'use client'

import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { LandingPage } from '@/types/competitor'

interface LandingPageCardProps {
  page: LandingPage
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function LandingPageCard({ page }: LandingPageCardProps) {
  const hostname = getHostname(page.url)
  const hasContent = page.offerName || page.h1Texts[0]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      {/* Screenshot — clickable, opens URL in new tab */}
      <a
        href={page.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full h-44 bg-slate-100 overflow-hidden relative"
        title={page.url}
      >
        {page.screenshotPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.screenshotPath}
            alt={`Screenshot de ${hostname}`}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">Sin captura</span>
          </div>
        )}
        {/* HTTP error badge */}
        {page.httpStatus && page.httpStatus >= 400 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {page.httpStatus}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow">
            Abrir →
          </span>
        </div>
      </a>

      {/* Content */}
      <div className="p-4">
        {/* Hostname */}
        <div className="flex items-center gap-1.5 mb-2">
          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-violet-600 hover:text-violet-800 truncate"
            title={page.url}
          >
            {hostname}
          </a>
        </div>

        {/* Offer name / H1 */}
        {hasContent && (
          <p className="text-sm font-semibold text-slate-800 mb-2 line-clamp-2">
            {page.offerName || page.h1Texts[0]}
          </p>
        )}

        {/* Price badges */}
        {page.prices.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {page.prices.slice(0, 3).map((price, i) => (
              <span key={i} className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {price}
              </span>
            ))}
          </div>
        )}

        {/* CTAs */}
        {page.ctaTexts.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {page.ctaTexts.slice(0, 2).map((cta, i) => (
              <span key={i} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full truncate max-w-[140px]">
                {cta}
              </span>
            ))}
          </div>
        )}

        {/* Error */}
        {page.scrapeError && (
          <p className="text-xs text-red-500 mb-2 truncate" title={page.scrapeError}>
            ⚠ {page.scrapeError}
          </p>
        )}

        <p className="text-xs text-slate-400 mt-auto pt-1">
          {formatDistanceToNow(new Date(page.scrapedAt), { addSuffix: true, locale: es })}
        </p>
      </div>
    </div>
  )
}
