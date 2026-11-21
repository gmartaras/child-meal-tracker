import { useState } from 'react'
import type { Analysis } from '../domain/analysis'
import { amountLabel, type AssessmentResult, type Tot } from '../domain/calc'
import { statusLabel, statusOf, type Status, type Target } from '../domain/drv'
import type { Insight } from '../domain/insights'
import { GROUP_ORDER, NUTRIENTS, NUTRIENT_BY_ID, fmt, fmtNutrient } from '../domain/nutrients'
import { Icon, cx } from './ui'

const SCALE_MAX = 150 // bars run from 0 to 150% of target

export function StatusChip({ status, compact, target }: { status: Status; compact?: boolean; target?: Target }) {
  if (status === 'unknown') return <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap text-ink-2"><Icon name="info" size={12} />{!compact && 'Insufficient data'}</span>
  if (status === 'none') return <span className="text-[12px] text-muted">{compact ? '' : 'No reference'}</span>
  const tone =
    status === 'met' ? 'text-good-ink bg-good-wash' : status === 'low' ? 'text-critical-ink bg-critical-wash' : 'text-warning-ink bg-warning-wash'
  const icon = status === 'met' ? 'check' : status === 'low' ? 'alertCircle' : status === 'above' ? 'arrowUp' : 'alert'
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap', tone)}>
      <Icon name={icon} size={12} />
      {!compact && statusLabel(status, target)}
    </span>
  )
}

function Meter({ tot, target }: { tot: Tot; target: Target }) {
  const pct = (tot.v / target.value) * 100
  const food = ((tot.v - tot.supp) / target.value) * 100
  const w = (x: number) => `${(Math.min(Math.max(x, 0), SCALE_MAX) / SCALE_MAX) * 100}%`
  const foodW = Math.min(food, SCALE_MAX)
  const suppW = Math.max(0, Math.min(pct, SCALE_MAX) - foodW)
  return (
    <div className="relative h-4" aria-hidden="true">
      <div className="absolute inset-x-0 top-1 flex h-2 gap-[2px] overflow-hidden rounded-full bg-track">
        {foodW > 0 && <div className="h-full rounded-l-full bg-series-1" style={{ width: w(foodW), borderRadius: suppW > 0 ? undefined : '9999px' }} />}
        {suppW > 0 && <div className="h-full rounded-r-full bg-series-2" style={{ width: w(suppW) }} />}
      </div>
      {target.lrni != null && <div className="absolute top-0.5 h-3 w-px bg-critical" style={{ left: w((target.lrni / target.value) * 100) }} />}
      <div className="absolute top-0 h-4 w-[2px] rounded-full bg-ink" style={{ left: `calc(${w(100)} - 1px)` }} />
    </div>
  )
}

function rowTitle(id: string, tot: Tot, t: Target | undefined): string {
  const n = NUTRIENT_BY_ID[id]
  const parts = [`${n.label}: ${tot.missing.length ? 'at least ' : ''}${fmtNutrient(id, tot.v)} ${n.unit} per day`]
  if (tot.supp > 0) parts.push(`of which supplements: ${fmtNutrient(id, tot.supp)} ${n.unit}`)
  if (t) parts.push(`${t.type}: ${t.value} ${n.unit}${t.lrni != null ? ` · LRNI: ${t.lrni}` : ''} (${t.source})`)
  if (tot.missing.length) parts.push(`No value for: ${tot.missing.join('; ')}`)
  if (tot.lowEst) parts.push('Includes NSP fibre values, which under-read against AOAC targets')
  return parts.join('\n')
}

