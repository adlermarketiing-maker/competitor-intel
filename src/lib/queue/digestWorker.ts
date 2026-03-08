import { Worker, Queue, Job } from 'bullmq'
import { getRedisConnectionOpts } from './bullmq'

interface DigestJobData {
  type: 'daily' | 'weekly'
}

let _digestQueue: Queue | null = null

export function getDigestQueue(): Queue {
  if (!_digestQueue) {
    _digestQueue = new Queue('telegramDigest', {
      connection: getRedisConnectionOpts(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    })
  }
  return _digestQueue
}

async function processDigestJob(job: Job<DigestJobData>): Promise<void> {
  const { isTelegramConfigured } = await import('@/lib/telegram/client')
  if (!isTelegramConfigured()) {
    console.log('[Digest] Telegram not configured, skipping digest')
    return
  }

  const { sendTelegramMessage } = await import('@/lib/telegram/client')
  const { buildDailyDigest, buildWeeklyDigest, generateDigestInsight } = await import('@/lib/telegram/digest')

  const { type } = job.data

  console.log(`[Digest] Processing ${type} digest...`)

  let message: string | null = null

  if (type === 'weekly') {
    message = await buildWeeklyDigest()
  } else {
    message = await buildDailyDigest()

    // Append AI insight to daily digest
    if (message && process.env.ANTHROPIC_API_KEY) {
      try {
        const insight = await generateDigestInsight()
        if (insight) {
          message += `\n💡 <b>INSIGHT DEL DÍA:</b>\n"${insight}"`
        }
      } catch (err) {
        console.error('[Digest] Error generating AI insight:', err)
      }
    }
  }

  if (!message) {
    console.log(`[Digest] No news for ${type} digest, nothing to send`)
    return
  }

  await sendTelegramMessage(message)
  console.log(`[Digest] ${type} digest sent (${message.length} chars)`)
}

export function startDigestWorker() {
  const worker = new Worker<DigestJobData>('telegramDigest', processDigestJob, {
    connection: getRedisConnectionOpts(),
    concurrency: 1,
  })

  worker.on('completed', (job) => {
    console.log(`[Digest] Job ${job.id} completed`)
  })
  worker.on('failed', (job, err) => {
    console.error(`[Digest] Job ${job?.id} failed:`, err.message)
  })

  console.log('[Digest] Telegram digest worker started')
  return worker
}

/**
 * Set up repeatable digest jobs:
 *   - Daily at 08:00 Europe/Madrid
 *   - Weekly on Monday at 09:00 Europe/Madrid
 */
export async function setupDigestSchedule() {
  const queue = getDigestQueue()

  // Remove any existing repeatable jobs first to avoid duplicates
  const existing = await queue.getRepeatableJobs()
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key)
  }

  // Daily digest at 8:00 AM Madrid time
  await queue.add(
    'daily-digest',
    { type: 'daily' },
    {
      repeat: {
        pattern: '0 8 * * *',
        tz: 'Europe/Madrid',
      },
    },
  )

  // Weekly digest on Monday at 9:00 AM Madrid time
  await queue.add(
    'weekly-digest',
    { type: 'weekly' },
    {
      repeat: {
        pattern: '0 9 * * 1',
        tz: 'Europe/Madrid',
      },
    },
  )

  console.log('[Digest] Scheduled: daily at 08:00 + weekly Monday 09:00 (Europe/Madrid)')
}
