'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AdCard from '@/components/ads/AdCard'
import LandingPageCard from '@/components/landings/LandingPageCard'
import ScrapeProgressBanner from '@/components/competitors/ScrapeProgressBanner'
import MarketAnalysisCard from '@/components/market/MarketAnalysisCard'
import type { Ad, Competitor, LandingPage } from '@/types/competitor'
import type { ScrapeJob } from '@/types/scrape'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarketAnalysis = any

interface AdStatusCounts {
  nuevo: number
  activo: number
  winner: number
  eliminado: number
  total: number
}

interface CompetitorData {
  competitor: Competitor & { _count?: { ads: number } }
  ads: Ad[]
  landingPages: LandingPage[]
  latestJob: ScrapeJob | null
  marketAnalysis: MarketAnalysis | null
  adStatusCounts: AdStatusCounts
}

type AdFilter = 'all' | 'nuevo' | 'activo' | 'winner' | 'eliminado'
type AdSort = 'recent' | 'daysActive' | 'oldest'

export default function CompetitorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const jobIdParam = searchParams.get('jobId')

  const [data, setData] = useState<CompetitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adFilter, setAdFilter] = useState<AdFilter>('all')
  const [adSort, setAdSort] = useState<AdSort>('recent')
  const [scraping, setScraping] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(jobIdParam)
  const [deleting, setDeleting] = useState(false)
  const [resetting, setResetting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/competitors/${id}`)
      if (!res.ok) throw new Error('Error loading competitor')
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleScrape = async () => {
    setScraping(true)
    try {
      const res = await fetch(`/api/competitors/${id}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: 'FULL_SCRAPE' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCurrentJobId(json.jobId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al lanzar scrape')
      setScraping(false)
    }
  }

  const handleReset = async () => {
    if (!confirm(`¿Resetear datos de "${data?.competitor.name}"?\n\nSe borrarán todos los anuncios scrapeados y los datos auto-detectados (Facebook Page ID, Instagram, Facebook URL). El competidor permanece y el próximo scrape empezará limpio.`)) return
    setResetting(true)
    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      if (!res.ok) throw new Error('Error al resetear')
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al resetear')
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${data?.competitor.name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
      router.push('/competitors')
    } catch {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error || 'Competidor no encontrado'}</p>
        <Link href="/competitors" className="text-violet-600 text-sm mt-2 block">← Volver</Link>
      </div>
    )
  }

  const { competitor, ads, landingPages, latestJob, marketAnalysis, adStatusCounts } = data

  const filteredAds = adFilter === 'all' ? ads : ads.filter((a) => a.adStatus === adFilter)

  const visibleAds = [...filteredAds].sort((a, b) => {
    if (adSort === 'daysActive') return (b.daysActive || 0) - (a.daysActive || 0)
    if (adSort === 'oldest') return new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime()
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
  })
  const isJobRunning = latestJob?.status === 'RUNNING' || (scraping && !currentJobId)

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-8 py-4">
        <div className="flex items-center gap-3">
          <Link href="/competitors" className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 truncate">{competitor.name}</h1>
              {latestJob && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                  latestJob.status === 'RUNNING' ? 'bg-violet-100 text-violet-700' :
                  latestJob.status === 'COMPLETE' ? 'bg-emerald-100 text-emerald-700' :
                  latestJob.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {latestJob.status === 'RUNNING' ? '● Scraping...' : latestJob.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {competitor.fbPageName && (
                <span className="text-xs text-slate-400">@{competitor.fbPageName}</span>
              )}
              {competitor.websiteUrl && (
                <a href={competitor.websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-violet-600 hover:underline">
                  {(() => { try { return new URL(competitor.websiteUrl).hostname } catch { return competitor.websiteUrl } })()}
                </a>
              )}
              {competitor.facebookUrl && (
                <a href={competitor.facebookUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">
                  Facebook ↗
                </a>
              )}
              {competitor.instagramUrl && (
                <a href={competitor.instagramUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-pink-600 hover:underline">
                  Instagram ↗
                </a>
              )}
              {competitor.adLibraryUrl && (
                <a href={competitor.adLibraryUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:underline font-medium">
                  Ad Library ↗
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleScrape}
              disabled={scraping || isJobRunning}
              className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-xl transition-colors"
            >
              {scraping || isJobRunning ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Scraping...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Scrape
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={resetting || scraping || isJobRunning}
              title="Borrar datos auto-detectados y anuncios scrapeados para empezar limpio"
              className="text-sm font-medium px-3 py-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors border border-transparent hover:border-amber-100"
            >
              {resetting ? 'Reseteando...' : 'Resetear'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm font-medium px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="px-8 py-6 space-y-10">
        {/* Progress banner */}
        {currentJobId && (
          <ScrapeProgressBanner
            competitorId={id}
            jobId={currentJobId}
            onComplete={() => {
              setCurrentJobId(null)
              setScraping(false)
              loadData()
            }}
          />
        )}

        {/* ── ADS ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Anuncios</h2>
            <span className="text-sm text-slate-500">
              {adStatusCounts.total} total
              {adStatusCounts.winner > 0 && <> · <span className="text-emerald-600 font-semibold">{adStatusCounts.winner} winners</span></>}
            </span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Status filter tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {([
              { label: 'Todos', value: 'all' as const, count: adStatusCounts.total, color: 'bg-violet-600' },
              { label: 'Winners', value: 'winner' as const, count: adStatusCounts.winner, color: 'bg-emerald-600' },
              { label: 'Nuevos', value: 'nuevo' as const, count: adStatusCounts.nuevo, color: 'bg-blue-600' },
              { label: 'Activos', value: 'activo' as const, count: adStatusCounts.activo, color: 'bg-slate-600' },
              { label: 'Eliminados', value: 'eliminado' as const, count: adStatusCounts.eliminado, color: 'bg-red-600' },
            ]).map(({ label, value, count, color }) => (
              <button
                key={value}
                onClick={() => setAdFilter(value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  adFilter === value
                    ? `${color} text-white`
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label} <span className="opacity-70">({count})</span>
              </button>
            ))}

            {/* Sort selector */}
            <div className="ml-auto relative">
              <select
                value={adSort}
                onChange={(e) => setAdSort(e.target.value as AdSort)}
                className="h-8 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none cursor-pointer"
              >
                <option value="recent">Más recientes</option>
                <option value="daysActive">Más días activo</option>
                <option value="oldest">Más antiguos</option>
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {visibleAds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
              <p className="text-sm text-slate-400 mb-3">
                {ads.length === 0 ? 'Sin anuncios todavía' : 'Sin anuncios en este filtro'}
              </p>
              {ads.length === 0 && (
                <button onClick={handleScrape} className="text-sm text-violet-600 font-medium hover:underline">
                  Buscar anuncios →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleAds.map((ad) => <AdCard key={ad.id} ad={ad} />)}
            </div>
          )}
        </section>

        {/* ── LANDING PAGES ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Landing Pages</h2>
            <span className="text-sm text-slate-500">{landingPages.length}</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {landingPages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
              <p className="text-sm text-slate-400">Sin landing pages todavía</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {landingPages.map((page) => <LandingPageCard key={page.id} page={page} />)}
            </div>
          )}
        </section>

        {/* ── MARKET ANALYSIS ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Análisis de Mercado</h2>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {marketAnalysis ? (
            <MarketAnalysisCard analysis={marketAnalysis} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
              <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Sin análisis de mercado</p>
              <p className="text-xs text-slate-400">
                Lanza un scrape completo para analizar las reseñas de plataformas con IA
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
