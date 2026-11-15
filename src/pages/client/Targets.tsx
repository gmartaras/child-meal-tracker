import { useState } from 'react'
import { Card, cx } from '../../components/ui'
import { ageInMonths, formatAge, todayISO } from '../../domain/age'
import { referenceTargets } from '../../domain/drv'
import { GROUP_ORDER, NUTRIENTS, fmt } from '../../domain/nutrients'
import type { Client } from '../../domain/types'
import { useStore } from '../../store/store'

export function Targets({ client }: { client: Client }) {
  const patchClient = useStore((s) => s.patchClient)
  const panel = useStore((s) => s.settings.panel)
  const [open, setOpen] = useState(Object.keys(client.targets ?? {}).length > 0)
  const age = ageInMonths(client.dob, todayISO())
  const ref = client.sex && client.dob ? referenceTargets(age, client.sex, client.feeding) : {}
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
  if (!client.dob || !client.sex) return <Card className="p-4 text-[13px] text-ink-2">Add the date of birth and sex in the client record to use reference values.</Card>
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
