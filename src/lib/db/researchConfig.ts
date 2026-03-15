import { db } from './client'

const DEFAULT_MARKETS = [
  {
    name: 'Brazilian',
    language: 'pt',
    countries: ['BR'],
    keywords: [
      'curso online', 'mentoria', 'infoproduto', 'lançamento digital',
      'treinamento online', 'coaching de vida', 'masterclass',
      'formação online', 'programa de mentoria', 'escola digital',
      'comunidade online', 'método comprovado',
    ],
  },
  {
    name: 'US',
    language: 'en',
    countries: ['US', 'CA', 'GB', 'AU'],
    keywords: [
      'online course', 'coaching program', 'masterclass', 'free training',
      'free webinar', 'group coaching', 'digital course', 'online academy',
      'business coaching', 'high-ticket offer', 'course creator',
      'certification program',
    ],
  },
  {
    name: 'Hispanic',
    language: 'es',
    countries: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE'],
    keywords: [
      'curso online', 'mentoría grupal', 'programa de coaching',
      'masterclass gratis', 'formación online', 'academia digital',
      'lanzamiento digital', 'embudo de ventas', 'infoproducto',
      'consultoría online', 'comunidad de pago', 'método probado',
    ],
  },
  {
    name: 'Russian',
    language: 'ru',
    countries: ['RU'],
    keywords: [
      'онлайн курс', 'наставничество', 'менторство', 'коучинг',
      'обучение онлайн', 'мастер-класс', 'вебинар', 'инфобизнес',
      'онлайн школа', 'программа обучения', 'консультация',
      'тренинг онлайн',
    ],
  },
  {
    name: 'French',
    language: 'fr',
    countries: ['FR', 'BE', 'CH', 'CA'],
    keywords: [
      'formation en ligne', 'coaching', 'mentorat', 'masterclass',
      'cours en ligne', 'webinaire gratuit', 'accompagnement',
      'infopreneuriat', 'tunnel de vente', 'programme de formation',
      'académie en ligne', 'consulting',
    ],
  },
]

/**
 * Get the research config, creating it with defaults if it doesn't exist.
 */
export async function getResearchConfig() {
  let config = await db.researchConfig.findUnique({
    where: { id: 'singleton' },
    include: { markets: { orderBy: { createdAt: 'asc' } } },
  })

  if (!config) {
    config = await seedResearchDefaults()
  }

  return config
}

/**
 * Seed default config and markets.
 */
export async function seedResearchDefaults() {
  const config = await db.researchConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
    include: { markets: true },
  })

  // Only seed markets if none exist
  if (config.markets.length === 0) {
    for (const m of DEFAULT_MARKETS) {
      await db.researchMarket.create({
        data: {
          configId: 'singleton',
          name: m.name,
          language: m.language,
          countries: m.countries,
          keywords: m.keywords,
        },
      })
    }

    // Re-fetch with markets
    return db.researchConfig.findUniqueOrThrow({
      where: { id: 'singleton' },
      include: { markets: { orderBy: { createdAt: 'asc' } } },
    })
  }

  return config
}

/**
 * Update research config.
 */
export async function updateResearchConfig(data: {
  enabled?: boolean
  schedule?: string
  maxAdsPerMarket?: number
}) {
  return db.researchConfig.update({
    where: { id: 'singleton' },
    data,
    include: { markets: { orderBy: { createdAt: 'asc' } } },
  })
}

/**
 * Get keywords to use this week for a market (rotate 4 from the pool).
 */
export function getWeeklyKeywords(allKeywords: string[], weekNumber: number, count = 4): string[] {
  if (allKeywords.length <= count) return allKeywords
  const offset = (weekNumber % Math.ceil(allKeywords.length / count)) * count
  const selected: string[] = []
  for (let i = 0; i < count; i++) {
    selected.push(allKeywords[(offset + i) % allKeywords.length])
  }
  return selected
}
