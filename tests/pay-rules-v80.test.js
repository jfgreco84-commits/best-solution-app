// v80 — pay rules: Isaiah 40% of his own sales, everyone else 35%; a day next to the
// owner splits the 35%; hand-typed pay wins; older shows keep their pay. SYNTHETIC FIXTURES ONLY.
//   node tests/pay-rules-v80.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els;
  const S=ctx.S; S.shows=[];
  const own=S.reps.find(r=>r.isSelf);
  const add=(id,name,rate)=>{ let r=S.reps.find(x=>x.id===id); if(!r){ r={id,name,active:true,payments:[]}; S.reps.push(r); } if(rate!=null)r.commRate=rate; else delete r.commRate; return id; };
  h.own=own.id; h.isa=add('rep_isaiah','Isaiah',0.40); h.tj=add('rep_tj','T.J.'); h.an=add('rep_anthony','Anthony');
  return h;
}
const day=(ctx,i,o)=>Object.assign(ctx._bsBlankDay(i+1,'Day '+(i+1)),o||{});
function tableShow(h,o){ const {ctx}=h; const sh=Object.assign({id:'t',name:'Table Show',status:'active',startDate:'2026-10-24',numDays:1,dates:['2026-10-24'],
  repIds:[],repOnlyShow:true,showExpenses:[],workers:[],days:[day(ctx,0,{payments:{cash:1000}})]},o||{}); ctx.S.shows.push(sh); return sh; }
function boothShow(h,crew,o){ const {ctx}=h; const sh=Object.assign({id:'b',name:'Booth Show',status:'active',startDate:'2026-10-24',numDays:1,dates:['2026-10-24'],
  repIds:[],repOnlyShow:false,showExpenses:[],workers:[],booths:[{id:'b1',name:'Booth 1'}],
  days:[day(ctx,0,{boothCounts:{b1:{payments:{cash:1000}}},boothCrew:{b1:crew}})]},o||{}); ctx.S.shows.push(sh); return sh; }
const pay=sh=>sh.days[0].repPay||{};

R.section('1. Rates on their own sales');
{ const h=world(),{ctx}=h; const sh=tableShow(h,{repIds:[h.isa]}); ctx.commissionSyncAll();
  chk('1a. Isaiah alone: 40% of $1,000',pay(sh)[h.isa],400); }
{ const h=world(),{ctx}=h; const sh=tableShow(h,{repIds:[h.tj]}); ctx.commissionSyncAll();
  chk('1b. T.J. alone: 35% of $1,000',pay(sh)[h.tj],350); }
{ const h=world(),{ctx}=h; const sh=boothShow(h,[h.isa,h.tj]); ctx.commissionSyncAll();
  chk('1c. Isaiah + T.J. (no owner) split the sales, each at their rate',[pay(sh)[h.isa],pay(sh)[h.tj]],[200,175]); }
{ const h=world(),{ctx}=h; const sh=boothShow(h,[h.isa,h.tj]); sh.days[0].boothCounts.b1.sellerPayments={[h.isa]:{cash:600},[h.tj]:{cash:400}}; ctx.commissionSyncAll();
  chk('1d. drawer split by person: each on their own sales',[pay(sh)[h.isa],pay(sh)[h.tj]],[240,140]); }

R.section('2. Side by side with the owner: the 35% is split');
{ const h=world(),{ctx}=h; const sh=boothShow(h,[h.own,h.tj]); ctx.commissionSyncAll();
  chk('2a. owner + T.J.: T.J. gets half of 35%',pay(sh)[h.tj],175); }
{ const h=world(),{ctx}=h; const sh=boothShow(h,[h.own,h.isa]); ctx.commissionSyncAll();
  chk('2b. owner + Isaiah: also half of 35%',pay(sh)[h.isa],175); }
{ const h=world(),{ctx}=h; const sh=tableShow(h,{repIds:[h.isa],repOnlyShow:false}); ctx.commissionSyncAll();
  chk('2c. no booths, owner working the show with Isaiah',pay(sh)[h.isa],175);
  chk('2d. the owner is never paid',pay(sh)[h.own],undefined); }
{ const h=world(),{ctx}=h; const sh=boothShow(h,[h.own,h.isa]); sh.numDays=2; sh.days.push(day(ctx,1,{boothCounts:{b1:{payments:{cash:500}}},boothCrew:{b1:[h.isa]}})); ctx.commissionSyncAll();
  chk('2e. day by day: next to owner Saturday, alone Sunday',[sh.days[0].repPay[h.isa],sh.days[1].repPay[h.isa]],[175,200]); }

