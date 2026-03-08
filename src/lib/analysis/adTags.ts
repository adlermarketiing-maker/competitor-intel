import Anthropic from '@anthropic-ai/sdk'

export interface AdTagsResult {
  hookType: string
  marketingAngle: string
  creativeFormat: string
  awarenessLevel: string
  copyLength: string
  copyStructure: string
  ctaText: string
  ctaUrgency: boolean
  offerPrice: string | null
  offerDiscount: boolean
  offerBonuses: string | null
  offerGuarantee: string | null
  offerScarcity: string | null
  aiScore: number
  aiSummary: string
}

/**
 * Analyze an ad's copy with Claude Haiku to extract marketing tags.
 * Uses Haiku for cost efficiency — sufficient for classification tasks.
 */
export async function analyzeAdTags(input: {
  copyBodies: string[]
  headline?: string | null
  description?: string | null
  caption?: string | null
  ctaType?: string | null
  hasVideo: boolean
  hasImages: boolean
  imageCount: number
}): Promise<AdTagsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  const copyText = input.copyBodies.join('\n\n') || ''
  const fullText = [
    input.headline && `TITULAR: ${input.headline}`,
    copyText && `COPY:\n${copyText}`,
    input.description && `DESCRIPCIÓN: ${input.description}`,
    input.caption && `CAPTION: ${input.caption}`,
    input.ctaType && `CTA BOTÓN: ${input.ctaType}`,
  ].filter(Boolean).join('\n\n')

  const mediaInfo = input.hasVideo
    ? 'El anuncio tiene vídeo.'
    : input.imageCount > 1
      ? `El anuncio tiene ${input.imageCount} imágenes (posible carrusel).`
      : input.hasImages
        ? 'El anuncio tiene 1 imagen estática.'
        : 'El anuncio no tiene media visible.'

  const prompt = `Eres un analista experto en publicidad digital y copywriting. Clasifica este anuncio de Facebook/Instagram.

${fullText}

${mediaInfo}

Responde SOLO con JSON válido (sin markdown, sin backticks):

{
  "hookType": "uno de: pregunta_retorica | declaracion_impactante | historia_personal | estadistica | contraintuitivo | llamada_directa | problema_dolor | resultado_transformacion | curiosidad_misterio | urgencia",
  "marketingAngle": "uno de: dolor | aspiracion | urgencia_escasez | prueba_social | curiosidad | comparacion | educativo | contrario_mito | oportunidad | fomo",
  "creativeFormat": "uno de: imagen_estatica | carrusel | video_ugc | video_talking_head | video_broll | video_texto_animado | meme_humor | testimonial",
  "awarenessLevel": "uno de: inconsciente | consciente_problema | consciente_solucion | consciente_producto | mas_consciente",
  "copyLength": "uno de: corto | medio | largo",
  "copyStructure": "estructura detectada, ej: hook > problema > solucion > cta",
  "ctaText": "el CTA exacto del anuncio o el más probable",
  "ctaUrgency": true/false,
  "offerPrice": "precio mencionado o null",
  "offerDiscount": true/false,
  "offerBonuses": "bonos mencionados o null",
  "offerGuarantee": "garantía mencionada o null",
  "offerScarcity": "escasez mencionada (plazas, fecha límite) o null",
  "aiScore": 1-10,
  "aiSummary": "Resumen de 1-2 frases: qué hace bien este anuncio y qué podría mejorar"
}

REGLAS:
- hookType: clasifica el gancho principal del copy
- marketingAngle: el ángulo emocional predominante
- creativeFormat: basado en la info de media que te doy
- awarenessLevel: nivel de conciencia del público objetivo según Eugene Schwartz
- copyLength: corto (<50 palabras), medio (50-150), largo (>150)
- aiScore: 1-10 basado en claridad del hook, persuasión, CTA fuerte, coherencia
- Si no hay copy suficiente para clasificar, usa los valores más probables basados en el contexto`

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
  let result: any
  try {
    result = JSON.parse(jsonStr)
  } catch {
    console.error('[AdTags] Failed to parse Claude response as JSON:', jsonStr.slice(0, 200))
    throw new Error('Failed to parse AI response for ad analysis')
  }

  return {
    hookType: result.hookType || 'llamada_directa',
    marketingAngle: result.marketingAngle || 'dolor',
    creativeFormat: result.creativeFormat || 'imagen_estatica',
    awarenessLevel: result.awarenessLevel || 'consciente_problema',
    copyLength: result.copyLength || 'medio',
    copyStructure: result.copyStructure || '',
    ctaText: result.ctaText || '',
    ctaUrgency: !!result.ctaUrgency,
    offerPrice: result.offerPrice || null,
    offerDiscount: !!result.offerDiscount,
    offerBonuses: result.offerBonuses || null,
    offerGuarantee: result.offerGuarantee || null,
    offerScarcity: result.offerScarcity || null,
    aiScore: Math.min(10, Math.max(1, parseInt(result.aiScore) || 5)),
    aiSummary: result.aiSummary || '',
  }
}
