export type ResearchRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED'

export interface ResearchMarketConfig {
  id: string
  name: string      // "Brazilian", "US", "Hispanic", "Russian", "French"
  language: string   // "pt", "en", "es", "ru", "fr"
  countries: string[]
  keywords: string[]
  isActive: boolean
}

export interface ResearchRunSummary {
  id: string
  weekLabel: string
  status: ResearchRunStatus
  totalAdsFound: number
  totalAdsKept: number
  totalAdsAnalyzed: number
  apiCallsUsed: number
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface ResearchAdItem {
  id: string
  runId: string
  market: string
  searchKeyword: string
  metaAdId: string
  pageName: string | null
  pageId: string | null
  adCopyBodies: string[]
  headline: string | null
  description: string | null
  caption: string | null
  landingUrl: string | null
  adSnapshotUrl: string | null
  imageUrls: string[]
  videoUrls: string[]
  platforms: string[]
  isActive: boolean
  daysActive: number
  startDate: Date | null
  stopDate: Date | null
  adCategory: string | null
  niche: string | null
  language: string | null
  isRelevant: boolean
  relevanceScore: number | null
  aiAnalyzed: boolean
  hookType: string | null
  marketingAngle: string | null
  creativeFormat: string | null
  awarenessLevel: string | null
  copyLength: string | null
  copyStructure: string | null
  ctaText: string | null
  ctaUrgency: boolean | null
  aiScore: number | null
  aiSummary: string | null
  innovationScore: number | null
  createdAt: Date
}

export interface ClassificationResult {
  metaAdId: string
  adCategory: string
  niche: string
  language: string
  relevanceScore: number
}

export interface ResearchJobData {
  type: 'weekly-research'
}
