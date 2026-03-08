import { db } from '@/lib/db/client'
import { escHtml } from './client'

interface CompetitorDigest {
  name: string
  newAds: number
  newWinners: Array<{
    headline: string | null
    daysActive: number
    creativeFormat: string | null
    marketingAngle: string | null
    hookType: string | null
    copyPreview: string
  }>
  retired: {
    count: number
    avgDays: number
  }
  launchDetected: boolean
}

/**
 * Build a daily digest message with changes from the last N hours.
 */
export async function buildDailyDigest(hoursBack = 24): Promise<string | null> {
  const since = new Date()
  since.setHours(since.getHours() - hoursBack)

  const competitors = await db.competitor.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const digests: CompetitorDigest[] = []

  for (const comp of competitors) {
    // New ads detected since last digest
    const newAds = await db.ad.count({
      where: {
        competitorId: comp.id,
        firstSeenAt: { gte: since },
      },
    })

    // New winners (ads that crossed >10 days since last check)
    const newWinners = await db.ad.findMany({
      where: {
        competitorId: comp.id,
        adStatus: 'winner',
        updatedAt: { gte: since },
      },
      select: {
        headline: true,
        daysActive: true,
        creativeFormat: true,
        marketingAngle: true,
        hookType: true,
        adCopyBodies: true,
      },
      orderBy: { daysActive: 'desc' },
      take: 5,
    })

    // Retired ads (became inactive since last digest)
    const retiredAds = await db.ad.findMany({
      where: {
        competitorId: comp.id,
        isActive: false,
        updatedAt: { gte: since },
      },
      select: { daysActive: true },
    })

    const retiredCount = retiredAds.length
    const avgDays = retiredCount > 0
      ? Math.round(retiredAds.reduce((sum, a) => sum + a.daysActive, 0) / retiredCount)
      : 0

    // Only include competitors with news
    if (newAds === 0 && newWinners.length === 0 && retiredCount === 0) continue

    digests.push({
      name: comp.name,
      newAds,
      newWinners: newWinners.map((w) => ({
        headline: w.headline,
        daysActive: w.daysActive,
        creativeFormat: w.creativeFormat,
        marketingAngle: w.marketingAngle,
        hookType: w.hookType,
        copyPreview: (w.adCopyBodies[0] || '').slice(0, 80),
      })),
      retired: { count: retiredCount, avgDays },
      launchDetected: newAds >= 5,
    })
  }

  if (digests.length === 0) return null

  // Build message
  const lines: string[] = []
  const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  lines.push(`<b>📊 DIGEST DIARIO — ${escHtml(date)}</b>`)
  lines.push('')

  for (const d of digests) {
    lines.push(`<b>▸ ${escHtml(d.name)}</b>`)

    if (d.newAds > 0) {
      lines.push(`🆕 <b>${d.newAds}</b> anuncios nuevos${d.launchDetected ? ' ⚠️ <b>LANZAMIENTO</b>' : ''}`)
    }

    if (d.newWinners.length > 0) {
      lines.push(`🏆 <b>Winners detectados:</b>`)
      for (const w of d.newWinners) {
        const tags = [
          w.creativeFormat?.replace(/_/g, ' '),
          w.marketingAngle?.replace(/_/g, ' '),
          w.hookType?.replace(/_/g, ' '),
        ].filter(Boolean).join(' · ')
        const preview = w.headline || w.copyPreview || 'Sin copy'
        lines.push(`  → "${escHtml(preview.slice(0, 60))}" — ${w.daysActive}d${tags ? ` [${escHtml(tags)}]` : ''}`)
      }
    }

    if (d.retired.count > 0) {
      lines.push(`🔴 ${d.retired.count} anuncios retirados (media: ${d.retired.avgDays} días)`)
    }

    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Build a weekly digest with the full week summary.
 */
export async function buildWeeklyDigest(): Promise<string | null> {
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const competitors = await db.competitor.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Global stats
  const totalNewAds = await db.ad.count({ where: { firstSeenAt: { gte: since } } })
  const totalWinners = await db.ad.count({ where: { adStatus: 'winner' } })
  const newWinnersThisWeek = await db.ad.count({
    where: { adStatus: 'winner', updatedAt: { gte: since } },
  })

  if (totalNewAds === 0 && newWinnersThisWeek === 0) return null

  // Top formats, hooks, angles this week
  const weekAds = await db.ad.findMany({
    where: { firstSeenAt: { gte: since }, aiAnalyzed: true },
    select: { creativeFormat: true, hookType: true, marketingAngle: true, adStatus: true },
  })

  const formatCounts = new Map<string, number>()
  const hookCounts = new Map<string, number>()
  const angleCounts = new Map<string, number>()

  for (const ad of weekAds) {
    if (ad.creativeFormat) formatCounts.set(ad.creativeFormat, (formatCounts.get(ad.creativeFormat) || 0) + 1)
    if (ad.hookType) hookCounts.set(ad.hookType, (hookCounts.get(ad.hookType) || 0) + 1)
    if (ad.marketingAngle) angleCounts.set(ad.marketingAngle, (angleCounts.get(ad.marketingAngle) || 0) + 1)
  }

  const topOf = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  // Per competitor summary
  const compSummaries: string[] = []
  for (const comp of competitors) {
    const newAds = await db.ad.count({
      where: { competitorId: comp.id, firstSeenAt: { gte: since } },
    })
    const winners = await db.ad.count({
      where: { competitorId: comp.id, adStatus: 'winner' },
    })
    if (newAds > 0 || winners > 0) {
      compSummaries.push(`  ${escHtml(comp.name)}: ${newAds} nuevos, ${winners} winners`)
    }
  }

  const lines: string[] = []
  const weekRange = `${since.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
  lines.push(`<b>📊 DIGEST SEMANAL — ${escHtml(weekRange)}</b>`)
  lines.push('')

  lines.push(`<b>📈 RESUMEN</b>`)
  lines.push(`• ${totalNewAds} anuncios nuevos esta semana`)
  lines.push(`• ${newWinnersThisWeek} nuevos winners detectados`)
  lines.push(`• ${totalWinners} winners activos en total`)
  lines.push('')

  if (topOf(formatCounts).length > 0) {
    lines.push(`<b>🎬 FORMATOS DOMINANTES</b>`)
    for (const [format, count] of topOf(formatCounts)) {
      const pct = weekAds.length > 0 ? Math.round((count / weekAds.length) * 100) : 0
      lines.push(`  ${escHtml(format.replace(/_/g, ' '))} — ${pct}% (${count})`)
    }
    lines.push('')
  }

  if (topOf(hookCounts).length > 0) {
    lines.push(`<b>🎣 HOOKS MÁS USADOS</b>`)
    for (const [hook, count] of topOf(hookCounts)) {
      const pct = weekAds.length > 0 ? Math.round((count / weekAds.length) * 100) : 0
      lines.push(`  ${escHtml(hook.replace(/_/g, ' '))} — ${pct}% (${count})`)
    }
    lines.push('')
  }

  if (topOf(angleCounts).length > 0) {
    lines.push(`<b>🎯 ÁNGULOS DE MARKETING</b>`)
    for (const [angle, count] of topOf(angleCounts)) {
      const pct = weekAds.length > 0 ? Math.round((count / weekAds.length) * 100) : 0
      lines.push(`  ${escHtml(angle.replace(/_/g, ' '))} — ${pct}% (${count})`)
    }
    lines.push('')
  }

  if (compSummaries.length > 0) {
    lines.push(`<b>👥 POR COMPETIDOR</b>`)
    lines.push(...compSummaries)
    lines.push('')
  }

  // Organic trends section
  try {
    const { getOrganicTrendsSummary } = await import('@/lib/analysis/trends')
    const trendsSummary = await getOrganicTrendsSummary(7)

    if (trendsSummary) {
      lines.push(`<b>📱 TENDENCIAS ORGÁNICAS</b>`)

      if (trendsSummary.topVirals.length > 0) {
        lines.push(`<b>🔥 Top virales:</b>`)
        for (const v of trendsSummary.topVirals) {
          lines.push(`  [${v.platform}] @${escHtml(v.authorHandle)}: "${escHtml(v.caption.slice(0, 50))}" — ${v.views > 0 ? v.views.toLocaleString() + ' views' : ''}`)
        }
      }

      if (trendsSummary.trendingTopics.length > 0) {
        lines.push(`📌 Topics trending: ${trendsSummary.trendingTopics.join(', ')}`)
      }

      if (trendsSummary.trendingSounds.length > 0) {
        lines.push(`🎵 Sounds trending: ${trendsSummary.trendingSounds.map((s) => `${escHtml(s.sound)} (${s.count}x)`).join(', ')}`)
      }

      lines.push('')
    }
  } catch {
    // Organic trends not available, skip
  }

  return lines.join('\n')
}

/**
 * Generate AI insight for daily digest using available data.
 */
export async function generateDigestInsight(): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const since = new Date()
  since.setHours(since.getHours() - 24)

  const recentAds = await db.ad.findMany({
    where: { firstSeenAt: { gte: since }, aiAnalyzed: true },
    select: {
      hookType: true, marketingAngle: true, creativeFormat: true,
      adStatus: true, adCopyBodies: true, headline: true,
      competitor: { select: { name: true } },
    },
    take: 50,
  })

  if (recentAds.length < 3) return null

  const summary = recentAds.map((a) =>
    `${a.competitor.name}: ${a.hookType || '?'} / ${a.marketingAngle || '?'} / ${a.creativeFormat || '?'} — "${(a.headline || a.adCopyBodies[0] || '').slice(0, 50)}"`
  ).join('\n')

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Eres un analista de publicidad digital. Basándote en estos ${recentAds.length} anuncios nuevos de hoy, genera UN solo insight accionable en 2-3 frases en español. Sé específico con datos y nombres.

ANUNCIOS HOY:
${summary}

Responde SOLO con el insight, sin preámbulos.`,
      }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.type === 'text' ? b.text : '')
      .join('')

    return text.trim()
  } catch {
    return null
  }
}

