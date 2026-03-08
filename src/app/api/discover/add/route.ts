import { NextRequest, NextResponse } from 'next/server'
import { createCompetitor } from '@/lib/db/competitors'
import { createScrapeJob } from '@/lib/db/jobs'
import { getScrapeQueue, isRedisAvailable } from '@/lib/queue/bullmq'
import { getSettings } from '@/lib/db/settings'
import { db } from '@/lib/db/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { discoveredId } = body

    if (!discoveredId) {
      return NextResponse.json({ error: 'discoveredId requerido' }, { status: 400 })
    }

    const discovered = await db.discoveredCompetitor.findUnique({
      where: { id: discoveredId },
      include: { search: true },
    })

    if (!discovered) {
      return NextResponse.json({ error: 'Competidor no encontrado' }, { status: 404 })
    }

    // If already added, return existing competitor
    if (discovered.competitorId) {
      return NextResponse.json({ competitorId: discovered.competitorId, jobId: null, alreadyAdded: true })
    }

    const settings = await getSettings()
    const countries = discovered.search.countries.length > 0
      ? discovered.search.countries
      : (settings?.countries ?? ['ES', 'MX', 'AR', 'CO'])

    // Create competitor from discovered data
    const competitor = await createCompetitor({
      name: discovered.pageName,
      fbPageName: discovered.pageName,
      fbPageId: discovered.pageId ?? undefined,
    })

    // Mark as added
    await db.discoveredCompetitor.update({
      where: { id: discoveredId },
      data: { competitorId: competitor.id },
    })

    // Launch full scrape
    const job = await createScrapeJob(competitor.id, 'FULL_SCRAPE')
    if (isRedisAvailable()) {
      try {
        await getScrapeQueue().add(
          'scrapeCompetitor',
          { jobDbId: job.id, competitorId: competitor.id, jobType: 'FULL_SCRAPE', countries },
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
