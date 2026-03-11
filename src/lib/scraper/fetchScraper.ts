import { extractContent, extractLinksFromNextData } from './extractor'
import type { ScrapedPageContent } from '@/types/scrape'

/**
 * Lightweight page scraper using fetch + cheerio.
 * Works without Puppeteer/Chrome — used as primary fallback
 * when Chrome is not available (Railway, serverless, etc.).
 */
export async function scrapePageWithFetch(url: string): Promise<ScrapedPageContent> {
  let finalUrl = url
  let httpStatus = 0

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    httpStatus = response.status
    finalUrl = response.url || url

    const html = await response.text()
    const extracted = extractContent(html, finalUrl)

    // For JS-rendered pages (Linktree, etc.), also extract links from __NEXT_DATA__
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
    const error = err instanceof Error ? err.message : String(err)
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
      error,
    }
  }
}
