const PORTAL = {
  teams: 'Portal Teams', submissions: 'Milestone Submissions', evaluations: 'Evaluation', evaluationsStep1: 'Evaluation Step 1',
  settings: 'Portal Settings', audit: 'Portal Audit'
};

const PORTAL_HEADERS = {
  teams: ['Team ID','Leader Admission Number','Leader Name','Team Name','Project ID','Project Name','Access Code','Active'],
  submissions: ['Submission ID','Team ID','Step','Version','Latest','Submitted At','Deadline','Late Days','Repository URL','Commit URL','Note','Status','Submitted By','Branch','Interface Type','Entry Point','Run Command','Report Path','Demo URL','Evidence Checks','LinkedIn Post URL'],
  evaluations: ['Team ID','Step','Status','Score','Comment','What Is Good','What To Improve','Next Action','Published','Evaluated On'],
  settings: ['Key','Value'], audit: ['Timestamp','Team ID','Action','Detail']
};
const PORTAL_DEFAULT_SETTINGS = [
  ['STEP_1_DEADLINE','2026-09-26T23:59:59+05:30'], ['STEP_1_ACCEPT_LATE','TRUE'],
  ['STEP_2_DEADLINE','2026-10-04T23:59:59+05:30'], ['STEP_2_ACCEPT_LATE','TRUE'],
  ['STEP_3_DEADLINE','2026-10-12T23:59:59+05:30'], ['STEP_3_ACCEPT_LATE','TRUE'], ['STEP_3_ACTIVE','TRUE'],
  ['STEP_4_DEADLINE','2026-10-20T23:59:59+05:30'], ['STEP_4_ACCEPT_LATE','TRUE'], ['STEP_4_ACTIVE','TRUE'],
  ['STEP_5_DEADLINE','2026-11-08T23:59:59+05:30'], ['STEP_5_ACCEPT_LATE','TRUE'], ['STEP_5_ACTIVE','TRUE'],
  ['STEP_6_DEADLINE','2026-11-22T23:59:59+05:30'], ['STEP_6_ACCEPT_LATE','TRUE'], ['STEP_6_ACTIVE','FALSE'],
  ['STEP_7_DEADLINE','2026-11-29T23:59:59+05:30'], ['STEP_7_ACCEPT_LATE','TRUE'], ['STEP_7_ACTIVE','FALSE'],
  ['STEP_8_DEADLINE','2026-12-06T23:59:59+05:30'], ['STEP_8_ACCEPT_LATE','TRUE'], ['STEP_8_ACTIVE','FALSE']
];
const PORTAL_STEPS = ['STEP_1','STEP_2','STEP_3','STEP_4','STEP_5','STEP_6','STEP_7','STEP_8'];
function portalPreviousStep(step) { const index=PORTAL_STEPS.indexOf(step); return index>0?PORTAL_STEPS[index-1]:null; }

function isCentralPortalAction(action) { return ['portalLookup','submitMilestone','requestGradeReview'].indexOf(action) >= 0; }

function setupCentralPortal() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(PORTAL_HEADERS).forEach(key => {
    const sheet = ss.getSheetByName(PORTAL[key]) || ss.insertSheet(PORTAL[key]);
    if (sheet.getLastRow() === 0) sheet.appendRow(PORTAL_HEADERS[key]);
    sheet.setFrozenRows(1);
  });
  const settings = ss.getSheetByName(PORTAL.settings);
  const existing = settings.getLastRow() < 2 ? new Set() : new Set(settings.getRange(2, 1, settings.getLastRow() - 1, 1).getDisplayValues().flat());
  const missing = PORTAL_DEFAULT_SETTINGS.filter(([key]) => !existing.has(key));
  if (missing.length) settings.getRange(settings.getLastRow() + 1, 1, missing.length, 2).setValues(missing);
  return 'Portal sheets created. Next run syncPortalTeams(), then share access codes privately.';
}

