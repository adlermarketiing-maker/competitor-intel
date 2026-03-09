'use client'

import { useEffect, useState, useCallback } from 'react'
import { useClient } from '@/contexts/ClientContext'

/* ── Types ── */
interface DistributionItem {
  value: string
  count: number
  winnerCount: number
  pct: number
}

interface AnalyticsData {
  summary: {
    totalAds: number
    analyzedAds: number
    winners: number
    avgScore: number | null
    avgDaysActive: number | null
  }
  distributions: {
    hookType: DistributionItem[]
    marketingAngle: DistributionItem[]
    creativeFormat: DistributionItem[]
    awarenessLevel: DistributionItem[]
    copyLength: DistributionItem[]
  }
  topCtas: Array<{ value: string; count: number; winnerCount: number }>
  offers: {
    withDiscount: number
    withBonuses: number
    withGuarantee: number
    withScarcity: number
    withPrice: number
    total: number
  }
  competitorComparison: Array<{
    id: string
    name: string
    totalAds: number
    winners: number
    avgScore: number | null
    topHook: string | null
    topAngle: string | null
    topFormat: string | null
  }>
  weeklyTrends: Array<{
    weekStart: string
    totalAds: number
    winners: number
    hookTypes: Record<string, number>
    formats: Record<string, number>
    angles: Record<string, number>
    avgScore: number | null
  }>
}

interface CompetitorOption {
  id: string
  name: string
}

