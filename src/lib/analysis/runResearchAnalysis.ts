import { db } from '@/lib/db/client'
import {
  updateResearchRun,
  getRelevantUnanalyzedAds,
  updateResearchAdClassification,
  updateResearchAdAnalysis,
  saveResearchReport,
} from '@/lib/db/research'
import { getResearchConfig } from '@/lib/db/researchConfig'
import { classifyResearchAds, heuristicFilter } from '@/lib/analysis/researchClassifier'
import { analyzeAdTags } from '@/lib/analysis/adTags'
import { generateMarketReport, generateGlobalReport } from '@/lib/analysis/researchReport'

/**
 * Compute an innovation score based on the ad's tags.
 */
function computeInnovationScore(
  tags: { hookType: string; creativeFormat: string; marketingAngle: string; aiScore: number; copyStructure: string },
  daysActive: number
): number {
  let score = 5

  const rareFormats = ['meme_humor', 'testimonial', 'video_texto_animado']
  if (rareFormats.includes(tags.creativeFormat)) score += 2
  const commonFormats = ['imagen_estatica']
  if (commonFormats.includes(tags.creativeFormat)) score -= 1

  const rareHooks = ['contraintuitivo', 'estadistica', 'curiosidad_misterio']
  if (rareHooks.includes(tags.hookType)) score += 1

  const rareAngles = ['contrario_mito', 'comparacion', 'oportunidad']
  if (rareAngles.includes(tags.marketingAngle)) score += 1

  if (tags.copyStructure && tags.copyStructure.includes('>') &&
    tags.copyStructure.split('>').length >= 4) score += 1

  if (tags.aiScore >= 8) score += 1
  if (tags.aiScore >= 9) score += 1
  if (daysActive >= 14) score += 1

  return Math.min(10, Math.max(1, score))
}

/**
 * Run the full research analysis pipeline directly (no BullMQ).
 * This is a fire-and-forget function — call it without await.
 *
 * Steps:
 * 1. Heuristic pre-filter on unclassified ads
 * 2. AI classification (Haiku) in batches of 10
 * 3. Full ad analysis (Haiku) on relevant ads
 * 4. Generate reports (Opus 4.6) per market + global
 * 5. Send Telegram digest
 * 6. Mark run as COMPLETE
 */
