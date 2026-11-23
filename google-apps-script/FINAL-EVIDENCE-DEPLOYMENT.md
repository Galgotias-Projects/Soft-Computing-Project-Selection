# Final project evidence - 23 November 2026

Steps 7 and 8 require a public UI/demo evidence URL and a demonstration type. Hosted applications link to the working UI. Local/desktop applications link to public interface evidence and run instructions or a demo video. Localhost and private network URLs are rejected.

Step 8 requires a specific LinkedIn project-post URL and three confirmations: the submitted GitHub project link, project description/results/limitation, and actual team/faculty/university credits. The service validates URL shape and records the student's confirmations. Faculty review the actual external post content.

PPTX upload stays required for Step 7 (1-8 slides, at most 10 MiB). Step 8 can reuse or replace the recorded deck. Its private Drive URL stays in column V. A separate optional public presentation reading-copy URL is accepted.

The original A:AA columns retain their meanings. Added columns:

| Column | Header | Purpose |
| --- | --- | --- |
| AB | Demo Mode | HOSTED or LOCAL_EVIDENCE |
| AC | Presentation Reference URL | Optional public PDF/PPTX reading link |
| AD | LinkedIn Post Checks | Required Step 8 content confirmations |

The final UI/demo URL uses existing column S, and the project-post URL uses existing column U. Existing submissions are retained; the new requirements apply to new versions.

Deploy the tested CentralPortal.gs as a new version of the existing web app, preserving the execute-as-owner/access settings and URL. Add the exact AB:AD headers before enabling the frontend. Dashboard capability checks keep final submissions disabled if the schema is not ready. Earlier milestone forms are independent of these fields.

Regression command:

```text
node --test tests/central-portal.test.cjs tests/presentation-upload.test.cjs tests/presentation-ui.test.cjs
```

The combined guide and reference project/PPT links appear on the public dashboard. All demonstration test records must be removed after live verification.
