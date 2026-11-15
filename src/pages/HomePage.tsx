import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClientForm } from '../components/ClientForm'
import { Banner, Button, Card, Empty, Icon } from '../components/ui'
import { ageInMonths, formatAge, formatDate, todayISO } from '../domain/age'
import { cofidCount } from '../domain/foods'
import { downloadBackup } from '../lib/export'
import { useStore } from '../store/store'

export default function HomePage() {
  const clients = useStore((s) => s.clients)
  const assessments = useStore((s) => s.assessments)
  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const exportBackup = useStore((s) => s.exportBackup)
  const updateSettings = useStore((s) => s.updateSettings)
  const [adding, setAdding] = useState(false)
  const nav = useNavigate()
  const today = todayISO()
  const active = clients.filter((c) => !c.archived)
  const lastActivity = (id: string) => {
    const dates = [...assessments.filter((a) => a.clientId === id).map((a) => a.date), ...sessions.filter((s) => s.clientId === id).map((s) => s.date)].sort()
    return dates[dates.length - 1]
  }
  const recent = [...active].sort((a, b) => b.updatedAt - a.updatedAt)
  const daysSinceBackup = settings.lastBackupAt ? Math.floor((Date.now() - settings.lastBackupAt) / 86400000) : null
  const backupDue = clients.length > 0 && (daysSinceBackup == null || daysSinceBackup >= 30)

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-2">{active.length} active · {assessments.length} food histor{assessments.length === 1 ? 'y' : 'ies'} · {cofidCount().toLocaleString('en-GB')} CoFID foods loaded</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>New client</Button>
      </div>

      {backupDue && (
        <div className="mt-4">
          <Banner tone="warning" action={<Button size="sm" icon="download" onClick={() => (downloadBackup(exportBackup()), updateSettings({ lastBackupAt: Date.now() }))}>Download backup</Button>}>
            {daysSinceBackup == null ? 'No backup file has been downloaded yet.' : `Last backup file was downloaded ${daysSinceBackup} days ago.`} A monthly backup protects you if anything happens to the cloud account.
          </Banner>
        </div>
      )}

      {active.length === 0 ? (
        <Card className="mt-5">
          <Empty icon="users" title="Add your first client" action={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>New client</Button>}>
            Each client has a timeline of food histories, session notes and measurements, with charts that update as you add to it.
          </Empty>
        </Card>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((c) => {
            const n = assessments.filter((a) => a.clientId === c.id).length
            const last = lastActivity(c.id)
            return (
              <Link key={c.id} to={`/c/${c.id}`} className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{c.firstName}</div>
                    <div className="text-[12.5px] text-ink-2">{formatAge(ageInMonths(c.dob, today))} · {c.sex === 'M' ? 'Boy' : 'Girl'} · <span className="tnum">{c.code}</span></div>
                  </div>
                  <Icon name="chevronRight" className="mt-1 text-muted" />
                </div>
                {c.context && <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-2">{c.context}</p>}
                <div className="mt-3 text-[12px] text-muted">{n} food histor{n === 1 ? 'y' : 'ies'}{last ? ` · last activity ${formatDate(last)}` : ''}</div>
              </Link>
            )
          })}
        </div>
      )}
      {adding && <ClientForm onClose={() => setAdding(false)} onSaved={(c) => nav(`/c/${c.id}`)} />}
    </div>
  )
}
