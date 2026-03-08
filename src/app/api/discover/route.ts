import { NextRequest, NextResponse } from 'next/server'
import { searchPages, fetchAdsForPage } from '@/lib/meta/adLibraryApi'
import { getSettings } from '@/lib/db/settings'
import { db } from '@/lib/db/client'
import type { MetaAdRaw } from '@/types/scrape'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { keywords, countries, clientId } = body

    if (!keywords?.trim()) {
      return NextResponse.json({ error: 'Keywords requeridas' }, { status: 400 })
    }

    const apiKey = process.env.SEARCHAPI_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SEARCHAPI_KEY no configurada. Añádela en Railway.' }, { status: 400 })
    }

    const settings = await getSettings()
    const effectiveCountries: string[] = countries?.length > 0
      ? countries
      : (settings?.countries ?? ['ES', 'MX', 'AR', 'CO'])

    // Step 1: Find all advertiser pages matching these keywords
    const pages = await searchPages(apiKey, keywords.trim())

    if (pages.length === 0) {
      // Persist empty search so it shows in history
      const search = await db.keywordSearch.create({
        data: {
          keywords: keywords.trim(),
          countries: effectiveCountries,
          clientId: clientId || null,
        },
        include: { discoveredCompetitors: true },
      })
      return NextResponse.json({
        searchId: search.id,
        keywords: search.keywords,
        total: 0,
        advertisers: [],
      })
    }

    // Step 2: For each page, fetch a sample of their active ads (parallel, max 10 pages)
    const pagesToFetch = pages.slice(0, 10)
    const adsPerPage = await Promise.all(
      pagesToFetch.map(async (page) => {
        const ads = await fetchAdsForPage(apiKey, page.pageId, {
          maxAds: 15,
          activeStatus: 'ACTIVE',
        })
        return { page, ads }
      })
    )

    // Step 3: Build rich advertiser data
    const advertisers = adsPerPage
      .map(({ page, ads }) => {
        // Collect unique landing URLs from ads
        const landingUrls = new Set<string>()
        const adCopies: string[] = []
        const adImages: string[] = []

        for (const ad of ads) {
          if (ad.ad_creative_link_url) {
            landingUrls.add(ad.ad_creative_link_url)
          }
          if (ad.ad_creative_bodies?.[0] && adCopies.length < 3) {
            adCopies.push(ad.ad_creative_bodies[0].slice(0, 300))
          }
          if (ad.ad_creative_images?.[0]?.original_image_url && adImages.length < 3) {
            adImages.push(ad.ad_creative_images[0].original_image_url)
          }
        }

        return {
          pageId: page.pageId,
          pageName: page.pageName,
          category: page.category ?? null,
          likes: page.likes ?? 0,
          igUsername: page.igUsername ?? null,
          adCount: ads.length,
          sampleCopy: adCopies[0] ?? null,
          sampleLandingUrl: [...landingUrls][0] ?? null,
          landingUrls: [...landingUrls].slice(0, 5),
          adCopies,
          adImages,
        }
      })
      .filter((a) => a.adCount > 0)
      .sort((a, b) => b.adCount - a.adCount)

    // Step 4: Persist the search and discovered competitors
    const search = await db.keywordSearch.create({
      data: {
        keywords: keywords.trim(),
        countries: effectiveCountries,
        clientId: clientId || null,
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

    // Merge the rich data with the persisted records
    const enrichedAdvertisers = search.discoveredCompetitors.map((dc) => {
      const rich = advertisers.find((a) => a.pageId === dc.pageId)
      return {
        ...dc,
        category: rich?.category ?? null,
        likes: rich?.likes ?? 0,
        igUsername: rich?.igUsername ?? null,
        landingUrls: rich?.landingUrls ?? [],
        adCopies: rich?.adCopies ?? [],
        adImages: rich?.adImages ?? [],
      }
    })

    return NextResponse.json({
      searchId: search.id,
      keywords: search.keywords,
      total: enrichedAdvertisers.length,
      advertisers: enrichedAdvertisers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId') || undefined
    const where = clientId ? { clientId } : {}
    const searches = await db.keywordSearch.findMany({
      where,
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
