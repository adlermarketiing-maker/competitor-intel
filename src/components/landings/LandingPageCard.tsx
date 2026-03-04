import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { LandingPage } from '@/types/competitor'

interface LandingPageCardProps {
  page: LandingPage
}

export default function LandingPageCard({ page }: LandingPageCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Screenshot */}
      <div className="w-full h-44 bg-slate-100 overflow-hidden relative">
        {page.screenshotPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.screenshotPath}
            alt="Landing page screenshot"
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Status overlay */}
        {page.httpStatus && page.httpStatus >= 400 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {page.httpStatus}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-violet-600 hover:text-violet-800 truncate block mb-2"
        >
          {page.url}
        </a>

        {/* Offer name / H1 */}
        {(page.offerName || page.h1Texts[0]) && (
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
          <p className="text-xs text-red-500 mb-2 truncate">Error: {page.scrapeError}</p>
        )}

        <p className="text-xs text-slate-400 mt-2">
          Scrapeada {formatDistanceToNow(new Date(page.scrapedAt), { addSuffix: true, locale: es })}
        </p>
      </div>
    </div>
  )
}
