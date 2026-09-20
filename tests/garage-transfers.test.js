// Bringing more product from the garage to a show that is already running —
// SYNTHETIC FIXTURES ONLY.
//
// v38 gave Transfer Stock a garage source. v39 changes WHERE a delivery lands
// and lets every size come in one tap. The rule now:
//
//     A DELIVERY IS PART OF THE OPENING COUNT.
//
// What comes from the garage for a day is written to day.garageIn (per booth
// on a booth show, rolled up to the day) and added straight onto that day's
// morning count if it is already in; if it is not in yet, the morning count
// defaults to last night's ending + what was brought. The reconciliation
// ladder expects exactly that, so the number on the table and the number on
// the screen agree with no flag, and sold is still opening + restock − ending
// with nothing counted twice. Restock is left for what it always meant.
//
// The three-way invariant from v38 still holds: garage down, packed up, the
// day up, all by the same amount, so garage + at-shows never changes by a
// unit and undo puts all three back. Section 9 pins the one-time migration
// of v38 rows (which landed as restock) onto the opening count.
//
//   node tests/garage-transfers.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const tot=o=>SK.reduce((t,k)=>t+((o&&o[k])||0),0);

function world(){
  const h=boot();
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
  h.save=()=>{h.ctx.window.__lastSave=0;h.ctx.saveTransfer();};   // _dupGuard would swallow a second save inside 900ms
  h.qty=o=>{SK.forEach(k=>h.set('tr_q_'+k,o[k]||0));};              // stub inputs persist between opens, so every size is set
  h.short=k=>(h.ctx.SKUS.find(s=>s.key===k)||{}).short||k;
  // The count modal writes its defaults into the rendered HTML; read them
  // back from there, and copy them onto the stub inputs before a save the
  // way a person accepting the defaults would.
  h.cval=id=>{const m=new RegExp('id="'+id+'" value="(\\d+)"').exec(h.modal());return m?m[1]:null;};
  h.fillCounts=()=>{SK.forEach(k=>h.set('c_'+k,h.cval('c_'+k)||0));};
  // A clean board: no seeded shows, a known garage.
  h.ctx.S.shows=[]; h.ctx.S.transfers=[];
  h.ctx.S.inventory=cnt({'32oz':10,'c5s':200,'2oz':80,'8oz':60,'c5l':70});
  return h;
}
function dayKey(offset){ const d=new Date(); d.setDate(d.getDate()+offset); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function newShow(ctx,o){
  const nd=o.numDays||1, dates=o.dates||[];
  const days=[];for(let i=0;i<nd;i++){const d=ctx._bsBlankDay(i+1,dates[i]||('Day '+(i+1)));days.push(d);}
  return Object.assign({id:o.id,name:o.name,status:'planned',startDate:dates[0]||'2099-06-15',numDays:nd,
    location:'Somewhere, WI',miles:0,boothCost:0,boothPayments:[],days,dates:days.map(d=>d.date),
    showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true,lodging:0,packedInventory:null},o,{days,numDays:nd});
}
// Wine & Harvest Fest: two days, running, day 1 counted at close. Tonight.
// Day 2's morning is NOT pre-filled here so the "not counted yet" path is
// exercised; section 3 also covers the app's own evening → next-morning fill.
function runningShow(ctx,o){
  const sh=newShow(ctx,Object.assign({id:'wh',name:'Wine and Harvest Fest',numDays:2,status:'active',dates:[dayKey(0),dayKey(1)]},o||{}));
  sh.packedInventory=cnt({'c5s':100,'2oz':40});
  sh.days[0].morningCount=cnt({'c5s':100,'2oz':40});
  sh.days[0].eveningCount=cnt({'c5s':60,'2oz':30});
  ctx.S.shows.push(sh);
  return sh;
}

// ===========================================================================
R.section('1. The picker knows the garage, and takes every size at once');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  runningShow(ctx);
  ctx.S.shows.push(newShow(ctx,{id:'p1',name:'Next Weekend',status:'planned'}));
  chk('1a. a running show can take a garage delivery',ctx.garageDeliveryShows().map(s=>s.id),['wh']);
  chk('1b. a planned show cannot — that is Pack for Show',ctx.garageDeliveryShows().some(s=>s.id==='p1'),false);
  chk('1c. transferableShows is unchanged: active and planned, both',ctx.transferableShows().map(s=>s.id),['wh','p1']);

  ctx.openTransferModal('wh');
  const m=h.modal();
  chk('1d. opened from the running show, From is the garage',/<option value="garage" selected>/.test(m),true);
  chk('1e. and To is that show',/<option value="wh" selected>/.test(m),true);
  chk('1f. it asks which day the delivery is for',m.indexOf('id="tr_day"')>=0,true);
  chk('1g. no booth picker on a single-booth show',m.indexOf('id="tr_booth"')>=0,false);
  chk('1h. it says the units go onto the opening count',m.indexOf('opening count')>=0,true);
  chk('1i. the button brings it all',m.indexOf('Bring it all')>=0,true);
  chk('1j. the garage is only offered as a source, never a destination',
      /id="tr_to"[^>]*>[^]*?<\/select>/.exec(m)[0].indexOf('value="garage"')>=0,false);
  chk('1k. one quantity box per size, all six',SK.filter(k=>m.indexOf('id="tr_q_'+k+'"')>=0).length,6);
  chk('1l. no single-product picker any more',m.indexOf('id="tr_sku"')>=0,false);
  chk('1m. each row shows what the garage holds',m.indexOf('Garage: 200')>=0,true);

  ctx.openTransferModal();
  chk('1n. from the Stock tab the garage is the default source',/<option value="garage" selected>/.test(h.modal()),true);
  h.set('tr_from','p1'); ctx.trRefresh('from');
  const m2=h.modal();
  chk('1o. switching From to a show drops the garage landing pickers',m2.indexOf('id="tr_day"')>=0,false);
  chk('1p. and the rows now show what that show has packed',m2.indexOf('Packed: 0')>=0,true);
  chk('1q. and the show → show wording is the old one',m2.indexOf('Move packed units from one show to another')>=0,true);
}
{
  const h=world(),{ctx}=h;
  ctx.S.shows.push(newShow(ctx,{id:'p1',name:'A',status:'planned'}),newShow(ctx,{id:'p2',name:'B',status:'planned'}));
  ctx.openTransferModal();
  const m=h.modal();
  chk('1r. no running show, no garage option',m.indexOf('value="garage"')>=0,false);
  chk('1s. and two planned shows still transfer between each other',/<option value="p1" selected>/.test(m)&&/id="tr_to"[^>]*>[^]*?<option value="p2" selected>/.test(m),true);
}
{
  const h=world(),{ctx}=h;
  ctx.S.shows.push(newShow(ctx,{id:'p1',name:'A',status:'planned'}));
  ctx.openTransferModal();
  chk('1t. no running show and only one planned: no modal',h.modal(),'');
  chk('1u. the toast explains',/running show/.test(h.toast()),true);
}

