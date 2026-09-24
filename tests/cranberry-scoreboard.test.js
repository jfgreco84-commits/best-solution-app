// v42 — Cranberry show-only prices, the team scoreboard, and Batman bottles
// landing in the garage again. SYNTHETIC FIXTURES ONLY.
//
//   node tests/cranberry-scoreboard.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const NEW={'32oz':30,'16oz':25,'8oz':20,'2oz':12.5,c5s:12.5,c5l:25};

function world(){
  const h=boot();
  const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},
    insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},
    focus(){},click(){},scrollIntoView(){}});
  h.ctx.document.getElementById=id=>(els[id]||(els[id]=mk()));
  h.set=(id,v)=>{h.ctx.document.getElementById(id).value=String(v);};
  return h;
}
function state(ctx,extra){
  const days=[0,1,2].map(i=>ctx._bsBlankDay(i+1,'Day '+(i+1)));
  const cran={id:'sh_cran',name:'Cranberry Fest',status:'planned',startDate:'2026-09-25',numDays:3,days,dates:days.map(d=>d.date),
    location:'Warrens, WI',boothCost:450,boothPayments:[],showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true};
  const other={id:'sh_other',name:'Burgoo Fest',status:'planned',startDate:'2026-10-10',numDays:2,days:[ctx._bsBlankDay(1,'Day 1')],
    location:'Utica, IL',boothCost:150,boothPayments:[],showExpenses:[],workers:[],repIds:[],prices:null,confirmed:false};
  return Object.assign({v:7,inventory:cnt({'8oz':100,'2oz':100,c5l:100}),batmanBorrow:{},shows:[cran,other],
    reps:[{id:'rep_justin',name:'Justin (Froggy)',isSelf:true,active:true,payments:[]},
          {id:'rep_anthony',name:'Anthony',isSelf:false,active:true,payments:[]},
          {id:'rep_tj',name:'T.J.',isSelf:false,active:true,payments:[]}],
    prices:{'32oz':25,'16oz':20,'8oz':15,'2oz':8,c5s:10,c5l:20},settings:{},_applied:{}},extra||{});
}

// ===========================================================================
R.section('1. Cranberry gets its own prices; nothing else moves');
// ===========================================================================
{
  const {ctx}=world();
  const d=state(ctx);
  ctx.applyOneTimeUpdates(d);
  const cran=d.shows.find(s=>s.id==='sh_cran'), other=d.shows.find(s=>s.id==='sh_other');
  chk('1a. Cranberry prices are the new ones',SK.map(k=>cran.prices[k]),SK.map(k=>NEW[k]));
  chk('1b. app-wide prices untouched',d.prices['32oz'],25);
  chk('1c. another show has no Cranberry prices',!!(other.prices&&other.prices['32oz']===30),false);
  ctx.S=d;
  chk('1d. revenue at Cranberry uses $30 for a 32oz',ctx.calcRev(cnt({'32oz':2,'2oz':2}),cran.prices),85);
  chk('1e. the show screen shows a show-prices card',/Prices at this show only/.test(ctx.showPricesLineHTML(cran)),true);
  chk('1f. a show at normal prices shows no card',ctx.showPricesLineHTML(other),'');
}

// ===========================================================================
R.section('2. Teams are seeded and Les joins the roster');
// ===========================================================================
{
  const {ctx}=world();
  const d=state(ctx);
  ctx.applyOneTimeUpdates(d);
  const cran=d.shows.find(s=>s.id==='sh_cran');
  chk('2a. three teams',cran.teams.map(t=>t.name),['Froggy + Cutty','Les + Anthony','TJ + Dave']);
  chk('2b. Les added once',d.reps.filter(r=>/^les$/i.test(r.name)).length,1);
  chk('2c. Froggy + Cutty ids',cran.teams[0].repIds,['rep_justin','rep_cutty']);
  chk('2d. TJ matched by "T.J."',cran.teams[2].repIds[0],'rep_tj');
  const again=JSON.stringify(cran.teams); ctx.applyOneTimeUpdates(d);
  chk('2e. second run changes nothing',JSON.stringify(cran.teams),again);
}

