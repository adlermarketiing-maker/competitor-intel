import { db } from './client'

interface DistributionItem {
  value: string
  count: number
  winnerCount: number
  pct: number
}

interface OfferSummary {
  withDiscount: number
  withBonuses: number
  withGuarantee: number
  withScarcity: number
  withPrice: number
  total: number
}

interface CompetitorComparison {
  id: string
  name: string
  totalAds: number
  winners: number
  avgScore: number | null
  topHook: string | null
  topAngle: string | null
  topFormat: string | null
}

interface WeeklyTrend {
  weekStart: string
  totalAds: number
  winners: number
  hookTypes: Record<string, number>
  formats: Record<string, number>
  angles: Record<string, number>
  avgScore: number | null
}

export interface AnalyticsData {
  summary: {
    totalAds: number
    analyzedAds: number
    winners: number
    avgScore: number | null
    avgDaysActive: number | null
  }
  distributions: {
    hookType: DistributionItem[]
    marketingAngle: DistributionItem[]
    creativeFormat: DistributionItem[]
    awarenessLevel: DistributionItem[]
    copyLength: DistributionItem[]
  }
  topCtas: Array<{ value: string; count: number; winnerCount: number }>
  offers: OfferSummary
  competitorComparison: CompetitorComparison[]
  weeklyTrends: WeeklyTrend[]
}

