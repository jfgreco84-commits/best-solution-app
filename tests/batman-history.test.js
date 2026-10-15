// v75 — Borrowed from Batman history log (S.settings.batmanLog) and the
// one-time back-fill from the backups. SYNTHETIC FIXTURES ONLY.
//
//   node tests/batman-history.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const SEP30={'32oz':11,'16oz':4,'8oz':123,'2oz':263,c5s:1054,c5l:445};

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
  h.clear=()=>{Object.keys(els).forEach(k=>delete els[k]);};
  return h;
}
const sum=o=>SK.reduce((t,k)=>t+(parseInt((o||{})[k])||0),0);

// ===========================================================================
R.section('1. Borrowed / Returned / Set Exact each write a dated log entry');
// ===========================================================================
{
  const h=world(); const x=h.ctx;
  x.S.inventory=cnt({'32oz':10}); x.S.batmanBorrow={}; x.S.settings={};
  h.set('bma_date','2026-10-14'); h.set('bma_note','for Burgoo');
  SK.forEach(k=>h.set('bma_'+k,k==='32oz'?12:(k==='c5l'?3:'')));
  x.applyAddBatman();
  let L=x.S.settings.batmanLog;
  chk('1a. one entry',L.length,1);
  chk('1b. borrow, date, sizes, note',[L[0].type,L[0].date,L[0].items['32oz'],L[0].items.c5l,L[0].note,L[0].src],['borrow','2026-10-14',12,3,'for Burgoo','app']);
  chk('1c. owed after is recorded',[L[0].owed['32oz'],L[0].owed.c5l],[12,3]);
  chk('1d. debt and garage still move',[x.S.batmanBorrow['32oz'],x.S.inventory['32oz']],[12,22]);

  h.clear(); h.set('bmr_date','2026-10-15');
  SK.forEach(k=>h.set('bmr_'+k,k==='32oz'?20:''));
  x.applyReturnBatman();
  L=x.S.settings.batmanLog;
  chk('1e. return logs what actually came off (capped at owed)',[L[1].type,L[1].items['32oz'],L[1].date],['return',12,'2026-10-15']);

  h.clear(); SK.forEach(k=>h.set('bms_'+k,k==='c5l'?10:(x.S.batmanBorrow[k]||0)));
  x.applySetBatman();
  L=x.S.settings.batmanLog;
  chk('1f. Set Exact logs the signed change',[L[2].type,L[2].items.c5l,Object.keys(L[2].items).length],['set',7,1]);

  h.clear(); SK.forEach(k=>h.set('bma_'+k,''));
  x.applyAddBatman();
  chk('1g. an empty borrow logs nothing',x.S.settings.batmanLog.length,3);

  h.clear(); SK.forEach(k=>h.set('bms_'+k,x.S.batmanBorrow[k]||0));
  x.applySetBatman();
  chk('1h. a Set Exact with no change logs nothing',x.S.settings.batmanLog.length,3);

  const html=x.bmHistoryHTML();
  const at=t=>html.indexOf('>'+t+'</b>');
  chk('1i. history renders newest first',at('Set Exact')>0&&at('Set Exact')<at('Returned')&&at('Returned')<at('Borrowed'),true);
  chk('1j. secBatman includes the history',/📜 History/.test(x.secBatman()),true);
}

