import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!_client) _client = new Anthropic({ apiKey })
  return _client
}

export interface ClassificationInput {
  metaAdId: string
  copyText: string
  headline: string | null
  landingUrl: string | null
}

export interface ClassificationOutput {
  metaAdId: string
  adCategory: string
  niche: string
  language: string
  relevanceScore: number
}

/**
 * Classify a batch of ads to determine if they are relevant to the infoproducer/mentor niche.
 * Uses Claude Haiku for cost efficiency. Processes up to 5 ads per call.
 */
export async function classifyResearchAds(
  ads: ClassificationInput[]
): Promise<ClassificationOutput[]> {
  if (ads.length === 0) return []

  const client = getClient()

  const adEntries = ads.map((ad, i) => {
    const parts = []
    if (ad.copyText) parts.push(`Copy: ${ad.copyText.slice(0, 300)}`)
    if (ad.headline) parts.push(`Headline: ${ad.headline}`)
    if (ad.landingUrl) parts.push(`URL: ${ad.landingUrl}`)
    return `[AD_${i + 1}] id="${ad.metaAdId}"\n${parts.join('\n')}`
  }).join('\n\n')

  const prompt = `You are an ad classification expert. Classify each ad below into a category and detect its niche and language.

${adEntries}

Respond ONLY with valid JSON (no markdown, no backticks). Return an array:

[
  {
    "index": 1,
    "adCategory": "infoproduct | service | agency | ecommerce | betting | entertainment | other",
    "niche": "detected niche in English, e.g. 'digital marketing', 'fitness coaching', 'crypto trading', 'real estate', 'personal development'",
    "language": "detected language code: es, en, pt, ru, fr, de, it, etc.",
    "relevanceScore": 1-10
  }
]

RULES:
- adCategory:
  - "infoproduct": online courses, digital products, webinars, masterclasses, ebooks, membership sites
  - "service": coaching, consulting, mentoring, agency services, done-for-you services
  - "agency": marketing/advertising agencies promoting their own services
  - "ecommerce": physical products, dropshipping, Amazon FBA products
  - "betting": gambling, sports betting, casino
  - "entertainment": movies, series, games, streaming, apps
  - "other": anything that doesn't fit above
- relevanceScore: how useful this ad is for someone studying infoproducer/mentor advertising strategies
  - 8-10: Clearly an infoproducer, coach, or mentor ad with strong copy worth studying
  - 5-7: Related to online education/services but not a strong example
  - 1-4: Irrelevant to the infoproducer niche
- niche: be specific. "digital marketing" not just "marketing". "fitness coaching" not just "fitness"
- language: the primary language of the ad copy (ISO 639-1 code)`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results: any[]
  try {
    results = JSON.parse(jsonStr)
  } catch {
    console.error('[ResearchClassifier] Failed to parse response:', jsonStr.slice(0, 200))
    // Return all as "other" with low relevance so they get filtered out
    return ads.map((ad) => ({
      metaAdId: ad.metaAdId,
      adCategory: 'other',
      niche: 'unknown',
      language: 'unknown',
      relevanceScore: 1,
    }))
  }

  return results.map((r) => {
    const idx = (r.index ?? 1) - 1
    const ad = ads[idx] ?? ads[0]
    return {
      metaAdId: ad.metaAdId,
      adCategory: r.adCategory || 'other',
      niche: r.niche || 'unknown',
      language: r.language || 'unknown',
      relevanceScore: Math.min(10, Math.max(1, parseInt(r.relevanceScore) || 1)),
    }
  })
}

/**
 * Heuristic pre-filter to eliminate obviously irrelevant ads before AI classification.
 * Returns true if the ad MIGHT be relevant (should go to AI classification).
 */
export function heuristicFilter(ad: {
  copyText: string
  headline: string | null
  landingUrl: string | null
}): boolean {
  const text = `${ad.copyText} ${ad.headline || ''} ${ad.landingUrl || ''}`.toLowerCase()

  // Negative keywords — definitely not infoproductor
  const NEGATIVE = [
    'bet365', 'casino', 'apuestas', 'apostas', 'poker', 'slot',
    'netflix', 'prime video', 'disney+', 'hbo',
    'aliexpress', 'shein', 'temu', 'wish.com', 'shopee',
    'dropshipping product', 'free shipping worldwide',
    'manga', 'anime', 'k-drama',
    'weight loss pill', 'diet pill', 'crypto mining',
    'sports betting', 'ставки на спорт', 'paris sportif',
  ]

  for (const neg of NEGATIVE) {
    if (text.includes(neg)) return false
  }

  // Positive keywords — likely infoproductor/mentor
  const POSITIVE = [
    // Spanish
    'curso', 'mentoría', 'formación', 'webinar', 'masterclass',
    'coaching', 'programa', 'método', 'academia', 'embudo',
    'lanzamiento', 'infoproducto', 'consultoría',
    // English
    'course', 'coaching', 'mentoring', 'training', 'webinar',
    'masterclass', 'program', 'academy', 'funnel', 'launch',
    'certification', 'workshop',
    // Portuguese
    'curso', 'mentoria', 'treinamento', 'infoproduto', 'lançamento',
    'formação', 'coaching', 'masterclass', 'método',
    // Russian
    'курс', 'наставничество', 'обучение', 'вебинар', 'коучинг',
    'мастер-класс', 'программа', 'тренинг',
    // French
    'formation', 'coaching', 'mentorat', 'masterclass',
    'webinaire', 'accompagnement', 'programme',
  ]

  let score = 0
  for (const pos of POSITIVE) {
    if (text.includes(pos)) score++
  }

  // Need at least 1 positive keyword hit
  return score >= 1
}
