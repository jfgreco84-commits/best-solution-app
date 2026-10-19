// v84 — the auditor pass: money checks, one-tap fixes, rep payments linked to shows,
// and the common-day polish (money screen says short/over, active show first).
// SYNTHETIC FIXTURES ONLY.   node tests/auditor-v84.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'], PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;}, pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};
function world(){
  const h=boot(); const {ctx}=h; const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
  ctx.document.getElementById=id=>(els[id]||(els[id]=mk())); h.els=els; ctx.confirm=()=>true;
  const S=ctx.S; S.shows=[]; S.otherExpenses=[]; S.transfers=[];
  const own=S.reps.find(r=>r.isSelf); h.own=own.id;
  ['isaiah','andre'].forEach(n=>{ if(!S.reps.find(r=>r.id==='rep_'+n))S.reps.push({id:'rep_'+n,name:n[0].toUpperCase()+n.slice(1),active:true,payments:[]}); });
  h.show=(o)=>{ const d=ctx._bsBlankDay(1,'Day 1'); Object.assign(d,o.day||{});
    const sh=Object.assign({id:o.id,name:o.id,status:'completed',numDays:1,startDate:o.date||'2026-09-01',location:'X',miles:50,boothCost:0,boothPayments:[],dates:['Sep 1'],showExpenses:[],workers:[],repIds:[],repOnlyShow:false,prices:null,confirmed:true,lodging:0,packedInventory:cnt({c5s:50}),days:[d]},o.extra||{});
    S.shows.push(sh); return sh; };
  h.codes=id=>ctx.auditAll(ctx.S).filter(x=>!id||x.showId===id).map(x=>x.code);
  return h;
}

R.section('1. Sold product, no money: flagged red, with a button to enter it');
{ const h=world(),{ctx}=h; const sh=h.show({id:'a',extra:{status:'active'},day:{morningCount:cnt({c5s:50}),eveningCount:cnt({c5s:40})}});
  const x=ctx.auditAll(ctx.S).find(i=>i.code==='countNoMoney');
  chk('1a. flagged',!!x&&x.sev==='red',true);
  chk('1b. says how many and what they were worth',/10 units sold \(\$100\.00 at full price\)/.test(x.msg),true);
  chk('1c. offers Enter the money',(x.fixes||[]).some(f=>/Enter the money/.test(f.label)),true);
  sh.days[0].payments=pmt({cash:100}); chk('1d. gone once money is in',h.codes('a').includes('countNoMoney'),false); }

R.section('2. Only a rep on the crew, but you are charged as working it');
{ const h=world(),{ctx}=h; const sh=h.show({id:'b',extra:{repIds:['rep_isaiah']},day:{morningCount:cnt({c5s:50}),eveningCount:cnt({c5s:40}),payments:pmt({cash:100})}});
  chk('2a. flagged',h.codes('b').includes('repOnlyUnset'),true);
  const lunch=ctx.calcShow(sh).lunch, gas=ctx.calcShow(sh).gasAuto;
  ctx.confirm=()=>false; ctx.auditSetCrew('b',false);  // not there, rep covered gas
  chk('2b. rep-only: your lunch and gas come off',[lunch>0,gas>0,ctx.calcShow(sh).lunch,ctx.calcShow(sh).gasAuto],[true,true,0,0]);
  chk('2c. snapshot engine agrees',[ctx.bxView(ctx.S).calcShow(sh).lunch,ctx.bxView(ctx.S).calcShow(sh).gasAuto],[0,0]);
  chk('2d. flag gone',h.codes('b').includes('repOnlyUnset'),false); }
{ const h=world(),{ctx}=h; const sh=h.show({id:'c',extra:{repIds:['rep_isaiah']},day:{morningCount:cnt({c5s:50}),eveningCount:cnt({c5s:40}),payments:pmt({cash:100})}});
  ctx.confirm=()=>true; ctx.auditSetCrew('c',false);
  chk('2e. rep-only but you paid their gas: gas stays, lunch goes',[ctx.calcShow(sh).gasAuto>0,ctx.calcShow(sh).lunch],[true,0]);
  const s2=h.show({id:'d',extra:{repIds:['rep_isaiah']},day:{morningCount:cnt({c5s:50}),eveningCount:cnt({c5s:40}),payments:pmt({cash:100})}});
  ctx.auditSetCrew('d',true);
  chk('2f. "I was there" puts you on the crew and clears it',[s2.repIds.includes(h.own),h.codes('d').includes('repOnlyUnset')],[true,false]); }

