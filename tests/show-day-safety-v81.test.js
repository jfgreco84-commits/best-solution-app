// v81 — show-day safety: undo a wrong pack, reopen a show closed by mistake, move a
// show's date, opens on today's day, double taps never double up, typo counts get
// called out on the spot. SYNTHETIC FIXTURES ONLY.
//   node tests/show-day-safety-v81.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(/^ec_(open|close)_/.test(id)&&!els[id])?null:(els[id]||(els[id]=mk())); h.els=els; h.toast=()=>els['toast']?els['toast'].textContent:'';
  ctx.confirm=()=>true; ctx.S.shows=[]; ctx.S.transfers=[]; ctx.S.inventory=cnt({c5s:100,'8oz':50});
  h.val=(id,v)=>{ ctx.document.getElementById(id).value=String(v); };
  h.newShow=(name,date,days)=>{ ctx.showNewShowModal(); h.val('ns_n',name); h.val('ns_d',date); h.val('ns_dy',days||1); h.val('ns_b',''); h.val('ns_m',''); h.val('ns_l','');
    ctx.window.__lastTap=null; ctx.createShow(); return ctx.S.shows.find(s=>s.name===name); };
  h.pack=(sh,m)=>{ ctx.showPackModal(sh.id); SK.forEach(k=>h.val('pk_'+k,(m||{})[k]||0)); ctx.confirmPack(sh.id); };
  h.count=(sh,di,type,m)=>{ SK.forEach(k=>h.val('c_'+k,(m||{})[k]||0)); ctx.saveCount(sh.id,di,type); };
  h.money=(sh,di,cash)=>{ ctx.showMoneyModal(sh.id,di); h.val('pm_cash',cash); ctx.saveMoney(sh.id,di); };
  return h;
}

R.section('1. Packed the wrong show: Undo Start');
{ const h=world(),{ctx}=h; const sh=h.newShow('Wrong','2026-11-07');
  h.pack(sh,{c5s:40}); chk('1a. garage down 40',ctx.S.inventory.c5s,60);
  h.pack(sh,{c5s:40}); chk('1b. a second Start tap does not pack again',ctx.S.inventory.c5s,60);
  chk('1c. undo is offered while nothing is sold',ctx.canUndoStart(sh),true);
  ctx.undoStartShow(sh.id);
  chk('1d. stock back, show upcoming',[ctx.S.inventory.c5s,sh.status,sh.packedInventory],[100,'planned',null]); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Sold','2026-11-07'); h.pack(sh,{c5s:40}); h.money(sh,0,50);
  chk('1e. no undo once money is in',ctx.canUndoStart(sh),false);
  ctx.undoStartShow(sh.id); chk('1f. and it refuses',[sh.status,ctx.S.inventory.c5s],['active',60]); }

R.section('2. Closed by mistake: Reopen Show');
{ const h=world(),{ctx}=h; const sh=h.newShow('Two Day','2026-11-14',2); h.pack(sh,{c5s:40});
  h.money(sh,0,250); h.count(sh,0,'evening',{c5s:30});
  ctx.endShow(sh.id); ctx.confirmEndShow(sh.id); ctx.confirmEndShow(sh.id);
  chk('2a. closing twice returns stock once',ctx.S.inventory.c5s,90);
  ctx.reopenShow(sh.id);
  chk('2b. reopen takes the return back off the shelf',[sh.status,ctx.S.inventory.c5s,sh.returned],['active',60,undefined]);
  ctx.saveCount(sh.id,1,'morning'); h.count(sh,1,'morning',{c5s:30}); h.money(sh,1,125); h.count(sh,1,'evening',{c5s:20});
  ctx.endShow(sh.id); ctx.confirmEndShow(sh.id);
  chk('2c. close again: garage = start - 20 sold',ctx.S.inventory.c5s,80); }
{ const h=world(),{ctx}=h; const sh=h.newShow('Gone','2026-11-14'); h.pack(sh,{c5s:40}); h.money(sh,0,100); h.count(sh,0,'evening',{c5s:30});
  ctx.endShow(sh.id); ctx.confirmEndShow(sh.id); ctx.S.inventory.c5s=5;
  ctx.reopenShow(sh.id); chk('2d. refuses when the garage no longer has it',[sh.status,ctx.S.inventory.c5s],['completed',5]); }

R.section('3. Rain date: move the show');
{ const h=world(),{ctx}=h; const sh=h.newShow('Rain','2026-11-21',2);
  ctx.showEditCosts(sh.id); h.val('ec_start','2026-11-28'); h.val('ec_days','2'); ctx.saveEditCosts(sh.id);
  chk('3a. start date and day tabs move',[sh.startDate,sh.days.map(d=>d.date)],['2026-11-28',['Nov 28','Nov 29']]); }

R.section('4. A show opens on today');
{ const h=world(),{ctx}=h; const today=ctx._todayKey(); const y=new Date(today+'T12:00:00'); y.setDate(y.getDate()-1);
  const ys=y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
  const sh=h.newShow('Now','2026-01-01',2); sh.startDate=ys; ctx.resizeShowDays(sh,2); sh.status='active';
  ctx.curDay=0; ctx.go('show',sh.id); chk('4a. day 2 is today: opens on day 2',ctx.curDay,1);
  const one=h.newShow('One','2026-12-01',1); ctx.curDay=1; ctx.go('show',one.id); chk('4b. never a day the show does not have',ctx.curDay,0); }

R.section('5. Double taps');
{ const h=world(),{ctx}=h; ctx.showNewShowModal(); h.val('ns_n','Dup'); h.val('ns_d','2026-12-05'); h.val('ns_dy',1);
  ctx.window.__lastTap=null; ctx.createShow(); ctx.createShow();
  chk('5a. one show, not two',ctx.S.shows.filter(s=>s.name==='Dup').length,1);
  ctx.showRestock&&ctx.showRestock(); h.val('rst_c5s',10); SK.filter(k=>k!=='c5s').forEach(k=>h.val('rst_'+k,0));
  ctx.window.__lastTap=null; ctx.applyRestock(); ctx.applyRestock();
  chk('5b. restock adds once',ctx.S.inventory.c5s,110); }

R.section('6. Typo at night gets called out now');
{ const h=world(),{ctx}=h; const sh=h.newShow('Typo','2026-11-07'); h.pack(sh,{c5s:30});
  h.count(sh,0,'evening',{c5s:300});
  chk('6a. warning names it',/Typo\? C5-S 300 tonight, only 30 this morning/.test(h.toast()),true); }
R.done();
