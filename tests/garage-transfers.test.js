// Bringing more product from the garage to a show that is already running —
// SYNTHETIC FIXTURES ONLY.
//
// The gap this closes: Transfer Stock only ever listed other shows, and Pack
// for Show runs once when a show starts. "I am at the show and need to bring
// more from home tomorrow" had no button. Now the garage is a source.
//
// The invariant under test is that a garage delivery is ONE physical act that
// the books must record in three places at once, and that the three agree:
//
//   garage count       goes DOWN by the delivery
//   show packed total  goes UP   by the delivery   (end-of-show returns read it)
//   the day's restock  goes UP   by the delivery   (sold = opening + restock − ending)
//
// so that garage + at-shows never changes by a unit, tomorrow's morning count
// can stay what it always was (last night's ending) with no reconciliation
// mismatch, and the units sold out of the delivery are counted exactly once.
// Undo reverses all three. The old show → show transfer is not touched.
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
  // A clean board: no seeded shows, a known garage.
  h.ctx.S.shows=[]; h.ctx.S.transfers=[];
  h.ctx.S.inventory=cnt({'32oz':10,'c5s':200,'2oz':80});
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
function runningShow(ctx,o){
  const sh=newShow(ctx,Object.assign({id:'wh',name:'Wine and Harvest Fest',numDays:2,status:'active',dates:[dayKey(0),dayKey(1)]},o||{}));
  sh.packedInventory=cnt({'c5s':100,'2oz':40});
  sh.days[0].morningCount=cnt({'c5s':100,'2oz':40});
  sh.days[0].eveningCount=cnt({'c5s':60,'2oz':30});
  ctx.S.shows.push(sh);
  return sh;
}

