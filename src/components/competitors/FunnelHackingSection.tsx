'use client'

import { useState, useEffect } from 'react'
import type { Competitor } from '@/types/competitor'
import { useToast } from '@/contexts/ToastContext'

interface Props {
  competitor: Competitor
  onUpdate: () => void
}

const FUNNEL_FIELDS = [
  { key: 'avatar', label: 'Avatar / Cliente Ideal', hint: 'A quién se dirige, cómo lo identifica, qué gancho usa para atraerlo', rows: 3 },
  { key: 'embudoStructure', label: 'Estructura del Embudo', hint: 'Ej: Anuncio → Opt-in → VSL → Checkout → Upsell', rows: 2 },
  { key: 'promesa', label: 'Promesa (Lead Magnet)', hint: 'Qué promete para atraer: lead magnet, webinar gratuito, evento', rows: 3 },
  { key: 'promesaOferta', label: 'Promesa de Oferta', hint: 'Qué resultado consigue el cliente, qué problemas soluciona', rows: 3 },
  { key: 'oferta', label: 'Oferta (Stack de Valor)', hint: 'Nombre de la oferta, qué incluye, entregables, escalera de valor', rows: 3 },
  { key: 'bonos', label: 'Bonos', hint: 'Qué entrega como bono y por qué', rows: 2 },
  { key: 'garantia', label: 'Garantía', hint: 'Tipo de garantía: devolución, satisfacción, resultados', rows: 2 },
  { key: 'pruebasAutoridad', label: 'Pruebas / Autoridad', hint: 'Testimonios, casos de éxito, premios, medios, certificaciones', rows: 3 },
  { key: 'precio', label: 'Precio', hint: 'Rango de precios: oferta principal + otros productos + planes de pago', rows: 2 },
  { key: 'funnelNotes', label: 'Notas', hint: 'Notas generales sobre este competidor', rows: 3 },
] as const

type FieldKey = typeof FUNNEL_FIELDS[number]['key']

export default function FunnelHackingSection({ competitor, onUpdate }: Props) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const buildValues = (comp: Competitor) => {
    const v: Record<string, string> = {}
    for (const f of FUNNEL_FIELDS) {
      v[f.key] = (comp[f.key as keyof Competitor] as string) || ''
    }
    v.funnelUrl = comp.funnelUrl || ''
    v.competitorType = comp.competitorType || ''
    v.youtubeUrl = comp.youtubeUrl || ''
    return v
  }

  const [values, setValues] = useState<Record<string, string>>(() => buildValues(competitor))

  // Reset form values when competitor prop changes (e.g. after re-analyze or navigation)
  useEffect(() => {
    setValues(buildValues(competitor))
    setEditing(false)
  }, [competitor.id, competitor.funnelAnalyzedAt])

  const hasAnyData = FUNNEL_FIELDS.some(
    (f) => !!(competitor[f.key as keyof Competitor])
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/competitors/${competitor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setEditing(false)
      toast('Cambios guardados', 'success')
      onUpdate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReanalyze = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/competitors/${competitor.id}/analyze-funnel`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Error al analizar')
      }
      onUpdate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al analizar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Funnel Hacking</h2>
        {competitor.funnelAnalyzedAt && (
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
            IA
          </span>
        )}
        <div className="flex-1 h-px bg-slate-100" />
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-medium px-3 py-1.5 text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={handleReanalyze}
                disabled={saving}
                className="text-xs font-medium px-3 py-1.5 text-violet-600 hover:bg-violet-50 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
              >
                {saving ? 'Analizando...' : 'Re-analizar con IA'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="text-xs font-medium px-3 py-1.5 text-slate-500 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-semibold px-3 py-1.5 bg-violet-600 text-white hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Meta row: type, funnel URL, external links */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Competitor type */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo de competidor</label>
            {editing ? (
              <select
                value={values.competitorType}
                onChange={(e) => updateField('competitorType', e.target.value)}
                className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">Sin clasificar</option>
                <option value="directo">Directo</option>
                <option value="indirecto">Indirecto</option>
              </select>
            ) : (
              <span className={`text-sm font-medium ${
                competitor.competitorType === 'directo' ? 'text-rose-600' :
                competitor.competitorType === 'indirecto' ? 'text-amber-600' :
                'text-slate-400'
              }`}>
                {competitor.competitorType === 'directo' ? 'Competidor Directo' :
                 competitor.competitorType === 'indirecto' ? 'Competidor Indirecto' :
                 'Sin clasificar'}
              </span>
            )}
          </div>

          {/* Funnel URL */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">URL del Embudo</label>
            {editing ? (
              <input
                type="url"
                value={values.funnelUrl}
                onChange={(e) => updateField('funnelUrl', e.target.value)}
                placeholder="https://..."
                className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            ) : competitor.funnelUrl ? (
              <a href={competitor.funnelUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-violet-600 hover:underline truncate block">
                {(() => { try { return new URL(competitor.funnelUrl).hostname } catch { return competitor.funnelUrl } })()}  ↗
              </a>
            ) : (
              <span className="text-sm text-slate-400">-</span>
            )}
          </div>

          {/* YouTube URL */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">YouTube</label>
            {editing ? (
              <input
                type="url"
                value={values.youtubeUrl}
                onChange={(e) => updateField('youtubeUrl', e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            ) : competitor.youtubeUrl ? (
              <a href={competitor.youtubeUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-red-600 hover:underline truncate block">
                YouTube ↗
              </a>
            ) : (
              <span className="text-sm text-slate-400">-</span>
            )}
          </div>
        </div>

        {/* External tool links */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-50">
          {competitor.adLibraryUrl && (
            <a href={competitor.adLibraryUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
              Ad Library ↗
            </a>
          )}
          {competitor.semrushUrl && (
            <a href={competitor.semrushUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors">
              Semrush ↗
            </a>
          )}
          {competitor.websiteUrl && (
            <a href={`https://www.clickbank.com/mkplSearchResult.htm?includeKeywords=${encodeURIComponent(competitor.name)}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
              Clickbank ↗
            </a>
          )}
        </div>
      </div>

      {/* Funnel Hacking fields */}
      {!hasAnyData && !editing ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin análisis de funnel</p>
          <p className="text-xs text-slate-400 mb-4">
            Lanza un scrape completo para que la IA analice el embudo, o rellena los campos manualmente.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-violet-600 font-medium hover:underline"
          >
            Rellenar manualmente →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {FUNNEL_FIELDS.map((field) => {
            const value = competitor[field.key as keyof Competitor] as string | null
            return (
              <div key={field.key} className="bg-white rounded-2xl border border-slate-100 p-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  {field.label}
                </label>
                {editing ? (
                  <div>
                    <textarea
                      value={values[field.key as FieldKey] || ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      rows={field.rows}
                      placeholder={field.hint}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
                    />
                    <p className="text-xs text-slate-400 mt-1">{field.hint}</p>
                  </div>
                ) : value ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{value}</p>
                ) : (
                  <p className="text-sm text-slate-300 italic">Sin datos</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
