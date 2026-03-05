import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { MetaAdRaw } from '@/types/scrape'

puppeteerExtra.use(StealthPlugin())

interface FetchAdsOptions {
  searchTerms?: string
  pageIds?: string[]
  countries: string[]
  maxAds?: number
  onProgress?: (count: number) => void
}

// Recursively searches a parsed JSON object for nodes that look like ad records
function extractFromJson(obj: unknown, ads: MetaAdRaw[], seenIds: Set<string>): void {
  if (!obj || typeof obj !== 'object') return

  if (Array.isArray(obj)) {
    for (const item of obj) extractFromJson(item, ads, seenIds)
    return
  }

  const o = obj as Record<string, unknown>

  // Node looks like an ad record
  if (typeof o.ad_archive_id === 'string' && !seenIds.has(o.ad_archive_id)) {
    const ad = mapToMetaAdRaw(o)
    if (ad) {
      seenIds.add(o.ad_archive_id)
      ads.push(ad)
    }
    return
  }

  for (const val of Object.values(o)) {
    if (val && typeof val === 'object') extractFromJson(val, ads, seenIds)
  }
}

function mapToMetaAdRaw(node: Record<string, unknown>): MetaAdRaw | null {
  const id = node.ad_archive_id as string
  if (!id) return null

  const snapshot = (node.snapshot ?? node) as Record<string, unknown>
  const cards = (snapshot.cards as Array<Record<string, unknown>>) ?? []

  const bodies: string[] = []
  const images: MetaAdRaw['ad_creative_images'] = []

  // Main body text
  const bodyObj = snapshot.body as Record<string, unknown> | undefined
  const bodyText = (bodyObj?.text ?? snapshot.body_text ?? snapshot.ad_creative_body) as string | undefined
  if (bodyText) bodies.push(bodyText)

  // Card bodies + images
  for (const card of cards) {
    const t = card.body as string | undefined
    if (t) bodies.push(t)
    const img = (card.resized_image_url ?? card.original_image_url) as string | undefined
    if (img) images.push({ resized_image_url: img })
  }

  // Snapshot-level images
  const snapshotImages = snapshot.images as Array<Record<string, unknown>> | undefined
  if (snapshotImages) {
    for (const img of snapshotImages) {
      images.push({
        original_image_url: img.original_image_url as string | undefined,
        resized_image_url: img.resized_image_url as string | undefined,
      })
    }
  }

  const startDate = node.start_date ?? node.ad_delivery_start_time
  const endDate = node.end_date ?? node.ad_delivery_stop_time

  return {
    id,
    page_id: (node.page_id ?? (node.page as Record<string, unknown> | undefined)?.id) as string | undefined,
    page_name: (node.page_name ?? (node.page as Record<string, unknown> | undefined)?.name) as string | undefined,
    ad_creative_bodies: bodies.length > 0 ? bodies : undefined,
    ad_creative_link_titles: snapshot.title ? [snapshot.title as string] : undefined,
    ad_creative_link_descriptions: snapshot.link_description
      ? [snapshot.link_description as string]
      : undefined,
    ad_creative_link_url: (snapshot.link_url ?? snapshot.cta_link) as string | undefined,
    ad_creative_images: images.length > 0 ? images : undefined,
    ad_delivery_start_time: startDate
      ? typeof startDate === 'number'
        ? new Date(startDate * 1000).toISOString()
        : String(startDate)
      : undefined,
    ad_delivery_stop_time: endDate
      ? typeof endDate === 'number'
        ? new Date(endDate * 1000).toISOString()
        : String(endDate)
      : undefined,
    publisher_platforms: node.publisher_platform as string[] | undefined,
    ad_snapshot_url: `https://www.facebook.com/ads/archive/render_ad/?id=${id}`,
  }
}

function parseGraphQLText(text: string, ads: MetaAdRaw[], seenIds: Set<string>): void {
  if (!text.includes('ad_archive_id')) return

  // Facebook sometimes sends multiple JSON objects per response (one per line)
  const lines = text.split('\n').filter((l) => l.trimStart().startsWith('{'))
  for (const line of lines) {
    try {
      extractFromJson(JSON.parse(line), ads, seenIds)
    } catch {}
  }

  // Also try the full text as one JSON object
  if (lines.length === 0 || !text.includes('\n')) {
    try {
      extractFromJson(JSON.parse(text), ads, seenIds)
    } catch {}
  }
}

