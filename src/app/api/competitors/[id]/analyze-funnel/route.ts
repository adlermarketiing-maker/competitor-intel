import { NextRequest, NextResponse } from 'next/server'
import { getCompetitor, updateCompetitor } from '@/lib/db/competitors'
import { db } from '@/lib/db/client'
import { analyzeFunnel } from '@/lib/analysis/funnelHacking'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const competitor = await getCompetitor(id)
    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 400 })
    }

    const landingPages = await db.landingPage.findMany({
      where: { competitorId: id },
      select: { url: true, title: true, h1Texts: true, h2Texts: true, ctaTexts: true, prices: true, bodyText: true },
      orderBy: { scrapedAt: 'desc' },
      take: 15,
    })

    if (landingPages.length === 0) {
      return NextResponse.json({ error: 'No hay landing pages scrapeadas. Lanza un scrape primero.' }, { status: 400 })
    }

    // Filter out pages with no meaningful content to avoid sending empty data to Claude
    const pagesWithContent = landingPages.filter((p) =>
      (p.bodyText && p.bodyText.length > 50) ||
      p.h1Texts.length > 0 ||
      p.h2Texts.length > 0 ||
      p.ctaTexts.length > 0
    )

    if (pagesWithContent.length === 0) {
      return NextResponse.json(
        { error: `Hay ${landingPages.length} landing pages pero ninguna tiene contenido suficiente para analizar. Puede que el scraping no haya podido extraer el texto (páginas con JavaScript pesado, protección anti-bot, etc.).` },
        { status: 400 }
      )
    }

    const analysis = await analyzeFunnel({ competitorName: competitor.name, pages: pagesWithContent })

    // Auto-generate Semrush URL
    let semrushUrl = competitor.semrushUrl
    if (competitor.websiteUrl && !semrushUrl) {
      try {
        const domain = new URL(competitor.websiteUrl).hostname.replace(/^www\./, '')
        semrushUrl = `https://www.semrush.com/analytics/overview/?q=${encodeURIComponent(domain)}`
      } catch { /* ignore */ }
    }

    await updateCompetitor(id, {
      ...analysis,
      ...(semrushUrl ? { semrushUrl } : {}),
      funnelAnalyzedAt: new Date(),
    })

    return NextResponse.json({ ok: true, analysis })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
