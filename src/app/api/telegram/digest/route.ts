import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, isTelegramConfigured } from '@/lib/telegram/client'
import { buildDailyDigest, buildWeeklyDigest, generateDigestInsight } from '@/lib/telegram/digest'

export async function POST(req: NextRequest) {
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({ error: 'Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({})) as { type?: string }
    const type = body.type || 'daily'

    let message: string | null = null

    if (type === 'weekly') {
      message = await buildWeeklyDigest()
    } else {
      message = await buildDailyDigest()

      // Append AI insight if available
      if (message) {
        const insight = await generateDigestInsight()
        if (insight) {
          message += `\n💡 <b>INSIGHT DEL DÍA:</b>\n"${insight}"`
        }
      }
    }

    if (!message) {
      return NextResponse.json({ sent: false, reason: 'No hay novedades relevantes' })
    }

    await sendTelegramMessage(message)
    return NextResponse.json({ sent: true, type, messageLength: message.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
