import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui'

const ico = 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/'
const code = 'https://github.com/gmartaras/child-meal-tracker/blob/7fbd7b21db489bac77f8ca719a70eeee209ae677/'

function Source({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">{children}</a>
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return <details className="rounded-xl border border-line bg-surface px-4 py-3">
    <summary className="cursor-pointer font-semibold">{title}</summary>
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">{children}</div>
  </details>
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <Link to="/" className="text-sm text-accent-ink underline underline-offset-2">Back to clients</Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy &amp; security</h1>
        <p className="mt-1 text-sm text-muted">Practice guide · Production checks on 15 November 2026</p>
      </header>
      <Card className="space-y-2 p-4 text-sm leading-relaxed">
        <h2 className="font-semibold">Where the practice stands</h2>
        <p>Mealtrace supports several UK GDPR safeguards. The live checks confirm account isolation and London hosting for the clinical database. Overall practice compliance remains unverified. The practice is responsible for documenting its lawful basis, processor arrangements, access, retention and recovery procedures.</p>
        <p className="text-ink-2">This guide records technical evidence and practice tasks. Give families a separate privacy notice in language children and parents can understand.</p>
      </Card>

      <GuideSection title="What was checked in the live app">
        <dl className="space-y-3">
          <div>
            <dt className="font-semibold text-ink">Access and separation</dt>
            <dd>Google sign-in and Firestore require a verified, approved account. Client records are scoped to that account’s user ID. The published rules matched the tested source after removing email addresses. Tests cover signed-out and unverified access, cross-account isolation, and deletion of a client with finalised records. Direct access through Google Cloud IAM is a separate control.</dd>
            <dd><Source href={code + 'firestore.rules'}>Rules source</Source> · <Source href={code + 'tests/rules.test.ts'}>Rules tests</Source></dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Storage, devices and tracking</dt>
            <dd>The configured Firestore database is in London (europe-west2). Google documents encryption in transit and at rest for Firestore. The live site served HTTPS with HSTS and anti-framing headers. Clinical records use Firestore’s memory cache in the production app. Google sign-in can retain authentication state in the browser after a tab closes. Downloads and printouts create separate copies. The app has an adjustable inactivity sign-out and no integrated analytics, advertising or AI service.</dd>
            <dd><Source href={code + 'src/store/backend.ts'}>Storage code</Source> · <Source href={code + 'firebase.json'}>Hosting configuration</Source> · <Source href="https://firebase.google.com/support/privacy">Google’s Firebase security and location details</Source> · <Source href="https://firebase.google.com/docs/auth/web/auth-state-persistence">Sign-in persistence</Source></dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">What the database contains</dt>
            <dd>Records can include a client code, dates, growth and nutrition data, health history, session notes, questionnaire answers, copied document text, and links to Drive files. Client codes reduce visible identifiers. The records still count as personal data. Photos and videos open through Google Drive, with its own permissions.</dd>
          </div>
        </dl>
      </GuideSection>

      <GuideSection title="Three priorities for Katarina">
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong>Review project control and privileged access.</strong> The IAM check found one individual project owner. Katarina’s account did not hold that role. Agree who should control the project and recovery account, review the developer’s access and record why it is needed. Check two-step verification and device screen locks. The live app’s access log is disabled. Agree what access and changes the practice needs to be able to investigate and how that evidence will be kept. <Source href="https://console.cloud.google.com/iam-admin/iam?project=childmealtracker">Review project access</Source></li>
          <li><strong>Document Google’s role and data transfers.</strong> Google states that Firebase Authentication runs from US data centres. Review the applicable agreements separately for Firebase and the Drive account, record where each service processes data, and document any required UK transfer mechanism and risk assessment. Check Drive recipients and sharing settings and keep identifiable material out of public links. <Source href="https://firebase.google.com/terms/data-processing-terms/">Firebase processing terms</Source> · <Source href="https://workspace.google.com/terms/dpa_terms.html">Google Workspace processing terms</Source> · <Source href={ico + 'international-transfers/a-guide-to-international-transfers/'}>ICO transfer guidance</Source></li>
          <li><strong>Prove you can recover the records.</strong> There were no scheduled Firestore backups and point-in-time recovery and database deletion protection were off at the live check. Agree a recovery schedule, run a password-encrypted backup in Settings, and test recovery in a separate controlled environment. Keep the password separately and manage backup retention. An unpassworded backup, Excel export, JSON export or PDF needs protection wherever it is stored or sent. <Link to="/settings" className="text-accent-ink underline">Open Settings</Link> · <Source href={code + 'src/lib/export.ts'}>Backup and export code</Source></li>
        </ol>
      </GuideSection>

      <GuideSection title="UK GDPR and professional record keeping">
        <p><strong>Health data and accountability.</strong> Document both the Article 6 lawful basis and the Article 9 special-category condition for each purpose. Article 9(2)(h) may apply to necessary dietetic care with the applicable UK health-care condition and professional confidentiality. Record the reasoning and check the ICO fee or exemption. Keep a processing record, assess high-risk processing and document a DPIA for the way the practice handles children’s health data and mealtime media. <Source href={ico + 'lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/'}>ICO health-data guidance</Source> · <Source href="https://www.legislation.gov.uk/ukpga/2018/12/schedule/1">Data Protection Act 2018, Schedule 1</Source> · <Source href={ico + 'accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/'}>ICO DPIA guidance</Source> · <Source href="https://ico.org.uk/for-organisations/data-protection-fee/">ICO fee</Source></p>
        <p><strong>Tell families and handle requests.</strong> Provide a child-appropriate notice with practice contact details, purposes, legal grounds, recipients, transfers, retention and rights. Record which notice was given. Verify identity and authority before releasing a child’s records. Access requests usually need a response within one month. The client menu can export the Mealtrace record and delete it when erasure applies. Review Drive, email, exports and backups too. Keep amendments to finalised histories and document restrictions separately. Archiving only hides a profile from the working list. <Source href={ico + 'individual-rights/individual-rights/right-to-be-informed/'}>ICO privacy information</Source> · <Source href={ico + 'individual-rights/right-of-access/'}>ICO access requests</Source></p>
        <p><strong>Retention and confidentiality.</strong> Adopt a justified retention schedule and review it against HCPC guidance and the practice’s obligations. The app’s configurable retention age gives a review reminder for clients with known dates of birth. Review missing dates manually. Deleting a client removes the linked live records in Mealtrace. Review any separate Drive and backup copies, and check for legal or professional reasons to retain material before deletion. <Source href="https://www.hcpc-uk.org/standards/meeting-our-standards/record-keeping/our-expectations-for-your-record-keeping/">HCPC record-keeping guidance</Source></p>
        <p><strong>Complaints and incidents.</strong> Give families a way to complain and acknowledge data-protection complaints within 30 days. Investigate and communicate the outcome. Log all personal-data breaches and notify the ICO without undue delay and within 72 hours of awareness when reportable. Inform affected people without undue delay if the risk is high. <Source href="https://ico.org.uk/for-organisations/how-to-deal-with-data-protection-complaints/">ICO complaints guidance</Source> · <Source href="https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide/">ICO breach guidance</Source> · <Source href="https://www.legislation.gov.uk/ukpga/2025/18/contents">Data (Use and Access) Act 2025</Source></p>
      </GuideSection>

      <GuideSection title="What to keep for an audit">
        <p>Keep dated records of the live rules and IAM review, signed or applicable processor terms and transfer decision, privacy notice and evidence of delivery, fee status, DPIA, retention schedule, rights and complaints log, breach procedure, and a successful restore test. Save the database location and backup configuration alongside that evidence and review the file when the app, accounts or data flows change.</p>
        <p>The checks above used production configuration, public response headers, source review and synthetic tests. The practice’s account controls, contractual acceptance, Drive sharing and internal policies were outside those checks.</p>
      </GuideSection>
    </article>
  )
}
