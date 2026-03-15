import { NextRequest, NextResponse } from 'next/server'
import { listResearchAds } from '@/lib/db/research'

function safeInt(val: string | null): number | undefined {
  if (!val) return undefined
  const n = parseInt(val, 10)
  return isNaN(n) ? undefined : n
}

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
      minScore: safeInt(sp.get('minScore')),
      minInnovation: safeInt(sp.get('minInnovation')),
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
