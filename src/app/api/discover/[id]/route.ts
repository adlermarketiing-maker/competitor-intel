import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete the search and all its discovered competitors (cascade)
    await db.keywordSearch.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
