import type { CustomFood, Food, RawVal } from './types'

interface CofidFile {
  version: string
  nutrients: string[]
  foods: [string, string, string, number | null, number | null, RawVal[]][]
}

export const BREAST_MILK_ID = 'c:12-536'

/** Friendlier names / extra search words for foods practitioners look up by another name. */
const ALIASES: Record<string, { name?: string; words?: string; boost?: number }> = {
  'c:12-536': { name: 'Breast milk (human milk, mature)', words: 'breastmilk breast feed breastfeed bm ebm expressed', boost: 12 },
  'c:12-038': { name: 'Breast milk, colostrum (human milk)', words: 'breastmilk breast' },
  'c:12-039': { name: 'Breast milk, transitional (human milk)', words: 'breastmilk breast' },
  'c:12-596': { boost: 9 }, // whole milk, the usual toddler milk
  'c:12-313': { boost: 6 }, // semi-skimmed
  'c:17-377': { name: 'Water, plain (CoFID: distilled)', words: 'tap drinking', boost: 20 },
}

/** The everyday version of a food, preferred when several entries match equally well. */
const COMMON = /^(Eggs, chicken, whole, (boiled|fried|poached|scrambled)|Bread, (white|wholemeal|brown), average|Bananas, flesh only|Apples, eating, raw, flesh and skin|Baked beans, canned in tomato sauce$|Rice, white, .*boiled|Pasta, white, .*boiled|Yogurt, whole milk, (plain|fruit)|Cheese, Cheddar, English|Butter, salted|Carrots, old, boiled|Potatoes, old, (boiled|mashed with butter)|Peas, frozen, boiled|Chicken, meat, average, roasted)/

/** Everyday words mapped to the spelling CoFID uses. */
const SYNONYMS: Record<string, string> = {
  hummus: 'houmous', humous: 'houmous', yoghurt: 'yogurt', yoghurts: 'yogurt', toast: 'toasted', mash: 'mashed',
  spag: 'spaghetti', bol: 'bolognese', chips: 'chips', crisp: 'crisps', satsuma: 'satsumas', tomato: 'tomatoes',
  potato: 'potatoes', wholemeal: 'wholemeal', brown: 'brown', mince: 'minced', courgettes: 'courgette',
}

let cofid: Food[] = []
let byId = new Map<string, Food>()
let custom = new Map<string, Food>()
let nutrientIds: string[] = []
export let cofidVersion = ''

/** Default density (g/ml) so liquids can be entered in ml. CoFID's own specific gravity wins when present. */
function defaultDensity(group: string, name: string): number | undefined {
  if (/^BA|^BC|^BH/.test(group)) return /powder|dried|condensed/i.test(name) ? undefined : 1.03
  if (/^FC|^PE/.test(group)) return 1.04
  if (/^PC/.test(group)) return /undiluted|concentrat/i.test(name) ? 1.1 : 1.02
  if (/^PAC/.test(group)) return 1.0
  if (/^WA/.test(group)) return /dried|powder|condensed/i.test(name) ? undefined : 1.02
  if (/^OC/.test(group)) return 0.92
  if (/^Q/.test(group)) return 1.0
  if (/^water\b/i.test(name)) return 1.0
  return undefined
}

export async function loadCofid(): Promise<void> {
  if (cofid.length) return
  const data = (await import('../data/cofid.json')).default as unknown as CofidFile
  nutrientIds = data.nutrients
  cofidVersion = data.version
  cofid = data.foods.map(([code, name, group, sg, , vals]) => {
    const id = 'c:' + code
    const values: Record<string, RawVal> = {}
    for (let i = 0; i < nutrientIds.length; i++) values[nutrientIds[i]] = vals[i]
    return {
      id,
      name: ALIASES[id]?.name ?? name,
      kind: 'food' as const,
      group,
      per: 100,
      unit: 'g',
      density: sg ?? defaultDensity(group, name),
      values,
    }
  })
  byId = new Map(cofid.map((f) => [f.id, f]))
  rebuildIndex()
}

export function customToFood(c: CustomFood): Food {
  return { id: 'u:' + c.id, name: c.name, brand: c.brand, sourceFoodId: c.sourceFoodId, kind: c.kind, infantFormula: c.infantFormula, group: '', per: c.per, unit: c.unit, values: c.values }
}

export function setCustomFoods(list: CustomFood[]): void {
  custom = new Map(list.map((c) => [('u:' + c.id) as string, customToFood(c)]))
  rebuildIndex()
}

export function getFood(id: string): Food | undefined {
  return byId.get(id) ?? custom.get(id)
}

export function cofidCount(): number {
  return cofid.length
}

// ---------- search ----------

interface IndexEntry {
  food: Food
  text: string // lower-cased name + alias words
  words: string[]
}

let index: IndexEntry[] = []

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
}

