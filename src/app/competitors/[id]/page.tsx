'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AdCard from '@/components/ads/AdCard'
import LandingPageCard from '@/components/landings/LandingPageCard'
import ScrapeProgressBanner from '@/components/competitors/ScrapeProgressBanner'
import type { Ad, Competitor, LandingPage, Funnel } from '@/types/competitor'
import type { ScrapeJob } from '@/types/scrape'

interface CompetitorData {
  competitor: Competitor & { _count?: { ads: number } }
  ads: Ad[]
  landingPages: LandingPage[]
  funnels: Funnel[]
  latestJob: ScrapeJob | null
}

type AdFilter = 'all' | 'active' | 'inactive'

const PAGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  landing: { label: 'Landing', color: 'bg-violet-100 text-violet-700' },
  upsell: { label: 'Upsell', color: 'bg-orange-100 text-orange-700' },
  downsell: { label: 'Downsell', color: 'bg-amber-100 text-amber-700' },
  checkout: { label: 'Checkout', color: 'bg-blue-100 text-blue-700' },
  thank_you: { label: 'Gracias', color: 'bg-emerald-100 text-emerald-700' },
  unknown: { label: 'Desconocido', color: 'bg-slate-100 text-slate-600' },
}

export default function CompetitorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const jobIdParam = searchParams.get('jobId')

  const [data, setData] = useState<CompetitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adFilter, setAdFilter] = useState<AdFilter>('all')
  const [scraping, setScraping] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(jobIdParam)
  const [deleting, setDeleting] = useState(false)

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

  const { competitor, ads, landingPages, funnels, latestJob } = data
  const activeAds = ads.filter((a) => a.isActive)
  const inactiveAds = ads.filter((a) => !a.isActive)
  const visibleAds = adFilter === 'active' ? activeAds : adFilter === 'inactive' ? inactiveAds : ads
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
            <span className="text-sm text-slate-500">{ads.length} total · {activeAds.length} activos</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <div className="flex gap-2 mb-5">
            {([
              { label: 'Todos', value: 'all' as const, count: ads.length },
              { label: 'Activos', value: 'active' as const, count: activeAds.length },
              { label: 'Inactivos', value: 'inactive' as const, count: inactiveAds.length },
            ]).map(({ label, value, count }) => (
              <button
                key={value}
                onClick={() => setAdFilter(value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  adFilter === value
                    ? 'bg-violet-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label} <span className="opacity-70">({count})</span>
              </button>
            ))}
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

        {/* ── FUNNELS ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Funnels</h2>
            <span className="text-sm text-slate-500">{funnels.length} detectados</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {funnels.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
              <p className="text-sm text-slate-400 mb-1">Sin funnels detectados</p>
              <p className="text-xs text-slate-300">Lanza un scrape completo para detectar el embudo de ventas</p>
            </div>
          ) : (
            <div className="space-y-6">
              {funnels.map((funnel, fi) => (
                <div key={funnel.funnelId} className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Funnel #{fi + 1}
                  </p>
                  <div className="space-y-1">
                    {funnel.steps.map((step, i) => {
                      const typeInfo = PAGE_TYPE_LABELS[step.pageType || 'unknown'] || PAGE_TYPE_LABELS.unknown
                      return (
                        <div key={step.id}>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                              {step.stepOrder}
                            </div>
                            <div className="flex-1 min-w-0">
                              <a href={step.url} target="_blank" rel="noopener noreferrer"
                                className="text-sm text-violet-700 hover:text-violet-900 font-medium truncate block">
                                {step.url}
                              </a>
                              {step.landingPage?.title && (
                                <p className="text-xs text-slate-500 truncate mt-0.5">{step.landingPage.title}</p>
                              )}
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                          {i < funnel.steps.length - 1 && (
                            <div className="flex justify-center py-1">
                              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
