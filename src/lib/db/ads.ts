import { db } from './client'
import type { MetaAdRaw } from '@/types/scrape'

/** Calculate ad status based on days active AND whether ad is still running */
function computeAdStatus(daysActive: number, isActive: boolean): string {
  // If Meta says the ad is stopped → eliminado
  if (!isActive) return 'eliminado'
  // Still running → classify by duration
  if (daysActive < 3) return 'nuevo'
  if (daysActive <= 14) return 'activo'
  return 'winner'
}

/** Calculate days between two dates */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

/** Calculate daysActive using Meta's own dates (startDate/stopDate) */
function computeDaysActive(startDate: Date | null, stopDate: Date | null): number {
  if (!startDate) return 0
  const end = stopDate ?? new Date()
  return daysBetween(startDate, end)
}

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

  const now = new Date()
  const startDate = raw.ad_delivery_start_time ? new Date(raw.ad_delivery_start_time) : null
  const stopDate = raw.ad_delivery_stop_time ? new Date(raw.ad_delivery_stop_time) : null
  const isActive = !raw.ad_delivery_stop_time
  const daysActive = computeDaysActive(startDate, stopDate)
  const adStatus = computeAdStatus(daysActive, isActive)

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
    isActive,
    startDate,
    stopDate,
    lastSeenAt: now,
    daysActive,
    adStatus,
  }

  return db.ad.upsert({
    where: { metaAdId: raw.id },
    create: { metaAdId: raw.id, ...data },
    update: data,
  })
}

/**
 * Mark ads that were NOT in the latest scrape as "eliminado".
 * Returns info about retired winners for detection alerts.
 */
export async function markEliminatedAds(competitorId: string, scrapedMetaAdIds: string[]) {
  const now = new Date()

  // Find all ads for this competitor that were NOT in the current scrape
  // and are not already marked as eliminated
  const missingAds = await db.ad.findMany({
    where: {
      competitorId,
      adStatus: { not: 'eliminado' },
      ...(scrapedMetaAdIds.length > 0
        ? { metaAdId: { notIn: scrapedMetaAdIds } }
        : {}),
    },
    select: { id: true, metaAdId: true, startDate: true, stopDate: true, adStatus: true, daysActive: true },
  })

  const retiredWinners: Array<{ metaAdId: string; daysActive: number }> = []

  for (const ad of missingAds) {
    const daysActive = computeDaysActive(ad.startDate, ad.stopDate ?? now)
    if (ad.adStatus === 'winner') {
      retiredWinners.push({ metaAdId: ad.metaAdId, daysActive })
    }
    await db.ad.update({
      where: { id: ad.id },
      data: { adStatus: 'eliminado', daysActive },
    })
  }

  return { eliminatedCount: missingAds.length, retiredWinners }
}

/**
 * Detect if there's been a launch (5+ new ads in the latest scrape).
 */
export async function detectLaunch(competitorId: string): Promise<{ isLaunch: boolean; newAdsCount: number }> {
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const newAdsCount = await db.ad.count({
    where: {
      competitorId,
      adStatus: { not: 'eliminado' },
      firstSeenAt: { gte: threeDaysAgo },
    },
  })

  return { isLaunch: newAdsCount >= 5, newAdsCount }
}

export async function listAds(options: {
  competitorId?: string
  isActive?: boolean
  adStatus?: string
  minDays?: number
  maxDays?: number
  sortBy?: string
  platform?: string
  page?: number
  limit?: number
}) {
  const { competitorId, isActive, adStatus, minDays, maxDays, sortBy, platform, page = 1, limit = 24 } = options

  const where: Record<string, unknown> = {}
  if (competitorId) where.competitorId = competitorId
  if (isActive !== undefined) where.isActive = isActive
  if (adStatus) where.adStatus = adStatus
  if (platform) where.platforms = { has: platform }
  if (minDays !== undefined || maxDays !== undefined) {
    where.daysActive = {}
    if (minDays !== undefined) (where.daysActive as Record<string, number>).gte = minDays
    if (maxDays !== undefined) (where.daysActive as Record<string, number>).lte = maxDays
  }

  // Determine sort order
  let orderBy: Record<string, string>[]
  switch (sortBy) {
    case 'daysActive':
      orderBy = [{ daysActive: 'desc' }, { lastSeenAt: 'desc' }]
      break
    case 'newest':
      orderBy = [{ firstSeenAt: 'desc' }]
      break
    case 'oldest':
      orderBy = [{ firstSeenAt: 'asc' }]
      break
    default:
      orderBy = [{ lastSeenAt: 'desc' }]
      break
  }

  const [ads, total] = await Promise.all([
    db.ad.findMany({
      where,
      orderBy,
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

/**
 * Get top winners across all competitors or for a specific one.
 */
export async function getWinnersRanking(options?: { competitorId?: string; limit?: number }) {
  const { competitorId, limit = 50 } = options || {}

  const where: Record<string, unknown> = { adStatus: 'winner' }
  if (competitorId) where.competitorId = competitorId

  return db.ad.findMany({
    where,
    orderBy: { daysActive: 'desc' },
    take: limit,
    include: {
      competitor: { select: { id: true, name: true } },
    },
  })
}

/**
 * Get winner stats grouped by competitor.
 */
export async function getWinnersByCompetitor() {
  const winners = await db.ad.findMany({
    where: { adStatus: 'winner' },
    select: {
      id: true,
      daysActive: true,
      competitorId: true,
      competitor: { select: { id: true, name: true } },
    },
    orderBy: { daysActive: 'desc' },
  })

  // Group by competitor
  const grouped = new Map<string, { competitor: { id: string; name: string }; count: number; maxDays: number; ads: typeof winners }>()
  for (const w of winners) {
    const existing = grouped.get(w.competitorId)
    if (existing) {
      existing.count++
      existing.maxDays = Math.max(existing.maxDays, w.daysActive)
      existing.ads.push(w)
    } else {
      grouped.set(w.competitorId, {
        competitor: w.competitor,
        count: 1,
        maxDays: w.daysActive,
        ads: [w],
      })
    }
  }

  return [...grouped.values()].sort((a, b) => b.maxDays - a.maxDays)
}

/**
 * Recalculate daysActive and adStatus for ALL ads based on Meta's startDate/stopDate.
 * Used to fix existing ads after the logic change.
 */
export async function recalculateAllAdStatuses() {
  const ads = await db.ad.findMany({
    select: { id: true, startDate: true, stopDate: true, isActive: true },
  })

  let updated = 0
  for (const ad of ads) {
    const daysActive = computeDaysActive(ad.startDate, ad.stopDate)
    const adStatus = computeAdStatus(daysActive, ad.isActive)
    await db.ad.update({
      where: { id: ad.id },
      data: { daysActive, adStatus },
    })
    updated++
  }
  return { updated }
}

/**
 * Get ad status counts for a competitor (for UI badges).
 */
export async function getAdStatusCounts(competitorId: string) {
  const [nuevo, activo, winner, eliminado, total] = await Promise.all([
    db.ad.count({ where: { competitorId, adStatus: 'nuevo' } }),
    db.ad.count({ where: { competitorId, adStatus: 'activo' } }),
    db.ad.count({ where: { competitorId, adStatus: 'winner' } }),
    db.ad.count({ where: { competitorId, adStatus: 'eliminado' } }),
    db.ad.count({ where: { competitorId } }),
  ])
  return { nuevo, activo, winner, eliminado, total }
}
