import { beforeAll, expect, it } from 'vitest'
import { getFood, loadCofid } from '../src/domain/foods'
import { expandRecipe, exploreNutrients } from '../src/domain/nutrientExplorer'
import { computeRecipe } from '../src/domain/recipe'
import type { Food, Ingredient, RecipeDef } from '../src/domain/types'

// Synthetic recipes built from library foods only.
beforeAll(loadCofid)

const ing = (foodId: string, amount: number): Ingredient => {
  const f = getFood(foodId)!
  return { id: foodId, foodId, name: f.name, unit: f.unit, qty: amount, measure: f.unit, measureAmount: 1, amount }
}

it('a nested recipe with a drink stored in ml gives the same energy in the explorer as in the library', () => {
  const drink = 'b:alpro-oat-original-uht'
  expect(getFood(drink)?.unit).toBe('ml')
  const porridge: RecipeDef = { ingredients: [ing('c:11-1145', 40), ing(drink, 200)], portions: 1 }
  const lib = computeRecipe(porridge)
  const porridgeFood: Food = { id: 'u:porridge', name: 'Synthetic porridge', kind: 'recipe', group: '', per: 100, unit: 'g', values: lib.values }
  const outer: RecipeDef = { portions: 1, ingredients: [{ id: 'p', foodId: 'u:porridge', name: 'Synthetic porridge', unit: 'g', qty: 120, measure: 'g', measureAmount: 1, amount: 120 }] }
  const lookup = { food: (id: string) => (id === 'u:porridge' ? porridgeFood : getFood(id)), recipe: (id: string) => (id === 'u:porridge' ? porridge : undefined) }
  const expected = ((lib.values.energy as number) * 120) / 100
  const got = exploreNutrients({ title: '', portions: 1, meals: [{ id: 'm', name: '', items: expandRecipe('Outer', outer, lookup).entries }] }).nutrients.energy.value!
  expect(got / expected).toBeCloseTo(1, 3)
})
