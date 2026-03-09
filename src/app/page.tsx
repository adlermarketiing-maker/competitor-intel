'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useClient } from '@/contexts/ClientContext'
import StatCard from '@/components/shared/StatCard'
import CompetitorTable from '@/components/competitors/CompetitorTable'
import AddCompetitorButton from '@/components/shared/AddCompetitorButton'
import { SkeletonStats, SkeletonTable } from '@/components/shared/Skeleton'

interface DashboardStats {
  competitors: number
  totalAds: number
  activeAds: number
  landingPages: number
}

export default function DashboardPage() {
  const { selectedClientId, loading: clientLoading } = useClient()
  const [stats, setStats] = useState<DashboardStats>({ competitors: 0, totalAds: 0, activeAds: 0, landingPages: 0 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [competitors, setCompetitors] = useState<any[]>([])
  const [hasToken, setHasToken] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientLoading) return
    setLoading(true)
    const cParam = selectedClientId ? `?clientId=${selectedClientId}` : ''
    Promise.all([
      fetch(`/api/dashboard${cParam}`).then((r) => r.json()).catch(() => ({ competitors: 0, totalAds: 0, activeAds: 0, landingPages: 0 })),
      fetch(`/api/competitors${cParam}`).then((r) => r.json()).catch(() => []),
      fetch('/api/settings').then((r) => r.json()).catch(() => null),
    ]).then(([dashStats, comps, settings]) => {
      setStats(dashStats)
      setCompetitors(comps)
      setHasToken(!!settings?.hasToken)
      setLoading(false)
    })
  }, [selectedClientId, clientLoading])

  const isLoading = loading || clientLoading

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <AddCompetitorButton />
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="mb-6">
          <SkeletonStats count={4} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Competidores"
            value={stats.competitors}
            color="violet"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            label="Total Anuncios"
            value={stats.totalAds}
            color="blue"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            }
          />
          <StatCard
            label="Anuncios Activos"
            value={stats.activeAds}
            color="green"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Landing Pages"
            value={stats.landingPages}
            color="amber"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Token setup banner */}
      {!isLoading && !hasToken && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-800 font-medium">
              Configura tu token de Meta Ad Library para empezar a scrapear
            </p>
          </div>
          <Link
            href="/settings"
            className="text-sm font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap transition-colors"
          >
            Configurar
          </Link>
        </div>
      )}

      {/* Competitors table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            Competidores
            {!isLoading && competitors.length > 0 && (
              <span className="ml-2 text-slate-400 font-normal">({competitors.length})</span>
            )}
          </h2>
          {!isLoading && competitors.length > 0 && (
            <Link href="/ads" className="text-sm text-violet-600 hover:text-violet-800 font-medium">
              Ver todos los anuncios
            </Link>
          )}
        </div>
        {isLoading ? (
          <SkeletonTable rows={3} />
        ) : competitors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Empieza anadiendo un competidor</p>
            <p className="text-xs text-slate-400 mb-4">
              Monitorea anuncios, landings y estrategias de tu competencia
            </p>
            <AddCompetitorButton />
          </div>
        ) : (
          <CompetitorTable competitors={competitors} />
        )}
      </div>
    </div>
  )
}
