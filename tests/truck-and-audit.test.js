// v41 — the truck, and an app that audits itself. SYNTHETIC FIXTURES ONLY.
//
// The Sep 2026 garage count came up 40 C5 Large and 40 2oz short. Both were
// a morning count raised above what the show had packed (St. Martins C5L
// 42→84, Wine & Harvest 2oz 79→116): the app never took those bottles out of
// the garage, then sent them back at close. The rule that catches it:
//
//     EVERYTHING AT A SHOW IS EITHER ON A TABLE OR IN THE TRUCK.
//
// and the truck can never be negative. On a booth show the truck is real:
// booths pull from it, a booth opening above last night is a pull and not a
// mismatch, and the truck can be counted by hand and checked.
//
//   node tests/truck-and-audit.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};

function world(seed){
  const h=boot(seed);
  const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},
    insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},
    focus(){},click(){},scrollIntoView(){}});
  h.ctx.document.getElementById=id=>(els[id]||(els[id]=mk()));
  h.els=els;
  h.set=(id,v)=>{h.ctx.document.getElementById(id).value=String(v);};
  h.modal=()=>els['mb']?els['mb'].innerHTML:'';
  h.toast=()=>els['toast']?els['toast'].textContent:'';
  if(!seed){
    h.ctx.S.shows=[]; h.ctx.S.transfers=[];
    h.ctx.S.inventory=cnt({'32oz':50,'16oz':50,'8oz':100,'2oz':100,'c5s':400,'c5l':100});
  }
  return h;
}
function dayKey(offset){ const d=new Date(); d.setDate(d.getDate()+offset); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function newShow(ctx,o){
  const nd=o.numDays||1, start=o.startDate||dayKey(0);
  const days=[];for(let i=0;i<nd;i++)days.push(ctx._bsBlankDay(i+1,'Day '+(i+1)));
  return Object.assign({id:o.id,name:o.name,status:'active',numDays:nd,
    location:'Somewhere, WI',miles:0,boothCost:0,boothPayments:[],dates:days.map(d=>d.date),
    showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true,lodging:0,packedInventory:null},o,{days,numDays:nd,startDate:start});
}
const codes=(ctx,sh)=>ctx.auditShow(sh).map(x=>x.code);

// ===========================================================================
R.section('1. The St. Martins mistake is caught the moment it is saved');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'sm',name:'St. Martins',numDays:2,startDate:dayKey(0)});
  sh.packedInventory=cnt({'c5l':42}); sh.days[0].morningCount=cnt({'c5l':42}); ctx.S.shows.push(sh);
  chk('1a. packed 42, table 42: clean',codes(ctx,sh),[]);
  sh.days[0].morningCount=cnt({'c5l':84}); sh.days[0].eveningCount=cnt({'c5l':62});
  const iss=ctx.auditShow(sh);
  chk('1b. table 84 of a show that has 42: flagged red',iss.map(x=>x.code+':'+x.sev),['overTable:red']);
  chk('1c. the message names the size and the overage',/C5-L 84 counted, only 42 here \(\+42\)/.test(iss[0].msg),true);
  chk('1d. the ledger puts the truck at −42',ctx.showLedger(sh)[0].truck.c5l,-42);
  chk('1e. and it rolls into auditAll',ctx.auditAll().some(x=>x.code==='overTable'&&x.showId==='sm'),true);
  chk('1f. the reconciliation light goes red too',ctx.invStatus(sh),'red');
}

// ===========================================================================
R.section('2. A day that opened but never closed, and money with no count');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'x',name:'Two Day',numDays:2,startDate:dayKey(-2)});
  sh.packedInventory=cnt({'2oz':50});
  sh.days[0].morningCount=cnt({'2oz':50}); sh.days[0].eveningCount=cnt({'2oz':40});
  sh.days[1].morningCount=cnt({'2oz':40});
  ctx.S.shows.push(sh);
  chk('2a. yesterday opened and was never closed: red',codes(ctx,sh).indexOf('noClose')>=0,true);
  sh.days[1].eveningCount=cnt({'2oz':30});
  chk('2b. once counted: gone',codes(ctx,sh).indexOf('noClose'),-1);
  sh.days[1].eveningCount=null; sh.days[1].payments.cash=80;
  chk('2c. money on a day with no close count: red',codes(ctx,sh).indexOf('moneyNoCount')>=0,true);
  const today=newShow(ctx,{id:'t',name:'Today',numDays:1,startDate:dayKey(0)});
  today.packedInventory=cnt({'2oz':10}); today.days[0].morningCount=cnt({'2oz':10}); ctx.S.shows.push(today);
  chk('2d. today, still open: not a problem yet',codes(ctx,today),[]);
}

