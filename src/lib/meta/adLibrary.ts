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
  _token: string | null,
  options: FetchAdsOptions
): Promise<MetaAdRaw[]> {
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
