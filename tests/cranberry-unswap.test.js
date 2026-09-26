// v47 — undo the v45 Booth 2/3 swap. SYNTHETIC FIXTURE shaped like the real
// Sep 25 day: counts as Froggy entered them in the app, then what v45 did.
//   node tests/cranberry-unswap.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=a=>{const r={};SK.forEach((k,i)=>r[k]=a[i]);return r;};
const KEY='dd_bs_v7';
function build(tweak){
  const {ctx}=boot();
  ctx.S.shows=[]; ctx.S.transfers=[];
  const dd=[];for(let i=0;i<3;i++)dd.push(ctx._bsBlankDay(i+1,['Sep 25','Sep 26','Sep 27'][i]));
  const sh={id:'cran',name:'Warrens Cranberry Festival',status:'active',numDays:3,startDate:'2026-09-25',location:'Warrens, WI',miles:0,boothCost:0,boothPayments:[],dates:dd.map(d=>d.date),showExpenses:[],workers:[],repIds:[],
    prices:{'32oz':30,'16oz':25,'8oz':20,'2oz':12.5,c5s:12.5,c5l:25},confirmed:true,lodging:0,packedInventory:cnt([72,120,312,258,628,250]),days:dd};
  ctx.S.shows.push(sh); ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
  const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);
  ctx.boothSetStock(sh,0,A,'morning',cnt([24,40,72,114,174,42]));
  ctx.boothSetStock(sh,0,B,'morning',cnt([24,40,72,112,174,42]));
  ctx.boothSetStock(sh,0,C,'morning',cnt([24,40,96,32,140,42]));
  ctx.boothSetStock(sh,0,A,'evening',cnt([22,35,59,72,132,23]));
  // what v45 left behind: swapped endings, invented restocks, raised packed
  ctx.boothSetStock(sh,0,B,'evening',cnt([21,37,76,9,130,36]));
  ctx.boothSetStock(sh,0,C,'evening',cnt([16,36,49,90,148,16]));
  ctx.dayBoothWrite(sh.days[0],B).restock={'8oz':4};
  ctx.dayBoothWrite(sh.days[0],C).restock={'2oz':58,c5s:8};
  ctx.rollupDay(sh,0);
  sh.packedInventory=cnt([72,120,316,316,636,250]);
  ctx.boothSetStock(sh,1,A,'morning',cnt([22,35,59,72,132,23]));
  ctx.boothSetStock(sh,1,B,'morning',cnt([16,36,49,90,148,16]));
  ctx.boothSetStock(sh,1,C,'morning',cnt([21,37,76,9,130,36]));
  if(tweak)tweak(ctx,sh);
  delete ctx.S._applied['cranberry_day1_unswap_v47'];
  const seed={}; seed[KEY]=JSON.stringify(ctx.S);
  const c=boot(seed).ctx; return {c,sh:c.S.shows.find(s=>s.id==='cran')};
}
const row=o=>SK.map(k=>(o||{})[k]||0);
R.section('1. The swap is undone');
{
  const {c,sh}=build(); const [A,B,C]=c.showBooths(sh).map(b=>b.id); const d=sh.days[0];
  chk('1a. applied',c.S._applied['cranberry_day1_unswap_v47'],true);
  chk('1b. Booth 2 ending as entered',row(c.dayBoothRead(d,B).eveningCount),[16,36,49,90,148,16]);
  chk('1c. Booth 3 ending as entered',row(c.dayBoothRead(d,C).eveningCount),[21,37,76,9,130,36]);
  chk('1d. invented restocks gone',[c.dayBoothRead(d,B).restock,c.dayBoothRead(d,C).restock],[null,null]);
  chk('1e. packed back',row(sh.packedInventory),[72,120,312,258,628,250]);
  chk('1f. day 1 sold',row(c.daySold(d)),[13,12,56,87,78,51]);
  chk('1g. day 1 at show prices',c.calcRev(c.daySold(d),sh.prices),5147.5);
  chk('1h. day 1 truck = hand count',row(c.showLedger(sh)[0].truck),[0,0,72,0,140,124]);
  chk('1i. day 2 truck = hand count',row(c.showLedger(sh)[1].truck),[0,0,72,0,140,124]);
  chk('1j. Booth 2 opens today where it closed',c.boothCarryIssues(sh,B).filter(m=>m.di===1).length,0);
  chk('1k. no negative sales',c.auditShow(sh).some(x=>x.code==='negSold'),false);
  const seed={dd_bs_v7:JSON.stringify(c.S)}; const c2=boot(seed).ctx;
  chk('1l. second load: no change',row(c2.S.shows.find(s=>s.id==='cran').packedInventory),[72,120,312,258,628,250]);
}
R.section('2. Leaves anything else alone');
{
  const {c}=build((ctx,sh)=>{ sh.packedInventory['2oz']=300; });
  chk('2a. numbers moved since v45: untouched',c.S._applied['cranberry_day1_unswap_v47']||false,false);
  const {c:c3}=build((ctx,sh)=>{ sh.days[0].locked=true; });
  chk('2b. locked day: untouched',c3.S._applied['cranberry_day1_unswap_v47']||false,false);
}
R.done();
