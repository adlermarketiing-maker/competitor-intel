import axios from 'axios'
import type { MetaAdRaw } from '@/types/scrape'

const SEARCHAPI_URL = 'https://www.searchapi.io/api/v1/search'

interface FetchAdsApiOptions {
  searchTerms?: string
  pageIds?: string[]
  countries: string[]
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL'
  maxAds?: number
  onProgress?: (count: number) => void
  onLog?: (message: string) => void
}

interface SearchApiAd {
  ad_archive_id?: string
  page_id?: string
  snapshot?: {
    page_name?: string
    body?: { text?: string }
    title?: string
    link_url?: string
    link_description?: string
    images?: Array<{ original_image_url?: string; resized_image_url?: string }>
    videos?: Array<{ video_hd_url?: string; video_sd_url?: string; video_preview_image_url?: string }>
    cards?: Array<{ body?: string; title?: string; link_url?: string }>
  }
  is_active?: boolean
  start_date?: string
  end_date?: string
  publisher_platform?: string[]
}

interface SearchApiResponse {
  search_information?: { total_results?: number }
  ads?: SearchApiAd[]
  pagination?: { next_page_token?: string }
  error?: string
}

interface PageSearchResponse {
  page_results?: Array<{
    page_id: string
    name: string
    category?: string
    likes?: number
    ig_username?: string
  }>
  error?: string
}

function mapAd(ad: SearchApiAd): MetaAdRaw {
  const snap = ad.snapshot ?? {}
  const bodies: string[] = []
  if (snap.body?.text) bodies.push(snap.body.text)
  if (snap.cards) {
    for (const card of snap.cards) {
      if (card.body) bodies.push(card.body)
    }
  }

  // Extract link URL: prefer snapshot-level, fallback to first card link
  let linkUrl = snap.link_url
  if (!linkUrl && snap.cards) {
    for (const card of snap.cards) {
      if (card.link_url) { linkUrl = card.link_url; break }
    }
  }

  return {
    id: ad.ad_archive_id ?? '',
    page_id: ad.page_id,
    page_name: snap.page_name,
    ad_creative_bodies: bodies.length > 0 ? bodies : undefined,
    ad_creative_link_titles: snap.title ? [snap.title] : undefined,
    ad_creative_link_descriptions: snap.link_description ? [snap.link_description] : undefined,
    ad_creative_link_url: linkUrl,
    ad_creative_images: snap.images,
    ad_creative_videos: snap.videos,
    ad_delivery_start_time: ad.start_date,
    ad_delivery_stop_time: ad.end_date,
    publisher_platforms: ad.publisher_platform,
    ad_snapshot_url: ad.ad_archive_id
      ? `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&id=${ad.ad_archive_id}`
      : undefined,
  }
}

/**
 * Search for a Facebook page by name and return its page_id.
 * Uses SearchAPI's meta_ad_library_page_search engine.
 */
