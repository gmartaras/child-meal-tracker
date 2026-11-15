import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AutoTextarea, Button, Card, IconButton, Input, SectionTitle } from '../../components/ui'
import { uid } from '../../domain/age'
import { PLAN_DAYS, PLAN_SLOTS, type Client, type MealPlan as Plan } from '../../domain/types'
import { useStore } from '../../store/store'

export function emptyPlan(): Plan {
  return { intro: '', cells: PLAN_DAYS.map(() => PLAN_SLOTS.map(() => '')), chains: [], updatedAt: 0 }
}

/**
 * Sample meal plan (week × meal slots) and food chaining ideas, as shared with the family.
 * A line starting with "+" is a new food to introduce and is highlighted when printed.
 */
export function MealPlan({ client }: { client: Client }) {
  const saveClient = useStore((s) => s.saveClient)
  const [plan, setPlan] = useState<Plan>(client.plan ?? emptyPlan())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ client, plan })
  latest.current = { client, plan }
  const flush = () => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    saveClient({ ...latest.current.client, plan: { ...latest.current.plan, updatedAt: Date.now() } })
  }
  useEffect(() => () => flush(), []) // eslint-disable-line react-hooks/exhaustive-deps
  const change = (next: Plan) => {
    setPlan(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      saveClient({ ...latest.current.client, plan: { ...next, updatedAt: Date.now() } })
    }, 600)
  }
  const setCell = (d: number, s: number, v: string) => change({ ...plan, cells: plan.cells.map((row, i) => (i === d ? row.map((c, j) => (j === s ? v : c)) : row)) })
  const accepted = (client.acceptedFoods ?? []).map((f) => f.name)
  const empty = !plan.intro && plan.cells.every((r) => r.every((c) => !c)) && !plan.chains.length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] text-ink-2">Write the week as you would in the document you send. Start a line with <span className="rounded bg-accent-wash px-1 font-medium text-accent-ink">+</span> to mark a new food to introduce; it prints highlighted.</p>
        {!empty && <Link to={`/c/${client.id}/print/plan`} onClick={flush}><Button size="sm" icon="printer">Print for parents</Button></Link>}
      </div>
      <Card className="p-3.5">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-2">Introduction for the family</span>
          <AutoTextarea value={plan.intro} onChange={(v) => change({ ...plan, intro: v })} minRows={2} placeholder="This is just a suggestion, with some ideas for introducing new foods…" />
        </label>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="w-12 border-b border-line px-2 py-2 text-left text-[12px] font-medium text-ink-2">Day</th>
              {PLAN_SLOTS.map((s) => <th key={s} className="border-b border-l border-line px-2 py-2 text-left text-[12px] font-medium text-ink-2">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {PLAN_DAYS.map((d, di) => (
              <tr key={d}>
                <th className="border-b border-line px-2 py-1 text-left align-top text-[12.5px] font-semibold last:border-0">{d}</th>
                {PLAN_SLOTS.map((s, si) => (
                  <td key={s} className="border-b border-l border-line p-0 align-top">
                    <AutoTextarea value={plan.cells[di]?.[si] ?? ''} onChange={(v) => setCell(di, si, v)} minRows={2} aria-label={`${d} ${s}`} className="min-h-[3.2rem] rounded-none border-0 bg-transparent px-2 py-1.5 text-[13px] focus:ring-0 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <SectionTitle action={<Button size="sm" icon="plus" onClick={() => change({ ...plan, chains: [...plan.chains, { id: uid(), from: '', to: '' }] })}>Add a chain</Button>}>Food chaining ideas</SectionTitle>
        <datalist id="accepted-foods">{accepted.map((a) => <option key={a} value={a} />)}</datalist>
        {plan.chains.length === 0 ? (
          <Card className="px-4 py-5 text-center text-[13px] text-ink-2">Link an accepted food to the next small step, e.g. “strawberries → raspberries”. Accepted foods are suggested as you type.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {plan.chains.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_auto_1.6fr_auto] items-center gap-2 px-3 py-2">
                <Input list="accepted-foods" value={c.from} placeholder="Accepted food" aria-label="Accepted food" onChange={(e) => change({ ...plan, chains: plan.chains.map((x) => (x.id === c.id ? { ...x, from: e.target.value } : x)) })} className="h-8" />
                <span className="text-muted" aria-hidden="true">→</span>
                <Input value={c.to} placeholder="Next step to offer, and how" aria-label="Next step" onChange={(e) => change({ ...plan, chains: plan.chains.map((x) => (x.id === c.id ? { ...x, to: e.target.value } : x)) })} className="h-8" />
                <IconButton icon="trash" label="Remove this chain" onClick={() => change({ ...plan, chains: plan.chains.filter((x) => x.id !== c.id) })} />
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
