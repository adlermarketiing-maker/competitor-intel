import { NextRequest, NextResponse } from 'next/server'
import { getResearchConfig, updateResearchConfig } from '@/lib/db/researchConfig'

export async function GET() {
  try {
    const config = await getResearchConfig()
    return NextResponse.json(config)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { enabled, schedule, maxAdsPerMarket } = body as {
      enabled?: boolean
      schedule?: string
      maxAdsPerMarket?: number
    }

    const config = await updateResearchConfig({ enabled, schedule, maxAdsPerMarket })
    return NextResponse.json(config)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
