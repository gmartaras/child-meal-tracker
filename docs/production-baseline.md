# Production source baseline

This branch is the source used for the live Mealtrace Hosting build, with deployment-specific configuration removed for public sharing. Use it as the base when integrating practice-tailoring. The existing main branch predates production.

- Use Node 24. Run npm ci, npm test and npm run build. For a synthetic browser test, run npm run test:e2e with Playwright Chromium installed, or set PLAYWRIGHT_CHROME to an existing Chromium executable. The browser tests use dev-only trial mode.
- The empty firebase.config.json is intentional. Supply the project-specific Firebase web configuration separately at deployment, and verify the project ID before building a cloud release.
- firestore.rules contains illustrative addresses for local emulator tests. The actual rule configuration remains on the deployment Mac and in Firebase. Do not deploy this file to production. Use Hosting-only deployment.
- Preserve the live safety and record-integrity controls when merging. In particular, use memory-only caching, client-scoped context writes, completed-day averages, uncertainty for missing nutrient values and immutable finalised assessments.
- The production rules do not expose an audit collection. Any audit features must remain optional under those rules or be tested separately in staging. Do not use real client records in a preview or browser tests.
- Do not commit production account allowlists, CLI credentials, service-account keys, exports or clinical records.
