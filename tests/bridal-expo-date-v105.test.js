// v105 — Bridal Expo at The Ten Hotel moved Jan 17 -> Jan 24 2027. SYNTHETIC FIXTURES ONLY.
//
//   node tests/bridal-expo-date-v105.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const mk=(date,extra)=>Object.assign(ctx.buildPlannedShow({name:'Bridal Expo — The Ten Hotel',location:'The Ten Hotel, Gurnee, IL',startDate:date,numDays:1,boothCost:178,
  boothPayments:[{id:'bp_smc_001930',amount:178,date:'2026-08-21'}]}),{notes:'BRIDAL EXPO notes.'},extra||{});
const board=shows=>({v:7,inventory:{},shows,reps:[],prices:{},settings:{},_applied:{}});
const bx=d=>d.shows.filter(s=>/bridal expo/i.test(s.name));

R.section('1. Moved');
{ const d=board([mk('2027-01-17')]); const out=ctx.bridalExpoDateV105(d); const s=bx(d)[0];
  chk('1a. now Sun Jan 24 2027, day 1 follows',[s.startDate,s.days[0].date,s.numDays],['2027-01-24','Jan 24',1]);
  chk('1b. booth money untouched',[s.boothCost,s.boothPayments.length,s.boothPayments[0].amount],[178,1,178]);
  chk('1c. note added, his notes kept, move logged',[/DATE MOVED/.test(s.notes),/^BRIDAL EXPO notes\./.test(s.notes),s.invLog.slice(-1)[0].type],[true,true,'date moved']);
  chk('1d. one change reported',out.length,1); }

R.section('2. Never twice, never a second show');
{ const d=board([mk('2027-01-17')]); ctx.bridalExpoDateV105(d); ctx.bridalExpoDateV105(d);
  chk('2a. one note, one log line',[(bx(d)[0].notes.match(/DATE MOVED/g)||[]).length,bx(d)[0].invLog.filter(x=>x.type==='date moved').length],[1,1]);
  const s=bx(d)[0]; s.startDate='2027-01-31'; ctx.bridalExpoDateV105(d);
  chk('2b. a date he sets by hand later stays',s.startDate,'2027-01-31');
  const d2=board([mk('2027-01-24')]); ctx.bridalExpoDateV105(d2);
  chk('2c. already on Jan 24: left alone',[bx(d2).length,bx(d2)[0].startDate,/DATE MOVED/.test(bx(d2)[0].notes)],[1,'2027-01-24',false]); }

R.section('3. Full load: seed re-run never duplicates');
{ const d=board([mk('2027-01-17')]); ctx.applyOneTimeUpdates(d); delete d._applied['social_market_v77']; ctx.applyOneTimeUpdates(d);
  chk('3a. one Bridal Expo, on Jan 24, one payment',[bx(d).length,bx(d)[0].startDate,bx(d)[0].boothPayments.length],[1,'2027-01-24',1]);
  const d2=board([]); ctx.applyOneTimeUpdates(d2);
  chk('3b. fresh board seeds it on Jan 24',bx(d2).map(s=>s.startDate),['2027-01-24']); }

R.section('4. Other Ten Hotel shows untouched');
{ const g=Object.assign(ctx.buildPlannedShow({name:"Galentine's Day Market",location:'The Ten Hotel, Gurnee, IL',startDate:'2027-02-07',numDays:1}));
  const d=board([mk('2027-01-17'),g]); ctx.bridalExpoDateV105(d);
  chk('4a. Galentine stays Feb 7',g.startDate,'2027-02-07'); }

R.done();
