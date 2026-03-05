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

export async function fetchAdsViaSearchApi(
  apiKey: string,
  options: FetchAdsApiOptions
): Promise<MetaAdRaw[]> {
  const maxAds = options.maxAds ?? 500
  const allAds: MetaAdRaw[] = []

  const params: Record<string, string> = {
    engine: 'meta_ad_library',
    api_key: apiKey,
    ad_type: 'all',
    active_status: (options.activeStatus ?? 'ALL').toLowerCase(),
    country: options.countries[0] ?? 'ALL',
  }

  if (options.pageIds?.length) {
    params.page_id = options.pageIds[0]
  } else if (options.searchTerms) {
    params.q = options.searchTerms
  } else {
    throw new Error('Either pageIds or searchTerms must be provided')
  }

  console.log('[SearchAPI] Fetching ads:', { ...params, api_key: '***' })

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
      throw new Error(`SearchAPI: ${response.error}`)
    }

    if (pageNum === 1 && response.search_information?.total_results !== undefined) {
      console.log(`[SearchAPI] Total results available: ${response.search_information.total_results}`)
    }

    if (!response.ads || response.ads.length === 0) {
      console.log(`[SearchAPI] Page ${pageNum}: no more results`)
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
