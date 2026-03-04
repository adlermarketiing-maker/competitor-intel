import puppeteer from 'puppeteer'

export interface UdemyCourse {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

export interface UdemyComment {
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

export async function searchUdemy(keyword: string, maxCourses = 8): Promise<UdemyCourse[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const courses: UdemyCourse[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    const searchUrl = `https://www.udemy.com/courses/search/?q=${encodeURIComponent(keyword)}&lang=es&sort=relevance`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const results = await page.evaluate((max: number) => {
      const items = Array.from(document.querySelectorAll('[data-purpose="course-title-url"]')).slice(0, max)
      return items.map((el) => {
        const link = el as HTMLAnchorElement
        const card = link.closest('[class*="course-card"]') || link.closest('li') || link.parentElement
        const title = link.textContent?.trim() || ''
        const url = link.href || ''

        // Rating
        const ratingEl = card?.querySelector('[data-purpose="rating-number"]') ||
          card?.querySelector('[class*="star-rating"]')
        const ratingText = ratingEl?.textContent?.trim().replace(',', '.') || ''
        const rating = parseFloat(ratingText) || null

        // Review count
        const reviewEl = card?.querySelector('[data-purpose="enrollment"]') ||
          card?.querySelector('[class*="enrollment"]')
        const reviewText = reviewEl?.textContent?.replace(/[^0-9]/g, '') || ''
        const reviewCount = parseInt(reviewText) || null

        // Price
        const priceEl = card?.querySelector('[data-purpose="course-price-text"]') ||
          card?.querySelector('[class*="price"]')
        const price = priceEl?.textContent?.trim() || null

        // Author
        const authorEl = card?.querySelector('[class*="instructor"]') ||
          card?.querySelector('[data-purpose="instructor-name"]')
        const authorName = authorEl?.textContent?.trim() || null

        return { title, url, authorName, price, rating, reviewCount, description: null }
      }).filter((c) => c.title && c.url)
    }, maxCourses)

    courses.push(...results)
  } catch {
    // Silently fail — return whatever was collected
  } finally {
    await page.close()
    await browser.close()
  }

  return courses
}

export async function scrapeUdemyReviews(courseUrl: string, maxReviews = 20): Promise<UdemyComment[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const comments: UdemyComment[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const reviews = await page.evaluate((max: number) => {
      const reviewEls = Array.from(
        document.querySelectorAll('[data-purpose="review-comment-content"], [class*="review-comment"]')
      ).slice(0, max)

      return reviewEls.map((el) => {
        const text = el.querySelector('[data-purpose="review-comment-content"]')?.textContent?.trim()
          || el.textContent?.trim() || ''
        const author = el.querySelector('[class*="user-name"]')?.textContent?.trim() || null
        const date = el.querySelector('[class*="date"]')?.textContent?.trim() || null
        const ratingEl = el.querySelector('[class*="star"]')
        const ratingText = ratingEl?.getAttribute('aria-label') || ''
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/)
        const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : null
        return { text, author, date, rating }
      }).filter((r) => r.text.length > 10)
    }, maxReviews)

    comments.push(...reviews)
  } catch {
    // Silently fail
  } finally {
    await page.close()
    await browser.close()
  }

  return comments
}
