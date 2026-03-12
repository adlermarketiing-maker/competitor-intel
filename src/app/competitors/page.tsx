'use client'

import { useEffect, useState } from 'react'
import { useClient } from '@/contexts/ClientContext'
import CompetitorTable, { type CompetitorRow } from '@/components/competitors/CompetitorTable'
import AddCompetitorButton from '@/components/shared/AddCompetitorButton'
import { SkeletonTable } from '@/components/shared/Skeleton'

export default function CompetitorsPage() {
  const { selectedClientId, loading: clientLoading } = useClient()
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (clientLoading) return
    setLoading(true)
    setError(null)
    const cParam = selectedClientId ? `?clientId=${selectedClientId}` : ''
    fetch(`/api/competitors${cParam}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`)
        return r.json()
      })
      .then((data) => { setCompetitors(data); setLoading(false) })
      .catch((err) => { setError(err.message || 'Error al cargar competidores'); setLoading(false) })
  }, [selectedClientId, clientLoading])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Cargando...' : `${competitors.length} monitoreados`}
          </p>
        </div>
        <AddCompetitorButton />
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : loading || clientLoading ? (
        <SkeletonTable rows={4} />
      ) : competitors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-700 mb-1">Sin competidores todavía</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
            Añade tu primer competidor para empezar a monitorear sus anuncios, landings y estrategias.
          </p>
          <AddCompetitorButton />
        </div>
      ) : (
        <CompetitorTable competitors={competitors} />
      )}
    </div>
  )
}