function syncPortalTeams() {
  const ss = SpreadsheetApp.getActive();
  const registrations = ss.getSheetByName(CONFIG.registrations).getDataRange().getDisplayValues();
  const h = registrations[0], ix = name => h.indexOf(name);
  const required = ['Status','Project ID','Project Title','Team Name','Leader Name','Leader Admission Number'];
  if (required.some(name => ix(name) < 0)) throw new Error('Registrations headers do not match the expected tracker.');
  const teams = ss.getSheetByName(PORTAL.teams), existing = teams.getDataRange().getDisplayValues();
  const known = new Set(existing.slice(1).map(row => normaliseIdentifier(row[1])));
  registrations.slice(1).forEach(row => {
    const status = String(row[ix('Status')]).toLowerCase(); const admission = normaliseIdentifier(row[ix('Leader Admission Number')]);
    if (!admission || status === 'cancelled' || status === 'expired' || known.has(admission)) return;
    teams.appendRow([Utilities.getUuid(), admission, row[ix('Leader Name')], row[ix('Team Name')], row[ix('Project ID')], row[ix('Project Title')], String(Math.floor(100000 + Math.random()*900000)), 'TRUE']);
  });
  return 'Teams synchronised. Access codes are visible only to the coordinator in Portal Teams.';
}

function centralPortalDispatch(body) {
  const admission = normaliseIdentifier(body.admissionNumber), code = String(body.accessCode || '').trim();
  const team = portalTeam(admission, code); if (!team.ok) return team;
  if (body.action === 'portalLookup') return { ok:true, dashboard: portalDashboard(team.team) };
  if (body.action === 'submitMilestone') return submitPortalMilestone(team.team, body);
  if (body.action === 'requestGradeReview') return submitGradeReview(team.team, body);
  return { ok:false, error:'Unsupported portal request.' };
}

function portalTeam(admission, code) {
  if (!ADMISSION_PATTERN.test(admission) || !/^\d{6}$/.test(code)) return {ok:false,error:'Enter the registered leader admission number and six-digit team access code.'};
  const rows = SpreadsheetApp.getActive().getSheetByName(PORTAL.teams).getDataRange().getDisplayValues(), h=rows[0], ix=n=>h.indexOf(n);
  const row = rows.slice(1).find(r => normaliseIdentifier(r[ix('Leader Admission Number')])===admission && String(r[ix('Access Code')])===code && String(r[ix('Active')]).toUpperCase()==='TRUE');
  if (!row) return {ok:false,error:'The admission number or access code is not valid for an active allocated team.'};
  return {ok:true,team:{id:row[ix('Team ID')],admissionNumber:admission,leaderName:row[ix('Leader Name')],teamName:row[ix('Team Name')],projectId:row[ix('Project ID')],projectTitle:row[ix('Project Name')]}};
}

function portalSettings() { const rows=SpreadsheetApp.getActive().getSheetByName(PORTAL.settings).getDataRange().getDisplayValues(); return Object.fromEntries(rows.slice(1).map(r=>[r[0],r[1]])); }
function stepLabel(step) { return step.replace('STEP_', 'Step '); }
function stepConfiguration(settings, step) {
  const deadlineValue = String(settings[step + '_DEADLINE'] || '').trim();
  const deadline = deadlineValue ? new Date(deadlineValue) : null;
  const hasDeadline = deadline && !isNaN(deadline.getTime());
  const active = String(settings[step + '_ACTIVE'] || (PORTAL_STEPS.indexOf(step)<5?'TRUE':'FALSE')).toUpperCase() === 'TRUE';
  return { deadline, hasDeadline, active, acceptLate: String(settings[step + '_ACCEPT_LATE'] || 'FALSE').toUpperCase() === 'TRUE' };
}

// Step 1 was collected before the central portal existed. Read the original
// tracker as a fallback so already-submitted teams see their true status,
// without duplicating or altering the original tracker records.
function legacyStepOneSubmission(team) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Step 1 Submissions');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getDataRange().getDisplayValues(), h = rows[0], ix = n => h.indexOf(n);
  const matches = rows.slice(1).filter(r => normaliseIdentifier(r[ix('Leader Admission Number')]) === team.admissionNumber);
  if (!matches.length) return null;
  const record = matches.sort((a, b) => new Date(a[ix('Submitted At')]).getTime() - new Date(b[ix('Submitted At')]).getTime())[0];
  const submittedAt = new Date(record[ix('Submitted At')]);
  const deadline = new Date('2026-09-26T23:59:59+05:30');
  const lateDays = Math.max(0, Math.ceil((submittedAt.getTime() - deadline.getTime()) / 86400000));
  return { repositoryUrl: record[ix('Project GitHub Repository')] || '', submittedAt, lateDays, status: lateDays ? 'SUBMITTED_LATE' : 'SUBMITTED' };
}

