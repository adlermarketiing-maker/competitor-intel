import { NextRequest, NextResponse } from 'next/server'
import { getOpportunities, dismissOpportunity, saveOpportunity } from '@/lib/db/trends'
import { analyzeTrendsVsAds } from '@/lib/analysis/trends'

// GET — return trend opportunities
export async function GET() {
  try {
    const opportunities = await getOpportunities(50)
    return NextResponse.json(opportunities)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST — generate new opportunities via AI cross-analysis, or dismiss one
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, id } = body as { action: 'generate' | 'dismiss'; id?: string }

    if (action === 'dismiss' && id) {
      await dismissOpportunity(id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'generate') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
      }

      const insights = await analyzeTrendsVsAds()

      const saved = []
      for (const insight of insights) {
        const opp = await saveOpportunity({
          type: insight.type,
          title: insight.title,
          description: insight.description,
          source: insight.source,
          urgency: insight.urgency,
          relatedPosts: insight.relatedPostIds,
        })
        saved.push(opp)
      }

      return NextResponse.json({ generated: saved.length, opportunities: saved }, { status: 201 })
    }

    return NextResponse.json({ error: 'action requerida (generate | dismiss)' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
