import { NextRequest, NextResponse } from 'next/server'
import { listResearchAds } from '@/lib/db/research'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const result = await listResearchAds({
      runId: sp.get('runId') || undefined,
      market: sp.get('market') || undefined,
      isRelevant: sp.has('isRelevant') ? sp.get('isRelevant') === 'true' : undefined,
      niche: sp.get('niche') || undefined,
      hookType: sp.get('hookType') || undefined,
      marketingAngle: sp.get('marketingAngle') || undefined,
      creativeFormat: sp.get('creativeFormat') || undefined,
      minScore: sp.has('minScore') ? parseInt(sp.get('minScore')!) : undefined,
      minInnovation: sp.has('minInnovation') ? parseInt(sp.get('minInnovation')!) : undefined,
      sortBy: sp.get('sortBy') || undefined,
      page: sp.has('page') ? parseInt(sp.get('page')!) : 1,
      limit: sp.has('limit') ? parseInt(sp.get('limit')!) : 24,
    })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
