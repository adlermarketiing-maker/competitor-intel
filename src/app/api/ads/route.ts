import { NextRequest, NextResponse } from 'next/server'
import { listAds } from '@/lib/db/ads'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const competitorId = searchParams.get('competitorId') || undefined
    const isActiveParam = searchParams.get('isActive')
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined
    const adStatus = searchParams.get('adStatus') || undefined
    const minDays = searchParams.get('minDays') ? parseInt(searchParams.get('minDays')!) || undefined : undefined
    const maxDays = searchParams.get('maxDays') ? parseInt(searchParams.get('maxDays')!) || undefined : undefined
    const sortBy = searchParams.get('sortBy') || undefined
    const platform = searchParams.get('platform') || undefined
    const hookType = searchParams.get('hookType') || undefined
    const marketingAngle = searchParams.get('marketingAngle') || undefined
    const creativeFormat = searchParams.get('creativeFormat') || undefined
    const awarenessLevel = searchParams.get('awarenessLevel') || undefined
    const copyLength = searchParams.get('copyLength') || undefined
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) || undefined : undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '24') || 24))

    const result = await listAds({ competitorId, isActive, adStatus, minDays, maxDays, sortBy, platform, hookType, marketingAngle, creativeFormat, awarenessLevel, copyLength, minScore, page, limit })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
