// v85 — nothing can go wrong: damaged data never opens as a blank board, a full phone never
// loses a save silently, bad numbers never land. SYNTHETIC FIXTURES ONLY.
//   node tests/bulletproof-v85.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'], PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;}, pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};
// a real-looking saved board built by the app itself
function savedBoard(){ const h=boot(); const {ctx}=h; const S=ctx.S;
  S.shows.push({id:'mine',name:'My Show',status:'completed',numDays:1,startDate:'2026-09-01',dates:['Sep 1'],location:'X',miles:10,boothCost:50,boothPayments:[],showExpenses:[],workers:[],repIds:[],days:[Object.assign(ctx._bsBlankDay(1,'Sep 1'),{morningCount:cnt({c5s:20}),eveningCount:cnt({c5s:10}),payments:pmt({cash:100})})]});
  return JSON.parse(JSON.stringify(S)); }
const N=d=>d.shows.filter(Boolean).length;

R.section('1. Damaged data opens repaired, never blank');
{ const d=savedBoard(), n=N(d); d.shows.splice(1,0,null); d.inventory=null; d.otherExpenses=null; d.shows[0].days=null;
  const h=boot({dd_bs_v7:JSON.stringify(d)}); const {ctx,store}=h;
  chk('1a. every show is still there',ctx.S.shows.length,n);
  chk('1b. my show kept its money',ctx.calcShow(ctx.S.shows.find(s=>s.id==='mine')).gross,100);
  chk('1c. the copy from before the repair is kept',Object.keys(store).some(k=>/dd_bs_backup_prerepair_/.test(k)),true);
  let ok=true; try{ ctx.rHome(); ctx.rShows(); ctx.rPnL(); ctx.rStock(); }catch(e){ ok=false; } chk('1d. every page still draws',ok,true); }

R.section('2. Unreadable data is never replaced by a blank board');
{ const raw=JSON.stringify(savedBoard()).slice(0,4000); const h=boot({dd_bs_v7:raw}); const {ctx,store}=h;
  chk('2a. the blank stand-in is marked',ctx.S._readOnlyBlank,true);
  ctx.saveS(); chk('2b. saving does not write over the real data',store['dd_bs_v7'],raw);
  chk('2c. a copy of what was there is kept',Object.keys(store).some(k=>/dd_bs_backup_unreadable_/.test(k)),true); }

R.section('3. Phone storage full');
{ const h=boot({dd_bs_v7:JSON.stringify(savedBoard())}); const {ctx,store}=h; const real=ctx.localStorage.setItem;
  store['dd_bs_backup_1700000000000']='x'.repeat(100); store['dd_bs_backup_1700000000001']='x'.repeat(100);
  ctx.localStorage.setItem=(k,v)=>{ if(k==='dd_bs_v7'&&('dd_bs_backup_1700000000000' in store))throw new Error('QuotaExceededError'); real(k,v); };
  ctx.S.shows.find(s=>s.id==='mine').name='Renamed'; ctx.saveS();
  chk('3a. old automatic copies trimmed and the save went through',JSON.parse(store['dd_bs_v7']).shows.find(s=>s.id==='mine').name,'Renamed');
  let bar=null; ctx.document.getElementById=id=>id==='saveFailBar'?bar:{style:{},classList:{add(){},remove(){}},innerHTML:'',textContent:''};
  ctx.document.createElement=()=>({style:{},remove(){}}); ctx.document.body.appendChild=x=>{bar=x;};
  ctx.localStorage.setItem=(k,v)=>{ if(k==='dd_bs_v7')throw new Error('QuotaExceededError'); real(k,v); };
  ctx.saveS(); chk('3b. if it still cannot save, a red NOT SAVED bar says so',!!(bar&&/NOT SAVED/.test(bar.textContent)),true); }

R.section('4. Bad numbers never land');
{ const h=boot(); const {ctx}=h; const els={}; const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',dataset:{},classList:{add(){},remove(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},insertAdjacentHTML(){},setAttribute(){},addEventListener(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); const S=ctx.S; S.shows=[];
  const sh={id:'s',name:'S',status:'active',numDays:1,startDate:'2026-10-20',dates:['Oct 20'],repIds:[],showExpenses:[],workers:[],boothPayments:[],packedInventory:cnt({c5s:20}),days:[Object.assign(ctx._bsBlankDay(1,'Oct 20'),{morningCount:cnt({c5s:20})})]}; S.shows.push(sh);
  SK.forEach(k=>els['c_'+k]=Object.assign(mk(),{value:k==='c5s'?'-5':'0'})); ctx.saveCount('s',0,'evening');
  chk('4a. a minus sign never makes a negative count',sh.days[0].eveningCount.c5s,0);
  SK.forEach(k=>els['c_'+k]=Object.assign(mk(),{value:k==='c5s'?'10':'0'})); ctx.saveCount('s',0,'evening');
  ctx.showMoneyModal('s',0); els['pm_cash']=Object.assign(mk(),{value:'-40'}); ctx.saveMoney('s',0);
  chk('4b. no negative money',sh.days[0].payments.cash,0);
  let asked=false; ctx.confirm=()=>{ asked=true; return false; };
  ctx.showMoneyModal('s',0); els['pm_cash']=Object.assign(mk(),{value:'1000'}); ctx.saveMoney('s',0);
  chk('4c. $1,000 for $100 of product asks first, and Cancel saves nothing',[asked,sh.days[0].payments.cash],[true,0]);
  ctx.confirm=()=>true; ctx.showMoneyModal('s',0); els['pm_cash']=Object.assign(mk(),{value:'1000'}); ctx.saveMoney('s',0);
  chk('4d. OK saves it',sh.days[0].payments.cash,1000); }
R.done();