R.section('3. Closed with nothing sold: one tap moves it to Missed');
{ const h=world(),{ctx}=h; const sh=h.show({id:'e',day:{morningCount:cnt({c5s:50}),eveningCount:cnt({c5s:50}),payments:pmt({cash:1}),repPay:{rep_isaiah:1}},extra:{repIds:['rep_isaiah'],repOnlyShow:true,returned:cnt({c5s:50})}});
  const before=ctx.calcYTD().profit;
  chk('3a. flagged',h.codes('e').includes('zeroSale'),true);
  ctx.auditDidNotHappen('e');
  chk('3b. now missed, costs off, placeholder pay gone',[ctx.isMissed(sh),ctx.repEarned('rep_isaiah')],[true,0]);
  chk('3c. year profit no longer carries its costs',ctx.calcYTD().profit>before,true); }

R.section('4. A rep paid more than entered is flagged');
{ const h=world(),{ctx}=h; h.show({id:'f',extra:{repIds:['rep_andre']},day:{morningCount:cnt({c5s:50}),eveningCount:cnt({c5s:40}),payments:pmt({cash:300}),repPay:{rep_andre:100}}});
  ctx.S.reps.find(r=>r.id==='rep_andre').payments=[{amount:352,date:'2026-09-02',showId:'f'}];
  const x=ctx.auditAll(ctx.S).find(i=>i.code==='repOverpaid');
  chk('4a. flagged with the gap',!!x&&/\$252\.00 more/.test(x.msg),true); }

R.section('5. Rep payments with no show get linked when the match is exact');
{ const h=world(),{ctx}=h;
  const d={reps:[{id:'rep_x',name:'X',payments:[{amount:225,date:'2026-06-22'},{amount:727,date:'2026-07-06'}]}],
    shows:[{id:'s1',name:'S1',startDate:'2026-06-12',days:[{repPay:{rep_x:225},payments:pmt({})}]},{id:'s2',name:'S2',startDate:'2026-06-20',days:[{repPay:{rep_x:300},payments:pmt({})}]}],settings:{},_applied:{}};
  ctx.applyOneTimeUpdates(d);
  chk('5a. exact match linked',d.reps[0].payments[0].showId,'s1');
  chk('5b. no exact match: left alone',d.reps[0].payments[1].showId,undefined); }

R.section('6. Common day polish');
{ const h=world(),{ctx}=h;
  chk('6a. money screen: matches',/Matches what sold/.test(ctx.mmDiffText(100,100)),true);
  chk('6b. money screen: short',/\$40\.00 short of what sold/.test(ctx.mmDiffText(60,100)),true);
  chk('6c. money screen: over',/\$40\.00 over what sold/.test(ctx.mmDiffText(140,100)),true);
  const act=h.show({id:'live',extra:{status:'active',startDate:'2030-01-01'}}); h.show({id:'later',extra:{status:'planned',startDate:'2030-01-05'}});
  ctx.showsTab='upcoming'; ctx.rShows(); const html=h.els['pg-shows'].innerHTML;
  chk('6d. the show happening now is above the booking pipeline',html.indexOf('Happening now')>=0&&html.indexOf('Happening now')<html.indexOf('Booking Pipeline'),true);
  chk('6e. and listed once',(html.match(/go\('show','live'\)/g)||[]).length,1); }
{ const h=world(),{ctx}=h; h.show({id:'w',extra:{repIds:['rep_isaiah']},day:{morningCount:cnt({c5s:50}),eveningCount:cnt({c5s:40}),payments:pmt({cash:300}),repPay:{rep_isaiah:120}}});
  chk('6f. owed says which show',ctx.repOwedWhere('rep_isaiah'),'w $120.00');
  ctx.rReps(); const html=h.els['pg-reps'].innerHTML;
  chk('6g. a person with no shows or pay is tucked away',/No shows or pay yet: .*Andre/.test(html),true); }
R.done();
