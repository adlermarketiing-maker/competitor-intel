import { db } from './client'
import type { MetaAdRaw } from '@/types/scrape'

export async function upsertAd(competitorId: string, raw: MetaAdRaw) {
  const imageUrls = (raw.ad_creative_images || [])
    .map((img) => img.resized_image_url || img.original_image_url)
    .filter(Boolean) as string[]

  // Add video preview thumbnails as images (so video ads have a visible thumbnail)
  for (const v of raw.ad_creative_videos || []) {
    if (v.video_preview_image_url) imageUrls.push(v.video_preview_image_url)
  }

  const videoUrls = (raw.ad_creative_videos || [])
    .map((v) => v.video_hd_url || v.video_sd_url)
    .filter(Boolean) as string[]

  const data = {
    competitorId,
    adCopyBodies: raw.ad_creative_bodies || [],
    headline: raw.ad_creative_link_titles?.[0] ?? null,
    description: raw.ad_creative_link_descriptions?.[0] ?? null,
    caption: raw.ad_creative_link_captions?.[0] ?? null,
    landingUrl: raw.ad_creative_link_url ?? null,
    adSnapshotUrl: raw.ad_snapshot_url ?? null,
    imageUrls,
    videoUrls,
    platforms: raw.publisher_platforms || [],
    pageId: raw.page_id ?? null,
    pageName: raw.page_name ?? null,
    isActive: !raw.ad_delivery_stop_time,
    startDate: raw.ad_delivery_start_time ? new Date(raw.ad_delivery_start_time) : null,
    stopDate: raw.ad_delivery_stop_time ? new Date(raw.ad_delivery_stop_time) : null,
    lastSeenAt: new Date(),
  }

  return db.ad.upsert({
    where: { metaAdId: raw.id },
    create: { metaAdId: raw.id, ...data },
    update: data,
  })
}

export async function listAds(options: {
  competitorId?: string
  isActive?: boolean
  platform?: string
  page?: number
  limit?: number
}) {
  const { competitorId, isActive, platform, page = 1, limit = 24 } = options

  const where: Record<string, unknown> = {}
  if (competitorId) where.competitorId = competitorId
  if (isActive !== undefined) where.isActive = isActive
  if (platform) where.platforms = { has: platform }

  const [ads, total] = await Promise.all([
    db.ad.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        competitor: { select: { id: true, name: true } },
      },
    }),
    db.ad.count({ where }),
  ])

  return { ads, total, pages: Math.ceil(total / limit) }
}

export async function getAdsForCompetitor(competitorId: string) {
  return db.ad.findMany({
    where: { competitorId },
    orderBy: [{ isActive: 'desc' }, { lastSeenAt: 'desc' }],
  })
}
