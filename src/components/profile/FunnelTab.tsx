import type { Funnel } from '@/types/competitor'

interface FunnelTabProps {
  funnels: Funnel[]
}

const PAGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  landing: { label: 'Landing', color: 'bg-violet-100 text-violet-700' },
  upsell: { label: 'Upsell', color: 'bg-orange-100 text-orange-700' },
  downsell: { label: 'Downsell', color: 'bg-amber-100 text-amber-700' },
  checkout: { label: 'Checkout', color: 'bg-blue-100 text-blue-700' },
  thank_you: { label: 'Gracias', color: 'bg-emerald-100 text-emerald-700' },
  unknown: { label: 'Desconocido', color: 'bg-slate-100 text-slate-600' },
}

export default function FunnelTab({ funnels }: FunnelTabProps) {
  if (funnels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600 mb-1">Sin funnels detectados</p>
        <p className="text-xs text-slate-400 max-w-xs">
          Lanza un scrape completo para detectar el embudo de ventas de este competidor
        </p>
      </div>
    )
  }

  return (
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
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-violet-700 hover:text-violet-900 font-medium truncate block"
                      >
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
  )
}
