import { BREAST_MILK_ID, getFood, isMilkDrink } from './foods'
import type { Assessment, Day, Food, Freq, Item, RawVal } from './types'

export interface Tot {
  /** total amount (a minimum when `missing` is not empty) */
  v: number
  /** part of `v` that came from supplements */
  supp: number
  /** names of foods eaten that have no value for this nutrient */
  missing: string[]
  /** true when part of the fibre total used NSP because no AOAC value exists (an underestimate) */
  lowEst: boolean
}
export type Totals = Record<string, Tot>

export interface Contribution {
  name: string
  value: number
  kind: Food['kind']
}

export interface AssessmentResult {
  nDays: number
  days: { label: string; totals: Totals; itemCount: number }[]
  avg: Totals
  /** per nutrient, foods ranked by average daily contribution */
  sources: Record<string, Contribution[]>
  /** ml per day */
  formulaMl: number
  milkMl: number
  breastMilkMl: number
  breastMilkEstimated: boolean
  itemCount: number
  usesSupplements: boolean
  energyPct: { protein: number; fat: number; carb: number; satfat: number } | null
}

/** All nutrient ids the engine totals (CoFID columns + derived). */
export const CALC_IDS = [
  'energy', 'protein', 'fat', 'satfat', 'carb', 'sugars', 'fibre', 'iron', 'zinc', 'calcium', 'iodine', 'salt',
  'selenium', 'sodium', 'potassium', 'magnesium', 'phosphorus', 'copper', 'chloride', 'manganese', 'vita', 'vitc',
  'vitd', 'thiamin', 'riboflavin', 'niaceq', 'b6', 'b12', 'folate', 'panto', 'biotin', 'vite', 'vitk', 'n3', 'n6',
  'mufa', 'pufa', 'trans', 'chol', 'starch', 'water',
]

function known(v: RawVal | undefined): number | null {
  if (v === 'T') return 0
  return typeof v === 'number' ? v : null
}

/** Value of one nutrient per `food.per` units, plus whether it is a known underestimate. */
export function rawValue(food: Pick<Food, 'values'>, id: string): { v: number | null; lowEst: boolean } {
  const vals = food.values
  if (id === 'fibre') {
    const direct = known(vals.fibre)
    if (direct != null) return { v: direct, lowEst: false }
    const aoac = known(vals.fibre_aoac)
    if (aoac != null) return { v: aoac, lowEst: false }
    const nsp = known(vals.fibre_nsp)
    // NSP excludes resistant starch and lignin, so it under-reads against AOAC-based targets
    return { v: nsp, lowEst: nsp != null && nsp > 0 }
  }
  if (id === 'salt') {
    const direct = known(vals.salt)
    if (direct != null) return { v: direct, lowEst: false }
    const na = known(vals.sodium)
    return { v: na == null ? null : (na * 2.5) / 1000, lowEst: false }
  }
  if (id === 'sodium') {
    const na = known(vals.sodium)
    if (na != null) return { v: na, lowEst: false }
    const salt = known(vals.salt)
    return { v: salt == null ? null : (salt * 1000) / 2.5, lowEst: false }
  }
  return { v: known(vals[id]), lowEst: false }
}

export function freqFactor(f: Freq | undefined): number {
  if (!f) return 1
  const days = f.per === 'day' ? 1 : f.per === 'week' ? 7 : 30.44
  return f.times / days
}

/** Resolve the food an item refers to, preferring the frozen snapshot for custom foods. */
export function foodOf(item: Item): Food | undefined {
  const live = getFood(item.foodId)
  if (item.snap) {
    return {
      id: item.foodId,
      name: item.name,
      kind: item.snap.kind,
      labelSource: item.snap.labelSource,
      sourceFoodId: item.snap.sourceFoodId,
      infantFormula: item.snap.infantFormula,
      group: live?.group ?? '',
      per: item.snap.per,
      unit: item.unit,
      density: live?.density,
      values: item.snap.values,
      partial: item.snap.partial,
    }
  }
  return live
}

function emptyTotals(): Totals {
  const t: Totals = {}
  for (const id of CALC_IDS) t[id] = { v: 0, supp: 0, missing: [], lowEst: false }
  return t
}

/** Daily amount an item contributes (amount × frequency). */
export function dailyAmount(item: Item): number {
  if (item.refused) return 0
  return (item.amount || 0) * freqFactor(item.freq)
}

