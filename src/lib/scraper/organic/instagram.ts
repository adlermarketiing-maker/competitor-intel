import puppeteer from 'puppeteer'

export interface InstagramPost {
  externalId: string
  url: string
  caption: string | null
  hashtags: string[]
  mediaType: 'image' | 'carousel' | 'reel'
  likes: number
  comments: number
  thumbnailUrl: string | null
  publishedAt: string | null
}

export interface InstagramProfile {
  handle: string
  name: string | null
  followers: number
  posts: InstagramPost[]
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
 * Scrape an Instagram profile's recent posts.
 * Uses Puppeteer to load the public profile page and extract post data.
 * Note: Instagram aggressively blocks scraping — this works for public profiles
 * but may require retries or fail if Instagram detects bot behavior.
 */
export async function scrapeInstagramProfile(
  handle: string,
  maxPosts = 20,
): Promise<InstagramProfile> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const result: InstagramProfile = {
    handle,
    name: null,
    followers: 0,
    posts: [],
  }

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    )
    await page.setViewport({ width: 390, height: 844 })

    // Set cookies to bypass consent dialog
    await page.setCookie({
      name: 'ig_did',
      value: Math.random().toString(36).substring(2),
      domain: '.instagram.com',
    })

    const profileUrl = `https://www.instagram.com/${handle}/`
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Dismiss login popup if it appears
    try {
      const notNow = await page.$('button:has-text("Not Now"), button:has-text("Ahora no"), [role="button"][tabindex="0"]')
      if (notNow) await notNow.click()
      await new Promise((r) => setTimeout(r, 1000))
    } catch { /* ignore */ }

    // Extract profile info
    const profileData = await page.evaluate(() => {
      const metas = Array.from(document.querySelectorAll('meta'))
      let followers = 0
      let name: string | null = null

      // Try to get followers from meta description
      const descMeta = metas.find((m) => m.getAttribute('name') === 'description')
      if (descMeta) {
        const desc = descMeta.getAttribute('content') || ''
        const fMatch = desc.match(/([\d,.]+[KMkm]?)\s*Followers/i) || desc.match(/([\d,.]+[KMkm]?)\s*seguidores/i)
        if (fMatch) {
          let num = fMatch[1].replace(/,/g, '')
          if (num.endsWith('K') || num.endsWith('k')) {
            followers = Math.round(parseFloat(num) * 1000)
          } else if (num.endsWith('M') || num.endsWith('m')) {
            followers = Math.round(parseFloat(num) * 1000000)
          } else {
            followers = parseInt(num) || 0
          }
        }
      }

      // Try title for name
      const titleMeta = metas.find((m) => m.getAttribute('property') === 'og:title')
      if (titleMeta) {
        const title = titleMeta.getAttribute('content') || ''
        const nameMatch = title.match(/^(.+?)\s*[(@]/)
        if (nameMatch) name = nameMatch[1].trim()
      }

      return { followers, name }
    })

    result.followers = profileData.followers
    result.name = profileData.name

    // Scroll to load more posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000))
      await new Promise((r) => setTimeout(r, 2000))
    }

    // Extract post links from the grid
    const postLinks = await page.evaluate((max: number) => {
      const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
      return links.slice(0, max).map((a) => {
        const href = (a as HTMLAnchorElement).href
        const img = a.querySelector('img')
        const thumbnail = img?.src || null
        const isReel = href.includes('/reel/')
        return { href, thumbnail, isReel }
      })
    }, maxPosts)

    // Visit each post to get details
    for (const link of postLinks.slice(0, maxPosts)) {
      try {
        const postPage = await browser.newPage()
        await postPage.setUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        )

        await postPage.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await new Promise((r) => setTimeout(r, 2000))

        const postData = await postPage.evaluate(() => {
          const metas = Array.from(document.querySelectorAll('meta'))
          let caption = ''
          let likes = 0
          let comments = 0
          let publishedAt: string | null = null

          // Caption from og:description
          const descMeta = metas.find((m) => m.getAttribute('property') === 'og:description')
          if (descMeta) {
            const desc = descMeta.getAttribute('content') || ''
            // Format: "X likes, Y comments - Author: Caption"
            const likeMatch = desc.match(/([\d,]+)\s*(?:likes|Me gusta)/i)
            const commentMatch = desc.match(/([\d,]+)\s*(?:comments|comentarios)/i)
            if (likeMatch) likes = parseInt(likeMatch[1].replace(/,/g, '')) || 0
            if (commentMatch) comments = parseInt(commentMatch[1].replace(/,/g, '')) || 0

            const captionMatch = desc.match(/:\s*"(.+)"/) || desc.match(/-\s*(.+)/)
            if (captionMatch) caption = captionMatch[1].trim()
          }

          // Published date from time element
          const timeEl = document.querySelector('time[datetime]')
          if (timeEl) publishedAt = timeEl.getAttribute('datetime')

          return { caption, likes, comments, publishedAt }
        })

        // Extract shortcode from URL
        const shortcodeMatch = link.href.match(/\/(?:p|reel)\/([\w-]+)/)
        const shortcode = shortcodeMatch?.[1] || ''

        // Extract hashtags from caption
        const hashtags = (postData.caption || '').match(/#\w+/g)?.map((h) => h.toLowerCase()) || []

        // Detect carousel (multiple images in the same post)
        const isCarousel = await postPage.$('.swipe-indicator, [aria-label*="Carousel"], [aria-label*="carrusel"]') !== null

        let mediaType: 'image' | 'carousel' | 'reel' = 'image'
        if (link.isReel) mediaType = 'reel'
        else if (isCarousel) mediaType = 'carousel'

        result.posts.push({
          externalId: `ig_${shortcode}`,
          url: link.href,
          caption: postData.caption || null,
          hashtags,
          mediaType,
          likes: postData.likes,
          comments: postData.comments,
          thumbnailUrl: link.thumbnail,
          publishedAt: postData.publishedAt,
        })

        await postPage.close()
      } catch {
        // Skip individual post errors
      }

      // Rate limit between posts
      await new Promise((r) => setTimeout(r, 1500))
    }
  } catch (err) {
    console.error(`[Instagram] Error scraping @${handle}:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return result
}