// ===========================================================================
R.section('2. Which day the delivery is for');
// ===========================================================================
{
  const {ctx}=world();
  const sh=runningShow(ctx);
  chk('2a. tonight, day 1 counted at close: the delivery is for tomorrow',ctx.transferDefaultDay(sh),1);
  sh.days[0].eveningCount=null;
  chk('2b. mid-day, day 1 still open: it is for today',ctx.transferDefaultDay(sh),0);
  sh.days[0].eveningCount=cnt({'c5s':60}); sh.days[0].locked=true;
  chk('2c. day 1 locked: tomorrow',ctx.transferDefaultDay(sh),1);
  sh.days[1].eveningCount=cnt({'c5s':30});
  chk('2d. every day counted: the last day (the modal still lets you pick)',ctx.transferDefaultDay(sh),1);
  const old=newShow(ctx,{id:'old',name:'Ran Late',numDays:3,status:'active',dates:[dayKey(-2),dayKey(-1),dayKey(0)]});
  old.days[0].eveningCount=cnt({'c5s':5});
  chk('2e. a show whose earlier days went uncounted: the first open day on or after today',ctx.transferDefaultDay(old),2);
  old.days[2].locked=true;
  chk('2f. today locked and yesterday open: yesterday, the only open day',ctx.transferDefaultDay(old),1);
  chk('2g. labelled days (no dates) count as open',ctx.transferDefaultDay(newShow(ctx,{id:'x',name:'X',numDays:2,status:'active'})),0);
}

