import { NextRequest, NextResponse } from 'next/server'
import { getSettings, saveMetaToken, saveCountries } from '@/lib/db/settings'
import { decrypt } from '@/lib/utils/crypto'

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json({
      hasToken: !!settings?.metaToken,
      tokenExpiry: settings?.tokenExpiry ?? null,
      countries: settings?.countries ?? ['ES', 'MX', 'AR', 'CO', 'US'],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.token !== undefined) {
      const token = String(body.token).trim()
      if (!token) {
        return NextResponse.json({ error: 'Token cannot be empty' }, { status: 400 })
      }
      // Calculate expiry: Meta long-lived tokens last ~60 days
      const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000)
      await saveMetaToken(token, expiresAt)
    }

    if (Array.isArray(body.countries)) {
      await saveCountries(body.countries)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
