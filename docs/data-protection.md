# Data protection: what the app does, and what remains with you

This describes how Mealtrace handles personal data, to help the practitioner meet UK GDPR and
Data Protection Act 2018 duties. **It is not legal advice and software cannot make a practice
compliant on its own.** Compliance also depends on how the app is set up and used, and on the
practice's own policies. Where a point needs a decision from you it is marked **You**.

## 1. What is stored

| Data | Why | Notes |
|---|---|---|
| Child's first name, date of birth, sex, practice code | Identify the record; choose age-appropriate reference values | No surname, address, NHS number or contact details are asked for |
| Key context, session notes, sensory checklist answers | Clinical record | Free text: avoid third-party details that are not needed |
| Food histories, accepted foods, meal plan, weight and height | Assessment and advice | Health data (special category) |
| Link to the client's shared folder | One-click access | Only the link is stored, not the folder's contents |
| Privacy-notice date, discharge date | Record keeping | |
| Access log (sign-ins, exports, backups, restores, deletions) | Accountability | Optional: only kept where the database rules allow an `audit` collection. The production rules currently do not, so nothing is logged there |

The name typed onto a printed report is never saved. Nothing is sent to analytics, advertising,
error-tracking or AI services.

## 2. Where it is stored and who can reach it

- **Google Firebase (Cloud Firestore), region `europe-west2` (London).** Encrypted in transit
  (TLS) and at rest by Google. Google acts as a processor under the Firebase / Google Cloud data
  processing terms, which the project owner accepts in the console.
- **Access is limited by Firestore security rules** to named, verified Google accounts, and each
  account can only read its own records. The live rules are kept outside this repository; the
  `firestore.rules` file here holds placeholder addresses for local tests and must not be deployed.
- **Nothing is written to the device.** Records are held in the browser's memory only while the
  app is open and are cleared when the tab closes or on sign-out. The app signs out by itself
  after a period of inactivity (default 30 minutes). It needs a connection to load and save.
- **Finalised food histories cannot be changed or deleted**, in the app or by the database rules.
  Corrections are saved as a separate amendment, so the original stays as issued.
- **Anyone who owns or administers the Firebase project can read the database** from the Firebase
  console, whatever the app's rules say. **You:** the project should be owned by the
  practitioner's account. Any other person with access (for example whoever set it up) is someone
  you have given access to client records: remove them once setup is finished, or record why they
  need it and put a confidentiality agreement in place.

## 3. Individual rights

| Right | How the app supports it |
|---|---|
| Access / portability | Client menu → **Export full record** (JSON) and **Export to Excel** |
| Rectification | Every field is editable |
| Erasure | Client menu → **Delete client and all data** removes the record, session notes and food histories |
| Restriction | **Archive client** hides a record from the working list without deleting it |

Deleting in the app does not delete copies you have made: backup files, exported spreadsheets,
printed or emailed PDFs, and the client's shared folder. **You:** delete those too.

## 4. Retention

The app shows a "keep record until" date for every child, calculated from the date of birth and
the age set in Settings → Data protection (default 25), and lists records that have reached it.
**You:** confirm the retention period with your professional body, regulator or insurer, and
delete records when they fall due.

## 5. Backups

Firestore's free plan has no automatic backups. Settings → Backup downloads every record as one
file. With a password the file is encrypted in the browser (AES-256-GCM, key derived with PBKDF2)
before it is saved; without the password it cannot be read. **You:** always set a password, store
the file somewhere access-controlled, and delete old backups in line with your retention period.

## 6. What you need to have in place

- [ ] Registration with the ICO as a data controller, with the fee paid.
- [ ] A privacy notice for families that names Google (Firebase, London) as a processor, states
      your lawful basis for processing health data, your retention period, and their rights.
      Record the date each family receives it (client → Edit).
- [ ] 2-Step Verification on the Google account used to sign in, and a screen lock on every
      device.
- [ ] The Firebase project owned by you, with no unneeded collaborators (IAM page in the console).
- [ ] A short data protection impact assessment (DPIA): processing children's health data
      normally calls for one. Sections 1, 2 and 5 above cover most of the "measures" part.
- [ ] A plan for a breach (for example a lost unlocked laptop): who to tell and that the ICO must
      be told within 72 hours where there is a risk to individuals.
- [ ] Professional indemnity cover that includes holding electronic records.

## 7. A note on the shared Google Drive folders

The app links to each client's Drive folder but does not manage it. Those folders hold videos of
children and documents written by parents, shared between accounts. The same questions apply to
them as to the app: who has access, where copies exist, and when they are deleted. Storing data in
Google Drive is not compliant or non-compliant in itself; what matters is the account type, the
sharing settings, the agreement in place with Google, and your own procedures.

## 8. Technical summary for an auditor

- Single-page app served as static files over HTTPS; no application server of our own.
- Authentication: Google sign-in via Firebase Authentication. Authorisation: Firestore rules keyed
  to the user's ID and verified email. An access log is written only if the rules expose an `audit` collection.
- Hosting sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, HSTS and `noindex` headers (`firebase.json`).
- The Firebase web configuration in `firebase.config.json` identifies the project and is not a
  secret; it grants no access by itself.
- No third-party scripts, fonts, trackers or cookies beyond Firebase's own authentication storage.
