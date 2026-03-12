'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useClient } from '@/contexts/ClientContext'
import DiscoveredTable, { type DiscoveredAdvertiser } from '@/components/discover/DiscoveredTable'
import { COUNTRY_OPTIONS } from '@/lib/countries'

interface SearchResult {
  searchId: string
  keywords: string
  total: number
  advertisers: DiscoveredAdvertiser[]
}

interface HistoryItem {
  id: string
  keywords: string
  countries: string[]
  createdAt: string
  discoveredCompetitors: DiscoveredAdvertiser[]
}

interface ProgressInfo {
  message: string
  adsScanned?: number
  advertisersFound?: number
  page?: number
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return `${mins}m ${rem}s`
}

export default function DiscoverPage() {
  const { selectedClientId } = useClient()
  const [keywords, setKeywords] = useState('')
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['ES', 'MX', 'AR', 'CO'])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshHistory = useCallback(() => {
    const cParam = selectedClientId ? `?clientId=${selectedClientId}` : ''
    fetch(`/api/discover${cParam}`)
      .then((r) => r.json())
      .then((data) => { setHistory(data); setLoadingHistory(false) })
      .catch(() => setLoadingHistory(false))
  }, [selectedClientId])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  // Elapsed timer
  useEffect(() => {
    if (loading) {
      startTimeRef.current = Date.now()
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keywords.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress({ message: 'Iniciando búsqueda...', adsScanned: 0, advertisersFound: 0 })

    let receivedDone = false

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords.trim(),
          countries: selectedCountries,
          clientId: selectedClientId || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No se pudo leer la respuesta')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6))

              if (eventType === 'progress') {
                setProgress(data as ProgressInfo)
              } else if (eventType === 'done') {
                receivedDone = true
                setResult(data as SearchResult)
                setProgress(null)
                refreshHistory()
              } else if (eventType === 'error') {
                throw new Error(data.error)
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                throw parseErr
              }
            }
            eventType = ''
          }
        }
      }

      // SSE stream ended without 'done' event — try to recover from DB
      if (!receivedDone) {
        setProgress({ message: 'Reconectando... buscando resultados guardados', adsScanned: 0, advertisersFound: 0 })
        // Wait a moment for DB writes to complete
        await new Promise((r) => setTimeout(r, 2000))
        const cParam = selectedClientId ? `?clientId=${selectedClientId}` : ''
        const histRes = await fetch(`/api/discover${cParam}`)
        const histData: HistoryItem[] = await histRes.json()
        setHistory(histData)
        // Find the latest search matching our keywords
        const latest = histData.find((h) =>
          h.keywords.toLowerCase() === keywords.trim().toLowerCase() &&
          h.discoveredCompetitors.length > 0
        )
        if (latest) {
          setResult({
            searchId: latest.id,
            keywords: latest.keywords,
            total: latest.discoveredCompetitors.length,
            advertisers: latest.discoveredCompetitors,
          })
          setProgress(null)
        } else {
          setError('La conexión se interrumpió. Si la búsqueda se completó, recarga la página para ver los resultados.')
          setProgress(null)
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Error al buscar')
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setLoading(false)
    setProgress(null)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/discover/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setHistory((prev) => prev.filter((h) => h.id !== id))
      if (result?.searchId === id) setResult(null)
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  const loadFromHistory = (item: HistoryItem) => {
    setError(null)
    setProgress(null)
    setResult({
      searchId: item.id,
      keywords: item.keywords,
      total: item.discoveredCompetitors.length,
      advertisers: item.discoveredCompetitors,
    })
    setKeywords(item.keywords)
    setSelectedCountries(item.countries)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Split history into searches with results and empty ones
  const historyWithResults = history.filter((h) => h.discoveredCompetitors.length > 0)
  const historyEmpty = history.filter((h) => h.discoveredCompetitors.length === 0)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Descubrir Competidores</h1>
        <p className="text-sm text-slate-500 mt-1">
          Busca por keyword en el contenido de anuncios de Meta Ad Library para encontrar todos los anunciantes de tu nicho
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Palabras clave (se buscan en el contenido de los anuncios)
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder='Ej: "mindfulness", "curso marketing digital", "coaching empresarial"'
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            disabled={loading}
          />
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Países a buscar
            </label>
            <button
              type="button"
              onClick={() =>
                setSelectedCountries(
                  selectedCountries.length === COUNTRY_OPTIONS.length
                    ? []
                    : COUNTRY_OPTIONS.map((c) => c.code)
                )
              }
              className="text-xs font-medium text-violet-600 hover:text-violet-500 transition-colors"
            >
              {selectedCountries.length === COUNTRY_OPTIONS.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {COUNTRY_OPTIONS.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleCountry(code)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  selectedCountries.includes(code)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !keywords.trim() || selectedCountries.length === 0}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Buscando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Buscar en anuncios
              </>
            )}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Progress bar */}
      {progress && (
        <div className="mb-6 bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 animate-spin text-violet-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-medium text-violet-800">{progress.message}</p>
            </div>
            {elapsed > 0 && (
              <span className="text-xs text-violet-400 font-mono flex-shrink-0">{formatElapsed(elapsed)}</span>
            )}
          </div>
          {(progress.adsScanned ?? 0) > 0 && (
            <div className="flex items-center gap-6 ml-8">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-violet-700">{(progress.adsScanned ?? 0).toLocaleString()}</span>
                <span className="text-xs text-violet-500 uppercase">anuncios escaneados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-violet-700">{(progress.advertisersFound ?? 0).toLocaleString()}</span>
                <span className="text-xs text-violet-500 uppercase">anunciantes encontrados</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Resultados para <span className="text-violet-700">&quot;{result.keywords}&quot;</span>
              {result.total > 0 && (
                <span className="text-slate-400 font-normal ml-1">
                  — {result.total} anunciantes relevantes (formación/mentoría/servicios)
                </span>
              )}
            </h2>
          </div>
          <DiscoveredTable advertisers={result.advertisers} />
        </div>
      )}

      {/* History — searches with results */}
      {!loadingHistory && historyWithResults.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Búsquedas anteriores
          </h2>
          <div className="space-y-2">
            {historyWithResults.map((item) => (
              <div
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="w-full text-left bg-white rounded-2xl border border-slate-100 px-5 py-3.5 hover:border-violet-200 hover:bg-violet-50/40 transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">
                      {item.keywords}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.discoveredCompetitors.length} anunciantes ·{' '}
                      {new Date(item.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar búsqueda"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History — empty searches (collapsed) */}
      {!loadingHistory && historyEmpty.length > 0 && (
        <details className="mb-6">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-500 transition-colors">
            {historyEmpty.length} búsqueda{historyEmpty.length !== 1 ? 's' : ''} sin resultados
          </summary>
          <div className="space-y-1 mt-2">
            {historyEmpty.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2 group"
              >
                <div>
                  <span className="text-xs text-slate-500">{item.keywords}</span>
                  <span className="text-[10px] text-slate-300 ml-2">
                    {new Date(item.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  disabled={deletingId === item.id}
                  className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Empty state */}
      {!loadingHistory && history.length === 0 && !result && !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Empieza tu primera búsqueda</p>
          <p className="text-xs text-slate-400">
            Escribe keywords de tu nicho y escanearemos miles de anuncios en Meta Ad Library para descubrir todos los competidores
          </p>
        </div>
      )}
    </div>
  )
}
