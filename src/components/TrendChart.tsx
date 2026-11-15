import { useRef, useState } from 'react'
import { formatDateShort, parseDate } from '../domain/age'
import { fmt } from '../domain/nutrients'

export interface TrendPoint {
  date: string // yyyy-mm-dd
  value: number
  note?: string
}

function niceMax(v: number): number {
  if (!(v > 0)) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * p
}

/**
 * Small single-series line chart: 2px line, ringed markers, hairline grid, optional reference line,
 * hover/tap tooltip. One series, so the title carries identity and there is no legend.
 */
export function TrendChart({ title, subtitle, points, unit, dp = 0, reference, referenceLabel, height = 132 }: { title: string; subtitle?: string; points: TrendPoint[]; unit: string; dp?: number; reference?: number; referenceLabel?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const W = 300
  const H = height
  const pad = { l: 34, r: 14, t: 10, b: 20 }
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const xs = sorted.map((p) => parseDate(p.date).getTime())
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const yMax = niceMax(Math.max(...sorted.map((p) => p.value), reference ?? 0) * 1.08)
  const px = (t: number) => (x1 === x0 ? (pad.l + W - pad.r) / 2 : pad.l + ((t - x0) / (x1 - x0)) * (W - pad.l - pad.r))
  const py = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b)
  const path = sorted.map((p, i) => `${i ? 'L' : 'M'}${px(xs[i]).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ')
  const ticks = [0, yMax / 2, yMax]
  const last = sorted[sorted.length - 1]
  const first = sorted[0]
  const delta = sorted.length > 1 ? last.value - sorted[sorted.length - 2].value : null

  const onMove = (clientX: number) => {
    const el = box.current
    if (!el || !sorted.length) return
    const r = el.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < sorted.length; i++) if (Math.abs(px(xs[i]) - x) < Math.abs(px(xs[best]) - x)) best = i
    setHover(best)
  }
  const h = hover != null ? sorted[hover] : null

  return (
    <figure className="rounded-xl border border-line bg-surface p-3">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium">{title}</span>
        {last && (
          <span className="tnum shrink-0 text-[12px] text-ink-2">
            {fmt(last.value, dp)}{unit === '%' ? '' : ' '}{unit}
            {delta != null && Math.abs(delta) >= Math.pow(10, -dp) / 2 && <span className="ml-1 text-muted">({delta > 0 ? '+' : '−'}{fmt(Math.abs(delta), dp)})</span>}
          </span>
        )}
      </figcaption>
      {subtitle && <div className="-mt-1 mb-1 text-[11.5px] text-muted">{subtitle}</div>}
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center text-[12px] text-muted" style={{ height: H }}>No data yet</div>
      ) : (
        <div ref={box} className="relative touch-pan-y" onMouseMove={(e) => onMove(e.clientX)} onMouseLeave={() => setHover(null)} onTouchStart={(e) => onMove(e.touches[0].clientX)} onTouchMove={(e) => onMove(e.touches[0].clientX)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${title}: ${sorted.map((p) => `${formatDateShort(p.date)} ${fmt(p.value, dp)} ${unit}`).join(', ')}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={py(t)} y2={py(t)} stroke={t === 0 ? 'var(--line-strong)' : 'var(--line)'} strokeWidth={1} />
                <text x={pad.l - 6} y={py(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--muted)" className="tnum">{fmt(t, Number.isInteger(t) ? 0 : yMax < 1 ? 2 : 1)}</text>
              </g>
            ))}
            {reference != null && (
              <g>
                <line x1={pad.l} x2={W - pad.r} y1={py(reference)} y2={py(reference)} stroke="var(--ink-2)" strokeWidth={1} />
                <text x={pad.l + 3} y={py(reference) - 4} textAnchor="start" fontSize={10} fill="var(--ink-2)">{referenceLabel ?? 'target'}</text>
              </g>
            )}
            {sorted.length > 1 && <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {h && <line x1={px(xs[hover!])} x2={px(xs[hover!])} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeWidth={1} />}
            {sorted.map((p, i) => (
              <circle key={i} cx={px(xs[i])} cy={py(p.value)} r={hover === i ? 5 : 4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            ))}
            <text x={sorted.length === 1 ? px(xs[0]) : pad.l} y={H - 5} textAnchor={sorted.length === 1 ? 'middle' : 'start'} fontSize={10} fill="var(--muted)">{formatDateShort(first.date)}</text>
            {sorted.length > 1 && <text x={W - pad.r} y={H - 5} textAnchor="end" fontSize={10} fill="var(--muted)">{formatDateShort(last.date)}</text>}
          </svg>
          {h && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] shadow-card whitespace-nowrap" style={{ left: `${Math.min(82, Math.max(18, (px(xs[hover!]) / W) * 100))}%`, top: 0 }}>
              <div className="text-muted">{formatDateShort(h.date)}</div>
              <div className="tnum font-medium">{fmt(h.value, dp)}{unit === '%' ? '' : ' '}{unit}</div>
              {h.note && <div className="text-muted">{h.note}</div>}
            </div>
          )}
        </div>
      )}
    </figure>
  )
}