// ===========================================================================
R.section('1. The picker knows the garage');
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
  chk('1h. and it says where the units land',m.indexOf('+Restock')>=0,true);
  chk('1i. the button says what it does',m.indexOf('Bring it')>=0,true);
  chk('1j. the garage is only offered as a source, never a destination',
      /id="tr_to"[^>]*>[^]*?<\/select>/.exec(m)[0].indexOf('value="garage"')>=0,false);

  // From the Stock tab with a planned show and a running show: garage first.
  ctx.openTransferModal();
  chk('1k. from the Stock tab the garage is the default source',/<option value="garage" selected>/.test(h.modal()),true);

  // Switch From to the planned show: To follows and the day picker leaves.
  h.set('tr_from','p1'); ctx.trRefresh('from');
  const m2=h.modal();
  chk('1l. switching From to a show drops the garage landing pickers',m2.indexOf('id="tr_day"')>=0,false);
  chk('1m. and To offers the other show',/id="tr_to"[^>]*>[^]*?<option value="wh"/.test(m2),true);
  chk('1n. the show → show wording is the old one',m2.indexOf('Move packed units from one show to another')>=0,true);
}
{
  // Nothing running, two planned: exactly the old behaviour.
  const h=world(),{ctx}=h;
  ctx.S.shows.push(newShow(ctx,{id:'p1',name:'A',status:'planned'}),newShow(ctx,{id:'p2',name:'B',status:'planned'}));
  ctx.openTransferModal();
  const m=h.modal();
  chk('1o. no running show, no garage option',m.indexOf('value="garage"')>=0,false);
  chk('1p. and two planned shows still transfer between each other',/<option value="p1" selected>/.test(m)&&/id="tr_to"[^>]*>[^]*?<option value="p2" selected>/.test(m),true);
}
{
  // Nothing running, one planned: nothing to do, and it says so instead of opening.
  const h=world(),{ctx}=h;
  ctx.S.shows.push(newShow(ctx,{id:'p1',name:'A',status:'planned'}));
  ctx.openTransferModal();
  chk('1q. no running show and only one planned: no modal',h.modal(),'');
  chk('1r. the toast explains',/running show/.test(h.toast()),true);
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
R.section('3. Bring it: garage → running show, no booths');
// ===========================================================================
{
  const {ctx}=world();
  const sh=runningShow(ctx);
  const everythingBefore=tot(ctx.S.inventory)+tot(ctx.atShowsInv());
  chk('3a. before: garage 200 C5S, show holding 60',[ctx.S.inventory.c5s,ctx.showOnHand(sh).c5s],[200,60]);

  const r=ctx.garageToShow(sh,'c5s',50,1,null);
  chk('3b. the delivery is accepted',r.ok,true);
  chk('3c. garage went down',ctx.S.inventory.c5s,150);
  chk('3d. the show packed total went up',sh.packedInventory.c5s,150);
  chk('3e. it landed as restock on TOMORROW, not today',[sh.days[1].restock.c5s,(sh.days[0].restock||{}).c5s||0],[50,0]);
  chk('3f. the show is holding it already',ctx.showOnHand(sh).c5s,110);
  chk('3g. the Stock tab agrees',ctx.atShowsInv().c5s,110);
  chk('3h. THE INVARIANT: garage + at-shows did not change by a unit',tot(ctx.S.inventory)+tot(ctx.atShowsInv()),everythingBefore);
  chk('3i. one ledger row, from the garage',ctx.S.transfers.map(t=>[t.fromShowId,t.toShowId,t.sku,t.qty,t.di]),[['garage','wh','c5s',50,1]]);
  chk('3j. the row names the day it is for',ctx.S.transfers[0].dayDate,dayKey(1));
  chk('3k. the change log carries it',/garage delivery/.test((sh.invLog||[]).slice(-1)[0].type),true);
  chk('3l. yesterday untouched: still sold 40',ctx.daySold(sh.days[0]).c5s,40);

  // Undo, then do it again — undo must put every one of the three back.
  const row=ctx.S.transfers[0];
  chk('3m. undo is accepted',ctx.garageToShowUndo(row).ok,true);
  chk('3n. garage back to 200',ctx.S.inventory.c5s,200);
  chk('3o. packed back to 100',sh.packedInventory.c5s,100);
  chk('3p. restock back to 0',sh.days[1].restock.c5s,0);
  chk('3q. ledger empty',ctx.S.transfers.length,0);
  chk('3r. on hand back to 60',ctx.showOnHand(sh).c5s,60);
  ctx.garageToShow(sh,'c5s',50,1,null);

  // Tomorrow morning: the normal morning count — last night's ending.
  sh.days[1].morningCount={...sh.days[0].eveningCount};
  chk('3s. morning = last night, so there is NO reconciliation mismatch',ctx.invCarryIssues(sh).length,0);
  chk('3t. and on hand is opening + the delivery',ctx.showOnHand(sh).c5s,110);
  // Tomorrow night: 30 left on the table.
  sh.days[1].eveningCount=cnt({'c5s':30,'2oz':30});
  chk('3u. sold tomorrow = 60 opening + 50 delivered − 30 ending = 80',ctx.daySold(sh.days[1]).c5s,80);
  chk('3v. no impossible sale flagged',ctx.invNegativeSold(sh).length,0);
  chk('3w. whole show sold 120',ctx.showUnitsSold(sh).c5s,120);
  chk('3x. end-of-show returns 30: packed 150 − sold 120 agrees with the last count',ctx.endShowReturns(sh).c5s,30);
  chk('3y. garage + at-shows: the same total minus exactly what was sold',tot(ctx.S.inventory)+tot(ctx.atShowsInv()),everythingBefore-80);
}

// ===========================================================================
R.section('4. Through the modal');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx);
  ctx.openTransferModal('wh');
  h.set('tr_sku','2oz'); h.set('tr_qty','25');
  h.save();
  chk('4a. saved: garage 2oz 80 → 55',ctx.S.inventory['2oz'],55);
  chk('4b. packed 2oz 40 → 65',sh.packedInventory['2oz'],65);
  chk('4c. restock on tomorrow',sh.days[1].restock['2oz'],25);
  chk('4d. the ledger row',ctx.S.transfers.map(t=>[t.fromName,t.toName,t.sku,t.qty]),[['🏠 Garage','Wine and Harvest Fest','2oz',25]]);
  chk('4e. the toast says so',/from the garage/.test(h.toast()),true);

  // Pick today instead of tomorrow.
  ctx.openTransferModal('wh');
  h.set('tr_sku','c5s'); h.set('tr_qty','10'); h.set('tr_day','0');
  h.save();
  chk('4g. day override honoured',[(sh.days[0].restock||{}).c5s||0,(sh.days[1].restock||{}).c5s||0],[10,0]);

  // Ask for more than the garage shows: the harness says no to every confirm.
  // (Stub inputs persist between opens, so the day is set back explicitly.)
  ctx.openTransferModal('wh');
  h.set('tr_sku','32oz'); h.set('tr_qty','50'); h.set('tr_day','1');
  h.save();
  chk('4h. more than the garage has and the confirm declined: nothing moves',[ctx.S.inventory['32oz'],sh.packedInventory['32oz']||0],[10,0]);
  chk('4i. and the modal stays open',h.modal()!=='',true);
  ctx.confirm=()=>true;
  h.save();
  chk('4j. confirmed: it goes anyway, garage floors at 0',[ctx.S.inventory['32oz'],sh.packedInventory['32oz'],sh.days[1].restock['32oz']],[0,50,50]);

  // The Stock tab shows the log with the garage as the source.
  ctx.stockView='garage'; ctx.rStock();
  const st=h.els['pg-stock'].innerHTML;
  chk('4k. the Stock tab button offers the garage',st.indexOf('from the garage or between shows')>=0,true);
  chk('4l. the transfer log reads garage → show',st.indexOf('🏠 Garage → Wine and Harvest Fest')>=0,true);
  chk('4m. and names the day it was for',st.indexOf('for '+dayKey(1))>=0,true);

  // Undo from the log.
  const id=ctx.S.transfers[0].id;
  ctx.delTransfer(id);
  chk('4n. undo from the log reverses the 2oz delivery',[ctx.S.inventory['2oz'],sh.packedInventory['2oz'],sh.days[1].restock['2oz']],[80,40,0]);
  chk('4o. the other rows stay',ctx.S.transfers.length,2);

  // Empty quantity is refused before anything is touched.
  const snap=JSON.stringify([ctx.S.inventory,sh.packedInventory,sh.days]);
  ctx.openTransferModal('wh'); h.set('tr_qty',''); h.save();
  chk('4p. no quantity: refused',/quantity/i.test(h.toast()),true);
  chk('4q. and nothing moved',JSON.stringify([ctx.S.inventory,sh.packedInventory,sh.days]),snap);
}

