import { amountLabel, type AssessmentResult } from './calc'
import { statusOf, type Target } from './drv'
import { NUTRIENT_BY_ID, fmtNutrient } from './nutrients'

export type Severity = 'critical' | 'warning' | 'good' | 'info'

export interface Insight {
  severity: Severity
  title: string
  detail?: string
  nutrient?: string
}

const pct = (v: number, t: number) => Math.round((v / t) * 100)

function label(id: string): string {
  const n = NUTRIENT_BY_ID[id]
  return n ? (n.short ?? n.label) : id
}

function topSources(r: AssessmentResult, id: string, n = 3): string {
  const total = r.avg[id]?.v ?? 0
  const list = (r.sources[id] ?? []).slice(0, n)
  if (!list.length || !(total > 0)) return ''
  return list.map((s) => `${s.name} (${amountLabel(s.amount, s.unit) ? `${amountLabel(s.amount, s.unit)} a day, ` : ''}${Math.round((s.value / total) * 100)}%)`).join(', ')
}

export interface InsightContext {
  ageMonths: number
  panel: string[]
  targets: Record<string, Target>
  previous?: { result: AssessmentResult; targets: Record<string, Target>; date: string }
}

/**
 * Deterministic, rule-based findings. Every rule is a plain comparison against the reference
 * values, so each statement can be traced back to the numbers shown on screen.
 */
