import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClientForm } from '../components/ClientForm'
import { Banner, Button, Card, Empty, Icon, Input, Segmented } from '../components/ui'
import { ageInMonths, formatAge, formatDateShort, todayISO } from '../domain/age'
import { useStore } from '../store/store'

export default function HomePage() {
  const clients = useStore((s) => s.clients)
  const assessments = useStore((s) => s.assessments)
  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'active' | 'all'>('active')
  const nav = useNavigate()
  const today = todayISO()

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return clients
      .filter((c) => show === 'all' || (!c.archived && !c.dischargedOn))
      .filter((c) => !t || c.firstName.toLowerCase().includes(t) || c.code.toLowerCase().includes(t))
      .map((c) => {
        const ss = sessions.filter((s) => s.clientId === c.id)
        const as = assessments.filter((a) => a.clientId === c.id)
        const last = [...ss.map((s) => s.date), ...as.map((a) => a.date)].sort().pop()
        const actions = ss.filter((s) => s.sections?.actions).sort((a, b) => b.date.localeCompare(a.date))[0]?.sections?.actions
        return { c, sessions: ss.length, histories: as.length, last, actions }
      })
      .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || b.c.updatedAt - a.c.updatedAt)
  }, [clients, sessions, assessments, q, show])

  const daysSinceBackup = settings.lastBackupAt ? Math.floor((Date.now() - settings.lastBackupAt) / 86400000) : null
  const backupDue = clients.length > 0 && (daysSinceBackup == null || daysSinceBackup >= 30)

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-semibold tracking-tight">Clients</h1>
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or code" className="pl-8" aria-label="Filter clients" />
        </div>
        <Segmented value={show} onChange={setShow} options={[{ id: 'active', label: 'Active' }, { id: 'all', label: 'All' }]} />
        <Button variant="primary" icon="plus" className="ml-auto" onClick={() => setAdding(true)}>New client</Button>
      </div>

      {backupDue && (
        <div className="mt-3">
          <Banner tone="warning" action={<Button size="sm" icon="download" onClick={() => nav('/settings#backup')}>Back up now</Button>}>
            {daysSinceBackup == null ? 'No backup file has been downloaded yet.' : `Your last backup file was downloaded ${daysSinceBackup} days ago.`} A monthly backup protects the records if anything happens to the cloud account.
          </Banner>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="mt-3">
          <Empty icon="users" title={clients.length ? 'No clients match' : 'Add your first client'} action={!clients.length && <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>New client</Button>}>
            {clients.length ? 'Try a different name or code, or show all clients.' : 'Each client has session notes, food histories, an accepted foods list, a meal plan and progress charts.'}
          </Empty>
        </Card>
      ) : (
        <Card className="mt-3">
          <div className="hidden grid-cols-[minmax(9rem,1.2fr)_7rem_5.5rem_minmax(0,3fr)_5rem_1.5rem] gap-3 sticky top-0 z-10 rounded-t-xl border-b border-line bg-surface-2 px-4 py-2 text-[12px] font-medium text-muted md:grid">
            <span>Client</span><span>Age</span><span>Last contact</span><span>Agreed actions</span><span className="text-right">Records</span><span />
          </div>
          <ul className="divide-y divide-line">
            {rows.map(({ c, sessions: ns, histories, last, actions }) => (
              <li key={c.id}>
                <Link to={`/c/${c.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 hover:bg-surface-2 md:grid-cols-[minmax(9rem,1.2fr)_7rem_5.5rem_minmax(0,3fr)_5rem_1.5rem]">
                  <span className="min-w-0">
                    <span className="text-[14px] font-medium">{c.firstName}</span>
                    <span className="tnum ml-2 text-[12px] text-muted">{c.code}</span>
                    {(c.archived || c.dischargedOn) && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">{c.archived ? 'archived' : 'discharged'}</span>}
                  </span>
                  <span className="text-[13px] text-ink-2 md:order-none">{formatAge(ageInMonths(c.dob, today))}</span>
                  <span className="tnum hidden text-[13px] text-ink-2 md:block">{last ? formatDateShort(last) : '–'}</span>
                  <span className="col-span-2 truncate text-[13px] text-ink-2 md:col-span-1">{actions ? actions.replace(/\s*\n\s*/g, ' · ') : <span className="text-muted">{c.context ? c.context.replace(/\s*\n\s*/g, ' · ') : '–'}</span>}</span>
                  <span className="tnum hidden text-right text-[12px] text-muted md:block" title={`${ns} session notes, ${histories} food histories`}>{ns} · {histories}</span>
                  <Icon name="chevronRight" className="hidden text-muted md:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {adding && <ClientForm onClose={() => setAdding(false)} onSaved={(c) => nav(`/c/${c.id}`)} />}
    </div>
  )
}
