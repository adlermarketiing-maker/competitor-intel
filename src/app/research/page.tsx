'use client'

import { useState, useEffect, useCallback } from 'react'
import ResearchAdCard from '@/components/research/ResearchAdCard'
import type { ResearchAdItem } from '@/types/research'

interface RunSummary {
  id: string
  weekLabel: string
  status: string
  totalAdsFound: number
  totalAdsKept: number
  totalAdsAnalyzed: number
  startedAt: string | null
  completedAt: string | null
  _count: { ads: number; reports: number }
}

interface Report {
  id: string
  market: string
  reportHtml: string
}

const MARKETS = ['Todos', 'Brazilian', 'US', 'Hispanic', 'Russian', 'French']
const MARKET_FLAGS: Record<string, string> = {
  Todos: '🌍', Brazilian: '🇧🇷', US: '🇺🇸', Hispanic: '🇪🇸', Russian: '🇷🇺', French: '🇫🇷',
}

export default function ResearchPage() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>('')
  const [market, setMarket] = useState('Todos')
  const [view, setView] = useState<'report' | 'ads'>('report')
  const [reports, setReports] = useState<Report[]>([])
  const [ads, setAds] = useState<ResearchAdItem[]>([])
  const [totalAds, setTotalAds] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  // Filters
  const [sortBy, setSortBy] = useState('innovation')
  const [minInnovation, setMinInnovation] = useState('')
  const [hookType, setHookType] = useState('')
  const [creativeFormat, setCreativeFormat] = useState('')

  // Load runs
  useEffect(() => {
    fetch('/api/research')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setRuns(data)
          // Prefer COMPLETE run, fallback to most recent of any status
          const complete = data.find((r: RunSummary) => r.status === 'COMPLETE')
          if (complete) {
            setSelectedRunId(complete.id)
          } else if (data.length > 0) {
            setSelectedRunId(data[0].id)
          }
        }
      })
      .catch((err) => console.error('[Research] Error loading runs:', err))
      .finally(() => setLoading(false))
  }, [])

  // Load reports for selected run
  useEffect(() => {
    if (!selectedRunId) return
    let cancelled = false
    fetch(`/api/research/${selectedRunId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.reports) setReports(data.reports)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedRunId])

  // Auto-refresh when a run is RUNNING
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === 'RUNNING')
    if (!hasRunning) return
    const interval = setInterval(() => {
      fetch('/api/research')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!Array.isArray(data)) return
          setRuns(data)
          // If the running run completed, reload reports
          const wasRunning = runs.find((r) => r.status === 'RUNNING')
          const nowComplete = data.find((r: RunSummary) => r.id === wasRunning?.id && r.status === 'COMPLETE')
          if (nowComplete) {
            setSelectedRunId(nowComplete.id)
            fetch(`/api/research/${nowComplete.id}`)
              .then((r) => r.json())
              .then((d) => { if (d.reports) setReports(d.reports) })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }, 15000) // Poll every 15 seconds
    return () => clearInterval(interval)
  }, [runs])

  // Load ads
  const loadAds = useCallback(() => {
    if (!selectedRunId) return
    const params = new URLSearchParams({
      runId: selectedRunId,
      isRelevant: 'true',
      page: String(page),
      limit: '24',
      sortBy,
    })
    if (market !== 'Todos') params.set('market', market)
    if (minInnovation) params.set('minInnovation', minInnovation)
    if (hookType) params.set('hookType', hookType)
    if (creativeFormat) params.set('creativeFormat', creativeFormat)

    fetch(`/api/research/ads?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ads) {
          setAds(data.ads)
          setTotalAds(data.total)
          setTotalPages(data.pages)
        }
      })
      .catch(() => {})
  }, [selectedRunId, market, page, sortBy, minInnovation, hookType, creativeFormat])

  useEffect(() => {
    if (view === 'ads') loadAds()
  }, [view, loadAds])

  const handleTrigger = async (resumeRunId?: string) => {
    setTriggering(true)
    try {
      const res = await fetch('/api/research/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumeRunId ? { resumeRunId } : {}),
      })
      if (res.ok) {
        const data = await res.json()
        alert(data.resumed
          ? 'Reanudando análisis del run existente. Los ads ya están guardados, solo se ejecuta clasificación + informe.'
          : 'Investigación completa lanzada. Puede tardar 1-3 horas.')
      } else {
        const data = await res.json()
        alert(data.error || 'Error al lanzar')
      }
    } catch {
      alert('Error de conexión')
    }
    setTriggering(false)
  }

  const selectedReport = reports.find((r) =>
    market === 'Todos' ? r.market === 'global' : r.market === market
  )

  const latestRun = runs.find((r) => r.id === selectedRunId)
  const runningJob = runs.find((r) => r.status === 'RUNNING')

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="h-4 bg-slate-200 rounded w-96" />
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Investigación Semanal</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {latestRun
              ? `Semana ${latestRun.weekLabel} — ${latestRun.totalAdsAnalyzed} ads analizados`
              : 'Investigación automática de ads en 5 mercados cada domingo'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runningJob && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Ejecutando...
            </span>
          )}
          {/* Run selector */}
          {runs.length > 1 && (
            <select
              value={selectedRunId}
              onChange={(e) => { setSelectedRunId(e.target.value); setPage(1) }}
              className="h-9 px-3 pr-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.weekLabel} ({r.status === 'COMPLETE' ? `${r.totalAdsAnalyzed} ads` : r.status})
                </option>
              ))}
            </select>
          )}
          {latestRun && latestRun.totalAdsFound > 0 && latestRun.totalAdsAnalyzed === 0 && (
            <button
              onClick={() => handleTrigger(latestRun.id)}
              disabled={triggering || !!runningJob}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {triggering ? 'Lanzando...' : 'Analizar ads existentes'}
            </button>
          )}
          <button
            onClick={() => handleTrigger()}
            disabled={triggering || !!runningJob}
            className="h-9 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? 'Lanzando...' : 'Ejecutar nuevo'}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {latestRun && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Ads analizados</p>
            <p className="text-2xl font-bold text-slate-900">{latestRun.totalAdsAnalyzed}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Ads encontrados</p>
            <p className="text-2xl font-bold text-slate-900">{latestRun.totalAdsFound}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Informes</p>
            <p className="text-2xl font-bold text-slate-900">{latestRun._count.reports}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Mercados</p>
            <p className="text-2xl font-bold text-slate-900">5</p>
          </div>
        </div>
      )}

      {/* Market tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {MARKETS.map((m) => (
          <button
            key={m}
            onClick={() => { setMarket(m); setPage(1) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              market === m
                ? 'bg-violet-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{MARKET_FLAGS[m]}</span>
            {m === 'Todos' ? 'Global' : m}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setView('report')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'report' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Informe
        </button>
        <button
          onClick={() => setView('ads')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'ads' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Ads ({view === 'ads' ? totalAds : '...'})
        </button>
      </div>

      {/* Report view */}
      {view === 'report' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 lg:p-8">
          {selectedReport && selectedRunId && (
            <div className="flex items-center justify-end gap-2 mb-4">
              <a
                href={`/api/research/${selectedRunId}/export?market=${market === 'Todos' ? 'global' : market}`}
                download
                className="inline-flex items-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar .docx
              </a>
            </div>
          )}
          {selectedReport ? (
            <div
              className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-p:text-slate-600 prose-p:leading-relaxed prose-blockquote:border-violet-300 prose-blockquote:text-slate-500 prose-blockquote:italic prose-a:text-violet-600 prose-strong:text-slate-800 prose-li:text-slate-600 prose-ul:text-slate-600"
              dangerouslySetInnerHTML={{ __html: selectedReport.reportHtml }}
            />
          ) : (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium text-slate-500 mb-2">
                {runs.length === 0
                  ? 'No hay investigaciones todavía'
                  : 'No hay informe para este mercado'}
              </p>
              <p className="text-sm text-slate-400">
                {runs.length === 0
                  ? 'La investigación se ejecuta automáticamente cada domingo a las 02:00, o pulsa "Ejecutar ahora".'
                  : 'Prueba seleccionando otro mercado o ejecuta una nueva investigación.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ads view */}
      {view === 'ads' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
              className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700"
            >
              <option value="innovation">Innovación</option>
              <option value="score">Score IA</option>
              <option value="daysActive">Días activo</option>
            </select>
            <select
              value={minInnovation}
              onChange={(e) => { setMinInnovation(e.target.value); setPage(1) }}
              className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700"
            >
              <option value="">Innovación: todos</option>
              <option value="8">8+ (destacados)</option>
              <option value="6">6+</option>
              <option value="4">4+</option>
            </select>
            <select
              value={hookType}
              onChange={(e) => { setHookType(e.target.value); setPage(1) }}
              className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700"
            >
              <option value="">Hook: todos</option>
              <option value="pregunta_retorica">Pregunta retórica</option>
              <option value="declaracion_impactante">Declaración impactante</option>
              <option value="historia_personal">Historia personal</option>
              <option value="estadistica">Estadística</option>
              <option value="contraintuitivo">Contraintuitivo</option>
              <option value="resultado_transformacion">Resultado transformación</option>
              <option value="curiosidad_misterio">Curiosidad misterio</option>
              <option value="urgencia">Urgencia</option>
            </select>
            <select
              value={creativeFormat}
              onChange={(e) => { setCreativeFormat(e.target.value); setPage(1) }}
              className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700"
            >
              <option value="">Formato: todos</option>
              <option value="video_ugc">Video UGC</option>
              <option value="video_talking_head">Talking Head</option>
              <option value="carrusel">Carrusel</option>
              <option value="imagen_estatica">Imagen estática</option>
              <option value="video_broll">Video B-Roll</option>
              <option value="video_texto_animado">Texto animado</option>
              <option value="meme_humor">Meme/Humor</option>
              <option value="testimonial">Testimonial</option>
            </select>
          </div>

          {/* Ad grid */}
          {ads.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ads.map((ad) => (
                  <ResearchAdCard key={ad.id} ad={ad} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-slate-500 px-3">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium text-slate-500">No hay ads para estos filtros</p>
              <p className="text-sm mt-1">Prueba ajustando los filtros o selecciona otro mercado.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
