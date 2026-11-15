import { beforeAll, describe, expect, it } from 'vitest'
import { ageInMonths, formatAge } from '../src/domain/age'
import { computeAssessment, rawValue } from '../src/domain/calc'
import { bandIndex, energyEAR, referenceTargets, statusOf, targetsFor } from '../src/domain/drv'
import { BREAST_MILK_ID, cofidCount, getFood, loadCofid, searchFoods, setCustomFoods } from '../src/domain/foods'
import { buildInsights } from '../src/domain/insights'
import { measuresFor } from '../src/domain/measures'
import type { Day, Item } from '../src/domain/types'

const item = (foodId: string, amount: number, extra: Partial<Item> = {}): Item => ({
  id: Math.random().toString(36), foodId, name: getFood(foodId)?.name ?? foodId, amount, unit: 'g', qty: 1, measure: 'g', measureAmount: amount, ...extra,
})
const day = (label: string, items: Item[]): Day => ({ id: label, label, meals: [{ id: 'm', name: 'Meal', items }] })

beforeAll(async () => {
  await loadCofid()
  setCustomFoods([
    { id: 'vitd', name: 'Vitamin D drops', kind: 'supplement', per: 1, unit: 'dose', values: { vitd: 10 }, updatedAt: 0 },
    { id: 'pouch', name: 'Veg pouch', kind: 'food', per: 100, unit: 'g', values: { energy: 60, protein: 2, salt: 0.1 }, updatedAt: 0 },
  ])
})

describe('CoFID data', () => {
  it('loads every food', () => expect(cofidCount()).toBe(2887))
  it('has the published values for whole milk', () => {
    const milk = getFood('c:12-596')!
    expect(milk.name).toBe('Milk, whole, pasteurised, average')
    expect(milk.values.energy).toBe(63)
    expect(milk.values.calcium).toBe(120)
    expect(milk.values.iodine).toBe(31)
  })
  it('keeps trace and not-measured markers distinct', () => {
    const bm = getFood(BREAST_MILK_ID)!
    expect(bm.values.vitd).toBe('N')
    expect(rawValue(bm, 'vitd').v).toBeNull()
    expect(bm.values.b12).toBe('T')
    expect(rawValue(bm, 'b12').v).toBe(0)
  })
  it('keeps both foods that share source code 13-669', () => {
    expect(getFood('c:13-669')!.name).toMatch(/Aubergine/)
    expect(getFood('c:13-669b')!.name).toBe('Watercress, raw')
  })
})

describe('search', () => {
  it('finds common foods first', () => {
    expect(searchFoods('whole milk')[0].id).toBe('c:12-596')
    expect(searchFoods('breast milk')[0].id).toBe(BREAST_MILK_ID)
    expect(searchFoods('bananas')[0].name).toMatch(/^Bananas/)
    expect(searchFoods('weetabix').length).toBeGreaterThan(0)
    expect(searchFoods('vitamin d')[0].id).toBe('u:vitd')
    expect(searchFoods('water')[0]).toMatchObject({ id: 'c:17-377' })
    expect(getFood('c:17-377')!.values.energy).toBe(0)
    expect(searchFoods('hummus')[0].name).toBe('Houmous')
  })
  it('requires every word to match', () => expect(searchFoods('banana zzzz')).toHaveLength(0))
})