// ===========================================================================
R.section('3. A delivery is part of the opening count');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx);
  const everythingBefore=tot(ctx.S.inventory)+tot(ctx.atShowsInv());
  chk('3a. before: garage 200 C5S, show holding 60',[ctx.S.inventory.c5s,ctx.showOnHand(sh).c5s],[200,60]);

  const r=ctx.garageToShow(sh,'c5s',50,1,null);
  chk('3b. the delivery is accepted',r.ok,true);
  chk('3c. garage went down',ctx.S.inventory.c5s,150);
  chk('3d. the show packed total went up',sh.packedInventory.c5s,150);
  chk('3e. it is booked as brought-from-garage on TOMORROW, not today',[ctx.dayGarageIn(sh.days[1]).c5s,ctx.dayGarageIn(sh.days[0]).c5s],[50,0]);
  chk('3f. restock is untouched — that is not what this is',(sh.days[1].restock||{}).c5s||0,0);
  chk('3g. tomorrow has no morning count yet, so nothing was written to it',sh.days[1].morningCount,null);
  chk('3h. the show is holding it already',ctx.showOnHand(sh).c5s,110);
  chk('3i. the Stock tab agrees',ctx.atShowsInv().c5s,110);
  chk('3j. THE INVARIANT: garage + at-shows did not change by a unit',tot(ctx.S.inventory)+tot(ctx.atShowsInv()),everythingBefore);
  chk('3k. one ledger row, from the garage, landed on the opening',ctx.S.transfers.map(t=>[t.fromShowId,t.toShowId,t.sku,t.qty,t.di,t.landed]),[['garage','wh','c5s',50,1,'opening']]);
  chk('3l. the row names the day it is for',ctx.S.transfers[0].dayDate,dayKey(1));
  chk('3m. yesterday untouched: still sold 40',ctx.daySold(sh.days[0]).c5s,40);

  // Undo, then do it again — undo must put every one of the three back.
  chk('3n. undo is accepted',ctx.garageToShowUndo(ctx.S.transfers[0]).ok,true);
  chk('3o. garage 200, packed 100, brought 0, ledger empty, on hand 60',
      [ctx.S.inventory.c5s,sh.packedInventory.c5s,ctx.dayGarageIn(sh.days[1]).c5s,ctx.S.transfers.length,ctx.showOnHand(sh).c5s],[200,100,0,0,60]);
  ctx.garageToShow(sh,'c5s',50,1,null);

  // Tomorrow morning: open the count. The default is last night + brought.
  ctx.showCntModal('wh',1,'morning');
  chk('3p. the morning count defaults to 60 last night + 50 brought = 110',h.cval('c_c5s'),'110');
  chk('3q. and says so on the row',h.modal().indexOf('Last night: 60 + 🏠 50 brought = 110')>=0,true);
  chk('3r. a size that was not delivered defaults to last night alone',h.cval('c_2oz'),'30');
  h.fillCounts(); ctx.saveCount('wh',1,'morning',null);
  chk('3s. morning saved as 110',sh.days[1].morningCount.c5s,110);
  chk('3t. and there is NO reconciliation mismatch — 110 is what should be on the table',ctx.invCarryIssues(sh).length,0);
  chk('3u. the count modal did not warn',/NOT match/.test(h.toast()),false);
  chk('3v. on hand is the opening',ctx.showOnHand(sh).c5s,110);
  // Tomorrow night: 30 left on the table.
  sh.days[1].eveningCount=cnt({'c5s':30,'2oz':30});
  chk('3w. sold tomorrow = 110 opening − 30 ending = 80, no restock involved',ctx.daySold(sh.days[1]).c5s,80);
  chk('3x. no impossible sale flagged',ctx.invNegativeSold(sh).length,0);
  chk('3y. whole show sold 120',ctx.showUnitsSold(sh).c5s,120);
  chk('3z. end-of-show returns 30: packed 150 − sold 120 agrees with the last count',ctx.endShowReturns(sh).c5s,30);
  chk('3aa. garage + at-shows: the same total minus exactly what was sold',tot(ctx.S.inventory)+tot(ctx.atShowsInv()),everythingBefore-80);

  // Reopening the morning count keeps the number that is there — it never
  // silently drops back to last night and loses the delivery.
  sh.days[1].morningCount.c5s=112;   // a recount
  ctx.showCntModal('wh',1,'morning');
  chk('3ab. reopening the count shows the count that is in, not last night',h.cval('c_c5s'),'112');
}
{
  // The other order: the delivery is booked for tomorrow BEFORE tonight's
  // evening count is saved. The evening save pre-fills tomorrow's morning,
  // and that pre-fill must carry the delivery.
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx); sh.days[0].eveningCount=null;
  ctx.garageToShow(sh,'c5s',50,1,null);
  SK.forEach(k=>h.set('c_'+k,0)); h.set('c_c5s',60); h.set('c_2oz',30);
  ctx.saveCount('wh',0,'evening',null);
  chk('3ac. tonight\'s count pre-fills tomorrow as 60 + 50 brought',sh.days[1].morningCount.c5s,110);
  chk('3ad. a size with no delivery pre-fills as tonight\'s count alone',sh.days[1].morningCount['2oz'],30);
  chk('3ae. continuity is clean',ctx.invCarryIssues(sh).length,0);
}
{
  // Mid-day: the morning count is already in when the truck arrives.
  const {ctx}=world();
  const sh=runningShow(ctx); sh.days[0].eveningCount=null;   // still open today
  ctx.garageToShow(sh,'c5s',50,0,null);
  chk('3af. today\'s opening goes from 100 to 150 on the spot',sh.days[0].morningCount.c5s,150);
  chk('3ag. and is booked as brought',ctx.dayGarageIn(sh.days[0]).c5s,50);
  sh.days[0].eveningCount=cnt({'c5s':120,'2oz':40});
  chk('3ah. sold = 150 − 120 = 30',ctx.daySold(sh.days[0]).c5s,30);
  ctx.garageToShowUndo(ctx.S.transfers[0]);
  chk('3ai. undo takes it back off the opening',sh.days[0].morningCount.c5s,100);
}
{
  // The reconciliation ladder names the expectation when a morning is off.
  const {ctx}=world();
  const sh=runningShow(ctx);
  ctx.garageToShow(sh,'c5s',50,1,null);
  sh.days[1].morningCount=cnt({'c5s':60,'2oz':30});   // counted WITHOUT the delivery
  const iss=ctx.invCarryIssues(sh);
  chk('3aj. a morning that ignores the delivery IS flagged',iss.length,1);
  chk('3ak. and the issue says what was expected and why',[iss[0].prevEve,iss[0].brought,iss[0].expected,iss[0].morn,iss[0].diff],[60,50,110,60,-50]);
  ctx.fixCarryFromPrev('wh',1);
  chk('3al. "reset to last night" resets to last night + brought',sh.days[1].morningCount.c5s,110);
  chk('3am. which clears it',ctx.invCarryIssues(sh).length,0);
}

