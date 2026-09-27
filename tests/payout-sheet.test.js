// v57 payout sheet: pay follows the 35% commission on Cranberry, per day and total,
// extras added in, Paid ✓ logs the payment, P&L carries every day's pay.
const {boot}=require('./harness.js');
const fs=require('fs'), path=require('path');
let fails=0, n=0;
function chk(name,got,want){ n++; const ok=JSON.stringify(got)===JSON.stringify(want); if(!ok)fails++; console.log((ok?'  PASS  ':'  FAIL  ')+name+'   got='+JSON.stringify(got)+(ok?'':'  want='+JSON.stringify(want))); }
const r2=x=>Math.round(x*100)/100;

// Seed: a 3-booth show, owner + Cutty on B1, TJ + Dave on B2, Les / Anthony by person on B3.
const {ctx}=boot();
const S=ctx.S;
const rid=name=>{ let r=S.reps.find(x=>x.name===name); if(!r){ r={id:'rep_'+name.toLowerCase(),name,active:true,payments:[]}; S.reps.push(r);} return r.id; };
const own=S.reps.find(r=>r.isSelf);
const C=rid('Cutty'),T=rid('TJ'),D=rid('Dave'),L=rid('Les'),A=rid('Anthony'),I=rid('Isaiah');
const sh={id:'sh_t',name:'Test Fest',status:'active',startDate:'2026-09-25',numDays:3,dates:['2026-09-25','2026-09-27'],
  repIds:[own.id,C,T,D,L,A,I],booths:[{id:'b1',name:'Booth 1'},{id:'b2',name:'Booth 2'},{id:'b3',name:'Booth 3'}],
  days:[0,1,2].map(i=>({date:'Sep '+(25+i),boothCounts:{},boothCrew:{b1:[own.id,C],b2:[T,D],b3:[L,A]},payments:{}})),
  workers:[{id:'w1',repId:D,name:'Dave',role:'Cooking',type:'flat',amount:200,paid:0}],payFromCommission:true};
sh.days[2].boothCrew={b1:[T,D],b2:[L,A],b3:[own.id,C]};   // Sunday rotation
S.shows.push(sh);
const pay=(di,b,p,sp)=>{ sh.days[di].boothCounts[b]=Object.assign(sh.days[di].boothCounts[b]||{},{payments:p},sp?{sellerPayments:sp}:{}); };
pay(0,'b1',{cash:1695}); pay(0,'b2',{cash:1497}); pay(0,'b3',{cash:1785},{[L]:{cash:1110},[A]:{cash:675}});
pay(1,'b1',{cash:1969}); pay(1,'b2',{cash:1035}); pay(1,'b3',{cash:2305},{[L]:{cash:1135},[A]:{cash:1170}});
sh.days[0].repPay={[C]:297.5,[L]:388.5,[A]:236.25,[T]:262.5,[D]:262.5};   // hand-typed, rounded
ctx.saveS();

console.log('1. day pay follows the commission');
chk('1a. Friday corrected to the exact commission',[C,T,D,L,A].map(id=>sh.days[0].repPay[id]),[296.63,261.98,261.98,388.5,236.25]);
chk('1b. Saturday filled in on its own',[C,T,D,L,A].map(id=>sh.days[1].repPay[id]),[344.58,181.13,181.13,397.25,409.5]);
chk('1c. Sunday empty until counted',Object.keys(sh.days[2].repPay||{}).length,0);
chk('1d. owner never gets pay',sh.days.some(d=>d.repPay&&d.repPay[own.id]!=null),false);
const t=ctx.calcShow(sh);
chk('1e. P&L rep pay = every day of commission',r2(t.repPay),2958.93);
chk('1f. Dave extra counted once, as worker pay',t.workerPay,200);

console.log('2. payout sheet');
const X=ctx.payoutSheetData(sh);
const by=id=>X.people.find(p=>p.id===id);
chk('2a. per-person totals',[L,A,C,T,D].map(id=>by(id).total),[785.75,645.75,641.21,443.11,643.11]);
chk('2b. Dave: commission + $200 extra',[by(D).comm,by(D).extra],[443.11,200]);
chk('2c. day columns are Day 1/2/3 Fri/Sat/Sun',X.days.map(d=>d.lbl.n+' '+d.lbl.wd),['Day 1 Fri','Day 2 Sat','Day 3 Sun']);
chk('2d. sheet total = P&L rep + extra',X.total,r2(t.repPay+t.workerPay));
chk('2e. Isaiah (never on a booth) is not on the sheet',!!by(I),false);
chk('2f. sales credited: Cutty half his booth, Les his own',[by(C).sales[0],by(L).sales[1]],[847.5,1135]);
chk('2g. booth worked each day',by(L).booth.slice(0,2),['Booth 3','Booth 3']);
const html=ctx.payoutSheetHTML(sh);
chk('2h. card shows the headings',[/Payout Sheet/.test(html),/Pay them out/.test(html),/Rep stats/.test(html),/not in yet/.test(html)],[true,true,true,true]);

console.log('3. Paid ✓');
ctx.confirm=()=>true;
ctx.payoutMarkPaid(sh.id,D);
const Y=ctx.payoutSheetData(sh), dv=Y.people.find(p=>p.id===D);
chk('3a. Dave paid up',[dv.paid,dv.owe],[643.11,0]);
chk('3b. $200 on the worker line, the rest on his rep page',[sh.workers[0].paid,ctx.repPaid(D,sh.id)],[200,443.11]);
chk('3c. rep page owes nothing for this show',r2(ctx.repOwed(D,sh.id)),0);
chk('3d. nobody else touched',Y.people.filter(p=>p.id!==D).every(p=>p.paid===0),true);

console.log('4. Sunday comes in: totals grow on their own');
pay(2,'b1',{cash:1000}); ctx.saveS();
chk('4a. Sunday pay for TJ + Dave',[sh.days[2].repPay[T],sh.days[2].repPay[D]],[175,175]);
const Z=ctx.payoutSheetData(sh);
chk('4b. Dave owes just Sunday again',Z.people.find(p=>p.id===D).owe,175);

console.log('5. manual day pay is blocked on a commission show');
let msg=''; ctx.toast=m=>msg=m; ctx.openRepDayPay(sh.id,T);
chk('5a. tells you where pay lives',/Payout Sheet/.test(msg),true);

console.log('\n'+(fails?'FAILED '+fails+' of '+n:'ALL '+n+' CHECKS PASS'));
if(fails)process.exitCode=1;
