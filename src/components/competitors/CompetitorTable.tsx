'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

type LatestJob = {
  status: string
  createdAt: Date | string
} | null

type CompetitorRow = {
  id: string
  name: string
  fbPageName: string | null
  lastScrapedAt: Date | string | null
  activeAdsCount: number
  latestJob: LatestJob
  _count: { ads: number }
}

interface CompetitorTableProps {
  competitors: CompetitorRow[]
  onAddClick?: () => void
}

const JOB_BADGE: Record<string, { label: string; cls: string }> = {
  RUNNING: { label: '● Scraping', cls: 'bg-violet-100 text-violet-700' },
  COMPLETE: { label: '✓ OK', cls: 'bg-emerald-100 text-emerald-700' },
  PARTIAL: { label: '~ Parcial', cls: 'bg-amber-100 text-amber-700' },
  FAILED: { label: '✕ Error', cls: 'bg-red-100 text-red-700' },
  PENDING: { label: '○ En cola', cls: 'bg-slate-100 text-slate-500' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function CompetitorTable({ competitors, onAddClick }: CompetitorTableProps) {
  const router = useRouter()
  const [scrapingIds, setScrapingIds] = useState<Set<string>>(new Set())

  const handleScrape = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setScrapingIds((prev) => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/competitors/${id}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: 'FULL_SCRAPE' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push(`/competitors/${id}?jobId=${json.jobId}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al lanzar scrape')
      setScrapingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (competitors.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">Sin competidores todavía</p>
        <p className="text-xs text-slate-400 mb-4">
          Añade tu primer competidor para empezar a monitorear sus anuncios y funnels.
        </p>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Añadir competidor
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-6 py-3 w-full">
              Competidor
            </th>
            <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
              Total ads
            </th>
            <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
              Activos
            </th>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
              Último scrape
            </th>
            <th className="px-6 py-3 w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {competitors.map((c) => {
            const isRunning = c.latestJob?.status === 'RUNNING' || scrapingIds.has(c.id)
            const badge = c.latestJob ? JOB_BADGE[c.latestJob.status] : null

            return (
              <tr
                key={c.id}
                onClick={() => router.push(`/competitors/${c.id}`)}
                className="hover:bg-violet-50/40 cursor-pointer transition-colors group"
              >
                {/* Name */}
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors truncate">
                        {c.name}
                      </p>
                      {c.fbPageName && (
                        <p className="text-xs text-slate-400 truncate">@{c.fbPageName}</p>
                      )}
                    </div>
                    {badge && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                </td>

                {/* Total ads */}
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-semibold text-slate-700">{c._count.ads}</span>
                </td>

                {/* Active ads */}
                <td className="px-4 py-3.5 text-right">
                  {c.activeAdsCount > 0 ? (
                    <span className="text-sm font-semibold text-emerald-600">●{c.activeAdsCount}</span>
                  ) : (
                    <span className="text-sm text-slate-300">—</span>
                  )}
                </td>

                {/* Last scrape */}
                <td className="px-4 py-3.5">
                  {c.lastScrapedAt ? (
                    <span className="text-sm text-slate-500">
                      {formatDistanceToNow(new Date(c.lastScrapedAt), { addSuffix: true, locale: es })}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-300">—</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    {/* Scrape */}
                    <button
                      onClick={(e) => handleScrape(e, c.id)}
                      disabled={isRunning}
                      title={isRunning ? 'Scraping en curso...' : 'Lanzar scrape'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-100 disabled:opacity-40 transition-colors"
                    >
                      {isRunning ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    {/* View */}
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/competitors/${c.id}`) }}
                      title="Ver perfil"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