// ===========================================================================
R.section('5. A show with booths: the delivery goes to ONE booth');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=runningShow(ctx);
  ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
  const [A,B,C]=ctx.showBooths(sh).map(x=>x.id);
  // Day 1 per booth, then rolled up.
  [A,B,C].forEach(id=>{ const en=ctx.dayBoothWrite(sh.days[0],id); en.morningCount=cnt({'c5s':30}); en.eveningCount=cnt({'c5s':20}); });
  ctx.rollupDay(sh,0);
  chk('5a. day 1 rolled up: 90 opened, 60 left',[sh.days[0].morningCount.c5s,sh.days[0].eveningCount.c5s],[90,60]);

  chk('5b. no booth named: refused',ctx.garageToShow(sh,'c5s',30,1,null).ok,false);
  chk('5c. a booth that is not on the show: refused',ctx.garageToShow(sh,'c5s',30,1,'nope').ok,false);
  chk('5d. nothing moved on those refusals',[ctx.S.inventory.c5s,sh.packedInventory.c5s],[200,100]);

  ctx.openTransferModal('wh');
  chk('5e. the modal asks which booth',h.modal().indexOf('id="tr_booth"')>=0,true);
  h.set('tr_sku','c5s'); h.set('tr_qty','30'); h.set('tr_booth',B);
  h.save();
  chk('5f. it landed on booth 2 tomorrow',ctx.dayBoothRead(sh.days[1],B).restock.c5s,30);
  chk('5g. not on booths 1 or 3',[A,C].map(id=>((ctx.dayBoothRead(sh.days[1],id)||{}).restock||{}).c5s||0),[0,0]);
  chk('5h. the day total carries it (rollup)',sh.days[1].restock.c5s,30);
  chk('5i. garage and packed moved',[ctx.S.inventory.c5s,sh.packedInventory.c5s],[170,130]);
  chk('5j. the ledger row names the booth',ctx.S.transfers[0].boothName,'Booth 2');
  chk('5k. the show is holding 90',ctx.showOnHand(sh).c5s,90);

  // Tomorrow: each booth opens with its own ending from last night.
  [A,B,C].forEach(id=>{ ctx.dayBoothWrite(sh.days[1],id).morningCount=cnt({'c5s':20}); });
  ctx.rollupDay(sh,1);
  chk('5l. booth 2 on hand = 20 opening + 30 delivered',ctx.boothOnHand(sh,1,B).c5s,50);
  chk('5m. booth 1 on hand = 20',ctx.boothOnHand(sh,1,A).c5s,20);
  chk('5n. per-booth continuity is clean',ctx.boothCarryIssues(sh,B).length,0);
  chk('5o. day-level continuity is clean',ctx.invCarryIssues(sh).length,0);
  // Close: booth 2 sold 35 of its 50.
  [A,B,C].forEach(id=>{ ctx.dayBoothWrite(sh.days[1],id).eveningCount=cnt({'c5s':id===B?15:18}); });
  ctx.rollupDay(sh,1);
  chk('5p. booth 2 is credited with 35',ctx.boothSold(sh.days[1],B).c5s,35);
  chk('5q. booths 1 and 3 with 2 each',[ctx.boothSold(sh.days[1],A).c5s,ctx.boothSold(sh.days[1],C).c5s],[2,2]);
  chk('5r. the day sold 39 = 60 + 30 − 51',ctx.daySold(sh.days[1]).c5s,39);

  // Undo takes it back off booth 2 and re-rolls the day.
  ctx.confirm=()=>true;
  ctx.delTransfer(ctx.S.transfers[0].id);
  chk('5s. undo: booth 2 restock 0',ctx.dayBoothRead(sh.days[1],B).restock.c5s,0);
  chk('5t. day restock 0 (rolled up)',sh.days[1].restock.c5s,0);
  chk('5u. garage and packed back',[ctx.S.inventory.c5s,sh.packedInventory.c5s],[200,100]);
}

