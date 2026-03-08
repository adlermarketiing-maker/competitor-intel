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
