import { jsPDF } from 'jspdf'
import type { Assessment } from '../domain/types'
import { NUTRIENT_BY_ID } from '../domain/nutrients'
import { statusLabel, statusOf } from '../domain/drv'
export function reportPDF(a: Assessment, kind: 'parent' | 'clinical'): Uint8Array {
  if (!a.snapshot || a.state !== 'finalised') throw new Error('Finalise before issuing a report')
  const doc = new jsPDF(); let y = 20
  const line = (text: string) => { for (const row of doc.splitTextToSize(text.replace(/≥/g, '>=').replace(/µ/g, 'u'), 170)) { if(y > 275) {doc.addPage(); y = 20} doc.text(row,20,y); y += 6 } y += 3 }
  doc.setFontSize(16); line(kind === 'parent' ? 'Feeding plan' : 'Clinical nutrition record'); doc.setFontSize(11)
  line(`${a.snapshot.client.firstName} | ${a.date}${a.scenarioOf ? ' | Planning scenario, not observed intake' : ''}`)
  line('Agreed actions and follow-up'); line(a.parentNote || 'No actions recorded.')
  if(kind === 'clinical') {
    line(`Client code: ${a.snapshot.client.code}. Completed days: ${a.snapshot.analysis.result.nDays}.`)
    line(a.note || '')
    for (const day of a.days) for (const meal of day.meals) {
      if (meal.familyNotes) line(`${day.label}${day.diaryDate ? ' ('+day.diaryDate+')' : ''}, ${meal.name}: ${meal.familyNotes}`)
    }
    for(const id of a.snapshot.settings.panel) { const n=NUTRIENT_BY_ID[id], t=a.snapshot.analysis.result.avg[id], target=a.snapshot.analysis.targets[id]; if(!n||!t) continue; line(`${n.label}: ${t.missing.length ? '>=' : ''}${t.v.toFixed(n.dp)} ${n.unit}; ${statusLabel(statusOf(t,target),target)}${t.missing.length ? '; missing: '+t.missing.join(', ') : ''}`) }
  }
  line(`Prepared by ${a.snapshot.settings.practitioner || 'Dietitian'}. Finalised ${a.snapshot.finalisedAt}. Calculator ${a.snapshot.calculatorVersion}. Report template 1.`)
  return new Uint8Array(doc.output('arraybuffer'))
}
