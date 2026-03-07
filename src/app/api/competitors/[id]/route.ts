import { NextRequest, NextResponse } from 'next/server'
import { getCompetitor, deleteCompetitor, resetCompetitorData } from '@/lib/db/competitors'
import { getAdsForCompetitor } from '@/lib/db/ads'
import { getLandingPagesForCompetitor } from '@/lib/db/landings'
import { getLatestJobForCompetitor } from '@/lib/db/jobs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [competitor, ads, landingPages, latestJob] = await Promise.all([
      getCompetitor(id),
      getAdsForCompetitor(id),
      getLandingPagesForCompetitor(id),
      getLatestJobForCompetitor(id),
    ])

    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    return NextResponse.json({ competitor, ads, landingPages, latestJob })
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

// PATCH /api/competitors/[id]  body: { action: 'reset' }
// Clears auto-detected data (fbPageId, social links) and deletes scraped ads
// so the next scrape starts fresh with the correct competitor
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { action?: string }
    if (body.action === 'reset') {
      const competitor = await resetCompetitorData(id)
      return NextResponse.json({ ok: true, competitor })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
