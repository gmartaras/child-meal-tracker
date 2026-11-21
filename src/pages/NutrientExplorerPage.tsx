import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FoodSearch } from '../components/FoodSearch'
import { RecipeEditor } from '../components/RecipeEditor'
import { Button, Card, Field, Icon, IconButton, Input, Select, cx } from '../components/ui'
import { measuresFor } from '../domain/measures'
import { GROUP_ORDER, NUTRIENTS, NUTRIENT_BY_ID, fmt } from '../domain/nutrients'
import { COFID_SOURCE, EXPLORER_METHOD, expandRecipe, roundQty, exploreNutrients, explorerCsv, explorerEntry, newWorkspace, withMeasure, type RecipeLookup, sourceOf, valueStatus, type ExplorerBasis, type ExplorerDraft, type ExplorerEntry, type ExplorerMode, type ExplorerValue } from '../domain/nutrientExplorer'
import { getFood } from '../domain/foods'
import { amountLabel } from '../domain/calc'
import { normaliseRecipe } from '../domain/recipe'
import type { Food } from '../domain/types'
import { useStore } from '../store/store'

const MODES: { id: ExplorerMode; label: string; hint: string; icon: string }[] = [
  { id: 'foods', label: 'Foods', hint: 'One food or a combination', icon: 'apple' },
  { id: 'recipe', label: 'Recipe', hint: 'Ingredients, yield & portions', icon: 'file' },
  { id: 'day', label: 'Full day', hint: 'From breakfast to dinner', icon: 'chart' },
]
const COLOURS = ['var(--series-1)', 'var(--series-3)', 'var(--series-2)', 'var(--accent)', 'var(--warning)', 'var(--muted)']
const singleDraft = (items: ExplorerEntry[]): ExplorerDraft => ({ title: '', portions: 1, meals: [{ id: 'one', name: '', items }] })
function amountText(v: ExplorerValue, id: string) {
  if (v.value == null) return '—'
  const prefix = v.status === 'partial' || v.lowEst ? '≥ ' : ''
  const dp = NUTRIENT_BY_ID[id]?.dp ?? 1
  // Avoid turning a small, measured positive value into an apparent zero.
  return prefix + fmt(v.value, v.value > 0 && v.value < 10 ** -dp / 2 ? Math.min(8, Math.ceil(-Math.log10(v.value)) + 1) : dp)
}

function EntryRow({ entry, change, remove, title, portions }: { entry: ExplorerEntry; change: (i: ExplorerEntry) => void; remove: () => void; title: string; portions?: number }) {
  const measures = useStore(s => s.settings.measures)
  const customFoods = useStore(s => s.foods)
  const options = measuresFor(entry.food, { userMeasures: measures[entry.foodId], customMeasures: customFoods.find(f => 'u:' + f.id === entry.foodId)?.measures }).filter(m => !m.estimate)
  if (!options.some(m => m.label === entry.measure)) options.unshift({ label: entry.measure, amount: entry.measureAmount })
  const source = sourceOf(entry.food)
  return <li className="space-y-2 border-b border-line px-4 py-3 last:border-0" data-testid="explorer-entry">
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1"><p className="text-[13px] font-medium leading-snug">{entry.name}</p><p className="mt-0.5 text-[11px] text-muted">{entry.fromRecipe && entry.fromRecipe !== title && <span className="mr-1 rounded bg-accent-wash px-1 py-px text-accent-ink">from {entry.fromRecipe}</span>}{source.label}{entry.food.brand ? ` · ${entry.food.brand}` : ''}</p></div>
      <IconButton icon="trash" label={`Remove ${entry.name}`} onClick={remove} className="-mr-1 -mt-1 h-7 w-7" />
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <Input key={entry.measure} type="number" min="0" step="any" value={entry.qty || ''} placeholder="0" aria-label={`Quantity of ${entry.name}`} className="tnum h-8 w-20 px-2" onChange={e => {
        const qty = e.target.valueAsNumber
        change({ ...entry, qty: Number.isFinite(qty) && qty >= 0 ? qty : 0, amount: Number.isFinite(qty) && qty >= 0 ? qty * entry.measureAmount : 0 })
      }} />
      <Select aria-label={`Measure for ${entry.name}`} className="h-8 min-w-0 flex-1 basis-28 px-2 text-xs" value={entry.measure} onChange={e => {
        const m = options.find(m => m.label === e.target.value)
        if (m) change(withMeasure(entry, m))
      }}>{options.map(m => <option key={m.label} value={m.label}>{m.label}{m.label !== entry.unit ? ` (${fmt(m.amount, 1)} ${entry.unit})` : ''}</option>)}</Select>
      <button type="button" aria-label={`Halve ${entry.name}`} onClick={() => change({ ...entry, qty: entry.qty / 2, amount: entry.amount / 2 })} className="h-8 rounded-md border border-line px-2 text-xs hover:bg-surface-2">½</button>
      <button type="button" aria-label={`Double ${entry.name}`} onClick={() => change({ ...entry, qty: entry.qty * 2, amount: entry.amount * 2 })} className="h-8 rounded-md border border-line px-2 text-xs hover:bg-surface-2">2×</button>
    </div>
    <p className={cx('text-[11px]', entry.amount > 0 ? 'text-muted' : 'text-warning-ink')}>{entry.amount > 0 ? <>{fmt(entry.amount, 1)} {entry.unit} included{portions && portions > 1 ? <> · <span className="tnum font-medium text-ink-2">{amountLabel(entry.amount / portions, entry.unit)} per portion</span></> : ''}</> : 'Enter an amount to include this food in the analysis.'}</p>
  </li>
}

