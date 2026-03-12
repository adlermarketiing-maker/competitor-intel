import { Queue } from 'bullmq'
import type { ScrapeJobData } from '@/types/scrape'

/** Shared Redis URL parser — used by bullmq.ts and events.ts */
export function parseRedisUrl(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  }
}

export function getRedisConnectionOpts() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is not set')
  }
  return parseRedisUrl(process.env.REDIS_URL)
}

/** Returns true if Redis is configured */
export function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL
}

// Lazy singleton
let _scrapeQueue: Queue | null = null

export function getScrapeQueue(): Queue {
  if (!_scrapeQueue) {
    _scrapeQueue = new Queue('scrapeCompetitor', {
      connection: getRedisConnectionOpts(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    })
  }
  return _scrapeQueue
}

export type { ScrapeJobData }
