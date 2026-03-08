import puppeteer from 'puppeteer'

export interface YouTubeOrganic {
  externalId: string
  url: string
  title: string
  authorHandle: string
  authorName: string | null
  views: number
  likes: number
  comments: number
  duration: number | null  // seconds
  thumbnailUrl: string | null
  publishedAt: string | null
  description: string | null
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

function parseViewCount(text: string): number {
  if (!text) return 0
  text = text.replace(/\s/g, '').replace(/,/g, '.')
  const match = text.match(/([\d.]+)\s*([KkMmBb]?)/)
  if (!match) return parseInt(text.replace(/\D/g, '')) || 0
  const num = parseFloat(match[1])
  const suffix = match[2].toUpperCase()
  if (suffix === 'K') return Math.round(num * 1000)
  if (suffix === 'M') return Math.round(num * 1000000)
  if (suffix === 'B') return Math.round(num * 1000000000)
  return Math.round(num)
}

function parseDuration(text: string): number | null {
  if (!text) return null
  const parts = text.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

/**
 * Scrape a YouTube channel's recent/popular videos.
 */
export async function scrapeYouTubeChannel(
  channelUrl: string,
  maxVideos = 20,
  sortByPopular = false,
): Promise<{ channelName: string | null; handle: string; videos: YouTubeOrganic[] }> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const videos: YouTubeOrganic[] = []
  let channelName: string | null = null
  let handle = ''

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )
    await page.setViewport({ width: 1280, height: 800 })

