import { ageInMonths } from './age'
import { analyse, type Analysis } from './analysis'
import { computeAssessment, rawValue, type Tot, type Totals } from './calc'
import { statusOf, targetsFor, type Status, type Target } from './drv'
import { allBranded, allCofid, getFood } from './foods'
import { measuresFor } from './measures'
import { NUTRIENT_BY_ID } from './nutrients'
import type { Assessment, Client, Day, Food, Item, Settings } from './types'

/** One nutrient against its reference value, as a share of the target. */
export interface Gap {
  id: string
  label: string
  unit: string
  value: number
  target: Target
  /** value / target × 100 */
  pct: number
  /** some foods eaten have no value for this nutrient, so `value` is a minimum */
  minimum: boolean
  status: Status
}

/**
 * Nutrients with an intake target (RNI, EAR, safe intake or guideline), lowest share first.
 * Maximums such as salt are returned separately by `limitsOf`.
 */
export function gapsOf(avg: Totals, targets: Record<string, Target>, panel: string[]): Gap[] {
  const out: Gap[] = []
  for (const id of panel) {
    const t = targets[id]
    const tot = avg[id]
    const n = NUTRIENT_BY_ID[id]
    if (!t || !tot || !n || t.type === 'Max' || !(t.value > 0)) continue
    out.push({ id, label: n.short ?? n.label, unit: n.unit, value: tot.v, target: t, pct: (tot.v / t.value) * 100, minimum: tot.missing.length > 0 || tot.lowEst, status: statusOf(tot, t) })
  }
  return out.sort((a, b) => a.pct - b.pct)
}

/** Nutrients to keep below a maximum (salt) or a guideline share of energy (free sugars proxy, saturated fat). */
export function limitsOf(avg: Totals, targets: Record<string, Target>): { id: string; label: string; value: number; max: number; unit: string; pct: number }[] {
  const out: { id: string; label: string; value: number; max: number; unit: string; pct: number }[] = []
  for (const [id, t] of Object.entries(targets)) {
    if (t.type !== 'Max' || !avg[id]) continue
    const n = NUTRIENT_BY_ID[id]
    out.push({ id, label: n?.short ?? n?.label ?? id, value: avg[id].v, max: t.value, unit: n?.unit ?? '', pct: (avg[id].v / t.value) * 100 })
  }
  return out
}

/** Days that have at least one eaten food with an amount. */
export function enteredDays(a: Pick<Assessment, 'days'>): Day[] {
  return a.days.filter((d) => !d.excluded && d.meals.some((m) => m.items.some((i) => !i.refused && i.amount > 0)))
}

export interface Snapshot {
  analysis: Analysis
  /** true when unconfirmed draft days were counted because no day is confirmed yet */
  provisional: boolean
  days: number
}

/**
 * The analysis of a food history to show on screens: confirmed days when there are any,
 * otherwise every day with entries, flagged as provisional. Finalised histories use their frozen analysis.
 */
export function snapshotOf(a: Assessment, client: Client, settings: Settings, mode: 'auto' | 'confirmed' | 'all' = 'auto'): Snapshot | null {
  const confirmed = analyse(a, client, settings)
  if (a.state === 'finalised' || mode === 'confirmed') return confirmed.result.nDays ? { analysis: confirmed, provisional: false, days: confirmed.result.nDays } : null
  if (mode === 'auto' && confirmed.result.nDays > 0) return { analysis: confirmed, provisional: false, days: confirmed.result.nDays }
  const days = enteredDays(a)
  if (!days.length) return null
  const all: Assessment = { ...a, days: days.map((d) => ({ ...d, complete: true })) }
  const analysis = analyse(all, client, settings)
  const provisional = days.some((d) => !d.complete)
  return { analysis, provisional, days: days.length }
}

/** The most recent food history (not a planning scenario) that has something to analyse. */
export function latestSnapshot(assessments: Assessment[], client: Client, settings: Settings): { a: Assessment; snap: Snapshot } | null {
  const sorted = assessments.filter((a) => a.clientId === client.id && !a.scenarioOf).sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt)
  for (const a of sorted) {
    const snap = snapshotOf(a, client, settings)
    if (snap) return { a, snap }
  }
  return null
}

// ---------- totals for an ad hoc list of foods ----------

/** Daily totals for a flat list of foods, using the same engine as food histories. */
export function totalsOf(items: Item[]): Totals {
  const day: Day = { id: 'x', label: 'x', complete: true, meals: [{ id: 'm', name: 'm', items }] }
  return computeAssessment({ days: [day] }).avg
}

/** Adds two sets of daily totals (a baseline and extra foods). */
export function addTotals(a: Totals, b: Totals): Totals {
  const out: Totals = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x: Tot = a[id] ?? { v: 0, supp: 0, missing: [], lowEst: false }
    const y: Tot = b[id] ?? { v: 0, supp: 0, missing: [], lowEst: false }
    out[id] = { v: x.v + y.v, supp: x.supp + y.supp, missing: [...new Set([...x.missing, ...y.missing])], lowEst: x.lowEst || y.lowEst }
  }
  return out
}

