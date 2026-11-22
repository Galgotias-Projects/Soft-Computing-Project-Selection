const assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'..');
const fixtures=path.resolve(__dirname,'fixtures');
const text=n=>fs.readFileSync(path.join(base,'google-apps-script',n),'utf8');
const blob=(bytes,type,name)=>({getBytes:()=>Array.from(Buffer.from(bytes)),getName:()=>name,getDataAsString:()=>Buffer.from(bytes).toString('utf8')});
const files=new Map();let created=0,appendFails=false;
const headers=['Submission ID','Team ID','Step','Version','Latest','Submitted At','Deadline','Late Days','Repository URL','Commit URL','Note','Status','Submitted By','Branch','Interface Type','Entry Point','Run Command','Report Path','Demo URL','Evidence Checks','LinkedIn Post URL','Presentation URL','Presentation File Name','Presentation Slides','Presentation Size Bytes','Presentation SHA256','Request ID'];
const tables=new Map();
function table(name,rows){
 const api={rows,getLastRow:()=>rows.length,getDataRange:()=>({getDisplayValues:()=>rows.map(r=>r.map(x=>x instanceof Date?x.toISOString():String(x??'')))}),
   getRange:(r,c)=>({getDisplayValue:()=>String(rows[r-1]?.[c-1]??''),setValue:v=>rows[r-1][c-1]=v}),appendRow:r=>{if(appendFails&&name==='Milestone Submissions')throw Error('Simulated sheet error');rows.push(r)}};
 tables.set(name,api);return api;
}
const sub=table('Milestone Submissions',[headers]);
table('Portal Teams',[['Team ID','Leader Admission Number','Leader Name','Team Name','Project ID','Project Name','Access Code','Active'],['TEST-PPT','24SCSE1410999','Test leader','TEST ONLY','SC11','Example','123456','TRUE']]);
table('Portal Settings',[['Key','Value'],...Array.from({length:8},(_,i)=>i+1).flatMap(n=>[[`STEP_${n}_ACTIVE`,'TRUE'],[`STEP_${n}_ACCEPT_LATE`,'TRUE'],[`STEP_${n}_DEADLINE`,'2099-01-01T23:59:59+05:30']])]);
table('Step 1 Submissions',[['Leader Admission Number','Submitted At']]);
table('Evaluation',[['Team ID','Step','Published']]);table('Evaluation Step 1',[['Team ID','Step','Published']]);table('Portal Audit',[['Timestamp','Team ID','Action','Detail']]);
const folder={createFile:b=>{const id='test-file-'+(++created); const f={getId:()=>id,getUrl:()=>`https://docs.google.com/presentation/d/${id}/edit?usp=drivesdk`,getName:()=>b.getName(),isTrashed:()=>f.trashed,setTrashed:v=>f.trashed=v,trashed:false};files.set(id,f);return f;}};
const ctx=vm.createContext({
 SpreadsheetApp:{getActive:()=>({getSheetByName:n=>tables.get(n)})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'private-test-folder'})},
 DriveApp:{getFolderById:()=>folder,getFileById:id=>{if(!files.has(id))throw Error('missing');return files.get(id)}},
 LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},Session:{getScriptTimeZone:()=> 'Asia/Calcutta'},
 Utilities:{getUuid:()=>crypto.randomUUID(),formatDate:d=>d.toISOString(),DigestAlgorithm:{SHA_256:'sha256'},base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:blob,
  computeDigest:(kind,bytes)=>Array.from(crypto.createHash('sha256').update(Buffer.from(bytes)).digest()),
  unzip:b=>{const buf=Buffer.from(b.getBytes()),out=[];let pos=0;while(pos+30<buf.length&&buf.readUInt32LE(pos)===0x04034b50){const method=buf.readUInt16LE(pos+8),size=buf.readUInt32LE(pos+18),n=buf.readUInt16LE(pos+26),e=buf.readUInt16LE(pos+28); const name=buf.subarray(pos+30,pos+30+n).toString();const data=buf.subarray(pos+30+n+e,pos+30+n+e+size);out.push(blob(method===8?zlib.inflateRawSync(data):data,'',name));pos+=30+n+e+size;}return out;}},
 XmlService:{getNamespace:x=>x,parse:xml=>({getRootElement:()=>({getChild:()=>({getChildren:()=>Array.from(xml.matchAll(/<p:sldId\s/g))})})})},
 ADMISSION_PATTERN:/^\d{2}[A-Z]{2,8}\d{5,8}$/,GITHUB_REPOSITORY_URL_PATTERN:/^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/,
 normaliseIdentifier:s=>String(s||'').toUpperCase(),normaliseRepositoryUrl:s=>s,console
});
vm.runInContext(text('PresentationUpload.gs'),ctx);vm.runInContext(text('CentralPortal.gs'),ctx);
const upload=n=>({name:`dummy-${n}-slides.pptx`,base64:fs.readFileSync(path.join(fixtures,`dummy-${n}-slides.pptx`)).toString('base64')});
const body=(step,extra={})=>({action:'submitMilestone',admissionNumber:'24SCSE1410999',accessCode:'123456',step,repositoryUrl:'https://github.com/example/test',note:'TEST ONLY',requestId:crypto.randomUUID(),...extra});
const send=b=>ctx.centralPortalDispatch(b);
let checks=0;
function ok(v,msg){assert.ok(v,msg);checks++;}
ok(ctx.validatePresentationUpload(upload(1)).slides===1,'One-slide deck accepted');
ok(ctx.validatePresentationUpload(upload(8)).slides===8,'Eight-slide deck accepted');
assert.throws(()=>ctx.validatePresentationUpload(upload(9)),/1 to 8/);checks++;
for(const u of [{name:'deck.ppt',base64:'AAAA'},{name:'deck.pptm',base64:'AAAA'},{name:'deck.pptx',base64:'invalid!'},{name:'deck.pptx',base64:Buffer.from('not a pptx').toString('base64')},{name:'deck.pptx',base64:'A'.repeat(4*Math.ceil(10*1024*1024/3)+4)}]){assert.throws(()=>ctx.validatePresentationUpload(u));checks++;}
ok(!send(body('STEP_7',{presentation:upload(8)})).ok,'Missing Step 6 blocks upload');
ok(created===0&&sub.rows.length===1,'Rejected prerequisite creates no files/rows');
sub.rows.push(['previous','TEST-PPT','STEP_6',1,'TRUE',new Date(),'','', 'https://github.com/example/test','','','SUBMITTED','24SCSE1410999']);
ok(!send(body('STEP_7')).ok,'New Step 7 requires a deck');
ok(!send(body('STEP_7',{presentation:upload(9)})).ok,'Nine-slide submission rejected');
ok(created===0,'Validation occurs before Drive writes');
const first=body('STEP_7',{presentation:upload(8)});
let result=send(first);
ok(result.ok,'Step 7 upload succeeds');
ok(created===1&&sub.rows.at(-1)[23]===8,'Actual slide count recorded');
ok(sub.rows.at(-1)[21]==='https://drive.google.com/file/d/test-file-1/view','Stored URL is canonical even when Drive returns an editor URL');
const current=result.dashboard.milestones.find(x=>x.step==='STEP_7');
ok(current.presentation.name==='dummy-8-slides.pptx','Student sees recorded filename');
ok(result.dashboard.milestones.find(x=>x.step==='STEP_8').presentation.sourceStep==='STEP_7','Step 8 offers Step 7 deck');
ok(send(first).ok&&created===1&&sub.rows.length===3,'Same request retry is idempotent');
result=send(body('STEP_7',{presentation:upload(1)}));
ok(result.ok&&created===2&&sub.rows.at(-2)[4]==='FALSE'&&sub.rows.at(-1)[3]===2,'Resubmission retains prior version and creates new file');
sub.rows.at(-1)[21]='https://docs.google.com/presentation/d/test-file-2/edit?usp=drivesdk';
result=send(body('STEP_8',{reusePresentation:true,linkedinPostUrl:'https://www.linkedin.com/posts/example_project-123'}));
ok(result.ok&&created===2&&sub.rows.at(-1)[21]===sub.rows.at(-2)[21],'Step 8 reuses prior file without duplicate upload');
ok(sub.rows.at(-1)[20].includes('linkedin.com/posts/'),'LinkedIn link preserved with presentation metadata');
const wrong=body('STEP_7',{presentation:upload(8),accessCode:'000000'});
ok(!send(wrong).ok&&created===2,'Wrong code cannot create files');
appendFails=true;const fail=send(body('STEP_7',{presentation:upload(8)}));appendFails=false;
ok(!fail.ok&&created===3&&files.get('test-file-3').trashed,'Sheet failure trashes only the unrecorded new file');
ok(!files.get('test-file-1').trashed&&!files.get('test-file-2').trashed,'Old presentation files retained');
const props=ctx.PropertiesService;ctx.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};
ok(!send(body('STEP_7',{presentation:upload(8)})).ok,'Unconfigured uploads fail safely');
ctx.PropertiesService=props;
ok(sub.rows.filter(r=>r[2]==='STEP_7'&&r[4]==='TRUE').length===1,'Exactly one latest Step 7 record');
console.log(`Presentation tests passed: ${checks} checks using real one-, eight- and nine-slide PowerPoint fixtures.`);
