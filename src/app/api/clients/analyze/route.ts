import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Lightweight web page content fetcher.
 * Uses simple fetch + regex extraction instead of Puppeteer,
 * so it works reliably on Railway (no Chrome needed).
 */
async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CompetitorIntelBot/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''
    const html = await res.text()

    // Extract useful text from HTML
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || ''
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || ''
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || ''

    // Extract headings
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .slice(0, 5)

    const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .slice(0, 10)

    // Extract body text (strip tags)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ''
    const bodyText = bodyMatch
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000)

    return [
      title ? `Title: ${title}` : '',
      metaDesc ? `Meta description: ${metaDesc}` : '',
      ogDesc && ogDesc !== metaDesc ? `OG description: ${ogDesc}` : '',
      h1s.length > 0 ? `H1: ${h1s.join(' | ')}` : '',
      h2s.length > 0 ? `H2: ${h2s.join(' | ')}` : '',
      bodyText ? `Content: ${bodyText}` : '',
    ].filter(Boolean).join('\n')
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const { websiteUrl, driveFolder } = (await req.json()) as {
      websiteUrl?: string
      driveFolder?: string
    }

    if (!websiteUrl?.trim() && !driveFolder?.trim()) {
      return NextResponse.json({ error: 'Se necesita al menos una URL (web o Google Drive)' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    // Fetch website content if URL provided
    let webContent = ''
    if (websiteUrl?.trim()) {
      webContent = await fetchPageContent(websiteUrl.trim())
    }

    // Build the prompt with all available context
    const contextParts: string[] = []

    if (websiteUrl?.trim()) {
      contextParts.push(`URL del sitio web: ${websiteUrl.trim()}`)
      if (webContent) {
        contextParts.push(`Contenido extraido del sitio web:\n${webContent}`)
      } else {
        contextParts.push('(No se pudo extraer contenido de la web, pero analiza lo que puedas inferir de la URL)')
      }
    }

    if (driveFolder?.trim()) {
      contextParts.push(`URL de carpeta Google Drive del negocio: ${driveFolder.trim()}`)
      contextParts.push('(La carpeta de Google Drive contiene materiales del negocio. Aunque no puedas acceder directamente, ten en cuenta que este negocio tiene materiales organizados en Drive.)')
    }

    const context = contextParts.join('\n\n')

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analiza la siguiente informacion de un negocio/emprendedor y extrae la informacion clave para crear un perfil de cliente.

${context}

Responde EXCLUSIVAMENTE con JSON valido (sin markdown, sin backticks):
{
  "niche": "El nicho o industria del negocio (max 50 caracteres, ej: 'Marketing Digital', 'Coaching de Vida', 'Fitness Online')",
  "description": "Descripcion breve del negocio: que hace, que vende, su propuesta de valor (2-3 frases en espanol)",
  "avatarDesc": "Descripcion del cliente ideal: a quien se dirige, que problemas resuelve, demografia si se puede inferir (2-3 frases en espanol)"
}

Si no puedes inferir algun campo, pon null. Responde siempre en espanol.`,
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
    console.error('[Clients Analyze] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
