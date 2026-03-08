import { NextResponse } from 'next/server'
import { getMarketQueue } from '@/lib/queue/marketWorker'

// POST — manually trigger market re-analysis of all stale analyses
export async function POST() {
  try {
    const queue = getMarketQueue()
    await queue.add('manual-reanalysis', { type: 'reanalyze-all' as const })
    return NextResponse.json({ message: 'Re-analysis job queued' }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
