// v102 — two July website orders. SYNTHETIC FIXTURES ONLY.
//
//   node tests/july-web-orders-v102.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const board=()=>({v:7,inventory:{'8oz':50,'2oz':60},shows:[],reps:[],prices:{},settings:{onlineSales:[]},_applied:{}});
const ours=d=>d.settings.onlineSales.filter(x=>/^ol_2026_07_(07|20)_web$/.test(x.id)).sort((a,b)=>a.date<b.date?-1:1);

R.section('1. Added');
{ const d=board(); ctx.julyWebOrdersV102(d); const L=ours(d);
  chk('1a. two sales',L.length,2);
  chk('1b. dates, amounts, methods',L.map(x=>[x.date,x.amount,x.method]),[['2026-07-07',25,'Venmo'],['2026-07-20',40,'Cash App']]);
  chk('1c. items',L.map(x=>JSON.stringify(x.items)),['[{"sku":"8oz","qty":1}]','[{"sku":"8oz","qty":1},{"sku":"2oz","qty":1}]']);
  chk('1d. postage left at 0, note says add it',L.every(x=>x.postage===0&&/Postage you paid not entered/.test(x.note)),true);
  chk('1e. garage NOT moved',[d.inventory['8oz'],d.inventory['2oz']],[50,60]);
  chk('1f. no buyer name, email or phone stored',JSON.stringify(L).match(/celeste|lyles|nancy|cannister|@|815|lowden|allen st/i),null);
  ctx.S=d; const t=ctx.olTotals(2026);
  chk('1g. 2026 online totals: 2 orders, 3 units, $65',[t.orders,t.units,t.amount],[2,3,65]); }

R.section('2. Never doubled');
{ const d=board(); ctx.julyWebOrdersV102(d); ctx.julyWebOrdersV102(d);
  chk('2a. rerun: still two',ours(d).length,2); }
{ const d=board(); d.settings.onlineSales=[{id:'mine',date:'2026-07-08',items:[{sku:'8oz',qty:1}],amount:25,postage:9}];
  ctx.julyWebOrdersV102(d);
  chk('2b. his 7/8 $25 8oz kept, ours for 7/7 skipped, 7/20 added',[d.settings.onlineSales.length,ours(d).map(x=>x.date)],[2,['2026-07-20']]); }
{ const d=board(); d.settings.onlineSales=[{id:'other',date:'2026-07-07',items:[{sku:'c5s',qty:1}],amount:25}];
  ctx.julyWebOrdersV102(d);
  chk('2c. a different $25 sale the same day does not block it',ours(d).length,2); }

R.section('3. Runs from applyOneTimeUpdates');
{ const d=board(); ctx.applyOneTimeUpdates(d);
  chk('3a. marker set, both sales on the list',[!!d._applied['july_web_orders_v102'],ours(d).length],[true,2]); }

R.done();
