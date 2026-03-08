import puppeteer from 'puppeteer'

export interface TrustpilotBusiness {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

export interface TrustpilotComment {
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

export async function searchTrustpilot(keyword: string, maxResults = 8): Promise<TrustpilotBusiness[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const businesses: TrustpilotBusiness[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    const searchUrl = `https://www.trustpilot.com/search?query=${encodeURIComponent(keyword)}`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const results = await page.evaluate((max: number) => {
      const cards = Array.from(
        document.querySelectorAll('[class*="business-unit-card"], [class*="search-result"], a[href*="/review/"]')
      ).slice(0, max)

      return cards.map((card) => {
        const linkEl = card.tagName === 'A' ? card as HTMLAnchorElement : card.querySelector('a[href*="/review/"]') as HTMLAnchorElement | null
        const url = linkEl?.href || ''

        const titleEl = card.querySelector('h2, h3, [class*="title"], [class*="displayName"]')
        const title = titleEl?.textContent?.trim() || linkEl?.textContent?.trim()?.split('\n')[0]?.trim() || ''

        const ratingEl = card.querySelector('[class*="rating"], [class*="star"], [class*="score"]')
        const ratingText = ratingEl?.textContent?.trim().replace(',', '.') || ''
        const rating = parseFloat(ratingText) || null

        const reviewCountEl = card.querySelector('[class*="review-count"], [class*="total"]')
        const reviewText = reviewCountEl?.textContent?.replace(/[^0-9]/g, '') || ''
        const reviewCount = parseInt(reviewText) || null

        const descEl = card.querySelector('[class*="description"], [class*="category"], p')
        const description = descEl?.textContent?.trim()?.slice(0, 300) || null

        return { title, url, authorName: null, price: null, rating, reviewCount, description }
      }).filter((b) => b.title && b.url && b.url.includes('/review/'))
    }, maxResults)

    businesses.push(...results)
  } catch (err) {
    console.error(`[Trustpilot] Error searching "${keyword}":`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return businesses
}

export async function scrapeTrustpilotReviews(businessUrl: string, maxReviews = 20): Promise<TrustpilotComment[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const comments: TrustpilotComment[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    await page.goto(businessUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const reviews = await page.evaluate((max: number) => {
      const reviewEls = Array.from(
        document.querySelectorAll('[class*="review-card"], [class*="review-content"], article[class*="review"]')
      ).slice(0, max)

      return reviewEls.map((el) => {
        const textEl = el.querySelector('[class*="review-content"], [class*="review-text"], p[class*="text"]')
        const text = textEl?.textContent?.trim() || el.querySelector('p')?.textContent?.trim() || ''

        const authorEl = el.querySelector('[class*="consumer-name"], [class*="author"], [class*="display-name"]')
        const author = authorEl?.textContent?.trim() || null

        const dateEl = el.querySelector('time, [class*="date"]')
        const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || null

        const starEl = el.querySelector('[class*="star-rating"] img, [data-service-review-rating]')
        const ratingAttr = starEl?.getAttribute('alt') || starEl?.getAttribute('data-service-review-rating') || ''
        const ratingMatch = ratingAttr.match(/(\d+)/)
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : null

        return { text, author, date, rating }
      }).filter((r) => r.text.length > 10)
    }, maxReviews)

    comments.push(...reviews)
  } catch (err) {
    console.error(`[Trustpilot] Error scraping reviews:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return comments
}
