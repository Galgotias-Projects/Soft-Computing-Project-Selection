# Google Apps Script setup

The portal uses two private Google Sheets:

1. The existing **project tracker**, which stores reservations and calculates availability.
2. A separate **student directory**, containing approved Sections 32 and 33 students. Do not publish, share publicly, or commit this directory to GitHub.

## 1. Prepare the private student directory

Create a private spreadsheet that only the course coordinator can access. Its sheet must be named `Students` and use these exact headers in row 1:

```text
Full Name | Enrollment No/PRN | Admission Number | Section | Registration Status
```

Only `Approved` entries from `Section-32` and `Section-33` are accepted by the application. Keep the directory private; the portal never receives or downloads the full list.

## 2. Update the registration tracker

The `Registrations` sheet needs these headers, in this order:

```text
Submission ID | Submitted At | Status | Project ID | Project Title | Slot | Team Name |
Leader Name | Leader Email | Leader Admission Number | Leader Enrollment No/PRN | Leader Section | Leader GitHub | Leader Phone |
Member 2 Name | Member 2 Email | Member 2 Admission Number | Member 2 Enrollment No/PRN | Member 2 Section | Member 2 GitHub | Member 2 Phone |
Member 3 Name | Member 3 Email | Member 3 Admission Number | Member 3 Enrollment No/PRN | Member 3 Section | Member 3 GitHub | Member 3 Phone |
Member 4 Name | Member 4 Email | Member 4 Admission Number | Member 4 Enrollment No/PRN | Member 4 Section | Member 4 GitHub | Member 4 Phone |
Team Repository URL | Consent | Faculty Notes
```

Do not change `Project Capacity`; its formulas continue to count each `Reserved` row by project ID.

## 3. Configure and deploy the Apps Script

1. Open the tracker Sheet, then choose **Extensions → Apps Script**.
2. Replace the default file with [`Code.gs`](./Code.gs), then save it.
3. In `CONFIG`, replace:
   - `REPLACE_WITH_PRIVATE_STUDENT_DIRECTORY_ID` with the private student-directory spreadsheet ID (the value between `/d/` and `/edit` in its URL).
   - `REPLACE_WITH_A_LONG_RANDOM_SECRET` with a long random value.
4. Update the web-app deployment to a **new version**. Keep **Execute as** set to **Me** and **Who has access** set to **Anyone**. Use the `/exec` URL.

The private directory ID and the secret must never be committed to GitHub or placed in browser code.

## 4. Configure Netlify

In **Site configuration → Environment variables**, retain:

```text
APPS_SCRIPT_URL=<Apps Script /exec URL>
APPS_SCRIPT_SECRET=<same private secret as Code.gs>
```

Netlify forwards lookup and registration requests to Apps Script. The secret stays on the server; students cannot see it in the page source.

## What is verified

- A student starts by entering an Enrollment No./PRN or admission number.
- The portal fills their official full name and section only after a private-directory match.
- The Apps Script performs the same roster match again at reservation time, using both identifiers.
- Only approved students in Sections 32 and 33 are accepted.
- The system rejects a student, phone number, email address, or GitHub username already used in an active registration.
- Phone numbers must have exactly 10 digits; GitHub usernames are checked against GitHub before reservation.
- Email addresses are checked for valid syntax and duplicates. For stronger proof of mailbox ownership, enable an email-confirmation workflow separately before opening registration.
