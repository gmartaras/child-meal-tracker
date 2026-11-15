import { CALC_IDS, computeDay } from './calc'
import type { Item } from './types'
export function recipeValues(items: Item[], yieldGrams: number) {
  if (!Number.isFinite(yieldGrams) || yieldGrams <= 0 || !items.length) throw new Error('Enter ingredients and a positive final yield')
  if (items.some(i => !Number.isFinite(i.amount) || i.amount <= 0 || i.freq)) throw new Error('Ingredients need positive amounts without frequency adjustments')
  const totals = computeDay({id: 'recipe', label: 'Recipe', meals: [{id: 'ingredients', name: 'Ingredients', items}]})
  return Object.fromEntries(CALC_IDS.filter(id => !totals[id].missing.length && !totals[id].lowEst).map(id => [id, totals[id].v * 100 / yieldGrams]))
}
