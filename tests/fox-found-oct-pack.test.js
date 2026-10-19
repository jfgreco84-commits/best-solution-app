// v76 — Fox & Found North Aurora (Oct 17 2026) packed from the garage for
// Isaiah. SYNTHETIC FIXTURES ONLY.
//
//   node tests/fox-found-oct-pack.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const K=['32oz','16oz','8oz','2oz','c5s','c5l'];
const row=o=>K.map(k=>(o||{})[k]||0);
const WANT=[12,10,48,99,159,24];
const GARAGE={'32oz':50,'16oz':40,'8oz':200,'2oz':300,c5s:500,c5l:100};
const NAME='Fox & Found — North Aurora (Oct)';
function world(inv,sh){
  const show=sh||ctx.buildPlannedShow({name:NAME,location:'North Aurora, IL',startDate:'2026-10-17',numDays:1,boothCost:0,miles:77,boothPayments:[]});
  show.repIds=show.repIds||[];
  const d={v:7,inventory:{...(inv||GARAGE)},shows:[show],reps:[{id:'rep_isaiah',name:'Isaiah',isSelf:false,active:true,payments:[]}],
    prices:{'32oz':30,'16oz':25,'8oz':15,'2oz':10,c5s:10,c5l:25},settings:{},_applied:{}};
  ctx.S=d; return {d,sh:show};
}

R.section('1. Packs the show like Pack for Show');
{ const {d,sh}=world(); const r=ctx.foxFoundOctPack(d);
  chk('1a. done',r.done,true);
  chk('1b. packed 12/10/48/99/159/24',row(sh.packedInventory),WANT);
  chk('1c. 352 units total',row(sh.packedInventory).reduce((a,b)=>a+b,0),352);
  chk('1d. morning count = packed',row(sh.days[0].morningCount),WANT);
  chk('1e. garage down by exactly that',row(d.inventory),row(GARAGE).map((v,i)=>v-WANT[i]));
  chk('1f. show started',sh.status,'active');
  chk('1g. prices frozen',sh.prices.c5l,25);
  chk('1h. Isaiah on the crew',sh.repIds.indexOf('rep_isaiah')>=0,true);
  chk('1i. crew-run show',sh.repOnlyShow,true);
  chk('1j. note names the travel sets',/19 travel sets/.test(sh.notes),true);
  chk('1k. one inventory log row',sh.invLog.length,1);
  chk('1l. garage + show unchanged in total',row(d.inventory).map((v,i)=>v+sh.packedInventory[K[i]]),row(GARAGE)); }

R.section('2. Never packs twice');
{ const {d,sh}=world(); ctx.foxFoundOctPack(d); const inv=JSON.stringify(d.inventory), s1=JSON.stringify(sh);
  const r=ctx.foxFoundOctPack(d);
  chk('2a. skipped',r.skipped,true); chk('2b. garage untouched',JSON.stringify(d.inventory),inv); chk('2c. show untouched',JSON.stringify(sh),s1); }
{ const {d,sh}=world(); sh.status='active'; sh.packedInventory={'32oz':5}; const inv=JSON.stringify(d.inventory);
  const r=ctx.foxFoundOctPack(d);
  chk('2d. already packed by hand: left alone',[r.skipped,JSON.stringify(d.inventory)===inv,sh.packedInventory['32oz'],sh.repOnlyShow],[true,true,5,false]); }

R.section('3. Garage count short');
{ const {d,sh}=world({...GARAGE,c5s:100});
  const r=ctx.foxFoundOctPack(d);
  chk('3a. still packs what really went',sh.packedInventory.c5s,159);
  chk('3b. garage floored at 0, never negative',d.inventory.c5s,0);
  chk('3c. shortfall reported',r.short.length,1);
  chk('3d. shortfall in the log',/short/.test(sh.invLog[0].changes.join(' ')),true); }

