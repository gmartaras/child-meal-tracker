import type { Assessment, Client, Session } from './types'

/**
 * Privacy reset: removes free-text notes and identifying details, keeping the client code and the
 * non-identifying clinical data the analysis needs (date of birth, sex, milk feeding, foods and amounts,
 * accepted foods, meal plan, sensory answers, growth measurements and dates).
 *
 * Returns only the records that change. Finalised food histories cannot be edited, so they are listed
 * separately for the practitioner to review.
 */
export function redactRecords(clients: Client[], sessions: Session[], assessments: Assessment[]): {
  clients: Client[]
  sessions: Session[]
  assessments: Assessment[]
  locked: Assessment[]
} {
  const outClients: Client[] = []
  for (const c of clients) {
    const next: Client = {
      ...c,
      firstName: c.code || c.firstName,
      context: '',
      sensory: c.sensory ? { ...c.sensory, rows: c.sensory.rows.map((r) => ({ ...r, comment: '' })) } : undefined,
      acceptedFoods: c.acceptedFoods?.map(({ note: _n, ...f }) => f),
    }
    delete next.folderUrl
    delete next.resources
    delete next.goals
    if (!next.sensory) delete next.sensory
    if (!next.acceptedFoods) delete next.acceptedFoods
    if (JSON.stringify(next) !== JSON.stringify(c)) outClients.push(next)
  }
  const outSessions: Session[] = []
  for (const s of sessions) {
    if (!s.note && !Object.values(s.sections ?? {}).some(Boolean)) continue
    outSessions.push({ ...s, note: '', sections: {} })
  }
  const outAssessments: Assessment[] = []
  const locked: Assessment[] = []
  for (const a of assessments) {
    const hasText = !!a.note || !!a.parentNote || a.days.some((d) => d.source != null || d.meals.some((m) => !!m.familyNotes))
    const hasSnapshotText = !!a.snapshot && (!!a.snapshot.client?.context || (a.snapshot.client?.firstName ?? '') !== (a.snapshot.client?.code ?? ''))
    if (a.state === 'finalised') {
      if (hasText || hasSnapshotText) locked.push(a)
      continue
    }
    if (!hasText) continue
    outAssessments.push({
      ...a,
      note: '',
      parentNote: '',
      days: a.days.map(({ source: _s, ...d }) => ({ ...d, meals: d.meals.map(({ familyNotes: _f, ...m }) => m) })),
    })
  }
  return { clients: outClients, sessions: outSessions, assessments: outAssessments, locked }
}