// ===========================================================================
R.section('3. Scoreboard: booth marks, money by method, pay, ranking');
// ===========================================================================
{
  const {ctx}=world();
  const d=state(ctx); ctx.applyOneTimeUpdates(d); ctx.S=d;
  const cran=d.shows.find(s=>s.id==='sh_cran');
  if(!ctx.hasBooths(cran))ctx.boothsApply(cran,['Booth 1','Booth 2','Booth 3']);
  const [b1,b2,b3]=ctx.showBooths(cran).map(b=>b.id);
  const T=cran.teams;
  chk('3a. mark Les + Anthony on Booth 2, day 1',ctx.setTeamBooth(cran,0,T[1].id,b2).ok,true);
  chk('3b. that is the booth crew too',ctx.dayBoothCrew(cran,0,b2),T[1].repIds);
  ctx.setTeamBooth(cran,0,T[2].id,b3);
  ctx.setTeamBooth(cran,0,T[0].id,b1);
  ctx.dayBoothWrite(cran.days[0],b2).payments={cash:300,square:200,venmo:50};
  ctx.dayBoothWrite(cran.days[0],b3).payments={cash:100,zelle:40};
  ctx.dayBoothWrite(cran.days[0],b1).payments={cash:120};
  const m=ctx.teamDayMoney(cran,0,T[1]);
  chk('3c. team money is its booth drawer',[m.total,m.p.cash,m.p.square,m.p.venmo],[550,300,200,50]);
  cran.days[0].repPay={rep_les:0,rep_anthony:80,rep_cutty:60};
  const lesId=T[1].repIds[0]; cran.days[0].repPay[lesId]=90;
  chk('3d. team pay for the day',ctx.teamDayPay(cran,0,T[1]),170);
  // day 2: swap, Les + Anthony to Booth 3 (TJ + Dave come off it)
  ctx.setTeamBooth(cran,1,T[1].id,b3);
  chk('3e. TJ + Dave now unmarked on day 2',ctx.teamBoothOnDay(cran,1,T[2]),null);
  chk('3f. Les + Anthony on Booth 3 day 2',ctx.teamBoothOnDay(cran,1,T[1]),b3);
  ctx.dayBoothWrite(cran.days[1],b3).payments={square:400};
  const tot=ctx.teamShowTotals(cran,T[1]);
  chk('3g. 3-day running total',[tot.total,tot.p.square,tot.pay],[950,600,170]);
  const html=ctx.teamScoreboardHTML(cran);
  chk('3h. leader gets the gold medal',html.indexOf('🥇 Les + Anthony')>=0,true);
  chk('3i. booth picker is on the card',/Mark booth/.test(html),true);
  chk('3j. pay chip opens day pay',/openRepDayPay\('sh_cran','rep_anthony'\)/.test(html),true);
  chk('3k. a show without teams renders nothing',ctx.teamScoreboardHTML(d.shows.find(s=>s.id==='sh_other')),'');
}

// ===========================================================================
R.section('4. Batman: borrowing puts bottles in the garage again');
// ===========================================================================
{
  const {ctx}=world();
  // first load: every older migration settles, Batman tally is still empty
  const d=state(ctx);
  ctx.applyOneTimeUpdates(d);
  chk('4a. no borrow yet: stays pending',!!d._applied['batman_to_garage_20260924'],false);
  d.inventory=cnt({'8oz':100,'2oz':100,c5l:100});
  ctx.applyOneTimeUpdates(d);
  chk('4b. and the garage is untouched',[d.inventory.c5l,d.inventory['2oz'],d.inventory['8oz']],[100,100,100]);
  // the Sep 24 entry arrives (debt only, the old way)
  d.batmanBorrow={c5l:34,'2oz':80,'8oz':48,c5s:280};
  ctx.applyOneTimeUpdates(d);
  chk('4c. Sep 24 borrow lands in the garage',[d.inventory.c5l,d.inventory['2oz'],d.inventory['8oz'],d.inventory.c5s],[134,180,148,0]);
  ctx.applyOneTimeUpdates(d);
  chk('4d. only once',[d.inventory.c5l,d.inventory['2oz'],d.inventory['8oz']],[134,180,148]);

  const h=world(); const x=h.ctx;
  x.S.inventory=cnt({'32oz':10}); x.S.batmanBorrow={};
  SK.forEach(k=>h.set('bma_'+k,k==='32oz'?12:''));
  x.applyAddBatman();
  chk('4e. + Borrowed More adds to debt and garage',[x.S.batmanBorrow['32oz'],x.S.inventory['32oz']],[12,22]);
  SK.forEach(k=>h.set('bmr_'+k,k==='32oz'?5:''));
  x.applyReturnBatman();
  chk('4f. Returned lowers debt and garage',[x.S.batmanBorrow['32oz'],x.S.inventory['32oz']],[7,17]);
  SK.forEach(k=>h.set('bms_'+k,k==='32oz'?3:0));
  x.applySetBatman();
  chk('4g. Set Exact touches only the debt',[x.S.batmanBorrow['32oz'],x.S.inventory['32oz']],[3,17]);
}

R.done();