// ===========================================================================
R.section('4. Through the modal: every size in one tap');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx);
  sh.days[1].morningCount=cnt({'c5s':60,'2oz':30});   // the app's own pre-fill from last night
  ctx.openTransferModal('wh');
  h.qty({'2oz':25,'c5s':10,'8oz':48});
  h.save();
  chk('4a. saved three sizes at once: garage 2oz 80→55, C5S 200→190, 8oz 60→12',[ctx.S.inventory['2oz'],ctx.S.inventory.c5s,ctx.S.inventory['8oz']],[55,190,12]);
  chk('4b. packed up by the same',[sh.packedInventory['2oz'],sh.packedInventory.c5s,sh.packedInventory['8oz']],[65,110,48]);
  chk('4c. tomorrow\'s opening went up by the same',[sh.days[1].morningCount['2oz'],sh.days[1].morningCount.c5s,sh.days[1].morningCount['8oz']],[55,70,48]);
  chk('4d. booked as brought',ctx.dayGarageIn(sh.days[1]),cnt({'2oz':25,'c5s':10,'8oz':48}));
  chk('4e. restock untouched',tot(sh.days[1].restock||{}),0);
  chk('4f. three ledger rows, ONE batch',[ctx.S.transfers.length,new Set(ctx.S.transfers.map(t=>t.batch)).size],[3,1]);
  chk('4g. the toast lists all three',[/25 /.test(h.toast()),/10 /.test(h.toast()),/48 /.test(h.toast())],[true,true,true]);
  chk('4h. continuity is clean',ctx.invCarryIssues(sh).length,0);

  // The Stock tab log shows the tap as one line with one undo.
  ctx.stockView='garage'; ctx.rStock();
  const st=h.els['pg-stock'].innerHTML;
  chk('4i. the Stock tab log reads garage → show',st.indexOf('🏠 Garage → Wine and Harvest Fest')>=0,true);
  chk('4j. as one line carrying every size',(st.match(/delTransferBatch\(/g)||[]).length,1);
  chk('4k. and names the day it was for',st.indexOf('for '+dayKey(1))>=0,true);

  // Undo the whole tap.
  ctx.confirm=()=>true;
  ctx.delTransferBatch(ctx.S.transfers[0].batch);
  chk('4l. batch undo: garage back',[ctx.S.inventory['2oz'],ctx.S.inventory.c5s,ctx.S.inventory['8oz']],[80,200,60]);
  chk('4m. packed back',[sh.packedInventory['2oz'],sh.packedInventory.c5s,sh.packedInventory['8oz']||0],[40,100,0]);
  chk('4n. opening back',[sh.days[1].morningCount['2oz'],sh.days[1].morningCount.c5s,sh.days[1].morningCount['8oz']],[30,60,0]);
  chk('4o. brought back to 0, ledger empty',[tot(ctx.dayGarageIn(sh.days[1])),ctx.S.transfers.length],[0,0]);

  // Pick today instead of tomorrow.
  ctx.openTransferModal('wh');
  h.qty({'c5s':10}); h.set('tr_day','0');
  h.save();
  chk('4p. day override honoured: today\'s opening 100 → 110',[sh.days[0].morningCount.c5s,ctx.dayGarageIn(sh.days[0]).c5s,ctx.dayGarageIn(sh.days[1]).c5s],[110,10,0]);

  // Ask for more than the garage shows: the harness says no to every confirm.
  ctx.confirm=()=>false;
  ctx.openTransferModal('wh');
  h.qty({'32oz':50}); h.set('tr_day','1');
  h.save();
  chk('4q. more than the garage has and the confirm declined: nothing moves',[ctx.S.inventory['32oz'],sh.packedInventory['32oz']||0],[10,0]);
  ctx.confirm=()=>true;
  h.save();
  chk('4r. confirmed: it goes anyway, garage floors at 0',[ctx.S.inventory['32oz'],sh.packedInventory['32oz'],sh.days[1].morningCount['32oz']],[0,50,50]);

  // Empty is refused before anything is touched.
  const snap=JSON.stringify([ctx.S.inventory,sh.packedInventory,sh.days]);
  ctx.openTransferModal('wh'); h.qty({}); h.save();
  chk('4s. no quantities: refused',/at least one size/i.test(h.toast()),true);
  chk('4t. and nothing moved',JSON.stringify([ctx.S.inventory,sh.packedInventory,sh.days]),snap);
}

