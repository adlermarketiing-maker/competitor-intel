import { Worker, Job } from 'bullmq'
import { getRedisConnectionOpts } from './bullmq'
import { publishJobEvent } from './events'
import { getMetaToken } from '@/lib/db/settings'
import { getSettings } from '@/lib/db/settings'
import { fetchAdsForCompetitor, buildAdLibraryUrl, buildFacebookPageUrl, buildInstagramUrl } from '@/lib/meta/adLibrary'
import { upsertAd, markEliminatedAds, detectLaunch } from '@/lib/db/ads'
import { upsertLandingPage } from '@/lib/db/landings'
import { updateScrapeJob } from '@/lib/db/jobs'
import { getCompetitor, updateCompetitor } from '@/lib/db/competitors'
import { scrapePage, isPuppeteerAvailable } from '@/lib/scraper/puppeteer'
import { discoverUrlsFromSitemap, probeCommonPaths } from '@/lib/scraper/sitemap'
import { isSameDomain, isSocialMediaUrl, isLinkInBioService } from '@/lib/utils/urls'
import type { ScrapeJobData, JobStatus } from '@/types/scrape'

async function emit(jobId: string, type: string, message: string, extra?: object) {
  try {
    await publishJobEvent(jobId, { type, message, ...extra })
  } catch {
    // Don't let Redis failures break the scraping pipeline
    console.warn(`[Worker] Failed to emit event: ${message}`)
  }
}

/** Strip fragment (#...) and trailing slash so url.com and url.com#precio are the same */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    let str = u.toString()
    if (str.endsWith('/') && u.pathname !== '/') str = str.slice(0, -1)
    return str
  } catch {
    return url.split('#')[0]
  }
}

