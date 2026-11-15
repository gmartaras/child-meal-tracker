import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Icon, confirmDialog, cx } from '../components/ui'
import { formatDate, todayISO } from '../domain/age'
import { useStore, inactivityMinutes } from '../store/store'

const ICO = 'https://ico.org.uk/for-organisations/'

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink underline underline-offset-2">{children}</a>
}

type Tone = 'good' | 'todo'
function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map = { good: ['check', 'text-good-ink bg-good-wash'], todo: ['alert', 'text-warning-ink bg-warning-wash'] } as const
  return <span className={cx('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', map[tone][1])}><Icon name={map[tone][0]} size={12} />{children}</span>
}

function Row({ tone, label, title, children }: { tone: Tone; label: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <div className="w-20 shrink-0 pt-0.5"><Status tone={tone}>{label}</Status></div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{children}</div>
      </div>
    </li>
  )
}

/** Steps only the practitioner can take. Ticks are saved in Settings with the date. */
const STEPS: { id: string; title: string; why: string; how: ReactNode }[] = [
  {
    id: 'ico-fee',
    title: 'Register with the ICO and pay the data protection fee',
    why: 'Anyone running a business that keeps people’s personal information on a computer normally has to pay this yearly fee. Health information about children makes it very likely that you must.',
    how: <>Use the ICO’s short self-assessment, then register online. The lowest tier is a small yearly fee; check the current amount on the ICO site. <Ext href={ICO + 'data-protection-fee/'}>ICO data protection fee</Ext></>,
  },
  {
    id: 'notice',
    title: 'Give every family a privacy notice',
    why: 'Families must be told, in plain words, what you keep, why, where, who can see it, how long you keep it and how to ask for it or complain.',
    how: <>The ICO has a free privacy notice generator for small businesses. Send the notice with your booking confirmation, then record the date in each client’s record (client page → Edit details → Privacy notice given on). <Ext href={ICO + 'advice-for-small-organisations/privacy-notices-and-cookies/create-your-own-privacy-notice/'}>ICO privacy notice generator</Ext></>,
  },
  {
    id: 'lawful-basis',
    title: 'Write down why you are allowed to keep this information',
    why: 'UK GDPR asks for a reason (a “lawful basis”), plus an extra condition for health information. Writing it down once is enough.',
    how: <>For most dietetic practices this is <em>Article 6(1)(b), contract</em> (you provide a service the family asked for) and <em>Article 9(2)(h), health care</em>, which applies because you are a registered health professional bound by confidentiality. Keep one dated page with this wording. <Ext href={ICO + 'uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/'}>ICO guide to health data</Ext></>,
  },
  {
    id: 'dpia',
    title: 'Do a short risk assessment (DPIA)',
    why: 'Children’s health information and mealtime videos count as high-risk information, so the ICO expects a written check of the risks and how you reduce them.',
    how: <>Use the ICO template. Most of the answers are on this page: what you collect, where it is kept, who can see it, and how long you keep it. <Ext href={ICO + 'uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/'}>ICO DPIA guidance and template</Ext></>,
  },
  {
    id: '2sv',
    title: 'Turn on 2-step verification for your Google account',
    why: 'Your Google account is the key to Mealtrace and to your Drive folders. With 2-step verification, a stolen password alone is not enough to get in.',
    how: <>Google Account → Security → 2-Step Verification. Ask your husband to do the same on his account. <Ext href="https://myaccount.google.com/security">Google account security</Ext></>,
  },
  {
    id: 'ownership',
    title: 'Decide who controls the technical side',
    why: 'Mealtrace runs in a Google Cloud project that your husband set up and owns. The project owner can open the database directly in Google’s console, outside the app.',
    how: <>Best option: make yourself the project owner, and give your husband a lower role that he uses only to fix or update the app. Either way, have a one-page written agreement that he acts only on your instructions and keeps everything confidential (in GDPR terms he is your “processor”). Review who has access once a year. <Ext href="https://console.cloud.google.com/iam-admin/iam?project=childmealtracker">Project access</Ext></>,
  },
  {
    id: 'google-terms',
    title: 'Accept Google’s data processing terms',
    why: 'Google stores the information for you, so its contract terms need to be in place. They are free and accepted online.',
    how: <>In the Firebase console: Project settings → Privacy → accept the Data Processing and Security Terms. For Google Drive these come with Google Workspace if you use a business account. <Ext href="https://firebase.google.com/terms/data-processing-terms">Firebase processing terms</Ext></>,
  },
  {
    id: 'drive',
    title: 'Check your Google Drive sharing',
    why: 'The original diaries, questionnaires, photos and videos are in Google Drive, not in Mealtrace. A folder shared with “anyone with the link” can be opened by anyone who gets hold of that link.',
    how: <>Open each client folder → Share. Keep access to yourself and the family’s own email address, and remove the family’s access once you have the files. Delete videos you no longer need.</>,
  },
  {
    id: 'backup',
    title: 'Keep an encrypted backup each month',
    why: 'If your Google account were ever lost or locked, a backup lets you recover your records.',
    how: <>Settings → Backup and restore → set a password → Download. Keep the password somewhere separate from the file, for example in a password manager.</>,
  },
  {
    id: 'retention-breach',
    title: 'Decide how long you keep records, and what you would do if something went wrong',
    why: 'Records must not be kept forever, and a serious data breach (for example a lost unlocked laptop or a hacked account) has to be reported to the ICO within 72 hours.',
    how: <>Children’s health records are commonly kept until the child turns 25; Mealtrace shows that date on each record. Write that down together with your plan for a breach: change your password, sign out everywhere, note what happened, and report to the ICO if families could be affected. <Ext href={ICO + 'report-a-breach/'}>ICO: report a breach</Ext></>,
  },
]

