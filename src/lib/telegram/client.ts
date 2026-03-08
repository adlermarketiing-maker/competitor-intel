/**
 * Telegram Bot API client using native fetch (no dependencies).
 */

const TELEGRAM_API = 'https://api.telegram.org'

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')
  return token
}

function getChatId(): string {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID not configured')
  return chatId
}

export function isTelegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

/**
 * Send a message via Telegram Bot API.
 * Uses HTML parse mode for easy formatting.
 * Splits messages longer than 4096 chars automatically.
 */
export async function sendTelegramMessage(
  text: string,
  chatId?: string,
): Promise<void> {
  const token = getBotToken()
  const targetChat = chatId || getChatId()

  // Telegram limit is 4096 chars per message
  const chunks = splitMessage(text, 4096)

  for (const chunk of chunks) {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Telegram] Error sending message:', err)
      throw new Error(`Telegram API error: ${res.status} - ${JSON.stringify(err)}`)
    }

    // Small delay between chunks to avoid rate limiting
    if (chunks.length > 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}

/** Split a message into chunks at line boundaries */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    // Find a good split point (line break before maxLen)
    let splitAt = remaining.lastIndexOf('\n', maxLen)
    if (splitAt < maxLen * 0.5) splitAt = maxLen // No good line break, force split

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}

/** Escape HTML special chars for Telegram HTML mode */
export function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
