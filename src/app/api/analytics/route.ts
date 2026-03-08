import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics } from '@/lib/db/analytics'

export async function GET(req: NextRequest) {
  try {
    const competitorId = req.nextUrl.searchParams.get('competitorId') || undefined
    const data = await getAnalytics(competitorId)
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