R.section('4. Show missing / other shows');
{ const {d}=world(); d.shows=[]; chk('4a. not found: waits',ctx.foxFoundOctPack(d).done,false); }
{ const other=ctx.buildPlannedShow({name:'Rustic Fox — Carol Stream (Oct)',location:'Carol Stream, IL',startDate:'2026-10-04',numDays:1,boothPayments:[]});
  const {d}=world(null,other); const inv=JSON.stringify(d.inventory);
  chk('4b. other Fox show not touched',[ctx.foxFoundOctPack(d).done,other.status,JSON.stringify(d.inventory)===inv],[false,'planned',true]); }

R.section('5. Full load from a blank board');
{ const d={v:7,inventory:{...GARAGE},shows:[],reps:[],prices:{},settings:{},_applied:{}};
  ctx.applyOneTimeUpdates(d); ctx.applyOneTimeUpdates(d);
  const ff=d.shows.filter(s=>s.startDate==='2026-10-17'&&/north aurora/i.test(s.name));
  chk('5a. one Fox & Found Oct show',ff.length,1);
  chk('5b. packed',row(ff[0].packedInventory),WANT);
  chk('5c. marked applied',d._applied['fox_found_oct_pack_v76'],true);
  const inv=JSON.stringify(d.inventory); ctx.applyOneTimeUpdates(d);
  chk('5d. third load changes nothing',JSON.stringify(d.inventory),inv); }

R.section('6. Borrowed more from Batman (Mom\'s) Oct 16');
{ const {d}=world(); d.batmanBorrow={'32oz':10,'16oz':5,'8oz':20,'2oz':0,c5s:0,c5l:0};
  const inv=row(d.inventory);
  chk('6a. done',ctx.bmBorrowOct16(d),true);
  chk('6b. owed up 108/60/24',row(d.batmanBorrow),[118,65,44,0,0,0]);
  chk('6c. garage up 108/60/24',row(d.inventory),inv.map((v,i)=>v+[108,60,24,0,0,0][i]));
  const e=d.settings.batmanLog.find(x=>x.id==='bmh_v76_oct16');
  chk('6d. one History entry, dated Oct 16, undoable',[!!e,e&&e.date,e&&e.type,e&&e.src,d.settings.batmanLog.length],[true,'2026-10-16','borrow','app',1]);
  chk('6e. owed-after recorded',row(e.owed),[118,65,44,0,0,0]);
  ctx.bmBorrowOct16(d);
  chk('6f. only once',[row(d.batmanBorrow)[0],d.settings.batmanLog.length],[118,1]); }
{ const {d}=world(); d.batmanBorrow={}; const inv=JSON.stringify(d.inventory);
  chk('6g. empty tally (blank device): waits, nothing booked',[ctx.bmBorrowOct16(d),JSON.stringify(d.inventory)===inv],[false,true]); }

R.section('7. Borrow lands before the pack on load');
{ const {d,sh}=world({'32oz':0,'16oz':0,'8oz':30,'2oz':200,c5s:300,c5l:50});
  d.batmanBorrow={'32oz':1}; d._applied['batman_history_seed_v75']=true;
  d._applied['fix_future_active_v1']=true;   // ran long ago on every real device; on a blank board it un-packs future shows
  ctx.applyOneTimeUpdates(d);
  chk('7a. both applied',[d._applied['batman_borrow_oct16_v76'],d._applied['fox_found_oct_pack_v76']],[true,true]);
  chk('7b. no shortfall on 32oz/16oz/8oz',/short/.test(sh.invLog.map(x=>x.changes.join(' ')).join(' ')),false);
  chk('7c. show got the full 32oz/16oz/8oz',[sh.packedInventory['32oz'],sh.packedInventory['16oz'],sh.packedInventory['8oz']],[12,10,48]);
  chk('7d. borrow is in History',d.settings.batmanLog.some(e=>e.id==='bmh_v76_oct16'),true); }

R.done();
