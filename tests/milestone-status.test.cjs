const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../central-portal/app.js'),'utf8');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{addEventListener(){}});return elements.get(id)}
const context=vm.createContext({window:{PORTAL_CONFIG:{}},document:{querySelector:element}});
vm.runInContext(source,context);
const past={active:true,hasDeadline:true,overdueDays:1,status:'SUBMITTED'};
const tone=(item,status,published=true)=>context.milestoneTone(item,{status,published});
for(const status of ['Needs Revision','NEEDS_REVISION','Needs Improvement'])assert.equal(tone(past,status),'status-revision');
for(const status of ['Accepted','ACCEPTED','Provisionally Accepted'])assert.equal(tone(past,status),'status-accepted');
assert.equal(tone({...past,status:'NOT_SUBMITTED'},'Accepted'),'status-missing','Missing overdue work is red even with stale feedback');
assert.equal(tone(past,'Needs Revision',false),'','Unpublished feedback does not expose a review state');
assert.equal(tone(past,'Awaiting Review'),'','Submitted work awaiting review is not marked missing');
for(const status of ['Accepted','Needs Revision','Not Submitted']){
  assert.equal(tone({...past,overdueDays:0,status:'NOT_SUBMITTED'},status),'','Future deadline stays neutral');
  assert.equal(tone({...past,hasDeadline:false},status),'','No deadline stays neutral');
  assert.equal(tone({...past,active:false},status),'','Inactive milestone stays neutral');
}
console.log('Milestone status checks passed.');
