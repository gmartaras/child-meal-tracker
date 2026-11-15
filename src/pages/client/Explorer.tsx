import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FoodSearch } from '../../components/FoodSearch'
import { GapBars, LimitBars, StatTiles } from '../../components/nutritionCharts'
import { Button, Card, IconButton, Select, cx } from '../../components/ui'
import { ageInMonths, formatAge, formatDate, todayISO } from '../../domain/age'
import { addTotals, boostersFor, gapsOf, limitsOf, quickItem, snapshotOf, targetsForClient, totalsOf, typicalPortion, type Booster } from '../../domain/explore'
import { getFood } from '../../domain/foods'
import { measuresFor } from '../../domain/measures'
import { NUTRIENT_BY_ID, fmt, fmtNutrient } from '../../domain/nutrients'
import { rawValue, type Totals } from '../../domain/calc'
import type { Assessment, Client, ExplorerState, Food, Item } from '../../domain/types'
import { useStore } from '../../store/store'
import { Targets } from './Targets'

const EMPTY: ExplorerState = { baseId: '', usual: [], plan: [] }

function FoodRow({ item, ageMonths, onChange, onRemove }: { item: Item; ageMonths: number; onChange: (i: Item) => void; onRemove: () => void }) {
  const food = getFood(item.foodId)
  const options = useMemo(() => {
    const ms = food ? measuresFor(food, { ageMonths }) : []
    return ms.some((m) => m.label === item.measure) ? ms : [{ label: item.measure, amount: item.measureAmount }, ...ms]
  }, [food, ageMonths, item.measure, item.measureAmount])
  const [text, setText] = useState(String(item.qty))
  const kcal = food ? ((rawValue(food, 'energy').v ?? 0) * item.amount) / food.per : 0
  return (
    <li className="flex flex-wrap items-center gap-1.5 px-3 py-2">
      <span className="min-w-0 flex-1 basis-40 truncate text-[13px]" title={item.name}>{item.name}</span>
      <input
        value={text}
        inputMode="decimal"
        aria-label={`Amount of ${item.name}`}
        onChange={(e) => {
          setText(e.target.value)
          const q = parseFloat(e.target.value.replace(',', '.'))
          const qty = isFinite(q) && q >= 0 ? q : 0
          onChange({ ...item, qty, amount: qty * item.measureAmount })
        }}
        className="tnum h-8 w-14 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm focus:border-accent focus:outline-none"
      />
      <Select aria-label={`Measure for ${item.name}`} value={item.measure} className="h-8 w-auto max-w-[12rem] py-0 text-[12.5px]" onChange={(e) => {
        const m = options.find((x) => x.label === e.target.value)
        if (m) onChange({ ...item, measure: m.label, measureAmount: m.amount, amount: item.qty * m.amount })
      }}>
        {options.map((m) => <option key={m.label} value={m.label}>{m.label}</option>)}
      </Select>
      <span className="tnum w-16 text-right text-[12px] text-muted">{fmt(kcal, 0)} kcal</span>
      <IconButton icon="trash" label={`Remove ${item.name}`} onClick={onRemove} className="h-7 w-7" />
    </li>
  )
}

function FoodList({ title, hint, items, ageMonths, onChange, empty, tone }: { title: string; hint: string; items: Item[]; ageMonths: number; onChange: (items: Item[]) => void; empty: string; tone?: 'plan' }) {
  const add = (food: Food) => {
    const p = typicalPortion(food, ageMonths)
    const named = p.label !== `${p.amount} ${food.unit}`
    onChange([...items, named ? quickItem(food, p.amount, p.label) : quickItem(food, p.amount)])
  }
  return (
    <Card className={cx(tone === 'plan' && 'border-series-2/40')}>
      <div className="flex items-baseline justify-between gap-2 px-3 pt-3">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {items.length > 0 && <button type="button" className="text-[12px] text-muted hover:text-ink" onClick={() => onChange([])}>Clear</button>}
      </div>
      <p className="px-3 pb-2 text-[12px] text-ink-2">{hint}</p>
      {items.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">{items.map((it) => (
          <FoodRow key={it.id} item={it} ageMonths={ageMonths} onChange={(next) => onChange(items.map((x) => (x.id === it.id ? next : x)))} onRemove={() => onChange(items.filter((x) => x.id !== it.id))} />
        ))}</ul>
      ) : <p className="border-t border-line px-3 py-2 text-[12.5px] text-muted">{empty}</p>}
      <div className="p-3"><FoodSearch placeholder="Add a food…" onPick={add} /></div>
    </Card>
  )
}

