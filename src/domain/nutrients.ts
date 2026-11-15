export type NutrientGroup = 'Energy & macros' | 'Minerals' | 'Vitamins' | 'Fats detail' | 'Other'

export interface NutrientDef {
  id: string
  label: string
  short?: string
  unit: string
  dp: number // decimals to display
  group: NutrientGroup
  core: boolean // shown by default
  /** label used on the custom-food form, if different */
  hint?: string
}

/** Display order within the app. `fibre` and `salt` are derived (see calc.ts). */
export const NUTRIENTS: NutrientDef[] = [
  { id: 'energy', label: 'Energy', unit: 'kcal', dp: 0, group: 'Energy & macros', core: true },
  { id: 'protein', label: 'Protein', unit: 'g', dp: 1, group: 'Energy & macros', core: true },
  { id: 'fat', label: 'Fat', unit: 'g', dp: 1, group: 'Energy & macros', core: true },
  { id: 'satfat', label: 'Saturated fat', unit: 'g', dp: 1, group: 'Energy & macros', core: true },
  { id: 'carb', label: 'Carbohydrate', unit: 'g', dp: 1, group: 'Energy & macros', core: true },
  { id: 'sugars', label: 'Total sugars', unit: 'g', dp: 1, group: 'Energy & macros', core: true },
  { id: 'fibre', label: 'Fibre', unit: 'g', dp: 1, group: 'Energy & macros', core: true, hint: 'AOAC fibre' },

  { id: 'iron', label: 'Iron', unit: 'mg', dp: 1, group: 'Minerals', core: true },
  { id: 'zinc', label: 'Zinc', unit: 'mg', dp: 1, group: 'Minerals', core: true },
  { id: 'calcium', label: 'Calcium', unit: 'mg', dp: 0, group: 'Minerals', core: true },
  { id: 'iodine', label: 'Iodine', unit: 'µg', dp: 0, group: 'Minerals', core: true },
  { id: 'salt', label: 'Salt', unit: 'g', dp: 2, group: 'Minerals', core: true, hint: 'sodium × 2.5' },
  { id: 'selenium', label: 'Selenium', unit: 'µg', dp: 0, group: 'Minerals', core: false },
  { id: 'sodium', label: 'Sodium', unit: 'mg', dp: 0, group: 'Minerals', core: false },
  { id: 'potassium', label: 'Potassium', unit: 'mg', dp: 0, group: 'Minerals', core: false },
  { id: 'magnesium', label: 'Magnesium', unit: 'mg', dp: 0, group: 'Minerals', core: false },
  { id: 'phosphorus', label: 'Phosphorus', unit: 'mg', dp: 0, group: 'Minerals', core: false },
  { id: 'copper', label: 'Copper', unit: 'mg', dp: 2, group: 'Minerals', core: false },
  { id: 'chloride', label: 'Chloride', unit: 'mg', dp: 0, group: 'Minerals', core: false },
  { id: 'manganese', label: 'Manganese', unit: 'mg', dp: 2, group: 'Minerals', core: false },

  { id: 'vita', label: 'Vitamin A', unit: 'µg RE', dp: 0, group: 'Vitamins', core: true, hint: 'retinol equivalents' },
  { id: 'vitc', label: 'Vitamin C', unit: 'mg', dp: 0, group: 'Vitamins', core: true },
  { id: 'vitd', label: 'Vitamin D', unit: 'µg', dp: 1, group: 'Vitamins', core: true },
  { id: 'thiamin', label: 'Thiamin (B1)', short: 'Thiamin', unit: 'mg', dp: 2, group: 'Vitamins', core: true },
  { id: 'riboflavin', label: 'Riboflavin (B2)', short: 'Riboflavin', unit: 'mg', dp: 2, group: 'Vitamins', core: true },
  { id: 'niaceq', label: 'Niacin (B3)', short: 'Niacin', unit: 'mg NE', dp: 1, group: 'Vitamins', core: true, hint: 'niacin equivalents' },
  { id: 'b6', label: 'Vitamin B6', unit: 'mg', dp: 2, group: 'Vitamins', core: true },
  { id: 'b12', label: 'Vitamin B12', unit: 'µg', dp: 1, group: 'Vitamins', core: true },
  { id: 'folate', label: 'Folate (B9)', short: 'Folate', unit: 'µg', dp: 0, group: 'Vitamins', core: true },
  { id: 'panto', label: 'Pantothenate (B5)', short: 'Pantothenate', unit: 'mg', dp: 1, group: 'Vitamins', core: true },
  { id: 'biotin', label: 'Biotin (B7)', short: 'Biotin', unit: 'µg', dp: 1, group: 'Vitamins', core: true },
  { id: 'vite', label: 'Vitamin E', unit: 'mg', dp: 1, group: 'Vitamins', core: false },
  { id: 'vitk', label: 'Vitamin K1', unit: 'µg', dp: 0, group: 'Vitamins', core: false },

  { id: 'n3', label: 'Omega-3 (n-3) fatty acids', short: 'Omega-3', unit: 'g', dp: 2, group: 'Fats detail', core: false },
  { id: 'n6', label: 'Omega-6 (n-6) fatty acids', short: 'Omega-6', unit: 'g', dp: 2, group: 'Fats detail', core: false },
  { id: 'mufa', label: 'Monounsaturated fat', unit: 'g', dp: 1, group: 'Fats detail', core: false },
  { id: 'pufa', label: 'Polyunsaturated fat', unit: 'g', dp: 1, group: 'Fats detail', core: false },
  { id: 'trans', label: 'Trans fatty acids', unit: 'g', dp: 2, group: 'Fats detail', core: false },
  { id: 'chol', label: 'Cholesterol', unit: 'mg', dp: 0, group: 'Fats detail', core: false },

  { id: 'starch', label: 'Starch', unit: 'g', dp: 1, group: 'Other', core: false },
  { id: 'water', label: 'Water', unit: 'g', dp: 0, group: 'Other', core: false },
]

export const NUTRIENT_BY_ID: Record<string, NutrientDef> = Object.fromEntries(NUTRIENTS.map((n) => [n.id, n]))
export const CORE_IDS = NUTRIENTS.filter((n) => n.core).map((n) => n.id)
export const GROUP_ORDER: NutrientGroup[] = ['Energy & macros', 'Minerals', 'Vitamins', 'Fats detail', 'Other']

export function fmt(value: number | null | undefined, dp: number): string {
  if (value == null || !isFinite(value)) return '–'
  return value.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function fmtNutrient(id: string, value: number | null | undefined): string {
  const n = NUTRIENT_BY_ID[id]
  return fmt(value, n ? n.dp : 1)
}
