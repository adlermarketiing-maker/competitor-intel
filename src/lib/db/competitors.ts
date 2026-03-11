import { db } from './client'

export async function listCompetitors(clientId?: string) {
  const where = clientId ? { clientId } : {}
  const [competitors, activeAdCounts] = await Promise.all([
    db.competitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { ads: true } },
        scrapeJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    db.ad.groupBy({
      by: ['competitorId'],
      where: { isActive: true, ...(clientId ? { competitor: { clientId } } : {}) },
      _count: { _all: true },
    }),
  ])
  const activeMap = new Map(activeAdCounts.map((a) => [a.competitorId, a._count._all]))
  return competitors.map((c) => ({
    ...c,
    activeAdsCount: activeMap.get(c.id) ?? 0,
    latestJob: c.scrapeJobs[0] ?? null,
  }))
}

export async function getCompetitor(id: string) {
  return db.competitor.findUnique({
    where: { id },
    include: {
      _count: { select: { ads: true } },
    },
  })
}

export async function createCompetitor(data: {
  name: string
  fbPageName?: string
  fbPageId?: string
  websiteUrl?: string
  searchTerm?: string
  facebookUrl?: string
  instagramUrl?: string
  adLibraryUrl?: string
  clientId?: string
}) {
  return db.competitor.create({ data })
}

export async function updateCompetitor(
  id: string,
  data: Partial<{
    name: string
    fbPageName: string
    fbPageId: string
    websiteUrl: string
    facebookUrl: string
    instagramUrl: string
    youtubeUrl: string
    adLibraryUrl: string
    semrushUrl: string
    competitorType: string
    lastScrapedAt: Date
    // Funnel Hacking fields
    avatar: string | null
    funnelUrl: string | null
    promesa: string | null
    promesaOferta: string | null
    oferta: string | null
    bonos: string | null
    garantia: string | null
    pruebasAutoridad: string | null
    precio: string | null
    embudoStructure: string | null
    funnelNotes: string | null
    funnelAnalyzedAt: Date | null
  }>
) {
  return db.competitor.update({ where: { id }, data })
}

export async function deleteCompetitor(id: string) {
  return db.competitor.delete({ where: { id } })
}

/**
 * Full reset: clears all scraped data (ads, landings, jobs, funnel analysis)
 * and auto-detected fields, so the next scrape starts completely fresh.
 */
export async function resetCompetitorData(id: string) {
  await db.landingPage.deleteMany({ where: { competitorId: id } })
  await db.scrapeJob.deleteMany({ where: { competitorId: id } })
  await db.ad.deleteMany({ where: { competitorId: id } })
  return db.competitor.update({
    where: { id },
    data: {
      fbPageId: null,
      facebookUrl: null,
      instagramUrl: null,
      adLibraryUrl: null,
      lastScrapedAt: null,
      funnelAnalyzedAt: null,
      avatar: null,
      promesa: null,
      promesaOferta: null,
      oferta: null,
      bonos: null,
      garantia: null,
      pruebasAutoridad: null,
      precio: null,
      embudoStructure: null,
      funnelNotes: null,
      funnelUrl: null,
    },
  })
}

export async function getDashboardStats(clientId?: string) {
  const compWhere = clientId ? { clientId } : {}
  const adWhere = clientId ? { competitor: { clientId } } : {}
  const lpWhere = clientId ? { competitor: { clientId } } : {}
  const [competitors, totalAds, activeAds, landingPages] = await Promise.all([
    db.competitor.count({ where: compWhere }),
    db.ad.count({ where: adWhere }),
    db.ad.count({ where: { isActive: true, ...adWhere } }),
    db.landingPage.count({ where: lpWhere }),
  ])
  return { competitors, totalAds, activeAds, landingPages }
}
