import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { upsertOrganicPost, calculateViralStatus } from '@/lib/db/trends'

// POST — trigger organic content scraping
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { platform, competitorId, keywords } = body as {
      platform: 'instagram' | 'tiktok' | 'youtube'
      competitorId?: string
      keywords?: string
    }

    const VALID_PLATFORMS = ['instagram', 'tiktok', 'youtube']
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'Platform inválida. Usa: instagram, tiktok, youtube' }, { status: 400 })
    }

    let saved = 0

    if (platform === 'instagram' && competitorId) {
      const competitor = await db.competitor.findUnique({
        where: { id: competitorId },
        select: { instagramUrl: true, name: true },
      })

      if (!competitor?.instagramUrl) {
        return NextResponse.json({ error: 'Competidor sin URL de Instagram configurada' }, { status: 400 })
      }

      const handleMatch = competitor.instagramUrl.match(/instagram\.com\/([\w.]+)/)
      if (!handleMatch) {
        return NextResponse.json({ error: 'URL de Instagram no válida' }, { status: 400 })
      }

      const handle = handleMatch[1]
      const { scrapeInstagramProfile } = await import('@/lib/scraper/organic/instagram')
      const profile = await scrapeInstagramProfile(handle, 20)

      for (const post of profile.posts) {
        await upsertOrganicPost({
          platform: 'instagram',
          externalId: post.externalId,
          url: post.url,
          authorHandle: handle,
          authorName: profile.name,
          competitorId,
          caption: post.caption,
          hashtags: post.hashtags,
          mediaType: post.mediaType,
          thumbnailUrl: post.thumbnailUrl,
          likes: post.likes,
          comments: post.comments,
          followers: profile.followers,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
        })
        saved++
      }

      await calculateViralStatus(handle, 'instagram')
    } else if (platform === 'tiktok') {
      if (keywords) {
        const { searchTikTok } = await import('@/lib/scraper/organic/tiktok')
        const videos = await searchTikTok(keywords, 20)

        for (const video of videos) {
          await upsertOrganicPost({
            platform: 'tiktok',
            externalId: video.externalId,
            url: video.url,
            authorHandle: video.authorHandle,
            authorName: video.authorName,
            caption: video.caption,
            hashtags: video.hashtags,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            shares: video.shares,
            duration: video.duration,
            soundName: video.soundName,
            thumbnailUrl: video.thumbnailUrl,
            searchKeywords: keywords,
          })
          saved++
        }

        // Calculate viral status per author
        const handles = [...new Set(videos.map((v) => v.authorHandle))]
        for (const h of handles) {
          await calculateViralStatus(h, 'tiktok')
        }
      } else if (competitorId) {
        // Could scrape a specific TikTok profile if URL is configured
        return NextResponse.json({ error: 'Para TikTok usa keywords de búsqueda' }, { status: 400 })
      }
    } else if (platform === 'youtube') {
      if (keywords) {
        const { searchYouTubeOrganic } = await import('@/lib/scraper/organic/youtubeOrganic')
        const videos = await searchYouTubeOrganic(keywords, 20)

        for (const video of videos) {
          await upsertOrganicPost({
            platform: 'youtube',
            externalId: video.externalId,
            url: video.url,
            authorHandle: video.authorHandle,
            authorName: video.authorName,
            caption: video.title + (video.description ? '\n' + video.description : ''),
            mediaType: video.description === '[Short]' ? 'short' : 'video',
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            duration: video.duration,
            thumbnailUrl: video.thumbnailUrl,
            searchKeywords: keywords,
          })
          saved++
        }
      } else if (competitorId) {
        // Scrape competitor's YouTube channel
        const competitor = await db.competitor.findUnique({
          where: { id: competitorId },
          select: { name: true, websiteUrl: true },
        })

        // For now, just return an error — user should use keywords
        return NextResponse.json({ error: 'Usa keywords para buscar en YouTube, o configura la URL del canal' }, { status: 400 })
      }
    }

    // Attempt transcription for top videos
    if (saved > 0) {
      try {
        const { batchTranscribe } = await import('@/lib/scraper/organic/transcribe')
        const recentPosts = await db.organicPost.findMany({
          where: {
            platform,
            transcript: null,
            mediaType: { in: ['reel', 'video', 'short'] },
            scrapedAt: { gte: new Date(Date.now() - 3600000) }, // last hour
          },
          select: { id: true, externalId: true, url: true, platform: true, views: true },
          orderBy: { views: 'desc' },
          take: 5,
        })

        if (recentPosts.length > 0) {
          const transcripts = await batchTranscribe(
            recentPosts.map((p) => ({ url: p.url, platform: p.platform, views: p.views, externalId: p.externalId })),
            5,
          )

          for (const [externalId, transcript] of transcripts) {
            await db.organicPost.update({
              where: { externalId },
              data: { transcript },
            })
          }
        }
      } catch (err) {
        console.error('[Trends] Transcription error:', err instanceof Error ? err.message : err)
      }
    }

    return NextResponse.json({ saved, platform }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