/**
 * Build on-demand analysis for a specific competitor.
 */
export async function buildCompetitorReport(competitorName: string): Promise<string | null> {
  const competitor = await db.competitor.findFirst({
    where: {
      name: { contains: competitorName, mode: 'insensitive' },
    },
    select: { id: true, name: true },
  })

  if (!competitor) return null

  const [totalAds, winners, activeAds, analyzedAds] = await Promise.all([
    db.ad.count({ where: { competitorId: competitor.id } }),
    db.ad.count({ where: { competitorId: competitor.id, adStatus: 'winner' } }),
    db.ad.count({ where: { competitorId: competitor.id, isActive: true } }),
    db.ad.findMany({
      where: { competitorId: competitor.id, aiAnalyzed: true },
      select: { hookType: true, marketingAngle: true, creativeFormat: true, aiScore: true },
    }),
  ])

  const hookCounts = new Map<string, number>()
  const angleCounts = new Map<string, number>()
  const formatCounts = new Map<string, number>()
  let scoreSum = 0, scoreCount = 0

  for (const ad of analyzedAds) {
    if (ad.hookType) hookCounts.set(ad.hookType, (hookCounts.get(ad.hookType) || 0) + 1)
    if (ad.marketingAngle) angleCounts.set(ad.marketingAngle, (angleCounts.get(ad.marketingAngle) || 0) + 1)
    if (ad.creativeFormat) formatCounts.set(ad.creativeFormat, (formatCounts.get(ad.creativeFormat) || 0) + 1)
    if (ad.aiScore != null) { scoreSum += ad.aiScore; scoreCount++ }
  }

  const topOf = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]

  const lines: string[] = []
  lines.push(`<b>📊 ANÁLISIS — ${escHtml(competitor.name)}</b>`)
  lines.push('')
  lines.push(`• Total anuncios: <b>${totalAds}</b>`)
  lines.push(`• Activos: <b>${activeAds}</b>`)
  lines.push(`• Winners: <b>${winners}</b>`)
  lines.push(`• Score medio: <b>${scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : 'N/A'}</b>/10`)
  lines.push('')

  const topHook = topOf(hookCounts)
  const topAngle = topOf(angleCounts)
  const topFormat = topOf(formatCounts)

  if (topHook || topAngle || topFormat) {
    lines.push(`<b>🔝 TOP ESTRATEGIAS</b>`)
    if (topHook) lines.push(`  Hook: ${escHtml(topHook[0].replace(/_/g, ' '))} (${topHook[1]}x)`)
    if (topAngle) lines.push(`  Ángulo: ${escHtml(topAngle[0].replace(/_/g, ' '))} (${topAngle[1]}x)`)
    if (topFormat) lines.push(`  Formato: ${escHtml(topFormat[0].replace(/_/g, ' '))} (${topFormat[1]}x)`)
  }

  return lines.join('\n')
}
