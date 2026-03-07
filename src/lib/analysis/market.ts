import Anthropic from '@anthropic-ai/sdk'

export interface ReviewInput {
  text: string
  rating?: number | null
  platform?: string
}

export interface MarketAnalysisResult {
  objections: Array<{ text: string; count: number }>
  benefits: Array<{ text: string; count: number }>
  fears: Array<{ text: string; count: number }>
  desires: Array<{ text: string; count: number }>
  phrases: string[]
  awarenessLevel: {
    unaware: number
    problemAware: number
    solutionAware: number
    productAware: number
    mostAware: number
  }
  summary: string
}

export async function analyzeReviews(
  reviews: ReviewInput[],
  context: { competitorName?: string; keywords?: string }
): Promise<MarketAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  const reviewsText = reviews
    .map((r, i) => {
      const parts = [`[${i + 1}]`]
      if (r.platform) parts.push(`(${r.platform})`)
      if (r.rating) parts.push(`★${r.rating}`)
      parts.push(r.text)
      return parts.join(' ')
    })
    .join('\n\n')

  const contextLabel = context.competitorName
    ? `del competidor "${context.competitorName}"`
    : `del nicho "${context.keywords}"`

  const prompt = `Eres un experto en copywriting y análisis de mercado. Analiza las siguientes ${reviews.length} reseñas/comentarios de productos ${contextLabel} extraídas de plataformas como Udemy, Hotmart, TrustPilot y Amazon.

Tu objetivo es extraer el LENGUAJE EXACTO DEL MERCADO — las palabras, frases y emociones que los clientes reales usan. Esto se usará para crear copy de ventas que resuene profundamente.

RESEÑAS:
${reviewsText}

Responde EXCLUSIVAMENTE con un JSON válido (sin markdown, sin backticks, sin explicación) con esta estructura:

{
  "objections": [{"text": "objeción exacta o parafraseada", "count": número_de_veces_mencionada}],
  "benefits": [{"text": "beneficio valorado", "count": número_de_veces_mencionado}],
  "fears": [{"text": "miedo o frustración expresada", "count": número_de_veces_mencionado}],
  "desires": [{"text": "deseo o aspiración expresada", "count": número_de_veces_mencionado}],
  "phrases": ["frase exacta del mercado 1", "frase exacta 2", ...],
  "awarenessLevel": {
    "unaware": porcentaje_estimado,
    "problemAware": porcentaje_estimado,
    "solutionAware": porcentaje_estimado,
    "productAware": porcentaje_estimado,
    "mostAware": porcentaje_estimado
  },
  "summary": "Resumen ejecutivo de 2-3 párrafos sobre el estado del mercado, qué valoran los clientes, qué les frusta, y cómo hablan de sus problemas y deseos."
}

INSTRUCCIONES:
- Ordena objections, benefits, fears y desires de mayor a menor frecuencia (count)
- En "phrases" incluye 10-20 frases EXACTAS del mercado — expresiones textuales que los clientes usan y que servirían para copy de ventas
- Los porcentajes de awarenessLevel deben sumar 100 (basado en los niveles de conciencia de Eugene Schwartz)
  - unaware: No saben que tienen un problema
  - problemAware: Saben que tienen un problema pero no la solución
  - solutionAware: Saben que existe una solución pero no conocen el producto
  - productAware: Conocen el producto pero no están convencidos
  - mostAware: Conocen el producto y solo necesitan la oferta correcta
- En el summary, escribe en español e incluye insights accionables para crear copy de ventas
- Si no hay suficientes datos para alguna categoría, devuelve un array vacío []`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  // Parse JSON response — handle potential markdown wrapping
  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const result = JSON.parse(jsonStr) as MarketAnalysisResult

  // Ensure all fields exist with defaults
  return {
    objections: result.objections || [],
    benefits: result.benefits || [],
    fears: result.fears || [],
    desires: result.desires || [],
    phrases: result.phrases || [],
    awarenessLevel: result.awarenessLevel || {
      unaware: 20,
      problemAware: 30,
      solutionAware: 25,
      productAware: 15,
      mostAware: 10,
    },
    summary: result.summary || '',
  }
}
