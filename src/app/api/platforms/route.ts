import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

// GET — return platform search results
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const searchId = searchParams.get('searchId')

    const where = searchId ? { searchId } : {}

    const courses = await db.platformCourse.findMany({
      where,
      orderBy: { scrapedAt: 'desc' },
      take: 100,
      include: {
        comments: { orderBy: { createdAt: 'asc' }, take: 50 },
        search: { select: { keywords: true } },
      },
    })

    return NextResponse.json(courses)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST — launch a platform scrape job
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { keywords, platforms, searchId } = body as {
      keywords: string
      platforms: string[]
      searchId?: string
    }

    if (!keywords?.trim()) {
      return NextResponse.json({ error: 'Keywords requeridas' }, { status: 400 })
    }

    const VALID_PLATFORMS = ['udemy', 'hotmart', 'skool', 'pylon', 'trustpilot', 'amazon', 'youtube', 'reddit']
    const enabledPlatforms: string[] = platforms?.length > 0
      ? platforms.filter((p: string) => VALID_PLATFORMS.includes(p))
      : ['udemy', 'hotmart', 'skool', 'pylon']

    // Run scrapers in parallel (they create their own browser instances)
    const results = await Promise.allSettled(
      enabledPlatforms.map((platform) => scrapePlatform(platform, keywords.trim(), searchId))
    )

    const allCourses: Array<{ platform: string; title: string; url: string }> = []
    for (const r of results) {
      if (r.status === 'fulfilled') allCourses.push(...r.value)
    }

    return NextResponse.json({ total: allCourses.length, courses: allCourses }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function scrapePlatform(
  platform: string,
  keywords: string,
  searchId?: string
): Promise<Array<{ platform: string; title: string; url: string }>> {
  const saved: Array<{ platform: string; title: string; url: string }> = []

  try {
    let courses: Array<{
      title: string
      url: string
      authorName: string | null
      price: string | null
      rating: number | null
      reviewCount: number | null
      description: string | null
    }> = []

    let scrapeComments: (url: string, max?: number) => Promise<Array<{
      author: string | null
      text: string
      rating: number | null
      date: string | null
    }>>

    if (platform === 'udemy') {
      const { searchUdemy, scrapeUdemyReviews } = await import('@/lib/scraper/platforms/udemy')
      courses = await searchUdemy(keywords, 8)
      scrapeComments = scrapeUdemyReviews
    } else if (platform === 'hotmart') {
      const { searchHotmart, scrapeHotmartComments } = await import('@/lib/scraper/platforms/hotmart')
      courses = await searchHotmart(keywords, 8)
      scrapeComments = scrapeHotmartComments
    } else if (platform === 'skool') {
      const { searchSkool, scrapeSkoolComments } = await import('@/lib/scraper/platforms/skool')
      courses = await searchSkool(keywords, 8)
      scrapeComments = scrapeSkoolComments
    } else if (platform === 'pylon') {
      const { searchPylon, scrapePylonComments } = await import('@/lib/scraper/platforms/pylon')
      courses = await searchPylon(keywords, 8)
      scrapeComments = scrapePylonComments
    } else if (platform === 'trustpilot') {
      const { searchTrustpilot, scrapeTrustpilotReviews } = await import('@/lib/scraper/platforms/trustpilot')
      courses = await searchTrustpilot(keywords, 8)
      scrapeComments = scrapeTrustpilotReviews
    } else if (platform === 'amazon') {
      const { searchAmazon, scrapeAmazonReviews } = await import('@/lib/scraper/platforms/amazon')
      courses = await searchAmazon(keywords, 8)
      scrapeComments = scrapeAmazonReviews
    } else if (platform === 'youtube') {
      const { searchYouTube, scrapeYouTubeComments } = await import('@/lib/scraper/platforms/youtube')
      courses = await searchYouTube(keywords, 8)
      scrapeComments = scrapeYouTubeComments
    } else if (platform === 'reddit') {
      const { searchReddit, scrapeRedditComments } = await import('@/lib/scraper/platforms/reddit')
      courses = await searchReddit(keywords, 8)
      scrapeComments = scrapeRedditComments
    } else {
      return []
    }

    // Persist courses + scrape their comments
    for (const course of courses) {
      if (!course.title || !course.url) continue

      try {
        const existing = await db.platformCourse.findUnique({ where: { url: course.url } })
        let courseRecord = existing

        if (!courseRecord) {
          courseRecord = await db.platformCourse.create({
            data: {
              platform,
              title: course.title,
              url: course.url,
              authorName: course.authorName,
              price: course.price,
              rating: course.rating,
              reviewCount: course.reviewCount,
              description: course.description,
              searchId: searchId ?? null,
            },
          })
        }

        // Scrape comments for this course
        const comments = await scrapeComments(course.url, 20)
        if (comments.length > 0) {
          await db.platformComment.createMany({
            data: comments.map((c) => ({
              courseId: courseRecord!.id,
              author: c.author,
              text: c.text,
              rating: c.rating,
              date: c.date,
            })),
            skipDuplicates: true,
          })
        }

        saved.push({ platform, title: course.title, url: course.url })
      } catch {
        // Skip individual course errors
      }
    }
  } catch {
    // Skip platform errors
  }

  return saved
}
