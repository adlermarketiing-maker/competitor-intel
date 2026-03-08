import { NextRequest, NextResponse } from 'next/server'
import { listClients, createClient } from '@/lib/db/clients'

export async function GET() {
  try {
    const clients = await listClients()
    return NextResponse.json(clients)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, niche, description, avatarDesc, websiteUrl, driveFolder, countries, notes } = body as {
      name: string
      niche?: string
      description?: string
      avatarDesc?: string
      websiteUrl?: string
      driveFolder?: string
      countries?: string[]
      notes?: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 })
    }

    const client = await createClient({ name: name.trim(), niche, description, avatarDesc, websiteUrl, driveFolder, countries, notes })
    return NextResponse.json(client, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
