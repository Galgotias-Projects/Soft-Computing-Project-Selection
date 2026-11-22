const PRESENTATION_HEADERS = ['Presentation URL','Presentation File Name','Presentation Slides','Presentation Size Bytes','Presentation SHA256','Request ID'];
const PRESENTATION_MAX_BYTES = 10 * 1024 * 1024;
const PRESENTATION_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// Run once as the spreadsheet owner. Files stay private in the owner's Drive.
function setupPresentationUploads() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PORTAL.submissions);
  const headers = sheet.getDataRange().getDisplayValues()[0];
  for (let i=0;i<PRESENTATION_HEADERS.length;i++) {
    const existing=headers[21+i]||'';
    if (existing && existing!==PRESENTATION_HEADERS[i]) throw new Error('Unexpected existing column at '+(22+i)+'. No data changed.');
  }
  if(sheet.getMaxColumns()<27) sheet.insertColumnsAfter(sheet.getMaxColumns(),27-sheet.getMaxColumns());
  sheet.getRange(1,22,1,6).setValues([PRESENTATION_HEADERS]);
  const props=PropertiesService.getScriptProperties();
  let folderId=props.getProperty('PRESENTATION_FOLDER_ID');
  if(!folderId) {
    const folder=DriveApp.createFolder('GU Capstone - Project Presentations');
    folderId=folder.getId();
    props.setProperty('PRESENTATION_FOLDER_ID',folderId);
  }
  const folder=DriveApp.getFolderById(folderId);
  const message='Presentation uploads ready. Private teacher folder: '+folder.getUrl();
  console.log(message);
  return message;
}

function presentationUploadStatus() {
  const ready=typeof PropertiesService!=='undefined' && !!PropertiesService.getScriptProperties().getProperty('PRESENTATION_FOLDER_ID');
  return {ready,maxBytes:PRESENTATION_MAX_BYTES,maxSlides:8,extension:'.pptx'};
}

function presentationRecord(rows,h,teamId,step,allowStep7) {
  const ix=n=>h.indexOf(n);
  if(ix('Presentation URL')<0) return null;
  const latest=s=>rows.slice(1).filter(r=>r[ix('Team ID')]===teamId && r[ix('Step')]===s)
    .sort((a,b)=>Number(b[ix('Version')])-Number(a[ix('Version')]))[0];
  const row=latest(step)||(allowStep7 && step==='STEP_8'?latest('STEP_7'):null);
  if(!row || !row[ix('Presentation URL')]) return null;
  return {
    url:row[ix('Presentation URL')],name:row[ix('Presentation File Name')],
    slides:Number(row[ix('Presentation Slides')]),size:Number(row[ix('Presentation Size Bytes')]),
    sha256:row[ix('Presentation SHA256')],sourceStep:row[ix('Step')]
  };
}

// Check the central directory before expanding a ZIP to bound memory use.
function inspectPresentationZip(bytes) {
  const u8=i=>bytes[i]&255;
  const u16=i=>u8(i)+u8(i+1)*256;
  const u32=i=>u16(i)+u16(i+2)*65536;
  if(bytes.length<22 || u32(0)!==0x04034b50) throw new Error('Save an unencrypted PowerPoint .pptx file and upload it.');
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if(u32(i)===0x06054b50 && i+22+u16(i+20)===bytes.length) {end=i;break;}
  }
  if(end<0 || u16(end+4)!==0 || u16(end+6)!==0 || u16(end+8)!==u16(end+10)) throw new Error('The PowerPoint file is damaged or unsupported.');
  const count=u16(end+10),size=u32(end+12),offset=u32(end+16);
  if(count<1 || count>2500 || offset+size!==end) throw new Error('The PowerPoint file is too complex or damaged.');
  let pos=offset,expanded=0; const names=[];
  for(let i=0;i<count;i++) {
    if(pos+46>end || u32(pos)!==0x02014b50) throw new Error('The PowerPoint file is damaged.');
    const flags=u16(pos+8),method=u16(pos+10),unpacked=u32(pos+24);
    const length=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32);
    if((flags&1) || ![0,8].includes(method) || pos+46+length+extra+comment>end) throw new Error('Use a standard, unencrypted .pptx file.');
    const name=Utilities.newBlob(bytes.slice(pos+46,pos+46+length)).getDataAsString('UTF-8');
    if(names.indexOf(name)>=0 || /(^|[/\\])\.\.([/\\]|$)/.test(name) || /^[\/\\]/.test(name) || /vbaProject\.bin$/i.test(name)) throw new Error('Use a standard PowerPoint .pptx without macros.');
    if(name==='ppt/presentation.xml' && unpacked>512*1024) throw new Error('The PowerPoint file is too complex.');
    expanded+=unpacked;
    if(expanded>50*1024*1024) throw new Error('Compress the images in your presentation and upload it again.');
    names.push(name);pos+=46+length+extra+comment;
  }
  if(pos!==end || !names.includes('[Content_Types].xml') || !names.includes('ppt/presentation.xml')) throw new Error('This file is not a valid PowerPoint presentation.');
  return names;
}

