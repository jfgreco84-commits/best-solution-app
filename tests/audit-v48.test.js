// v48 — fixes from the two-pass audit. SYNTHETIC FIXTURES ONLY.
//   node tests/audit-v48.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'], PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;}, pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};
const CR={'32oz':30,'16oz':25,'8oz':20,'2oz':12.5,c5s:12.5,c5l:25};
function world(inv){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(p,x){this.innerHTML+=x;},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els; h.modal=()=>els['mb']?els['mb'].innerHTML:'';
  ctx.S.shows=[]; ctx.S.transfers=[]; ctx.S.otherExpenses=[]; ctx.S.inventory=cnt(inv||{c5s:300});
  ctx.S.settings.sqFee=0.03; ctx.S.settings.tax=0.28; ctx.S.settings.cardTax=0; return h;
}
function show(ctx,o){ o=o||{}; const n=o.numDays||1, dd=[]; for(let i=0;i<n;i++)dd.push(ctx._bsBlankDay(i+1,'Day '+(i+1)));
  const sh=Object.assign({id:o.id||'s',name:'Cranberry',status:'active',numDays:n,startDate:'2026-09-25',location:'Warrens, WI',miles:0,boothCost:0,boothPayments:[],dates:dd.map(d=>d.date),showExpenses:[],workers:[],repIds:[],prices:CR,confirmed:true,lodging:0,packedInventory:null,days:dd},o.extra||{});
  ctx.S.shows.push(sh); if(o.booths!==false)ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']); return sh; }

R.section('1. Exports price at show prices');
{ const h=world(),{ctx}=h; const sh=show(ctx,{booths:false}); sh.packedInventory=cnt({c5s:20});
  sh.days[0].morningCount=cnt({c5s:20}); sh.days[0].eveningCount=cnt({c5s:10}); sh.days[0].payments=pmt({cash:125});
  let csv=''; ctx.dlFile=(n,t)=>{csv=t;}; ctx.exportShowCSV('s');
  chk('1a. CSV line uses $12.50',/C5-S,10,12\.50,125\.00/.test(csv),true); }

R.section('2. Fuel receipt is the gas; day modal does not pre-fill gas');
{ const h=world(),{ctx}=h; const sh=show(ctx,{booths:false,numDays:3,extra:{miles:100,showExpenses:[{id:'f',cat:'fuel',amount:110}]}});
  chk('2a. gas = the receipt only',Math.round(ctx.calcShow(sh).expenses*100)/100>=110&&ctx.calcShow(sh).gasAuto===0,true);
  ctx.showExpModal('s',0); chk('2b. gas field empty',/id="ex_g" value=""/.test(h.modal()),true); }

R.section('3. A booth that ends above what it had');
{ const h=world(),{ctx}=h; const sh=show(ctx); ctx.showPackModal('s'); ctx.pkAll('s'); ctx.document.getElementById('pk_c5s').value='300'; ctx.confirmPack('s');
  const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);
  [A,B,C].forEach(b=>ctx.boothSetStock(sh,0,b,'morning',cnt({c5s:10})));
  ctx.boothSetStock(sh,0,A,'evening',cnt({c5s:15})); ctx.boothSetStock(sh,0,B,'evening',cnt({c5s:5})); ctx.boothSetStock(sh,0,C,'evening',cnt({c5s:10}));
  chk('3a. flagged red',ctx.auditShow(sh).some(x=>x.code==='boothOver'&&x.sev==='red'),true);
  ctx.saveTruckCount('s',0,cnt({c5s:265}));
  chk('3b. truck fix refuses until logged',ctx.fixPackedFromTruckCount('s',0).ok,false);
  ctx.dayBoothWrite(sh.days[0],A).restock={c5s:5}; ctx.rollupDay(sh,0);
  chk('3c. logged: flag gone',ctx.auditShow(sh).some(x=>x.code==='boothOver'),false);
  chk('3d. logged: real sales',ctx.showUnitsSold(sh).c5s,5);
  chk('3e. logged: truck matches',ctx.truckCountDiff(sh,0).any,false); }

R.section('4. A later truck fix retires earlier counts');
{ const h=world(),{ctx}=h; const sh=show(ctx,{numDays:2}); ctx.showPackModal('s'); ctx.pkAll('s'); ctx.document.getElementById('pk_c5s').value='300'; ctx.confirmPack('s');
  const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);
  [A,B,C].forEach(b=>{ctx.boothSetStock(sh,0,b,'morning',cnt({c5s:50}));ctx.boothSetStock(sh,0,b,'evening',cnt({c5s:40}));});
  ctx.saveTruckCount('s',0,cnt({c5s:150}));
  [A,B,C].forEach(b=>ctx.boothSetStock(sh,1,b,'morning',cnt({c5s:40})));
  ctx.saveTruckCount('s',1,cnt({c5s:146})); chk('4a. day 2 fix ok',ctx.fixPackedFromTruckCount('s',1).ok,true);
  chk('4b. day 1 not re-flagged',ctx.auditShow(sh).some(x=>x.code==='truckCount'),false);
  chk('4c. day 1 card offers no fix',/My truck count is right/.test(ctx.truckCardHTML(sh,0)),false); }

