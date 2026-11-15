import { ageInMonths, formatAge } from '../domain/age'
import { TYPE_LABEL, analyse } from '../domain/analysis'
import { dailyAmount, dayItems, foodOf, rawValue } from '../domain/calc'
import { statusLabel, statusOf } from '../domain/drv'
import { NUTRIENTS } from '../domain/nutrients'
import type { Assessment, Client, Session, Settings } from '../domain/types'
import { downloadBlob } from '../components/ui'
import type { Backup } from '../store/store'

type Cell = { value: string | number | null; fontWeight?: 'bold'; type?: typeof String | typeof Number; format?: string } | null
const h = (v: string): Cell => ({ value: v, fontWeight: 'bold' })
const t = (v: string | undefined): Cell => ({ value: v ?? '', type: String })
const n = (v: number | null | undefined, format = '0.00'): Cell => (v == null || !isFinite(v) ? null : { value: Math.round(v * 1000) / 1000, type: Number, format })

/** One workbook per client: summary per assessment, every food line, measurements and notes. */
export async function exportClientExcel(client: Client, assessments: Assessment[], sessions: Session[], settings: Settings): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const list = [...assessments].sort((a, b) => a.date.localeCompare(b.date))
  const nutrients = NUTRIENTS.filter((x) => settings.panel.includes(x.id))

  const summary: Cell[][] = [[h('Date'), h('Food history'), h('Type'), h('Age'), h('Days'), h('Nutrient'), h('Unit'), h('Daily intake'), h('From supplements'), h('Target'), h('Target type'), h('LRNI'), h('% of target'), h('Status'), h('Foods without a value')]]
  const items: Cell[][] = [[h('Date'), h('Food history'), h('Day'), h('Meal'), h('Food'), h('Quantity'), h('Measure'), h('Amount'), h('Unit'), h('Frequency'), h('Estimated'), h('Energy (kcal/day)')]]
  for (const a of list) {
    const an = analyse(a, client, settings)
    for (const nu of nutrients) {
      const tot = an.result.avg[nu.id]
      const tg = an.targets[nu.id]
      summary.push([
        t(a.date), t(a.title), t(TYPE_LABEL[a.type]), t(formatAge(an.ageMonths)), n(an.result.nDays, '0'), t(nu.label), t(nu.unit),
        n(tot.v), n(tot.supp), n(tg?.value), t(tg?.type), n(tg?.lrni), n(tg ? (tot.v / tg.value) * 100 : null, '0'),
        t(tg ? statusLabel(statusOf(tot, tg), tg) : ''), t(tot.missing.join('; ')),
      ])
    }
    for (const d of a.days) {
      for (const m of d.meals) {
        for (const it of m.items) {
          const f = foodOf(it)
          const k = f ? rawValue(f, 'energy').v : null
          items.push([
            t(a.date), t(a.title), t(d.label), t(m.name), t(it.name), n(it.qty), t(it.measure), n(it.amount), t(it.unit),
            t(it.freq ? `${it.freq.times} per ${it.freq.per}` : ''), t(it.estimate ? 'yes' : ''), n(k != null && f ? (k * dailyAmount(it)) / f.per : null, '0'),
          ])
        }
      }
      if (!dayItems(d).length) items.push([t(a.date), t(a.title), t(d.label), t('(nothing recorded)')])
    }
  }
  const meas: Cell[][] = [[h('Date'), h('Age'), h('Weight (kg)'), h('Length / height (cm)'), h('Session note')]]
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    meas.push([t(s.date), t(formatAge(ageInMonths(client.dob, s.date))), n(s.weightKg), n(s.heightCm, '0.0'), t(s.note)])
  }
  const about: Cell[][] = [
    [h('Client code'), t(client.code)], [h('First name'), t(client.firstName)], [h('Date of birth'), t(client.dob)],
    [h('Sex'), t(client.sex === 'M' ? 'Male' : 'Female')], [h('Key context'), t(client.context)],
    [h('Exported'), t(new Date().toLocaleString('en-GB'))],
    [h('Data source'), t('McCance and Widdowson’s Composition of Foods Integrated Dataset 2021 (Public Health England), Open Government Licence v3.0')],
  ]
  const file = await writeXlsxFile([
    { data: about as never, sheet: 'Client', columns: [{ width: 18 }, { width: 80 }] },
    { data: summary as never, sheet: 'Nutrient summary', columns: [{ width: 12 }, { width: 28 }, { width: 14 }, { width: 10 }, { width: 6 }, { width: 22 }, { width: 8 }, { width: 12 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 8 }, { width: 11 }, { width: 14 }, { width: 50 }] },
    { data: items as never, sheet: 'Food items', columns: [{ width: 12 }, { width: 28 }, { width: 12 }, { width: 16 }, { width: 46 }, { width: 9 }, { width: 26 }, { width: 9 }, { width: 6 }, { width: 14 }, { width: 10 }, { width: 14 }] },
    { data: meas as never, sheet: 'Sessions', columns: [{ width: 12 }, { width: 10 }, { width: 12 }, { width: 18 }, { width: 90 }] },
  ]).toBlob()
  downloadBlob(file, `${client.code}-${client.firstName}-nutrition.xlsx`.replace(/[^\w.\-]+/g, '_'))
}

export function downloadBackup(b: Backup): void {
  const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' })
  downloadBlob(blob, `mealtrace-backup-${b.exportedAt.slice(0, 10)}.json`)
}

/** Export a single client for an access request or secure handover. */
export function exportClientRecord(client: Client, assessments: Assessment[], sessions: Session[]) {
  const record = {
    exportedAt: new Date().toISOString(), client,
    assessments: assessments.filter(a=>a.clientId===client.id),
    sessions: sessions.filter(s=>s.clientId===client.id),
  }
  downloadBlob(new Blob([JSON.stringify(record, null, 2)], {type:'application/json'}),
    `mealtrace-client-${client.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
}
