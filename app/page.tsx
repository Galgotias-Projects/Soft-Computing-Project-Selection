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

function Member({ n, required = true }: { n: number; required?: boolean }) {
  return (
    <fieldset>
      <legend>{n === 1 ? 'Team leader' : `Member ${n}`}{required ? ' *' : ' (optional)'}</legend>
      <label>Full name<input name={`member${n}Name`} required={required} /></label>
      <label>University email<input name={`member${n}Email`} type="email" required={required} /></label>
      <label>Student ID<input name={`member${n}StudentId`} required={required} /></label>
      <label>GitHub username<input name={`member${n}Github`} required={required} /></label>
    </fieldset>
  );
}

export default function Home() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const members = [1, 2, 3, 4]
      .map((number) => ({
        name: String(data.get(`member${number}Name`) || '').trim(),
        email: String(data.get(`member${number}Email`) || '').trim(),
        studentId: String(data.get(`member${number}StudentId`) || '').trim(),
        github: String(data.get(`member${number}Github`) || '').trim(),
      }))
      .filter((member) => member.name || member.email || member.studentId || member.github);

    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch('/.netlify/functions/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project: selectedProject[0],
          team: {
            name: String(data.get('teamName') || '').trim(),
            members,
            repositoryUrl: String(data.get('repositoryUrl') || '').trim(),
            facultyNote: String(data.get('facultyNote') || '').trim(),
            consent: data.get('consent') === 'on',
          },
        }),
      });
      const result = await response.json() as RegistrationResult;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to reserve the team slot.');

      form.reset();
      setFeedback({ kind: 'success', text: `${selectedProject[0]} has been reserved. Your details are now recorded in the tracker.` });
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
              <Member n={1} />
              <Member n={2} />
              <Member n={3} />
              <Member n={4} required={false} />
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
