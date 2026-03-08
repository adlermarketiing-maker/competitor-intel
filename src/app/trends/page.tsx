'use client'

import { useEffect, useState, useCallback } from 'react'
import { useClient } from '@/contexts/ClientContext'

interface OrganicPost {
  id: string
  platform: string
  externalId: string
  url: string
  authorHandle: string
  authorName: string | null
  caption: string | null
  hashtags: string[]
  mediaType: string | null
  thumbnailUrl: string | null
  duration: number | null
  likes: number
  comments: number
  shares: number
  views: number
  followers: number
  engagementRate: number | null
  isViral: boolean
  viralScore: number | null
  transcript: string | null
  soundName: string | null
  publishedAt: string | null
  scrapedAt: string
  searchKeywords: string | null
  competitor?: { id: string; name: string } | null
}

interface Opportunity {
  id: string
  type: string
  title: string
  description: string
  source: string
  urgency: string
  detectedAt: string
  dismissed: boolean
}

interface CompetitorOption {
  id: string
  name: string
  instagramUrl?: string | null
}

type Tab = 'all' | 'instagram' | 'tiktok' | 'youtube' | 'opportunities'

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  tiktok: 'bg-slate-900 text-white',
  youtube: 'bg-red-100 text-red-700',
}

const URGENCY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  format_gap: { label: 'Gap de Formato', icon: '🎬' },
  hook_transfer: { label: 'Hook Transferible', icon: '🎣' },
  trending_topic: { label: 'Tema Trending', icon: '🔥' },
  viral_sound: { label: 'Audio Viral', icon: '🎵' },
}