/** URLs that are never useful as landing pages */
function isJunkUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    const hostname = u.hostname.replace(/^www\./, '')
    // Instagram login / profile pages
    if (hostname === 'instagram.com' || hostname === 'www.instagram.com') return true
    // Facebook pages (not useful as landing)
    if (hostname === 'facebook.com' || hostname === 'www.facebook.com') return true
    // Privacy, legal, cookies pages
    if (/\/(privacy|privacidad|legal|terms|terminos|cookies|aviso-legal|politica-de-privacidad|cookie-policy|terms-of-service)\b/i.test(path)) return true
    // Non-page resources
    if (/\.(pdf|zip|mp3|mp4|avi|mov|doc|docx|xls|xlsx|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(path)) return true
    // mailto/tel/javascript
    if (/^(mailto|tel|javascript):/.test(url)) return true
    // Empty path with just fragment
    if (path === '/' && u.hash && !u.search) return false // root is ok
    return false
  } catch {
    return false
  }
}

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
      } catch (err) {
        console.error(`[Worker] Error saving ad:`, err instanceof Error ? err.message : err)
        failedTasks++
      }
    }

    await emit(jobDbId, 'progress', `${completedTasks} anuncios guardados`)

    // Mark ads not found in this scrape as "eliminado"
    const scrapedMetaAdIds = adsRaw.map((a) => a.id)
    try {
      const { eliminatedCount, retiredWinners } = await markEliminatedAds(competitorId, scrapedMetaAdIds)
      if (eliminatedCount > 0) {
        await emit(jobDbId, 'progress', `${eliminatedCount} anuncios marcados como eliminados`)
      }
      for (const rw of retiredWinners) {
        await emit(jobDbId, 'progress', `⚠️ Winner retirado: anuncio ${rw.metaAdId} (${rw.daysActive} días activo)`)
        if (rw.daysActive >= 10) {
          try {
            const { alertWinnerRetired } = await import('@/lib/telegram/alerts')
            await alertWinnerRetired(competitor.name, rw.metaAdId, rw.daysActive, rw.headline)
          } catch { /* ignore telegram errors */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emit(jobDbId, 'error', `Error marcando eliminados: ${msg}`)
    }

    // Detect launch (5+ new ads)
    try {
      const { isLaunch, newAdsCount } = await detectLaunch(competitorId)
      if (isLaunch) {
        await emit(jobDbId, 'progress', `🚀 Lanzamiento detectado: ${newAdsCount} anuncios nuevos en los últimos 3 días`)
        try {
          const { alertLaunchDetected } = await import('@/lib/telegram/alerts')
          await alertLaunchDetected(competitor.name, newAdsCount)
        } catch { /* ignore telegram errors */ }
      }
    } catch { /* ignore */ }

    // AI tag analysis for unanalyzed ads
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { getUnanalyzedAds } = await import('@/lib/db/adAnalysis')
        const { analyzeAdTags } = await import('@/lib/analysis/adTags')
        const { saveAdAnalysis } = await import('@/lib/db/adAnalysis')

        const unanalyzed = await getUnanalyzedAds(50)
        const toAnalyze = unanalyzed.filter((a) =>
          a.adCopyBodies.length > 0 || a.headline || a.description
        )

        if (toAnalyze.length > 0) {
          await emit(jobDbId, 'progress', `Analizando ${toAnalyze.length} anuncios con IA...`)
          let analyzed = 0
          for (const ad of toAnalyze) {
            try {
              const tags = await analyzeAdTags({
                copyBodies: ad.adCopyBodies,
                headline: ad.headline,
                description: ad.description,
                caption: ad.caption,
                ctaType: ad.ctaType,
                hasVideo: ad.videoUrls.length > 0,
                hasImages: ad.imageUrls.length > 0,
                imageCount: ad.imageUrls.length,
              })
              await saveAdAnalysis(ad.id, tags)
              analyzed++
              if (analyzed % 10 === 0) {
                await emit(jobDbId, 'progress', `IA: ${analyzed}/${toAnalyze.length} anuncios analizados`)
              }
            } catch (err) {
              console.error(`[Worker] Ad analysis error (${ad.id}):`, err instanceof Error ? err.message : err)
            }
            await new Promise((r) => setTimeout(r, 300))
          }
          await emit(jobDbId, 'progress', `IA: ${analyzed} anuncios analizados con tags`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'progress', `Error en análisis IA de anuncios: ${msg}`)
      }
    }
  }

  // ── Step 1b: Extract real social links from competitor's own website ────────
  const freshCompetitor = await getCompetitor(competitorId)
  if (freshCompetitor?.websiteUrl && (!freshCompetitor.instagramUrl || !freshCompetitor.facebookUrl)) {
    try {
      await emit(jobDbId, 'progress', `Extrayendo redes sociales desde ${freshCompetitor.websiteUrl}...`)
      const siteContent = await scrapePage(freshCompetitor.websiteUrl)

      if (siteContent.error) {
        await emit(jobDbId, 'progress', `Aviso al scrapear web: ${siteContent.error}`)
      }

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
        } catch { /* ignore malformed URLs */ }
      }

      if (Object.keys(socialUpdates).length > 0) {
        await updateCompetitor(competitorId, socialUpdates)
        const found = Object.entries(socialUpdates).map(([k, v]) => `${k}: ${v}`).join(', ')
        await emit(jobDbId, 'progress', `Redes sociales encontradas en web: ${found}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emit(jobDbId, 'progress', `Error extrayendo redes sociales de web: ${msg}`)
    }
  }

  // ── Step 2: Discover and scrape ALL landing pages ─────────────────────────
  if (jobType === 'FULL_SCRAPE' || jobType === 'LANDING_PAGES') {
    const discoveredUrls = new Map<string, string>() // normalized url -> source label

    /** Add a URL to the discovery map, normalizing and filtering junk */
    const addUrl = (url: string, source: string) => {
      const norm = normalizeUrl(url)
      if (!discoveredUrls.has(norm) && !isJunkUrl(norm)) {
        discoveredUrls.set(norm, source)
      }
    }

    const mode = isPuppeteerAvailable() === false ? 'fetch' : 'puppeteer'
    await emit(jobDbId, 'progress', `Modo de scraping: ${mode === 'fetch' ? 'fetch (sin Chrome)' : 'Chrome + fallback'}`)

    // Source A: Landing URLs from ads (this always works — no scraping needed)
    const { db } = await import('@/lib/db/client')
    const ads = await db.ad.findMany({
      where: { competitorId, landingUrl: { not: null } },
      select: { id: true, landingUrl: true },
    })
    for (const ad of ads) {
      if (ad.landingUrl) addUrl(ad.landingUrl, 'ad')
    }
    await emit(jobDbId, 'progress', `${discoveredUrls.size} URLs de anuncios`)

    // Source B: Crawl competitor's website for internal links
    const latestComp = await getCompetitor(competitorId)
    if (latestComp?.websiteUrl) {
      try {
        await emit(jobDbId, 'progress', `Rastreando web: ${latestComp.websiteUrl}...`)
        const siteContent = await scrapePage(latestComp.websiteUrl)

        // Save homepage as a landing page too
        addUrl(siteContent.url || latestComp.websiteUrl, 'homepage')

        if (siteContent.error) {
          await emit(jobDbId, 'progress', `Aviso homepage: ${siteContent.error}`)
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
          return [...new Map(links.map((u) => {
            try { return [new URL(u).pathname, u] } catch { return [u, u] }
          })).values()]
        }

        // Level 1: internal links from homepage
        const level1Links = collectInternalLinks(siteContent.outboundLinks, latestComp.websiteUrl)
        await emit(jobDbId, 'progress', `${level1Links.length} links internos en homepage`)

        for (const link of level1Links) {
          addUrl(link, 'website')
        }

        // Check for external links (payment platforms, link-in-bio, etc.)
        for (const link of siteContent.outboundLinks) {
          if (isLinkInBioService(link)) addUrl(link, 'linkinbio')
          // Also add external non-social links that could be product/sales pages
          try {
            if (!isSameDomain(link, latestComp.websiteUrl) && !isSocialMediaUrl(link) && !isJunkUrl(link)) {
              const hostname = new URL(link).hostname
              // Skip common non-landing external domains
              if (!/google\.|gstatic\.|googleapis\.|cloudflare\.|cdn\.|analytics\.|pixel\.|fonts\./i.test(hostname)) {
                addUrl(link, 'external')
              }
            }
          } catch { /* ignore */ }
        }

        // Level 2: crawl level-1 pages (limit to 15 for speed)
        const level1ToCrawl = level1Links.slice(0, 15)
        let level2Count = 0
        for (const subUrl of level1ToCrawl) {
          try {
            const subContent = await scrapePage(subUrl)
            const level2Links = collectInternalLinks(subContent.outboundLinks, latestComp.websiteUrl)
            for (const link of level2Links) {
              const before = discoveredUrls.size
              addUrl(link, 'website-deep')
              if (discoveredUrls.size > before) level2Count++
            }
            for (const link of subContent.outboundLinks) {
              if (isLinkInBioService(link)) addUrl(link, 'linkinbio')
            }
            await new Promise((r) => setTimeout(r, 500))
          } catch { /* ignore errors on individual subpages */ }
        }
        if (level2Count > 0) {
          await emit(jobDbId, 'progress', `${level2Count} links adicionales en subpáginas`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'progress', `Error rastreando web: ${msg}`)
      }

      // Source B2: Sitemap.xml discovery (works even when homepage returns 403)
      try {
        await emit(jobDbId, 'progress', `Buscando sitemap.xml en ${latestComp.websiteUrl}...`)
        const sitemapUrls = await discoverUrlsFromSitemap(latestComp.websiteUrl, {
          maxUrls: 150,
          onProgress: async (msg) => await emit(jobDbId, 'progress', msg),
        })
        let sitemapNew = 0
        for (const sUrl of sitemapUrls) {
          try {
            if (isSameDomain(sUrl, latestComp.websiteUrl) && !isSocialMediaUrl(sUrl) && !isJunkUrl(sUrl)) {
              const before = discoveredUrls.size
              addUrl(sUrl, 'sitemap')
              if (discoveredUrls.size > before) sitemapNew++
            }
          } catch { /* ignore */ }
        }
        if (sitemapNew > 0) {
          await emit(jobDbId, 'progress', `${sitemapNew} URLs nuevas del sitemap`)
        } else if (sitemapUrls.length === 0) {
          await emit(jobDbId, 'progress', 'No se encontró sitemap.xml')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'progress', `Error leyendo sitemap: ${msg}`)
      }

      // Source B3: Probe common paths (fallback if sitemap + crawl found very few URLs)
      if (discoveredUrls.size < 5) {
        try {
          await emit(jobDbId, 'progress', 'Pocas URLs encontradas, probando rutas comunes...')
          const commonUrls = await probeCommonPaths(latestComp.websiteUrl)
          for (const cUrl of commonUrls) {
            addUrl(cUrl, 'common-path')
          }
          if (commonUrls.length > 0) {
            await emit(jobDbId, 'progress', `${commonUrls.length} rutas comunes accesibles`)
          }
        } catch { /* ignore */ }
      }
    }

    // Source C: Instagram bio link
    const compForSocial = await getCompetitor(competitorId)
    if (compForSocial?.instagramUrl) {
      try {
        await emit(jobDbId, 'progress', `Buscando link en bio de Instagram...`)
        const igContent = await scrapePage(compForSocial.instagramUrl)

        for (const link of igContent.outboundLinks) {
          try {
            if (!isSocialMediaUrl(link)) {
              addUrl(link, isLinkInBioService(link) ? 'ig-linkinbio' : 'ig-bio')
            }
          } catch { /* ignore */ }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'progress', `No se pudo acceder a Instagram: ${msg}`)
      }
    }

    // Source D: Crawl ALL link-in-bio pages (regardless of how they were discovered)
    const linkInBioUrls = [...discoveredUrls.keys()].filter((url) => isLinkInBioService(url))

    for (const bioUrl of linkInBioUrls) {
      try {
        await emit(jobDbId, 'progress', `Rastreando link-in-bio: ${bioUrl}...`)
        const bioContent = await scrapePage(bioUrl, { waitUntil: 'networkidle2' })

        let linksFound = 0
        for (const link of bioContent.outboundLinks) {
          try {
            if (!isSocialMediaUrl(link) && !isJunkUrl(link)) {
              const before = discoveredUrls.size
              addUrl(link, 'linkinbio-link')
              if (discoveredUrls.size > before) linksFound++
            }
          } catch { /* ignore */ }
        }
        if (linksFound > 0) {
          await emit(jobDbId, 'progress', `${linksFound} links descubiertos en link-in-bio`)
        } else {
          await emit(jobDbId, 'progress', `Link-in-bio scrapeado pero sin links adicionales (${bioContent.outboundLinks.length} links totales, ${bioContent.error || 'sin error'})`)
        }
        await new Promise((r) => setTimeout(r, 500))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await emit(jobDbId, 'progress', `Error en link-in-bio ${bioUrl}: ${msg}`)
      }
    }

    await emit(jobDbId, 'progress', `Total URLs descubiertas: ${discoveredUrls.size}`)

    // Build a map of landing URL -> ad ID for linking
    const urlToAdId = new Map<string, string>()
    for (const ad of ads) {
      if (ad.landingUrl) urlToAdId.set(normalizeUrl(ad.landingUrl), ad.id)
    }

    // ── Scrape all discovered URLs ──────────────────────────────────
    if (discoveredUrls.size === 0) {
      await emit(jobDbId, 'progress', 'No se encontraron URLs de landing pages para scrapear')
    } else {
      await emit(jobDbId, 'progress', `Scrapeando ${discoveredUrls.size} landing pages...`)
      let landingsDone = 0
      let landingsFailed = 0
      const scrapedLandings: Array<{ url: string; adId: string | null; content: Awaited<ReturnType<typeof scrapePage>> }> = []

      for (const [url, source] of discoveredUrls.entries()) {
        try {
          const isLinkBio = isLinkInBioService(url)
          const content = await scrapePage(url, isLinkBio ? { waitUntil: 'networkidle2' } : undefined)

          // Normalize URL from browser (may add fragments or trailing slashes)
          content.url = normalizeUrl(content.url)

          const adId = urlToAdId.get(url) ?? null
          scrapedLandings.push({ url, adId, content })

          landingsDone++
          if (landingsDone % 5 === 0 || landingsDone === discoveredUrls.size) {
            await emit(jobDbId, 'progress', `Landing scrapeada (${landingsDone}/${discoveredUrls.size})`)
          }
        } catch (err) {
          landingsFailed++
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[Worker] Error scraping ${url}: ${msg}`)
        }

        // Pause between pages
        await new Promise((r) => setTimeout(r, 600))
      }

      if (landingsFailed > 0) {
        await emit(jobDbId, 'progress', `${landingsFailed} landings fallaron al scrapear`)
      }

      // ── Save landing pages to database ──────────────────────────────
      // Save individually (not in a transaction) to avoid holding a DB connection
      // for minutes, which causes MaxClientsInSessionMode on Supabase pooler
      if (scrapedLandings.length > 0) {
        await emit(jobDbId, 'progress', `Guardando ${scrapedLandings.length} landing pages...`)

        // Clear old landings first
        try {
          await db.landingPage.deleteMany({ where: { competitorId } })
        } catch (err) {
          console.error(`[Worker] Error clearing old landings:`, err instanceof Error ? err.message : err)
        }

        let savedCount = 0
        for (const { adId, content } of scrapedLandings) {
          try {
            await upsertLandingPage(competitorId, adId, content)
            savedCount++
          } catch (err) {
            console.error(`[Worker] Error saving landing ${content.url}:`, err instanceof Error ? err.message : err)
          }
        }
        await emit(jobDbId, 'progress', `${savedCount}/${scrapedLandings.length} landings guardadas`)
      }
    }
  }

  // ── Step 3: AI Funnel Hacking analysis ──────────────────────────────────────
  if (jobType === 'FULL_SCRAPE' && process.env.ANTHROPIC_API_KEY) {
    try {
      const { db: prisma } = await import('@/lib/db/client')
      const landingPages = await prisma.landingPage.findMany({
        where: { competitorId },
        select: { url: true, title: true, h1Texts: true, h2Texts: true, ctaTexts: true, prices: true, bodyText: true },
        orderBy: { scrapedAt: 'desc' },
        take: 15,
      })

      if (landingPages.length > 0) {
        await emit(jobDbId, 'progress', `Analizando funnel con IA (${landingPages.length} páginas)...`)
        const { analyzeFunnel } = await import('@/lib/analysis/funnelHacking')
        const analysis = await analyzeFunnel({ competitorName: competitor.name, pages: landingPages })

        await updateCompetitor(competitorId, {
          ...analysis,
          funnelAnalyzedAt: new Date(),
        })

        // Auto-generate Semrush URL from website domain
        const latestComp = await getCompetitor(competitorId)
        if (latestComp?.websiteUrl && !latestComp.semrushUrl) {
          try {
            const domain = new URL(latestComp.websiteUrl).hostname.replace(/^www\./, '')
            await updateCompetitor(competitorId, {
              semrushUrl: `https://www.semrush.com/analytics/overview/?q=${encodeURIComponent(domain)}`,
            })
          } catch { /* ignore URL parse errors */ }
        }

        await emit(jobDbId, 'progress', 'Funnel hacking: análisis IA completado')
      } else {
        await emit(jobDbId, 'progress', 'Sin landing pages para análisis de funnel')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emit(jobDbId, 'progress', `Error en análisis de funnel: ${msg}`)
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
  const worker = new Worker<ScrapeJobData>('scrapeCompetitor', async (job) => {
    try {
      await processScrapeJob(job)
    } catch (err) {
      // Ensure job status is ALWAYS updated even on unexpected errors
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Worker] processScrapeJob crashed:`, msg)

      try {
        await updateScrapeJob(job.data.jobDbId, {
          status: 'FAILED',
          errorMessage: msg.slice(0, 500),
          completedAt: new Date(),
        })
      } catch (dbErr) {
        console.error(`[Worker] Failed to update job status after crash:`, dbErr)
      }

      try {
        await emit(job.data.jobDbId, 'status', `Error: ${msg}`, { status: 'FAILED' })
      } catch { /* ignore emit failure */ }

      throw err // Re-throw so BullMQ knows the job failed
    }
  }, {
    connection: getRedisConnectionOpts(),
    concurrency: 1,
    lockDuration: 300000,     // 5 min — scrape jobs are long-running
    stalledInterval: 30000,   // check for stalled jobs every 30s
    maxStalledCount: 2,       // retry stalled jobs up to 2 times before failing
  })

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`)
  })
  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message)
    if (job?.data?.jobDbId) {
      updateScrapeJob(job.data.jobDbId, {
        status: 'FAILED',
        errorMessage: err.message.slice(0, 500),
        completedAt: new Date(),
      }).catch((e) => console.error('[Worker] Failed to update job status:', e))
      publishJobEvent(job.data.jobDbId, {
        type: 'status',
        message: `Error: ${err.message}`,
        status: 'FAILED',
      }).catch((e) => console.error('[Worker] Failed to publish failure event:', e))
    }
  })
  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled — will be retried`)
  })
  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err)
  })

  // Clean up stalled/stuck jobs from previous crashes on startup
  cleanupStalledJobs().catch((e) => console.error('[Worker] Cleanup error:', e))

  console.log('[Worker] Scrape competitor worker started')
  return worker
}

/** Mark DB jobs stuck in RUNNING/PENDING (from previous crashes) as FAILED */
async function cleanupStalledJobs() {
  try {
    const { db: prisma } = await import('@/lib/db/client')
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000) // 15 min ago

    const stuckJobs = await prisma.scrapeJob.findMany({
      where: {
        status: { in: ['RUNNING', 'PENDING'] },
        createdAt: { lt: staleThreshold },
      },
      select: { id: true, status: true },
    })

    if (stuckJobs.length > 0) {
      console.log(`[Worker] Found ${stuckJobs.length} stuck jobs from previous crashes, marking as FAILED`)
      await prisma.scrapeJob.updateMany({
        where: { id: { in: stuckJobs.map((j) => j.id) } },
        data: { status: 'FAILED', errorMessage: 'Marked as failed: worker restarted', completedAt: new Date() },
      })
    }
  } catch (err) {
    console.error('[Worker] Failed to clean up stalled jobs:', err instanceof Error ? err.message : err)
  }
}