function portalDashboard(team) {
  const settings=portalSettings(), rows=SpreadsheetApp.getActive().getSheetByName(PORTAL.submissions).getDataRange().getDisplayValues(), h=rows[0], ix=n=>h.indexOf(n);
  const records = step => rows.slice(1).filter(r=>r[ix('Team ID')]===team.id && r[ix('Step')]===step);
  const latest = step => records(step).sort((a,b)=>Number(b[ix('Version')])-Number(a[ix('Version')]))[0];
  const first = step => records(step).sort((a,b)=>Number(a[ix('Version')])-Number(b[ix('Version')]))[0];
  const step1 = latest('STEP_1');
  const legacyStep1 = legacyStepOneSubmission(team);
  const hasSubmitted = step => !!latest(step) || (step==='STEP_1' && !!legacyStep1);
  const milestone = (step,label) => {
    const config=stepConfiguration(settings,step), record=latest(step), initial=first(step), fallback=step==='STEP_1'&&!record?legacyStep1:null;
    const overdue=config.hasDeadline?Math.max(0,Math.ceil((Date.now()-config.deadline.getTime())/86400000)):0;
    const prerequisite=portalPreviousStep(step);
    const blockedReason=prerequisite && !hasSubmitted(prerequisite) && !record ? 'Submit '+stepLabel(prerequisite)+' before '+label+'.' : '';
    const accepting=config.active && (!config.hasDeadline || overdue===0 || config.acceptLate) && !blockedReason;
    const recordedLateDays=initial?Number(initial[ix('Late Days')]||0):(fallback?fallback.lateDays:0);
    const firstDate=step==='STEP_1'?[initial&&new Date(initial[ix('Submitted At')]),legacyStep1&&legacyStep1.submittedAt].filter(d=>d&&!isNaN(d.getTime())).sort((a,b)=>a-b)[0]:null;
    const lateDays=firstDate&&config.hasDeadline?Math.max(0,Math.ceil((firstDate.getTime()-config.deadline.getTime())/86400000)):recordedLateDays;
    const priorEvidence=record || (step==='STEP_8'?latest('STEP_7'):null) || latest('STEP_5');
    const finalFields=['STEP_7','STEP_8'].includes(step)?{demoMode:priorEvidence&&ix('Demo Mode')>=0?priorEvidence[ix('Demo Mode')]||'':'',demoUrl:priorEvidence&&ix('Demo URL')>=0?priorEvidence[ix('Demo URL')]||'':'',presentationReferenceUrl:priorEvidence&&ix('Presentation Reference URL')>=0?priorEvidence[ix('Presentation Reference URL')]||'':''}:{};
    const presentation = ['STEP_7','STEP_8'].includes(step) && typeof presentationRecord==='function' ? presentationRecord(rows,h,team.id,step,true) : null;
    return {...finalFields,step,label,active:config.active,deadlineDisplay:config.hasDeadline?Utilities.formatDate(config.deadline,Session.getScriptTimeZone(),'dd MMM yyyy, hh:mm a'):'Open - deadline will be announced',hasDeadline:!!config.hasDeadline,overdueDays:overdue,lateDays,status:record?(lateDays?'SUBMITTED_LATE':'SUBMITTED'):(fallback?fallback.status:'NOT_SUBMITTED'),accepting,...(step==='STEP_8'?{linkedinPostUrl:record&&ix('LinkedIn Post URL')>=0?record[ix('LinkedIn Post URL')]:''}:{}),...(presentation?{presentation:{name:presentation.name,slides:presentation.slides,size:presentation.size,sourceStep:presentation.sourceStep}}:{}),blockedReason:!config.active?'Not active yet.':blockedReason};
  };
  const evaluationFor = step => {
    const names=step==='STEP_1'?[PORTAL.evaluations,PORTAL.evaluationsStep1]:[PORTAL.evaluations];
    for (const name of names) {
      const sheet=SpreadsheetApp.getActive().getSheetByName(name);
      if (!sheet || sheet.getLastRow()<2) continue;
      const evals=sheet.getDataRange().getDisplayValues(), eh=evals[0], ei=n=>eh.indexOf(n);
      const er=evals.slice(1).find(r=>r[ei('Team ID')]===team.id && r[ei('Step')]===step && r[ei('Published')].toUpperCase()==='TRUE');
      if(er) return {published:true,status:er[ei('Status')],score:er[ei('Score')],comment:er[ei('Comment')],good:er[ei('What Is Good')],improve:er[ei('What To Improve')],nextAction:er[ei('Next Action')]};
    }
    return {published:false};
  };
  return {gradeReviews:gradeReviewDashboard(team),finalEvidence:{ready:finalEvidenceReady(h)},team,milestones:PORTAL_STEPS.map(step=>milestone(step,stepLabel(step))),latestRepositoryUrl:step1?step1[ix('Repository URL')]:(legacyStep1?legacyStep1.repositoryUrl:'') ,evaluations:Object.fromEntries(PORTAL_STEPS.map(step=>[step,evaluationFor(step)])),presentationUploads:typeof presentationUploadStatus==='function'?presentationUploadStatus():{ready:false}};
}

