import { NextRequest, NextResponse } from 'next/server'
import { getCompetitor } from '@/lib/db/competitors'
import { createScrapeJob, getScrapeJob } from '@/lib/db/jobs'
import { getScrapeQueue, isRedisAvailable } from '@/lib/queue/bullmq'
import { getSettings } from '@/lib/db/settings'
import type { JobType } from '@/types/scrape'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    const job = await getScrapeJob(jobId)
    if (!job || job.competitorId !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(job)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const competitor = await getCompetitor(id)
    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const jobType: JobType = body.jobType || 'FULL_SCRAPE'
    const countries: string[] = body.countries || []

    const job = await createScrapeJob(id, jobType)

    if (isRedisAvailable()) {
      try {
        const settings = await getSettings()
        const effectiveCountries =
          countries.length > 0 ? countries : (settings?.countries ?? ['ES', 'MX', 'AR', 'CO'])

        await getScrapeQueue().add(
          'scrapeCompetitor',
          {
            jobDbId: job.id,
            competitorId: id,
            jobType,
            countries: effectiveCountries,
          },
          { jobId: job.id }
        )
      } catch (err) {
        console.error('[Queue] Failed to enqueue scrape job:', err)
      }
    }

    return NextResponse.json({ jobId: job.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
