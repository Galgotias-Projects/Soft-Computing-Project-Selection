const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,innerHTML:'',textContent:'',addEventListener(){}});return elements.get(id)}
const ctx=vm.createContext({window:{PORTAL_CONFIG:{}},document:{querySelector:s=>el(s.slice(1))}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../central-portal/app.js'),'utf8'),ctx);
const css=fs.readFileSync(path.join(__dirname,'../central-portal/styles.css'),'utf8');
assert.ok(css.includes('form[hidden]{display:none}'),'Pending forms must remain hidden despite the form grid style');
const source=fs.readFileSync(path.join(__dirname,'../central-portal/app.js'),'utf8');
assert.ok(source.includes('form.hidden = true;')&&source.includes("input.type = 'hidden';"),'Transport payload must not appear as a visible input');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
const data={gradeReviews:{ready:true,requests:[]}};
ctx.renderGradeReview(data,{published:false,score:'8/10'},'STEP_1');check(el('grade-review-panel').hidden,'Unpublished grade hidden');
ctx.renderGradeReview(data,{published:true,score:''},'STEP_1');check(el('grade-review-panel').hidden,'Ungraded feedback hidden');
for(const step of ['STEP_1','STEP_8']){ctx.renderGradeReview(data,{published:true,score:'0/10'},step);check(!el('grade-review-panel').hidden&&!el('send-grade-review').disabled,'All graded steps, including zero and future grades, supported')}
data.gradeReviews.requests=[{id:'r1',step:'STEP_1',status:'PENDING',type:'Marks',message:'<img onerror=alert(1)>',requestedAt:'23 Nov',grade:'7/10'}];
ctx.renderGradeReview(data,{published:true,score:'7/10'},'STEP_1');check(el('grade-review-form').hidden,'Pending request prevents duplicate form');check(el('grade-review-history').innerHTML.includes('&lt;img'),'Student concern escaped');
ctx.renderGradeReview(data,{published:true,score:'7/10'},'STEP_2');check(!el('grade-review-form').hidden,'Another step is not blocked');
data.gradeReviews.requests[0].status='RESPONDED';data.gradeReviews.requests[0].response='Use the saved output.';
ctx.renderGradeReview(data,{published:true,score:'7/10'},'STEP_1');check(!el('grade-review-form').hidden&&el('grade-review-history').innerHTML.includes('Use the saved output.'),'Response visible and a new review may be requested');
data.gradeReviews.ready=false;ctx.renderGradeReview(data,{published:true,score:'7/10'},'STEP_1');check(el('send-grade-review').disabled,'Configuration failure blocks requests only');
console.log(`Grade review UI tests passed: ${checks} checks.`);
