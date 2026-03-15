import { Worker, Queue, Job } from 'bullmq'
import { getRedisConnectionOpts } from './bullmq'

interface ResearchJobData {
  type: 'weekly-research'
  resumeRunId?: string  // If set, skip search and resume analysis on existing run
}

let _researchQueue: Queue | null = null

export function getResearchQueue(): Queue {
  if (!_researchQueue) {
    _researchQueue = new Queue('weeklyResearch', {
      connection: getRedisConnectionOpts(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 10 },
      },
    })
  }
  return _researchQueue
}

/**
 * Get the ISO week number for a date.
 */
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Main research job processor.
 */
async function processResearchJob(job: Job<ResearchJobData>): Promise<void> {
  const apiKey = process.env.SEARCHAPI_KEY
  if (!apiKey) {
    console.log('[Research] SEARCHAPI_KEY not set, skipping')
    return
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[Research] ANTHROPIC_API_KEY not set, skipping')
    return
  }

  const { getResearchConfig, getWeeklyKeywords } = await import('@/lib/db/researchConfig')
  const { createResearchRun, updateResearchRun, upsertResearchAd,
    getUnclassifiedAds, countUnclassifiedAds, updateResearchAdClassification,
    getRelevantUnanalyzedAds, updateResearchAdAnalysis,
    saveResearchReport } = await import('@/lib/db/research')
  const { searchAdsByKeyword } = await import('@/lib/meta/adLibraryApi')
  const { classifyResearchAds, heuristicFilter } = await import('@/lib/analysis/researchClassifier')
  const { analyzeAdTags } = await import('@/lib/analysis/adTags')
  const { generateMarketReport, generateGlobalReport } = await import('@/lib/analysis/researchReport')

  const config = await getResearchConfig()
  if (!config.enabled) {
    console.log('[Research] Research is disabled in config, skipping')
    return
  }

  const activeMarkets = config.markets.filter((m) => m.isActive)
  if (activeMarkets.length === 0) {
    console.log('[Research] No active markets configured, skipping')
    return
  }

  const now = new Date()
  const weekNum = getWeekNumber(now)
  const weekLabel = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  const isResume = !!job.data.resumeRunId

  let runId: string | null = null

  try {
    // ── Resume existing run or create new one ──
    if (isResume) {
      runId = job.data.resumeRunId!
      console.log(`[Research] Resuming run ${runId} — skipping search, starting analysis...`)
      await updateResearchRun(runId, { status: 'RUNNING', startedAt: now })
    } else {
      console.log(`[Research] Starting weekly research for ${weekLabel}...`)
      const run = await createResearchRun(weekLabel)
      runId = run.id
      await updateResearchRun(runId, { status: 'RUNNING', startedAt: now })

      let totalAdsFound = 0
      let totalAdsKept = 0
      let apiCallsUsed = 0

      // ── Step 1: Search each market ──────────────────────────
      for (const market of activeMarkets) {
        const keywords = getWeeklyKeywords(market.keywords, weekNum, 4)
        console.log(`[Research] ${market.name}: searching ${keywords.length} keywords: ${keywords.join(', ')}`)

        for (const keyword of keywords) {
          try {
            const results = await searchAdsByKeyword(apiKey, {
              keywords: keyword,
              countries: market.countries,
              activeStatus: 'ACTIVE',
              maxPages: 10,
              onLog: (msg) => console.log(`[Research] ${market.name}/${keyword}: ${msg}`),
              onProgress: (info) => {
                apiCallsUsed = info.page
              },
            })

            for (const advertiser of results) {
              for (const raw of advertiser.ads) {
                if (!raw.id) continue
                totalAdsFound++
                try {
                  await upsertResearchAd(runId, market.name, keyword, raw)
                  totalAdsKept++
                } catch {
                  // Duplicate within run — skip
                }
              }
            }

            await new Promise((r) => setTimeout(r, 2000))
          } catch (err) {
            console.error(`[Research] Error searching ${market.name}/${keyword}:`, err instanceof Error ? err.message : err)
          }
        }

        console.log(`[Research] ${market.name}: ${totalAdsKept} ads stored`)
      }

      await updateResearchRun(runId, { totalAdsFound, totalAdsKept, apiCallsUsed })
      console.log(`[Research] Search complete: ${totalAdsFound} found, ${totalAdsKept} unique stored`)
    }

    await job.updateProgress(20)

    // ── Step 2: Heuristic pre-filter (chunked, 500 at a time) ─
    const { db } = await import('@/lib/db/client')
    let totalUnclassified = await countUnclassifiedAds(runId)
    let heuristicPassed = 0
    let heuristicRejected = 0

    console.log(`[Research] Heuristic filter: ${totalUnclassified} ads to process...`)

    while (totalUnclassified > 0) {
      const chunk = await getUnclassifiedAds(runId, 500)
      if (chunk.length === 0) break

      const rejectIds: string[] = []
      for (const ad of chunk) {
        const copyText = ad.adCopyBodies.join(' ')
        if (!heuristicFilter({ copyText, headline: ad.headline, landingUrl: ad.landingUrl })) {
          rejectIds.push(ad.id)
        } else {
          heuristicPassed++
        }
      }

      if (rejectIds.length > 0) {
        await db.researchAd.updateMany({
          where: { id: { in: rejectIds } },
          data: { adCategory: 'other', isRelevant: false, relevanceScore: 0 },
        })
        heuristicRejected += rejectIds.length
      }

      totalUnclassified = await countUnclassifiedAds(runId)
      await job.updateProgress(20 + Math.round(((heuristicPassed + heuristicRejected) / (totalUnclassified + heuristicPassed + heuristicRejected)) * 10))
    }

    console.log(`[Research] Heuristic filter: ${heuristicPassed} passed, ${heuristicRejected} rejected`)
    await job.updateProgress(30)

    // ── Step 3: AI classification (chunked, 10 per API call) ─
    let remaining = await countUnclassifiedAds(runId)
    const totalToClassify = remaining
    let classified = 0
    console.log(`[Research] Classifying ${remaining} ads with AI...`)

    while (remaining > 0) {
      const batch = await getUnclassifiedAds(runId, 10)
      if (batch.length === 0) break

      try {
        const results = await classifyResearchAds(
          batch.map((ad) => ({
            metaAdId: ad.metaAdId,
            copyText: ad.adCopyBodies.join(' '),
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

        await new Promise((r) => setTimeout(r, 300))
      } catch (err) {
        console.error(`[Research] Classification error:`, err instanceof Error ? err.message : err)
        // Mark this batch as "other" to avoid infinite loop
        for (const ad of batch) {
          await updateResearchAdClassification(ad.id, { adCategory: 'other', isRelevant: false, relevanceScore: 0 })
        }
      }

      remaining = await countUnclassifiedAds(runId)
      if (totalToClassify > 0) {
        await job.updateProgress(30 + Math.round(((totalToClassify - remaining) / totalToClassify) * 30))
      }
    }
    console.log(`[Research] Classification complete: ${classified} classified`)
    await job.updateProgress(60)

    // ── Step 4: Full ad analysis on relevant ads ────────────
    const maxAnalyze = activeMarkets.length * 60 // ~60 per market
    const toAnalyze = await getRelevantUnanalyzedAds(runId, undefined, maxAnalyze)
    console.log(`[Research] Analyzing ${toAnalyze.length} relevant ads with AI...`)

    let analyzed = 0
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

        // Innovation score: ask for it in a separate lightweight call
        const innovationScore = computeInnovationScore(tags, ad.daysActive)

        await updateResearchAdAnalysis(ad.id, {
          aiAnalyzed: true,
          ...tags,
          innovationScore,
        })
        analyzed++

        // Rate limit + progress
        if (analyzed % 20 === 0) await job.updateProgress(60 + Math.round((analyzed / toAnalyze.length) * 20))
        await new Promise((r) => setTimeout(r, 300))
      } catch (err) {
        console.error(`[Research] Analysis error for ${ad.metaAdId}:`, err instanceof Error ? err.message : err)
      }
    }

    await updateResearchRun(runId, { totalAdsAnalyzed: analyzed })
    await job.updateProgress(80)
    console.log(`[Research] Analysis complete: ${analyzed} ads analyzed`)

    // ── Step 5: Generate Opus 4.6 reports per market ────────
    console.log('[Research] Generating reports with Opus 4.6...')
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
        where: { runId: runId, market: market.name, isRelevant: true, aiAnalyzed: true },
        orderBy: { innovationScore: 'desc' },
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

        const report = await generateMarketReport(market.name, adSummaries, weekLabel)

        await saveResearchReport({
          runId: runId,
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

        console.log(`[Research] ${market.name}: report generated (${marketAds.length} ads)`)
      } catch (err) {
        console.error(`[Research] Report generation error for ${market.name}:`, err instanceof Error ? err.message : err)
      }
    }

    // Global report
    if (marketSummaries.length > 0) {
      try {
        const globalHtml = await generateGlobalReport(marketSummaries, weekLabel)
        await saveResearchReport({
          runId: runId,
          market: 'global',
          reportHtml: globalHtml,
        })
        console.log('[Research] Global report generated')
      } catch (err) {
        console.error('[Research] Global report error:', err instanceof Error ? err.message : err)
      }
    }

    // ── Step 6: Send Telegram digest ────────────────────────
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

    const elapsed = ((Date.now() - now.getTime()) / 1000 / 60).toFixed(1)
    console.log(`[Research] Weekly research complete in ${elapsed} min. ${analyzed} ads analyzed across ${activeMarkets.length} markets.`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Research] Fatal error:', msg)
    if (runId) {
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
}

/**
 * Compute an innovation score based on the ad's tags.
 * Uses heuristics since calling Opus for each ad would be too expensive.
 */
function computeInnovationScore(
  tags: { hookType: string; creativeFormat: string; marketingAngle: string; aiScore: number; copyStructure: string },
  daysActive: number
): number {
  let score = 5 // base

  // Reward unusual formats
  const rareFormats = ['meme_humor', 'testimonial', 'video_texto_animado']
  if (rareFormats.includes(tags.creativeFormat)) score += 2
  const commonFormats = ['imagen_estatica']
  if (commonFormats.includes(tags.creativeFormat)) score -= 1

  // Reward unusual hooks
  const rareHooks = ['contraintuitivo', 'estadistica', 'curiosidad_misterio']
  if (rareHooks.includes(tags.hookType)) score += 1

  // Reward unusual angles
  const rareAngles = ['contrario_mito', 'comparacion', 'oportunidad']
  if (rareAngles.includes(tags.marketingAngle)) score += 1

  // Reward complex copy structures
  if (tags.copyStructure && tags.copyStructure.includes('>') &&
    tags.copyStructure.split('>').length >= 4) score += 1

  // High AI score = well-executed ad
  if (tags.aiScore >= 8) score += 1
  if (tags.aiScore >= 9) score += 1

  // Longevity bonus (if it's been running a while, it's probably working)
  if (daysActive >= 14) score += 1

  return Math.min(10, Math.max(1, score))
}

export function startResearchWorker() {
  const worker = new Worker<ResearchJobData>('weeklyResearch', processResearchJob, {
    connection: getRedisConnectionOpts(),
    concurrency: 1,
    lockDuration: 7200000, // 2 hour lock — research processes thousands of ads
  })

  worker.on('completed', (job) => {
    console.log(`[Research] Job ${job.id} completed`)
  })
  worker.on('failed', (job, err) => {
    console.error(`[Research] Job ${job?.id} failed:`, err.message)
  })

  console.log('[Research] Weekly research worker started')
  return worker
}

/**
 * Set up the weekly research schedule: Sunday at 02:00 Europe/Madrid.
 */
export async function setupResearchSchedule() {
  const queue = getResearchQueue()

  // Remove existing repeatable jobs
  const existing = await queue.getRepeatableJobs()
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key)
  }

  await queue.add(
    'weekly-research',
    { type: 'weekly-research' },
    {
      repeat: {
        pattern: '0 2 * * 0', // Sunday 02:00
        tz: 'Europe/Madrid',
      },
    },
  )

  console.log('[Research] Scheduled: Sunday at 02:00 (Europe/Madrid)')
}
