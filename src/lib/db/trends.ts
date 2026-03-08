import { db } from './client'

interface OrganicPostInput {
  platform: string
  externalId: string
  url: string
  authorHandle: string
  authorName?: string | null
  competitorId?: string | null
  caption?: string | null
  hashtags?: string[]
  mediaType?: string | null
  thumbnailUrl?: string | null
  duration?: number | null
  likes?: number
  comments?: number
  shares?: number
  views?: number
  followers?: number
  engagementRate?: number | null
  isViral?: boolean
  viralScore?: number | null
  transcript?: string | null
  soundName?: string | null
  publishedAt?: Date | null
  searchKeywords?: string | null
}

export async function upsertOrganicPost(data: OrganicPostInput) {
  return db.organicPost.upsert({
    where: { externalId: data.externalId },
    create: {
      platform: data.platform,
      externalId: data.externalId,
      url: data.url,
      authorHandle: data.authorHandle,
      authorName: data.authorName ?? null,
      competitorId: data.competitorId ?? null,
      caption: data.caption ?? null,
      hashtags: data.hashtags ?? [],
      mediaType: data.mediaType ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      duration: data.duration ?? null,
      likes: data.likes ?? 0,
      comments: data.comments ?? 0,
      shares: data.shares ?? 0,
      views: data.views ?? 0,
      followers: data.followers ?? 0,
      engagementRate: data.engagementRate ?? null,
      isViral: data.isViral ?? false,
      viralScore: data.viralScore ?? null,
      transcript: data.transcript ?? null,
      soundName: data.soundName ?? null,
      publishedAt: data.publishedAt ?? null,
      searchKeywords: data.searchKeywords ?? null,
    },
    update: {
      likes: data.likes ?? undefined,
      comments: data.comments ?? undefined,
      shares: data.shares ?? undefined,
      views: data.views ?? undefined,
      engagementRate: data.engagementRate ?? undefined,
      isViral: data.isViral ?? undefined,
      viralScore: data.viralScore ?? undefined,
      transcript: data.transcript ?? undefined,
      scrapedAt: new Date(),
    },
  })
}

export async function getOrganicPosts(filters: {
  platform?: string
  competitorId?: string
  isViral?: boolean
  searchKeywords?: string
  minEngagement?: number
  daysBack?: number
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {}

  if (filters.platform) where.platform = filters.platform
  if (filters.competitorId) where.competitorId = filters.competitorId
  if (filters.isViral !== undefined) where.isViral = filters.isViral
  if (filters.searchKeywords) where.searchKeywords = { contains: filters.searchKeywords, mode: 'insensitive' }
  if (filters.minEngagement) where.engagementRate = { gte: filters.minEngagement }
  if (filters.daysBack) {
    const since = new Date()
    since.setDate(since.getDate() - filters.daysBack)
    where.scrapedAt = { gte: since }
  }

  const [posts, total] = await Promise.all([
    db.organicPost.findMany({
      where,
      orderBy: { views: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      include: { competitor: { select: { id: true, name: true } } },
    }),
    db.organicPost.count({ where }),
  ])

  return { posts, total }
}

export async function getViralPosts(daysBack = 30, limit = 20) {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  return db.organicPost.findMany({
    where: {
      isViral: true,
      scrapedAt: { gte: since },
    },
    orderBy: { viralScore: 'desc' },
    take: limit,
    include: { competitor: { select: { id: true, name: true } } },
  })
}

export async function getTrendingHashtags(platform?: string, daysBack = 30, limit = 30) {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const where: Record<string, unknown> = { scrapedAt: { gte: since } }
  if (platform) where.platform = platform

  const posts = await db.organicPost.findMany({
    where,
    select: { hashtags: true, views: true, isViral: true },
  })

  const tagMap = new Map<string, { count: number; totalViews: number; viralCount: number }>()

  for (const post of posts) {
    for (const tag of post.hashtags) {
      const existing = tagMap.get(tag) || { count: 0, totalViews: 0, viralCount: 0 }
      existing.count++
      existing.totalViews += post.views
      if (post.isViral) existing.viralCount++
      tagMap.set(tag, existing)
    }
  }

  return [...tagMap.entries()]
    .map(([tag, data]) => ({ tag, ...data, avgViews: Math.round(data.totalViews / data.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function getTrendingSounds(daysBack = 30, limit = 20) {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const posts = await db.organicPost.findMany({
    where: {
      platform: 'tiktok',
      soundName: { not: null },
      scrapedAt: { gte: since },
    },
    select: { soundName: true, views: true, likes: true },
  })

  const soundMap = new Map<string, { count: number; totalViews: number }>()

  for (const post of posts) {
    if (!post.soundName) continue
    const existing = soundMap.get(post.soundName) || { count: 0, totalViews: 0 }
    existing.count++
    existing.totalViews += post.views
    soundMap.set(post.soundName, existing)
  }

  return [...soundMap.entries()]
    .map(([sound, data]) => ({ sound, ...data }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, limit)
}

export async function saveOpportunity(data: {
  type: string
  title: string
  description: string
  source: string
  urgency: string
  relatedPosts?: string[]
}) {
  return db.trendOpportunity.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      source: data.source,
      urgency: data.urgency,
      relatedPosts: data.relatedPosts ?? [],
    },
  })
}

export async function getOpportunities(limit = 50, includeDismissed = false) {
  return db.trendOpportunity.findMany({
    where: includeDismissed ? {} : { dismissed: false },
    orderBy: { detectedAt: 'desc' },
    take: limit,
  })
}

export async function dismissOpportunity(id: string) {
  return db.trendOpportunity.update({
    where: { id },
    data: { dismissed: true },
  })
}

/**
 * Calculate engagement metrics and mark viral posts.
 * A post is "viral" if its engagement is >3x the profile's average.
 */
export async function calculateViralStatus(authorHandle: string, platform: string) {
  const posts = await db.organicPost.findMany({
    where: { authorHandle, platform },
    select: { id: true, likes: true, comments: true, shares: true, views: true, followers: true },
  })

  if (posts.length < 3) return // Need enough data for meaningful average

  // Calculate average engagement
  const avgEngagement = posts.reduce((sum, p) => sum + p.likes + p.comments, 0) / posts.length
  // Use the max followers value across posts (all should be same profile)
  const avgFollowers = Math.max(...posts.map((p) => p.followers), 1)

  for (const post of posts) {
    const totalEngagement = post.likes + post.comments
    const engagementRate = avgFollowers > 0 ? totalEngagement / avgFollowers : 0
    const viralScore = avgEngagement > 0 ? totalEngagement / avgEngagement : 0
    const isViral = viralScore > 3

    await db.organicPost.update({
      where: { id: post.id },
      data: { engagementRate, viralScore, isViral },
    })
  }
}
