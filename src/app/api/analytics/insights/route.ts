import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics } from '@/lib/db/analytics'
import Anthropic from '@anthropic-ai/sdk'

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 400 })
    }

    const competitorId = req.nextUrl.searchParams.get('competitorId') || undefined
    const clientId = req.nextUrl.searchParams.get('clientId') || undefined
    const data = await getAnalytics(competitorId, clientId)

    if (data.summary.analyzedAds === 0) {
      return NextResponse.json({ insights: 'No hay suficientes anuncios analizados para generar insights.' })
    }

    const client = new Anthropic({ apiKey })

    // Build context for Claude
    const topHooks = data.distributions.hookType.slice(0, 5).map((h) => `${h.value.replace(/_/g, ' ')} (${h.pct}%, ${h.winnerCount} winners)`).join(', ')
    const topFormats = data.distributions.creativeFormat.slice(0, 5).map((f) => `${f.value.replace(/_/g, ' ')} (${f.pct}%, ${f.winnerCount} winners)`).join(', ')
    const topAngles = data.distributions.marketingAngle.slice(0, 5).map((a) => `${a.value.replace(/_/g, ' ')} (${a.pct}%, ${a.winnerCount} winners)`).join(', ')
    const awarenessData = data.distributions.awarenessLevel.map((a) => `${a.value.replace(/_/g, ' ')} (${a.pct}%)`).join(', ')
    const copyData = data.distributions.copyLength.map((c) => `${c.value} (${c.pct}%, ${c.winnerCount} winners)`).join(', ')
    const topCtas = data.topCtas.slice(0, 5).map((c) => `"${c.value}" (${c.count}x, ${c.winnerCount} winners)`).join(', ')

    const offerData = `Descuentos: ${data.offers.withDiscount}, Bonos: ${data.offers.withBonuses}, Garantía: ${data.offers.withGuarantee}, Escasez: ${data.offers.withScarcity}, Precio visible: ${data.offers.withPrice} de ${data.offers.total} anuncios`

    const competitorData = data.competitorComparison.slice(0, 10).map((c) =>
      `${c.name}: ${c.totalAds} anuncios, ${c.winners} winners, score ${c.avgScore ?? 'N/A'}, formato top: ${c.topFormat?.replace(/_/g, ' ') ?? 'N/A'}, hook top: ${c.topHook?.replace(/_/g, ' ') ?? 'N/A'}`
    ).join('\n')

    // Weekly trends summary
    const recentWeeks = data.weeklyTrends.slice(-4)
    const weeklyData = recentWeeks.map((w) => {
      const topFormat = Object.entries(w.formats).sort(([, a], [, b]) => b - a)[0]
      const topHook = Object.entries(w.hookTypes).sort(([, a], [, b]) => b - a)[0]
      return `Semana ${w.weekStart}: ${w.totalAds} ads, ${w.winners} winners, formato top: ${topFormat?.[0]?.replace(/_/g, ' ') ?? 'N/A'}, hook top: ${topHook?.[0]?.replace(/_/g, ' ') ?? 'N/A'}, score medio: ${w.avgScore ?? 'N/A'}`
    }).join('\n')

    const prompt = `Eres un estratega de publicidad digital y copywriting experto. Analiza estos datos de anuncios de la competencia y genera insights accionables.

DATOS AGREGADOS:
- Total anuncios: ${data.summary.totalAds} (${data.summary.analyzedAds} analizados)
- Winners (>10 días activos): ${data.summary.winners}
- Score medio: ${data.summary.avgScore ?? 'N/A'}/10
- Días activos medio: ${data.summary.avgDaysActive ?? 'N/A'}

HOOKS MÁS USADOS: ${topHooks}
FORMATOS: ${topFormats}
ÁNGULOS DE MARKETING: ${topAngles}
NIVELES DE CONCIENCIA: ${awarenessData}
LONGITUD DE COPY: ${copyData}
TOP CTAs: ${topCtas}
OFERTAS: ${offerData}

COMPETIDORES:
${competitorData}

TENDENCIAS SEMANALES (últimas 4 semanas):
${weeklyData}

Genera un análisis en español con este formato exacto. Sé específico con los datos, no generalices:

1. **RESUMEN DEL MERCADO** (2-3 frases sobre el estado general)

2. **FÓRMULA GANADORA** (qué tienen en común los winners: hook + formato + copy + ángulo)

3. **OPORTUNIDADES** (3-4 bullet points concretos):
   - Formatos o ángulos infrautilizados que podrían funcionar
   - Niveles de conciencia no cubiertos
   - Tipos de oferta que faltan

4. **TENDENCIAS** (qué está cambiando semana a semana)

5. **MOVIMIENTOS DE COMPETIDORES** (quién destaca y por qué, lanzamientos recientes)

6. **RECOMENDACIONES** (3-4 acciones concretas para testear)

Responde SOLO con el análisis, sin preámbulos.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    if (!text.trim()) {
      return NextResponse.json({ insights: 'No se pudieron generar insights. Inténtalo de nuevo.' })
    }

    return NextResponse.json({ insights: text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
