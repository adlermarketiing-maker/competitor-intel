import { db } from './client'

export async function saveFunnelSteps(
  competitorId: string,
  funnelId: string,
  steps: Array<{ url: string; pageType?: string; landingPageId?: string }>
) {
  const creates = steps.map((step, i) =>
    db.funnelStep.upsert({
      where: { funnelId_stepOrder: { funnelId, stepOrder: i + 1 } },
      create: {
        competitorId,
        funnelId,
        stepOrder: i + 1,
        url: step.url,
        pageType: step.pageType,
        landingPageId: step.landingPageId ?? null,
      },
      update: {
        url: step.url,
        pageType: step.pageType,
        landingPageId: step.landingPageId ?? null,
      },
    })
  )
  return Promise.all(creates)
}

export async function getFunnelsForCompetitor(competitorId: string) {
  const steps = await db.funnelStep.findMany({
    where: { competitorId },
    orderBy: [{ funnelId: 'asc' }, { stepOrder: 'asc' }],
    include: { landingPage: true },
  })

  // Group by funnelId
  const grouped = new Map<string, typeof steps>()
  for (const step of steps) {
    if (!grouped.has(step.funnelId)) grouped.set(step.funnelId, [])
    grouped.get(step.funnelId)!.push(step)
  }

  return Array.from(grouped.entries()).map(([funnelId, funnelSteps]) => ({
    funnelId,
    steps: funnelSteps,
  }))
}
