// v73 — Burgoo Fest 2026 restock repair. SYNTHETIC FIXTURES ONLY.
//
//   node tests/burgoo-restock-fix.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const K=['32oz','16oz','8oz','2oz','c5s','c5l'];
const row=o=>K.map(k=>(o||{})[k]||0);
const OPEN={'32oz':10,'16oz':10,'8oz':10,'2oz':40,c5s:60,c5l:10};
const SATCLOSE={...OPEN,'2oz':20,c5s:30};
const BIG={'32oz':40,'16oz':40,'8oz':40,'2oz':200,c5s:300,c5l:40};

function world(packed){
  const days=[ctx._bsBlankDay(1,'Sat'),ctx._bsBlankDay(2,'Sun')];
  const sh={id:'bg',name:'Burgoo Fest',location:'Utica, IL',status:'active',startDate:'2026-10-10',numDays:2,days,
    booths:[{id:'booth1',name:'F37',repIds:[]},{id:'booth2',name:"Jamie's Outpost",repIds:[]}],
    packedInventory:{...(packed||BIG)},boothPayments:[],showExpenses:[],workers:[],repIds:[]};
  const d={v:7,inventory:{'2oz':300,c5s:400},shows:[sh],reps:[],settings:{},_applied:{},transfers:[]};
  ctx.S=d;
  ['booth1','booth2'].forEach(b=>{ ctx.boothSetStock(sh,0,b,'morning',OPEN); ctx.boothSetStock(sh,0,b,'evening',SATCLOSE);
    ctx.boothSetStock(sh,1,b,'morning',SATCLOSE); });
  return {d,sh};
}
const e=(sh,di,b)=>ctx.dayBoothRead(sh.days[di],b);
const rk=(sh,di,b)=>{ const r=(e(sh,di,b)||{}).restock||{}; return [r['2oz']||0,r.c5s||0]; };
const op=(sh,di,b)=>{ const m=(e(sh,di,b)||{}).morningCount||{}; return [m['2oz']||0,m.c5s||0]; };
const setRk=(sh,di,b,q)=>{ ctx.dayBoothWrite(sh.days[di],b).restock={'2oz':q,c5s:q}; ctx.rollupDay(sh,di); };
function rightShape(t,sh,d){
  chk(t+' F37 restock 33/33',rk(sh,1,'booth1'),[33,33]);
  chk(t+' JO restock 24/24',rk(sh,1,'booth2'),[24,24]);
  chk(t+' F37 opening = last night',op(sh,1,'booth1'),[20,30]);
  chk(t+' JO opening = last night',op(sh,1,'booth2'),[20,30]);
  chk(t+' F37 on hand 53/63',[ctx.boothOnHand(sh,1,'booth1')['2oz'],ctx.boothOnHand(sh,1,'booth1').c5s],[53,63]);
  chk(t+' JO on hand 44/54',[ctx.boothOnHand(sh,1,'booth2')['2oz'],ctx.boothOnHand(sh,1,'booth2').c5s],[44,54]);
  chk(t+' Saturday sold untouched (20/30 each booth)',[ctx.boothSold(sh.days[0],'booth1')['2oz'],ctx.boothSold(sh.days[0],'booth2').c5s],[20,30]);
  chk(t+' no "booths hold more than the show has"',ctx.truckShort(sh).length,0);
  chk(t+' day total restock 57/57',[sh.days[1].restock['2oz'],sh.days[1].restock.c5s],[57,57]);
}

R.section('A. Entered correctly: nothing changes');
{ const {d,sh}=world(); setRk(sh,1,'booth1',33); setRk(sh,1,'booth2',24);
  const before=JSON.stringify(sh.days); const r=ctx.burgooRestockFix(d);
  chk('A0. done',r.done,true); chk('A1. no changes listed',r.log,[]);
  chk('A2. days identical',JSON.stringify(sh.days),before); rightShape('A.',sh,d);
  chk('A3. garage untouched',[d.inventory['2oz'],d.inventory.c5s],[300,400]); }

R.section('B. Opening raised AND restock entered (double count)');
{ const {d,sh}=world(); setRk(sh,1,'booth1',33); setRk(sh,1,'booth2',24);
  ctx.boothSetStock(sh,1,'booth1','morning',{...SATCLOSE,'2oz':53,c5s:63}); ctx.boothSetStock(sh,1,'booth2','morning',{...SATCLOSE,'2oz':44,c5s:54});
  ctx.burgooRestockFix(d); rightShape('B.',sh,d); }

R.section('B2. Restock typed into the opening only, no restock entry');
{ const {d,sh}=world();
  ctx.boothSetStock(sh,1,'booth1','morning',{...SATCLOSE,'2oz':53,c5s:63}); ctx.boothSetStock(sh,1,'booth2','morning',{...SATCLOSE,'2oz':44,c5s:54});
  ctx.burgooRestockFix(d); rightShape('B2.',sh,d); }

