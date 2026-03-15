import { db } from './client'
import type { MetaAdRaw } from '@/types/scrape'

/** Calculate days between two dates */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

// ── Runs ────────────────────────────────────────────────────

export async function createResearchRun(weekLabel: string) {
  return db.researchRun.create({
    data: { weekLabel, status: 'PENDING' },
  })
}

export async function updateResearchRun(
  id: string,
  data: {
    status?: string
    totalAdsFound?: number
    totalAdsKept?: number
    totalAdsAnalyzed?: number
    apiCallsUsed?: number
    errorMessage?: string | null
    startedAt?: Date
    completedAt?: Date
  }
) {
  return db.researchRun.update({ where: { id }, data })
}

export async function getResearchRun(id: string) {
  return db.researchRun.findUnique({
    where: { id },
    include: { reports: true },
  })
}

export async function listResearchRuns(limit = 20) {
  return db.researchRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      _count: { select: { ads: true, reports: true } },
    },
  })
}

export async function getLatestCompleteRun() {
  return db.researchRun.findFirst({
    where: { status: 'COMPLETE' },
    orderBy: { createdAt: 'desc' },
    include: { reports: true },
  })
}

// ── Ads ─────────────────────────────────────────────────────

export async function upsertResearchAd(
  runId: string,
  market: string,
  searchKeyword: string,
  raw: MetaAdRaw
) {
  const imageUrls = (raw.ad_creative_images || [])
    .map((img) => img.resized_image_url || img.original_image_url)
    .filter(Boolean) as string[]

  for (const v of raw.ad_creative_videos || []) {
    if (v.video_preview_image_url) imageUrls.push(v.video_preview_image_url)
  }

  const videoUrls = (raw.ad_creative_videos || [])
    .map((v) => v.video_hd_url || v.video_sd_url)
    .filter(Boolean) as string[]

  let startDate: Date | null = null
  if (raw.ad_delivery_start_time) {
    const d = new Date(raw.ad_delivery_start_time)
    if (!isNaN(d.getTime())) startDate = d
  }
  let stopDate: Date | null = null
  if (raw.ad_delivery_stop_time) {
    const d = new Date(raw.ad_delivery_stop_time)
    if (!isNaN(d.getTime())) stopDate = d
  }
  const isActive = !raw.ad_delivery_stop_time
  const daysActive = startDate ? daysBetween(startDate, stopDate ?? new Date()) : 0

  const data = {
    market,
    searchKeyword,
    metaAdId: raw.id,
    pageName: raw.page_name ?? null,
    pageId: raw.page_id ?? null,
    adCopyBodies: raw.ad_creative_bodies || [],
    headline: raw.ad_creative_link_titles?.[0] ?? null,
    description: raw.ad_creative_link_descriptions?.[0] ?? null,
    caption: raw.ad_creative_link_captions?.[0] ?? null,
    landingUrl: raw.ad_creative_link_url ?? null,
    adSnapshotUrl: raw.ad_snapshot_url ?? null,
    imageUrls,
    videoUrls,
    platforms: raw.publisher_platforms || [],
    isActive,
    daysActive,
    startDate,
    stopDate,
  }

  return db.researchAd.upsert({
    where: { runId_metaAdId: { runId, metaAdId: raw.id } },
    create: { runId, ...data },
    update: data,
  })
}

export async function updateResearchAdClassification(
  id: string,
  data: {
    adCategory?: string
    niche?: string
    language?: string
    isRelevant?: boolean
    relevanceScore?: number
  }
) {
  return db.researchAd.update({ where: { id }, data })
}

export async function updateResearchAdAnalysis(
  id: string,
  data: {
    aiAnalyzed?: boolean
    hookType?: string
    marketingAngle?: string
    creativeFormat?: string
    awarenessLevel?: string
    copyLength?: string
    copyStructure?: string
    ctaText?: string
    ctaUrgency?: boolean
    aiScore?: number
    aiSummary?: string
    innovationScore?: number
  }
) {
  return db.researchAd.update({ where: { id }, data })
}

export async function getUnclassifiedAds(runId: string) {
  return db.researchAd.findMany({
    where: { runId, adCategory: null },
    orderBy: { daysActive: 'desc' },
  })
}

