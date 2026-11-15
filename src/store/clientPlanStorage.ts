import type { MealPlan } from '../domain/types'

type StoredPlan = Omit<MealPlan, 'cells'> & { cells: { slots: string[] }[] }

export function encodeClientPlan(plan: MealPlan): StoredPlan {
  // Firestore allows arrays inside map elements, but rejects directly nested arrays.
  return { ...plan, cells: plan.cells.map(slots => ({ slots })) }
}

export function decodeClientPlan(plan: StoredPlan | MealPlan): MealPlan {
  return { ...plan, cells: plan.cells.map(row => Array.isArray(row) ? row : row.slots) }
}
