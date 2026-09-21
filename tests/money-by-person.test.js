// Money by person — SYNTHETIC FIXTURES ONLY.
//
// Isaiah works the table beside Froggy and takes money on his own phone and
// into his own pocket. His cash, card and Venmo have to be enterable on their
// own and still add into the drawer. The rule is the booth rule, one level
// down:
//
//     A SELLER IS AN INPUT. THE DRAWER IS THE TOTAL.
//
// Per-person entries live in <drawer>.sellerPayments[repId] — the DAY on an
// ordinary show, the BOOTH ENTRY on a show that runs booths — and whenever
// the split is non-empty the drawer's own payments are REBUILT from the sum.
// So every figure downstream (the day total, the cash-vs-product check,
// collected revenue, the P&L, the closeout wizard, the exports) keeps reading
// payments the way it always did and gets the right number for free. A change
// that lets a person's total and the drawer total drift apart is the failure
// this file exists to catch, so most checks assert both sides at once.
//
// On a booth show it has to compose: seller → booth → day. Section 4 pins
// that. Section 6 pins that turning the split off leaves exactly one flat
// count behind, because two sets of books that disagree is the whole danger.
//
//   node tests/money-by-person.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};

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
  // Stub inputs persist between modal opens the way real ones do not, so a
  // test clears them before driving a fresh modal.
  h.clear=()=>{Object.keys(els).forEach(k=>{if(/^(pm_|sp_)/.test(k))els[k].value='';});};
  h.flat=o=>{h.clear();PK.forEach(k=>h.set('pm_'+k,o[k]||0));};
  h.person=(id,o)=>{PK.forEach(k=>h.set('sp_'+id+'_'+k,o[k]||0));};
  h.ctx.S.shows=[];
  return h;
}
const FROG='rep_justin', ISAIAH='rep_isaiah', BATMAN='rep_batman';
function newShow(ctx,o){
  const nd=o.numDays||1;
  const days=[];for(let i=0;i<nd;i++)days.push(ctx._bsBlankDay(i+1,'2099-06-'+(15+i)));
  return Object.assign({id:o.id,name:o.name,status:'active',startDate:'2099-06-15',numDays:nd,
    location:'Somewhere, WI',miles:0,boothCost:0,boothPayments:[],days,dates:days.map(d=>d.date),
    showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true,lodging:0,packedInventory:null},o,{days,numDays:nd});
}
// One day, counted top and bottom, so revenue and the cash check are live.
function sellingDay(ctx,sh,di){
  sh.days[di].morningCount=cnt({'c5s':100,'2oz':40});
  sh.days[di].eveningCount=cnt({'c5s':60,'2oz':30});
  return sh.days[di];
}

// ===========================================================================
R.section('1. Isaiah is already someone the app knows');
// ===========================================================================
{
  const {ctx}=world();
  const r=(ctx.S.reps||[]).find(x=>x.id===ISAIAH);
  chk('1a. he is on the roster',!!r&&r.name,'Isaiah');
  chk('1b. active',!!r.active,true);
  chk('1c. and not the owner',!!r.isSelf,false);
  chk('1d. the owner is Froggy',ctx.sellerIsOwner(FROG),true);
  chk('1e. names resolve',[ctx.sellerName(ISAIAH),ctx.sellerName(FROG)],['Isaiah','Justin (Froggy)']);
}

// ===========================================================================
R.section('2. A seller is an input, the drawer is the total');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'wh',name:'Wine and Harvest Fest'}); ctx.S.shows.push(sh);
  const d=sellingDay(ctx,sh,0);
  d.sellerPayments={};
  d.sellerPayments[FROG]=pmt({cash:300,square:150});
  d.sellerPayments[ISAIAH]=pmt({cash:120,square:80,venmo:45});
  chk('2a. the split is live',ctx.hasSellerSplit(d),true);
  chk('2b. both people are on it',ctx.drawerSellers(d).sort(),[ISAIAH,FROG].sort());
  chk('2c. rebuilt',ctx.rollupSellers(d),true);
  chk('2d. THE INVARIANT: the day total is the sum',ctx.calcPmt(d.payments),695);
  chk('2e. method by method, not just the total',[d.payments.cash,d.payments.square,d.payments.venmo,d.payments.zelle],[420,230,45,0]);
  chk('2f. each person stays readable on their own',[ctx.sellerPmt(d,FROG),ctx.sellerPmt(d,ISAIAH)],[450,245]);
  chk('2g. a manual count is no longer claimed to be auto',d.paymentsAuto,false);
  // Everything downstream reads the day and gets the grand total for free.
  chk('2h. collected revenue is the grand total',ctx.showActualRev(sh),695);
  chk('2i. the P&L collected figure agrees',ctx.calcShow(sh).gross,695);
  chk('2j. the cash check reads the day, not a person',ctx.dayCashCheck(sh,0).collected,695);
}