export async function getRelevantUnanalyzedAds(runId: string, market?: string, limit?: number) {
  const where: Record<string, unknown> = {
    runId,
    isRelevant: true,
    aiAnalyzed: false,
  }
  if (market) where.market = market
  return db.researchAd.findMany({
    where,
    orderBy: { daysActive: 'desc' },
    ...(limit ? { take: limit } : {}),
  })
}

export async function listResearchAds(options: {
  runId?: string
  market?: string
  isRelevant?: boolean
  niche?: string
  hookType?: string
  marketingAngle?: string
  creativeFormat?: string
  minScore?: number
  minInnovation?: number
  sortBy?: string
  page?: number
  limit?: number
}) {
  const {
    runId, market, isRelevant, niche, hookType, marketingAngle,
    creativeFormat, minScore, minInnovation, sortBy, page = 1, limit = 24,
  } = options

  const where: Record<string, unknown> = {}
  if (runId) where.runId = runId
  if (market) where.market = market
  if (isRelevant !== undefined) where.isRelevant = isRelevant
  if (niche) where.niche = niche
  if (hookType) where.hookType = hookType
  if (marketingAngle) where.marketingAngle = marketingAngle
  if (creativeFormat) where.creativeFormat = creativeFormat
  if (minScore !== undefined) where.aiScore = { gte: minScore }
  if (minInnovation !== undefined) where.innovationScore = { gte: minInnovation }

  let orderBy: Record<string, string>[]
  switch (sortBy) {
    case 'innovation':
      orderBy = [{ innovationScore: 'desc' }, { aiScore: 'desc' }]
      break
    case 'score':
      orderBy = [{ aiScore: 'desc' }]
      break
    case 'daysActive':
      orderBy = [{ daysActive: 'desc' }]
      break
    default:
      orderBy = [{ innovationScore: 'desc' }, { aiScore: 'desc' }]
  }

  const [ads, total] = await Promise.all([
    db.researchAd.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.researchAd.count({ where }),
  ])

  return { ads, total, pages: Math.ceil(total / limit) }
}

// ── Reports ─────────────────────────────────────────────────

export async function saveResearchReport(data: {
  runId: string
  market: string
  reportHtml: string
  topFormats?: Array<{ name: string; count: number; pct: number }>
  topAngles?: Array<{ name: string; count: number; pct: number }>
  topHooks?: Array<{ name: string; count: number; pct: number }>
  highlights?: Array<{ metaAdId: string; innovationScore: number; reason: string }>
}) {
  return db.researchReport.upsert({
    where: { runId_market: { runId: data.runId, market: data.market } },
    create: data,
    update: {
      reportHtml: data.reportHtml,
      topFormats: data.topFormats ?? undefined,
      topAngles: data.topAngles ?? undefined,
      topHooks: data.topHooks ?? undefined,
      highlights: data.highlights ?? undefined,
    },
  })
}

export async function getResearchReports(runId: string) {
  return db.researchReport.findMany({
    where: { runId },
    orderBy: { market: 'asc' },
  })
}

// ── Stats ───────────────────────────────────────────────────

export async function getResearchStats(runId: string) {
  const [byMarket, topNiches, topFormats, topHooks, topAngles, highlighted] = await Promise.all([
    db.researchAd.groupBy({
      by: ['market'],
      where: { runId, isRelevant: true, aiAnalyzed: true },
      _count: { _all: true },
      _avg: { aiScore: true, innovationScore: true },
    }),
    db.researchAd.groupBy({
      by: ['niche'],
      where: { runId, isRelevant: true, niche: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { niche: 'desc' } },
      take: 10,
    }),
    db.researchAd.groupBy({
      by: ['creativeFormat'],
      where: { runId, isRelevant: true, creativeFormat: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { creativeFormat: 'desc' } },
      take: 10,
    }),
    db.researchAd.groupBy({
      by: ['hookType'],
      where: { runId, isRelevant: true, hookType: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { hookType: 'desc' } },
      take: 10,
    }),
    db.researchAd.groupBy({
      by: ['marketingAngle'],
      where: { runId, isRelevant: true, marketingAngle: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { marketingAngle: 'desc' } },
      take: 10,
    }),
    db.researchAd.count({
      where: { runId, isRelevant: true, innovationScore: { gte: 8 } },
    }),
  ])

  return { byMarket, topNiches, topFormats, topHooks, topAngles, highlighted }
}
