import { Worker, Job } from 'bullmq'
import { getRedisConnectionOpts } from './bullmq'
import { publishJobEvent } from './events'
import { getMetaToken } from '@/lib/db/settings'
import { getSettings } from '@/lib/db/settings'
import { fetchAdsForCompetitor, buildAdLibraryUrl, buildFacebookPageUrl, buildInstagramUrl } from '@/lib/meta/adLibrary'
import { upsertAd } from '@/lib/db/ads'
import { upsertLandingPage } from '@/lib/db/landings'
import { updateScrapeJob } from '@/lib/db/jobs'
import { getCompetitor, updateCompetitor } from '@/lib/db/competitors'
import { scrapePage } from '@/lib/scraper/puppeteer'
import { isSameDomain, isSocialMediaUrl, isLinkInBioService } from '@/lib/utils/urls'
import type { ScrapeJobData, JobStatus } from '@/types/scrape'

async function emit(jobId: string, type: string, message: string, extra?: object) {
  await publishJobEvent(jobId, { type, message, ...extra })
}

/**
 * Returns true if the page name found in Meta Ad Library reasonably matches the competitor name.
 */
function pageNameMatchesCompetitor(pageName: string, competitorName: string): boolean {
  if (!pageName) return false
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
  const normPage = normalize(pageName)
  const normComp = normalize(competitorName)

  if (normPage.includes(normComp) || normComp.includes(normPage)) return true

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
      const firstAd = adsRaw[0]
      const pageId = firstAd.page_id
      const foundPageName = firstAd.page_name ?? ''
      const isMatchingPage = pageNameMatchesCompetitor(foundPageName, competitor.name)

      const updateData: Record<string, string> = {}
      if (pageId && isMatchingPage) {
        updateData.fbPageId = pageId
        await emit(jobDbId, 'progress', `Page ID detectado: ${pageId} (${foundPageName})`)
      } else if (pageId && !isMatchingPage) {
        await emit(jobDbId, 'progress', `Pagina encontrada "${foundPageName}" no coincide con "${competitor.name}" — no se guarda el Page ID`)
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

    await emit(jobDbId, 'progress', `${completedTasks} anuncios guardados`)
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
            if (!/\/(p|reel|tv|stories)\//.test(parsed.pathname)) {
              socialUpdates.instagramUrl = clean
            }
          }
          if (!socialUpdates.facebookUrl && !freshCompetitor.facebookUrl && hostname === 'facebook.com') {
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
        await emit(jobDbId, 'progress', `Redes sociales encontradas en web: ${found}`)
      } else {
        await emit(jobDbId, 'progress', `Sin redes sociales en la web del competidor`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emit(jobDbId, 'error', `Error extrayendo redes sociales de web: ${msg}`)
    }
  }

  // ── Step 2: Discover and scrape ALL landing pages ─────────────────────────
  if (jobType === 'FULL_SCRAPE' || jobType === 'LANDING_PAGES') {
    const discoveredUrls = new Map<string, string>() // url -> source label

    // Source A: Landing URLs from ads
    const { db } = await import('@/lib/db/client')
    const ads = await db.ad.findMany({
      where: { competitorId, landingUrl: { not: null } },
      select: { id: true, landingUrl: true },
    })
    for (const ad of ads) {
      if (ad.landingUrl && !discoveredUrls.has(ad.landingUrl)) {
        discoveredUrls.set(ad.landingUrl, 'ad')
      }
    }
    await emit(jobDbId, 'progress', `${discoveredUrls.size} URLs de anuncios`)

    // Source B: Deep crawl of competitor's website (2 levels deep)
    const latestComp = await getCompetitor(competitorId)
    if (latestComp?.websiteUrl) {
      try {
        await emit(jobDbId, 'progress', `Rastreando web: ${latestComp.websiteUrl}...`)
        const siteContent = await scrapePage(latestComp.websiteUrl)

        // Save homepage as a landing page too
        if (!discoveredUrls.has(siteContent.url)) {
          discoveredUrls.set(siteContent.url, 'homepage')
        }

        // Helper: collect internal links from a page's outbound links
        const collectInternalLinks = (outboundLinks: string[], baseUrl: string): string[] => {
          const links: string[] = []
          for (const link of outboundLinks) {
            try {
              if (isSameDomain(link, baseUrl) && !isSocialMediaUrl(link)) {
                links.push(link)
              }
            } catch { /* ignore */ }
          }
          // Deduplicate by pathname
          return [...new Map(links.map((u) => {
            try { return [new URL(u).pathname, u] } catch { return [u, u] }
          })).values()]
        }

        // Level 1: internal links from homepage
        const level1Links = collectInternalLinks(siteContent.outboundLinks, latestComp.websiteUrl)
        await emit(jobDbId, 'progress', `${level1Links.length} links internos en homepage`)

        for (const link of level1Links) {
          if (!discoveredUrls.has(link)) discoveredUrls.set(link, 'website')
        }

        // Level 2: crawl each level-1 page to find deeper links
        const level1ToCrawl = level1Links.slice(0, 20) // limit level-1 crawl
        let level2Count = 0
        for (const subUrl of level1ToCrawl) {
          try {
            const subContent = await scrapePage(subUrl)
            const level2Links = collectInternalLinks(subContent.outboundLinks, latestComp.websiteUrl)
            for (const link of level2Links) {
              if (!discoveredUrls.has(link)) {
                discoveredUrls.set(link, 'website-deep')
                level2Count++
              }
            }
            // Check for link-in-bio in subpages too
            for (const link of subContent.outboundLinks) {
              if (isLinkInBioService(link) && !discoveredUrls.has(link)) {
                discoveredUrls.set(link, 'linkinbio')
              }
            }
            await new Promise((r) => setTimeout(r, 800))
          } catch { /* ignore errors on individual subpages */ }
        }
        if (level2Count > 0) {
          await emit(jobDbId, 'progress', `${level2Count} links adicionales en subpáginas`)
        }

        // Check for link-in-bio services in homepage outbound links
        for (const link of siteContent.outboundLinks) {
          if (isLinkInBioService(link) && !discoveredUrls.has(link)) {
            discoveredUrls.set(link, 'linkinbio')
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'error', `Error rastreando web: ${msg}`)
      }
    }

    // Source C: Link-in-bio and Instagram bio link
    const compForSocial = await getCompetitor(competitorId)
    if (compForSocial?.instagramUrl) {
      try {
        await emit(jobDbId, 'progress', `Buscando link en bio de Instagram...`)
        const igContent = await scrapePage(compForSocial.instagramUrl)

        // Instagram pages often have the bio link as an outbound link
        for (const link of igContent.outboundLinks) {
          try {
            if (
              !isSocialMediaUrl(link) &&
              !discoveredUrls.has(link)
            ) {
              if (isLinkInBioService(link)) {
                discoveredUrls.set(link, 'ig-linkinbio')
              } else {
                discoveredUrls.set(link, 'ig-bio')
              }
            }
          } catch { /* ignore */ }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'progress', `No se pudo acceder a Instagram: ${msg}`)
      }
    }

    // Source D: If we found link-in-bio pages, crawl them to find more landing pages
    const linkInBioUrls = [...discoveredUrls.entries()]
      .filter(([, source]) => source.includes('linkinbio'))
      .map(([url]) => url)

    for (const bioUrl of linkInBioUrls) {
      try {
        await emit(jobDbId, 'progress', `Rastreando link-in-bio: ${bioUrl}...`)
        const bioContent = await scrapePage(bioUrl)

        for (const link of bioContent.outboundLinks) {
          try {
            if (
              !isSocialMediaUrl(link) &&
              !discoveredUrls.has(link)
            ) {
              discoveredUrls.set(link, 'linkinbio-link')
            }
          } catch { /* ignore */ }
        }
        await new Promise((r) => setTimeout(r, 800))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'error', `Error en link-in-bio ${bioUrl}: ${msg}`)
      }
    }

    // Build a map of landing URL -> ad ID for linking
    const urlToAdId = new Map<string, string>()
    for (const ad of ads) {
      if (ad.landingUrl) urlToAdId.set(ad.landingUrl, ad.id)
    }

    // Now scrape all discovered URLs
    await emit(jobDbId, 'progress', `${discoveredUrls.size} landing pages a scrapear...`)
    let landingsDone = 0

    for (const [url, source] of discoveredUrls.entries()) {
      try {
        await emit(jobDbId, 'progress', `Scrapeando (${source}): ${url}`)
        const content = await scrapePage(url)

        const adId = urlToAdId.get(url) ?? null
        await upsertLandingPage(competitorId, adId, content)

        landingsDone++
        await emit(jobDbId, 'progress', `Landing scrapeada (${landingsDone}/${discoveredUrls.size})`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'error', `Error scrapeando ${url}: ${msg}`)
      }

      // Pause between pages
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
