'use client'

import { useEffect, useState } from 'react'
import AdCard from '@/components/ads/AdCard'
import EmptyState from '@/components/shared/EmptyState'
import QuickAddModal from '@/components/shared/QuickAddModal'
import type { Ad } from '@/types/competitor'

interface AdsResponse {
  ads: Array<Ad & { competitor?: { id: string; name: string } }>
  total: number
  pages: number
}

interface CompetitorOption {
  id: string
  name: string
}

type StatusFilter = '' | 'winner' | 'posible_winner'
type SortOption = '' | 'daysActive' | 'newest' | 'oldest'

export default function AdsPage() {
  const [data, setData] = useState<AdsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [competitors, setCompetitors] = useState<CompetitorOption[]>([])
  const [competitorId, setCompetitorId] = useState('')
  const [adStatus, setAdStatus] = useState<StatusFilter>('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('')
  const [minDays, setMinDays] = useState('')
  const [maxDays, setMaxDays] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)

  // Load competitor list for filter dropdown
  useEffect(() => {
    fetch('/api/competitors')
      .then((r) => r.json())
      .then((list: CompetitorOption[]) => setCompetitors(list))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '24' })
    if (adStatus) params.set('adStatus', adStatus)
    if (isActiveFilter === 'true' || isActiveFilter === 'false') params.set('isActive', isActiveFilter)
    if (competitorId) params.set('competitorId', competitorId)
    if (sortBy) params.set('sortBy', sortBy)
    if (minDays) params.set('minDays', minDays)
    if (maxDays) params.set('maxDays', maxDays)

    fetch(`/api/ads?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [adStatus, isActiveFilter, page, competitorId, sortBy, minDays, maxDays])

  const hasActiveFilters = competitorId !== '' || adStatus !== '' || isActiveFilter !== '' || sortBy !== '' || minDays !== '' || maxDays !== ''

  const clearFilters = () => {
    setCompetitorId('')
    setAdStatus('')
    setIsActiveFilter('')
    setSortBy('')
    setMinDays('')
    setMaxDays('')
    setPage(1)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Todos los Anuncios</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">{data.total} anuncios encontrados</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Competitor selector */}
        <div className="relative">
          <select
            value={competitorId}
            onChange={(e) => { setCompetitorId(e.target.value); setPage(1) }}
            className="h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none cursor-pointer"
          >
            <option value="">Todos los competidores</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Winner filter */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([
            { label: 'Todos', value: '' as StatusFilter },
            { label: 'Winners', value: 'winner' as StatusFilter },
            { label: 'Posibles', value: 'posible_winner' as StatusFilter },
          ]).map(({ label, value }) => (
            <button
              key={value}
              onClick={() => { setAdStatus(value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                adStatus === value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active / Inactive filter */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([
            { label: 'Todos', value: '' },
            { label: 'Activos', value: 'true' },
            { label: 'Inactivos', value: 'false' },
          ]).map(({ label, value }) => (
            <button
              key={`active-${value}`}
              onClick={() => { setIsActiveFilter(value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActiveFilter === value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortOption); setPage(1) }}
            className="h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none cursor-pointer"
          >
            <option value="">Más recientes</option>
            <option value="daysActive">Más días activo</option>
            <option value="newest">Detección más reciente</option>
            <option value="oldest">Más antiguos</option>
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Days range filter */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="Min días"
            value={minDays}
            onChange={(e) => { setMinDays(e.target.value); setPage(1) }}
            className="w-20 h-9 px-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <span className="text-xs text-slate-400">-</span>
          <input
            type="number"
            placeholder="Max días"
            value={maxDays}
            onChange={(e) => { setMaxDays(e.target.value); setPage(1) }}
            className="w-20 h-9 px-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="h-9 px-3 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-xl transition-colors"
          >
            Limpiar x
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.ads.length === 0 ? (
        <EmptyState
          title="Sin anuncios"
          description="Añade competidores y lanza un scrape para ver sus anuncios aquí."
          action={
            <button
              onClick={() => setShowModal(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              + Añadir competidor
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} showCompetitor={!competitorId} />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50"
              >
                ← Anterior
              </button>
              <span className="px-4 py-2 text-sm text-slate-500">
                Página {page} de {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {showModal && <QuickAddModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
