// v93 — gas by area and week, Ram at 17 mpg, IRS rate by date, rep-only miles, mileage log.
// SYNTHETIC FIXTURES ONLY.
//
//   node tests/gas-area-v93.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const r2=n=>Math.round(n*100)/100;
const blank=()=>({v:7,inventory:{},shows:[],reps:[],prices:{},settings:{},_applied:{}});
const full=()=>{ const d=blank(); ctx.applyOneTimeUpdates(d); return d; };
const mk=o=>Object.assign(ctx.buildPlannedShow({name:'Test Show',location:'Racine, WI',startDate:'2026-09-19',numDays:1,miles:24}),o||{});

// A board as it stood before v93: v77 month prices on finished shows, 17.5 mpg, $4.20 default,
// 70 cents a mile, Cranberry's three v56 fuel lines at $4.30.
function oldBoard(){
  const d=full(); ctx.applyOneTimeUpdates(d); ctx.S=d; // other seeds finish on the second load
  delete d._applied['gas_area_v93'];
  Object.assign(d.settings,{mpg:17.5,gasPrice:4.2,irsRate:0.70}); delete d.settings.gasPriceIL;
  d.shows.forEach(sh=>{ if(sh.passed)return; const m=ctx.V77_GAS_BY_MONTH[String(sh.startDate).slice(0,7)];
    if(String(sh.startDate)<'2026-10-25'){ sh.status='completed'; sh.gasPrice=m||null; } else sh.gasPrice=null; });
  const cran=d.shows.find(s=>/cranberry/i.test(s.name));
  cran.mpg=17.5; cran.gasPrice=4.3; cran.totalMiles=570;
  cran.showExpenses=[{id:'se_cran26_gas_ram',cat:'fuel',amount:140.06,desc:'Froggy · Ram 1500'},
    {id:'se_cran26_gas_terrain',cat:'fuel',amount:108.43,desc:'TJ · GMC Terrain'},
    {id:'se_cran26_gas_impala',cat:'fuel',amount:170.19,desc:'Anthony · Chevy Impala'}];
  return d;
}

R.section('1. Prices by area and day');
{ chk('1a. a reading day is the reading',ctx.gasAreaPriceOn('wi','2026-09-04'),3.74);
  chk('1b. between readings is interpolated (Sep 24 = halfway 4.41 / 4.36)',r2(ctx.gasAreaPriceOn('wi','2026-09-24')),4.39);
  chk('1c. far outside the table = no reading',[ctx.gasAreaPriceOn('wi','2026-01-10'),ctx.gasAreaPriceOn('chi','2026-12-20')],[null,null]);
  chk('1d. areas from the town',[mk({location:'Warrens, WI'}),mk({location:'Utica, IL'}),mk({location:'Valley Ridge Golf Course, Antioch, IL'}),mk({location:'Carol Stream, IL'}),mk({location:'Rosemont, IL'}),mk({location:'Plymouth, WI'})].map(ctx.gasArea),['wiw','ilc','iln','chi','chi','wi']);
  const cs=mk({location:'Carol Stream, IL',startDate:'2026-10-04'});
  const want=r2(ctx.gasAreaPriceOn('wi','2026-10-04')*0.28+ctx.gasAreaPriceOn('chi','2026-10-04')*0.72);
  chk('1e. an Illinois trip is priced where the miles were driven (28% WI, 72% Chicago area)',ctx.gasMarketPrice(cs),want);
  const two=mk({startDate:'2026-09-16',numDays:2});
  chk('1f. a 2-day show averages its days (Sep 16 4.04, Sep 17 4.29)',ctx.gasMarketPrice(two),4.17);
  chk('1g. Warrens falls back to the Milwaukee table when the west table is silent',ctx.gasMarketPrice(mk({location:'Warrens, WI',startDate:'2026-07-04'})),r2(ctx.gasAreaPriceOn('wi','2026-07-04'))); }

