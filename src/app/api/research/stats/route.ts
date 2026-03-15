import { NextRequest, NextResponse } from 'next/server'
import { getResearchStats, getLatestCompleteRun } from '@/lib/db/research'

export async function GET(req: NextRequest) {
  try {
    const runId = req.nextUrl.searchParams.get('runId')

    let targetRunId = runId
    if (!targetRunId) {
      const latest = await getLatestCompleteRun()
      if (!latest) {
        return NextResponse.json({ error: 'No hay investigaciones completadas' }, { status: 404 })
      }
      targetRunId = latest.id
    }

    const stats = await getResearchStats(targetRunId)
    return NextResponse.json({ runId: targetRunId, ...stats })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
