const config = window.PORTAL_CONFIG || {};
const state = { admissionNumber: '', accessCode: '', dashboard: null, selectedStep: 'STEP_1' };
const $ = (selector) => document.querySelector(selector);

function message(selector, text, kind = 'error') {
  const element = $(selector); element.textContent = text; element.className = `message ${kind}`; element.hidden = !text;
}

function api(action, payload = {}) {
  if (!config.apiUrl || config.apiUrl.includes('PASTE_YOUR')) throw new Error('The portal is being configured. Please contact the course coordinator.');
  return new Promise((resolve, reject) => {
    const requestId = payload.requestId || (window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const frame = document.createElement('iframe');
    const form = document.createElement('form');
    const input = document.createElement('input');
    const timeout = window.setTimeout(() => finish(new Error('The portal service is taking longer than expected. Please check your dashboard before retrying.')), payload.presentation ? 120000 : 45000);

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
    form.hidden = true;
    input.type = 'hidden';
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

function dueText(item, feedback = {}) {
  if (feedback.published && feedback.status) return `Reviewed · ${String(feedback.status).replaceAll('_', ' ')}`;
  if (item.status === 'EVALUATED') return 'Evaluated';
  if (item.status === 'NEEDS_IMPROVEMENT') return 'Needs improvement';
  if (item.status === 'SUBMITTED_LATE') return `Submitted late · ${item.lateDays} day(s) overdue`;
  if (item.status === 'SUBMITTED') return 'Submitted · awaiting review';
  if (item.active === false) return 'Upcoming · not active yet';
  if (!item.hasDeadline) return item.accepting ? 'Open for submission' : 'Not active yet';
  return item.overdueDays > 0 ? `Overdue by ${item.overdueDays} day(s)` : `Due ${item.deadlineDisplay}`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function milestoneTone(item, feedback = {}) {
  // Upcoming deadlines retain the normal appearance, including unsubmitted work.
  if (item.active === false || !item.hasDeadline || !(Number(item.overdueDays) > 0)) return '';
  if (item.status === 'NOT_SUBMITTED') return 'status-missing';
  if (!feedback.published) return '';
  const status = String(feedback.status || '').trim().toLowerCase().replaceAll('_', ' ');
  if (/revision|improv|revise/.test(status)) return 'status-revision';
  if (/^(provisionally )?accepted$/.test(status)) return 'status-accepted';
  return '';
}

function renderGradeReview(data, feedback, step) {
  if(state.reviewStep!==step) {
    state.reviewStep=step;
    for(const id of ['grade-review-type','grade-review-concern','grade-review-evidence']) $('#'+id).value='';
    message('#grade-review-result','');
  }
  const graded=feedback.published && String(feedback.score ?? '').trim()!=='';
  $('#grade-review-panel').hidden=!graded;
  if(!graded) return;
  const service=data.gradeReviews || {ready:false,requests:[]};
  const requests=(service.requests || []).filter(r=>r.step===step);
  const pending=requests.some(r=>!['RESPONDED','CLOSED'].includes(String(r.status).toUpperCase()));
  $('#grade-review-form').hidden=pending;
  $('#send-grade-review').disabled=!service.ready;
  $('#grade-review-help').textContent=!service.ready
    ? 'Grade-review requests are being enabled. Refresh this page shortly.'
    : pending ? 'Your request is awaiting review. Check its status and the faculty reply below.'
    : 'Explain your concern, a question about the feedback, or the fixes you made. Add a link to the exact files or commit where possible. Faculty will review the evidence; sending a request does not change the grade automatically.';
  const labels={PENDING:'Pending review',IN_REVIEW:'Being reviewed',RESPONDED:'Faculty replied',CLOSED:'Closed'};
  $('#grade-review-history').innerHTML=requests.slice(0,5).map(r=>`<article class="review-request"><p><strong>${escapeHtml(labels[r.status] || 'Pending review')}</strong> · ${escapeHtml(r.requestedAt)} · ${escapeHtml(r.type)}</p><p>${escapeHtml(r.message)}</p>${r.evidenceUrl ? `<p><a href="${escapeHtml(r.evidenceUrl)}" target="_blank" rel="noopener">Supporting evidence</a></p>` : ''}<p>Grade when requested: ${escapeHtml(r.grade)} · Request ${escapeHtml(r.id)}</p>${r.response ? `<p><strong>Faculty reply:</strong> ${escapeHtml(r.response)}</p>` : ''}</article>`).join('');
}

function renderDashboard(data) {
  state.dashboard = data;
  $('#project-title').textContent = `${data.team.projectId} · ${data.team.projectTitle}`;
  $('#team-summary').textContent = `${data.team.teamName} · Leader: ${data.team.leaderName}`;
  $('#repository-url').value = ''; // Always require a fresh repository URL for the selected step.
  const timeline = $('#timeline'); timeline.innerHTML = '';
  data.milestones.forEach((item) => {
    const feedback = (data.evaluations || {})[item.step] || {};
    const button = document.createElement('button'); button.type = 'button'; button.className = `milestone ${milestoneTone(item, feedback)} ${item.step === state.selectedStep ? 'selected' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(dueText(item, (data.evaluations || {})[item.step]))}</span>`;
    button.addEventListener('click', () => { state.selectedStep = item.step; $('#submission-form').reset(); message('#submission-message', ''); renderDashboard(state.dashboard); });
    timeline.append(button);
  });
  const selected = data.milestones.find((item) => item.step === state.selectedStep) || data.milestones[0];
  state.selectedStep = selected.step;
  const needsPresentation = ['STEP_7','STEP_8'].includes(selected.step);
  const uploadReady = data.presentationUploads?.ready === true;
  $('#presentation-fields').hidden = !needsPresentation;
  $('#presentation-fields').disabled = !needsPresentation || !selected.accepting || !uploadReady;
  const existingPresentation = selected.presentation;
  $('#reuse-presentation-label').hidden = !existingPresentation;
  $('#reuse-presentation').checked = !!existingPresentation;
  $('#presentation-file').value = '';
  $('#presentation-file').disabled = !uploadReady || !selected.accepting || !!existingPresentation;
  $('#presentation-file').required = needsPresentation && uploadReady && !existingPresentation;
  $('#presentation-current').textContent = existingPresentation
    ? `Saved: ${existingPresentation.name} · ${existingPresentation.slides} slide(s) · from ${existingPresentation.sourceStep.replace('_',' ')}. Keep it selected to reuse, or untick to replace it.`
    : 'Upload the editable PowerPoint for Step 7. For Step 8, you can reuse the Step 7 deck or upload a revised one.';
  $('#presentation-service').textContent = needsPresentation && !uploadReady ? 'PowerPoint uploads are being configured. Please try again later.' : '';
  $('#presentation-service').hidden = !needsPresentation || uploadReady;
  const finalReady = data.finalEvidence?.ready === true;
  $('#final-evidence-fields').hidden = !needsPresentation;
  $('#final-evidence-fields').disabled = !needsPresentation || !selected.accepting || !finalReady;
  $('#final-demo-mode').value = selected.demoMode || '';
  $('#final-demo-url').value = selected.demoUrl || '';
  $('#presentation-reference-url').value = selected.presentationReferenceUrl || '';
  for (const id of ['repository','description','credits']) $('#linkedin-check-'+id).checked = false;
  if(needsPresentation && !finalReady) { $('#presentation-service').textContent = 'The final-step form is being updated. Refresh this page shortly.'; $('#presentation-service').hidden=false; }
  const isProduct = selected.step === 'STEP_5';
  $('#product-fields').hidden = !isProduct;
  $('#product-fields').disabled = !isProduct || !selected.accepting;
  $('#step-expectations').hidden = !isProduct;
  const hasLinkedInField = selected.step === 'STEP_8' && typeof selected.linkedinPostUrl === 'string';
  $('#linkedin-fields').hidden = !hasLinkedInField;
  $('#linkedin-fields').disabled = !hasLinkedInField || !selected.accepting || !finalReady;
  $('#linkedin-post-url').value = hasLinkedInField ? selected.linkedinPostUrl : '';
  $('#selected-step').value = selected.step;
  $('#submission-heading').textContent = `Submit or update ${selected.label}`;
  $('#submission-help').textContent = selected.blockedReason || (selected.accepting
    ? (selected.status === 'NOT_SUBMITTED' ? 'Submit your first version.' : 'A new submission replaces the visible version while preserving the earlier version for the teacher.')
    : (selected.active === false ? 'This milestone is planned. Submissions will open later.' : 'Submissions are currently unavailable for this step.'));
  $('#submit-work').disabled = !selected.accepting || (needsPresentation && (!uploadReady || !finalReady));
  $('#deadline-notes').innerHTML = data.milestones.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.deadlineDisplay)}${item.hasDeadline ? ' IST' : ''}. ${item.accepting ? 'Submissions open.' : escapeHtml(item.blockedReason || 'Submissions unavailable.')}</li>`).join('');
  const feedback = (data.evaluations || {})[selected.step] || {};
  $('#evaluation').className = milestoneTone(selected, feedback);
  $('#evaluation').innerHTML = feedback.published
    ? `<p class="status ${escapeHtml(String(feedback.status || '').toLowerCase())}">${escapeHtml(String(feedback.status || '').replaceAll('_', ' '))}${feedback.score ? ` · ${escapeHtml(feedback.score)}` : ''}</p><p><b>Expected:</b> ${escapeHtml(String(feedback.comment || '—').replace(/^Expected:\s*/i, ''))}</p><p><b>What is done:</b> ${escapeHtml(feedback.good || '—')}</p><p><b>What needs attention:</b> ${escapeHtml(feedback.improve || '—')}</p><p><b>Required action:</b> ${escapeHtml(feedback.nextAction || '—')}</p>`
    : `<p>No evaluation has been published for ${escapeHtml(selected.label)} yet.</p>`;
  renderGradeReview(data, feedback, selected.step);
}

$('#grade-review-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button=$('#send-grade-review');
  if(button.disabled) return;
  const concern=$('#grade-review-concern').value.trim();
  if(concern.length<20 || concern.length>1500) return message('#grade-review-result','Explain your concern or changes in 20 to 1500 characters.');
  button.disabled=true;button.textContent='Sending request…';
  const step=state.selectedStep,reviewType=$('#grade-review-type').value,evidenceUrl=$('#grade-review-evidence').value.trim();
  const signature=JSON.stringify([step,reviewType,concern,evidenceUrl]);
  if(state.reviewSignature!==signature) {
    state.reviewSignature=signature;
    state.reviewRequestId=window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  try {
    const result=await api('requestGradeReview',{admissionNumber:state.admissionNumber,accessCode:state.accessCode,step,reviewType,concern,evidenceUrl,scoreAtView:state.dashboard?.evaluations?.[step]?.score,requestId:state.reviewRequestId});
    state.reviewSignature='';state.reviewRequestId='';
    $('#grade-review-form').reset();
    state.selectedStep=step;
    renderDashboard(result.dashboard);
    message('#grade-review-result',result.message,'success');
  } catch(error){message('#grade-review-result',error.message);}
  finally{button.textContent='Send review request';button.disabled=state.dashboard?.gradeReviews?.ready!==true;}
});

$('#refresh-dashboard').addEventListener('click', async () => {
  const button=$('#refresh-dashboard');button.disabled=true;
  message('#dashboard-message','Checking the latest grades and replies…','success');
  try {
    const result=await api('portalLookup',{admissionNumber:state.admissionNumber,accessCode:state.accessCode});
    renderDashboard(result.dashboard);
    message('#dashboard-message','Dashboard updated.','success');
  } catch(error){message('#dashboard-message',error.message);}
  finally{button.disabled=false;}
});

$('#lookup-form').addEventListener('submit', async (event) => {
  event.preventDefault(); message('#lookup-message', 'Retrieving team details…', 'success');
  const submitButton = $('#open-dashboard'); submitButton.disabled = true; submitButton.textContent = 'Retrieving…';
  state.admissionNumber = $('#admission-number').value.trim().replace(/\s/g, '').toUpperCase(); state.accessCode = $('#access-code').value.trim();
  try { const result = await api('portalLookup', state); $('#submission-form').reset(); message('#submission-message', ''); state.selectedStep = 'STEP_1'; $('#lookup-card').hidden = true; $('#dashboard').hidden = false; renderDashboard(result.dashboard); }
  catch (error) { message('#lookup-message', error.message); }
  finally { submitButton.disabled = false; submitButton.textContent = 'Open my dashboard'; }
});

$('#submission-form').addEventListener('submit', async (event) => {
  event.preventDefault(); message('#submission-message', '');
  const button = $('#submit-work');
  if (button.disabled) return;
  button.disabled = true; button.textContent = 'Submitting…';
  try {
    const needsPresentation = ['STEP_7','STEP_8'].includes(state.selectedStep);
    const reusePresentation = needsPresentation && $('#reuse-presentation').checked;
    let presentation;
    const file = needsPresentation && !reusePresentation ? $('#presentation-file').files[0] : null;
    if (needsPresentation && !reusePresentation) {
      if (!file || !/\.pptx$/i.test(file.name)) throw new Error('Choose a PowerPoint .pptx file.');
      if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a PowerPoint file of at most 10 MB.');
      button.textContent = 'Preparing presentation…';
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The file could not be read. Choose it again.'));
        reader.readAsDataURL(file);
      });
      presentation = {name:file.name,base64:String(dataUrl).split(',')[1]};
      button.textContent = 'Uploading presentation…';
    }
    const productEvidence = state.selectedStep === 'STEP_5' ? {
      branch: $('#product-branch').value.trim(), interfaceType: $('#interface-type').value,
      entryPoint: $('#entry-point').value.trim(), runCommand: $('#run-command').value.trim(),
      reportPath: $('#report-path').value.trim(), demoUrl: $('#demo-url').value.trim(),
      checks: { inference: $('#check-inference').checked, validation: $('#check-validation').checked,
        output: $('#check-output').checked, documentation: $('#check-documentation').checked }
    } : undefined;
    const linkedinPostUrl = $('#linkedin-fields').disabled ? undefined : $('#linkedin-post-url').value.trim();
    const finalEvidence = needsPresentation ? {demoMode:$('#final-demo-mode').value,demoUrl:$('#final-demo-url').value.trim(),presentationReferenceUrl:$('#presentation-reference-url').value.trim()} : undefined;
    const linkedinChecks = state.selectedStep==='STEP_8' ? {repository:$('#linkedin-check-repository').checked,description:$('#linkedin-check-description').checked,credits:$('#linkedin-check-credits').checked} : undefined;
    if(needsPresentation && (!finalEvidence.demoMode || !finalEvidence.demoUrl)) throw new Error('Choose your demonstration type and enter the public UI or demo evidence link.');
    if(state.selectedStep==='STEP_8' && (!linkedinPostUrl || !Object.values(linkedinChecks).every(v=>v===true))) throw new Error('Add your project LinkedIn post URL and confirm its GitHub link, description and credits.');
    const signature = JSON.stringify([finalEvidence,linkedinChecks,state.selectedStep,$('#repository-url').value.trim(),$('#submission-note').value.trim(),linkedinPostUrl,reusePresentation,file?.name,file?.size,file?.lastModified]);
    if (state.pendingSignature !== signature) {
      state.pendingSignature = signature;
      state.pendingRequestId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    const result = await api('submitMilestone', { admissionNumber: state.admissionNumber, accessCode: state.accessCode, step: state.selectedStep, repositoryUrl: $('#repository-url').value.trim(), note: $('#submission-note').value.trim(), productEvidence, finalEvidence, linkedinPostUrl, linkedinChecks, presentation, reusePresentation, requestId:state.pendingRequestId });
    state.pendingSignature = ''; state.pendingRequestId = '';
    message('#submission-message', result.message, 'success'); renderDashboard(result.dashboard);
  } catch (error) { message('#submission-message', error.message); }
  finally { button.textContent = 'Submit work'; button.disabled = !(state.dashboard?.milestones.find((item) => item.step === state.selectedStep)?.accepting) || (['STEP_7','STEP_8'].includes(state.selectedStep) && (!state.dashboard?.presentationUploads?.ready || !state.dashboard?.finalEvidence?.ready)); }
});

$('#reuse-presentation').addEventListener('change', () => {
  const reuse = $('#reuse-presentation').checked;
  $('#presentation-file').disabled = reuse;
  $('#presentation-file').required = !reuse;
  if (reuse) $('#presentation-file').value = '';
});
$('#sign-out').addEventListener('click', () => { $('#dashboard').hidden = true; $('#lookup-card').hidden = false; $('#lookup-form').reset(); $('#submission-form').reset(); $('#grade-review-form').reset(); message('#lookup-message', ''); message('#submission-message', ''); message('#grade-review-result',''); state.reviewStep='';state.reviewSignature='';state.reviewRequestId=''; state.admissionNumber = ''; state.accessCode = ''; state.selectedStep = 'STEP_1'; state.dashboard = null; });