// ===========================================================================
R.section('3. Close Show is gated, and remembers what it sent home');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=newShow(ctx,{id:'c',name:'Closer',numDays:2,startDate:dayKey(-2)});
  sh.packedInventory=cnt({'8oz':30}); sh.days[0].morningCount=cnt({'8oz':30}); sh.days[0].eveningCount=cnt({'8oz':25});
  sh.days[1].morningCount=cnt({'8oz':25});
  ctx.S.shows.push(sh);
  ctx.endShow('c');
  chk('3a. an uncounted day blocks: the modal says fix these first',h.modal().indexOf('Fix these before you close')>=0,true);
  chk('3b. and the button reads Close anyway',h.modal().indexOf('Close anyway')>=0,true);
  sh.days[1].eveningCount=cnt({'8oz':20});
  ctx.endShow('c');
  chk('3c. all counted: audit clean',h.modal().indexOf('Audit clean')>=0,true);
  const g0=ctx.S.inventory['8oz'];
  ctx.confirmEndShow('c');
  chk('3d. 20 went home',ctx.S.inventory['8oz']-g0,20);
  chk('3e. the show remembers exactly that',sh.returned['8oz'],20);
  // Anthony's recount after close: 20 → 29. v40 never sent the 9 home.
  sh.days[1].eveningCount=cnt({'8oz':29});
  ctx.saveS();
  chk('3f. the garage follows the recount (+9)',ctx.S.inventory['8oz']-g0,29);
  chk('3g. and the show now remembers 29',sh.returned['8oz'],29);
  chk('3h. the show log says why',(sh.invLog||[]).some(e=>e.type==='garage re-synced'&&/8oz \+9/.test(e.changes[0])),true);
  chk('3i. so does the audit log',ctx.auditState().log.some(e=>/Closer: garage 8oz \+9/.test(e.msg)),true);
  ctx.saveS();
  chk('3j. a second save moves nothing',ctx.S.inventory['8oz']-g0,29);
}

