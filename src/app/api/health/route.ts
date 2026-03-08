import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { isRedisAvailable } from '@/lib/queue/bullmq'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, boolean> = {}

  // DB check
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = true
  } catch {
    checks.database = false
  }

  checks.searchApi = !!process.env.SEARCHAPI_KEY
  checks.redis = isRedisAvailable()
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY

  const healthy = checks.database // DB is the only hard requirement

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  )
}