export function NutrientTable({ result, targets, panel, selected, onSelect }: { result: AssessmentResult; targets: Record<string, Target>; panel: string[]; selected?: string | null; onSelect?: (id: string) => void }) {
  const shown = NUTRIENTS.filter((n) => panel.includes(n.id))
  const anySupp = shown.some((n) => result.avg[n.id]?.supp > 0)
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-series-1" />Food &amp; drink</span>
        {anySupp && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-series-2" />Supplements</span>}
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[2px] rounded-full bg-ink" />Target (100%)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-critical" />LRNI</span>
      </div>
      {GROUP_ORDER.map((g) => {
        const rows = shown.filter((n) => n.group === g)
        if (!rows.length) return null
        return (
          <div key={g} className="mb-3 last:mb-0">
            <div className="mb-1 text-[12px] font-medium text-muted">{g}</div>
            <div className="divide-y divide-line rounded-lg border border-line">
              {rows.map((n) => {
                const tot = result.avg[n.id]
                const t = targets[n.id]
                const st = t ? statusOf(tot, t) : 'none'
                const pct = t ? Math.round((tot.v / t.value) * 100) : null
                return (
                  <button
                    key={n.id}
                    type="button"
                    title={rowTitle(n.id, tot, t)}
                    onClick={() => onSelect?.(n.id)}
                    className={cx('grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg sm:grid-cols-[124px_minmax(60px,1fr)_auto_40px_118px]', selected === n.id ? 'bg-accent-wash' : 'hover:bg-surface-2')}
                  >
                    <span className="truncate text-[13px] font-medium">{n.short ?? n.label}</span>
                    <span className="order-3 col-span-2 sm:order-none sm:col-span-1">{t ? <Meter tot={tot} target={t} /> : <span className="block h-4" />}</span>
                    <span className="tnum order-2 text-right text-[13px] whitespace-nowrap sm:order-none sm:min-w-[92px]">
                      {tot.missing.length > 0 && <span className="text-warning-ink" aria-label="at least">≥ </span>}
                      <span className="font-medium">{fmtNutrient(n.id, tot.v)}</span> <span className="text-muted">{n.unit}</span>
                    </span>
                    <span className="tnum order-4 text-[12px] text-ink-2 sm:order-none sm:text-right">{pct != null ? `${pct}%` : ''}</span>
                    <span className="order-5 text-right sm:order-none">
                      <StatusChip status={st} target={t} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const MACROS = [
  { id: 'protein', label: 'Protein', cls: 'bg-series-1', ink: 'text-white' },
  { id: 'fat', label: 'Fat', cls: 'bg-series-2', ink: 'text-white' },
  { id: 'carb', label: 'Carbohydrate', cls: 'bg-series-3', ink: 'text-white' },
] as const

export function MacroBar({ pct }: { pct: NonNullable<AssessmentResult['energyPct']> }) {
  const total = pct.protein + pct.fat + pct.carb || 1
  return (
    <div>
      <div className="flex h-7 gap-[2px]" role="img" aria-label={`Energy from protein ${Math.round(pct.protein)}%, fat ${Math.round(pct.fat)}%, carbohydrate ${Math.round(pct.carb)}%`}>
        {MACROS.map((m) => {
          const share = (pct[m.id] / total) * 100
          if (share <= 0) return null
          return (
            <div key={m.id} title={`${m.label}: ${Math.round(pct[m.id])}% of energy`} className={cx('flex items-center rounded-[4px] px-2 text-[12px] font-medium', m.cls, m.ink)} style={{ width: `${share}%` }}>
              {share >= 12 ? `${Math.round(pct[m.id])}%` : ''}
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        {MACROS.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1.5">
            <span className={cx('h-2 w-2 rounded-sm', m.cls)} />
            {m.label}
          </span>
        ))}
        <span className="text-muted">of which saturated fat {fmt(pct.satfat, 0)}% of energy</span>
      </div>
    </div>
  )
}

/** Foods ranked by how much of a nutrient they provide, each with the amount eaten that provides it. */
export function SourcesList({ result, nutrient, limit = 8, perDay = true }: { result: AssessmentResult; nutrient: string; limit?: number; perDay?: boolean }) {
  const n = NUTRIENT_BY_ID[nutrient]
  const perDayLabel = perDay ? ' a day' : ''
  const list = result.sources[nutrient] ?? []
  const total = result.avg[nutrient]?.v ?? 0
  const missing = result.avg[nutrient]?.missing ?? []
  if (!list.length) return <p className="text-[13px] text-ink-2">No foods recorded contain a measured amount of {n.label.toLowerCase()}.</p>
  const max = list[0].value
  return (
    <div>
      <ul className="space-y-1.5">
        {list.slice(0, limit).map((s) => (
          <li key={s.name} title={`${s.name}: ${amountLabel(s.amount, s.unit) ? `${amountLabel(s.amount, s.unit)} a day provides ` : ''}${fmtNutrient(nutrient, s.value)} ${n.unit}/day (${Math.round((s.value / total) * 100)}%)`}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate">{s.name}{amountLabel(s.amount, s.unit) && <span className="tnum ml-1.5 text-[12px] text-muted">{amountLabel(s.amount, s.unit)}{perDayLabel}</span>}</span>
              <span className="tnum shrink-0 text-ink-2">
                {fmtNutrient(nutrient, s.value)} {n.unit} · {Math.round((s.value / total) * 100)}%
              </span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-track">
              <div className={cx('h-full rounded-full', s.kind === 'supplement' ? 'bg-series-2' : 'bg-series-1')} style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {list.length > limit && <p className="mt-2 text-[12px] text-muted">+ {list.length - limit} more foods</p>}
      {missing.length > 0 && (
        <p className="mt-3 text-[12px] text-ink-2">
          <span className="font-medium text-warning-ink">No {n.short ?? n.label} value in the food data for:</span> {missing.join('; ')}.
        </p>
      )}
    </div>
  )
}

const SEV = {
  critical: { icon: 'alertCircle', cls: 'text-critical-ink', label: 'Priority' },
  warning: { icon: 'alert', cls: 'text-warning-ink', label: 'Review' },
  good: { icon: 'check', cls: 'text-good-ink', label: 'Positive' },
  info: { icon: 'info', cls: 'text-muted', label: 'Note' },
} as const

export function InsightList({ insights, onSelect }: { insights: Insight[]; onSelect?: (nutrient: string) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!insights.length) return <p className="text-[13px] text-ink-2">Add foods to see insights.</p>
  return (
    <ul className="divide-y divide-line">
      {insights.map((i, idx) => {
        const s = SEV[i.severity]
        return (
          <li key={idx} className="py-2 first:pt-0 last:pb-0">
            <button
              type="button"
              className="flex w-full items-start gap-2 text-left"
              onClick={() => {
                setOpen(open === idx ? null : idx)
                if (i.nutrient) onSelect?.(i.nutrient)
              }}
            >
              <Icon name={s.icon} className={cx('mt-0.5', s.cls)} />
              <span className="min-w-0 flex-1">
                <span className="sr-only">{s.label}: </span>
                <span className="text-[13px] font-medium">{i.title}</span>
                {i.detail && (open === idx || i.severity === 'critical') && <span className="mt-0.5 block text-[12.5px] text-ink-2">{i.detail}</span>}
              </span>
              {i.detail && i.severity !== 'critical' && <Icon name={open === idx ? 'chevronDown' : 'chevronRight'} size={14} className="mt-1 text-muted" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Headline tiles: energy against EAR and count of flagged nutrients. */
export function Headline({ analysis, panel }: { analysis: Analysis; panel: string[] }) {
  const { result, targets } = analysis
  const e = targets.energy
  const kcal = result.avg.energy.v
  let low = 0
  let below = 0
  let met = 0
  for (const id of panel) {
    if (id === 'energy' || !targets[id]) continue
    const st = statusOf(result.avg[id], targets[id])
    if (st === 'low') low++
    else if (st === 'below' || st === 'above') below++
    else if (st === 'met') met++
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      <Stat label="Energy per day" value={fmt(kcal, 0)} unit="kcal" sub={e ? `${Math.round((kcal / e.value) * 100)}% of EAR (${e.value})` : undefined} />
      <Stat label="Below LRNI" value={String(low)} sub="nutrients" tone={low ? 'critical' : undefined} />
      <Stat label="Outside target" value={String(below)} sub="nutrients" tone={below ? 'warning' : undefined} />
      <Stat label="Meeting target" value={String(met)} sub="nutrients" />
    </div>
  )
}

function Stat({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: 'critical' | 'warning' }) {
  return (
    <div>
      <div className="text-[12px] text-ink-2">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-[13px] text-muted">{unit}</span>}
        {tone && <Icon name={tone === 'critical' ? 'alertCircle' : 'alert'} size={14} className={tone === 'critical' ? 'text-critical-ink' : 'text-warning-ink'} />}
      </div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
    </div>
  )
}
