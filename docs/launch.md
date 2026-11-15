# Mealtrace setup and launch

1. Open **Firebase Sign-In.command** on the setup Mac. Sign in with a Google account that can administer childmealtracker. Return to Codex when the project appears in the CLI list. Keep credentials in the Google sign-in flow.
2. In Firebase, verify the Firestore location and enable the Google sign-in provider. If the database has yet to be created, select the approved region before creating it.
3. Deploy the hosting build and Firestore rules. Verify both configured accounts can sign in and only see their own app records. Grant the developer the necessary project IAM role separately through the project owner. Project-level roles can provide broader data access.
4. Test a synthetic assessment on laptop and phone, including connection loss, simultaneous editing, finalisation and report download.
5. Review the clinical references, portion measures, formula and supplement labels, and breast-milk estimation choices before using the app with families.
6. In a finalised report, choose **Download PDF for Drive** and upload the downloaded PDF to a private folder in the practice Google Drive. Check the folder's access settings. Keep the exact file you issue in Drive, alongside its unique assessment filename.
7. If keeping Firebase billing off, export the app's JSON backup regularly and test restoration with synthetic records in a separate environment. PDF copies in Drive cannot restore diaries or notes. Enable Blaze separately if you want managed scheduled Firestore backups.

To run a synthetic demo locally, use Node 24, run `npm ci` and `npm run dev`, and open the displayed address with `?demo=1`.