const GRADE_REVIEW_SHEET = 'Grade Review Requests';
const GRADE_REVIEW_HEADERS = ['Request ID','Requested At','Team ID','Team Name','Leader Admission Number','Project ID','Step','Submission Version','Request Type','Student Message','Evidence URL','Grade At Request','Evaluation Snapshot','Status','Faculty Response','Responded At','Client Request ID'];
const GRADE_REVIEW_TYPES = {GRADE:'Marks or grade',FEEDBACK:'Feedback clarification',UPDATED_WORK:'Updated work for reassessment',LATE_DEDUCTION:'Late deduction'};

function gradeReviewTable() {
  const sheet=SpreadsheetApp.getActive().getSheetByName(GRADE_REVIEW_SHEET);
  if(!sheet || sheet.getLastRow()<1) return null;
  const rows=sheet.getDataRange().getDisplayValues(),h=rows[0];
  return GRADE_REVIEW_HEADERS.every((name,i)=>h[i]===name)?{sheet,rows}:null;
}

function gradeReviewDashboard(team) {
  const table=gradeReviewTable();
  if(!table) return {ready:false,requests:[]};
  return {ready:true,requests:table.rows.slice(1).filter(r=>r[2]===team.id).map(r=>({id:r[0],requestedAt:r[1],step:r[6],type:r[8],message:r[9],evidenceUrl:r[10],grade:r[11],status:r[13],response:r[14]||'',respondedAt:r[15]||''})).reverse()};
}

