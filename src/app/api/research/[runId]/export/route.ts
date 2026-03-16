import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HTMLtoDOCX = require('html-to-docx')

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const market = req.nextUrl.searchParams.get('market') || 'global'

    const report = await db.researchReport.findUnique({
      where: { runId_market: { runId, market } },
    })

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    const run = await db.researchRun.findUnique({ where: { id: runId } })
    const weekLabel = run?.weekLabel || 'unknown'

    const marketNames: Record<string, string> = {
      Brazilian: 'Mercado Brasileño',
      US: 'Mercado Estadounidense',
      Hispanic: 'Mercado Hispano',
      Russian: 'Mercado Ruso',
      French: 'Mercado Francés',
      global: 'Visión Global',
    }

    const title = `Investigación Semanal — ${marketNames[market] || market} — ${weekLabel}`

    // Wrap report HTML in a proper document structure
    const fullHtml = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.6; color: #333; margin: 40px; }
            h1 { font-size: 22pt; color: #1a1a2e; border-bottom: 3px solid #6366f1; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 16pt; color: #1a1a2e; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            h3 { font-size: 13pt; color: #334155; margin-top: 20px; margin-bottom: 10px; }
            p { margin-bottom: 12px; }
            blockquote { border-left: 4px solid #6366f1; padding: 10px 20px; margin: 15px 0; background: #f8fafc; font-style: italic; color: #475569; }
            ul, ol { margin-bottom: 12px; padding-left: 25px; }
            li { margin-bottom: 6px; }
            strong { color: #1e293b; }
            a { color: #6366f1; text-decoration: underline; }
            table { border-collapse: collapse; width: 100%; margin: 15px 0; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
            th { background: #f1f5f9; font-weight: bold; }
            .header-meta { color: #64748b; font-size: 10pt; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="header-meta">
            Generado automáticamente por Competitor Intelligence<br>
            Fecha: ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          ${report.reportHtml}
          <hr>
          <p style="color: #94a3b8; font-size: 9pt; margin-top: 30px;">
            Este informe ha sido generado por IA (Claude) a partir del análisis de anuncios recopilados de Meta Ad Library.
            Los datos son orientativos y deben validarse con métricas reales de campaña.
          </p>
        </body>
      </html>
    `

    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      title,
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    })

    const fileName = `investigacion-${weekLabel}-${market.toLowerCase()}.docx`

    return new NextResponse(new Uint8Array(docxBuffer as Buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Research Export]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
