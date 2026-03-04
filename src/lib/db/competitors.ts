import { db } from './client'

export async function listCompetitors() {
  const [competitors, activeAdCounts] = await Promise.all([
    db.competitor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { ads: true } },
        scrapeJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    db.ad.groupBy({
      by: ['competitorId'],
      where: { isActive: true },
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
    adLibraryUrl: string
    lastScrapedAt: Date
  }>
) {
  return db.competitor.update({ where: { id }, data })
}

export async function deleteCompetitor(id: string) {
  return db.competitor.delete({ where: { id } })
}

export async function getDashboardStats() {
  const [competitors, totalAds, activeAds, landingPages] = await Promise.all([
    db.competitor.count(),
    db.ad.count(),
    db.ad.count({ where: { isActive: true } }),
    db.landingPage.count(),
  ])
  return { competitors, totalAds, activeAds, landingPages }
}