export function buildInsights(r: AssessmentResult, ctx: InsightContext): Insight[] {
  const out: Insight[] = []
  if (!r.nDays) return out
  const { targets, ageMonths, panel } = ctx
  const shown = panel.filter((id) => targets[id])

  // --- nutrients below LRNI / RNI
  const low: string[] = []
  const below: string[] = []
  const met: string[] = []
  for (const id of shown) {
    if (id === 'energy' || id === 'salt') continue
    const t = targets[id]
    const tot = r.avg[id]
    const st = statusOf(tot, t)
    if (st === 'low') low.push(id)
    else if (st === 'below') below.push(id)
    else if (st === 'met') met.push(id)
  }
  for (const id of low) {
    const t = targets[id]
    const tot = r.avg[id]
    const gaps = tot.missing.length ? ` ${tot.missing.length} food(s) have no ${label(id).toLowerCase()} value, so true intake may be higher.` : ''
    const src = topSources(r, id)
    out.push({
      severity: 'critical',
      nutrient: id,
      title: `${label(id)} is below the LRNI (${pct(tot.v, t.value)}% of RNI)`,
      detail: `${fmtNutrient(id, tot.v)} ${NUTRIENT_BY_ID[id].unit}/day against an LRNI of ${t.lrni} and RNI of ${t.value}. Intake below the LRNI is very likely to be inadequate.${gaps}${src ? ` Main sources: ${src}.` : ''}`,
    })
  }
  for (const id of below) {
    const t = targets[id]
    const tot = r.avg[id]
    const p = pct(tot.v, t.value)
    const gaps = tot.missing.length ? ` ${tot.missing.length} food(s) have no value for this nutrient, so true intake may be higher.` : ''
    const src = topSources(r, id)
    out.push({
      severity: 'warning',
      nutrient: id,
      title: `${label(id)} is below the ${t.type === 'RNI' ? 'RNI' : t.type.toLowerCase()} (${p}%)`,
      detail: `${fmtNutrient(id, tot.v)} ${NUTRIENT_BY_ID[id].unit}/day against ${t.value}.${gaps}${src ? ` Main sources: ${src}.` : ''}`,
    })
  }

  // --- salt
  if (targets.salt && panel.includes('salt')) {
    const s = r.avg.salt.v
    if (s > targets.salt.value) {
      out.push({ severity: 'warning', nutrient: 'salt', title: `Salt is above the maximum for this age (${fmtNutrient('salt', s)} g vs ${targets.salt.value} g)`, detail: `Main sources: ${topSources(r, 'salt') || 'n/a'}.` })
    }
  }

  // --- vitamin D supplementation (UK advice: breastfed babies from birth, all children 1–4 years)
  if (ageMonths < 60) {
    const suppD = r.avg.vitd.supp
    const formulaEnough = r.formulaMl >= 500 && ageMonths < 12
    if (!(suppD > 0) && !formulaEnough) {
      out.push({
        severity: 'info',
        nutrient: 'vitd',
        title: 'No vitamin D supplement recorded',
        detail: 'UK guidance advises a daily vitamin D supplement for breastfed babies from birth and for all children aged 1 to 4 years (babies having 500 ml or more of infant formula a day do not need one). Check whether a supplement is given but was not recorded.',
      })
    }
  }

  // --- milk displacing iron-rich foods
  if (ageMonths >= 12 && r.milkMl > 0) {
    const iron = targets.iron ? r.avg.iron.v / targets.iron.value : 1
    const milkEnergy = (r.sources.energy ?? []).filter((s) => /\bmilk\b/i.test(s.name) || s.kind === 'formula').reduce((a, s) => a + s.value, 0)
    const share = r.avg.energy.v > 0 ? (milkEnergy / r.avg.energy.v) * 100 : 0
    if (r.milkMl >= 500 && iron < 1 && !r.avg.iron.missing.length) {
      out.push({
        severity: 'warning',
        nutrient: 'iron',
        title: `High milk intake (about ${Math.round(r.milkMl / 10) * 10} ml/day) alongside low iron`,
        detail: `Milk provides around ${Math.round(share)}% of energy and may be displacing iron-rich foods. Iron is at ${Math.round(iron * 100)}% of the RNI.`,
      })
    } else if (r.milkMl >= 600) {
      out.push({ severity: 'info', title: `Milk intake is about ${Math.round(r.milkMl / 10) * 10} ml/day`, detail: `Around ${Math.round(share)}% of energy comes from milk; over roughly 500 ml a day can reduce appetite for other foods in toddlers.` })
    }
  }

  // --- macronutrient balance (population guidance applies in full from 5 years)
  if (r.energyPct && ageMonths >= 60) {
    if (r.energyPct.satfat > 11) out.push({ severity: 'warning', nutrient: 'satfat', title: `Saturated fat provides ${Math.round(r.energyPct.satfat)}% of energy`, detail: 'Population guidance from age 5 is no more than about 10–11% of energy.' })
    if (r.energyPct.fat > 35) out.push({ severity: 'info', nutrient: 'fat', title: `Fat provides ${Math.round(r.energyPct.fat)}% of energy`, detail: 'Population guidance from age 5 is no more than about 35% of energy.' })
  }

  // --- estimates and data gaps
  if (r.breastMilkMl > 0 && r.breastMilkEstimated) {
    out.push({ severity: 'info', title: `Breast milk volume is an estimate (about ${Math.round(r.breastMilkMl / 10) * 10} ml/day)`, detail: 'It is based on the number of feeds and an assumed volume per feed, so all totals that include breast milk are approximate. Vitamin D in breast milk has no CoFID value.' })
  }
  const gappy = shown
    .filter((id) => r.avg[id].missing.length > 0)
    .map((id) => ({ id, n: r.avg[id].missing.length }))
    .sort((a, b) => b.n - a.n)
  if (gappy.length) {
    out.push({
      severity: 'info',
      title: `Some totals are minimum values because of gaps in the food data`,
      detail: gappy.slice(0, 6).map((g) => `${label(g.id)}: ${g.n} food${g.n === 1 ? '' : 's'} without a value`).join('; ') + '. These are marked “≥” in the table.',
    })
  }
  if (r.avg.fibre.lowEst && panel.includes('fibre')) {
    out.push({ severity: 'info', nutrient: 'fibre', title: 'Fibre is partly based on NSP values', detail: 'Some foods have no AOAC fibre figure in CoFID, so their NSP value was used. NSP reads lower than AOAC fibre, so the total is likely an underestimate.' })
  }

  // --- change since last assessment (only where it matters: at least one of the two values is off target)
  if (ctx.previous) {
    const better: string[] = []
    const worse: string[] = []
    for (const id of shown) {
      const tNow = targets[id]
      const tPrev = ctx.previous.targets[id]
      if (id === "energy" || r.avg[id].lowEst || ctx.previous.result.avg[id].lowEst || !tNow || !tPrev || r.avg[id].missing.length || ctx.previous.result.avg[id].missing.length) continue
      const now = (r.avg[id].v / tNow.value) * 100
      const prev = (ctx.previous.result.avg[id].v / tPrev.value) * 100
      const d = now - prev
      if (Math.abs(d) < 10) continue
      const text = `${label(id)} ${Math.round(prev)}% → ${Math.round(now)}%`
      if (tNow.type === 'Max') {
        if (d < 0 && prev > 100) better.push(text)
        else if (d > 0 && now > 100) worse.push(text)
      } else if (tNow.type === 'EAR') {
        if (Math.abs(now - 100) < Math.abs(prev - 100)) better.push(text)
        else if (Math.abs(now - 100) > 10) worse.push(text)
      } else if (d > 0 && prev < 100) better.push(text)
      else if (d < 0 && now < 100) worse.push(text)
    }
    if (better.length) out.push({ severity: 'good', title: 'Moved towards target since the previous assessment', detail: better.join(', ') + ' (% of target).' })
    if (worse.length) out.push({ severity: 'warning', title: 'Moved away from target since the previous assessment', detail: worse.join(', ') + ' (% of target).' })
  }

  if (met.length === shown.filter(id => id !== "energy" && id !== "salt").length && met.length && !low.length && !below.length) {
    out.unshift({ severity: 'good', title: 'All tracked nutrients with a reference value meet their targets' })
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, good: 2, info: 3 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}
