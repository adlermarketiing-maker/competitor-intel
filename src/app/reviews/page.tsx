'use client'

import { useState, useEffect } from 'react'
import PlatformCourseCard from '@/components/reviews/PlatformCourseCard'

const PLATFORM_OPTIONS = [
  { value: 'udemy', label: 'Udemy' },
  { value: 'hotmart', label: 'Hotmart' },
  { value: 'skool', label: 'Skool' },
  { value: 'pylon', label: 'Pylon' },
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

export default function ReviewsPage() {
  const [keywords, setKeywords] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['udemy', 'hotmart', 'skool', 'pylon'])
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [fetchingCourses, setFetchingCourses] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterPlatform, setFilterPlatform] = useState('')

  useEffect(() => {
    fetch('/api/platforms')
      .then((r) => r.json())
      .then((data) => { setCourses(data); setFetchingCourses(false) })
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

      // Refresh course list
      const refreshed = await fetch('/api/platforms').then((r) => r.json())
      setCourses(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar')
    } finally {
      setLoading(false)
    }
  }

  const displayedCourses = filterPlatform
    ? courses.filter((c) => c.platform === filterPlatform)
    : courses

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reseñas de Plataformas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Extrae comentarios y reseñas de cursos similares en Udemy, Hotmart, Skool y Pylon
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
              Buscando reseñas... (puede tardar varios minutos)
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

        {loading && (
          <p className="text-xs text-slate-400 mt-3">
            Abriendo navegador y recorriendo las plataformas seleccionadas. Esto puede tomar 3-5 minutos...
          </p>
        )}
      </form>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 font-medium">{error}</p>
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
            {displayedCourses.length} cursos
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
