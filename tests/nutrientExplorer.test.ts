import { setCustomFoods } from '../src/domain/foods'
import { computeRecipe } from '../src/domain/recipe'
import { describe, expect, it } from 'vitest'
import { explorerEntry, explorerCsv, exploreNutrients, newWorkspace, sourceOf, type ExplorerDraft } from '../src/domain/nutrientExplorer'
import type { Food } from '../src/domain/types'

const food = (values: Food['values'], extra: Partial<Food> = {}): Food => ({ id: 'u:test', name: 'Synthetic food', per: 100, unit: 'g', group: '', kind: 'food', values, ...extra })
const draft = (foods: Food[]): ExplorerDraft => ({ title: 'Synthetic recipe', portions: 4, meals: [{ id: 'a', name: 'Breakfast', items: foods.map(explorerEntry) }] })

describe('independent nutrient research', () => {
  it('scales ingredients, portions and finished weight without altering whole-recipe nutrients', () => {
    const d = draft([food({ energy: 200, iron: 4 }), food({ energy: 100, iron: 2 })])
    d.meals[0].items[0].amount = 50
    d.cookedWeight = 120
    expect(exploreNutrients(d).nutrients.energy.value).toBe(200)
    expect(exploreNutrients(d, 'portion').nutrients.energy.value).toBe(50)
    expect(exploreNutrients(d, '100g').nutrients.iron.value).toBeCloseTo(4 / 1.2)
    d.cookedWeight = 240
    expect(exploreNutrients(d).nutrients.energy.value).toBe(200)
    expect(exploreNutrients(d, '100g').nutrients.iron.value).toBeCloseTo(4 / 2.4)
  })
  it('distinguishes unknown nutrients from zero and known subtotals', () => {
    const d = draft([food({ iron: 0, calcium: 20 }), food({ iron: 0 })])
    const n = exploreNutrients(d).nutrients
    expect(n.iron).toMatchObject({ value: 0, status: 'complete' })
    expect(n.calcium).toMatchObject({ value: 20, status: 'partial' })
    expect(n.vitd).toMatchObject({ value: null, status: 'unavailable' })
    expect(exploreNutrients(draft([])).nutrients.energy.status).toBe('empty')
  })
  it('retains inherited recipe uncertainty, derived salt, NSP and traces', () => {
    const d = draft([food({ sodium: 100, fibre_nsp: 2, iodine: 'T' }, { kind: 'recipe', partial: ['sodium'] })])
    const n = exploreNutrients(d).nutrients
    expect(n.salt).toMatchObject({ value: 0.25, status: 'partial' })
    expect(n.fibre).toMatchObject({ value: 2, lowEst: true })
    expect(n.iodine).toMatchObject({ value: 0, trace: true })
  })
  it('does not assume ml or doses weigh a gram', () => {
    const d = draft([food({ energy: 60 }, { unit: 'ml' })])
    expect(exploreNutrients(d, '100g').nutrients.energy.value).toBeNull()
    expect(exploreNutrients(d, '100ml').nutrients.energy.value).toBe(60)
    d.meals[0].items[0].food.density = 1.03
    expect(exploreNutrients(d, '100g').nutrients.energy.value).toBeCloseTo(60 / 1.03)
    d.meals[0].items.push(explorerEntry(food({ energy: 1 }, { unit: 'drop', per: 1 })))
    expect(exploreNutrients(d, '100g').factor).toBeNull()
    expect(exploreNutrients(d, '100ml').factor).toBeNull()
  })
  it('ignores invalid amounts and refuses invalid portions', () => {
    const d = draft([food({ energy: 5 }), food({ energy: 10 }), food({ energy: 20 })])
    d.meals[0].items[0].amount = -1
    d.meals[0].items[1].amount = Infinity
    d.portions = 0
    expect(exploreNutrients(d).nutrients.energy.value).toBe(20)
    expect(exploreNutrients(d, 'portion').factor).toBeNull()
  })
  it('keeps source snapshots independent of subsequent library changes', () => {
    const original = food({ energy: 100 }, { partial: ['iron'] })
    const d = draft([original])
    original.values.energy = 500
    original.partial?.push('energy')
    expect(exploreNutrients(d).nutrients.energy).toMatchObject({ value: 100, status: 'complete' })
  })
  it('exports reproducible quantities, source values, missing-data status and safe CSV text', () => {
    const d = draft([food({ energy: 100 }, { name: '=1+1', id: 'c:example' }), food({})])
    d.title = 'Title, with "quotes"'
    const csv = explorerCsv(d, 'portion', 'Per portion')
    expect(csv).toContain('"Title, with ""quotes"""')
    expect(csv).toContain('"\'=1+1"')
    expect(csv).toContain('Known subtotal')
    expect(csv).toContain('No value')
    expect(csv).toContain('composition-of-foods-integrated-dataset-cofid')
    expect(csv).toContain('Source value')
    expect(csv).toContain('"Energy","25","kcal"')
    expect(sourceOf(food({}, { edited: true, id: 'c:test' })).label).toBe('Practitioner-edited CoFID')
  })
  it('keeps recipe uncertainty when saving NSP fibre or combining incomplete supplements', () => {
    setCustomFoods([
      { id: 'nsp', name: 'NSP food', kind: 'food', per: 100, unit: 'g', values: { fibre_nsp: 2, energy: 50 }, updatedAt: 1 },
      { id: 'supp', name: 'Supplement', kind: 'supplement', per: 1, unit: 'dose', values: { vitd: 10 }, updatedAt: 1 },
    ])
    const ingredients = [explorerEntry(food({}, { id: 'u:nsp' })), explorerEntry(food({}, { id: 'u:supp', per: 1, unit: 'dose' }))]
    const result = computeRecipe({ ingredients, portions: 3, cookedWeight: 80 })
    expect(result.partial).toContain('fibre')
    expect(result.partial).toContain('energy')
    expect(result.values.energy).toBe(62.5)
    setCustomFoods([])
  })
  it('keeps the three workspace drafts separate', () => {
    const w = newWorkspace()
    w.drafts.foods.meals[0].items.push(explorerEntry(food({ energy: 100 })))
    expect(w.drafts.recipe.meals[0].items).toHaveLength(0)
    expect(w.drafts.day.meals).toHaveLength(6)
    expect(w.drafts.day.meals.every(m => !m.items.length)).toBe(true)
  })
})

