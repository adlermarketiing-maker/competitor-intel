import { NextRequest, NextResponse } from 'next/server'
import { scrapePage } from '@/lib/scraper/puppeteer'
import { closeBrowser } from '@/lib/scraper/puppeteer'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { websiteUrl } = (await req.json()) as { websiteUrl: string }

    if (!websiteUrl?.trim()) {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    // Scrape the website
    const page = await scrapePage(websiteUrl.trim())
    await closeBrowser()

    if (!page.bodyText && page.h1Texts.length === 0) {
      return NextResponse.json({ error: 'No se pudo extraer contenido de la URL' }, { status: 400 })
    }

    // Build content summary
    const content = [
      page.title ? `Title: ${page.title}` : '',
      page.h1Texts.length > 0 ? `H1: ${page.h1Texts.join(' | ')}` : '',
      page.h2Texts.length > 0 ? `H2: ${page.h2Texts.slice(0, 10).join(' | ')}` : '',
      page.ctaTexts.length > 0 ? `CTAs: ${page.ctaTexts.join(', ')}` : '',
      page.bodyText ? `Content: ${page.bodyText.slice(0, 4000)}` : '',
    ].filter(Boolean).join('\n')

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analiza esta página web de un negocio/emprendedor y extrae la información clave.

URL: ${websiteUrl}
${content}

Responde EXCLUSIVAMENTE con JSON válido (sin markdown, sin backticks):
{
  "niche": "El nicho o industria del negocio (máx 50 caracteres, ej: 'Marketing Digital', 'Coaching de Vida', 'Fitness Online')",
  "description": "Descripción breve del negocio: qué hace, qué vende, su propuesta de valor (2-3 frases)",
  "avatarDesc": "Descripción del cliente ideal: a quién se dirige, qué problemas resuelve, demografía si se puede inferir (2-3 frases)"
}

Si no puedes inferir algún campo, pon null.`,
      }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.type === 'text' ? b.text : '')
      .join('')

    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const result = JSON.parse(jsonStr) as {
      niche: string | null
      description: string | null
      avatarDesc: string | null
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
