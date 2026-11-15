import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FoodEditor } from '../components/FoodEditor'
import { FoodSearch, type FoodSearchHandle } from '../components/FoodSearch'
import { Headline, InsightList, MacroBar, NutrientTable, SourcesList } from '../components/analysis'
import { AutoTextarea, Button, Card, Field, Icon, IconButton, Input, Modal, SectionTitle, Segmented, Select, Tabs, Textarea, confirmDialog, cx } from '../components/ui'
import { ageInMonths, formatAge, uid } from '../domain/age'
import { analyse, isUsual, previousAssessment } from '../domain/analysis'
import { dailyAmount, foodOf, freqFactor, rawValue } from '../domain/calc'
import { BREAST_MILK_ID, getFood } from '../domain/foods'
import { measuresFor } from '../domain/measures'
import { NUTRIENT_BY_ID, fmt } from '../domain/nutrients'
import { splitDiaryByDay } from '../domain/parse'
import { MEAL_NAMES, type Assessment, type CustomFood, type Day, type Food, type Freq, type Item, type Measure } from '../domain/types'
import { useStore } from '../store/store'

export function newDay(label: string, mealNames: string[] = MEAL_NAMES): Day {
  return { id: uid(), label, meals: mealNames.map((name) => ({ id: uid(), name, items: [] })) }
}

export function newAssessment(clientId: string, date: string, mealNames: string[] | undefined, days = 3): Assessment {
  const now = Date.now()
  return {
    id: uid(),
    clientId,
    date,
    type: 'diary',
    title: `${days}-day food history`,
    days: Array.from({ length: days }, (_, i) => newDay(`Day ${i + 1}`, mealNames?.length ? mealNames : MEAL_NAMES)),
    createdAt: now,
    updatedAt: now,
  }
}

const HOW_OFTEN: { label: string; freq?: Freq }[] = [
  { label: 'Every day' },
  { label: '6 days a week', freq: { times: 6, per: 'week' } },
  { label: '5 days a week', freq: { times: 5, per: 'week' } },
  { label: '4 days a week', freq: { times: 4, per: 'week' } },
  { label: '3 days a week', freq: { times: 3, per: 'week' } },
  { label: '2 days a week', freq: { times: 2, per: 'week' } },
  { label: 'Once a week', freq: { times: 1, per: 'week' } },
  { label: 'Fortnightly', freq: { times: 0.5, per: 'week' } },
  { label: 'Once a month', freq: { times: 1, per: 'month' } },
]
const freqKey = (f?: Freq) => (f ? `${f.times}/${f.per}` : 'daily')

function useMeasures(food: Food | undefined, ageMonths: number): Measure[] {
  const settings = useStore((s) => s.settings)
  const foods = useStore((s) => s.foods)
  return useMemo(() => {
    if (!food) return []
    const custom = food.id.startsWith('u:') ? foods.find((f) => 'u:' + f.id === food.id)?.measures : undefined
    return measuresFor(food, { userMeasures: settings.measures[food.id], customMeasures: custom, ageMonths, bm: settings.bm })
  }, [food, foods, settings.measures, settings.bm, ageMonths])
}