import { expandRecipe, withMeasure } from '../src/domain/nutrientExplorer'
import type { RecipeDef } from '../src/domain/types'

describe('recipes and measures in the explorer', () => {
  const oats = food({ energy: 400, iron: 4 }, { id: 'u:oats', name: 'Oats' })
  const milk = food({ energy: 60, iron: 0 }, { id: 'u:milk', name: 'Milk', unit: 'ml', density: 1.03 })
  const porridge: RecipeDef = { portions: 2, ingredients: [
    { id: '1', foodId: 'u:oats', name: 'Oats', amount: 80, qty: 80, measure: 'g', measureAmount: 1, unit: 'g' },
    { id: '2', foodId: 'u:milk', name: 'Milk', amount: 300, qty: 2, measure: 'cup (150 ml)', measureAmount: 150, unit: 'ml' },
  ] }
  const lookup = (recipes: Record<string, RecipeDef> = {}) => ({ food: (id: string) => ({ 'u:oats': oats, 'u:milk': milk, 'u:porridge': food({}, { id: 'u:porridge', name: 'Porridge', kind: 'recipe' }) } as Record<string, Food>)[id], recipe: (id: string) => recipes[id] })

  it('adds a saved recipe as its separate ingredients, whole or as one portion', () => {
    const whole = expandRecipe('Porridge', porridge, lookup())
    expect(whole.entries.map((e) => [e.name, e.amount, e.qty, e.measure, e.fromRecipe])).toEqual([['Oats', 80, 80, 'g', 'Porridge'], ['Milk', 300, 2, 'cup (150 ml)', 'Porridge']])
    const one = expandRecipe('Porridge', porridge, lookup(), 1 / 2)
    expect(one.entries.map((e) => [e.amount, e.qty])).toEqual([[40, 40], [150, 1]])
    const d: ExplorerDraft = { title: '', portions: 1, meals: [{ id: 'm', name: '', items: one.entries }] }
    expect(exploreNutrients(d).nutrients.energy.value).toBeCloseTo(160 + 90)
  })
  it('expands a recipe used inside another recipe, by its share of the finished weight', () => {
    const breakfast: RecipeDef = { portions: 1, ingredients: [{ id: 'p', foodId: 'u:porridge', name: 'Porridge', amount: 100, qty: 100, measure: 'g', measureAmount: 1, unit: 'g' }] }
    const withCooked = { ...porridge, ingredients: [porridge.ingredients[0]], cookedWeight: 200 } // 80 g oats cooked to 200 g
    const out = expandRecipe('Breakfast', breakfast, lookup({ 'u:porridge': withCooked }))
    expect(out.entries).toHaveLength(1)
    expect(out.entries[0]).toMatchObject({ name: 'Oats', amount: 40, fromRecipe: 'Breakfast' })
  })
  it('reports ingredients missing from the library', () => {
    const def: RecipeDef = { portions: 1, ingredients: [{ ...porridge.ingredients[0], foodId: 'u:gone', name: 'Gone' }] }
    expect(expandRecipe('X', def, lookup())).toMatchObject({ entries: [], unknown: ['Gone'] })
  })
  it('keeps the amount when the measure changes to or from grams or ml', () => {
    const e = { qty: 100, amount: 100, measure: 'g', measureAmount: 1, unit: 'g' }
    expect(withMeasure(e, { label: 'portion', amount: 150 })).toMatchObject({ measure: 'portion', qty: 0.6667, amount: 100 })
    expect(withMeasure(e, { label: 'medium banana', amount: 100 })).toMatchObject({ qty: 1, amount: 100 })
    expect(withMeasure({ ...e, qty: 0, amount: 0 }, { label: 'portion', amount: 150 })).toMatchObject({ qty: 0, amount: 0 })
    // a household measure back to grams gives the grams
    expect(withMeasure({ qty: 1, amount: 36, measure: 'medium slice', measureAmount: 36, unit: 'g' }, { label: 'g', amount: 1 })).toMatchObject({ qty: 36, amount: 36 })
    // ml on a food stored in grams, and fl oz, are units too
    expect(withMeasure({ qty: 1, amount: 206, measure: 'cup (200 ml)', measureAmount: 206, unit: 'g' }, { label: 'ml', amount: 1.03 })).toMatchObject({ qty: 200, amount: 206 })
    expect(withMeasure({ qty: 200, amount: 200, measure: 'ml', measureAmount: 1, unit: 'ml' }, { label: 'fl oz (28 ml)', amount: 28.4 })).toMatchObject({ qty: 7.042, amount: 200 })
  })
  it('keeps the count between household measures, as the family reported it', () => {
    const slice = { qty: 1, amount: 36, measure: 'medium slice', measureAmount: 36, unit: 'g' }
    expect(withMeasure(slice, { label: 'thick slice', amount: 44 })).toMatchObject({ measure: 'thick slice', qty: 1, amount: 44 })
    expect(withMeasure({ ...slice, qty: 2, amount: 72 }, { label: 'small slice', amount: 25 })).toMatchObject({ qty: 2, amount: 50 })
    expect(withMeasure({ qty: 1, amount: 150, measure: 'beaker (150 ml)', measureAmount: 150, unit: 'ml' }, { label: 'cup (200 ml)', amount: 200 })).toMatchObject({ qty: 1, amount: 200 })
  })
  it('never rounds the quantity away from the amount', () => {
    const big = { qty: 1234, amount: 1234, measure: 'g', measureAmount: 1, unit: 'g' }
    const back = withMeasure(withMeasure(big, { label: 'portion', amount: 153 }), { label: 'g', amount: 1 })
    expect(back).toMatchObject({ qty: 1234, amount: 1234 })
    for (const amount of [1, 7.5, 36, 100, 153, 999, 1234, 2500]) {
      for (const m of [3, 15, 28.4, 44, 150, 153, 210]) {
        const r = withMeasure({ qty: amount, amount, measure: 'g', measureAmount: 1, unit: 'g' }, { label: 'portion', amount: m })
        expect(Math.abs(r.qty * m - amount) / amount).toBeLessThan(0.0005)
      }
    }
    expect(withMeasure({ qty: 0.2, amount: 0.2, measure: 'g', measureAmount: 1, unit: 'g' }, { label: 'portion', amount: 150 }).qty).toBe(0.001333)
  })
  it('sizes a sub-recipe with liquid ingredients the same way as the library', () => {
    // porridge: 80 g oats + 300 ml milk (density 1.03), no finished weight → 389 g, as computeRecipe counts it
    const breakfast: RecipeDef = { portions: 1, ingredients: [{ id: 'p', foodId: 'u:porridge', name: 'Porridge', amount: 194.5, qty: 194.5, measure: 'g', measureAmount: 1, unit: 'g' }] }
    const out = expandRecipe('Breakfast', breakfast, lookup({ 'u:porridge': porridge }))
    expect(out.entries.map((e) => e.amount)).toEqual([40, 150]) // half the porridge, not 194.5/80 of it
    const d: ExplorerDraft = { title: '', portions: 1, meals: [{ id: 'm', name: '', items: out.entries }] }
    expect(exploreNutrients(d).nutrients.energy.value).toBeCloseTo(160 + 90)
  })
})