// ===========================================================================
R.section('5. A show with booths: the delivery goes to ONE booth');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx);
  ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
  const [A,B,C]=ctx.showBooths(sh).map(x=>x.id);
  [A,B,C].forEach(id=>{ const en=ctx.dayBoothWrite(sh.days[0],id); en.morningCount=cnt({'c5s':30}); en.eveningCount=cnt({'c5s':20}); });
  ctx.rollupDay(sh,0);
  chk('5a. day 1 rolled up: 90 opened, 60 left',[sh.days[0].morningCount.c5s,sh.days[0].eveningCount.c5s],[90,60]);

  chk('5b. no booth named: refused',ctx.garageToShow(sh,'c5s',30,1,null).ok,false);
  chk('5c. a booth that is not on the show: refused',ctx.garageToShow(sh,'c5s',30,1,'nope').ok,false);
  chk('5d. nothing moved on those refusals',[ctx.S.inventory.c5s,sh.packedInventory.c5s],[200,100]);

  ctx.openTransferModal('wh');
  chk('5e. the modal asks which booth',h.modal().indexOf('id="tr_booth"')>=0,true);
  h.qty({'c5s':30}); h.set('tr_booth',B); h.set('tr_day','1');
  h.save();
  chk('5f. booked as brought to booth 2 tomorrow',ctx.boothGarageIn(sh.days[1],B).c5s,30);
  chk('5g. not to booths 1 or 3',[A,C].map(id=>ctx.boothGarageIn(sh.days[1],id).c5s),[0,0]);
  chk('5h. the day total carries it (rollup)',ctx.dayGarageIn(sh.days[1]).c5s,30);
  chk('5i. garage and packed moved',[ctx.S.inventory.c5s,sh.packedInventory.c5s],[170,130]);
  chk('5j. the ledger row names the booth',ctx.S.transfers[0].boothName,'Booth 2');
  chk('5k. the show is holding 90',ctx.showOnHand(sh).c5s,90);

  // Tomorrow: each booth opens with its own ending from last night, plus
  // what was brought to it. The count modal offers exactly that.
  ctx.showCntModal('wh',1,'morning',B);
  chk('5l. booth 2\'s morning defaults to 20 last night + 30 brought',h.cval('c_c5s'),'50');
  h.fillCounts(); ctx.saveCount('wh',1,'morning',B);
  ctx.showCntModal('wh',1,'morning',A);
  chk('5m. booth 1\'s defaults to 20 alone',h.cval('c_c5s'),'20');
  h.fillCounts(); ctx.saveCount('wh',1,'morning',A);
  ctx.showCntModal('wh',1,'morning',C); h.fillCounts(); ctx.saveCount('wh',1,'morning',C);
  chk('5n. the day opened with 90',sh.days[1].morningCount.c5s,90);
  chk('5o. booth 2 on hand = 50',ctx.boothOnHand(sh,1,B).c5s,50);
  chk('5p. per-booth continuity is clean',[A,B,C].map(id=>ctx.boothCarryIssues(sh,id).length),[0,0,0]);
  chk('5q. day-level continuity is clean',ctx.invCarryIssues(sh).length,0);
  chk('5r. the booth screen says what was brought',(()=>{ctx.openBoothDetail('wh',1,B);return h.modal().indexOf('Brought from the garage to this booth today')>=0;})(),true);
  // Close: booth 2 sold 35 of its 50.
  [A,B,C].forEach(id=>{ ctx.dayBoothWrite(sh.days[1],id).eveningCount=cnt({'c5s':id===B?15:18}); });
  ctx.rollupDay(sh,1);
  chk('5s. booth 2 is credited with 35',ctx.boothSold(sh.days[1],B).c5s,35);
  chk('5t. booths 1 and 3 with 2 each',[ctx.boothSold(sh.days[1],A).c5s,ctx.boothSold(sh.days[1],C).c5s],[2,2]);
  chk('5u. the day sold 39 = 90 − 51',ctx.daySold(sh.days[1]).c5s,39);

  // Undo takes it back off booth 2 and re-rolls the day.
  ctx.confirm=()=>true;
  ctx.delTransferBatch(ctx.S.transfers[0].batch);
  chk('5v. undo: booth 2 brought 0, opening 20',[ctx.boothGarageIn(sh.days[1],B).c5s,ctx.dayBoothRead(sh.days[1],B).morningCount.c5s],[0,20]);
  chk('5w. day brought 0, day opening 60 (rolled up)',[ctx.dayGarageIn(sh.days[1]).c5s,sh.days[1].morningCount.c5s],[0,60]);
  chk('5x. garage and packed back',[ctx.S.inventory.c5s,sh.packedInventory.c5s],[200,100]);
}

