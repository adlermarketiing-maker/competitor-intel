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

/**
 * Returns true if the page name found in Meta Ad Library reasonably matches the competitor name.
 * Prevents saving a wrong page ID when keyword search returns unrelated pages.
 */
function pageNameMatchesCompetitor(pageName: string, competitorName: string): boolean {
  if (!pageName) return false
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
  const normPage = normalize(pageName)
  const normComp = normalize(competitorName)

  // Exact or substring match
  if (normPage.includes(normComp) || normComp.includes(normPage)) return true

  // Any significant word (>3 chars) from competitor name appears in page name
  const compWords = normComp.split(/\s+/).filter((w) => w.length > 3)
  return compWords.some((word) => normPage.includes(word))
}

async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const { jobDbId, competitorId, jobType, countries } = job.data

  await updateScrapeJob(jobDbId, { status: 'RUNNING', startedAt: new Date() })
  await emit(jobDbId, 'progress', 'Iniciando scraping...')

  const competitor = await getCompetitor(competitorId)
  if (!competitor) throw new Error('Competitor not found')

  const token = await getMetaToken()

  const settings = await getSettings()
  const effectiveCountries = countries.length > 0 ? countries : (settings?.countries ?? ['ES', 'MX'])

  let completedTasks = 0
  let failedTasks = 0

  // ── Step 1: Fetch ads from Meta Ad Library ──────────────────────────────────
  if (jobType === 'FULL_SCRAPE' || jobType === 'ADS_ONLY') {
    await emit(jobDbId, 'progress', 'Buscando anuncios en Meta Ad Library...')

    const pageIds = competitor.fbPageId ? [competitor.fbPageId] : undefined
    // Always use the human-readable name for page search (handles like "elartedelaquietud" return wrong pages)
    const searchTerms = competitor.name

    let adsRaw: import('@/types/scrape').MetaAdRaw[] = []
    try {
      adsRaw = await fetchAdsForCompetitor(token, {
        searchTerms: pageIds ? undefined : searchTerms,
        pageIds,
        countries: effectiveCountries,
        onProgress: async (count) => {
          await emit(jobDbId, 'progress', `Anuncios encontrados: ${count}...`)
        },
        onLog: async (msg) => {
          await emit(jobDbId, 'progress', msg)
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
      // Only save the page ID if the found page name actually resembles the competitor name
      // (prevents saving a wrong page ID when search matches unrelated ads)
      const firstAd = adsRaw[0]
      const pageId = firstAd.page_id
      const foundPageName = firstAd.page_name ?? ''
      const isMatchingPage = pageNameMatchesCompetitor(foundPageName, competitor.name)

      const updateData: Record<string, string> = {}
      if (pageId && isMatchingPage) {
        updateData.fbPageId = pageId
        await emit(jobDbId, 'progress', `✓ Page ID detectado: ${pageId} (${foundPageName})`)
      } else if (pageId && !isMatchingPage) {
        await emit(jobDbId, 'progress', `⚠ Página encontrada "${foundPageName}" no coincide con "${competitor.name}" — no se guarda el Page ID`)
      }

      const pageName = firstAd.page_name || competitor.fbPageName || competitor.name
      if (pageName) {
        updateData.adLibraryUrl = buildAdLibraryUrl(pageName, effectiveCountries)
        if (!competitor.facebookUrl) updateData.facebookUrl = buildFacebookPageUrl(pageName)
        if (!competitor.instagramUrl) updateData.instagramUrl = buildInstagramUrl(pageName)
      }
      if (Object.keys(updateData).length > 0) await updateCompetitor(competitorId, updateData)
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

  // ── Step 1b: Extract real social links from competitor's own website ────────
  const freshCompetitor = await getCompetitor(competitorId)
  if (freshCompetitor?.websiteUrl && (!freshCompetitor.instagramUrl || !freshCompetitor.facebookUrl)) {
    try {
      await emit(jobDbId, 'progress', `Extrayendo redes sociales desde ${freshCompetitor.websiteUrl}...`)
      const siteContent = await scrapePage(freshCompetitor.websiteUrl)
      const socialUpdates: Record<string, string> = {}

      for (const link of siteContent.outboundLinks) {
        try {
          const parsed = new URL(link)
          const hostname = parsed.hostname.replace(/^www\./, '')
          const clean = link.split('?')[0].replace(/\/$/, '')

          if (!socialUpdates.instagramUrl && !freshCompetitor.instagramUrl && hostname === 'instagram.com') {
            // Avoid post/reel/story links — only profile URLs
            if (!/\/(p|reel|tv|stories)\//.test(parsed.pathname)) {
              socialUpdates.instagramUrl = clean
            }
          }
          if (!socialUpdates.facebookUrl && !freshCompetitor.facebookUrl && hostname === 'facebook.com') {
            // Avoid facebook.com/ads or other meta pages
            if (!/\/(ads|business|pages\/create)/.test(parsed.pathname)) {
              socialUpdates.facebookUrl = clean
            }
          }
        } catch {
          // ignore malformed URLs
        }
      }

      if (Object.keys(socialUpdates).length > 0) {
        await updateCompetitor(competitorId, socialUpdates)
        const found = Object.entries(socialUpdates).map(([k, v]) => `${k}: ${v}`).join(', ')
        await emit(jobDbId, 'progress', `✓ Redes sociales encontradas en web: ${found}`)
      } else {
        await emit(jobDbId, 'progress', `Sin redes sociales en la web del competidor`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emit(jobDbId, 'error', `Error extrayendo redes sociales de web: ${msg}`)
    }
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
