import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Ad } from '@/types/competitor'

interface AdCardProps {
  ad: Ad & { competitor?: { id: string; name: string } }
  showCompetitor?: boolean
}

export default function AdCard({ ad, showCompetitor = false }: AdCardProps) {
  const primaryCopy = ad.adCopyBodies[0] || ''
  const thumbUrl = ad.imageUrls[0] || ad.videoUrls[0] || null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="w-full h-40 bg-slate-100 flex items-center justify-center overflow-hidden">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt="Ad creative"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {showCompetitor && ad.competitor && (
          <p className="text-xs font-semibold text-violet-600 mb-1">{ad.competitor.name}</p>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            ad.isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ad.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {ad.isActive ? 'Activo' : 'Inactivo'}
          </span>
          {ad.platforms.length > 0 && (
            <span className="text-xs text-slate-400">{ad.platforms.join(', ')}</span>
          )}
        </div>

        {/* Headline */}
        {ad.headline && (
          <p className="text-sm font-semibold text-slate-800 mb-1 line-clamp-2">{ad.headline}</p>
        )}

        {/* Copy body */}
        {primaryCopy && (
          <p className="text-xs text-slate-600 mb-3 line-clamp-3">{primaryCopy}</p>
        )}

        {/* Landing URL */}
        {ad.landingUrl && (
          <a
            href={ad.landingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 mb-2 truncate"
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="truncate">{ad.landingUrl}</span>
          </a>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
          <span className="text-xs text-slate-400">
            {ad.startDate
              ? formatDistanceToNow(new Date(ad.startDate), { addSuffix: true, locale: es })
              : 'Fecha desconocida'}
          </span>
          {ad.adSnapshotUrl && (
            <a
              href={ad.adSnapshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-violet-600 font-medium"
            >
              Ver anuncio ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
