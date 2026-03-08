import { NextRequest, NextResponse } from 'next/server'
import { searchAdsByKeyword, type DiscoveredAdvertiserRaw } from '@/lib/meta/adLibraryApi'
import { getSettings } from '@/lib/db/settings'
import { db } from '@/lib/db/client'

// Force dynamic — streaming SSE
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min timeout for thorough search

// ── Relevance filter: only keep advertisers selling courses/mentoring/services ──

const POSITIVE_KEYWORDS = [
  // ES
  'curso', 'formación', 'formacion', 'programa', 'mentoría', 'mentoria', 'mentor',
  'coaching', 'coach', 'masterclass', 'master class', 'webinar', 'taller online',
  'taller virtual', 'seminario', 'clase online', 'clase en vivo', 'aprende',
  'enseña', 'certifica', 'certificación', 'certificacion', 'diploma', 'inscríbete',
  'inscribete', 'regístrate', 'registrate', 'matrícula', 'matricula',
  'descarga gratis', 'ebook', 'e-book', 'guía gratuita', 'guia gratuita',
  'pdf gratis', 'lead magnet', 'entrenamiento', 'capacitación', 'capacitacion',
  'academia', 'escuela online', 'comunidad', 'membresía', 'membresia',
  'método', 'metodo', 'sistema', 'estrategia', 'fórmula', 'formula',
  'sesión gratuita', 'sesion gratuita', 'consulta gratis', 'llamada gratis',
  'plazas limitadas', 'cupos limitados', 'últimas plazas', 'oferta especial',
  'descuento', 'bono', 'bonos', 'garantía', 'garantia', 'transformación',
  'transformacion', 'resultado', 'testimonios', 'caso de éxito', 'caso de exito',
  'servicio', 'consultoría', 'consultoria', 'asesoría', 'asesoria',
  'embudo', 'funnel', 'lanzamiento', 'launch', 'reto', 'challenge', 'desafío',
  // EN
  'course', 'training', 'program', 'workshop', 'mentorship', 'bootcamp',
  'certification', 'enroll', 'sign up', 'free download', 'free guide',
  'free training', 'free masterclass', 'free webinar', 'free workshop',
  'online class', 'live class', 'membership', 'community', 'academy',
  'school', 'method', 'framework', 'blueprint', 'strategy', 'system',
  'free call', 'free session', 'limited spots', 'limited seats',
  'transformation', 'results', 'testimonial', 'success story',
  'consulting', 'agency', 'service', 'done for you',
]

const PLATFORM_DOMAINS = [
  'hotmart', 'teachable', 'kajabi', 'thinkific', 'skool', 'podia',
  'clickfunnels', 'systeme.io', 'stan.store', 'gumroad', 'payhip',
  'samcart', 'kartra', 'leadpages', 'unbounce', 'instapage',
  'everwebinar', 'webinarjam', 'demio', 'easywebinar', 'zoom.us',
  'calendly', 'typeform', 'tally.so', 'circle.so', 'school.com',
  'udemy', 'domestika', 'coursera', 'skillshare',
  'checkout', 'pago', 'payment', 'order', 'compra',
]

function scoreAdvertiser(a: DiscoveredAdvertiserRaw): number {
  let score = 0
  const allText = [
    ...a.adCopies,
    a.pageName,
  ].join(' ').toLowerCase()

  const allUrls = [...a.landingUrls].join(' ').toLowerCase()

  // Check ad copy for positive keywords
  for (const kw of POSITIVE_KEYWORDS) {
    if (allText.includes(kw)) score += 2
  }

  // Check landing URLs for known platforms
  for (const domain of PLATFORM_DOMAINS) {
    if (allUrls.includes(domain)) score += 5
  }

  // More ads = more likely a serious advertiser
  if (a.ads.length >= 5) score += 3
  if (a.ads.length >= 10) score += 3
  if (a.ads.length >= 20) score += 5

  return score
}

// ── API Routes ──────────────────────────────────────────────────────────────

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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send('progress', { message: `Buscando anuncios con "${keywords}"...`, adsScanned: 0, advertisersFound: 0 })

        const rawAdvertisers = await searchAdsByKeyword(apiKey, {
          keywords: keywords.trim(),
          countries: effectiveCountries,
          activeStatus: 'ALL',
          maxPages: 200,
          onProgress: ({ adsScanned, advertisersFound, page }) => {
            send('progress', {
              message: `Escaneando... ${adsScanned.toLocaleString()} anuncios, ${advertisersFound} anunciantes`,
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
          const search = await db.keywordSearch.create({
            data: { keywords: keywords.trim(), countries: effectiveCountries, clientId: clientId || null },
            include: { discoveredCompetitors: true },
          })
          send('done', { searchId: search.id, keywords: search.keywords, total: 0, advertisers: [] })
          controller.close()
          return
        }

        // ── Filter: score each advertiser and keep only relevant ones ──
        send('progress', {
          message: `Filtrando ${rawAdvertisers.length} anunciantes (solo formación/mentoría/servicios online)...`,
          adsScanned: 0,
          advertisersFound: rawAdvertisers.length,
        })

        const scored = rawAdvertisers
          .map((a) => ({ advertiser: a, score: scoreAdvertiser(a) }))
          .filter((s) => s.score >= 4) // Minimum relevance threshold
          .sort((a, b) => b.score - a.score)

        // Cap at top 200 most relevant
        const filtered = scored.slice(0, 200).map((s) => s.advertiser)

        send('progress', {
          message: `${filtered.length} anunciantes relevantes de ${rawAdvertisers.length} totales. Guardando...`,
          adsScanned: 0,
          advertisersFound: filtered.length,
        })

        // Build advertiser data
        const advertisers = filtered.map((a) => ({
          pageId: a.pageId,
          pageName: a.pageName,
          adCount: a.ads.length,
          sampleCopy: a.adCopies[0] ?? null,
          sampleLandingUrl: [...a.landingUrls][0] ?? null,
          landingUrls: [...a.landingUrls].slice(0, 5),
          adCopies: a.adCopies.slice(0, 5),
          adImages: a.adImages.slice(0, 5),
        }))

        // Persist: create search first, then batch-insert discovered competitors
        const search = await db.keywordSearch.create({
          data: {
            keywords: keywords.trim(),
            countries: effectiveCountries,
            clientId: clientId || null,
          },
        })

        // Batch insert in chunks of 50 to avoid Prisma timeout
        const BATCH_SIZE = 50
        for (let i = 0; i < advertisers.length; i += BATCH_SIZE) {
          const batch = advertisers.slice(i, i + BATCH_SIZE)
          await db.discoveredCompetitor.createMany({
            data: batch.map((a) => ({
              searchId: search.id,
              pageName: a.pageName,
              pageId: a.pageId || null,
              adCount: a.adCount,
              sampleCopy: a.sampleCopy,
              sampleLandingUrl: a.sampleLandingUrl,
            })),
          })
        }

        // Fetch persisted records to get IDs
        const savedCompetitors = await db.discoveredCompetitor.findMany({
          where: { searchId: search.id },
          orderBy: { adCount: 'desc' },
        })

        // Merge rich data with persisted records
        const enrichedAdvertisers = savedCompetitors.map((dc) => {
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