// ===========================================================================
R.section('4. Cranberry: three booths and a truck');
// ===========================================================================
function cranberry(h){
  const {ctx}=h;
  const sh=newShow(ctx,{id:'cr',name:'Cranberry',numDays:3,startDate:dayKey(0),status:'planned'});
  ctx.S.shows.push(sh);
  ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
  return sh;
}
{
  const h=world(),{ctx}=h;
  const sh=cranberry(h); const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);
  // Take everything.
  ctx.showPackModal('cr'); ctx.pkAll('cr');
  SK.forEach(k=>h.set('pk_'+k,ctx.S.inventory[k]));
  ctx.confirmPack('cr');
  chk('4a. garage emptied into the show',SK.map(k=>ctx.S.inventory[k]),[0,0,0,0,0,0]);
  chk('4b. packed = everything',sh.packedInventory.c5s,400);
  chk('4c. before any booth is counted, all of it is in the truck',ctx.truckNow(sh).c5s,400);
  chk('4d. and the day has no fake morning count',sh.days[0].morningCount,null);
  chk('4e. Stock tab: the show is holding all 400',ctx.showOnHand(sh).c5s,400);
  // Each booth takes what it needs.
  ctx.boothSetStock(sh,0,A,'morning',cnt({'c5s':60,'2oz':20}));
  ctx.boothSetStock(sh,0,B,'morning',cnt({'c5s':50,'2oz':20}));
  ctx.boothSetStock(sh,0,C,'morning',cnt({'c5s':40,'2oz':20}));
  chk('4f. truck = 400 − 150 on the booths',ctx.truckNow(sh).c5s,250);
  chk('4g. 2oz truck = 100 − 60',ctx.truckNow(sh)['2oz'],40);
  chk('4h. still holding everything',ctx.showOnHand(sh).c5s,400);
  chk('4i. clean',codes(ctx,sh),[]);
  // Booth 2 runs low: 20 more off the truck as a booth restock.
  const en=ctx.dayBoothWrite(sh.days[0],B); en.restock=cnt({'c5s':20}); ctx.rollupDay(sh,0);
  chk('4j. restock at a booth comes off the truck',ctx.truckNow(sh).c5s,230);
  // Close: booth A 40, B 30, C 25 left.
  ctx.boothSetStock(sh,0,A,'evening',cnt({'c5s':40,'2oz':15}));
  ctx.boothSetStock(sh,0,B,'evening',cnt({'c5s':30,'2oz':15}));
  ctx.boothSetStock(sh,0,C,'evening',cnt({'c5s':25,'2oz':15}));
  chk('4k. day 1 sold 75 C5S across the booths',ctx.daySold(sh.days[0]).c5s,75);
  chk('4l. show now holds 400 − 75',ctx.showOnHand(sh).c5s,325);
  // Day 2: booth A opens with MORE than last night: that is a truck pull, not a mismatch.
  ctx.boothSetStock(sh,1,A,'morning',cnt({'c5s':70,'2oz':15}));
  ctx.boothSetStock(sh,1,B,'morning',cnt({'c5s':30,'2oz':15}));
  ctx.boothSetStock(sh,1,C,'morning',cnt({'c5s':25,'2oz':15}));
  chk('4m. no carry mismatch on a booth show',ctx.invCarryIssues(sh),[]);
  chk('4n. reconciliation stays green',ctx.invStatus(sh),'green');
  chk('4o. the truck gave 30 to booth A',ctx.truckNow(sh).c5s,325-125);
  chk('4p. the booth card calls it a truck pull',/30 off the truck/.test(ctx.boothDayCardHTML(sh,1,ctx.showBooths(sh)[0])),true);
  chk('4q. the day screen shows the truck card',/🚚 Truck/.test(ctx.truckCardHTML(sh,1)),true);
  // Pull more than the truck has: caught.
  ctx.boothSetStock(sh,1,C,'morning',cnt({'c5s':500,'2oz':15}));
  chk('4r. a booth holding more than the show has: red',codes(ctx,sh).indexOf('overTable')>=0,true);
  chk('4s. and the reconciliation light goes red',ctx.invStatus(sh),'red');
  ctx.boothSetStock(sh,1,C,'morning',cnt({'c5s':25,'2oz':15}));
  chk('4t. fixed: clean again',codes(ctx,sh),[]);
}

// ===========================================================================
R.section('5. Counting the truck by hand');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=cranberry(h); const [A]=ctx.showBooths(sh).map(b=>b.id);
  sh.status='active'; sh.packedInventory=cnt({'c5l':100});
  ctx.boothSetStock(sh,0,A,'morning',cnt({'c5l':30}));
  chk('5a. truck expected 70',ctx.truckNow(sh).c5l,70);
  const ok=ctx.saveTruckCount('cr',0,cnt({'c5l':70}));
  chk('5b. a matching truck count: no diff',ok.res.any,false);
  chk('5c. no audit finding',codes(ctx,sh).indexOf('truckCount'),-1);
  ctx.saveTruckCount('cr',0,cnt({'c5l':66}));
  chk('5d. 4 short: flagged gold',ctx.auditShow(sh).filter(x=>x.code==='truckCount').map(x=>x.sev),['gold']);
  chk('5e. and the truck card shows the gap',/\(-4\)/.test(ctx.truckCardHTML(sh,0)),true);
  ctx.openTruckCount('cr',0);
  chk('5f. the count modal shows what the app expects',/App expects: 70/.test(h.modal()),true);
}