function addItem(t: Totals, item: Item, sources?: Record<string, Map<string, Contribution>>, weight = 1): void {
  const food = foodOf(item)
  const amount = dailyAmount(item)
  if (!(amount > 0)) return
  for (const id of CALC_IDS) {
    const tot = t[id]
    if (!food) {
      if (!tot.missing.includes(item.name)) tot.missing.push(item.name)
      continue
    }
    const { v, lowEst } = rawValue(food, id)
    if (v == null) {
      // a supplement simply does not contain what its label does not list
      if (!tot.missing.includes(item.name)) tot.missing.push(item.name)
      continue
    }
    const x = (v * amount) / food.per
    // a recipe total is a minimum when one of its ingredients has no value for this nutrient
    if (food.partial?.includes(id) && !tot.missing.includes(item.name)) tot.missing.push(item.name)
    tot.v += x
    if (food.kind === 'supplement') tot.supp += x
    if (lowEst) tot.lowEst = true
    if (sources && x > 0) {
      const m = sources[id]
      const c = m.get(item.name)
      if (c) c.value += x * weight
      else m.set(item.name, { name: item.name, value: x * weight, kind: food.kind })
    }
  }
}

export function dayItems(day: Day): Item[] {
  return day.meals.flatMap((m) => m.items)
}

export function computeDay(day: Day): Totals {
  const t = emptyTotals()
  for (const item of dayItems(day)) addItem(t, item)
  return t
}

/** Average daily intake across the days that have at least one food recorded. */
export function computeAssessment(a: Pick<Assessment, 'days'>): AssessmentResult {
  const used = a.days.filter((d) => d.complete === true && !d.excluded)
  const n = used.length
  const avg = emptyTotals()
  const src: Record<string, Map<string, Contribution>> = {}
  for (const id of CALC_IDS) src[id] = new Map()
  const days = used.map((d) => {
    const t = emptyTotals()
    for (const item of dayItems(d)) addItem(t, item, src, 1 / n)
    return { label: d.label, totals: t, itemCount: dayItems(d).filter((i) => !i.refused).length }
  })
  for (const id of CALC_IDS) {
    const a2 = avg[id]
    for (const d of days) {
      const t = d.totals[id]
      a2.v += t.v / n
      a2.supp += t.supp / n
      if (t.lowEst) a2.lowEst = true
      for (const m of t.missing) if (!a2.missing.includes(m)) a2.missing.push(m)
    }
  }
  let formula = 0
  let milk = 0
  let bm = 0
  let bmEst = false
  let supp = false
  let count = 0
  for (const d of used) {
    for (const item of dayItems(d)) {
      if (item.refused) continue
      count++
      const food = foodOf(item)
      if (!food) continue
      const amt = dailyAmount(item) / n
      if (food.kind === 'supplement') supp = true
      if (food.infantFormula) formula += food.unit === 'ml' ? amt : amt / (food.density ?? 1.03)
      if (item.foodId === BREAST_MILK_ID) {
        bm += amt / 1.03
        if (item.estimate) bmEst = true
      } else if (isMilkDrink(food)) {
        milk += food.unit === 'ml' ? amt : amt / (food.density ?? 1.03)
      }
    }
  }
  const sources: Record<string, Contribution[]> = {}
  for (const id of CALC_IDS) sources[id] = [...src[id].values()].sort((x, y) => y.value - x.value)

  const carbEnergy = used.reduce((sum,d) => sum + dayItems(d).reduce((subtotal,item) => {
    const food = foodOf(item); const value = food ? rawValue(food, 'carb').v : null
    return subtotal + (food && value != null ? value * dailyAmount(item) / food.per * ((food.sourceFoodId ?? item.foodId).startsWith('c:') ? 3.75 : 4) : 0)
  },0),0) / (n || 1)
  const kcal = avg.energy.v
  const energyPct =
    kcal > 0
      ? {
          protein: (avg.protein.v * 4 * 100) / kcal,
          fat: (avg.fat.v * 9 * 100) / kcal,
          // CoFID carbohydrate is in monosaccharide equivalents: 3.75 kcal/g
          carb: (carbEnergy * 100) / kcal,
          satfat: (avg.satfat.v * 9 * 100) / kcal,
        }
      : null

  return {
    nDays: n,
    days,
    avg,
    sources,
    formulaMl: formula,
    milkMl: milk,
    breastMilkMl: bm,
    breastMilkEstimated: bmEst,
    itemCount: count,
    usesSupplements: supp,
    energyPct,
  }
}
