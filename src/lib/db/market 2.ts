import { db } from './client'
import type { MarketAnalysisResult } from '@/lib/analysis/market'

export async function saveMarketAnalysis(
  data: MarketAnalysisResult & {
    competitorId?: string
    clientId?: string
    searchKeywords?: string
    totalReviews: number
    platforms: string[]
  }
) {
  return db.marketAnalysis.create({
    data: {
      competitorId: data.competitorId ?? null,
      clientId: data.clientId ?? null,
      searchKeywords: data.searchKeywords ?? null,
      objections: data.objections,
      benefits: data.benefits,
      fears: data.fears,
      desires: data.desires,
      phrases: data.phrases,
      awarenessLevel: data.awarenessLevel,
      summary: data.summary,
      totalReviews: data.totalReviews,
      platforms: data.platforms,
    },
  })
}

export async function getMarketAnalysisForCompetitor(competitorId: string) {
  return db.marketAnalysis.findFirst({
    where: { competitorId },
    orderBy: { analyzedAt: 'desc' },
  })
}

export async function getMarketAnalysisByKeywords(keywords: string) {
  return db.marketAnalysis.findFirst({
    where: { searchKeywords: keywords },
    orderBy: { analyzedAt: 'desc' },
  })
}

export async function getLatestMarketAnalyses(limit = 20, clientId?: string) {
  const where = clientId ? { clientId } : {}
  return db.marketAnalysis.findMany({
    where,
    orderBy: { analyzedAt: 'desc' },
    take: limit,
    include: {
      competitor: { select: { id: true, name: true } },
    },
  })
}

/**
 * Get unique analysis "groups" that should be re-analyzed periodically.
 * Returns one entry per distinct (competitorId, searchKeywords) pair,
 * picking the most recent analysis in each group.
 */
export async function getAnalysisGroupsForReanalysis(olderThanDays = 14) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  // Get all analyses older than cutoff, grouped by competitorId + searchKeywords
  const analyses = await db.marketAnalysis.findMany({
    where: { analyzedAt: { lte: cutoff } },
    orderBy: { analyzedAt: 'desc' },
    include: { competitor: { select: { id: true, name: true } } },
  })

  // Deduplicate: keep only the latest per group key
  const seen = new Set<string>()
  const groups: typeof analyses = []

  for (const a of analyses) {
    const key = `${a.competitorId ?? ''}|${a.searchKeywords ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      groups.push(a)
    }
  }

  return groups
}

export interface MarketChangeItem {
  text: string
  count: number
}

export interface MarketChanges {
  label: string // competitor name or keywords
  newObjections: MarketChangeItem[]
  removedObjections: MarketChangeItem[]
  newBenefits: MarketChangeItem[]
  newFears: MarketChangeItem[]
  newDesires: MarketChangeItem[]
  newPhrases: string[]
  removedPhrases: string[]
  awarenessShift: { level: string; oldPct: number; newPct: number }[]
}

/**
 * Compare two analyses and return significant changes.
 */
export function compareAnalyses(
  previous: { objections: unknown; benefits: unknown; fears: unknown; desires: unknown; phrases: string[]; awarenessLevel: unknown },
  current: MarketAnalysisResult,
  label: string
): MarketChanges {
  const prevItems = (field: unknown): MarketChangeItem[] => {
    if (!Array.isArray(field)) return []
    return field as MarketChangeItem[]
  }

  const findNew = (prev: MarketChangeItem[], curr: MarketChangeItem[]): MarketChangeItem[] => {
    const prevTexts = new Set(prev.map((i) => i.text.toLowerCase()))
    return curr.filter((i) => !prevTexts.has(i.text.toLowerCase()))
  }

  const findRemoved = (prev: MarketChangeItem[], curr: MarketChangeItem[]): MarketChangeItem[] => {
    const currTexts = new Set(curr.map((i) => i.text.toLowerCase()))
    return prev.filter((i) => !currTexts.has(i.text.toLowerCase()))
  }

  const prevObj = prevItems(previous.objections)
  const prevBen = prevItems(previous.benefits)
  const prevFear = prevItems(previous.fears)
  const prevDes = prevItems(previous.desires)

  const prevPhrases = previous.phrases || []
  const currPhrases = current.phrases || []

  const newPhrases = currPhrases.filter(
    (p) => !prevPhrases.some((pp) => pp.toLowerCase() === p.toLowerCase())
  )
  const removedPhrases = prevPhrases.filter(
    (p) => !currPhrases.some((cp) => cp.toLowerCase() === p.toLowerCase())
  )

  // Awareness level shifts > 10 points
  const awarenessShift: MarketChanges['awarenessShift'] = []
  const prevAwareness = (previous.awarenessLevel || {}) as Record<string, number>
  const currAwareness = (current.awarenessLevel || {}) as Record<string, number>
  for (const level of ['unaware', 'problemAware', 'solutionAware', 'productAware', 'mostAware']) {
    const oldPct = prevAwareness[level] ?? 0
    const newPct = currAwareness[level] ?? 0
    if (Math.abs(newPct - oldPct) >= 10) {
      awarenessShift.push({ level, oldPct, newPct })
    }
  }

  return {
    label,
    newObjections: findNew(prevObj, current.objections),
    removedObjections: findRemoved(prevObj, current.objections),
    newBenefits: findNew(prevBen, current.benefits),
    newFears: findNew(prevFear, current.fears),
    newDesires: findNew(prevDes, current.desires),
    newPhrases,
    removedPhrases,
    awarenessShift,
  }
}

/**
 * Check if changes are significant enough to notify.
 */
export function hasSignificantChanges(changes: MarketChanges): boolean {
  return (
    changes.newObjections.length >= 1 ||
    changes.newFears.length >= 1 ||
    changes.newDesires.length >= 2 ||
    changes.newBenefits.length >= 2 ||
    changes.newPhrases.length >= 3 ||
    changes.awarenessShift.length >= 1
  )
}
