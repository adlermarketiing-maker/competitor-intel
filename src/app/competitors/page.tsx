'use client'

import { useEffect, useState } from 'react'
import { useClient } from '@/contexts/ClientContext'
import CompetitorTable from '@/components/competitors/CompetitorTable'
import AddCompetitorButton from '@/components/shared/AddCompetitorButton'

export default function CompetitorsPage() {
  const { selectedClientId, loading: clientLoading } = useClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [competitors, setCompetitors] = useState<any[]>([])
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

  if (loading || clientLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{competitors.length} monitoreados</p>
        </div>
        <AddCompetitorButton />
      </div>

      <CompetitorTable competitors={competitors} />
    </div>
  )
}
