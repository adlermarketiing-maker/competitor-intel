import { NextRequest, NextResponse } from 'next/server'
import { getOrganicPosts, getViralPosts, getTrendingHashtags, getTrendingSounds } from '@/lib/db/trends'

// GET — return organic posts with filters, or aggregated trend data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') // 'posts' | 'virals' | 'hashtags' | 'sounds'
    const platform = searchParams.get('platform') || undefined
    const competitorId = searchParams.get('competitorId') || undefined
    const viral = searchParams.get('viral')
    const daysBack = parseInt(searchParams.get('daysBack') || '30')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (view === 'virals') {
      const virals = await getViralPosts(daysBack, limit)
      return NextResponse.json(virals)
    }

    if (view === 'hashtags') {
      const hashtags = await getTrendingHashtags(platform, daysBack, limit)
      return NextResponse.json(hashtags)
    }

    if (view === 'sounds') {
      const sounds = await getTrendingSounds(daysBack, limit)
      return NextResponse.json(sounds)
    }

    // Default: return organic posts
    const result = await getOrganicPosts({
      platform,
      competitorId,
      isViral: viral === 'true' ? true : undefined,
      daysBack,
      limit,
    })

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
