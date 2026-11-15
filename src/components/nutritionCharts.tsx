import { useState } from 'react'
import type { Gap } from '../domain/explore'
import { fmt, fmtNutrient } from '../domain/nutrients'
import { Icon, cx } from './ui'

const SCALE = 150 // bars run from 0 to 150% of target

const toneOf = (g: Gap) =>
  g.status === 'low' ? 'bg-critical' : g.status === 'below' ? 'bg-warning' : g.status === 'met' ? 'bg-good' : g.pct < 100 ? 'bg-warning' : 'bg-good'

const pos = (pct: number) => `${(Math.min(Math.max(pct, 0), SCALE) / SCALE) * 100}%`

/**
 * Horizontal bars of intake as a share of each nutrient's target, lowest first.
 * Optional `boost` adds a second segment showing what extra foods would add.
 */
export function GapBars({ gaps, boost, show = 8, selected, onSelect, compact }: {
  gaps: Gap[]
  boost?: Record<string, number>
  show?: number
  selected?: string | null
  onSelect?: (id: string) => void
  compact?: boolean
}) {
  const [all, setAll] = useState(false)
  if (!gaps.length) return <p className="text-[13px] text-ink-2">No reference values to compare against. Add the date of birth and sex to the client record.</p>
  const rows = all ? gaps : gaps.slice(0, show)
  return (
    <div>
      <ul className="space-y-1" aria-label="Intake as a share of the daily target">
        {rows.map((g) => {
          const extra = boost?.[g.id] ?? 0
          const lrni = g.target.lrni != null ? (g.target.lrni / g.target.value) * 100 : null
          const title = `${g.label}: ${g.minimum ? 'at least ' : ''}${fmtNutrient(g.id, g.value)} ${g.unit} per day, ${Math.round(g.pct)}% of the ${g.target.type} (${g.target.value} ${g.unit})${lrni != null ? `; LRNI ${g.target.lrni}` : ''}${extra > 0 ? `; +${Math.round(extra)}% with the foods you are trying` : ''}${g.minimum ? '. Some foods have no value for this nutrient, so this is a minimum.' : ''}`
          return (
            <li key={g.id}>
              <button
                type="button"
                title={title}
                onClick={() => onSelect?.(g.id)}
                className={cx('grid w-full grid-cols-[88px_minmax(0,1fr)_64px] items-center gap-2 rounded-md px-1.5 text-left transition-colors sm:grid-cols-[112px_minmax(0,1fr)_76px]', compact ? 'py-0.5' : 'py-1', onSelect && 'hover:bg-surface-2', selected === g.id && 'bg-accent-wash')}
              >
                <span className="truncate text-[12.5px] font-medium">{g.label}</span>
                <span className="relative block h-4" aria-hidden="true">
                  <span className="absolute inset-x-0 top-1 block h-2 overflow-hidden rounded-full bg-track">
                    <span className={cx('absolute inset-y-0 left-0 block rounded-full', toneOf(g), g.minimum && 'opacity-70')} style={{ width: pos(g.pct) }} />
                    {extra > 0 && <span className="absolute inset-y-0 block rounded-r-full bg-series-2" style={{ left: pos(g.pct), width: `calc(${pos(g.pct + extra)} - ${pos(g.pct)})` }} />}
                  </span>
                  {lrni != null && <span className="absolute top-0.5 block h-3 w-px bg-critical" style={{ left: pos(lrni) }} />}
                  <span className="absolute top-0 block h-4 w-[2px] rounded-full bg-ink" style={{ left: `calc(${pos(100)} - 1px)` }} />
                </span>
                <span className="tnum text-right text-[12.5px] whitespace-nowrap">
                  {g.minimum && <span className="text-warning-ink">≥</span>}
                  <span className="font-medium">{fmt(g.pct, 0)}%</span>
                  {extra > 0 && <span className="ml-1 text-[11.5px] text-series-2">+{fmt(extra, 0)}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-2">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-critical" />Below LRNI</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />Below target</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-good" />Meets target</span>
        {boost && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-series-2" />Added by foods you are trying</span>}
        <span className="inline-flex items-center gap-1"><span className="h-3 w-[2px] bg-ink" />100% of target</span>
        <span className="text-muted">≥ minimum: some foods have no value</span>
        {gaps.length > show && (
          <button type="button" className="ml-auto font-medium text-accent-ink hover:underline" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show all ${gaps.length}`}
          </button>
        )}
      </div>
    </div>
  )
}

/** Salt and other maximums: how close intake is to the upper limit. */
export function LimitBars({ limits }: { limits: { id: string; label: string; value: number; max: number; unit: string; pct: number }[] }) {
  if (!limits.length) return null
  return (
    <ul className="space-y-1.5">
      {limits.map((l) => (
        <li key={l.id} className="grid grid-cols-[88px_minmax(0,1fr)_76px] items-center gap-2 text-[12.5px] sm:grid-cols-[112px_minmax(0,1fr)_96px]" title={`${l.label}: ${fmtNutrient(l.id, l.value)} ${l.unit} of a ${l.max} ${l.unit} maximum`}>
          <span className="truncate font-medium">{l.label}</span>
          <span className="relative block h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
            <span className={cx('absolute inset-y-0 left-0 rounded-full', l.pct > 100 ? 'bg-critical' : l.pct > 80 ? 'bg-warning' : 'bg-good')} style={{ width: `${Math.min(l.pct, 100)}%` }} />
          </span>
          <span className="tnum text-right whitespace-nowrap"><span className="font-medium">{fmtNutrient(l.id, l.value)}</span> <span className="text-muted">/ {l.max} {l.unit}</span></span>
        </li>
      ))}
    </ul>
  )
}

/** Small headline numbers. */
export function StatTiles({ items }: { items: { label: string; value: string; sub?: string; tone?: 'critical' | 'warning' | 'good' }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-lg border border-line px-3 py-2">
          <div className="text-[11.5px] text-ink-2">{s.label}</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className={cx('tnum text-xl font-semibold tracking-tight', s.tone === 'critical' && 'text-critical-ink', s.tone === 'warning' && 'text-warning-ink', s.tone === 'good' && 'text-good-ink')}>{s.value}</span>
            {s.tone === 'critical' && <Icon name="alertCircle" size={13} className="text-critical-ink" />}
          </div>
          {s.sub && <div className="text-[11.5px] text-muted">{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}

/** Counts per food group as a single stacked bar, for the variety of accepted foods. */
export function GroupBar({ groups }: { groups: { label: string; count: number }[] }) {
  const total = groups.reduce((n, g) => n + g.count, 0)
  const cls = ['bg-series-1', 'bg-good', 'bg-series-2', 'bg-series-3', 'bg-warning', 'bg-muted']
  if (!total) return <p className="text-[13px] text-ink-2">No accepted foods recorded yet.</p>
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={groups.map((g) => `${g.label}: ${g.count}`).join(', ')}>
        {groups.map((g, i) => g.count > 0 && <span key={g.label} className={cls[i % cls.length]} style={{ width: `${(g.count / total) * 100}%` }} title={`${g.label}: ${g.count}`} />)}
      </div>
      <ul className="mt-2 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
        {groups.map((g, i) => (
          <li key={g.label} className={cx('flex items-center gap-1.5', !g.count && 'text-muted')}>
            <span className={cx('h-2 w-2 shrink-0 rounded-sm', cls[i % cls.length])} />
            <span className="min-w-0 flex-1 truncate">{g.label}</span>
            <span className="tnum font-medium">{g.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
