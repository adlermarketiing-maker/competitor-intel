import puppeteer from 'puppeteer'
import type { MetaAdRaw } from '@/types/scrape'

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
    page_id: (node.page_id ?? node.page?.id) as string | undefined,
    page_name: (node.page_name ?? node.page?.name) as string | undefined,
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

  const url = options.pageIds?.length
    ? `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&view_all_page_id=${options.pageIds[0]}`
    : `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(options.searchTerms ?? '')}&search_type=keyword_unordered`

  const browser = await puppeteer.launch({
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
    ],
  })

  const seenIds = new Set<string>()
  const ads: MetaAdRaw[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 900 })

    // Intercept Facebook's internal GraphQL responses (where the real ads data lives)
    page.on('response', async (response) => {
      if (!response.url().includes('api/graphql')) return
      if (ads.length >= maxAds) return
      try {
        const text = await response.text()
        const before = ads.length
        parseGraphQLText(text, ads, seenIds)
        if (ads.length > before) options.onProgress?.(ads.length)
      } catch {}
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await new Promise((r) => setTimeout(r, 4000))

    // Scroll to trigger lazy loading of more ads
    for (let i = 0; i < 8 && ads.length < maxAds; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await new Promise((r) => setTimeout(r, 2500))
    }

    await page.close()
  } finally {
    await browser.close()
  }

  return ads.slice(0, maxAds)
}