// ===========================================================================
R.section('3. Through the modal: one total, then split by person');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=newShow(ctx,{id:'wh',name:'Wine and Harvest Fest'}); ctx.S.shows.push(sh);
  sellingDay(ctx,sh,0);

  ctx.showMoneyModal('wh',0);
  chk('3a. it opens flat, with the split on offer',[h.modal().indexOf('Split this drawer by person')>=0,h.modal().indexOf('id="pm_cash"')>=0],[true,true]);
  h.flat({cash:500,square:200});
  ctx.saveMoney();
  chk('3b. a plain count still saves the old way',ctx.calcPmt(sh.days[0].payments),700);
  chk('3c. and writes no split',ctx.hasSellerSplit(sh.days[0]),false);

  // Now split it. The money already counted seeds the owner rather than vanishing.
  ctx.showMoneyModal('wh',0);
  h.clear();
  ctx.mmToggle();
  const m=h.modal();
  chk('3d. the split view opens',m.indexOf('Splitting by person')>=0,true);
  chk('3e. the owner is offered first',m.indexOf('id="sp_'+FROG+'_cash"')>=0,true);
  chk('3f. and carries the $700 already counted',[ctx._mm.split[FROG].cash,ctx._mm.split[FROG].square],[500,200]);
  chk('3g. with a picker for everyone else',m.indexOf('id="mm_add"')>=0,true);

  h.set('mm_add',ISAIAH); ctx.mmAddSeller();
  chk('3h. Isaiah joins the split',ctx._mm.ids.indexOf(ISAIAH)>=0,true);
  chk('3i. and gets his own inputs',h.modal().indexOf('id="sp_'+ISAIAH+'_venmo"')>=0,true);

  // Froggy took 380/150, Isaiah took 120/50/45.
  h.person(FROG,{cash:380,square:150});
  h.person(ISAIAH,{cash:120,square:50,venmo:45});
  ctx.updSplitPmt();
  chk('3j. the live subtotals are per person',[h.els['sub_'+FROG].textContent,h.els['sub_'+ISAIAH].textContent],['$530.00','$215.00']);
  chk('3k. and the live grand total is the sum',h.els['pmtTot'].textContent,'$745.00');
  ctx.saveMoney();
  const d=sh.days[0];
  chk('3l. saved: the day total is the sum',ctx.calcPmt(d.payments),745);
  chk('3m. Isaiah is on the books on his own',ctx.sellerPmt(d,ISAIAH),215);
  chk('3n. and so is Froggy',ctx.sellerPmt(d,FROG),530);
  chk('3o. cash and card rolled up right',[d.payments.cash,d.payments.square,d.payments.venmo],[500,200,45]);
  chk('3p. Isaiah worked it, so he is on the crew now',(sh.repIds||[]).indexOf(ISAIAH)>=0,true);
  chk('3q. and the toast says so',/crew/.test(h.toast()),true);
  chk('3r. the owner is not double-added to his own crew',(sh.repIds||[]).indexOf(FROG),-1);
  chk('3s. collected revenue still reads the day',ctx.showActualRev(sh),745);

  // Reopening shows the split as saved.
  h.clear();
  ctx.showMoneyModal('wh',0);
  chk('3t. reopening lands in the split, not flat',ctx._mm.on,true);
  chk('3u. with both people and their numbers',[ctx._mm.split[FROG].cash,ctx._mm.split[ISAIAH].venmo],[380,45]);
}

