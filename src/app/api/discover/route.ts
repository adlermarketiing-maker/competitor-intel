import { NextRequest, NextResponse } from 'next/server'
import { searchAdsByKeyword } from '@/lib/meta/adLibraryApi'
import { getSettings } from '@/lib/db/settings'
import { db } from '@/lib/db/client'

// Force dynamic — streaming SSE
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min timeout for thorough search

export async function POST(req: NextRequest) {
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

  // Stream SSE progress events to the frontend
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send('progress', { message: `Buscando anuncios con "${keywords}" en ${effectiveCountries.length} países...`, adsScanned: 0, advertisersFound: 0 })

        // Deep keyword search in ad content
        const rawAdvertisers = await searchAdsByKeyword(apiKey, {
          keywords: keywords.trim(),
          countries: effectiveCountries,
          activeStatus: 'ALL', // Both active and inactive
          maxPages: 200,       // Deep pagination — up to 200 API calls
          onProgress: ({ adsScanned, advertisersFound, page }) => {
            send('progress', {
              message: `Escaneando... ${adsScanned} anuncios, ${advertisersFound} anunciantes encontrados`,
              adsScanned,
              advertisersFound,
              page,
            })
          },
          onLog: (msg) => {
            send('log', { message: msg })
          },
        })

        if (rawAdvertisers.length === 0) {
          // Persist empty search
          const search = await db.keywordSearch.create({
            data: {
              keywords: keywords.trim(),
              countries: effectiveCountries,
              clientId: clientId || null,
            },
            include: { discoveredCompetitors: true },
          })
          send('done', {
            searchId: search.id,
            keywords: search.keywords,
            total: 0,
            advertisers: [],
          })
          controller.close()
          return
        }

        send('progress', { message: `Guardando ${rawAdvertisers.length} anunciantes en base de datos...`, adsScanned: 0, advertisersFound: rawAdvertisers.length })

        // Build advertiser data for persistence and response
        const advertisers = rawAdvertisers.map((a) => ({
          pageId: a.pageId,
          pageName: a.pageName,
          adCount: a.ads.length,
          sampleCopy: a.adCopies[0] ?? null,
          sampleLandingUrl: [...a.landingUrls][0] ?? null,
          landingUrls: [...a.landingUrls].slice(0, 5),
          adCopies: a.adCopies.slice(0, 5),
          adImages: a.adImages.slice(0, 5),
        }))

        // Persist to DB
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

        // Merge rich data with persisted records
        const enrichedAdvertisers = search.discoveredCompetitors.map((dc) => {
          const rich = advertisers.find((a) => a.pageId === dc.pageId)
          return {
            ...dc,
            landingUrls: rich?.landingUrls ?? [],
            adCopies: rich?.adCopies ?? [],
            adImages: rich?.adImages ?? [],
          }
        })

        send('done', {
          searchId: search.id,
          keywords: search.keywords,
          total: enrichedAdvertisers.length,
          advertisers: enrichedAdvertisers,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send('error', { error: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
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