export default function NutrientExplorerPage() {
  const workspace = useStore(s => s.nutrientWorkspace)
  const setWorkspace = useStore(s => s.setNutrientWorkspace)
  const mode = workspace.mode
  const draft = workspace.drafts[mode]
  const [mealId, setMealId] = useState('meal-0')
  const [basis, setBasis] = useState<ExplorerBasis>('entered')
  const [focus, setFocus] = useState('energy')
  const [group, setGroup] = useState('All nutrients')
  const [nutrientSearch, setNutrientSearch] = useState('')
  const [showRecipe, setShowRecipe] = useState(false)
  const [savedRecipe, setSavedRecipe] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<'food' | 'meal'>('food')
  const [notice, setNotice] = useState('')
  const [params, setParams] = useSearchParams()
  const customFoods = useStore(s => s.foods)
  const lookup = useMemo<RecipeLookup>(() => {
    const recipes = new Map(customFoods.map(f => ['u:' + f.id, normaliseRecipe(f.recipe)]))
    return { food: getFood, recipe: id => recipes.get(id) }
  }, [customFoods])
  const activeMeal = mode === 'day' ? draft.meals.find(m => m.id === mealId) ?? draft.meals[0] : draft.meals[0]
  const totals = useMemo(() => exploreNutrients(draft, basis), [draft, basis])
  const whole = useMemo(() => exploreNutrients(draft), [draft])
  const anyItems = Object.values(workspace.drafts).some(d => d.meals.some(m => m.items.length))
  useEffect(() => {
    if (!anyItems) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyItems])
  // A removal or yield edit can make a previously valid normalisation impossible.
  useEffect(() => { if (totals.factor == null) setBasis('entered') }, [totals.factor])
  const update = (patch: Partial<ExplorerDraft>) => setWorkspace({ ...workspace, drafts: { ...workspace.drafts, [mode]: { ...draft, ...patch } } })
  const updateItems = (items: ExplorerEntry[]) => update({ meals: draft.meals.map(m => m.id === activeMeal.id ? { ...m, items } : m) })
  /** A saved recipe is added as its ingredients: the whole recipe when starting a new one, otherwise one portion. */
  const add = (food: Food) => {
    const def = lookup.recipe(food.id)
    if (!def) return updateItems([...activeMeal.items, explorerEntry(food)])
    const portions = Math.max(1, def.portions || 1)
    if (mode === 'recipe' && !entered.length) return loadRecipe(food)
    const { entries, unknown } = expandRecipe(food.name, def, lookup, 1 / portions)
    updateItems([...activeMeal.items, ...entries])
    setNotice(`Added one portion of ${food.name} as ${entries.length} ingredient${entries.length === 1 ? '' : 's'}.${unknown.length ? ` Not found in the library: ${unknown.join(', ')}.` : ''}`)
  }
  /** Open a saved recipe in the Recipe tab, broken into its ingredients, shown per portion. */
  function loadRecipe(food: Food) {
    const def = lookup.recipe(food.id)
    if (!def) return
    const current = workspace.drafts.recipe
    if (current.meals.some(m => m.items.length) && current.title !== food.name && !window.confirm(`Replace “${current.title || 'the current recipe'}” in the Recipe tab with “${food.name}”?`)) return
    const { entries, unknown } = expandRecipe(food.name, def, lookup)
    setWorkspace({ ...workspace, mode: 'recipe', drafts: { ...workspace.drafts, recipe: { title: food.name, portions: Math.max(1, def.portions || 1), cookedWeight: def.cookedWeight, meals: [{ id: 'ingredients', name: 'Foods', items: entries }] } } })
    setBasis('portion')
    setBreakdown('food')
    setNotice(`Opened your saved recipe “${food.name}”. Changes here are for exploring and do not alter the saved recipe.${unknown.length ? ` Not found in the library: ${unknown.join(', ')}.` : ''}`)
  }
  // links from the food library: ?recipe=<id> opens a recipe, ?food=<id> adds a food
  useEffect(() => {
    const recipeId = params.get('recipe')
    const foodId = params.get('food')
    if (!recipeId && !foodId) return
    const food = getFood(recipeId ?? foodId!)
    setParams({}, { replace: true })
    if (!food) return
    if (recipeId && lookup.recipe(food.id)) return loadRecipe(food)
    const d = workspace.drafts.foods
    setWorkspace({ ...workspace, mode: 'foods', drafts: { ...workspace.drafts, foods: { ...d, meals: [{ ...d.meals[0], items: [...d.meals[0].items, explorerEntry(food)] }] } } })
    setBasis('entered')
    setNotice(`Added ${food.name}. It starts at ${food.per} ${food.unit}; adjust the amount below.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  const chooseMode = (next: ExplorerMode) => { setWorkspace({ ...workspace, mode: next }); setBasis('entered'); setNotice(''); setSavedRecipe(null); setBreakdown(next === 'day' ? 'meal' : 'food') }
  const amountBasis = basis === 'portion' ? 'per portion' : basis === '100g' ? 'per 100 g' : basis === '100ml' ? 'per 100 ml' : mode === 'recipe' ? 'in the whole recipe' : mode === 'day' ? 'in the day' : 'entered'
  const basisLabel = basis === 'portion' ? `Per portion (1 of ${draft.portions})` : basis === '100g' ? 'Per 100 g' : basis === '100ml' ? 'Per 100 ml' : mode === 'recipe' ? 'Whole recipe' : mode === 'day' ? 'Whole day' : 'Entered amounts'
  const selectedNutrient = NUTRIENT_BY_ID[focus]
  const selectedValue = totals.nutrients[focus]
  const knownCount = NUTRIENTS.filter(n => totals.nutrients[n.id].status === 'complete' && !totals.nutrients[n.id].lowEst).length
  const entered = draft.meals.flatMap(m => m.items)
  const rows = useMemo(() => {
    const groups = mode === 'day' && breakdown === 'meal' ? draft.meals.map((m, i) => ({ id: m.id, name: m.name, items: m.items, colour: COLOURS[i % COLOURS.length] })) : entered.map((item, i) => ({ id: item.id, name: item.name, items: [item], colour: COLOURS[i % COLOURS.length] }))
    return groups.map(g => {
      const result = exploreNutrients(singleDraft(g.items)).nutrients[focus]
      const one = g.items.length === 1 ? g.items[0] : undefined
      // how much of the food is in the basis shown (one portion, 100 g, the whole recipe or day)
      const scaled = one && totals.factor != null ? { amount: one.amount * totals.factor, qty: roundQty(one.qty * totals.factor), measure: one.measure, unit: one.unit } : undefined
      return { ...g, from: one?.fromRecipe, scaled, result: { ...result, value: result.value == null || totals.factor == null ? null : result.value * totals.factor } }
    }).filter(g => g.items.length).sort((a, b) => (b.result.value ?? -1) - (a.result.value ?? -1))
  }, [draft, mode, breakdown, focus, totals.factor])
  const max = Math.max(...rows.map(r => r.result.value ?? 0), 0)
  const knownTotal = rows.reduce((sum, r) => sum + (r.result.value ?? 0), 0)
  const nutrientRows = NUTRIENTS.filter(n => (group === 'All nutrients' || group === n.group) && n.label.toLowerCase().includes(nutrientSearch.toLowerCase()))
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([explorerCsv(draft, basis, basisLabel)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `mealtrace-nutrients-${mode}.csv`; a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-1 flex items-center gap-2 text-xs font-medium text-accent-ink"><Icon name="chart" size={14} /> RESEARCH WORKSPACE</div><h1 className="text-2xl font-semibold tracking-tight">Nutrient Explorer</h1><p className="mt-1 text-[13px] text-ink-2">Explore a food. Build a recipe. See the whole day.</p></div>
      <Button icon="download" disabled={!totals.entries.length} onClick={exportCsv}>Export analysis</Button>
    </header>

    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Exploration type">
      {MODES.map(m => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => chooseMode(m.id)} className={cx('flex items-center gap-3 rounded-xl border p-3 text-left transition-colors sm:p-4', mode === m.id ? 'border-accent bg-accent-wash ring-1 ring-accent/15' : 'border-line bg-surface hover:border-line-strong')}><Icon name={m.icon} className="hidden text-accent-ink sm:block" size={21} /><span><span className="block text-sm font-semibold">{m.label}</span><span className="mt-0.5 hidden text-xs text-muted sm:block">{m.hint}</span></span></button>)}
    </div>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]">
      <div className="min-w-0 space-y-3">
        <Card>
          <div className="space-y-3 border-b border-line p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{mode === 'recipe' ? 'Build your recipe' : mode === 'day' ? 'Build your day' : 'Choose your foods'}</h2>{entered.length > 0 && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm('Clear this exploration? Other exploration tabs and saved recipes will stay.')) { update(newWorkspace().drafts[mode]); setBasis('entered') } }}>Clear</Button>}</div>
            <Input aria-label="Exploration title" value={draft.title} onChange={e => update({ title: e.target.value })} />
            {mode === 'day' && <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Meals in chronological order">{draft.meals.map((m, index) => <button type="button" key={m.id} onClick={() => setMealId(m.id)} aria-pressed={m.id === activeMeal.id} className={cx('rounded-lg border px-2 py-2 text-left', m.id === activeMeal.id ? 'border-accent bg-accent-wash' : 'border-line hover:bg-surface-2')}><span className="block text-[10px] text-muted">{String(index + 1).padStart(2, '0')} · {m.items.length} food{m.items.length === 1 ? '' : 's'}</span><span className="text-xs font-medium">{m.name}</span></button>)}</div>}
            <FoodSearch placeholder={mode === 'recipe' ? 'Search ingredients or saved recipes…' : 'Search foods, brands or recipes…'} onPick={add} />
            <p className="text-[11px] text-muted">UK CoFID, branded foods and your library. Foods start at 100 g / ml, or one dose; saved recipes are added as their ingredients. Changing the measure keeps the amount.</p>
            {notice && <p role="status" className="flex items-start gap-2 rounded-lg bg-accent-wash px-3 py-2 text-xs text-ink"><Icon name="info" size={14} className="mt-0.5 text-accent-ink" /><span className="flex-1">{notice}</span><button type="button" aria-label="Dismiss" className="text-muted hover:text-ink" onClick={() => setNotice('')}><Icon name="x" size={13} /></button></p>}
          </div>
          {activeMeal.items.length ? <ul>{activeMeal.items.map(entry => <EntryRow key={entry.id} entry={entry} title={draft.title} portions={mode === 'recipe' && draft.portions >= 1 ? draft.portions : undefined} change={next => updateItems(activeMeal.items.map(i => i.id === entry.id ? next : i))} remove={() => updateItems(activeMeal.items.filter(i => i.id !== entry.id))} />)}</ul> : <div className="px-6 py-9 text-center"><Icon name="apple" size={26} className="mx-auto mb-3 text-accent-ink" /><h3 className="text-sm font-medium">{mode === 'day' ? `What’s for ${activeMeal.name.toLowerCase()}?` : mode === 'recipe' ? 'Start with an ingredient' : 'What would you like to explore?'}</h3><p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">Search above for a food or saved recipe, then adjust its weight or household measure.</p><div className="mt-3 flex justify-center gap-2"><Link to="/foods" className="text-xs text-accent-ink underline underline-offset-4">Browse the food library</Link></div></div>}
          {mode === 'recipe' && <div className="space-y-3 border-t border-line p-4">
            <div className="grid grid-cols-2 gap-3"><Field label="Number of portions"><Input type="number" min="1" step="1" value={draft.portions || ''} onChange={e => update({ portions: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0 })} /></Field><Field label="Finished weight (g)"><Input type="number" min="0.1" step="any" value={draft.cookedWeight ?? ''} placeholder={whole.rawWeight ? String(Math.round(whole.rawWeight)) : 'Optional'} onChange={e => update({ cookedWeight: e.target.valueAsNumber > 0 ? e.target.valueAsNumber : undefined })} /></Field></div>
            {draft.portions < 1 && <p className="text-xs text-warning-ink">Enter at least one portion to analyse or save portions.</p>}
            <p className="text-xs leading-relaxed text-muted">{whole.finalWeight && draft.portions >= 1 ? `One portion ≈ ${fmt(whole.finalWeight / draft.portions, 1)} g. ` : ''}Finished weight accounts for water gained or lost. Cooking losses of nutrients are not modelled.</p>
            <Button icon="plus" disabled={!entered.length || entered.some(i => !(i.amount > 0)) || draft.portions < 1 || !draft.title.trim() || !whole.finalWeight} onClick={() => setShowRecipe(true)} className="w-full">Save as library recipe</Button>
            <p className="text-[11px] text-muted">Review the recipe using current library values before saving.</p>
            {!whole.finalWeight && entered.length > 0 && <p className="text-xs text-warning-ink">Enter a finished weight to save this recipe. Some ingredients have no known weight conversion.</p>}
          </div>}
        </Card>
        <Button className="w-full xl:hidden" disabled={!totals.entries.length} onClick={() => document.getElementById('explorer-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View nutrient analysis ↓</Button>
        {savedRecipe && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-xs text-good-ink">Recipe saved to your library. <Link to={`/foods?food=${encodeURIComponent(savedRecipe)}`} className="underline">View recipe</Link></p>}
        <div className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted"><Icon name="info" size={14} className="mt-0.5" /><p>This workspace stays available as you move around the app. It clears on refresh or sign-out. Export to keep your analysis, or save a recipe to your library. Client records are unchanged.</p></div>
      </div>

      <div id="explorer-analysis" className="min-w-0 space-y-4">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">Nutrient overview</h2><p className="mt-0.5 text-xs text-muted">Updates as you adjust foods and amounts</p></div><Select className="w-auto text-xs" aria-label="Analysis basis" value={basis} onChange={e => setBasis(e.target.value as ExplorerBasis)}><option value="entered">{mode === 'recipe' ? 'Whole recipe' : mode === 'day' ? 'Whole day' : 'Entered amounts'}</option>{mode === 'recipe' && <option value="portion" disabled={draft.portions < 1}>Per portion</option>}{mode !== 'day' && <option value="100g" disabled={!whole.finalWeight}>Per 100 g</option>}{mode === 'foods' && whole.volume && <option value="100ml">Per 100 ml</option>}</Select></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{['energy', 'protein', 'carb', 'fat'].map((id, index) => <button key={id} type="button" aria-pressed={focus === id} onClick={() => setFocus(id)} className={cx('rounded-lg border p-3 text-left transition-colors', focus === id ? 'border-accent bg-accent-wash' : 'border-line hover:bg-surface-2')}><span className="mb-2 block text-xs text-muted">{NUTRIENT_BY_ID[id].label}</span><span className="tnum text-xl font-semibold tracking-tight" data-testid={`explorer-${id}`}>{amountText(totals.nutrients[id], id)}</span><span className="ml-1 text-xs text-muted">{NUTRIENT_BY_ID[id].unit}</span><span className="mt-2 block h-0.5 w-6 rounded-full" style={{ background: COLOURS[index] }} /><span className="mt-1 block text-[10px] text-muted">{valueStatus(totals.nutrients[id])}</span></button>)}</div>
          {totals.entries.length > 0 && <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-[11px] text-muted">Macronutrients in grams · a shared weight scale</p>
            <div className="space-y-2" role="list" aria-label="Macronutrient weights">{['protein', 'carb', 'fat'].map((id, index) => {
              const v = totals.nutrients[id]
              const macroMax = Math.max(...['protein', 'carb', 'fat'].map(key => totals.nutrients[key].value ?? 0))
              return <div role="listitem" key={id}><button type="button" onClick={() => setFocus(id)} aria-label={`Explore ${NUTRIENT_BY_ID[id].label} contribution`} className="grid w-full grid-cols-[84px_minmax(0,1fr)_68px] items-center gap-2 text-left text-[11px]"><span>{NUTRIENT_BY_ID[id].label}</span><span className="h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true"><span className="block h-full rounded-full" style={{ background: COLOURS[index + 1], width: `${macroMax ? (v.value ?? 0) / macroMax * 100 : 0}%` }} /></span><span className="tnum text-right">{amountText(v, id)} g</span></button></div>
            })}</div>
          </div>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted"><span>{basisLabel} · {totals.entries.length} food{totals.entries.length === 1 ? '' : 's'} included</span><span>{totals.entries.length ? `${knownCount} / ${NUTRIENTS.length} nutrients with complete data` : 'Add foods to begin'}</span></div>
          {entered.some(i => !(i.amount > 0)) && <p role="status" className="mt-2 text-xs text-warning-ink">Foods without a positive amount are excluded. Set their quantities to include them.</p>}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Where the nutrients come from</h2><Select className="w-auto max-w-full text-xs" aria-label="Chart nutrient" value={focus} onChange={e => setFocus(e.target.value)}>{NUTRIENTS.map(n => <option key={n.id} value={n.id}>{n.label} ({n.unit})</option>)}</Select></div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><span className="tnum text-3xl font-semibold tracking-tight">{amountText(selectedValue, focus)}</span><span className="ml-1.5 text-sm text-muted">{selectedNutrient.unit} {selectedNutrient.label.toLowerCase()}</span><p className="mt-1 text-xs text-muted">{basisLabel} · {valueStatus(selectedValue)}</p></div>{mode === 'day' && <div className="flex rounded-lg bg-surface-2 p-1" role="group" aria-label="Contribution grouping">{(['meal', 'food'] as const).map(b => <button type="button" key={b} aria-pressed={breakdown === b} onClick={() => setBreakdown(b)} className={cx('rounded-md px-2.5 py-1 text-xs', breakdown === b && 'bg-surface shadow-sm')}>By {b}</button>)}</div>}</div>
          <div className="mt-5 space-y-3" role="list" aria-label={`${selectedNutrient.label} contributions`}>
            {rows.map(row => <div key={row.id} role="listitem"><div className="mb-1 flex items-baseline justify-between gap-3 text-xs"><span className="min-w-0" title={row.name}><span className="block truncate">{row.name}{row.from && row.from !== draft.title && <span className="ml-1.5 text-[10px] text-muted">from {row.from}</span>}</span>{row.scaled && row.scaled.amount > 0 && <span className="tnum block text-[11px] text-muted" data-testid="explorer-contribution-amount"><span className="font-medium text-ink-2">{amountLabel(row.scaled.amount, row.scaled.unit)}</span> {amountBasis}{row.scaled.measure !== row.scaled.unit && !/^(g|ml)\b/.test(row.scaled.measure) ? ` · ${fmt(row.scaled.qty, row.scaled.qty < 10 ? 2 : 0)} × ${row.scaled.measure}` : ''}</span>}{!row.scaled && row.items.length > 1 && <span className="block text-[11px] text-muted">{row.items.length} foods</span>}</span><span className="tnum shrink-0"><span className="font-medium">{amountText(row.result, focus)} {selectedNutrient.unit}</span>{knownTotal > 0 && row.result.value != null && <span className="ml-2 inline-block w-9 text-right text-muted">{Math.round((row.result.value / knownTotal) * 100)}%</span>}</span></div><div className="h-2 overflow-hidden rounded-full bg-track" aria-hidden="true"><div className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${max ? ((row.result.value ?? 0) / max) * 100 : 0}%`, background: row.colour }} /></div>{(row.result.status !== 'complete' || row.result.lowEst) && <p className="mt-0.5 text-[10px] text-muted">{valueStatus(row.result)}</p>}</div>)}
            {!rows.length && <div className="rounded-lg border border-dashed border-line px-6 py-8 text-center text-xs text-muted">Your foods will appear here, ranked by their contribution to the selected nutrient.</div>}
          </div>
          {rows.length > 0 && <p className="mt-4 text-[11px] text-muted">Bars share a scale within this nutrient. {selectedValue.missing.length ? `Missing or partial data for ${[...new Set(selectedValue.missing)].join('; ')}. Known subtotals are not complete totals.` : 'Select any nutrient to explore its contributors.'}</p>}
        </Card>

        <Card>
          <div className="space-y-3 border-b border-line p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Full nutrient profile</h2><span className="text-xs text-muted">{basisLabel}</span></div><div className="flex flex-wrap gap-2"><Input aria-label="Find a nutrient" placeholder="Find a nutrient…" value={nutrientSearch} onChange={e => setNutrientSearch(e.target.value)} className="min-w-32 flex-1 text-xs" /><Select aria-label="Nutrient group" value={group} onChange={e => setGroup(e.target.value)} className="w-auto text-xs">{['All nutrients', ...GROUP_ORDER].map(g => <option key={g}>{g}</option>)}</Select></div></div>
          <div className="max-h-[440px] overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-surface-2 text-left text-muted"><tr><th className="px-4 py-2 font-medium">Nutrient</th><th className="px-4 py-2 text-right font-medium">Amount</th><th className="px-4 py-2 font-medium">Data</th></tr></thead><tbody className="divide-y divide-line">{nutrientRows.map(n => { const v = totals.nutrients[n.id]; return <tr key={n.id} className={focus === n.id ? 'bg-accent-wash' : ''}><td className="px-4 py-2"><button type="button" onClick={() => setFocus(n.id)} className="text-left font-medium text-accent-ink hover:underline" aria-label={`Chart ${n.label}`}>{n.label}</button></td><td className="tnum whitespace-nowrap px-4 py-2 text-right">{amountText(v, n.id)} <span className="text-muted">{n.unit}</span></td><td className="px-4 py-2 text-[11px] text-muted" title={v.missing.join('; ')}>{valueStatus(v)}</td></tr> })}</tbody></table>{!nutrientRows.length && <p className="p-4 text-xs text-muted">No nutrients match. Try a different search or group.</p>}</div>
        </Card>
      </div>
    </div>

    <details className="rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium">Sources & calculation notes <span className="ml-2 text-xs font-normal text-muted">For your research and writing</span></summary>
      <div className="mt-4 grid gap-5 text-xs leading-relaxed lg:grid-cols-2"><div><h3 className="mb-1 font-semibold">How to interpret these figures</h3><p className="text-ink-2">{EXPLORER_METHOD}</p><p className="mt-2 text-ink-2">Nutrients use a snapshot of the food when added. Remove and re-add a food to use subsequent library edits. Results describe the foods entered, without comparing them with a person’s requirements. Exports include the basis, amounts, source IDs, links, available label dates and source nutrient values.</p><a href={COFID_SOURCE} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-accent-ink underline">McCance and Widdowson’s CoFID 2021 · dataset & user guide</a></div><div><h3 className="mb-1 font-semibold">Foods in this exploration</h3>{!entered.length && <p className="text-muted">Source details appear when you add foods.</p>}<ul className="divide-y divide-line">{entered.map(i => { const source = sourceOf(i.food); return <li key={i.id} className="py-2"><div className="font-medium">{i.name} <span className="font-normal text-muted">· {i.foodId}</span></div><div className="text-muted">{source.label}{source.checked ? ` · checked ${source.checked}` : ''}{source.version ? ` · ${source.version}` : ''} · {fmt(i.amount, 1)} {i.unit}</div><div className="mt-1 flex gap-3">{source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">Source</a>}<Link to={`/foods?food=${encodeURIComponent(i.foodId)}`} className="text-accent-ink underline">Library entry</Link></div>{i.food.labelSource?.bounds && <p className="mt-1 text-muted">Label limits: {Object.entries(i.food.labelSource.bounds).map(([id, bound]) => `${NUTRIENT_BY_ID[id]?.label ?? id} ${bound} ${NUTRIENT_BY_ID[id]?.unit ?? ''}`).join('; ')} per {i.food.per} {i.unit}. These are not exact values and are excluded from totals.</p>}</li> })}</ul></div></div>
    </details>
    {showRecipe && <RecipeEditor initial={{ name: draft.title, recipe: { ingredients: entered.map(({ food: _food, ...ingredient }) => ingredient), portions: draft.portions, cookedWeight: draft.cookedWeight ?? whole.finalWeight ?? undefined } }} onClose={() => setShowRecipe(false)} onSaved={f => setSavedRecipe('u:' + f.id)} />}
  </div>
}
