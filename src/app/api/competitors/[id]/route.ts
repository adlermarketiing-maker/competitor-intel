import { NextRequest, NextResponse } from 'next/server'
import { getCompetitor, deleteCompetitor } from '@/lib/db/competitors'
import { getAdsForCompetitor } from '@/lib/db/ads'
import { getLandingPagesForCompetitor } from '@/lib/db/landings'
import { getFunnelsForCompetitor } from '@/lib/db/funnels'
import { getLatestJobForCompetitor } from '@/lib/db/jobs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [competitor, ads, landingPages, funnels, latestJob] = await Promise.all([
      getCompetitor(id),
      getAdsForCompetitor(id),
      getLandingPagesForCompetitor(id),
      getFunnelsForCompetitor(id),
      getLatestJobForCompetitor(id),
    ])

    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    return NextResponse.json({ competitor, ads, landingPages, funnels, latestJob })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteCompetitor(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
