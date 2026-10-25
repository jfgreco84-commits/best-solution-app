// v93: Small Sets (1 x 2oz + 1 x C5-S + organza 5x7 + microfiber cloth + pouch + mini
// screwdriver set) are their own product, built from garage stock. SYNTHETIC FIXTURES ONLY.
//   node tests/small-sets-v93.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els; return h;
}
const r2=n=>Math.round(n*100)/100;

R.section('1. The product');
{ const {ctx}=world(), S=ctx.S, sk=ctx.SKUS.find(s=>s.key==='set');
  chk('1a. SET is a product',[sk.short,sk.name],['SET','Small Set (2oz + C5-S)']);
  chk('1b. default price $20',ctx.getP('set'),20);
  chk('1c. cost now = 2oz + C5-S',ctx.getCostOn('set','2026-10-25',null,S),4.80);
  chk('1d. before Aug 1 = old 2oz + C5-S',ctx.getCostOn('set','2026-07-01',null,S),5.25);
  chk('1e. cost schedule still valid',ctx.cogsValidate(ctx.cogsSchedule(S)).valid,true); }

R.section('2. One-time update on an older copy');
{ const {ctx}=world(), S=ctx.S;
  S.cogsHistory.forEach(e=>delete e.costs.set); delete S.prices.set; delete S.inventory.set;
  S.supplies=[{id:'sup_microfiber',name:'Microfiber Cloths',qty:40,low:4,unit:'ea',cost:0.12}];
  delete S._applied.small_set_v93; ctx.applyOneTimeUpdates(S);
  chk('2a. each cost period gets its own 2oz + C5-S',S.cogsHistory.map(e=>e.costs.set),[5.25,4.80]);
  chk('2b. schedule valid',ctx.cogsValidate(ctx.cogsSchedule(S)).valid,true);
  chk('2c. price $20, garage 0',[S.prices.set,S.inventory.set],[20,0]);
  chk('2d. add-ons and organza sizes on Supplies',S.supplies.map(s=>s.id),['sup_microfiber','sup_organza_5x7','sup_mf_pouch','sup_screwdriver','sup_organza_6x9','sup_organza_8x12']);
  chk('2e. an existing cloth keeps its count and cost',[S.supplies[0].qty,S.supplies[0].cost],[40,0.12]);
  const n=S.supplies.length; S.prices.set=25; delete S._applied.small_set_v93; ctx.applyOneTimeUpdates(S);
  chk('2f. running again changes nothing',[S.supplies.length,S.prices.set],[n,25]); }

R.section('3. Build and break apart');
{ const {ctx,els}=world(), S=ctx.S;
  S.inventory['2oz']=50; S.inventory.c5s=30; S.inventory.set=0;
  const sup=id=>S.supplies.find(s=>s.id===id);
  ['sup_organza_5x7','sup_microfiber','sup_mf_pouch','sup_screwdriver'].forEach(id=>sup(id).qty=100); sup('sup_mf_pouch').qty=5;
  let r=ctx.buildSmallSets(10);
  chk('3a. garage: 2oz -10, C5-S -10, SET +10',[S.inventory['2oz'],S.inventory.c5s,S.inventory.set],[40,20,10]);
  chk('3b. add-ons come off Supplies',[sup('sup_organza_5x7').qty,sup('sup_microfiber').qty,sup('sup_screwdriver').qty],[90,90,90]);
  chk('3c. short on pouches is called out, never negative',[r.short,sup('sup_mf_pouch').qty],[['Microfiber Pouch 5'],0]);
  r=ctx.buildSmallSets(25);
  chk('3d. not enough C5-S: refused, nothing moves',[r.ok,S.inventory.c5s,S.inventory.set],[false,20,10]);
  r=ctx.buildSmallSets(-4);
  chk('3e. break 4 apart: bottles back',[S.inventory['2oz'],S.inventory.c5s,S.inventory.set,sup('sup_organza_5x7').qty],[44,24,6,94]);
  chk('3f. cannot break more than built',ctx.buildSmallSets(-7).ok,false);
  ctx.openBuildSets(); ctx.document.getElementById('bss_n').value='3'; ctx.applyBuildSets(1);
  chk('3g. Build button',S.inventory.set,9);
  const L=S.settings.garageLog||[]; const e=L[L.length-1];
  chk('3h. garage history says why',e&&e.why,'Built 3 Small Sets'); }

R.section('4. Money');
{ const {ctx,els}=world(), S=ctx.S;
  chk('4a. COGS of 3 sets sold Oct 25',r2(ctx.calcCOGSOn({set:3},'2026-10-25',null,S)),14.40);
  chk('4b. all-in cost of one set',r2(ctx.smallSetBottleCost()+ctx.smallSetAddonCost()),6.26);
  ctx.openBuildSets(); const h=ctx.document.getElementById('mb').innerHTML;
  chk('4c. card shows all-in and the three prices',['$6.26','$13.74','$18.74','$23.74'].every(x=>h.includes(x)),true);
  const sh={days:[{morningCount:{set:10,'2oz':4},eveningCount:{set:7,'2oz':0}}]};
  chk('4d. a set sold gets one bag',ctx.showBagCount(sh),5); }

R.done();
