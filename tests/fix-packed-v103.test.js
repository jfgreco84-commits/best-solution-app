// v103 — fix what was packed. Froggy, Nov 7 2026, The Rustic Fox North Aurora: "I actually brought
// 32 sets, not 22. Please edit that and make it editable for me in the future."
// SYNTHETIC SHOW, REAL NUMBERS from his Nov 7 screenshot.
//   node tests/fix-packed-v103.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l','set'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const PACK=cnt({'32oz':12,'16oz':10,'8oz':41,'2oz':63,c5s:0,c5l:64,set:22});
const EVE=cnt({'32oz':12,'16oz':6,'8oz':32,'2oz':63,c5s:0,c5l:54,set:14});
function world(o){
  o=o||{};
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk()));
  const day={dayNum:1,date:'Nov 7',morningCount:{...(o.morn||PACK)},eveningCount:{...EVE},payments:{cash:400},expenses:{}};
  if(o.restock)day.restock=cnt(o.restock);
  const sh={id:'rf',name:'The Rustic Fox — North Aurora (Nov)',location:'The Rustic Fox, 1790 Towne Center Drive, North Aurora, IL 60542',
    status:'active',startDate:'2026-11-07',numDays:1,dates:['Nov 7'],packedInventory:{...PACK},showExpenses:[],boothPayments:[],repIds:[],days:[day]};
  ctx.S.shows=[sh]; ctx.S.inventory.set=o.garageSet==null?40:o.garageSet;
  return {ctx,sh,d:day,els,S:ctx.S};
}

R.section('1. One-time update: the opening already says 32 (18 sold, 14 left)');
{ const {ctx,sh,d,S}=world({morn:{...PACK,set:32}});
  chk('1a. before: packed 22, sold 18',[ctx.showPackedAtStart(sh).set,ctx.showUnitsSold(sh).set],[22,18]);
  delete S._applied.rustic_fox_sets_v103; ctx.applyOneTimeUpdates(S);
  chk('1b. packed SET 32',ctx.showPackedAtStart(sh).set,32);
  chk('1c. sold 18, on hand 14 unchanged',[ctx.showUnitsSold(sh).set,ctx.showOnHand(sh).set],[18,14]);
  chk('1d. opening stays 32',d.morningCount.set,32);
  chk('1e. the 10 extra sets come off the garage',S.inventory.set,30);
  chk('1f. other sizes untouched',SK.filter(k=>k!=='set').map(k=>sh.packedInventory[k]),SK.filter(k=>k!=='set').map(k=>PACK[k]));
  const L=S.settings.garageLog; chk('1g. garage history says why',L.some(e=>/Fixed what was packed/.test(e.why)),true);
  chk('1h. show log has it',sh.invLog.some(e=>/packed count fixed/.test(e.type)),true);
  chk('1i. marker set',S._applied.rustic_fox_sets_v103,true);
  S.inventory.set=30; ctx.applyOneTimeUpdates(S);
  chk('1j. running again changes nothing',[ctx.showPackedAtStart(sh).set,S.inventory.set],[32,30]); }

R.section('2. One-time update: the extra 10 were typed as restock');
{ const {ctx,sh,d,S}=world({restock:{set:10}});
  delete S._applied.rustic_fox_sets_v103; ctx.applyOneTimeUpdates(S);
  chk('2a. packed 32, opening and restock left as counted',[ctx.showPackedAtStart(sh).set,d.morningCount.set,d.restock.set],[32,22,10]);
  chk('2b. sold still 18, on hand 14',[ctx.showUnitsSold(sh).set,ctx.showOnHand(sh).set],[18,14]); }

R.section('3. One-time update waits and never redoes a hand fix');
{ const {ctx,S}=world(); S.shows=[];
  delete S._applied.rustic_fox_sets_v103; ctx.applyOneTimeUpdates(S);
  chk('3a. show not on the device yet: waits',!!S._applied.rustic_fox_sets_v103,false); }
{ const {ctx,sh,S}=world({morn:{...PACK,set:32}}); sh.packedInventory.set=30;
  delete S._applied.rustic_fox_sets_v103; ctx.applyOneTimeUpdates(S);
  chk('3b. packed no longer 22: left alone',[sh.packedInventory.set,S.inventory.set],[30,40]); }

R.section('4. ✏️ Fix Packed, typed by hand');
{ const {ctx,sh,d,S}=world();
  // opening still equals the old packed number: it moves too
  const r=ctx.fixPackedCounts(sh,{set:32,c5l:60},true);
  chk('4a. ok',r.ok,true);
  chk('4b. packed and opening move together',[sh.packedInventory.set,d.morningCount.set,sh.packedInventory.c5l,d.morningCount.c5l],[32,32,60,60]);
  chk('4c. garage: SET −10, C5-L +4 back',[S.inventory.set],[30]);
  chk('4d. sold reads from the new opening',[ctx.showUnitsSold(sh).set,ctx.showUnitsSold(sh).c5l],[18,6]);
  chk('4e. nothing changed is refused',ctx.fixPackedCounts(sh,{set:32},true).ok,false); }
{ const {ctx,sh,S}=world({garageSet:4});
  const r=ctx.fixPackedCounts(sh,{set:32},true);
  chk('4f. garage never below 0, shortfall named',[S.inventory.set,r.notes.length],[0,1]); }
{ const {ctx,sh,S}=world();
  ctx.fixPackedCounts(sh,{set:32},false);
  chk('4g. garage box unchecked: garage not touched',S.inventory.set,40); }
{ const {ctx,sh,d}=world(); d.locked=true;
  chk('4h. finalized day is refused',ctx.fixPackedCounts(sh,{set:32},true).ok,false); }
{ const {ctx,sh,d,els,S}=world();
  ctx.openFixPacked('rf'); const h=els.mb?els.mb.innerHTML:'';
  chk('4i. modal shows what the app says',/app says 22/.test(h),true);
  els.fpk_set.value='32'; els.fpk_garage.checked=true;
  for(const k of SK)if(k!=='set')els['fpk_'+k].value=String(PACK[k]);
  ctx.applyFixPackedCounts('rf');
  chk('4j. Save button applies it',[sh.packedInventory.set,d.morningCount.set,S.inventory.set],[32,32,30]);
  chk('4k. stock card has the button',/Fix Packed/.test(ctx.showStockCardHTML(sh)),true); }

R.done();
