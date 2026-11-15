import { useMemo, useState } from 'react'
import { uid } from '../domain/age'
import { getFood } from '../domain/foods'
import { measuresFor } from '../domain/measures'
import { NUTRIENTS, fmt } from '../domain/nutrients'
import { computeRecipe } from '../domain/recipe'
import type { CustomFood, Food, Ingredient } from '../domain/types'
import { useStore } from '../store/store'
import { FoodSearch } from './FoodSearch'
import { Banner, Button, Field, IconButton, Input, Modal, Select, Textarea } from './ui'

function IngredientRow({ ing, onChange, onRemove }: { ing: Ingredient; onChange: (i: Ingredient) => void; onRemove: () => void }) {
  const userMeasures = useStore((s) => s.settings.measures)
  const foods = useStore((s) => s.foods)
  const food = getFood(ing.foodId)
  const measures = useMemo(() => {
    if (!food) return []
    const custom = food.id.startsWith('u:') ? foods.find((f) => 'u:' + f.id === food.id)?.measures : undefined
    return measuresFor(food, { userMeasures: userMeasures[food.id], customMeasures: custom }).filter((m) => !m.estimate)
  }, [food, foods, userMeasures])
  const options = measures.some((m) => m.label === ing.measure) ? measures : [{ label: ing.measure, amount: ing.measureAmount }, ...measures]
  const [qty, setQty] = useState(ing.qty ? String(ing.qty) : '')
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
      <span className="min-w-[10rem] flex-1 truncate text-[13.5px]" title={ing.name}>{ing.name}{!food && <span className="ml-1.5 text-[11.5px] text-critical-ink">no longer in the library</span>}</span>
      <input
        value={qty}
        inputMode="decimal"
        aria-label={`Quantity of ${ing.name}`}
        placeholder="qty"
        autoFocus={!ing.qty}
        onChange={(e) => {
          setQty(e.target.value)
          const q = parseFloat(e.target.value.replace(',', '.'))
          const v = isFinite(q) && q >= 0 ? q : 0
          onChange({ ...ing, qty: v, amount: v * ing.measureAmount })
        }}
        className={`tnum h-8 w-16 rounded-lg border bg-surface px-2 text-right text-sm focus:border-accent focus:outline-none ${ing.amount > 0 ? 'border-line-strong' : 'border-warning'}`}
      />
      <span className="text-muted">×</span>
      <Select
        value={ing.measure}
        aria-label="Measure"
        onChange={(e) => {
          const m = options.find((x) => x.label === e.target.value)
          if (m) onChange({ ...ing, measure: m.label, measureAmount: m.amount, amount: ing.qty * m.amount })
        }}
        className="h-8 w-44 py-0 text-[13px]"
      >
        {options.map((m) => <option key={m.label} value={m.label}>{m.label}{m.label !== ing.unit && m.label !== 'ml' && !/\d\s*(ml|g)\)/.test(m.label) ? ` (${fmt(m.amount, m.amount < 10 ? 1 : 0)} ${ing.unit})` : ''}</option>)}
      </Select>
      <span className="tnum w-16 text-right text-[12px] text-muted">{fmt(ing.amount, ing.amount < 10 ? 1 : 0)} {ing.unit}</span>
      <IconButton icon="trash" label={`Remove ${ing.name}`} onClick={onRemove} className="h-7 w-7" />
    </div>
  )
}

const HEADLINE = ['energy', 'protein', 'fat', 'carb', 'fibre', 'iron', 'calcium', 'salt']