function PostCard({ post }: { post: OrganicPost }) {
  const [showTranscript, setShowTranscript] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      {post.thumbnailUrl && (
        <div className="relative aspect-video bg-slate-100 overflow-hidden">
          <img
            src={post.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {post.duration && (
            <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
              {formatDuration(post.duration)}
            </span>
          )}
          {post.isViral && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              VIRAL {post.viralScore ? `${post.viralScore.toFixed(1)}x` : ''}
            </span>
          )}
          {post.mediaType && (
            <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded uppercase">
              {post.mediaType}
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        {/* Platform + Author */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[post.platform] || 'bg-slate-100 text-slate-600'}`}>
            {post.platform}
          </span>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-600 font-medium hover:underline truncate"
          >
            @{post.authorHandle}
          </a>
          {post.competitor && (
            <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded ml-auto flex-shrink-0">
              {post.competitor.name}
            </span>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm text-slate-700 line-clamp-3 mb-3 leading-relaxed">
            {post.caption}
          </p>
        )}

        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.hashtags.slice(0, 5).map((tag) => (
              <span key={tag} className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {post.hashtags.length > 5 && (
              <span className="text-[10px] text-slate-400">+{post.hashtags.length - 5}</span>
            )}
          </div>
        )}

        {/* Sound */}
        {post.soundName && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-500">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="truncate">{post.soundName}</span>
          </div>
        )}

        {/* Engagement stats */}
        <div className="flex items-center gap-3 text-xs text-slate-500 border-t border-slate-50 pt-3">
          {post.views > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {formatNumber(post.views)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {formatNumber(post.likes)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {formatNumber(post.comments)}
          </span>
          {post.shares > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {formatNumber(post.shares)}
            </span>
          )}
          {post.engagementRate != null && (
            <span className="ml-auto text-[10px] font-bold text-violet-600">
              {(post.engagementRate * 100).toFixed(2)}% ER
            </span>
          )}
        </div>

        {/* Transcript toggle */}
        {post.transcript && (
          <div className="mt-3">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-xs text-violet-600 hover:text-violet-500 font-medium flex items-center gap-1"
            >
              <svg className={`w-3 h-3 transition-transform ${showTranscript ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showTranscript ? 'Ocultar' : 'Ver'} transcripcion
            </button>
            {showTranscript && (
              <div className="mt-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed max-h-40 overflow-y-auto">
                {post.transcript}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function OpportunityCard({ opp, onDismiss }: { opp: Opportunity; onDismiss: (id: string) => void }) {
  const typeInfo = TYPE_LABELS[opp.type] || { label: opp.type, icon: '💡' }

  return (
    <div className={`bg-white rounded-2xl border p-5 ${URGENCY_STYLES[opp.urgency] || 'border-slate-100'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeInfo.icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{typeInfo.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${URGENCY_STYLES[opp.urgency] || ''}`}>
            {opp.urgency === 'high' ? 'Urgente' : opp.urgency === 'medium' ? 'Medio' : 'Bajo'}
          </span>
          <button
            onClick={() => onDismiss(opp.id)}
            className="text-slate-300 hover:text-slate-500 transition-colors"
            title="Descartar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-2">{opp.title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{opp.description}</p>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400">
        <span>Fuente: {opp.source}</span>
        <span>{new Date(opp.detectedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  )
}

export default function TrendsPage() {
  const { selectedClientId } = useClient()
  const [tab, setTab] = useState<Tab>('all')
  const [posts, setPosts] = useState<OrganicPost[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [competitors, setCompetitors] = useState<CompetitorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [competitorFilter, setCompetitorFilter] = useState('')
  const [viralOnly, setViralOnly] = useState(false)
  const [scrapeKeywords, setScrapeKeywords] = useState('')
  const [scrapeCompetitor, setScrapeCompetitor] = useState('')
  const [scrapePlatform, setScrapePlatform] = useState<'instagram' | 'tiktok' | 'youtube'>('tiktok')
  const [total, setTotal] = useState(0)

  const platformFilter = tab === 'all' || tab === 'opportunities' ? undefined : tab

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (platformFilter) params.set('platform', platformFilter)
      if (competitorFilter) params.set('competitorId', competitorFilter)
      if (selectedClientId) params.set('clientId', selectedClientId)
      if (viralOnly) params.set('viral', 'true')
      params.set('limit', '60')

      const res = await fetch(`/api/trends?${params}`)
      const data = await res.json()
      if (data.posts) {
        setPosts(data.posts)
        setTotal(data.total)
      } else if (Array.isArray(data)) {
        setPosts(data)
        setTotal(data.length)
      }
    } catch (err) {
      console.error('[Trends] Error fetching posts:', err)
    }
    setLoading(false)
  }, [platformFilter, competitorFilter, viralOnly, selectedClientId])

  const fetchOpportunities = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedClientId) params.set('clientId', selectedClientId)
      const res = await fetch(`/api/trends/opportunities?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setOpportunities(data)
    } catch (err) {
      console.error('[Trends] Error fetching opportunities:', err)
    }
  }, [selectedClientId])

  useEffect(() => {
    const cParam = selectedClientId ? `?clientId=${selectedClientId}` : ''
    Promise.all([
      fetch(`/api/competitors${cParam}`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCompetitors(d) }),
      fetchPosts(),
      fetchOpportunities(),
    ]).then(() => setLoading(false))
  }, [selectedClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'opportunities') fetchPosts()
  }, [tab, competitorFilter, viralOnly, fetchPosts])

  const handleScrape = async () => {
    setScraping(true)
    try {
      const body: Record<string, string> = { platform: scrapePlatform }
      if (scrapeKeywords.trim()) body.keywords = scrapeKeywords.trim()
      if (scrapeCompetitor) body.competitorId = scrapeCompetitor

      const res = await fetch('/api/trends/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        await fetchPosts()
      }
    } catch (err) {
      console.error('[Trends] Error scraping:', err)
    }
    setScraping(false)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await fetch('/api/trends/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', clientId: selectedClientId || undefined }),
      })
      await fetchOpportunities()
    } catch (err) {
      console.error('[Trends] Error generating opportunities:', err)
    }
    setGenerating(false)
  }

  const handleDismiss = async (id: string) => {
    try {
      await fetch('/api/trends/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', id }),
      })
      setOpportunities((prev) => prev.filter((o) => o.id !== id))
    } catch { /* ignore */ }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'opportunities', label: `Oportunidades (${opportunities.length})` },
  ]

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tendencias Organicas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Contenido organico que funciona — detecta oportunidades para ads
          </p>
        </div>
      </div>

      {/* Scrape controls */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Escanear contenido</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Plataforma</label>
            <select
              value={scrapePlatform}
              onChange={(e) => setScrapePlatform(e.target.value as 'instagram' | 'tiktok' | 'youtube')}
              className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
            >
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 block mb-1">
              {scrapePlatform === 'instagram' ? 'Competidor (con Instagram configurado)' : 'Keywords de busqueda'}
            </label>
            {scrapePlatform === 'instagram' ? (
              <select
                value={scrapeCompetitor}
                onChange={(e) => setScrapeCompetitor(e.target.value)}
                className="h-10 w-full px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
              >
                <option value="">Seleccionar competidor</option>
                {competitors.filter((c) => c.instagramUrl).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={scrapeKeywords}
                onChange={(e) => setScrapeKeywords(e.target.value)}
                placeholder="ej: marketing digital, productividad..."
                className="h-10 w-full px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
              />
            )}
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping || (scrapePlatform === 'instagram' ? !scrapeCompetitor : !scrapeKeywords.trim())}
            className="h-10 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            {scraping ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Escaneando...
              </>
            ) : (
              'Escanear'
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (not for opportunities tab) */}
      {tab !== 'opportunities' && (
        <div className="flex items-center gap-3 mb-6">
          <select
            value={competitorFilter}
            onChange={(e) => setCompetitorFilter(e.target.value)}
            className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700"
          >
            <option value="">Todos los competidores</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={viralOnly}
              onChange={(e) => setViralOnly(e.target.checked)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
            />
            Solo virales
          </label>
          <span className="text-xs text-slate-400 ml-auto">{total} resultados</span>
        </div>
      )}

      {/* Content */}
      {tab === 'opportunities' ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Oportunidades Detectadas</h2>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="h-9 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generar con IA
                </>
              )}
            </button>
          </div>

          {opportunities.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Sin oportunidades detectadas</p>
              <p className="text-xs text-slate-400">
                Escanea contenido organico y luego pulsa &ldquo;Generar con IA&rdquo; para cruzar tendencias organicas con tus datos de ads
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-2 2H9m3 4v6m-3-3h6" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin contenido organico</p>
          <p className="text-xs text-slate-400">
            Usa el panel de arriba para escanear contenido de Instagram, TikTok o YouTube
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