// ===========================================================================
R.section('6. Refusals leave nothing touched');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx);
  const pl=newShow(ctx,{id:'p1',name:'Planned',status:'planned'}); ctx.S.shows.push(pl);
  sh.days[1].locked=true;   // locked up front so the snapshot below is the whole comparison
  const snap=()=>JSON.stringify([ctx.S.inventory,sh.packedInventory,sh.days,pl.packedInventory,pl.days,ctx.S.transfers]);
  const before=snap();
  chk('6a. planned show: refused, pointed at Pack for Show',/Pack for Show/.test(ctx.garageToShow(pl,'c5s',5,0,null).reason),true);
  chk('6b. zero: refused',ctx.garageToShow(sh,'c5s',0,1,null).ok,false);
  chk('6c. negative: refused',ctx.garageToShow(sh,'c5s',-5,1,null).ok,false);
  chk('6d. unknown product: refused',ctx.garageToShow(sh,'gallon',5,1,null).ok,false);
  chk('6e. a day that is not on the show: refused',ctx.garageToShow(sh,'c5s',5,7,null).ok,false);
  chk('6f. a finalized day: refused',/finalized/.test(ctx.garageToShow(sh,'c5s',5,1,null).reason),true);
  // A multi-size tap into a finalized day is refused as a whole.
  ctx.openTransferModal('wh'); h.qty({'c5s':5,'2oz':5}); h.set('tr_day','1'); h.save();
  chk('6g. the modal refuses the whole tap on a finalized day',/finalized/.test(h.toast()),true);
  chk('6h. nothing moved through any of that',snap(),before);

  sh.days[1].locked=false;
  const r=ctx.garageToShow(sh,'c5s',5,1,null);
  sh.days[1].locked=true;
  chk('6i. undo on a finalized day: refused',ctx.garageToShowUndo(r.rec).ok,false);
  chk('6j. and the row is still there',ctx.S.transfers.length,1);
  chk('6k. undo of a show → show row through the garage path: refused',ctx.garageToShowUndo({fromShowId:'p1',toShowId:'wh',sku:'c5s',qty:5}).ok,false);
}

// ===========================================================================
R.section('7. On hand counts a delivery booked for a day not yet counted');
// ===========================================================================
{
  const {ctx}=world();
  const sh=runningShow(ctx);
  chk('7a. baseline: last count',ctx.showOnHand(sh).c5s,60);
  sh.days[1].garageIn=cnt({'c5s':50});
  chk('7b. brought on an uncounted later day is on top of the last count',ctx.showOnHand(sh).c5s,110);
  sh.days[1].restock=cnt({'c5s':5});
  chk('7c. and so is a restock on that day',ctx.showOnHand(sh).c5s,115);
  sh.days[1].morningCount=cnt({'c5s':110});
  chk('7d. once that day is opened it reads morning + restock',ctx.showOnHand(sh).c5s,115);
  sh.days[1].eveningCount=cnt({'c5s':30});
  chk('7e. once counted at close, the count wins',ctx.showOnHand(sh).c5s,30);
  const fresh=newShow(ctx,{id:'f',name:'Fresh',numDays:2,status:'active'});
  fresh.packedInventory=cnt({'c5s':40}); ctx.S.shows.push(fresh);
  chk('7f. no counts at all: packed',ctx.showOnHand(fresh).c5s,40);
  ctx.garageToShow(fresh,'c5s',10,1,null);
  chk('7g. a delivery to it is counted once, not twice',ctx.showOnHand(fresh).c5s,50);
  const bs=runningShow(ctx,{id:'b',name:'Booths'});
  ctx.boothsApply(bs,['X','Y']);
  const [X,Y]=ctx.showBooths(bs).map(b=>b.id);
  [X,Y].forEach(id=>{const en=ctx.dayBoothWrite(bs.days[0],id);en.morningCount=cnt({'c5s':50});en.eveningCount=cnt({'c5s':30});});
  ctx.rollupDay(bs,0);
  ctx.garageToShow(bs,'c5s',20,1,Y);
  chk('7h. booth show: 60 counted + 20 delivered',ctx.showOnHand(bs).c5s,80);
}

