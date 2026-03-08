import puppeteer from 'puppeteer'

export interface HotmartProduct {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

export interface HotmartComment {
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

export async function searchHotmart(keyword: string, maxProducts = 8): Promise<HotmartProduct[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const products: HotmartProduct[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    // Hotmart marketplace search
    const searchUrl = `https://hotmart.com/es/marketplace?q=${encodeURIComponent(keyword)}`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 4000))

    const results = await page.evaluate((max: number) => {
      const cards = Array.from(document.querySelectorAll('[class*="product-card"], [class*="card-product"]')).slice(0, max)
      return cards.map((card) => {
        const titleEl = card.querySelector('[class*="product-name"], [class*="card-title"], h3, h2')
        const title = titleEl?.textContent?.trim() || ''

        const linkEl = card.querySelector('a[href]') as HTMLAnchorElement | null
        const url = linkEl?.href || ''

        const priceEl = card.querySelector('[class*="price"]')
        const price = priceEl?.textContent?.trim() || null

        const authorEl = card.querySelector('[class*="producer"], [class*="author"]')
        const authorName = authorEl?.textContent?.trim() || null

        const ratingEl = card.querySelector('[class*="rating"], [class*="stars"]')
        const ratingText = ratingEl?.textContent?.trim().replace(',', '.') || ''
        const rating = parseFloat(ratingText) || null

        const descEl = card.querySelector('[class*="description"], p')
        const description = descEl?.textContent?.trim()?.slice(0, 300) || null

        return { title, url, authorName, price, rating, reviewCount: null, description }
      }).filter((p) => p.title && p.url)
    }, maxProducts)

    products.push(...results)
  } catch (err) {
    console.error(`[Hotmart] Error searching "${keyword}":`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return products
}

export async function scrapeHotmartComments(productUrl: string, maxComments = 20): Promise<HotmartComment[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const comments: HotmartComment[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Scroll to testimonials section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await new Promise((r) => setTimeout(r, 1500))

    const reviews = await page.evaluate((max: number) => {
      const reviewEls = Array.from(
        document.querySelectorAll('[class*="testimonial"], [class*="review"], [class*="comment"]')
      ).slice(0, max)

      return reviewEls.map((el) => {
        const text = el.querySelector('[class*="text"], p')?.textContent?.trim()
          || el.textContent?.trim() || ''
        const author = el.querySelector('[class*="name"], [class*="author"]')?.textContent?.trim() || null
        const date = el.querySelector('[class*="date"], time')?.textContent?.trim() || null
        return { text, author, date, rating: null }
      }).filter((r) => r.text.length > 10)
    }, maxComments)

    comments.push(...reviews)
  } catch (err) {
    console.error(`[Hotmart] Error scraping comments:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return comments
}
