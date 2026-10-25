// v96 full audit: every bug the audit reproduced, held fixed. SYNTHETIC FIXTURES ONLY.
//   node tests/full-audit-v96.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l','set'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(/^ec_(open|close)_/.test(id)&&!els[id])?null:(els[id]||(els[id]=mk())); h.els=els;
  ctx.confirm=()=>true; ctx.S.shows=[]; ctx.S.transfers=[]; ctx.S.otherExpenses=[]; ctx.S.inventory=cnt({c5s:100,'2oz':100});
  h.val=(id,v)=>{ ctx.document.getElementById(id).value=String(v); };
  h.newShow=(name,date,days)=>{ ctx.showNewShowModal(); h.val('ns_n',name); h.val('ns_d',date); h.val('ns_dy',days||1); h.val('ns_b',''); h.val('ns_m',''); h.val('ns_l','');
    ctx.window.__lastTap=null; ctx.createShow(); return ctx.S.shows.find(s=>s.name===name); };
  h.pack=(sh,m)=>{ ctx.showPackModal(sh.id); SK.forEach(k=>h.val('pk_'+k,(m||{})[k]||0)); ctx.confirmPack(sh.id); };
  h.count=(sh,di,type,m)=>{ SK.forEach(k=>h.val('c_'+k,(m||{})[k]||0)); ctx.saveCount(sh.id,di,type); };
  h.money=(sh,di,cash)=>{ ctx.showMoneyModal(sh.id,di); h.val('pm_cash',cash); ctx.saveMoney(sh.id,di); ctx.window.__lastSave=0; };
  return h;
}
const dayKey=off=>{ const d=new Date(); d.setDate(d.getDate()+off); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };

R.section('1. Pack for Show');
{ const h=world(),{ctx}=h; const sh=h.newShow('Minus','2026-11-07');
  h.pack(sh,{'2oz':-50,c5s:10});
  chk('1a. a minus sign never adds stock to the garage',[ctx.S.inventory['2oz'],ctx.S.inventory.c5s,sh.packedInventory['2oz']],[100,90,0]); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Moved In','2026-11-07'); sh.packedInventory=cnt({'2oz':10});
  h.pack(sh,{'2oz':5});
  chk('1b. stock moved in before the start stays packed',[sh.packedInventory['2oz'],sh.days[0].morningCount['2oz']],[15,15]); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Late Start',dayKey(-1),2);
  h.pack(sh,{c5s:40});
  chk('1c. started on day 2: the opening lands on day 2',[sh.days[0].morningCount,(sh.days[1].morningCount||{}).c5s],[null,40]); }

R.section('2. Close and transfers');
{ const h=world(),{ctx}=h; const A=h.newShow('Saturday',dayKey(0)), B=h.newShow('Sunday',dayKey(1));
  h.pack(A,{'2oz':40}); h.pack(B,{}); h.money(A,0,80); h.count(A,0,'evening',{'2oz':30});
  ctx.S.transfers.push({id:'t1',batch:'t1',ts:new Date().toISOString(),date:dayKey(0),sku:'2oz',qty:30,fromShowId:A.id,toShowId:B.id});
  A.packedInventory['2oz']-=30; B.packedInventory['2oz']+=30;
  chk('2a. leftovers sent on after the night count are not returned too',ctx.endShowReturns(A)['2oz'],0); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Short Garage',dayKey(0)); h.pack(sh,{c5s:10}); ctx.S.inventory.c5s=3;
  const r=ctx.garageToShow(sh,'c5s',5,0,null,'b1'); ctx.garageToShowUndo(r.rec);
  chk('2b. undoing a delivery the garage was short on gives back only what it lost',ctx.S.inventory.c5s,3); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Undo','2026-11-07'); h.pack(sh,{'2oz':40});
  sh.days[0].restock=cnt({'2oz':5}); sh.days[0].lost=cnt({'2oz':2}); ctx.undoStartShow(sh.id);
  chk('2c. Undo Start clears restock and lost',[sh.days[0].restock,sh.days[0].lost],[undefined,undefined]); }

