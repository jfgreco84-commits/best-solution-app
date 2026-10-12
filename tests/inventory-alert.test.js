// v74: the Home "inventory counts to fix" card. SYNTHETIC FIXTURES ONLY.
//
//   node tests/inventory-alert.test.js
//
// Shows closed before the last garage recount are settled and never alert.
// A live problem says exactly which day and SKU, and the one-tap fix clears it.
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const cnt=o=>Object.assign({'32oz':0,'16oz':0,'8oz':0,'2oz':0,c5s:0,c5l:0},o);

function show(id,name,status,startDate,extra){
  const days=[ctx._bsBlankDay(1,'Sat'),ctx._bsBlankDay(2,'Sun')];
  days[0].morningCount=cnt({c5s:50}); days[0].eveningCount=cnt({c5s:40});
  days[1].morningCount=cnt({c5s:45}); days[1].eveningCount=cnt({c5s:30}); // opened 45, last night ended 40
  return Object.assign({id,name,location:'X',status,startDate,numDays:2,days,boothPayments:[],showExpenses:[],workers:[],repIds:[]},extra||{});
}
const OLD=show('old','McHenry County Fair','completed','2026-08-04');                                  // no completedAt, ended before recount
const OLD2=show('old2','St. Martins Fair','completed','2026-08-29',{completedAt:'2026-08-31T03:00:00Z'});
const NEW=show('new','Burgoo Fest','completed','2026-10-10',{completedAt:'2026-10-12T01:00:00Z'});
const LIVE=show('live','Fall Market','active','2026-10-11');
ctx.S={v:7,inventory:{},shows:[OLD,OLD2,NEW,LIVE],reps:[],settings:{audit:{baseline:'2026-09-23T15:00:00Z',log:[]}},_applied:{},transfers:[]};

R.section('Settled shows stay quiet');
chk('old show still red underneath',ctx.invStatus(OLD),'red');
chk('old show settled (end date fallback)',ctx.invSettled(OLD),true);
chk('old show settled (completedAt)',ctx.invSettled(OLD2),true);
chk('post-recount show not settled',ctx.invSettled(NEW),false);
chk('active show never settled',ctx.invSettled(LIVE),false);
chk('alert lists only live problems',ctx.invAlertShows().map(s=>s.id),['new','live']);

R.section('The message says exactly what is wrong');
const xs=ctx.invIssues(LIVE);
chk('one issue',xs.length,1);
chk('names day + SKU + both numbers',/Sun: opened with 45 C5-?S.*last night ended 40/i.test(xs[0].text),true);
chk('two fixes offered',xs[0].fixes.map(f=>f.label),["↩︎ Use last night's count",'✓ Morning count is right']);

R.section('One tap clears it');
ctx.invFix('carry','live',1);
chk('opening reset to 40',LIVE.days[1].morningCount.c5s,40);
chk('live show clean',ctx.invStatus(LIVE),'green');
ctx.invFix('keep','new',1);
chk('kept count stays 45',NEW.days[1].morningCount.c5s,45);
chk('kept show reviewed (yellow)',ctx.invStatus(NEW),'yellow');
chk('nothing left to alert',ctx.invAlertShows().length,0);

R.section('No baseline yet: nothing is treated as settled');
ctx.S.settings.audit={log:[]};
chk('old show alerts without a recount',ctx.invSettled(OLD),false);
R.done();
