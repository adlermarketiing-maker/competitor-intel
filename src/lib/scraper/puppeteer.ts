import puppeteer, { Browser } from 'puppeteer'
import { extractContent } from './extractor'
import type { ScrapedPageContent } from '@/types/scrape'

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance && !browserInstance.connected) {
    // Previous browser disconnected — clean up reference
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

export async function scrapePage(url: string): Promise<ScrapedPageContent> {
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
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })

    httpStatus = response?.status() ?? 200
    finalUrl = page.url()

    // Wait a bit for any lazy-loaded content
    await new Promise((r) => setTimeout(r, 1500))

    const html = await page.content()

    // Screenshot as base64 data URL (persists in DB, works on Railway ephemeral filesystem)
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 50,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })
    const screenshotPath = `data:image/jpeg;base64,${Buffer.from(screenshotBuffer).toString('base64')}`

    const extracted = extractContent(html, finalUrl)

    return {
      url: finalUrl,
      originalUrl: url,
      ...extracted,
      screenshotPath,
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
      httpStatus,
      error,
    }
  } finally {
    await page.close()
  }
}
