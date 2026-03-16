import { NextRequest, NextResponse } from 'next/server'
import { getResearchQueue } from '@/lib/queue/researchWorker'
import { isRedisAvailable } from '@/lib/queue/bullmq'

export async function POST(req: NextRequest) {
  try {
    if (!isRedisAvailable()) {
      return NextResponse.json({ error: 'Redis no disponible' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const resumeRunId = (body as { resumeRunId?: string }).resumeRunId

    if (resumeRunId) {
      // Validate
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 400 })
      }
      const { db } = await import('@/lib/db/client')
      const run = await db.researchRun.findUnique({ where: { id: resumeRunId } })
      if (!run) {
        return NextResponse.json({ error: 'Run no encontrado' }, { status: 404 })
      }
    } else {
      if (!process.env.SEARCHAPI_KEY) {
        return NextResponse.json({ error: 'SEARCHAPI_KEY no configurada' }, { status: 400 })
      }
    }

    const queue = getResearchQueue()
    const job = await queue.add(
      resumeRunId ? 'resume-research' : 'manual-research',
      {
        type: 'weekly-research' as const,
        ...(resumeRunId ? { resumeRunId } : {}),
      }
    )

    return NextResponse.json({ ok: true, jobId: job.id, resumed: !!resumeRunId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
