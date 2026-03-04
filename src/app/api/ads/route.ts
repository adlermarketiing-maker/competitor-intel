import { NextRequest, NextResponse } from 'next/server'
import { listAds } from '@/lib/db/ads'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const competitorId = searchParams.get('competitorId') || undefined
    const isActiveParam = searchParams.get('isActive')
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined
    const platform = searchParams.get('platform') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')

    const result = await listAds({ competitorId, isActive, platform, page, limit })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
