'use client'

import { useEffect, useState, useCallback } from 'react'

interface AnalysisItem {
  text: string
  count: number
}

interface AwarenessLevel {
  unaware: number
  problemAware: number
  solutionAware: number
  productAware: number
  mostAware: number
}

interface MarketAnalysis {
  id: string
  objections: AnalysisItem[]
  benefits: AnalysisItem[]
  fears: AnalysisItem[]
  desires: AnalysisItem[]
  phrases: string[]
  awarenessLevel: AwarenessLevel
  summary: string
  totalReviews: number
  platforms: string[]
  analyzedAt: string
  searchKeywords?: string | null
  competitor?: { id: string; name: string } | null
}

interface CompetitorOption {
  id: string
  name: string
}

const AWARENESS_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  unaware: { label: 'No consciente', color: 'bg-slate-400', desc: 'No saben que tienen un problema' },
  problemAware: { label: 'Consciente del problema', color: 'bg-red-400', desc: 'Saben del problema pero no la solución' },
  solutionAware: { label: 'Consciente de la solución', color: 'bg-amber-400', desc: 'Buscan soluciones activamente' },
  productAware: { label: 'Consciente del producto', color: 'bg-blue-400', desc: 'Conocen productos pero no están convencidos' },
  mostAware: { label: 'Totalmente consciente', color: 'bg-emerald-400', desc: 'Solo necesitan la oferta correcta' },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 p-1 rounded hover:bg-slate-100 transition-colors group"
      title="Copiar frase"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

function RankedList({ items, color, search }: { items: AnalysisItem[]; color: string; search: string }) {
  const filtered = search
    ? items.filter((i) => i.text.toLowerCase().includes(search.toLowerCase()))
    : items

  if (filtered.length === 0) {
    return <p className="text-xs text-slate-400 italic">Sin resultados para &ldquo;{search}&rdquo;</p>
  }

  const maxCount = Math.max(...filtered.map((i) => i.count), 1)

  return (
    <div className="space-y-2">
      {filtered.map((item, i) => (
        <div key={i} className="group">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-slate-400 w-5 mt-0.5 flex-shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1">
                <p className="text-sm text-slate-700 leading-snug flex-1">&ldquo;{item.text}&rdquo;</p>
                <CopyButton text={item.text} />
              </div>
              <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-0.5 flex-shrink-0">{item.count}x</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function MarketPage() {
  const [analyses, setAnalyses] = useState<MarketAnalysis[]>([])
  const [competitors, setCompetitors] = useState<CompetitorOption[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<MarketAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [competitorFilter, setCompetitorFilter] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/market-analysis').then((r) => r.json()),
      fetch('/api/competitors').then((r) => r.json()),
    ]).then(([analysesData, comps]) => {
      if (Array.isArray(analysesData)) {
        setAnalyses(analysesData)
        if (analysesData.length > 0) setSelectedAnalysis(analysesData[0])
      }
      if (Array.isArray(comps)) setCompetitors(comps)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filteredAnalyses = competitorFilter
    ? analyses.filter((a) => a.competitor?.id === competitorFilter)
    : analyses

  const selectAnalysis = useCallback((a: MarketAnalysis) => {
    setSelectedAnalysis(a)
    setSearch('')
  }, [])

  const handleExport = () => {
    if (!selectedAnalysis) return
    window.open(`/api/market-analysis/${selectedAnalysis.id}/export`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const a = selectedAnalysis

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lenguaje del Mercado</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Frases reales de clientes para usar en tus copies
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Competitor filter */}
          <div className="relative">
            <select
              value={competitorFilter}
              onChange={(e) => { setCompetitorFilter(e.target.value) }}
              className="h-10 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none cursor-pointer"
            >
              <option value="">Todos</option>
              {competitors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {analyses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin analisis de mercado</p>
          <p className="text-xs text-slate-400 mb-4">
            Ve a la seccion de Resenas para extraer reviews de plataformas y generar el analisis con IA
          </p>
          <a
            href="/reviews"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Ir a Resenas
          </a>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar: analysis list */}
          <div className="w-64 flex-shrink-0">
            <div className="space-y-2">
              {filteredAnalyses.map((analysis) => (
                <button
                  key={analysis.id}
                  onClick={() => selectAnalysis(analysis)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedAnalysis?.id === analysis.id
                      ? 'bg-violet-50 border-violet-200'
                      : 'bg-white border-slate-100 hover:border-violet-200'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {analysis.competitor?.name || analysis.searchKeywords || 'Analisis'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{analysis.totalReviews} resenas</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">
                      {new Date(analysis.analyzedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {analysis.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                    {analysis.platforms.length > 3 && (
                      <span className="text-[10px] text-slate-400">+{analysis.platforms.length - 3}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          {a ? (
            <div className="flex-1 min-w-0">
              {/* Document header */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {a.competitor?.name || a.searchKeywords || 'Analisis de Mercado'}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400">{a.totalReviews} resenas analizadas</span>
                      <span className="text-xs text-slate-400">{a.platforms.join(', ')}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(a.analyzedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar en el analisis..."
                        className="h-9 pl-8 pr-3 w-52 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {/* Export */}
                    <button
                      onClick={handleExport}
                      className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Exportar .md
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary */}
              {a.summary && (!search || a.summary.toLowerCase().includes(search.toLowerCase())) && (
                <div className="bg-violet-50 rounded-2xl p-6 border border-violet-100 mb-6">
                  <h3 className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-3">Resumen del Mercado</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{a.summary}</p>
                </div>
              )}

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Objections */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </span>
                    Objeciones ({a.objections.length})
                  </h3>
                  <RankedList items={a.objections} color="bg-red-400" search={search} />
                </div>

                {/* Benefits */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    Beneficios Valorados ({a.benefits.length})
                  </h3>
                  <RankedList items={a.benefits} color="bg-emerald-400" search={search} />
                </div>

                {/* Fears */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-amber-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </span>
                    Miedos y Frustraciones ({a.fears.length})
                  </h3>
                  <RankedList items={a.fears} color="bg-amber-400" search={search} />
                </div>

                {/* Desires */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </span>
                    Deseos y Aspiraciones ({a.desires.length})
                  </h3>
                  <RankedList items={a.desires} color="bg-blue-400" search={search} />
                </div>
              </div>

              {/* Phrases for copies */}
              {a.phrases.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
                  <h3 className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-violet-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </span>
                    Frases Textuales para Copies ({a.phrases.length})
                  </h3>
                  <div className="space-y-2">
                    {(search
                      ? a.phrases.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
                      : a.phrases
                    ).map((phrase, i) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-100 rounded-xl group hover:border-violet-200 transition-colors">
                        <p className="text-sm text-violet-800 flex-1">&ldquo;{phrase}&rdquo;</p>
                        <CopyButton text={phrase} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Awareness Levels */}
              {a.awarenessLevel && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-5">
                    Niveles de Conciencia (Eugene Schwartz)
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(AWARENESS_LABELS).map(([key, { label, color, desc }]) => {
                      const awareness = a.awarenessLevel as unknown as Record<string, number>
                      const value = awareness[key] ?? 0
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="text-sm font-medium text-slate-700">{label}</span>
                              <span className="text-xs text-slate-400 ml-2">{desc}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-800">{value}%</span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${color}`}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-400">Selecciona un analisis de la lista</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
