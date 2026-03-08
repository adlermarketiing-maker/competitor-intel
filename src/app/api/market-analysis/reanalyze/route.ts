import { NextResponse } from 'next/server'
import { isRedisAvailable } from '@/lib/queue/bullmq'

// POST — manually trigger market re-analysis of all stale analyses
export async function POST() {
  try {
    if (!isRedisAvailable()) {
      return NextResponse.json({ error: 'Cola de trabajos no disponible (Redis)' }, { status: 503 })
    }
    const { getMarketQueue } = await import('@/lib/queue/marketWorker')
    const queue = getMarketQueue()
    await queue.add('manual-reanalysis', { type: 'reanalyze-all' as const })
    return NextResponse.json({ message: 'Re-analysis job queued' }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
