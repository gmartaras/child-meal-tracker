import { useParams } from 'react-router-dom'
import { Card, Icon } from '../components/ui'
import { formatDate } from '../domain/age'
import { useStore } from '../store/store'

export default function FamilyPage() {
  const {id, aid} = useParams()
  const a = useStore(s => s.assessments.find(x => x.id === aid && x.clientId === id && x.state === 'finalised'))
  if (!a?.snapshot) return <main className="app-page"><Card className="p-6">No approved summary available.</Card></main>
  return <main className="app-page !max-w-3xl space-y-5">
    <header className="workspace-hero rounded-2xl border border-line p-6 sm:p-9">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-accent-ink"><Icon name="file" /> Family summary</div>
      <h1 className="page-title text-3xl font-semibold">{a.snapshot.client.firstName}’s feeding plan</h1>
      <p className="mt-2 text-sm text-ink-2">{formatDate(a.date)}{a.scenarioOf ? ' · Planning scenario' : ''}</p>
    </header>
    <Card className="p-6 sm:p-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Agreed actions and follow-up</h2>
      <p className="whitespace-pre-wrap leading-relaxed text-ink-2">{a.parentNote || 'No agreed actions recorded.'}</p>
    </Card>
    <p className="text-sm text-muted">Prepared by {a.snapshot.settings.practitioner || 'your dietitian'}.</p>
  </main>
}
