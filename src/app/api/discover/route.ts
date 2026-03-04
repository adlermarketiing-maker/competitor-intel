import { NextRequest, NextResponse } from 'next/server'
import { fetchAdsForCompetitor } from '@/lib/meta/adLibrary'
import { getMetaToken } from '@/lib/db/settings'
import { getSettings } from '@/lib/db/settings'
import { db } from '@/lib/db/client'
import type { MetaAdRaw } from '@/types/scrape'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { keywords, countries } = body

    if (!keywords?.trim()) {
      return NextResponse.json({ error: 'Keywords requeridas' }, { status: 400 })
    }

    const token = await getMetaToken()
    if (!token) {
      return NextResponse.json({ error: 'Token de Meta no configurado. Ve a Configuración.' }, { status: 400 })
    }

    const settings = await getSettings()
    const effectiveCountries: string[] = countries?.length > 0
      ? countries
      : (settings?.countries ?? ['ES', 'MX', 'AR', 'CO'])

    // Search Meta Ad Library by keywords
    const ads = await fetchAdsForCompetitor(token, {
      searchTerms: keywords.trim(),
      countries: effectiveCountries,
      activeStatus: 'ACTIVE',
    })

    // Group ads by page_id / page_name to discover unique advertisers
    const pageMap = new Map<string, {
      pageId: string
      pageName: string
      adCount: number
      sampleCopy: string | null
      sampleLandingUrl: string | null
    }>()

    for (const ad of ads as MetaAdRaw[]) {
      const key = ad.page_id ?? ad.page_name ?? 'unknown'
      if (key === 'unknown') continue

      if (!pageMap.has(key)) {
        pageMap.set(key, {
          pageId: ad.page_id ?? '',
          pageName: ad.page_name ?? key,
          adCount: 0,
          sampleCopy: null,
          sampleLandingUrl: null,
        })
      }

      const entry = pageMap.get(key)!
      entry.adCount++
      if (!entry.sampleCopy && ad.ad_creative_bodies?.[0]) {
        entry.sampleCopy = ad.ad_creative_bodies[0].slice(0, 200)
      }
      if (!entry.sampleLandingUrl && ad.ad_creative_link_url) {
        entry.sampleLandingUrl = ad.ad_creative_link_url
      }
    }

    // Sort by ad count
    const advertisers = Array.from(pageMap.values())
      .sort((a, b) => b.adCount - a.adCount)

    // Persist the search and results
    const search = await db.keywordSearch.create({
      data: {
        keywords: keywords.trim(),
        countries: effectiveCountries,
        discoveredCompetitors: {
          create: advertisers.map((a) => ({
            pageName: a.pageName,
            pageId: a.pageId || null,
            adCount: a.adCount,
            sampleCopy: a.sampleCopy,
            sampleLandingUrl: a.sampleLandingUrl,
          })),
        },
      },
      include: { discoveredCompetitors: true },
    })

    return NextResponse.json({
      searchId: search.id,
      keywords: search.keywords,
      total: advertisers.length,
      advertisers: search.discoveredCompetitors,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  try {
    const searches = await db.keywordSearch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        discoveredCompetitors: { orderBy: { adCount: 'desc' } },
        _count: { select: { platformCourses: true } },
      },
    })
    return NextResponse.json(searches)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
