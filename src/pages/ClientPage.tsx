import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ClientForm, FEEDING_LABEL } from '../components/ClientForm'
import { MacroBar, StatusChip } from '../components/analysis'
import { GapBars, GroupBar, LimitBars, StatTiles } from '../components/nutritionCharts'
import { TrendChart, type TrendPoint } from '../components/TrendChart'
import { Button, Card, Empty, Field, Icon, IconButton, Input, Modal, Select, Tabs, Textarea, confirmDialog, cx } from '../components/ui'
import { ageInMonths, formatAge, formatDate, todayISO, uid } from '../domain/age'
import { TYPE_LABEL, analyse, type Analysis } from '../domain/analysis'
import { statusOf } from '../domain/drv'
import { gapsOf, limitsOf, snapshotOf, type Snapshot } from '../domain/explore'
import { NUTRIENT_BY_ID, fmt } from '../domain/nutrients'
import { DEFAULT_CHECKLIST, FOOD_GROUPS, SESSION_KINDS, type Assessment, type Client, type Session, type SessionSections } from '../domain/types'
import { exportClientExcel, exportClientJson } from '../lib/export'
import { useStore } from '../store/store'
import { newAssessment } from './AssessmentPage'
import { AcceptedFoods } from './client/AcceptedFoods'
import { Explorer } from './client/Explorer'
import { MealPlan } from './client/MealPlan'
import { Sensory } from './client/Sensory'

type Tab = 'overview' | 'nutrition' | 'sessions' | 'food' | 'accepted' | 'plan' | 'sensory'

const SECTION_LABELS: [keyof SessionSections, string, string][] = [
  ['concerns', 'What the parents shared', 'Concerns, what has happened since last time, what is going well…'],
  ['observations', 'Observations', 'From the conversation, mealtime videos, the food history…'],
  ['advice', 'Advice and strategies discussed', 'What you explained or suggested…'],
  ['actions', 'Agreed actions before the next session', 'One per line: what the family will try, what you will send…'],
]

// ---------- session ----------
function SessionForm({ client, session, onClose }: { client: Client; session?: Session; onClose: () => void }) {
  const save = useStore((s) => s.saveSession)
  const del = useStore((s) => s.deleteSession)
  const count = useStore((s) => s.sessions.filter((x) => x.clientId === client.id).length)
  const [date, setDate] = useState(session?.date ?? todayISO())
  const [kind, setKind] = useState(session?.kind ?? (count === 0 ? SESSION_KINDS[0] : SESSION_KINDS[1]))
  const [sections, setSections] = useState<SessionSections>(session?.sections ?? {})
  const [note, setNote] = useState(session?.note ?? '')
  const [w, setW] = useState(session?.weightKg != null ? String(session.weightKg) : '')
  const [h, setH] = useState(session?.heightCm != null ? String(session.heightCm) : '')
  const [busy, setBusy] = useState(false)
  const num = (s: string) => {
    const x = parseFloat(s.replace(',', '.'))
    return isFinite(x) && x > 0 ? x : undefined
  }
  const trimmed = Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, (v ?? '').trim()]).filter(([, v]) => v)) as SessionSections
  return (
    <Modal
      wide
      title={session ? 'Edit session notes' : 'New session notes'}
      onClose={onClose}
      footer={
        <>
          {session && <Button variant="danger" className="mr-auto" icon="trash" onClick={() => confirmDialog('Delete these session notes and their measurements?') && (del(session.id), onClose())}>Delete</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={async () => { setBusy(true); const ok = await save({ id: session?.id, clientId: client.id, date, kind, sections: trimmed, note: note.trim(), weightKg: num(w), heightCm: num(h) }); setBusy(false); if (ok) onClose() }}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date"><Input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value)}>{SESSION_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Field>
        <Field label="Weight (kg)"><Input inputMode="decimal" className="tnum" value={w} onChange={(e) => setW(e.target.value)} placeholder="if reported" /></Field>
        <Field label="Height (cm)"><Input inputMode="decimal" className="tnum" value={h} onChange={(e) => setH(e.target.value)} placeholder="if reported" /></Field>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {SECTION_LABELS.map(([key, label, ph], i) => (
          <Field key={key} label={label}>
            <Textarea autoFocus={!session && i === 0} rows={5} value={sections[key] ?? ''} onChange={(e) => setSections({ ...sections, [key]: e.target.value })} placeholder={ph} />
          </Field>
        ))}
      </div>
      <Field label="Anything else" className="mt-3"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <p className="mt-2 text-[12px] text-muted">Fill in only what is useful. Agreed actions from the most recent session are shown on the client’s overview.</p>
    </Modal>
  )
}

function SessionCard({ s, client, onEdit }: { s: Session; client: Client; onEdit: () => void }) {
  const filled = SECTION_LABELS.filter(([k]) => s.sections?.[k])
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="text-[14px] font-semibold">{formatDate(s.date)}</span>
          <span className="text-[13px] text-ink-2">{s.kind ?? 'Session'}</span>
          <span className="text-[12.5px] text-muted">age {formatAge(ageInMonths(client.dob, s.date))}</span>
          {s.weightKg != null && <span className="tnum rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px]">{fmt(s.weightKg, 2)} kg</span>}
          {s.heightCm != null && <span className="tnum rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px]">{fmt(s.heightCm, 1)} cm</span>}
        </div>
        <Button size="sm" variant="ghost" icon="edit" onClick={onEdit} className="-my-1">Edit</Button>
      </div>
      {filled.length > 0 && (
        <div className={cx('mt-3 grid gap-x-6 gap-y-3', filled.length > 1 && 'lg:grid-cols-2')}>
          {filled.map(([k, label]) => (
            <div key={k}>
              <div className="mb-0.5 text-[12px] font-medium text-muted">{label}</div>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{s.sections![k]}</p>
            </div>
          ))}
        </div>
      )}
      {s.note && <p className={cx('text-[13.5px] leading-relaxed whitespace-pre-wrap', filled.length ? 'mt-3 border-t border-line pt-3' : 'mt-2')}>{s.note}</p>}
      {!filled.length && !s.note && <p className="mt-2 text-[12.5px] text-muted">No notes written.</p>}
    </Card>
  )
}

