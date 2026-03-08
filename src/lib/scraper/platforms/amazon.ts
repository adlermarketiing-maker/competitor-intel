import puppeteer from 'puppeteer'

export interface AmazonProduct {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

export interface AmazonComment {
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

export async function searchAmazon(keyword: string, maxProducts = 8): Promise<AmazonProduct[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const products: AmazonProduct[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    // Search Amazon Spain for books/digital products
    const searchUrl = `https://www.amazon.es/s?k=${encodeURIComponent(keyword)}&i=stripbooks`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const results = await page.evaluate((max: number) => {
      const items = Array.from(
        document.querySelectorAll('[data-component-type="s-search-result"], .s-result-item[data-asin]')
      ).slice(0, max)

      return items.map((item) => {
        const titleEl = item.querySelector('h2 a, .a-link-normal .a-text-normal, h2 span')
        const linkEl = item.querySelector('h2 a') as HTMLAnchorElement | null
        const title = titleEl?.textContent?.trim() || ''
        const url = linkEl?.href || ''

        const authorEl = item.querySelector('.a-row .a-size-base+ .a-size-base, [class*="author"]')
        const authorName = authorEl?.textContent?.trim() || null

        const priceEl = item.querySelector('.a-price .a-offscreen, .a-price-whole')
        const price = priceEl?.textContent?.trim() || null

        const ratingEl = item.querySelector('[class*="a-icon-alt"]')
        const ratingText = ratingEl?.textContent?.replace(',', '.') || ''
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/)
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null

        const reviewCountEl = item.querySelector('[class*="a-size-base"][href*="customerReviews"], .a-size-base.s-underline-text')
        const reviewText = reviewCountEl?.textContent?.replace(/[^0-9]/g, '') || ''
        const reviewCount = parseInt(reviewText) || null

        return { title, url, authorName, price, rating, reviewCount, description: null }
      }).filter((p) => p.title && p.url)
    }, maxProducts)

    products.push(...results)
  } catch (err) {
    console.error(`[Amazon] Error searching "${keyword}":`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return products
}

export async function scrapeAmazonReviews(productUrl: string, maxReviews = 20): Promise<AmazonComment[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const comments: AmazonComment[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    // Navigate to reviews page if not already there
    let reviewUrl = productUrl
    if (!productUrl.includes('/product-reviews/')) {
      const asinMatch = productUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
      if (asinMatch) {
        reviewUrl = `https://www.amazon.es/product-reviews/${asinMatch[1]}/ref=cm_cr_dp_d_show_all_btm?sortBy=recent`
      }
    }

    await page.goto(reviewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const reviews = await page.evaluate((max: number) => {
      const reviewEls = Array.from(
        document.querySelectorAll('[data-hook="review"], .review, .a-section.review')
      ).slice(0, max)

      return reviewEls.map((el) => {
        const textEl = el.querySelector('[data-hook="review-body"] span, .review-text-content span, .review-text')
        const text = textEl?.textContent?.trim() || ''

        const authorEl = el.querySelector('[data-hook="review-author"] span, .a-profile-name')
        const author = authorEl?.textContent?.trim() || null

        const dateEl = el.querySelector('[data-hook="review-date"], .review-date')
        const date = dateEl?.textContent?.trim() || null

        const ratingEl = el.querySelector('[data-hook="review-star-rating"] span, .a-icon-alt')
        const ratingText = ratingEl?.textContent?.replace(',', '.') || ''
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/)
        const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : null

        return { text, author, date, rating }
      }).filter((r) => r.text.length > 10)
    }, maxReviews)

    comments.push(...reviews)
  } catch (err) {
    console.error(`[Amazon] Error scraping reviews:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return comments
}