export async function runResearchAnalysis(runId: string): Promise<void> {
  console.log(`[Research] === STARTING ANALYSIS for run ${runId} ===`)

  try {
    // Validate the run exists
    const run = await db.researchRun.findUnique({ where: { id: runId } })
    if (!run) {
      console.error(`[Research] Run ${runId} not found`)
      return
    }
    console.log(`[Research] Run found: ${run.weekLabel}, status=${run.status}, ads=${run.totalAdsFound}`)

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[Research] ANTHROPIC_API_KEY not set — cannot analyze')
      await updateResearchRun(runId, { status: 'FAILED', errorMessage: 'ANTHROPIC_API_KEY not set', completedAt: new Date() })
      return
    }

    // Quick API key validation
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const testClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const test = await testClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say OK' }],
      })
      console.log(`[Research] API key validated — Haiku responded: ${test.content[0].type === 'text' ? test.content[0].text : 'ok'}`)
    } catch (err) {
      const errMsg = err instanceof Error
        ? `${err.constructor.name}: ${err.message} ${JSON.stringify({ status: (err as unknown as Record<string, unknown>).status })}`
        : String(err)
      console.error(`[Research] API key validation FAILED: ${errMsg}`)
      await updateResearchRun(runId, { status: 'FAILED', errorMessage: `API key invalid: ${errMsg}`, completedAt: new Date() })
      return
    }

    // Load config
    const config = await getResearchConfig()
    const activeMarkets = config.markets.filter((m) => m.isActive)
    if (activeMarkets.length === 0) {
      console.error('[Research] No active markets')
      await updateResearchRun(runId, { status: 'FAILED', errorMessage: 'No active markets', completedAt: new Date() })
      return
    }
    console.log(`[Research] ${activeMarkets.length} active markets: ${activeMarkets.map((m) => m.name).join(', ')}`)

    // Mark as running
    await updateResearchRun(runId, { status: 'RUNNING', startedAt: new Date() })

    // ── Step 1: Heuristic pre-filter ────────────────────────
    console.log('[Research] Step 1: Heuristic pre-filter...')
    let allUnclassified: Array<{ id: string; adCopyBodies: string[]; headline: string | null; landingUrl: string | null }>
    try {
      allUnclassified = await db.researchAd.findMany({
        where: { runId, adCategory: null },
        select: { id: true, adCopyBodies: true, headline: true, landingUrl: true },
      })
      console.log(`[Research] Found ${allUnclassified.length} unclassified ads`)
    } catch (err) {
      console.error('[Research] DB query failed for unclassified ads:', err instanceof Error ? err.message : err)
      await updateResearchRun(runId, { status: 'FAILED', errorMessage: 'DB query failed', completedAt: new Date() })
      return
    }

    if (allUnclassified.length > 0) {
      const rejectIds: string[] = []
      const passIds: string[] = []

      for (const ad of allUnclassified) {
        try {
          const copyText = (ad.adCopyBodies || []).join(' ')
          if (!heuristicFilter({ copyText, headline: ad.headline, landingUrl: ad.landingUrl })) {
            rejectIds.push(ad.id)
          } else {
            passIds.push(ad.id)
          }
        } catch (err) {
          console.error(`[Research] Heuristic error for ad ${ad.id}:`, err instanceof Error ? err.message : err)
          rejectIds.push(ad.id) // reject on error to avoid stuck
        }
      }

      // Batch update rejected
      if (rejectIds.length > 0) {
        for (let i = 0; i < rejectIds.length; i += 500) {
          await db.researchAd.updateMany({
            where: { id: { in: rejectIds.slice(i, i + 500) } },
            data: { adCategory: 'other', isRelevant: false, relevanceScore: 0 },
          })
        }
        console.log(`[Research] Rejected ${rejectIds.length} ads by heuristic`)
      }

      // Mark passed as 'pending' for AI classification
      if (passIds.length > 0) {
        for (let i = 0; i < passIds.length; i += 500) {
          await db.researchAd.updateMany({
            where: { id: { in: passIds.slice(i, i + 500) } },
            data: { adCategory: 'pending' },
          })
        }
        console.log(`[Research] Marked ${passIds.length} ads as pending for AI classification`)
      }

      console.log(`[Research] Step 1 complete: ${passIds.length} passed, ${rejectIds.length} rejected`)
    } else {
      console.log('[Research] Step 1: No unclassified ads — skipping heuristic filter')
    }

    // ── Step 2: AI classification (batches of 10) ──────────
    console.log('[Research] Step 2: AI classification...')
    const pendingCount = await db.researchAd.count({ where: { runId, adCategory: 'pending' } })
    console.log(`[Research] ${pendingCount} ads pending AI classification`)

    let classified = 0
    let classifyErrors = 0

    while (true) {
      const batch = await db.researchAd.findMany({
        where: { runId, adCategory: 'pending' },
        select: { id: true, metaAdId: true, adCopyBodies: true, headline: true, landingUrl: true },
        take: 10,
      })
      if (batch.length === 0) break

      try {
        const results = await classifyResearchAds(
          batch.map((ad) => ({
            metaAdId: ad.metaAdId,
            copyText: (ad.adCopyBodies || []).join(' '),
            headline: ad.headline,
            landingUrl: ad.landingUrl,
          }))
        )

        for (const result of results) {
          const ad = batch.find((a) => a.metaAdId === result.metaAdId)
          if (!ad) continue
          const isRelevant =
            ['infoproduct', 'service', 'agency'].includes(result.adCategory) &&
            result.relevanceScore >= 5
          await updateResearchAdClassification(ad.id, {
            adCategory: result.adCategory,
            niche: result.niche,
            language: result.language,
            isRelevant,
            relevanceScore: result.relevanceScore,
          })
          classified++
        }
      } catch (err) {
        const errMsg = err instanceof Error
          ? `${err.constructor.name}: ${err.message || '(empty)'} ${JSON.stringify({ status: (err as any).status, error: (err as any).error })}`
          : String(err)
        console.error(`[Research] Classification API error: ${errMsg}`)
        classifyErrors++
        // Mark batch as 'other' to prevent infinite loop
        await db.researchAd.updateMany({
          where: { id: { in: batch.map((a) => a.id) } },
          data: { adCategory: 'classification_failed', isRelevant: false, relevanceScore: 0 },
        })
      }

      if (classified % 50 === 0 && classified > 0) {
        console.log(`[Research] Classified ${classified}/${pendingCount} ads...`)
      }

      await new Promise((r) => setTimeout(r, 300))
    }

    console.log(`[Research] Step 2 complete: ${classified} classified, ${classifyErrors} batch errors`)

    // ── Step 3: Full ad analysis on relevant ads ────────────
    console.log('[Research] Step 3: Full ad analysis...')
    const maxAnalyze = activeMarkets.length * 60
    const toAnalyze = await getRelevantUnanalyzedAds(runId, undefined, maxAnalyze)
    console.log(`[Research] ${toAnalyze.length} relevant ads to analyze (max ${maxAnalyze})`)

    let analyzed = 0
    let analyzeErrors = 0

    for (const ad of toAnalyze) {
      try {
        const tags = await analyzeAdTags({
          copyBodies: ad.adCopyBodies,
          headline: ad.headline,
          description: ad.description,
          caption: ad.caption,
          ctaType: null,
          hasVideo: ad.videoUrls.length > 0,
          hasImages: ad.imageUrls.length > 0,
          imageCount: ad.imageUrls.length,
        })

        const innovationScore = computeInnovationScore(tags, ad.daysActive)

        await updateResearchAdAnalysis(ad.id, {
          aiAnalyzed: true,
          ...tags,
          innovationScore,
        })
        analyzed++

        if (analyzed % 20 === 0) {
          console.log(`[Research] Analyzed ${analyzed}/${toAnalyze.length} ads...`)
        }

        await new Promise((r) => setTimeout(r, 300))
      } catch (err) {
        // Log full error details — Anthropic SDK errors have status/error/message
        const errMsg = err instanceof Error
          ? `${err.constructor.name}: ${err.message || '(empty message)'} ${JSON.stringify({ status: (err as any).status, error: (err as any).error })}`
          : String(err)
        console.error(`[Research] Analysis error for ${ad.metaAdId}: ${errMsg}`)
        analyzeErrors++
        // Mark as analyzed anyway to prevent re-processing
        try {
          await updateResearchAdAnalysis(ad.id, { aiAnalyzed: true })
        } catch { /* ignore */ }
      }
    }

    await updateResearchRun(runId, { totalAdsAnalyzed: analyzed })
    console.log(`[Research] Step 3 complete: ${analyzed} analyzed, ${analyzeErrors} errors`)

    // ── Step 4: Generate Opus 4.6 reports per market ────────
    console.log('[Research] Step 4: Generating reports with Opus 4.6...')
    const marketSummaries: Array<{
      market: string
      adCount: number
      topFormats: Array<{ name: string; count: number; pct: number }>
      topAngles: Array<{ name: string; count: number; pct: number }>
      topHooks: Array<{ name: string; count: number; pct: number }>
      avgScore: number
      highlightCount: number
    }> = []

    for (const market of activeMarkets) {
      const marketAds = await db.researchAd.findMany({
        where: { runId, market: market.name, isRelevant: true, aiAnalyzed: true },
        orderBy: { innovationScore: 'desc' },
        take: 500, // Limit to prevent OOM
      })

      if (marketAds.length === 0) {
        console.log(`[Research] ${market.name}: no analyzed ads, skipping report`)
        continue
      }

      try {
        const adSummaries = marketAds.map((a) => ({
          metaAdId: a.metaAdId,
          pageName: a.pageName,
          adSnapshotUrl: a.adSnapshotUrl,
          copyPreview: (a.adCopyBodies[0] || '').slice(0, 300),
          headline: a.headline,
          hookType: a.hookType,
          marketingAngle: a.marketingAngle,
          creativeFormat: a.creativeFormat,
          awarenessLevel: a.awarenessLevel,
          copyStructure: a.copyStructure,
          aiScore: a.aiScore,
          innovationScore: a.innovationScore,
          daysActive: a.daysActive,
          niche: a.niche,
          landingUrl: a.landingUrl,
          aiSummary: a.aiSummary,
        }))

        console.log(`[Research] ${market.name}: generating report for ${marketAds.length} ads...`)
        const report = await generateMarketReport(market.name, adSummaries, run.weekLabel)

        await saveResearchReport({
          runId,
          market: market.name,
          reportHtml: report.reportHtml,
          topFormats: report.topFormats,
          topAngles: report.topAngles,
          topHooks: report.topHooks,
          highlights: report.highlights,
        })

        marketSummaries.push({
          market: market.name,
          adCount: marketAds.length,
          topFormats: report.topFormats,
          topAngles: report.topAngles,
          topHooks: report.topHooks,
          avgScore: marketAds.reduce((s, a) => s + (a.aiScore ?? 0), 0) / marketAds.length,
          highlightCount: report.highlights.length,
        })

        console.log(`[Research] ${market.name}: report saved`)
      } catch (err) {
        console.error(`[Research] Report error for ${market.name}:`, err instanceof Error ? err.message : err)
      }
    }

    // Global report
    if (marketSummaries.length > 0) {
      try {
        console.log('[Research] Generating global report...')
        const globalHtml = await generateGlobalReport(marketSummaries, run.weekLabel)
        await saveResearchReport({ runId, market: 'global', reportHtml: globalHtml })
        console.log('[Research] Global report saved')
      } catch (err) {
        console.error('[Research] Global report error:', err instanceof Error ? err.message : err)
      }
    }

    // ── Step 5: Send Telegram digest ────────────────────────
    try {
      const { buildResearchTelegramDigest } = await import('@/lib/telegram/researchDigest')
      const { isTelegramConfigured, sendTelegramMessage } = await import('@/lib/telegram/client')

      if (isTelegramConfigured()) {
        const digest = await buildResearchTelegramDigest(runId)
        if (digest) {
          await sendTelegramMessage(digest)
          console.log('[Research] Telegram digest sent')
        }
      }
    } catch (err) {
      console.error('[Research] Telegram error:', err instanceof Error ? err.message : err)
    }

    // ── Done ────────────────────────────────────────────────
    await updateResearchRun(runId, {
      status: 'COMPLETE',
      completedAt: new Date(),
      totalAdsAnalyzed: analyzed,
    })

    console.log(`[Research] === ANALYSIS COMPLETE === ${analyzed} ads analyzed, ${marketSummaries.length} reports generated`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Research] === FATAL ERROR ===', msg)
    try {
      await updateResearchRun(runId, {
        status: 'FAILED',
        errorMessage: msg,
        completedAt: new Date(),
      })
    } catch (updateErr) {
      console.error('[Research] Could not mark run as failed:', updateErr)
    }
  }
}
