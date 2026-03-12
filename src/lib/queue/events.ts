// Shared parser from bullmq.ts — eliminates code duplication
import { parseRedisUrl } from './bullmq'

function getIORedis() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('ioredis') as typeof import('ioredis').default
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publisherClient: any = null

function getRedisUrl(): string {
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL environment variable is required')
  return url
}

function getPublisher() {
  if (!publisherClient) {
    const IORedis = getIORedis()
    publisherClient = new IORedis(parseRedisUrl(getRedisUrl()))
  }
  return publisherClient
}

export function getSubscriberClient() {
  const IORedis = getIORedis()
  return new IORedis(parseRedisUrl(getRedisUrl()))
}

export function jobChannel(jobId: string) {
  return `job:${jobId}:events`
}

export async function publishJobEvent(jobId: string, event: object): Promise<void> {
  await getPublisher().publish(jobChannel(jobId), JSON.stringify(event))
}
