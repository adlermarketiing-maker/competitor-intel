import { listCompetitors } from '@/lib/db/competitors'
import CompetitorTable from '@/components/competitors/CompetitorTable'
import AddCompetitorButton from '@/components/shared/AddCompetitorButton'

export const dynamic = 'force-dynamic'

export default async function CompetitorsPage() {
  const competitors = await listCompetitors()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{competitors.length} monitoreados</p>
        </div>
        <AddCompetitorButton />
      </div>

      <CompetitorTable competitors={competitors} />
    </div>
  )
}
