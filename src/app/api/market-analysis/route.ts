import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { analyzeReviews } from '@/lib/analysis/market'
import { saveMarketAnalysis, getLatestMarketAnalyses } from '@/lib/db/market'

// GET — return existing market analyses
export async function GET() {
  try {
    const analyses = await getLatestMarketAnalyses(50)
    return NextResponse.json(analyses)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST — analyze reviews for given keywords (uses existing PlatformComments in DB)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { keywords, competitorId } = body as {
      keywords?: string
      competitorId?: string
    }

    if (!keywords?.trim() && !competitorId) {
      return NextResponse.json({ error: 'Se necesitan keywords o competitorId' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    // Collect reviews from PlatformComments in DB
    let reviews: Array<{ text: string; rating?: number | null; platform?: string }> = []
    let platforms: string[] = []

    if (competitorId) {
      // Get reviews from courses linked to this competitor
      const courses = await db.platformCourse.findMany({
        where: { competitorId },
        include: { comments: true },
      })
      for (const course of courses) {
        for (const comment of course.comments) {
          if (comment.text.length > 10) {
            reviews.push({ text: comment.text, rating: comment.rating, platform: course.platform })
          }
        }
        if (course.comments.length > 0 && !platforms.includes(course.platform)) {
          platforms.push(course.platform)
        }
      }
    }

    if (keywords?.trim()) {
      // Search by keywords in comments text
      const courses = await db.platformCourse.findMany({
        where: {
          OR: [
            { title: { contains: keywords.trim(), mode: 'insensitive' } },
            { search: { keywords: { contains: keywords.trim(), mode: 'insensitive' } } },
          ],
        },
        include: { comments: true },
      })
      for (const course of courses) {
        for (const comment of course.comments) {
          if (comment.text.length > 10) {
            reviews.push({ text: comment.text, rating: comment.rating, platform: course.platform })
          }
        }
        if (course.comments.length > 0 && !platforms.includes(course.platform)) {
          platforms.push(course.platform)
        }
      }
    }

    if (reviews.length < 3) {
      return NextResponse.json(
        { error: `Solo se encontraron ${reviews.length} reseñas. Necesitas al menos 3. Busca primero reseñas en las plataformas.` },
        { status: 400 }
      )
    }

    // Limit to 200 reviews to avoid token limits
    if (reviews.length > 200) reviews = reviews.slice(0, 200)

    // Get competitor name if filtering by competitor
    let competitorName: string | undefined
    if (competitorId) {
      const comp = await db.competitor.findUnique({ where: { id: competitorId }, select: { name: true } })
      competitorName = comp?.name ?? undefined
    }

    const analysis = await analyzeReviews(reviews, {
      competitorName,
      keywords: keywords?.trim(),
    })

    const saved = await saveMarketAnalysis({
      ...analysis,
      competitorId: competitorId ?? undefined,
      searchKeywords: keywords?.trim(),
      totalReviews: reviews.length,
      platforms,
    })

    return NextResponse.json(saved, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