function BoosterList({ list, nutrient, onTry, tried }: { list: Booster[]; nutrient: string; onTry: (b: Booster) => void; tried: Set<string> }) {
  const n = NUTRIENT_BY_ID[nutrient]
  const max = Math.max(...list.map((b) => b.value), 0)
  return (
    <ul className="space-y-1.5">
      {list.map((b) => (
        <li key={b.food.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="truncate" title={b.food.name}>{b.food.name}</span>
              <span className="tnum shrink-0 text-ink-2">{fmtNutrient(nutrient, b.value)} {n.unit}{b.pctOfTarget > 0 && <span className="text-muted"> · {fmt(b.pctOfTarget, 0)}%</span>}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-track"><span className="block h-full rounded-full bg-series-2" style={{ width: `${Math.max(3, (b.value / (max || 1)) * 100)}%` }} /></span>
              <span className="shrink-0 text-[11px] text-muted">per {b.portion.label}</span>
            </div>
          </div>
          <Button size="sm" variant={tried.has(b.food.id) ? 'ghost' : 'secondary'} disabled={tried.has(b.food.id)} onClick={() => onTry(b)}>{tried.has(b.food.id) ? 'Added' : 'Try'}</Button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Nutrient explorer: start from a food history (or nothing), add foods the child eats or could eat,
 * and see at once which nutrients fall short and what a planned food would add.
 */
export function Explorer({ client, assessments }: { client: Client; assessments: Assessment[] }) {
  const settings = useStore((s) => s.settings)
  const patchClient = useStore((s) => s.patchClient)
  const histories = useMemo(() => assessments.filter((a) => !a.scenarioOf).sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt), [assessments])
  const initial = client.explorer ?? { ...EMPTY, baseId: histories[0]?.id ?? '' }
  const [state, setState] = useState<ExplorerState>(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(state)
  latest.current = state
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current)
      void patchClient(client.id, { explorer: latest.current })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const change = (patch: Partial<ExplorerState>) => {
    const next = { ...state, ...patch }
    setState(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void patchClient(client.id, { explorer: next })
    }, 700)
  }

  const today = todayISO()
  const ageMonths = ageInMonths(client.dob, today)
  const targets = useMemo(() => targetsForClient(client, today), [client, today])
  const base = histories.find((a) => a.id === state.baseId)
  const baseSnap = useMemo(() => (base ? snapshotOf(base, client, settings) : null), [base, client, settings])
  const baseTotals: Totals = useMemo(() => {
    const b = baseSnap?.analysis.result.avg ?? totalsOf([])
    return state.usual.length ? addTotals(b, totalsOf(state.usual)) : b
  }, [baseSnap, state.usual])
  const planTotals = useMemo(() => totalsOf(state.plan), [state.plan])
  const withPlan = useMemo(() => addTotals(baseTotals, planTotals), [baseTotals, planTotals])
  const gaps = useMemo(() => gapsOf(baseTotals, targets, settings.panel), [baseTotals, targets, settings.panel])
  const gapsAfter = useMemo(() => gapsOf(withPlan, targets, settings.panel), [withPlan, targets, settings.panel])
  const boost = useMemo(() => Object.fromEntries(gapsAfter.map((g) => [g.id, g.pct - (gaps.find((x) => x.id === g.id)?.pct ?? 0)])), [gaps, gapsAfter])
  const limits = limitsOf(state.plan.length ? withPlan : baseTotals, targets)
  const focus = state.focus && targets[state.focus] ? state.focus : gaps[0]?.id ?? 'iron'
  const acceptedIds = useMemo(() => (client.acceptedFoods ?? []).map((f) => f.foodId).filter((x): x is string => !!x), [client.acceptedFoods])
  const boosters = useMemo(() => boostersFor(focus, { ageMonths: Number.isFinite(ageMonths) ? ageMonths : 36, target: targets[focus], acceptedIds, limit: 8 }), [focus, ageMonths, targets, acceptedIds])
  const tried = new Set(state.plan.map((i) => i.foodId))
  const hasFoods = !!baseSnap || state.usual.length > 0
  const count = (list: typeof gaps, s: string) => list.filter((g) => g.status === s).length
  const energy = (t: Totals) => t.energy?.v ?? 0
  const ear = targets.energy?.value

  if (!client.dob || !client.sex) {
    return <Card className="p-5 text-[13px] text-ink-2">Add the date of birth and sex in the client record to compare intake with UK reference values.</Card>
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-3">
        <Card className="p-3">
          <label className="block text-[12px] font-medium text-ink-2" htmlFor="explorer-base">Start from</label>
          <Select id="explorer-base" className="mt-1" value={state.baseId} onChange={(e) => change({ baseId: e.target.value })}>
            <option value="">Nothing: I will list the foods</option>
            {histories.map((a) => <option key={a.id} value={a.id}>{a.title} · {formatDate(a.date)}{a.state === 'finalised' ? ' · finalised' : ''}</option>)}
          </Select>
          {base && (
            <p className="mt-1.5 text-[12px] text-ink-2">
              {baseSnap ? <>Daily average of {baseSnap.days} day{baseSnap.days === 1 ? '' : 's'}{baseSnap.provisional && <span className="text-warning-ink"> including unconfirmed days</span>}. </> : 'No foods with amounts in this history yet. '}
              <Link to={`/c/${client.id}/a/${base.id}`} className="font-medium text-accent-ink hover:underline">Open food history</Link>
            </p>
          )}
        </Card>
        <FoodList title="Also eats regularly" hint="Foods missing from the starting point, as an amount per day." items={state.usual} ageMonths={ageMonths} onChange={(usual) => change({ usual })} empty="Nothing added." />
        <FoodList tone="plan" title="Try adding" hint="Foods you might recommend. What they add shows as an extra segment on each bar." items={state.plan} ageMonths={ageMonths} onChange={(plan) => change({ plan })} empty="Pick foods from the suggestions, or search." />
      </div>

      <div className="space-y-3">
        {!hasFoods && !state.plan.length ? (
          <Card className="p-6 text-center text-[13px] text-ink-2">Choose a food history to start from, or add the foods the child eats, to see which nutrients fall short.</Card>
        ) : (
          <>
            <StatTiles items={[
              { label: 'Energy per day', value: fmt(energy(state.plan.length ? withPlan : baseTotals), 0), sub: ear ? `${fmt((energy(state.plan.length ? withPlan : baseTotals) / ear) * 100, 0)}% of EAR (${ear} kcal)` : 'kcal' },
              { label: 'Below LRNI', value: state.plan.length ? `${count(gaps, 'low')} → ${count(gapsAfter, 'low')}` : String(count(gaps, 'low')), sub: 'nutrients', tone: count(state.plan.length ? gapsAfter : gaps, 'low') ? 'critical' : undefined },
              { label: 'Below target', value: state.plan.length ? `${count(gaps, 'below')} → ${count(gapsAfter, 'below')}` : String(count(gaps, 'below')), sub: 'nutrients', tone: count(state.plan.length ? gapsAfter : gaps, 'below') ? 'warning' : undefined },
              { label: 'Meeting target', value: state.plan.length ? `${count(gaps, 'met')} → ${count(gapsAfter, 'met')}` : String(count(gaps, 'met')), sub: 'nutrients', tone: 'good' },
            ]} />
            <Card className="p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-semibold">Nutrients furthest from target</h3>
                <span className="text-[12px] text-muted">UK reference values for {formatAge(ageMonths)}, {client.sex === 'M' ? 'boy' : 'girl'} · select a nutrient to find foods that boost it</span>
              </div>
              <GapBars gaps={gaps} boost={state.plan.length ? boost : undefined} show={10} selected={focus} onSelect={(id) => change({ focus: id })} />
            </Card>
            {limits.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-2 text-[13px] font-semibold">Keep below the maximum</h3>
                <LimitBars limits={limits} />
              </Card>
            )}
          </>
        )}

        <Card className="p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold">Boost {NUTRIENT_BY_ID[focus]?.short ?? NUTRIENT_BY_ID[focus]?.label ?? ''}</h3>
            <Select aria-label="Nutrient to boost" value={focus} className="h-8 w-auto py-0 text-[12.5px]" onChange={(e) => change({ focus: e.target.value })}>
              {settings.panel.filter((id) => targets[id] && targets[id].type !== 'Max').map((id) => <option key={id} value={id}>{NUTRIENT_BY_ID[id]?.label ?? id}</option>)}
            </Select>
          </div>
          <p className="mb-3 text-[12px] text-ink-2">
            Amount in one typical portion{targets[focus] ? ` and its share of the daily ${targets[focus].type} (${targets[focus].value} ${NUTRIENT_BY_ID[focus]?.unit})` : ''}. Suggestions are ideas to review, not advice: check textures, allergies and the child’s stage.
          </p>
          {boosters.accepted.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[12px] font-medium text-good-ink">Already accepted</div>
              <BoosterList list={boosters.accepted} nutrient={focus} tried={tried} onTry={(b) => change({ plan: [...state.plan, quickItem(b.food, b.portion.amount, b.portion.label === `${b.portion.amount} ${b.food.unit}` ? undefined : b.portion.label)] })} />
            </div>
          )}
          <div className="mb-1.5 text-[12px] font-medium text-ink-2">Other good sources</div>
          <BoosterList list={boosters.ideas} nutrient={focus} tried={tried} onTry={(b) => change({ plan: [...state.plan, quickItem(b.food, b.portion.amount, b.portion.label === `${b.portion.amount} ${b.food.unit}` ? undefined : b.portion.label)] })} />
        </Card>

        <details className="rounded-xl border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold">Targets for this child</summary>
          <div className="mt-3"><Targets key={client.id} client={client} /></div>
        </details>
      </div>
    </div>
  )
}
