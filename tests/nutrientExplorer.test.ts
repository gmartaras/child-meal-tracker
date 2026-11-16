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
