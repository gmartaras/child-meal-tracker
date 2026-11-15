import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Field, Icon, Input } from '../components/ui'
import { formatDate, todayISO } from '../domain/age'
import { FOOD_GROUPS, PLAN_DAYS, PLAN_SLOTS } from '../domain/types'
import { useStore } from '../store/store'

/** Meal-plan cell: lines starting with "+" are new foods and print highlighted. */
function Cell({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const isNew = /^\s*\+/.test(line)
        return line.trim() ? <div key={i} className={isNew ? 'font-semibold text-accent-ink' : ''}>{line.replace(/^\s*\+\s*/, '')}</div> : null
      })}
    </>
  )
}

/** Parent-facing documents: the sample meal plan with food chaining ideas, and the accepted foods list. */
export default function PrintDocPage() {
  const { id, doc } = useParams()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const settings = useStore((s) => s.settings)
  const [name, setName] = useState('')
  useEffect(() => {
    document.documentElement.classList.add('print-light')
    return () => document.documentElement.classList.remove('print-light')
  }, [])
  useEffect(() => {
    const prev = document.title
    if (client) document.title = `${client.code} ${doc === 'plan' ? 'meal plan' : 'accepted foods'}`
    return () => {
      document.title = prev
    }
  }, [client, doc])
  if (!client) return <div className="p-8 text-ink-2">Not found. <Link className="underline" to="/">Back</Link></div>
  const shown = name.trim() || client.firstName
  const plan = client.plan
  const accepted = client.acceptedFoods ?? []
  const first = accepted.length ? accepted.map((f) => f.addedOn).sort()[0] : ''
  const isPlan = doc === 'plan'
  const anyNew = isPlan && plan?.cells.some((r) => r.some((c) => /^\s*\+/m.test(c)))

  return (
    <div className="min-h-full bg-bg print:bg-white">
      <div className="no-print sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-end gap-3 px-4 py-3">
          <Link to={`/c/${client.id}?tab=${isPlan ? 'plan' : 'accepted'}`} className="mb-1.5 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink"><Icon name="arrowLeft" size={15} /> Back</Link>
          <Field label="Name on the page (not saved)" className="min-w-[12rem] flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={client.firstName} autoComplete="off" /></Field>
          <Button variant="primary" icon="printer" onClick={() => window.print()}>Print / save as PDF</Button>
        </div>
      </div>
      <article className="print-page mx-auto my-6 max-w-[1000px] rounded-xl border border-line bg-white p-8 text-ink shadow-card">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{isPlan ? 'Sample meal plan' : 'Accepted foods list'}</h1>
            <p className="mt-1 text-[13px] text-ink-2">{shown} · {formatDate(todayISO())}</p>
          </div>
          <div className="text-right">
            {settings.logo && <img src={settings.logo} alt="" className="mb-1 ml-auto max-h-12 max-w-40 object-contain" />}
            {settings.practiceName && <div className="text-[13px] font-semibold">{settings.practiceName}</div>}
            {settings.practitioner && <div className="text-[12px] text-ink-2">{settings.practitioner}</div>}
          </div>
        </header>

        {isPlan && plan && (
          <>
            {plan.intro && <p className="mt-4 text-[13.5px] leading-relaxed whitespace-pre-wrap">{plan.intro}</p>}
            {anyNew && <p className="mt-2 text-[12.5px] text-ink-2">New foods to offer are shown in <span className="font-semibold text-accent-ink">bold blue</span>.</p>}
            <table className="mt-4 w-full table-fixed border-collapse text-[11.5px] leading-snug">
              <thead>
                <tr>
                  <th className="w-10 border border-line bg-surface-2 px-1.5 py-1.5 text-left font-semibold">Day</th>
                  {PLAN_SLOTS.map((s) => <th key={s} className="border border-line bg-surface-2 px-1.5 py-1.5 text-left font-semibold">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {PLAN_DAYS.map((d, di) => (
                  <tr key={d} className="avoid-break">
                    <th className="border border-line px-1.5 py-1.5 text-left align-top font-semibold">{d}</th>
                    {PLAN_SLOTS.map((s, si) => <td key={s} className="border border-line px-1.5 py-1.5 align-top"><Cell text={plan.cells[di]?.[si] ?? ''} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.chains.some((c) => c.from || c.to) && (
              <section className="avoid-break mt-6">
                <h2 className="mb-2 text-[16px] font-semibold">Food chaining ideas</h2>
                <ul className="space-y-1.5 text-[13.5px] leading-relaxed">
                  {plan.chains.filter((c) => c.from || c.to).map((c) => <li key={c.id}><span className="font-medium">{c.from}</span> <span className="text-ink-2">→</span> {c.to}</li>)}
                </ul>
              </section>
            )}
          </>
        )}
        {isPlan && !plan && <p className="mt-4 text-[13px] text-ink-2">No meal plan has been written yet.</p>}

        {!isPlan && (
          <table className="mt-5 w-full border-collapse text-[13.5px]">
            <thead><tr><th className="w-[34%] border border-line bg-surface-2 px-3 py-2 text-left font-semibold">Food group</th><th className="border border-line bg-surface-2 px-3 py-2 text-left font-semibold">Accepted foods</th></tr></thead>
            <tbody>
              {FOOD_GROUPS.map((g, gi) => {
                const foods = accepted.filter((f) => f.group === gi)
                return (
                  <tr key={g} className="avoid-break">
                    <th className="border border-line px-3 py-2.5 text-left align-top font-medium">{g}</th>
                    <td className="border border-line px-3 py-2.5 leading-relaxed">
                      {foods.length ? foods.map((f, i) => <span key={f.id}>{i > 0 && ', '}<span className={f.addedOn > first ? 'font-semibold text-accent-ink' : ''}>{f.name}</span></span>) : <span className="text-muted">–</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!isPlan && accepted.some((f) => f.addedOn > first) && <p className="mt-2 text-[12.5px] text-ink-2">Foods added since the first list are shown in <span className="font-semibold text-accent-ink">bold blue</span>.</p>}
      </article>
    </div>
  )
}
