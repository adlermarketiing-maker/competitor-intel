import { NextRequest, NextResponse } from 'next/server'
import { listCompetitors, createCompetitor } from '@/lib/db/competitors'
import { createScrapeJob } from '@/lib/db/jobs'
import { getScrapeQueue, isRedisAvailable } from '@/lib/queue/bullmq'
import { getSettings } from '@/lib/db/settings'
import type { JobType } from '@/types/scrape'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId') || undefined
    const competitors = await listCompetitors(clientId)
    return NextResponse.json(competitors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, fbPageName, websiteUrl, searchTerm, countries, jobType, clientId } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const competitor = await createCompetitor({
      name: name.trim(),
      fbPageName: fbPageName?.trim() || undefined,
      websiteUrl: websiteUrl?.trim() || undefined,
      searchTerm: searchTerm?.trim() || undefined,
      clientId: clientId || undefined,
    })

    // Trigger initial scrape
    const type: JobType = jobType || 'FULL_SCRAPE'
    const job = await createScrapeJob(competitor.id, type)

    if (isRedisAvailable()) {
      try {
        const settings = await getSettings()
        const effectiveCountries = countries?.length > 0
          ? countries
          : (settings?.countries ?? ['ES', 'MX', 'AR', 'CO'])

        await getScrapeQueue().add(
          'scrapeCompetitor',
          {
            jobDbId: job.id,
            competitorId: competitor.id,
            jobType: type,
            countries: effectiveCountries,
          },
          { jobId: job.id }
        )
      } catch (err) {
        console.error('[Queue] Failed to enqueue scrape job:', err)
      }
    }

    return NextResponse.json({ competitorId: competitor.id, jobId: job.id }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
