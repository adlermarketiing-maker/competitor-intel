import puppeteer from 'puppeteer'

export interface PylonProduct {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

export interface PylonComment {
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

export async function searchPylon(keyword: string, maxProducts = 8): Promise<PylonProduct[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const products: PylonProduct[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    // Try Pylon marketplace / search
    const searchUrl = `https://app.usepylon.com/marketplace?search=${encodeURIComponent(keyword)}`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 4000))

    const results = await page.evaluate((max: number) => {
      // Generic extraction — Pylon's structure may vary
      const cards = Array.from(
        document.querySelectorAll('[class*="product"], [class*="card"], [class*="item"]')
      ).slice(0, max)

      return cards.map((card) => {
        const titleEl = card.querySelector('h1, h2, h3, [class*="title"], [class*="name"]')
        const title = titleEl?.textContent?.trim() || ''

        const linkEl = card.querySelector('a[href]') as HTMLAnchorElement | null
        const url = linkEl?.href || ''

        const priceEl = card.querySelector('[class*="price"]')
        const price = priceEl?.textContent?.trim() || null

        const descEl = card.querySelector('p, [class*="description"]')
        const description = descEl?.textContent?.trim()?.slice(0, 300) || null

        const authorEl = card.querySelector('[class*="author"], [class*="creator"]')
        const authorName = authorEl?.textContent?.trim() || null

        return { title, url, authorName, price, rating: null, reviewCount: null, description }
      }).filter((p) => p.title && p.url)
    }, maxProducts)

    products.push(...results)
  } catch {
    // Silently fail
  } finally {
    await page.close()
    await browser.close()
  }

  return products
}

export async function scrapePylonComments(productUrl: string, maxComments = 20): Promise<PylonComment[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const comments: PylonComment[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const reviews = await page.evaluate((max: number) => {
      const reviewEls = Array.from(
        document.querySelectorAll('[class*="review"], [class*="testimonial"], [class*="comment"], [class*="feedback"]')
      ).slice(0, max)

      return reviewEls.map((el) => {
        const text = el.querySelector('p, [class*="text"], [class*="body"]')?.textContent?.trim()
          || el.textContent?.trim() || ''
        const author = el.querySelector('[class*="name"], [class*="author"]')?.textContent?.trim() || null
        const date = el.querySelector('time, [class*="date"]')?.textContent?.trim() || null
        const ratingEl = el.querySelector('[class*="star"], [class*="rating"]')
        const ratingText = ratingEl?.getAttribute('aria-label') || ratingEl?.textContent || ''
        const ratingMatch = ratingText.match(/(\d)/)
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : null
        return { text, author, date, rating }
      }).filter((r) => r.text.length > 10)
    }, maxComments)

    comments.push(...reviews)
  } catch {
    // Silently fail
  } finally {
    await page.close()
    await browser.close()
  }

  return comments
}