export function targetsForClient(client: Client, at: string): Record<string, Target> {
  if (!client.dob || !client.sex) return {}
  const age = ageInMonths(client.dob, at)
  return Number.isFinite(age) ? targetsFor(age, client.sex, client.feeding, client.targets) : {}
}

// ---------- foods that boost a nutrient ----------

/** A typical child portion: the first household measure offered, otherwise a sensible default by food type. */
export function typicalPortion(food: Food, ageMonths: number): { label: string; amount: number } {
  const ms = measuresFor(food, { ageMonths })
  const household = ms.find((m) => m.label !== food.unit && m.label !== 'ml' && !m.label.startsWith('½') && !m.estimate && m.amount >= 3 && m.amount <= 400)
  if (household) return { label: household.label, amount: household.amount }
  const g = food.group ?? ''
  const young = ageMonths < 24
  const amount = food.unit === 'ml' ? (young ? 100 : 150)
    : /^B/.test(g) ? (young ? 60 : 100)
      : /^(M|J|C)/.test(g) ? (young ? 30 : 50)
        : /^(F|D)/.test(g) ? (young ? 30 : 50)
          : /^G/.test(g) ? 10
            : young ? 20 : 30
  return { label: `${amount} ${food.unit}`, amount }
}

export interface Booster {
  food: Food
  portion: { label: string; amount: number }
  /** nutrient amount in one portion */
  value: number
  /** share of the daily target one portion provides */
  pctOfTarget: number
  accepted: boolean
}

// foods unsuitable to suggest for young children, or not eaten as such
const NOT_SUGGESTED = /\b(liver|kidney|pate|pâté|offal|tripe|heart|brain|alcohol|wine|beer|spirits|yeast extract powder|infant|formula|supplement|powder|concentrate|essence|dried skimmed|instant drinks|raw egg|unpasteuri[sz]ed|whale|shark|swordfish|marlin)\b/i
const RAW_STAPLE = /^(A[ACD]|M|J|CA|DB)/

function suggestable(food: Food): boolean {
  if (food.kind !== 'food' || food.infantFormula) return false
  const g = food.group ?? ''
  // alcohol, herbs and spices, fats and oils, fat spreads, soups and sauces are not foods to suggest on their own
  if (/^(Q|H|O|W|BT)/.test(g)) return false
  if (NOT_SUGGESTED.test(food.name)) return false
  if (/\braw\b/i.test(food.name) && RAW_STAPLE.test(g)) return false
  if (/weighed with|as purchased|canned in brine, drained, weighed/i.test(food.name)) return false
  return true
}

/**
 * Foods that provide the most of a nutrient in one typical portion.
 * Foods the child already accepts are listed first, then other ideas from the library.
 */
export function boostersFor(nutrient: string, opts: { ageMonths: number; target?: Target; acceptedIds?: string[]; limit?: number }): { accepted: Booster[]; ideas: Booster[] } {
  const accepted = new Set(opts.acceptedIds ?? [])
  const target = opts.target?.value
  const score = (food: Food): Booster | null => {
    const v = rawValue(food, nutrient).v
    if (v == null || !(v > 0)) return null
    const portion = typicalPortion(food, opts.ageMonths)
    const value = (v * portion.amount) / food.per
    return { food, portion, value, pctOfTarget: target ? (value / target) * 100 : 0, accepted: accepted.has(food.id) }
  }
  const acc: Booster[] = []
  for (const id of accepted) {
    const f = getFood(id)
    const b = f && score(f)
    if (b) acc.push(b)
  }
  const ideas: Booster[] = []
  const seenNames = new Set<string>()
  for (const f of [...allCofid(), ...allBranded()]) {
    if (accepted.has(f.id) || !suggestable(f)) continue
    const b = score(f)
    if (!b) continue
    // one entry per food family, e.g. a single "Salmon" rather than every cooking method
    const key = f.name.split(',')[0].toLowerCase()
    if (seenNames.has(key)) {
      const i = ideas.findIndex((x) => x.food.name.split(',')[0].toLowerCase() === key)
      if (i >= 0 && ideas[i].value < b.value) ideas[i] = b
      continue
    }
    seenNames.add(key)
    ideas.push(b)
  }
  const limit = opts.limit ?? 10
  return {
    accepted: acc.sort((a, b) => b.value - a.value).slice(0, limit),
    ideas: ideas.sort((a, b) => b.value - a.value).slice(0, limit),
  }
}

/** A food list item with an amount in the food's base unit. */
export function quickItem(food: Food, amount: number, label?: string): Item {
  return {
    id: Math.random().toString(36).slice(2, 10),
    foodId: food.id,
    name: food.name,
    unit: food.unit,
    qty: label ? 1 : amount,
    measure: label ?? food.unit,
    measureAmount: label ? amount : 1,
    amount,
    ...(food.labelSource || food.edited || food.id.startsWith('u:') ? { snap: { kind: food.kind, labelSource: food.labelSource, per: food.per, values: { ...food.values } } } : {}),
  }
}
