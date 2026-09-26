// v45 — Cranberry day 1 closed from Froggy's hand counts. SYNTHETIC FIXTURES ONLY.
// Booths opened 24/40/72/114/174/42 each. Packing was miscounted: the app
// thought 2oz +160, 8oz −48, C5L −24 vs what was really in the boxes. The
// one-time update enters the ending counts, logs Booth 2's extra 8oz as a
// truck restock, records the truck count and fixes the packed total.
//   node tests/cranberry-day1-close.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const KEY='dd_bs_v7';
function build(tweak){
  const h=boot(); const {ctx}=h;
  const els={}; const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk()));
  ctx.S.shows=[]; ctx.S.transfers=[];
  const dd=[];for(let i=0;i<3;i++)dd.push(ctx._bsBlankDay(i+1,['Fri 9/25','Sat 9/26','Sun 9/27'][i]));
  const sh={id:'cran',name:'Warrens Cranberry Festival',status:'active',numDays:3,startDate:'2026-09-25',location:'Warrens, WI',miles:0,boothCost:0,boothPayments:[],dates:dd.map(d=>d.date),showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true,lodging:0,
    packedInventory:cnt({'32oz':72,'16oz':120,'8oz':244,'2oz':502,c5s:662,c5l:226}),days:dd};
  ctx.S.shows.push(sh); ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
  ctx.showBooths(sh).forEach(b=>ctx.boothSetStock(sh,0,b.id,'morning',cnt({'32oz':24,'16oz':40,'8oz':72,'2oz':114,c5s:174,c5l:42})));
  if(tweak)tweak(ctx,sh);
  delete ctx.S._applied['cranberry_day1_close_v45'];
  const seed={}; seed[KEY]=JSON.stringify(ctx.S);
  return boot(seed).ctx;
}
R.section('1. Opening the app closes day 1 and fixes the show');
{
  const c=build(); const sh=c.S.shows.find(s=>s.id==='cran'); const [A,B,C]=c.showBooths(sh).map(b=>b.id);
  chk('1a. applied',c.S._applied['cranberry_day1_close_v45'],true);
  chk('1b. Booth 1 ending',SK.map(k=>c.dayBoothRead(sh.days[0],A).eveningCount[k]),[22,35,59,72,132,23]);
  chk('1c. Booth 2 ending',SK.map(k=>c.dayBoothRead(sh.days[0],B).eveningCount[k]),[21,37,76,9,130,36]);
  chk('1d. Booth 3 ending',SK.map(k=>c.dayBoothRead(sh.days[0],C).eveningCount[k]),[16,36,49,90,148,16]);
  chk('1e. Booth 2 got 4 8oz off the truck',c.dayBoothRead(sh.days[0],B).restock['8oz'],4);
  chk('1f. packed now the real boxes',SK.map(k=>sh.packedInventory[k]),[72,120,292,342,662,250]);
  chk('1g. truck equals the hand count',SK.map(k=>c.showLedger(sh)[0].truck[k]),[0,0,72,0,140,124]);
  chk('1h. day 1 sold',SK.map(k=>c.daySold(sh.days[0])[k]),[13,12,36,171,112,51]);
  chk('1i. no truck finding, no negative sales',c.auditShow(sh).filter(x=>['truckCount','negSold','overTable'].includes(x.code)).length,0);
  chk('1j. logged',c.S.settings.audit.log.some(x=>x.type==='packFix'&&/day 1 closed/.test(x.msg)),true);
  chk('1k. whole show now',SK.map(k=>c.showOnHand(sh)[k]),[59,108,256,171,550,199]);
}
R.section('2. Runs once and stays out of the way');
{
  const c=build(); const sh=c.S.shows.find(s=>s.id==='cran');
  const seed={}; seed[KEY]=JSON.stringify(c.S); const c2=boot(seed).ctx; const sh2=c2.S.shows.find(s=>s.id==='cran');
  chk('2a. second load changes nothing',JSON.stringify(sh2.packedInventory),JSON.stringify(sh.packedInventory));
  const c3=build((ctx,s)=>{ s.days[0].locked=true; });
  chk('2b. a finalized day is left alone',c3.S._applied['cranberry_day1_close_v45']||false,false);
  const c4=build((ctx,s)=>{ s.name='Some Other Show'; });
  chk('2c. no Cranberry: nothing',c4.S._applied['cranberry_day1_close_v45']||false,false);
}
R.done();
