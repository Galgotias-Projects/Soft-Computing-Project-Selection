const PORTAL = {
  teams: 'Portal Teams', submissions: 'Milestone Submissions', evaluations: 'Evaluation', evaluationsStep1: 'Evaluation Step 1',
  settings: 'Portal Settings', audit: 'Portal Audit'
};

const PORTAL_HEADERS = {
  teams: ['Team ID','Leader Admission Number','Leader Name','Team Name','Project ID','Project Name','Access Code','Active'],
  submissions: ['Submission ID','Team ID','Step','Version','Latest','Submitted At','Deadline','Late Days','Repository URL','Commit URL','Note','Status','Submitted By'],
  evaluations: ['Team ID','Step','Status','Score','Comment','What Is Good','What To Improve','Next Action','Published','Evaluated On'],
  settings: ['Key','Value'], audit: ['Timestamp','Team ID','Action','Detail']
};
const PORTAL_DEFAULT_SETTINGS = [
  ['STEP_1_DEADLINE','2026-09-26T23:59:59+05:30'], ['STEP_1_ACCEPT_LATE','TRUE'],
  ['STEP_2_DEADLINE','2026-10-04T23:59:59+05:30'], ['STEP_2_ACCEPT_LATE','TRUE'],
  ['STEP_3_DEADLINE','2026-10-12T23:59:59+05:30'], ['STEP_3_ACCEPT_LATE','TRUE'], ['STEP_3_ACTIVE','TRUE'],
  ['STEP_4_DEADLINE','2026-10-20T23:59:59+05:30'], ['STEP_4_ACCEPT_LATE','TRUE'], ['STEP_4_ACTIVE','TRUE']
];

function isCentralPortalAction(action) { return ['portalLookup','submitMilestone'].indexOf(action) >= 0; }

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
  const active = String(settings[step + '_ACTIVE'] || 'TRUE').toUpperCase() === 'TRUE';
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
  const previousStep = {STEP_2:'STEP_1',STEP_3:'STEP_2',STEP_4:'STEP_3'};
  const milestone = (step,label) => {
    const config=stepConfiguration(settings,step), record=latest(step), initial=first(step), fallback=step==='STEP_1'&&!record?legacyStep1:null;
    const overdue=config.hasDeadline?Math.max(0,Math.ceil((Date.now()-config.deadline.getTime())/86400000)):0;
    const prerequisite=previousStep[step];
    const blockedReason=prerequisite && !hasSubmitted(prerequisite) && !record ? 'Submit '+stepLabel(prerequisite)+' before '+label+'.' : '';
    const accepting=config.active && (!config.hasDeadline || overdue===0 || config.acceptLate) && !blockedReason;
    const recordedLateDays=initial?Number(initial[ix('Late Days')]||0):(fallback?fallback.lateDays:0);
    const firstDate=step==='STEP_1'?[initial&&new Date(initial[ix('Submitted At')]),legacyStep1&&legacyStep1.submittedAt].filter(d=>d&&!isNaN(d.getTime())).sort((a,b)=>a-b)[0]:null;
    const lateDays=firstDate&&config.hasDeadline?Math.max(0,Math.ceil((firstDate.getTime()-config.deadline.getTime())/86400000)):recordedLateDays;
    return {step,label,deadlineDisplay:config.hasDeadline?Utilities.formatDate(config.deadline,Session.getScriptTimeZone(),'dd MMM yyyy, hh:mm a'):'Open - deadline will be announced',hasDeadline:!!config.hasDeadline,overdueDays:overdue,lateDays,status:record?(lateDays?'SUBMITTED_LATE':'SUBMITTED'):(fallback?fallback.status:'NOT_SUBMITTED'),accepting,blockedReason};
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
  return {team,milestones:[milestone('STEP_1','Step 1'),milestone('STEP_2','Step 2'),milestone('STEP_3','Step 3'),milestone('STEP_4','Step 4')],latestRepositoryUrl:step1?step1[ix('Repository URL')]:(legacyStep1?legacyStep1.repositoryUrl:'') ,evaluations:{STEP_1:evaluationFor('STEP_1'),STEP_2:evaluationFor('STEP_2'),STEP_3:evaluationFor('STEP_3'),STEP_4:evaluationFor('STEP_4')}};
}

function submitPortalMilestone(team, body) {
  const step=String(body.step||''); if (['STEP_1','STEP_2','STEP_3','STEP_4'].indexOf(step)<0) return {ok:false,error:'Select an available project step.'};
  const url=normaliseRepositoryUrl(body.repositoryUrl); if (!GITHUB_REPOSITORY_URL_PATTERN.test(url)) return {ok:false,error:'Enter a complete public GitHub repository URL.'};
  const note=String(body.note||'').trim(); if(note.length>700) return {ok:false,error:'Keep the completion note within 700 characters.'};
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss=SpreadsheetApp.getActive(), sheet=ss.getSheetByName(PORTAL.submissions), rows=sheet.getDataRange().getDisplayValues(), h=rows[0], ix=n=>h.indexOf(n);
    const teamRows=rows.slice(1).filter(r=>r[ix('Team ID')]===team.id);
    const priorStep={STEP_2:'STEP_1',STEP_3:'STEP_2',STEP_4:'STEP_3'}[step];
    if(priorStep && !teamRows.some(r=>r[ix('Step')]===priorStep) && !(priorStep==='STEP_1'&&legacyStepOneSubmission(team)) && !teamRows.some(r=>r[ix('Step')]===step)) return {ok:false,error:'Submit '+stepLabel(priorStep)+' before '+stepLabel(step)+'.'};
    const settings=portalSettings(), config=stepConfiguration(settings,step), now=new Date(), deadline=config.hasDeadline?config.deadline:'', lateDays=config.hasDeadline?Math.max(0,Math.ceil((now.getTime()-deadline.getTime())/86400000)):0;
    if(!config.active) return {ok:false,error:stepLabel(step)+' submissions are not active yet.'};
    if(lateDays>0 && !config.acceptLate) return {ok:false,error:'The '+stepLabel(step)+' deadline has passed. Please contact the course coordinator.'};
    const prior=teamRows.filter(r=>r[ix('Step')]===step), version=prior.reduce((max,r)=>Math.max(max,Number(r[ix('Version')])||0),0)+1;
    sheet.appendRow([Utilities.getUuid(),team.id,step,version,'TRUE',now,deadline,lateDays,url,'',note,lateDays?'SUBMITTED_LATE':'SUBMITTED',team.admissionNumber]);
    prior.forEach(r=>{if(r[ix('Latest')]==='TRUE') sheet.getRange(rows.indexOf(r)+1,ix('Latest')+1).setValue('FALSE');});
    try { ss.getSheetByName(PORTAL.audit).appendRow([new Date(),team.id,'SUBMIT_'+step,'Version '+version]); }
    catch (error) { console.error('Portal audit write failed after a successful submission: '+error); }
    return {ok:true,message:version>1?'Your updated version is now the latest submission.':'Your submission has been recorded.',dashboard:portalDashboard(team)};
  } finally {lock.releaseLock();}
}
