import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, IconButton, Input, cx } from '../../components/ui'
import { formatDateShort, todayISO, uid } from '../../domain/age'
import { FOOD_GROUPS, type AcceptedFood, type Client } from '../../domain/types'
import { useStore } from '../../store/store'

/** The child's accepted foods, by food group. Each food keeps the date it was added, so the range can be charted over time. */
export function AcceptedFoods({ client }: { client: Client }) {
  const patchClient = useStore((s) => s.patchClient)
  const list = client.acceptedFoods ?? []
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [date, setDate] = useState(todayISO())
  const save = (acceptedFoods: AcceptedFood[]) => patchClient(client.id, { acceptedFoods })

  const add = (group: number) => {
    // several foods can be typed or pasted at once, separated by commas or new lines
    const names = (drafts[group] ?? '').split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean)
    if (!names.length) return
    const have = new Set(list.filter((f) => f.group === group).map((f) => f.name.toLowerCase()))
    save([...list, ...names.filter((n) => !have.has(n.toLowerCase())).map((name) => ({ id: uid(), name, group, addedOn: date }))])
    setDrafts({ ...drafts, [group]: '' })
  }
  const firstDate = list.length ? list.map((f) => f.addedOn).sort()[0] : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-[13px] text-ink-2">
          {list.length ? <><span className="font-semibold text-ink">{list.length} accepted food{list.length === 1 ? '' : 's'}</span>. Foods added after the first list ({firstDate && formatDateShort(firstDate)}) are marked <span className="rounded bg-good-wash px-1 text-good-ink">new</span>, and the total is charted under Progress.</> : 'List the foods the child reliably eats, by food group. Type several at once, separated by commas.'}
        </p>
        <label className="flex items-center gap-1.5 text-[12px] text-ink-2">Adding as of <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px]" /></label>
        {list.length > 0 && <Link to={`/c/${client.id}/print/accepted`}><Button size="sm" icon="printer">Print for parents</Button></Link>}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {FOOD_GROUPS.map((g, gi) => {
          const foods = list.filter((f) => f.group === gi)
          return (
            <Card key={g} className={cx('p-3.5', gi === 4 && 'lg:col-span-2')}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-[13.5px] font-semibold">{g}</h3>
                <span className="tnum text-[12px] text-muted">{foods.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {foods.map((f) => (
                  <span key={f.id} className="group inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/60 py-0.5 pr-1 pl-2.5 text-[13px]" title={`Added ${formatDateShort(f.addedOn)}`}>
                    {f.name}
                    {firstDate && f.addedOn > firstDate && <span className="rounded bg-good-wash px-1 text-[10.5px] text-good-ink">new</span>}
                    <IconButton icon="x" label={`Remove ${f.name}`} className="h-5 w-5" onClick={() => save(list.filter((x) => x.id !== f.id))} />
                  </span>
                ))}
                {foods.length === 0 && <span className="text-[12.5px] text-muted">None listed yet</span>}
              </div>
              <form className="mt-2.5 flex gap-2" onSubmit={(e) => (e.preventDefault(), add(gi))}>
                <Input value={drafts[gi] ?? ''} onChange={(e) => setDrafts({ ...drafts, [gi]: e.target.value })} placeholder="Add foods, separated by commas…" className="h-8" aria-label={`Add to ${g}`} />
                <Button size="sm" type="submit" disabled={!(drafts[gi] ?? '').trim()}>Add</Button>
              </form>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
