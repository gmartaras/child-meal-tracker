# Mealtrace privacy and security

The signed-in **Privacy & security** footer link opens the [practice guide](https://childmealtracker.web.app/#/privacy). It contains the dated production findings, technical evidence, ICO and HCPC sources, and the records the practice should keep. The guide is for practice staff. Families need a separate privacy notice.

## Evidence to refresh when the service changes

- Check the live Firestore region, backup schedules, point-in-time recovery and deletion protection in Google Cloud. Capture IAM and review the project's privileged access separately from the app's account allowlist.
- Compare live rules to the repository after redacting allowlisted addresses. Run `npm run test:rules` with synthetic data. Keep real allowlist values in the private deployment configuration.
- Check production HTTPS and response headers. Review the Firestore cache and sign-in persistence separately. Check the exposure created by local exports and Drive previews.
- Verify the app's access log is available before relying on it. The live rules inspected on 15 November 2026 did not permit the audit collection.
- Recheck Firebase and Drive data flows and terms against the practice's records before updating the guide. Firebase Authentication is documented by Google as a US-hosted service. A London database does not establish the location of other processing.

The production assessment covers app controls. The practice should collect its own dated evidence for account security, processor agreements and international transfers, the privacy notice, UK GDPR lawful bases, impact assessment, record retention, backup recovery, and the handling of rights requests, complaints and breaches.
