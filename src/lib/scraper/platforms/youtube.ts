import puppeteer from 'puppeteer'

export interface YouTubeVideo {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

export interface YouTubeComment {
  author: string | null
  text: string
  rating: number | null
  date: string | null
}

async function getBrowser() {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })
}

/**
 * Search YouTube for videos matching keywords.
 */
export async function searchYouTube(keyword: string, maxVideos = 8): Promise<YouTubeVideo[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const videos: YouTubeVideo[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=CAI%253D`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Accept cookies if dialog appears
    try {
      const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Aceptar"], tp-yt-paper-button.ytd-consent-bump-v2-lightbox')
      if (consentBtn) await consentBtn.click()
      await new Promise((r) => setTimeout(r, 1000))
    } catch { /* ignore */ }

    const results = await page.evaluate((max: number) => {
      const items = Array.from(document.querySelectorAll('ytd-video-renderer')).slice(0, max)
      return items.map((el) => {
        const titleEl = el.querySelector('#video-title')
        const title = titleEl?.textContent?.trim() || ''
        const href = (titleEl as HTMLAnchorElement)?.href || ''
        const channelEl = el.querySelector('#channel-name a, .ytd-channel-name a')
        const authorName = channelEl?.textContent?.trim() || null

        return {
          title,
          url: href,
          authorName,
          price: null,
          rating: null,
          reviewCount: null,
          description: null,
        }
      }).filter((v) => v.title && v.url)
    }, maxVideos)

    videos.push(...results)
  } catch {
    // Silently fail
  } finally {
    await page.close()
    await browser.close()
  }

  return videos
}

/**
 * Scrape comments from a YouTube video page.
 * Scrolls down to load the comments section.
 */
export async function scrapeYouTubeComments(videoUrl: string, maxComments = 20): Promise<YouTubeComment[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const comments: YouTubeComment[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Accept cookies if needed
    try {
      const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Aceptar"]')
      if (consentBtn) await consentBtn.click()
      await new Promise((r) => setTimeout(r, 1000))
    } catch { /* ignore */ }

    // Scroll down to trigger comment loading
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800))
      await new Promise((r) => setTimeout(r, 1500))
    }

    // Wait for comments to appear
    await page.waitForSelector('ytd-comment-thread-renderer', { timeout: 10000 }).catch(() => {})

    const results = await page.evaluate((max: number) => {
      const commentEls = Array.from(document.querySelectorAll('ytd-comment-thread-renderer')).slice(0, max)
      return commentEls.map((el) => {
        const contentEl = el.querySelector('#content-text')
        const text = contentEl?.textContent?.trim() || ''
        const authorEl = el.querySelector('#author-text')
        const author = authorEl?.textContent?.trim() || null
        const dateEl = el.querySelector('.published-time-text a, #header-author yt-formatted-string.published-time-text')
        const date = dateEl?.textContent?.trim() || null
        return { text, author, date, rating: null }
      }).filter((c) => c.text.length > 10)
    }, maxComments)

    comments.push(...results)
  } catch {
    // Silently fail
  } finally {
    await page.close()
    await browser.close()
  }

  return comments
}
