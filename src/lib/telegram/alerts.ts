import { sendTelegramMessage, isTelegramConfigured, escHtml } from './client'

/**
 * Alert: competitor launched many ads at once (5+).
 */
export async function alertLaunchDetected(
  competitorName: string,
  newAdsCount: number,
): Promise<void> {
  if (!isTelegramConfigured()) return

  const msg = [
    `⚠️ <b>LANZAMIENTO DETECTADO</b>`,
    ``,
    `<b>${escHtml(competitorName)}</b> lanzó <b>${newAdsCount}</b> anuncios nuevos.`,
    `Posible nuevo lanzamiento o campaña agresiva.`,
  ].join('\n')

  try {
    await sendTelegramMessage(msg)
  } catch (err) {
    console.error('[Telegram] Error sending launch alert:', err)
  }
}

/**
 * Alert: a long-running winner ad was retired.
 */
export async function alertWinnerRetired(
  competitorName: string,
  metaAdId: string,
  daysActive: number,
  headline?: string | null,
): Promise<void> {
  if (!isTelegramConfigured()) return

  const preview = headline ? `"${escHtml(headline.slice(0, 60))}"` : `ID ${escHtml(metaAdId)}`

  const msg = [
    `🔴 <b>WINNER RETIRADO</b>`,
    ``,
    `<b>${escHtml(competitorName)}</b> quitó su anuncio winner:`,
    `${preview}`,
    `Estuvo activo <b>${daysActive} días</b>.`,
  ].join('\n')

  try {
    await sendTelegramMessage(msg)
  } catch (err) {
    console.error('[Telegram] Error sending winner retired alert:', err)
  }
}

/**
 * Alert: significant changes detected in market language analysis.
 */
export async function alertMarketLanguageChanges(
  changes: import('@/lib/db/market').MarketChanges,
): Promise<void> {
  if (!isTelegramConfigured()) return

  const lines: string[] = []
  lines.push(`🔄 <b>CAMBIO EN LENGUAJE DEL MERCADO</b>`)
  lines.push(`📌 ${escHtml(changes.label)}`)
  lines.push('')

  if (changes.newObjections.length > 0) {
    lines.push(`<b>🆕 Nuevas objeciones emergentes:</b>`)
    for (const o of changes.newObjections.slice(0, 5)) {
      lines.push(`  → "${escHtml(o.text)}" (${o.count}x)`)
    }
    lines.push('')
  }

  if (changes.newFears.length > 0) {
    lines.push(`<b>😰 Nuevos miedos detectados:</b>`)
    for (const f of changes.newFears.slice(0, 5)) {
      lines.push(`  → "${escHtml(f.text)}" (${f.count}x)`)
    }
    lines.push('')
  }

  if (changes.newDesires.length > 0) {
    lines.push(`<b>✨ Nuevos deseos:</b>`)
    for (const d of changes.newDesires.slice(0, 5)) {
      lines.push(`  → "${escHtml(d.text)}" (${d.count}x)`)
    }
    lines.push('')
  }

  if (changes.newBenefits.length > 0) {
    lines.push(`<b>✅ Nuevos beneficios valorados:</b>`)
    for (const b of changes.newBenefits.slice(0, 5)) {
      lines.push(`  → "${escHtml(b.text)}" (${b.count}x)`)
    }
    lines.push('')
  }

  if (changes.newPhrases.length > 0) {
    lines.push(`<b>💬 Nuevas frases del mercado:</b>`)
    for (const p of changes.newPhrases.slice(0, 5)) {
      lines.push(`  → "${escHtml(p)}"`)
    }
    lines.push('')
  }

  if (changes.awarenessShift.length > 0) {
    lines.push(`<b>📊 Cambio en niveles de awareness:</b>`)
    for (const s of changes.awarenessShift) {
      const arrow = s.newPct > s.oldPct ? '↑' : '↓'
      lines.push(`  ${escHtml(s.level)}: ${s.oldPct}% → ${s.newPct}% ${arrow}`)
    }
    lines.push('')
  }

  if (changes.removedObjections.length > 0) {
    lines.push(`<i>Se resolvieron ${changes.removedObjections.length} objeciones anteriores</i>`)
  }

  try {
    await sendTelegramMessage(lines.join('\n'))
  } catch (err) {
    console.error('[Telegram] Error sending market language alert:', err)
  }
}
