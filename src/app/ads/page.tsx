'use client'

import { useEffect, useState } from 'react'
import { useClient } from '@/contexts/ClientContext'
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

const HOOK_TYPES = ['pregunta_retorica', 'declaracion_impactante', 'historia_personal', 'estadistica', 'contraintuitivo', 'llamada_directa', 'problema_dolor', 'resultado_transformacion', 'curiosidad_misterio', 'urgencia']
const MARKETING_ANGLES = ['dolor', 'aspiracion', 'urgencia_escasez', 'prueba_social', 'curiosidad', 'comparacion', 'educativo', 'contrario_mito', 'oportunidad', 'fomo']
const CREATIVE_FORMATS = ['imagen_estatica', 'carrusel', 'video_ugc', 'video_talking_head', 'video_broll', 'video_texto_animado', 'meme_humor', 'testimonial']
const AWARENESS_LEVELS = ['inconsciente', 'consciente_problema', 'consciente_solucion', 'consciente_producto', 'mas_consciente']
const PLATFORMS = ['facebook', 'instagram', 'messenger', 'audience_network']

const selectCls = "h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
const chevron = (
  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

function AdCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="h-40 bg-slate-200 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="h-3 bg-slate-200 rounded-full w-8 animate-pulse" />
          <div className="h-3 bg-slate-200 rounded-full w-16 animate-pulse ml-auto" />
        </div>
        <div className="h-4 bg-slate-200 rounded-full w-3/4 animate-pulse" />
        <div className="h-3 bg-slate-100 rounded-full w-full animate-pulse" />
        <div className="h-3 bg-slate-100 rounded-full w-2/3 animate-pulse" />
        <div className="flex gap-1">
          <div className="h-4 bg-slate-100 rounded w-16 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-12 animate-pulse" />
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-50">
          <div className="h-3 bg-slate-100 rounded-full w-24 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded-full w-16 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function AdsPage() {
  const { selectedClientId } = useClient()
  const [data, setData] = useState<AdsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorOption[]>([])
  const [competitorId, setCompetitorId] = useState('')
  const [adStatus, setAdStatus] = useState<StatusFilter>('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [platform, setPlatform] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('daysActive')
  const [minDays, setMinDays] = useState('')
  const [maxDays, setMaxDays] = useState('')
  const [hookType, setHookType] = useState('')
  const [marketingAngle, setMarketingAngle] = useState('')
  const [creativeFormat, setCreativeFormat] = useState('')
  const [awarenessLevel, setAwarenessLevel] = useState('')
  const [minScore, setMinScore] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Load competitor list for filter dropdown
  useEffect(() => {
    const cParam = selectedClientId ? `?clientId=${selectedClientId}` : ''
    fetch(`/api/competitors${cParam}`)
      .then((r) => r.json())
      .then((list: CompetitorOption[]) => setCompetitors(list))
      .catch(() => {})
  }, [selectedClientId])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: '24' })
    if (selectedClientId) params.set('clientId', selectedClientId)
    if (adStatus) params.set('adStatus', adStatus)
    if (isActiveFilter === 'true' || isActiveFilter === 'false') params.set('isActive', isActiveFilter)
    if (competitorId) params.set('competitorId', competitorId)
    if (platform) params.set('platform', platform)
    if (sortBy) params.set('sortBy', sortBy)
    if (minDays) params.set('minDays', minDays)
    if (maxDays) params.set('maxDays', maxDays)
    if (hookType) params.set('hookType', hookType)
    if (marketingAngle) params.set('marketingAngle', marketingAngle)
    if (creativeFormat) params.set('creativeFormat', creativeFormat)
    if (awarenessLevel) params.set('awarenessLevel', awarenessLevel)
    if (minScore) params.set('minScore', minScore)

    fetch(`/api/ads?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [adStatus, isActiveFilter, page, competitorId, platform, sortBy, minDays, maxDays, hookType, marketingAngle, creativeFormat, awarenessLevel, minScore, selectedClientId])

  const activeFilterCount = [
    competitorId, adStatus, isActiveFilter, platform, sortBy !== 'daysActive' ? sortBy : '',
    minDays, maxDays, hookType, marketingAngle, creativeFormat, awarenessLevel, minScore,
  ].filter(Boolean).length

  const clearFilters = () => {
    setCompetitorId('')
    setAdStatus('')
    setIsActiveFilter('')
    setPlatform('')
    setSortBy('daysActive')
    setMinDays('')
    setMaxDays('')
    setHookType('')
    setMarketingAngle('')
    setCreativeFormat('')
    setAwarenessLevel('')
    setMinScore('')
    setPage(1)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Todos los Anuncios</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              {data.total.toLocaleString('es-ES')} anuncios encontrados
              {activeFilterCount > 0 && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">{activeFilterCount} filtros</span>}
            </p>
          )}
        </div>
      </div>

      {/* ── Basic Filters ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Competitor */}
          <div className="relative">
            <select value={competitorId} onChange={(e) => { setCompetitorId(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">Todos los competidores</option>
              {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {chevron}
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {([
              { label: 'Todos', value: '' as StatusFilter },
              { label: '🏆 Winners', value: 'winner' as StatusFilter },
              { label: '🔥 Hot', value: 'posible_winner' as StatusFilter },
            ]).map(({ label, value }) => (
              <button key={value} onClick={() => { setAdStatus(value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${adStatus === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Active / Inactive */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {([
              { label: 'Todos', value: '' },
              { label: 'Activos', value: 'true' },
              { label: 'Inactivos', value: 'false' },
            ]).map(({ label, value }) => (
              <button key={`active-${value}`} onClick={() => { setIsActiveFilter(value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isActiveFilter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortOption); setPage(1) }} className={selectCls}>
              <option value="daysActive">Más días activo</option>
              <option value="">Más recientes</option>
              <option value="newest">Detección más reciente</option>
              <option value="oldest">Más antiguos</option>
            </select>
            {chevron}
          </div>

          {/* Platform */}
          <div className="relative">
            <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">Plataforma</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : p === 'messenger' ? 'Messenger' : 'Audience Network'}</option>)}
            </select>
            {chevron}
          </div>

          {/* Toggle avanzados */}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`h-9 px-3 text-xs font-medium rounded-xl border transition-colors ${showAdvanced ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
            Filtros IA {showAdvanced ? '↑' : '↓'}
          </button>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters}
              className="h-9 px-3 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors ml-auto">
              Limpiar ({activeFilterCount})
            </button>
          )}
        </div>

        {/* ── Advanced AI Filters ── */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Análisis IA</span>

            <div className="relative">
              <select value={hookType} onChange={(e) => { setHookType(e.target.value); setPage(1) }} className={selectCls}>
                <option value="">Hook</option>
                {HOOK_TYPES.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
              {chevron}
            </div>

            <div className="relative">
              <select value={marketingAngle} onChange={(e) => { setMarketingAngle(e.target.value); setPage(1) }} className={selectCls}>
                <option value="">Ángulo</option>
                {MARKETING_ANGLES.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
              {chevron}
            </div>

            <div className="relative">
              <select value={creativeFormat} onChange={(e) => { setCreativeFormat(e.target.value); setPage(1) }} className={selectCls}>
                <option value="">Formato</option>
                {CREATIVE_FORMATS.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
              {chevron}
            </div>

            <div className="relative">
              <select value={awarenessLevel} onChange={(e) => { setAwarenessLevel(e.target.value); setPage(1) }} className={selectCls}>
                <option value="">Awareness</option>
                {AWARENESS_LEVELS.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
              {chevron}
            </div>

            <input type="number" placeholder="Score min" value={minScore}
              onChange={(e) => { setMinScore(e.target.value); setPage(1) }}
              min="1" max="10"
              className="w-24 h-9 px-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />

            <div className="flex items-center gap-1">
              <input type="number" placeholder="Min días" value={minDays}
                onChange={(e) => { setMinDays(e.target.value); setPage(1) }}
                className="w-20 h-9 px-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <span className="text-xs text-slate-400">–</span>
              <input type="number" placeholder="Max días" value={maxDays}
                onChange={(e) => { setMaxDays(e.target.value); setPage(1) }}
                className="w-20 h-9 px-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-700 font-medium mb-1">Error al cargar anuncios</p>
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={() => setPage(p => p)} className="mt-3 text-sm text-red-600 underline">Reintentar</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <AdCardSkeleton key={i} />)}
        </div>
      ) : !data || data.ads.length === 0 ? (
        <EmptyState
          title="Sin anuncios"
          description="Añade competidores y lanza un scrape para ver sus anuncios aquí."
          action={
            <button onClick={() => setShowModal(true)} className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              + Añadir competidor
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.ads.map((ad) => <AdCard key={ad.id} ad={ad} showCompetitor={!competitorId} />)}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 transition-colors">
                ← Anterior
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page + i - 2
                  if (p < 1 || p > data.pages) return null
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-9 h-9 text-sm font-medium rounded-xl transition-colors ${page === p ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {p}
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 transition-colors">
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
