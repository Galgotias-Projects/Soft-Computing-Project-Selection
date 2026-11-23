# Grade-review requests

Students see **Request a review of this grade** below published feedback whenever a step has a grade, including 0/10 and future gradings. Ungraded steps do not show it.

The form records a reason, a 20–1500 character concern and an optional public HTTPS evidence link. It uses the existing team login. One request per team and step can be pending. A retry with the same request ID does not create a duplicate. Requests do not change grades or milestone submissions.

## Storage

Use the existing tracker tab **Grade Review Requests** with these exact A:Q headers:

Request ID | Requested At | Team ID | Team Name | Leader Admission Number | Project ID | Step | Submission Version | Request Type | Student Message | Evidence URL | Grade At Request | Evaluation Snapshot | Status | Faculty Response | Responded At | Client Request ID

No access code is stored in this tab. The grade and feedback snapshot preserve what was under review at request time. Students receive only their own team's requests and replies.

## Faculty workflow

1. Filter **Status (N)** to `PENDING`.
2. Read the concern in **J**, evidence in **K**, and grade snapshot in **L:M**.
3. Set `IN_REVIEW` while checking the work.
4. If the evaluation changes, update the existing team/step row in **Evaluation** and retain `Published=TRUE`.
5. Write a short reply in **Faculty Response (O)**, enter **Responded At (P)** and choose `RESPONDED` or `CLOSED` in **N**.
6. The requesting team sees the reply on its next dashboard refresh. A new concern may be submitted after a response or closure.

## Deployment and checks

The action `requestGradeReview` is routed through the existing `CentralPortal.gs`; `Code.gs`, permissions and the web-app URL remain unchanged. Add the tracker tab and headers first, save the tested source, then update the existing web-app deployment to a new version. Saving source alone does not update `/exec`.

Run the portal, presentation, status-colour and grade-review tests. Verify an actual dummy request, duplicate prevention, teacher reply visibility, zero-grade eligibility and an ungraded step. Delete only identified synthetic request and audit rows after testing. Do not use a real student's review request as disposable test data.
