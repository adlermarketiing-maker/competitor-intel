import axios from 'axios'
import { createMetaClient } from './client'
import type { MetaAdRaw } from '@/types/scrape'

interface FetchAdsApiOptions {
  searchTerms?: string
  pageIds?: string[]
  countries: string[]
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL'
  maxAds?: number
  onProgress?: (count: number) => void
}

const AD_FIELDS = [
  'id',
  'ad_archive_id',
  'page_id',
  'page_name',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_creative_link_captions',
  'ad_snapshot_url',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'publisher_platforms',
].join(',')

interface ApiRecord {
  id: string
  ad_archive_id?: string
  page_id?: string
  page_name?: string
  ad_creative_bodies?: string[]
  ad_creative_link_titles?: string[]
  ad_creative_link_descriptions?: string[]
  ad_creative_link_captions?: string[]
  ad_snapshot_url?: string
  ad_delivery_start_time?: string
  ad_delivery_stop_time?: string
  publisher_platforms?: string[]
}

interface ApiResponse {
  data: ApiRecord[]
  paging?: { next?: string }
}

function mapRecord(r: ApiRecord): MetaAdRaw {
  return {
    id: r.ad_archive_id ?? r.id,
    page_id: r.page_id,
    page_name: r.page_name,
    ad_creative_bodies: r.ad_creative_bodies,
    ad_creative_link_titles: r.ad_creative_link_titles,
    ad_creative_link_descriptions: r.ad_creative_link_descriptions,
    ad_creative_link_captions: r.ad_creative_link_captions,
    ad_snapshot_url: r.ad_snapshot_url,
    ad_delivery_start_time: r.ad_delivery_start_time,
    ad_delivery_stop_time: r.ad_delivery_stop_time,
    publisher_platforms: r.publisher_platforms,
  }
}

export async function fetchAdsViaApi(
  token: string,
  options: FetchAdsApiOptions
): Promise<MetaAdRaw[]> {
  const client = createMetaClient(token)
  const maxAds = options.maxAds ?? 500
  const allAds: MetaAdRaw[] = []

  const params: Record<string, string> = {
    ad_type: 'ALL',
    ad_active_status: options.activeStatus ?? 'ALL',
    ad_reached_countries: JSON.stringify(
      options.countries.length > 0 ? options.countries : ['ALL']
    ),
    fields: AD_FIELDS,
    limit: '25',
  }

  if (options.pageIds?.length) {
    params.search_page_ids = options.pageIds.join(',')
  } else if (options.searchTerms) {
    params.search_terms = options.searchTerms
  } else {
    throw new Error('Either pageIds or searchTerms must be provided')
  }

  console.log('[AdLibraryAPI] Request params:', JSON.stringify(params, null, 2))

  let nextUrl: string | null = null
  let page = 0

  while (true) {
    page++
    let response: ApiResponse

    try {
      if (nextUrl) {
        const { data } = await axios.get<ApiResponse>(nextUrl)
        response = data
      } else {
        const { data } = await client.get<ApiResponse>('/ads_archive', { params })
        response = data
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const errorData = err.response?.data?.error
        const fullError = JSON.stringify(err.response?.data ?? {}).substring(0, 500)
        console.error(`[AdLibraryAPI] HTTP ${status} error: ${fullError}`)

        if (errorData?.code === 190 || errorData?.error_subcode === 463) {
          throw new Error(`Token expirado o inválido: ${errorData?.message ?? err.message}`)
        }

        if (status === 429 || errorData?.code === 32 || errorData?.code === 4) {
          console.warn(`[AdLibraryAPI] Rate limited, returning ${allAds.length} ads so far`)
          break
        }

        throw new Error(`Meta API HTTP ${status}: ${errorData?.message ?? fullError}`)
      }
      throw err
    }

    // Log raw response structure on first page for debugging
    if (page === 1) {
      console.log(`[AdLibraryAPI] Response keys: ${Object.keys(response)}`)
      console.log(`[AdLibraryAPI] data array length: ${response.data?.length ?? 'undefined'}`)
      if (response.data?.[0]) {
        console.log(`[AdLibraryAPI] First record keys: ${Object.keys(response.data[0])}`)
      }
    }

    if (!response.data || response.data.length === 0) {
      console.log(`[AdLibraryAPI] Page ${page}: no more results`)
      break
    }

    console.log(`[AdLibraryAPI] Page ${page}: ${response.data.length} ads`)

    for (const record of response.data) {
      allAds.push(mapRecord(record))
      if (allAds.length >= maxAds) break
    }

    options.onProgress?.(allAds.length)

    if (allAds.length >= maxAds || !response.paging?.next) {
      break
    }

    nextUrl = response.paging.next
  }

  console.log(`[AdLibraryAPI] Total: ${allAds.length} ads`)
  return allAds
}
