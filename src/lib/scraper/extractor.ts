import * as cheerio from 'cheerio'

const PRICE_REGEX = /(€|\$|USD|EUR|£)\s*\d[\d.,]*/gi

export interface ExtractedContent {
  title: string | null
  h1Texts: string[]
  h2Texts: string[]
  ctaTexts: string[]
  prices: string[]
  offerName: string | null
  bodyText: string
  outboundLinks: string[]
}

export function extractContent(html: string, pageUrl: string): ExtractedContent {
  const $ = cheerio.load(html)

  // Extract outbound links BEFORE removing elements (nav/footer may contain important links)
  const outboundLinks: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    try {
      const resolved = new URL(href, pageUrl).href
      if (resolved.startsWith('http')) {
        outboundLinks.push(resolved)
      }
    } catch { /* ignore malformed URLs */ }
  })

  // Also extract links from data attributes (some SPAs use data-href, data-url, etc.)
  $('[data-href], [data-url], [data-link]').each((_, el) => {
    const href = $(el).attr('data-href') || $(el).attr('data-url') || $(el).attr('data-link')
    if (!href) return
    try {
      const resolved = new URL(href, pageUrl).href
      if (resolved.startsWith('http')) outboundLinks.push(resolved)
    } catch { /* ignore */ }
  })

  // Extract links from __NEXT_DATA__ (Linktree and other Next.js SPAs)
  const nextDataLinks = extractLinksFromNextData(html)
  outboundLinks.push(...nextDataLinks)

  // Now remove noise for text extraction
  $('script, style, noscript, iframe').remove()

  const title = $('title').first().text().trim() || null

  const h1Texts = $('h1')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)

  const h2Texts = $('h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 10)

  // CTA buttons
  const ctaSelectors = [
    'button',
    'input[type=submit]',
    'a.btn',
    'a.button',
    'a.cta',
    '[class*="cta"]',
    '[class*="btn"]',
    '[class*="button"]',
    '[id*="cta"]',
  ]
  const ctaTextsRaw = new Set<string>()
  for (const sel of ctaSelectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim()
      if (text && text.length < 100) ctaTextsRaw.add(text)
    })
  }
  const ctaTexts = Array.from(ctaTextsRaw).slice(0, 10)

  // Remove nav/footer/header AFTER extracting links and CTAs but before body text
  $('nav, footer, header').remove()

  // Prices
  const fullText = $('body').text()
  const priceMatches = fullText.match(PRICE_REGEX) || []
  const prices = [...new Set(priceMatches)].slice(0, 10)

  // Offer name: try H1 first, then title
  const offerName = h1Texts[0] || title || null

  // Body text (first 3000 chars of meaningful text)
  const bodyText = fullText.replace(/\s+/g, ' ').trim().slice(0, 3000)

  return {
    title,
    h1Texts,
    h2Texts,
    ctaTexts,
    prices,
    offerName,
    bodyText,
    outboundLinks: [...new Set(outboundLinks)].slice(0, 100),
  }
}

/**
 * Extract links from __NEXT_DATA__ JSON embedded in page HTML.
 * Linktree and other Next.js apps store all link data here even before
 * client-side JS hydration. This lets us find links without needing a browser.
 */
export function extractLinksFromNextData(html: string): string[] {
  const links: string[] = []

  try {
    // Match __NEXT_DATA__ script tag
    const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
    if (!match?.[1]) return links

    const data = JSON.parse(match[1])
    extractUrlsFromObject(data, links)
  } catch { /* ignore parse errors */ }

  // Also try to find JSON-LD structured data
  try {
    const ldMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    for (const m of ldMatches) {
      try {
        const ld = JSON.parse(m[1])
        extractUrlsFromObject(ld, links)
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return [...new Set(links)]
}

/** Recursively find URL strings in a nested object/array */
function extractUrlsFromObject(obj: unknown, links: string[], depth = 0): void {
  if (depth > 8) return // prevent infinite recursion
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.startsWith('http') && !obj.includes(' ')) {
      try {
        new URL(obj) // validate it's a URL
        links.push(obj)
      } catch { /* not a valid URL */ }
    }
    return
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractUrlsFromObject(item, links, depth + 1)
    }
    return
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Focus on keys that likely contain URLs
    const keyLower = key.toLowerCase()
    if (keyLower.includes('url') || keyLower === 'href' || keyLower === 'link' ||
        keyLower === 'src' || keyLower === 'links' || keyLower === 'destination') {
      extractUrlsFromObject(value, links, depth + 1)
    }
    // Also recurse into arrays and nested objects (props, pageProps, etc.)
    if (typeof value === 'object' && value !== null) {
      extractUrlsFromObject(value, links, depth + 1)
    }
  }
}
