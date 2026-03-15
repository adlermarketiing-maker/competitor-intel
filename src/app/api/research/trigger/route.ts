import { NextResponse } from 'next/server'
import { getResearchQueue } from '@/lib/queue/researchWorker'
import { isRedisAvailable } from '@/lib/queue/bullmq'

export async function POST() {
  try {
    if (!isRedisAvailable()) {
      return NextResponse.json({ error: 'Redis no disponible' }, { status: 503 })
    }
    if (!process.env.SEARCHAPI_KEY) {
      return NextResponse.json({ error: 'SEARCHAPI_KEY no configurada' }, { status: 400 })
    }

    const queue = getResearchQueue()
    const job = await queue.add('manual-research', { type: 'weekly-research' as const })

    return NextResponse.json({ ok: true, jobId: job.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