export async function findPageId(
  apiKey: string,
  searchName: string,
  onLog?: (msg: string) => void
): Promise<{ pageId: string; pageName: string } | null> {
  const log = onLog ?? ((msg: string) => console.log(msg))

  try {
    const { data } = await axios.get<PageSearchResponse>(SEARCHAPI_URL, {
      params: {
        engine: 'meta_ad_library_page_search',
        api_key: apiKey,
        q: searchName,
      },
    })

    if (data.error || !data.page_results?.length) {
      log(`No se encontró página de Facebook para "${searchName}"`)
      return null
    }

    // Pick the best match by name similarity, preferring pages with more likes
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim()
    const normSearch = normalize(searchName)

    // Score each result: name similarity + likes as tiebreaker
    const scored = data.page_results.map((p) => {
      const normName = normalize(p.name)
      const exact = normName === normSearch ? 10 : 0
      const includes = normName.includes(normSearch) || normSearch.includes(normName) ? 5 : 0
      const wordMatch = normSearch.split(/\s+/).filter((w) => w.length > 2 && normName.includes(w)).length
      return { page: p, score: exact + includes + wordMatch + Math.min(Math.log10((p.likes ?? 0) + 1), 3) }
    })
    scored.sort((a, b) => b.score - a.score)

    const best = scored[0]
    if (best.score < 1) {
      log(`No se encontró página que coincida con "${searchName}" (mejor candidato: "${best.page.name}" score=${best.score.toFixed(1)})`)
      return null
    }

    const page = best.page
    log(`✓ Página encontrada: "${page.name}" (ID: ${page.page_id}, ${page.likes ?? 0} likes)`)
    return { pageId: page.page_id, pageName: page.name }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Error buscando página: ${msg}`)
    return null
  }
}

export interface DiscoveredPage {
  pageId: string
  pageName: string
  category?: string
  likes?: number
  igUsername?: string
}

/**
 * Search for Facebook pages by keyword — returns ALL matching pages, not just the best one.
 * Used by the Discover feature to find advertisers related to a niche/keyword.
 */
export async function searchPages(
  apiKey: string,
  keywords: string,
  onLog?: (msg: string) => void
): Promise<DiscoveredPage[]> {
  const log = onLog ?? ((msg: string) => console.log(msg))

  try {
    log(`Buscando páginas de anunciantes para "${keywords}"...`)
    const { data } = await axios.get<PageSearchResponse>(SEARCHAPI_URL, {
      params: {
        engine: 'meta_ad_library_page_search',
        api_key: apiKey,
        q: keywords,
      },
    })

    if (data.error || !data.page_results?.length) {
      log(`No se encontraron páginas para "${keywords}"`)
      return []
    }

    const pages: DiscoveredPage[] = data.page_results.map((p) => ({
      pageId: p.page_id,
      pageName: p.name,
      category: p.category,
      likes: p.likes,
      igUsername: p.ig_username,
    }))

    log(`✓ ${pages.length} páginas encontradas`)
    return pages
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Error buscando páginas: ${msg}`)
    return []
  }
}

/**
 * Fetch a sample of ads for a given page_id.
 * Used by Discover to get ads per discovered advertiser.
 */
export async function fetchAdsForPage(
  apiKey: string,
  pageId: string,
  options?: { maxAds?: number; activeStatus?: string }
): Promise<MetaAdRaw[]> {
  const maxAds = options?.maxAds ?? 20
  const ads: MetaAdRaw[] = []

  const params: Record<string, string> = {
    engine: 'meta_ad_library',
    api_key: apiKey,
    ad_type: 'all',
    active_status: (options?.activeStatus ?? 'active').toLowerCase(),
    country: 'ALL',
    page_id: pageId,
  }

  try {
    const { data } = await axios.get<SearchApiResponse>(SEARCHAPI_URL, { params })

    if (data.error || !data.ads?.length) return []

    for (const ad of data.ads) {
      if (ad.ad_archive_id) {
        ads.push(mapAd(ad))
        if (ads.length >= maxAds) break
      }
    }
  } catch {
    // Silently fail for individual page fetches
  }

  return ads
}

// ── Keyword-based ad content search (for Discover) ──────────────────────────

export interface DiscoveredAdvertiserRaw {
  pageId: string
  pageName: string
  ads: MetaAdRaw[]
  landingUrls: Set<string>
  adCopies: string[]
  adImages: string[]
}

interface KeywordSearchOptions {
  keywords: string
  countries: string[]
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL'
  maxPages?: number          // max API pages to paginate through (default 200)
  onProgress?: (info: { adsScanned: number; advertisersFound: number; page: number }) => void
  onLog?: (msg: string) => void
}

/**
 * Search the Meta Ad Library by KEYWORD IN AD CONTENT (not page name).
 * Uses the `meta_ad_library` engine with `search_terms` parameter.
 *
 * Strategy: ONE deep global search with country=ALL, paginating through as
 * many pages as the API allows. This is far more efficient than searching
 * each country individually — a single search_terms query can return tens of
 * thousands of ads from all countries at once.
 *
 * After the global pass, we do a second pass on each explicitly-selected
 * country to catch region-specific ads that the global search might rank lower.
 */
