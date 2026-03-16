import { NextRequest, NextResponse } from 'next/server'
import { getResearchQueue } from '@/lib/queue/researchWorker'
import { isRedisAvailable } from '@/lib/queue/bullmq'
import { runResearchAnalysis } from '@/lib/analysis/runResearchAnalysis'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const resumeRunId = (body as { resumeRunId?: string }).resumeRunId

    // ── Resume: run analysis DIRECTLY (bypass BullMQ) ──────
    if (resumeRunId) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 400 })
      }

      // Validate run exists
      const { db } = await import('@/lib/db/client')
      const run = await db.researchRun.findUnique({ where: { id: resumeRunId } })
      if (!run) {
        return NextResponse.json({ error: 'Run no encontrado' }, { status: 404 })
      }

      // Fire-and-forget — runs in the Node.js process background
      runResearchAnalysis(resumeRunId).catch((err) => {
        console.error('[Research] Background analysis failed:', err)
      })

      return NextResponse.json({ ok: true, resumed: true, runId: resumeRunId })
    }

    // ── New full research: use BullMQ (search + analysis) ──
    if (!isRedisAvailable()) {
      return NextResponse.json({ error: 'Redis no disponible' }, { status: 503 })
    }
    if (!process.env.SEARCHAPI_KEY) {
      return NextResponse.json({ error: 'SEARCHAPI_KEY no configurada' }, { status: 400 })
    }

    const queue = getResearchQueue()
    const job = await queue.add('manual-research', {
      type: 'weekly-research' as const,
    })

    return NextResponse.json({ ok: true, jobId: job.id, resumed: false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