// ===========================================================================
R.section('8. Show → show: every size in one tap, otherwise what it was');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const a=newShow(ctx,{id:'a',name:'A',status:'planned'}), b=newShow(ctx,{id:'b',name:'B',status:'planned'});
  a.packedInventory=cnt({'c5s':30,'2oz':20}); ctx.S.shows.push(a,b);
  const garage=JSON.stringify(ctx.S.inventory);
  ctx.openTransferModal('a');
  h.qty({'c5s':12,'2oz':7});
  h.save();
  chk('8a. packed moved A → B, both sizes',[a.packedInventory.c5s,b.packedInventory.c5s,a.packedInventory['2oz'],b.packedInventory['2oz']],[18,12,13,7]);
  chk('8b. the garage never noticed',JSON.stringify(ctx.S.inventory),garage);
  chk('8c. two ledger rows in the old shape, one batch',[ctx.S.transfers.map(t=>[t.fromShowId,t.toShowId,t.sku,t.qty]),new Set(ctx.S.transfers.map(t=>t.batch)).size],[[['a','b','2oz',7],['a','b','c5s',12]],1]);   // rows follow the size list
  chk('8d. no day was written on either side',[a.days[0].garageIn,b.days[0].garageIn,a.days[0].restock,b.days[0].restock],[undefined,undefined,undefined,undefined]);
  ctx.confirm=()=>true;
  ctx.delTransfer(ctx.S.transfers[1].id);
  chk('8e. a single row can still be undone on its own',[a.packedInventory.c5s,b.packedInventory.c5s,ctx.S.transfers.length],[30,0,1]);
  ctx.delTransferBatch(ctx.S.transfers[0].batch);
  chk('8f. and the rest of the batch',[a.packedInventory['2oz'],b.packedInventory['2oz'],ctx.S.transfers.length],[20,0,0]);
  chk('8g. garage still untouched',JSON.stringify(ctx.S.inventory),garage);
}

// ===========================================================================
R.section('9. The v38 → v39 migration: restock rows move onto the opening');
// ===========================================================================
{
  // A board as v38 left it this morning: three deliveries booked for today as
  // +Restock, today's morning pre-filled from last night by the evening save.
  const {ctx}=world();
  const sh=runningShow(ctx);
  sh.days[1].morningCount=cnt({'c5s':60,'2oz':30});
  sh.days[1].restock=cnt({'c5l':54,'8oz':48,'2oz':8});
  sh.packedInventory=cnt({'c5s':100,'2oz':48,'c5l':54,'8oz':48});
  const row=(sku,qty)=>({id:'tr_'+sku,ts:'2026-09-20T13:00:00Z',date:dayKey(0),sku,qty,fromShowId:'garage',fromName:'🏠 Garage',toShowId:'wh',toName:sh.name,di:1,dayDate:dayKey(1),boothId:null,boothName:''});
  ctx.S.transfers=[row('c5l',54),row('8oz',48),row('2oz',8)];
  chk('9a. before: v38 flags nothing, but the opening does not show the delivery',[ctx.invCarryIssues(sh).length,sh.days[1].morningCount['2oz']],[0,30]);
  ctx.migrateGarageRowsV39(ctx.S);
  chk('9b. restock emptied',tot(sh.days[1].restock),0);
  chk('9c. brought carries the three deliveries',ctx.dayGarageIn(sh.days[1]),cnt({'c5l':54,'8oz':48,'2oz':8}));
  chk('9d. the opening was raised by exactly the delivery',[sh.days[1].morningCount.c5l,sh.days[1].morningCount['8oz'],sh.days[1].morningCount['2oz'],sh.days[1].morningCount.c5s],[54,48,38,60]);
  chk('9e. continuity is clean',ctx.invCarryIssues(sh).length,0);
  chk('9f. rows are marked so the migration never runs on them twice',ctx.S.transfers.every(t=>t.landed==='opening'&&t.batch),true);
  const snap=JSON.stringify([sh.days,ctx.S.transfers]);
  ctx.migrateGarageRowsV39(ctx.S);
  chk('9g. running it again changes nothing',JSON.stringify([sh.days,ctx.S.transfers]),snap);
  sh.days[1].eveningCount=cnt({'c5s':30,'2oz':20,'c5l':40,'8oz':30});
  chk('9h. sold reads right afterwards: 38 − 20 = 18 2oz, 54 − 40 = 14 C5L',[ctx.daySold(sh.days[1])['2oz'],ctx.daySold(sh.days[1]).c5l],[18,14]);
  chk('9i. undo still works on a migrated row',(()=>{const r=ctx.garageToShowUndo(ctx.S.transfers[0]);return [r.ok,sh.days[1].morningCount.c5l,ctx.dayGarageIn(sh.days[1]).c5l,ctx.S.inventory.c5l];})(),[true,0,0,124]);
}
{
  // Variant: the morning was already recounted WITH the new product on the
  // table. The migration must not raise it a second time.
  const {ctx}=world();
  const sh=runningShow(ctx);
  sh.days[1].morningCount=cnt({'c5s':60,'2oz':38});
  sh.days[1].restock=cnt({'2oz':8});
  ctx.S.transfers=[{id:'tr_x',ts:'2026-09-20T13:00:00Z',date:dayKey(0),sku:'2oz',qty:8,fromShowId:'garage',fromName:'🏠 Garage',toShowId:'wh',toName:sh.name,di:1,dayDate:dayKey(1),boothId:null,boothName:''}];
  chk('9j. before: v38 double-counts and flags the morning',[ctx.invCarryIssues(sh).length],[1]);
  ctx.migrateGarageRowsV39(ctx.S);
  chk('9k. after: opening stays 38, restock 0, brought 8, no flag',[sh.days[1].morningCount['2oz'],tot(sh.days[1].restock),ctx.dayGarageIn(sh.days[1])['2oz'],ctx.invCarryIssues(sh).length],[38,0,8,0]);
}
{
  // Variant: a booth row.
  const {ctx}=world();
  const sh=runningShow(ctx);
  ctx.boothsApply(sh,['P','Q']);
  const [P,Q]=ctx.showBooths(sh).map(b=>b.id);
  [P,Q].forEach(id=>{const en=ctx.dayBoothWrite(sh.days[0],id);en.morningCount=cnt({'c5s':50});en.eveningCount=cnt({'c5s':30});});
  ctx.rollupDay(sh,0);
  [P,Q].forEach(id=>{const en=ctx.dayBoothWrite(sh.days[1],id);en.morningCount=cnt({'c5s':30});});
  ctx.dayBoothWrite(sh.days[1],Q).restock=cnt({'c5s':20});
  ctx.rollupDay(sh,1);
  ctx.S.transfers=[{id:'tr_q',ts:'2026-09-20T13:00:00Z',date:dayKey(0),sku:'c5s',qty:20,fromShowId:'garage',fromName:'🏠 Garage',toShowId:'wh',toName:sh.name,di:1,dayDate:dayKey(1),boothId:Q,boothName:'Q'}];
  ctx.migrateGarageRowsV39(ctx.S);
  chk('9l. booth Q: restock 0, brought 20, opening 50',[ctx.dayBoothRead(sh.days[1],Q).restock.c5s,ctx.boothGarageIn(sh.days[1],Q).c5s,ctx.dayBoothRead(sh.days[1],Q).morningCount.c5s],[0,20,50]);
  chk('9m. booth P untouched',[ctx.boothGarageIn(sh.days[1],P).c5s,ctx.dayBoothRead(sh.days[1],P).morningCount.c5s],[0,30]);
  chk('9n. the day rolled up: opening 80, brought 20, restock 0',[sh.days[1].morningCount.c5s,ctx.dayGarageIn(sh.days[1]).c5s,sh.days[1].restock.c5s],[80,20,0]);
  chk('9o. both continuity checks clean',[ctx.boothCarryIssues(sh,Q).length,ctx.invCarryIssues(sh).length],[0,0]);
}
{
  const {ctx}=world();
  chk('9p. the migration marker is set on boot',ctx.S._applied['garage_in_v39'],true);
}

