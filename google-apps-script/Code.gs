const CONFIG = {
  registrations: 'Registrations',
  capacity: 'Project Capacity',
  secret: 'REPLACE_WITH_A_LONG_RANDOM_SECRET'
};

function doGet() {
  const rows = SpreadsheetApp.getActive().getSheetByName(CONFIG.capacity).getDataRange().getValues();
  return json({projects: rows.slice(1).map(r => ({id:r[0], title:r[1], max:Number(r[2]), reserved:Number(r[3]), remaining:Number(r[4]), availability:r[5]}))});
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.secret !== CONFIG.secret) return json({ok:false, error:'Unauthorized'});
    const p = body.project;
    const team = body.team;
    if (!p || !team || !team.name || !team.members || team.members.length < 3 || team.members.length > 4) return json({ok:false, error:'Complete all required team details.'});
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const ss = SpreadsheetApp.getActive();
      const capacity = ss.getSheetByName(CONFIG.capacity);
      const values = capacity.getDataRange().getValues();
      const index = values.findIndex((row, i) => i && row[0] === p);
      if (index < 1 || Number(values[index][4]) < 1) return json({ok:false, error:'This project has just become full. Please select another project.'});
      const members = team.members.concat([{}, {}, {}, {}]).slice(0,4);
      const row = [Utilities.getUuid(), new Date(), 'Reserved', p, values[index][1], Number(values[index][3]) + 1, team.name];
      members.forEach(m => row.push(m.name || '',m.email || '',m.studentId || '',m.github || ''));
      row.push('', 'Confirmed', '');
      ss.getSheetByName(CONFIG.registrations).appendRow(row);
      SpreadsheetApp.flush();
      return json({ok:true, message:'Your team slot is reserved.', project:p});
    } finally { lock.releaseLock(); }
  } catch (err) { return json({ok:false, error:String(err)}); }
}

function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
