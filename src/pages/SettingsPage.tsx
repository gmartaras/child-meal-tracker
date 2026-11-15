import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Banner, Button, Card, Field, IconButton, Input, Textarea, confirmDialog, cx } from '../components/ui'
import { BANDS, ENERGY_CHILD, ENERGY_INFANT, LRNI, RNI, SALT_MAX } from '../domain/drv'
import { cofidCount, cofidVersion, getFood } from '../domain/foods'
import { GROUP_ORDER, NUTRIENTS, NUTRIENT_BY_ID } from '../domain/nutrients'
import { DEFAULT_CHECKLIST, MEAL_NAMES, type BreastMilkSettings } from '../domain/types'
import { downloadBackup, readBackup } from '../lib/export'
import { cloudConfigured } from '../store/backend'
import { DEFAULT_SETTINGS, useStore } from '../store/store'

function Section({ title, intro, children, id }: { title: string; intro?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="grid gap-3 border-t border-line py-6 first:border-0 lg:grid-cols-[240px_1fr] lg:gap-8">
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
  const audit = useStore((s) => s.audit)
  const logAudit = useStore((s) => s.logAudit)
  const clients = useStore((s) => s.clients)
  const [password, setPassword] = useState('')
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (window.location.hash.endsWith('#backup')) document.getElementById('backup')?.scrollIntoView()
  }, [])
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean)
  const retentionAge = settings.retentionAge ?? 25
  const today = new Date().toISOString().slice(0, 10)
  const due = clients.filter((c) => c.dob && `${Number(c.dob.slice(0, 4)) + retentionAge}${c.dob.slice(4)}` <= today)
  const noNotice = clients.filter((c) => !c.privacyNoticeOn && !c.archived)
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
      const data = await readBackup(await f.text(), () => window.prompt('This backup is encrypted. Enter its password:'))
      if (!confirmDialog(`Restore ${data.clients?.length ?? 0} clients and ${data.assessments?.length ?? 0} food histories from this backup (${data.exportedAt?.slice(0, 10)})? Records with the same ID are overwritten; nothing else is deleted.`)) return
      const n = await importBackup(data)
      logAudit('restore', `${n} records from backup dated ${data.exportedAt?.slice(0, 10)}`)
      setMsg(`Restored ${n} records.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }
  const onBackup = async () => {
    if (!password && !confirmDialog('Download the backup WITHOUT a password? Anyone who gets the file could read the client records. Cancel to go back and set a password.')) return
    await downloadBackup(exportBackup(), password || undefined)
    logAudit('backup', password ? 'encrypted backup downloaded' : 'unencrypted backup downloaded')
    update({ lastBackupAt: Date.now() })
    setPassword('')
    setMsg(password ? 'Encrypted backup downloaded. Keep the password somewhere safe: without it the file cannot be opened.' : 'Backup downloaded.')
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

        <Section title="Your process" intro="Shape the app around how you work. These apply to new food histories and to every client’s checklist.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meal headings in a food history" hint="One per line, in the order of your food history template.">
              <Textarea key={(settings.mealNames ?? MEAL_NAMES).join('|')} rows={6} defaultValue={(settings.mealNames ?? MEAL_NAMES).join('\n')} onBlur={(e) => update({ mealNames: lines(e.target.value).length ? lines(e.target.value) : [...MEAL_NAMES] })} />
            </Field>
            <Field label="Process checklist for each client" hint="One step per line. Ticked off on the client’s overview.">
              <Textarea key={(settings.checklist ?? DEFAULT_CHECKLIST).join('|')} rows={6} defaultValue={(settings.checklist ?? DEFAULT_CHECKLIST).join('\n')} onBlur={(e) => update({ checklist: lines(e.target.value).length ? lines(e.target.value) : [...DEFAULT_CHECKLIST] })} />
            </Field>
          </div>
        </Section>

        <Section title="Nutrients shown" intro="Choose what appears in analyses, charts, reports and exports. Every nutrient in CoFID is always calculated, so you can switch more on at any time.">
          {GROUP_ORDER.map((g) => (
            <div key={g} className="mb-3 last:mb-0">
              <div className="mb-1.5 text-[12px] font-medium text-muted">{g}</div>
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
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={Boolean(bm.estimatesApproved)} onChange={(e) => update({ bm: { ...bm, estimatesApproved: e.target.checked } })} /><span className="text-[13px]"><span className="font-medium">I have reviewed these volumes and want estimated breastfeeds offered when logging</span><span className="mt-0.5 block text-[12.5px] text-ink-2">Until this is ticked, breast milk can only be logged with a measured volume, or marked as “volume unknown” on the food history.</span></span></label>
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

        <Section id="backup" title="Backup and restore" intro="Download a complete copy of your records as one file. Set a password and the file is encrypted, so it is safe to keep on a drive or in cloud storage.">
          <p className="mb-3 text-[13px] text-ink-2">Currently stored: {counts}.{settings.lastBackupAt ? ` Last backup downloaded ${new Date(settings.lastBackupAt).toLocaleDateString('en-GB')}.` : ' No backup downloaded yet.'}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Password for the backup file" className="w-64"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="at least 10 characters" /></Field>
            <Button variant="primary" icon="download" disabled={password.length > 0 && password.length < 10} onClick={onBackup}>Download {password ? 'encrypted ' : ''}backup</Button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (e.target.files?.[0] && onRestore(e.target.files[0]), (e.target.value = ''))} />
            <Button icon="upload" onClick={() => file.current?.click()}>Restore from a backup file</Button>
          </div>
          {msg && <p className="mt-2 text-[13px] text-ink-2" role="status">{msg}</p>}
          <p className="mt-2 text-[12px] text-muted">The password is never stored. If you lose it, the encrypted file cannot be opened by anyone, including you.</p>
        </Section>

        <Section title="Security on this device" intro="Controls that protect the records if a laptop or phone is lost, borrowed or left open.">
          {mode === 'cloud' ? (
            <Banner>Signed in as <strong className="font-semibold">{user?.email}</strong>. Records are stored in your Firebase project.</Banner>
          ) : (
            <Banner tone="warning">{cloudConfigured ? 'Cloud storage is configured but not active.' : 'Cloud storage is not connected, so data lives only in this browser and these controls have no effect yet.'}</Banner>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Sign out automatically after (minutes)" hint="With no clicks or typing. 0 switches this off.">
              <Input key={settings.autoLockMin} inputMode="numeric" className="tnum w-28" defaultValue={settings.autoLockMin ?? 30} onBlur={(e) => { const x = parseInt(e.target.value); update({ autoLockMin: isFinite(x) && x >= 0 ? x : 30 }) }} />
            </Field>
            <div className="rounded-lg border border-line p-3 text-[13px]"><span className="font-medium">Clinical record cache</span><span className="mt-0.5 block text-[12.5px] text-ink-2">{mode === 'cloud' ? 'The cloud app caches records in memory while the tab is open. Manage downloaded and printed copies separately.' : 'Trial mode stores its records in this browser. Use synthetic records here.'}</span></div>
          </div>
          <p className="mt-2 text-[12px] text-muted">Wait for “Saved to cloud” before closing the tab: an unsaved edit is lost if the tab closes first.</p>
        </Section>

        <Section title="Data protection" intro={<Link to="/privacy" className="text-accent-ink underline">Read the privacy and security guide for UK practices</Link>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Keep each child’s record until age" hint="Shown on every client’s overview as the date to review and delete. Confirm the period with your professional body or insurer.">
              <Input key={retentionAge} inputMode="numeric" className="tnum w-28" defaultValue={retentionAge} onBlur={(e) => { const x = parseInt(e.target.value); update({ retentionAge: isFinite(x) && x > 0 ? x : 25 }) }} />
            </Field>
            <div className="space-y-1.5 text-[13px]">
              <div className={due.length ? 'text-warning-ink' : 'text-ink-2'}>{due.length ? `${due.length} record${due.length === 1 ? ' has' : 's have'} reached the retention age: ${due.map((c) => c.code).join(', ')}` : 'No records have reached the retention age.'}</div>
              <div className={noNotice.length ? 'text-warning-ink' : 'text-ink-2'}>{noNotice.length ? `${noNotice.length} active client${noNotice.length === 1 ? ' has' : 's have'} no privacy-notice date recorded: ${noNotice.map((c) => c.code).join(', ')}` : 'Every active client has a privacy-notice date.'}</div>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-ink-2">
            <li>Each client’s menu has <strong className="font-medium text-ink">Export full record</strong> (for an access or portability request) and <strong className="font-medium text-ink">Delete client and all data</strong> (for an erasure request).</li>
            <li>Keep clinical notes, imported text and files limited to what the practice needs. The name typed on a report is not saved to the client profile.</li>
            <li>The clinical database is in London. Google sign-in and Drive previews have separate data flows described in the privacy guide.</li>
          </ul>
          <details className="mt-3">
            <summary className="text-[13px] font-medium text-accent-ink">Access log ({audit.length})</summary>
            <p className="mt-1 text-[12px] text-muted">{mode === 'cloud' ? 'The current production rules do not record in-app access events. Review audit evidence outside Mealtrace.' : 'Trial events are for testing only.'}</p>
            <Card className="mt-2 max-h-64 overflow-y-auto">
              <table className="tnum w-full text-[12.5px]">
                <tbody className="divide-y divide-line">
                  {audit.slice(0, 200).map((a) => <tr key={a.id}><td className="px-3 py-1 whitespace-nowrap text-ink-2">{new Date(a.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="px-3 py-1 font-medium">{a.action}</td><td className="px-3 py-1 text-ink-2">{a.detail}</td></tr>)}
                  {!audit.length && <tr><td className="px-3 py-2 text-muted">Nothing logged yet.</td></tr>}
                </tbody>
              </table>
            </Card>
          </details>
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
