import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!_client) _client = new Anthropic({ apiKey })
  return _client
}

interface AdSummary {
  metaAdId: string
  pageName: string | null
  adSnapshotUrl: string | null
  copyPreview: string
  headline: string | null
  hookType: string | null
  marketingAngle: string | null
  creativeFormat: string | null
  awarenessLevel: string | null
  copyStructure: string | null
  aiScore: number | null
  innovationScore: number | null
  daysActive: number
  niche: string | null
  landingUrl: string | null
  aiSummary: string | null
}

interface FormatStat {
  name: string
  count: number
  pct: number
}

export interface ReportResult {
  reportHtml: string
  topFormats: FormatStat[]
  topAngles: FormatStat[]
  topHooks: FormatStat[]
  highlights: Array<{ metaAdId: string; innovationScore: number; reason: string }>
}

/**
 * Build statistics from ads for a given group.
 */
function buildStats(ads: AdSummary[]): {
  formats: FormatStat[]
  angles: FormatStat[]
  hooks: FormatStat[]
} {
  const count = (field: keyof AdSummary) => {
    const map = new Map<string, number>()
    for (const ad of ads) {
      const val = ad[field] as string | null
      if (val) map.set(val, (map.get(val) ?? 0) + 1)
    }
    const total = ads.length || 1
    return [...map.entries()]
      .map(([name, c]) => ({ name, count: c, pct: Math.round((c / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  return {
    formats: count('creativeFormat'),
    angles: count('marketingAngle'),
    hooks: count('hookType'),
  }
}

/**
 * Generate a detailed research report for a specific market using Claude Opus 4.6.
 */
export async function generateMarketReport(
  market: string,
  ads: AdSummary[],
  weekLabel: string,
): Promise<ReportResult> {
  const client = getClient()
  const stats = buildStats(ads)

  // Build the top ads list for the prompt (max 30 ads to fit in context)
  const topAds = ads
    .sort((a, b) => (b.innovationScore ?? 0) - (a.innovationScore ?? 0))
    .slice(0, 30)

  const adsText = topAds.map((ad, i) => {
    const lines = [
      `[${i + 1}] "${ad.pageName || 'Sin nombre'}"`,
      `  Copy: ${ad.copyPreview}`,
      ad.headline && `  Headline: ${ad.headline}`,
      `  Formato: ${ad.creativeFormat || '?'} | Hook: ${ad.hookType || '?'} | Ángulo: ${ad.marketingAngle || '?'}`,
      `  Nivel: ${ad.awarenessLevel || '?'} | Estructura: ${ad.copyStructure || '?'}`,
      `  Nicho: ${ad.niche || '?'} | Días activo: ${ad.daysActive}`,
      `  Score IA: ${ad.aiScore ?? '?'}/10 | Innovation: ${ad.innovationScore ?? '?'}/10`,
      ad.adSnapshotUrl && `  Meta Ad Library: ${ad.adSnapshotUrl}`,
      ad.landingUrl && `  Landing: ${ad.landingUrl}`,
    ].filter(Boolean).join('\n')
    return lines
  }).join('\n\n')

  const statsText = `
FORMATOS: ${stats.formats.map((f) => `${f.name} (${f.pct}%)`).join(', ')}
ÁNGULOS: ${stats.angles.map((a) => `${a.name} (${a.pct}%)`).join(', ')}
HOOKS: ${stats.hooks.map((h) => `${h.name} (${h.pct}%)`).join(', ')}
Total ads analizados: ${ads.length}
Ads con innovation >= 8: ${ads.filter((a) => (a.innovationScore ?? 0) >= 8).length}
Score medio: ${ads.length > 0 ? (ads.reduce((sum, a) => sum + (a.aiScore ?? 0), 0) / ads.length).toFixed(1) : 0}
`

  const marketNames: Record<string, string> = {
    Brazilian: 'Mercado Brasileño',
    US: 'Mercado Estadounidense',
    Hispanic: 'Mercado Hispano',
    Russian: 'Mercado Ruso',
    French: 'Mercado Francés',
    global: 'Todos los Mercados',
  }

  const prompt = `Eres un estratega de publicidad digital de élite. Tu cliente es una agencia de marketing que gestiona campañas para infoproductores, mentores y coaches. Acaban de completar su investigación semanal de anuncios en el ${marketNames[market] || market} (semana ${weekLabel}).

DATOS ESTADÍSTICOS:
${statsText}

ANUNCIOS ANALIZADOS (ordenados por innovación):
${adsText}

Genera un INFORME PROFESIONAL en HTML (sin etiquetas <html>, <head>, <body> — solo el contenido interior). El informe debe ser ELABORADO, PROFUNDO y ACCIONABLE. No es un resumen superficial: es un análisis estratégico que un director de marketing usará para tomar decisiones.

ESTRUCTURA DEL INFORME:

<h2>📊 Resumen Ejecutivo</h2>
2-3 párrafos densos analizando el estado actual del mercado esta semana. Tendencias dominantes, cambios observados, oportunidades detectadas.

<h2>🎬 Formatos Dominantes</h2>
Ranking de los formatos más usados con porcentaje. Para cada formato TOP 3:
- Por qué funciona en este mercado
- Ejemplo concreto de un ad que lo usa bien (citar el copy)
- Cómo adaptarlo para otros nichos

<h2>🎯 Ángulos de Marketing</h2>
Análisis de los ángulos emocionales predominantes. ¿Cuáles se están saturando? ¿Cuáles son frescos?
Incluye ejemplos textuales del copy.

<h2>🪝 Hooks Más Efectivos</h2>
Los ganchos que mejor funcionan esta semana. Cita los hooks exactos de los mejores ads.
Explica la psicología detrás de cada uno.

<h2>⭐ Ads Destacados</h2>
Los 5-10 ads con mayor potencial de innovación. Para cada uno:
- Quién lo publica (pageName)
- Qué hace especial a este ad
- El copy o hook exacto
- Por qué es innovador
- Cómo adaptarlo para clientes de la agencia
- Link a Meta Ad Library si disponible

<h2>💡 Ideas Accionables</h2>
3-5 ideas CONCRETAS y ESPECÍFICAS que la agencia puede implementar esta semana con sus clientes.
No genéricas tipo "usa vídeo". Específicas tipo "Testea un hook de pregunta retórica en formato carrusel educativo de 5 slides para clientes de coaching, usando la estructura: pregunta impactante → 3 errores comunes → solución → CTA con urgencia".

REGLAS:
- Escribe en español
- Usa HTML semántico: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <blockquote>
- Los copies citados van en <blockquote>
- Los links a Meta Ad Library usan: <a href="URL" target="_blank">Ver en Meta</a>
- Sé específico y cita datos del análisis. No inventes.
- El informe debe tener entre 1500-3000 palabras
- Incluye emojis para los headers de sección`

  const response = await client.messages.create({
    model: 'claude-opus-4-6-20250610',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const reportHtml = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  // Extract highlights (ads with innovationScore >= 8)
  const highlights = ads
    .filter((a) => (a.innovationScore ?? 0) >= 8)
    .sort((a, b) => (b.innovationScore ?? 0) - (a.innovationScore ?? 0))
    .slice(0, 10)
    .map((a) => ({
      metaAdId: a.metaAdId,
      innovationScore: a.innovationScore ?? 8,
      reason: a.aiSummary || 'Ad destacado por innovación',
    }))

  return {
    reportHtml,
    topFormats: stats.formats,
    topAngles: stats.angles,
    topHooks: stats.hooks,
    highlights,
  }
}

/**
 * Generate a global cross-market report using Claude Opus 4.6.
 */
export async function generateGlobalReport(
  marketSummaries: Array<{
    market: string
    adCount: number
    topFormats: FormatStat[]
    topAngles: FormatStat[]
    topHooks: FormatStat[]
    avgScore: number
    highlightCount: number
  }>,
  weekLabel: string,
): Promise<string> {
  const client = getClient()

  const summaryText = marketSummaries.map((m) => `
${m.market}:
  Ads analizados: ${m.adCount}
  Formatos: ${m.topFormats.slice(0, 3).map((f) => `${f.name} (${f.pct}%)`).join(', ')}
  Ángulos: ${m.topAngles.slice(0, 3).map((a) => `${a.name} (${a.pct}%)`).join(', ')}
  Hooks: ${m.topHooks.slice(0, 3).map((h) => `${h.name} (${h.pct}%)`).join(', ')}
  Score medio: ${m.avgScore.toFixed(1)}
  Ads destacados: ${m.highlightCount}
`).join('\n')

  const prompt = `Eres un estratega de publicidad digital de élite. Analiza los resultados de la investigación semanal de anuncios (semana ${weekLabel}) comparando 5 mercados internacionales.

RESUMEN POR MERCADO:
${summaryText}

Genera un INFORME GLOBAL COMPARATIVO en HTML (sin etiquetas html/head/body). Máximo 1500 palabras.

ESTRUCTURA:
<h2>🌍 Visión Global — Semana ${weekLabel}</h2>
Resumen ejecutivo comparando los 5 mercados.

<h2>📊 Comparativa de Formatos</h2>
¿Qué formatos dominan en cada mercado? ¿Hay convergencia o divergencia?

<h2>🔄 Tendencias Cruzadas</h2>
¿Qué tendencias de un mercado podrían funcionar en otro? Oportunidades de cross-pollination.

<h2>💡 Top 5 Ideas para Esta Semana</h2>
Las 5 ideas más potentes extraídas de TODOS los mercados. Cada idea con:
- De qué mercado viene
- Cómo implementarla
- Para qué tipo de cliente de la agencia

REGLAS:
- Escribe en español
- HTML semántico
- Sé específico y basado en los datos
- Incluye emojis en headers`

  const response = await client.messages.create({
    model: 'claude-opus-4-6-20250610',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
