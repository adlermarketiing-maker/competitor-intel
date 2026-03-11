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
      <div className="relative w-full h-40 bg-slate-100 flex items-center justify-center overflow-hidden">
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

        {/* Badges on thumbnail */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {/* Active / Inactive badge */}
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg shadow-sm ${
            ad.isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-200 text-slate-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ad.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {ad.isActive ? 'Activo' : 'Inactivo'}
          </span>

          {/* Winner badge — only if >= 5 days */}
          {ad.adStatus === 'winner' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg shadow-sm bg-amber-100 text-amber-800">
              Winner &middot; {ad.daysActive}d
            </span>
          )}
          {ad.adStatus === 'posible_winner' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg shadow-sm bg-orange-100 text-orange-700">
              Posible Winner &middot; {ad.daysActive}d
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {showCompetitor && ad.competitor && (
          <p className="text-xs font-semibold text-violet-600 mb-1">{ad.competitor.name}</p>
        )}

        {/* Platforms + dates */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {ad.platforms.length > 0 && (
            <span className="text-xs text-slate-400">{ad.platforms.join(', ')}</span>
          )}
          <span className="text-xs text-slate-400">
            {ad.startDate
              ? `Desde: ${new Date(ad.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : `Detectado: ${new Date(ad.firstSeenAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
            {ad.daysActive > 0 && ` · ${ad.daysActive} días`}
          </span>
        </div>

        {/* Headline */}
        {ad.headline && (
          <p className="text-sm font-semibold text-slate-800 mb-1 line-clamp-2">{ad.headline}</p>
        )}

        {/* Copy body */}
        {primaryCopy && (
          <p className="text-xs text-slate-600 mb-3 line-clamp-3">{primaryCopy}</p>
        )}

        {/* AI Tags */}
        {ad.aiAnalyzed && (
          <div className="flex flex-wrap gap-1 mb-3">
            {ad.hookType && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                {ad.hookType.replace(/_/g, ' ')}
              </span>
            )}
            {ad.marketingAngle && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700">
                {ad.marketingAngle.replace(/_/g, ' ')}
              </span>
            )}
            {ad.creativeFormat && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700">
                {ad.creativeFormat.replace(/_/g, ' ')}
              </span>
            )}
            {ad.awarenessLevel && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                {ad.awarenessLevel.replace(/_/g, ' ')}
              </span>
            )}
            {ad.aiScore != null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                ad.aiScore >= 8 ? 'bg-emerald-50 text-emerald-700'
                : ad.aiScore >= 5 ? 'bg-yellow-50 text-yellow-700'
                : 'bg-red-50 text-red-700'
              }`}>
                {ad.aiScore}/10
              </span>
            )}
          </div>
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
              href={ad.adSnapshotUrl
                .replace('/ads/archive/render_ad/?id=', '/ads/library/?active_status=all&ad_type=all&country=ALL&id=')
                .replace(/\/ads\/library\/\?id=(\d+)$/, '/ads/library/?active_status=all&ad_type=all&country=ALL&id=$1')}
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