// ===========================================================================
R.section('6. Garage → truck delivery, and undo');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=cranberry(h); const [A]=ctx.showBooths(sh).map(b=>b.id);
  sh.status='active'; sh.packedInventory=cnt({'2oz':40});
  ctx.S.inventory['2oz']=100;
  ctx.boothSetStock(sh,0,A,'morning',cnt({'2oz':20}));
  ctx.openTransferModal('cr');
  chk('6a. a booth show defaults to the truck',ctx._trState.booth,'truck');
  chk('6b. and the picker offers it',/🚚 Truck \(booths pull from it\)/.test(h.modal()),true);
  const r=ctx.garageToShow(sh,'2oz',30,0,'truck');
  chk('6c. delivered',r.ok,true);
  chk('6d. garage 100 → 70',ctx.S.inventory['2oz'],70);
  chk('6e. packed 40 → 70',sh.packedInventory['2oz'],70);
  chk('6f. booth A count untouched',ctx.dayBoothRead(sh.days[0],A).morningCount['2oz'],20);
  chk('6g. truck 20 → 50',ctx.truckNow(sh)['2oz'],50);
  chk('6h. survives a rollup',(ctx.rollupDay(sh,0),ctx.truckNow(sh)['2oz']),50);
  chk('6i. clean',codes(ctx,sh),[]);
  const u=ctx.garageToShowUndo(ctx.S.transfers[ctx.S.transfers.length-1]);
  chk('6j. undo',u.ok,true);
  chk('6k. everything back',[ctx.S.inventory['2oz'],sh.packedInventory['2oz'],ctx.truckNow(sh)['2oz']],[100,40,20]);
}

// ===========================================================================
R.section('7. Booth crews');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=cranberry(h); const [A,B]=ctx.showBooths(sh).map(b=>b.id);
  if(!ctx.S.reps.some(r=>r.id==='rep_cutty'))ctx.S.reps.push({id:'rep_cutty',name:'Cutty',active:true,isSelf:false,payments:[]});
  const own=ctx.S.reps.find(r=>r.isSelf);
  ctx.setBoothReps(sh,A,[own.id,'rep_cutty']);
  chk('7a. booth 1 crew',ctx.boothCrewLabel(sh,A),own.name+' + Cutty');
  chk('7b. the crew joins the show',sh.repIds.indexOf('rep_cutty')>=0,true);
  ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
  chk('7c. renaming booths keeps the crew',ctx.boothRepIds(sh,A),[own.id,'rep_cutty']);
  chk('7d. the booth card names them',/Cutty/.test(ctx.boothDayCardHTML(sh,0,ctx.showBooths(sh)[0])),true);
  ctx.showMoneyModal('cr',0,A);
  chk('7e. booth 1 money split offers Cutty',ctx._mm.ids.indexOf('rep_cutty')>=0,true);
  ctx.openBoothsModal('cr');
  chk('7f. the booth manager has crew buttons',/boothCrewToggle\(0,'rep_cutty'\)/.test(h.modal()),true);
  ctx.boothCrewToggle(1,'rep_cutty'); ctx.saveBooths();
  chk('7g. toggled onto booth 2 and saved',ctx.boothRepIds(sh,B),['rep_cutty']);
}

// ===========================================================================
R.section('8. The Sep 23 garage recount only lands on untouched numbers');
// ===========================================================================
{
  const base=world(); const INIT=JSON.parse(JSON.stringify(base.ctx.INIT));
  // A real device has every earlier one-time update applied already; only v41's are new.
  const done=Object.assign({},base.ctx.S._applied);
  ['garage_recount_20260923','audit_baseline_v41','cutty_cranberry_v41'].forEach(k=>delete done[k]);
  const mk=inv=>{ const d=JSON.parse(JSON.stringify(INIT)); d.inventory=inv; d._applied=Object.assign({},done); return {dd_bs_v7:JSON.stringify(d)}; };
  const old={'32oz':78,'16oz':136,'8oz':249,'2oz':316,c5s:739,c5l:264};
  const a=world(mk(old));
  chk('8a. exact old numbers: set to the physical count',SK.map(k=>a.ctx.S.inventory[k]),[77,134,259,276,859,224]);
  chk('8b. logged',a.ctx.auditState().log.some(e=>/Sep 23 physical count/.test(e.msg)),true);
  const moved=Object.assign({},old,{c5s:700});
  const b=world(mk(moved));
  chk('8c. anything already moved: untouched',b.ctx.S.inventory.c5s,700);
  chk('8d. every device gets an audit start date',!!b.ctx.auditState().baseline,true);
  chk('8e. Cutty is on the roster and active',!!b.ctx.S.reps.find(r=>r.id==='rep_cutty'&&r.active),true);
  chk('8f. no new top-level state key',Object.keys(a.ctx.S).filter(k=>/audit/i.test(k)),[]);
}

