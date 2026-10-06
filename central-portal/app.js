const config = window.PORTAL_CONFIG || {};
const state = { admissionNumber: '', accessCode: '', dashboard: null, selectedStep: 'STEP_1' };
const $ = (selector) => document.querySelector(selector);

function message(selector, text, kind = 'error') {
  const element = $(selector); element.textContent = text; element.className = `message ${kind}`; element.hidden = !text;
}

function api(action, payload = {}) {
  if (!config.apiUrl || config.apiUrl.includes('PASTE_YOUR')) throw new Error('The portal is being configured. Please contact the course coordinator.');
  return new Promise((resolve, reject) => {
    const requestId = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const frame = document.createElement('iframe');
    const form = document.createElement('form');
    const input = document.createElement('input');
    const timeout = window.setTimeout(() => finish(new Error('The portal service is taking longer than expected. Please retry.')), 30000);

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
      form.remove();
      frame.remove();
    }
    function finish(error, result) {
      cleanup();
      if (error) reject(error); else resolve(result);
    }
    function receive(event) {
      const data = event.data;
      if (!data || data.source !== 'gu-central-portal' || data.requestId !== requestId) return;
      const result = data.result || {};
      if (!result.ok) return finish(new Error(result.error || 'The portal service could not complete this request.'));
      finish(null, result);
    }

    frame.name = `portal-transport-${requestId}`;
    frame.hidden = true;
    form.method = 'post';
    form.action = config.apiUrl;
    form.target = frame.name;
    input.name = 'payload';
    input.value = JSON.stringify({ action, ...payload, transport: 'iframe', origin: window.location.origin, requestId });
    form.append(input);
    document.body.append(frame, form);
    window.addEventListener('message', receive);
    form.submit();
  });
}

function dueText(item) {
  if (item.status === 'EVALUATED') return 'Evaluated';
  if (item.status === 'NEEDS_IMPROVEMENT') return 'Needs improvement';
  if (item.status === 'SUBMITTED_LATE') return `Submitted late · ${item.lateDays} day(s) overdue`;
  if (item.status === 'SUBMITTED') return 'Submitted · awaiting review';
  if (!item.hasDeadline) return item.accepting ? 'Open for submission' : 'Not active yet';
  return item.overdueDays > 0 ? `Overdue by ${item.overdueDays} day(s)` : `Due ${item.deadlineDisplay}`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function renderDashboard(data) {
  state.dashboard = data;
  $('#project-title').textContent = `${data.team.projectId} · ${data.team.projectTitle}`;
  $('#team-summary').textContent = `${data.team.teamName} · Leader: ${data.team.leaderName}`;
  $('#repository-url').value = ''; // Always require a fresh repository URL for the selected step.
  const timeline = $('#timeline'); timeline.innerHTML = '';
  data.milestones.forEach((item) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `milestone ${item.step === state.selectedStep ? 'selected' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(dueText(item))}</span>`;
    button.addEventListener('click', () => { state.selectedStep = item.step; renderDashboard(state.dashboard); });
    timeline.append(button);
  });
  const selected = data.milestones.find((item) => item.step === state.selectedStep) || data.milestones[0];
  state.selectedStep = selected.step;
  $('#selected-step').value = selected.step;
  $('#submission-heading').textContent = `Submit or update ${selected.label}`;
  $('#submission-help').textContent = selected.accepting
    ? (selected.status === 'NOT_SUBMITTED' ? 'Submit your first version.' : 'A new submission replaces the visible version while preserving the earlier version for the teacher.')
    : 'This deadline has passed. Submissions are currently closed for this step.';
  $('#submit-work').disabled = !selected.accepting;
  const feedback = (data.evaluations || {})[selected.step] || {};
  $('#evaluation').innerHTML = feedback.published
    ? `<p class="status ${escapeHtml(String(feedback.status || '').toLowerCase())}">${escapeHtml(String(feedback.status || '').replaceAll('_', ' '))}${feedback.score ? ` · ${escapeHtml(feedback.score)}` : ''}</p><p><b>Comment:</b> ${escapeHtml(feedback.comment || '—')}</p><p><b>What is good:</b> ${escapeHtml(feedback.good || '—')}</p><p><b>Improve next:</b> ${escapeHtml(feedback.improve || '—')}</p><p><b>Required action:</b> ${escapeHtml(feedback.nextAction || '—')}</p>`
    : `<p>No evaluation has been published for ${escapeHtml(selected.label)} yet.</p>`;
}

$('#lookup-form').addEventListener('submit', async (event) => {
  event.preventDefault(); message('#lookup-message', 'Retrieving team details…', 'success');
  const submitButton = $('#open-dashboard'); submitButton.disabled = true; submitButton.textContent = 'Retrieving…';
  state.admissionNumber = $('#admission-number').value.trim().replace(/\s/g, '').toUpperCase(); state.accessCode = $('#access-code').value.trim();
  try { const result = await api('portalLookup', state); $('#lookup-card').hidden = true; $('#dashboard').hidden = false; renderDashboard(result.dashboard); }
  catch (error) { message('#lookup-message', error.message); }
  finally { submitButton.disabled = false; submitButton.textContent = 'Open my dashboard'; }
});

$('#submission-form').addEventListener('submit', async (event) => {
  event.preventDefault(); message('#submission-message', '');
  try {
    const result = await api('submitMilestone', { admissionNumber: state.admissionNumber, accessCode: state.accessCode, step: state.selectedStep, repositoryUrl: $('#repository-url').value.trim(), note: $('#submission-note').value.trim() });
    message('#submission-message', result.message, 'success'); renderDashboard(result.dashboard);
  } catch (error) { message('#submission-message', error.message); }
});

$('#sign-out').addEventListener('click', () => { $('#dashboard').hidden = true; $('#lookup-card').hidden = false; $('#lookup-form').reset(); state.dashboard = null; });
