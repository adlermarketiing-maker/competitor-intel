import { Worker, Queue, Job } from 'bullmq'
import { getRedisConnectionOpts } from './bullmq'

interface MarketReanalysisJobData {
  type: 'reanalyze-all'
}

let _marketQueue: Queue | null = null

export function getMarketQueue(): Queue {
  if (!_marketQueue) {
    _marketQueue = new Queue('marketReanalysis', {
      connection: getRedisConnectionOpts(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 10 },
      },
    })
  }
  return _marketQueue
}

async function processMarketReanalysis(job: Job<MarketReanalysisJobData>): Promise<void> {
  console.log('[Market] Starting periodic re-analysis...')

  const { db } = await import('@/lib/db/client')
  const {
    getAnalysisGroupsForReanalysis,
    saveMarketAnalysis,
    compareAnalyses,
    hasSignificantChanges,
  } = await import('@/lib/db/market')
  const { analyzeReviews } = await import('@/lib/analysis/market')
  const { alertMarketLanguageChanges } = await import('@/lib/telegram/alerts')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[Market] ANTHROPIC_API_KEY not configured, skipping re-analysis')
    return
  }

  // Find analyses older than 14 days
  const groups = await getAnalysisGroupsForReanalysis(14)
  console.log(`[Market] Found ${groups.length} analysis groups to re-analyze`)

  if (groups.length === 0) return

  let processed = 0

  for (const previous of groups) {
    try {
      // Collect fresh reviews from DB
      let reviews: Array<{ text: string; rating?: number | null; platform?: string }> = []
      let platforms: string[] = []
      const label = previous.competitor?.name ?? previous.searchKeywords ?? 'Sin etiqueta'

      if (previous.competitorId) {
        const courses = await db.platformCourse.findMany({
          where: { competitorId: previous.competitorId },
          include: { comments: true },
        })
        for (const course of courses) {
          for (const comment of course.comments) {
            if (comment.text.length > 10) {
              reviews.push({ text: comment.text, rating: comment.rating, platform: course.platform })
            }
          }
          if (course.comments.length > 0 && !platforms.includes(course.platform)) {
            platforms.push(course.platform)
          }
        }
      }

      if (previous.searchKeywords) {
        const courses = await db.platformCourse.findMany({
          where: {
            OR: [
              { title: { contains: previous.searchKeywords, mode: 'insensitive' } },
              { search: { keywords: { contains: previous.searchKeywords, mode: 'insensitive' } } },
            ],
          },
          include: { comments: true },
        })
        for (const course of courses) {
          for (const comment of course.comments) {
            if (comment.text.length > 10) {
              reviews.push({ text: comment.text, rating: comment.rating, platform: course.platform })
            }
          }
          if (course.comments.length > 0 && !platforms.includes(course.platform)) {
            platforms.push(course.platform)
          }
        }
      }

      if (reviews.length < 3) {
        console.log(`[Market] Skipping "${label}" — only ${reviews.length} reviews`)
        continue
      }

      // Limit reviews
      if (reviews.length > 200) reviews = reviews.slice(0, 200)

      console.log(`[Market] Re-analyzing "${label}" with ${reviews.length} reviews...`)

      const newAnalysis = await analyzeReviews(reviews, {
        competitorName: previous.competitor?.name,
        keywords: previous.searchKeywords ?? undefined,
      })

      // Save the new analysis
      await saveMarketAnalysis({
        ...newAnalysis,
        competitorId: previous.competitorId ?? undefined,
        searchKeywords: previous.searchKeywords ?? undefined,
        totalReviews: reviews.length,
        platforms,
      })

      // Compare with previous and notify if significant
      const changes = compareAnalyses(
        {
          objections: previous.objections,
          benefits: previous.benefits,
          fears: previous.fears,
          desires: previous.desires,
          phrases: previous.phrases,
          awarenessLevel: previous.awarenessLevel,
        },
        newAnalysis,
        label,
      )

      if (hasSignificantChanges(changes)) {
        console.log(`[Market] Significant changes detected for "${label}", sending Telegram alert`)
        await alertMarketLanguageChanges(changes)
      } else {
        console.log(`[Market] No significant changes for "${label}"`)
      }

      processed++

      // Rate limit between analyses
      await new Promise((r) => setTimeout(r, 5000))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Market] Error re-analyzing group:`, msg)
    }
  }

  console.log(`[Market] Re-analysis complete: ${processed}/${groups.length} processed`)
}

export function startMarketWorker() {
  const worker = new Worker<MarketReanalysisJobData>('marketReanalysis', processMarketReanalysis, {
    connection: getRedisConnectionOpts(),
    concurrency: 1,
  })

  worker.on('completed', (job) => {
    console.log(`[Market] Job ${job.id} completed`)
  })
  worker.on('failed', (job, err) => {
    console.error(`[Market] Job ${job?.id} failed:`, err.message)
  })

  console.log('[Market] Market re-analysis worker started')
  return worker
}

/**
 * Schedule market re-analysis every 2 weeks (1st and 15th of each month at 03:00 Madrid).
 */
export async function setupMarketSchedule() {
  const queue = getMarketQueue()

  // Remove existing repeatable jobs to avoid duplicates
  const existing = await queue.getRepeatableJobs()
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key)
  }

  // Run on the 1st and 15th of each month at 03:00 AM Madrid time
  await queue.add(
    'market-reanalysis',
    { type: 'reanalyze-all' },
    {
      repeat: {
        pattern: '0 3 1,15 * *',
        tz: 'Europe/Madrid',
      },
    },
  )

  console.log('[Market] Scheduled: re-analysis on 1st & 15th of each month at 03:00 (Europe/Madrid)')
}
