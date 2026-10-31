// v100 — Royale Events 2027 four-show package, one $800 Zelle. SYNTHETIC FIXTURES ONLY.
//
//   node tests/royale-2027-v100.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx}=boot();
const blank=()=>({v:7,inventory:{},shows:[],reps:[],prices:{},settings:{},_applied:{}});
const RE=/royale|iftaa?r|ramadan|bazaar|shalimar|chaand|suhoor/i;
const find=d=>d.shows.filter(s=>RE.test((s.name||'')+' '+(s.notes||''))).sort((a,b)=>a.startDate<b.startDate?-1:1);
const paid=L=>Math.round(L.reduce((t,s)=>t+(s.boothPayments||[]).reduce((a,p)=>a+(parseFloat(p.amount)||0),0),0)*100)/100;
const cost=L=>Math.round(L.reduce((t,s)=>t+(parseFloat(s.boothCost)||0),0)*100)/100;

R.section('1. Four shows on a full load');
{ const d=blank(); ctx.applyOneTimeUpdates(d); const L=find(d);
  chk('1a. exactly four shows',L.length,4);
  chk('1b. the four dates, no Mar 8',L.map(s=>s.startDate),['2027-02-19','2027-02-20','2027-02-26','2027-03-07']);
  chk('1c. each a one-day show',L.map(s=>s.numDays),[1,1,1,1]);
  chk('1d. names',L.map(s=>s.name),['Dawat-e-Iftaar Ramadan Bazaar, Shalimar Day 1','Dawat-e-Iftaar Ramadan Bazaar, Shalimar Day 2',
    'Iftaar & Suhoor Night Ramadan Bazaar, Naperville','Laylat al Fitr (Chaand Raat) Ramadan Bazaar, Naperville']);
  chk('1e. places',L.map(s=>s.location),['Addison, IL','Addison, IL','Naperville, IL','Naperville, IL']);
  chk('1f. overnight hours',L.map(s=>[s.days[0].openTime,s.days[0].closeTime]),[['14:00','02:00'],['14:00','02:00'],['16:00','04:00'],['14:00','02:00']]);
  chk('1g. work hours wrap past midnight (12h + 1h setup)',L.map(s=>ctx.dayWorkHours(s,0)),[13,13,13,13]);
  chk('1h. pending, not confirmed, planned',L.map(s=>[s.confirmed,s.status]),[[false,'planned'],[false,'planned'],[false,'planned'],[false,'planned']]);
  chk('1i. Addison miles left blank, Naperville ~75',L.map(s=>s.miles),[0,0,75,75]);
  chk('1j. shares 235.29 / 235.30 / 164.70 / 164.71',L.map(s=>s.boothCost),[235.29,235.30,164.70,164.71]);
  chk('1k. booth costs add to exactly $800.00',cost(L),800);
  chk('1l. payments add to exactly $800.00, one share per show',[paid(L),L.map(s=>s.boothPayments.length)],[800,[1,1,1,1]]);
  chk('1m. every share dated Oct 31 2026 and carries the Zelle ref',L.every(s=>s.boothPayments[0].date==='2026-10-31'&&/PNCAA0e-ZN45n/.test(s.boothPayments[0].note)),true);
  chk('1n. nothing owed on any show',L.map(s=>ctx.boothBalance(s)),[0,0,0,0]);
  chk('1o. one booking id links all four',[...new Set(L.map(s=>s.booking&&s.booking.id))],['royale_2027_pkg']);
  chk('1p. booking total $800 on each, internal allocation',L.every(s=>s.booking.total===800&&s.booking.allocation==='internal'),true);
  chk('1q. show keys',L.map(s=>s.booking.showKey),['ROYALE-2027-02-19-ADDISON','ROYALE-2027-02-20-ADDISON','ROYALE-2027-02-26-NAPERVILLE','ROYALE-2027-03-07-NAPERVILLE']);
  chk('1r. notes say pending + allocation not organizer price',L.every(s=>/CONFIRMATION PENDING/.test(s.notes)&&/NOT the organizer/.test(s.notes)),true);
  chk('1s. Day 2 note: no second $500',/NO SECOND \$500/.test(L[1].notes),true);
  chk('1t. Mar 7 note: Mar 8 not bought',/Mar 8 bazaar was NOT bought/.test(L[3].notes),true);
  chk('1u. no em dashes in notes',L.some(s=>/—/.test(s.notes)),false);
  chk('1v. no sales, gas or lodging entered',L.every(s=>!s.lodging&&!(s.showExpenses||[]).length&&s.days[0].morningCount===null),true); }

R.section('2. Paid ahead, not in 2026 profit');
{ const d=blank(); ctx.applyOneTimeUpdates(d); ctx.S=d; const L=find(d);
  chk('2a. each share is paid ahead',L.every(s=>ctx.isPaidAhead(s)),true); }

R.section('3. Reloads never duplicate');
{ const d=blank(); ctx.applyOneTimeUpdates(d); ctx.applyOneTimeUpdates(d);
  delete d._applied['royale_2027_v100']; ctx.applyOneTimeUpdates(d);
  const L=find(d);
  chk('3a. still four shows',L.length,4);
  chk('3b. still $800 total, one payment each',[paid(L),L.map(s=>s.boothPayments.length)],[800,[1,1,1,1]]); }

R.section('4. One typed in by hand on the same date: adopted, not doubled');
{ const d=blank(); const own=ctx.buildPlannedShow({name:'Shalimar bazaar',location:'',startDate:'2027-02-19',numDays:1});
  own.confirmed=false; own.notes='my note'; d.shows.push(own);
  ctx.applyOneTimeUpdates(d); const L=find(d);
  chk('4a. still four shows',L.length,4);
  chk('4b. his name and note kept',[L[0].name,/^my note/.test(L[0].notes)],['Shalimar bazaar',true]);
  chk('4c. share added, blanks filled',[L[0].boothCost,L[0].location,L[0].days[0].closeTime],[235.29,'Addison, IL','02:00']);
  chk('4d. total still $800',paid(L),800); }

R.section('5. $800 already typed in on one show: no shares anywhere');
{ const d=blank(); const own=ctx.buildPlannedShow({name:'Royale Ramadan Bazaar',location:'Addison, IL',startDate:'2027-02-19',numDays:1,boothCost:800,
    boothPayments:[{id:'x',amount:800,date:'2026-10-31',note:'zelle'}]});
  d.shows.push(own); ctx.applyOneTimeUpdates(d); const L=find(d);
  chk('5a. four shows',L.length,4);
  chk('5b. still exactly $800 paid',paid(L),800);
  chk('5c. the three new shows carry no cost or payment',L.slice(1).map(s=>[s.boothCost,s.boothPayments.length]),[[0,0],[0,0],[0,0]]); }

R.section('6. A different show on the same date is left alone');
{ const d=blank(); const other=ctx.buildPlannedShow({name:'Galentine Market',location:'Gurnee, IL',startDate:'2027-02-20',numDays:1,boothCost:100});
  d.shows.push(other); ctx.applyOneTimeUpdates(d);
  chk('6a. other show untouched',[other.name,other.boothCost,other.boothPayments.length,other.notes||''],['Galentine Market',100,0,'']);
  chk('6b. still four Royale shows',find(d).length,4); }

R.done();
