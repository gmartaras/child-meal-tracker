/**
 * UK Dietary Reference Values for infants, children and adolescents.
 *
 * Sources
 *  - COMA (1991) Dietary Reference Values for Food Energy and Nutrients for the United Kingdom
 *    (Report on Health and Social Subjects 41): RNI and LRNI for protein, vitamins and minerals.
 *  - SACN (2011) Dietary Reference Values for Energy: energy EARs.
 *  - SACN (2015) Carbohydrates and Health: fibre (AOAC) recommendations from age 2.
 *  - SACN (2016) Vitamin D and Health: safe intakes under 4 years, RNI from 4 years.
 *  - SACN (2003) Salt and Health: maximum salt intakes for children.
 *
 * These tables were transcribed for this app and MUST be checked by the practitioner against the
 * published sources before clinical use (Settings → Reference values shows them in full).
 */
import type { Feeding, Sex } from './types'

export type TargetType = 'RNI' | 'EAR' | 'Max' | 'Safe intake' | 'Guideline'

export interface Target {
  value: number
  type: TargetType
  lrni?: number
  source: string
  overridden?: boolean
}

export const BANDS = ['0–3 months', '4–6 months', '7–9 months', '10–12 months', '1–3 years', '4–6 years', '7–10 years', '11–14 years', '15–18 years']

export function bandIndex(ageMonths: number): number {
  if (ageMonths < 4) return 0
  if (ageMonths < 7) return 1
  if (ageMonths < 10) return 2
  if (ageMonths < 12) return 3
  if (ageMonths < 48) return 4
  if (ageMonths < 84) return 5
  if (ageMonths < 132) return 6
  if (ageMonths < 180) return 7
  return 8
}

type Row = (number | [number, number] | null)[] // one entry per band; [male, female] where they differ

const COMA = 'COMA 1991'

/** Reference Nutrient Intakes per day. */
export const RNI: Record<string, Row> = {
  protein: [12.5, 12.7, 13.7, 14.9, 14.5, 19.7, 28.3, [42.1, 41.2], [55.2, 45.0]],
  thiamin: [0.2, 0.2, 0.2, 0.3, 0.5, 0.7, 0.7, [0.9, 0.7], [1.1, 0.8]],
  riboflavin: [0.4, 0.4, 0.4, 0.4, 0.6, 0.8, 1.0, [1.2, 1.1], [1.3, 1.1]],
  niaceq: [3, 3, 4, 5, 8, 11, 12, [15, 12], [18, 14]],
  b6: [0.2, 0.2, 0.3, 0.4, 0.7, 0.9, 1.0, [1.2, 1.0], [1.5, 1.2]],
  b12: [0.3, 0.3, 0.4, 0.4, 0.5, 0.8, 1.0, 1.2, 1.5],
  folate: [50, 50, 50, 50, 70, 100, 150, 200, 200],
  vitc: [25, 25, 25, 25, 30, 30, 30, 35, 40],
  vita: [350, 350, 350, 350, 400, 400, 500, 600, [700, 600]],
  calcium: [525, 525, 525, 525, 350, 450, 550, [1000, 800], [1000, 800]],
  phosphorus: [400, 400, 400, 400, 270, 350, 450, [775, 625], [775, 625]],
  magnesium: [55, 60, 75, 80, 85, 120, 200, 280, 300],
  sodium: [210, 280, 320, 350, 500, 700, 1200, 1600, 1600],
  potassium: [800, 850, 700, 700, 800, 1100, 2000, 3100, 3500],
  chloride: [320, 400, 500, 500, 800, 1100, 1800, 2500, 2500],
  iron: [1.7, 4.3, 7.8, 7.8, 6.9, 6.1, 8.7, [11.3, 14.8], [11.3, 14.8]],
  zinc: [4.0, 4.0, 5.0, 5.0, 5.0, 6.5, 7.0, 9.0, [9.5, 7.0]],
  copper: [0.2, 0.3, 0.3, 0.3, 0.4, 0.6, 0.7, 0.8, 1.0],
  selenium: [10, 13, 10, 10, 15, 20, 30, 45, [70, 60]],
  iodine: [50, 60, 60, 60, 70, 100, 110, 130, 140],
}

/** Lower Reference Nutrient Intakes per day (only nutrients with a fixed daily LRNI). */
export const LRNI: Record<string, Row> = {
  riboflavin: [0.2, 0.2, 0.2, 0.2, 0.3, 0.4, 0.5, 0.8, 0.8],
  b12: [0.1, 0.1, 0.25, 0.25, 0.3, 0.5, 0.6, 0.8, 1.0],
  folate: [30, 30, 30, 30, 35, 50, 75, 100, 100],
  vitc: [6, 6, 6, 6, 8, 8, 8, 9, 10],
  vita: [150, 150, 150, 150, 200, 200, 250, 250, [300, 250]],
  calcium: [240, 240, 240, 240, 200, 275, 325, [480, 450], [480, 450]],
  magnesium: [30, 40, 45, 45, 50, 70, 115, 180, 190],
  sodium: [140, 140, 200, 200, 200, 280, 350, 460, 575],
  potassium: [400, 400, 400, 450, 450, 600, 950, 1600, 2000],
  iron: [0.9, 2.3, 4.2, 4.2, 3.7, 3.3, 4.7, [6.1, 8.0], [6.1, 8.0]],
  zinc: [2.6, 2.6, 3.0, 3.0, 3.0, 4.0, 4.0, 5.3, [5.5, 4.0]],
  selenium: [4, 5, 5, 6, 7, 10, 16, 25, 40],
  iodine: [40, 40, 40, 40, 40, 50, 55, 65, 70],
}

