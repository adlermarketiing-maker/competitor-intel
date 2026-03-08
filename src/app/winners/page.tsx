'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useClient } from '@/contexts/ClientContext'
import AdCard from '@/components/ads/AdCard'
import type { Ad } from '@/types/competitor'

interface WinnerGroup {
  competitor: { id: string; name: string }
  count: number
  maxDays: number
  ads: Array<{ id: string; daysActive: number; competitorId: string }>
}

type ViewMode = 'ranking' | 'grid'

export default function WinnersPage() {
  const { selectedClientId } = useClient()
  const [groups, setGroups] = useState<WinnerGroup[]>([])
  const [allWinners, setAllWinners] = useState<Array<Ad & { competitor?: { id: string; name: string } }>>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('ranking')

  useEffect(() => {
    setLoading(true)
    const cParam = selectedClientId ? `&clientId=${selectedClientId}` : ''
    if (view === 'ranking') {
      fetch(`/api/ads/winners?groupBy=competitor${cParam}`)
        .then((r) => r.json())
        .then((data) => { setGroups(data); setLoading(false) })
        .catch(() => setLoading(false))
    } else {
      fetch(`/api/ads/winners?limit=100${cParam}`)
        .then((r) => r.json())
        .then((data) => { setAllWinners(data); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }, [view, selectedClientId])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Top Winners</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Anuncios con más de 14 días activos — los que mejor funcionan
          </p>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([
            { label: 'Por competidor', value: 'ranking' as ViewMode },
            { label: 'Todos', value: 'grid' as ViewMode },
          ]).map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                view === value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'ranking' ? (
        groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Sin winners todavía</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Los anuncios que lleven más de 14 días activos se marcarán como winners automáticamente.
              Haz scraping de tus competidores varias veces para empezar a detectarlos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group, i) => (
              <Link
                key={group.competitor.id}
                href={`/competitors/${group.competitor.id}`}
                className="block bg-white rounded-2xl border border-slate-100 hover:shadow-md transition-shadow p-5"
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-200 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 truncate">{group.competitor.name}</p>
                    <p className="text-sm text-slate-500">
                      <span className="text-emerald-600 font-semibold">{group.count} winner{group.count > 1 ? 's' : ''}</span>
                      {' '}&middot; máximo <span className="font-semibold">{group.maxDays} días</span> activo
                    </p>
                  </div>

                  {/* Days bar */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (group.maxDays / Math.max(...groups.map((g) => g.maxDays))) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-emerald-600 w-14 text-right">{group.maxDays}d</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        allWinners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <p className="text-sm text-slate-400">Sin winners todavía</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allWinners.map((ad) => (
              <AdCard key={ad.id} ad={ad} showCompetitor />
            ))}
          </div>
        )
      )}
    </div>
  )
}
