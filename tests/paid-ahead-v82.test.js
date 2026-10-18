// v82 — deposits on shows still to come are paid AHEAD, not a cost of the season so far.
// SYNTHETIC FIXTURES ONLY.   node tests/paid-ahead-v82.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'], PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;}, pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els;
  ctx.S.shows=[]; ctx.S.otherExpenses=[]; ctx.S.settings.onlineSales=[]; ctx.S.settings.tax=0.28; ctx.S.settings.sqFee=0; ctx.S.settings.cardTax=0;
  return h;
}
const iso=off=>{ const d=new Date(); d.setDate(d.getDate()+off); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
function show(ctx,o){ const dd=[ctx._bsBlankDay(1,'Day 1')];
  const sh=Object.assign({id:o.id,name:o.name||o.id,status:'planned',numDays:1,startDate:o.date,location:'X',miles:0,boothCost:o.booth||0,boothPayments:o.paid?[{amount:o.paid,date:iso(-30)}]:[],dates:dd.map(d=>d.date),showExpenses:[],workers:[],repIds:[],repOnlyShow:true,prices:null,confirmed:true,lodging:0,packedInventory:null,days:dd},o.extra||{});
  ctx.S.shows.push(sh); return sh; }

R.section('1. A deposit on a show still to come is not a cost yet');
{ const h=world(),{ctx}=h;
  const done=show(ctx,{id:'d',date:iso(-20),booth:100,paid:100,extra:{status:'completed'}}); done.days[0].morningCount=cnt({c5s:50}); done.days[0].eveningCount=cnt({c5s:0}); done.days[0].payments=pmt({cash:1000});
  const base=ctx.calcYTD().profit;
  show(ctx,{id:'f',date:iso(40),booth:1095,paid:1095});
  const y=ctx.calcYTD();
  chk('1a. year profit unchanged by a future deposit',Math.round(y.profit*100),Math.round(base*100));
  chk('1b. and it is reported as paid ahead',y.paidAhead,1095);
  ctx.rPnL(); const pl=h.els['pg-pnl'].innerHTML;
  chk('1c. P&L shows the paid-ahead line',/Paid ahead for upcoming shows: \$1,095\.00/.test(pl),true);
  chk('1d. P&L lines still add up',/These lines are/.test(pl),false); }

R.section('2. Money lost on missed and passed shows stays in profit');
{ const h=world(),{ctx}=h; const base=ctx.calcYTD().profit;
  show(ctx,{id:'m',date:iso(-60),booth:70,paid:70});                       // date passed, never worked: missed
  const p=show(ctx,{id:'p',date:iso(30),booth:50,paid:50}); p.passed=true;  // passed on a future show: deposit gone
  const y=ctx.calcYTD();
  chk('2a. both count as money out',Math.round((base-y.profit)*100),12000);
  chk('2b. neither is paid ahead',y.paidAhead,0); }

R.section('3. The deposit counts when the show is worked');
{ const h=world(),{ctx}=h; const sh=show(ctx,{id:'w',date:iso(10),booth:200,paid:200});
  const before=ctx.calcYTD();
  sh.status='completed'; sh.startDate=iso(-1); sh.days[0].morningCount=cnt({c5s:10}); sh.days[0].eveningCount=cnt({c5s:0}); sh.days[0].payments=pmt({cash:300});
  const after=ctx.calcYTD();
  chk('3a. before: paid ahead, not in profit',[before.paidAhead,Math.round(before.profit)],[200,0]);
  chk('3b. after: in the show, not paid ahead',[after.paidAhead,ctx.calcShow(sh).booth],[0,200]); }

R.section('4. Season CSV still adds up');
{ const h=world(),{ctx}=h;
  const a=show(ctx,{id:'a',date:iso(-20),booth:100,paid:100,extra:{status:'completed'}}); a.days[0].morningCount=cnt({c5s:50}); a.days[0].eveningCount=cnt({c5s:10}); a.days[0].payments=pmt({cash:500});
  show(ctx,{id:'f',date:iso(40),booth:300,paid:300}); show(ctx,{id:'m',date:iso(-60),booth:70,paid:70});
  let csv=''; ctx.dlFile=(n,t)=>{csv=t;}; ctx.exportSeasonCSV();
  const rows=csv.trim().split(/\r?\n/).map(l=>(l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)||[]).map(x=>x.replace(/,$/,'').replace(/^"|"$/g,''))); const pi=rows[0].indexOf('Net Profit');
  const body=rows.slice(1).filter(r=>r.length>pi&&r[0]&&r[0]!=='SEASON TOTAL'); const tot=rows.find(r=>r[0]==='SEASON TOTAL');
  chk('4a. rows sum to the season total',Math.round(body.reduce((t,r)=>t+parseFloat(r[pi]),0)*100),Math.round(parseFloat(tot[pi])*100));
  chk('4b. the paid-ahead row is there, outside profit',/Paid ahead for upcoming shows: 300\.00/.test(csv),true); }

R.section('5. Home compares net to net');
{ const h=world(),{ctx}=h;
  const a=show(ctx,{id:'a',date:iso(-20),extra:{status:'completed'}}); a.days[0].morningCount=cnt({c5s:50}); a.days[0].eveningCount=cnt({c5s:0}); a.days[0].payments=pmt({cash:1000});
  ctx.rHome(); const home=h.els['pg-home'].innerHTML.replace(/<[^>]+>/g,' ');
  const y=ctx.calcYTD(), pct=Math.round(y.profit/ctx.PREV_YEAR.net*100);
  chk('5a. bar uses the year net against 2025 net',home.includes('Net '+ctx.fmt(y.profit)+' = '+pct+'% of 2025 net'),true); }
R.done();
