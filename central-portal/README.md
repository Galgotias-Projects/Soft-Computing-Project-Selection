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

The public dashboard exposes only the logged-in team's project, submissions and published feedback. Steps 1–8 are active and accepted in order. The remaining deadlines are 22 November (Step 6), 29 November (Step 7) and 6 December 2026 (Step 8), all at 11:59:59 PM IST. Late submissions remain open. Earlier versions are preserved, and the earliest submission, including legacy Step 1 records, determines lateness.

Published grades use the ten-point content grade minus a fixed one-mark deduction for a late first submission, with a zero floor. The evaluation's Required action states the deduction and content grade. On-time first versions are exempt after revision. Dashboard cards become yellow for revision required, green for accepted and red for overdue missing submissions. Future deadlines retain their normal appearance. Submitted work awaiting review stays neutral.

The combined Steps 7 and 8 reference PDF is linked on the public page, together with the complete SC11 reference project, eight-slide PPTX and matching presentation PDF. Step 7 requires PPTX upload; Step 8 may reuse it. Both final steps require public UI/demo evidence. Step 8 also requires a specific project LinkedIn post and content confirmations.

The Step 5 student instructions are in [`step-5-guide.html`](./step-5-guide.html). Its form records branch, interface type, entry-point file, run command, report path, optional hosted demo and evidence confirmations in columns N:T of `Milestone Submissions`. The first 13 columns retain their existing meanings. The Step 4 student instructions are in [`step-4-guide.html`](./step-4-guide.html). Run `npm run test:portal` before changing the Apps Script source. After editing the live `CentralPortal.gs`, update the existing web-app deployment to a **new version**; saving source alone does not update its `/exec` URL. The GitHub Pages frontend deploys from `central-portal/` through the repository workflow.

## Teacher evaluation workflow

Add one row per team and step to the private `Evaluation` sheet. Use `Published=TRUE` only when feedback is ready for students. Feedback for every step uses the same table; no new evaluation tab is needed. The step’s published evaluation appears after the team's next dashboard refresh.

Each published graded step also shows **Request a review of this grade**. Requests and evidence are saved in **Grade Review Requests**, along with the grade and feedback at request time. Filter column N to `PENDING`, record a faculty reply in O, enter its date in P and set N to `RESPONDED` or `CLOSED`. Update the Evaluation row separately when reassessment changes a grade. See `google-apps-script/GRADE-REVIEW-DEPLOYMENT.md` for the exact schema and tests.


## Final presentation schedule

Section 32 presents on 13 December 2026, 10:15-11:55 IST; Section 33 on 14 December 2026, 14:35-16:20 IST. Attendance is mandatory for every member; an absent student receives zero for the project presentation. Teams bring at most eight slides, with the university logo taken from the lecture PPTs, and finish within ten minutes. Project performance/presentation carries 25 marks; the other 25 are based on each student's assignment and quiz submissions. The 29 November Step 7 and 6 December Step 8 deadlines are unchanged. The reference deck and matching reading PDF contain the lecture logo.