export async function searchAdsByKeyword(
  apiKey: string,
  options: KeywordSearchOptions,
): Promise<DiscoveredAdvertiserRaw[]> {
  const log = options.onLog ?? ((msg: string) => console.log(msg))
  const maxPages = options.maxPages ?? 200
  const advertisersMap = new Map<string, DiscoveredAdvertiserRaw>()
  let totalAdsScanned = 0
  let totalApiPages = 0

  const processAds = (ads: SearchApiAd[]) => {
    for (const ad of ads) {
      if (!ad.ad_archive_id) continue
      totalAdsScanned++

      const mapped = mapAd(ad)
      const pageId = ad.page_id ?? mapped.page_id ?? 'unknown'
      const pageName = ad.snapshot?.page_name ?? mapped.page_name ?? 'Desconocido'

      let advertiser = advertisersMap.get(pageId)
      if (!advertiser) {
        advertiser = {
          pageId,
          pageName,
          ads: [],
          landingUrls: new Set(),
          adCopies: [],
          adImages: [],
        }
        advertisersMap.set(pageId, advertiser)
      }

      advertiser.ads.push(mapped)

      if (mapped.ad_creative_link_url) {
        advertiser.landingUrls.add(mapped.ad_creative_link_url)
      }
      if (mapped.ad_creative_bodies?.[0] && advertiser.adCopies.length < 10) {
        advertiser.adCopies.push(mapped.ad_creative_bodies[0].slice(0, 500))
      }
      if (mapped.ad_creative_images?.[0]?.original_image_url && advertiser.adImages.length < 10) {
        advertiser.adImages.push(mapped.ad_creative_images[0].original_image_url)
      }
    }
  }

  /**
   * Paginate through one search query until exhaustion or maxPages.
   * Returns the number of pages actually fetched.
   */
  const paginateSearch = async (
    label: string,
    baseParams: Record<string, string>,
    pagesLimit: number,
  ): Promise<number> => {
    const params = { ...baseParams }
    let pageNum = 0

    while (pageNum < pagesLimit) {
      pageNum++
      totalApiPages++

      let response: SearchApiResponse
      try {
        const { data } = await axios.get<SearchApiResponse>(SEARCHAPI_URL, { params })
        response = data
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status
          if (status === 429) {
            log(`Rate limited (${label}, p${pageNum}). Esperando 5s...`)
            await new Promise((r) => setTimeout(r, 5000))
            // Retry once
            try {
              const { data } = await axios.get<SearchApiResponse>(SEARCHAPI_URL, { params })
              response = data
            } catch {
              log(`Rate limited de nuevo. Parando búsqueda ${label}.`)
              break
            }
          } else if (status === 401) {
            throw new Error('SearchAPI key inválida')
          } else {
            log(`Error HTTP ${status} en ${label} p${pageNum}. Saltando...`)
            break
          }
        } else {
          throw err
        }
      }

      if (response!.error) {
        if (response!.error.toLowerCase().includes('didn\'t return any results') ||
            response!.error.toLowerCase().includes('no results')) {
          break
        }
        log(`API error (${label} p${pageNum}): ${response!.error}`)
        break
      }

      if (!response!.ads || response!.ads.length === 0) break

      if (pageNum === 1 && response!.search_information?.total_results) {
        log(`${label}: ~${response!.search_information.total_results.toLocaleString()} anuncios disponibles`)
      }

      processAds(response!.ads)

      options.onProgress?.({
        adsScanned: totalAdsScanned,
        advertisersFound: advertisersMap.size,
        page: totalApiPages,
      })

      if (!response!.pagination?.next_page_token) break
      params.next_page_token = response!.pagination.next_page_token
    }

    return pageNum
  }

  // ── Pass 1: Global deep search (country=ALL) ─────────────────────────────
  log(`Búsqueda global profunda por "${options.keywords}"...`)
  const globalPages = await paginateSearch('Global', {
    engine: 'meta_ad_library',
    api_key: apiKey,
    ad_type: 'all',
    q: options.keywords,
    country: 'ALL',
    active_status: (options.activeStatus ?? 'all').toLowerCase(),
  }, maxPages)

  log(`Búsqueda global: ${globalPages} páginas → ${totalAdsScanned} anuncios, ${advertisersMap.size} anunciantes`)

  // ── Pass 2: Per-country searches for selected countries (10 pages each) ──
  // This catches region-specific ads that may not appear high in global results.
  // Only search up to 8 key countries to avoid burning too many API credits.
  const countryCodes = options.countries.length > 0 ? options.countries : []
  const keyCountries = countryCodes.slice(0, 8)

  if (keyCountries.length > 0) {
    const remainingPages = maxPages - totalApiPages
    const pagesPerCountry = Math.max(5, Math.floor(remainingPages / keyCountries.length))

    log(`Búsqueda por países: ${keyCountries.join(', ')} (${pagesPerCountry} páginas c/u)...`)

    for (const country of keyCountries) {
      if (totalApiPages >= maxPages) break

      const fetched = await paginateSearch(`País ${country}`, {
        engine: 'meta_ad_library',
        api_key: apiKey,
        ad_type: 'all',
        q: options.keywords,
        country,
        active_status: (options.activeStatus ?? 'all').toLowerCase(),
      }, pagesPerCountry)

      log(`País ${country}: ${fetched} páginas`)
    }
  }

  log(`✓ TOTAL: ${totalApiPages} llamadas API, ${totalAdsScanned.toLocaleString()} anuncios escaneados, ${advertisersMap.size} anunciantes únicos`)

  return [...advertisersMap.values()].sort((a, b) => b.ads.length - a.ads.length)
}

