import Anthropic from '@anthropic-ai/sdk'

export interface FunnelHackingResult {
  avatar: string | null
  promesa: string | null
  promesaOferta: string | null
  oferta: string | null
  bonos: string | null
  garantia: string | null
  pruebasAutoridad: string | null
  precio: string | null
  embudoStructure: string | null
}

/**
 * Analyze a competitor's entire funnel using Claude.
 * Takes all scraped landing page content and extracts funnel hacking intel.
 */
export async function analyzeFunnel(input: {
  competitorName: string
  pages: Array<{
    url: string
    title: string | null
    h1Texts: string[]
    h2Texts: string[]
    ctaTexts: string[]
    prices: string[]
    bodyText: string | null
  }>
}): Promise<FunnelHackingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  // Build a condensed summary of all pages (limit to avoid token overflow)
  const pagesSummary = input.pages
    .slice(0, 15) // max 15 pages
    .map((p, i) => {
      const body = (p.bodyText || '').slice(0, 2000)
      return [
        `--- PÁGINA ${i + 1}: ${p.url} ---`,
        p.title && `Título: ${p.title}`,
        p.h1Texts.length > 0 && `H1: ${p.h1Texts.join(' | ')}`,
        p.h2Texts.length > 0 && `H2: ${p.h2Texts.join(' | ')}`,
        p.ctaTexts.length > 0 && `CTAs: ${p.ctaTexts.join(' | ')}`,
        p.prices.length > 0 && `Precios: ${p.prices.join(' | ')}`,
        body && `Contenido:\n${body}`,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const prompt = `Eres un experto en funnel hacking y análisis de competencia digital. Analiza las siguientes páginas del funnel del competidor "${input.competitorName}" y extrae la información de marketing.

${pagesSummary}

Responde SOLO con JSON válido (sin markdown, sin backticks):

{
  "avatar": "Describe el avatar/cliente ideal al que se dirige: quién es, qué problema tiene, cómo lo identifica el competidor, qué gancho usa para atraerlo. Si hay múltiples avatares, describe los principales.",
  "promesa": "¿Qué promete para atraer a las personas a su embudo? ¿Qué promete el lead magnet, webinar gratuito o evento? Es la promesa de ENTRADA, no la de venta.",
  "promesaOferta": "¿Qué promete la oferta principal? ¿Qué resultado consigue el cliente? ¿Qué problemas soluciona? Es la promesa de la OFERTA DE PAGO.",
  "oferta": "Nombre de la oferta, stack de valor (qué incluye), entregables principales. Si hay escalera de valor (varios productos), describe cada nivel.",
  "bonos": "¿Qué bonos ofrece? ¿Por qué los da? Describe cada bono detectado.",
  "garantia": "¿Qué garantía ofrece? (devolución, satisfacción, resultados, etc.)",
  "pruebasAutoridad": "¿Qué usa para generar autoridad y confianza? Testimonios, casos de éxito, premios, apariciones en medios, certificaciones, números de alumnos/clientes.",
  "precio": "¿Qué precios se mencionan? Rango de precios de la oferta principal y otros productos si se detectan. Incluye planes de pago si existen.",
  "embudoStructure": "Describe la estructura del embudo detectada paso a paso. Ejemplo: 'Anuncio → Opt-in (lead magnet PDF) → Página de gracias con vídeo → Secuencia email → VSL → Checkout con order bump → Upsell'"
}

REGLAS:
- Extrae SOLO lo que está presente en las páginas. No inventes.
- Si un campo no tiene información suficiente, pon null.
- Para "avatar", infiere del lenguaje, pain points y beneficios mencionados.
- Para "embudoStructure", analiza las URLs y tipos de página para reconstruir el flujo.
- Sé específico y detallado. Cita textos exactos cuando sea relevante.
- Escribe en español.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
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
  let result: any
  try {
    result = JSON.parse(jsonStr)
  } catch {
    console.error('[FunnelHacking] Failed to parse Claude response:', jsonStr.slice(0, 300))
    throw new Error('Failed to parse AI response for funnel analysis')
  }

  return {
    avatar: result.avatar || null,
    promesa: result.promesa || null,
    promesaOferta: result.promesaOferta || null,
    oferta: result.oferta || null,
    bonos: result.bonos || null,
    garantia: result.garantia || null,
    pruebasAutoridad: result.pruebasAutoridad || null,
    precio: result.precio || null,
    embudoStructure: result.embudoStructure || null,
  }
}
