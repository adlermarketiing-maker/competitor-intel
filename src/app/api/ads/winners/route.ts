import { NextRequest, NextResponse } from 'next/server'
import { getWinnersRanking, getWinnersByCompetitor } from '@/lib/db/ads'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const groupBy = searchParams.get('groupBy')
    const competitorId = searchParams.get('competitorId') || undefined
    const clientId = searchParams.get('clientId') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')

    if (groupBy === 'competitor') {
      const grouped = await getWinnersByCompetitor(clientId)
      return NextResponse.json(grouped)
    }

    const winners = await getWinnersRanking({ competitorId, clientId, limit })
    return NextResponse.json(winners)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
