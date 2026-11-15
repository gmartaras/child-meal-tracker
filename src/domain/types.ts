export type RawVal = number | 'T' | 'N' | null
export type Sex = 'M' | 'F'
export type Feeding = 'breast' | 'formula' | 'mixed' | 'na'
export type FoodKind = 'food' | 'formula' | 'supplement'

/** A food the calculator can use, whatever its source. */
export interface Food {
  id: string // "c:<CoFID code>" or "u:<custom id>"
  name: string
  kind: FoodKind
  group: string // CoFID sub-group code, or '' for custom foods
  /** amount the values refer to: 100 (per 100 g / 100 ml) or 1 (per dose) */
  per: number
  /** base unit amounts are entered in */
  unit: string // 'g' | 'ml' | dose name e.g. 'drop'
  density?: number // g per ml, when a ml measure makes sense
  values: Record<string, RawVal>
  brand?: string
}

/** Custom food as stored in the database. */
export interface CustomFood {
  id: string
  name: string
  brand?: string
  kind: FoodKind
  per: number
  unit: string
  /** only nutrients the user actually knows; anything absent is treated as "no data" */
  values: Record<string, number>
  measures?: Measure[]
  notes?: string
  updatedAt: number
}

export interface Measure {
  label: string
  /** amount in the food's base unit (g, ml or doses) */
  amount: number
  estimate?: boolean
}

export interface Freq {
  times: number
  per: 'day' | 'week' | 'month'
}

export interface Item {
  id: string
  foodId: string
  name: string
  /** total amount in the food's base unit for one occasion */
  amount: number
  unit: string
  qty: number
  measure: string // label of the measure used ('g', 'ml', 'medium slice' ...)
  measureAmount: number // base units per 1 measure
  freq?: Freq
  estimate?: boolean // e.g. breast-milk volume estimated from feeds
  /** frozen copy of a custom food at the time it was logged, so later edits do not rewrite history */
  snap?: { kind: FoodKind; per: number; values: Record<string, number> }
}

export interface Meal {
  id: string
  name: string
  items: Item[]
}

export interface Day {
  id: string
  label: string
  meals: Meal[]
}

export type AssessmentType = 'diary' | 'typical' | 'ffq'

export interface Assessment {
  id: string
  clientId: string
  date: string // yyyy-mm-dd
  type: AssessmentType
  title: string
  days: Day[]
  note?: string
  /** recommendations text shown on the parent report */
  parentNote?: string
  createdAt: number
  updatedAt: number
}

export interface Client {
  id: string
  code: string
  firstName: string
  dob: string // yyyy-mm-dd
  sex: Sex
  feeding: Feeding
  context: string // pinned key context
  /** per-child target overrides, keyed by nutrient id */
  targets?: Record<string, number>
  archived?: boolean
  createdAt: number
  updatedAt: number
}

export interface Session {
  id: string
  clientId: string
  date: string
  note: string
  weightKg?: number
  heightCm?: number
  createdAt: number
  updatedAt: number
}

export interface BreastMilkSettings {
  /** ml per feed for infants younger than `olderFromMonths` */
  perFeedYounger: number
  /** ml per feed from `olderFromMonths` onwards */
  perFeedOlder: number
  olderFromMonths: number
  /** ml per day when exclusively breastfed (under ~6 months) */
  exclusiveDay: number
  /** ml per day when breast milk is the main milk alongside solids (about 7-12 months) */
  mainMilkDay: number
  density: number
}

export interface Settings {
  id: 'settings'
  practiceName: string
  practitioner: string
  logo?: string // data URL
  panel: string[] // nutrient ids shown
  bm: BreastMilkSettings
  /** user-defined household measures per food id */
  measures: Record<string, Measure[]>
  recents: string[]
  favourites: string[]
  lastBackupAt?: number
  seeded?: boolean
  nextClientNo: number
  updatedAt: number
}

export const MEAL_NAMES = ['Breakfast', 'Mid-morning', 'Lunch', 'Mid-afternoon', 'Evening meal', 'Bedtime / night']
