import { fetchAdsViaApi } from './adLibraryApi'
import { scrapeAdLibrary } from './adLibraryScraper'
import type { MetaAdRaw } from '@/types/scrape'

interface FetchAdsOptions {
  searchTerms?: string
  pageIds?: string[]
  countries: string[]
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL'
  onProgress?: (count: number) => void
}

export async function fetchAdsForCompetitor(
  token: string | null,
  options: FetchAdsOptions
): Promise<MetaAdRaw[]> {
  // Primary: use the Graph API if we have a token
  if (token) {
    try {
      console.log('[AdLibrary] Using Graph API (token available)')
      const ads = await fetchAdsViaApi(token, {
        searchTerms: options.searchTerms,
        pageIds: options.pageIds,
        countries: options.countries,
        activeStatus: options.activeStatus,
        onProgress: options.onProgress,
      })

      if (ads.length > 0) {
        return ads
      }

      console.log('[AdLibrary] Graph API returned 0 ads, falling back to scraper')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[AdLibrary] Graph API failed: ${msg}, falling back to scraper`)
    }
  } else {
    console.log('[AdLibrary] No token available, using scraper directly')
  }

  // Fallback: Puppeteer scraper
  return scrapeAdLibrary({
    searchTerms: options.searchTerms,
    pageIds: options.pageIds,
    countries: options.countries,
    onProgress: options.onProgress,
  })
}

export function buildAdLibraryUrl(fbPageName: string, countries: string[]): string {
  const country = countries[0] ?? 'ES'
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(fbPageName)}&search_type=page`
}

export function buildFacebookPageUrl(fbPageName: string): string {
  return `https://www.facebook.com/${fbPageName}`
}

export function buildInstagramUrl(fbPageName: string): string {
  return `https://www.instagram.com/${fbPageName}/`
}
