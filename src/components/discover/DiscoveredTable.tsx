'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface DiscoveredAdvertiser {
  id: string
  pageName: string
  pageId: string | null
  adCount: number
  sampleCopy: string | null
  sampleLandingUrl: string | null
  competitorId: string | null
}

interface DiscoveredTableProps {
  advertisers: DiscoveredAdvertiser[]
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function DiscoveredTable({ advertisers }: DiscoveredTableProps) {
  const router = useRouter()
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const [addedIds, setAddedIds] = useState<Set<string>>(
    new Set(advertisers.filter((a) => a.competitorId).map((a) => a.id))
  )

  const handleAdd = async (advertiser: DiscoveredAdvertiser) => {
    if (addedIds.has(advertiser.id)) {
      router.push(`/competitors/${advertiser.competitorId}`)
      return
    }

    setAddingIds((prev) => new Set([...prev, advertiser.id]))
    try {
      const res = await fetch('/api/discover/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredId: advertiser.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAddedIds((prev) => new Set([...prev, advertiser.id]))
      router.push(`/competitors/${json.competitorId}?jobId=${json.jobId}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al añadir competidor')
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev)
        next.delete(advertiser.id)
        return next
      })
    }
  }

  if (advertisers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
        <p className="text-sm text-slate-400">No se encontraron anunciantes para esas keywords</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {advertisers.length} anunciantes encontrados
        </span>
        <span className="text-xs text-slate-400">Ordenados por nº de anuncios activos</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-50">
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-6 py-3">Anunciante</th>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Copy de muestra</th>
            <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Ads</th>
            <th className="px-6 py-3 w-28" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {advertisers.map((a, i) => {
            const isAdding = addingIds.has(a.id)
            const isAdded = addedIds.has(a.id)
            return (
              <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                {/* Rank + Name */}
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 font-medium w-5 flex-shrink-0">{i + 1}</span>
                    <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(a.pageName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.pageName}</p>
                      {a.sampleLandingUrl && (
                        <a
                          href={a.sampleLandingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-600 hover:underline truncate block max-w-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(() => { try { return new URL(a.sampleLandingUrl!).hostname } catch { return a.sampleLandingUrl } })()}
                        </a>
                      )}
                    </div>
                  </div>
                </td>

                {/* Sample copy */}
                <td className="px-4 py-3.5 hidden md:table-cell max-w-xs">
                  {a.sampleCopy ? (
                    <p className="text-xs text-slate-500 line-clamp-2">{a.sampleCopy}</p>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>

                {/* Ad count */}
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-bold text-slate-700">{a.adCount}</span>
                </td>

                {/* Action */}
                <td className="px-6 py-3.5">
                  <button
                    onClick={() => handleAdd(a)}
                    disabled={isAdding}
                    className={`w-full px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      isAdded
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60'
                    }`}
                  >
                    {isAdding ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Añadiendo...
                      </span>
                    ) : isAdded ? (
                      '✓ Ver perfil →'
                    ) : (
                      '+ Añadir'
                    )}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
