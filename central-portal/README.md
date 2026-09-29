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

The public dashboard exposes only the logged-in team’s own project, submissions and published feedback. It accepts only Step 1 and Step 2. The `Milestone Submissions` tab is append-only, so a re-submission updates the visible version without erasing history.

## Teacher evaluation workflow

Add one row per team and step to the private `Evaluation` sheet. Use `Published=TRUE` only when feedback is ready for students. The current Step’s published evaluation appears to the team after their next dashboard refresh.
