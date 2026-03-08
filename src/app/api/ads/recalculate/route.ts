import { NextResponse } from 'next/server'
import { recalculateAllAdStatuses } from '@/lib/db/ads'

export async function POST() {
  try {
    const result = await recalculateAllAdStatuses()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
