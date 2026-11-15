import { useMemo, useState } from 'react'
import { CustomFoodForm } from '../components/CustomFoodForm'
import { Banner, Button, Card, Empty, IconButton, Input, Tabs, confirmDialog } from '../components/ui'
import { cofidCount, cofidVersion, groupName, searchFoods } from '../domain/foods'
import { NUTRIENT_BY_ID, fmt } from '../domain/nutrients'
import type { CustomFood, Food, FoodKind } from '../domain/types'
import { useStore } from '../store/store'
import { rawValue } from '../domain/calc'

const KIND_LABEL: Record<FoodKind, string> = { food: 'Food / drink', formula: 'Formula / milk', supplement: 'Supplement' }

function summary(f: CustomFood): string {
  const ids = Object.keys(f.values)
  if (!ids.length) return 'No nutrient values entered'
  const head = ['energy', 'protein', 'iron', 'calcium', 'vitd', 'vita', 'vitc'].filter((id) => f.values[id] != null)
  const shown = (head.length ? head : ids).slice(0, 4).map((id) => {
    const n = NUTRIENT_BY_ID[id]
    return n ? `${n.short ?? n.label} ${fmt(f.values[id], n.dp)} ${n.unit}` : ''
  })
  return `${shown.filter(Boolean).join(' · ')}${ids.length > shown.length ? ` · +${ids.length - shown.length} more` : ''}`
}

function CofidBrowser() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Food | null>(null)
  const panel = useStore((s) => s.settings.panel)
  const results = useMemo(() => (q.trim() ? searchFoods(q, { limit: 40 }).filter((f) => f.id.startsWith('c:')) : []), [q])
  return (
    <div>
      <Input value={q} onChange={(e) => (setQ(e.target.value), setOpen(null))} placeholder={`Search ${cofidCount().toLocaleString('en-GB')} foods in ${cofidVersion}…`} />
      {q.trim() && (
        <Card className="mt-3 divide-y divide-line">
          {results.length === 0 && <p className="px-4 py-3 text-[13px] text-ink-2">No foods match.</p>}
          {results.map((f) => (
            <div key={f.id}>
              <button type="button" onClick={() => setOpen(open?.id === f.id ? null : f)} aria-expanded={open?.id === f.id} className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left hover:bg-surface-2">
                <span className="text-[13.5px]">{f.name}</span>
                <span className="tnum shrink-0 text-[12px] text-muted">{groupName(f)} · {f.id.slice(2)}</span>
              </button>
              {open?.id === f.id && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 bg-surface-2 px-4 py-3 text-[12.5px] sm:grid-cols-3">
                  <div className="col-span-full mb-1 text-[12px] text-muted">Per 100 g edible portion</div>
                  {panel.map((id) => {
                    const n = NUTRIENT_BY_ID[id]
                    const { v, lowEst } = rawValue(f, id)
                    const raw = f.values[id]
                    return (
                      <div key={id} className="flex justify-between gap-2">
                        <span className="text-ink-2">{n.short ?? n.label}</span>
                        <span className="tnum">{v == null ? <span className="text-warning-ink">no value</span> : <>{raw === 'T' ? 'trace' : fmt(v, Math.max(n.dp, 1))} <span className="text-muted">{raw === 'T' ? '' : n.unit}{lowEst ? ' (NSP)' : ''}</span></>}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      {!q.trim() && <p className="mt-3 text-[13px] text-ink-2">Look up any food to check its values before a consultation. “No value” means CoFID gives no reliable figure for that nutrient; the analysis flags these instead of treating them as zero.</p>}
    </div>
  )
}

export default function FoodsPage() {
  const foods = useStore((s) => s.foods)
  const deleteFood = useStore((s) => s.deleteFood)
  const [tab, setTab] = useState<'all' | FoodKind | 'cofid'>('all')
  const [editing, setEditing] = useState<Partial<CustomFood> | null>(null)
  const list = foods.filter((f) => tab === 'all' || f.kind === tab)
  const count = (k: FoodKind) => foods.filter((f) => f.kind === k).length
  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My foods &amp; supplements</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-2">Branded products, formula milks and supplements you add from labels. They appear in food search alongside CoFID.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEditing({ kind: tab === 'all' || tab === 'cofid' ? 'food' : tab, unit: tab === 'formula' ? 'ml' : tab === 'supplement' ? 'dose' : 'g' })}>New food</Button>
      </div>
      <Tabs className="mt-4 mb-4" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All mine', count: foods.length }, { id: 'food', label: 'Foods', count: count('food') }, { id: 'formula', label: 'Formula & milks', count: count('formula') }, { id: 'supplement', label: 'Supplements', count: count('supplement') }, { id: 'cofid', label: 'Browse CoFID' }]} />
      {tab === 'cofid' ? (
        <CofidBrowser />
      ) : (
        <>
          {tab === 'formula' && <div className="mb-3"><Banner>CoFID 2021 contains no infant formula or growing-up milks. Add the products your clients use from the manufacturer’s data card (per 100 ml as fed) so micronutrients are counted.</Banner></div>}
          {list.length === 0 ? (
            <Card><Empty icon="apple" title="Nothing here yet" action={<Button icon="plus" onClick={() => setEditing({ kind: tab === 'all' ? 'food' : (tab as FoodKind), unit: tab === 'formula' ? 'ml' : tab === 'supplement' ? 'dose' : 'g' })}>New food</Button>}>You can also add a food on the fly while entering a food history: type its name and choose “Add as a new food”.</Empty></Card>
          ) : (
            <Card className="divide-y divide-line">
              {list.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => setEditing(f)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[14px] font-medium">{f.name}{f.brand && <span className="ml-1.5 font-normal text-muted">{f.brand}</span>}</div>
                    <div className="tnum truncate text-[12.5px] text-ink-2">{KIND_LABEL[f.kind]} · per {f.per === 1 ? f.unit : `100 ${f.unit}`} · {summary(f)}</div>
                  </button>
                  <IconButton icon="edit" label={`Edit ${f.name}`} onClick={() => setEditing(f)} />
                  <IconButton icon="trash" label={`Delete ${f.name}`} onClick={() => confirmDialog(`Delete “${f.name}”? Food histories that already use it keep their saved values.`) && deleteFood(f.id)} />
                </div>
              ))}
            </Card>
          )}
        </>
      )}
      {editing && <CustomFoodForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
