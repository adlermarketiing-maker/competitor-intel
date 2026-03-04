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

  // Remove noise
  $('script, style, noscript, iframe, nav, footer, header').remove()

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

  // CTA buttons: look for buttons, links with CTA-like classes, and input[type=submit]
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

  // Prices
  const fullText = $('body').text()
  const priceMatches = fullText.match(PRICE_REGEX) || []
  const prices = [...new Set(priceMatches)].slice(0, 10)

  // Offer name: try H1 first, then title
  const offerName = h1Texts[0] || title || null

  // Body text (first 3000 chars of meaningful text)
  const bodyText = fullText.replace(/\s+/g, ' ').trim().slice(0, 3000)

  // Outbound links
  const pageHostname = (() => {
    try {
      return new URL(pageUrl).hostname
    } catch {
      return ''
    }
  })()

  const outboundLinks: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    try {
      const resolved = new URL(href, pageUrl).href
      // Include same-domain links that look like funnel steps, and external payment platforms
      if (resolved.startsWith('http')) {
        outboundLinks.push(resolved)
      }
    } catch {}
  })

  return {
    title,
    h1Texts,
    h2Texts,
    ctaTexts,
    prices,
    offerName,
    bodyText,
    outboundLinks: [...new Set(outboundLinks)].slice(0, 50),
  }
}
