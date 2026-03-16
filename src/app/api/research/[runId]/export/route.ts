import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

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
    const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

    // HTML with Word-compatible formatting — .doc extension opens in Google Docs and Word
    const htmlDoc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Competitor Intelligence">
<style>
  @page { size: A4; margin: 2.5cm; }
  body { font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.7; color: #1e293b; }
  h1 { font-size: 24pt; color: #0f172a; border-bottom: 3px solid #6366f1; padding-bottom: 12px; margin-bottom: 8px; }
  .subtitle { color: #64748b; font-size: 10pt; margin-bottom: 30px; }
  h2 { font-size: 16pt; color: #1e293b; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  h3 { font-size: 13pt; color: #334155; margin-top: 24px; margin-bottom: 12px; }
  p { margin-bottom: 12px; text-align: justify; }
  blockquote { border-left: 4px solid #6366f1; padding: 12px 20px; margin: 16px 0; background-color: #f8fafc; font-style: italic; color: #475569; }
  ul, ol { margin-bottom: 12px; padding-left: 28px; }
  li { margin-bottom: 8px; }
  strong { color: #0f172a; }
  em { color: #475569; }
  a { color: #6366f1; text-decoration: underline; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th { background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
  td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
  .footer { color: #94a3b8; font-size: 9pt; margin-top: 40px; text-align: center; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="subtitle">
    Generado por Competitor Intelligence &mdash; ${date}<br>
    Datos: Meta Ad Library &bull; Análisis: Claude AI
  </div>

  ${report.reportHtml}

  <hr>
  <div class="footer">
    <p>Este informe ha sido generado automáticamente por IA a partir de ${run?.totalAdsAnalyzed || 0} anuncios analizados.</p>
    <p>Competitor Intelligence &copy; ${new Date().getFullYear()} &mdash; Semana ${weekLabel}</p>
  </div>
</body>
</html>`

    const fileName = `investigacion-${weekLabel}-${market.toLowerCase()}.doc`
    const buffer = Buffer.from(htmlDoc, 'utf-8')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Research Export]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
