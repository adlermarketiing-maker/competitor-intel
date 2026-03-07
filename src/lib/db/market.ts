import { db } from './client'
import type { MarketAnalysisResult } from '@/lib/analysis/market'

export async function saveMarketAnalysis(
  data: MarketAnalysisResult & {
    competitorId?: string
    searchKeywords?: string
    totalReviews: number
    platforms: string[]
  }
) {
  return db.marketAnalysis.create({
    data: {
      competitorId: data.competitorId ?? null,
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

export async function getLatestMarketAnalyses(limit = 20) {
  return db.marketAnalysis.findMany({
    orderBy: { analyzedAt: 'desc' },
    take: limit,
    include: {
      competitor: { select: { id: true, name: true } },
    },
  })
}
