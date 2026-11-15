# Mealtrace

A private web app for a paediatric dietitian: enter a child's food history, see intake against UK
reference values, and track progress across consultations.

- **Food data:** McCance and Widdowson's Composition of Foods Integrated Dataset 2021 (CoFID), 2,887 foods,
  plus your own branded foods, formula milks and supplements.
- **Food histories:** multi-day diary, typical day, or food frequency.
- **Analysis:** daily intake of energy, macronutrients, minerals and vitamins against UK DRVs for the
  child's age and sex, top food sources of each nutrient, rule-based insights, and data-gap warnings.
- **Per client:** pinned key context, dated session notes, weight and height log, trend charts,
  per-child target overrides.
- **Outputs:** parent summary and clinical report (print or save as PDF), Excel export, full backup file.

## Before clinical use

These parts were written for the app and have **not** been verified by a dietitian. Please check them:

| What | Where to review it |
|---|---|
| UK reference values (RNI, LRNI, energy EAR, fibre, vitamin D, salt) | Settings → Reference values → Show the full tables |
| Breast-milk volume assumptions (135 ml/feed under 8 months, 100 ml/feed after, 780 ml and 600 ml full-day figures) | Settings → Breast milk estimates |
| Household measures (typical portion weights) | Shown on every food line; `src/domain/measures.ts` |
| Preloaded supplements (Healthy Start drops, vitamin D 8.5 and 10 µg) | My foods & supplements |

Things the data cannot do:

- CoFID 2021 has **no infant formula or growing-up milks**. Add the products your clients use under
  My foods → Formula & milks, from the manufacturer's data card.
- CoFID gives **total sugars only**, so free sugars cannot be calculated.
- Many foods have no iodine, selenium, AOAC fibre, biotin or vitamin E value. The app never counts a
  missing value as zero: the total is shown with "≥" and the foods concerned are listed.
- Breast milk has no vitamin D value in CoFID, and its volume is an estimate unless measured.

## Try it on your own computer

```bash
npm install
```

```bash
npm run dev
```

Without cloud settings the app runs in **trial mode**: data is kept only in that browser. Do not enter
real client data in trial mode.

## Going live: cloud storage and a web address

You need two free accounts, both owned by you: **Firebase** (Google) stores the data in London and
handles sign-in; **GitHub** holds the code and serves the app at a web address.

### 1. Create the Firebase project (about 10 minutes)

1. Go to <https://console.firebase.google.com> and sign in with the Google account you will use for the app.
2. **Create a project.** Give it any name. Turn Google Analytics **off**.
3. In the left menu choose **Build → Firestore Database → Create database**.
   - Location: **europe-west2 (London)**. This cannot be changed later.
   - Choose **Start in production mode**.
4. Open the **Rules** tab, delete what is there, and paste the contents of [`firestore.rules`](firestore.rules).
   Replace `YOUR_EMAIL_ADDRESS` with your Google email address, then **Publish**.
   These rules mean only your account can read or write anything.
5. Choose **Build → Authentication → Get started → Sign-in method → Google → Enable**, pick a support
   email, **Save**.
6. Click the gear icon → **Project settings → General → Your apps → Web (`</>`)**. Register an app
   (any nickname, do not tick Firebase Hosting). Firebase shows a `firebaseConfig` block. Copy the
   values into [`firebase.config.json`](firebase.config.json) so it looks like this:

   ```json
   {
     "apiKey": "…",
     "authDomain": "your-project.firebaseapp.com",
     "projectId": "your-project",
     "storageBucket": "your-project.appspot.com",
     "messagingSenderId": "…",
     "appId": "…"
   }
   ```

   These values identify the project; they are not passwords. The security rules are what protect the data.

Also turn on **2-Step Verification** for that Google account (<https://myaccount.google.com/security>).

### 2. Put the app online with GitHub Pages (about 10 minutes)

1. Create a free account at <https://github.com> and a new repository (for example `mealtrace`).
   On a free account GitHub Pages needs the repository to be **public**. The repository contains only
   the app's code and the public CoFID data, never client data.
2. Upload this project to the repository.
3. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Every time the code changes, GitHub rebuilds and publishes the app. The address is
   `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.
5. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** and enter
   `YOUR-USERNAME.github.io`. Without this, sign-in is refused.

### 3. Use it

- Open the address, sign in with Google, and add your first client.
- On a phone, open the address in Safari or Chrome and choose **Add to Home Screen**.
- If you tried the app in trial mode first: Settings → Download backup, then sign in to the live
  app and Settings → Restore from a backup file.

### Backups

Firestore's free plan has no automatic backups. The app reminds you monthly to download a backup
file (Settings → Backup and restore). Keep it somewhere secure, such as an encrypted drive.

## Data protection

- The app stores a first name, date of birth, sex, a client code and your notes. It does not ask for
  surnames, addresses or contact details. The name typed onto a report is not saved.
- You are the data controller. Check that your ICO registration and privacy notice cover storing
  client records with Google Cloud (Firebase) in the UK, and that your Google account is secured.
- Avoid putting identifying details in free-text notes beyond what you need clinically.

## How the numbers are calculated

- Nutrients per item = amount eaten ÷ 100 × CoFID value per 100 g (or per dose for supplements).
- A diary is averaged over the days that have at least one food. Typical-day and food-frequency
  entries are scaled by how often each food is eaten.
- "Trace" counts as zero. "N" and blank values count as unknown.
- Fibre uses the AOAC value; where CoFID has none, the NSP value is used and the total is flagged
  as an underestimate.
- Salt = sodium × 2.5. Vitamin A is retinol equivalents. Niacin is niacin equivalents.
- Reference values are chosen by the child's age **on the date of the food history**.
- Energy shares use 4, 9 and 3.75 kcal/g (CoFID carbohydrate is in monosaccharide equivalents).

## For developers

```
scripts/build_cofid.py   CoFID Excel → src/data/cofid.json   (npm run data)
src/domain/              nutrients, DRVs, measures, calculation, insights (no UI)
src/store/               state + storage backends (Firestore / local)
src/pages, components/   screens
tests/                   unit tests for the calculation core   (npm test)
```

Data source: contains public sector information licensed under the Open Government Licence v3.0.
