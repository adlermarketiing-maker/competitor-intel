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

function getIORedis() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('ioredis') as typeof import('ioredis').default
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publisherClient: any = null

function getPublisher() {
  if (!publisherClient) {
    const IORedis = getIORedis()
    publisherClient = new IORedis(parseRedisUrl(process.env.REDIS_URL!))
  }
  return publisherClient
}

export function getSubscriberClient() {
  const IORedis = getIORedis()
  return new IORedis(parseRedisUrl(process.env.REDIS_URL!))
}

export function jobChannel(jobId: string) {
  return `job:${jobId}:events`
}

export async function publishJobEvent(jobId: string, event: object): Promise<void> {
  await getPublisher().publish(jobChannel(jobId), JSON.stringify(event))
}
