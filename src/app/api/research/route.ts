import { NextResponse } from 'next/server'
import { listResearchRuns } from '@/lib/db/research'

export async function GET() {
  try {
    const runs = await listResearchRuns(20)
    return NextResponse.json(runs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
