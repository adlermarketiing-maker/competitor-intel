import { createMetaClient } from './client'
import type { MetaAdRaw } from '@/types/scrape'

const AD_FIELDS = [
  'id',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_creative_link_captions',
  'ad_creative_link_url',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_snapshot_url',
  'page_id',
  'page_name',
  'ad_creative_images',
  'ad_creative_videos',
  'publisher_platforms',
].join(',')

interface FetchAdsOptions {
  searchTerms?: string
  pageIds?: string[]
  countries: string[]
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL'
  onProgress?: (count: number) => void
}

export async function fetchAdsForCompetitor(
  token: string,
  options: FetchAdsOptions
): Promise<MetaAdRaw[]> {
  const client = createMetaClient(token)
  const all: MetaAdRaw[] = []
  let after: string | undefined

  const params: Record<string, string> = {
    ad_type: 'ALL',
    ad_active_status: options.activeStatus ?? 'ALL',
    ad_reached_countries: JSON.stringify(options.countries),
    fields: AD_FIELDS,
    limit: '100',
  }

  if (options.pageIds && options.pageIds.length > 0) {
    params.search_page_ids = options.pageIds.join(',')
  } else if (options.searchTerms) {
    params.search_terms = options.searchTerms
  } else {
    throw new Error('Must provide either pageIds or searchTerms')
  }

  let page = 0
  const MAX_PAGES = 20 // Safety limit: 20 pages × 100 ads = 2000 ads max

  while (page < MAX_PAGES) {
    const reqParams = { ...params }
    if (after) reqParams.after = after

    let response
    try {
      response = await client.get('/ads_archive', { params: reqParams })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown; status?: number } }
      if (axiosErr?.response?.data) {
        const meta = axiosErr.response.data as { error?: { message?: string; code?: number; type?: string } }
        const e = meta?.error
        throw new Error(`Meta API error ${axiosErr.response.status}: ${e?.message ?? JSON.stringify(meta)} (code ${e?.code}, type ${e?.type})`)
      }
      throw err
    }
    const data = response.data

    if (!data.data || data.data.length === 0) break

    all.push(...data.data)
    options.onProgress?.(all.length)

    if (!data.paging?.cursors?.after || data.data.length < 100) break
    after = data.paging.cursors.after
    page++

    // Rate limit: wait 500ms between pages
    await new Promise((r) => setTimeout(r, 500))
  }

  return all
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
