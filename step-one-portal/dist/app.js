const API_BASE = 'https://guaisc.netlify.app';
const DEADLINE = Date.parse('2026-09-26T23:59:59+05:30');
const CLOSED_MESSAGE = 'The Step 1 submission deadline has passed. Please contact the course coordinator.';

const form = document.querySelector('#submission-form');
const admissionInput = document.querySelector('#admission-number');
const repositoryInput = document.querySelector('#repository-url');
const lookupButton = document.querySelector('#lookup-button');
const submitButton = document.querySelector('#submit-button');
const detailPanel = document.querySelector('#team-details');
const feedback = document.querySelector('#feedback');
const deadline = document.querySelector('#deadline');
let verifiedTeam = null;

function isClosed() {
  return Date.now() > DEADLINE;
}

function showFeedback(text, kind = 'error') {
  feedback.textContent = text;
  feedback.className = `feedback ${kind}`;
  feedback.hidden = false;
}

function clearFeedback() {
  feedback.textContent = '';
  feedback.hidden = true;
}

function setBusy(button, busy, busyLabel) {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy || isClosed();
  button.textContent = busy ? busyLabel : button.dataset.label;
}

function clearTeam() {
  verifiedTeam = null;
  detailPanel.hidden = true;
  repositoryInput.disabled = true;
  submitButton.disabled = true;
}

function showTeam(team) {
  verifiedTeam = team;
  document.querySelector('#leader-name').textContent = team.leaderName;
  document.querySelector('#team-name').textContent = team.teamName;
  document.querySelector('#project-name').textContent = `${team.projectId} · ${team.projectTitle}`;
  detailPanel.hidden = false;
  repositoryInput.disabled = false;
  submitButton.disabled = isClosed();
}

function applyDeadlineState() {
  if (!isClosed()) return;
  deadline.classList.add('closed');
  deadline.innerHTML = '<strong>Step 1 submissions are closed</strong><span>The deadline was 26 September 2026, 11:59 PM IST. New submissions are not accepted.</span>';
  admissionInput.disabled = true;
  lookupButton.disabled = true;
  repositoryInput.disabled = true;
  submitButton.disabled = true;
}

async function parseResponse(response) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The submission service returned an invalid response. Please try again.');
  }
  if (!response.ok || !result.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

async function findTeam() {
  if (isClosed()) return showFeedback(CLOSED_MESSAGE);
  const admissionNumber = admissionInput.value.trim().replace(/\s/g, '').toUpperCase();
  admissionInput.value = admissionNumber;
  clearFeedback();
  clearTeam();
  if (!admissionNumber) return showFeedback('Enter the team leader’s admission number first.');

  setBusy(lookupButton, true, 'Checking…');
  try {
    const response = await fetch(`${API_BASE}/.netlify/functions/stepone-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ admissionNumber }),
    });
    const result = await parseResponse(response);
    showTeam(result.team);
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'The team could not be verified.');
  } finally {
    setBusy(lookupButton, false, 'Checking…');
  }
}

lookupButton.addEventListener('click', findTeam);
admissionInput.addEventListener('input', () => { clearTeam(); clearFeedback(); });
admissionInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); findTeam(); } });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isClosed()) return showFeedback(CLOSED_MESSAGE);
  if (!verifiedTeam) return showFeedback('First verify the team leader’s admission number.');
  if (!repositoryInput.value.trim()) return showFeedback('Enter the public GitHub repository URL.');

  clearFeedback();
  setBusy(submitButton, true, 'Submitting…');
  try {
    const response = await fetch(`${API_BASE}/.netlify/functions/stepone-submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ admissionNumber: verifiedTeam.admissionNumber, repositoryUrl: repositoryInput.value.trim() }),
    });
    const result = await parseResponse(response);
    showFeedback(result.message || 'Your Step 1 repository has been submitted.', 'success');
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'The submission could not be completed.');
  } finally {
    setBusy(submitButton, false, 'Submitting…');
  }
});

applyDeadlineState();
window.setInterval(applyDeadlineState, 30_000);
