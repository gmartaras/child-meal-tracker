import { rawValue } from './calc'
import { NUTRIENTS } from './nutrients'
import { ingredientWeight } from './recipe'
import type { Food, Ingredient, Measure, RecipeDef } from './types'

export const COFID_SOURCE = 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid'
export type ExplorerMode = 'foods' | 'recipe' | 'day'
export type ExplorerBasis = 'entered' | 'portion' | '100g' | '100ml'
/** `fromRecipe` names the saved recipe an ingredient was expanded from. */
export interface ExplorerEntry extends Ingredient { food: Food; fromRecipe?: string }
export interface ExplorerMeal { id: string; name: string; items: ExplorerEntry[] }
export interface ExplorerDraft { title: string; meals: ExplorerMeal[]; portions: number; cookedWeight?: number }
export interface NutrientWorkspace { mode: ExplorerMode; drafts: Record<ExplorerMode, ExplorerDraft> }

export function newWorkspace(): NutrientWorkspace {
  const single = (title: string): ExplorerDraft => ({ title, portions: 1, meals: [{ id: 'ingredients', name: 'Foods', items: [] }] })
  return { mode: 'foods', drafts: {
    foods: single('Food exploration'), recipe: { ...single('Untitled recipe'), portions: 4 },
    day: { title: 'A day of meals', portions: 1, meals: ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening snack'].map((name, i) => ({ id: `meal-${i}`, name, items: [] })) },
  } }
}

/** A research snapshot never changes client records or rewrites when the library changes. */
export function explorerEntry(food: Food): ExplorerEntry {
  const amount = food.per
  return { id: crypto.randomUUID(), foodId: food.id, name: food.name, amount, qty: amount, unit: food.unit, measure: food.unit, measureAmount: 1, food: structuredClone(food) }
}

/**
 * A quantity for display and editing, precise enough that quantity × measure stays within 0.05% of the
 * amount: three decimals from 1 upwards, four significant figures below 1. Never rounds 1234 to 1230.
 */
export function roundQty(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 0
  return x >= 1 ? Math.round(x * 1000) / 1000 : Number(x.toPrecision(4))
}

/** A unit of weight or volume (g, ml, fl oz, oz, or the food's own unit), as opposed to a household measure. */
export function isUnitMeasure(label: string, unit?: string): boolean {
  return label === unit || /^(g|ml|oz|fl oz)\b/i.test(label.trim())
}

/**
 * Change the measure of an entry.
 * - To or from a unit of weight or volume, the amount eaten is kept: 100 g switched to “portion (153 g)”
 *   becomes 0.654 portions, and 1 medium slice switched to g becomes 36 g.
 * - Between household measures, the count is kept, as the family reported it: 1 medium slice switched to
 *   thick slice is 1 thick slice.
 */
export function withMeasure<T extends Pick<Ingredient, 'qty' | 'amount' | 'measure' | 'measureAmount'> & { unit?: string }>(entry: T, m: Measure): T {
  if (!(m.amount > 0)) return entry
  if (!isUnitMeasure(entry.measure, entry.unit) && !isUnitMeasure(m.label, entry.unit)) {
    const qty = entry.qty > 0 ? entry.qty : 0
    return { ...entry, measure: m.label, measureAmount: m.amount, qty, amount: qty * m.amount }
  }
  const amount = entry.amount > 0 ? entry.amount : 0
  return { ...entry, measure: m.label, measureAmount: m.amount, qty: amount ? roundQty(amount / m.amount) : 0, amount }
}

export interface RecipeLookup {
  food(id: string): Food | undefined
  recipe(id: string): RecipeDef | undefined
}

export interface ExpandedRecipe {
  entries: ExplorerEntry[]
  /** ingredients no longer in the library, which could not be added */
  unknown: string[]
}

/**
 * A saved recipe as its separate ingredients, so each one can be adjusted and seen as a contributor.
 * `scale` 1 gives the whole recipe; 1 / portions gives one portion. Recipes used as ingredients of
 * another recipe are expanded too (up to three levels deep).
 */
export function expandRecipe(recipeName: string, def: RecipeDef, lookup: RecipeLookup, scale = 1, depth = 0): ExpandedRecipe {
  const entries: ExplorerEntry[] = []
  const unknown: string[] = []
  for (const ing of def.ingredients) {
    if (!(ing.amount > 0)) continue
    const f = lookup.food(ing.foodId)
    if (!f) {
      unknown.push(ing.name)
      continue
    }
    const inner = lookup.recipe(f.id)
    if (inner && depth < 3 && ing.unit === 'g') {
      // grams of the sub-recipe as a share of its finished weight, applied to each of its ingredients.
      // The finished weight follows the same rule as the library (computeRecipe): ml count via density.
      const raw = inner.ingredients.reduce((sum, i) => {
        const food = i.amount > 0 ? lookup.food(i.foodId) : undefined
        return sum + (food ? ingredientWeight(food, i.amount) : 0)
      }, 0)
      const finished = inner.cookedWeight && inner.cookedWeight > 0 ? inner.cookedWeight : raw
      if (finished > 0) {
        const sub = expandRecipe(recipeName, inner, lookup, (scale * ing.amount) / finished, depth + 1)
        entries.push(...sub.entries)
        unknown.push(...sub.unknown)
        continue
      }
    }
    const base = explorerEntry(f)
    entries.push({ ...base, name: f.name, qty: roundQty(ing.qty * scale), measure: ing.measure, measureAmount: ing.measureAmount, amount: ing.amount * scale, fromRecipe: recipeName })
  }
  return { entries, unknown }
}

export interface ExplorerValue {
  value: number | null
  status: 'complete' | 'partial' | 'unavailable' | 'empty'
  missing: string[]
  lowEst: boolean
  trace: boolean
}

export function sourceOf(food: Food): { label: string; url?: string; checked?: string; version?: string } {
  if (food.labelSource) return { label: `${food.labelSource.publisher} label`, url: food.labelSource.url, checked: food.labelSource.checkedOn, version: food.labelSource.version }
  if (food.edited) return { label: 'Practitioner-edited CoFID', url: COFID_SOURCE }
  if (food.id.startsWith('c:')) return { label: 'UK CoFID 2021', url: COFID_SOURCE }
  return { label: food.kind === 'recipe' ? 'Saved recipe · calculated ingredients' : 'Practitioner food data' }
}

export function exploreNutrients(draft: ExplorerDraft, basis: ExplorerBasis = 'entered') {
  const entries = draft.meals.flatMap(m => m.items).filter(i => Number.isFinite(i.amount) && i.amount > 0)
  let weight = 0
  let weightKnown = entries.length > 0
  for (const i of entries) {
    if (i.unit === 'g') weight += i.amount
    else if (i.unit === 'ml' && i.food.density && i.food.density > 0) weight += i.amount * i.food.density
    else weightKnown = false
  }
  const finalWeight = draft.cookedWeight && Number.isFinite(draft.cookedWeight) && draft.cookedWeight > 0 ? draft.cookedWeight : weightKnown ? weight : null
  const volume = entries.length && entries.every(i => i.unit === 'ml') ? entries.reduce((sum, i) => sum + i.amount, 0) : null
  const portionsValid = Number.isFinite(draft.portions) && draft.portions >= 1
  const factor = basis === 'portion' ? (portionsValid ? 1 / draft.portions : null) : basis === '100g' ? (finalWeight ? 100 / finalWeight : null) : basis === '100ml' ? (volume ? 100 / volume : null) : 1
  const nutrients: Record<string, ExplorerValue> = {}
  for (const n of NUTRIENTS) {
    let value = 0, known = 0, lowEst = false, trace = false
    const missing: string[] = []
    for (const i of entries) {
      const raw = rawValue(i.food, n.id)
      if (raw.v == null || !(i.food.per > 0)) { missing.push(i.name); continue }
      known++
      value += raw.v * i.amount / i.food.per
      lowEst ||= raw.lowEst
      trace ||= i.food.values[n.id] === 'T' || (n.id === 'salt' && i.food.values.sodium === 'T') || (n.id === 'fibre' && (i.food.values.fibre_aoac === 'T' || i.food.values.fibre_nsp === 'T'))
      if (i.food.partial?.includes(n.id) || (n.id === 'salt' && i.food.partial?.includes('sodium'))) missing.push(i.name)
    }
    const status = !entries.length ? 'empty' : !known || factor == null ? 'unavailable' : missing.length ? 'partial' : 'complete'
    nutrients[n.id] = { value: known && factor != null ? value * factor : null, status, missing, lowEst, trace }
  }
  return { nutrients, entries, finalWeight, volume, factor, rawWeight: weightKnown ? weight : null }
}

export function valueStatus(value: ExplorerValue): string {
  if (value.status === 'empty') return 'No foods entered'
  if (value.status === 'unavailable') return 'No value'
  return [value.status === 'partial' ? 'Known subtotal' : 'Complete', value.lowEst && 'NSP fibre estimate', value.trace && 'Includes trace'].filter(Boolean).join(' · ')
}

export const EXPLORER_METHOD = 'Nutrients are scaled from source values to the entered amounts and summed. Missing data is not zero; partial results are known subtotals. Trace values contribute zero numerically. Fibre uses AOAC where available, otherwise NSP (an underestimate). Salt may be derived from sodium × 2.5. Total sugars are not free sugars. Cooking changes weight only; no nutrient retention factors are applied. Household measures are approximate. Values are composition estimates, not laboratory results for the actual meal.'

/** Quote every cell and neutralise spreadsheet formula prefixes in user-provided text. */
export function explorerCsv(draft: ExplorerDraft, basis: ExplorerBasis, basisLabel: string): string {
  const result = exploreNutrients(draft, basis)
  const rows: (string | number)[][] = [
    ['Mealtrace Nutrient Explorer', draft.title], ['Exported at', new Date().toISOString()], ['Basis', basisLabel],
    ['Portions', draft.portions], ['Finished weight (g)', result.finalWeight ?? 'Unknown'], ['Method', EXPLORER_METHOD], [],
    ['Nutrient', 'Value', 'Unit', 'Data status', 'Foods with missing / partial data'],
    ...NUTRIENTS.map(n => { const v = result.nutrients[n.id]; return [n.label, v.value == null ? '' : Number(v.value.toPrecision(10)), n.unit, valueStatus(v), v.missing.join('; ')] }),
    [], ['Meal', 'Food', 'Food ID', 'Quantity', 'Measure', 'Amount', 'Unit', 'Source', 'Source URL', 'Source checked', 'Source version'],
    ...draft.meals.flatMap(m => m.items.map(i => { const s = sourceOf(i.food); return [m.name, i.name, i.foodId, i.qty, i.measure, i.amount, i.unit, s.label, s.url ?? '', s.checked ?? '', s.version ?? ''] })),
    [], ['Food ID', 'Nutrient', 'Source value', 'Source basis', 'Unit', 'Source status'],
    ...result.entries.flatMap(i => NUTRIENTS.map(n => { const v = rawValue(i.food, n.id); return [i.foodId, n.label, v.v ?? '', `${i.food.per} ${i.unit}`, n.unit, i.food.partial?.includes(n.id === 'salt' ? 'sodium' : n.id) ? 'Partial' : v.v == null ? 'No value' : v.lowEst ? 'NSP fibre estimate' : 'Available'] })),
  ]
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value)
    if (typeof value === 'string' && /^[\s]*[=+@\-]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}
