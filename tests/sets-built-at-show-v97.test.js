// v97 — Small Sets built at the show. A table that opens with loose 2oz and C5-S and closes with
// Small Sets made from them: the sets come out of the 2oz and C5-S evenly, not out of sales.
// Uses Froggy's real Oct 25 2026 Chicago Women's Expo counts. SYNTHETIC SHOW, REAL NUMBERS.
//   node tests/sets-built-at-show-v97.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l','set'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const MORN=cnt({'32oz':21,'16oz':34,'8oz':60,'2oz':151,c5s:123,c5l:54,set:0});
const EVE=cnt({'32oz':21,'16oz':33,'8oz':54,'2oz':111,c5s:86,c5l:45,set:22});
function expo(eve){
  const h=boot(); const {ctx}=h; const sh={id:'wx',name:"Chicago Women's Expo",status:'active',startDate:'2026-10-24',numDays:2,dates:['Oct 24','Oct 25'],
    packedInventory:{...MORN},showExpenses:[],boothPayments:[],repIds:[],
    days:[{dayNum:1,date:'Oct 24',morningCount:{...MORN},eveningCount:{...MORN},payments:{},expenses:{}},
          {dayNum:2,date:'Oct 25',morningCount:{...MORN},eveningCount:{...(eve||EVE)},payments:{cash:295,square:225,zelle:95},expenses:{}}]};
  ctx.S.shows=[sh]; return {ctx,sh,d:sh.days[1]};
}

R.section('1. Oct 25: 22 sets made from 2oz + C5-S at the table');
{ const {ctx,sh,d}=expo();
  chk('1a. 22 sets built',ctx.daySetsBuilt(d),22);
  chk('1b. sold: the sets came out of 2oz and C5-S, not sales',[ctx.daySold(d)['2oz'],ctx.daySold(d).c5s,ctx.daySold(d).set],[18,15,0]);
  chk('1c. full price of what sold',ctx.calcRev(ctx.daySold(d),null),584);
  chk('1d. no false $365 short',ctx.dayCashCheck(sh,1).state,'over');
  chk('1e. no "SET ended at more than started"',ctx.invNegativeSold(sh).length,0);
  chk('1f. what is on the table is what goes home',[ctx.showOnHand(sh)['2oz'],ctx.showOnHand(sh).c5s,ctx.showOnHand(sh).set,ctx.endShowReturns(sh).set],[111,86,22,22]); }

R.section('2. A typo never invents sales or stock');
{ const {ctx,sh,d}=expo(cnt({...EVE,'2oz':151,c5s:86})); // 2oz did not go down at all
  chk('2a. no 2oz left the table: no sets could be built',ctx.daySetsBuilt(d),0);
  chk('2b. so the 22 sets are still flagged',ctx.invNegativeSold(sh).some(x=>x.sku==='set'),true); }
{ const {ctx,d}=expo(cnt({...EVE,set:60}));
  chk('2c. capped at what the 2oz and C5-S went down',ctx.daySetsBuilt(d),37); }

R.section('3. A day with no sets built is unchanged');
{ const {ctx,d}=expo(cnt({...EVE,set:0}));
  chk('3a. nothing built',ctx.daySetsBuilt(d),0);
  chk('3b. sold the old way',[ctx.daySold(d)['2oz'],ctx.daySold(d).c5s],[40,37]); }

R.section('4. Booth show: per booth, and the truck adds up');
{ const h=boot(); const {ctx}=h; const own=ctx.S.reps.find(x=>x.isSelf).id;
  const sh={id:'bx',name:'Booths',status:'active',startDate:'2026-10-25',numDays:1,dates:['a'],packedInventory:{'2oz':60,c5s:60,set:0},repIds:[own],
    booths:[{id:'b1',name:'Booth 1'},{id:'b2',name:'Booth 2'}],showExpenses:[],boothPayments:[],workers:[],
    days:[{dayNum:1,date:'a',boothCounts:{b1:{morningCount:cnt({'2oz':20,c5s:20}),eveningCount:cnt({'2oz':10,c5s:12,set:5}),payments:{cash:100}},
      b2:{morningCount:cnt({'2oz':20,c5s:20}),eveningCount:cnt({'2oz':15,c5s:15}),payments:{cash:90}}},payments:{},expenses:{}}]};
  ctx.S.shows=[sh]; ctx.rollupDay(sh,0); const d=sh.days[0];
  chk('4a. booth 1 built 5, sold 5 2oz and 3 C5-S',[ctx.boothSetsBuilt(d,'b1'),ctx.boothSold(d,'b1')['2oz'],ctx.boothSold(d,'b1').c5s],[5,5,3]);
  chk('4b. day adds the booths',[ctx.daySetsBuilt(d),ctx.daySold(d)['2oz'],ctx.daySold(d).c5s],[5,10,8]);
  chk('4c. truck + tables: 45 2oz, 47 C5-S, 5 sets',[ctx.showOnHand(sh)['2oz'],ctx.showOnHand(sh).c5s,ctx.showOnHand(sh).set],[45,47,5]);
  chk('4d. nothing flagged',[ctx.invNegativeSold(sh).length,ctx.truckShort(sh).length],[0,0]); }

R.done();
