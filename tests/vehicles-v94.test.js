// v94 — who drove what on each show: driver, vehicle (your Ram or their own car), mpg, miles.
// Every mile on the Ram gets the IRS rate whoever drove it; gas for anyone's own car is an expense.
// SYNTHETIC FIXTURES ONLY.   node tests/vehicles-v94.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const r2=n=>Math.round(n*100)/100;
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els; ctx.confirm=()=>true;
  const S=ctx.S; S.shows=[]; S.otherExpenses=[]; S.settings.mpg=17; S.settings.gasPrice=4;
  h.own=S.reps.find(r=>r.isSelf).id;
  if(!S.reps.find(r=>r.id==='rep_tj'))S.reps.push({id:'rep_tj',name:'TJ',active:true,payments:[]});
  h.show=o=>{ const sh=Object.assign(ctx.buildPlannedShow({name:'Show',location:'Racine, WI',startDate:'2026-09-19',numDays:2,miles:25}),{status:'completed',gasPrice:4},o||{}); S.shows.push(sh); return sh; };
  return h;
}

R.section('1. No vehicles listed: just you in the Ram, as before');
{ const {ctx,show}=world(); const sh=show();
  chk('1a. miles, gas, IRS unchanged',[ctx.showMiles(sh),r2(ctx.showGas(sh)),ctx.showIrsMiles(sh)],[100,r2(100/17*4),100]); }

R.section('2. You in the Ram, TJ in his own car');
{ const h=world(),{ctx}=h; const sh=h.show({vehicles:[{who:h.own,car:'ram'},{who:'rep_tj',car:'own',carName:'GMC Terrain',mpg:25,miles:30}]});
  chk('2a. miles = both vehicles (100 + 120)',ctx.showMiles(sh),220);
  chk('2b. gas = each at its own mpg',r2(ctx.showGas(sh)),r2((100/17+120/25)*4));
  chk('2c. IRS miles = the Ram only',ctx.showIrsMiles(sh),100);
  const t=ctx.calcShow(sh); chk('2d. your truck\'s share of the gas (what mileage replaces)',r2(ctx.showOwnGas(sh,t)),r2(t.gasAuto*(100/17)/(100/17+120/25))); }

R.section('3. Rep-only show, TJ drove your Ram');
{ const h=world(),{ctx}=h; const sh=h.show({repOnlyShow:true,repGasPaid:true,repIds:['rep_tj'],vehicles:[{who:'rep_tj',car:'ram'}]});
  chk('3a. the Ram\'s miles count for your IRS deduction',[ctx.showIrsMiles(sh),r2(ctx.showIrsDeduct(sh))],[100,r2(100*0.76)]);
  chk('3b. its gas is your truck\'s gas',r2(ctx.showOwnGas(sh)),r2(ctx.calcShow(sh).gasAuto));
  const sh2=h.show({repOnlyShow:true,repGasPaid:true,repIds:['rep_tj'],vehicles:[{who:'rep_tj',car:'own',mpg:25}]});
  chk('3c. TJ in his own car: no IRS miles, gas stays a cost',[ctx.showIrsMiles(sh2),r2(ctx.calcShow(sh2).gasAuto),ctx.showOwnGas(sh2)],[0,r2(100/25*4),0]); }

R.section('4. Defaults');
{ const h=world(),{ctx}=h; const sh=h.show({vehicles:[{who:'rep_tj',car:'own'}]});
  chk('4a. their car with no mpg yet is figured at the Ram\'s, never free',r2(ctx.showGas(sh)),r2(100/17*4));
  const sh2=h.show({roundTrips:1,vehicles:[{who:h.own,car:'ram',miles:'',trips:''}]});
  chk('4b. blank miles and trips follow the show (hotel = 1 trip)',ctx.showMiles(sh2),50); }

R.section('5. Snapshot engine agrees');
{ const h=world(),{ctx}=h; const sh=h.show({vehicles:[{who:h.own,car:'ram'},{who:'rep_tj',car:'own',mpg:25,miles:30}]});
  const V=ctx.bxView(ctx.S);
  chk('5a. miles, gas, IRS miles',[V.miles(sh),r2(V.gas(sh)),V.irsMiles(sh)],[ctx.showMiles(sh),r2(ctx.showGas(sh)),ctx.showIrsMiles(sh)]); }

R.section('6. IRS mileage log');
{ const h=world(),{ctx}=h;
  h.show({name:'Fair',repOnlyShow:true,repIds:['rep_tj'],vehicles:[{who:'rep_tj',car:'ram'}]});
  h.show({name:'Market',startDate:'2026-10-03',numDays:1,vehicles:[{who:h.own,car:'ram'},{who:'rep_tj',car:'own',mpg:25}]});
  const rows=ctx.mileageLogRows();
  chk('6a. the Ram on a rep-only show is on your log, one row a day, with who drove',rows.filter(r=>/Fair/.test(r.why)).map(r=>[r.miles,/driven by T\.J\./.test(r.why)]),[[50,true],[50,true]]);
  chk('6b. TJ\'s own car is not on your log',rows.filter(r=>/Market/.test(r.why)).length,1);
  chk('6c. log total = year business miles',Math.round(rows.reduce((t,r)=>t+r.miles,0)),Math.round(ctx.calcYTD().miles)); }

R.section('7. Edit Show: add, fill from the rep, save');
{ const h=world(),{ctx,els}=h; const sh=h.show({repIds:['rep_tj']});
  ctx.S.reps.find(r=>r.id==='rep_tj').car='GMC Terrain'; ctx.S.reps.find(r=>r.id==='rep_tj').mpg=23;
  ctx.showEditCosts(sh.id);
  ctx.ecVehAdd(); ctx.ecVehAdd();
  chk('7a. first row is you in the Ram, next is a crew member',ctx.window.__ecVeh.map(v=>[v.who,v.car]),[[h.own,'ram'],['rep_tj','ram']]);
  ctx.ecVehSet(1,'car','own');
  chk('7b. their own car fills from what they drove last time',[ctx.window.__ecVeh[1].carName,ctx.window.__ecVeh[1].mpg],['GMC Terrain',23]);
  ctx.ecVehSet(1,'mpg','24',1);
  // only the form fields the modal draws exist (an always-found stub would loop Save's per-day hours forever)
  const form={}; [['ec_name',sh.name],['ec_loc',sh.location],['ec_start',sh.startDate],['ec_days','2'],['ec_miles','25'],['ec_gasprice','4']].forEach(([k,v])=>{ form[k]=Object.assign(ctx.document.createElement('input'),{value:v}); });
  const getEl=ctx.document.getElementById; ctx.document.getElementById=id=>form[id]||(/^ec_/.test(id)?null:getEl('x_'+id));
  ctx.saveEditCosts(sh.id);
  chk('7c. saved on the show',sh.vehicles.map(v=>[v.who,v.car,v.mpg]),[[h.own,'ram',''],['rep_tj','own',24]]);
  chk('7d. TJ\'s car remembered at the new mpg',ctx.S.reps.find(r=>r.id==='rep_tj').mpg,24);
  ctx.showEditCosts(sh.id); ctx.window.__ecVeh.length=0; ctx.saveEditCosts(sh.id);
  chk('7e. removing every row goes back to the default',sh.vehicles===undefined,true); }

R.done();
