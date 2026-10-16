// v76 — Chicago Women's Expo, Oct 24-25 2026, Rosemont. SYNTHETIC FIXTURES ONLY.
//
//   node tests/womens-expo.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const blank=()=>({v:7,inventory:{},shows:[],reps:[],prices:{},settings:{},_applied:{}});
const find=d=>d.shows.filter(s=>/women.?s expo/i.test(s.name||''));

R.section('1. Added on a full load');
{ const d=blank(); ctx.applyOneTimeUpdates(d); const L=find(d), sh=L[0];
  chk('1a. one show',L.length,1);
  chk('1b. name / place / dates',[sh.name,sh.location,sh.startDate,sh.numDays],["Chicago Women's Expo",'Rosemont, IL','2026-10-24',2]);
  chk('1c. hours Sat 10-5, Sun 11-5',sh.days.map(x=>[x.openTime,x.closeTime]),[['10:00','17:00'],['11:00','17:00']]);
  chk('1d. booth $1,095, paid in full',[sh.boothCost,sh.boothPayments.length,sh.boothPayments[0].amount,sh.boothPayments[0].date],[1095,1,1095,'2026-10-13']);
  chk('1e. confirmed, planned, 70 mi',[sh.confirmed,sh.status,sh.miles],[true,'planned',70]);
  chk('1f. Alivia + Michele on the crew, Froggy working (not crew-run)',[sh.repIds,sh.repOnlyShow],[['rep_alivia','rep_michele'],false]);
  chk('1g. Michele on the rep roster',d.reps.some(r=>r.id==='rep_michele'&&r.name==='Michele'&&r.active),true);
  chk('1h. notes: no tables/chairs + setup kit',[/NOT include tables or chairs/.test(sh.notes),/Set-Up Kit/.test(sh.notes)],[true,true]);
  chk('1i. nothing owed on the booth',(parseFloat(sh.boothCost)||0)-sh.boothPayments.reduce((t,x)=>t+x.amount,0),0); }

R.section('2. Reloads never duplicate');
{ const d=blank(); ctx.applyOneTimeUpdates(d); ctx.applyOneTimeUpdates(d);
  delete d._applied['chicago_womens_expo_v76']; ctx.applyOneTimeUpdates(d);
  chk('2a. still one show',find(d).length,1);
  chk('2b. still one payment',find(d)[0].boothPayments.length,1);
  chk('2c. one Michele',d.reps.filter(r=>r.id==='rep_michele').length,1); }

R.section('3. Already typed in by hand: updated in place');
{ const d=blank(); const own=ctx.buildPlannedShow({name:'Womens Expo Rosemont',location:'',startDate:'2026-10-24',numDays:2,boothPayments:[{id:'x',amount:1095,date:'2026-10-13'}]});
  own.notes='my note'; own.repIds=['rep_justin']; d.shows.push(own);
  d._applied={}; ctx.applyOneTimeUpdates(d);
  const L=find(d);
  chk('3a. not duplicated',L.length,1);
  chk('3b. his name kept',L[0].name,'Womens Expo Rosemont');
  chk('3c. his $1,095 payment not doubled',L[0].boothPayments.length,1);
  chk('3d. blanks filled',[L[0].location,L[0].miles,L[0].boothCost,L[0].days[1].openTime],['Rosemont, IL',70,1095,'11:00']);
  chk('3e. his note kept, ours appended',[/^my note/.test(L[0].notes),/ExhibitorComp/.test(L[0].notes)],[true,true]);
  chk('3f. Alivia + Michele added, his crew kept',L[0].repIds,['rep_justin','rep_alivia','rep_michele']); }

R.section('4. TJ works A Fair to Remember, Fall');
{ const d=blank(); ctx.applyOneTimeUpdates(d);
  const f=d.shows.find(s=>/fair to remember, fall/i.test(s.name)), x=d.shows.find(s=>/fair to remember, christmas/i.test(s.name));
  chk('4a. TJ on the Fall crew, crew-run',[f.repIds.indexOf('rep_tj')>=0,f.repOnlyShow],[true,true]);
  chk('4b. note says TJ',/TJ works this show/.test(f.notes),true);
  chk('4c. Christmas show untouched',[x.repIds.indexOf('rep_tj')>=0,!!x.repOnlyShow],[false,false]);
  delete d._applied['ftr_fall_tj_v76']; ctx.applyOneTimeUpdates(d);
  chk('4d. rerun adds nothing',[f.repIds.filter(i=>i==='rep_tj').length,(f.notes.match(/TJ works this show/g)||[]).length],[1,1]); }
{ const d=blank(); d.shows=[]; d._applied={}; Object.keys(ctx.MRG_SEED_RECORDS).forEach(k=>d._applied[k]=true);
  ctx.applyOneTimeUpdates(d);
  chk('4e. no show yet: waits',!!d._applied['ftr_fall_tj_v76'],false); }

R.done();
