import { NextRequest, NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/db/competitors'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId') || undefined
    const stats = await getDashboardStats(clientId)
    return NextResponse.json(stats)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
