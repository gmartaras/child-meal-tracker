import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClientForm } from '../components/ClientForm'
import { Banner, Button, Card, Empty, Icon, Input } from '../components/ui'
import { ageInMonths, formatAge, formatDate, todayISO } from '../domain/age'
import { cofidCount } from '../domain/foods'
import { downloadBackup } from '../lib/export'
import { useStore } from '../store/store'

export default function HomePage() {
  const clients = useStore(s => s.clients)
  const assessments = useStore(s => s.assessments)
  const sessions = useStore(s => s.sessions)
  const settings = useStore(s => s.settings)
  const exportBackup = useStore(s => s.exportBackup)
  const updateSettings = useStore(s => s.updateSettings)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const nav = useNavigate()
  const today = todayISO()
  const active = clients.filter(c => !c.archived)
  const filtered = active.filter(c => `${c.firstName} ${c.code}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const recentActivity = new Map<string, string>()
  const historyCount = new Map<string, number>()
  for (const row of [...assessments, ...sessions]) {
    if (row.date > (recentActivity.get(row.clientId) ?? '')) recentActivity.set(row.clientId, row.date)
  }
  for (const row of assessments) historyCount.set(row.clientId, (historyCount.get(row.clientId) ?? 0) + 1)
  const daysSinceBackup = settings.lastBackupAt ? Math.floor((Date.now() - settings.lastBackupAt) / 86_400_000) : null
  const backupDue = clients.length > 0 && (daysSinceBackup == null || daysSinceBackup >= 30)

  return (
    <div className="app-page">
      <header className="workspace-hero flex flex-wrap items-end justify-between gap-5 rounded-2xl border border-line p-6 sm:p-9">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-accent-ink"><Icon name="layout" /> Practice workspace</div>
          <h1 className="text-3xl font-semibold sm:text-[2.65rem]">Clients</h1>
          <p className="mt-2 text-sm text-ink-2">Manage consultations, food histories and reports.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>New client</Button>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          {label:'Active clients', value:active.length, icon:'users'},
          {label:'Food histories', value:assessments.length, icon:'note'},
          {label:'CoFID foods', value:cofidCount(), icon:'apple'},
        ].map(metric => <Card key={metric.label} className="p-3 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-medium text-ink-2 sm:text-[13px]"><Icon name={metric.icon} className="hidden text-accent-ink sm:block" />{metric.label}</div>
          <div className="tnum mt-2 text-xl font-semibold tracking-tight sm:text-3xl">{metric.value.toLocaleString('en-GB')}</div>
        </Card>)}
      </div>

      {backupDue && <div className="mt-5">
        <Banner tone="warning" action={<Button size="sm" icon="download" onClick={() => (downloadBackup(exportBackup()), updateSettings({lastBackupAt: Date.now()}))}>Download backup</Button>}>
          {daysSinceBackup == null ? 'No backup file has been downloaded yet.' : `Last backup downloaded ${daysSinceBackup} days ago.`}
        </Banner>
      </div>}

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold tracking-tight">Client directory</h2>
          {!!active.length && <div className="relative w-full sm:w-64">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input className="pl-9" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Filter clients" placeholder="Search name or code" />
          </div>}
        </div>

        {active.length === 0 ? <Empty icon="users" title="Add your first client" action={<Button icon="plus" onClick={()=>setAdding(true)}>New client</Button>}>Create a record to start a food history or capture a session note.</Empty>
          : filtered.length === 0 ? <Empty icon="search" title="No clients match your search" action={<Button onClick={()=>setQuery('')}>Clear search</Button>} />
          : <>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] gap-4 bg-surface-2/60 px-6 py-2.5 text-xs font-semibold text-ink-2 sm:grid" aria-hidden="true">
              <span>Client</span><span>Last session or history</span><span>Food histories</span>
            </div>
            <ul className="divide-y divide-line">
              {filtered.map(client => {
                const date = recentActivity.get(client.id)
                const n = historyCount.get(client.id) ?? 0
                return <li key={client.id}>
                  <Link to={`/c/${client.id}`} className="workspace-row grid grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] sm:gap-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-accent-wash text-sm font-semibold text-accent-ink">{client.firstName.slice(0,1).toUpperCase()}</span>
                      <div className="min-w-0"><div className="truncate font-semibold">{client.firstName}</div><div className="truncate text-xs text-ink-2">{client.code} · {formatAge(ageInMonths(client.dob, today))}</div></div>
                    </div>
                    <span className="hidden text-sm text-ink-2 sm:block">{date ? formatDate(date) : 'No activity yet'}</span>
                    <span className="tnum hidden text-sm text-ink-2 sm:block">{n}</span>
                    <Icon name="chevronRight" className="text-muted" />
                  </Link>
                </li>
              })}
            </ul>
          </>}
      </Card>
      {adding && <ClientForm onClose={() => setAdding(false)} onSaved={c => nav(`/c/${c.id}`)} />}
    </div>
  )
}
