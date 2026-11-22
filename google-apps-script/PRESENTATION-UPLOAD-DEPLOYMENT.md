# Presentation uploads for Steps 7 and 8

Students upload one editable `.pptx`, no more than eight slides (including title,
hidden slides and appendices) and 10 MiB. They also keep a matching PDF reading
copy in their project repository. The portal does not accept legacy `.ppt` or
macro-enabled `.pptm` files.

## Storage and records

- `PresentationUpload.gs` stores files in the owner's private Google Drive folder
  `GU Capstone - Project Presentations`. It does not make the folder or files public.
- The folder ID is stored in the Apps Script property `PRESENTATION_FOLDER_ID`.
- `Milestone Submissions` retains its existing A:U columns. V:AA add the file URL,
  original filename, actual slide count, byte size, SHA256 and request ID.
- A successful resubmission adds a version and retains previous rows/files.
  Step 8 can explicitly reuse the team's previous presentation or upload a replacement.
- Retry IDs prevent duplicate uploads from repeating an already-recorded request.
- Rejected files create no Drive file. A newly created file is trashed if recording
  the submission fails. Previously recorded files are retained.

## Deployment order

1. Preserve the live project's configuration and existing secrets in `Code.gs`.
2. Apply the changes to `CentralPortal.gs` and add `PresentationUpload.gs`.
3. The owner reviews Google's new Drive authorization and runs
   `setupPresentationUploads()` from the Apps Script editor. This checks the
   destination headers before adding columns and creates the private folder.
4. Confirm the execution log reports success and V1:AA1 contain the six headers.
5. Update the existing web-app deployment to a new version, retaining its URL,
   execute-as-owner setting and existing access setting.
6. Publish the updated `central-portal` UI. Until setup/deployment is ready, the
   new UI disables only Steps 7 and 8 uploads; earlier steps remain available.
7. Verify with a synthetic team: missing upload, nine-slide rejection, valid upload,
   retry, replacement and Step 8 reuse. Verify the actual sheet and Drive files,
   then remove only synthetic rows and trash only test-created files.

The local test fixtures are synthetic and contain no student information. Run:

```text
node --test tests/central-portal.test.cjs tests/presentation-upload.test.cjs tests/presentation-ui.test.cjs
```

The local tests mock Apps Script services. They do not replace the live deployment
and cleanup checks above.