R.section('3. Pay typed by hand wins');
{ const h=world(),{ctx}=h; const sh=tableShow(h,{repIds:[h.isa]}); ctx.commissionSyncAll();
  ctx.document.getElementById('rdp_0').value='450'; ctx.saveRepDayPay('t',h.isa);
  chk('3a. typed $450 stays',pay(sh)[h.isa],450);
  chk('3b. and is marked as typed',!!(sh.repPayManual&&sh.repPayManual[h.isa]),true);
  sh.days[0].payments={cash:2000}; ctx.commissionSyncAll();
  chk('3c. more sales later do not change it',pay(sh)[h.isa],450);
  ctx.document.getElementById('rdp_0').value=''; ctx.saveRepDayPay('t',h.isa);
  chk('3d. clearing it goes back to automatic 40%',pay(sh)[h.isa],800); }
{ const h=world(),{ctx}=h; const sh=tableShow(h,{repIds:[h.isa]}); ctx.commissionSyncAll();
  ctx.document.getElementById('rdp_0').value='400'; ctx.saveRepDayPay('t',h.isa);
  chk('3e. saving without changing anything keeps it automatic',!!(sh.repPayManual&&sh.repPayManual[h.isa]),false);
  ctx.openDayPay('t',0); ctx.document.getElementById('dp_'+h.isa).value='380'; ctx.saveDayPay('t',0);
  chk('3f. typed on the day screen stays too',[pay(sh)[h.isa],!!sh.repPayManual[h.isa]],[380,true]); }

R.section('4. Shows before Oct 17 keep their pay');
{ const h=world(),{ctx}=h; const sh=boothShow(h,[h.isa,h.tj],{startDate:'2026-10-10'}); sh.days[0].repPay={[h.isa]:446,[h.tj]:350}; ctx.commissionSyncAll();
  chk('4a. hand pay on an older show untouched',pay(sh),{[h.isa]:446,[h.tj]:350}); }
{ const h=world(),{ctx}=h; const sh=boothShow(h,[h.isa,h.tj],{startDate:'2026-09-25',payFromCommission:true}); ctx.commissionSyncAll();
  chk('4b. older commission show stays at 35% for everyone',[pay(sh)[h.isa],pay(sh)[h.tj]],[175,175]); }
{ const h=world(),{ctx}=h; const sh=tableShow(h,{repIds:[h.isa],startDate:'2026-12-05',status:'planned',days:[day(ctx,0)]}); ctx.commissionSyncAll();
  chk('4c. upcoming show with no sales: nothing written',Object.keys(pay(sh)).length,0); }

R.section('5. Migration');
{ const h=world(),{ctx}=h; const d=JSON.parse(JSON.stringify(ctx.S)); d._applied=Object.assign({},d._applied); delete d._applied.pay_rules_v80;
  d.reps.find(r=>r.id==='rep_isaiah').commRate=undefined; delete d.reps.find(r=>r.id==='rep_isaiah').commRate;
  d.shows=[{id:'n',name:'New',status:'active',startDate:'2026-10-17',days:[{repPay:{rep_isaiah:120}}]},{id:'o',name:'Old',status:'completed',startDate:'2026-10-10',days:[{repPay:{rep_isaiah:446}}]}];
  ctx.applyOneTimeUpdates(d);
  chk('5a. Isaiah set to 40%',d.reps.find(r=>r.id==='rep_isaiah').commRate,0.4);
  chk('5b. pay already on an Oct 17+ show is kept as typed',d.shows.find(s=>s.id==='n').repPayManual,{rep_isaiah:true});
  chk('5c. older shows not touched',d.shows.find(s=>s.id==='o').repPayManual,undefined);
  d.reps.find(r=>r.id==='rep_isaiah').commRate=0.45; const once=JSON.stringify(d); ctx.applyOneTimeUpdates(d);
  chk('5d. runs once: a rate you change later stays',d.reps.find(r=>r.id==='rep_isaiah').commRate,0.45);
  chk('5e. second load changes nothing else',JSON.stringify(d).replace(/"ts":"[^"]*"/g,'')===once.replace(/"ts":"[^"]*"/g,''),true); }

R.section('6. Edit Rep sets the rate');
{ const h=world(),{ctx}=h; ctx.openEditRep(h.tj); ['er_name','er_phone'].forEach(k=>ctx.document.getElementById(k).value=k==='er_name'?'T.J.':'');
  ctx.document.getElementById('er_active').checked=true; ctx.document.getElementById('er_rate').value='37.5'; ctx.saveEditRep(h.tj);
  chk('6a. T.J. now 37.5%',ctx.repCommRate(h.tj),0.375);
  chk('6b. a rep with no rate set is 35%',ctx.repCommRate(h.an),0.35); }
R.done();
