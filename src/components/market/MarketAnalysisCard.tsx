'use client'

import { useState } from 'react'

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

const AWARENESS_LABELS: Record<string, { label: string; color: string }> = {
  unaware: { label: 'No consciente', color: 'bg-slate-400' },
  problemAware: { label: 'Consciente del problema', color: 'bg-red-400' },
  solutionAware: { label: 'Consciente de la solución', color: 'bg-amber-400' },
  productAware: { label: 'Consciente del producto', color: 'bg-blue-400' },
  mostAware: { label: 'Totalmente consciente', color: 'bg-emerald-400' },
}

function ItemList({ items, color }: { items: AnalysisItem[]; color: string }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, 5)

  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`flex-shrink-0 mt-1.5 w-2 h-2 rounded-full ${color}`} />
            <span className="text-sm text-slate-700 leading-snug">{item.text}</span>
            {item.count > 1 && (
              <span className="flex-shrink-0 text-xs text-slate-400 font-medium mt-0.5">×{item.count}</span>
            )}
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-violet-600 hover:text-violet-800 mt-2 transition-colors"
        >
          {expanded ? '↑ Ver menos' : `Ver ${items.length - 5} más ↓`}
        </button>
      )}
    </div>
  )
}

export default function MarketAnalysisCard({ analysis }: { analysis: MarketAnalysis }) {
  const [showPhrases, setShowPhrases] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">
              {analysis.totalReviews} reseñas analizadas
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              {analysis.platforms.join(', ')}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              {new Date(analysis.analyzedAt).toLocaleDateString('es-ES')}
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {analysis.summary && (
        <div className="bg-violet-50 rounded-xl p-5 border border-violet-100">
          <h3 className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-2">Resumen del Mercado</h3>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{analysis.summary}</p>
        </div>
      )}

      {/* Grid: Objections + Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Objections */}
        {analysis.objections.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Objeciones
            </h3>
            <ItemList items={analysis.objections} color="bg-red-400" />
          </div>
        )}

        {/* Benefits */}
        {analysis.benefits.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Beneficios Valorados
            </h3>
            <ItemList items={analysis.benefits} color="bg-emerald-400" />
          </div>
        )}

        {/* Fears */}
        {analysis.fears.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Miedos y Frustraciones
            </h3>
            <ItemList items={analysis.fears} color="bg-amber-400" />
          </div>
        )}

        {/* Desires */}
        {analysis.desires.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Deseos y Aspiraciones
            </h3>
            <ItemList items={analysis.desires} color="bg-blue-400" />
          </div>
        )}
      </div>

      {/* Awareness Levels */}
      {analysis.awarenessLevel && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">
            Niveles de Conciencia (Eugene Schwartz)
          </h3>
          <div className="space-y-3">
            {Object.entries(AWARENESS_LABELS).map(([key, { label, color }]) => {
              const awareness = analysis.awarenessLevel as unknown as Record<string, number>
              const value = awareness[key] ?? 0
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{label}</span>
                    <span className="text-xs font-bold text-slate-700">{value}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${color}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Exact Market Phrases */}
      {analysis.phrases.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Lenguaje Exacto del Mercado
            </h3>
            <button
              onClick={() => setShowPhrases(!showPhrases)}
              className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
            >
              {showPhrases ? 'Ocultar' : `Ver ${analysis.phrases.length} frases`}
            </button>
          </div>

          {showPhrases && (
            <div className="flex flex-wrap gap-2">
              {analysis.phrases.map((phrase, i) => (
                <span
                  key={i}
                  className="inline-block px-3 py-1.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs rounded-lg font-medium"
                >
                  &ldquo;{phrase}&rdquo;
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
