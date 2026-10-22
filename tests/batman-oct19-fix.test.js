// v88: put the Batman debt back to what the Oct 19 return left, on the stale
// copy only (no return in History, C5-S 1054, C5-L 445). SYNTHETIC FIXTURES.
//
//   node tests/batman-oct19-fix.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(), chk=R.check;
const STALE={'32oz':119,'16oz':84,'8oz':147,'2oz':343,c5s:1054,c5l:445};
const OCT16={id:'bmh_v76_oct16',type:'borrow',date:'2026-10-16',items:{'32oz':108,'16oz':60,'8oz':24}};
const run=(bm,log,applied)=>{
  const x=boot().ctx;
  const d={settings:{batmanLog:log||[OCT16]},batmanBorrow:Object.assign({},bm),inventory:{'32oz':50,c5s:9},_applied:applied||{}};
  const r=x.bmFixOct19Return(d); return {x,d,r};
};

R.section('1. Stale copy: debt goes back to after the Oct 19 return');
{ const {x,d,r}=run(STALE);
  chk('1a. done',r,true);
  chk('1b. owed per size',[d.batmanBorrow['32oz'],d.batmanBorrow['16oz'],d.batmanBorrow['8oz'],d.batmanBorrow['2oz'],d.batmanBorrow.c5s,d.batmanBorrow.c5l],[0,0,0,96,274,0]);
  const e=d.settings.batmanLog[1];
  chk('1c. one History entry dated Oct 19, Set Exact style',[d.settings.batmanLog.length-1,e.type,e.date,e.src],[1,'set','2026-10-19','app']);
  chk('1d. entry holds the signed change',[e.items['32oz'],e.items.c5s,e.items['2oz']],[-119,-780,-247]);
  chk('1e. garage untouched',[d.inventory['32oz'],d.inventory.c5s],[50,9]);
  chk('1f. total owed 370',x.SKUS.reduce((t,s)=>t+(d.batmanBorrow[s.key]||0),0),370);
}
R.section('2. Left alone when it does not match the stale copy');
{ const {d,r}=run(STALE,[OCT16,{id:'r1',type:'return',items:{c5l:375}}]);
  chk('2a. History has a return: nothing changed',[r,d.batmanBorrow.c5s,d.settings.batmanLog.length],[true,1054,2]); }
{ const {d,r}=run(STALE,[]);
  chk('2a2. no Oct 16 borrow in History (Sep 30 copy): nothing changed',[r,d.batmanBorrow.c5s,d.settings.batmanLog.length],[true,1054,0]); }
{ const {d,r}=run(Object.assign({},STALE,{c5s:274}));
  chk('2b. different counts: nothing changed',[r,d.batmanBorrow['32oz'],d.settings.batmanLog.length],[true,119,1]); }
{ const {d,r}=run({});
  chk('2c. blank device waits',[r,d.settings.batmanLog.length],[false,1]); }
R.section('3. Through applyOneTimeUpdates: once only');
{ const x=boot().ctx;
  const d=JSON.parse(JSON.stringify(x.S)); d.batmanBorrow=Object.assign({},STALE); d.settings=d.settings||{}; d.settings.batmanLog=[Object.assign({},OCT16)];
  d._applied=Object.assign({},d._applied,{batman_history_seed_v75:true,batman_borrow_oct16_v76:true});
  x.applyOneTimeUpdates(d);
  chk('3a. marker set and debt fixed',[!!d._applied.batman_oct19_return_v88,d.batmanBorrow.c5s],[true,274]);
  d.batmanBorrow.c5s=1054; d.batmanBorrow.c5l=445;
  x.applyOneTimeUpdates(d);
  chk('3b. never runs twice',d.batmanBorrow.c5s,1054);
}
R.done();
