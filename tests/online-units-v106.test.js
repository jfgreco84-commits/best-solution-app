// v106 — online bottles count in Units Sold. SYNTHETIC FIXTURES ONLY.
//
//   node tests/online-units-v106.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const show=()=>({id:'sh1',name:'Test Fair',status:'completed',startDate:'2026-06-06',endDate:'2026-06-06',
  days:[{date:'2026-06-06',morningCount:{'32oz':10,'16oz':10,'8oz':10,'2oz':10,c5s:10,c5l:10},
                            eveningCount:{'32oz':8,'16oz':7,'8oz':10,'2oz':4,c5s:10,c5l:9},payments:{cash:100}}]});
const board=(ol)=>({v:7,inventory:{'32oz':5,'16oz':5,'8oz':5,'2oz':5,c5s:5,c5l:5},shows:[show()],reps:[],prices:{},
  settings:{onlineSales:ol||[]},_applied:{}});

R.section('1. Shows only (no online sales)');
{ ctx.S=board(); const y=ctx.calcYTD('2026');
  chk('1a. show units',[y.units['32oz'],y.units['16oz'],y.units['2oz'],y.units.c5l],[2,3,6,1]);
  chk('1b. total 12',y.totalUnits,12);
  chk('1c. showUnits matches',JSON.stringify(y.showUnits),JSON.stringify(y.units)); }

R.section('2. Online bottles added');
{ ctx.S=board([{id:'a',date:'2026-07-07',items:[{sku:'8oz',qty:1}],amount:25,postage:0},
               {id:'b',date:'2026-07-20',items:[{sku:'8oz',qty:1},{sku:'2oz',qty:2}],amount:40,postage:0},
               {id:'c',date:'2025-12-01',items:[{sku:'32oz',qty:5}],amount:100,postage:0}]);
  const y=ctx.calcYTD('2026');
  chk('2a. 8oz 0+2, 2oz 6+2',[y.units['8oz'],y.units['2oz']],[2,8]);
  chk('2b. total 12 + 4 = 16',y.totalUnits,16);
  chk('2c. 2025 sale not in 2026',y.units['32oz'],2);
  chk('2d. showUnits stays show-only (restock pace)',[y.showUnits['8oz'],y.showUnits['2oz']],[0,6]);
  chk('2e. online totals unchanged',[y.online.orders,y.online.units,y.online.amount],[2,4,65]);
  const y25=ctx.calcYTD('2025');
  chk('2f. 2025: 5 x 32oz online',[y25.units['32oz'],y25.totalUnits],[5,5]); }

R.section('3. Odd records do not break it');
{ ctx.S=board([{id:'x',date:'2026-08-01',items:[{sku:'mystery',qty:3}],amount:10,postage:0}]);
  const y=ctx.calcYTD('2026');
  chk('3a. unknown SKU ignored, no NaN',[y.totalUnits,Number.isNaN(y.totalUnits)],[12,false]); }

R.done();
