'use client'

import { useState, useEffect } from 'react'
import PlatformCourseCard from '@/components/reviews/PlatformCourseCard'
import MarketAnalysisCard from '@/components/market/MarketAnalysisCard'

const PLATFORM_OPTIONS = [
  { value: 'udemy', label: 'Udemy' },
  { value: 'hotmart', label: 'Hotmart' },
  { value: 'trustpilot', label: 'TrustPilot' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'skool', label: 'Skool' },
  { value: 'pylon', label: 'Pylon' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'clickbank', label: 'Clickbank' },
]

interface Comment {
  id: string
  author: string | null
  text: string
  rating: number | null
  date: string | null
}

interface Course {
  id: string
  platform: string
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
  comments: Comment[]
  search: { keywords: string } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarketAnalysis = any

export default function ReviewsPage() {
  const [keywords, setKeywords] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['udemy', 'hotmart', 'trustpilot', 'amazon', 'skool', 'pylon'])
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [fetchingCourses, setFetchingCourses] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterPlatform, setFilterPlatform] = useState('')

  // Market analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [analyses, setAnalyses] = useState<MarketAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<MarketAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/platforms').then((r) => r.json()),
      fetch('/api/market-analysis').then((r) => r.json()),
    ])
      .then(([coursesData, analysesData]) => {
        setCourses(coursesData)
        if (Array.isArray(analysesData)) setAnalyses(analysesData)
        setFetchingCourses(false)
      })
      .catch(() => setFetchingCourses(false))
  }, [])

  const togglePlatform = (value: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keywords.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim(), platforms: selectedPlatforms }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const refreshed = await fetch('/api/platforms').then((r) => r.json())
      setCourses(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!keywords.trim()) return
    setAnalyzing(true)
    setAnalysisError(null)
    setActiveAnalysis(null)

    try {
      const res = await fetch('/api/market-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setActiveAnalysis(data)
      setAnalyses((prev) => [data, ...prev])
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Error al analizar')
    } finally {
      setAnalyzing(false)
    }
  }

  const totalComments = courses.reduce((sum, c) => sum + c.comments.length, 0)

  const displayedCourses = filterPlatform
    ? courses.filter((c) => c.platform === filterPlatform)
    : courses

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reseñas y Lenguaje del Mercado</h1>
        <p className="text-sm text-slate-500 mt-1">
          Extrae reseñas de plataformas y analiza el lenguaje del mercado con IA
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Nicho o palabras clave
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder='Ej: "marketing digital", "coaching de vida", "inglés para negocios"'
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Plataformas a buscar
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => togglePlatform(value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  selectedPlatforms.includes(value)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !keywords.trim() || selectedPlatforms.length === 0}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Buscando reseñas...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Extraer reseñas
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || !keywords.trim() || totalComments < 3}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {analyzing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analizando con IA...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analizar mercado
              </>
            )}
          </button>
        </div>

        {loading && (
          <p className="text-xs text-slate-400 mt-3">
            Abriendo navegador y recorriendo las plataformas seleccionadas. Esto puede tomar 3-5 minutos...
          </p>
        )}
        {analyzing && (
          <p className="text-xs text-slate-400 mt-3">
            Enviando {totalComments} reseñas a Claude para análisis de mercado...
          </p>
        )}
      </form>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {analysisError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 font-medium">{analysisError}</p>
        </div>
      )}

      {/* Active analysis result */}
      {activeAnalysis && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Análisis de Mercado</h2>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <MarketAnalysisCard analysis={activeAnalysis} />
        </div>
      )}

      {/* Previous analyses */}
      {!activeAnalysis && analyses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Análisis Anteriores</h2>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {analyses.map((a: MarketAnalysis) => (
              <button
                key={a.id}
                onClick={() => setActiveAnalysis(a)}
                className="bg-white rounded-xl border border-slate-100 p-4 text-left hover:border-violet-200 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-800 mb-1">
                  {a.searchKeywords || a.competitor?.name || 'Análisis'}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{a.totalReviews} reseñas</span>
                  <span>·</span>
                  <span>{new Date(a.analyzedAt).toLocaleDateString('es-ES')}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Platform filter */}
      {courses.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[{ value: '', label: 'Todos' }, ...PLATFORM_OPTIONS].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterPlatform(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterPlatform === value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            {displayedCourses.length} cursos · {totalComments} reseñas
          </span>
        </div>
      )}

      {/* Course list */}
      {fetchingCourses ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayedCourses.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedCourses.map((course) => (
            <PlatformCourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin reseñas todavía</p>
          <p className="text-xs text-slate-400">
            Introduce keywords de tu nicho arriba para extraer reseñas de cursos similares
          </p>
        </div>
      )}
    </div>
  )
}
