import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const analysis = await db.marketAnalysis.findUnique({
      where: { id },
      include: { competitor: { select: { name: true } } },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    const title = analysis.competitor?.name || analysis.searchKeywords || 'Análisis de Mercado'
    const date = new Date(analysis.analyzedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

    const objections = (analysis.objections as Array<{ text: string; count: number }>) || []
    const benefits = (analysis.benefits as Array<{ text: string; count: number }>) || []
    const fears = (analysis.fears as Array<{ text: string; count: number }>) || []
    const desires = (analysis.desires as Array<{ text: string; count: number }>) || []
    const awareness = (analysis.awarenessLevel as Record<string, number>) || {}
    const phrases = analysis.phrases || []

    const lines: string[] = []
    lines.push(`# Lenguaje del Mercado — ${title}`)
    lines.push(``)
    lines.push(`**Fecha:** ${date}`)
    lines.push(`**Reseñas analizadas:** ${analysis.totalReviews}`)
    lines.push(`**Plataformas:** ${analysis.platforms.join(', ')}`)
    lines.push(``)

    if (analysis.summary) {
      lines.push(`## Resumen del Mercado`)
      lines.push(``)
      lines.push(analysis.summary)
      lines.push(``)
    }

    if (objections.length > 0) {
      lines.push(`## Objeciones (rankeadas por frecuencia)`)
      lines.push(``)
      objections.forEach((o, i) => {
        lines.push(`${i + 1}. "${o.text}" — mencionada ${o.count}x`)
      })
      lines.push(``)
    }

    if (benefits.length > 0) {
      lines.push(`## Beneficios Más Valorados`)
      lines.push(``)
      benefits.forEach((b, i) => {
        lines.push(`${i + 1}. "${b.text}" — mencionado ${b.count}x`)
      })
      lines.push(``)
    }

    if (fears.length > 0) {
      lines.push(`## Miedos y Frustraciones`)
      lines.push(``)
      fears.forEach((f, i) => {
        lines.push(`${i + 1}. "${f.text}" — mencionado ${f.count}x`)
      })
      lines.push(``)
    }

    if (desires.length > 0) {
      lines.push(`## Deseos y Aspiraciones`)
      lines.push(``)
      desires.forEach((d, i) => {
        lines.push(`${i + 1}. "${d.text}" — mencionado ${d.count}x`)
      })
      lines.push(``)
    }

    if (phrases.length > 0) {
      lines.push(`## Frases Textuales para Copies`)
      lines.push(``)
      phrases.forEach((p, i) => {
        lines.push(`${i + 1}. "${p}"`)
      })
      lines.push(``)
    }

    if (Object.keys(awareness).length > 0) {
      const labels: Record<string, string> = {
        unaware: 'No consciente',
        problemAware: 'Consciente del problema',
        solutionAware: 'Consciente de la solución',
        productAware: 'Consciente del producto',
        mostAware: 'Totalmente consciente',
      }
      lines.push(`## Niveles de Conciencia (Eugene Schwartz)`)
      lines.push(``)
      for (const [key, label] of Object.entries(labels)) {
        lines.push(`- **${label}:** ${awareness[key] ?? 0}%`)
      }
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(`*Generado por Competitor Intelligence · ${date}*`)

    const markdown = lines.join('\n')

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="lenguaje-mercado-${title.replace(/\s+/g, '-').toLowerCase()}.md"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
