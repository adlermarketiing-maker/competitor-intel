import { NextRequest, NextResponse } from 'next/server'
import { getResearchRun, getResearchReports } from '@/lib/db/research'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const run = await getResearchRun(runId)
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const reports = await getResearchReports(runId)

    return NextResponse.json({ ...run, reports })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
