import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FEEDING_LABEL } from '../components/ClientForm'
import { MacroBar, StatusChip } from '../components/analysis'
import { Button, Field, Icon, Input, Segmented, Textarea } from '../components/ui'
import { formatAge, formatDate } from '../domain/age'
import { TYPE_LABEL, analyse, previousAssessment } from '../domain/analysis'
import type { Tot } from '../domain/calc'
import { statusOf, type Status, type Target } from '../domain/drv'
import { cofidVersion } from '../domain/foods'
import { NUTRIENTS, fmt, fmtNutrient } from '../domain/nutrients'
import { useStore } from '../store/store'

const SCALE = 150
/** up to one decimal, without a trailing .0 */
const num = (x: number) => fmt(x, Number.isInteger(Math.round(x * 10) / 10) ? 0 : 1)

function PrintMeter({ tot, target }: { tot: Tot; target: Target }) {
  const w = (x: number) => `${(Math.min(Math.max(x, 0), SCALE) / SCALE) * 100}%`
  const pct = (tot.v / target.value) * 100
  const food = ((tot.v - tot.supp) / target.value) * 100
  const foodW = Math.min(food, SCALE)
  const suppW = Math.max(0, Math.min(pct, SCALE) - foodW)
  return (
    <div className="relative h-4">
      <div className="absolute inset-x-0 top-1 flex h-2 gap-[2px] overflow-hidden rounded-full bg-track">
        {foodW > 0 && <div className="h-full rounded-full bg-series-1" style={{ width: w(foodW) }} />}
        {suppW > 0 && <div className="h-full rounded-full bg-series-2" style={{ width: w(suppW) }} />}
      </div>
      <div className="absolute top-0 h-4 w-[2px] rounded-full bg-ink" style={{ left: `calc(${w(100)} - 1px)` }} />
    </div>
  )
}

const PARENT_WORD: Record<Status, string> = { unknown: 'Insufficient data', met: 'Recorded reference met', below: 'A little low', low: 'Low', above: 'Higher than advised', none: '' }