/** Maximum salt, g/day (SACN 2003; under 1 year: less than 1 g). */
export const SALT_MAX: Row = [1, 1, 1, 1, 2, 3, 5, 6, 6]

/**
 * SACN 2011 energy EAR, kcal/day.
 * Infants: age bands 1–2, 3–4, 5–6 and 7–12 months, by feeding mode. [boys, girls]
 */
export const ENERGY_INFANT: Record<'breast' | 'formula' | 'mixed', [number, number][]> = {
  breast: [[526, 478], [574, 526], [598, 550], [694, 646]],
  formula: [[598, 550], [622, 598], [646, 622], [742, 670]],
  mixed: [[574, 502], [598, 550], [622, 574], [718, 646]],
}
/** Children 1–18 years, index = age in completed years − 1. [boys, girls] */
export const ENERGY_CHILD: [number, number][] = [
  [765, 717], [1004, 932], [1171, 1076], [1386, 1291], [1482, 1362], [1577, 1482], [1649, 1530], [1745, 1625],
  [1840, 1721], [2032, 1936], [2127, 2032], [2247, 2103], [2414, 2223], [2629, 2342], [2820, 2390], [2964, 2414],
  [3083, 2462], [3155, 2462],
]

function pick(row: Row | undefined, band: number, sex: Sex): number | null {
  if (!row) return null
  const v = row[band]
  if (v == null) return null
  return Array.isArray(v) ? v[sex === 'M' ? 0 : 1] : v
}

export function energyEAR(ageMonths: number, sex: Sex, feeding: Feeding): number {
  const s = sex === 'M' ? 0 : 1
  if (ageMonths < 12) {
    const mode = feeding === 'breast' || feeding === 'formula' ? feeding : 'mixed'
    const i = ageMonths < 3 ? 0 : ageMonths < 5 ? 1 : ageMonths < 7 ? 2 : 3
    return ENERGY_INFANT[mode][i][s]
  }
  const years = Math.min(18, Math.floor(ageMonths / 12))
  return ENERGY_CHILD[years - 1][s]
}

export function fibreTarget(ageMonths: number): number | null {
  if (ageMonths < 24) return null
  if (ageMonths < 60) return 15
  if (ageMonths < 132) return 20
  if (ageMonths < 192) return 25
  return 30
}

/** All reference targets for a child of this age and sex, before per-child overrides. */
export function referenceTargets(ageMonths: number, sex: Sex, feeding: Feeding): Record<string, Target> {
  const b = bandIndex(ageMonths)
  const out: Record<string, Target> = {}
  out.energy = { value: energyEAR(ageMonths, sex, feeding), type: 'EAR', source: 'SACN 2011' }
  for (const id of Object.keys(RNI)) {
    const v = pick(RNI[id], b, sex)
    if (v == null) continue
    const l = pick(LRNI[id], b, sex)
    out[id] = { value: v, type: 'RNI', source: COMA, ...(l != null ? { lrni: l } : {}) }
  }
  out.vitd =
    ageMonths < 12
      ? { value: 8.5, type: 'Safe intake', source: 'SACN 2016 (8.5–10 µg)' }
      : ageMonths < 48
        ? { value: 10, type: 'Safe intake', source: 'SACN 2016' }
        : { value: 10, type: 'RNI', source: 'SACN 2016' }
  const fibre = fibreTarget(ageMonths)
  if (fibre != null) out.fibre = { value: fibre, type: 'Guideline', source: 'SACN 2015' }
  out.salt = { value: pick(SALT_MAX, b, sex)!, type: 'Max', source: 'SACN 2003' }
  return out
}

export function targetsFor(
  ageMonths: number,
  sex: Sex,
  feeding: Feeding,
  overrides?: Record<string, number>,
): Record<string, Target> {
  const t = referenceTargets(ageMonths, sex, feeding)
  for (const [id, v] of Object.entries(overrides ?? {})) {
    if (!(v > 0)) continue
    t[id] = { ...(t[id] ?? { type: 'Guideline', source: '' }), value: v, type: t[id]?.type ?? 'Guideline', source: 'Custom target', overridden: true }
    // an LRNI above a lowered custom target would be meaningless
    if (t[id].lrni != null && t[id].lrni! >= v) delete t[id].lrni
  }
  return t
}

export type Status = 'low' | 'below' | 'met' | 'above' | 'none'

/** Classify an intake against its target. */
export function statusOf(value: number, t: Target | undefined): Status {
  if (!t) return 'none'
  const pct = value / t.value
  switch (t.type) {
    case 'EAR':
      return pct < 0.9 ? 'below' : pct > 1.1 ? 'above' : 'met'
    case 'Max':
      return pct > 1 ? 'above' : 'met'
    default:
      if (t.lrni != null && value < t.lrni) return 'low'
      return pct < 1 ? 'below' : 'met'
  }
}

export const STATUS_LABEL: Record<Status, string> = {
  low: 'Below LRNI',
  below: 'Below target',
  met: 'Meets target',
  above: 'Above target',
  none: 'No reference value',
}

export function statusLabel(status: Status, t?: Target): string {
  if (t?.type === 'Max') return status === 'above' ? 'Above maximum' : 'Within maximum'
  if (t?.type === 'EAR') return status === 'met' ? 'Close to EAR' : status === 'below' ? 'Below EAR' : 'Above EAR'
  return STATUS_LABEL[status]
}
