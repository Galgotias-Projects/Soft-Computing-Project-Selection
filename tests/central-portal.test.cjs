const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'CentralPortal.gs'), 'utf8');
new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8'));
const header = {
  teams: ['Team ID','Leader Admission Number','Leader Name','Team Name','Project ID','Project Name','Access Code','Active'],
  submissions: ['Submission ID','Team ID','Step','Version','Latest','Submitted At','Deadline','Late Days','Repository URL','Commit URL','Note','Status','Submitted By'],
  evaluations: ['Team ID','Step','Status','Score','Comment','What Is Good','What To Improve','Next Action','Published','Evaluated On'],
};
const sheets = new Map();
function sheet(name, rows) {
  const state = {rows};
  const api = {
    getLastRow: () => state.rows.length,
    getDataRange: () => ({getDisplayValues: () => state.rows.map(row => row.map(value => value instanceof Date ? value.toLocaleString('en-US') : String(value ?? '')))}),
    getRange: (row, col) => ({setValue: value => {state.rows[row-1][col-1] = value;}, getDisplayValue: () => String(state.rows[row-1]?.[col-1]||'')}),
    appendRow: row => state.rows.push(row),
  };
  sheets.set(name, api);
  return state;
}
const teamId = 'TEST-STEP4-TEAM';
const admission = '24SCSE1410999';
sheet('Portal Teams', [header.teams,[teamId,admission,'Portal Test Leader','PORTAL-TEST','SC11','Water Quality Example','123456','TRUE']]);
const submissions = sheet('Milestone Submissions', [header.submissions]);
const audits = sheet('Portal Audit', [['Timestamp','Team ID','Action','Detail']]);
const settings = sheet('Portal Settings', [['Key','Value'],['STEP_1_DEADLINE','2026-09-26T23:59:59+05:30'],['STEP_1_ACTIVE','TRUE'],['STEP_1_ACCEPT_LATE','TRUE'],['STEP_2_DEADLINE','2026-10-04T23:59:59+05:30'],['STEP_2_ACTIVE','TRUE'],['STEP_2_ACCEPT_LATE','TRUE'],['STEP_3_DEADLINE','2026-10-12T23:59:59+05:30'],['STEP_3_ACTIVE','TRUE'],['STEP_3_ACCEPT_LATE','TRUE'],['STEP_4_DEADLINE','2099-10-20T23:59:59+05:30'],['STEP_4_ACTIVE','TRUE'],['STEP_4_ACCEPT_LATE','TRUE']]);
sheet('Evaluation', [header.evaluations,[teamId,'STEP_3','ACCEPTED','','Clear result','','','','TRUE','']]);
sheet('Evaluation Step 1', [header.evaluations]);
sheet('Step 1 Submissions', [['Submission ID','Submitted At','Leader Admission Number','Project GitHub Repository']]);
let uuid = 0;
const context = vm.createContext({
  SpreadsheetApp:{getActive:()=>({getSheetByName:name=>sheets.get(name)})},
  Utilities:{getUuid:()=>`test-submission-${++uuid}`,formatDate:date=>date.toISOString()},
  Session:{getScriptTimeZone:()=> 'Asia/Calcutta'},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  ADMISSION_PATTERN:/^\d{2}[A-Z]{2,8}\d{5,8}$/,
  GITHUB_REPOSITORY_URL_PATTERN:/^https:\/\/github\.com\/[A-Za-z\d-]+\/[A-Za-z\d._-]+\/?$/i,
  normaliseIdentifier:value=>String(value||'').trim().toUpperCase(),
  normaliseRepositoryUrl:value=>String(value||'').trim(),
  console,
});
vm.runInContext(source,context);
const call = (action,step,url='https://github.com/example/SC11-Water-Quality') => context.centralPortalDispatch({action,admissionNumber:admission,accessCode:'123456',step,repositoryUrl:url,note:'Baseline comparison in docs/STEP-4.md'});
const addEarlier = step => submissions.rows.push([`fixture-${step}`,teamId,step,1,'TRUE',new Date('2026-10-01T10:00:00Z'),'','','https://github.com/example/SC11-Water-Quality','','','SUBMITTED',admission]);