// ===========================================================================
R.section('10. Where it shows up: the show stock card and the day card');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx);
  sh.days[1].morningCount=cnt({'c5s':60,'2oz':30});
  ctx.openTransferModal('wh'); h.qty({'c5l':54,'8oz':48,'2oz':8}); h.set('tr_day','1'); h.save();
  chk('10a. packed at start is packed minus brought',ctx.showPackedAtStart(sh),cnt({'c5s':100,'2oz':40}));
  chk('10b. brought is the whole-show sum',ctx.showGarageIn(sh),cnt({'c5l':54,'8oz':48,'2oz':8}));
  const card=ctx.showStockCardHTML(sh);
  chk('10c. the show stock card exists for a running show',card.indexOf('Show stock')>=0,true);
  chk('10d. it has a Brought column',card.indexOf('🏠 Brought')>=0,true);
  chk('10e. and lists the tap that brought it',card.indexOf('🏠 '+dayKey(1)+': ')>=0,true);
  chk('10f. totals: packed 140, brought +110, total 250',[/>140</.test(card),/>\+110</.test(card),/>250</.test(card)],[true,true,true]);
  chk('10g. no card on a planned show',ctx.showStockCardHTML(newShow(ctx,{id:'p',name:'P',status:'planned'})),'');
  const day=ctx.dayGarageCardHTML(sh,1);
  chk('10h. the day card names the day and the units',[day.indexOf('Brought from the garage')>=0,day.indexOf('54 '+h.short('c5l'))>=0],[true,true]);
  chk('10i. with an undo for the tap',day.indexOf('delTransferBatch(')>=0,true);
  chk('10j. and a button to bring more',day.indexOf('Bring more from the garage')>=0,true);
  chk('10k. yesterday shows the button but nothing brought',[ctx.dayGarageCardHTML(sh,0).indexOf('Nothing brought')>=0],[true]);
  sh.days[1].locked=true;
  chk('10l. a finalized day offers neither undo nor the button',[ctx.dayGarageCardHTML(sh,1).indexOf('delTransferBatch(')>=0,ctx.dayGarageCardHTML(sh,1).indexOf('Bring more')>=0],[false,false]);
  sh.days[1].locked=false;
  const r=ctx.rDay(sh,1);
  chk('10m. the day screen\'s morning column says the opening includes the delivery',r.indexOf('incl. 🏠 +110 from garage')>=0,true);
  chk('10n. and carries the delivery card',r.indexOf('Brought from the garage')>=0,true);
}

R.done();
