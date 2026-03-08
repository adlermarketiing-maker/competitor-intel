import puppeteer from 'puppeteer'

export interface SkoolCommunity {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

export interface SkoolComment {
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

export async function searchSkool(keyword: string, maxCommunities = 8): Promise<SkoolCommunity[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const communities: SkoolCommunity[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 900 })

    await page.goto('https://www.skool.com/discovery', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Type in search box
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]')
    if (searchInput) {
      await searchInput.click()
      await searchInput.type(keyword, { delay: 50 })
      await page.keyboard.press('Enter')
      await new Promise((r) => setTimeout(r, 3000))
    }

    const results = await page.evaluate((max: number) => {
      const cards = Array.from(
        document.querySelectorAll('[class*="community-card"], [class*="group-card"], [data-testid*="community"]')
      ).slice(0, max)

      return cards.map((card) => {
        const titleEl = card.querySelector('h2, h3, [class*="name"], [class*="title"]')
        const title = titleEl?.textContent?.trim() || ''

        const linkEl = card.closest('a[href]') as HTMLAnchorElement | null ||
          card.querySelector('a[href]') as HTMLAnchorElement | null
        const url = linkEl?.href || ''

        const priceEl = card.querySelector('[class*="price"]')
        const price = priceEl?.textContent?.trim() || 'Gratis'

        const membersEl = card.querySelector('[class*="member"], [class*="Member"]')
        const reviewCount = parseInt(membersEl?.textContent?.replace(/[^0-9]/g, '') || '0') || null

        const descEl = card.querySelector('p, [class*="description"]')
        const description = descEl?.textContent?.trim()?.slice(0, 300) || null

        return { title, url, authorName: null, price, rating: null, reviewCount, description }
      }).filter((c) => c.title && c.url)
    }, maxCommunities)

    communities.push(...results)
  } catch (err) {
    console.error(`[Skool] Error searching "${keyword}":`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return communities
}

export async function scrapeSkoolComments(communityUrl: string, maxComments = 20): Promise<SkoolComment[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const comments: SkoolComment[] = []

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 900 })

    await page.goto(communityUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const posts = await page.evaluate((max: number) => {
      const postEls = Array.from(
        document.querySelectorAll('[class*="post"], [class*="feed-item"], [class*="comment"]')
      ).slice(0, max)

      return postEls.map((el) => {
        const text = el.querySelector('[class*="body"], [class*="content"], p')?.textContent?.trim()
          || el.textContent?.trim() || ''
        const author = el.querySelector('[class*="name"], [class*="author"]')?.textContent?.trim() || null
        const date = el.querySelector('[class*="date"], time')?.getAttribute('datetime')
          || el.querySelector('[class*="date"], time')?.textContent?.trim() || null
        return { text, author, date, rating: null }
      }).filter((p) => p.text.length > 10)
    }, maxComments)

    comments.push(...posts)
  } catch (err) {
    console.error(`[Skool] Error scraping comments:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await browser.close()
  }

  return comments
}
