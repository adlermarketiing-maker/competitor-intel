// Use BullMQ's bundled ioredis to avoid version conflicts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IORedis = require('bullmq/node_modules/ioredis') as typeof import('ioredis').default

function parseRedisUrl(url: string) {
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

let publisherClient: InstanceType<typeof IORedis> | null = null

function getPublisher() {
  if (!publisherClient) {
    publisherClient = new IORedis(parseRedisUrl(process.env.REDIS_URL!))
  }
  return publisherClient
}

export function getSubscriberClient() {
  return new IORedis(parseRedisUrl(process.env.REDIS_URL!))
}

export function jobChannel(jobId: string) {
  return `job:${jobId}:events`
}

export async function publishJobEvent(jobId: string, event: object): Promise<void> {
  await getPublisher().publish(jobChannel(jobId), JSON.stringify(event))
}