// ===========================================================================
R.section('4. A booth show composes: seller → booth → day');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=newShow(ctx,{id:'cf',name:'Cranberry Fest'}); ctx.S.shows.push(sh);
  ctx.boothsApply(sh,['Booth 1','Booth 2']);
  const [A,B]=ctx.showBooths(sh).map(x=>x.id);
  [A,B].forEach(id=>{const en=ctx.dayBoothWrite(sh.days[0],id);en.morningCount=cnt({'c5s':50});en.eveningCount=cnt({'c5s':30});});
  ctx.rollupDay(sh,0);

  chk('4a. the day-level modal refuses on a booth show',(()=>{ctx.showMoneyModal('cf',0);return /separate booths/.test(h.toast());})(),true);

  // Booth 1's drawer is split between Froggy and Isaiah.
  h.clear();
  ctx.showMoneyModal('cf',0,A);
  ctx.mmToggle();
  h.set('mm_add',ISAIAH); ctx.mmAddSeller();
  h.person(FROG,{cash:200}); h.person(ISAIAH,{cash:100,venmo:50});
  ctx.saveMoney();
  // Booth 2 is one flat drawer.
  h.clear();
  ctx.showMoneyModal('cf',0,B);
  h.flat({cash:175});
  ctx.saveMoney();

  const enA=ctx.dayBoothRead(sh.days[0],A), enB=ctx.dayBoothRead(sh.days[0],B);
  chk('4b. booth 1 rolled up from its two people',ctx.calcPmt(enA.payments),350);
  chk('4c. booth 2 is a flat drawer with no split',[ctx.calcPmt(enB.payments),ctx.hasSellerSplit(enB)],[175,false]);
  chk('4d. THE DAY is the sum of the booths',ctx.calcPmt(sh.days[0].payments),525);
  chk('4e. method by method at the day level',[sh.days[0].payments.cash,sh.days[0].payments.venmo],[475,50]);
  chk('4f. Isaiah reads on his own inside booth 1',ctx.sellerPmt(enA,ISAIAH),150);
  chk('4g. the whole show credits him once',ctx.showSellerTotals(sh).find(r=>r.repId===ISAIAH).total,150);
  chk('4h. and the show total is still the day total',ctx.showActualRev(sh),525);

  // Re-rolling the day must not lose the booth's seller-derived money.
  ctx.rollupDay(sh,0);
  chk('4i. a second rollup changes nothing',[ctx.calcPmt(enA.payments),ctx.calcPmt(sh.days[0].payments)],[350,525]);
  // Editing a person re-rolls both levels.
  enA.sellerPayments[ISAIAH].cash=300;
  ctx.rollupDay(sh,0);
  chk('4j. editing a person re-rolls the booth and the day',[ctx.calcPmt(enA.payments),ctx.calcPmt(sh.days[0].payments)],[550,725]);
}

// ===========================================================================
R.section('5. Whole-show totals across days and booths');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'wh',name:'Two Day',numDays:2}); ctx.S.shows.push(sh);
  [0,1].forEach(i=>sellingDay(ctx,sh,i));
  sh.days[0].sellerPayments={};
  sh.days[0].sellerPayments[FROG]=pmt({cash:300});
  sh.days[0].sellerPayments[ISAIAH]=pmt({cash:100,square:50});
  ctx.rollupSellers(sh.days[0]);
  sh.days[1].sellerPayments={};
  sh.days[1].sellerPayments[ISAIAH]=pmt({cash:200,venmo:25});
  sh.days[1].sellerPayments[BATMAN]=pmt({cash:75});
  ctx.rollupSellers(sh.days[1]);

  const tot=ctx.showSellerTotals(sh);
  chk('5a. three people across the weekend',tot.length,3);
  chk('5b. biggest first',tot.map(r=>r.name),['Isaiah','Justin (Froggy)','Batman']);
  chk('5c. Isaiah adds across both days',tot[0].total,375);
  chk('5d. his methods add too',[tot[0].payments.cash,tot[0].payments.square,tot[0].payments.venmo],[300,50,25]);
  chk('5e. the people add up to the show',tot.reduce((t,r)=>t+r.total,0),ctx.showActualRev(sh));
  chk('5f. cash / card / apps split the way the card reads them',
      [ctx.sellerCash(tot[0].payments),ctx.sellerCard(tot[0].payments),ctx.sellerApps(tot[0].payments)],[300,50,25]);
  const card=ctx.showSellerCardHTML(sh);
  chk('5g. the show card names every person',[/Isaiah/.test(card),/Batman/.test(card),/Froggy/.test(card)],[true,true,true]);
  chk('5h. and says the split is not a second set of books',/not a second set of books/.test(card),true);
  chk('5i. no card when nobody split a drawer',ctx.showSellerCardHTML(newShow(ctx,{id:'x',name:'X'})),'');
  const day=ctx.rDay(sh,0);
  chk('5j. the day screen money column lists the people',[/Isaiah/.test(day),/Froggy/.test(day)],[true,true]);
}