// ===========================================================================
R.section('6. Refusals leave nothing touched');
// ===========================================================================
{
  const {ctx}=world();
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
  chk('6g. nothing moved through any of that',snap(),before);

  sh.days[1].locked=false;
  const r=ctx.garageToShow(sh,'c5s',5,1,null);
  sh.days[1].locked=true;
  chk('6h. undo on a finalized day: refused',ctx.garageToShowUndo(r.rec).ok,false);
  chk('6i. and the row is still there',ctx.S.transfers.length,1);
  chk('6j. undo of a show → show row through the garage path: refused',ctx.garageToShowUndo({fromShowId:'p1',toShowId:'wh',sku:'c5s',qty:5}).ok,false);
}

// ===========================================================================
R.section('7. On hand counts a delivery booked for a day not yet counted');
// ===========================================================================
{
  const {ctx}=world();
  const sh=runningShow(ctx);
  chk('7a. baseline: last count',ctx.showOnHand(sh).c5s,60);
  sh.days[1].restock=cnt({'c5s':50});
  chk('7b. restock on an uncounted later day is on top of the last count',ctx.showOnHand(sh).c5s,110);
  sh.days[1].morningCount=cnt({'c5s':60});
  chk('7c. once that day is opened it reads morning + restock, same number',ctx.showOnHand(sh).c5s,110);
  sh.days[1].eveningCount=cnt({'c5s':30});
  chk('7d. once counted at close, the count wins',ctx.showOnHand(sh).c5s,30);
  // A show with nothing counted yet reads packed, and packed already carries every delivery.
  const fresh=newShow(ctx,{id:'f',name:'Fresh',numDays:2,status:'active'});
  fresh.packedInventory=cnt({'c5s':40}); ctx.S.shows.push(fresh);
  chk('7e. no counts at all: packed',ctx.showOnHand(fresh).c5s,40);
  ctx.garageToShow(fresh,'c5s',10,1,null);
  chk('7f. a delivery to it is counted once, not twice',ctx.showOnHand(fresh).c5s,50);
  // Booth shows: the rollup is what showOnHand reads, so it agrees.
  const bs=runningShow(ctx,{id:'b',name:'Booths'});
  ctx.boothsApply(bs,['X','Y']);
  const [X,Y]=ctx.showBooths(bs).map(b=>b.id);
  [X,Y].forEach(id=>{const en=ctx.dayBoothWrite(bs.days[0],id);en.morningCount=cnt({'c5s':50});en.eveningCount=cnt({'c5s':30});});
  ctx.rollupDay(bs,0);
  ctx.garageToShow(bs,'c5s',20,1,Y);
  chk('7g. booth show: 60 counted + 20 delivered',ctx.showOnHand(bs).c5s,80);
}

// ===========================================================================
R.section('8. Show → show is exactly what it was');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const a=newShow(ctx,{id:'a',name:'A',status:'planned'}), b=newShow(ctx,{id:'b',name:'B',status:'planned'});
  a.packedInventory=cnt({'c5s':30}); ctx.S.shows.push(a,b);
  const garage=JSON.stringify(ctx.S.inventory);
  ctx.openTransferModal('a');
  h.set('tr_sku','c5s'); h.set('tr_qty','12');
  h.save();
  chk('8a. packed moved A → B',[a.packedInventory.c5s,b.packedInventory.c5s],[18,12]);
  chk('8b. the garage never noticed',JSON.stringify(ctx.S.inventory),garage);
  chk('8c. the ledger row is the old shape',ctx.S.transfers.map(t=>[t.fromShowId,t.toShowId,t.qty]),[['a','b',12]]);
  chk('8d. no day was written on either side',[a.days[0].restock,b.days[0].restock],[undefined,undefined]);
  ctx.confirm=()=>true;
  ctx.delTransfer(ctx.S.transfers[0].id);
  chk('8e. undo puts it back',[a.packedInventory.c5s,b.packedInventory.c5s],[30,0]);
  chk('8f. garage still untouched',JSON.stringify(ctx.S.inventory),garage);
}

R.done();