function submitGradeReview(team,body) {
  const step=String(body.step||'');
  if(!PORTAL_STEPS.includes(step)) return {ok:false,error:'Choose a valid graded step.'};
  const category=String(body.reviewType||'');
  if(!Object.prototype.hasOwnProperty.call(GRADE_REVIEW_TYPES,category)) return {ok:false,error:'Choose the reason for your request.'};
  const concern=typeof body.concern==='string'?body.concern.trim():'';
  if(concern.length<20 || concern.length>1500) return {ok:false,error:'Explain your concern or changes in 20 to 1500 characters.'};
  const clientId=String(body.requestId||'');
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(clientId)) return {ok:false,error:'Refresh the page and send the request again.'};
  let evidenceUrl='';
  try {if(body.evidenceUrl) evidenceUrl=validatePublicEvidenceUrl(body.evidenceUrl,'Evidence link');}
  catch(error){return {ok:false,error:error.message};}
  const lock=LockService.getScriptLock();
  let saved=false;
  try {
    lock.waitLock(30000);
    const table=gradeReviewTable();
    if(!table) return {ok:false,error:'Grade-review recording is being configured. Please try again later.'};
    const existing=table.rows.slice(1).find(r=>r[2]===team.id&&r[16]===clientId);
    if(existing) {
      if(existing[6]!==step) return {ok:false,error:'Refresh your dashboard before sending this request.'};
      return {ok:true,message:'Your request is already recorded.',dashboard:portalDashboard(team)};
    }
    const dashboard=portalDashboard(team),feedback=dashboard.evaluations[step]||{};
    if(!feedback.published || !String(feedback.score||'').trim()) return {ok:false,error:'You can request a review after a grade is published for this step.'};
    if(String(body.scoreAtView||'')!==String(feedback.score)) return {ok:false,error:'This grade has changed. Reopen your dashboard, read the latest feedback and try again.'};
    const pending=table.rows.slice(1).find(r=>r[2]===team.id&&r[6]===step&&!['RESPONDED','CLOSED'].includes(String(r[13]).toUpperCase()));
    if(pending) return {ok:true,message:'A request for this step is already awaiting review. Its status is shown below.',dashboard};
    const ss=SpreadsheetApp.getActive(),subRows=ss.getSheetByName(PORTAL.submissions).getDataRange().getDisplayValues();
    const versions=subRows.slice(1).filter(r=>r[1]===team.id&&r[2]===step).map(r=>Number(r[3])||0);
    const version=versions.length?Math.max(...versions):'Legacy Step 1';
    const id=Utilities.getUuid();
    table.sheet.appendRow([id,new Date(),team.id,team.teamName,team.admissionNumber,team.projectId,step,version,GRADE_REVIEW_TYPES[category],concern,evidenceUrl,String(feedback.score),JSON.stringify(feedback),'PENDING','','',clientId].map(portalTextCell));
    saved=true;
    try {ss.getSheetByName(PORTAL.audit).appendRow([new Date(),team.id,'GRADE_REVIEW_REQUEST',step+' '+id]);}
    catch(error){console.error('Grade review saved; audit logging failed: '+error);}
    return {ok:true,message:'Your grade-review request has been recorded. You can check its status and the faculty reply here.',dashboard:portalDashboard(team)};
  } catch(error) {
    return {ok:false,error:saved?'Your request was recorded. Reopen your dashboard before retrying.':(error.message||'The request could not be saved. Please try again.')};
  } finally {try{lock.releaseLock();}catch(error){/* No lock was acquired. */}}
}