R.section('5. An opening the app filled in follows a corrected close');
{ const h=world(),{ctx}=h; const sh=show(ctx,{booths:false,numDays:2}); sh.packedInventory=cnt({c5s:100});
  sh.days[0].morningCount=cnt({c5s:100});
  ctx.document.getElementById('cnt_c5s'); SK.forEach(k=>ctx.document.getElementById('cnt_'+k).value=k==='c5s'?'70':'0');
  const put=v=>{ SK.forEach(k=>{ const e=ctx.document.getElementById('c_'+k); e.value=k==='c5s'?String(v):'0'; }); };
  sh.days[0].eveningCount=null; }
{ const h=world(),{ctx}=h; const sh=show(ctx,{numDays:2}); sh.packedInventory=cnt({c5s:300}); const [A]=ctx.showBooths(sh).map(b=>b.id);
  ctx.boothSetStock(sh,0,A,'morning',cnt({c5s:80}));
  const en1=ctx.dayBoothWrite(sh.days[1],A); en1.morningCount=cnt({c5s:70}); en1.morningSeeded=true;
  ctx.boothSetStock(sh,1,A,'morning',cnt({c5s:72}));
  chk('5a. a counted opening loses the seeded mark',!!ctx.dayBoothRead(sh.days[1],A).morningSeeded,false); }

R.section('6. Season numbers add up; reserve on the year');
{ const h=world(),{ctx}=h;
  const a=show(ctx,{id:'a',booths:false,extra:{status:'completed',startDate:'2026-08-15',prices:null}}); a.days[0].morningCount=cnt({c5s:100}); a.days[0].eveningCount=cnt({c5s:20}); a.days[0].payments=pmt({cash:800});
  const b=show(ctx,{id:'b',booths:false,extra:{status:'completed',startDate:'2026-08-20',prices:null,boothCost:1500}}); b.days[0].morningCount=cnt({c5s:10}); b.days[0].eveningCount=cnt({c5s:0}); b.days[0].payments=pmt({cash:100});
  const y=ctx.calcYTD();
  chk('6a. reserve = 28% of year profit, never of a loss',Math.round(y.taxRes*100),Math.round(Math.max(0,y.profit)*0.28*100));
  let csv=''; ctx.dlFile=(n,t)=>{csv=t;}; ctx.exportSeasonCSV();
  const rows=csv.trim().split(/\r?\n/).map(l=>(l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)||[]).map(x=>x.replace(/,$/,'').replace(/^"|"$/g,''))); const pi=rows[0].indexOf('Net Profit');
  const body=rows.slice(1).filter(r=>r.length>pi&&r[0]&&r[0]!=='SEASON TOTAL'); const tot=rows.find(r=>r[0]==='SEASON TOTAL');
  chk('6b. rows sum to the season total',Math.round(body.reduce((t,r)=>t+parseFloat(r[pi]),0)*100),Math.round(parseFloat(tot[pi])*100)); }

R.section('7. Scoreboard: a drawer counts once');
{ const h=world(),{ctx}=h; const sh=show(ctx); const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);
  sh.teams=[{id:'t1',repIds:['rep_justin','rep_cutty'],name:'F'},{id:'t2',repIds:['rep_les','rep_anthony'],name:'L'},{id:'t3',repIds:['rep_tj','rep_dave'],name:'T'}];
  [A,B,C].forEach((id,i)=>{ ctx.boothSetStock(sh,0,id,'morning',cnt({c5s:50})); ctx.boothSetStock(sh,0,id,'evening',cnt({c5s:30})); ctx.dayBoothWrite(sh.days[0],id).payments=pmt({cash:[200,300,250][i]}); });
  ctx.rollupDay(sh,0); ctx.setTeamBooth(sh,0,'t1',A); ctx.setTeamBooth(sh,0,'t2',B); ctx.setTeamBooth(sh,0,'t3',C);
  ctx.dayCrewToggle(sh,0,A,'rep_anthony');
  const T=id=>ctx.teamShowTotals(sh,ctx.showTeams(sh).find(x=>x.id===id)).total;
  chk('7a. one helper does not double-credit',T('t1')+T('t2')+T('t3'),750); }

R.section('8. Stock card shows Lost; lost leaves at-show right away');
{ const h=world(),{ctx}=h; const sh=show(ctx); ctx.showPackModal('s'); ctx.pkAll('s'); ctx.document.getElementById('pk_c5s').value='300'; ctx.confirmPack('s');
  const [A]=ctx.showBooths(sh).map(b=>b.id); ctx.boothSetStock(sh,0,A,'morning',cnt({c5s:50}));
  ctx.dayBoothWrite(sh.days[0],A).lost={c5s:3}; ctx.rollupDay(sh,0);
  chk('8a. at-show drops by the lost 3 before close',ctx.showOnHand(sh).c5s,297); }
R.done();
