import { NextRequest } from 'next/server'
import { getScrapeJob } from '@/lib/db/jobs'
import { getLatestJobForCompetitor } from '@/lib/db/jobs'
import { isRedisAvailable } from '@/lib/queue/bullmq'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const jobIdParam = req.nextUrl.searchParams.get('jobId')

  let jobId = jobIdParam
  if (!jobId) {
    const latestJob = await getLatestJobForCompetitor(id)
    jobId = latestJob?.id ?? null
  }

  if (!jobId) {
    return new Response('No active job', { status: 404 })
  }

  if (!isRedisAvailable()) {
    return new Response('Redis unavailable — progress streaming disabled', { status: 503 })
  }

  const { getSubscriberClient, jobChannel } = await import('@/lib/queue/events')

  const encoder = new TextEncoder()
  let subscriber: ReturnType<typeof getSubscriberClient>
  try {
    subscriber = getSubscriberClient()
  } catch {
    return new Response('Redis connection failed', { status: 503 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const channel = jobChannel(jobId!)
      let closed = false

      function safeEnqueue(data: string) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          closed = true
        }
      }

      function safeClose() {
        if (closed) return
        closed = true
        try { controller.close() } catch {}
      }

      subscriber.subscribe(channel, (err) => {
        if (err) {
          safeClose()
          return
        }
      })

      subscriber.on('message', (_chan: string, message: string) => {
        safeEnqueue(`data: ${message}\n\n`)
      })

      // Send initial ping
      safeEnqueue(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to job stream' })}\n\n`)

      // Auto-close after 10 minutes
      const timeout = setTimeout(async () => {
        await subscriber.unsubscribe(channel)
        subscriber.disconnect()
        safeClose()
      }, 10 * 60 * 1000)

      req.signal.addEventListener('abort', async () => {
        clearTimeout(timeout)
        await subscriber.unsubscribe(channel)
        subscriber.disconnect()
        safeClose()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
