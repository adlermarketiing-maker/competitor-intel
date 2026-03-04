import puppeteer, { Browser } from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { extractContent } from './extractor'
import type { ScrapedPageContent } from '@/types/scrape'

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
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
    await browserInstance.close()
    browserInstance = null
  }
}

const SCREENSHOTS_DIR = path.join(process.cwd(), 'public', 'screenshots')

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
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
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    httpStatus = response?.status() ?? 200
    finalUrl = page.url()

    // Wait a bit for any lazy-loaded content
    await new Promise((r) => setTimeout(r, 1500))

    const html = await page.content()

    // Screenshot
    ensureScreenshotsDir()
    const screenshotId = randomUUID()
    const screenshotFile = path.join(SCREENSHOTS_DIR, `${screenshotId}.png`)
    await page.screenshot({
      path: screenshotFile as `${string}.png`,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })
    const screenshotPath = `/screenshots/${screenshotId}.png`

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
