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
  // Rich fields from keyword search
  category?: string | null
  likes?: number
  igUsername?: string | null
  landingUrls?: string[]
  adCopies?: string[]
  adImages?: string[]
}

interface DiscoveredTableProps {
  advertisers: DiscoveredAdvertiser[]
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function extractHostname(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

export default function DiscoveredTable({ advertisers }: DiscoveredTableProps) {
  const router = useRouter()
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const [addedIds, setAddedIds] = useState<Set<string>>(
    new Set(advertisers.filter((a) => a.competitorId).map((a) => a.id))
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {advertisers.length} anunciantes encontrados
        </span>
        <span className="text-xs text-slate-400">Ordenados por n&ordm; de anuncios activos</span>
      </div>

      {advertisers.map((a, i) => {
        const isAdding = addingIds.has(a.id)
        const isAdded = addedIds.has(a.id)
        const isExpanded = expandedId === a.id
        const hasRichData = (a.landingUrls?.length ?? 0) > 0 || (a.adCopies?.length ?? 0) > 0 || (a.adImages?.length ?? 0) > 0

        return (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors">
            {/* Main row */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer"
              onClick={() => hasRichData && setExpandedId(isExpanded ? null : a.id)}
            >
              {/* Rank */}
              <span className="text-xs text-slate-300 font-bold w-5 flex-shrink-0 text-center">{i + 1}</span>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {getInitials(a.pageName)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.pageName}</p>
                  {a.category && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline">
                      {a.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {a.sampleLandingUrl && (
                    <a
                      href={a.sampleLandingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {extractHostname(a.sampleLandingUrl)}
                    </a>
                  )}
                  {(a.likes ?? 0) > 0 && (
                    <span className="text-[10px] text-slate-400">{(a.likes ?? 0).toLocaleString()} likes</span>
                  )}
                  {a.igUsername && (
                    <a
                      href={`https://instagram.com/${a.igUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-400 hover:text-violet-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{a.igUsername}
                    </a>
                  )}
                </div>
              </div>

              {/* Ad count */}
              <div className="text-center flex-shrink-0">
                <p className="text-lg font-bold text-slate-800">{a.adCount}</p>
                <p className="text-[10px] text-slate-400 uppercase">ads</p>
              </div>

              {/* Expand arrow */}
              {hasRichData && (
                <svg
                  className={`w-4 h-4 text-slate-300 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}

              {/* Add button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleAdd(a) }}
                disabled={isAdding}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                  isAdded
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60'
                }`}
              >
                {isAdding ? 'Añadiendo...' : isAdded ? '✓ Ver perfil' : '+ Añadir y scrape'}
              </button>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                {/* Ad copies */}
                {(a.adCopies?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Copies de anuncios</p>
                    <div className="space-y-2">
                      {a.adCopies!.map((copy, ci) => (
                        <div key={ci} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                          <p className="text-xs text-slate-600 leading-relaxed">{copy}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ad images */}
                {(a.adImages?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Creatividades</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {a.adImages!.map((img, ii) => (
                        <a key={ii} href={img} target="_blank" rel="noopener noreferrer">
                          <img
                            src={img}
                            alt={`Ad ${ii + 1}`}
                            className="w-32 h-32 object-cover rounded-xl border border-slate-200 flex-shrink-0 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Landing URLs */}
                {(a.landingUrls?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Landing pages detectadas</p>
                    <div className="flex flex-wrap gap-2">
                      {a.landingUrls!.map((url, ui) => (
                        <a
                          key={ui}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors"
                        >
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {extractHostname(url)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
