'use client';

import { FormEvent, useState } from 'react';

const projects = [
  ['SC01', 'Campus Climate & Energy Controller', 'Fuzzy + GA', 'SC01-Intelligent-Campus-Climate-&-Energy-Controller.pdf'],
  ['SC02', 'Smart Washing Machine Optimizer', 'Fuzzy + GA', 'SC02-Smart-Washing-Machine-Decision-&-Resource-Optimizer.pdf'],
  ['SC03', 'Academic Intervention System', 'Perceptron + ADALINE + BPN', 'SC03-Student-Performance-&-Academic-Intervention-System.pdf'],
  ['SC04', 'Adaptive Traffic Control', 'Fuzzy + GA', 'SC04-Adaptive-Traffic-Signal-Optimization-System.pdf'],
  ['SC05', 'University Timetable Optimizer', 'Genetic Algorithm', 'SC05-University-Timetable-Optimization-Engine.pdf'],
  ['SC06', 'Campus Route Optimizer', 'Genetic Algorithm', 'SC06-Multi-Stop-Campus-Shuttle---Delivery-Route-Optimizer.pdf'],
  ['SC07', 'Smart Irrigation System', 'Fuzzy + ANN', 'SC07-Smart-Irrigation-&-Crop-Water-Management-System.pdf'],
  ['SC08', 'Predictive Maintenance System', 'ANN + Fuzzy', 'SC08-Machine-Predictive-Maintenance-&-Fault-Priority-System.pdf'],
  ['SC09', 'Credit Risk Decision Support', 'ANN + Fuzzy', 'SC09-Intelligent-Loan-Credit-Risk-Decision-Support-System.pdf'],
  ['SC10', 'Energy Demand & Appliance Scheduler', 'ANN + GA', 'SC10-Smart-Energy-Demand-&-Appliance-Scheduling-System.pdf'],
] as const;

const specificationsBase = 'https://github.com/Galgotias-Projects/Soft-Computing-Capstone-Projects/blob/main/project-briefs/';

type Project = (typeof projects)[number];
type Feedback = { kind: 'success' | 'error'; text: string };
type RegistrationResult = { ok?: boolean; error?: string };
type Student = {
  fullName: string;
  enrollmentNumber: string;
  admissionNumber: string;
  section: string;
};
type MemberData = Student & {
  identifier: string;
  email: string;
  phone: string;
  github: string;
  verified: boolean;
};
type MemberContactField = 'email' | 'phone' | 'github';

const EMPTY_MEMBER: MemberData = {
  identifier: '',
  fullName: '',
  enrollmentNumber: '',
  admissionNumber: '',
  section: '',
  email: '',
  phone: '',
  github: '',
  verified: false,
};

const PHONE_NUMBER = /^\d{10}$/;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GITHUB_USERNAME = /^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?$/;
const PLACEHOLDER = /\b(test|demo|sample|dummy|unknown|none|n\/a)\b/i;