export async function scrapeAdLibrary(options: FetchAdsOptions): Promise<MetaAdRaw[]> {
  const country = options.countries[0] ?? 'ALL'
  const maxAds = options.maxAds ?? 100

  // Use ALL countries for broader results; keyword_unordered finds ads by content/page name
  const searchCountry = options.pageIds?.length ? country : 'ALL'
  const url = options.pageIds?.length
    ? `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${searchCountry}&view_all_page_id=${options.pageIds[0]}`
    : `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${searchCountry}&q=${encodeURIComponent(options.searchTerms ?? '')}&search_type=keyword_unordered`

  console.log(`[Scraper] Starting scrape: ${url}`)

  const browser = await puppeteerExtra.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=es-ES,es',
    ],
  })

  const seenIds = new Set<string>()
  const ads: MetaAdRaw[] = []
  let graphqlResponses = 0

  try {
    const page = await browser.newPage()

    // Bypass bot detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).chrome = { runtime: {} }
    })

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 900 })
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' })

    // Inject Facebook session cookies if provided (bypasses rate limiting on datacenter IPs)
    const fbCookiesEnv = process.env.FACEBOOK_COOKIES
    if (fbCookiesEnv) {
      try {
        const cookies = JSON.parse(fbCookiesEnv) as Array<{ name: string; value: string }>
        await page.setCookie(
          ...cookies.map((c) => ({ name: c.name, value: c.value, domain: '.facebook.com' }))
        )
        console.log(`[Scraper] Injected ${cookies.length} Facebook session cookies`)
      } catch {
        console.log('[Scraper] Warning: FACEBOOK_COOKIES env var is not valid JSON, ignoring')
      }
    } else {
      console.log('[Scraper] No FACEBOOK_COOKIES env var — requests will be unauthenticated (may hit rate limit)')
    }

    // Intercept Facebook's internal GraphQL responses (where the real ads data lives)
    page.on('response', async (response) => {
      const responseUrl = response.url()
      if (!responseUrl.includes('api/graphql')) return
      graphqlResponses++
      if (ads.length >= maxAds) return
      try {
        const text = await response.text()
        // Log first 2 GraphQL responses to understand the format
        if (graphqlResponses <= 2) {
          console.log(`[Scraper] GraphQL response #${graphqlResponses} preview (200 chars): ${text.substring(0, 200)}`)
        }
        const before = ads.length
        parseGraphQLText(text, ads, seenIds)
        if (ads.length > before) {
          console.log(`[Scraper] Found ${ads.length} ads so far (from GraphQL)`)
          options.onProgress?.(ads.length)
        }
      } catch {}
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    console.log(`[Scraper] Page loaded, final URL: ${page.url()}`)

    // Handle cookie consent / GDPR dialogs
    await new Promise((r) => setTimeout(r, 3000))
    const cookieSelectors = [
      '[data-testid="cookie-policy-manage-dialog-accept-button"]',
      'button[title="Allow all cookies"]',
      'button[title="Permitir todas las cookies"]',
      '[data-cookiebanner="accept_button"]',
      'button[data-testid="accept-cookie-banner-button"]',
      '[aria-label="Allow all cookies"]',
    ]
    for (const sel of cookieSelectors) {
      try {
        const btn = await page.$(sel)
        if (btn) {
          console.log(`[Scraper] Accepting cookies via: ${sel}`)
          await btn.click()
          await new Promise((r) => setTimeout(r, 2000))
          break
        }
      } catch {}
    }

    // Log page title to understand what we landed on
    const title = await page.title()
    console.log(`[Scraper] Page title: "${title}"`)

    await new Promise((r) => setTimeout(r, 3000))

    // Scroll to trigger lazy loading of more ads
    for (let i = 0; i < 8 && ads.length < maxAds; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await new Promise((r) => setTimeout(r, 2500))
      if (i === 0) {
        console.log(`[Scraper] After first scroll: ${ads.length} ads, ${graphqlResponses} GraphQL responses intercepted`)
      }
    }

    console.log(`[Scraper] Scroll done: ${ads.length} ads from GraphQL, ${graphqlResponses} total GraphQL responses`)

    // Fallback: extract ad IDs directly from rendered DOM links
    if (ads.length === 0) {
      console.log('[Scraper] No ads from GraphQL — trying DOM fallback')
      const domAdIds = await page.evaluate(() => {
        const ids: string[] = []
        document.querySelectorAll('a[href*="ads/archive/render_ad"]').forEach((el) => {
          const href = (el as HTMLAnchorElement).href
          const m = href.match(/[?&]id=(\d+)/)
          if (m && !ids.includes(m[1])) ids.push(m[1])
        })
        return ids
      })
      console.log(`[Scraper] DOM fallback found ${domAdIds.length} ad IDs`)
      for (const adId of domAdIds) {
        if (!seenIds.has(adId)) {
          seenIds.add(adId)
          ads.push({
            id: adId,
            ad_snapshot_url: `https://www.facebook.com/ads/archive/render_ad/?id=${adId}`,
          })
        }
      }
    }

    await page.close()
  } finally {
    await browser.close()
  }

  console.log(`[Scraper] Done: ${ads.length} ads returned`)
  return ads.slice(0, maxAds)
}