R.section('2. IRS rate by date');
{ const d=full(); ctx.S=d;
  chk('2a. 2026 Jan-Jun 72.5c, Jul 1 on 76c, 2025 70c',[ctx.irsRateOn('2026-06-30'),ctx.irsRateOn('2026-07-01'),ctx.irsRateOn('2025-08-30')],[0.725,0.76,0.70]);
  d.settings.irsRate=0.8; chk('2b. 2027 uses Setup',ctx.irsRateOn('2027-01-17'),0.8);
  const sh=mk({startDate:'2026-06-13',miles:14,numDays:2});
  chk('2c. show deduction = miles x the rate on its date',r2(ctx.showIrsDeduct(sh)),r2(56*0.725)); }

R.section('3. Rep-only shows are not your miles');
{ const d=full(); ctx.S=d;
  const sh=mk({repOnlyShow:true,miles:40});
  chk('3a. the rep drove: 0 IRS miles',ctx.showIrsMiles(sh),0);
  chk('3b. gas you paid them still counts',r2(ctx.showGas(sh))>0,true);
  sh.ownerMiles=48; chk('3c. miles you drove yourself for it count',[ctx.showIrsMiles(sh),r2(ctx.showIrsDeduct(sh))],[48,r2(48*0.76)]);
  const c=mk({status:'completed',miles:40}); d.shows.push(c); ctx.auditSetCrew(c.id,false);
  chk('3d. marking a show rep-only keeps the gas: you pay it at every show',[c.repOnlyShow,c.repGasPaid,r2(ctx.calcShow(c).gasAuto)>0],[true,true,true]);
  chk('3e. that gas is deducted as gas, not replaced by mileage',[r2(ctx.showOwnGas(c)),ctx.showIrsMiles(c)],[0,0]); }

R.section('4. The v93 update on an old board');
{ const d=oldBoard();
  const own=d.shows.find(s=>/st\.? martin/i.test(s.name)); own.gasPrice=3.99;
  const hand=d.shows.find(s=>/sheboygan/i.test(s.name)); hand.gasOverride=150;
  const rep=d.shows.find(s=>/fair to remember, fall/i.test(s.name)); rep.repOnlyShow=true; rep.repGasPaid=false;
  const r=ctx.gasAuditV93(d);
  chk('4a. ran',r.done,true);
  chk('4b. settings: 17 mpg, WI $4.52, IL $4.82, 76c for 2027 on',[d.settings.mpg,d.settings.gasPrice,d.settings.gasPriceIL,d.settings.irsRate],[17,4.52,4.82,0.76]);
  const rf=d.shows.find(s=>/rustic fox/i.test(s.name)&&s.startDate==='2026-10-04');
  chk('4c. a finished show moves from the month guess to its week and area',rf.gasPrice,ctx.gasMarketPrice(rf));
  chk('4d. a price you typed is kept',own.gasPrice,3.99);
  chk('4e. gas you entered by hand stays',hand.gasOverride,150);
  chk('4f. upcoming shows wait for their own week',d.shows.filter(s=>!s.passed&&String(s.startDate)>'2026-10-25').every(s=>s.gasPrice==null),true);
  chk('4g. the change is on the show history',rf.invLog.some(x=>/v93/.test(x.type)),true);
  chk('4g2. a rep show marked "rep covered gas" now carries the gas you paid',[rep.repGasPaid,ctx.calcShow(rep).gasAuto>0],[true,true]);
  const keep=JSON.stringify(d.shows); d._applied['gas_area_v93']=true; ctx.applyOneTimeUpdates(d);
  chk('4h. a second load changes nothing',JSON.stringify(d.shows),keep);
  const e=blank(); Object.keys(ctx.MRG_SEED_RECORDS).forEach(k=>e._applied[k]=true); ctx.applyOneTimeUpdates(e);
  chk('4i. no shows yet: waits',[e.shows.length,!!e._applied['gas_area_v93']],[0,false]); }

