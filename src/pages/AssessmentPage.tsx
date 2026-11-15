import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CustomFoodForm } from '../components/CustomFoodForm'
import { FoodSearch, type FoodSearchHandle } from '../components/FoodSearch'
import { Headline, InsightList, MacroBar, NutrientTable, SourcesList } from '../components/analysis'
import { Banner, Button, Card, Field, Icon, IconButton, Input, Modal, SectionTitle, Select, AutoTextarea, confirmDialog, cx } from '../components/ui'
import { ageInMonths, formatAge, uid } from '../domain/age'
import { TYPE_LABEL, analyse, previousAssessment } from '../domain/analysis'
import { dailyAmount, foodOf, rawValue } from '../domain/calc'
import { BREAST_MILK_ID, getFood } from '../domain/foods'
import { measuresFor } from '../domain/measures'
import { NUTRIENT_BY_ID, fmt } from '../domain/nutrients'
import { type Assessment, type CustomFood, type Day, type Food, type Freq, type Item, type Measure } from '../domain/types'
import { useStore } from '../store/store'

export function newDay(label: string, type: Assessment['type']): Day {
  const names = type === 'ffq' ? ['Foods and drinks'] : ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks']
  return { id: uid(), label, meals: names.map((name) => ({ id: uid(), name, items: [] })) }
}

