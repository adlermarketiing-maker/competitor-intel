import Link from 'next/link'
import AddCompetitorForm from '@/components/competitors/AddCompetitorForm'

export default function NewCompetitorPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/competitors" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Añadir Competidor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Se lanzará un scrape automáticamente</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <AddCompetitorForm />
      </div>
    </div>
  )
}