function rebuildIndex(): void {
  const all = [...custom.values(), ...cofid]
  index = all.map((food) => {
    const text = norm(`${food.name} ${food.brand ?? ''} ${ALIASES[food.id]?.words ?? ''}`)
    return { food, text, words: text.split(' ') }
  })
}

/** crude singular/plural tolerance: "bananas" matches "banana", "tomato" matches "tomatoes" */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2)
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1)
  return t
}

export interface SearchOptions {
  recents?: string[]
  favourites?: string[]
  limit?: number
  cofidOnly?: boolean
  browse?: boolean
}

/**
 * Every query word must match the start of some word in the food name.
 * Ranking favours favourites, recently used foods, matches on the first word and shorter names.
 */
export function searchFoods(query: string, opts: SearchOptions = {}): Food[] {
  const limit = opts.limit ?? 40
  const q = norm(query)
  const recents = opts.recents ?? []
  const favs = new Set(opts.favourites ?? [])
  if (!q) {
    const seen = new Set<string>()
    const out: Food[] = []
    for (const id of [...favs, ...recents]) {
      const f = getFood(id)
      if (f && !seen.has(id)) {
        seen.add(id)
        out.push(f)
      }
    }
    if (opts.browse) {
      const catalogue = index.filter(({food}) => !opts.cofidOnly || food.id.startsWith('c:'))
      for (const {food} of [...catalogue].sort((a,b) => a.food.name.localeCompare(b.food.name))) {
        if (!seen.has(food.id)) out.push(food)
      }
    }
    return out.slice(0, limit)
  }
  const tokens = q.split(' ').map((t) => stem(SYNONYMS[t] ?? t))
  const scored: { food: Food; score: number }[] = []
  for (const e of index) {
    if (opts.cofidOnly && !e.food.id.startsWith('c:')) continue
    if (e.food.id.startsWith('c:') && e.food.id.slice(2).toLowerCase() === query.trim().toLowerCase()) {
      scored.push({food: e.food, score: 1_000})
      continue
    }
    let score = 0
    let ok = true
    for (const t of tokens) {
      let best = -1
      for (let i = 0; i < e.words.length; i++) {
        const w = e.words[i]
        if (w.startsWith(t)) {
          const s = (i === 0 ? 30 : 12 - Math.min(i, 8)) + (stem(w) === t ? 8 : 0)
          if (s > best) best = s
        }
      }
      if (best < 0) {
        ok = false
        break
      }
      score += best
    }
    if (!ok) continue
    score -= e.words.length * 0.9 // prefer simpler names
    const g = e.food.group
    const raw = /\braw\b/.test(e.text)
    // staples are eaten cooked: rank raw meat, fish, pasta, rice, pulses and eggs below the cooked versions
    if (raw && /^(A[ACD]|M|J|CA|DB|DA)/.test(g)) score -= 7
    else if (raw && /^(FA|DG|DF)/.test(g)) score += 3
    if (/\b(boiled|cooked|grilled|baked|roasted|steamed|average)\b/.test(e.text)) score += 2.5
    if (/\b(dried|powder|concentrate)\b/.test(e.text)) score -= 3
    if (/^(FC|PE)/.test(g) && !/juice/.test(q)) score -= 4
    if (/weighed with|homemade/.test(e.text)) score -= 3
    if (e.food.id.startsWith('u:')) score += 6
    score += ALIASES[e.food.id]?.boost ?? 0
    if (COMMON.test(e.food.name)) score += 5
    if (favs.has(e.food.id)) score += 25
    const r = recents.indexOf(e.food.id)
    if (r >= 0) score += 14 - Math.min(r, 12)
    scored.push({ food: e.food, score })
  }
  scored.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
  return scored.slice(0, limit).map((s) => s.food)
}

export const GROUP_NAMES: Record<string, string> = {
  A: 'Cereals', B: 'Milk & dairy', C: 'Eggs', D: 'Vegetables', F: 'Fruit', G: 'Nuts & seeds', H: 'Herbs & spices',
  J: 'Fish', M: 'Meat', O: 'Fats & oils', P: 'Beverages', Q: 'Alcohol', S: 'Sugars & snacks', W: 'Soups & sauces',
}

export function groupName(food: Food): string {
  if (food.kind === 'supplement') return 'Supplement'
  if (food.kind === 'formula') return 'Formula / milk'
  if (!food.group) return 'My foods'
  return GROUP_NAMES[food.group[0]] ?? ''
}

/** Cow's, goat's, plant and formula milks drunk as a main drink (used for the milk-displacement insight). */
export function isMilkDrink(food: Food): boolean {
  if (food.id === BREAST_MILK_ID) return false
  if (food.kind === 'formula') return true
  if (/^BA[BEHKN]?$/.test(food.group)) return true
  if (food.group === 'BAR') return /^milk, (semi|skimmed|whole)/i.test(food.name) && !/dried|condensed|evaporated/i.test(food.name)
  if (food.group === 'BC') return !/human/i.test(food.name) && !/breast/i.test(food.name)
  return false
}