function validatePresentationUpload(upload) {
  if(!upload || typeof upload!=='object' || Array.isArray(upload)) throw new Error('Choose your PowerPoint .pptx presentation.');
  const name=String(upload.name||'').trim(),data=upload.base64;
  if(name.length>140 || !/^[^\/\\\x00-\x1f]+\.pptx$/i.test(name)) throw new Error('Upload a .pptx file. Use Save As to convert an older .ppt file.');
  if(typeof data!=='string' || !data || data.length>4*Math.ceil(PRESENTATION_MAX_BYTES/3) || data.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error('Choose a valid PowerPoint file of at most 10 MB.');
  let bytes,names,parts,slides;
  try {
    bytes=Utilities.base64Decode(data);
    if(bytes.length>PRESENTATION_MAX_BYTES) throw new Error('Choose a PowerPoint file of at most 10 MB.');
    names=inspectPresentationZip(bytes);
    parts=Utilities.unzip(Utilities.newBlob(bytes,'application/zip','presentation.zip'));
    const xml=parts.find(p=>p.getName()==='ppt/presentation.xml');
    const root=XmlService.parse(xml.getDataAsString('UTF-8')).getRootElement();
    const ns=XmlService.getNamespace('http://schemas.openxmlformats.org/presentationml/2006/main');
    const list=root.getChild('sldIdLst',ns);
    slides=list?list.getChildren('sldId',ns).length:0;
    if(slides!==names.filter(n=>/^ppt\/slides\/slide[0-9]+\.xml$/.test(n)).length) throw new Error('Slide records do not match.');
  } catch(error) { throw new Error(error.message||'The presentation could not be read. Save it again as .pptx.'); }
  if(slides<1 || slides>8) throw new Error('Use 1 to 8 slides in total, including title, hidden and appendix slides.');
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(b=>('0'+((b&255).toString(16))).slice(-2)).join('');
  return {name,bytes,slides,size:bytes.length,sha256:digest};
}

function preparePresentationSubmission(team,body,rows,h,step) {
  if(!['STEP_7','STEP_8'].includes(step)) return null;
  if(typeof body.requestId!=='string' || !/^[A-Za-z0-9_-]{8,100}$/.test(body.requestId)) throw new Error('Refresh the portal and submit again.');
  if(!presentationUploadStatus().ready || PRESENTATION_HEADERS.some((v,i)=>h[21+i]!==v)) throw new Error('Presentation uploads are being configured. Your earlier submissions are safe. Please try again later.');
  if(body.presentation) return {upload:validatePresentationUpload(body.presentation)};
  const existing=presentationRecord(rows,h,team.id,step,true);
  if(body.reusePresentation===true && existing) {
    const match=/^https:\/\/(?:drive\.google\.com\/file|docs\.google\.com\/presentation)\/d\/([A-Za-z0-9_-]+)(?:[/?#]|$)/.exec(existing.url);
    if(!match) throw new Error('Choose your presentation again.');
    try { if(DriveApp.getFileById(match[1]).isTrashed()) throw new Error('Trashed'); }
    catch(error) { throw new Error('Your earlier presentation is unavailable. Upload it again.'); }
    return {reuse:existing};
  }
  throw new Error('Upload your presentation, or select the saved presentation to reuse it.');
}

function savePresentationFile(prepared,team,step,version) {
  if(!prepared) return {cells:[],file:null};
  if(prepared.reuse) {
    const p=prepared.reuse;
    return {cells:[p.url,p.name,p.slides,p.size,p.sha256],file:null};
  }
  const u=prepared.upload;
  const folder=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('PRESENTATION_FOLDER_ID'));
  const storedName=team.id+'_'+step+'_v'+version+'_'+Utilities.getUuid()+'_'+u.name;
  const file=folder.createFile(Utilities.newBlob(u.bytes,PRESENTATION_MIME,storedName));
  return {cells:['https://drive.google.com/file/d/'+file.getId()+'/view',u.name,u.slides,u.size,u.sha256],file};
}
