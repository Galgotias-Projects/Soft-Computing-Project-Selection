const API_BASE = window.location.origin;
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
