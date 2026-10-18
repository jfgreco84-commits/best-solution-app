// v83 — gift bags and shelf liner count once, as Business Purchases, not again per show.
// SYNTHETIC FIXTURES ONLY.   node tests/supplies-once-v83.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'], PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;}, pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};
const h=boot(); const {ctx}=h; const S=ctx.S;
S.shows=[]; S.otherExpenses=[{id:'o1',date:'2026-06-08',amount:39.8,note:'Organza bags 5x7'},{id:'o2',date:'2026-06-09',amount:25.98,note:'Shelf liner'}];
const dd=[ctx._bsBlankDay(1,'Day 1')]; dd[0].morningCount=cnt({'8oz':20,'2oz':20}); dd[0].eveningCount=cnt({'8oz':10,'2oz':10}); dd[0].payments=pmt({cash:230});
const sh={id:'s',name:'Show',status:'completed',numDays:1,startDate:'2026-09-01',location:'X',miles:0,boothCost:0,boothPayments:[],dates:['Sep 1'],showExpenses:[],workers:[],repIds:[],repOnlyShow:false,prices:null,confirmed:true,lodging:0,packedInventory:null,days:dd};
S.shows.push(sh);

R.section('1. Default: bags and liner are purchases only');
chk('1a. no per-show bag charge',ctx.showBagCost(sh),0);
chk('1b. no per-show liner charge',ctx.showLinerCost(sh),0);
chk('1c. paper towels still per show',ctx.showPaperCost(sh)>0,true);
chk('1d. supplies on the show = paper towels only',Math.round(ctx.calcShow(sh).supplyCost*100),Math.round(ctx.showPaperCost(sh)*100));
chk('1e. the purchases still count in the year',ctx.calcYTD().otherSpend,65.78);
const V=ctx.bxView(S); chk('1f. snapshot engine agrees',Math.round(V.calcShow(sh).supplyCost*100),Math.round(ctx.calcShow(sh).supplyCost*100));

R.section('2. Switch back to per-show charges');
S.settings.supplyFromPurchases=false;
chk('2a. bags per bottle again',ctx.showBagCount(sh)>0&&ctx.showBagCost(sh)>0,true);
chk('2b. liner per show again',ctx.showLinerCost(sh),6.25);
const V2=ctx.bxView(S); chk('2c. snapshot engine agrees',Math.round(V2.calcShow(sh).supplyCost*100),Math.round(ctx.calcShow(sh).supplyCost*100));

R.section('3. A rep-only show is not your lunch');
delete S.settings.supplyFromPurchases;
chk('3a. you worked it: $20',ctx.showLunchCost(sh),20);
sh.repOnlyShow=true;
chk('3b. rep-only: no lunch of yours',ctx.showLunchCost(sh),0);
chk('3c. snapshot engine agrees',ctx.bxView(S).calcShow(sh).lunch,0);
sh.repOnlyShow=false;
R.done();
