import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if record exists first to return proper 404
    const exists = await db.keywordSearch.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'Búsqueda no encontrada' }, { status: 404 })
    }

    // Delete the search and all its discovered competitors (cascade)
    await db.keywordSearch.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