export async function fetchAdsViaSearchApi(
  apiKey: string,
  options: FetchAdsApiOptions
): Promise<MetaAdRaw[]> {
  const maxAds = options.maxAds ?? 500
  const allAds: MetaAdRaw[] = []
  const log = options.onLog ?? ((msg: string) => console.log(msg))

  // Step 1: Resolve page_id
  let pageId: string | undefined = options.pageIds?.[0]

  if (!pageId && options.searchTerms) {
    log(`Buscando página de Facebook para "${options.searchTerms}"...`)
    const found = await findPageId(apiKey, options.searchTerms, options.onLog)
    if (found) {
      pageId = found.pageId
    } else {
      // No page found — return empty instead of doing a keyword search
      // that would return unrelated ads
      return []
    }
  }

  if (!pageId) {
    throw new Error('No se pudo determinar el page_id del competidor')
  }

  // Step 2: Fetch ads by page_id (not keyword search)
  const params: Record<string, string> = {
    engine: 'meta_ad_library',
    api_key: apiKey,
    ad_type: 'all',
    active_status: (options.activeStatus ?? 'ALL').toLowerCase(),
    country: 'ALL',
    page_id: pageId,
  }

  log(`Buscando anuncios de página ${pageId}...`)

  let pageNum = 0
  const maxPages = 50

  while (pageNum < maxPages) {
    pageNum++
    let response: SearchApiResponse

    try {
      const { data } = await axios.get<SearchApiResponse>(SEARCHAPI_URL, { params })
      response = data
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const errMsg = err.response?.data?.error ?? err.message
        console.error(`[SearchAPI] HTTP ${status}: ${errMsg}`)

        if (status === 401) {
          throw new Error('SearchAPI key inválida')
        }
        if (status === 429) {
          console.warn(`[SearchAPI] Rate limited, returning ${allAds.length} ads so far`)
          break
        }
        throw new Error(`SearchAPI error (HTTP ${status}): ${errMsg}`)
      }
      throw err
    }

    if (response.error) {
      if (response.error.toLowerCase().includes('didn\'t return any results') ||
          response.error.toLowerCase().includes('no results')) {
        console.log(`[SearchAPI] No results for this page`)
        break
      }
      throw new Error(`SearchAPI: ${response.error}`)
    }

    if (pageNum === 1 && response.search_information?.total_results !== undefined) {
      log(`Total anuncios disponibles: ${response.search_information.total_results}`)
    }

    if (!response.ads || response.ads.length === 0) {
      log(`Paginación terminada: página ${pageNum} sin anuncios`)
      break
    }

    console.log(`[SearchAPI] Page ${pageNum}: ${response.ads.length} ads`)

    for (const ad of response.ads) {
      if (ad.ad_archive_id) {
        allAds.push(mapAd(ad))
        if (allAds.length >= maxAds) break
      }
    }

    options.onProgress?.(allAds.length)

    if (allAds.length >= maxAds) {
      log(`Límite de ${maxAds} anuncios alcanzado`)
      break
    }
    if (!response.pagination?.next_page_token) {
      log(`Paginación terminada: no hay más páginas (${allAds.length} anuncios obtenidos)`)
      break
    }

    params.next_page_token = response.pagination.next_page_token
  }

  if (pageNum >= maxPages) {
    log(`Límite de paginación alcanzado (${maxPages} páginas). ${allAds.length} anuncios obtenidos.`)
  }

  console.log(`[SearchAPI] Total: ${allAds.length} ads`)
  return allAds
}
