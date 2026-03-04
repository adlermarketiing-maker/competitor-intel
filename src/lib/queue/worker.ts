import { Worker, Job } from 'bullmq'
import { getRedisConnectionOpts } from './bullmq'
import { publishJobEvent } from './events'
import { getMetaToken } from '@/lib/db/settings'
import { getSettings } from '@/lib/db/settings'
import { fetchAdsForCompetitor, buildAdLibraryUrl, buildFacebookPageUrl, buildInstagramUrl } from '@/lib/meta/adLibrary'
import { upsertAd } from '@/lib/db/ads'
import { upsertLandingPage } from '@/lib/db/landings'
import { saveFunnelSteps } from '@/lib/db/funnels'
import { updateScrapeJob, getScrapeJob } from '@/lib/db/jobs'
import { getCompetitor, updateCompetitor } from '@/lib/db/competitors'
import { scrapePage } from '@/lib/scraper/puppeteer'
import { detectFunnelChain } from '@/lib/scraper/funnel'
import { randomUUID } from 'crypto'
import type { ScrapeJobData, JobStatus } from '@/types/scrape'

async function emit(jobId: string, type: string, message: string, extra?: object) {
  await publishJobEvent(jobId, { type, message, ...extra })
}

async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const { jobDbId, competitorId, jobType, countries } = job.data

  await updateScrapeJob(jobDbId, { status: 'RUNNING', startedAt: new Date() })
  await emit(jobDbId, 'progress', 'Iniciando scraping...')

  const competitor = await getCompetitor(competitorId)
  if (!competitor) throw new Error('Competitor not found')

  const token = await getMetaToken()
  if (!token) throw new Error('No Meta token configured. Please add your token in Settings.')

  const settings = await getSettings()
  const effectiveCountries = countries.length > 0 ? countries : (settings?.countries ?? ['ES', 'MX'])

  let completedTasks = 0
  let failedTasks = 0

  // ── Step 1: Fetch ads from Meta Ad Library ──────────────────────────────────
  if (jobType === 'FULL_SCRAPE' || jobType === 'ADS_ONLY') {
    await emit(jobDbId, 'progress', 'Buscando anuncios en Meta Ad Library...')

    const pageIds = competitor.fbPageId ? [competitor.fbPageId] : undefined
    const searchTerms = competitor.fbPageName || competitor.searchTerm || competitor.name

    let adsRaw: import('@/types/scrape').MetaAdRaw[] = []
    try {
      adsRaw = await fetchAdsForCompetitor(token, {
        searchTerms: pageIds ? undefined : searchTerms,
        pageIds,
        countries: effectiveCountries,
        onProgress: async (count) => {
          await emit(jobDbId, 'progress', `Anuncios encontrados: ${count}...`)
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emit(jobDbId, 'error', `Error al buscar anuncios: ${msg}`)
      failedTasks++
      adsRaw = []
    }

    await updateScrapeJob(jobDbId, { totalTasks: adsRaw.length })
    await emit(jobDbId, 'progress', `${adsRaw.length} anuncios encontrados. Guardando...`)

    // Resolve page ID and profile URLs from first ad if not already set
    if (adsRaw.length > 0 && !competitor.fbPageId) {
      const firstAd = adsRaw[0]
      const pageId = firstAd.page_id
      const pageName = firstAd.page_name || competitor.fbPageName || competitor.name

      const updateData: Record<string, string> = {}
      if (pageId) updateData.fbPageId = pageId
      if (pageName) {
        updateData.facebookUrl = buildFacebookPageUrl(pageName)
        updateData.instagramUrl = competitor.instagramUrl || buildInstagramUrl(pageName)
        updateData.adLibraryUrl = buildAdLibraryUrl(pageName, effectiveCountries)
      }
      await updateCompetitor(competitorId, updateData)
    } else if (!competitor.adLibraryUrl) {
      const pageName = competitor.fbPageName || competitor.name
      await updateCompetitor(competitorId, {
        adLibraryUrl: buildAdLibraryUrl(pageName, effectiveCountries),
        facebookUrl: competitor.facebookUrl || buildFacebookPageUrl(pageName),
        instagramUrl: competitor.instagramUrl || buildInstagramUrl(pageName),
      })
    }

    // Save ads
    for (const raw of adsRaw) {
      try {
        await upsertAd(competitorId, raw)
        completedTasks++
        await updateScrapeJob(jobDbId, { completedTasks })
      } catch {
        failedTasks++
      }
    }

    await emit(jobDbId, 'progress', `✓ ${completedTasks} anuncios guardados`)
  }

  // ── Step 2: Scrape landing pages ────────────────────────────────────────────
  if (jobType === 'FULL_SCRAPE' || jobType === 'LANDING_PAGES') {
    const { db } = await import('@/lib/db/client')
    const ads = await db.ad.findMany({
      where: { competitorId, landingUrl: { not: null } },
      select: { id: true, landingUrl: true },
    })

    const uniqueUrls = new Map<string, string>()
    for (const ad of ads) {
      if (ad.landingUrl) uniqueUrls.set(ad.landingUrl, ad.id)
    }

    await emit(jobDbId, 'progress', `Scrapeando ${uniqueUrls.size} landing pages...`)

    let landingsDone = 0
    for (const [url, adId] of uniqueUrls.entries()) {
      try {
        await emit(jobDbId, 'progress', `Scrapeando: ${url}`)
        const content = await scrapePage(url)
        const lp = await upsertLandingPage(adId, content)

        // Build funnel chain from this landing
        if (jobType === 'FULL_SCRAPE' && content.outboundLinks.length > 0) {
          const funnelId = randomUUID()
          const funnelChain = await detectFunnelChain(url, async (step) => {
            await emit(jobDbId, 'progress', `  Funnel paso ${step.url}`)
          })

          if (funnelChain.length > 1) {
            await saveFunnelSteps(
              competitorId,
              funnelId,
              funnelChain.map((s) => ({
                url: s.url,
                pageType: s.pageType,
                landingPageId: s.url === lp.url ? lp.id : undefined,
              }))
            )
          }
        }

        landingsDone++
        await emit(jobDbId, 'progress', `✓ Landing scrapeada (${landingsDone}/${uniqueUrls.size})`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'error', `Error scrapeando ${url}: ${msg}`)
      }

      // Pause between pages to be polite
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  // ── Finalize ────────────────────────────────────────────────────────────────
  await updateCompetitor(competitorId, { lastScrapedAt: new Date() })
  const finalStatus: JobStatus = failedTasks === 0 ? 'COMPLETE' : 'PARTIAL'
  await updateScrapeJob(jobDbId, {
    status: finalStatus,
    completedAt: new Date(),
    failedTasks,
  })
  await emit(jobDbId, 'status', 'Scraping completado', { status: finalStatus })
}

export function startWorker() {
  const worker = new Worker<ScrapeJobData>('scrapeCompetitor', processScrapeJob, {
    connection: getRedisConnectionOpts(),
    concurrency: 1,
  })

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`)
  })
  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message)
    if (job?.data?.jobDbId) {
      updateScrapeJob(job.data.jobDbId, {
        status: 'FAILED',
        errorMessage: err.message,
        completedAt: new Date(),
      }).catch(() => {})
      publishJobEvent(job.data.jobDbId, {
        type: 'status',
        message: `Error: ${err.message}`,
        status: 'FAILED',
      }).catch(() => {})
    }
  })
  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err)
  })

  console.log('[Worker] Scrape competitor worker started')
  return worker
}