// ===========================================================================
R.section('6. The split and the total can never disagree');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=newShow(ctx,{id:'wh',name:'W'}); ctx.S.shows.push(sh);
  sellingDay(ctx,sh,0);
  ctx.showMoneyModal('wh',0); h.clear(); ctx.mmToggle();
  h.set('mm_add',ISAIAH); ctx.mmAddSeller();
  h.person(FROG,{cash:400}); h.person(ISAIAH,{cash:100});
  ctx.saveMoney();
  chk('6a. split saved',[ctx.calcPmt(sh.days[0].payments),ctx.drawerSellers(sh.days[0]).length],[500,2]);

  // Turning the split off leaves ONE flat count carrying the same money.
  h.clear();
  ctx.showMoneyModal('wh',0);
  ctx.mmToggle();
  chk('6b. coming out of the split, the flat count is the sum',ctx.calcPmt(ctx._mm.flat),500);
  ctx.saveMoney();
  chk('6c. saved flat: total unchanged',ctx.calcPmt(sh.days[0].payments),500);
  chk('6d. and the split is GONE, not left behind to drift',[ctx.hasSellerSplit(sh.days[0]),sh.days[0].sellerPayments],[false,undefined]);

  // A person who rang nothing is not parked in the books at $0.
  h.clear();
  ctx.showMoneyModal('wh',0); ctx.mmToggle();
  h.set('mm_add',BATMAN); ctx.mmAddSeller();
  h.person(FROG,{cash:250}); h.person(BATMAN,{});
  ctx.saveMoney();
  chk('6e. the zero row is dropped',ctx.drawerSellers(sh.days[0]),[FROG]);
  chk('6f. the total is still right',ctx.calcPmt(sh.days[0].payments),250);
  chk('6g. and a zero-ringer is not added to the crew',(sh.repIds||[]).indexOf(BATMAN),-1);

  // Every row zero is not a split at all. (It reopens IN the split, so no toggle.)
  h.clear();
  ctx.showMoneyModal('wh',0);
  chk('6g2. it reopened in the split',ctx._mm.on,true);
  h.person(FROG,{});
  ctx.saveMoney();
  chk('6h. an all-zero split is no split',[ctx.hasSellerSplit(sh.days[0]),ctx.calcPmt(sh.days[0].payments)],[false,0]);
  chk('6i. and leaves nothing behind',sh.days[0].sellerPayments,undefined);
}

// ===========================================================================
R.section('7. Refusals');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=newShow(ctx,{id:'wh',name:'W'}); ctx.S.shows.push(sh);
  sellingDay(ctx,sh,0);
  ctx.showMoneyModal('wh',0); h.clear(); ctx.mmToggle();
  h.set('mm_add',ISAIAH); ctx.mmAddSeller();
  h.person(FROG,{cash:100}); h.person(ISAIAH,{cash:50});
  ctx.saveMoney();
  sh.days[0].locked=true;
  const before=JSON.stringify(sh.days[0]);

  h.clear();
  ctx.showMoneyModal('wh',0);
  h.person(FROG,{cash:999});
  ctx.saveMoney();
  chk('7a. a finalized day refuses the save',/locked/i.test(h.toast()),true);
  chk('7b. and nothing moved',JSON.stringify(sh.days[0]),before);
  sh.days[0].locked=false;

  h.clear();
  ctx.showMoneyModal('wh',0); ctx.mmToggle(); ctx.mmToggle();
  chk('7c. toggling twice returns to the split with the money intact',[ctx._mm.on,ctx.mmSplitTotal(ctx._mm)],[true,150]);
  chk('7d. a person can be dropped from the split',(()=>{const n=ctx._mm.ids.length;ctx.mmDropSeller(ctx._mm.ids[1]);return [n,ctx._mm.ids.length];})(),[2,1]);
  chk('7e. but never the last one — that is the "one total" button\'s job',
      (()=>{ctx.mmDropSeller(ctx._mm.ids[0]);return [ctx._mm.ids.length,/one total/.test(h.toast())];})(),[1,true]);
}

// ===========================================================================
R.section('8. The written sheet');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=newShow(ctx,{id:'wh',name:'W'}); ctx.S.shows.push(sh);
  sellingDay(ctx,sh,0);
  sh.days[0].sellerPayments={};
  sh.days[0].sellerPayments[FROG]=pmt({cash:300,square:100});
  sh.days[0].sellerPayments[ISAIAH]=pmt({cash:120,venmo:45});
  ctx.rollupSellers(sh.days[0]);
  let csv=null;
  ctx.Blob=class{constructor(a){csv=String(a[0]);}};
  ctx.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};
  try{ ctx.exportShowCSV('wh'); }catch(e){}
  chk('8a. the CSV carries a money-by-person section',/Money by person/.test(csv||''),true);
  chk('8b. with a whole-show roll-up',/Money by person \(whole show\)/.test(csv||''),true);
  chk('8c. naming Isaiah and his total',/Isaiah/.test(csv||'')&&/165\.00/.test(csv||''),true);
  chk('8d. and the day total is still the payments section',/565\.00/.test(csv||''),true);
}

