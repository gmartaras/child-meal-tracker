import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClientForm, FEEDING_LABEL } from '../components/ClientForm'
import { TrendChart, type TrendPoint } from '../components/TrendChart'
import { StatusChip } from '../components/analysis'
import { AutoTextarea, Banner, Button, Card, Empty, Field, Icon, IconButton, Input, Modal, Select, SectionTitle, Segmented, Tabs, Textarea, confirmDialog, cx } from '../components/ui'
import { ageInMonths, formatAge, formatDate, todayISO, uid } from '../domain/age'
import { TYPE_LABEL, analyse, type Analysis } from '../domain/analysis'
import { referenceTargets, statusOf } from '../domain/drv'
import { GROUP_ORDER, NUTRIENTS, fmt, fmtNutrient } from '../domain/nutrients'
import type { Assessment, Client, Session } from '../domain/types'
import { exportClientExcel, exportClientRecord } from '../lib/export'
import { useStore } from '../store/store'
import { newDay } from './AssessmentPage'

// ---------- session note + measurements ----------
function SessionForm({ client, session, onClose }: { client: Client; session?: Session; onClose: () => void }) {
  const save = useStore((s) => s.saveSession)
  const del = useStore((s) => s.deleteSession)
  const [date, setDate] = useState(session?.date ?? todayISO())
  const [note, setNote] = useState(session?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [w, setW] = useState(session?.weightKg != null ? String(session.weightKg) : '')
  const [h, setH] = useState(session?.heightCm != null ? String(session.heightCm) : '')
  const num = (s: string) => {
    const x = parseFloat(s.replace(',', '.'))
    return isFinite(x) && x > 0 ? x : undefined
  }
  return (
    <Modal
      wide
      title={session ? 'Edit session note' : 'New session note'}
      onClose={onClose}
      footer={
        <>
          {session && <Button variant="danger" className="mr-auto" icon="trash" onClick={() => confirmDialog('Delete this session note and its measurements?') && (del(session.id), onClose())}>Delete</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving || (!note.trim() && !num(w) && !num(h))} onClick={async () => {
            setSaving(true)
            const ok = await save({id:session?.id, clientId:client.id, date, note:note.trim(), weightKg:num(w), heightCm:num(h)})
            setSaving(false)
            if (ok) onClose()
          }}>{saving ? 'Saving…' : 'Save session note'}</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date"><Input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
        <Field label="Weight (kg)"><Input inputMode="decimal" className="tnum" value={w} onChange={(e) => setW(e.target.value)} placeholder="optional" /></Field>
        <Field label="Length / height (cm)"><Input inputMode="decimal" className="tnum" value={h} onChange={(e) => setH(e.target.value)} placeholder="optional" /></Field>
      </div>
      <Field label="Session notes" className="mt-3">
        <Textarea autoFocus={!session} rows={10} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Concerns raised, observations, advice given, plan and follow-up…" />
      </Field>
    </Modal>
  )
}

// ---------- timeline ----------
function AssessmentCard({ a, analysis, panel }: { a: Assessment; analysis: Analysis; panel: string[] }) {
  const { result, targets } = analysis
  const flags = panel.filter((id) => targets[id] && id !== 'energy').map((id) => ({ id, st: statusOf(result.avg[id], targets[id]) }))
  const low = flags.filter((f) => f.st === 'low').length
  const off = flags.filter((f) => f.st === 'below' || f.st === 'above').length
  const e = targets.energy
  return (
    <Link to={`/c/${a.clientId}/a/${a.id}`} className="workspace-row block rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="apple" className="text-accent-ink" />
            <span className="truncate font-medium">{a.title || TYPE_LABEL[a.type]}</span>
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-2">{TYPE_LABEL[a.type]} · {result.itemCount} food line{result.itemCount === 1 ? '' : 's'}{a.type === 'diary' ? ` · ${result.nDays} day${result.nDays === 1 ? '' : 's'}` : ''}</div>
        </div>
        <Icon name="chevronRight" className="mt-1 text-muted" />
      </div>
      {result.nDays > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
          <span className="tnum"><span className="font-semibold">{fmt(result.avg.energy.v, 0)}</span> kcal/day{e ? ` · ${Math.round((result.avg.energy.v / e.value) * 100)}% of EAR` : ''}</span>
          {low > 0 && <span className="inline-flex items-center gap-1"><StatusChip status="low" compact /> {low} below LRNI</span>}
          {off > 0 && <span className="inline-flex items-center gap-1"><StatusChip status="below" compact /> {off} outside target</span>}
          {!low && !off && !flags.some(f => f.st === "unknown") && <span className="inline-flex items-center gap-1"><StatusChip status="met" compact /> all targets met</span>}
        </div>
      ) : (
        <div className="mt-2 text-[12.5px] text-muted">No foods entered yet</div>
      )}
      {a.note && <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-2">{a.note}</p>}
    </Link>
  )
}

function SessionCard({ s, client, onEdit }: { s: Session; client: Client; onEdit: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="note" className="text-ink-2" />
          <span className="font-medium">Session</span>
          <span className="text-[12.5px] text-muted">age {formatAge(ageInMonths(client.dob, s.date))}</span>
        </div>
        <IconButton icon="edit" label="Edit session" onClick={onEdit} className="-my-1" />
      </div>
      {(s.weightKg != null || s.heightCm != null) && (
        <div className="tnum mt-2 flex flex-wrap gap-2 text-[12.5px]">
          {s.weightKg != null && <span className="rounded-md bg-surface-2 px-2 py-0.5">Weight <span className="font-semibold">{fmt(s.weightKg, 2)} kg</span></span>}
          {s.heightCm != null && <span className="rounded-md bg-surface-2 px-2 py-0.5">Length / height <span className="font-semibold">{fmt(s.heightCm, 1)} cm</span></span>}
        </div>
      )}
      {s.note ? <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-wrap">{s.note}</p> : <p className="mt-2 text-[12.5px] text-muted">No notes</p>}
    </div>
  )
}

// ---------- progress ----------
function Progress({ client, rows, sessions, panel }: { client: Client; rows: { a: Assessment; an: Analysis }[]; sessions: Session[]; panel: string[] }) {
  const [mode, setMode] = useState<'pct' | 'abs'>('pct')
  const done = rows.filter((r) => r.a.state === "finalised" && !r.a.scenarioOf && r.an.result.nDays > 0).sort((x, y) => x.a.date.localeCompare(y.a.date))
  const weights: TrendPoint[] = sessions.filter((s) => s.weightKg != null).map((s) => ({ date: s.date, value: s.weightKg!, note: `age ${formatAge(ageInMonths(client.dob, s.date))}` }))
  const heights: TrendPoint[] = sessions.filter((s) => s.heightCm != null).map((s) => ({ date: s.date, value: s.heightCm!, note: `age ${formatAge(ageInMonths(client.dob, s.date))}` }))
  const shown = NUTRIENTS.filter((n) => panel.includes(n.id))
  const latest = done[done.length - 1]
  const prev = done[done.length - 2]

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle action={done.length > 0 ? <Segmented value={mode} onChange={setMode} options={[{ id: 'pct', label: '% of target' }, { id: 'abs', label: 'Amounts' }]} /> : undefined}>Nutrient intake over time</SectionTitle>
        {done.length === 0 ? (
          <Card><Empty icon="trend" title="No food histories yet">Trends appear here once a food history has been entered. Each one adds a point to every chart.</Empty></Card>
        ) : (
          <>
            {done.length === 1 && <div className="mb-3"><Banner>One food history so far. Add a follow-up history to see how intake changes between consultations.</Banner></div>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((n) => {
                const usePct = mode === 'pct' && done.some((r) => r.an.targets[n.id])
                const points: TrendPoint[] = done
                  .filter((r) => !usePct || r.an.targets[n.id])
                  .map((r) => {
                    const v = r.an.result.avg[n.id].v
                    const t = r.an.targets[n.id]
                    return { date: r.a.date, value: usePct ? (v / t.value) * 100 : v, note: usePct ? `${fmtNutrient(n.id, v)} ${n.unit} · ${r.a.title}` : r.a.title }
                  })
                const tLast = latest.an.targets[n.id]
                return (
                  <TrendChart
                    key={n.id}
                    title={n.short ?? n.label}
                    subtitle={usePct ? `% of ${tLast?.type === 'Max' ? 'maximum' : (tLast?.type ?? 'target')}` : `${n.unit} per day${mode === 'pct' ? ' · no reference value' : ''}`}
                    points={points}
                    unit={usePct ? '%' : n.unit}
                    dp={usePct ? 0 : n.dp}
                    reference={usePct ? 100 : undefined}
                    referenceLabel={tLast?.type === 'Max' ? 'max' : 'target'}
                  />
                )
              })}
            </div>
            {prev && (
              <Card className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <caption className="px-4 pt-3 pb-2 text-left text-[13px] font-semibold">Latest compared with previous</caption>
                  <thead>
                    <tr className="border-y border-line text-left text-[12px] text-ink-2">
                      <th className="px-4 py-2 font-medium">Nutrient</th>
                      <th className="px-3 py-2 text-right font-medium">{formatDate(prev.a.date)}</th>
                      <th className="px-3 py-2 text-right font-medium">{formatDate(latest.a.date)}</th>
                      <th className="px-3 py-2 text-right font-medium">Change</th>
                      <th className="px-4 py-2 font-medium">Now</th>
                    </tr>
                  </thead>
                  <tbody className="tnum divide-y divide-line">
                    {shown.map((n) => {
                      const a = prev.an.result.avg[n.id].v
                      const b = latest.an.result.avg[n.id].v
                      const d = b - a
                      const t = latest.an.targets[n.id]
                      return (
                        <tr key={n.id}>
                          <td className="px-4 py-1.5">{n.short ?? n.label} <span className="text-muted">({n.unit})</span></td>
                          <td className="px-3 py-1.5 text-right">{fmtNutrient(n.id, a)}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{fmtNutrient(n.id, b)}</td>
                          <td className="px-3 py-1.5 text-right text-ink-2">{Math.abs(d) < Math.pow(10, -n.dp) / 2 ? '–' : `${d > 0 ? '+' : '−'}${fmtNutrient(n.id, Math.abs(d))}`}</td>
                          <td className="px-4 py-1.5">{t ? <StatusChip status={statusOf(latest.an.result.avg[n.id], t)} target={t} /> : <span className="text-[12px] text-muted">No reference</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </section>
      <section>
        <SectionTitle>Growth measurements</SectionTitle>
        {weights.length + heights.length === 0 ? (
          <Card><Empty icon="ruler" title="No measurements yet">Add weight and length or height when you record a session.</Empty></Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <TrendChart title="Weight" points={weights} unit="kg" dp={2} height={150} />
              <TrendChart title="Length / height" points={heights} unit="cm" dp={1} height={150} />
            </div>
            <Card className="mt-3 overflow-x-auto">
              <table className="tnum w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-ink-2"><th className="px-4 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Age</th><th className="px-3 py-2 text-right font-medium">Weight (kg)</th><th className="px-4 py-2 text-right font-medium">Length / height (cm)</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...sessions].filter((s) => s.weightKg != null || s.heightCm != null).sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
                    <tr key={s.id}><td className="px-4 py-1.5">{formatDate(s.date)}</td><td className="px-3 py-1.5">{formatAge(ageInMonths(client.dob, s.date))}</td><td className="px-3 py-1.5 text-right">{s.weightKg != null ? fmt(s.weightKg, 2) : '–'}</td><td className="px-4 py-1.5 text-right">{s.heightCm != null ? fmt(s.heightCm, 1) : '–'}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <p className="mt-2 text-[12px] text-muted">Measurements are plotted as recorded. Use your UK-WHO growth charts for centiles.</p>
          </>
        )}
      </section>
    </div>
  )
}

// ---------- targets ----------
function Targets({ client }: { client: Client }) {
  const saveClient = useStore((s) => s.saveClient)
  const panel = useStore((s) => s.settings.panel)
  const age = ageInMonths(client.dob, todayISO())
  const ref = referenceTargets(age, client.sex, client.feeding)
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(client.targets ?? {}).map(([k, v]) => [k, String(v)])))
  const commit = (next: Record<string, string>) => {
    const targets: Record<string, number> = {}
    for (const [k, v] of Object.entries(next)) {
      const x = parseFloat(v.replace(',', '.'))
      if (isFinite(x) && x > 0) targets[k] = x
    }
    saveClient({ ...client, targets })
  }
  const shown = NUTRIENTS.filter((n) => panel.includes(n.id))
  return (
    <div>
      <Banner>Reference values for {client.firstName} today ({formatAge(age)}, {client.sex === 'M' ? 'boy' : 'girl'}). Type a custom target to replace a reference value for this child only, for example a higher energy target for catch-up growth. Custom targets apply to all of this child’s food histories.</Banner>
      <Card className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-2"><th className="px-4 py-2 font-medium">Nutrient</th><th className="px-3 py-2 font-medium">Reference value</th><th className="px-3 py-2 font-medium">LRNI</th><th className="px-3 py-2 font-medium">Source</th><th className="px-4 py-2 font-medium">Custom target</th></tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map((g) => shown.filter((n) => n.group === g).map((n) => {
              const t = ref[n.id]
              return (
                <tr key={n.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-1.5">{n.label} <span className="text-muted">({n.unit})</span></td>
                  <td className="tnum px-3 py-1.5">{t ? <>{t.value} <span className="text-muted">{t.type}</span></> : <span className="text-muted">none set for this age</span>}</td>
                  <td className="tnum px-3 py-1.5">{t?.lrni ?? <span className="text-muted">–</span>}</td>
                  <td className="px-3 py-1.5 text-[12px] text-muted">{t?.source ?? ''}</td>
                  <td className="px-4 py-1">
                    <input
                      inputMode="decimal"
                      aria-label={`Custom target for ${n.label}`}
                      value={vals[n.id] ?? ''}
                      placeholder="–"
                      onChange={(e) => setVals({ ...vals, [n.id]: e.target.value })}
                      onBlur={() => commit(vals)}
                      className={cx('tnum h-8 w-24 rounded-lg border bg-surface px-2 text-right text-sm focus:border-accent focus:outline-none', vals[n.id] ? 'border-accent' : 'border-line')}
                    />
                  </td>
                </tr>
              )
            }))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ---------- page ----------
function ClientContext({ client }: { client: Client }) {
  const saveContext = useStore((state) => state.saveContext)
  const [edit, setEdit] = useState<{ original: string; text: string } | null>(null)
  const [savedValue, setSavedValue] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const context = edit?.text ?? savedValue ?? client.context
  const original = edit?.original ?? savedValue ?? client.context
  const dirty = edit !== null && context !== original

  useEffect(() => {
    if (client.context === savedValue) setSavedValue(undefined)
  }, [client.context, savedValue])

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await saveContext(client.id, context, original)
      setSavedValue(context)
      setEdit(null)
      setMessage('Context saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your context. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <Field label="Key context" hint="Private notes about feeding, medical history or family priorities.">
        <AutoTextarea value={context} disabled={saving} onChange={(text) => {
          setEdit({ original, text })
          setMessage('')
        }} minRows={2} placeholder="Allergies, feeding concerns, medication or goals…" />
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save context'}</Button>
        <span className="text-sm text-ink-2" role="status">{message || (dirty ? 'Unsaved changes' : '')}</span>
      </div>
    </Card>
  )
}

const RESOURCE_CATEGORIES = ['Food diary', 'Accepted foods list', 'Questionnaire', 'Meal plan', 'Other handout']

function privateDriveLink(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname) || url.username || url.password) return
    if (!/^\/(?:file\/d\/|drive\/(?:u\/\d+\/)?folders\/|(?:document|spreadsheets|presentation|forms)\/d\/)/.test(url.pathname)) return
    return url.href
  } catch {
    return undefined
  }
}

function ClientResources({ client }: { client: Client }) {
  const save = useStore(s => s.saveResources)
  const [category, setCategory] = useState(RESOURCE_CATEGORIES[0])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const resources = client.resources ?? []
  const saveList = async (list: NonNullable<Client['resources']>) => {
    setPending(true)
    const ok = await save(client, list)
    setPending(false)
    setStatus(ok ? 'Files and handouts updated.' : 'Changes could not be saved. Your entry is still here.')
    return ok
  }

  return <details className="mt-4 rounded-xl border border-line bg-surface p-4">
    <summary className="cursor-pointer font-semibold">Files and handouts</summary>
    <p className="my-3 text-sm text-ink-2">Link the family's completed diary, questionnaires and handouts in your practice Drive. File permissions are managed in Drive.</p>
    <ul className="mb-3 space-y-2">{resources.map(resource => {
      const href = privateDriveLink(resource.url)
      return <li key={resource.id} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{resource.category}</span>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">{resource.title}</a> : <span>{resource.title}</span>}
        <Button size="sm" disabled={pending} onClick={() => void saveList(resources.filter(r=>r.id!==resource.id))}>Remove link</Button>
      </li>
    })}</ul>
    <form className="grid gap-2 sm:grid-cols-3" onSubmit={async event=>{
      event.preventDefault()
      const link = privateDriveLink(url.trim())
      if (!link || !title.trim()) {setStatus('Enter a title and a Google Drive or Docs link.'); return}
      if (await saveList([...resources, {id:uid(), title:title.trim(), url:link, category}])) {setTitle(''); setUrl('')}
    }}>
      <Field label="File type"><Select value={category} onChange={e=>setCategory(e.target.value)}>{RESOURCE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</Select></Field>
      <Field label="Title"><Input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/></Field>
      <Field label="Google Drive link"><Input type="url" value={url} onChange={e=>setUrl(e.target.value)}/></Field>
      <Button type="submit" size="sm" disabled={pending}>Add link</Button>
    </form>
    <p role="status" className="mt-2 text-sm">{status}</p>
  </details>
}

export default function ClientPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const allAssessments = useStore((s) => s.assessments)
  const allSessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const saveClient = useStore((s) => s.saveClient)
  const deleteClient = useStore((s) => s.deleteClient)
  const [tab, setTab] = useState<'timeline' | 'progress' | 'targets'>('timeline')
  const [modal, setModal] = useState<null | 'session' | 'edit'>(null)
  const [creatingHistory, setCreatingHistory] = useState(false)
  const saveAssessment = useStore(s => s.saveAssessment)
  const [editing, setEditing] = useState<Session | undefined>()
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    setTab('timeline')
    setMenu(false)
  }, [id])

  const assessments = useMemo(() => allAssessments.filter((a) => a.clientId === id), [allAssessments, id])
  const sessions = useMemo(() => allSessions.filter((s) => s.clientId === id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt), [allSessions, id])
  const rows = useMemo(() => (client ? assessments.map((a) => ({ a, an: analyse(a, client, settings) })) : []), [assessments, client, settings])

  if (!client) return <div className="p-8"><Empty icon="users" title="Client not found" action={<Button onClick={() => nav('/')}>Back to clients</Button>} /></div>

  const age = ageInMonths(client.dob, todayISO())
  const startHistory = async () => {
    setCreatingHistory(true)
    const now = Date.now()
    const assessment: Assessment = {
      id: uid(), clientId: client.id, type: 'diary', title: '3-day food diary',
      date: todayISO(), state: 'draft', createdAt: now, updatedAt: now,
      days: Array.from({length: 3}, (_, i) => newDay(`Day ${i + 1}`, 'diary')),
    }
    if (await saveAssessment(assessment)) nav(`/c/${client.id}/a/${assessment.id}`)
    setCreatingHistory(false)
  }
  type Entry = { date: string; at: number; s?: Session; r?: { a: Assessment; an: Analysis } }
  const entries: Entry[] = [...sessions.map((s) => ({ date: s.date, at: s.createdAt, s })), ...rows.map((r) => ({ date: r.a.date, at: r.a.createdAt, r }))].sort((x, y) => y.date.localeCompare(x.date) || y.at - x.at)
  const byDate: { date: string; items: Entry[] }[] = []
  for (const e of entries) {
    const last = byDate[byDate.length - 1]
    if (last && last.date === e.date) last.items.push(e)
    else byDate.push({ date: e.date, items: [e] })
  }

  return (
    <div className="app-page">
      <div className="workspace-hero flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-line p-5 sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-accent-wash text-xl font-semibold text-accent-ink">{client.firstName.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0">
          <h1 className="page-title truncate text-2xl font-semibold sm:text-3xl">{client.firstName}{client.archived && <span className="ml-2 align-middle text-[12px] font-medium text-muted">archived</span>}</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-2">
            {formatAge(age)} · {client.sex === 'M' ? 'Boy' : 'Girl'} · born {formatDate(client.dob)}{client.feeding !== 'na' ? ` · ${FEEDING_LABEL[client.feeding]}` : ''} · <span className="tnum">{client.code}</span>
          </p>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <Button variant="primary" icon="plus" disabled={creatingHistory} onClick={startHistory}>Add food history</Button>
          <Button icon="note" onClick={() => (setEditing(undefined), setModal('session'))}>Add session note</Button>
          <Button aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label="More actions">More <Icon name="chevronDown" size={14} /></Button>
          {menu && (
            <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-56 rounded-lg border border-line bg-surface py-1 shadow-card" onMouseLeave={() => setMenu(false)}>
              {[
                { icon: 'edit', label: 'Edit client details', fn: () => setModal('edit') },
                { icon: 'download', label: 'Download client record (JSON)', fn: () => exportClientRecord(client, assessments, sessions) },
                { icon: 'download', label: 'Export to Excel', fn: () => exportClientExcel(client, assessments, sessions, settings) },
                { icon: 'users', label: client.archived ? 'Restore from archive' : 'Archive client', fn: () => saveClient({ ...client, archived: !client.archived }) },
                { icon: 'trash', label: 'Delete client and all data', danger: true, fn: () => confirmDialog(`Permanently delete ${client.firstName} (${client.code}) with all food histories, sessions and notes? This cannot be undone.`) && (deleteClient(client.id), nav('/')) },
              ].map((m) => (
                <button key={m.label} role="menuitem" type="button" onClick={() => (setMenu(false), m.fn())} className={cx('flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] hover:bg-surface-2', m.danger && 'text-critical-ink')}>
                  <Icon name={m.icon} size={15} /> {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-2">
      <ClientContext key={`context-${client.id}`} client={client} />
      <Card className="p-5">
        <SectionTitle action={<Button size="sm" icon="plus" onClick={() => {setEditing(undefined); setModal('session')}}>Add session note</Button>}>Session notes</SectionTitle>
        <p className="mb-3 text-sm text-ink-2">Record what the family reported, what you discussed and what to follow up. These notes stay in the client record.</p>
        {sessions.length ? <SessionCard s={sessions[0]} client={client} onEdit={() => {setEditing(sessions[0]); setModal('session')}} /> : <p className="text-sm text-muted">No session notes yet.</p>}
        {!!client.goals?.length && <details className="mt-3 text-sm"><summary>Previously recorded actions</summary><ul className="mt-2 list-disc pl-5">{client.goals.map(goal => <li key={goal.id}>{goal.text}{goal.due && ` · review ${goal.due}`}{goal.done && ' · completed'}{goal.outcome && ` · ${goal.outcome}`}</li>)}</ul></details>}
      </Card>
      </div>
      <ClientResources key={`resources-${client.id}`} client={client} />
      <Tabs className="mt-6 mb-5" value={tab} onChange={setTab} tabs={[{ id: 'timeline', label: 'Timeline', count: entries.length }, { id: 'progress', label: 'Progress' }, { id: 'targets', label: 'Targets' }]} />

      {tab === 'timeline' &&
        (entries.length === 0 ? (
          <Card>
            <Empty icon="apple" title={`Start ${client.firstName}’s record`} action={<div className="flex gap-2"><Button variant="primary" icon="plus" disabled={creatingHistory} onClick={startHistory}>Add food history</Button><Button icon="note" onClick={() => setModal('session')}>Add session note</Button></div>}>
              Enter a food history to analyse intake, or record a session with notes and measurements.
            </Empty>
          </Card>
        ) : (
          <ol className="space-y-5">
            {byDate.map((g) => (
              <li key={g.date} className="grid gap-2 sm:grid-cols-[112px_1fr] sm:gap-4">
                <div className="pt-1 text-[13px] font-medium text-ink-2 sm:text-right">{formatDate(g.date)}</div>
                <div className="space-y-2">
                  {g.items.map((e) => (e.s ? <SessionCard key={e.s.id} s={e.s} client={client} onEdit={() => (setEditing(e.s), setModal('session'))} /> : <AssessmentCard key={e.r!.a.id} a={e.r!.a} analysis={e.r!.an} panel={settings.panel} />))}
                </div>
              </li>
            ))}
          </ol>
        ))}
      {tab === 'progress' && <Progress client={client} rows={rows} sessions={sessions} panel={settings.panel} />}
      {tab === 'targets' && <Targets key={client.id} client={client} />}

      {modal === 'session' && <SessionForm client={client} session={editing} onClose={() => setModal(null)} />}
      {modal === 'edit' && <ClientForm client={client} onClose={() => setModal(null)} />}
    </div>
  )
}
