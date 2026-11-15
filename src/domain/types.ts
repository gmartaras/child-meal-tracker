export type RawVal = number | 'T' | 'N' | null
export type Sex = 'M' | 'F'
export type Feeding = 'breast' | 'formula' | 'mixed' | 'na'
export type FoodKind = 'food' | 'formula' | 'supplement' | 'recipe'

/** A food the calculator can use, whatever its source. */
export interface Food {
  sourceFoodId?: string
  infantFormula?: boolean
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
  /** nutrients whose value is a minimum because part of the food (a recipe ingredient) has no data */
  partial?: string[]
  /** true for a CoFID food whose values or name the practitioner has changed */
  edited?: boolean
  /** food this entry was derived from, if any */
  basedOn?: string
}

export interface Ingredient {
  id: string
  foodId: string
  name: string
  /** grams (or ml / doses for foods measured that way) */
  amount: number
  qty: number
  measure: string
  measureAmount: number
  unit: string
}

/** Recipes saved by an earlier version used items / yieldGrams / servings; see normaliseRecipe. */
export interface RecipeDef {
  ingredients: Ingredient[]
  /** weight of the finished dish in grams; blank = sum of the ingredients */
  cookedWeight?: number
  portions: number
}

/** Custom food as stored in the database. */
export interface CustomFood {
  sourceFoodId?: string
  infantFormula?: boolean
  id: string
  name: string
  brand?: string
  kind: FoodKind
  per: number
  unit: string
  /** only nutrients the user actually knows; anything absent is treated as "no data" */
  values: Record<string, RawVal>
  measures?: Measure[]
  notes?: string
  /** set when this record replaces the values of a CoFID food ("c:<code>"); deleting it reverts to the original */
  overrideOf?: string
  /** the library entry this one was copied from */
  basedOn?: string
  recipe?: RecipeDef
  partial?: string[]
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
  /** offered but not eaten: kept on the record, left out of the totals */
  refused?: boolean
  /** frozen copy of an editable food at the time it was logged, so later edits do not rewrite history */
  snap?: { sourceFoodId?: string; infantFormula?: boolean; kind: FoodKind; per: number; values: Record<string, RawVal>; partial?: string[] }
}

export interface Meal {
  familyNotes?: string
  id: string
  name: string
  items: Item[]
}

export interface Day {
  diaryDate?: string
  complete?: boolean
  excluded?: boolean
  id: string
  label: string
  meals: Meal[]
  /** what the parent wrote for this day, pasted in for reference while entering foods */
  source?: string
}

/** 'typical' and 'ffq' are earlier names for 'usual' and are read as such */
export type AssessmentType = 'diary' | 'usual' | 'typical' | 'ffq'

export interface Assessment {
  state?: "draft" | "reviewed" | "finalised"
  amendmentOf?: string
  unquantifiedBreastMilk?: boolean
  scenarioOf?: string
  snapshot?: { analysis: import("./analysis").Analysis; client: Client; settings: Settings; finalisedAt: string; calculatorVersion: string }
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
  resources?: {id: string; category: string; title: string; url: string}[]
  goals?: { id: string; text: string; due: string; done: boolean; outcome: string }[]
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
  /** link to the client's shared folder (videos, documents) */
  folderUrl?: string
  /** date the privacy notice / consent was given */
  privacyNoticeOn?: string
  dischargedOn?: string
  /** practice checklist: item label -> date ticked */
  checklist?: Record<string, string>
  acceptedFoods?: AcceptedFood[]
  plan?: MealPlan
  sensory?: SensoryRecord
  createdAt: number
  updatedAt: number
}

export const FOOD_GROUPS = [
  'Carbohydrates and starchy foods',
  'Fruits and vegetables',
  'Milk and dairy foods (or fortified alternatives)',
  'Meat, fish, eggs, beans and other protein',
  'Foods and drinks high in fat or sugar',
] as const

export interface AcceptedFood {
  id: string
  foodId?: string
  name: string
  group: number // index into FOOD_GROUPS
  addedOn: string
  note?: string
}

export const PLAN_SLOTS = ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Before bed']
export const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface MealPlan {
  intro: string
  /** cells[day][slot]; a line starting with "+" is a new food to introduce */
  cells: string[][]
  chains: { id: string; from: string; to: string }[]
  updatedAt: number
}

export type SensoryAnswer = 'yes' | 'no' | 'sometimes' | ''

export interface SensoryRow {
  section: string
  text: string
  answer: SensoryAnswer
  comment: string
}

export interface SensoryRecord {
  completedOn: string
  rows: SensoryRow[]
}

export interface SessionSections {
  concerns?: string
  observations?: string
  advice?: string
  actions?: string
}

export const SESSION_KINDS = ['Initial consultation', 'Follow-up', 'Message or email', 'Other'] as const

export interface Session {
  id: string
  clientId: string
  date: string
  kind?: string
  /** free-text note (earlier records) */
  note: string
  sections?: SessionSections
  weightKg?: number
  heightCm?: number
  createdAt: number
  updatedAt: number
}

export interface BreastMilkSettings {
  estimatesApproved?: boolean
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
  savedMeals?: {id: string; name: string; items: Item[]}[]
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
  /** meal headings used for new food histories */
  mealNames?: string[]
  /** steps of the practice process ticked off per client */
  checklist?: string[]
  /** sign out after this many minutes without activity (0 = never) */
  autoLockMin?: number
  /** age at which a child's record is due for deletion review */
  retentionAge?: number
  seeded?: boolean
  nextClientNo: number
  updatedAt: number
}

export const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks']
export const DEFAULT_CHECKLIST = [
  '3-day food history received',
  'Sensory questionnaire received',
  'Mealtime videos reviewed',
  'Accepted foods list agreed',
  'Sample meal plan shared',
  'Food chaining ideas shared',
  'Handouts shared',
]