// ===========================================================================
R.section('9. saveMoney can be handed an explicit target');
// ===========================================================================
{
  // The modal calls it bare. Called with a target that is not the one the
  // modal is holding, it reads a flat count off the inputs instead, so money
  // can never land on a day the caller did not name.
  const h=world(),{ctx}=h;
  const a=newShow(ctx,{id:'a',name:'A'}), b=newShow(ctx,{id:'b',name:'B',numDays:2});
  ctx.S.shows.push(a,b);
  sellingDay(ctx,a,0); sellingDay(ctx,b,0); sellingDay(ctx,b,1);

  // Open the modal on show A, then save against show B day 2 instead.
  ctx.showMoneyModal('a',0);
  h.flat({cash:60});
  ctx.saveMoney('b',1);
  chk('9a. the money landed on the named show and day',ctx.calcPmt(b.days[1].payments),60);
  chk('9b. and not on the one the modal had open',ctx.calcPmt(a.days[0].payments),0);
  chk('9c. nor on the wrong day of the right show',ctx.calcPmt(b.days[0].payments),0);

  // A booth target routes to that booth and re-rolls the day.
  const c=newShow(ctx,{id:'c',name:'C'}); ctx.S.shows.push(c);
  ctx.boothsApply(c,['B1','B2']);
  const [B1]=ctx.showBooths(c).map(x=>x.id);
  ctx.dayBoothWrite(c.days[0],B1).morningCount=cnt({'c5s':10});
  h.flat({cash:75});
  ctx.saveMoney('c',0,B1);
  chk('9d. a booth target lands in that drawer',ctx.boothMoney(ctx.dayBoothRead(c.days[0],B1)),75);
  chk('9e. and rolls into the day',ctx.calcPmt(c.days[0].payments),75);

  // Handed the target the modal already holds, the split is kept.
  h.clear();
  ctx.showMoneyModal('a',0); ctx.mmToggle();
  h.set('mm_add',ISAIAH); ctx.mmAddSeller();
  h.person(FROG,{cash:200}); h.person(ISAIAH,{cash:100});
  ctx.saveMoney('a',0);
  chk('9f. the matching target keeps the split',[ctx.calcPmt(a.days[0].payments),ctx.drawerSellers(a.days[0]).length],[300,2]);
}

// ===========================================================================
R.section('10. The phone-sized split: rare methods stay folded away');
// ===========================================================================
{
  const h=world(),{ctx}=h;
  const sh=newShow(ctx,{id:'wh',name:'W'}); ctx.S.shows.push(sh);
  sellingDay(ctx,sh,0);
  ctx.showMoneyModal('wh',0); h.clear(); ctx.mmToggle();
  const m=h.modal();
  chk('10a. the four methods that get used are on screen',
      ['cash','square','debit','venmo'].every(k=>m.indexOf('id="sp_'+FROG+'_'+k+'"')>=0),true);
  chk('10b. the rare three are folded away',
      ['zelle','cashapp','paypal'].some(k=>m.indexOf('id="sp_'+FROG+'_'+k+'"')>=0),false);
  chk('10c. with a way to get them',m.indexOf('+ Zelle, Cash App, PayPal')>=0,true);
  ctx.mmAllMethods();
  chk('10d. asked for, they appear',h.modal().indexOf('id="sp_'+FROG+'_zelle"')>=0,true);
  ctx.mmAllMethods();
  chk('10e. and fold back',h.modal().indexOf('id="sp_'+FROG+'_zelle"')>=0,false);

  // A folded method that already carries money is always shown, and a save
  // never drops it just because its box was off screen.
  h.person(FROG,{cash:100});
  ctx.mmAllMethods(); h.person(FROG,{cash:100,zelle:25}); ctx.mmAllMethods();
  chk('10f. a used rare method stays visible once it has money',h.modal().indexOf('id="sp_'+FROG+'_zelle"')>=0,true);
  chk('10g. the subtotal counts it while folded',ctx.calcPmt(ctx._mm.split[FROG]),125);
  ctx.saveMoney();
  chk('10h. and the save keeps it',[ctx.sellerPmt(sh.days[0],FROG),sh.days[0].payments.zelle],[125,25]);
  chk('10i. the flat count still offers every method',
      (()=>{h.clear();ctx.showMoneyModal('wh',0);ctx.mmToggle();return PK.every(k=>h.modal().indexOf('id="pm_'+k+'"')>=0);})(),true);
}

R.done();
