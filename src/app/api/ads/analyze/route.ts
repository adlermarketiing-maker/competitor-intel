import { NextRequest, NextResponse } from 'next/server'
import { getUnanalyzedAds, getUnanalyzedCount, saveAdAnalysis } from '@/lib/db/adAnalysis'
import { analyzeAdTags } from '@/lib/analysis/adTags'

// GET: returns count of unanalyzed ads
export async function GET() {
  try {
    const count = await getUnanalyzedCount()
    return NextResponse.json({ unanalyzed: count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST: batch analyze unanalyzed ads
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({})) as { limit?: number }
    const limit = Math.min(body.limit || 50, 200)

    const ads = await getUnanalyzedAds(limit)
    const toAnalyze = ads.filter((a) =>
      a.adCopyBodies.length > 0 || a.headline || a.description
    )

    if (toAnalyze.length === 0) {
      return NextResponse.json({ analyzed: 0, message: 'No hay anuncios por analizar' })
    }

    let analyzed = 0
    let errors = 0

    for (const ad of toAnalyze) {
      try {
        const tags = await analyzeAdTags({
          copyBodies: ad.adCopyBodies,
          headline: ad.headline,
          description: ad.description,
          caption: ad.caption,
          ctaType: ad.ctaType,
          hasVideo: ad.videoUrls.length > 0,
          hasImages: ad.imageUrls.length > 0,
          imageCount: ad.imageUrls.length,
        })
        await saveAdAnalysis(ad.id, tags)
        analyzed++
      } catch {
        errors++
      }
      await new Promise((r) => setTimeout(r, 300))
    }

    return NextResponse.json({ analyzed, errors, total: toAnalyze.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
