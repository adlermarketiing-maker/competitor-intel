import { db } from './client'
import type { AdTagsResult } from '@/lib/analysis/adTags'

export async function saveAdAnalysis(adId: string, tags: AdTagsResult) {
  return db.ad.update({
    where: { id: adId },
    data: {
      aiAnalyzed: true,
      hookType: tags.hookType,
      marketingAngle: tags.marketingAngle,
      creativeFormat: tags.creativeFormat,
      awarenessLevel: tags.awarenessLevel,
      copyLength: tags.copyLength,
      copyStructure: tags.copyStructure,
      ctaText: tags.ctaText,
      ctaUrgency: tags.ctaUrgency,
      offerPrice: tags.offerPrice,
      offerDiscount: tags.offerDiscount,
      offerBonuses: tags.offerBonuses,
      offerGuarantee: tags.offerGuarantee,
      offerScarcity: tags.offerScarcity,
      aiScore: tags.aiScore,
      aiSummary: tags.aiSummary,
    },
  })
}

export async function getUnanalyzedAds(limit = 50) {
  return db.ad.findMany({
    where: { aiAnalyzed: false },
    orderBy: { lastSeenAt: 'desc' },
    take: limit,
    select: {
      id: true,
      adCopyBodies: true,
      headline: true,
      description: true,
      caption: true,
      ctaType: true,
      imageUrls: true,
      videoUrls: true,
    },
  })
}

export async function getUnanalyzedCount() {
  return db.ad.count({ where: { aiAnalyzed: false } })
}

/** Get distinct values for a tag field (for filter dropdowns) */
export async function getDistinctTagValues(field: 'hookType' | 'marketingAngle' | 'creativeFormat' | 'awarenessLevel' | 'copyLength') {
  const results = await db.ad.findMany({
    where: { aiAnalyzed: true, [field]: { not: null } },
    select: { [field]: true },
    distinct: [field],
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.map((r: any) => r[field] as string).filter(Boolean)
}
