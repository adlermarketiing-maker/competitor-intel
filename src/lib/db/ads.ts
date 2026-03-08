import { db } from './client'
import type { MetaAdRaw } from '@/types/scrape'

/** Calculate days between two dates */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

/** Calculate daysActive using Meta's own dates (startDate → stopDate, or now if still running) */
function computeDaysActive(startDate: Date | null, stopDate: Date | null): number {
  if (!startDate) return 0
  const end = stopDate ?? new Date()
  return daysBetween(startDate, end)
}

/**
 * Winner status — based ONLY on how many days the ad was active.
 * Doesn't matter if it's currently running or stopped.
 *   < 5 days  → "normal"
 *   5-10 days → "posible_winner"
 *   > 10 days → "winner"
 */
function computeAdStatus(daysActive: number): string {
  if (daysActive > 10) return 'winner'
  if (daysActive >= 5) return 'posible_winner'
  return 'normal'
}

export async function upsertAd(competitorId: string, raw: MetaAdRaw) {
  const imageUrls = (raw.ad_creative_images || [])
    .map((img) => img.resized_image_url || img.original_image_url)
    .filter(Boolean) as string[]

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
  const adStatus = computeAdStatus(daysActive)

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
 * Mark ads not found in latest scrape — just update lastSeenAt tracking.
 * Winner status stays based on daysActive.
 */
export async function markEliminatedAds(competitorId: string, scrapedMetaAdIds: string[]) {
  // Nothing to do if no ads were scraped (avoid marking everything)
  if (scrapedMetaAdIds.length === 0) return { eliminatedCount: 0, retiredWinners: [] }

  const now = new Date()
  const missingAds = await db.ad.findMany({
    where: {
      competitorId,
      metaAdId: { notIn: scrapedMetaAdIds },
    },
    select: { id: true, metaAdId: true, startDate: true, stopDate: true, adStatus: true, daysActive: true },
  })

  const retiredWinners: Array<{ metaAdId: string; daysActive: number }> = []

  for (const ad of missingAds) {
    const daysActive = computeDaysActive(ad.startDate, ad.stopDate ?? now)
    if (ad.adStatus === 'winner') {
      retiredWinners.push({ metaAdId: ad.metaAdId, daysActive })
    }
    // Mark as inactive and update daysActive, but keep winner status
    await db.ad.update({
      where: { id: ad.id },
      data: { isActive: false, daysActive, adStatus: computeAdStatus(daysActive) },
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
  hookType?: string
  marketingAngle?: string
  creativeFormat?: string
  awarenessLevel?: string
  copyLength?: string
  minScore?: number
  page?: number
  limit?: number
}) {
  const { competitorId, isActive, adStatus, minDays, maxDays, sortBy, platform, hookType, marketingAngle, creativeFormat, awarenessLevel, copyLength, minScore, page = 1, limit = 24 } = options

  const where: Record<string, unknown> = {}
  if (competitorId) where.competitorId = competitorId
  if (isActive !== undefined) where.isActive = isActive
  if (adStatus) where.adStatus = adStatus
  if (platform) where.platforms = { has: platform }
  if (hookType) where.hookType = hookType
  if (marketingAngle) where.marketingAngle = marketingAngle
  if (creativeFormat) where.creativeFormat = creativeFormat
  if (awarenessLevel) where.awarenessLevel = awarenessLevel
  if (copyLength) where.copyLength = copyLength
  if (minScore !== undefined) where.aiScore = { gte: minScore }
  if (minDays !== undefined || maxDays !== undefined) {
    where.daysActive = {}
    if (minDays !== undefined) (where.daysActive as Record<string, number>).gte = minDays
    if (maxDays !== undefined) (where.daysActive as Record<string, number>).lte = maxDays
  }

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
    orderBy: [{ daysActive: 'desc' }, { lastSeenAt: 'desc' }],
  })
}

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
 * Recalculate daysActive and adStatus for ALL existing ads.
 */
export async function recalculateAllAdStatuses() {
  const ads = await db.ad.findMany({
    select: { id: true, startDate: true, stopDate: true },
  })

  let updated = 0
  for (const ad of ads) {
    const daysActive = computeDaysActive(ad.startDate, ad.stopDate)
    const adStatus = computeAdStatus(daysActive)
    await db.ad.update({
      where: { id: ad.id },
      data: { daysActive, adStatus },
    })
    updated++
  }
  return { updated }
}

export async function getAdStatusCounts(competitorId: string) {
  const [normal, posible_winner, winner, active, inactive, total] = await Promise.all([
    db.ad.count({ where: { competitorId, adStatus: 'normal' } }),
    db.ad.count({ where: { competitorId, adStatus: 'posible_winner' } }),
    db.ad.count({ where: { competitorId, adStatus: 'winner' } }),
    db.ad.count({ where: { competitorId, isActive: true } }),
    db.ad.count({ where: { competitorId, isActive: false } }),
    db.ad.count({ where: { competitorId } }),
  ])
  return { normal, posible_winner, winner, active, inactive, total }
}
