import { Link, useNavigate } from 'react-router-dom'
import { measuresFor } from '../domain/measures'
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
    return n ? `${n.short ?? n.label} ${fmt(typeof f.values[id] === 'number' ? f.values[id] : null, n.dp)} ${n.unit}` : ''
  })
  return `${shown.filter(Boolean).join(' · ')}${ids.length > shown.length ? ` · +${ids.length - shown.length} more` : ''}`
}

function CofidBrowser({ onVariant }: { onVariant: (food: Partial<CustomFood>) => void }) {
  const measures = useStore(s => s.settings.measures)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(40)
  const [open, setOpen] = useState<Food | null>(null)
  const panel = useStore((s) => s.settings.panel)
  const results = useMemo(() => searchFoods(q, { limit: limit + 1, browse: true, cofidOnly: true }), [q, limit])
  return (
    <div>
      <Input value={q} onChange={(e) => (setQ(e.target.value), setLimit(40), setOpen(null))} placeholder={`Search ${cofidCount().toLocaleString('en-GB')} foods in ${cofidVersion}…`} />
      {(        <Card className="mt-3 divide-y divide-line">
          {results.length === 0 && <p className="px-4 py-3 text-[13px] text-ink-2">No foods match.</p>}
          {results.slice(0, limit).map((f) => (
            <div key={f.id}>
              <button type="button" onClick={() => setOpen(open?.id === f.id ? null : f)} aria-expanded={open?.id === f.id} className="workspace-row flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left">
                <span className="text-[13.5px]">{f.name}</span>
                <span className="tnum shrink-0 text-[12px] text-muted">{groupName(f)} · {f.id.slice(2)}</span>
              </button>
              {open?.id === f.id && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 bg-surface-2 px-4 py-3 text-[12.5px] sm:grid-cols-3">
                  <div className="col-span-full mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted">Per 100 g edible portion · CoFID code {f.id.slice(2)}</span>
                    <Button size="sm" variant="primary" onClick={() => onVariant({
                      name: `${f.name} (practice variant)`, kind: 'food', unit: f.unit, per: f.per,
                      sourceFoodId: f.id, values: {...f.values}, notes: `Based on CoFID 2021 food ${f.id.slice(2)}`,
                      measures: measuresFor(f, {userMeasures: measures[f.id]}).filter(m => m.label !== f.unit),
                    })}>Copy and edit</Button>
                  </div>
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
      {results.length > limit && <Button className="mt-3" onClick={() => setLimit(limit + 40)}>Show more foods</Button>}
      {!q.trim() && <p className="mt-3 text-[13px] text-ink-2">Look up any food to check its values before a consultation. “No value” means CoFID gives no reliable figure for that nutrient; the analysis flags these instead of treating them as zero.</p>}
    </div>
  )
}

export default function FoodsPage() {
  const navigate = useNavigate()
  const foods = useStore((s) => s.foods)
  const deleteFood = useStore((s) => s.deleteFood)
  const [tab, setTab] = useState<'all' | FoodKind | 'cofid' | 'recipes'>('cofid')
  const [editing, setEditing] = useState<Partial<CustomFood> | null>(null)
  const list = foods.filter(f => tab === 'all' || (tab === 'recipes' ? !!f.recipe : f.kind === tab && !f.recipe))
  const count = (k: FoodKind) => foods.filter((f) => f.kind === k).length
  return (
    <div className="app-page">
      <div className="workspace-hero flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line p-5 sm:p-7">
        <div>
          <h1 className="page-title text-3xl font-semibold">Food library</h1>
          <p className="mt-2 text-sm text-ink-2">Search UK CoFID foods, practice variants and recipes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Link to="/recipes" className="app-button inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2">Build a recipe</Link>
        <Button variant="primary" icon="plus" onClick={() => setEditing({ kind: tab === 'all' || tab === 'cofid' || tab === 'recipes' ? 'food' : tab, unit: tab === 'formula' ? 'ml' : tab === 'supplement' ? 'dose' : 'g' })}>New food</Button>
        </div>
      </div>
      <Tabs className="mt-6 mb-5" value={tab} onChange={setTab} tabs={[{ id: 'cofid', label: 'UK CoFID catalogue' }, {id:'recipes', label:'Recipes', count:foods.filter(f=>f.recipe).length}, { id: 'all', label: 'All mine', count: foods.length }, { id: 'food', label: 'Foods', count: count('food') }, { id: 'formula', label: 'Formula & milks', count: count('formula') }, { id: 'supplement', label: 'Supplements', count: count('supplement') } ]} />
      {tab === 'cofid' ? (
        <CofidBrowser onVariant={setEditing} />
      ) : (
        <>
          {tab === 'formula' && <div className="mb-3"><Banner>CoFID 2021 contains no infant formula or growing-up milks. Add the products your clients use from the manufacturer’s data card (per 100 ml as fed) so micronutrients are counted.</Banner></div>}
          {tab === 'recipes' && <div className="mb-3"><Button variant="primary" onClick={() => navigate('/recipes')}>Build a recipe</Button></div>}
          {list.length === 0 && tab === 'recipes' ? <Card><Empty icon="apple" title="No saved recipes yet">Add ingredients and a finished weight to save a recipe and use its portions in food histories.</Empty></Card> : list.length === 0 ? (
            <Card><Empty icon="apple" title="Nothing here yet" action={<Button icon="plus" onClick={() => setEditing({ kind: tab === 'all' ? 'food' : (tab as FoodKind), unit: tab === 'formula' ? 'ml' : tab === 'supplement' ? 'dose' : 'g' })}>New food</Button>}>You can also add a food on the fly while entering a food history: type its name and choose “Add as a new food”.</Empty></Card>
          ) : (
            <Card className="divide-y divide-line">
              {list.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => f.recipe ? navigate(`/recipes?id=${encodeURIComponent(f.id)}`) : setEditing(f)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[14px] font-medium">{f.name}{f.brand && <span className="ml-1.5 font-normal text-muted">{f.brand}</span>}</div>
                    <div className="tnum truncate text-[12.5px] text-ink-2">{KIND_LABEL[f.kind]} · per {f.per === 1 ? f.unit : `100 ${f.unit}`} · {summary(f)}</div>
                  </button>
                  {f.recipe ? <Link className="text-sm font-medium text-accent-ink underline" to={`/recipes?id=${encodeURIComponent(f.id)}`}>Edit recipe</Link>
                    : <IconButton icon="edit" label={`Edit ${f.name}`} onClick={() => setEditing(f)} />}
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
