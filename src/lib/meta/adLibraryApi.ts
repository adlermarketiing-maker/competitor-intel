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

  return {
    id: ad.ad_archive_id ?? '',
    page_id: ad.page_id,
    page_name: snap.page_name,
    ad_creative_bodies: bodies.length > 0 ? bodies : undefined,
    ad_creative_link_titles: snap.title ? [snap.title] : undefined,
    ad_creative_link_descriptions: snap.link_description ? [snap.link_description] : undefined,
    ad_creative_link_url: snap.link_url,
    ad_creative_images: snap.images,
    ad_creative_videos: snap.videos,
    ad_delivery_start_time: ad.start_date,
    ad_delivery_stop_time: ad.end_date,
    publisher_platforms: ad.publisher_platform,
    ad_snapshot_url: ad.ad_archive_id
      ? `https://www.facebook.com/ads/archive/render_ad/?id=${ad.ad_archive_id}`
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
    country: options.countries[0] ?? 'ALL',
    page_id: pageId,
  }

  log(`Buscando anuncios de página ${pageId}...`)

  let pageNum = 0

  while (true) {
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

    if (allAds.length >= maxAds || !response.pagination?.next_page_token) {
      break
    }

    params.next_page_token = response.pagination.next_page_token
  }

  console.log(`[SearchAPI] Total: ${allAds.length} ads`)
  return allAds
}
