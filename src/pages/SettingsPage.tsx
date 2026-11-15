import { useRef, useState, type ReactNode } from 'react'
import { Banner, Button, Card, Field, IconButton, Input, confirmDialog, cx } from '../components/ui'
import { BANDS, ENERGY_CHILD, ENERGY_INFANT, LRNI, RNI, SALT_MAX } from '../domain/drv'
import { cofidCount, cofidVersion, getFood } from '../domain/foods'
import { GROUP_ORDER, NUTRIENTS, NUTRIENT_BY_ID } from '../domain/nutrients'
import type { BreastMilkSettings } from '../domain/types'
import { downloadBackup } from '../lib/export'
import { cloudConfigured } from '../store/backend'
import { DEFAULT_SETTINGS, useStore, type Backup } from '../store/store'

function Section({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line py-6 first:border-0 lg:grid-cols-[240px_1fr] lg:gap-8">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {intro && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{intro}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

const cell = (v: number | [number, number] | null) => (v == null ? '–' : Array.isArray(v) ? `${v[0]} / ${v[1]}` : String(v))

function RefTable({ title, rows }: { title: string; rows: [string, (number | [number, number] | null)[]][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tnum w-full min-w-[720px] text-[12px]">
        <caption className="pb-1 text-left text-[12.5px] font-semibold">{title}</caption>
        <thead>
          <tr className="border-y border-line text-ink-2">
            <th className="py-1 pr-2 text-left font-medium">Nutrient</th>
            {BANDS.map((b) => <th key={b} className="px-1.5 py-1 text-right font-medium whitespace-nowrap">{b.replace(' months', ' m').replace(' years', ' y')}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, vals]) => (
            <tr key={label} className="border-b border-line">
              <td className="py-1 pr-2 whitespace-nowrap">{label}</td>
              {vals.map((v, i) => <td key={i} className="px-1.5 py-1 text-right whitespace-nowrap">{cell(v)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const mode = useStore((s) => s.mode)
  const user = useStore((s) => s.user)
  const exportBackup = useStore((s) => s.exportBackup)
  const importBackup = useStore((s) => s.importBackup)
  const counts = useStore((s) => `${s.clients.length} clients, ${s.assessments.length} food histories, ${s.sessions.length} sessions, ${s.foods.length} custom foods`)
  const file = useRef<HTMLInputElement>(null)
  const logo = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [showRef, setShowRef] = useState(false)

  const bm = settings.bm
  const setBm = (k: keyof BreastMilkSettings, v: string) => {
    const x = parseFloat(v.replace(',', '.'))
    if (isFinite(x) && x > 0) update({ bm: { ...bm, [k]: x } })
  }
  const toggle = (id: string) => update({ panel: settings.panel.includes(id) ? settings.panel.filter((x) => x !== id) : [...settings.panel, id] })
  const label = (id: string) => `${NUTRIENT_BY_ID[id].label} (${NUTRIENT_BY_ID[id].unit})`
  const measureEntries = Object.entries(settings.measures).filter(([, list]) => list.length)

  const onRestore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Backup
      if (!confirmDialog(`Restore ${data.clients?.length ?? 0} clients and ${data.assessments?.length ?? 0} food histories from this backup (${data.exportedAt?.slice(0, 10)})? Records with the same ID are overwritten; nothing else is deleted.`)) return
      const n = importBackup(data)
      setMsg(`Restored ${n} records.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }
  const onLogo = (f: File) => {
    if (f.size > 300_000) return setMsg('Please choose a logo under 300 KB.')
    const r = new FileReader()
    r.onload = () => update({ logo: String(r.result) })
    r.readAsDataURL(f)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="mt-2">
        <Section title="Practice details" intro="Shown in the header of printed reports.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Practice name"><Input defaultValue={settings.practiceName} onBlur={(e) => update({ practiceName: e.target.value.trim() })} /></Field>
            <Field label="Your name and credentials"><Input defaultValue={settings.practitioner} onBlur={(e) => update({ practitioner: e.target.value.trim() })} placeholder="e.g. Jane Smith RD" /></Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {settings.logo && <img src={settings.logo} alt="Practice logo" className="h-10 max-w-32 rounded border border-line bg-white object-contain p-1" />}
            <input ref={logo} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
            <Button size="sm" icon="upload" onClick={() => logo.current?.click()}>{settings.logo ? 'Replace logo' : 'Add a logo'}</Button>
            {settings.logo && <Button size="sm" variant="ghost" onClick={() => update({ logo: undefined })}>Remove</Button>}
          </div>
        </Section>

        <Section title="Nutrients shown" intro="Choose what appears in analyses, charts, reports and exports. Every nutrient in CoFID is always calculated, so you can switch more on at any time.">
          {GROUP_ORDER.map((g) => (
            <div key={g} className="mb-3 last:mb-0">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{g}</div>
              <div className="flex flex-wrap gap-1.5">
                {NUTRIENTS.filter((n) => n.group === g).map((n) => {
                  const on = settings.panel.includes(n.id)
                  return (
                    <button key={n.id} type="button" aria-pressed={on} onClick={() => toggle(n.id)} className={cx('rounded-full border px-2.5 py-1 text-[12.5px] transition-colors', on ? 'border-ink bg-ink text-surface' : 'border-line-strong text-ink-2 hover:bg-surface-2')}>
                      {n.short ?? n.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => update({ panel: DEFAULT_SETTINGS.panel })}>Reset to default panel</Button>
        </Section>

        <Section title="Breast milk estimates" intro="Volumes used when you log a breastfeed without a measured amount. These are starting assumptions for you to review and adjust to your own practice.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={`Per feed, under ${bm.olderFromMonths} months (ml)`}><Input key={bm.perFeedYounger} inputMode="decimal" defaultValue={bm.perFeedYounger} onBlur={(e) => setBm('perFeedYounger', e.target.value)} /></Field>
            <Field label={`Per feed, ${bm.olderFromMonths} months and over (ml)`}><Input key={bm.perFeedOlder} inputMode="decimal" defaultValue={bm.perFeedOlder} onBlur={(e) => setBm('perFeedOlder', e.target.value)} /></Field>
            <Field label="Age the lower volume starts (months)"><Input key={bm.olderFromMonths} inputMode="decimal" defaultValue={bm.olderFromMonths} onBlur={(e) => setBm('olderFromMonths', e.target.value)} /></Field>
            <Field label="Full day, exclusively breastfed (ml)"><Input key={bm.exclusiveDay} inputMode="decimal" defaultValue={bm.exclusiveDay} onBlur={(e) => setBm('exclusiveDay', e.target.value)} /></Field>
            <Field label="Full day, main milk with solids (ml)"><Input key={bm.mainMilkDay} inputMode="decimal" defaultValue={bm.mainMilkDay} onBlur={(e) => setBm('mainMilkDay', e.target.value)} /></Field>
            <Field label="Density (g per ml)"><Input key={bm.density} inputMode="decimal" defaultValue={bm.density} onBlur={(e) => setBm('density', e.target.value)} /></Field>
          </div>
          <p className="mt-2 text-[12px] text-muted">Composition comes from CoFID “Milk, human, mature”, which has no vitamin D value. Anything logged with an estimated volume is labelled as an estimate in the analysis and on reports.</p>
        </Section>

        <Section title="Reference values" intro="The UK dietary reference values built into the app. Please check them against the published sources before relying on them clinically; tell me if any figure needs correcting.">
          <Banner tone="warning">Transcribed from COMA 1991 (RNI, LRNI), SACN 2011 (energy), SACN 2015 (fibre), SACN 2016 (vitamin D) and SACN 2003 (salt). Not yet verified by a dietitian.</Banner>
          <Button size="sm" className="mt-3" onClick={() => setShowRef(!showRef)}>{showRef ? 'Hide tables' : 'Show the full tables'}</Button>
          {showRef && (
            <Card className="mt-3 space-y-5 p-4">
              <p className="text-[12px] text-ink-2">Where two figures are shown they are boys / girls.</p>
              <RefTable title="Reference Nutrient Intake (RNI) per day" rows={Object.keys(RNI).map((id) => [label(id), RNI[id]])} />
              <RefTable title="Lower Reference Nutrient Intake (LRNI) per day" rows={Object.keys(LRNI).map((id) => [label(id), LRNI[id]])} />
              <RefTable title="Other" rows={[['Salt, maximum (g)', SALT_MAX], ['Vitamin D (µg)', [8.5, 8.5, 8.5, 8.5, 10, 10, 10, 10, 10]], ['Fibre, AOAC (g)', [null, null, null, null, 15, 20, 20, 25, 25]]]} />
              <p className="text-[12px] text-ink-2">Vitamin D is a safe intake below 4 years (8.5–10 µg under 1 year) and an RNI from 4 years. Fibre applies from 2 years: 15 g at 2–4 years, 20 g at 5–10, 25 g at 11–15, 30 g from 16.</p>
              <div className="overflow-x-auto">
                <table className="tnum w-full min-w-[520px] text-[12px]">
                  <caption className="pb-1 text-left text-[12.5px] font-semibold">Energy EAR under 1 year, kcal/day (boys / girls)</caption>
                  <thead><tr className="border-y border-line text-ink-2"><th className="py-1 pr-2 text-left font-medium">Feeding</th>{['0–2 m', '3–4 m', '5–6 m', '7–12 m'].map((b) => <th key={b} className="px-2 py-1 text-right font-medium">{b}</th>)}</tr></thead>
                  <tbody>
                    {(['breast', 'formula', 'mixed'] as const).map((m) => (
                      <tr key={m} className="border-b border-line"><td className="py-1 pr-2">{m === 'breast' ? 'Breastfed' : m === 'formula' ? 'Formula-fed' : 'Mixed or not known'}</td>{ENERGY_INFANT[m].map((v, i) => <td key={i} className="px-2 py-1 text-right">{v[0]} / {v[1]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="tnum w-full min-w-[720px] text-[12px]">
                  <caption className="pb-1 text-left text-[12.5px] font-semibold">Energy EAR 1–18 years, kcal/day</caption>
                  <thead><tr className="border-y border-line text-ink-2"><th className="py-1 pr-2 text-left font-medium">Age (y)</th>{ENERGY_CHILD.map((_, i) => <th key={i} className="px-1 py-1 text-right font-medium">{i + 1}</th>)}</tr></thead>
                  <tbody>
                    <tr className="border-b border-line"><td className="py-1 pr-2">Boys</td>{ENERGY_CHILD.map((v, i) => <td key={i} className="px-1 py-1 text-right">{v[0]}</td>)}</tr>
                    <tr className="border-b border-line"><td className="py-1 pr-2">Girls</td>{ENERGY_CHILD.map((v, i) => <td key={i} className="px-1 py-1 text-right">{v[1]}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </Section>

        <Section title="My household measures" intro="Measures you add while entering foods. The built-in starter list of typical portion weights is a guide only.">
          {measureEntries.length === 0 ? (
            <p className="text-[13px] text-ink-2">None yet. On any food line choose “Add a measure…” to save one, such as “small bowl = 110 g”.</p>
          ) : (
            <Card className="divide-y divide-line">
              {measureEntries.flatMap(([foodId, list]) =>
                list.map((m) => (
                  <div key={foodId + m.label} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{getFood(foodId)?.name ?? foodId}</span>
                    <span className="tnum text-ink-2">{m.label} = {m.amount} {getFood(foodId)?.unit ?? 'g'}</span>
                    <IconButton icon="trash" label="Delete measure" onClick={() => update({ measures: { ...settings.measures, [foodId]: list.filter((x) => x.label !== m.label) } })} />
                  </div>
                )),
              )}
            </Card>
          )}
        </Section>

        <Section title="Backup and restore" intro="Download a complete copy of your data as one file and keep it somewhere safe, such as an encrypted drive. The app reminds you monthly.">
          <p className="mb-3 text-[13px] text-ink-2">Currently stored: {counts}.{settings.lastBackupAt ? ` Last backup downloaded ${new Date(settings.lastBackupAt).toLocaleDateString('en-GB')}.` : ' No backup downloaded yet.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="download" onClick={() => (downloadBackup(exportBackup()), update({ lastBackupAt: Date.now() }))}>Download backup</Button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (e.target.files?.[0] && onRestore(e.target.files[0]), (e.target.value = ''))} />
            <Button icon="upload" onClick={() => file.current?.click()}>Restore from a backup file</Button>
          </div>
          {msg && <p className="mt-2 text-[13px] text-ink-2" role="status">{msg}</p>}
          <p className="mt-2 text-[12px] text-muted">The backup file contains client data in readable form. Store it as carefully as you would paper records.</p>
        </Section>

        <Section title="Storage and account">
          {mode === 'cloud' ? (
            <Banner>Signed in as <strong className="font-semibold">{user?.email}</strong>. Data is stored in your Firebase project and syncs across your devices; changes made offline are sent when you reconnect.</Banner>
          ) : (
            <Banner tone="warning">{cloudConfigured ? 'Cloud storage is configured but not active.' : 'Cloud storage is not connected yet, so data lives only in this browser.'} Follow the setup guide (README) to create your Firebase project, then your data can be moved across with Backup → Restore.</Banner>
          )}
        </Section>

        <Section title="About the data">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Food composition data: McCance and Widdowson’s The Composition of Foods Integrated Dataset ({cofidVersion}), Public Health England, {cofidCount().toLocaleString('en-GB')} foods. Contains public sector information licensed under the Open Government Licence v3.0. Values are per 100 g of edible portion and are typical, not exact, for any individual food. “Trace” is counted as zero; “N” (present but not reliably measured) and blank values are treated as unknown and flagged.
          </p>
        </Section>
      </div>
    </div>
  )
}
