'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COUNTRY_OPTIONS = [
  { code: 'ES', label: 'España' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
  { code: 'US', label: 'USA' },
  { code: 'PE', label: 'Perú' },
  { code: 'CL', label: 'Chile' },
]

export default function AddCompetitorForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countries, setCountries] = useState(['ES', 'MX', 'AR', 'CO'])
  const [jobType, setJobType] = useState<'FULL_SCRAPE' | 'ADS_ONLY'>('FULL_SCRAPE')

  const toggleCountry = (code: string) => {
    setCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const data = new FormData(form)

    const body = {
      name: data.get('name') as string,
      fbPageName: (data.get('fbPageName') as string) || undefined,
      websiteUrl: (data.get('websiteUrl') as string) || undefined,
      searchTerm: (data.get('searchTerm') as string) || undefined,
      countries,
      jobType,
    }

    if (!body.name?.trim()) {
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
      router.push(`/competitors/${json.competitorId}?jobId=${json.jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Nombre interno <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          type="text"
          placeholder="ej. Marketing Total"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Nombre de página Facebook / Instagram
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
          <input
            name="fbPageName"
            type="text"
            placeholder="ej. marketingtotal"
            className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Se usará para buscar sus anuncios en Meta Ad Library
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Website URL
        </label>
        <input
          name="websiteUrl"
          type="url"
          placeholder="https://competidor.com"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Término de búsqueda (Ad Library)
        </label>
        <input
          name="searchTerm"
          type="text"
          placeholder="ej. curso marketing digital online"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <p className="text-xs text-slate-400 mt-1">
          Alternativo al nombre de página — útil para buscar por palabras clave
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Países a monitorear
        </label>
        <div className="flex flex-wrap gap-2">
          {COUNTRY_OPTIONS.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => toggleCountry(code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                countries.includes(code)
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Tipo de scraping inicial
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setJobType('FULL_SCRAPE')}
            className={`flex-1 p-3 rounded-xl border-2 text-left transition-colors ${
              jobType === 'FULL_SCRAPE'
                ? 'border-violet-500 bg-violet-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className="text-sm font-semibold text-slate-800">Completo</p>
            <p className="text-xs text-slate-500 mt-0.5">Anuncios + landings + funnels</p>
          </button>
          <button
            type="button"
            onClick={() => setJobType('ADS_ONLY')}
            className={`flex-1 p-3 rounded-xl border-2 text-left transition-colors ${
              jobType === 'ADS_ONLY'
                ? 'border-violet-500 bg-violet-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className="text-sm font-semibold text-slate-800">Solo anuncios</p>
            <p className="text-xs text-slate-500 mt-0.5">Solo Meta Ad Library</p>
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl transition-colors"
        >
          {loading ? 'Añadiendo...' : 'Añadir y scrape →'}
        </button>
      </div>
    </form>
  )
}
