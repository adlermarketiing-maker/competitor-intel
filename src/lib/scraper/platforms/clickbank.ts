import puppeteer from 'puppeteer'

export interface ClickbankProduct {
  title: string
  url: string
  authorName: string | null
  description: string | null
  category: string | null
  gravity: number | null
  avgEarningsPerSale: number | null
  price: string | null
  rating: number | null
  reviewCount: number | null
}

export interface ClickbankReview {
  author: string | null
  text: string
  rating: number | null
  date: string | null
}

async function getBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
}

/**
 * Search Clickbank marketplace for products by keyword.
 */
export async function searchClickbank(keyword: string, maxResults = 8): Promise<ClickbankProduct[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1280, height: 800 })

    const url = `https://www.clickbank.com/mkplSearchResult.htm?dession=&includeKeywords=${encodeURIComponent(keyword)}&sortField=GRAVITY&sortOrder=DESCENDING`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const products = await page.evaluate((max: number) => {
      const items: Array<{
        title: string
        url: string
        authorName: string | null
        description: string | null
        category: string | null
        gravity: number | null
        avgEarningsPerSale: number | null
        price: string | null
      }> = []

      const rows = document.querySelectorAll('.listing, .results .result, [class*="product"], tr[class*="row"]')

      rows.forEach((row) => {
        if (items.length >= max) return

        const titleEl = row.querySelector('a[class*="title"], .title a, h3 a, .name a, a strong') as HTMLAnchorElement
        const descEl = row.querySelector('.description, .desc, [class*="desc"]')
        const catEl = row.querySelector('.category, [class*="category"]')

        // Try to extract gravity and earnings from stats text
        const statsText = row.textContent || ''
        const gravityMatch = statsText.match(/(?:Grav|Gravity)[:\s]*(\d+\.?\d*)/i)
        const earningsMatch = statsText.match(/(?:Avg|Average)\s*\$/i) ? statsText.match(/\$(\d+\.?\d*)/) : null
        const priceMatch = statsText.match(/\$\s*(\d+\.?\d*)/)

        if (titleEl) {
          items.push({
            title: titleEl.textContent?.trim() || '',
            url: titleEl.href || '',
            authorName: null,
            description: descEl?.textContent?.trim() || null,
            category: catEl?.textContent?.trim() || null,
            gravity: gravityMatch ? parseFloat(gravityMatch[1]) : null,
            avgEarningsPerSale: earningsMatch ? parseFloat(earningsMatch[1]) : null,
            price: priceMatch ? `$${priceMatch[1]}` : null,
          })
        }
      })

      // Fallback: try parsing any links in the page that look like products
      if (items.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="clickbank"], a[href*="hop.clickbank"]')
        allLinks.forEach((a) => {
          if (items.length >= max) return
          const anchor = a as HTMLAnchorElement
          const text = anchor.textContent?.trim()
          if (text && text.length > 5 && !text.startsWith('http')) {
            items.push({
              title: text,
              url: anchor.href,
              authorName: null,
              description: null,
              category: null,
              gravity: null,
              avgEarningsPerSale: null,
              price: null,
            })
          }
        })
      }

      return items
    }, maxResults)

    return products
      .filter((p) => p.title && p.url)
      .map((p) => ({ ...p, rating: null, reviewCount: null }))
  } catch (err) {
    console.error('[Clickbank] Search error:', err instanceof Error ? err.message : err)
    return []
  } finally {
    await page.close()
    await browser.close()
  }
}

/**
 * Scrape a Clickbank product page for reviews/testimonials.
 * Clickbank products link to vendor pages, so we scrape those for testimonials.
 */
export async function scrapeClickbankReviews(productUrl: string, maxReviews = 15): Promise<ClickbankReview[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1280, height: 800 })

    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))

    const reviews = await page.evaluate((max: number) => {
      const items: Array<{ author: string | null; text: string; rating: number | null; date: string | null }> = []

      // Look for testimonial patterns common on sales pages
      const testimonialSelectors = [
        '[class*="testimonial"]',
        '[class*="review"]',
        '[class*="feedback"]',
        'blockquote',
        '[class*="quote"]',
        '[class*="social-proof"]',
      ]

      for (const selector of testimonialSelectors) {
        const elements = document.querySelectorAll(selector)
        elements.forEach((el) => {
          if (items.length >= max) return
          const text = el.textContent?.trim() || ''
          if (text.length > 20 && text.length < 2000) {
            const authorEl = el.querySelector('[class*="author"], [class*="name"], cite, strong, b')
            items.push({
              author: authorEl?.textContent?.trim() || null,
              text,
              rating: null,
              date: null,
            })
          }
        })
        if (items.length >= max) break
      }

      return items
    }, maxReviews)

    return reviews.filter((r) => r.text.length > 10)
  } catch (err) {
    console.error('[Clickbank] Review scrape error:', err instanceof Error ? err.message : err)
    return []
  } finally {
    await page.close()
    await browser.close()
  }
}
