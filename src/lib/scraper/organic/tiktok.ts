import puppeteer from 'puppeteer'

export interface TikTokVideo {
  externalId: string
  url: string
  authorHandle: string
  authorName: string | null
  caption: string | null
  hashtags: string[]
  views: number
  likes: number
  comments: number
  shares: number
  duration: number | null
  soundName: string | null
  thumbnailUrl: string | null
  publishedAt: string | null
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

function parseCount(text: string): number {
  if (!text) return 0
  text = text.trim().replace(/,/g, '')
  const match = text.match(/([\d.]+)\s*([KkMm]?)/)
  if (!match) return parseInt(text) || 0
  const num = parseFloat(match[1])
  const suffix = match[2].toUpperCase()
  if (suffix === 'K') return Math.round(num * 1000)
  if (suffix === 'M') return Math.round(num * 1000000)
  return Math.round(num)
}

/**
 * Search TikTok for videos by keyword.
 * Extracts video cards from search results page.
 */
export async function searchTikTok(keyword: string, maxVideos = 20): Promise<TikTokVideo[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const videos: TikTokVideo[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )
    await page.setViewport({ width: 1280, height: 800 })

    const searchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(keyword)}`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 4000))

    // Accept cookies if dialog appears
    try {
      const cookieBtn = await page.$('button[data-testid="cookie-banner-accept"], button:has-text("Accept all")')
      if (cookieBtn) {
        await cookieBtn.click()
        await new Promise((r) => setTimeout(r, 1000))
      }
    } catch { /* ignore */ }

    // Scroll to load more results
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await new Promise((r) => setTimeout(r, 2000))
    }

    // Extract video data from search results
    const results = await page.evaluate((max: number) => {
      const cards = Array.from(document.querySelectorAll('[data-e2e="search_top-item"], [data-e2e="search-card-desc"], div[class*="DivItemContainerV2"], div[class*="ItemContainer"]'))
      const items: Array<{
        url: string
        caption: string
        authorHandle: string
        authorName: string | null
        views: string
        likes: string
        thumbnailUrl: string | null
      }> = []

      // Fallback: try extracting from any video card links
      const allLinks = Array.from(document.querySelectorAll('a[href*="/@"]'))
      const videoLinks = allLinks.filter((a) => {
        const href = (a as HTMLAnchorElement).href
        return href.match(/\/@[\w.]+\/video\/\d+/)
      })

      const seen = new Set<string>()

      for (const link of videoLinks.slice(0, max * 2)) {
        const href = (link as HTMLAnchorElement).href
        if (seen.has(href)) continue
        seen.add(href)

        const handleMatch = href.match(/\/@([\w.]+)/)
        const authorHandle = handleMatch ? handleMatch[1] : ''

        // Try to get caption from nearby elements
        const container = link.closest('div[class*="ItemContainer"], div[class*="DivWrapper"], div[class*="item"]') || link.parentElement?.parentElement
        const descEl = container?.querySelector('[data-e2e="search-card-desc"], span[class*="SpanText"], [class*="desc"]')
        const caption = descEl?.textContent?.trim() || ''

        // Views from the card
        const viewEl = container?.querySelector('[data-e2e="video-views"], strong[data-e2e="video-count"], [class*="video-count"]')
        const views = viewEl?.textContent?.trim() || '0'

        // Likes
        const likeEl = container?.querySelector('[data-e2e="like-count"]')
        const likes = likeEl?.textContent?.trim() || '0'

        // Thumbnail
        const img = container?.querySelector('img')
        const thumbnailUrl = img?.src || null

        items.push({
          url: href,
          caption,
          authorHandle,
          authorName: null,
          views,
          likes,
          thumbnailUrl,
        })

        if (items.length >= max) break
      }

      return items
    }, maxVideos)

    for (const item of results) {
      const idMatch = item.url.match(/\/video\/(\d+)/)
      if (!idMatch) continue

      const hashtags = (item.caption || '').match(/#\w+/g)?.map((h) => h.toLowerCase()) || []

      videos.push({
        externalId: `tt_${idMatch[1]}`,
        url: item.url,
        authorHandle: item.authorHandle,
        authorName: item.authorName,
        caption: item.caption || null,
        hashtags,
        views: parseCount(item.views),
        likes: parseCount(item.likes),
        comments: 0,
        shares: 0,
        duration: null,
        soundName: null,
        thumbnailUrl: item.thumbnailUrl,
        publishedAt: null,
      })
    }

    // Visit top videos to get more details (comments, shares, sound, duration)
    for (const video of videos.slice(0, 10)) {
      let videoPage: Awaited<ReturnType<typeof browser.newPage>> | null = null
      try {
        videoPage = await browser.newPage()
        await videoPage.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        )
        await videoPage.goto(video.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await new Promise((r) => setTimeout(r, 3000))

        const details = await videoPage.evaluate(() => {
          const commentEl = document.querySelector('[data-e2e="comment-count"]')
          const shareEl = document.querySelector('[data-e2e="share-count"]')
          const soundEl = document.querySelector('[data-e2e="browse-music"], a[href*="/music/"]')
          const durationEl = document.querySelector('[class*="DivSeekBarTimeContainer"] span:last-child, [class*="time-duration"]')

          let duration: number | null = null
          if (durationEl?.textContent) {
            const parts = durationEl.textContent.split(':')
            if (parts.length === 2) {
              duration = parseInt(parts[0]) * 60 + parseInt(parts[1])
            }
          }

          return {
            comments: commentEl?.textContent?.trim() || '0',
            shares: shareEl?.textContent?.trim() || '0',
            soundName: soundEl?.textContent?.trim() || null,
            duration,
          }
        })

        video.comments = parseCount(details.comments)
        video.shares = parseCount(details.shares)
        video.soundName = details.soundName
        video.duration = details.duration

        await new Promise((r) => setTimeout(r, 1000))
      } catch {
        // Skip individual video detail errors
      } finally {
        if (videoPage) await videoPage.close().catch(() => {})
      }
    }
  } catch (err) {
    console.error(`[TikTok] Error searching "${keyword}":`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return videos
}

/**
 * Scrape a TikTok profile's recent videos.
 */
export async function scrapeTikTokProfile(handle: string, maxVideos = 20): Promise<TikTokVideo[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const videos: TikTokVideo[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )
    await page.setViewport({ width: 1280, height: 800 })

    const profileUrl = `https://www.tiktok.com/@${handle}`
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 4000))

    // Dismiss cookies
    try {
      const cookieBtn = await page.$('button[data-testid="cookie-banner-accept"]')
      if (cookieBtn) await cookieBtn.click()
    } catch { /* ignore */ }

    // Scroll to load videos
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000))
      await new Promise((r) => setTimeout(r, 2000))
    }

    const results = await page.evaluate((max: number, profileHandle: string) => {
      const videoLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'))
      const items: Array<{ url: string; views: string; caption: string; thumbnailUrl: string | null }> = []
      const seen = new Set<string>()

      for (const link of videoLinks.slice(0, max)) {
        const href = (link as HTMLAnchorElement).href
        if (seen.has(href) || !href.includes(`/@${profileHandle}`)) continue
        seen.add(href)

        const container = link.closest('div') || link
        const viewEl = container.querySelector('[data-e2e="video-views"], strong')
        const descEl = container.querySelector('[class*="desc"], [class*="caption"]')
        const img = container.querySelector('img')

        items.push({
          url: href,
          views: viewEl?.textContent?.trim() || '0',
          caption: descEl?.textContent?.trim() || '',
          thumbnailUrl: img?.src || null,
        })
      }

      return items
    }, maxVideos, handle)

    for (const item of results) {
      const idMatch = item.url.match(/\/video\/(\d+)/)
      if (!idMatch) continue

      const hashtags = (item.caption || '').match(/#\w+/g)?.map((h) => h.toLowerCase()) || []

      videos.push({
        externalId: `tt_${idMatch[1]}`,
        url: item.url,
        authorHandle: handle,
        authorName: null,
        caption: item.caption || null,
        hashtags,
        views: parseCount(item.views),
        likes: 0,
        comments: 0,
        shares: 0,
        duration: null,
        soundName: null,
        thumbnailUrl: item.thumbnailUrl,
        publishedAt: null,
      })
    }
  } catch (err) {
    console.error(`[TikTok] Error scraping @${handle}:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return videos
}