const TYPICAL_FREQ: { label: string; freq?: Freq }[] = [
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

function ItemRow({ item, type, ageMonths, autoFocus, onChange, onRemove, onDone }: { item: Item; type: Assessment['type']; ageMonths: number; autoFocus: boolean; onChange: (i: Item) => void; onRemove: () => void; onDone: () => void }) {
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
  const kcal = kcalRaw != null && food ? (kcalRaw * dailyAmount(item)) / food.per : null
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
    <div className="px-3 py-2">
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'} title={isFav ? 'Remove from favourites' : 'Add to favourites'} onClick={() => updateSettings({ favourites: isFav ? favourites.filter((f) => f !== item.foodId) : [...favourites, item.foodId] })} className={cx('text-[13px] leading-none', isFav ? 'text-warning-ink' : 'text-line-strong hover:text-muted')}>★</button>
        <span className="min-w-0 flex-1 truncate text-[13.5px]" title={item.name}>{item.name}</span>
        {item.estimate && <span className="rounded bg-warning-wash px-1 text-[11.5px] text-warning-ink">estimate</span>}
        {!live && !item.snap && <span className="text-[11.5px] text-critical-ink">food no longer exists</span>}
        <IconButton icon="trash" label={`Remove ${item.name}`} onClick={onRemove} className="-my-1 h-7 w-7" />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-5">
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
          className={cx('tnum h-8 w-16 rounded-lg border bg-surface px-2 text-right text-sm focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none', item.amount > 0 ? 'border-line-strong' : 'border-warning')}
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
        {type === 'typical' && (
          <Select
            aria-label="How often"
            value={freqKey(item.freq)}
            onChange={(e) => onChange({ ...item, freq: TYPICAL_FREQ.find((f) => freqKey(f.freq) === e.target.value)?.freq })}
            className="h-8 w-auto py-0 text-[13px]"
          >
            {TYPICAL_FREQ.map((f) => (
              <option key={f.label} value={freqKey(f.freq)}>{f.label}</option>
            ))}
          </Select>
        )}
        {type === 'ffq' && (
          <span className="inline-flex items-center gap-1.5">
            <input
              aria-label="Times"
              inputMode="decimal"
              defaultValue={item.freq?.times ?? 1}
              onChange={(e) => {
                const t = parseFloat(e.target.value.replace(',', '.'))
                onChange({ ...item, freq: { times: isFinite(t) && t >= 0 ? t : 0, per: item.freq?.per ?? 'day' } })
              }}
              className="tnum h-8 w-12 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm focus:border-accent focus:outline-none"
            />
            <Select aria-label="Per" value={item.freq?.per ?? 'day'} onChange={(e) => onChange({ ...item, freq: { times: item.freq?.times ?? 1, per: e.target.value as Freq['per'] } })} className="h-8 w-auto py-0 text-[13px]">
              <option value="day">× a day</option>
              <option value="week">× a week</option>
              <option value="month">× a month</option>
            </Select>
          </span>
        )}
        <span className="tnum ml-auto text-right text-[12px] text-muted">
          {!baseOnly && item.amount > 0 && <>{fmt(item.amount, item.amount < 10 ? 1 : 0)} {item.unit} · </>}
          {kcal != null ? `${fmt(kcal, 0)} kcal${item.freq ? '/day' : ''}` : 'no energy value'}
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
    <Modal
      title="Add a measure"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!label.trim() || !(a > 0)} onClick={() => onSave({ label: label.trim(), amount: a })}>Save measure</Button>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">Saved for <span className="font-medium text-ink">{foodName}</span> and offered every time you log it.</p>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Name"><Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. small bowl, pouch" /></Field>
        <Field label={`Weighs (${unit})`}><Input inputMode="decimal" className="tnum" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

export default function AssessmentPage() {
  const { id, aid } = useParams()
  const nav = useNavigate()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const stored = useStore((s) => s.assessments.find((a) => a.id === aid && a.clientId === id))
  const all = useStore((s) => s.assessments)
  const settings = useStore((s) => s.settings)
  const saveAssessment = useStore((s) => s.saveAssessment)
  const deleteAssessment = useStore((s) => s.deleteAssessment)
  const updateSettings = useStore(s => s.updateSettings)
  const touchRecent = useStore((s) => s.touchRecent)

  const [draft, setDraft] = useState<Assessment | null>(null)
  const [dayIdx, setDayIdx] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>('iron')
  const [searchParams] = useSearchParams()
  const [pane, setPane] = useState<'entry' | 'review'>(() => searchParams.get('step') === 'review' ? 'review' : 'entry')
  const [creating, setCreating] = useState<{ name: string; dayId: string; mealId: string } | null>(null)
  const [saved, setSaved] = useState(true)
  const [saveFailed, setSaveFailed] = useState(false)
  const [finalising, setFinalising] = useState(false)
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (!saved) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [saved])
  const searchRefs = useRef<Record<string, FoodSearchHandle | null>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<Assessment | null>(null)
  const writes = useRef(Promise.resolve(true))
  const acknowledged = useRef<number | undefined>(undefined)
  const persist = useCallback((record: Assessment) => {
    const job = writes.current.then(async previousOK => {
      if (!previousOK) { setSaveFailed(true); return false }
      const copy = {...record, updatedAt: acknowledged.current ?? record.updatedAt}
      const ok = await saveAssessment(copy)
      if (ok) { acknowledged.current = copy.updatedAt; record.updatedAt = copy.updatedAt }
      setSaveFailed(!ok)
      return ok
    })
    writes.current = job
    return job
  }, [saveAssessment])

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
  useEffect(() => () => { void flush() }, [flush])

  const update = useCallback(
    (fn: (a: Assessment) => Assessment) => {
      setDraft((d) => {
        if (!d || d.state === "finalised") return d
        const next = { ...fn(d), state: "draft" as const }
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
    [saveAssessment],
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

  const finalised = draft.state === 'finalised'
  const hasEntries = draft.days.some(d => d.complete || d.diaryDate || d.meals.some(m => m.items.length || m.familyNotes))
  const changeFormat = (type: Assessment['type']) => {
    if (type === draft.type || hasEntries) return
    const count = type === 'diary' ? 3 : 1
    setDayIdx(0)
    update(a => ({
      ...a, type, title: type === 'diary' ? '3-day food diary' : TYPE_LABEL[type],
      days: Array.from({length: count}, (_, index) => newDay(type === 'diary' ? `Day ${index + 1}` : TYPE_LABEL[type], type)),
    }))
  }
  const incompleteDays = draft.days.filter(d => !d.complete && !d.excluded)
  const needsQuantity = draft.days.some(d => !d.excluded && d.meals.some(m => m.items.some(i => !(i.amount > 0))))
  const whyBlocked = saveFailed ? 'Retry saving your edits before finalising.'
    : needsQuantity ? 'Enter a quantity for each food or remove the empty row.'
    : incompleteDays.length ? 'Mark each day complete below once the food and amounts are recorded.'
    : !analysis.result.nDays ? 'Include at least one completed day.'
    : !saved ? 'Saving your edits. Finalise will be available once they are saved.' : ''

  const openReport = async (kind: 'parent' | 'clinical') => {
    if (await flush()) nav(`/c/${client.id}/report/${draft.id}/${kind}`)
  }

  const ageMonths = ageInMonths(client.dob, draft.date)
  const day = draft.days[Math.min(dayIdx, draft.days.length - 1)]
  const mapDay = (dayId: string, fn: (d: Day) => Day) => update((a) => ({ ...a, days: a.days.map((d) => (d.id === dayId ? fn(d) : d)) }))
  const mapMeal = (dayId: string, mealId: string, fn: (items: Item[]) => Item[]) => mapDay(dayId, (d) => ({ ...d, complete: false, meals: d.meals.map((m) => (m.id === mealId ? { ...m, items: fn(m.items) } : m)) }))

  const addFood = (dayId: string, mealId: string, food: Food, customDoc?: CustomFood) => {
    const custom = customDoc ?? (food.id.startsWith('u:') ? useStore.getState().foods.find((f) => 'u:' + f.id === food.id) : undefined)
    const measures = measuresFor(food, { userMeasures: settings.measures[food.id], customMeasures: custom?.measures, ageMonths, bm: settings.bm })
    const household = measures[1] && measures[1].label !== 'ml' && food.unit !== 'ml' ? measures[1] : undefined
    const m = food.id === BREAST_MILK_ID || food.kind === 'supplement' ? measures[0] : (household ?? measures[0])
    const base = m.label === food.unit && food.kind !== 'supplement'
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
      ...(draft.type === 'ffq' ? { freq: { times: 1, per: 'day' as const } } : {}),
      ...(custom ? { snap: { sourceFoodId: custom.sourceFoodId, infantFormula: custom.infantFormula, kind: custom.kind, per: custom.per, values: custom.values } } : {}),
    }
    mapMeal(dayId, mealId, (items) => [...items, item])
    setFocusId(item.id)
    touchRecent(food.id)
  }

  const addDay = (copyFrom?: Day) => {
    const label = `Day ${draft.days.length + 1}`
    const d: Day = copyFrom
      ? { id: uid(), label, meals: copyFrom.meals.map((m) => ({ ...m, id: uid(), items: m.items.map((i) => ({ ...i, id: uid() })) })) }
      : newDay(label, draft.type)
    update((a) => ({ ...a, days: [...a.days, d] }))
    setDayIdx(draft.days.length)
  }
  const removeDay = (d: Day) => {
    if (d.meals.some((m) => m.items.length) && !confirmDialog(`Delete ${d.label} and everything recorded in it?`)) return
    update((a) => ({ ...a, days: a.days.filter((x) => x.id !== d.id) }))
    setDayIdx(0)
  }

  const entry = (
    <div className="space-y-4">
      {draft.type === 'diary' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {draft.days.map((d, i) => (
              <button key={d.id} type="button" onClick={() => setDayIdx(i)} aria-pressed={i === dayIdx} className={cx('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', i === dayIdx ? 'bg-ink text-surface' : 'bg-surface-2 text-ink-2 hover:text-ink')}>
                {d.label}
                <span className={cx('ml-1.5 text-[11.5px]', i === dayIdx ? 'opacity-70' : 'text-muted')}>{d.meals.reduce((n, m) => n + m.items.length, 0)}</span>
              </button>
            ))}
          </div>
          <Button size="sm" icon="plus" onClick={() => addDay()}>Day</Button>
          <IconButton icon="copy" label="Copy this day into a new day" onClick={() => addDay(day)} />
          {draft.days.length > 1 && <IconButton icon="trash" label={`Delete ${day.label}`} onClick={() => removeDay(day)} />}
          <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            Label
            <input value={day.label} onChange={(e) => mapDay(day.id, (d) => ({ ...d, label: e.target.value }))} className="h-8 w-28 rounded-lg border border-line bg-transparent px-2 text-[13px] text-ink focus:border-accent focus:outline-none" />
          </label>
        </div>
      )}
      {draft.type === 'diary' && <Field label={`Diary date for ${day.label} (optional)`}><Input type="date" value={day.diaryDate ?? ''} onChange={e => mapDay(day.id, d => ({...d, diaryDate: e.target.value}))} /></Field>}
      {draft.type === 'typical' && <Banner>Record a usual day. For foods not eaten daily, set how often on each line and the app scales them to a daily average.</Banner>}
      {draft.type === 'ffq' && <Banner>List each food with its usual portion and how often it is eaten; the app converts everything to a daily average.</Banner>}

      <Card className="my-3 flex flex-wrap gap-2 p-3">
        <Button onClick={() => {
          const name = window.prompt('Name this reusable day of meals')
          if (!name?.trim()) return
          const items = day.meals.flatMap(m => m.items).map(i => { const f = foodOf(i); return f ? {...i, snap: {kind: f.kind, sourceFoodId: f.sourceFoodId, infantFormula: f.infantFormula, per: f.per, values: {...f.values}}} : i })
          updateSettings({savedMeals: [...(settings.savedMeals ?? []), {id: uid(), name: name.trim(), items}]})
        }}>Save foods as reusable meal</Button>
        <Select aria-label="Insert saved meal" value="" onChange={e => { const savedMeal = settings.savedMeals?.find(m => m.id === e.target.value); if (savedMeal && day.meals[0]) mapMeal(day.id, day.meals[0].id, items => [...items, ...savedMeal.items.map(i => ({...i, id: uid()}))]) }}><option value="">Insert a saved meal…</option>{settings.savedMeals?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
      </Card>
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
            {meal.items.length > 0 && (
              <div className="divide-y divide-line border-t border-line">
                {meal.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    type={draft.type}
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
              <details className="mb-2">
                <summary className="cursor-pointer text-sm text-ink-2">Family notes {meal.familyNotes ? '· added' : ''}</summary>
                <Field label={`Family notes for ${meal.name}`} hint="Record foods offered, refused or only partly eaten. Add foods actually eaten below for the nutrient calculation.">
                  <AutoTextarea value={meal.familyNotes ?? ''} onChange={familyNotes => mapDay(day.id, d => ({...d, meals:d.meals.map(m => m.id === meal.id ? {...m, familyNotes} : m)}))} />
                </Field>
              </details>
              <FoodSearch
                ref={(h) => {
                  searchRefs.current[meal.id] = h
                }}
                placeholder={draft.type === 'ffq' ? 'Add a food or drink…' : `Add to ${meal.name.toLowerCase()}…`}
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
  const results = analysis.result.nDays === 0 ? (
    <Card className="p-6 text-center text-[13px] text-ink-2">Mark a day complete in Review to see its nutrient totals.</Card>
  ) : (
    <div className="space-y-4">
      <Card className="p-4">
        <Headline analysis={analysis} panel={settings.panel} />
        {analysis.result.energyPct && (
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] text-ink-2">Where the energy comes from</div>
            <MacroBar pct={analysis.result.energyPct} />
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted">
          {draft.type === 'diary' ? `Average of ${analysis.result.nDays} recorded day${analysis.result.nDays === 1 ? '' : 's'}` : 'Estimated daily average'} · reference values for {formatAge(ageMonths)}, {client.sex === 'M' ? 'boy' : 'girl'}
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
    <div className="app-page">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to={`/c/${client.id}`} onClick={flush} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
          <Icon name="arrowLeft" size={15} /> {client.firstName}
        </Link>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-medium text-ink-2">{TYPE_LABEL[draft.type]}</span>
        <span className="text-[12px] text-muted" aria-live="polite">{saved ? (useStore.getState().mode === 'cloud' ? 'Saved to cloud' : 'Saved in this browser only') : saveFailed ? 'Save failed' : 'Saving changes…'}</span>
        {saveFailed && <Button size="sm" onClick={retrySave}>Retry save</Button>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!finalised && <IconButton
            icon="trash"
            label="Delete this food history"
            onClick={() => {
              if (!confirmDialog('Delete this food history? This cannot be undone.')) return
              if (timer.current) clearTimeout(timer.current)
              timer.current = null
              deleteAssessment(draft.id)
              nav(`/c/${client.id}`)
            }}
          />}
        </div>
      </div>
      <div className="workspace-hero mb-5 rounded-2xl border border-line p-5 sm:p-7">
        <h1 className="page-title text-2xl font-semibold sm:text-3xl">{draft.title}</h1>
        <p className="text-sm text-ink-2">{client.firstName} · {finalised ? 'Finalised' : draft.scenarioOf ? 'Planning scenario' : 'Draft'}</p>
      </div>
      <nav aria-label="Assessment steps" className="mb-5 grid gap-1.5 rounded-xl border border-line bg-surface p-1.5 sm:grid-cols-3">
        <Button className="justify-start sm:justify-center" variant={pane === 'entry' && !finalised ? 'primary' : undefined} onClick={() => setPane('entry')}>1. {finalised ? 'Food history' : 'Enter foods'}</Button>
        <Button className="justify-start sm:justify-center" variant={pane === 'review' && !finalised ? 'primary' : undefined} onClick={() => setPane('review')}>2. Review intake</Button>
        <span className={cx('rounded-lg border px-3 py-2 text-sm font-medium', finalised ? 'border-line bg-good-wash text-good-ink' : 'border-line bg-surface-2 text-ink-2')}>3. Reports {finalised ? 'ready' : '· preview in Review'}</span>
      </nav>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Title" className="min-w-[14rem] flex-1"><Input disabled={finalised} value={draft.title} onChange={(e) => update((a) => ({ ...a, title: e.target.value }))} /></Field>
        <Field label="Date" className="w-40"><Input disabled={finalised} type="date" value={draft.date} onChange={(e) => e.target.value && update((a) => ({ ...a, date: e.target.value }))} /></Field>
      </div>

      {(pane === 'review' || finalised) && <Card className="mb-5 space-y-3 border-t-2 border-t-accent p-5">
        <p className="font-medium">{draft.scenarioOf ? 'Planning scenario' : draft.state === 'finalised' ? 'Finalised record — read only' : 'Draft assessment'} · {analysis.result.nDays} completed days</p>
        <p className="text-sm text-ink-2">Tick each day when its food and amounts are ready. Only completed days enter the average.</p>
        <div className="flex flex-wrap gap-3">{draft.days.map(d => <label key={d.id} className="flex gap-2"><input type="checkbox" checked={d.complete === true} disabled={finalised || finalising} onChange={e => mapDay(d.id, x => ({...x, complete: e.target.checked}))} />{d.label} complete</label>)}</div>
        <label className="flex gap-2"><input type="checkbox" checked={draft.unquantifiedBreastMilk ?? false} disabled={finalised || finalising} onChange={e => update(a => ({...a, unquantifiedBreastMilk:e.target.checked}))}/>Breastfeeding recorded, volume unquantified (totals are incomplete)</label>
        <Field label="Agreed actions and follow-up (shared with parents)"><AutoTextarea disabled={finalised || finalising} value={draft.parentNote ?? ''} onChange={v => update(a => ({...a, parentNote: v}))} /></Field>
        <div className="flex flex-wrap gap-2">
        <Button size="sm" icon="file" disabled={saveFailed || finalising} onClick={() => void openReport('parent')}>{finalised ? 'Parent summary' : 'Preview parent summary'}</Button>
        <Button size="sm" icon="file" disabled={saveFailed || finalising} onClick={() => void openReport('clinical')}>{finalised ? 'Clinical report' : 'Preview clinical report'}</Button>
        {!finalised ? <Button variant="primary" disabled={!!whyBlocked || finalising} aria-describedby="finalise-help" onClick={async () => {
          if (!confirmDialog('Save this assessment as final and unlock PDF downloads? Any later corrections will be saved as an amendment.')) return
          setFinalising(true)
          const frozen: Assessment = {...draft, days: draft.days.map(d => ({...d, meals: d.meals.map(m => ({...m, items: m.items.map(i => { const f = foodOf(i); return f ? {...i, snap: {kind: f.kind, sourceFoodId: f.sourceFoodId, infantFormula: f.infantFormula, per: f.per, values: {...f.values}}} : i })}))})), state: 'finalised', snapshot: {analysis: JSON.parse(JSON.stringify(analysis)), client: JSON.parse(JSON.stringify({...client, resources:undefined, goals:undefined})), settings: JSON.parse(JSON.stringify({...settings, savedMeals:undefined, recents:[], favourites:[], measures:{}})), finalisedAt: new Date().toISOString(), calculatorVersion: '2.0.0'}}
          if (await persist(frozen)) { setDraft(frozen); latest.current = null; setSaved(true) }
          setFinalising(false)
        }}>{finalising ? "Finalising…" : "Finalise and enable PDFs"}</Button> : <>
        <Button onClick={async () => { const next: Assessment = {...draft, id: uid(), state: 'draft', snapshot: undefined, amendmentOf: draft.id, createdAt: Date.now(), updatedAt: Date.now()}; if (await saveAssessment(next)) nav(`/c/${client.id}/a/${next.id}`) }}>Create amendment</Button>
        <Button onClick={async () => { const next: Assessment = {...draft, id: uid(), state: 'draft', snapshot: undefined, scenarioOf: draft.id, title: 'Scenario: ' + draft.title, createdAt: Date.now(), updatedAt: Date.now()}; if (await saveAssessment(next)) nav(`/c/${client.id}/a/${next.id}`) }}>What-if scenario</Button>
        <Button onClick={() => window.open(`${window.location.pathname}${window.location.search}#/c/${client.id}/family/${draft.id}`, '_blank', 'noopener')}>Open family view</Button>
        </>}
        </div>
        {!finalised && <p id="finalise-help" className="text-sm text-ink-2" role="status">{whyBlocked || 'Ready to finalise. You can preview both reports first.'}</p>}
      </Card>}
      {pane === 'entry' ? <div className="space-y-4">
        {!finalised && <Card className="space-y-2 p-4">
          <Field label="Food history format">
            <Select value={draft.type} disabled={hasEntries || finalising} onChange={event => changeFormat(event.target.value as Assessment['type'])}>
              <option value="diary">3-day food diary</option>
              <option value="typical">Typical day</option>
              <option value="ffq">Food frequency</option>
            </Select>
          </Field>
          <p className="text-sm text-ink-2">{hasEntries ? 'Format is fixed once you start recording. Add another food history to use a different format.' :
            draft.type === 'diary' ? 'Use the diary when the family records what was eaten on specific days. Each day is entered separately.' :
            draft.type === 'typical' ? 'Use a typical day when the family describes their usual routine.' :
            'Use food frequency for foods reported by how often they are eaten over a day, week or month.'}</p>
        </Card>}

        <div className="rounded-xl border border-line bg-accent-wash p-4 text-sm text-ink">
          Search CoFID foods by name and enter a portion for each item. When finished, choose <strong>Review intake</strong>.
        </div>
        <fieldset disabled={finalised || finalising}>{entry}</fieldset>
        <Button variant="primary" onClick={() => {setPane('review'); document.querySelector('.app-main')?.scrollTo({top: 0})}}>Review intake</Button>
      </div> : results}

      {creating && (
        <CustomFoodForm
          initial={{ name: creating.name }}
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
