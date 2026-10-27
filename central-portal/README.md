# Central mentoring portal

This folder is the permanent GitHub Pages frontend for capstone mentoring. It is intentionally a simple static website: no Netlify account, no build service, and no secret in browser code.

## Before publishing

1. In the tracker spreadsheet, open **Extensions → Apps Script**.
2. Add `CentralPortal.gs` beside `Code.gs`, save, and run `setupCentralPortal()` once. Authorize it if Google asks.
3. Run `syncPortalTeams()` once. It creates one six-digit access code for each registered team leader in the private `Portal Teams` sheet.
4. Share each access code privately with its registered team leader; do not publish the `Portal Teams` tab.
5. Deploy the Apps Script as a web app that executes as the coordinator and is accessible to anyone with the link. Copy its `/exec` URL.
6. Replace the placeholder in `portal-config.js` with that `/exec` URL.
7. Merge this branch into `main`, enable **Settings → Pages → Source: GitHub Actions**, then run the deployment workflow.

The public dashboard exposes only the logged-in team’s own project, submissions and published feedback. It accepts Steps 1-5 in order. Step 5 is Product V1 and requires Step 4. Its deadline is **8 November 2026, 11:59:59 PM IST**. Steps 6-8 are visible but inactive, with deadlines on 15, 22 and 29 November 2026. Late submissions remain open for active steps. The `Milestone Submissions` tab is append-only, so a re-submission updates the visible version without erasing history. The first submission date determines the displayed timeliness of each step.

The Step 5 student instructions are in [`step-5-guide.html`](./step-5-guide.html). Its form records branch, interface type, entry-point file, run command, report path, optional hosted demo and evidence confirmations in columns N:T of `Milestone Submissions`. The first 13 columns retain their existing meanings. The Step 4 student instructions are in [`step-4-guide.html`](./step-4-guide.html). Run `npm run test:portal` before changing the Apps Script source. After editing the live `CentralPortal.gs`, update the existing web-app deployment to a **new version**; saving source alone does not update its `/exec` URL. The GitHub Pages frontend deploys from `central-portal/` through the repository workflow.

## Teacher evaluation workflow

Add one row per team and step to the private `Evaluation` sheet. Use `Published=TRUE` only when feedback is ready for students. Feedback for every step uses the same table; no new evaluation tab is needed. The step’s published evaluation appears after the team's next dashboard refresh.

