import { NextRequest, NextResponse } from 'next/server'
import { getResearchQueue } from '@/lib/queue/researchWorker'
import { isRedisAvailable } from '@/lib/queue/bullmq'

// Store running analysis in globalThis so it survives API route lifecycle
const _global = globalThis as unknown as { __researchRunning?: boolean }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const resumeRunId = (body as { resumeRunId?: string }).resumeRunId

    // ── Resume: run analysis DIRECTLY (bypass BullMQ) ──────
    if (resumeRunId) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 400 })
      }
      if (_global.__researchRunning) {
        return NextResponse.json({ error: 'Ya hay un análisis en ejecución' }, { status: 409 })
      }

      // Validate run exists
      const { db } = await import('@/lib/db/client')
      const run = await db.researchRun.findUnique({ where: { id: resumeRunId } })
      if (!run) {
        return NextResponse.json({ error: 'Run no encontrado' }, { status: 404 })
      }

      // Start analysis in a detached context using setImmediate
      _global.__researchRunning = true
      setImmediate(async () => {
        try {
          const { runResearchAnalysis } = await import('@/lib/analysis/runResearchAnalysis')
          await runResearchAnalysis(resumeRunId)
        } catch (err) {
          console.error('[Research] Background analysis failed:', err)
        } finally {
          _global.__researchRunning = false
        }
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
