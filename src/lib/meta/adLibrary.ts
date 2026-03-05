import { fetchAdsViaSearchApi } from './adLibraryApi'
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
  _token: string | null,
  options: FetchAdsOptions
): Promise<MetaAdRaw[]> {
  const log = options.onLog ?? ((msg: string) => console.log(msg))
  const apiKey = process.env.SEARCHAPI_KEY

  if (!apiKey) {
    log('✗ No hay SEARCHAPI_KEY configurado. Añádelo en Railway.')
    return []
  }

  try {
    log('Consultando Meta Ad Library via SearchAPI...')
    const ads = await fetchAdsViaSearchApi(apiKey, {
      searchTerms: options.searchTerms,
      pageIds: options.pageIds,
      countries: options.countries,
      activeStatus: options.activeStatus,
      onProgress: options.onProgress,
      onLog: options.onLog,
    })

    if (ads.length === 0) {
      log('La API devolvió 0 anuncios para este competidor')
    } else {
      log(`✓ ${ads.length} anuncios obtenidos`)
    }
    return ads
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`✗ Error: ${msg}`)
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
