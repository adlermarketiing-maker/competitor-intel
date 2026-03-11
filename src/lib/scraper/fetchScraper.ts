import { extractContent, extractLinksFromNextData } from './extractor'
import type { ScrapedPageContent } from '@/types/scrape'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]

/**
 * Lightweight page scraper using fetch + cheerio.
 * Rotates User-Agents on 403 to bypass basic bot blocking.
 * Works without Puppeteer/Chrome.
 */
export async function scrapePageWithFetch(url: string): Promise<ScrapedPageContent> {
  let finalUrl = url
  let httpStatus = 0
  let lastError = ''

  for (const ua of USER_AGENTS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)

      const response = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'identity',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
        signal: controller.signal,
      })

      clearTimeout(timeout)

      httpStatus = response.status
      finalUrl = response.url || url

      // If blocked, try next UA
      if (httpStatus === 403 || httpStatus === 401) {
        lastError = `HTTP ${httpStatus} with UA: ${ua.slice(0, 30)}...`
        continue
      }

      const html = await response.text()
      const extracted = extractContent(html, finalUrl)

      // For JS-rendered pages, also extract links from __NEXT_DATA__
      const nextDataLinks = extractLinksFromNextData(html)
      if (nextDataLinks.length > 0) {
        const allLinks = [...new Set([...extracted.outboundLinks, ...nextDataLinks])]
        extracted.outboundLinks = allLinks.slice(0, 100)
      }

      return {
        url: finalUrl,
        originalUrl: url,
        ...extracted,
        screenshotPath: null,
        httpStatus,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      continue
    }
  }

  // All UAs failed
  return {
    url: finalUrl,
    originalUrl: url,
    title: null,
    h1Texts: [],
    h2Texts: [],
    ctaTexts: [],
    prices: [],
    offerName: null,
    bodyText: '',
    screenshotPath: null,
    outboundLinks: [],
    httpStatus: httpStatus || 0,
    error: lastError || 'All fetch attempts failed',
  }
}
