'use client'

import { useState } from 'react'
import type { ResearchAdItem } from '@/types/research'

interface ResearchAdCardProps {
  ad: ResearchAdItem
}

const MARKET_FLAGS: Record<string, string> = {
  Brazilian: '🇧🇷',
  US: '🇺🇸',
  Hispanic: '🇪🇸',
  Russian: '🇷🇺',
  French: '🇫🇷',
}

function buildAdLibraryUrl(url: string): string {
  return url
    .replace('/ads/archive/render_ad/?id=', '/ads/library/?active_status=all&ad_type=all&country=ALL&id=')
    .replace(/\/ads\/library\/\?id=(\d+)$/, '/ads/library/?active_status=all&ad_type=all&country=ALL&id=$1')
}

export default function ResearchAdCard({ ad }: ResearchAdCardProps) {
  const [imgError, setImgError] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const primaryCopy = ad.adCopyBodies[0] || ''
  const thumbUrl = (!imgError && (ad.imageUrls[0] || ad.videoUrls[0])) || null
  const adLibraryUrl = ad.adSnapshotUrl ? buildAdLibraryUrl(ad.adSnapshotUrl) : null
  const flag = MARKET_FLAGS[ad.market] || '🌍'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-200 transition-all group">
      {/* Thumbnail */}
      <div className="relative w-full h-40 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center overflow-hidden">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="Ad creative" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setImgError(true)} loading="lazy" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
        {/* Top-left: market + innovation */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm bg-black/50 text-white">
            {flag} {ad.market}
          </span>
          {ad.innovationScore != null && ad.innovationScore >= 8 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm bg-violet-500/90 text-white">
              {ad.innovationScore}/10
            </span>
          )}
        </div>
        {/* Top-right: days active */}
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm bg-black/50 text-white">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {ad.daysActive === 0 ? '<1d' : `${ad.daysActive}d`}
          </span>
        </div>
        {/* Bottom-right: video indicator */}
        {ad.videoUrls.length > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-black/60 text-white">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              Vídeo
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Advertiser name */}
        {ad.pageName && (
          <p className="text-[10px] font-bold text-violet-600 mb-1.5 uppercase tracking-widest truncate">{ad.pageName}</p>
        )}
        {/* Niche + Platform */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1 flex-wrap">
            {ad.niche && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700">{ad.niche}</span>}
            {ad.platforms.slice(0, 2).map((p) => (
              <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">
                {p === 'facebook' ? 'FB' : p === 'instagram' ? 'IG' : p === 'messenger' ? 'MSG' : p}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">
            {ad.startDate
              ? new Date(ad.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
              : ''}
          </span>
        </div>
        {/* Headline */}
        {ad.headline && (
          <p className="text-sm font-semibold text-slate-800 mb-1.5 line-clamp-2 leading-snug">{ad.headline}</p>
        )}
        {/* Copy body */}
        {primaryCopy && (
          <div className="mb-3">
            <p className={`text-xs text-slate-500 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>{primaryCopy}</p>
            {primaryCopy.length > 200 && (
              <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-violet-500 hover:text-violet-700 font-medium mt-0.5">
                {expanded ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
        )}
        {/* Score bars */}
        {ad.aiAnalyzed && (
          <div className="flex items-center gap-3 mb-2.5">
            {ad.aiScore != null && (
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-[9px] text-slate-400 font-medium w-8">Score</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${ad.aiScore >= 8 ? 'bg-emerald-500' : ad.aiScore >= 5 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${ad.aiScore * 10}%` }} />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${ad.aiScore >= 8 ? 'text-emerald-600' : ad.aiScore >= 5 ? 'text-amber-600' : 'text-red-500'}`}>{ad.aiScore}</span>
              </div>
            )}
            {ad.innovationScore != null && (
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-[9px] text-slate-400 font-medium w-8">Innov</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${ad.innovationScore >= 8 ? 'bg-violet-500' : ad.innovationScore >= 5 ? 'bg-blue-400' : 'bg-slate-300'}`} style={{ width: `${ad.innovationScore * 10}%` }} />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${ad.innovationScore >= 8 ? 'text-violet-600' : ad.innovationScore >= 5 ? 'text-blue-600' : 'text-slate-500'}`}>{ad.innovationScore}</span>
              </div>
            )}
          </div>
        )}
        {/* AI Tags */}
        {ad.aiAnalyzed && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {ad.hookType && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">{ad.hookType.replace(/_/g, ' ')}</span>}
            {ad.marketingAngle && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700">{ad.marketingAngle.replace(/_/g, ' ')}</span>}
            {ad.creativeFormat && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700">{ad.creativeFormat.replace(/_/g, ' ')}</span>}
          </div>
        )}
        {/* AI Summary */}
        {ad.aiSummary && (
          <p className="text-[9px] text-slate-400 italic mb-2.5 line-clamp-2 leading-relaxed border-l-2 border-slate-100 pl-2">{ad.aiSummary}</p>
        )}
        {/* Landing URL */}
        {ad.landingUrl && (
          <a href={ad.landingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-700 mb-2.5" title={ad.landingUrl}>
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="truncate">{(() => { try { return new URL(ad.landingUrl).hostname.replace('www.', '') } catch { return ad.landingUrl } })()}</span>
          </a>
        )}
        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-50">
          <span className="text-[10px] text-slate-400">
            {ad.language ? ad.language.toUpperCase() : ''}
          </span>
          {adLibraryUrl && (
            <a href={adLibraryUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 hover:text-violet-600 font-semibold transition-colors">
              Ver en Meta
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
