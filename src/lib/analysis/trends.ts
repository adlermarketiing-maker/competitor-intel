import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'

export interface TrendInsight {
  type: 'format_gap' | 'hook_transfer' | 'trending_topic' | 'viral_sound'
  title: string
  description: string
  source: string
  urgency: 'high' | 'medium' | 'low'
  relatedPostIds: string[]
}

/**
 * Cross-analyze organic content trends vs ad trends to find opportunities.
 * Uses Claude to generate actionable insights.
 */
export async function analyzeTrendsVsAds(): Promise<TrendInsight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []

  const since = new Date()
  since.setDate(since.getDate() - 30)

  // Gather organic data
  const [organicPosts, viralPosts, adData] = await Promise.all([
    db.organicPost.findMany({
      where: { scrapedAt: { gte: since } },
      select: {
        id: true,
        platform: true,
        caption: true,
        hashtags: true,
        mediaType: true,
        views: true,
        likes: true,
        isViral: true,
        viralScore: true,
        soundName: true,
        transcript: true,
        authorHandle: true,
        duration: true,
      },
      orderBy: { views: 'desc' },
      take: 100,
    }),
    db.organicPost.findMany({
      where: { isViral: true, scrapedAt: { gte: since } },
      select: { id: true, platform: true, caption: true, mediaType: true, views: true, soundName: true, transcript: true, hashtags: true },
      orderBy: { viralScore: 'desc' },
      take: 20,
    }),
    db.ad.findMany({
      where: { firstSeenAt: { gte: since }, aiAnalyzed: true },
      select: {
        hookType: true,
        marketingAngle: true,
        creativeFormat: true,
        headline: true,
        adCopyBodies: true,
        adStatus: true,
        daysActive: true,
      },
      take: 100,
    }),
  ])

  if (organicPosts.length < 5) return []

  // Summarize organic content
  const organicSummary = organicPosts.slice(0, 50).map((p) => {
    const engagement = `${p.likes} likes` + (p.views > 0 ? ` (${p.views} views)` : '')
    return `[${p.platform}] ${p.mediaType || 'post'} by @${p.authorHandle}: "${(p.caption || '').slice(0, 80)}" — ${engagement}${p.isViral ? ' 🔥VIRAL' : ''}${p.soundName ? ` [Sound: ${p.soundName}]` : ''}${p.transcript ? ` [Hook: "${p.transcript.slice(0, 60)}..."]` : ''}`
  }).join('\n')

  // Summarize viral content
  const viralSummary = viralPosts.map((p) => {
    return `[${p.platform}] "${(p.caption || '').slice(0, 80)}" — ${p.views} views${p.soundName ? ` [Sound: ${p.soundName}]` : ''}${p.transcript ? ` [Transcript: "${p.transcript.slice(0, 100)}"]` : ''}`
  }).join('\n')

  // Summarize ad trends
  const adFormats = new Map<string, number>()
  const adHooks = new Map<string, number>()
  const adAngles = new Map<string, number>()

  for (const ad of adData) {
    if (ad.creativeFormat) adFormats.set(ad.creativeFormat, (adFormats.get(ad.creativeFormat) || 0) + 1)
    if (ad.hookType) adHooks.set(ad.hookType, (adHooks.get(ad.hookType) || 0) + 1)
    if (ad.marketingAngle) adAngles.set(ad.marketingAngle, (adAngles.get(ad.marketingAngle) || 0) + 1)
  }

  const topFormats = [...adFormats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', ')
  const topHooks = [...adHooks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', ')
  const topAngles = [...adAngles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', ')

  // Organic format distribution
  const organicFormats = new Map<string, number>()
  const organicPlatforms = new Map<string, number>()
  for (const p of organicPosts) {
    if (p.mediaType) organicFormats.set(p.mediaType, (organicFormats.get(p.mediaType) || 0) + 1)
    organicPlatforms.set(p.platform, (organicPlatforms.get(p.platform) || 0) + 1)
  }

  const orgFormatStr = [...organicFormats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(', ')

  // Trending hashtags
  const hashtagMap = new Map<string, number>()
  for (const p of organicPosts) {
    for (const h of p.hashtags) {
      hashtagMap.set(h, (hashtagMap.get(h) || 0) + 1)
    }
  }
  const trendingTags = [...hashtagMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} (${v}x)`).join(', ')

  const client = new Anthropic({ apiKey })

  const prompt = `Eres un analista de marketing digital especializado en detectar oportunidades cruzando datos de contenido orgánico (Instagram, TikTok, YouTube) con datos de publicidad de pago (Meta Ads).

CONTENIDO ORGÁNICO RECIENTE (últimos 30 días):
${organicSummary}

CONTENIDO VIRAL DETECTADO:
${viralSummary || 'Ninguno aún'}

TENDENCIAS EN ADS (Meta Ad Library):
- Formatos más usados: ${topFormats || 'Sin datos'}
- Hooks más usados: ${topHooks || 'Sin datos'}
- Ángulos más usados: ${topAngles || 'Sin datos'}
- Total ads analizados: ${adData.length}

FORMATOS ORGÁNICOS: ${orgFormatStr || 'Sin datos'}
HASHTAGS TRENDING: ${trendingTags || 'Sin datos'}

Analiza estos datos y genera oportunidades concretas. Para cada una, indica:
1. TIPO: format_gap (formato popular en orgánico pero no en ads), hook_transfer (hook que funciona en orgánico y se puede adaptar a ads), trending_topic (tema trending que merece contenido urgente), viral_sound (audio viral adaptable a ads)
2. TÍTULO: frase corta y accionable
3. DESCRIPCIÓN: explicación detallada con datos específicos
4. SOURCE: plataforma(s) de origen
5. URGENCIA: high (actuar esta semana), medium (próximas 2 semanas), low (oportunidad general)

Responde EXCLUSIVAMENTE con un JSON válido (sin markdown, sin backticks):
[
  {
    "type": "format_gap|hook_transfer|trending_topic|viral_sound",
    "title": "título corto",
    "description": "descripción detallada",
    "source": "tiktok|instagram|youtube|multiple",
    "urgency": "high|medium|low"
  }
]

Genera entre 3 y 8 oportunidades, priorizando las más accionables.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.type === 'text' ? b.text : '')
      .join('')

    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    let insights: Array<{
      type: string
      title: string
      description: string
      source: string
      urgency: string
    }>
    try {
      insights = JSON.parse(jsonStr)
    } catch {
      console.error('[Trends] Failed to parse Claude response as JSON:', jsonStr.slice(0, 200))
      return []
    }

    return insights.map((i) => ({
      type: i.type as TrendInsight['type'],
      title: i.title,
      description: i.description,
      source: i.source,
      urgency: i.urgency as TrendInsight['urgency'],
      relatedPostIds: [],
    }))
  } catch (err) {
    console.error('[Trends] Error analyzing trends:', err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Get a summary of organic trends for Telegram digest.
 */
export async function getOrganicTrendsSummary(daysBack = 7): Promise<{
  topVirals: Array<{ platform: string; caption: string; views: number; authorHandle: string }>
  trendingTopics: string[]
  trendingSounds: Array<{ sound: string; count: number }>
} | null> {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const viralPosts = await db.organicPost.findMany({
    where: { isViral: true, scrapedAt: { gte: since } },
    orderBy: { viralScore: 'desc' },
    select: { platform: true, caption: true, views: true, authorHandle: true, hashtags: true, soundName: true },
    take: 10,
  })

  if (viralPosts.length === 0) return null

  // Top 3 virals
  const topVirals = viralPosts.slice(0, 3).map((p) => ({
    platform: p.platform,
    caption: (p.caption || '').slice(0, 80),
    views: p.views,
    authorHandle: p.authorHandle,
  }))

  // Trending topics from hashtags
  const tagCounts = new Map<string, number>()
  for (const p of viralPosts) {
    for (const h of p.hashtags) {
      tagCounts.set(h, (tagCounts.get(h) || 0) + 1)
    }
  }
  const trendingTopics = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag)

  // Trending sounds
  const soundCounts = new Map<string, number>()
  for (const p of viralPosts) {
    if (p.soundName) {
      soundCounts.set(p.soundName, (soundCounts.get(p.soundName) || 0) + 1)
    }
  }
  const trendingSounds = [...soundCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sound, count]) => ({ sound, count }))

  return { topVirals, trendingTopics, trendingSounds }
}
