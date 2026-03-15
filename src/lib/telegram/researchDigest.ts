import { db } from '@/lib/db/client'
import { escHtml } from './client'

/**
 * Build a Telegram digest message for a completed research run.
 */
export async function buildResearchTelegramDigest(runId: string): Promise<string | null> {
  const run = await db.researchRun.findUnique({
    where: { id: runId },
    include: {
      reports: { select: { market: true, topFormats: true, topHooks: true, highlights: true } },
    },
  })

  if (!run || run.status !== 'COMPLETE') return null

  const markets = ['Brazilian', 'US', 'Hispanic', 'Russian', 'French']
  const marketFlags: Record<string, string> = {
    Brazilian: '🇧🇷', US: '🇺🇸', Hispanic: '🇪🇸', Russian: '🇷🇺', French: '🇫🇷',
  }

  const lines: string[] = []
  lines.push(`<b>🔬 INVESTIGACIÓN SEMANAL — ${run.weekLabel}</b>`)
  lines.push('')
  lines.push(`<b>📈 RESUMEN</b>`)
  lines.push(`• ${run.totalAdsFound} anuncios escaneados`)
  lines.push(`• ${run.totalAdsKept} únicos guardados`)
  lines.push(`• ${run.totalAdsAnalyzed} analizados con IA`)
  lines.push(`• ${run.apiCallsUsed} llamadas API`)
  lines.push('')

  for (const marketName of markets) {
    const report = run.reports.find((r) => r.market === marketName)
    if (!report) continue

    const flag = marketFlags[marketName] || '🌍'
    lines.push(`<b>${flag} ${marketName.toUpperCase()}</b>`)

    // Top formats
    const formats = (report.topFormats as Array<{ name: string; pct: number }>) || []
    if (formats.length > 0) {
      lines.push(`Formatos: ${formats.slice(0, 3).map((f) => `${f.name} (${f.pct}%)`).join(', ')}`)
    }

    // Top hooks
    const hooks = (report.topHooks as Array<{ name: string; pct: number }>) || []
    if (hooks.length > 0) {
      lines.push(`Hooks: ${hooks.slice(0, 3).map((h) => `${h.name} (${h.pct}%)`).join(', ')}`)
    }

    // Highlights
    const highlights = (report.highlights as Array<{ metaAdId: string; innovationScore: number }>) || []
    if (highlights.length > 0) {
      lines.push(`⭐ ${highlights.length} ads destacados (innovation ≥ 8)`)
    }

    // Get top 2 ads by innovation for this market
    const topAds = await db.researchAd.findMany({
      where: { runId, market: marketName, isRelevant: true, aiAnalyzed: true },
      orderBy: { innovationScore: 'desc' },
      take: 2,
    })

    for (const ad of topAds) {
      const copy = (ad.adCopyBodies[0] || '').slice(0, 60)
      const score = ad.innovationScore ?? 0
      const days = ad.daysActive
      const format = ad.creativeFormat || '?'
      const angle = ad.marketingAngle || '?'
      lines.push(`  → "${escHtml(copy)}..." — ${days}d, ${score}/10 [${format} · ${angle}]`)
    }

    lines.push('')
  }

  lines.push(`📊 Informe completo disponible en el dashboard → /research`)

  return lines.join('\n')
}
