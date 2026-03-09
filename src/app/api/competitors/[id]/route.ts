import { NextRequest, NextResponse } from 'next/server'
import { getCompetitor, updateCompetitor, deleteCompetitor, resetCompetitorData } from '@/lib/db/competitors'
import { getAdsForCompetitor, getAdStatusCounts } from '@/lib/db/ads'
import { getLandingPagesForCompetitor } from '@/lib/db/landings'
import { getLatestJobForCompetitor } from '@/lib/db/jobs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [competitor, ads, landingPages, latestJob, adStatusCounts] = await Promise.all([
      getCompetitor(id),
      getAdsForCompetitor(id),
      getLandingPagesForCompetitor(id),
      getLatestJobForCompetitor(id),
      getAdStatusCounts(id),
    ])

    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    return NextResponse.json({ competitor, ads, landingPages, latestJob, adStatusCounts })
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
    const exists = await getCompetitor(id)
    if (!exists) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }
    await deleteCompetitor(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH /api/competitors/[id]
// body: { action: 'reset' } OR { field updates }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await req.json() as Record<string, any>

    if (body.action === 'reset') {
      const competitor = await resetCompetitorData(id)
      return NextResponse.json({ ok: true, competitor })
    }

    // Allow updating competitor fields (funnel hacking, urls, type, etc.)
    const ALLOWED_FIELDS = [
      'name', 'websiteUrl', 'facebookUrl', 'instagramUrl', 'youtubeUrl',
      'competitorType', 'avatar', 'funnelUrl', 'promesa', 'promesaOferta',
      'oferta', 'bonos', 'garantia', 'pruebasAutoridad', 'precio',
      'embudoStructure', 'funnelNotes',
    ]

    const updates: Record<string, string | null> = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates[field] = body[field] === '' ? null : body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const competitor = await updateCompetitor(id, updates)
    return NextResponse.json({ ok: true, competitor })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
