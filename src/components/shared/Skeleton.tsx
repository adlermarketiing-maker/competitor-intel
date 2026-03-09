export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-skeleton">
      <div className="h-3 bg-slate-200 rounded-full w-2/3 mb-3" />
      <div className="h-6 bg-slate-200 rounded-lg w-1/3 mb-2" />
      <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-skeleton">
      {/* Header */}
      <div className="flex gap-4 px-5 py-3 border-b border-slate-100">
        <div className="h-3 bg-slate-200 rounded-full w-24" />
        <div className="h-3 bg-slate-200 rounded-full w-20" />
        <div className="h-3 bg-slate-200 rounded-full w-16" />
        <div className="h-3 bg-slate-200 rounded-full w-20 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
          <div className="w-8 h-8 bg-slate-200 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-200 rounded-full w-40" />
            <div className="h-2.5 bg-slate-100 rounded-full w-24" />
          </div>
          <div className="h-3 bg-slate-200 rounded-full w-12" />
          <div className="h-3 bg-slate-200 rounded-full w-16" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="aspect-video bg-slate-200" />
          <div className="p-4 space-y-3">
            <div className="h-3 bg-slate-200 rounded-full w-3/4" />
            <div className="h-2.5 bg-slate-100 rounded-full w-full" />
            <div className="h-2.5 bg-slate-100 rounded-full w-2/3" />
            <div className="flex gap-3 pt-2">
              <div className="h-2.5 bg-slate-100 rounded-full w-12" />
              <div className="h-2.5 bg-slate-100 rounded-full w-12" />
              <div className="h-2.5 bg-slate-100 rounded-full w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
