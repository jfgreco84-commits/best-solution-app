// v89: Garage History, audit "Hide this" + Fox & Found / Andre hidden, and the
// Oct 22 garage count put back. SYNTHETIC FIXTURES.
//
//   node tests/garage-history-v89.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(), chk=R.check;
const COUNT={'32oz':118,'16oz':141,'8oz':263,'2oz':352,c5s:517,c5l:300};

R.section('1. Every garage change is logged with a reason');
{ const h=boot(), x=h.ctx;
  x.S.settings=x.S.settings||{}; x.S.settings.garageLog=[];
  x.localStorage.removeItem('dd_bs_garage_seen'); x.garageCheck('baseline');
  x.adjInv('32oz',1);
  let L=x.S.settings.garageLog;
  chk('1a. + button logged',[L.length,L[0].changes['32oz'],/\+ button/.test(L[0].why)],[1,1,true]);
  x.setInv('2oz',(x.S.inventory['2oz']||0)+5);
  chk('1b. typed count logged',[L.length,L[1].changes['2oz'],L[1].why],[2,5,'typed on the Stock page']);
  x.saveS();
  chk('1c. a save with no garage change logs nothing',L.length,2);
  chk('1d. shown on the Stock page',/Garage History/.test(x.garageHistoryHTML()),true);
  // a change that happens while the app is closed (cloud copy, update) is caught on open
  const before=x.S.inventory.c5l||0; x.S.inventory.c5l=before-7;
  chk('1e. caught with the given reason',x.garageCheck('loaded the cloud copy').why,'loaded the cloud copy');
}

R.section('2. Audit items can be hidden for good; Fox & Found and Andre are hidden');
{ const h=boot(), x=h.ctx;
  const a=x.auditState(x.S); a.hidden={}; x.S.inventory.c5l=-1;
  const raw=x.auditAllRaw(x.S);
  chk('2a. there is something to test with',raw.length>0,true);
  const first=raw[0]; x.auditHide(x.auditHideKey(first));
  chk('2b. hidden item is gone',x.auditAll(x.S).some(y=>x.auditHideKey(y)===x.auditHideKey(first)),false);
  // the one-time hide
  const d=JSON.parse(JSON.stringify(x.S));
  d.shows.push({id:'sh_ff_test',name:'Fox & Found - North Aurora (Oct)',startDate:'2026-10-17',status:'completed',days:[]});
  d.reps=(d.reps||[]).concat([{id:'rep_andre_1780776467102',name:'Andre',payments:[]}]);
  delete d._applied.audit_hide_fox_andre_v89;
  x.applyOneTimeUpdates(d);
  const hid=d.settings.audit.hidden;
  chk('2c. Fox & Found show hidden (all items)',!!hid['sh_ff_test|*'],true);
  chk('2d. Andre overpaid hidden',!!hid['rep|rep_andre_1780776467102'],true);
  const fake={sev:'gold',showId:'sh_ff_test',code:'zeroSale',key:'k'};
  chk('2e. a Fox & Found item is filtered out',[fake].filter(y=>!hid[x.auditHideKey(y)]&&!(y.showId&&hid[y.showId+'|*'])).length,0);
}

R.section('3. Oct 22 garage count put back, only when nothing moved since');
const run=(mut)=>{ const x=boot().ctx; const d=JSON.parse(JSON.stringify(x.S));
  d.inventory={'32oz':100,'16oz':100,'8oz':100,'2oz':100,c5s:100,c5l:100}; d.transfers=[]; d.settings=d.settings||{}; d.settings.garageLog=[];
  d.shows=(d.shows||[]).filter(sh=>!(String(sh.startDate||'')>='2026-10-23'&&(sh.status==='active'||sh.status==='completed'||sh.packedInventory)));
  if(mut)mut(d); delete d._applied.garage_count_oct22_v89; const r=x.garageCountOct22(d); if(r)d._applied.garage_count_oct22_v89=true; return {x,d}; };
{ const {d}=run();
  chk('3a. garage set to the count',d.inventory,COUNT);
  const e=d.settings.garageLog.slice(-1)[0];
  chk('3b. logged with what changed',[/Oct 22/.test(e.why),e.changes['32oz'],e.changes.c5s],[true,18,417]);
  chk('3c. marked done',d._applied.garage_count_oct22_v89,true); }
{ const {d}=run(d=>d.transfers.push({ts:'2026-10-23T14:00:00.000Z',sku:'c5s',qty:5}));
  chk('3d. a transfer after the count: garage left alone',d.inventory.c5s,100); }
{ const {d}=run(d=>d.shows.push({id:'x',name:'Fair',startDate:'2026-10-23',status:'active',packedInventory:{c5s:20},days:[]}));
  chk('3e. a show packed after the count: garage left alone',d.inventory.c5s,100); }
{ const {d}=run(d=>{d.inventory={};});
  chk('3f. blank device waits',[d.inventory.c5s,!!d._applied.garage_count_oct22_v89],[undefined,false]); }
{ const x=boot().ctx; const d=JSON.parse(JSON.stringify(x.S)); d.inventory={'32oz':900,'16oz':900,'8oz':900,'2oz':900,c5s:900,c5l:900}; d.transfers=[];
  d.shows=(d.shows||[]).filter(sh=>!(String(sh.startDate||'')>='2026-10-23'&&(sh.status==='active'||sh.status==='completed'||sh.packedInventory)));
  delete d._applied.garage_count_oct22_v89; x.applyOneTimeUpdates(d);
  chk('3g. runs inside applyOneTimeUpdates, last',[d.inventory.c5s,d._applied.garage_count_oct22_v89],[517,true]); }
R.section('4. v90: the Fair to Remember pack does not block putting the count back');
{ const {d}=run(d=>d.shows.push({id:'ftr',name:'A Fair to Remember, Fall',startDate:'2026-10-23',status:'active',packedInventory:{c5s:70},days:[]}));
  chk('4a. v89 rule still skips (show packed)',d.inventory.c5s,100); }
{ const x=boot().ctx; const d=JSON.parse(JSON.stringify(x.S));
  d.inventory={'32oz':106,'16oz':121,'8oz':216,'2oz':292,c5s:447,c5l:265}; d.transfers=[]; d.settings=d.settings||{}; d.settings.garageLog=[];
  d.shows=(d.shows||[]).filter(sh=>!(String(sh.startDate||'')>='2026-10-23'&&!/fair to remember/i.test(sh.name||'')&&(sh.status==='active'||sh.status==='completed'||sh.packedInventory)));
  d.shows.push({id:'ftr2',name:'A Fair to Remember, Fall',startDate:'2026-10-23',status:'active',packedInventory:{'32oz':12,'16oz':20,'8oz':47,'2oz':60,c5s:70,c5l:35},days:[]});
  const r=x.garageCountOct22(d,/fair to remember/i);
  chk('4b. garage back to the count',[r,d.inventory],[true,COUNT]);
  chk('4c. show keeps its 244',Object.values(d.shows.find(s=>s.id==='ftr2').packedInventory).reduce((a,b)=>a+b,0),244);
  chk('4d. logged as v90',/v90/.test(d.settings.garageLog.slice(-1)[0].why),true); }
{ const x=boot().ctx; const d=JSON.parse(JSON.stringify(x.S)); d.transfers=[];
  d.shows.push({id:'other',name:"Chicago Women's Expo",startDate:'2026-10-24',status:'active',packedInventory:{c5s:5},days:[]});
  d.inventory={c5s:900};
  chk('4e. another show packed: left alone',[x.garageCountOct22(d,/fair to remember/i),d.inventory.c5s],[true,900]); }
R.done();