function Member({
  index,
  member,
  required,
  lookingUp,
  onLookup,
  onIdentifierChange,
  onContactChange,
}: {
  index: number;
  member: MemberData;
  required: boolean;
  lookingUp: boolean;
  onLookup: () => void;
  onIdentifierChange: (value: string) => void;
  onContactChange: (field: MemberContactField, value: string) => void;
}) {
  const number = index + 1;
  const label = number === 1 ? 'Team leader' : `Member ${number}`;

  return (
    <fieldset>
      <legend>{label}{required ? ' *' : ' (optional)'}</legend>
      <label>
        Enrollment No./PRN or admission number
        <div className="lookup-row">
          <input
            value={member.identifier}
            onChange={(event) => onIdentifierChange(event.currentTarget.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="24131410010 or 24SCSE1410306"
            aria-label={`${label} enrollment or admission number`}
          />
          <button className="lookup" type="button" disabled={lookingUp || !member.identifier.trim()} onClick={onLookup}>
            {lookingUp ? 'Checking…' : 'Find student'}
          </button>
        </div>
      </label>

      {member.verified && (
        <>
          <p className="verified">Verified: {member.fullName} · {member.section}</p>
          <label>Full name<input value={member.fullName} readOnly /></label>
          <label>Admission number<input value={member.admissionNumber} readOnly /></label>
          <label>Enrollment No./PRN<input value={member.enrollmentNumber} readOnly /></label>
          <label>Section<input value={member.section} readOnly /></label>
          <label>Email<input value={member.email} type="email" required={required} placeholder="name@example.com" onChange={(event) => onContactChange('email', event.currentTarget.value)} /></label>
          <label>Phone number<input value={member.phone} required={required} inputMode="numeric" pattern="[0-9]{10}" title="Enter a 10-digit phone number" placeholder="10-digit phone number" onChange={(event) => onContactChange('phone', event.currentTarget.value.replace(/\D/g, '').slice(0, 10))} /></label>
          <label>GitHub username<input value={member.github} required={required} minLength={2} maxLength={39} pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?" title="Enter only your public GitHub username, not a profile link" placeholder="your-github-username" onChange={(event) => onContactChange('github', event.currentTarget.value.trim())} /></label>
        </>
      )}

      {!member.verified && <p className="lookup-help">Enter the official Enrollment No./PRN or admission number, then select <em>Find student</em>. Only approved students of Sections 32 and 33 can be added.</p>}
    </fieldset>
  );
}

export default function Home() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUp, setLookingUp] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberData[]>(() => Array.from({ length: 4 }, () => ({ ...EMPTY_MEMBER })));

  function updateMember(index: number, patch: Partial<MemberData>) {
    setMembers((current) => current.map((member, itemIndex) => itemIndex === index ? { ...member, ...patch } : member));
  }

  async function lookupStudent(index: number) {
    const identifier = members[index].identifier.trim();
    if (!identifier) return;

    setLookingUp(index);
    setFeedback(null);
    try {
      const response = await fetch('/.netlify/functions/student-lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; student?: Student };
      if (!response.ok || !result.ok || !result.student) throw new Error(result.error || 'Student could not be verified.');

      updateMember(index, { ...result.student, identifier, verified: true });
    } catch (error) {
      updateMember(index, { ...EMPTY_MEMBER, identifier });
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Student could not be verified.' });
    } finally {
      setLookingUp(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const teamName = String(data.get('teamName') || '').trim();
    const enteredMembers = members.filter((member) => member.verified || member.identifier.trim() || member.email || member.phone || member.github);
    const activeMembers = members.filter((member) => member.verified);
    const duplicate = (values: string[]) => new Set(values.map((value) => value.toLowerCase()).filter(Boolean)).size !== values.filter(Boolean).length;
    const invalidMember = activeMembers.find((member) => (
      !EMAIL_ADDRESS.test(member.email) || PLACEHOLDER.test(member.email) ||
      !PHONE_NUMBER.test(member.phone) ||
      !GITHUB_USERNAME.test(member.github) || member.github.length < 2
    ));

    if (PLACEHOLDER.test(teamName) || teamName.length < 5) {
      setFeedback({ kind: 'error', text: 'Enter a meaningful team name (not a test or placeholder name).' });
      return;
    }
    if (enteredMembers.some((member) => !member.verified)) {
      setFeedback({ kind: 'error', text: 'Verify every entered member from the official student directory before reserving a slot.' });
      return;
    }
    if (activeMembers.length < 3 || activeMembers.length > 4 || invalidMember) {
      setFeedback({ kind: 'error', text: 'A team needs 3–4 verified members, each with a valid email, 10-digit phone number, and public GitHub username.' });
      return;
    }
    if (duplicate(activeMembers.map((member) => member.enrollmentNumber)) || duplicate(activeMembers.map((member) => member.admissionNumber))) {
      setFeedback({ kind: 'error', text: 'The same student cannot be listed twice in a team.' });
      return;
    }
    if (duplicate(activeMembers.map((member) => member.phone))) {
      setFeedback({ kind: 'error', text: 'Each team member must have a different phone number.' });
      return;
    }
    if (duplicate(activeMembers.map((member) => member.email))) {
      setFeedback({ kind: 'error', text: 'Each team member must have a different email address.' });
      return;
    }
    if (duplicate(activeMembers.map((member) => member.github))) {
      setFeedback({ kind: 'error', text: 'Each team member must have a different GitHub username.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch('/.netlify/functions/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project: selectedProject[0],
          team: {
            name: teamName,
            members: activeMembers.map(({ identifier, verified, ...member }) => member),
            repositoryUrl: String(data.get('repositoryUrl') || '').trim(),
            facultyNote: String(data.get('facultyNote') || '').trim(),
            consent: data.get('consent') === 'on',
          },
        }),
      });
      const result = await response.json() as RegistrationResult;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to reserve the team slot.');

      form.reset();
      setMembers(Array.from({ length: 4 }, () => ({ ...EMPTY_MEMBER })));
      setFeedback({ kind: 'success', text: `${selectedProject[0]} has been reserved. Your verified team details are now recorded in the tracker.` });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to reserve the team slot. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <p className="tag">Galgotias University · 2026</p>
      <h1>Soft Computing Project Selection</h1>
      <p>Each team: 3–4 students · first come, first served · maximum 3 teams per project</p>

      <div className="grid">
        {projects.map((project) => (
          <section className="card" key={project[0]}>
            <b>{project[0]}</b>
            <h2>{project[1]}</h2>
            <p>{project[2]} · <span className="tag">3 team slots</span></p>
            <a href={specificationsBase + project[3]} target="_blank" rel="noreferrer">Read full specification ↗</a>
            <button onClick={() => { setSelectedProject(project); setFeedback(null); }}>Register team</button>
          </section>
        ))}
      </div>

      {selectedProject && (
        <div className="backdrop">
          <section className="form" aria-modal="true" role="dialog" aria-labelledby="registration-title">
            <button className="close" type="button" onClick={() => setSelectedProject(null)} aria-label="Close registration form">×</button>
            <p className="tag">Registering for {selectedProject[0]}</p>
            <h2 id="registration-title">{selectedProject[1]}</h2>
            <form onSubmit={submit}>
              <label>Team name *<input name="teamName" required placeholder="Example: Fuzzy Pioneers" /></label>
              <p className="form-note">Start each member with their Enrollment No./PRN or admission number. The system fills the official name and section from the private approved-student directory; the server verifies the same details again when you submit.</p>
              <Member index={0} member={members[0]} required lookingUp={lookingUp === 0} onLookup={() => lookupStudent(0)} onIdentifierChange={(identifier) => updateMember(0, { ...EMPTY_MEMBER, identifier })} onContactChange={(field, value) => updateMember(0, { [field]: value })} />
              <Member index={1} member={members[1]} required lookingUp={lookingUp === 1} onLookup={() => lookupStudent(1)} onIdentifierChange={(identifier) => updateMember(1, { ...EMPTY_MEMBER, identifier })} onContactChange={(field, value) => updateMember(1, { [field]: value })} />
              <Member index={2} member={members[2]} required lookingUp={lookingUp === 2} onLookup={() => lookupStudent(2)} onIdentifierChange={(identifier) => updateMember(2, { ...EMPTY_MEMBER, identifier })} onContactChange={(field, value) => updateMember(2, { [field]: value })} />
              <Member index={3} member={members[3]} required={false} lookingUp={lookingUp === 3} onLookup={() => lookupStudent(3)} onIdentifierChange={(identifier) => updateMember(3, { ...EMPTY_MEMBER, identifier })} onContactChange={(field, value) => updateMember(3, { [field]: value })} />
              <p className="form-note">Every public GitHub username is checked before reservation. Email addresses are checked for valid format and duplicate use; the official roster check prevents unapproved or vague student identities.</p>
              <label>Team repository URL (optional at registration)<input name="repositoryUrl" type="url" placeholder="https://github.com/..." /></label>
              <label>Faculty note (optional)<textarea name="facultyNote" rows={3} /></label>
              <label className="check"><input name="consent" required type="checkbox" /> I confirm that all listed members agree to this registration and have read the project specification.</label>
              <button type="submit" disabled={submitting}>{submitting ? 'Reserving…' : 'Reserve team slot'}</button>
            </form>
            {feedback && <p className={`message ${feedback.kind}`}>{feedback.text}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