R.section('3. Small Sets add-ons');
{ const h=world(),{ctx}=h; ctx.S.inventory=cnt({'2oz':30,c5s:30});
  const sup=ctx.SMALL_SET_ADDONS.map(a=>ctx.smallSetAddonSupply(a)).filter(Boolean); sup.forEach(s=>{ s.qty=0; delete s.inSets; });
  ctx.buildSmallSets(24); ctx.buildSmallSets(-24);
  chk('3a. break apart gives back no add-ons that were never there',sup.map(s=>s.qty).every(q=>q===0),true);
  sup.forEach(s=>{ s.qty=10; s.inSets=0; }); ctx.buildSmallSets(4); ctx.buildSmallSets(-4);
  chk('3b. and gives back what builds took',sup.map(s=>s.qty).every(q=>q===10),true); }

R.section('4. Show dates');
{ const h=world(),{ctx}=h; const sh=h.newShow('Three Day','2026-11-13',3);
  sh.days[2].expenses.hotel=120; sh.days[2].notes='hotel prepaid';
  ctx.resizeShowDays(sh,2);
  chk('4a. shrinking keeps a day with an expense on it',[sh.days.length,sh.days[2].expenses.hotel],[3,120]); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Date TBD',''); sh.createdAt='2020-01-01T00:00:00.000Z';
  chk('4b. a show with no date is never Missed',[ctx.isMissed(sh),ctx.isUpcoming(sh)],[false,true]); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Sip, Shop','2026-11-07',2); sh.location='Carol Stream, IL';
  let ics=''; ctx.URL={createObjectURL:b=>{ ics=b.a.join(''); return 'blob:x'; },revokeObjectURL(){}};
  ctx.exportCalICS();
  chk('4c. all-day event, end is the day after the last day',[/DTSTART;VALUE=DATE:20261107/.test(ics),/DTEND;VALUE=DATE:20261109/.test(ics)],[true,true]);
  chk('4d. commas escaped',[/LOCATION:Carol Stream\\, IL/.test(ics),/SUMMARY:⏳ Sip\\, Shop/.test(ics)],[true,true]); }

R.section('5. Money');
{ const h=world(),{ctx}=h; const S=ctx.S; const own=S.reps.find(r=>r.isSelf).id;
  const I=(S.reps.find(r=>/isaiah/i.test(r.name))||{}).id, C=(S.reps.find(r=>/cutty/i.test(r.name))||{}).id;
  const sh={id:'sh_b',name:'Booth Fest',status:'active',startDate:'2026-10-24',numDays:1,dates:['Oct 24'],location:'Waukesha, WI',miles:20,
    repIds:[own,C,I],booths:[{id:'b1',name:'Booth 1'},{id:'b2',name:'Booth 2'}],showExpenses:[],workers:[],boothPayments:[],boothCost:0,
    days:[{date:'Oct 24',boothCounts:{b1:{payments:{cash:800}},b2:{payments:{cash:1000}}},boothCrew:{b1:[own,C],b2:[I]},payments:{}}]};
  S.shows.push(sh); ctx.saveS(); sh.days[0].repPay[I]=300; ctx.repPayMarkManual(sh,I); ctx.saveS();
  const xi=ctx.payoutSheetData(sh).people.find(p=>p.id===I);
  chk('5a. Payout Sheet uses hand-typed pay',[xi.total,xi.owe],[300,300]); }
{ const h=world(),{ctx}=h; const S=ctx.S;
  S.settings.onlineSales=[]; S.otherExpenses=[{id:'a',date:'2026-06-01',amount:100,category:'x'},{id:'b',date:'2027-02-01',amount:40,category:'x'}];
  chk('5b. a year only counts its own purchases',[ctx.calcYTD('2026').otherSpend,ctx.calcYTD('2027').otherSpend],[100,40]);
  S.shows=[{id:'s7',name:'Winter 2027',status:'completed',startDate:'2027-02-06',numDays:1,days:[{morningCount:cnt({c5s:10}),eveningCount:cnt({c5s:5}),payments:{cash:50}}],showExpenses:[],boothPayments:[]}];
  chk('5c. and its own shows',[ctx.calcYTD('2026').gross,ctx.calcYTD('2027').gross],[0,50]);
  S.settings.tax=0; chk('5d. a 0% tax setting stays 0',ctx.showTaxRate({}),0); }

R.section('6. Sync');
{ const h=world(),{ctx}=h;
  chk('6a. protocol 3, so an app without the SET size refuses this copy',ctx.SYNC_PROTOCOL,3);
  chk('6b. a second push while one is waiting joins it',ctx.cloudPush()===ctx.cloudPush(),true); }

R.done();