// ===========================================================================
R.section('2. Undo reverses the entry and removes it');
// ===========================================================================
{
  const h=world(); const x=h.ctx; x.confirm=()=>true;
  x.S.inventory=cnt({'8oz':5}); x.S.batmanBorrow={}; x.S.settings={};
  SK.forEach(k=>h.set('bma_'+k,k==='8oz'?10:''));
  x.applyAddBatman();
  h.clear(); SK.forEach(k=>h.set('bmr_'+k,k==='8oz'?4:''));
  x.applyReturnBatman();
  chk('2a. after borrow 10, return 4',[x.S.batmanBorrow['8oz'],x.S.inventory['8oz']],[6,11]);
  const ret=x.S.settings.batmanLog.find(e=>e.type==='return');
  x.bmUndo(ret.id);
  chk('2b. undo return puts debt and garage back',[x.S.batmanBorrow['8oz'],x.S.inventory['8oz'],x.S.settings.batmanLog.length],[10,15,1]);
  x.bmUndo(x.S.settings.batmanLog[0].id);
  chk('2c. undo borrow takes it back out',[x.S.batmanBorrow['8oz'],x.S.inventory['8oz'],x.S.settings.batmanLog.length],[0,5,0]);
  h.clear(); SK.forEach(k=>h.set('bms_'+k,k==='8oz'?9:0));
  x.applySetBatman();
  x.bmUndo(x.S.settings.batmanLog[0].id);
  chk('2d. undo Set Exact restores the debt only',[x.S.batmanBorrow['8oz'],x.S.inventory['8oz']],[0,5]);
  x.S.settings.batmanLog.push({id:'bmh_seed_x',type:'borrow',items:{'8oz':3},date:'2026-09-24',src:'backup'});
  x.bmUndo('bmh_seed_x');
  chk('2e. backup entries cannot be undone',x.S.settings.batmanLog.length,1);
}

// ===========================================================================
R.section('3. One-time back-fill from the backups');
// ===========================================================================
{
  const {ctx}=world();
  const d={v:7,inventory:cnt({}),batmanBorrow:{},shows:[],reps:[],prices:{},settings:{},_applied:{}};
  ctx.applyOneTimeUpdates(d);
  chk('3a. empty tally: stays pending, nothing logged',[!!d._applied['batman_history_seed_v75'],(d.settings.batmanLog||[]).length],[false,0]);

  d.batmanBorrow=Object.assign({},SEP30);
  d._applied['batman_to_garage_20260924']=true;   // v42 is tested in cranberry-scoreboard
  const inv=JSON.stringify(d.inventory);
  ctx.applyOneTimeUpdates(d);
  const L=d.settings.batmanLog;
  chk('3b. marked done',d._applied['batman_history_seed_v75'],true);
  chk('3c. four entries when nothing changed since Sep 30',L.map(e=>e.id),['bmh_seed_jul06','bmh_seed_aug18','bmh_seed_sep24','bmh_seed_sep30']);
  chk('3d. Sep 24 borrow',[L[2].items.c5l,L[2].items['2oz'],L[2].items['8oz']],[34,80,48]);
  chk('3e. other Aug 18 to Sep 30 borrows',SK.map(k=>L[3].items[k]||0),[11,4,75,183,296,7]);
  chk('3f. Aug 18 + all borrows = Sep 30 owed',SK.map(k=>(k==='c5s'?758:k==='c5l'?404:0)+(L[2].items[k]||0)+(L[3].items[k]||0)),SK.map(k=>SEP30[k]));
  chk('3g. log only: garage untouched',JSON.stringify(d.inventory),inv);
  chk('3h. all marked from backups',L.every(e=>e.src==='backup'),true);
  ctx.applyOneTimeUpdates(d);
  chk('3i. only once',d.settings.batmanLog.length,4);
}
{
  const {ctx}=world();
  const cur=Object.assign({},SEP30,{c5s:1100,c5l:445,'2oz':250});
  const d={v:7,inventory:cnt({}),batmanBorrow:cur,shows:[],reps:[],prices:{},settings:{},_applied:{}};
  ctx.applyOneTimeUpdates(d);
  const e=d.settings.batmanLog.find(x=>x.id==='bmh_seed_since_sep30');
  chk('3j. net change since Sep 30 is logged',[!!e,e&&e.type,e&&e.items.c5s,e&&e.items['2oz'],e&&sum(e.owed)],[true,'change',46,-13,sum(cur)]);
}

R.done();
