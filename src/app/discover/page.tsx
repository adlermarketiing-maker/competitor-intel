'use client'

import { useState, useEffect } from 'react'
import DiscoveredTable, { type DiscoveredAdvertiser } from '@/components/discover/DiscoveredTable'

const COUNTRY_OPTIONS = [
  { code: 'ES', label: 'España' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
  { code: 'US', label: 'EEUU' },
  { code: 'PE', label: 'Perú' },
  { code: 'CL', label: 'Chile' },
  { code: 'EC', label: 'Ecuador' },
]

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

export default function DiscoverPage() {
  const [keywords, setKeywords] = useState('')
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['ES', 'MX', 'AR', 'CO'])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    fetch('/api/discover')
      .then((r) => r.json())
      .then((data) => { setHistory(data); setLoadingHistory(false) })
      .catch(() => setLoadingHistory(false))
  }, [])

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keywords.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim(), countries: selectedCountries }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      // Refresh history
      fetch('/api/discover')
        .then((r) => r.json())
        .then(setHistory)
        .catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar')
    } finally {
      setLoading(false)
    }
  }

  const loadFromHistory = (item: HistoryItem) => {
    setError(null)
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

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Descubrir Competidores</h1>
        <p className="text-sm text-slate-500 mt-1">
          Introduce palabras clave de tu nicho y descubriremos quién está anunciando en Meta
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Palabras clave o nicho
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder='Ej: "curso marketing digital", "coaching empresarial", "academia inglés"'
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Países a buscar
          </label>
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
              Buscando en Meta...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar competidores
            </>
          )}
        </button>
      </form>

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
            </h2>
          </div>
          <DiscoveredTable advertisers={result.advertisers} />
        </div>
      )}

      {/* History */}
      {!loadingHistory && history.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Búsquedas anteriores
          </h2>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="w-full text-left bg-white rounded-2xl border border-slate-100 px-5 py-3.5 hover:border-violet-200 hover:bg-violet-50/40 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">
                      {item.keywords}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.discoveredCompetitors.length} anunciantes ·{' '}
                      {item.countries.join(', ')} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no history, no results */}
      {!loadingHistory && history.length === 0 && !result && !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Empieza tu primera búsqueda</p>
          <p className="text-xs text-slate-400">
            Escribe keywords de tu nicho arriba y descubriremos qué competidores están activos en Meta Ads
          </p>
        </div>
      )}
    </div>
  )
}
