// v92 — a rep taken off the crew stopped counting. Chicago Women's Expo, Oct 25:
// Michele typed $227, the day said $378.67 because Alivia (off the crew) still held
// an auto $151.67 (35% of $1,300 split 3 ways) that kept her in the split. SYNTHETIC FIXTURES ONLY.
//   node tests/off-crew-pay-v92.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els;
  const S=ctx.S; S.shows=[];
  ['rep_alivia','rep_michele'].forEach((id,i)=>{ if(!S.reps.find(r=>r.id===id))S.reps.push({id,name:['Alivia','Michele'][i],active:true,payments:[]}); });
  const sh={id:'x',name:"Chicago Women's Expo",status:'active',startDate:'2026-10-24',numDays:1,dates:['2026-10-25'],
    repIds:['rep_alivia','rep_michele'],repOnlyShow:false,showExpenses:[],workers:[],
    days:[Object.assign(ctx._bsBlankDay(1,'Day 1'),{payments:{cash:1300}})]};
  S.shows.push(sh); h.sh=sh; return h;
}
const pay=sh=>sh.days[0].repPay||{};

R.section('1. Taken off the crew: auto pay goes away');
{ const h=world(),{ctx,sh}=h; ctx.commissionSyncAll();
  chk('1a. owner + 2 reps: 35% of $1,300 split 3 ways',[pay(sh).rep_alivia,pay(sh).rep_michele],[151.67,151.67]);
  sh.repIds=['rep_michele']; ctx.commissionSyncAll();
  chk('1b. Alivia off: no pay left for her',pay(sh).rep_alivia,undefined);
  chk('1c. Michele now gets half',pay(sh).rep_michele,227.5);
  ctx.openDayPay('x',0); ctx.document.getElementById('dp_rep_michele').value='227'; ctx.saveDayPay('x',0); ctx.commissionSyncAll();
  chk('1d. Michele typed $227: day total is $227',ctx.calcDayPay(sh.days[0]),227); }

R.section('2. Pay you typed for someone off the crew stays, and shows on the day');
{ const h=world(),{ctx,sh}=h; ctx.commissionSyncAll();
  ctx.openDayPay('x',0); ctx.document.getElementById('dp_rep_alivia').value='100'; ctx.saveDayPay('x',0);
  sh.repIds=['rep_michele']; ctx.commissionSyncAll();
  chk('2a. typed pay kept',pay(sh).rep_alivia,100);
  chk('2b. Day Pay screen still lists her so it can be cleared',ctx.dayPayIds(sh,sh.days[0]),['rep_michele','rep_alivia']);
  ctx.openDayPay('x',0); ctx.document.getElementById('dp_rep_alivia').value=''; ctx.saveDayPay('x',0); ctx.commissionSyncAll();
  chk('2c. cleared: gone',pay(sh).rep_alivia,undefined); }

R.section('3. Sales still count');
{ const h=world(),{ctx,sh}=h; sh.repIds=['rep_michele']; sh.repOnlyShow=true;
  sh.days[0].sellerPayments={rep_alivia:{cash:300},rep_michele:{cash:1000}}; ctx.commissionSyncAll();
  chk('3a. a seller with money is still paid on her own sales',[pay(sh).rep_alivia,pay(sh).rep_michele],[105,350]); }

R.done();