// ===========================================================================
R.section('9. History before the recount is left alone');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'old',name:'Old Show',numDays:1,startDate:'2026-09-06',status:'completed'});
  sh.completedAt='2026-09-10T20:00:00Z';
  sh.packedInventory=cnt({'c5l':42}); sh.days[0].morningCount=cnt({'c5l':84}); sh.days[0].eveningCount=cnt({'c5l':48});
  ctx.S.shows.push(sh);
  ctx.auditState().baseline='2026-09-23T12:00:00Z';
  chk('9a. closed before the recount: not re-flagged',ctx.auditShow(sh),[]);
  ctx.auditState().baseline='2026-09-01T00:00:00Z';
  chk('9b. closed after it: flagged',codes(ctx,sh),['overTable']);
}

// ===========================================================================
R.section('10. Crews rotate: each day says who is in which booth');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=cranberry(h); const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);
  ['a','b','c','d','e','f'].forEach(x=>ctx.S.reps.push({id:'r_'+x,name:x.toUpperCase(),active:true,isSelf:false,payments:[]}));
  ctx.setBoothReps(sh,A,['r_a','r_b']);
  chk('10a. no day entry: the booth default is used',ctx.dayBoothCrew(sh,0,A),['r_a','r_b']);
  // Day 1 by hand.
  [['r_a',A],['r_b',A],['r_c',B],['r_d',B],['r_e',C],['r_f',C]].forEach(([r,b])=>{ if(ctx.dayBoothCrew(sh,0,b).indexOf(r)<0)ctx.dayCrewToggle(sh,0,b,r); });
  chk('10b. day 1 booths',[A,B,C].map(b=>ctx.dayBoothCrew(sh,0,b)),[['r_a','r_b'],['r_c','r_d'],['r_e','r_f']]);
  // Day 2: rotate.
  ctx.dayCrewRotateFrom(sh,1);
  chk('10c. day 2 rotated: booth 1 has booth 3 crew, booth 2 has booth 1 crew',[A,B,C].map(b=>ctx.dayBoothCrew(sh,1,b)),[['r_e','r_f'],['r_a','r_b'],['r_c','r_d']]);
  chk('10d. day 1 did not change',ctx.dayBoothCrew(sh,0,A),['r_a','r_b']);
  // One person, one booth per day.
  ctx.dayCrewToggle(sh,1,C,'r_a');
  chk('10e. moving A to booth 3 takes A off booth 2 that day',[ctx.dayBoothCrew(sh,1,B),ctx.dayBoothCrew(sh,1,C)],[['r_b'],['r_c','r_d','r_a']]);
  chk('10f. the booth card shows the day crew',/E \+ F/.test(ctx.boothDayCardHTML(sh,1,ctx.showBooths(sh)[0])),true);
  ctx.showMoneyModal('cr',1,A);
  chk('10g. booth 1 money split on day 2 offers E and F first',ctx._mm.ids.slice(0,2),['r_e','r_f']);
  chk('10h. everyone who worked is on the show',['r_a','r_b','r_c','r_d','r_e','r_f'].every(r=>sh.repIds.indexOf(r)>=0),true);
  ctx.openDayCrews('cr',1);
  chk('10i. the crew screen offers the rotate button',/Rotate from/.test(h.modal()),true);
  chk('10j. and the day screen has the button',/Who's in which booth today/.test(ctx.dayBoothsHTML(sh,1)),true);
}

R.done();
