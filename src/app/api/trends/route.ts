import { NextRequest, NextResponse } from 'next/server'
import { getOrganicPosts, getViralPosts, getTrendingHashtags, getTrendingSounds } from '@/lib/db/trends'

// GET — return organic posts with filters, or aggregated trend data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') // 'posts' | 'virals' | 'hashtags' | 'sounds'
    const platform = searchParams.get('platform') || undefined
    const competitorId = searchParams.get('competitorId') || undefined
    const clientId = searchParams.get('clientId') || undefined
    const viral = searchParams.get('viral')
    const daysBack = Math.max(1, Math.min(365, parseInt(searchParams.get('daysBack') || '30') || 30))
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50') || 50))

    if (view === 'virals') {
      const virals = await getViralPosts(daysBack, limit, clientId)
      return NextResponse.json(virals)
    }

    if (view === 'hashtags') {
      const hashtags = await getTrendingHashtags(platform, daysBack, limit, clientId)
      return NextResponse.json(hashtags)
    }

    if (view === 'sounds') {
      const sounds = await getTrendingSounds(daysBack, limit, clientId)
      return NextResponse.json(sounds)
    }

    // Default: return organic posts
    const result = await getOrganicPosts({
      platform,
      competitorId,
      clientId,
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