describe('calculation', () => {
  it('scales per-100 g values by the amount eaten', () => {
    const r = computeAssessment({ days: [day('1', [item('c:12-596', 200)])] })
    expect(r.avg.energy.v).toBeCloseTo(126, 6)
    expect(r.avg.calcium.v).toBeCloseTo(240, 6)
    expect(r.avg.protein.v).toBeCloseTo(6.8, 6)
    expect(r.avg.salt.v).toBeCloseTo((42 * 2 * 2.5) / 1000, 6)
    expect(r.milkMl).toBeCloseTo(200 / 1.03, 3)
  })
  it('averages across recorded days and ignores empty ones', () => {
    const r = computeAssessment({ days: [day('1', [item('c:12-596', 100)]), day('2', [item('c:12-596', 300)]), day('3', [])] })
    expect(r.nDays).toBe(2)
    expect(r.avg.energy.v).toBeCloseTo(126, 6)
    expect(r.sources.energy[0].value).toBeCloseTo(126, 6)
  })
  it('applies frequencies', () => {
    const r = computeAssessment({ days: [day('1', [item('c:12-596', 100, { freq: { times: 3.5, per: 'week' } })])] })
    expect(r.avg.energy.v).toBeCloseTo(31.5, 6)
  })
  it('reports missing data instead of counting it as zero', () => {
    const r = computeAssessment({ days: [day('1', [item(BREAST_MILK_ID, 800), item('u:pouch', 100)])] })
    expect(r.avg.vitd.missing).toContain('Breast milk (human milk, mature)')
    expect(r.avg.iron.missing).toEqual(['Veg pouch'])
    expect(r.avg.energy.missing).toEqual([])
    expect(r.avg.salt.v).toBeCloseTo((15 * 8 * 2.5) / 1000 + 0.1, 6)
  })
  it('tracks supplements separately and never flags them as missing data', () => {
    const r = computeAssessment({ days: [day('1', [item('c:12-596', 100), item('u:vitd', 1, { unit: 'dose' })])] })
    expect(r.avg.vitd.supp).toBe(10)
    expect(r.avg.vitd.v).toBeCloseTo(10, 6) // whole milk vitamin D is trace
    expect(r.avg.iron.missing).toEqual([])
    expect(r.usesSupplements).toBe(true)
  })
  it('uses the frozen snapshot of a custom food', () => {
    const r = computeAssessment({ days: [day('1', [item('u:pouch', 100, { snap: { kind: 'food', per: 100, values: { energy: 80 } } })])] })
    expect(r.avg.energy.v).toBe(80)
  })
  it('falls back to NSP for fibre and flags the underestimate', () => {
    const f = { values: { fibre_aoac: null, fibre_nsp: 2.1 } }
    expect(rawValue(f, 'fibre')).toEqual({ v: 2.1, lowEst: true })
    expect(rawValue({ values: { fibre_aoac: 3, fibre_nsp: 2.1 } }, 'fibre')).toEqual({ v: 3, lowEst: false })
  })
  it('gives energy shares that add up for a single food', () => {
    const r = computeAssessment({ days: [day('1', [item('c:12-596', 100)])] })
    const p = r.energyPct!
    expect(p.protein + p.fat + p.carb).toBeGreaterThan(97)
    expect(p.protein + p.fat + p.carb).toBeLessThan(103)
  })
})

describe('age and reference values', () => {
  it('computes age in months', () => {
    expect(Math.floor(ageInMonths('2023-01-15', '2025-01-14'))).toBe(23)
    expect(Math.floor(ageInMonths('2023-01-15', '2025-01-15'))).toBe(24)
    expect(formatAge(7.4)).toBe('7 months')
    expect(formatAge(30)).toBe('2 y 6 m')
  })
  it('picks the right age band', () => {
    expect([0, 3.9, 4, 6.9, 7, 9.9, 10, 11.9, 12, 47.9, 48].map(bandIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5])
  })
  it('returns UK DRVs for a 2-year-old girl', () => {
    const t = referenceTargets(26, 'F', 'na')
    expect(t.energy.value).toBe(932)
    expect(t.iron).toMatchObject({ value: 6.9, lrni: 3.7, type: 'RNI' })
    expect(t.calcium.value).toBe(350)
    expect(t.vitd).toMatchObject({ value: 10, type: 'Safe intake' })
    expect(t.fibre.value).toBe(15)
    expect(t.salt).toMatchObject({ value: 2, type: 'Max' })
  })
  it('uses feeding mode for infant energy', () => {
    expect(energyEAR(5.5, 'M', 'breast')).toBe(598)
    expect(energyEAR(5.5, 'M', 'formula')).toBe(646)
    expect(energyEAR(8, 'F', 'na')).toBe(646)
    expect(referenceTargets(8, 'F', 'breast').fibre).toBeUndefined()
  })
  it('classifies intakes', () => {
    const t = referenceTargets(26, 'F', 'na')
    expect(statusOf(3.0, t.iron)).toBe('low')
    expect(statusOf(5.0, t.iron)).toBe('below')
    expect(statusOf(7.0, t.iron)).toBe('met')
    expect(statusOf(2.5, t.salt)).toBe('above')
    expect(statusOf(900, t.energy)).toBe('met')
    expect(statusOf(700, t.energy)).toBe('below')
  })
  it('applies per-child overrides', () => {
    const t = targetsFor(26, 'F', 'na', { energy: 1100, iron: 3 })
    expect(t.energy).toMatchObject({ value: 1100, overridden: true, type: 'EAR' })
    expect(t.iron.lrni).toBeUndefined()
  })
})

describe('measures and insights', () => {
  it('offers household measures', () => {
    const labels = (id: string) => measuresFor(getFood(id)!).map((m) => m.label)
    expect(labels('c:12-596')).toContain('beaker / small cup (150 ml)')
    expect(labels(searchFoods('bananas')[0].id)).toContain('medium banana')
    const bm = measuresFor(getFood(BREAST_MILK_ID)!, { ageMonths: 5, bm: { perFeedYounger: 135, perFeedOlder: 100, olderFromMonths: 8, exclusiveDay: 780, mainMilkDay: 600, density: 1.03 } })
    expect(bm[0]).toMatchObject({ label: 'breastfeed (est. 135 ml)', estimate: true })
    expect(bm[0].amount).toBeCloseTo(139.05, 2)
  })
  it('flags low iron with high milk intake in a toddler', () => {
    const r = computeAssessment({ days: [day('1', [item('c:12-596', 900)])] })
    const targets = referenceTargets(20, 'M', 'na')
    const ins = buildInsights(r, { ageMonths: 20, panel: ['energy', 'iron', 'vitd', 'calcium'], targets })
    expect(ins.some((i) => /below the LRNI/.test(i.title) && i.nutrient === 'iron')).toBe(true)
    expect(ins.some((i) => /High milk intake/.test(i.title))).toBe(true)
    expect(ins.some((i) => /No vitamin D supplement/.test(i.title))).toBe(true)
    expect(ins[0].severity).toBe('critical')
  })
})

