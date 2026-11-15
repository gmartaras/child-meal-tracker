import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FoodSearch } from '../components/FoodSearch'
import { Button, Card, Field, Input } from '../components/ui'
import { computeDay } from '../domain/calc'
import { fmtNutrient, NUTRIENTS } from '../domain/nutrients'
import { recipeValues } from '../domain/recipes'
import type { CustomFood, Food, Item } from '../domain/types'
import { useStore } from '../store/store'

function RecipeEditor({ existing }: { existing?: CustomFood }) {
  const recipe = existing?.recipe
  const [name, setName] = useState(existing?.name ?? '')
  const [yieldGrams, setYieldGrams] = useState(String(recipe?.yieldGrams ?? ''))
  const [servings, setServings] = useState(String(recipe?.servings ?? 1))
  const [items, setItems] = useState<Item[]>(recipe?.items ?? [])
  const [message, setMessage] = useState('')
  const [savedId, setSavedId] = useState(existing?.id)
  const [saving, setSaving] = useState(false)
  const saveFood = useStore(s => s.saveFood)
  const total = useMemo(() => computeDay({id:'recipe', label:'Recipe', meals:[{id:'ingredients', name:'Ingredients', items}]}), [items])
  const count = Number(servings)
  const weight = Number(yieldGrams)
  const valid = items.length > 0 && items.every(i => i.amount > 0 && Number.isFinite(i.amount)) && count > 0 && Number.isFinite(count) && weight > 0 && Number.isFinite(weight)

  const addIngredient = (food: Food) => {
    const item: Item = {
      id: crypto.randomUUID(), foodId: food.id, name: food.name, unit: food.unit, amount: 0, qty: 0,
      measure: food.unit, measureAmount: 1, snap: {
        kind: food.kind, sourceFoodId: food.sourceFoodId, infantFormula: food.infantFormula, per: food.per, values: {...food.values},
      },
    }
    setItems(current => [...current, item])
  }

  const save = async () => {
    setSaving(true)
    try {
      const food = await saveFood({
        id: savedId, name: name.trim(), kind: 'food', unit: 'g', per: 100,
        values: recipeValues(items, weight),
        measures: [{label:'one serving', amount:weight/count},{label:'½ serving', amount:weight/count/2},{label:'whole recipe',amount:weight}],
        recipe: {items, yieldGrams:weight, servings:count},
        notes: 'Calculated from ingredient amounts and finished weight. Cooking losses are not modelled.',
      })
      if (food) setSavedId(food.id)
      setMessage(food ? 'Recipe saved. Search for it by name when entering a food history.' : 'Recipe could not be saved. Your ingredients are still here.')
    } finally {
      setSaving(false)
    }
  }

  return <main className="app-page space-y-5">
    <Link to="/foods" className="text-sm text-accent-ink underline">Back to Food library</Link>
    <header className="workspace-hero rounded-2xl border border-line p-5 sm:p-7">
      <h1 className="page-title text-3xl font-semibold">{existing ? 'Edit recipe' : 'Build a recipe'}</h1>
      <p className="mt-2 text-sm text-ink-2">Combine ingredients, calculate nutrients and save portions to the food library.</p>
    </header>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <Field label="Recipe name"><Input value={name} onChange={e=>setName(e.target.value)}/></Field>
        <FoodSearch placeholder="Search for an ingredient…" onPick={addIngredient}/>
        {items.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2">
          <span className="min-w-32 flex-1">{item.name}</span>
          <Input className="w-24" aria-label={`Amount of ${item.name}`} type="number" min="0" step="any" value={item.amount || ''} onChange={e=>{
            const amount = Number(e.target.value)
            setItems(items.map(i => i.id === item.id ? {...i,amount,qty:amount} : i))
          }}/>
          <span>{item.unit}</span>
          <Button size="sm" onClick={()=>setItems(items.filter(i=>i.id!==item.id))}>Remove</Button>
        </div>)}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Finished weight (g)"><Input type="number" min="0" step="any" value={yieldGrams} onChange={e=>setYieldGrams(e.target.value)}/></Field>
          <Field label="Number of servings"><Input type="number" min="0" step="any" value={servings} onChange={e=>setServings(e.target.value)}/></Field>
        </div>
        <p className="text-sm text-ink-2">Use the measured weight of the finished recipe to calculate servings. The total is based on the ingredients entered.</p>
        <Button variant="primary" disabled={!valid || !name.trim() || saving} onClick={save}>{saving ? 'Saving…' : 'Save recipe to Food library'}</Button>
        <p role="status" className="text-sm">{message}</p>
      </Card>
      <Card className="self-start p-5">
        <h2 className="font-semibold tracking-tight">Recipe nutrients</h2>
        <p className="my-2 text-sm text-ink-2">Estimates use ingredient data. Unknown values stay unknown. Cooking losses and discarded liquid are not modelled.</p>
        {items.some(item => item.amount > 0) && <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left"><th className="p-2">Nutrient</th><th>Whole recipe</th><th>Per serving</th></tr></thead>
          <tbody>{NUTRIENTS.map(n=>{
            const t = total[n.id]
            if (!t) return null
            const missing = t.missing.length || t.lowEst
            const show = (v: number) => missing ? 'Incomplete' : `${fmtNutrient(n.id,v)} ${n.unit}`
            return <tr className="border-b border-line" key={n.id}><td className="p-2">{n.label}</td><td>{show(t.v)}</td><td>{count > 0 ? show(t.v/count) : '—'}</td></tr>
          })}</tbody>
        </table>}
      </Card>
    </div>
  </main>
}

export default function RecipePage() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const existing = useStore(s=>s.foods.find(f=>f.id===id && f.recipe))
  if (id && !existing) return <p className="p-6">Recipe not found. <Link to="/foods">Back to Food library</Link></p>
  return <RecipeEditor key={id ?? 'new'} existing={existing}/>
}