assert.equal(call('portalLookup').dashboard.milestones.length,8);
assert.equal(call('submitMilestone','STEP_4').ok,false,'Step 4 without Step 3 must be rejected');
assert.equal(submissions.rows.length,1,'Rejected request must not write a row');
addEarlier('STEP_1');
assert.equal(call('submitMilestone','STEP_3').ok,false,'Step 3 without Step 2 must be rejected');
addEarlier('STEP_2');
addEarlier('STEP_3');
assert.equal(call('submitMilestone','STEP_4','not-a-url').ok,false,'Bad repository URL must be rejected');
assert.equal(call('submitMilestone','STEP_5').ok,false,'Inactive future steps must be rejected');
assert.equal(context.centralPortalDispatch({action:'submitMilestone',admissionNumber:admission,accessCode:'123456',step:'STEP_4',repositoryUrl:'https://github.com/example/repo',note:'x'.repeat(701)}).ok,false,'Long note must be rejected');
assert.equal(submissions.rows.length,4,'No invalid request should create a row');
const result = call('submitMilestone','STEP_4');
assert.equal(result.ok,true);
assert.equal(result.dashboard.milestones.find(item=>item.step==='STEP_4').status,'SUBMITTED');
assert.equal(submissions.rows[4][2],'STEP_4');
assert.equal(submissions.rows[4][3],1);
assert.equal(submissions.rows[4][4],'TRUE');
assert.equal(audits.rows.length,2);
const again = call('submitMilestone','STEP_4');
assert.equal(again.ok,true,'Step 4 resubmission should be allowed');
assert.equal(submissions.rows[4][4],'FALSE');
assert.equal(submissions.rows[5][3],2);
assert.equal(submissions.rows[5][4],'TRUE');
assert.equal(again.dashboard.milestones.find(item=>item.step==='STEP_4').lateDays,0,'On-time first submission must remain on time');
assert.equal(again.dashboard.evaluations.STEP_3.status,'ACCEPTED','Existing feedback remains available');
sheet('Evaluation', [header.evaluations,[teamId,'STEP_4','NEEDS_IMPROVEMENT','','Compare with the baseline','','Add the comparison table','Update the repository','TRUE','']]);
assert.equal(call('portalLookup').dashboard.evaluations.STEP_4.status,'NEEDS_IMPROVEMENT','Step 4 feedback maps through the existing Evaluation sheet');
assert.equal(context.centralPortalDispatch({action:'portalLookup',admissionNumber:admission,accessCode:'000000'}).ok,false,'Wrong access code must be rejected');
settings.rows.find(row=>row[0]==='STEP_4_DEADLINE')[1]='2026-10-01T23:59:59+05:30';
const late = call('submitMilestone','STEP_4');
assert.equal(late.ok,true,'Late Step 4 submissions remain open');
assert.equal(late.dashboard.milestones.find(item=>item.step==='STEP_4').lateDays,0,'An on-time first version stays on time after a late resubmission');
assert.equal(submissions.rows[6][11],'SUBMITTED_LATE','The new row still records its actual late submission');
console.log('Central portal tests passed: prerequisites, validation, Step 4 save/resubmit, audit, first-date status, late acceptance, feedback, access code.');

// Product V1 adds fields without changing the first 13 submission columns.
submissions.rows[0].push('Branch','Interface Type','Entry Point','Run Command','Report Path','Demo URL','Evidence Checks');
settings.rows.push(['STEP_5_DEADLINE','2099-11-08T23:59:59+05:30'],['STEP_5_ACTIVE','TRUE'],['STEP_5_ACCEPT_LATE','TRUE'],['STEP_6_DEADLINE','2026-11-15T23:59:59+05:30'],['STEP_6_ACTIVE','FALSE']);
const product = {
  branch:'step-5-product-v1',interfaceType:'Streamlit',entryPoint:'app.py',
  runCommand:'python -m streamlit run app.py',reportPath:'docs/STEP-5.md',demoUrl:'',
  checks:{inference:true,validation:true,output:true,documentation:true}
};
const submitProduct = (evidence=product,extra={}) => context.centralPortalDispatch({action:'submitMilestone',admissionNumber:admission,accessCode:'123456',step:'STEP_5',repositoryUrl:'https://github.com/example/SC11-Water-Quality',note:'Product V1 evidence',productEvidence:evidence,...extra});
const countBefore=submissions.rows.length;
assert.equal(submitProduct({}).ok,false);
assert.equal(submitProduct({...product,checks:{...product.checks,validation:false}}).ok,false);
assert.equal(submitProduct({...product,reportPath:'../private.md'}).ok,false);
assert.equal(submitProduct({...product,demoUrl:'javascript:alert(1)'}).ok,false);
assert.equal(submitProduct({...product,runCommand:'=IMPORTXML("https://example.com")'}).ok,false);
assert.equal(submissions.rows.length,countBefore,'Invalid Product V1 requests must not be saved');
const successful=submitProduct();
assert.equal(successful.ok,true);
const firstProduct=submissions.rows.at(-1);
assert.equal(firstProduct.length,20);
assert.equal(firstProduct[13],'step-5-product-v1');
assert.equal(firstProduct[16],'python -m streamlit run app.py');
assert.equal(firstProduct[18],'','A hosted demo is optional');
assert.equal(successful.dashboard.milestones.find(x=>x.step==='STEP_6').active,false);
assert.equal(call('submitMilestone','STEP_6').ok,false,'Upcoming milestones must reject submission');
assert.equal(submitProduct().ok,true);
assert.equal(firstProduct[4],'FALSE');
assert.equal(submissions.rows.at(-1)[3],2);
settings.rows.find(row=>row[0]==='STEP_5_DEADLINE')[1]='2026-10-01T23:59:59+05:30';
assert.equal(submitProduct().dashboard.milestones.find(x=>x.step==='STEP_5').lateDays,0);
// A new team cannot bypass Step 4 by posting directly to the backend.
const team2='TEST-NO-STEP4';
const teamRows=sheets.get('Portal Teams');
const second=sheet('Portal Teams',[header.teams,[teamId,admission,'Leader','Test','SC11','Water','123456','TRUE'],[team2,'24SCSE1410998','Second','Second','SC11','Water','123456','TRUE']]);
const beforeBlocked=submissions.rows.length;
assert.equal(submitProduct(product,{admissionNumber:'24SCSE1410998'}).ok,false);
assert.equal(submissions.rows.length,beforeBlocked);
console.log('Product V1 tests passed: eight milestones, required evidence, optional local demo, validation, prerequisites, append-only resubmission, first-date status and future-step blocking.');

