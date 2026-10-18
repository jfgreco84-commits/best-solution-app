// v79 — owner-facing simplifications. SYNTHETIC FIXTURES ONLY.
//   node tests/simplify-v79.test.js
'use strict';
const fs=require('fs');
const {boot,reporter,APP}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'], PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;}, pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};
const html=fs.readFileSync(APP,'utf8');
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(p,x){this.innerHTML+=x;},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els; h.modal=()=>els['mb']?els['mb'].innerHTML:'';
  ctx.S.shows=[]; ctx.S.transfers=[]; ctx.S.otherExpenses=[]; ctx.S.inventory=cnt({c5s:300});
  ctx.S.settings.sqFee=0.03; ctx.S.settings.tax=0.28; ctx.S.settings.cardTax=0; ctx.S.settings.onlineSales=[]; return h;
}
function show(ctx,o){ o=o||{}; const n=o.numDays||1, dd=[]; for(let i=0;i<n;i++)dd.push(ctx._bsBlankDay(i+1,'Day '+(i+1)));
  const sh=Object.assign({id:o.id||'s',name:'Test Fest',status:'completed',numDays:n,startDate:'2026-09-05',location:'Somewhere, WI',miles:0,boothCost:0,boothPayments:[],dates:dd.map(d=>d.date),showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true,lodging:0,packedInventory:null,days:dd},o.extra||{});
  ctx.S.shows.push(sh); return sh; }
const money=s=>{ const m=String(s).replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&'); return m; };

R.section('1. One profit number: Home = P&L = calcYTD');
{ const h=world(),{ctx}=h;
  const a=show(ctx,{id:'a',extra:{boothCost:200}}); a.days[0].morningCount=cnt({c5s:100}); a.days[0].eveningCount=cnt({c5s:20}); a.days[0].payments=pmt({cash:1000});
  const y=ctx.calcYTD(); ctx.rHome(); const home=money(h.els['pg-home'].innerHTML);
  const want=ctx.fmt(y.profit);
  chk('1a. Home tile reads NET PROFIT (YEAR)',/NET PROFIT \(YEAR\)/.test(home),true);
  chk('1b. Home shows the calcYTD profit',home.includes(want),true);
  chk('1c. homeCtx yearNet = calcYTD profit',Math.round(ctx.homeCtx().yearNet*100),Math.round(y.profit*100));
  ctx.rPnL(); const pl=money(h.els['pg-pnl'].innerHTML);
  chk('1d. P&L shows the same number',pl.includes(want),true); }

R.section('2. Online sales count in the year');
{ const h=world(),{ctx}=h;
  const a=show(ctx,{id:'a'}); a.days[0].morningCount=cnt({c5s:50}); a.days[0].eveningCount=cnt({c5s:40}); a.days[0].payments=pmt({cash:125});
  const before=ctx.calcYTD();
  ctx.S.settings.onlineSales.push({id:'ol1',date:'2026-10-01',amount:30,postage:13,items:[{sku:'c5s',qty:2}]});
  const after=ctx.calcYTD(), ol=ctx.olTotals();
  chk('2a. gross goes up by the online amount',Math.round((after.gross-before.gross)*100),3000);
  chk('2b. profit moves by the online profit',Math.round((after.profit-before.profit)*100),Math.round(ol.profit*100));
  ctx.rPnL(); const pl=money(h.els['pg-pnl'].innerHTML);
  chk('2c. P&L has a postage line',/Online sales postage/.test(pl),true);
  chk('2d. P&L lines still add up (no warning)',/These lines are/.test(pl),false);
  let csv=''; ctx.dlFile=(n,t)=>{csv=t;}; ctx.exportSeasonCSV();
  chk('2e. season CSV has an online row',/Online sales \(1 orders/.test(csv),true); }

R.section('3. Six tabs');
{ chk('3a. no Calendar nav button',/id="nb-calendar"/.test(html),false);
  chk('3b. no Supplies nav button',/id="nb-supplies"/.test(html),false);
  chk('3c. six nav buttons',(html.match(/<button class="nb[^"]*" id="nb-/g)||[]).length,6);
  const h=world(),{ctx}=h; ctx.go('calendar'); chk('3d. Calendar page still opens with a Shows toggle',/go\('shows'\)/.test(h.els['pg-calendar'].innerHTML),true);
  ctx.go('supplies'); chk('3e. Supplies page still opens with a Stock toggle',/go\('stock'\)/.test(h.els['pg-supplies'].innerHTML),true); }

R.section('4. Setup cleanup');
{ const h=world(),{ctx}=h; ctx.rSettings(); const st=h.els['pg-settings'].innerHTML;
  chk('4a. one Backup & Restore card',(st.match(/BACKUP &amp; RESTORE/g)||[]).length,1);
  chk('4b. developer tools sit in Advanced',/<details[^>]*>[\s\S]*Advanced \(only when Claude asks\)[\s\S]*Danger Zone/i.test(st),true);
  chk('4c. Paste Claude Update is gone',/PASTE CLAUDE UPDATE/i.test(st)||typeof ctx.applyClaudeCmd==='function',false); }

R.section('5. Payout Sheet lives on Teams only');
{ const h=world(),{ctx}=h; const S=ctx.S, own=S.reps.find(r=>r.isSelf); S.reps.push({id:'rep_t',name:'Tester',active:true,payments:[]});
  const sh={id:'s',name:'Test Fest',status:'active',startDate:'2026-10-17',numDays:1,dates:['2026-10-17'],repIds:[own.id,'rep_t'],
    booths:[{id:'b1',name:'Booth 1'}],days:[Object.assign(ctx._bsBlankDay(1,'Day 1'),{boothCounts:{b1:{payments:{cash:500}}},boothCrew:{b1:[own.id,'rep_t']}})],
    showExpenses:[],workers:[],payFromCommission:true};
  S.shows.push(sh); ctx.saveS();
  ctx.curShow='s'; ctx.rShow(); const page=h.els['pg-show'].innerHTML;
  const pane=k=>{ const m=page.split('class="stab-pane" data-stab="'+k+'"')[1]||''; return m.split('class="stab-pane"')[0]; };
  const sheet=ctx.payoutSheetHTML(sh);
  chk('5a. fixture has a payout sheet',!!sheet,true);
  chk('5b. Teams tab has it',pane('teams').includes(sheet),true);
  chk('5c. Money tab only links to it',[pane('money').includes(sheet),/Payout Sheet is on the/.test(pane('money'))],[false,true]); }

R.section('6. One place for gas');
{ const h=world(),{ctx}=h; const sh=show(ctx,{extra:{miles:100}});
  ctx.showExpModal('s',0); chk('6a. day screen has no gas box',/id="ex_g"/.test(h.modal()),false);
  sh.days[0].expenses={gas:40,food:0,parking:0,hotel:0,other:0};
  ctx.showExpModal('s',0); chk('6b. old day gas is shown as still counting',/still counts/.test(h.modal()),true);
  ctx.document.getElementById('ex_f').value='12'; ctx.saveExp('s',0);
  chk('6c. saving the day keeps the old gas',[sh.days[0].expenses.gas,sh.days[0].expenses.food],[40,12]);
  chk('6d. logged gas counts once',ctx.showGasLogged(sh),40);
  sh.showExpenses.push({id:'f',cat:'fuel',amount:25});
  chk('6e. legacy fuel receipts add in',ctx.showGasLogged(sh),65); }
R.done();
