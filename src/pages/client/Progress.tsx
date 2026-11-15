import { useState } from 'react'
import { TrendChart, type TrendPoint } from '../../components/TrendChart'
import { StatusChip } from '../../components/analysis'
import { Banner, Card, Empty, SectionTitle, Segmented, cx } from '../../components/ui'
import { ageInMonths, formatAge, formatDate, todayISO } from '../../domain/age'
import type { Analysis } from '../../domain/analysis'
import { referenceTargets, statusOf } from '../../domain/drv'
import { GROUP_ORDER, NUTRIENTS, fmt, fmtNutrient } from '../../domain/nutrients'
import type { Assessment, Client, Session } from '../../domain/types'
import { useStore } from '../../store/store'

export function Progress({ client, rows, sessions, panel }: { client: Client; rows: { a: Assessment; an: Analysis }[]; sessions: Session[]; panel: string[] }) {
  const [mode, setMode] = useState<'pct' | 'abs'>('pct')
  const done = rows.filter((r) => r.a.state === 'finalised' && !r.a.scenarioOf && r.an.result.nDays > 0).sort((x, y) => x.a.date.localeCompare(y.a.date))
  const weights: TrendPoint[] = sessions.filter((s) => s.weightKg != null).map((s) => ({ date: s.date, value: s.weightKg!, note: `age ${formatAge(ageInMonths(client.dob, s.date))}` }))
  const heights: TrendPoint[] = sessions.filter((s) => s.heightCm != null).map((s) => ({ date: s.date, value: s.heightCm!, note: `age ${formatAge(ageInMonths(client.dob, s.date))}` }))
  const shown = NUTRIENTS.filter((n) => panel.includes(n.id))
  const latest = done[done.length - 1]
  const prev = done[done.length - 2]

  // accepted foods: running total by the date each food was added
  const accepted = [...(client.acceptedFoods ?? [])].sort((a, b) => a.addedOn.localeCompare(b.addedOn))
  const acceptedPoints: TrendPoint[] = []
  accepted.forEach((f, i) => {
    const last = acceptedPoints[acceptedPoints.length - 1]
    if (last && last.date === f.addedOn) last.value = i + 1
    else acceptedPoints.push({ date: f.addedOn, value: i + 1 })
  })

  return (
    <div className="space-y-6">
      {(acceptedPoints.length > 0 || weights.length + heights.length > 0) && (
        <section>
          <SectionTitle>Food range and growth</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {acceptedPoints.length > 0 && <TrendChart title="Accepted foods" subtitle="number of foods on the accepted list" points={acceptedPoints} unit="foods" height={150} />}
            {weights.length > 0 && <TrendChart title="Weight" points={weights} unit="kg" dp={2} height={150} />}
            {heights.length > 0 && <TrendChart title="Length / height" points={heights} unit="cm" dp={1} height={150} />}
          </div>
          {weights.length + heights.length > 0 && <p className="mt-2 text-[12px] text-muted">Measurements are plotted as recorded. Use your UK-WHO growth charts for centiles.</p>}
        </section>
      )}
      <section>
        <SectionTitle action={done.length > 0 ? <Segmented value={mode} onChange={setMode} options={[{ id: 'pct', label: '% of target' }, { id: 'abs', label: 'Amounts' }]} /> : undefined}>Nutrient intake over time</SectionTitle>
        {done.length === 0 ? (
          <Card><Empty icon="trend" title="No food histories yet">Trends are drawn from finalised food histories. Finalise one to add a point to every chart.</Empty></Card>
        ) : (
          <>
            {done.length === 1 && <div className="mb-3"><Banner>One finalised food history so far. Finalise a follow-up history to see how intake changes between sessions.</Banner></div>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {shown.map((n) => {
                const usePct = mode === 'pct' && done.some((r) => r.an.targets[n.id])
                const points: TrendPoint[] = done.filter((r) => !usePct || r.an.targets[n.id]).map((r) => {
                  const v = r.an.result.avg[n.id].v
                  const t = r.an.targets[n.id]
                  return { date: r.a.date, value: usePct ? (v / t.value) * 100 : v, note: usePct ? `${fmtNutrient(n.id, v)} ${n.unit} · ${r.a.title}` : r.a.title }
                })
                const tLast = latest.an.targets[n.id]
                return <TrendChart key={n.id} title={n.short ?? n.label} subtitle={usePct ? `% of ${tLast?.type === 'Max' ? 'maximum' : (tLast?.type ?? 'target')}` : `${n.unit} per day${mode === 'pct' ? ' · no reference value' : ''}`} points={points} unit={usePct ? '%' : n.unit} dp={usePct ? 0 : n.dp} reference={usePct ? 100 : undefined} referenceLabel={tLast?.type === 'Max' ? 'max' : 'target'} />
              })}
            </div>
            {prev && (
              <Card className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <caption className="px-4 pt-3 pb-2 text-left text-[13px] font-semibold">Latest compared with previous</caption>
                  <thead>
                    <tr className="border-y border-line text-left text-[12px] text-ink-2">
                      <th className="px-4 py-2 font-medium">Nutrient</th><th className="px-3 py-2 text-right font-medium">{formatDate(prev.a.date)}</th><th className="px-3 py-2 text-right font-medium">{formatDate(latest.a.date)}</th><th className="px-3 py-2 text-right font-medium">Change</th><th className="px-4 py-2 font-medium">Now</th>
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
        <SectionTitle>Targets for {client.firstName}</SectionTitle>
        <Targets key={client.id} client={client} />
      </section>
    </div>
  )
}

function Targets({ client }: { client: Client }) {
  const patchClient = useStore((s) => s.patchClient)
  const panel = useStore((s) => s.settings.panel)
  const [open, setOpen] = useState(Object.keys(client.targets ?? {}).length > 0)
  const age = ageInMonths(client.dob, todayISO())
  const ref = referenceTargets(age, client.sex, client.feeding)
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(client.targets ?? {}).map(([k, v]) => [k, String(v)])))
  const commit = (next: Record<string, string>) => {
    const targets: Record<string, number> = {}
    for (const [k, v] of Object.entries(next)) {
      const x = parseFloat(v.replace(',', '.'))
      if (isFinite(x) && x > 0) targets[k] = x
    }
    patchClient(client.id, { targets })
  }
  const shown = NUTRIENTS.filter((n) => panel.includes(n.id))
  const nCustom = Object.keys(client.targets ?? {}).length
  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
        <span className="text-ink-2">UK reference values for {formatAge(age)}, {client.sex === 'M' ? 'boy' : 'girl'}{nCustom ? ` · ${nCustom} custom target${nCustom === 1 ? '' : 's'}` : ' · no custom targets'}.</span>
        <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => setOpen(true)}>View or set custom targets</button>
      </Card>
    )
  }
  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-2">Type a custom target to replace a reference value for this child only, for example a higher energy target for catch-up growth. It applies to all of this child’s food histories.</p>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead><tr className="border-b border-line text-left text-[12px] text-ink-2"><th className="px-4 py-2 font-medium">Nutrient</th><th className="px-3 py-2 font-medium">Reference value</th><th className="px-3 py-2 font-medium">LRNI</th><th className="px-3 py-2 font-medium">Source</th><th className="px-4 py-2 font-medium">Custom target</th></tr></thead>
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
                    <input inputMode="decimal" aria-label={`Custom target for ${n.label}`} value={vals[n.id] ?? ''} placeholder="–" onChange={(e) => setVals({ ...vals, [n.id]: e.target.value })} onBlur={() => commit(vals)} className={cx('tnum h-8 w-24 rounded-lg border bg-surface px-2 text-right text-sm focus:border-accent focus:outline-none', vals[n.id] ? 'border-accent' : 'border-line')} />
                  </td>
                </tr>
              )
            }))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-[12px] text-muted">Showing {fmt(shown.length, 0)} nutrients from your panel.</p>
    </div>
  )
}