/** Build a distribution for a given tag field */
async function getDistribution(
  field: string,
  where: Record<string, unknown>,
): Promise<DistributionItem[]> {
  const allAds = await db.ad.findMany({
    where: { ...where, aiAnalyzed: true, [field]: { not: null } },
    select: { hookType: true, marketingAngle: true, creativeFormat: true, awarenessLevel: true, copyLength: true, adStatus: true },
  })

  const counts = new Map<string, { count: number; winnerCount: number }>()
  for (const ad of allAds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (ad as any)[field] as string
    if (!val) continue
    const existing = counts.get(val) || { count: 0, winnerCount: 0 }
    existing.count++
    if (ad.adStatus === 'winner') existing.winnerCount++
    counts.set(val, existing)
  }

  const total = allAds.length
  return [...counts.entries()]
    .map(([value, { count, winnerCount }]) => ({
      value,
      count,
      winnerCount,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/** Get top CTAs */
async function getTopCtas(where: Record<string, unknown>) {
  const ads = await db.ad.findMany({
    where: { ...where, aiAnalyzed: true, ctaText: { not: null } },
    select: { ctaText: true, adStatus: true },
  })

  const counts = new Map<string, { count: number; winnerCount: number }>()
  for (const ad of ads) {
    const val = (ad.ctaText || '').trim().toLowerCase()
    if (!val) continue
    const existing = counts.get(val) || { count: 0, winnerCount: 0 }
    existing.count++
    if (ad.adStatus === 'winner') existing.winnerCount++
    counts.set(val, existing)
  }

  return [...counts.entries()]
    .map(([value, { count, winnerCount }]) => ({ value, count, winnerCount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

/** Offer breakdown */
async function getOfferSummary(where: Record<string, unknown>): Promise<OfferSummary> {
  const base = { ...where, aiAnalyzed: true }
  const [withDiscount, withBonuses, withGuarantee, withScarcity, withPrice, total] = await Promise.all([
    db.ad.count({ where: { ...base, offerDiscount: true } }),
    db.ad.count({ where: { ...base, offerBonuses: { not: null } } }),
    db.ad.count({ where: { ...base, offerGuarantee: { not: null } } }),
    db.ad.count({ where: { ...base, offerScarcity: { not: null } } }),
    db.ad.count({ where: { ...base, offerPrice: { not: null } } }),
    db.ad.count({ where: base }),
  ])
  return { withDiscount, withBonuses, withGuarantee, withScarcity, withPrice, total }
}

/** Competitor comparison */
async function getCompetitorComparison(where: Record<string, unknown>, clientId?: string): Promise<CompetitorComparison[]> {
  const compWhere = clientId ? { clientId } : {}
  const competitors = await db.competitor.findMany({
    where: compWhere,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const results: CompetitorComparison[] = []

  for (const comp of competitors) {
    const compWhere = { ...where, competitorId: comp.id }
    const totalAds = await db.ad.count({ where: compWhere })
    if (totalAds === 0) continue

    const winners = await db.ad.count({ where: { ...compWhere, adStatus: 'winner' } })

    const scoreAgg = await db.ad.aggregate({
      where: { ...compWhere, aiAnalyzed: true, aiScore: { not: null } },
      _avg: { aiScore: true },
    })

    // Get top values for this competitor
    const analyzedAds = await db.ad.findMany({
      where: { ...compWhere, aiAnalyzed: true },
      select: { hookType: true, marketingAngle: true, creativeFormat: true },
    })

    const hookCounts = new Map<string, number>()
    const angleCounts = new Map<string, number>()
    const formatCounts = new Map<string, number>()

    for (const ad of analyzedAds) {
      if (ad.hookType) hookCounts.set(ad.hookType, (hookCounts.get(ad.hookType) || 0) + 1)
      if (ad.marketingAngle) angleCounts.set(ad.marketingAngle, (angleCounts.get(ad.marketingAngle) || 0) + 1)
      if (ad.creativeFormat) formatCounts.set(ad.creativeFormat, (formatCounts.get(ad.creativeFormat) || 0) + 1)
    }

    const topOf = (m: Map<string, number>) => {
      let max = 0, top: string | null = null
      for (const [k, v] of m) { if (v > max) { max = v; top = k } }
      return top
    }

    results.push({
      id: comp.id,
      name: comp.name,
      totalAds,
      winners,
      avgScore: scoreAgg._avg.aiScore ? Math.round(scoreAgg._avg.aiScore * 10) / 10 : null,
      topHook: topOf(hookCounts),
      topAngle: topOf(angleCounts),
      topFormat: topOf(formatCounts),
    })
  }

  return results.sort((a, b) => b.winners - a.winners)
}

/** Weekly trends for the last N weeks */
async function getWeeklyTrends(where: Record<string, unknown>, weeks = 8): Promise<WeeklyTrend[]> {
  const now = new Date()
  const trends: WeeklyTrend[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1) // Monday
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const weekWhere = {
      ...where,
      firstSeenAt: { gte: weekStart, lt: weekEnd },
    }

    const ads = await db.ad.findMany({
      where: weekWhere,
      select: {
        adStatus: true,
        hookType: true,
        creativeFormat: true,
        marketingAngle: true,
        aiScore: true,
        aiAnalyzed: true,
      },
    })

    const hookTypes: Record<string, number> = {}
    const formats: Record<string, number> = {}
    const angles: Record<string, number> = {}
    let scoreSum = 0, scoreCount = 0, winnerCount = 0

    for (const ad of ads) {
      if (ad.adStatus === 'winner') winnerCount++
      if (ad.aiAnalyzed) {
        if (ad.hookType) hookTypes[ad.hookType] = (hookTypes[ad.hookType] || 0) + 1
        if (ad.creativeFormat) formats[ad.creativeFormat] = (formats[ad.creativeFormat] || 0) + 1
        if (ad.marketingAngle) angles[ad.marketingAngle] = (angles[ad.marketingAngle] || 0) + 1
        if (ad.aiScore != null) { scoreSum += ad.aiScore; scoreCount++ }
      }
    }

    trends.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      totalAds: ads.length,
      winners: winnerCount,
      hookTypes,
      formats,
      angles,
      avgScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
    })
  }

  return trends
}

export async function getAnalytics(competitorId?: string, clientId?: string): Promise<AnalyticsData> {
  const where: Record<string, unknown> = {}
  if (competitorId) where.competitorId = competitorId
  if (clientId && !competitorId) where.competitor = { clientId }

  const [
    totalAds,
    analyzedAds,
    winners,
    scoreAgg,
    daysAgg,
    hookType,
    marketingAngle,
    creativeFormat,
    awarenessLevel,
    copyLength,
    topCtas,
    offers,
    competitorComparison,
    weeklyTrends,
  ] = await Promise.all([
    db.ad.count({ where }),
    db.ad.count({ where: { ...where, aiAnalyzed: true } }),
    db.ad.count({ where: { ...where, adStatus: 'winner' } }),
    db.ad.aggregate({ where: { ...where, aiAnalyzed: true, aiScore: { not: null } }, _avg: { aiScore: true } }),
    db.ad.aggregate({ where, _avg: { daysActive: true } }),
    getDistribution('hookType', where),
    getDistribution('marketingAngle', where),
    getDistribution('creativeFormat', where),
    getDistribution('awarenessLevel', where),
    getDistribution('copyLength', where),
    getTopCtas(where),
    getOfferSummary(where),
    getCompetitorComparison(where, clientId),
    getWeeklyTrends(where),
  ])

  return {
    summary: {
      totalAds,
      analyzedAds,
      winners,
      avgScore: scoreAgg._avg.aiScore ? Math.round(scoreAgg._avg.aiScore * 10) / 10 : null,
      avgDaysActive: daysAgg._avg.daysActive ? Math.round(daysAgg._avg.daysActive * 10) / 10 : null,
    },
    distributions: {
      hookType,
      marketingAngle,
      creativeFormat,
      awarenessLevel,
      copyLength,
    },
    topCtas,
    offers,
    competitorComparison,
    weeklyTrends,
  }
}