function validateProductEvidence(body) {
  const evidence=body.productEvidence||{};
  const value=name=>String(evidence[name]||'').trim();
  const fields={branch:value('branch'),interfaceType:value('interfaceType'),entryPoint:value('entryPoint'),runCommand:value('runCommand'),reportPath:value('reportPath'),demoUrl:value('demoUrl')};
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(fields.branch)||fields.branch.includes('..')) throw new Error('Enter the GitHub branch containing your Step 5 work.');
  if(['Streamlit','Gradio','Web application','Desktop application','Other project interface'].indexOf(fields.interfaceType)<0) throw new Error('Choose your Product V1 interface type.');
  for(const key of ['entryPoint','reportPath']) if(!/^[A-Za-z0-9_][A-Za-z0-9_. /-]{0,159}$/.test(fields[key])||fields[key].split(/[\\/]/).includes('..')) throw new Error('Enter a repository-relative '+(key==='entryPoint'?'entry-point':'report')+' file path.');
  if(!fields.runCommand||fields.runCommand.length>250||/^[=+@]/.test(fields.runCommand)) throw new Error('Enter a run command of at most 250 characters.');
  if(fields.demoUrl && (!/^https:\/\/[^\s<>]+$/i.test(fields.demoUrl)||fields.demoUrl.length>500)) throw new Error('Use a complete HTTPS demo URL, or leave it blank for a local demonstration.');
  const checks=evidence.checks||{};
  if(['inference','validation','output','documentation'].some(key=>checks[key]!==true)) throw new Error('Complete and confirm all four Product V1 checks before submitting Step 5.');
  return [fields.branch,fields.interfaceType,fields.entryPoint,fields.runCommand,fields.reportPath,fields.demoUrl,'Inference; input validation; clear output; run instructions and evidence'];
}
function validateLinkedInPostUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const postPattern = /^https:\/\/(?:www\.)?linkedin\.com\/(?:posts\/[a-z0-9_-]+|feed\/update\/urn:li:(?:activity|share|ugcPost):[0-9]+)\/?(?:[?#][^\s<>"\\]*)?$/i;
  if (url.length > 1000 || !postPattern.test(url)) throw new Error('Paste the HTTPS link to a specific project LinkedIn post. Profile and company-page links are not accepted.');
  return url.split(/[?#]/, 1)[0];
}
const FINAL_EVIDENCE_HEADERS = ['Demo Mode','Presentation Reference URL','LinkedIn Post Checks'];
function finalEvidenceReady(headers) { return FINAL_EVIDENCE_HEADERS.every((name,i)=>headers[27+i]===name); }
function validatePublicEvidenceUrl(value,label,required) {
  const url=String(value||'').trim();
  if(!url && !required) return '';
  const match=/^https:\/\/([a-z0-9.-]+)(?::443)?(?:[/?#][^\s<>"\\]*)?$/i.exec(url);
  if(!match || url.length>1000 || !match[1].includes('.') || /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/i.test(match[1])) throw new Error('Enter a public HTTPS '+label+' link. Localhost links cannot be opened by the reviewer.');
  return url;
}
function validateFinalEvidence(body,step) {
  const e=body.finalEvidence||{}, mode=String(e.demoMode||'');
  if(!['HOSTED','LOCAL_EVIDENCE'].includes(mode)) throw new Error('Choose a hosted UI or local application evidence for your demonstration.');
  const demoUrl=validatePublicEvidenceUrl(e.demoUrl,'UI/demo',true);
  const presentationReferenceUrl=validatePublicEvidenceUrl(e.presentationReferenceUrl,'presentation PDF/PPTX',false);
  let linkedinPostUrl='',linkedinChecks='';
  if(step==='STEP_8') {
    linkedinPostUrl=validateLinkedInPostUrl(body.linkedinPostUrl);
    if(!linkedinPostUrl) throw new Error('Step 8 requires the link to your project LinkedIn post. A profile link is not accepted.');
    const checks=body.linkedinChecks||{};
    if(['repository','description','credits'].some(key=>checks[key]!==true)) throw new Error('Confirm that the post includes this project GitHub link, a project description, and team/guide/university credits.');
    linkedinChecks='Confirmed: submitted GitHub repository; project description; team, guide and university credits';
  }
  return {demoMode:mode,demoUrl,presentationReferenceUrl,linkedinPostUrl,linkedinChecks};
}
function portalTextCell(value) { return typeof value==='string' && /^[=+\-@]/.test(value)?"'"+value:value; }

function submitPortalMilestone(team, body) {
  const step=String(body.step||''); if (PORTAL_STEPS.indexOf(step)<0) return {ok:false,error:'Select an available project step.'};
  const url=normaliseRepositoryUrl(body.repositoryUrl); if (!GITHUB_REPOSITORY_URL_PATTERN.test(url)) return {ok:false,error:'Enter a complete public GitHub repository URL.'};
  const note=String(body.note||'').trim(); if(note.length>700) return {ok:false,error:'Keep the completion note within 700 characters.'};
  let evidence=[], linkedinPostUrl='';
  try {
    if(step==='STEP_5') evidence=validateProductEvidence(body);

  } catch(error) { return {ok:false,error:error.message}; }
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  let createdPresentationFile=null,submissionSaved=false;
  try {
    const ss=SpreadsheetApp.getActive(), sheet=ss.getSheetByName(PORTAL.submissions), rows=sheet.getDataRange().getDisplayValues(), h=rows[0], ix=n=>h.indexOf(n);
    const teamRows=rows.slice(1).filter(r=>r[ix('Team ID')]===team.id);
    const existingRequest=ix('Request ID')>=0 && body.requestId ? teamRows.find(r=>r[ix('Request ID')]===body.requestId) : null;
    if(existingRequest) {
      if(existingRequest[ix('Step')]!==step) return {ok:false,error:'Please refresh your dashboard before submitting.'};
      return {ok:true,message:'Your submission has already been recorded.',dashboard:portalDashboard(team)};
    }
    const priorStep=portalPreviousStep(step);
    if(priorStep && !teamRows.some(r=>r[ix('Step')]===priorStep) && !(priorStep==='STEP_1'&&legacyStepOneSubmission(team)) && !teamRows.some(r=>r[ix('Step')]===step)) return {ok:false,error:'Submit '+stepLabel(priorStep)+' before '+stepLabel(step)+'.'};
    const settings=portalSettings(), config=stepConfiguration(settings,step), now=new Date(), deadline=config.hasDeadline?config.deadline:'', lateDays=config.hasDeadline?Math.max(0,Math.ceil((now.getTime()-deadline.getTime())/86400000)):0;
    if(!config.active) return {ok:false,error:stepLabel(step)+' submissions are not active yet.'};
    if(lateDays>0 && !config.acceptLate) return {ok:false,error:'The '+stepLabel(step)+' deadline has passed. Please contact the course coordinator.'};
    const prior=teamRows.filter(r=>r[ix('Step')]===step), version=prior.reduce((max,r)=>Math.max(max,Number(r[ix('Version')])||0),0)+1;
    if(step==='STEP_5' && sheet.getRange(1,14).getDisplayValue()!=='Branch') return {ok:false,error:'Step 5 recording is being configured. Please contact the coordinator.'};
    let finalEvidence=null;
    if(['STEP_7','STEP_8'].includes(step)) {
      if(ix('LinkedIn Post URL')!==20 || !finalEvidenceReady(h)) return {ok:false,error:'The updated final-step form is being configured. Refresh the portal before submitting.'};
      finalEvidence=validateFinalEvidence(body,step);
      evidence=Array(8).fill(''); evidence[5]=finalEvidence.demoUrl; evidence[7]=finalEvidence.linkedinPostUrl;
    }
    const prepared = typeof preparePresentationSubmission==='function' ? preparePresentationSubmission(team,body,rows,h,step) : null;
    const saved = typeof savePresentationFile==='function' ? savePresentationFile(prepared,team,step,version) : {cells:[],file:null};
    createdPresentationFile=saved.file;
    const newRow=[Utilities.getUuid(),team.id,step,version,'TRUE',now,deadline,lateDays,url,'',note,lateDays?'SUBMITTED_LATE':'SUBMITTED',team.admissionNumber].concat(evidence);
    if(prepared) {
      while(newRow.length<21) newRow.push('');
      newRow.push(...saved.cells,String(body.requestId||''));
    }
    if(finalEvidence) {
      while(newRow.length<27) newRow.push('');
      newRow.push(finalEvidence.demoMode,finalEvidence.presentationReferenceUrl,finalEvidence.linkedinChecks);
    }
    sheet.appendRow(newRow.map(portalTextCell));
    submissionSaved=true;
    prior.forEach(r=>{if(r[ix('Latest')]==='TRUE') sheet.getRange(rows.indexOf(r)+1,ix('Latest')+1).setValue('FALSE');});
    try { ss.getSheetByName(PORTAL.audit).appendRow([new Date(),team.id,'SUBMIT_'+step,'Version '+version]); }
    catch (error) { console.error('Portal audit write failed after a successful submission: '+error); }
    return {ok:true,message:version>1?'Your updated version is now the latest submission.':'Your submission has been recorded.',dashboard:portalDashboard(team)};
  } catch(error) {
    if(createdPresentationFile && !submissionSaved) {
      try { createdPresentationFile.setTrashed(true); } catch(cleanupError) { console.error('Could not clean unrecorded presentation: '+cleanupError); }
    }
    return {ok:false,error:submissionSaved?'Your submission was recorded. Reopen your dashboard to check the result before retrying.':error.message||'The presentation could not be saved. Please try again.'};
  } finally {lock.releaseLock();}
}

