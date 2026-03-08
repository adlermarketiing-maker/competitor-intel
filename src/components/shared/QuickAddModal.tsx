'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClient } from '@/contexts/ClientContext'

const COUNTRY_OPTIONS = [
  { code: 'ES', label: 'ES' },
  { code: 'MX', label: 'MX' },
  { code: 'AR', label: 'AR' },
  { code: 'CO', label: 'CO' },
  { code: 'US', label: 'US' },
  { code: 'PE', label: 'PE' },
  { code: 'CL', label: 'CL' },
]

interface QuickAddModalProps {
  onClose: () => void
}

export default function QuickAddModal({ onClose }: QuickAddModalProps) {
  const router = useRouter()
  const { selectedClientId } = useClient()
  const nameRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [countries, setCountries] = useState(['ES', 'MX', 'AR', 'CO'])
  const [jobType, setJobType] = useState<'FULL_SCRAPE' | 'ADS_ONLY'>('FULL_SCRAPE')

  // Focus name input on open
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleCountry = (code: string) => {
    setCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const data = new FormData(e.currentTarget)

    const body = {
      name: (data.get('name') as string)?.trim(),
      fbPageName: (data.get('fbPageName') as string)?.trim() || undefined,
      websiteUrl: (data.get('websiteUrl') as string)?.trim() || undefined,
      searchTerm: (data.get('searchTerm') as string)?.trim() || undefined,
      countries,
      jobType,
      clientId: selectedClientId || undefined,
    }

    if (!body.name) {
      setError('El nombre es obligatorio')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error desconocido')
      onClose()
      router.push(`/competitors/${json.competitorId}?jobId=${json.jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Añadir competidor</h2>
            <p className="text-xs text-slate-400 mt-0.5">Scrape automático al añadir</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Essential fields */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              name="name"
              type="text"
              placeholder="ej. Frank Cuesta"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Página Facebook / Instagram
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">@</span>
              <input
                name="fbPageName"
                type="text"
                placeholder="frankcuesta"
                className="w-full border border-slate-200 rounded-xl pl-8 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-violet-600 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showAdvanced ? 'Ocultar opciones' : 'Más opciones'}
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-4 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Website URL
                </label>
                <input
                  name="websiteUrl"
                  type="url"
                  placeholder="https://frankcuesta.com"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Término de búsqueda
                </label>
                <input
                  name="searchTerm"
                  type="text"
                  placeholder="ej. curso marketing digital"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Países
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRY_OPTIONS.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleCountry(code)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        countries.includes(code)
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Tipo de scrape
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setJobType('FULL_SCRAPE')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-colors ${
                      jobType === 'FULL_SCRAPE'
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobType('ADS_ONLY')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-colors ${
                      jobType === 'ADS_ONLY'
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    Solo anuncios
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Añadiendo...
                </>
              ) : (
                'Añadir y scrape →'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