R.section('5. Cranberry Fest: three vehicles, leg by leg');
{ const d=oldBoard(); ctx.gasAuditV93(d);
  const cran=d.shows.find(s=>/cranberry/i.test(s.name)), ex=id=>cran.showExpenses.find(x=>x.id===id).amount;
  const legs=(one,mpg)=>r2(ctx.v93LegsGas(ctx.v93CranberryLegs(one,'x'),mpg));
  chk('5a. Ram 570 mi at 17 mpg',[ex('se_cran26_gas_ram'),cran.mpg],[legs(180,17),17]);
  chk('5b. TJ Terrain 580 mi at 23, Anthony Impala 554 mi at 14',[ex('se_cran26_gas_terrain'),ex('se_cran26_gas_impala')],[legs(185,23),legs(172,14)]);
  chk('5c. route legs kept for the mileage log, 570 mi',cran.routeLegs.reduce((t,l)=>t+l.miles,0),570);
  chk('5d. the Ram is priced at home going up and at Warrens prices after',ctx.v93CranberryLegs(180,'x').map(l=>l.area),['wi','wiw','wiw','wiw','wiw','wiw']); }

R.section('6. Year totals and the tax view');
{ const d=oldBoard(); ctx.gasAuditV93(d); ctx.S=d;
  const y=ctx.calcYTD();
  const worked=d.shows.filter(s=>s.status==='completed'||s.status==='active');
  chk('6a. IRS deduction = each show at its own rate',r2(y.irsDeduct),r2(worked.reduce((t,s)=>t+ctx.showIrsDeduct(s),0)));
  const cran=d.shows.find(s=>/cranberry/i.test(s.name));
  chk('6b. TJ and Anthony\'s gas is not your truck\'s gas',r2(ctx.showOwnGas(cran)),cran.showExpenses.find(x=>x.id==='se_cran26_gas_ram').amount);
  chk('6c. tax profit = profit + your truck gas - mileage',r2(y.taxProfit),r2(y.profit+y.ownGas-y.irsDeduct));
  d.settings.businessTrips=[{id:'t1',date:_today(),to:'Post office',why:'Mailed online order',miles:6}];
  const y2=ctx.calcYTD(); chk('6d. a logged errand adds its miles and deduction',[y2.miles-y.miles,r2(y2.irsDeduct-y.irsDeduct)],[6,r2(6*ctx.irsRateOn(_today()))]); }
function _today(){ return ctx._todayKey(); }

R.section('7. IRS mileage log');
{ const d=oldBoard(); ctx.gasAuditV93(d); ctx.S=d;
  const rep=d.shows.find(s=>/fair to remember, fall/i.test(s.name)); rep.repOnlyShow=true; rep.status='completed';
  const rows=ctx.mileageLogRows();
  const wcf=rows.filter(r=>/Waukesha County Fair/.test(r.why));
  chk('7a. a 5-day show you drove home from each night = 5 rows of 44 mi',[wcf.length,wcf.every(r=>r.miles===44)],[5,true]);
  chk('7b. Cranberry is its 6 legs',rows.filter(r=>/Cranberry/.test(r.why)).length,6);
  chk('7c. a rep-only show is not on your log',rows.some(r=>/Fair to Remember, Fall/.test(r.why)),false);
  chk('7d. log total = year miles',Math.round(rows.reduce((t,r)=>t+r.miles,0)),Math.round(ctx.calcYTD().miles));
  chk('7e. each row at the rate for its date',rows.every(r=>r.rate===ctx.irsRateOn(r.date)),true); }

R.section('8. Snapshot engine agrees');
{ const d=oldBoard(); ctx.gasAuditV93(d); ctx.S=d; const V=ctx.bxView(d);
  const up=d.shows.find(s=>/merry makers/i.test(s.name));
  chk('8a. upcoming IL show: same blended default',[V.gasPrice(up),ctx.showGasPrice(up)],[ctx.gasDefaultPrice(up),ctx.gasDefaultPrice(up)]);
  const sh=d.shows.find(s=>/burgoo/i.test(s.name));
  chk('8b. gas and IRS rate agree',[r2(V.gas(sh)),V.irsRate(sh)],[r2(ctx.showGas(sh)),ctx.showIrsRate(sh)]); }

R.done();