    // Normalize channel URL to /videos tab
    let url = channelUrl.replace(/\/$/, '')
    if (!url.includes('/videos')) url += '/videos'
    if (sortByPopular && !url.includes('sort=p')) {
      url += url.includes('?') ? '&sort=p' : '?sort=p'
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Accept cookies
    try {
      const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Aceptar"]')
      if (consentBtn) await consentBtn.click()
      await new Promise((r) => setTimeout(r, 1000))
    } catch { /* ignore */ }

    // Get channel info
    const channelInfo = await page.evaluate(() => {
      const nameEl = document.querySelector('#channel-name yt-formatted-string, #channel-header ytd-channel-name yt-formatted-string')
      const handleEl = document.querySelector('#channel-handle, [id="channel-handle"]')
      return {
        name: nameEl?.textContent?.trim() || null,
        handle: handleEl?.textContent?.trim()?.replace('@', '') || '',
      }
    })
    channelName = channelInfo.name
    handle = channelInfo.handle || channelUrl.match(/@([\w-]+)/)?.[1] || ''

    // Scroll to load more videos
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000))
      await new Promise((r) => setTimeout(r, 2000))
    }

    // Extract video data
    const results = await page.evaluate((max: number) => {
      const renderers = Array.from(document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer')).slice(0, max)
      return renderers.map((el) => {
        const titleEl = el.querySelector('#video-title, a#video-title-link')
        const title = titleEl?.textContent?.trim() || ''
        const href = (titleEl as HTMLAnchorElement)?.href || ''

        const metaEl = el.querySelector('#metadata-line span, .inline-metadata-item')
        const viewText = metaEl?.textContent?.trim() || ''

        const timeEl = el.querySelector('ytd-thumbnail-overlay-time-status-renderer, #overlays span')
        const durationText = timeEl?.textContent?.trim() || ''

        const thumbEl = el.querySelector('img#img, yt-image img')
        const thumbnailUrl = thumbEl?.getAttribute('src') || null

        // Published date (relative text like "2 weeks ago")
        const metaItems = el.querySelectorAll('#metadata-line span, .inline-metadata-item')
        let publishedText = ''
        if (metaItems.length >= 2) publishedText = metaItems[1]?.textContent?.trim() || ''

        return {
          title,
          href,
          viewText,
          durationText,
          thumbnailUrl,
          publishedText,
        }
      }).filter((v) => v.title && v.href)
    }, maxVideos)

    for (const item of results) {
      const idMatch = item.href.match(/[?&]v=([\w-]+)/) || item.href.match(/\/shorts\/([\w-]+)/)
      if (!idMatch) continue

      const isShort = item.href.includes('/shorts/')

      videos.push({
        externalId: `yt_${idMatch[1]}`,
        url: item.href,
        title: item.title,
        authorHandle: handle,
        authorName: channelName,
        views: parseViewCount(item.viewText),
        likes: 0,
        comments: 0,
        duration: parseDuration(item.durationText),
        thumbnailUrl: item.thumbnailUrl,
        publishedAt: item.publishedText || null,
        description: isShort ? '[Short]' : null,
      })
    }
  } catch (err) {
    console.error(`[YouTube] Error scraping channel:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return { channelName, handle, videos }
}

/**
 * Search YouTube for trending videos by keyword and extract top results.
 */
export async function searchYouTubeOrganic(keyword: string, maxVideos = 20): Promise<YouTubeOrganic[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const videos: YouTubeOrganic[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )
    await page.setViewport({ width: 1280, height: 800 })

    // Search sorted by view count (sp=CAM%253D) or upload date (sp=CAI%253D)
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=CAM%253D`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Accept cookies
    try {
      const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Aceptar"]')
      if (consentBtn) await consentBtn.click()
      await new Promise((r) => setTimeout(r, 1000))
    } catch { /* ignore */ }

    // Scroll
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, 800))
      await new Promise((r) => setTimeout(r, 1500))
    }

    const results = await page.evaluate((max: number) => {
      const items = Array.from(document.querySelectorAll('ytd-video-renderer')).slice(0, max)
      return items.map((el) => {
        const titleEl = el.querySelector('#video-title')
        const title = titleEl?.textContent?.trim() || ''
        const href = (titleEl as HTMLAnchorElement)?.href || ''

        const channelEl = el.querySelector('#channel-name a, .ytd-channel-name a')
        const authorName = channelEl?.textContent?.trim() || null
        const channelHref = (channelEl as HTMLAnchorElement)?.href || ''
        const handleMatch = channelHref.match(/@([\w-]+)/)
        const authorHandle = handleMatch ? handleMatch[1] : ''

        const metaItems = el.querySelectorAll('#metadata-line span')
        const viewText = metaItems[0]?.textContent?.trim() || ''
        const publishedText = metaItems[1]?.textContent?.trim() || ''

        const timeEl = el.querySelector('ytd-thumbnail-overlay-time-status-renderer span')
        const durationText = timeEl?.textContent?.trim() || ''

        const thumbEl = el.querySelector('img')
        const thumbnailUrl = thumbEl?.src || null

        const descEl = el.querySelector('.metadata-snippet-text')
        const description = descEl?.textContent?.trim() || null

        return { title, href, authorName, authorHandle, viewText, publishedText, durationText, thumbnailUrl, description }
      }).filter((v) => v.title && v.href)
    }, maxVideos)

    for (const item of results) {
      const idMatch = item.href.match(/[?&]v=([\w-]+)/)
      if (!idMatch) continue

      videos.push({
        externalId: `yt_${idMatch[1]}`,
        url: item.href,
        title: item.title,
        authorHandle: item.authorHandle,
        authorName: item.authorName,
        views: parseViewCount(item.viewText),
        likes: 0,
        comments: 0,
        duration: parseDuration(item.durationText),
        thumbnailUrl: item.thumbnailUrl,
        publishedAt: item.publishedText || null,
        description: item.description,
      })
    }
  } catch (err) {
    console.error(`[YouTube] Error searching "${keyword}":`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return videos
}

/**
 * Extract auto-generated captions/transcript from a YouTube video.
 * This avoids needing Whisper API for YouTube content.
 */
export async function extractYouTubeTranscript(videoUrl: string): Promise<string | null> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )

    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Try to get captions from the page's player response
    const transcript = await page.evaluate(() => {
      // YouTube embeds caption data in ytInitialPlayerResponse
      const scripts = Array.from(document.querySelectorAll('script'))
      for (const script of scripts) {
        const text = script.textContent || ''
        if (text.includes('captionTracks')) {
          const match = text.match(/"captionTracks":\s*(\[.+?\])/)
          if (match) {
            try {
              const tracks = JSON.parse(match[1])
              // Return the URL of the first caption track
              if (tracks.length > 0 && tracks[0].baseUrl) {
                return tracks[0].baseUrl as string
              }
            } catch { /* ignore */ }
          }
        }
      }
      return null
    })

    if (transcript) {
      // Fetch the caption XML
      const captionPage = await browser.newPage()
      await captionPage.goto(transcript, { waitUntil: 'domcontentloaded', timeout: 15000 })
      const captionText = await captionPage.evaluate(() => {
        const texts = Array.from(document.querySelectorAll('text'))
        return texts.map((t) => t.textContent?.trim()).filter(Boolean).join(' ')
      })
      await captionPage.close()
      return captionText || null
    }
  } catch {
    // Silently fail
  } finally {
    await page.close()
    await browser.close()
  }

  return null
}