// ---------- food history card ----------
function AssessmentCard({ a, analysis, panel, provisional }: { a: Assessment; analysis: Analysis; panel: string[]; provisional?: boolean }) {
  const { result, targets } = analysis
  const flags = panel.filter((id) => targets[id] && id !== 'energy').map((id) => statusOf(result.avg[id], targets[id]))
  const low = flags.filter((f) => f === 'low').length
  const off = flags.filter((f) => f === 'below' || f === 'above').length
  return (
    <Link to={`/c/${a.clientId}/a/${a.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[14px] font-semibold">{a.title || TYPE_LABEL[a.type]}</span>
          <span className={cx('rounded-full px-1.5 py-0.5 text-[11px] font-medium', a.state === 'finalised' ? 'bg-good-wash text-good-ink' : 'bg-surface-2 text-ink-2')}>{a.scenarioOf ? 'Scenario' : a.state === 'finalised' ? 'Finalised' : a.amendmentOf ? 'Amendment draft' : 'Draft'}</span>
          <span className="text-[12.5px] text-ink-2">{formatDate(a.date)} · {TYPE_LABEL[a.type]} · {result.itemCount} food{result.itemCount === 1 ? '' : 's'}{a.type === 'diary' ? ` over ${result.nDays} day${result.nDays === 1 ? '' : 's'}` : ''}</span>
        </div>
        {result.nDays > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <span className="tnum"><span className="font-semibold">{result.avg.energy.missing.length ? '≥ ' : ''}{fmt(result.avg.energy.v, 0)}</span> kcal/day</span>
            {provisional && <span className="text-warning-ink">includes unconfirmed days</span>}
            {low > 0 && <span className="inline-flex items-center gap-1"><StatusChip status="low" compact /> {low} below LRNI</span>}
            {off > 0 && <span className="inline-flex items-center gap-1"><StatusChip status="below" compact /> {off} outside target</span>}
            {!Object.keys(targets).length && <span>Reference values unavailable</span>}
            {!!Object.keys(targets).length && !low && !off && <span className="inline-flex items-center gap-1"><StatusChip status="met" compact /> all targets met</span>}
          </div>
        ) : (
          <div className="mt-1 text-[12.5px] text-muted">No foods with amounts yet</div>
        )}
      </div>
      <Icon name="chevronRight" className="text-muted" />
    </Link>
  )
}

// ---------- overview: nutrition at a glance ----------
function NutritionSnapshot({ client, snaps, onExplore }: { client: Client; snaps: { a: Assessment; snap: Snapshot }[]; onExplore: (nutrient?: string) => void }) {
  const panel = useStore((s) => s.settings.panel)
  const latest = snaps[0]
  if (!latest) {
    return (
      <Card className="p-5">
        <h2 className="text-[13px] font-semibold">Nutrition</h2>
        <p className="mt-1 text-[13px] text-ink-2">Enter a food history, or list the foods the child eats in the nutrient explorer, to see intake against UK reference values here.</p>
        <Button size="sm" className="mt-3" icon="trend" onClick={() => onExplore()}>Open nutrient explorer</Button>
      </Card>
    )
  }
  const { analysis } = latest.snap
  const gaps = gapsOf(analysis.result.avg, analysis.targets, panel)
  const limits = limitsOf(analysis.result.avg, analysis.targets)
  const n = (s: string) => gaps.filter((g) => g.status === s).length
  const kcal = analysis.result.avg.energy.v
  const ear = analysis.targets.energy?.value
  const prev = snaps[1]
  // trend lines for energy and the three nutrients furthest from target, across every analysable history
  const series = snaps.slice().reverse()
  const trendIds = ['energy', ...gaps.filter((g) => g.id !== 'energy').slice(0, 3).map((g) => g.id)]
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold">Nutrition</h2>
          <p className="text-[12px] text-ink-2">
            <Link to={`/c/${client.id}/a/${latest.a.id}`} className="font-medium text-accent-ink hover:underline">{latest.a.title}</Link> · {formatDate(latest.a.date)} · average of {latest.snap.days} day{latest.snap.days === 1 ? '' : 's'}
            {latest.snap.provisional && <span className="text-warning-ink"> · includes unconfirmed days</span>}
          </p>
        </div>
        <Button size="sm" icon="trend" onClick={() => onExplore()}>Explore and plan</Button>
      </div>
      <StatTiles items={[
        { label: 'Energy per day', value: fmt(kcal, 0), sub: ear ? `${fmt((kcal / ear) * 100, 0)}% of EAR (${ear} kcal)` : 'kcal' },
        { label: 'Below LRNI', value: String(n('low')), sub: 'likely inadequate', tone: n('low') ? 'critical' : undefined },
        { label: 'Below target', value: String(n('below')), sub: 'nutrients', tone: n('below') ? 'warning' : undefined },
        { label: 'Meeting target', value: String(n('met')), sub: `of ${gaps.length} with a target`, tone: 'good' },
      ]} />
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h3 className="mb-1.5 text-[12px] font-medium text-ink-2">Furthest from target (select one to find foods that boost it)</h3>
          <GapBars gaps={gaps} show={8} compact onSelect={(id) => onExplore(id)} />
        </div>
        <div className="space-y-4">
          {analysis.result.energyPct && (
            <div>
              <h3 className="mb-1.5 text-[12px] font-medium text-ink-2">Where the energy comes from</h3>
              <MacroBar pct={analysis.result.energyPct} />
            </div>
          )}
          {limits.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[12px] font-medium text-ink-2">Keep below the maximum</h3>
              <LimitBars limits={limits} />
            </div>
          )}
          {gaps[0] && analysis.result.sources[gaps[0].id]?.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[12px] font-medium text-ink-2">Main sources of {gaps[0].label} now</h3>
              <ul className="space-y-0.5 text-[12.5px]">
                {analysis.result.sources[gaps[0].id].slice(0, 4).map((s) => <li key={s.name} className="flex justify-between gap-2"><span className="truncate">{s.name}</span><span className="tnum shrink-0 text-ink-2">{fmt((s.value / (analysis.result.avg[gaps[0].id].v || 1)) * 100, 0)}%</span></li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
      {series.length > 1 && (
        <div className="mt-5">
          <h3 className="mb-1.5 text-[12px] font-medium text-ink-2">Over time · % of target{prev ? ` · ${series.length} food histories` : ''}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {trendIds.map((id) => {
              const points: TrendPoint[] = series.filter((r) => r.snap.analysis.targets[id]).map((r) => ({ date: r.a.date, value: (r.snap.analysis.result.avg[id].v / r.snap.analysis.targets[id].value) * 100, note: `${r.a.title}${r.snap.provisional ? ' (unconfirmed days)' : ''}` }))
              return points.length > 1 ? <TrendChart key={id} title={NUTRIENT_BY_ID[id]?.short ?? NUTRIENT_BY_ID[id]?.label ?? id} subtitle={id === 'energy' ? '% of EAR' : '% of target'} points={points} unit="%" reference={100} referenceLabel="target" height={120} /> : null
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

const DAY_MS = 86_400_000
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS)
function ago(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  return `${Math.round(days / 30.4)} months ago`
}

/** How often and when the family has been seen: counts, a timeline and the most recent sessions. */
function SessionHistory({ sessions, onOpen, onNew }: { sessions: Session[]; onOpen: () => void; onNew: () => void }) {
  const today = todayISO()
  if (!sessions.length) {
    return (
      <Card className="p-4">
        <h2 className="text-[13px] font-semibold">Sessions with the family</h2>
        <p className="mt-1 text-[13px] text-muted">No sessions recorded yet.</p>
        <Button size="sm" icon="plus" className="mt-2" onClick={onNew}>New session note</Button>
      </Card>
    )
  }
  const asc = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const first = asc[0].date
  const last = asc[asc.length - 1].date
  const span = Math.max(daysBetween(first, today), 1)
  const gaps = asc.slice(1).map((s, i) => daysBetween(asc[i].date, s.date))
  const avgGap = gaps.length ? gaps.reduce((n, g) => n + g, 0) / gaps.length : null
  const kinds = SESSION_KINDS.map((k) => ({ k, n: sessions.filter((s) => (s.kind ?? 'Other') === k).length })).filter((x) => x.n)
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold">Sessions with the family</h2>
        <button type="button" className="text-[12.5px] font-medium text-accent-ink hover:underline" onClick={onOpen}>All notes</button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-line px-2 py-1.5"><div className="tnum text-lg font-semibold">{sessions.length}</div><div className="text-[11px] text-muted">session{sessions.length === 1 ? '' : 's'}</div></div>
        <div className="rounded-lg border border-line px-2 py-1.5"><div className="text-[13px] leading-7 font-semibold">{daysBetween(last, today) <= 1 ? ago(daysBetween(last, today)) : ago(daysBetween(last, today)).replace(' ago', '')}</div><div className="text-[11px] text-muted">{daysBetween(last, today) <= 1 ? 'last contact' : 'since last contact'}</div></div>
        <div className="rounded-lg border border-line px-2 py-1.5"><div className="text-[13px] leading-7 font-semibold">{avgGap != null ? (avgGap < 14 ? `${Math.round(avgGap)} days` : `${fmt(avgGap / 7, 0)} weeks`) : '–'}</div><div className="text-[11px] text-muted">typical gap</div></div>
      </div>
      <div className="relative mt-4 mb-1 h-6" role="img" aria-label={`${sessions.length} sessions from ${formatDate(first)} to ${formatDate(last)}`}>
        <div className="absolute inset-x-0 top-2.5 h-px bg-line-strong" />
        {asc.map((s) => (
          <span key={s.id} title={`${formatDate(s.date)} · ${s.kind ?? 'Session'}`} className={cx('absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-surface', s.kind === 'Initial consultation' ? 'bg-accent' : s.kind === 'Follow-up' ? 'bg-series-1' : 'bg-muted')} style={{ left: `${(daysBetween(first, s.date) / span) * 100}%` }} />
        ))}
        <span className="absolute top-0 right-0 h-6 w-px bg-ink" title="Today" />
      </div>
      <div className="flex justify-between text-[11px] text-muted"><span>{formatDate(first)}</span><span>today</span></div>
      <ul className="mt-3 divide-y divide-line text-[12.5px]">
        {sessions.slice(0, 5).map((s) => {
          const has = Object.values(s.sections ?? {}).some(Boolean) || !!s.note
          return (
            <li key={s.id}>
              <button type="button" onClick={onOpen} className="flex w-full items-baseline gap-2 py-1.5 text-left hover:text-ink">
                <span className="tnum w-24 shrink-0 font-medium">{formatDate(s.date)}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{s.kind ?? 'Session'}</span>
                {s.weightKg != null && <span className="tnum shrink-0 text-muted">{fmt(s.weightKg, 1)} kg</span>}
                {s.sections?.actions && <span className="shrink-0 rounded bg-surface-2 px-1 text-[11px] text-ink-2" title="Actions agreed">actions</span>}
                {!has && <span className="shrink-0 text-[11px] text-muted">no notes</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {sessions.length > 5 && <p className="mt-1 text-[11.5px] text-muted">+ {sessions.length - 5} earlier</p>}
      <p className="mt-2 text-[11.5px] text-muted">{kinds.map((x) => `${x.n} ${x.k.toLowerCase()}`).join(' · ')} · first seen {ago(daysBetween(first, today))}</p>
    </Card>
  )
}

function GrowthAndRange({ client, sessions }: { client: Client; sessions: Session[] }) {
  const weights: TrendPoint[] = sessions.filter((s) => s.weightKg != null).map((s) => ({ date: s.date, value: s.weightKg!, note: `age ${formatAge(ageInMonths(client.dob, s.date))}` }))
  const heights: TrendPoint[] = sessions.filter((s) => s.heightCm != null).map((s) => ({ date: s.date, value: s.heightCm!, note: `age ${formatAge(ageInMonths(client.dob, s.date))}` }))
  const accepted = client.acceptedFoods ?? []
  const groups = FOOD_GROUPS.slice(0, 5).map((label, i) => ({ label: label.replace(' (or fortified alternatives)', '').replace(', beans and other protein', ', beans'), count: accepted.filter((f) => f.group === i).length }))
  return (
    <>
      <Card className="p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold">Accepted foods</h2>
          <span className="tnum text-[12px] text-muted">{accepted.length} food{accepted.length === 1 ? '' : 's'}</span>
        </div>
        <GroupBar groups={groups} />
      </Card>
      {(weights.length > 0 || heights.length > 0) && (
        <div className="grid gap-3">
          {weights.length > 0 && <TrendChart title="Weight" points={weights} unit="kg" dp={2} height={120} />}
          {heights.length > 0 && <TrendChart title="Length / height" points={heights} unit="cm" dp={1} height={120} />}
          <p className="text-[11.5px] text-muted">Plotted as recorded in session notes. Use UK-WHO charts for centiles.</p>
        </div>
      )}
    </>
  )
}

// ---------- overview ----------
function KeyContext({ client }: { client: Client }) {
  const saveContext = useStore((s) => s.saveContext)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(client.context)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const save = async () => {
    setBusy(true)
    setProblem('')
    try {
      // writes only the context field, and refuses if it was changed elsewhere since this page loaded it
      await saveContext(client.id, text.trim(), client.context ?? '')
      setEditing(false)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save. Your text is still here; try again.')
    }
    setBusy(false)
  }
  useEffect(() => {
    setEditing(false)
    setText(client.context)
  }, [client.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card className="p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Key context</h2>
        {!editing && <Button size="sm" variant="ghost" icon="edit" className="-my-1.5" onClick={() => (setText(client.context), setEditing(true))}>{client.context ? 'Edit' : 'Add'}</Button>}
      </div>
      {editing ? (
        <>
          <Textarea autoFocus rows={Math.max(4, text.split('\n').length + 1)} value={text} onChange={(e) => setText(e.target.value)} placeholder="Allergies, diagnoses, medication, goals… Leave out names and anything that identifies the family." />
          <div className="mt-2 flex justify-end gap-2">
            {problem && <span className="mr-auto text-[12.5px] text-critical-ink" role="alert">{problem}</span>}
            <Button size="sm" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </>
      ) : client.context ? (
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{client.context}</p>
      ) : (
        <p className="text-[13px] text-muted">Nothing noted yet. Use this for what you want to see every time you open the record.</p>
      )}
    </Card>
  )
}

function Checklist({ client }: { client: Client }) {
  const patchClient = useStore((s) => s.patchClient)
  const items = useStore((s) => s.settings.checklist) ?? DEFAULT_CHECKLIST
  const done = client.checklist ?? {}
  const toggle = (label: string) => {
    // built from the latest saved copy, so quick successive ticks all persist
    void patchClient(client.id, (latest) => {
      const next = { ...(latest.checklist ?? {}) }
      if (next[label]) delete next[label]
      else next[label] = todayISO()
      return { checklist: next }
    })
  }
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Process checklist</h2>
        <span className="tnum text-[12px] text-muted">{items.filter((i) => done[i]).length} of {items.length}</span>
      </div>
      <ul className="space-y-0.5">
        {items.map((label) => (
          <li key={label}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover:bg-surface-2">
              <input type="checkbox" checked={Boolean(done[label])} onChange={() => toggle(label)} className="h-4 w-4 accent-[var(--ink)]" />
              <span className={cx('flex-1 text-[13.5px]', done[label] && 'text-ink-2')}>{label}</span>
              {done[label] && <span className="tnum text-[11.5px] text-muted">{formatDate(done[label])}</span>}
            </label>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function RecordDetails({ client, onEdit }: { client: Client; onEdit: () => void }) {
  const retentionAge = useStore((s) => s.settings.retentionAge) ?? 25
  const y = Number(client.dob.slice(0, 4)) + retentionAge
  const reviewOn = client.dob ? `${y}${client.dob.slice(4)}` : ''
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]"><dt className="text-ink-2">{label}</dt><dd className="text-right">{value}</dd></div>
  )
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Record</h2>
        <Button size="sm" variant="ghost" icon="edit" className="-my-1.5" onClick={onEdit}>Edit</Button>
      </div>
      <dl className="divide-y divide-line">
        {row('Shared folder', client.folderUrl ? <a href={client.folderUrl} target="_blank" rel="noreferrer noopener" className="font-medium text-accent-ink hover:underline">Open folder <Icon name="external" size={12} className="inline align-[-1px]" /></a> : <span className="text-muted">not linked</span>)}
        {row('Privacy notice given', client.privacyNoticeOn ? formatDate(client.privacyNoticeOn) : <span className="text-warning-ink">not recorded</span>)}
        {row('Discharged', client.dischargedOn ? formatDate(client.dischargedOn) : <span className="text-muted">active</span>)}
        {row('Keep record until', <span title={`Age ${retentionAge}, set in Settings → Data protection`}>{reviewOn ? formatDate(reviewOn) : 'Date of birth needed'}</span>)}
      </dl>
    </Card>
  )
}

// ---------- page ----------
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
  const save = useStore(s => s.patchClient)
  const [category, setCategory] = useState(RESOURCE_CATEGORIES[0])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const resources = client.resources ?? []
  const saveList = async (list: NonNullable<Client['resources']>) => {
    setPending(true)
    const ok = await save(client.id, { resources: list })
    setPending(false)
    setStatus(ok ? 'Files and handouts updated.' : 'Changes could not be saved. Your entry is still here.')
    return ok
  }

  return <details className="rounded-xl border border-line bg-surface p-4">
    <summary className="cursor-pointer font-semibold">Files and handouts <span className="text-sm font-normal text-muted">({resources.length})</span></summary>
    <p className="my-3 text-sm text-ink-2">Read imported documents here. Photos and videos open in a private Drive preview.</p>
    <ul className="mb-3 space-y-2">{resources.map(resource => {
      const href = privateDriveLink(resource.url)
      const preview = href && ['photo', 'video', 'pdf'].includes(resource.media ?? '')
        ? new URL(href).pathname.match(/^\/file\/d\/([\w-]+)\/view\/?$/)?.[1] : undefined
      return <li key={resource.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2.5">
        <span className="text-sm text-muted">{resource.category}</span>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">{resource.title}</a> : <span>{resource.title}</span>}
        <Button size="sm" disabled={pending} onClick={() => {
          if ((resource.text || resource.media) && !confirmDialog('Remove this file from the client record? The original in Drive will remain.')) return
          void saveList(resources.filter(r=>r.id!==resource.id))
        }}>Remove file</Button>
        {resource.text && <details className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Read in Mealtrace</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans leading-relaxed text-ink-2">{resource.text}</pre>
        </details>}
        {preview && <DriveResourcePreview id={preview} title={resource.title} />}
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

function DriveResourcePreview({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false)
  return <div className="w-full">
    <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close preview' : 'Preview in Mealtrace'}</Button>
    {open && <iframe title={title} src={`https://drive.google.com/file/d/${id}/preview`} referrerPolicy="no-referrer" allowFullScreen className="mt-2 aspect-video w-full rounded-lg border border-line" />}
  </div>
}

export default function ClientPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const allAssessments = useStore((s) => s.assessments)
  const allSessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const patchClient = useStore((s) => s.patchClient)
  const saveAssessment = useStore((s) => s.saveAssessment)
  const deleteClient = useStore((s) => s.deleteClient)
  const logAudit = useStore((s) => s.logAudit)
  const [modal, setModal] = useState<null | 'session' | 'edit'>(null)
  const [editing, setEditing] = useState<Session | undefined>()
  const [menu, setMenu] = useState(false)
  const asked = params.get('tab')
  const tab: Tab = (['nutrition', 'sessions', 'food', 'accepted', 'plan', 'sensory'] as const).find((t) => t === asked) ?? 'overview'
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })

  useEffect(() => setMenu(false), [id])

  const assessments = useMemo(() => allAssessments.filter((a) => a.clientId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [allAssessments, id])
  const sessions = useMemo(() => allSessions.filter((s) => s.clientId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [allSessions, id])
  const rows = useMemo(() => (client ? assessments.map((a) => {
    const snap = snapshotOf(a, client, settings)
    return { a, an: snap?.analysis ?? analyse(a, client, settings), provisional: !!snap?.provisional }
  }) : []), [assessments, client, settings])
  const snaps = useMemo(() => (client ? assessments.filter((a) => !a.scenarioOf).flatMap((a) => {
    const snap = snapshotOf(a, client, settings)
    return snap ? [{ a, snap }] : []
  }) : []), [assessments, client, settings])
  const explore = (nutrient?: string) => {
    if (nutrient && client) void patchClient(client.id, (latest) => ({ explorer: { baseId: snaps[0]?.a.id ?? '', usual: [], plan: [], ...latest.explorer, focus: nutrient } }))
    setTab('nutrition')
  }

  if (!client) return <div className="p-8"><Empty icon="users" title="Client not found" action={<Button onClick={() => nav('/')}>Back to clients</Button>} /></div>

  const age = ageInMonths(client.dob, todayISO())
  const startHistory = () => {
    const a = newAssessment(client.id, todayISO(), settings.mealNames)
    void saveAssessment(a).then((ok) => ok && nav(`/c/${client.id}/a/${a.id}`))
  }
  const newSession = () => (setEditing(undefined), setModal('session'))
  const latestActions = sessions.find((s) => s.sections?.actions)

  const menuItems = [
    { icon: 'edit', label: 'Edit client details', fn: () => setModal('edit') },
    { icon: 'download', label: 'Export to Excel', fn: async () => {
      await exportClientExcel(client, assessments, sessions, settings)
      void logAudit('export')
    } },
    { icon: 'download', label: 'Export full record (data request)', fn: () => {
      exportClientJson(client, assessments, sessions)
      void logAudit('export')
    } },
    { icon: 'users', label: client.archived ? 'Restore from archive' : 'Archive client', fn: () => void patchClient(client.id, { archived: !client.archived }) },
    { icon: 'trash', label: 'Delete client and all data', danger: true, fn: async () => {
      const label = client.firstName === client.code ? client.code : `${client.firstName} (${client.code})`
      if (!confirmDialog(`Permanently delete ${label} with all food histories, sessions and notes? This cannot be undone.`)) return
      if (await deleteClient(client.id)) {
        void logAudit('erase')
        nav('/')
      }
    } },
  ]

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="truncate text-xl font-semibold tracking-tight">{client.firstName}</h1>
            <span className="text-[13px] text-ink-2">
              {formatAge(age)}{client.sex && ` · ${client.sex === 'M' ? 'boy' : 'girl'}`}{client.dob && ` · born ${formatDate(client.dob)}`}{client.feeding !== 'na' ? ` · ${FEEDING_LABEL[client.feeding].toLowerCase()}` : ''} · <span className="tnum">{client.code}</span>
              {client.archived && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px]">archived</span>}
            </span>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="primary" icon="apple" onClick={startHistory}>New food history</Button>
          <Button size="sm" icon="note" onClick={newSession}>New session note</Button>
          {client.folderUrl && <a href={client.folderUrl} target="_blank" rel="noreferrer noopener"><Button size="sm" variant="ghost">Folder <Icon name="external" size={13} /></Button></a>}
          <IconButton icon="menu" label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} />
          {menu && (
            <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-64 rounded-lg border border-line bg-surface py-1 shadow-card" onMouseLeave={() => setMenu(false)}>
              {menuItems.map((m) => (
                <button key={m.label} role="menuitem" type="button" onClick={() => (setMenu(false), m.fn())} className={cx('flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] hover:bg-surface-2', m.danger && 'text-critical-ink')}>
                  <Icon name={m.icon} size={15} /> {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Tabs
        className="mt-2 mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'nutrition', label: 'Nutrient explorer' },
          { id: 'food', label: 'Food histories', count: assessments.length },
          { id: 'sessions', label: 'Session notes', count: sessions.length },
          { id: 'accepted', label: 'Accepted foods', count: client.acceptedFoods?.length ?? 0 },
          { id: 'plan', label: 'Meal plan' },
          { id: 'sensory', label: 'Sensory' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="space-y-4">
            <KeyContext client={client} />
            <NutritionSnapshot client={client} snaps={snaps} onExplore={explore} />
            {latestActions && (
              <Card className="p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-ink">Agreed actions · {formatDate(latestActions.date)}</h2>
                  <button type="button" className="text-[12.5px] font-medium text-accent-ink hover:underline" onClick={() => setTab('sessions')}>All session notes</button>
                </div>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{latestActions.sections!.actions}</p>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            <SessionHistory sessions={sessions} onOpen={() => setTab('sessions')} onNew={newSession} />
            <GrowthAndRange client={client} sessions={sessions} />
            <Checklist client={client} />
            <RecordDetails client={client} onEdit={() => setModal('edit')} />
            {!!client.resources?.length && <ClientResources key={`resources-${client.id}`} client={client} />}
          </div>
        </div>
      )}

      {tab === 'nutrition' && <Explorer key={client.id} client={client} assessments={assessments} />}

      {tab === 'sessions' && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button size="sm" variant="primary" icon="plus" onClick={newSession}>New session notes</Button></div>
          {sessions.length === 0 ? <Card><Empty icon="note" title="No session notes yet">Record what the parents shared, what you observed, the advice you gave and the actions you agreed.</Empty></Card> : sessions.map((s) => <SessionCard key={s.id} s={s} client={client} onEdit={() => (setEditing(s), setModal('session'))} />)}
        </div>
      )}

      {tab === 'food' && (
        <div className="space-y-2">
          <div className="flex justify-end"><Button size="sm" variant="primary" icon="plus" onClick={startHistory}>New food history</Button></div>
          {rows.length === 0 ? <Card><Empty icon="apple" title="No food histories yet">Start one, paste in the family’s 3-day food history, and enter the foods to see intake against UK reference values.</Empty></Card> : rows.map((r) => <AssessmentCard key={r.a.id} a={r.a} analysis={r.an} panel={settings.panel} provisional={r.provisional} />)}
        </div>
      )}

      {tab === 'accepted' && <AcceptedFoods client={client} />}
      {tab === 'plan' && <MealPlan key={client.id} client={client} />}
      {tab === 'sensory' && <Sensory client={client} />}

      {modal === 'session' && <SessionForm client={client} session={editing} onClose={() => setModal(null)} />}
      {modal === 'edit' && <ClientForm client={client} onClose={() => setModal(null)} />}
    </div>
  )
}
