import { fetchAdsViaApi } from './adLibraryApi'
import { scrapeAdLibrary } from './adLibraryScraper'
import type { MetaAdRaw } from '@/types/scrape'

interface FetchAdsOptions {
  searchTerms?: string
  pageIds?: string[]
  countries: string[]
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL'
  onProgress?: (count: number) => void
  onLog?: (message: string) => void
}

export async function fetchAdsForCompetitor(
  token: string | null,
  options: FetchAdsOptions
): Promise<MetaAdRaw[]> {
  const log = options.onLog ?? ((msg: string) => console.log(msg))

  // Primary: use the Graph API if we have a token
  if (token) {
    try {
      log('[API] Intentando Meta Graph API...')
      const ads = await fetchAdsViaApi(token, {
        searchTerms: options.searchTerms,
        pageIds: options.pageIds,
        countries: options.countries,
        activeStatus: options.activeStatus,
        onProgress: options.onProgress,
      })

      if (ads.length > 0) {
        log(`[API] ✓ ${ads.length} anuncios obtenidos via API`)
        return ads
      }

      log('[API] API devolvió 0 anuncios, probando scraper...')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`[API] ✗ Error: ${msg}`)
      log('[API] Probando scraper como fallback...')
    }
  } else {
    log('[Scraper] No hay token META_ACCESS_TOKEN, usando scraper directamente')
  }

  // Fallback: Puppeteer scraper
  try {
    log('[Scraper] Lanzando Puppeteer scraper...')
    const ads = await scrapeAdLibrary({
      searchTerms: options.searchTerms,
      pageIds: options.pageIds,
      countries: options.countries,
      onProgress: options.onProgress,
    })
    if (ads.length === 0) {
      log('[Scraper] Scraper devolvió 0 anuncios (posible bloqueo de Facebook)')
    } else {
      log(`[Scraper] ✓ ${ads.length} anuncios obtenidos via scraper`)
    }
    return ads
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`[Scraper] ✗ Error: ${msg}`)
    throw err
  }
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