function ItemRow({ item, usual, ageMonths, autoFocus, onChange, onRemove, onDone }: { item: Item; usual: boolean; ageMonths: number; autoFocus: boolean; onChange: (i: Item) => void; onRemove: () => void; onDone: () => void }) {
  const live = getFood(item.foodId)
  const food = foodOf(item)
  const measures = useMeasures(live, ageMonths)
  const favourites = useStore((s) => s.settings.favourites)
  const updateSettings = useStore((s) => s.updateSettings)
  const settings = useStore((s) => s.settings)
  const [adding, setAdding] = useState(false)
  const qtyRef = useRef<HTMLInputElement>(null)
  const [qtyText, setQtyText] = useState(item.qty ? String(item.qty) : '')
  useEffect(() => {
    if (autoFocus) {
      qtyRef.current?.focus()
      qtyRef.current?.select()
    }
  }, [autoFocus])

  // keep the saved measure selectable even if the list has changed since (e.g. the child is older now)
  const options = measures.some((m) => m.label === item.measure) ? measures : [{ label: item.measure, amount: item.measureAmount, estimate: item.estimate }, ...measures]
  const kcalRaw = food ? rawValue(food, 'energy').v : null
  const kcal = kcalRaw != null && food ? (kcalRaw * (item.amount || 0) * freqFactor(item.freq)) / food.per : null
  const isFav = favourites.includes(item.foodId)
  const baseOnly = item.measure === item.unit

  const setQty = (text: string) => {
    setQtyText(text)
    const q = parseFloat(text.replace(',', '.'))
    const qty = isFinite(q) && q >= 0 ? q : 0
    onChange({ ...item, qty, amount: qty * item.measureAmount })
  }
  const setMeasure = (label: string) => {
    if (label === '__add') return setAdding(true)
    const m = options.find((x) => x.label === label)
    if (!m) return
    onChange({ ...item, measure: m.label, measureAmount: m.amount, amount: item.qty * m.amount, estimate: m.estimate || undefined })
  }

  return (
    <div className={cx('px-3 py-2', item.refused && 'bg-surface-2/50')}>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'} title={isFav ? 'Remove from favourites' : 'Add to favourites'} onClick={() => updateSettings({ favourites: isFav ? favourites.filter((f) => f !== item.foodId) : [...favourites, item.foodId] })} className={cx('inline-flex h-6 w-6 items-center justify-center rounded', isFav ? 'text-warning' : 'text-line-strong hover:text-muted')}><Icon name="star" size={13} filled={isFav} /></button>
        <span className={cx('min-w-0 flex-1 truncate text-[13.5px]', item.refused && 'text-muted line-through')} title={item.name}>{item.name}</span>
        {item.estimate && <span className="rounded bg-warning-wash px-1 text-[11.5px] text-warning-ink">estimate</span>}
        {!live && !item.snap && <span className="text-[11.5px] text-critical-ink">no longer in the library</span>}
        <button
          type="button"
          aria-pressed={Boolean(item.refused)}
          title="Offered but not eaten: kept on the record, left out of the totals"
          onClick={() => onChange({ ...item, refused: item.refused ? undefined : true })}
          className={cx('rounded-full border px-2 py-0.5 text-[11.5px] whitespace-nowrap transition-colors', item.refused ? 'border-ink bg-ink text-surface' : 'border-line text-muted hover:border-line-strong hover:text-ink')}
        >
          {item.refused ? 'Not eaten' : 'Not eaten?'}
        </button>
        <IconButton icon="trash" label={`Remove ${item.name}`} onClick={onRemove} className="-my-1 h-7 w-7" />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[30px]">
        <input
          ref={qtyRef}
          value={qtyText}
          inputMode="decimal"
          aria-label={`Quantity of ${item.name}`}
          placeholder="qty"
          onChange={(e) => setQty(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onDone()
            }
          }}
          className={cx('tnum h-8 w-16 rounded-lg border bg-surface px-2 text-right text-sm focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none', item.amount > 0 || item.refused ? 'border-line-strong' : 'border-warning')}
        />
        <span className="text-muted">×</span>
        <Select value={item.measure} onChange={(e) => setMeasure(e.target.value)} aria-label="Measure" className="h-8 w-auto max-w-[17rem] min-w-[5rem] flex-1 py-0 text-[13px] sm:flex-none">
          {options.map((m) => (
            <option key={m.label} value={m.label}>
              {m.label}
              {m.label !== item.unit && m.label !== 'ml' && !/\d\s*(ml|g)\)/.test(m.label) && !m.estimate ? ` (${fmt(m.amount, m.amount < 10 ? 1 : 0)} ${item.unit})` : ''}
            </option>
          ))}
          <option value="__add">Add a measure…</option>
        </Select>
        {usual && (
          <Select aria-label="How often" value={freqKey(item.freq)} onChange={(e) => onChange({ ...item, freq: HOW_OFTEN.find((f) => freqKey(f.freq) === e.target.value)?.freq })} className="h-8 w-auto py-0 text-[13px]">
            {!HOW_OFTEN.some((f) => freqKey(f.freq) === freqKey(item.freq)) && item.freq && <option value={freqKey(item.freq)}>{item.freq.times} × a {item.freq.per}</option>}
            {HOW_OFTEN.map((f) => (
              <option key={f.label} value={freqKey(f.freq)}>{f.label}</option>
            ))}
          </Select>
        )}
        <span className="tnum ml-auto text-right text-[12px] text-muted">
          {item.refused ? 'not counted' : (
            <>
              {!baseOnly && item.amount > 0 && <>{fmt(item.amount, item.amount < 10 ? 1 : 0)} {item.unit} · </>}
              {kcal != null ? `${fmt(kcal, 0)} kcal${item.freq ? '/day' : ''}` : 'no energy value'}
            </>
          )}
        </span>
      </div>
      {adding && (
        <AddMeasure
          foodName={item.name}
          unit={item.unit}
          onClose={() => setAdding(false)}
          onSave={(m) => {
            updateSettings({ measures: { ...settings.measures, [item.foodId]: [...(settings.measures[item.foodId] ?? []).filter((x) => x.label !== m.label), m] } })
            onChange({ ...item, measure: m.label, measureAmount: m.amount, amount: item.qty * m.amount, estimate: undefined })
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function AddMeasure({ foodName, unit, onClose, onSave }: { foodName: string; unit: string; onClose: () => void; onSave: (m: Measure) => void }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const a = parseFloat(amount.replace(',', '.'))
  return (
    <Modal title="Add a measure" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!label.trim() || !(a > 0)} onClick={() => onSave({ label: label.trim(), amount: a })}>Save measure</Button></>}>
      <p className="mb-3 text-[13px] text-ink-2">Saved for <span className="font-medium text-ink">{foodName}</span> and offered every time you log it.</p>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Name"><Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. small bowl, pouch" /></Field>
        <Field label={`Weighs (${unit})`}><Input inputMode="decimal" className="tnum" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function PasteDiary({ onClose, onApply }: { onClose: () => void; onApply: (days: { label: string; text: string }[]) => void }) {
  const [text, setText] = useState('')
  const parts = useMemo(() => (text.trim() ? splitDiaryByDay(text) : []), [text])
  return (
    <Modal wide title="Paste the parent’s food diary" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!parts.length} onClick={() => onApply(parts)}>Add to {parts.length > 1 ? `${parts.length} days` : 'this day'}</Button></>}>
      <p className="mb-2 text-[13px] text-ink-2">Copy everything from the family’s 3-day food history document and paste it here. It is split on the “Day 1”, “Day 2”, “Day 3” headings and shown beside each day while you enter the foods.</p>
      <Textarea autoFocus rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Day 1:\nBreakfast: …\nLunch: …'} />
      {parts.length > 0 && <p className="mt-2 text-[12.5px] text-ink-2">Found {parts.length > 1 ? `${parts.length} days: ${parts.map((p) => p.label).join(', ')}` : 'no day headings, so it will all go on the day you have open'}.</p>}
    </Modal>
  )
}

export default function AssessmentPage() {
  const { id, aid } = useParams()
  const nav = useNavigate()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const stored = useStore((s) => s.assessments.find((a) => a.id === aid))
  const all = useStore((s) => s.assessments)
  const settings = useStore((s) => s.settings)
  const saveAssessment = useStore((s) => s.saveAssessment)
  const deleteAssessment = useStore((s) => s.deleteAssessment)
  const saveMeals = useStore(s => s.updateSettings)
  const touchRecent = useStore((s) => s.touchRecent)

  const [draft, setDraft] = useState<Assessment | null>(null)
  const [dayIdx, setDayIdx] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>('iron')
  const [pane, setPane] = useState<'entry' | 'analysis'>('entry')
  const [creating, setCreating] = useState<{ name: string; dayId: string; mealId: string } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [saved, setSaved] = useState(true)
  const [saveFailed, setSaveFailed] = useState(false)
  const [finalising, setFinalising] = useState(false)
  // warn before closing the tab while an edit has not reached the cloud
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (!saved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [saved])
  const searchRefs = useRef<Record<string, FoodSearchHandle | null>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<Assessment | null>(null)
  const writes = useRef(Promise.resolve(true))
  const acknowledged = useRef<number | undefined>(undefined)
  // saves run one after another; each carries the version stamp the server last confirmed
  const persist = useCallback(
    (record: Assessment) => {
      const job = writes.current.then(async (previousOK) => {
        if (!previousOK) {
          setSaveFailed(true)
          return false
        }
        const copy = { ...record, updatedAt: acknowledged.current ?? record.updatedAt }
        const ok = await saveAssessment(copy)
        if (ok) {
          acknowledged.current = copy.updatedAt
          record.updatedAt = copy.updatedAt
        }
        setSaveFailed(!ok)
        return ok
      })
      writes.current = job
      return job
    },
    [saveAssessment],
  )

  useEffect(() => {
    if (stored && (!draft || draft.id !== stored.id)) setDraft(stored)
  }, [stored, draft])

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
      if (latest.current) setSaved(await persist(latest.current))
    }
    return writes.current
  }, [persist])
  useEffect(() => () => void flush(), [flush])

  const update = useCallback(
    (fn: (a: Assessment) => Assessment) => {
      setDraft((d) => {
        // a finalised record never changes; corrections go into an amendment
        if (!d || d.state === 'finalised') return d
        const next = { ...fn(d), state: 'draft' as const }
        latest.current = next
        setSaved(false)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(async () => {
          timer.current = null
          const ok = await persist(next)
          if (latest.current === next) setSaved(ok)
        }, 500)
        return next
      })
    },
    [persist],
  )
  const retrySave = async () => {
    if (!latest.current) return
    writes.current = Promise.resolve(true)
    setSaveFailed(false)
    setSaved(await persist(latest.current))
  }

  const prev = useMemo(() => (draft ? previousAssessment(draft, all) : undefined), [draft, all])
  const analysis = useMemo(() => (draft && client ? analyse(draft, client, settings, prev) : null), [draft, client, settings, prev])

  if (!client) return <div className="p-8 text-ink-2">Client not found. <Link className="text-accent-ink underline" to="/">Back to clients</Link></div>
  if (!draft || !analysis) return <div className="p-8 text-ink-2">{stored === undefined ? 'Food history not found.' : 'Loading…'}</div>

  const usual = isUsual(draft)
  const finalised = draft.state === 'finalised'
  const locked = finalised || finalising
  const incompleteDays = draft.days.filter((d) => !d.complete && !d.excluded)
  const needsQuantity = draft.days.some((d) => !d.excluded && d.meals.some((m) => m.items.some((i) => !i.refused && !(i.amount > 0))))
  const whyBlocked = saveFailed
    ? 'Retry saving your edits before finalising.'
    : needsQuantity
      ? 'Enter a quantity for each food, mark it “not eaten”, or remove the empty row.'
      : incompleteDays.length
        ? `Tick “Day complete” on ${incompleteDays.map((d) => d.label.split(' · ')[0]).join(', ')} once the foods and amounts are recorded.`
        : !analysis.result.nDays
          ? 'Include at least one completed day.'
          : !saved
            ? 'Saving your edits. Finalise will be available once they are saved.'
            : ''
  const openReport = async (kind: 'parent' | 'clinical') => {
    if (await flush()) nav(`/c/${client.id}/report/${draft.id}/${kind}`)
  }
  const finalise = async () => {
    if (!confirmDialog('Save this food history as final? It can no longer be edited; later corrections are saved as an amendment.')) return
    setFinalising(true)
    // freeze every food's values and the analysis exactly as they stand now
    const frozen: Assessment = {
      ...draft,
      days: draft.days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, items: m.items.map((i) => { const f = foodOf(i); return f ? { ...i, snap: { kind: f.kind, sourceFoodId: f.sourceFoodId, infantFormula: f.infantFormula, per: f.per, values: { ...f.values }, partial: f.partial } } : i }) })) })),
      state: 'finalised',
      snapshot: {
        analysis: JSON.parse(JSON.stringify(analysis)),
        client: JSON.parse(JSON.stringify({ ...client, resources: undefined, goals: undefined, plan: undefined, sensory: undefined, acceptedFoods: undefined, checklist: undefined })),
        settings: JSON.parse(JSON.stringify({ ...settings, savedMeals: undefined, recents: [], favourites: [], measures: {} })),
        finalisedAt: new Date().toISOString(),
        calculatorVersion: '2.1.0',
      },
    }
    if (await persist(frozen)) {
      setDraft(frozen)
      latest.current = null
      setSaved(true)
    }
    setFinalising(false)
  }
  const copyAs = async (extra: Partial<Assessment>) => {
    const next: Assessment = { ...draft, id: uid(), state: 'draft', snapshot: undefined, createdAt: Date.now(), updatedAt: Date.now(), ...extra }
    if (await saveAssessment(next)) nav(`/c/${client.id}/a/${next.id}`)
  }
  const ageMonths = ageInMonths(client.dob, draft.date)
  const day = draft.days[Math.min(usual ? 0 : dayIdx, draft.days.length - 1)]
  const mapDay = (dayId: string, fn: (d: Day) => Day) => update((a) => ({ ...a, days: a.days.map((d) => (d.id === dayId ? fn(d) : d)) }))
  const mapMeal = (dayId: string, mealId: string, fn: (items: Item[]) => Item[]) => mapDay(dayId, (d) => ({ ...d, complete: false, meals: d.meals.map((m) => (m.id === mealId ? { ...m, items: fn(m.items) } : m)) }))

  const addFood = (dayId: string, mealId: string, food: Food, customDoc?: CustomFood) => {
    const custom = customDoc ?? (food.id.startsWith('u:') ? useStore.getState().foods.find((f) => 'u:' + f.id === food.id) : undefined)
    const measures = measuresFor(food, { userMeasures: settings.measures[food.id], customMeasures: custom?.measures, ageMonths, bm: settings.bm })
    const household = measures[1] && measures[1].label !== 'ml' && food.unit !== 'ml' ? measures[1] : undefined
    const perOne = food.per === 1
    const m = food.id === BREAST_MILK_ID || perOne ? measures[0] : (household ?? measures[0])
    const base = m.label === food.unit && !perOne
    // anything the practitioner can edit is frozen at the moment it is logged
    const snap = custom ? { kind: custom.kind, sourceFoodId: custom.sourceFoodId, infantFormula: custom.infantFormula, per: custom.per, values: custom.values, partial: custom.partial } : food.edited ? { kind: food.kind, per: food.per, values: food.values } : undefined
    const item: Item = {
      id: uid(),
      foodId: food.id,
      name: food.name,
      unit: food.unit,
      qty: base ? 0 : 1,
      measure: m.label,
      measureAmount: m.amount,
      amount: base ? 0 : m.amount,
      ...(m.estimate ? { estimate: true } : {}),
      ...(snap ? { snap } : {}),
    }
    mapMeal(dayId, mealId, (items) => [...items, item])
    setFocusId(item.id)
    touchRecent(food.id)
  }

  const addDay = (copyFrom?: Day) => {
    const label = `Day ${draft.days.length + 1}`
    const d: Day = copyFrom ? { id: uid(), label, meals: copyFrom.meals.map((m) => ({ ...m, id: uid(), items: m.items.map((i) => ({ ...i, id: uid() })) })) } : newDay(label, day.meals.map((m) => m.name))
    update((a) => ({ ...a, days: [...a.days, d] }))
    setDayIdx(draft.days.length)
  }
  const removeDay = (d: Day) => {
    if ((d.meals.some((m) => m.items.length) || d.source) && !confirmDialog(`Delete ${d.label} and everything recorded in it?`)) return
    update((a) => ({ ...a, days: a.days.filter((x) => x.id !== d.id) }))
    setDayIdx(0)
  }

  const setMethod = (m: 'diary' | 'usual') => {
    if (m === (usual ? 'usual' : 'diary') || locked) return
    const hasItems = (d: Day) => d.meals.some((x) => x.items.length > 0)
    if (m === 'usual') {
      const filled = draft.days.filter(hasItems)
      if (filled.length > 1 && !confirmDialog(`“Usual intake” describes a single typical day. Keep ${filled[0].label} as that day and remove the other ${filled.length - 1}?`)) return
      const keep = filled[0] ?? draft.days[0]
      update((a) => ({ ...a, type: 'usual', title: /food history|food diary/i.test(a.title) ? 'Usual intake' : a.title, days: [{ ...keep, label: 'Usual day' }] }))
      setDayIdx(0)
    } else {
      const anyFreq = draft.days.some((d) => d.meals.some((x) => x.items.some((i) => i.freq)))
      if (anyFreq && !confirmDialog('A food diary records what was actually eaten each day, so the “how often” settings will be cleared. Continue?')) return
      update((a) => ({ ...a, type: 'diary', title: /usual|typical|frequency/i.test(a.title) ? 'Food history' : a.title, days: a.days.map((d, i) => ({ ...d, label: i === 0 && /usual|typical/i.test(d.label) ? 'Day 1' : d.label, meals: d.meals.map((x) => ({ ...x, items: x.items.map(({ freq: _f, ...rest }) => rest) })) })) }))
    }
  }

  const applyPaste = (parts: { label: string; text: string }[]) => {
    update((a) => {
      const days = [...a.days]
      if (parts.length === 1 && !parts[0].label) {
        const i = days.findIndex((d) => d.id === day.id)
        days[i] = { ...days[i], source: [days[i].source, parts[0].text].filter(Boolean).join('\n\n') }
      } else if (isUsual(a)) {
        days[0] = { ...days[0], source: parts.map((p) => `${p.label}\n${p.text}`).join('\n\n') }
      } else {
        parts.forEach((p, i) => {
          if (days[i]) days[i] = { ...days[i], label: p.label || days[i].label, source: p.text }
          else days.push({ ...newDay(p.label || `Day ${i + 1}`, days[0].meals.map((m) => m.name)), source: p.text })
        })
      }
      return { ...a, days }
    })
    setPasting(false)
  }

  const entry = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!usual && (
          <>
            <div className="flex flex-wrap gap-1">
              {draft.days.map((d, i) => (
                <button key={d.id} type="button" onClick={() => setDayIdx(i)} aria-pressed={i === dayIdx} className={cx('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', i === dayIdx ? 'bg-ink text-surface' : 'bg-surface-2 text-ink-2 hover:text-ink')}>
                  {d.label.split(' · ')[0]}
                  <span className={cx('ml-1.5 text-[11.5px]', i === dayIdx ? 'opacity-70' : 'text-muted')}>{d.meals.reduce((n, m) => n + m.items.length, 0)}</span>
                </button>
              ))}
            </div>
            <IconButton icon="plus" label="Add a day" onClick={() => addDay()} />
            <IconButton icon="copy" label="Copy this day into a new day" onClick={() => addDay(day)} />
            {draft.days.length > 1 && <IconButton icon="trash" label={`Delete ${day.label}`} onClick={() => removeDay(day)} />}
          </>
        )}
        <Button size="sm" icon="note" className="ml-auto" onClick={() => setPasting(true)}>Paste parent’s diary</Button>
      </div>

      {!usual && (
        <input aria-label="Day label" value={day.label} onChange={(e) => mapDay(day.id, (d) => ({ ...d, label: e.target.value }))} placeholder="Day label, e.g. Day 1 · Saturday at home" className="h-8 w-full rounded-lg border border-transparent bg-transparent px-1 text-[13.5px] font-medium hover:border-line focus:border-accent focus:bg-surface focus:outline-none" />
      )}

      {!usual && draft.type === 'diary' && (
        <Field label="Diary date (optional)">
          <Input type="date" value={day.diaryDate ?? ''} onChange={e => mapDay(day.id, d => ({...d, diaryDate: e.target.value || undefined}))} />
        </Field>
      )}

      <label className={cx('flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px]', day.complete ? 'border-good/40 bg-good-wash' : 'border-line bg-surface')}>
        <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={day.complete === true} onChange={(e) => mapDay(day.id, (d) => ({ ...d, complete: e.target.checked }))} />
        <span className="font-medium">{usual ? 'Usual day complete' : 'Day complete'}</span>
        <span className="text-ink-2">{day.complete ? 'Included in the analysis.' : 'Tick when the foods and amounts are all entered. Only completed days are analysed; editing a day un-ticks it.'}</span>
      </label>

      {day.source != null && (
        <Card className="border-accent/30 bg-accent-wash/40 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[12px] font-medium text-ink-2">What the parent wrote</span>
            <button type="button" className="text-[12px] text-muted hover:text-ink" onClick={() => confirmDialog('Remove the parent’s text from this day?') && mapDay(day.id, ({ source: _s, ...d }) => d)}>Remove</button>
          </div>
          <AutoTextarea value={day.source ?? ''} onChange={(v) => mapDay(day.id, (d) => ({ ...d, source: v }))} minRows={3} className="border-transparent bg-transparent px-0 text-[13.5px] focus:border-transparent focus:ring-0" />
        </Card>
      )}

      <details className="rounded-xl border border-line bg-surface p-3">
        <summary className="cursor-pointer text-sm font-semibold">Reusable meals</summary>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!day.meals.some(meal => meal.items.some(item => item.amount > 0))} onClick={() => {
            const name = window.prompt('Name the foods from this day to reuse later')?.trim()
            if (!name) return
            const items = day.meals.flatMap(meal => meal.items).filter(item => item.amount > 0).map(item => {
              const food = foodOf(item)
              if (!food) return item
              return {...item, snap: {
                kind: food.kind, sourceFoodId: food.sourceFoodId, infantFormula: food.infantFormula,
                per: food.per, values: {...food.values},
              }}
            })
            const saved = useStore.getState().settings.savedMeals ?? []
            saveMeals({savedMeals: [...saved, {id: uid(), name, items}]})
          }}>Save foods as reusable meal</Button>
          <Select className="w-auto" aria-label="Insert saved meal" value="" disabled={!day.meals.length} onChange={e => {
            const savedMeal = settings.savedMeals?.find(meal => meal.id === e.target.value)
            if (!savedMeal || !day.meals[0]) return
            mapMeal(day.id, day.meals[0].id, items => [...items, ...savedMeal.items.map(item => ({...item, id: uid()}))])
          }}>
            <option value="">Insert into {day.meals[0]?.name.toLowerCase() ?? 'first meal'}…</option>
            {settings.savedMeals?.map(meal => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
          </Select>
        </div>
      </details>

      {day.meals.map((meal) => {
        const mealKcal = meal.items.reduce((sum, it) => {
          const f = foodOf(it)
          const k = f ? rawValue(f, 'energy').v : null
          return sum + (k != null && f ? (k * dailyAmount(it)) / f.per : 0)
        }, 0)
        return (
          <Card key={meal.id}>
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
              <h3 className="text-[13px] font-semibold">{meal.name}</h3>
              {meal.items.length > 0 && <span className="tnum text-[12px] text-muted">{fmt(mealKcal, 0)} kcal</span>}
            </div>
            {meal.familyNotes && <p className="border-t border-line px-3 py-2 text-[12.5px] whitespace-pre-wrap text-ink-2"><span className="font-medium text-ink">Family notes:</span> {meal.familyNotes}</p>}
            {meal.items.length > 0 && (
              <div className="divide-y divide-line border-t border-line">
                {meal.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    usual={usual}
                    ageMonths={ageMonths}
                    autoFocus={focusId === item.id}
                    onChange={(next) => mapMeal(day.id, meal.id, (items) => items.map((i) => (i.id === item.id ? next : i)))}
                    onRemove={() => mapMeal(day.id, meal.id, (items) => items.filter((i) => i.id !== item.id))}
                    onDone={() => {
                      setFocusId(null)
                      searchRefs.current[meal.id]?.focus()
                    }}
                  />
                ))}
              </div>
            )}
            <div className={cx('px-3 pb-3', meal.items.length ? 'border-t border-line pt-3' : 'pt-1')}>
              <FoodSearch
                ref={(h) => {
                  searchRefs.current[meal.id] = h
                }}
                placeholder={`Add to ${meal.name.toLowerCase()}…`}
                onPick={(food) => addFood(day.id, meal.id, food)}
                onCreate={(name) => setCreating({ name, dayId: day.id, mealId: meal.id })}
              />
            </div>
          </Card>
        )
      })}
      <Card className="p-3">
        <Field label="Notes on this food history">
          <AutoTextarea value={draft.note ?? ''} onChange={(v) => update((a) => ({ ...a, note: v }))} placeholder="Who reported it, how typical the days were, anything that affects interpretation…" />
        </Field>
      </Card>
    </div>
  )

  const sel = selected && settings.panel.includes(selected) ? selected : null
  const review = (
    <Card className={cx('p-4', finalised && 'border-good/40')}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon name={finalised ? 'lock' : 'edit'} className={finalised ? 'text-good-ink' : 'text-muted'} />
        <span className="text-[13.5px] font-semibold">{draft.scenarioOf ? 'Planning scenario' : finalised ? 'Finalised: read only' : draft.amendmentOf ? 'Amendment draft' : 'Draft'}</span>
        <span className="text-[12.5px] text-ink-2">· {analysis.result.nDays} completed day{analysis.result.nDays === 1 ? '' : 's'}{finalised && draft.snapshot ? ` · finalised ${new Date(draft.snapshot.finalisedAt).toLocaleDateString('en-GB')}` : ''}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {!finalised ? (
            <Button size="sm" variant="primary" icon="lock" disabled={!!whyBlocked || finalising} aria-describedby="finalise-help" onClick={() => void finalise()}>{finalising ? 'Finalising…' : 'Finalise'}</Button>
          ) : (
            <>
              <Button size="sm" onClick={() => void copyAs({ amendmentOf: draft.id })}>Create amendment</Button>
              <Button size="sm" onClick={() => void copyAs({ scenarioOf: draft.id, title: 'Scenario: ' + draft.title })}>What-if scenario</Button>
              <Button size="sm" variant="ghost" onClick={() => window.open(`${window.location.pathname}${window.location.search}#/c/${client.id}/family/${draft.id}`, '_blank', 'noopener')}>Family view</Button>
            </>
          )}
        </div>
      </div>
      {!finalised && <p id="finalise-help" className="mt-1.5 text-[12.5px] text-ink-2" role="status">{whyBlocked || 'Ready to finalise. You can preview both reports first.'}</p>}
      <label className="mt-2 flex items-center gap-2 text-[13px]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" disabled={locked} checked={draft.unquantifiedBreastMilk ?? false} onChange={(e) => update((a) => ({ ...a, unquantifiedBreastMilk: e.target.checked }))} />
        Breastfeeding recorded, volume unknown <span className="text-muted">(marks every total as a minimum)</span>
      </label>
      <Field label="Agreed actions and follow-up (shared with parents)" className="mt-2.5">
        <AutoTextarea disabled={locked} value={draft.parentNote ?? ''} onChange={(v) => update((x) => ({ ...x, parentNote: v }))} placeholder="Practical next steps in plain language. Shown on the parent summary and the family view." />
      </Field>
    </Card>
  )
  const results =
    analysis.result.nDays === 0 ? (
      <div className="space-y-3">{review}<Card className="p-6 text-center text-[13px] text-ink-2">Tick “Day complete” once a day’s foods and amounts are entered to see its analysis here.</Card></div>
    ) : (
      <div className="space-y-3">
        {review}
        <Card className="p-4">
          <Headline analysis={analysis} panel={settings.panel} />
          {analysis.result.energyPct && (
            <div className="mt-4">
              <div className="mb-1.5 text-[12px] text-ink-2">Where the energy comes from</div>
              <MacroBar pct={analysis.result.energyPct} />
            </div>
          )}
          <p className="mt-3 text-[12px] text-muted">
            {usual ? 'Estimated daily average from usual intake' : `Average of ${analysis.result.nDays} recorded day${analysis.result.nDays === 1 ? '' : 's'}`} · reference values for {formatAge(ageMonths)}, {client.sex === 'M' ? 'boy' : 'girl'}
          </p>
        </Card>
        <Card className="p-4">
          <SectionTitle>Insights</SectionTitle>
          <InsightList insights={analysis.insights} onSelect={setSelected} />
        </Card>
        <Card className="p-4">
          <SectionTitle>Daily intake against reference values</SectionTitle>
          <NutrientTable result={analysis.result} targets={analysis.targets} panel={settings.panel} selected={sel} onSelect={setSelected} />
          <p className="mt-2 text-[12px] text-muted">Select a nutrient to see which foods provide it. “≥” marks a minimum: some foods eaten have no value for that nutrient in the food data.</p>
        </Card>
        {sel && (
          <Card className="p-4">
            <SectionTitle>Top sources of {(NUTRIENT_BY_ID[sel].short ?? NUTRIENT_BY_ID[sel].label).toLowerCase()}</SectionTitle>
            <SourcesList result={analysis.result} nutrient={sel} />
          </Card>
        )}
      </div>
    )

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-3 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to={`/c/${client.id}?tab=food`} onClick={() => void flush()} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
          <Icon name="arrowLeft" size={15} /> {client.firstName}
        </Link>
        <input aria-label="Title" disabled={locked} value={draft.title} onChange={(e) => update((a) => ({ ...a, title: e.target.value }))} className="h-8 min-w-[10rem] flex-1 rounded-lg border border-transparent bg-transparent px-1.5 text-[15px] font-semibold hover:border-line focus:border-accent focus:bg-surface focus:outline-none" />
        <input aria-label="Date of the food history" type="date" disabled={locked} value={draft.date} onChange={(e) => e.target.value && update((a) => ({ ...a, date: e.target.value }))} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] focus:border-accent focus:outline-none" />
        <span className={cx('text-[12px]', saveFailed ? 'text-critical-ink' : 'text-muted')} aria-live="polite">{saveFailed ? 'Not saved' : saved ? 'Saved' : 'Saving…'}</span>
        {saveFailed && <Button size="sm" onClick={() => void retrySave()}>Retry save</Button>}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" icon="file" disabled={saveFailed || finalising} onClick={() => void openReport('parent')}>{finalised ? 'Parent summary' : 'Preview parent summary'}</Button>
          <Button size="sm" icon="file" disabled={saveFailed || finalising} onClick={() => void openReport('clinical')}>{finalised ? 'Clinical report' : 'Preview clinical report'}</Button>
          {!finalised && <IconButton
            icon="trash"
            label="Delete this food history"
            onClick={() => {
              if (!confirmDialog('Delete this food history? This cannot be undone.')) return
              if (timer.current) clearTimeout(timer.current)
              timer.current = null
              deleteAssessment(draft.id)
              nav(`/c/${client.id}?tab=food`)
            }}
          />}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Segmented value={usual ? 'usual' : 'diary'} onChange={setMethod} options={[{ id: 'diary', label: 'Food diary' }, { id: 'usual', label: 'Usual intake' }]} />
        <span className="text-[12.5px] text-ink-2">{usual ? 'One typical day as the family describes it. Set how often for foods not eaten every day; everything is scaled to a daily average.' : 'What was actually eaten on each recorded day. The days are averaged.'}</span>
      </div>

      <Tabs className="mb-3 lg:hidden" value={pane} onChange={setPane} tabs={[{ id: 'entry', label: 'Food entry', count: analysis.result.itemCount }, { id: 'analysis', label: 'Analysis' }]} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className={cx(pane === 'entry' ? 'block' : 'hidden', 'lg:block')}><fieldset disabled={locked} className="min-w-0">{entry}</fieldset></div>
        <div className={cx(pane === 'analysis' ? 'block' : 'hidden', 'scroll-thin lg:sticky lg:top-3 lg:block lg:max-h-[calc(100dvh-1.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1')}>{results}</div>
      </div>

      {pasting && <PasteDiary onClose={() => setPasting(false)} onApply={applyPaste} />}
      {creating && (
        <FoodEditor
          target={{ type: 'new', initial: { name: creating.name } }}
          onClose={() => setCreating(null)}
          onSaved={(f) => {
            // the store updates asynchronously; build the food directly so it can be logged straight away
            addFood(creating.dayId, creating.mealId, { id: 'u:' + f.id, name: f.name, kind: f.kind, group: '', per: f.per, unit: f.unit, values: f.values }, f)
          }}
        />
      )}
    </div>
  )
}