/** Build a dish from library foods; nutrients per 100 g and per portion are calculated from the ingredients. */
export function RecipeEditor({ recipe, onClose, onSaved }: { recipe?: CustomFood; onClose: () => void; onSaved?: (f: CustomFood) => void }) {
  const saveFood = useStore((s) => s.saveFood)
  const panel = useStore((s) => s.settings.panel)
  const [name, setName] = useState(recipe?.name ?? '')
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe?.recipe?.ingredients ?? [])
  const [cooked, setCooked] = useState(recipe?.recipe?.cookedWeight ? String(recipe.recipe.cookedWeight) : '')
  const [portions, setPortions] = useState(String(recipe?.recipe?.portions ?? 4))
  const [notes, setNotes] = useState(recipe?.notes ?? '')
  const [showAll, setShowAll] = useState(false)

  const cookedWeight = parseFloat(cooked.replace(',', '.')) || undefined
  const nPortions = Math.max(1, parseFloat(portions.replace(',', '.')) || 1)
  const result = useMemo(() => computeRecipe({ ingredients, cookedWeight, portions: nPortions }), [ingredients, cookedWeight, nPortions])

  const add = (food: Food) => {
    const m = measuresFor(food, {}).filter((x) => !x.estimate)[0]
    setIngredients([...ingredients, { id: uid(), foodId: food.id, name: food.name, unit: food.unit, qty: 0, measure: m.label, measureAmount: m.amount, amount: 0 }])
  }
  // salt is derived from sodium for display
  const val = (id: string, per: number) => {
    const v = id === 'salt' ? (result.values.sodium != null ? (result.values.sodium * 2.5) / 1000 : undefined) : result.values[id]
    return v == null ? null : (v * per) / 100
  }
  const isPartial = (id: string) => result.partial.includes(id === 'salt' ? 'sodium' : id)
  const shown = NUTRIENTS.filter((n) => (showAll ? panel.includes(n.id) : HEADLINE.includes(n.id)))
  const valid = name.trim() && ingredients.some((i) => i.amount > 0) && result.finalWeight > 0

  const save = () => {
    const doc = saveFood({
      id: recipe?.id,
      name: name.trim(),
      kind: 'recipe',
      per: 100,
      unit: 'g',
      values: result.values,
      partial: result.partial.filter((id) => result.values[id] != null),
      measures: [{ label: 'portion', amount: Math.round(result.portionWeight) }],
      recipe: { ingredients: ingredients.filter((i) => i.amount > 0), cookedWeight, portions: nPortions },
      notes: notes.trim() || undefined,
    })
    onSaved?.(doc)
    onClose()
  }

  return (
    <Modal wide title={recipe ? 'Edit recipe' : 'New recipe'} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>Save recipe</Button></>}>
      <Field label="Recipe name"><Input autoFocus={!recipe} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family spaghetti bolognese" /></Field>

      <h3 className="mt-4 mb-2 text-[13px] font-semibold">Ingredients</h3>
      <div className="rounded-xl border border-line">
        {ingredients.length > 0 && (
          <div className="divide-y divide-line border-b border-line">
            {ingredients.map((ing) => (
              <IngredientRow key={ing.id} ing={ing} onChange={(n) => setIngredients(ingredients.map((x) => (x.id === ing.id ? n : x)))} onRemove={() => setIngredients(ingredients.filter((x) => x.id !== ing.id))} />
            ))}
          </div>
        )}
        <div className="p-3"><FoodSearch placeholder="Add an ingredient…" onPick={add} /></div>
      </div>
      <p className="mt-1.5 text-[12px] text-muted">Use the cooked form where the food is cooked separately first (e.g. boiled pasta); use raw weights for things cooked in the dish and enter the cooked weight below.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Weight of ingredients"><div className="tnum flex h-9 items-center text-sm">{fmt(result.rawWeight, 0)} g</div></Field>
        <Field label="Cooked weight (g, optional)" hint="Leave blank if nothing is lost or absorbed in cooking."><Input inputMode="decimal" className="tnum" value={cooked} onChange={(e) => setCooked(e.target.value)} placeholder={fmt(result.rawWeight, 0)} /></Field>
        <Field label="Number of portions" hint={result.finalWeight > 0 ? `One portion = ${fmt(result.portionWeight, 0)} g` : undefined}><Input inputMode="decimal" className="tnum" value={portions} onChange={(e) => setPortions(e.target.value)} /></Field>
      </div>

      <div className="mt-4 mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Calculated nutrients</h3>
        <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Headline only' : 'Show my full panel'}</Button>
      </div>
      {result.finalWeight > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tnum w-full text-[13px]">
            <thead><tr className="border-b border-line text-left text-[12px] text-ink-2"><th className="px-3 py-1.5 font-medium">Nutrient</th><th className="px-3 py-1.5 text-right font-medium">per 100 g</th><th className="px-3 py-1.5 text-right font-medium">per portion</th><th className="px-3 py-1.5 text-right font-medium">whole recipe</th></tr></thead>
            <tbody className="divide-y divide-line">
              {shown.map((n) => {
                const p = isPartial(n.id) ? '≥ ' : ''
                const cell = (per: number) => { const v = val(n.id, per); return v == null ? <span className="text-warning-ink">no value</span> : `${p}${fmt(v, n.dp)}` }
                return <tr key={n.id}><td className="px-3 py-1.5">{n.short ?? n.label} <span className="text-muted">({n.unit})</span></td><td className="px-3 py-1.5 text-right">{cell(100)}</td><td className="px-3 py-1.5 text-right font-medium">{cell(result.portionWeight)}</td><td className="px-3 py-1.5 text-right">{cell(result.finalWeight)}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[13px] text-ink-2">Add ingredients with amounts to see the nutrients.</p>
      )}
      {result.partial.length > 0 && result.finalWeight > 0 && <div className="mt-2"><Banner>“≥” marks a minimum: at least one ingredient has no value for that nutrient in the food data.</Banner></div>}
      {result.unknown.length > 0 && <div className="mt-2"><Banner tone="warning">Not found in the library, so not counted: {result.unknown.join(', ')}.</Banner></div>}
      <p className="mt-2 text-[12px] text-muted">Nutrients are the sum of the ingredients. No allowance is made for vitamin losses during cooking.</p>
      <Field label="Notes (optional)" className="mt-3"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Method, whose recipe, anything to remember…" /></Field>
    </Modal>
  )
}
