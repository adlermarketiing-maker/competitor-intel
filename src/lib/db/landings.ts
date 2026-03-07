import { db } from './client'
import type { ScrapedPageContent } from '@/types/scrape'

export async function upsertLandingPage(adId: string | null, content: ScrapedPageContent) {
  const data = {
    adId,
    originalUrl: content.originalUrl,
    title: content.title,
    h1Texts: content.h1Texts,
    h2Texts: content.h2Texts,
    ctaTexts: content.ctaTexts,
    prices: content.prices,
    offerName: content.offerName,
    bodyText: content.bodyText,
    screenshotPath: content.screenshotPath,
    outboundLinks: content.outboundLinks,
    httpStatus: content.httpStatus,
    scrapedAt: new Date(),
    scrapeError: content.error ?? null,
  }

  return db.landingPage.upsert({
    where: { url: content.url },
    create: { url: content.url, ...data },
    update: data,
  })
}

export async function getLandingPagesForCompetitor(competitorId: string) {
  return db.landingPage.findMany({
    where: {
      OR: [
        { ad: { competitorId } },
        { funnelSteps: { some: { competitorId } } },
      ],
    },
    orderBy: { scrapedAt: 'desc' },
  })
}

export async function getLandingPage(url: string) {
  return db.landingPage.findUnique({ where: { url } })
}
