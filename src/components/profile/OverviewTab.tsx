import type { Competitor } from '@/types/competitor'

interface OverviewTabProps {
  competitor: Competitor & { _count?: { ads: number } }
  adsCount: number
  landingsCount: number
  funnelsCount: number
}

export default function OverviewTab({
  competitor,
  adsCount,
  landingsCount,
  funnelsCount,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{adsCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Anuncios</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{landingsCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Landings</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{funnelsCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Funnels</p>
        </div>
      </div>

      {/* Profile links */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Perfiles y enlaces</h3>
        <div className="space-y-3">
          {competitor.websiteUrl && (
            <ProfileLink
              icon="web"
              label="Website"
              url={competitor.websiteUrl}
            />
          )}
          {competitor.facebookUrl && (
            <ProfileLink
              icon="facebook"
              label="Facebook"
              url={competitor.facebookUrl}
            />
          )}
          {competitor.instagramUrl && (
            <ProfileLink
              icon="instagram"
              label="Instagram"
              url={competitor.instagramUrl}
            />
          )}
          {competitor.adLibraryUrl && (
            <ProfileLink
              icon="ads"
              label="Meta Ad Library"
              url={competitor.adLibraryUrl}
              highlight
            />
          )}
        </div>

        {!competitor.websiteUrl && !competitor.facebookUrl && !competitor.adLibraryUrl && (
          <p className="text-sm text-slate-400">
            No hay enlaces disponibles. Lanza un scrape para obtener los perfiles.
          </p>
        )}
      </div>

      {/* Search info */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Configuración de búsqueda</h3>
        <div className="space-y-2 text-sm">
          {competitor.fbPageName && (
            <Row label="Página Facebook/Instagram" value={`@${competitor.fbPageName}`} />
          )}
          {competitor.fbPageId && (
            <Row label="Page ID (Meta)" value={competitor.fbPageId} />
          )}
          {competitor.searchTerm && (
            <Row label="Término de búsqueda" value={competitor.searchTerm} />
          )}
          {competitor.lastScrapedAt && (
            <Row label="Último scrape" value={new Date(competitor.lastScrapedAt).toLocaleString('es-ES')} />
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-400 w-44 flex-shrink-0 text-xs font-medium">{label}:</span>
      <span className="text-slate-700 text-xs">{value}</span>
    </div>
  )
}

function ProfileLink({
  icon,
  label,
  url,
  highlight,
}: {
  icon: string
  label: string
  url: string
  highlight?: boolean
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        highlight
          ? 'bg-blue-50 hover:bg-blue-100 border border-blue-100'
          : 'bg-slate-50 hover:bg-slate-100'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        highlight ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500'
      }`}>
        {icon === 'web' && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
          </svg>
        )}
        {icon === 'facebook' && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )}
        {icon === 'instagram' && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        )}
        {icon === 'ads' && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${highlight ? 'text-blue-800' : 'text-slate-700'}`}>{label}</p>
        <p className="text-xs text-slate-400 truncate">{url}</p>
      </div>
      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}