export default function PrivacyPage() {
  const clients = useStore((s) => s.clients)
  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const redactAll = useStore((s) => s.redactAll)
  const user = useStore((s) => s.user)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const done = settings.privacyDone ?? {}
  const toggle = (id: string) => {
    const next = { ...done }
    if (next[id]) delete next[id]
    else next[id] = todayISO()
    update({ privacyDone: next })
  }

  const withNames = clients.filter((c) => c.firstName && c.firstName !== c.code).length
  const withNotes = clients.filter((c) => c.context || c.resources?.length || c.goals?.length || c.folderUrl).length + sessions.filter((s) => s.note || Object.values(s.sections ?? {}).some(Boolean)).length
  const notices = clients.filter((c) => c.privacyNoticeOn).length
  const backupDays = settings.lastBackupAt ? Math.floor((Date.now() - settings.lastBackupAt) / 86_400_000) : null
  const lock = inactivityMinutes(settings.autoLockMin)
  const stepsDone = STEPS.filter((s) => done[s.id]).length

  const reset = async () => {
    if (!confirmDialog('Remove every client’s first name (replaced by the client code), key context, session note text, food history notes, pasted diary text, imported documents, Drive links and sensory comments?\n\nDates, foods and amounts, accepted foods, meal plans, sensory yes/no answers and weights and heights are kept. This cannot be undone in Mealtrace; the originals stay in your Google Drive.')) return
    setBusy(true)
    const r = await redactAll()
    setBusy(false)
    setResult(`Done: ${r.clients} client record${r.clients === 1 ? '' : 's'}, ${r.sessions} session note${r.sessions === 1 ? '' : 's'} and ${r.histories} food histor${r.histories === 1 ? 'y' : 'ies'} cleaned.${r.failed ? ` ${r.failed} could not be saved: reload the page and run it again.` : ''}${r.locked.length ? ` ${r.locked.length} finalised food histor${r.locked.length === 1 ? 'y keeps' : 'ies keep'} a frozen copy of the old details, because finalised records cannot be edited. Delete them from the client page if they are not needed.` : ''}`)
  }

  return (
    <article className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy &amp; security</h1>
        <p className="mt-1 text-[13.5px] text-ink-2">What Mealtrace does to protect your clients, who can see what, and the steps that are yours to take as a self-employed dietitian.</p>
      </header>

      <Card className="p-4">
        <h2 className="text-[15px] font-semibold">Where you stand</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
          The app itself is set up safely: records are private to your Google account, encrypted, kept in London and never saved on your laptop or phone.
          Being <strong>compliant</strong> with UK GDPR also needs a few things only you can do, mostly short pieces of paperwork. You have marked <strong>{stepsDone} of {STEPS.length}</strong> as done.
        </p>
        <ul className="mt-2 divide-y divide-line">
          <Row tone="good" label="In place" title="Only approved Google accounts can sign in">Sign-in is limited to your account and your husband’s. Each account has its own separate, private area: his account cannot open your client records through the app.</Row>
          <Row tone="good" label="In place" title="Stored in London, encrypted">Client records are kept by Google in its London data centre, encrypted on disk and on the way to your browser.</Row>
          <Row tone="good" label="In place" title="Nothing left on your devices">Records are held in the browser’s memory only and disappear when you close the tab. You are signed out after {lock} minutes without activity.</Row>
          <Row tone={withNames || withNotes ? 'todo' : 'good'} label={withNames || withNotes ? 'Review' : 'In place'} title="Minimal identifying information">
            {withNames || withNotes ? `${withNames} client${withNames === 1 ? ' has' : 's have'} a first name and ${withNotes} record${withNotes === 1 ? ' has' : 's have'} free-text notes or links. Use “Remove notes and names” below for codes only.` : 'Clients are recorded by code only, with no names or free-text notes.'}
          </Row>
          <Row tone={clients.length && notices === clients.length ? 'good' : 'todo'} label={clients.length && notices === clients.length ? 'In place' : 'To do'} title="Privacy notice recorded">{notices} of {clients.length} client{clients.length === 1 ? '' : 's'} have the date the family received your privacy notice.</Row>
          <Row tone={backupDays != null && backupDays <= 31 ? 'good' : 'todo'} label={backupDays != null && backupDays <= 31 ? 'In place' : 'To do'} title="Recent backup">{backupDays == null ? 'No backup downloaded yet.' : `Last backup downloaded ${backupDays} day${backupDays === 1 ? '' : 's'} ago.`} <Link to="/settings" className="font-medium text-accent-ink underline">Open Settings</Link></Row>
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="text-[15px] font-semibold">How Mealtrace works, in plain English</h2>
        <div className="mt-3 grid gap-2 text-center text-[12.5px] sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
          <div className="rounded-lg border border-line p-3"><div className="font-semibold">Your browser</div><div className="text-ink-2">laptop or phone; keeps nothing once the tab closes</div></div>
          <div className="text-muted" aria-hidden="true">⇄</div>
          <div className="rounded-lg border border-line p-3"><div className="font-semibold">Google sign-in</div><div className="text-ink-2">checks it is you{user?.email ? ` (${user.email})` : ''}</div></div>
          <div className="text-muted" aria-hidden="true">⇄</div>
          <div className="rounded-lg border border-line p-3"><div className="font-semibold">Firebase database</div><div className="text-ink-2">Google’s storage service, in London</div></div>
        </div>
        <div className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink-2">
          <p><strong className="text-ink">Firebase</strong> is a Google service that apps use to store information securely, a bit like a locked filing cabinet that Google looks after. Mealtrace is the screen you use to read and fill in that cabinet.</p>
          <p>When you open Mealtrace, Google first checks your account and password (and your 2-step code, once that is on). Only then does the database send your records, over an encrypted connection, to your browser. Every single request is checked against a rule that says: only this signed-in, approved account may read or change its own records.</p>
          <p>Google’s sign-in service may handle your <em>email address</em> in the US; the <em>client records</em> stay in the London database. Mealtrace has no adverts, tracking, analytics or AI, and sends client information nowhere else.</p>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[15px] font-semibold">Who could see your clients’ records</h2>
        <table className="mt-2 w-full text-[13px]">
          <tbody className="divide-y divide-line align-top">
            <tr><td className="w-36 py-2 pr-3 font-semibold">You</td><td className="py-2 text-ink-2">Everything, through Mealtrace, after signing in.</td></tr>
            <tr><td className="py-2 pr-3 font-semibold">Your husband, in the app</td><td className="py-2 text-ink-2">No. His account may sign in so he can maintain the app, but it opens its own empty area, not yours.</td></tr>
            <tr><td className="py-2 pr-3 font-semibold">Your husband, as project owner</td><td className="py-2 text-ink-2"><Status tone="todo">Possible</Status> Whoever owns the Google Cloud project can view the database in Google’s console. That is normal for the person who runs an app, but it means he handles your clients’ information: see step 6 below.</td></tr>
            <tr><td className="py-2 pr-3 font-semibold">Google</td><td className="py-2 text-ink-2">Runs the servers. Its staff cannot browse your data except under the strict controls in its contract terms.</td></tr>
            <tr><td className="py-2 pr-3 font-semibold">Anyone else</td><td className="py-2 text-ink-2">No, unless they have your Google password (and your phone, once 2-step verification is on). Knowing the web address is not enough.</td></tr>
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Your steps</h2>
          <span className="tnum text-[12.5px] text-ink-2">{stepsDone} of {STEPS.length} done</span>
        </div>
        <p className="mt-1 text-[13px] text-ink-2">Tick each one when it is done; the date is saved. Keep the documents together in one folder in case the ICO ever asks.</p>
        <ol className="mt-3 space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.id} className={cx('rounded-lg border p-3', done[s.id] ? 'border-good/40' : 'border-line')}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--ink)]" checked={!!done[s.id]} onChange={() => toggle(s.id)} />
                <span className="min-w-0">
                  <span className="text-[13.5px] font-semibold">{i + 1}. {s.title}</span>
                  {done[s.id] && <span className="ml-2 text-[12px] text-good-ink">done {formatDate(done[s.id])}</span>}
                  <span className="mt-1 block text-[13px] text-ink-2"><strong className="font-medium text-ink">Why:</strong> {s.why}</span>
                  <span className="mt-1 block text-[13px] text-ink-2"><strong className="font-medium text-ink">How:</strong> {s.how}</span>
                </span>
              </label>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-4">
        <h2 className="text-[15px] font-semibold">Remove notes and names</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
          Keeps each client as a code with only what the nutrition analysis needs: date of birth, sex, milk feeding, foods and amounts, accepted foods, meal plans, sensory yes/no answers, and weights and heights.
          Removes first names, key context, session note text, food history notes and pasted diaries, imported documents, Drive links and sensory comments. Your originals in Google Drive are not touched.
        </p>
        <p className="mt-2 text-[12.5px] text-muted">With a date of birth and a code the records still count as personal data, because you can link them back to a family. The steps above still apply.</p>
        <Button className="mt-3" variant="danger" disabled={busy} onClick={() => void reset()}>{busy ? 'Removing…' : 'Remove notes and names from all clients'}</Button>
        {result && <p role="status" className="mt-2 text-[13px]">{result}</p>}
      </Card>

      <p className="text-[12px] text-muted">This page explains how the app is built and points to ICO guidance; it is not legal advice. The ICO helpline (0303 123 1113) gives free advice to small businesses.</p>
    </article>
  )
}
