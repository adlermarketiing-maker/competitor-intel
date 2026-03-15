import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram/client'
import { buildCompetitorReport } from '@/lib/telegram/digest'
import { buildDailyDigest, generateDigestInsight } from '@/lib/telegram/digest'

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
    from?: { first_name?: string }
  }
}

export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json()

    if (!update.message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = String(update.message.chat.id)
    const text = update.message.text.trim()

    // /competencia [nombre] — On-demand competitor analysis
    if (text.startsWith('/competencia')) {
      const name = text.replace('/competencia', '').trim()
      if (!name) {
        await sendTelegramMessage(
          '❓ Uso: <code>/competencia NombreCompetidor</code>\n\nEjemplo: <code>/competencia EmpresaX</code>',
          chatId,
        )
        return NextResponse.json({ ok: true })
      }

      const report = await buildCompetitorReport(name)
      if (report) {
        await sendTelegramMessage(report, chatId)
      } else {
        await sendTelegramMessage(
          `No encontré ningún competidor con el nombre "${name}". Comprueba que está registrado en el sistema.`,
          chatId,
        )
      }
      return NextResponse.json({ ok: true })
    }

    // /digest — Trigger daily digest manually
    if (text === '/digest') {
      let message = await buildDailyDigest()
      if (message) {
        const insight = await generateDigestInsight()
        if (insight) {
          message += `\n💡 <b>INSIGHT DEL DÍA:</b>\n"${insight}"`
        }
        await sendTelegramMessage(message, chatId)
      } else {
        await sendTelegramMessage('Sin novedades en las últimas 24 horas.', chatId)
      }
      return NextResponse.json({ ok: true })
    }

    // /research — Latest weekly research digest
    if (text === '/research') {
      try {
        const { buildResearchTelegramDigest } = await import('@/lib/telegram/researchDigest')
        const { getLatestCompleteRun } = await import('@/lib/db/research')
        const latestRun = await getLatestCompleteRun()
        if (latestRun) {
          const digest = await buildResearchTelegramDigest(latestRun.id)
          if (digest) {
            await sendTelegramMessage(digest, chatId)
          } else {
            await sendTelegramMessage('No hay datos en la última investigación.', chatId)
          }
        } else {
          await sendTelegramMessage('No hay investigaciones completadas todavía. Se ejecuta automáticamente cada domingo.', chatId)
        }
      } catch {
        await sendTelegramMessage('Error obteniendo la investigación semanal.', chatId)
      }
      return NextResponse.json({ ok: true })
    }

    // /help — Show available commands
    if (text === '/help' || text === '/start') {
      await sendTelegramMessage(
        [
          '<b>🤖 Competitor Intel Bot</b>',
          '',
          '<b>Comandos:</b>',
          '/competencia [nombre] — Análisis de un competidor',
          '/digest — Digest diario bajo demanda',
          '/research — Última investigación semanal de ads',
          '/help — Ver este mensaje',
        ].join('\n'),
        chatId,
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err)
    return NextResponse.json({ ok: true }) // Always return 200 to Telegram
  }
}
