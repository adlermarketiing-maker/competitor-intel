/**
 * Sitemap.xml discovery and parsing.
 * Most WordPress/WooCommerce/Shopify sites expose a sitemap that lists ALL pages.
 * This is the most reliable way to discover landing pages when direct crawling fails (403, etc.).
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]

async function fetchWithRetry(url: string, timeoutMs = 15000): Promise<string | null> {
  for (const ua of USER_AGENTS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
        },
        redirect: 'follow',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) return await res.text()
      // If 403/401, try next UA
      if (res.status === 403 || res.status === 401) continue
      return null
    } catch {
      continue
    }
  }
  return null
}

/** Extract URLs from a sitemap XML string */
function extractUrlsFromSitemap(xml: string): string[] {
  const urls: string[] = []
  // Match <loc>...</loc> tags
  const locMatches = xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)
  for (const m of locMatches) {
    const url = m[1].trim()
    if (url.startsWith('http')) {
      urls.push(url)
    }
  }
  return urls
}

/** Check if a sitemap URL points to a sitemap index (contains other sitemaps) */
function isSitemapIndex(xml: string): boolean {
  return xml.includes('<sitemapindex') || xml.includes('<sitemap>')
}

/**
 * Discover all page URLs from a website's sitemap.
 * Tries multiple common sitemap paths and handles sitemap indexes.
 * Returns unique URLs found, up to maxUrls.
 */
export async function discoverUrlsFromSitemap(
  websiteUrl: string,
  options?: { maxUrls?: number; onProgress?: (msg: string) => Promise<void> }
): Promise<string[]> {
  const maxUrls = options?.maxUrls ?? 200
  const emit = options?.onProgress ?? (async () => {})

  let baseUrl: string
  try {
    const parsed = new URL(websiteUrl)
    baseUrl = parsed.origin
  } catch {
    return []
  }

  // Common sitemap paths to try
  const sitemapPaths = [
    '/sitemap.xml',
    '/wp-sitemap.xml',           // WordPress 5.5+ default
    '/sitemap_index.xml',        // Yoast SEO
    '/post-sitemap.xml',         // Yoast posts
    '/page-sitemap.xml',         // Yoast pages
    '/product-sitemap.xml',      // WooCommerce products
    '/sitemap-0.xml',            // Some generators
  ]

  const allUrls = new Set<string>()
  const processedSitemaps = new Set<string>()

  async function processSitemap(url: string, depth = 0): Promise<void> {
    if (depth > 3 || processedSitemaps.has(url) || allUrls.size >= maxUrls) return
    processedSitemaps.add(url)

    const content = await fetchWithRetry(url)
    if (!content) return

    if (isSitemapIndex(content)) {
      // This is a sitemap index — extract child sitemap URLs
      const childSitemaps = extractUrlsFromSitemap(content)
        .filter((u) => u.endsWith('.xml') || u.includes('sitemap'))
      await emit(`Sitemap index encontrado: ${childSitemaps.length} sub-sitemaps`)

      for (const childUrl of childSitemaps) {
        if (allUrls.size >= maxUrls) break
        await processSitemap(childUrl, depth + 1)
      }
    } else {
      // Regular sitemap — extract page URLs
      const pageUrls = extractUrlsFromSitemap(content)
      for (const u of pageUrls) {
        if (allUrls.size >= maxUrls) break
        if (!u.endsWith('.xml')) {
          allUrls.add(u)
        }
      }
      if (pageUrls.length > 0) {
        await emit(`Sitemap ${url.split('/').pop()}: ${pageUrls.length} URLs`)
      }
    }
  }

  // Try each sitemap path
  for (const path of sitemapPaths) {
    const sitemapUrl = baseUrl + path
    await processSitemap(sitemapUrl)
    if (allUrls.size > 0 && allUrls.size >= 5) break // Found enough, stop trying
  }

  // Also try robots.txt for sitemap directives
  if (allUrls.size < 5) {
    try {
      const robotsTxt = await fetchWithRetry(baseUrl + '/robots.txt', 8000)
      if (robotsTxt) {
        const sitemapDirectives = robotsTxt.matchAll(/^Sitemap:\s*(.+)$/gmi)
        for (const m of sitemapDirectives) {
          const sitemapUrl = m[1].trim()
          if (sitemapUrl.startsWith('http')) {
            await processSitemap(sitemapUrl)
          }
        }
      }
    } catch { /* ignore */ }
  }

  return [...allUrls].slice(0, maxUrls)
}

/**
 * Try common WordPress/WooCommerce page paths when sitemap is unavailable.
 * Returns URLs that respond with 200 OK.
 */
export async function probeCommonPaths(websiteUrl: string): Promise<string[]> {
  let baseUrl: string
  try {
    const parsed = new URL(websiteUrl)
    baseUrl = parsed.origin
  } catch {
    return []
  }

  const commonPaths = [
    '/tienda/',
    '/shop/',
    '/cursos/',
    '/courses/',
    '/productos/',
    '/products/',
    '/servicios/',
    '/services/',
    '/blog/',
    '/sobre-nosotros/',
    '/about/',
    '/contacto/',
    '/contact/',
    '/precios/',
    '/pricing/',
    '/faq/',
    '/testimonios/',
  ]

  const found: string[] = []
  for (const path of commonPaths) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(baseUrl + path, {
        method: 'HEAD',
        headers: {
          'User-Agent': USER_AGENTS[0],
        },
        redirect: 'follow',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) {
        found.push(res.url || (baseUrl + path))
      }
    } catch { /* ignore */ }
  }

  return found
}
