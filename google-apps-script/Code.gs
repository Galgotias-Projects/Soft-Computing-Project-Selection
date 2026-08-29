const CONFIG = {
  registrations: 'Registrations',
  capacity: 'Project Capacity',
  studentDirectorySpreadsheetId: 'REPLACE_WITH_PRIVATE_STUDENT_DIRECTORY_ID',
  studentDirectorySheet: 'Students',
  secret: 'REPLACE_WITH_A_LONG_RANDOM_SECRET'
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;
const ENROLLMENT_PATTERN = /^\d{11}$/;
const ADMISSION_PATTERN = /^\d{2}[A-Z]{2,8}\d{5,8}$/;
const GITHUB_PATTERN = /^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?$/;
const PLACEHOLDER_PATTERN = /\b(test|demo|sample|dummy|unknown|none|n\/a)\b/i;
const ALLOWED_SECTIONS = new Set(['Section-32', 'Section-33']);

function doGet() {
  const rows = SpreadsheetApp.getActive().getSheetByName(CONFIG.capacity).getDataRange().getValues();
  return json({ projects: rows.slice(1).map(r => ({ id: r[0], title: r[1], max: Number(r[2]), reserved: Number(r[3]), remaining: Number(r[4]), availability: r[5] })) });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.secret !== CONFIG.secret) return json({ ok: false, error: 'Unauthorized' });
    if (body.action === 'lookupStudent') return json(lookupStudent(body.identifier));
    return json(registerTeam(body));
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'The registration service could not complete this request. Please contact the course coordinator.' });
  }
}

function lookupStudent(identifier) {
  const value = normaliseIdentifier(identifier);
  if (!ENROLLMENT_PATTERN.test(value) && !ADMISSION_PATTERN.test(value)) {
    return { ok: false, error: 'Enter a valid 11-digit Enrollment No./PRN or admission number.' };
  }

  const directory = getDirectoryIndex();
  const student = directory.byEnrollment.get(value) || directory.byAdmission.get(value);
  if (!student) {
    return { ok: false, error: 'This identifier is not in the approved Sections 32–33 directory.' };
  }

  return {
    ok: true,
    student: {
      fullName: student.fullName,
      enrollmentNumber: student.enrollmentNumber,
      admissionNumber: student.admissionNumber,
      section: student.section
    }
  };
}

function registerTeam(body) {
  const projectId = String(body.project || '').trim();
  const team = body.team;
  if (!projectId || !team || !Array.isArray(team.members) || team.members.length < 3 || team.members.length > 4) {
    return { ok: false, error: 'A complete team must contain 3 or 4 members.' };
  }

  const teamName = String(team.name || '').replace(/\s+/g, ' ').trim();
  if (teamName.length < 5 || PLACEHOLDER_PATTERN.test(teamName)) {
    return { ok: false, error: 'Enter a meaningful team name.' };
  }

  const submittedMembers = team.members.map(normaliseMember);
  const contactError = validateContactDetails(submittedMembers);
  if (contactError) return { ok: false, error: contactError };

  const rosterResult = verifyRosterMembers(submittedMembers);
  if (!rosterResult.ok) return rosterResult;
  const members = rosterResult.members;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActive();
    const capacity = ss.getSheetByName(CONFIG.capacity);
    const registrations = ss.getSheetByName(CONFIG.registrations);
    if (!capacity || !registrations) return { ok: false, error: 'The registration tracker is missing a required sheet.' };

    const capacityRows = capacity.getDataRange().getValues();
    const projectIndex = capacityRows.findIndex((row, index) => index && String(row[0]) === projectId);
    if (projectIndex < 1 || Number(capacityRows[projectIndex][4]) < 1) {
      return { ok: false, error: 'This project has just become full. Please select another project.' };
    }

    const registrationsRows = registrations.getDataRange().getValues();
    const existingDuplicate = findExistingDuplicate(registrationsRows, members);
    if (existingDuplicate) return { ok: false, error: existingDuplicate };

    const row = [Utilities.getUuid(), new Date(), 'Reserved', projectId, capacityRows[projectIndex][1], Number(capacityRows[projectIndex][3]) + 1, teamName];
    members.concat([{}, {}, {}, {}]).slice(0, 4).forEach(member => row.push(
      member.fullName || '',
      member.email || '',
      member.admissionNumber || '',
      member.enrollmentNumber || '',
      member.section || '',
      member.github || '',
      member.phone || ''
    ));
    row.push(String(team.repositoryUrl || '').trim(), team.consent ? 'Confirmed' : '', String(team.facultyNote || '').trim());
    registrations.appendRow(row);
    SpreadsheetApp.flush();
    return { ok: true, message: 'Your team slot is reserved.', project: projectId };
  } finally {
    lock.releaseLock();
  }
}