/* ── Bar chart component ── */
function HorizontalBar({ items, color, showWinners = true }: {
  items: DistributionItem[]
  color: string
  showWinners?: boolean
}) {
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.value} className="group">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-medium text-slate-700 capitalize">{item.value.replace(/_/g, ' ')}</span>
            <div className="flex items-center gap-2">
              {showWinners && item.winnerCount > 0 && (
                <span className="text-[10px] font-bold text-amber-600">{item.winnerCount} W</span>
              )}
              <span className="text-xs text-slate-500">{item.count} ({item.pct}%)</span>
            </div>
          </div>
          <div className="h-5 bg-slate-100 rounded-md overflow-hidden relative">
            <div
              className={`h-full rounded-md transition-all duration-500 ${color}`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
            {showWinners && item.winnerCount > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-amber-400/40 rounded-md"
                style={{ width: `${(item.winnerCount / max) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Stat card ── */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── Section wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">{title}</h3>
      {children}
    </div>
  )
}

/* ── Weekly mini chart ── */
function WeeklyChart({ trends }: { trends: AnalyticsData['weeklyTrends'] }) {
  const maxAds = Math.max(...trends.map((w) => w.totalAds), 1)

  return (
    <div className="flex items-end gap-2 h-32">
      {trends.map((week) => {
        const height = (week.totalAds / maxAds) * 100
        const winnerHeight = week.totalAds > 0 ? (week.winners / week.totalAds) * height : 0
        const dateLabel = new Date(week.weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        return (
          <div key={week.weekStart} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col items-center justify-end" style={{ height: '100px' }}>
              <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: `${Math.max(height, 4)}%` }}>
                <div className="absolute inset-0 bg-violet-200" />
                <div className="absolute bottom-0 left-0 right-0 bg-amber-400" style={{ height: `${winnerHeight}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 whitespace-nowrap">{dateLabel}</span>
            <span className="text-[10px] font-semibold text-slate-600">{week.totalAds}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Main page ── */
export default function AnalyticsPage() {
  const { selectedClientId } = useClient()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorOption[]>([])
  const [competitorId, setCompetitorId] = useState('')
  const [insights, setInsights] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  useEffect(() => {
    const cParam = selectedClientId ? `?clientId=${selectedClientId}` : ''
    fetch(`/api/competitors${cParam}`)
      .then((r) => r.json())
      .then((list: CompetitorOption[]) => setCompetitors(list))
      .catch(() => {})
  }, [selectedClientId])

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (selectedClientId) params.set('clientId', selectedClientId)
    if (competitorId) params.set('competitorId', competitorId)
    const qs = params.toString() ? `?${params}` : ''
    fetch(`/api/analytics${qs}`)
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [competitorId, selectedClientId])

  useEffect(() => { loadData() }, [loadData])

  const loadInsights = () => {
    setInsightsLoading(true)
    const params = new URLSearchParams()
    if (selectedClientId) params.set('clientId', selectedClientId)
    if (competitorId) params.set('competitorId', competitorId)
    const qs = params.toString() ? `?${params}` : ''
    fetch(`/api/analytics/insights${qs}`)
      .then((r) => r.json())
      .then((d) => { setInsights(d.insights || d.error); setInsightsLoading(false) })
      .catch(() => { setInsights('Error al generar insights'); setInsightsLoading(false) })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error || 'Error cargando analytics'}
        </div>
      </div>
    )
  }

  const { summary, distributions, topCtas, offers, competitorComparison, weeklyTrends } = data

  // Find winner formula
  const winnerHook = distributions.hookType.reduce((best, cur) => cur.winnerCount > (best?.winnerCount || 0) ? cur : best, distributions.hookType[0])
  const winnerFormat = distributions.creativeFormat.reduce((best, cur) => cur.winnerCount > (best?.winnerCount || 0) ? cur : best, distributions.creativeFormat[0])
  const winnerAngle = distributions.marketingAngle.reduce((best, cur) => cur.winnerCount > (best?.winnerCount || 0) ? cur : best, distributions.marketingAngle[0])
  const winnerLength = distributions.copyLength.reduce((best, cur) => cur.winnerCount > (best?.winnerCount || 0) ? cur : best, distributions.copyLength[0])

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics y Tendencias</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {summary.analyzedAds} de {summary.totalAds} anuncios analizados con IA
          </p>
        </div>

        {/* Competitor selector */}
        <div className="relative">
          <select
            value={competitorId}
            onChange={(e) => { setCompetitorId(e.target.value); setInsights(null) }}
            className="h-10 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none cursor-pointer"
          >
            <option value="">Todos los competidores</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Total anuncios" value={summary.totalAds} />
        <StatCard label="Analizados" value={summary.analyzedAds} sub={summary.totalAds > 0 ? `${Math.round((summary.analyzedAds / summary.totalAds) * 100)}%` : undefined} />
        <StatCard label="Winners" value={summary.winners} sub={summary.totalAds > 0 ? `${Math.round((summary.winners / summary.totalAds) * 100)}% del total` : undefined} />
        <StatCard label="Score medio" value={summary.avgScore ?? 'N/A'} sub="de 10" />
        <StatCard label="Días activo" value={summary.avgDaysActive ?? 'N/A'} sub="media" />
      </div>

      {/* Winner formula highlight */}
      {summary.winners > 0 && winnerHook && winnerFormat && winnerAngle && winnerLength && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <h3 className="text-sm font-bold text-amber-800 mb-2">Formula ganadora de los Winners</h3>
          <div className="flex flex-wrap gap-2">
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg">
              Hook: {winnerHook.value.replace(/_/g, ' ')} ({winnerHook.winnerCount}W)
            </span>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg">
              Formato: {winnerFormat.value.replace(/_/g, ' ')} ({winnerFormat.winnerCount}W)
            </span>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg">
              Angulo: {winnerAngle.value.replace(/_/g, ' ')} ({winnerAngle.winnerCount}W)
            </span>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg">
              Copy: {winnerLength.value} ({winnerLength.winnerCount}W)
            </span>
          </div>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Section title="Tipos de Hook">
          <HorizontalBar items={distributions.hookType} color="bg-blue-400" />
        </Section>

        <Section title="Angulos de Marketing">
          <HorizontalBar items={distributions.marketingAngle} color="bg-purple-400" />
        </Section>

        <Section title="Formatos Creativos">
          <HorizontalBar items={distributions.creativeFormat} color="bg-teal-400" />
        </Section>

        <Section title="Nivel de Conciencia">
          <HorizontalBar items={distributions.awarenessLevel} color="bg-indigo-400" />
        </Section>

        <Section title="Longitud de Copy">
          <HorizontalBar items={distributions.copyLength} color="bg-rose-400" />
        </Section>

        <Section title="Tipo de Oferta">
          <div className="space-y-3">
            {[
              { label: 'Con descuento', count: offers.withDiscount },
              { label: 'Con bonos', count: offers.withBonuses },
              { label: 'Con garantia', count: offers.withGuarantee },
              { label: 'Con escasez', count: offers.withScarcity },
              { label: 'Precio visible', count: offers.withPrice },
            ].map(({ label, count }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-slate-700">{label}</span>
                  <span className="text-xs text-slate-500">{count} ({offers.total > 0 ? Math.round((count / offers.total) * 100) : 0}%)</span>
                </div>
                <div className="h-5 bg-slate-100 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-md transition-all duration-500"
                    style={{ width: `${offers.total > 0 ? (count / offers.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Top CTAs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Section title="Top CTAs">
          <div className="space-y-2">
            {topCtas.length === 0 ? (
              <p className="text-sm text-slate-400">Sin CTAs analizados</p>
            ) : topCtas.map((cta, i) => (
              <div key={cta.value} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                <span className="text-sm text-slate-700 flex-1 truncate">&ldquo;{cta.value}&rdquo;</span>
                <span className="text-xs text-slate-500">{cta.count}x</span>
                {cta.winnerCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{cta.winnerCount}W</span>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Evolucion Semanal">
          {weeklyTrends.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos temporales</p>
          ) : (
            <>
              <WeeklyChart trends={weeklyTrends} />
              <div className="flex items-center gap-4 mt-3 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-violet-200 rounded-sm" />
                  <span className="text-[10px] text-slate-500">Total ads</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-amber-400 rounded-sm" />
                  <span className="text-[10px] text-slate-500">Winners</span>
                </div>
              </div>
            </>
          )}
        </Section>
      </div>

      {/* Competitor comparison */}
      {competitorComparison.length > 0 && (
        <Section title="Comparacion entre Competidores">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase">Competidor</th>
                  <th className="text-center py-2 text-xs font-semibold text-slate-400 uppercase">Ads</th>
                  <th className="text-center py-2 text-xs font-semibold text-slate-400 uppercase">Winners</th>
                  <th className="text-center py-2 text-xs font-semibold text-slate-400 uppercase">Score</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase">Hook Top</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase">Angulo Top</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase">Formato Top</th>
                </tr>
              </thead>
              <tbody>
                {competitorComparison.map((comp) => (
                  <tr key={comp.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 font-medium text-slate-800">{comp.name}</td>
                    <td className="py-2.5 text-center text-slate-600">{comp.totalAds}</td>
                    <td className="py-2.5 text-center">
                      <span className={comp.winners > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>{comp.winners}</span>
                    </td>
                    <td className="py-2.5 text-center text-slate-600">{comp.avgScore ?? '-'}</td>
                    <td className="py-2.5">
                      {comp.topHook ? (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{comp.topHook.replace(/_/g, ' ')}</span>
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="py-2.5">
                      {comp.topAngle ? (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">{comp.topAngle.replace(/_/g, ' ')}</span>
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="py-2.5">
                      {comp.topFormat ? (
                        <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md">{comp.topFormat.replace(/_/g, ' ')}</span>
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* AI Insights */}
      <div className="mt-8">
        <Section title="Insights y Oportunidades (IA)">
          {insights ? (
            <div className="prose prose-sm prose-slate max-w-none">
              {insights.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <h4 key={i} className="text-sm font-bold text-slate-800 mt-4 mb-2">{line.replace(/\*\*/g, '')}</h4>
                }
                if (line.match(/^\d+\.\s\*\*/)) {
                  const clean = line.replace(/\*\*/g, '')
                  return <h4 key={i} className="text-sm font-bold text-slate-800 mt-4 mb-2">{clean}</h4>
                }
                if (line.startsWith('- ')) {
                  return <p key={i} className="text-sm text-slate-600 ml-4 mb-1 before:content-['•'] before:mr-2 before:text-violet-400">{line.slice(2)}</p>
                }
                if (line.trim() === '') return <div key={i} className="h-2" />
                return <p key={i} className="text-sm text-slate-600 mb-1">{line}</p>
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500 mb-3">
                Genera un analisis con IA basado en todos los datos agregados
              </p>
              <button
                onClick={loadInsights}
                disabled={insightsLoading}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                {insightsLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analizando...
                  </span>
                ) : 'Generar Insights con IA'}
              </button>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