R.section('C. Restock logged on Saturday');
{ const {d,sh}=world(); setRk(sh,0,'booth1',33); setRk(sh,0,'booth2',24);
  chk('C0. before: Saturday F37 shows 53 2oz sold',ctx.boothSold(sh.days[0],'booth1')['2oz'],53);
  ctx.burgooRestockFix(d); rightShape('C.',sh,d);
  chk('C1. Saturday restock gone',[rk(sh,0,'booth1'),rk(sh,0,'booth2')],[[0,0],[0,0]]); }

R.section('C2. Saturday restock of OTHER amounts is left alone');
{ const {d,sh}=world(); setRk(sh,0,'booth1',12); setRk(sh,1,'booth1',33); setRk(sh,1,'booth2',24);
  ctx.burgooRestockFix(d); chk('C2. Saturday 12/12 kept',rk(sh,0,'booth1'),[12,12]); }

R.section('D. Bottles came from the garage (show packed too few)');
{ const {d,sh}=world({...BIG,'2oz':80,c5s:120}); setRk(sh,1,'booth1',33); setRk(sh,1,'booth2',24);
  chk('D0. before: booths hold more than the show',ctx.truckShort(sh).length>0,true);
  ctx.burgooRestockFix(d); rightShape('D.',sh,d);
  chk('D1. garage down by 57 each',[d.inventory['2oz'],d.inventory.c5s],[243,343]);
  chk('D2. packed up by 57 each',[sh.packedInventory['2oz'],sh.packedInventory.c5s],[137,177]);
  chk('D3. one ledger row per size',d.transfers.length,2); }

R.section('E. Wrong numbers (57 on one booth, nothing on the other)');
{ const {d,sh}=world(); setRk(sh,1,'booth1',57);
  ctx.burgooRestockFix(d); rightShape('E.',sh,d); }

R.section('F. Runs twice = runs once; logs; guards');
{ const {d,sh}=world(); setRk(sh,0,'booth1',33);
  ctx.burgooRestockFix(d); const once=JSON.stringify(sh.days)+JSON.stringify(d.inventory);
  ctx.burgooRestockFix(d); chk('F1. second run changes nothing',JSON.stringify(sh.days)+JSON.stringify(d.inventory),once);
  chk('F2. logged on the show',sh.invLog.some(x=>/Restock repair \(v73\)/.test(x.type)),true);
  chk('F3. in the audit log',d.settings.audit.log.some(x=>/v73/.test(x.msg)),true);
  const {d:d2,sh:s2}=world(); s2.status='completed'; chk('F4. a closed Burgoo is not touched',ctx.burgooRestockFix(d2).done,false);
  const {d:d3,sh:s3}=world(); s3.booths=[s3.booths[0]]; chk('F5. needs exactly two booths',ctx.burgooRestockFix(d3).done,false);
  const {d:d4,sh:s4}=world(); s4.days[1].boothCounts={}; ctx.rollupDay(s4,1); chk('F6. needs a day-2 opening',ctx.burgooRestockFix(d4).done,false);
  chk('F7. no Burgoo, no crash',ctx.burgooRestockFix({shows:[]}).done,false); }

R.section('G. Wired into the load path behind its marker');
{ const {d,sh}=world(); setRk(sh,0,'booth1',33); setRk(sh,0,'booth2',24);
  ctx.applyOneTimeUpdates(d); chk('G1. marker set',d._applied['burgoo_restock_fix_v73'],true);
  rightShape('G.',d.shows.find(x=>x.id==='bg'),d); }
R.section('H. A pre-filled third day does not steal the restock');
{ const {d,sh}=world(); sh.days.push(ctx._bsBlankDay(3,'Mon')); sh.numDays=3;
  setRk(sh,1,'booth1',33); setRk(sh,1,'booth2',24);
  ['booth1','booth2'].forEach(b=>{ const e=ctx.dayBoothWrite(sh.days[2],b); e.morningCount={...SATCLOSE}; e.morningSeeded=true; }); ctx.rollupDay(sh,2);
  const r=ctx.burgooRestockFix(d); chk('H1. repairs day 2, not day 3',r.day,1); chk('H2. nothing to change',r.log,[]);
  chk('H3. day 3 has no restock',rk(sh,2,'booth1'),[0,0]); }
{ const {d,sh}=world(); sh.days.push(ctx._bsBlankDay(3,'Mon')); sh.numDays=3; setRk(sh,0,'booth1',33); setRk(sh,0,'booth2',24);
  ctx.boothSetStock(sh,1,'booth1','evening',SATCLOSE); ctx.boothSetStock(sh,1,'booth2','evening',SATCLOSE);
  ['booth1','booth2'].forEach(b=>{ const e=ctx.dayBoothWrite(sh.days[2],b); e.morningCount={...SATCLOSE}; e.morningSeeded=true; }); ctx.rollupDay(sh,2);
  chk('H4. Saturday restock moves to the worked day 2, not pre-filled day 3',ctx.burgooRestockFix(d).day,1); }
R.done();
