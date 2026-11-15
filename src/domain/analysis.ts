import { ageInMonths } from './age'
import { computeAssessment, type AssessmentResult } from './calc'
import { targetsFor, type Target } from './drv'
import { buildInsights, type Insight } from './insights'
import type { Assessment, Client, Settings } from './types'

export interface Analysis {
  ageMonths: number
  targets: Record<string, Target>
  result: AssessmentResult
  insights: Insight[]
}

export function analyse(a: Assessment, client: Client, settings: Settings, prev?: Assessment): Analysis {
  if (a.state === "finalised" && a.snapshot) return a.snapshot.analysis
  const ageMonths = ageInMonths(client.dob, a.date)
  const targets = targetsFor(ageMonths, client.sex, client.feeding, client.targets)
  const result = computeAssessment(a)
  if (a.unquantifiedBreastMilk) for (const total of Object.values(result.avg)) total.missing.push('Unquantified breast milk')
  const previous = prev
    ? {
        result: computeAssessment(prev),
        targets: targetsFor(ageInMonths(client.dob, prev.date), client.sex, client.feeding, client.targets),
        date: prev.date,
      }
    : undefined
  const insights = buildInsights(result, { ageMonths, panel: settings.panel, targets, previous: previous && previous.result.nDays ? previous : undefined })
  return { ageMonths, targets, result, insights }
}

/** The assessment immediately before this one for the same client (by date, then creation time). */
export function previousAssessment(a: Assessment, all: Assessment[]): Assessment | undefined {
  return all
    .filter((x) => x.state === "finalised" && !x.scenarioOf && x.clientId === a.clientId && x.id !== a.id && (x.date < a.date || (x.date === a.date && x.createdAt < a.createdAt)))
    .sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt))[0]
}

export const TYPE_LABEL: Record<Assessment['type'], string> = {
  diary: 'Food diary',
  usual: 'Usual intake',
  typical: 'Usual intake',
  ffq: 'Usual intake',
}

export function isUsual(a: Pick<Assessment, 'type'>): boolean {
  return a.type !== 'diary'
}
