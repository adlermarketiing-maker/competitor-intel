export interface Competitor {
  id: string
  name: string
  fbPageName: string | null
  fbPageId: string | null
  websiteUrl: string | null
  searchTerm: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  adLibraryUrl: string | null
  lastScrapedAt: Date | null
  createdAt: Date
  updatedAt: Date
  _count?: {
    ads: number
  }
}

export interface Ad {
  id: string
  competitorId: string
  metaAdId: string
  adCopyBodies: string[]
  headline: string | null
  description: string | null
  caption: string | null
  ctaType: string | null
  landingUrl: string | null
  adSnapshotUrl: string | null
  imageUrls: string[]
  videoUrls: string[]
  platforms: string[]
  pageId: string | null
  pageName: string | null
  isActive: boolean
  adStatus: string
  daysActive: number
  startDate: Date | null
  stopDate: Date | null
  firstSeenAt: Date
  lastSeenAt: Date
  createdAt: Date
  updatedAt: Date
  // AI analysis
  aiAnalyzed: boolean
  hookType: string | null
  marketingAngle: string | null
  creativeFormat: string | null
  awarenessLevel: string | null
  copyLength: string | null
  copyStructure: string | null
  ctaText: string | null
  ctaUrgency: boolean | null
  offerPrice: string | null
  offerDiscount: boolean | null
  offerBonuses: string | null
  offerGuarantee: string | null
  offerScarcity: string | null
  aiScore: number | null
  aiSummary: string | null
}

export interface LandingPage {
  id: string
  adId: string | null
  url: string
  originalUrl: string
  title: string | null
  h1Texts: string[]
  h2Texts: string[]
  ctaTexts: string[]
  prices: string[]
  offerName: string | null
  bodyText: string | null
  screenshotPath: string | null
  outboundLinks: string[]
  httpStatus: number | null
  scrapedAt: Date
  scrapeError: string | null
  createdAt: Date
}

export interface FunnelStep {
  id: string
  competitorId: string
  funnelId: string
  stepOrder: number
  url: string
  pageType: string | null
  landingPageId: string | null
  landingPage?: LandingPage | null
  createdAt: Date
}

export interface Funnel {
  funnelId: string
  steps: FunnelStep[]
}