function normaliseMember(member) {
  return {
    enrollmentNumber: String(member.enrollmentNumber || '').replace(/\D/g, ''),
    admissionNumber: normaliseIdentifier(member.admissionNumber),
    email: String(member.email || '').trim().toLowerCase(),
    phone: String(member.phone || '').replace(/\D/g, ''),
    github: String(member.github || '').trim()
  };
}

function normaliseIdentifier(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function validateContactDetails(members) {
  if (members.some(member => !member.enrollmentNumber || !member.admissionNumber || !member.email || !member.phone || !member.github)) {
    return 'Every listed member needs a verified Enrollment No./PRN, admission number, email, phone number, and GitHub username.';
  }
  if (members.some(member => !ENROLLMENT_PATTERN.test(member.enrollmentNumber) || !ADMISSION_PATTERN.test(member.admissionNumber))) {
    return 'One or more official student identifiers is invalid.';
  }
  if (members.some(member => !EMAIL_PATTERN.test(member.email) || PLACEHOLDER_PATTERN.test(member.email))) {
    return 'Enter a valid, non-placeholder email address for every member.';
  }
  if (members.some(member => !PHONE_PATTERN.test(member.phone))) return 'Phone numbers must contain exactly 10 digits.';
  if (members.some(member => member.github.length < 2 || !GITHUB_PATTERN.test(member.github))) {
    return 'Enter a valid public GitHub username for every member.';
  }
  if (hasDuplicate(members.map(member => member.enrollmentNumber)) || hasDuplicate(members.map(member => member.admissionNumber))) {
    return 'The same student cannot appear more than once in a team.';
  }
  if (hasDuplicate(members.map(member => member.phone))) return 'A phone number cannot appear more than once in a team.';
  if (hasDuplicate(members.map(member => member.email))) return 'An email address cannot appear more than once in a team.';
  if (hasDuplicate(members.map(member => member.github))) return 'A GitHub username cannot appear more than once in a team.';
  return '';
}

function verifyRosterMembers(members) {
  const directory = getDirectoryIndex();
  const verified = [];

  for (const member of members) {
    const byEnrollment = directory.byEnrollment.get(member.enrollmentNumber);
    const byAdmission = directory.byAdmission.get(member.admissionNumber);
    if (!byEnrollment || !byAdmission || byEnrollment.admissionNumber !== byAdmission.admissionNumber) {
      return { ok: false, error: 'Each member must match one approved student in Sections 32–33 using both official identifiers.' };
    }
    verified.push({
      fullName: byEnrollment.fullName,
      enrollmentNumber: byEnrollment.enrollmentNumber,
      admissionNumber: byEnrollment.admissionNumber,
      section: byEnrollment.section,
      email: member.email,
      phone: member.phone,
      github: member.github
    });
  }
  return { ok: true, members: verified };
}

function getDirectoryIndex() {
  if (CONFIG.studentDirectorySpreadsheetId === 'REPLACE_WITH_PRIVATE_STUDENT_DIRECTORY_ID') {
    throw new Error('The private student directory has not been configured.');
  }

  const directorySpreadsheet = SpreadsheetApp.openById(CONFIG.studentDirectorySpreadsheetId);
  const sheet = directorySpreadsheet.getSheetByName(CONFIG.studentDirectorySheet);
  if (!sheet) throw new Error('The private student directory sheet is missing.');

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || [];
  const index = header => headers.indexOf(header);
  const fields = {
    fullName: index('Full Name'),
    enrollmentNumber: index('Enrollment No/PRN'),
    admissionNumber: index('Admission Number'),
    section: index('Section'),
    registrationStatus: index('Registration Status')
  };
  if (Object.keys(fields).some(key => fields[key] < 0)) {
    throw new Error('The private student directory has an unexpected header row.');
  }

  const byEnrollment = new Map();
  const byAdmission = new Map();
  values.slice(1).forEach(row => {
    const status = String(row[fields.registrationStatus] || '').trim();
    const section = String(row[fields.section] || '').trim();
    const enrollmentNumber = String(row[fields.enrollmentNumber] || '').replace(/\D/g, '');
    const admissionNumber = normaliseIdentifier(row[fields.admissionNumber]);
    const fullName = String(row[fields.fullName] || '').replace(/\s+/g, ' ').trim();
    if (status !== 'Approved' || !ALLOWED_SECTIONS.has(section) || !ENROLLMENT_PATTERN.test(enrollmentNumber) || !ADMISSION_PATTERN.test(admissionNumber) || !fullName) return;
    const student = { fullName, enrollmentNumber, admissionNumber, section };
    byEnrollment.set(enrollmentNumber, student);
    byAdmission.set(admissionNumber, student);
  });
  return { byEnrollment, byAdmission };
}

function hasDuplicate(values) {
  const cleaned = values.map(value => String(value).trim().toLowerCase());
  return new Set(cleaned).size !== cleaned.length;
}

function findExistingDuplicate(registrationsRows, members) {
  const headers = registrationsRows[0] || [];
  const statusIndex = headers.indexOf('Status');
  const fieldGroups = ['Leader', 'Member 2', 'Member 3', 'Member 4'].map(prefix => ({
    enrollment: headers.indexOf(prefix + ' Enrollment No/PRN'),
    admission: headers.indexOf(prefix + ' Admission Number'),
    phone: headers.indexOf(prefix + ' Phone'),
    email: headers.indexOf(prefix + ' Email'),
    github: headers.indexOf(prefix + ' GitHub')
  }));

  if (statusIndex < 0 || fieldGroups.some(group => Object.keys(group).some(key => group[key] < 0))) {
    return 'The registration tracker needs its updated verified-student columns before accepting submissions.';
  }

  const existing = { enrollment: new Set(), admission: new Set(), phone: new Set(), email: new Set(), github: new Set() };
  registrationsRows.slice(1).forEach(row => {
    const status = String(row[statusIndex] || '').trim().toLowerCase();
    if (status === 'cancelled' || status === 'expired') return;
    fieldGroups.forEach(group => {
      if (row[group.enrollment]) existing.enrollment.add(String(row[group.enrollment]).replace(/\D/g, ''));
      if (row[group.admission]) existing.admission.add(normaliseIdentifier(row[group.admission]));
      if (row[group.phone]) existing.phone.add(String(row[group.phone]).replace(/\D/g, ''));
      if (row[group.email]) existing.email.add(String(row[group.email]).trim().toLowerCase());
      if (row[group.github]) existing.github.add(String(row[group.github]).trim().toLowerCase());
    });
  });

  for (const member of members) {
    if (existing.enrollment.has(member.enrollmentNumber) || existing.admission.has(member.admissionNumber)) {
      return 'This student has already been used in a team registration.';
    }
    if (existing.phone.has(member.phone)) return 'This phone number has already been used in a team registration.';
    if (existing.email.has(member.email)) return 'This email address has already been used in a team registration.';
    if (existing.github.has(member.github.toLowerCase())) return 'This GitHub username has already been used in a team registration.';
  }
  return '';
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