export default function ReportPage() {
  const { id, aid, kind } = useParams()
  const liveClient = useStore((s) => s.clients.find((c) => c.id === id))
  const a = useStore((s) => s.assessments.find((x) => x.id === aid && x.clientId === id))
  const all = useStore((s) => s.assessments)
  const sessions = useStore((s) => s.sessions)
  const liveSettings = useStore((s) => s.settings)
  const client = a?.snapshot?.client ?? liveClient
  const settings = a?.snapshot?.settings ?? liveSettings
  const saveAssessment = useStore((s) => s.saveAssessment)
  const [archiveStatus, setArchiveStatus] = useState('')
  const [fullName, setFullName] = useState('')
  const [view, setView] = useState<'parent' | 'clinical'>(kind === 'clinical' ? 'clinical' : 'parent')
  const [advice, setAdvice] = useState(a?.parentNote ?? '')

  // reports always print on a white page, whatever the device theme
  useEffect(() => {
    document.documentElement.classList.add('print-light')
    return () => document.documentElement.classList.remove('print-light')
  }, [])
  useEffect(() => {
    const prev = document.title
    if (client && a) document.title = `${client.code} ${view === 'parent' ? 'nutrition summary' : 'clinical nutrition report'} ${a.date}`
    return () => {
      document.title = prev
    }
  }, [client, a, view])

  const prev = useMemo(() => (a ? previousAssessment(a, all) : undefined), [a, all])
  const an = useMemo(() => (a && client ? analyse(a, client, settings, prev) : null), [a, client, settings, prev])
  if (!client || !a || !an) return <div className="p-8 text-ink-2">Report not found. <Link className="underline" to="/">Back</Link></div>

  const isDraft = a.state !== "finalised"
  const name = fullName.trim() || client.firstName
  const { result, targets, ageMonths } = an
  const shown = NUTRIENTS.filter((n) => settings.panel.includes(n.id))
  const withTarget = shown.filter((n) => targets[n.id])
  const status = (nid: string) => statusOf(result.avg[nid], targets[nid])
  const session = [...(a.state === 'finalised' ? [] : sessions)].filter((s) => s.clientId === client.id && s.date <= a.date).sort((x, y) => y.date.localeCompare(x.date))[0]
  const basisText = a.type === 'diary' ? `the average of ${result.nDays} recorded day${result.nDays === 1 ? '' : 's'}` : a.type === 'typical' ? 'a typical day as described' : 'usual foods and how often they are eaten'
  const flagged = withTarget.filter((n) => ['low', 'below'].includes(status(n.id)) && n.id !== 'energy')
  const saveAdvice = () => a.state !== 'finalised' && advice !== (a.parentNote ?? '') && saveAssessment({ ...a, parentNote: advice })

  const header = (title: string) => (
    <header className="flex items-start justify-between gap-6 border-b border-line pb-4">
      <div>
        <div className="text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{title}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          {formatDate(a.date)} · age {formatAge(ageMonths)}
          {view === 'clinical' && <> · {client.sex === 'M' ? 'Male' : 'Female'} · DOB {formatDate(client.dob)} · {client.code}</>}
        </p>
      </div>
      <div className="text-right">
        {settings.logo && <img src={settings.logo} alt="" className="mb-1 ml-auto max-h-12 max-w-40 object-contain" />}
        {settings.practiceName && <div className="text-[13px] font-semibold">{settings.practiceName}</div>}
        {settings.practitioner && <div className="text-[12px] text-ink-2">{settings.practitioner}</div>}
      </div>
    </header>
  )

  const parent = (
    <>
      {header('Nutrition summary')}
      <p className="mt-4 text-[14px] leading-relaxed">
        This summary compares {name}’s food and drink intake, based on {basisText}, with UK recommendations for children of the same age. It shows an estimated daily average of <strong className="font-semibold">{fmt(result.avg.energy.v, 0)} kcal</strong>.
      </p>

      <section className="avoid-break mt-5">
        <h2 className="mb-2 text-[15px] font-semibold">At a glance</h2>
        <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
          {([['met', 'On track', 'check', 'text-good-ink'], ['below', 'A little low', 'alert', 'text-warning-ink'], ['low', 'Low: worth focusing on', 'alertCircle', 'text-critical-ink']] as const).map(([st, label, icon, cls]) => {
            const list = withTarget.filter((n) => n.id !== 'energy' && n.id !== 'salt' && status(n.id) === st)
            return (
              <div key={st} className="rounded-xl border border-line p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><Icon name={icon} className={cls} /> {label}</div>
                {list.length ? <p className="text-[13px] leading-relaxed text-ink-2">{list.map((n) => n.short ?? n.label).join(', ')}</p> : <p className="text-[13px] text-muted">None</p>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-1 text-[15px] font-semibold">How intake compares with recommendations</h2>
        <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-series-1" />Food and drink</span>
          {result.usesSupplements && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-series-2" />Supplements</span>}
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[2px] rounded-full bg-ink" />Recommended amount</span>
        </p>
        <div className="divide-y divide-line rounded-xl border border-line">
          {withTarget.filter((n) => n.id !== 'energy').map((n) => {
            const tot = result.avg[n.id]
            const st = status(n.id)
            return (
              <div key={n.id} className="avoid-break grid grid-cols-[120px_1fr_128px] items-center gap-3 px-3 py-1.5">
                <span className="text-[13px] font-medium">{n.short ?? n.label}</span>
                <PrintMeter tot={tot} target={targets[n.id]} />
                <span className="flex items-center justify-end gap-1.5 text-[12px] text-ink-2">
                  <StatusChip status={st} compact /> {PARENT_WORD[st]}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {flagged.length > 0 && (
        <section className="avoid-break mt-5">
          <h2 className="mb-2 text-[15px] font-semibold">Where {name} gets these nutrients now</h2>
          <ul className="space-y-1 text-[13.5px] leading-relaxed">
            {flagged.slice(0, 5).map((n) => {
              const src = (result.sources[n.id] ?? []).slice(0, 3)
              return (
                <li key={n.id}>
                  <strong className="font-semibold">{n.short ?? n.label}:</strong> {src.length ? src.map((s) => s.name.split(',')[0]).filter((v, i, arr) => arr.indexOf(v) === i).join(', ').toLowerCase() : 'no significant sources recorded'}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {advice.trim() && (
        <section className="avoid-break mt-5">
          <h2 className="mb-2 text-[15px] font-semibold">Recommendations</h2>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{advice}</p>
        </section>
      )}

      <footer className="mt-6 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">
        Intakes are estimates based on reported foods and standard UK food composition data, so they are approximate.{result.breastMilkMl > 0 ? ' Breast milk intake cannot be measured directly and is estimated from the number of feeds.' : ''} Recommendations are population reference values, not individual requirements; this summary supports, and does not replace, individual dietetic advice.
      </footer>
    </>
  )

  const clinical = (
    <>
      {header('Clinical nutrition report')}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-4 print:grid-cols-4">
        <div><dt className="text-[11.5px] text-muted">Assessment</dt><dd>{a.title || TYPE_LABEL[a.type]}</dd></div>
        <div><dt className="text-[11.5px] text-muted">Method</dt><dd>{TYPE_LABEL[a.type]}{a.type === 'diary' ? `, ${result.nDays} day${result.nDays === 1 ? '' : 's'}` : ''}</dd></div>
        <div><dt className="text-[11.5px] text-muted">Milk feeding</dt><dd>{FEEDING_LABEL[client.feeding]}</dd></div>
        <div><dt className="text-[11.5px] text-muted">Latest measurements</dt><dd>{session && (session.weightKg != null || session.heightCm != null) ? `${session.weightKg != null ? `${fmt(session.weightKg, 2)} kg` : ''}${session.weightKg != null && session.heightCm != null ? ' · ' : ''}${session.heightCm != null ? `${fmt(session.heightCm, 1)} cm` : ''} (${formatDate(session.date)})` : 'Not recorded'}</dd></div>
      </dl>
      {a.days.some(day => day.meals.some(meal => meal.familyNotes)) && <section className="mt-4">
        <h2 className="font-semibold">Parent-reported food diary notes</h2>
        {a.days.map(day => day.meals.filter(meal => meal.familyNotes).map(meal => <p className="mt-2 whitespace-pre-wrap text-sm" key={`${day.id}-${meal.id}`}><strong>{day.label}{day.diaryDate ? ` (${formatDate(day.diaryDate)})` : ''} · {meal.name}</strong> {meal.familyNotes}</p>))}
      </section>}
      {client.context && (
        <section className="avoid-break mt-4">
          <h2 className="mb-1 text-[13px] font-semibold">Key context</h2>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{client.context}</p>
        </section>
      )}

      <section className="avoid-break mt-5">
        <h2 className="mb-2 text-[13px] font-semibold">Energy</h2>
        <p className="mb-2 text-[13px]">
          <strong className="font-semibold">{fmt(result.avg.energy.v, 0)} kcal/day</strong>
          {targets.energy && <> · {Math.round((result.avg.energy.v / targets.energy.value) * 100)}% of EAR ({targets.energy.value} kcal, {targets.energy.source})</>}
          {session?.weightKg ? <> · {fmt(result.avg.energy.v / session.weightKg, 0)} kcal/kg · protein {fmt(result.avg.protein.v / session.weightKg, 1)} g/kg</> : null}
        </p>
        {result.energyPct && <MacroBar pct={result.energyPct} />}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-[13px] font-semibold">Average daily intake against reference values</h2>
        <table className="tnum w-full text-[12px]">
          <thead>
            <tr className="border-y border-line text-left text-ink-2">
              <th className="py-1.5 pr-2 font-medium">Nutrient</th><th className="px-2 py-1.5 text-right font-medium">Intake</th><th className="px-2 py-1.5 text-right font-medium">of which suppl.</th><th className="px-2 py-1.5 text-right font-medium">Reference</th><th className="px-2 py-1.5 text-right font-medium">LRNI</th><th className="px-2 py-1.5 text-right font-medium">%</th><th className="px-2 py-1.5 font-medium">Status</th><th className="py-1.5 pl-2 text-right font-medium">Data gaps</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((n) => {
              const tot = result.avg[n.id]
              const t = targets[n.id]
              return (
                <tr key={n.id} className="avoid-break border-b border-line">
                  <td className="py-1 pr-2">{n.label} <span className="text-muted">({n.unit})</span></td>
                  <td className="px-2 py-1 text-right font-medium">{tot.missing.length ? '≥ ' : ''}{fmtNutrient(n.id, tot.v)}</td>
                  <td className="px-2 py-1 text-right">{tot.supp > 0 ? fmtNutrient(n.id, tot.supp) : '–'}</td>
                  <td className="px-2 py-1 text-right">{t ? <>{t.value} <span className="text-muted">{t.type}{t.overridden ? '*' : ''}</span></> : '–'}</td>
                  <td className="px-2 py-1 text-right">{t?.lrni ?? '–'}</td>
                  <td className="px-2 py-1 text-right">{t ? Math.round((tot.v / t.value) * 100) : '–'}</td>
                  <td className="px-2 py-1">{t ? <StatusChip status={statusOf(tot, t)} target={t} /> : <span className="text-muted">No reference</span>}</td>
                  <td className="py-1 pl-2 text-right">{tot.missing.length ? `${tot.missing.length} food${tot.missing.length === 1 ? '' : 's'}` : '–'}{tot.lowEst ? ' †' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          “≥” = minimum value: the foods counted under Data gaps have no figure for that nutrient in the food data. † includes NSP fibre values where no AOAC figure exists (under-reads). {Object.values(targets).some((t) => t.overridden) ? '* custom target set for this child. ' : ''}Reference values: COMA 1991 RNI/LRNI, SACN 2011 energy EAR, SACN 2015 fibre, SACN 2016 vitamin D, SACN 2003 salt.
        </p>
      </section>

      {an.insights.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold">Findings</h2>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed">
            {an.insights.map((i, k) => (
              <li key={k} className="avoid-break flex gap-2">
                <Icon name={i.severity === 'critical' ? 'alertCircle' : i.severity === 'warning' ? 'alert' : i.severity === 'good' ? 'check' : 'info'} size={14} className={i.severity === 'critical' ? 'mt-0.5 text-critical-ink' : i.severity === 'warning' ? 'mt-0.5 text-warning-ink' : i.severity === 'good' ? 'mt-0.5 text-good-ink' : 'mt-0.5 text-muted'} />
                <span><strong className="font-semibold">{i.title}.</strong> {i.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.type === 'diary' && result.days.length > 1 && (
        <section className="avoid-break mt-5">
          <h2 className="mb-2 text-[13px] font-semibold">Day-by-day totals</h2>
          <table className="tnum w-full text-[12px]">
            <thead>
              <tr className="border-y border-line text-ink-2">
                <th className="py-1.5 pr-2 text-left font-medium">Day</th>
                {shown.slice(0, 9).map((n) => <th key={n.id} className="px-1.5 py-1.5 text-right font-medium">{n.short ?? n.label} <span className="font-normal text-muted">{n.unit}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {result.days.map((d) => (
                <tr key={d.label} className="border-b border-line">
                  <td className="py-1 pr-2">{d.label}</td>
                  {shown.slice(0, 9).map((n) => <td key={n.id} className="px-1.5 py-1 text-right">{fmtNutrient(n.id, d.totals[n.id].v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-[13px] font-semibold">Food record</h2>
        <div className="space-y-3 text-[12.5px]">
          {a.days.map((d) => (
            <div key={d.id}>
              {a.days.length > 1 && <div className="mb-1 font-semibold">{d.label}</div>}
              {d.meals.filter((m) => m.items.length).map((m) => (
                <div key={m.id} className="avoid-break grid grid-cols-[110px_1fr] gap-2 border-b border-line py-1">
                  <div className="text-ink-2">{m.name}</div>
                  <ul>
                    {m.items.map((it) => (
                      <li key={it.id}>
                        {it.name}: <span className="tnum">{it.measure === it.unit ? `${num(it.amount)} ${it.unit}` : `${num(it.qty)} × ${it.measure}${/\d\s*(g|ml)\)/.test(it.measure) && it.qty === 1 ? '' : ` (${num(it.amount)} ${it.unit})`}`}</span>
                        {it.freq && <span className="text-ink-2">, {it.freq.times} × per {it.freq.per}</span>}
                        {it.estimate && <span className="text-ink-2"> [estimated]</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!d.meals.some((m) => m.items.length) && <div className="text-muted">Nothing recorded</div>}
            </div>
          ))}
        </div>
      </section>

      {(a.note || (session && session.date === a.date && session.note)) && (
        <section className="avoid-break mt-5">
          <h2 className="mb-1 text-[13px] font-semibold">Notes</h2>
          {a.note && <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{a.note}</p>}
          {session && session.date === a.date && session.note && <p className="mt-2 text-[12.5px] leading-relaxed whitespace-pre-wrap">{session.note}</p>}
        </section>
      )}
      {advice.trim() && (
        <section className="avoid-break mt-5">
          <h2 className="mb-1 text-[13px] font-semibold">Recommendations given</h2>
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{advice}</p>
        </section>
      )}
      <footer className="mt-6 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
        Food composition: McCance and Widdowson’s Composition of Foods Integrated Dataset ({cofidVersion}), plus practitioner-entered product data. Intakes are estimates from reported consumption. Carbohydrate is expressed as monosaccharide equivalents; energy shares use 4, 9 and 3.75 kcal/g for protein, fat and carbohydrate.
        {result.breastMilkMl > 0 ? ` Breast milk volume (${Math.round(result.breastMilkMl)} ml/day${result.breastMilkEstimated ? ', estimated from feeds' : ''}) uses CoFID mature human milk composition.` : ''}
      </footer>
    </>
  )

  return (
    <div className="min-h-full bg-bg print:bg-white">
      <div className="app-topbar no-print sticky top-0 z-20 border-b border-line">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-end gap-3 px-4 py-3">
          <Link to={`/c/${client.id}/a/${a.id}?step=review`} className="mb-1.5 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink"><Icon name="arrowLeft" size={15} /> Back to assessment</Link>
          <div className="mb-0.5"><Segmented value={view} onChange={setView} options={[{ id: 'parent', label: 'Parent summary' }, { id: 'clinical', label: 'Clinical report' }]} /></div>
          <Field label="Name on the report (not saved)" className="min-w-[12rem] flex-1"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={client.firstName} autoComplete="off" /></Field>
          {!isDraft && <><Button onClick={async () => {setArchiveStatus('Preparing PDF…'); try {const {reportPDF} = await import('../lib/reportPdf'); const bytes = reportPDF(a,view); const url = URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/pdf'})); const link = document.createElement('a'); link.href=url; link.download=`${client.code}-${a.date}-${view}-${a.id}.pdf`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); setArchiveStatus('PDF downloaded. Save the issued copy in your private Drive folder.') } catch(e) {setArchiveStatus((e as Error).message)} }}>Download PDF for Drive</Button><span role="status">{archiveStatus}</span>
          <Button variant="primary" icon="printer" onClick={() => window.print()}>Print / save as PDF</Button></>}
        </div>
        <div className="mx-auto max-w-[860px] px-4 pb-3">
          <Field label="Recommendations preserved at finalisation (create an amendment to change)">
            <Textarea readOnly rows={3} value={advice} onChange={(e) => setAdvice(e.target.value)} onBlur={saveAdvice} placeholder="Practical next steps in plain language, e.g. offer an iron-rich food at two meals a day…" />
          </Field>
        </div>
      </div>
      {isDraft && <div className="mx-auto mt-4 max-w-[860px] rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Draft preview.</strong> This shows completed days only. To enable PDF downloads, return to the assessment, choose <strong>Review intake</strong>, mark the days complete, and finalise.
      </div>}
      <article className="print-page mx-auto my-6 max-w-[860px] rounded-2xl border border-line bg-white p-5 text-ink sm:p-10">{isDraft && <p className="mb-3 font-semibold text-amber-900">Draft preview</p>}{!isDraft || result.nDays > 0 ? (view === 'parent' ? parent : clinical) : <p>No completed days to show yet.</p>}</article>
    </div>
  )
}
