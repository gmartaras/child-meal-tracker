import { CALC_IDS, rawValue } from './calc'
import { getFood } from './foods'
import type { Ingredient, RecipeDef } from './types'

export interface RecipeResult {
  /** per 100 g of the finished dish */
  values: Record<string, number>
  /** nutrients where at least one ingredient has no value, so the figure is a minimum */
  partial: string[]
  rawWeight: number
  finalWeight: number
  portionWeight: number
  /** ingredients that could not be found in the library */
  unknown: string[]
}

/** Every stored nutrient id a recipe carries (the calculation ids, with sodium kept and salt derived). */
const RECIPE_IDS = CALC_IDS.filter((id) => id !== 'salt')

/**
 * Nutrients of a dish = sum of its ingredients, expressed per 100 g of the finished dish.
 * No allowance is made for vitamin losses in cooking; water lost or gained is handled only
 * through the cooked weight the practitioner enters.
 */
export function computeRecipe(r: Pick<RecipeDef, 'ingredients' | 'cookedWeight' | 'portions'>): RecipeResult {
  const totals: Record<string, number> = {}
  const partial = new Set<string>()
  const unknown: string[] = []
  let rawWeight = 0
  for (const ing of r.ingredients) {
    if (!(ing.amount > 0)) continue
    const food = getFood(ing.foodId)
    if (!food) {
      unknown.push(ing.name)
      for (const id of RECIPE_IDS) partial.add(id)
      continue
    }
    // weight: grams as entered; ml via density; supplement doses add no weight
    rawWeight += food.unit === 'g' ? ing.amount : food.unit === 'ml' ? ing.amount * (food.density ?? 1) : 0
    for (const id of RECIPE_IDS) {
      const { v } = rawValue(food, id)
      if (v == null) {
        if (food.kind !== 'supplement') partial.add(id)
        continue
      }
      totals[id] = (totals[id] ?? 0) + (v * ing.amount) / food.per
      if (food.partial?.includes(id)) partial.add(id)
    }
  }
  const finalWeight = r.cookedWeight && r.cookedWeight > 0 ? r.cookedWeight : rawWeight
  const values: Record<string, number> = {}
  if (finalWeight > 0) for (const [id, v] of Object.entries(totals)) values[id] = Math.round(((v * 100) / finalWeight) * 10000) / 10000
  return {
    values,
    partial: [...partial].filter((id) => id in values || true),
    rawWeight,
    finalWeight,
    portionWeight: finalWeight / Math.max(1, r.portions || 1),
    unknown,
  }
}

export function ingredientAmount(i: Pick<Ingredient, 'qty' | 'measureAmount'>): number {
  return (i.qty || 0) * (i.measureAmount || 0)
}

/** Read a stored recipe in either the current or the earlier (items / yieldGrams / servings) shape. */
export function normaliseRecipe(r: unknown): RecipeDef | undefined {
  if (!r || typeof r !== 'object') return undefined
  const x = r as Partial<RecipeDef> & { items?: Ingredient[]; yieldGrams?: number; servings?: number }
  if (Array.isArray(x.ingredients)) return { ingredients: x.ingredients, cookedWeight: x.cookedWeight, portions: x.portions || 1 }
  if (Array.isArray(x.items)) {
    return {
      ingredients: x.items.map((i) => ({ id: i.id, foodId: i.foodId, name: i.name, amount: i.amount, qty: i.qty, measure: i.measure, measureAmount: i.measureAmount, unit: i.unit })),
      cookedWeight: x.yieldGrams,
      portions: x.servings || 1,
    }
  }
  return undefined
}
