# Google Apps Script setup

1. Open the tracker Sheet, then choose **Extensions → Apps Script**.
2. Replace the default file with `Code.gs` in this folder.
3. Replace `REPLACE_WITH_A_LONG_RANDOM_SECRET` with a long private random value. Do not put this secret in browser code; a Netlify Function will keep it private.
4. Click **Deploy → New deployment → Web app**. Execute as **Me**; choose access appropriate to your students (normally **Anyone** only if the Netlify Function is the only caller).
5. Authorize the script and copy its `/exec` URL. Add it to Netlify as `APPS_SCRIPT_URL` and add the matching secret as `APPS_SCRIPT_SECRET`.

The script uses `LockService`, so simultaneous submissions cannot reserve a third team slot for the same project.
