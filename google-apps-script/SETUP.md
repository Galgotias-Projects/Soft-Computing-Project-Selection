# Google Apps Script setup

1. Open the tracker Sheet, then choose **Extensions → Apps Script**.
2. Replace the default file with the repository's `google-apps-script/Code.gs` content and save.
3. Replace `REPLACE_WITH_A_LONG_RANDOM_SECRET` with a long private random value. Keep this value private: do not commit it or put it in browser code.
4. Click **Deploy → New deployment → Web app**. Set **Execute as** to **Me** and **Who has access** to **Anyone**. Authorize the deployment, then copy the URL ending in `/exec`.
5. In Netlify, open **Site configuration → Environment variables**. Add:
   - `APPS_SCRIPT_URL` = the copied `/exec` URL
   - `APPS_SCRIPT_SECRET` = the exact private value from `Code.gs`
6. Go to **Deploys → Trigger deploy → Clear cache and deploy site**.
7. Submit one test registration. A successful registration shows “has been reserved” and creates one new row in the `Registrations` tab.

The Netlify Function forwards the form data securely, keeping the secret out of the public browser bundle. The script uses `LockService`, so simultaneous submissions cannot over-allocate a project.