import { splitDiaryByDay, parseSensory } from '../src/domain/parse'
import { computeRecipe } from '../src/domain/recipe'
import { overrideDocId, originalFood } from '../src/domain/foods'

describe('pasted records', () => {
  it('splits a diary on its day headings', () => {
    const d = splitDiaryByDay('**Day 1 (Sat 14 Nov):**\n\nBreakfast: toast\n\nLunch: pasta\n\n**Day 2:**\n\nBreakfast: cereal\n\nDay 3: Sunday\n- 8am milk')
    expect(d.map((x) => x.label)).toEqual(['Day 1 · Sat 14 Nov', 'Day 2', 'Day 3 · Sunday'])
    expect(d[0].text).toBe('Breakfast: toast\n\nLunch: pasta')
    expect(d[2].text).toBe('- 8am milk')
    expect(splitDiaryByDay('toast and jam')).toEqual([{ label: '', text: 'toast and jam' }])
  })
  it('reads answers from a pasted checklist', () => {
    const rows = parseSensory('SENSORY CHECKLIST\nChild’s Name:\n\n**TOUCH**\nDislikes loud unexpected touch–No\nAvoids being held or cuddled–YES, only by one parent\nMay frequently remove clothing–Sometimes\n\n**TASTE AND ORAL**\nPrefers dry, crunchy foods  –YES\nSleeps well. Give details\nWakes often at night')
    expect(rows.map((r) => [r.section, r.answer])).toEqual([['Touch', 'no'], ['Touch', 'yes'], ['Touch', 'sometimes'], ['Taste and oral', 'yes'], ['Taste and oral', '']])
    expect(rows[1].comment).toBe('only by one parent')
    expect(rows[0].comment).toBe('')
    expect(rows[4].comment).toBe('Wakes often at night')
  })
})

describe('library', () => {
  it('calculates a recipe per 100 g of the cooked dish', () => {
    const ing = (foodId: string, amount: number) => ({ id: foodId, foodId, name: foodId, amount, qty: amount, measure: 'g', measureAmount: 1, unit: 'g' })
    const r = computeRecipe({ ingredients: [ing('c:12-596', 200), ing('c:17-377', 100)], portions: 2 })
    expect(r.rawWeight).toBe(300)
    expect(r.values.energy).toBeCloseTo(42, 6) // 126 kcal in 300 g
    expect(r.portionWeight).toBe(150)
    const cooked = computeRecipe({ ingredients: [ing('c:12-596', 200), ing('c:17-377', 100)], cookedWeight: 200, portions: 2 })
    expect(cooked.values.energy).toBeCloseTo(63, 6)
    expect(cooked.values.calcium).toBeCloseTo(120, 6)
  })
  it('marks recipe nutrients as minimums when an ingredient has no value', () => {
    const ing = (foodId: string, amount: number) => ({ id: foodId, foodId, name: foodId, amount, qty: amount, measure: 'g', measureAmount: 1, unit: 'g' })
    const r = computeRecipe({ ingredients: [ing('c:12-596', 100), ing(BREAST_MILK_ID, 100)], portions: 1 })
    expect(r.partial).toContain('vitd')
    expect(r.partial).not.toContain('energy')
  })
  it('applies and reverts an edit to a CoFID food', () => {
    const before = getFood('c:12-596')!.values.iron
    setCustomFoods([{ id: overrideDocId('c:12-596'), overrideOf: 'c:12-596', name: '', kind: 'food', per: 100, unit: 'g', values: { iron: 9 }, updatedAt: 0 }])
    expect(getFood('c:12-596')).toMatchObject({ edited: true, name: 'Milk, whole, pasteurised, average' })
    expect(getFood('c:12-596')!.values.iron).toBe(9)
    expect(getFood('c:12-596')!.values.calcium).toBe(120)
    expect(originalFood('c:12-596')!.values.iron).toBe(before)
    setCustomFoods([])
    expect(getFood('c:12-596')!.edited).toBeUndefined()
    expect(getFood('c:12-596')!.values.iron).toBe(before)
  })
  it('leaves refused foods out of the totals', () => {
    const r = computeAssessment({ days: [day('1', [item('c:12-596', 100), item('c:12-596', 500, { refused: true })])] })
    expect(r.avg.energy.v).toBeCloseTo(63, 6)
    expect(r.itemCount).toBe(1)
  })
})
