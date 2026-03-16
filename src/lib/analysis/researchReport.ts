import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!_client) _client = new Anthropic({ apiKey })
  return _client
}

// Models to try in order — best to worst
const REPORT_MODELS = [
  'claude-opus-4-20250514',
  'claude-sonnet-4-6-20250514',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
]

/**
 * Call Claude with automatic model fallback.
 * Tries each model in order until one succeeds.
 */
async function createWithFallback(
  client: Anthropic,
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>
): Promise<Anthropic.Message> {
  let lastError: Error | null = null
  for (const model of REPORT_MODELS) {
    try {
      const response = await client.messages.create({ ...params, model })
      console.log(`[Research] Report generated with model: ${model}`)
      return response
    } catch (err) {
      const status = (err as Record<string, unknown>).status
      if (status === 404) {
        console.log(`[Research] Model ${model} not available (404), trying next...`)
        lastError = err as Error
        continue
      }
      throw err // Non-404 errors are real errors
    }
  }
  throw lastError || new Error('No models available for report generation')
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

  const prompt = `Eres el director de estrategia de una agencia de publicidad digital de alto nivel. Tu equipo de research acaba de completar el análisis semanal de anuncios activos en el ${marketNames[market] || market} (semana ${weekLabel}). Vas a redactar el informe semanal que envías a tus clientes — infoproductores, mentores, coaches y creadores de cursos online.

Este informe es el PRODUCTO PRINCIPAL que tus clientes pagan. Debe ser TAN BUENO que justifique una suscripción mensual. No es un resumen genérico: es inteligencia competitiva de alto valor.

DATOS ESTADÍSTICOS DEL MERCADO:
${statsText}

MUESTRA DE ANUNCIOS ANALIZADOS (top ${topAds.length} por innovación de ${ads.length} totales):
${adsText}

═══════════════════════════════════════════════════
GENERA EL INFORME EN HTML (sin tags html/head/body — solo contenido interior).

SECCIONES OBLIGATORIAS:

<h2>📊 Resumen Ejecutivo — ${marketNames[market] || market}</h2>
Escribe 3-4 párrafos DENSOS (no superficiales) analizando:
- El ESTADO REAL del mercado esta semana: ¿Qué está pasando? ¿Hay saturación de algún formato? ¿Se ve innovación?
- DATOS CONCRETOS: "El ${Math.round(stats.formats[0]?.pct || 0)}% de los anuncios usan ${stats.formats[0]?.name || '?'}, lo que sugiere..."
- OPORTUNIDADES no explotadas que detectas en los datos
- RIESGOS: ¿Qué deberían evitar tus clientes?

<h2>🎬 Análisis de Formatos Creativos</h2>
Para CADA formato del TOP 5 (con porcentaje exacto del total):
- <h3>1. [Formato] — X%</h3>
- ¿POR QUÉ domina? Análisis psicológico de por qué funciona con esta audiencia
- EJEMPLO REAL: cita el copy exacto de un anuncio que usa este formato magistralmente (usa <blockquote>)
- RECOMENDACIÓN PRÁCTICA: cómo debería usarlo un infoproductor de [nicho específico]
- VARIACIÓN RECOMENDADA: propón una variante creativa que nadie está usando

<h2>🎯 Mapa de Ángulos Emocionales</h2>
Análisis profundo de los ángulos de marketing detectados:
- ¿Cuáles están SATURADOS y ya no funcionan? (con datos)
- ¿Cuáles son FRESCOS y tienen poco uso pero alta efectividad?
- Para cada ángulo top, cita el copy exacto que mejor lo ejecuta
- MATRIZ de oportunidad: cruza ángulos poco usados con formatos dominantes = combinaciones ganadoras

<h2>🪝 Disección de Hooks</h2>
Los 5 hooks más efectivos encontrados esta semana:
- Para cada hook, cita el TEXTO EXACTO del anuncio
- Explica la PSICOLOGÍA detrás (qué bias cognitivo activa, por qué funciona)
- Propón 2-3 VARIACIONES del hook adaptadas a nichos diferentes (fitness, finanzas, desarrollo personal)
- Clasifica cada hook por nivel de sofisticación de la audiencia

<h2>⭐ Top 10 Anuncios de la Semana</h2>
Los anuncios más innovadores/efectivos. Para CADA uno:
- <h3>🏆 #N — "[pageName]"</h3>
- <strong>Hook:</strong> "[cita el hook exacto]"
- <strong>Copy preview:</strong> [primeras 200 palabras del copy en blockquote]
- <strong>Formato:</strong> [tipo] | <strong>Ángulo:</strong> [tipo] | <strong>Días activo:</strong> [N]
- <strong>¿Por qué destaca?</strong> [análisis de 2-3 frases sobre qué lo hace especial]
- <strong>Cómo replicar:</strong> [instrucciones paso a paso para crear una versión propia]
- <strong>Link:</strong> <a href="[adSnapshotUrl]" target="_blank">Ver en Meta Ad Library</a>

<h2>🧪 Laboratorio de Ideas — 5 Tests para Esta Semana</h2>
5 ideas ULTRA ESPECÍFICAS que tus clientes pueden testear ESTA SEMANA:
Para cada idea:
- <h3>Test #N: "[nombre descriptivo del test]"</h3>
- <strong>Basado en:</strong> [qué dato/anuncio inspiró esta idea]
- <strong>Formato:</strong> [exacto — "Carrusel de 5 slides" no "carrusel"]
- <strong>Hook propuesto:</strong> "[escribe el hook completo, no una descripción]"
- <strong>Estructura del copy:</strong> [paso a paso — "Slide 1: pregunta retórica sobre X. Slide 2: estadística impactante. Slide 3:..."]
- <strong>CTA:</strong> "[escribe el CTA exacto]"
- <strong>Para qué cliente:</strong> [tipo específico de infoproductor]
- <strong>KPI objetivo:</strong> [qué medir — CTR, hook rate, etc.]

═══════════════════════════════════════════════════
REGLAS CRÍTICAS:
- Escribe en español (España, no Latinoamérica)
- HTML semántico: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <blockquote>, <a>
- Los copies y hooks citados van SIEMPRE en <blockquote>
- Los links a Meta usan: <a href="URL" target="_blank">Ver en Meta Ad Library</a>
- CITA DATOS REALES del análisis. No inventes porcentajes ni copies.
- El informe debe tener entre 3000-5000 palabras. Esto es un informe PREMIUM, no un resumen.
- Cada sección debe tener PROFUNDIDAD — análisis, no descripción.
- NO uses frases vacías tipo "es importante", "cabe destacar", "resulta interesante". Sé DIRECTO.
- Cuando propongas ideas, escribe el COPY EXACTO que usarías, no una descripción de lo que escribirías.`

  const response = await createWithFallback(client, {
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

  const response = await createWithFallback(client, {
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
