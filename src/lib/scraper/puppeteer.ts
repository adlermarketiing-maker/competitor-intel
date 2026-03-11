import puppeteer, { Browser } from 'puppeteer'
import { extractContent, extractLinksFromNextData } from './extractor'
import { scrapePageWithFetch } from './fetchScraper'
import type { ScrapedPageContent } from '@/types/scrape'

let browserInstance: Browser | null = null
let puppeteerAvailable: boolean | null = null // Cache: null=unknown, true/false=tested

async function getBrowser(): Promise<Browser> {
  if (browserInstance && !browserInstance.connected) {
    try { await browserInstance.close() } catch { /* already dead */ }
    browserInstance = null
  }
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    })
  }
  return browserInstance
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try { await browserInstance.close() } catch { /* ignore */ }
    browserInstance = null
  }
}

/** Internal: scrape with Puppeteer (requires Chrome). Throws if Chrome unavailable. */
async function scrapeWithPuppeteer(
  url: string,
  options?: { waitUntil?: 'domcontentloaded' | 'networkidle2' }
): Promise<ScrapedPageContent> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  let finalUrl = url
  let httpStatus = 200

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    const response = await page.goto(url, {
      waitUntil: options?.waitUntil || 'domcontentloaded',
      timeout: 25000,
    })

    httpStatus = response?.status() ?? 200
    finalUrl = page.url()

    // Wait for lazy-loaded content
    await new Promise((r) => setTimeout(r, 2000))

    const html = await page.content()

    // Screenshot as base64 data URL
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 50,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })
    const screenshotPath = `data:image/jpeg;base64,${Buffer.from(screenshotBuffer).toString('base64')}`

    const extracted = extractContent(html, finalUrl)

    // Also extract links from __NEXT_DATA__ for JS-rendered pages
    const nextDataLinks = extractLinksFromNextData(html)
    if (nextDataLinks.length > 0) {
      const allLinks = [...new Set([...extracted.outboundLinks, ...nextDataLinks])]
      extracted.outboundLinks = allLinks.slice(0, 100)
    }

    return {
      url: finalUrl,
      originalUrl: url,
      ...extracted,
      screenshotPath,
      httpStatus,
    }
  } finally {
    await page.close()
  }
}

/**
 * Scrape a page. Tries Puppeteer first (screenshots + JS rendering),
 * automatically falls back to fetch + cheerio if Chrome is unavailable.
 */
export async function scrapePage(
  url: string,
  options?: { waitUntil?: 'domcontentloaded' | 'networkidle2' }
): Promise<ScrapedPageContent> {
  // If Puppeteer already confirmed unavailable, use fetch directly
  if (puppeteerAvailable === false) {
    return scrapePageWithFetch(url)
  }

  try {
    const result = await scrapeWithPuppeteer(url, options)
    puppeteerAvailable = true

    // If Puppeteer got an HTTP error or empty content, try fetch as supplement
    if (result.httpStatus >= 400 || (!result.bodyText && result.outboundLinks.length === 0)) {
      const fetchResult = await scrapePageWithFetch(url)
      if (fetchResult.outboundLinks.length > result.outboundLinks.length || fetchResult.bodyText.length > result.bodyText.length) {
        // Merge: keep Puppeteer screenshot but use better fetch content
        return {
          ...fetchResult,
          screenshotPath: result.screenshotPath,
          httpStatus: result.httpStatus || fetchResult.httpStatus,
        }
      }
    }

    return result
  } catch (err) {
    // Puppeteer launch/runtime failure (no Chrome, crash, etc.)
    const errMsg = err instanceof Error ? err.message : String(err)

    // If this was a launch failure, cache it so we don't retry for every page
    if (errMsg.includes('Could not find') || errMsg.includes('ENOENT') ||
        errMsg.includes('spawn') || errMsg.includes('Failed to launch') ||
        errMsg.includes('Chromium') || errMsg.includes('chrome') ||
        errMsg.includes('executablePath')) {
      console.warn(`[Scraper] Puppeteer unavailable (${errMsg.slice(0, 100)}), switching to fetch mode`)
      puppeteerAvailable = false
    } else {
      console.warn(`[Scraper] Puppeteer error for ${url}: ${errMsg.slice(0, 200)}`)
    }

    // Fall back to fetch
    return scrapePageWithFetch(url)
  }
}

/** Check if Puppeteer/Chrome is available without actually scraping a page */
export function isPuppeteerAvailable(): boolean | null {
  return puppeteerAvailable
}
