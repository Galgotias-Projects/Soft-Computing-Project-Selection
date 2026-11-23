const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../central-portal');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{id,value:'',hidden:false,disabled:false,required:false,checked:false,files:[],textContent:'',innerHTML:'',handlers:{},addEventListener(k,f){this.handlers[k]=f},append(){},remove(){}});return elements.get(id)}
for(const m of html.matchAll(/id="([^"]+)"/g))element(m[1]);
const ctx=vm.createContext({document:{querySelector:s=>element(s.slice(1)),createElement:()=>element('new-'+Math.random()),body:{append(){}}},window:{PORTAL_CONFIG:{apiUrl:'https://example.test'},crypto:{randomUUID:()=> 'ui-test-request-id'},setTimeout,clearTimeout},console});
vm.runInContext(fs.readFileSync(path.join(base,'app.js'),'utf8'),ctx);
const dashboard={team:{projectId:'SC11',projectTitle:'Example',teamName:'TEST',leaderName:'TEST'},finalEvidence:{ready:true},presentationUploads:{ready:true},milestones:Array.from({length:8},(_,i)=>({step:'STEP_'+(i+1),label:'Step '+(i+1),accepting:true,status:'NOT_SUBMITTED',hasDeadline:true,deadlineDisplay:'Test deadline',...(i===7?{linkedinPostUrl:''}:{})})),evaluations:{}};
ctx.fixture=dashboard;
let checks=0;
function check(v,m){assert.ok(v,m);checks++;}
function render(n){vm.runInContext(`state.selectedStep='STEP_${n}';renderDashboard(fixture)`,ctx)}
for(let n=1;n<=6;n++){render(n);check(element('presentation-fields').hidden,'Earlier steps do not show PPT inputs');check(!element('submit-work').disabled,'Earlier steps remain submit-enabled')}
render(7);
check(!element('presentation-fields').hidden&&!element('presentation-fields').disabled,'Step 7 upload appears');
check(element('presentation-file').required&&!element('presentation-file').disabled,'First deck required');
dashboard.milestones[6].presentation={name:'<script>deck.pptx',slides:8,size:1000,sourceStep:'STEP_7'};
render(7);
check(element('reuse-presentation').checked&&element('presentation-file').disabled,'Saved deck offered for reuse');
check(element('presentation-current').textContent.includes('<script>deck.pptx'),'Filename displayed as text');
element('reuse-presentation').checked=false;element('reuse-presentation').handlers.change();
check(element('presentation-file').required&&!element('presentation-file').disabled,'Replacement file input enabled');
dashboard.milestones[7].presentation=dashboard.milestones[6].presentation;render(8);
check(!element('linkedin-fields').hidden&&!element('presentation-fields').hidden,'Step 8 shows both PPT and LinkedIn');
dashboard.presentationUploads.ready=false;render(8);
check(element('submit-work').disabled&&element('presentation-fields').disabled,'Missing backend capability blocks only presentation steps');
render(6);check(!element('submit-work').disabled,'Step 6 unaffected by unavailable upload capability');
dashboard.presentationUploads.ready=true;dashboard.milestones[7].accepting=false;render(8);
check(element('submit-work').disabled&&element('presentation-fields').disabled,'Prerequisite block remains enforced');
dashboard.milestones[7].accepting=true;
render(8);
check(!element('final-evidence-fields').hidden&&!element('final-evidence-fields').disabled,'Final UI evidence fields visible');
dashboard.milestones[7].demoMode='LOCAL_EVIDENCE';dashboard.milestones[7].demoUrl='https://github.com/example/test/blob/main/docs/UI.md';render(8);
check(element('final-demo-mode').value==='LOCAL_EVIDENCE'&&element('final-demo-url').value.includes('/docs/UI.md'),'Recorded UI evidence is prefilled');
check(html.includes('Project LinkedIn post URL (required)'),'LinkedIn label states required');
check(html.includes('id="linkedin-post-url" type="url" required'),'Post URL has browser validation');
for(const key of ['repository','description','credits']) check(html.includes('id="linkedin-check-'+key+'" type="checkbox" required'),'Required post content check '+key);
dashboard.finalEvidence.ready=false;render(8);check(element('submit-work').disabled,'Schema not ready blocks only final steps');
render(4);check(!element('submit-work').disabled,'Earlier submissions unaffected by final evidence setup');
console.log(`Presentation UI tests passed: ${checks} checks.`);
