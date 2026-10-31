// v101 — bead show flop, WWW final payment, website sale. SYNTHETIC FIXTURES ONLY.
//
//   node tests/oct31-updates-v101.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const board=()=>{
  const wb=ctx.buildPlannedShow({name:'Whole Bead Show — Milwaukee Pop-up',location:'Milwaukee, WI',startDate:'2026-10-27',numDays:1,boothCost:175,
    boothPayments:[{amount:175,date:'2026-08-18',note:'Table fee'}]}); wb.notes='WHOLE BEAD SHOW notes.';
  const ww=ctx.buildPlannedShow({name:'Wonderful World of Weddings',location:'West Allis, WI',startDate:'2027-01-30',numDays:2,boothCost:1087.80,
    boothPayments:[{amount:250,date:'2026-08-18'},{id:'bp_www_2026_09_30',amount:418.90,date:'2026-09-30'}]}); ww.depositDue='2026-10-31';
  return {v:7,inventory:{'16oz':10,c5l:20},shows:[wb,ww],reps:[],prices:{},settings:{onlineSales:[]},_applied:{}};
};
const wb=d=>d.shows.find(s=>/whole bead/i.test(s.name));
const ww=d=>d.shows.find(s=>/wonderful world/i.test(s.name));
const web=d=>(d.settings.onlineSales||[]).filter(x=>x.id==='ol_2026_10_31_web');
const paid=s=>Math.round(s.boothPayments.reduce((t,x)=>t+x.amount,0)*100)/100;

R.section('1. Applied');
{ const d=board(); (ctx.oct31ShowsV101(d),ctx.oct31SaleV101(d));
  chk('1a. bead show flagged at the top, his notes kept',[/^❌ FLOP, DO NOT REBOOK/.test(wb(d).notes),/WHOLE BEAD SHOW notes\.$/.test(wb(d).notes)],[true,true]);
  chk('1b. bead show money and status untouched',[wb(d).boothCost,paid(wb(d)),wb(d).status],[175,175,'planned']);
  chk('1c. WWW paid in full $1,087.80, nothing owed',[paid(ww(d)),ctx.boothBalance(ww(d))],[1087.8,0]);
  chk('1d. last payment Oct 31, due date cleared',[ww(d).boothPayments.slice(-1)[0].date,ww(d).depositDue],['2026-10-31','']);
  chk('1e. one website sale: 16oz + C5-L, $55 in, $10 postage',[web(d).length,JSON.stringify(web(d)[0].items),web(d)[0].amount,web(d)[0].postage],
    [1,'[{"sku":"16oz","qty":1},{"sku":"c5l","qty":1}]',55,10]);
  chk('1f. 1 x 16oz + 1 x C5-L off the garage',[d.inventory['16oz'],d.inventory.c5l],[9,19]);
  ctx.S=d; chk('1g. sale profit $55 - $10 - $4.50 - $6.00 = $34.50',Math.round(ctx.olSaleProfit(web(d)[0])*100)/100,34.5); }

R.section('2. Reruns never double');
{ const d=board(); (ctx.oct31ShowsV101(d),ctx.oct31SaleV101(d)); (ctx.oct31ShowsV101(d),ctx.oct31SaleV101(d));
  chk('2a. one flag',(wb(d).notes.match(/FLOP/g)||[]).length,1);
  chk('2b. WWW still $1,087.80',paid(ww(d)),1087.8);
  chk('2c. one sale, garage moved once',[web(d).length,d.inventory['16oz'],d.inventory.c5l],[1,9,19]); }

R.section('3. Already logged by hand');
{ const d=board(); d.settings.onlineSales=[{id:'ol_mine',date:'2026-10-30',items:[{sku:'16oz',qty:1},{sku:'c5l',qty:1}],amount:55,postage:10}];
  (ctx.oct31ShowsV101(d),ctx.oct31SaleV101(d));
  chk('3a. his sale kept, ours not added',[d.settings.onlineSales.length,web(d).length],[1,0]);
  chk('3b. garage not moved again',[d.inventory['16oz'],d.inventory.c5l],[10,20]); }
{ const d=board(); ww(d).boothPayments.push({id:'mine',amount:418.90,date:'2026-10-29'}); (ctx.oct31ShowsV101(d),ctx.oct31SaleV101(d));
  chk('3c. his WWW payment not doubled',[paid(ww(d)),ww(d).boothPayments.length],[1087.8,3]); }
{ const d=board(); d.shows=[]; (ctx.oct31ShowsV101(d),ctx.oct31SaleV101(d));
  chk('3d. no shows on the board: nothing invented',d.shows.length,0); }

R.section('4. Runs from applyOneTimeUpdates');
{ const d=board(); d._applied={}; ctx.applyOneTimeUpdates(d);
  chk('4a. marker set, sale and flag present',[!!d._applied['oct31_updates_v101'],web(d).length,/FLOP/.test(wb(d).notes)],[true,1,true]); }

R.section('5. Shows restored from their seed get the edits back; his own changes stick');
{ const d=board(); ctx.oct31ShowsV101(d);
  const fresh=board(); d.shows=fresh.shows; ctx.oct31ShowsV101(d);
  chk('5a. restored shows flagged and paid again',[/FLOP/.test(wb(d).notes),paid(ww(d))],[true,1087.8]); }
{ const d=board(); ctx.oct31ShowsV101(d); wb(d).notes='he rewrote it'; ctx.oct31ShowsV101(d);
  chk('5b. a note he rewrote is not redone',wb(d).notes,'he rewrote it'); }

R.done();
