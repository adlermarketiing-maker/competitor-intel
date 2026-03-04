'use client'

import { useEffect, useState } from 'react'

const COUNTRY_OPTIONS = [
  { code: 'ES', label: 'España' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
  { code: 'US', label: 'USA' },
  { code: 'PE', label: 'Perú' },
  { code: 'CL', label: 'Chile' },
  { code: 'BR', label: 'Brasil' },
]

export default function SettingsPage() {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [countries, setCountries] = useState<string[]>(['ES', 'MX', 'AR', 'CO'])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setHasToken(d.hasToken)
        setTokenExpiry(d.tokenExpiry)
        setCountries(d.countries || ['ES', 'MX', 'AR', 'CO'])
      })
      .catch(() => {})
  }, [])

  const toggleCountry = (code: string) => {
    setCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const body: Record<string, unknown> = { countries }
      if (token.trim()) body.token = token.trim()

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaved(true)
      if (token.trim()) {
        setHasToken(true)
        setToken('')
      }
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Token de Meta y preferencias de scraping</p>
      </div>

      <div className="space-y-6">
        {/* Meta Token */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Token de Meta</h2>
          <p className="text-sm text-slate-500 mb-4">
            Necesario para acceder a la Meta Ad Library API. Debe tener el permiso{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">ads_read</code>.
          </p>

          {/* Current status */}
          <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-sm ${
            hasToken ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${hasToken ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {hasToken ? (
              <span>
                Token configurado
                {tokenExpiry && ` · Expira ${new Date(tokenExpiry).toLocaleDateString('es-ES')}`}
              </span>
            ) : (
              <span>Sin token — añade uno para empezar</span>
            )}
          </div>

          {/* Token input */}
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAA... (pega tu token aquí)"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm pr-20 font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
            >
              {showToken ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {/* How to get token */}
          <div className="mt-4 bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Cómo obtener tu token:</p>
            <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
              <li>Ve a <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">developers.facebook.com/tools/explorer</a></li>
              <li>Selecciona tu app o usa la app por defecto</li>
              <li>Añade el permiso <code className="bg-white px-1 rounded font-mono">ads_read</code></li>
              <li>Haz clic en "Generate Access Token"</li>
              <li>Pega el token aquí (es válido ~60 días)</li>
            </ol>
          </div>
        </div>

        {/* Countries */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Países por defecto</h2>
          <p className="text-sm text-slate-500 mb-4">
            Países en los que se buscarán los anuncios de la competencia
          </p>
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

        {/* Save button */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
            ✓ Configuración guardada
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
