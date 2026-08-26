// Passed / Not Doing state, and the Apply Show Update Package feature.
//
// The invariant this file exists to protect has two halves, and they pull in
// opposite directions, which is exactly why they need a test:
//
//   1. A passed show must be INVISIBLE to every forward-looking surface —
//      Upcoming, all three pipeline buckets and the owed total, deposit
//      alerts, the booth tally's owed/due, booked counts and staffed hours,
//      the calendar, the .ics export, conflict detection, stock transfers.
//   2. A passed show must be COMPLETELY PRESERVED — days, counts, booth
//      payments, notes, rep assignments, and any money already spent still
//      showing up as money spent.
//
// A change that satisfies one half by breaking the other is the failure mode
// here, so most checks below assert both sides of the same fact.
//
// Fixtures are synthetic. See tests/README.md.
'use strict';
const fs=require('fs'), path=require('path');
const {boot,reporter}=require('./harness');
const R=reporter();

const H=boot();
if(H.bootError){ console.log('BOOT FAILED: '+H.bootError.stack); process.exit(1); }
const C=H.ctx;

// ---- fixture builders -------------------------------------------------
// Dates are computed from the app's own _todayKey() so the suite does not rot.
const today=C._todayKey();
function shiftDay(key,n){
  const d=new Date(key+'T12:00:00'); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
const FUTURE=shiftDay(today,60), PAST=shiftDay(today,-60);

function day(n,dateStr){
  return {dayNum:n,date:dateStr||('Day '+n),morningCount:null,eveningCount:null,
    payments:{cash:0,square:0,debit:0,venmo:0,zelle:0,cashapp:0,paypal:0},
    expenses:{gas:0,food:0,parking:0,hotel:0,other:0},repSales:[],repPay:{},notes:'',status:'open'};
}
function show(o){
  return Object.assign({
    id:'sh_'+(o.name||'x').replace(/[^a-z0-9]/gi,'').toLowerCase(),
    name:'Test Show',location:'Somewhere, WI',startDate:FUTURE,numDays:1,dates:['Test'],
    boothCost:0,boothPayments:[],miles:10,repIds:[],repOnlyShow:false,
    status:'planned',confirmed:true,showExpenses:[],days:[day(1)],packedInventory:null
  },o);
}
function state(shows){
  return {v:7,shows:shows,inventory:{},supplies:[],otherExpenses:[],reps:[],
    prices:{},costs:{},settings:{gasPrice:3.2,mpg:17.5,irsRate:0.67,cardTax:0},_applied:{}};
}
function setState(shows){ C.S=state(shows); return C.S; }

// =======================================================================
R.section('1. isPassed / isMissed / isUpcoming');

const plainFuture=show({name:'Plain Future',startDate:FUTURE});
const plainPast=show({name:'Plain Past',startDate:PAST});
setState([plainFuture,plainPast]);

R.check('future planned show is upcoming', C.isUpcoming(plainFuture), true);
R.check('future planned show is not missed', C.isMissed(plainFuture), false);
R.check('past unfinished show is missed', C.isMissed(plainPast), true);
R.check('past unfinished show is not upcoming', C.isUpcoming(plainPast), false);
R.check('neither is passed', [C.isPassed(plainFuture),C.isPassed(plainPast)], [false,false]);

const passedFuture=show({name:'Passed Future',startDate:FUTURE});
const passedPast=show({name:'Passed Past',startDate:PAST});
C.pndMarkPassed(passedFuture,'chose not to','2027','manual');
C.pndMarkPassed(passedPast,'chose not to','2027','manual');
setState([passedFuture,passedPast]);

R.check('passed future show is not upcoming', C.isUpcoming(passedFuture), false);
R.check('passed future show is not missed', C.isMissed(passedFuture), false);
// This is the one that matters most: after the date goes by, a passed show
// must NOT fall through into the Missed tab and get labelled a screw-up.
R.check('passed show whose date passed is STILL not missed', C.isMissed(passedPast), false);
R.check('passed show whose date passed is not upcoming either', C.isUpcoming(passedPast), false);
R.check('isPassed reports both', [C.isPassed(passedFuture),C.isPassed(passedPast)], [true,true]);
R.check('passed is not a truthy-string bug', C.isPassed(show({name:'x',passed:'yes'})), false);

// =======================================================================
R.section('2. History is preserved, and the state is exactly reversible');

const rich=show({name:'Rich Record',startDate:FUTURE,boothCost:450,
  boothPayments:[{amount:100,date:'2026-08-01',note:'deposit'}],
  notes:'important organizer notes',repIds:['rep_a'],
  showExpenses:[{id:'se1',cat:'park',amount:4,desc:'ramp',date:FUTURE}],
  days:[day(1,'Sep 19')]});
const snapshot=JSON.stringify(rich);
C.pndMarkPassed(rich,'Justin decided not to participate in 2026.','2027 cycle','manual');

R.check('booth cost survives', rich.boothCost, 450);
R.check('booth payments survive', rich.boothPayments.length, 1);
R.check('payment amount survives', rich.boothPayments[0].amount, 100);
R.check('notes survive', rich.notes, 'important organizer notes');
R.check('rep assignment survives', rich.repIds, ['rep_a']);
R.check('show expenses survive', rich.showExpenses.length, 1);
R.check('days survive', rich.days.length, 1);
R.check('status is untouched', rich.status, 'planned');
R.check('reason stored', rich.passedReason, 'Justin decided not to participate in 2026.');
R.check('revisit stored', rich.passedRevisit, '2027 cycle');
R.check('passedAt is an ISO timestamp', /^\d{4}-\d{2}-\d{2}T/.test(rich.passedAt), true);
R.check('source recorded', rich.passedSource, 'manual');

C.pndRestore(rich);
R.check('restore removes every field it added, exactly', JSON.stringify(rich), snapshot);
R.check('restore returns false on a show that is not passed', C.pndRestore(rich), false);

const doneShow=show({name:'Done',status:'completed'});
const liveShow=show({name:'Live',status:'active'});
R.check('a completed show cannot be passed', C.pndMarkPassed(doneShow,'x','',''), false);
R.check('an active show cannot be passed', C.pndMarkPassed(liveShow,'x','',''), false);
R.check('refusing to pass leaves no residue', [doneShow.passed,liveShow.passed], [undefined,undefined]);

// =======================================================================
R.section('3. Excluded from active pipeline totals, history intact');

const owePaid=show({name:'Paid Booth',startDate:FUTURE,boothCost:200,
  boothPayments:[{amount:200,date:'2026-08-01',note:''}]});
const oweOwed=show({name:'Owe Booth',startDate:FUTURE,boothCost:300,
  boothPayments:[{amount:50,date:'2026-08-01',note:''}],depositDue:shiftDay(today,5)});
const pending=show({name:'Pending Show',startDate:FUTURE,boothCost:450,confirmed:false});
setState([owePaid,oweOwed,pending]);

let up=C.S.shows.filter(s=>C.isUpcoming(s));
let B=C.pipelineBuckets(up);
R.check('baseline: 3 upcoming', up.length, 3);
R.check('baseline buckets paid/owe/pending', [B.paid.length,B.owe.length,B.pending.length], [1,1,1]);
R.check('baseline owe total', B.oweTotal, 250);
R.check('baseline deposit alert fires', C.depositAlerts(14).length, 1);
let tally=C.calcBoothTally();
R.check('baseline booth owed', tally.owed, 950);
R.check('baseline booth due', tally.due, 700);
R.check('baseline booth paid', tally.paid, 250);

// Pass on the one we still owe money on, and on the pending application.
C.pndMarkPassed(oweOwed,'organizer cancelled','2027','manual');
C.pndMarkPassed(pending,'decided not to participate','2027','manual');

up=C.S.shows.filter(s=>C.isUpcoming(s));
B=C.pipelineBuckets(up);
R.check('passed shows leave Upcoming', up.length, 1);
R.check('passed show leaves the Owe bucket', B.owe.length, 0);
R.check('passed show leaves the Pending bucket', B.pending.length, 0);
R.check('paid bucket keeps the show we are still doing', B.paid.length, 1);
R.check('owe total drops to zero', B.oweTotal, 0);
R.check('deposit alert stops firing for a passed show', C.depositAlerts(14).length, 0);

tally=C.calcBoothTally();
R.check('booth owed excludes passed', tally.owed, 200);
R.check('booth due excludes passed', tally.due, 0);
// The other half of the invariant: the $50 that actually left the account is
// still counted as paid. Dropping it would flatter the books.
R.check('booth PAID still includes money spent on a passed show', tally.paid, 250);
R.check('passed shows are not counted as confirmed bookings', tally.confirmedCnt, 1);

// pipelineBuckets must refuse a passed show even if handed one directly.
R.check('pipelineBuckets is defensive if passed a raw list',
  C.pipelineBuckets(C.S.shows).planned.length, 1);

// =======================================================================
R.section('4. Booked counts, calendar, conflicts, transfers');

setState([owePaid,oweOwed,pending]); // oweOwed + pending are still passed
R.check('booked count excludes passed', C.S.shows.filter(sh=>!C.isMissed(sh)&&!C.isPassed(sh)).length, 1);
R.check('transferable shows exclude passed', C.transferableShows().length, 1);

const clashA=show({name:'Clash A',startDate:FUTURE,id:'sh_a'});
const clashB=show({name:'Clash B',startDate:FUTURE,id:'sh_b'});
setState([clashA,clashB]);
R.check('two shows on one date do conflict', C.showConflicts(clashA).length, 1);
C.pndMarkPassed(clashB,'passed','','manual');
R.check('a passed show no longer creates a conflict', C.showConflicts(clashA).length, 0);
R.check('and the passed show reports no conflicts of its own', C.showConflicts(clashB).length, 0);

// =======================================================================
R.section('5. Package gates: format, version, id, idempotency');

function pkg(ops,id){
  return {format:'bs-show-update-package',version:1,packageId:id||'pkg_test_1',
    description:'test',operations:ops};
}
setState([]);
R.check('wrong format is rejected',
  C.pkgPlan({format:'nope',version:1,packageId:'x',operations:[{op:'markPassed'}]},C.S).errors.length>0, true);
R.check('wrong version is rejected',
  C.pkgPlan({format:'bs-show-update-package',version:99,packageId:'x',operations:[{op:'markPassed'}]},C.S).errors.length>0, true);
R.check('missing packageId is rejected',
  C.pkgPlan({format:'bs-show-update-package',version:1,operations:[{op:'markPassed'}]},C.S).errors.length>0, true);
R.check('empty operations is rejected',
  C.pkgPlan(pkg([]),C.S).errors.length>0, true);
R.check('unknown operation is BLOCKED, not ignored',
  C.pkgPlan(pkg([{op:'deleteEverything'}]),C.S).blockedCount, 1);
R.check('a rejected plan reports changeCount 0, never undefined',
  C.pkgPlan({format:'nope',version:1,packageId:'x',operations:[]},C.S).changeCount, 0);

// pkgPlan() is documented read-only, and the pre-write cloud check depends on
// that being literally true. If merely PREVIEWING a package added a field to
// the state, the local document would no longer match the cloud copy and every
// apply would abort as a false divergence.
setState([show({name:'Untouched',startDate:FUTURE})]);
const preSnap=JSON.stringify(C.S);
C.pkgPlan(pkg([{op:'markPassed',match:{name:'Nope'},reason:'x'}]),C.S);
C.pkgPlan(pkg([{op:'upsertShow',match:{name:'Nope',startDate:FUTURE},show:{boothCost:1}}]),C.S);
R.check('PLANNING MUTATES NOTHING', JSON.stringify(C.S), preSnap);
R.check('and does not create the _pkgApplied map', C.S._pkgApplied, undefined);
R.check('pkgIsApplied works on a state that has no map', C.pkgIsApplied('anything',C.S), false);

// Idempotency marker
setState([]);
C.S._pkgApplied={pkg_test_1:{appliedAt:'2026-08-26T10:00:00.000Z'}};
R.check('an already-applied package is refused', C.pkgPlan(pkg([{op:'markPassed',match:{name:'x'}}]),C.S).ok, false);

// =======================================================================
R.section('6. Package upsert: create, match, no duplicates, no double payments');

const createOp={op:'upsertShow',label:'New Show',
  match:{name:'Brand New Fair',startDate:FUTURE},
  show:{name:'Brand New Fair',location:'Antioch, IL',startDate:FUTURE,numDays:1,
    boothCost:68,miles:33,confirmed:true},
  boothPayments:[{amount:68,date:'2026-08-21',note:'paid in full'}]};

setState([]);
let plan=C.pkgPlan(pkg([createOp]),C.S);
R.check('create is planned as a create', plan.ops[0].action, 'create');
R.check('create plan is applyable', plan.ok, true);
R.check('create plan reports one new record', plan.createCount, 1);

let res=C.pkgExecute(pkg([createOp]),plan,C.S);
R.check('one show now exists', C.S.shows.length, 1);
R.check('execute reports created', res[0].status, 'created');
R.check('booth cost landed', C.S.shows[0].boothCost, 68);
R.check('mileage landed', C.S.shows[0].miles, 33);
R.check('confirmed landed', C.S.shows[0].confirmed, true);
R.check('payment landed once', C.S.shows[0].boothPayments.length, 1);
R.check('days were built', C.S.shows[0].days.length, 1);

// Re-planning must settle: this is the proof every field actually landed.
let after=C.pkgPlan(pkg([createOp]),C.S);
R.check('re-plan finds nothing left to change', after.changeCount, 0);
R.check('re-plan now matches instead of creating', after.ops[0].action, 'update');

// Replay: executing the SAME package again must not duplicate anything.
C.pkgExecute(pkg([createOp]),after,C.S);
R.check('REPLAY does not create a second show', C.S.shows.length, 1);
R.check('REPLAY does not add a second payment', C.S.shows[0].boothPayments.length, 1);

// A payment that differs only in note text is still the same payment.
const reNote={op:'upsertShow',match:{name:'Brand New Fair',startDate:FUTURE},show:{},
  boothPayments:[{amount:68,date:'2026-08-21',note:'completely different wording'}]};
C.pkgExecute(pkg([reNote]),C.pkgPlan(pkg([reNote]),C.S),C.S);
R.check('same money same day is not re-added just because the note changed',
  C.S.shows[0].boothPayments.length, 1);

// A genuinely different payment IS added.
const second={op:'upsertShow',match:{name:'Brand New Fair',startDate:FUTURE},show:{},
  boothPayments:[{amount:25,date:'2026-09-01',note:'later installment'}]};
C.pkgExecute(pkg([second]),C.pkgPlan(pkg([second]),C.S),C.S);
R.check('a genuinely different payment IS added', C.S.shows[0].boothPayments.length, 2);

// =======================================================================
R.section('7. Package matching: normalization, drift, ambiguity');

setState([show({name:'Rustic Fox — Carol Stream (Sep)',startDate:FUTURE,id:'sh_rf'})]);
const emdash={op:'upsertShow',match:{name:'Rustic Fox - Carol Stream (Sep)',startDate:FUTURE},
  show:{boothCost:75}};
plan=C.pkgPlan(pkg([emdash]),C.S);
R.check('an em dash and a hyphen are the same show', plan.ops[0].action, 'update');
R.check('and it matched the right record', plan.ops[0].target.id, 'sh_rf');

const drift={op:'upsertShow',match:{name:'Rustic Fox — Carol Stream (Sep)',startDate:'2026-01-01'},
  show:{boothCost:75}};
plan=C.pkgPlan(pkg([drift]),C.S);
R.check('a date mismatch still matches on unique name', plan.ops[0].action, 'update');
R.check('but it is reported as date drift',
  /DATE DRIFT/.test(plan.ops[0].notes.join(' ')), true);

setState([show({name:'Twin Fair',startDate:FUTURE,id:'sh_t1'}),
          show({name:'Twin Fair',startDate:shiftDay(today,90),id:'sh_t2'})]);
plan=C.pkgPlan(pkg([{op:'upsertShow',match:{name:'Twin Fair',startDate:'2026-01-01'},show:{boothCost:1}}]),C.S);
R.check('two same-name candidates BLOCK rather than guess', plan.ops[0].blocked, true);
R.check('and the whole package is not applyable', plan.ok, false);
R.check('ambiguity is explained', /AMBIGUOUS/.test(plan.ops[0].notes.join(' ')), true);

// =======================================================================
R.section('8. Package markPassed: sweep protection and skips');

setState([
  show({name:'Sip & Sleigh — Carol Stream',startDate:FUTURE,id:'sh_ss1'}),
  show({name:'Sip & Sleigh — North Aurora',startDate:FUTURE,id:'sh_ss2'}),
  show({name:'Kris Kringle — Carol Stream',startDate:FUTURE,id:'sh_kk1'}),
  show({name:'Kris Kringle — North Aurora',startDate:FUTURE,id:'sh_kk2'}),
  show({name:'Cranberry Fest',startDate:FUTURE,id:'sh_cf'})
]);
const sweep={op:'markPassed',label:'holiday series',
  match:{nameContains:['sip sleigh','sip shop','kris kringle']},
  expectMax:6,reason:'Organizer canceled the 2026 holiday pop-up series.',revisit:'2027'};
plan=C.pkgPlan(pkg([sweep]),C.S);
R.check('the sweep matches exactly the four holiday shows', plan.ops[0].changes.length, 4);
R.check('and leaves the unrelated show alone',
  plan.ops[0].targets.some(t=>t.id==='sh_cf'), false);

C.pkgExecute(pkg([sweep]),plan,C.S);
R.check('four are now passed', C.S.shows.filter(s=>C.isPassed(s)).length, 4);
R.check('the unrelated show is untouched', C.isPassed(C.S.shows.find(s=>s.id==='sh_cf')), false);
R.check('the reason was recorded', C.S.shows[0].passedReason, 'Organizer canceled the 2026 holiday pop-up series.');
R.check('the revisit field was recorded', C.S.shows[0].passedRevisit, '2027');
R.check('the package id is recorded as the source', C.S.shows[0].passedSource, 'pkg_test_1');
R.check('re-plan settles after the sweep', C.pkgPlan(pkg([sweep]),C.S).changeCount, 0);

// expectMax is the guard against a rule that turns out to be too broad.
setState([
  show({name:'Kris Kringle A',startDate:FUTURE,id:'k1'}),
  show({name:'Kris Kringle B',startDate:FUTURE,id:'k2'}),
  show({name:'Kris Kringle C',startDate:FUTURE,id:'k3'})
]);
plan=C.pkgPlan(pkg([{op:'markPassed',match:{nameContains:['kris kringle']},expectMax:2,reason:'x'}]),C.S);
R.check('too many matches BLOCKS the operation', plan.ops[0].blocked, true);
R.check('too many matches makes the package unapplyable', plan.ok, false);
R.check('nothing was changed by planning', C.S.shows.filter(s=>C.isPassed(s)).length, 0);

// A show that was actually worked is history, not a decision.
setState([show({name:'Worked Show',startDate:PAST,status:'completed',id:'w1'})]);
plan=C.pkgPlan(pkg([{op:'markPassed',match:{name:'Worked Show',startDate:PAST},reason:'x'}]),C.S);
C.pkgExecute(pkg([{op:'markPassed',match:{name:'Worked Show',startDate:PAST},reason:'x'}]),plan,C.S);
R.check('a completed show is never marked passed by a package', C.isPassed(C.S.shows[0]), false);
R.check('and the skip is explained in the preview', /SKIPPED/.test(plan.ops[0].notes.join(' ')), true);

// An unmatched markPassed is a note, not a failure — the show may simply
// never have existed on this device.
setState([]);
plan=C.pkgPlan(pkg([{op:'markPassed',match:{name:'Never Existed',startDate:FUTURE},reason:'x'}]),C.S);
R.check('an unmatched markPassed does not block the package', plan.ops[0].blocked, false);
R.check('and says so plainly', /UNMATCHED/.test(plan.ops[0].notes.join(' ')), true);

// =======================================================================
R.section('8b. Identifying evidence — a name is not proof of whose show it is');

// "Kris Kringle" is a generic Christmas-market name. One organizer's
// cancellation notice must never be able to reach another organizer's
// identically-named show, and expectMax cannot help: it caps quantity, not
// ownership. This is the negative test that proves it.
setState([
  show({name:'Kris Kringle — North Aurora',startDate:FUTURE,id:'rf1',location:'North Aurora, IL'}),
  show({name:'Kris Kringle Christmas Market',startDate:FUTURE,id:'other1',
    location:'Oconomowoc, WI',notes:'Run by the Oconomowoc Chamber. Nothing to do with The Rustic Fox.'})
]);
const evOp={op:'markPassed',label:'RF cancellation',
  match:{nameContains:['kris kringle'],requiredEvidenceAny:['north aurora','rustic fox']},
  expectMax:3,reason:'Organizer canceled the 2026 holiday pop-up series.'};
plan=C.pkgPlan(pkg([evOp]),C.S);
R.check('only the Rustic Fox record is targeted', plan.ops[0].changes.length, 1);
R.check('the unrelated organizer is NOT targeted',
  plan.ops[0].targets.some(t=>t.id==='other1'), false);
R.check('and the preview names the record it deliberately left alone',
  /NOT TOUCHED .*Oconomowoc|NOT TOUCHED \(name matched/.test(plan.ops[0].notes.join(' ')), true);
C.pkgExecute(pkg([evOp]),plan,C.S);
R.check('THE UNRELATED KRIS KRINGLE SHOW IS COMPLETELY UNTOUCHED',
  C.isPassed(C.S.shows.find(s=>s.id==='other1')), false);
R.check('and it is still upcoming', C.isUpcoming(C.S.shows.find(s=>s.id==='other1')), true);
R.check('the Rustic Fox one was passed', C.isPassed(C.S.shows.find(s=>s.id==='rf1')), true);

// Evidence may live in location OR organizer — the organizer name alone is
// enough when the town is not on the record.
setState([show({name:'Kris Kringle Market',startDate:FUTURE,id:'byOrg',location:'Somewhere, IL',
  organizer:'The Rustic Fox'})]);
plan=C.pkgPlan(pkg([evOp]),C.S);
R.check('evidence found in the organizer field', plan.ops[0].changes.length, 1);

// NOTES ARE NOT EVIDENCE, and this is the check that proves why. Prose
// negates: a note saying the show has nothing to do with The Rustic Fox
// contains the string "rustic fox" and would satisfy a substring test exactly
// as well as one saying it IS a Rustic Fox show. Searching notes would sweep
// up the unrelated show this whole constraint exists to protect.
setState([show({name:'Kris Kringle Market',startDate:FUTURE,id:'byNote',location:'Oconomowoc, WI',
  notes:'Run by the Oconomowoc Chamber. Nothing to do with The Rustic Fox.'})]);
plan=C.pkgPlan(pkg([evOp]),C.S);
R.check('a NEGATING note is not treated as evidence', plan.ops[0].changes.length, 0);
setState([show({name:'Kris Kringle Market',startDate:FUTURE,id:'byNote2',location:'Somewhere, IL',
  notes:'Booked through The Rustic Fox as usual.'})]);
plan=C.pkgPlan(pkg([evOp]),C.S);
R.check('and a CONFIRMING note is not evidence either — notes are never read',
  plan.ops[0].changes.length, 0);

// With NO evidence anywhere, nothing is targeted at all.
setState([show({name:'Kris Kringle Market',startDate:FUTURE,id:'noEv',location:'Somewhere, IL'})]);
plan=C.pkgPlan(pkg([evOp]),C.S);
R.check('a name-only match with no evidence targets nothing', plan.ops[0].changes.length, 0);
R.check('and it does not block the package either', plan.ops[0].blocked, false);

// The evidence rule also guards single-record selectors, and there it fails
// CLOSED: refusing to create a near-duplicate beside a record it would not touch.
setState([show({name:'Party on the Pavement',startDate:'2026-09-19',id:'popX',location:'Somewhere Else, IA'})]);
plan=C.pkgPlan(pkg([{op:'upsertShow',
  match:{name:'Party on the Pavement',startDate:'2026-09-19',requiredEvidenceAny:['racine']},
  show:{boothCost:450}}]),C.S);
R.check('an upsert whose only name match fails the evidence test is BLOCKED',
  plan.ops[0].blocked, true);
R.check('it does not silently create a second record',
  /refusing to create/.test(plan.ops[0].notes.join(' ')), true);

// =======================================================================
R.section('8c. The apply gate — signed out, offline, unsynced');

// pkgGate() is the single source of truth for "can this reach the account".
// pkgApply() re-tests it itself: a disabled button is a courtesy, never the
// enforcement.
function gateWith(user,online,sync){
  C.ctxSetGate?C.ctxSetGate():null;
  C.sb=user?{}:null;
  C._cloudUser=user;
  C.navigator.onLine=online;
  C._syncState=sync;
  return C.pkgGate();
}
R.check('signed out fails the gate', gateWith(null,true,'synced').ok, false);
R.check('and says why', /not signed in/i.test(gateWith(null,true,'synced').reasons.join(' ')), true);
R.check('offline fails the gate', gateWith({id:'u1'},false,'synced').ok, false);
R.check('and says why', /offline/i.test(gateWith({id:'u1'},false,'synced').reasons.join(' ')), true);
R.check('not-synced fails the gate', gateWith({id:'u1'},true,'syncing').ok, false);
R.check('and says why', /not fully synced/i.test(gateWith({id:'u1'},true,'syncing').reasons.join(' ')), true);
R.check('sync error fails the gate', gateWith({id:'u1'},true,'error').ok, false);
R.check('signed out AND offline reports BOTH reasons', gateWith(null,false,'off').reasons.length>=3, true);
R.check('signed in, online and synced passes', gateWith({id:'u1'},true,'synced').ok, true);

// =======================================================================
R.section('8d. Cloud divergence is detected before anything is written');

const localDoc={_updatedAt:'2026-08-26T10:00:00.000Z',shows:[show({name:'A',id:'a'})]};
R.check('no cloud row yet is not divergence', C.pkgCloudDivergence(null,localDoc), null);
R.check('an identical cloud copy is not divergence',
  C.pkgCloudDivergence(JSON.parse(JSON.stringify(localDoc)),localDoc), null);
const newerCloud=JSON.parse(JSON.stringify(localDoc)); newerCloud._updatedAt='2026-08-26T11:00:00.000Z';
R.check('a NEWER cloud copy is divergence', /NEWER/.test(C.pkgCloudDivergence(newerCloud,localDoc)||''), true);
// The case _updatedAt cannot catch: same timestamp, different content.
const sneaky=JSON.parse(JSON.stringify(localDoc)); sneaky.shows.push(show({name:'B',id:'b'}));
R.check('same timestamp but different content is still divergence',
  /differs/.test(C.pkgCloudDivergence(sneaky,localDoc)||''), true);
// Key order must NOT count as a difference — Supabase reorders jsonb keys.
const reordered={shows:JSON.parse(JSON.stringify(localDoc.shows)),_updatedAt:localDoc._updatedAt};
R.check('a key-reordered cloud copy is NOT divergence',
  C.pkgCloudDivergence(reordered,localDoc), null);

// =======================================================================
R.section('8e. Cloud verification reads the server back, and fails honestly');

const vPkg=pkg([{op:'upsertShow',label:'V',
  match:{name:'Verify Me',startDate:FUTURE},
  show:{name:'Verify Me',startDate:FUTURE,numDays:1,boothCost:10},
  boothPayments:[{amount:10,date:'2026-08-21',note:'paid'}]}],'pkg_verify_1');
setState([]);
let vPlan=C.pkgPlan(vPkg,C.S);
C.pkgExecute(vPkg,vPlan,C.S);
C.pkgAppliedEnsure(C.S)['pkg_verify_1']={appliedAt:'2026-08-26T12:00:00.000Z'};
const goodCloud=JSON.parse(JSON.stringify(C.S));

R.check('a cloud copy that really has the change verifies',
  C.pkgVerifyCloud(vPkg,goodCloud,null).ok, true);
R.check('a MISSING cloud read never verifies',
  C.pkgVerifyCloud(vPkg,null,null).ok, false);
R.check('and says the write is unverified',
  /UNVERIFIED/.test(C.pkgVerifyCloud(vPkg,null,null).note), true);

// The cloud accepted the write but the marker is absent: not verified.
const noMarker=JSON.parse(JSON.stringify(goodCloud)); delete noMarker._pkgApplied;
R.check('a cloud copy missing the package id does NOT verify',
  C.pkgVerifyCloud(vPkg,noMarker,null).ok, false);
// The marker is there but the records never landed: not verified. This is the
// exact shape of a partial write, and the one a naive check would pass.
const markerOnly={_updatedAt:goodCloud._updatedAt,shows:[],_pkgApplied:goodCloud._pkgApplied};
R.check('marker present but records missing does NOT verify',
  C.pkgVerifyCloud(vPkg,markerOnly,null).ok, false);
// The record is there but its payment is not.
const noPmt=JSON.parse(JSON.stringify(goodCloud));
noPmt.shows[0].boothPayments=[];
R.check('a record present without its payment does NOT verify',
  C.pkgVerifyCloud(vPkg,noPmt,null).ok, false);
// A duplicated payment in the cloud is a failure, not a pass.
const dupPmt=JSON.parse(JSON.stringify(goodCloud));
dupPmt.shows[0].boothPayments.push({amount:10,date:'2026-08-21',note:'paid again'});
R.check('a DUPLICATED payment in the cloud does NOT verify',
  C.pkgVerifyCloud(vPkg,dupPmt,null).ok, false);

// The Wonderful World of Weddings invariant, checked against the cloud copy.
const wwwState={shows:[show({name:'Wonderful World of Weddings',id:'w',boothCost:1087.80,
  boothPayments:[{amount:250,date:'2026-08-18',note:'Deposit paid'}]})]};
const wwwSnap=C.pkgWwwSnapshot(wwwState);
const wwwCloudSame=JSON.parse(JSON.stringify(wwwState));
wwwCloudSame._pkgApplied={pkg_verify_1:{appliedAt:'x'}};
R.check('WWW unchanged in the cloud passes its check',
  C.pkgVerifyCloud(pkg([],'pkg_verify_1'),wwwCloudSame,wwwSnap).checks
    .filter(c=>/Wonderful World/.test(c.name)).every(c=>c.ok), true);
const wwwCloudChanged=JSON.parse(JSON.stringify(wwwCloudSame));
wwwCloudChanged.shows[0].boothCost=999;
R.check('WWW ALTERED in the cloud fails its check',
  C.pkgVerifyCloud(pkg([],'pkg_verify_1'),wwwCloudChanged,wwwSnap).checks
    .filter(c=>/Wonderful World/.test(c.name)).every(c=>c.ok), false);
const wwwCloudGone=JSON.parse(JSON.stringify(wwwCloudSame)); wwwCloudGone.shows=[];
R.check('WWW MISSING from the cloud fails its check',
  C.pkgVerifyCloud(pkg([],'pkg_verify_1'),wwwCloudGone,wwwSnap).checks
    .filter(c=>/Wonderful World/.test(c.name)).every(c=>c.ok), false);

// =======================================================================
R.section('9. The real shipped package plans correctly against a synthetic board');

const PKG=JSON.parse(fs.readFileSync(path.join(__dirname,'..','packages','2026-08-26-show-sync.json'),'utf8'));
R.check('shipped package declares the right format', PKG.format, 'bs-show-update-package');
R.check('shipped package declares version 1', PKG.version, 1);
R.check('shipped package has six operations', PKG.operations.length, 6);
// Every markPassed in the shipped package must prove whose show it is.
R.check('EVERY markPassed carries identifying evidence',
  PKG.operations.filter(o=>o.op==='markPassed')
    .every(o=>((o.match||{}).requiredEvidenceAny||[]).length>0), true);

// A synthetic board shaped like the real one: the two new shows absent, Party
// on the Pavement pending, the four Rustic Fox holiday shows present — plus an
// unrelated Kris Kringle run by someone else, which must survive untouched.
setState([
  show({name:'Party on the Pavement',startDate:'2026-09-19',id:'sh_pop',confirmed:false,boothCost:450,depositDue:'2026-08-22',location:'Racine, WI'}),
  show({name:'Sip & Sleigh — Carol Stream',startDate:'2026-11-07',id:'sh_ss1',location:'Carol Stream, IL'}),
  show({name:'Sip & Sleigh — North Aurora',startDate:'2026-11-20',id:'sh_ss2',location:'North Aurora, IL'}),
  show({name:'Kris Kringle — Carol Stream',startDate:'2026-12-04',id:'sh_kk1',location:'Carol Stream, IL'}),
  show({name:'Kris Kringle — North Aurora',startDate:'2026-12-12',id:'sh_kk2',location:'North Aurora, IL'}),
  show({name:'Kris Kringle Christmas Market',startDate:'2026-12-05',id:'sh_other',
    location:'Oconomowoc, WI',organizer:'Oconomowoc Chamber of Commerce',
    notes:'Unrelated to The Rustic Fox — the note deliberately names them, to prove notes are not read as evidence.'}),
  show({name:'Cranberry Fest',startDate:'2026-09-25',id:'sh_cf',location:'Warrens, WI'}),
  show({name:'Wonderful World of Weddings',startDate:'2027-01-30',id:'sh_www',boothCost:1087.80,
    location:'West Allis, WI',
    boothPayments:[{amount:250,date:'2026-08-18',note:'Deposit paid'}],depositDue:'2026-09-30'})
]);
plan=C.pkgPlan(PKG,C.S);
R.check('shipped package plans cleanly', plan.ok, true);
R.check('nothing in it is blocked', plan.blockedCount, 0);
R.check('it creates exactly three shows', plan.createCount, 3);
const popOp=plan.ops.find(o=>/Pavement/.test(o.label));
R.check('Party on the Pavement is a markPassed', popOp.action, 'markPassed');
R.check('and matches exactly one record', popOp.changes.length, 1);
const rfNA=plan.ops.find(o=>/North Aurora\)/.test(o.label));
const rfCS=plan.ops.find(o=>/Carol Stream\)/.test(o.label));
R.check('the North Aurora operation matches two records', rfNA.changes.length, 2);
R.check('the Carol Stream operation matches two records', rfCS.changes.length, 2);
R.check('neither sweep touches Cranberry Fest',
  rfNA.targets.concat(rfCS.targets).some(t=>t.id==='sh_cf'), false);
R.check('neither sweep touches Wonderful World of Weddings',
  rfNA.targets.concat(rfCS.targets).some(t=>t.id==='sh_www'), false);
R.check('NEITHER SWEEP TOUCHES THE UNRELATED KRIS KRINGLE',
  rfNA.targets.concat(rfCS.targets).some(t=>t.id==='sh_other'), false);
R.check('and the preview reports it as deliberately left alone',
  /NOT TOUCHED/.test(rfNA.notes.concat(rfCS.notes).join(' ')), true);

const wwwBefore=JSON.stringify(C.S.shows.find(s=>s.id==='sh_www'));
const otherBefore=JSON.stringify(C.S.shows.find(s=>s.id==='sh_other'));
C.pkgExecute(PKG,plan,C.S);
R.check('board grew from 8 to 11 shows', C.S.shows.length, 11);
R.check('Wonderful World of Weddings is byte-for-byte untouched',
  JSON.stringify(C.S.shows.find(s=>s.id==='sh_www')), wwwBefore);
R.check('THE UNRELATED KRIS KRINGLE IS BYTE-FOR-BYTE UNTOUCHED',
  JSON.stringify(C.S.shows.find(s=>s.id==='sh_other')), otherBefore);
R.check('and it is still upcoming', C.isUpcoming(C.S.shows.find(s=>s.id==='sh_other')), true);
R.check('Party on the Pavement is passed', C.isPassed(C.S.shows.find(s=>s.id==='sh_pop')), true);
R.check('Party on the Pavement is NOT missed', C.isMissed(C.S.shows.find(s=>s.id==='sh_pop')), false);
R.check('Party on the Pavement keeps its booth cost', C.S.shows.find(s=>s.id==='sh_pop').boothCost, 450);
R.check('five shows are now passed', C.S.shows.filter(s=>C.isPassed(s)).length, 5);
R.check('Cranberry Fest is still upcoming', C.isUpcoming(C.S.shows.find(s=>s.id==='sh_cf')), true);

const fling=C.S.shows.find(s=>/Last Fling/.test(s.name));
R.check('The Last Fling was created', !!fling, true);
R.check('The Last Fling booth cost', fling.boothCost, 68);
R.check('The Last Fling paid in full', C.boothPaid(fling), 68);
R.check('The Last Fling has zero balance', C.boothBalance(fling), 0);
R.check('The Last Fling is confirmed', fling.confirmed, true);
R.check('The Last Fling mileage', fling.miles, 33);

const mm=C.S.shows.find(s=>/Mistletoe/.test(s.name));
R.check('Mistletoe & Martinis was created', !!mm, true);
R.check('Mistletoe & Martinis booth cost', mm.boothCost, 100);
R.check('Mistletoe & Martinis paid in full', C.boothPaid(mm), 100);
R.check('Mistletoe & Martinis date', mm.startDate, '2026-11-27');

const rfNew=C.S.shows.find(s=>/Rustic Fox Holiday Market/.test(s.name));
R.check('the replacement Rustic Fox market was created', !!rfNew, true);
R.check('replacement booth cost', rfNew.boothCost, 100);
R.check('replacement paid in full', C.boothPaid(rfNew), 100);
R.check('replacement is upcoming', C.isUpcoming(rfNew), true);
R.check('replacement is not passed', C.isPassed(rfNew), false);

R.check('re-planning the shipped package settles to nothing', C.pkgPlan(PKG,C.S).changeCount, 0);
C.pkgExecute(PKG,C.pkgPlan(PKG,C.S),C.S);
R.check('REPLAYING the shipped package creates no duplicates', C.S.shows.length, 11);
R.check('REPLAY adds no duplicate payments',
  [C.boothPaid(C.S.shows.find(s=>/Last Fling/.test(s.name))),
   C.boothPaid(C.S.shows.find(s=>/Mistletoe/.test(s.name)))], [68,100]);

// The three new shows must be real bookings on every forward-looking surface.
const upNow=C.S.shows.filter(s=>C.isUpcoming(s));
// Six: the three new bookings, Cranberry Fest, Wonderful World of Weddings,
// and the unrelated Kris Kringle that was correctly left alone.
R.check('six shows upcoming after the sync', upNow.length, 6);
const bk=C.pipelineBuckets(upNow);
R.check('three of them sit in Booth Paid', bk.paid.length, 3);
R.check('and they are the three we just booked',
  bk.paid.map(s=>s.name).sort(),
  ['Mistletoe & Martinis','The Last Fling','The Rustic Fox Holiday Market (Holiday Weekend)']);
R.check('all three new bookings owe nothing',
  [C.boothBalance(fling),C.boothBalance(mm),C.boothBalance(rfNew)], [0,0,0]);
// Wonderful World of Weddings was explicitly left alone, so its real remaining
// balance must still be the ONLY thing in the Owe bucket. A sync that quietly
// zeroed it would be a far worse bug than one that failed to add a show.
R.check('only Wonderful World of Weddings still owes', bk.owe.length, 1);
R.check('and the owed total is exactly its remaining balance', bk.oweTotal, 837.8);
R.check('nothing is left in Pending / Applied', bk.pending.length, 0);
R.check('no passed show reached any bucket',
  bk.planned.filter(s=>C.isPassed(s)).length, 0);


// =======================================================================
R.section('10. v2 package: update the existing Last Fling, never duplicate it');

// The failure this section exists to prevent, in full: on 2026-08-26 the live
// cloud held "The Last Fling Artisan Market" on 2026-08-30 at Valley Ridge Golf
// Course. The v1 package matched on exact normalized name + startDate against
// the name "The Last Fling". Those two names are not equal, so the match
// missed, the operation fell through to CREATE, and it would have put a second
// record on the same day at the same venue.
//
// v2 matches on nameContains + startDate + location evidence, all three of
// which must agree. Everything below asserts one of the two halves: the real
// record IS found and updated, and anything that is not that record is NOT.

const PKG2=JSON.parse(fs.readFileSync(path.join(__dirname,'..','packages','2026-08-26-show-sync-v2.json'),'utf8'));
R.check('v2 declares the right format', PKG2.format, 'bs-show-update-package');
R.check('v2 has a distinct package id', PKG2.packageId, 'pkg_2026-08-26_show-sync_v2');
R.check('v2 id ends in _v2', /_v2$/.test(PKG2.packageId), true);
R.check('v2 is not the v1 id', PKG2.packageId===PKG.packageId, false);
R.check('v2 records what it supersedes', PKG2.supersedes, 'pkg_2026-08-26_show-sync_v1');
R.check('v2 preserves all six operations', PKG2.operations.length, 6);
const fl2=PKG2.operations[0];
R.check('the Last Fling op matches on a name fragment', fl2.match.nameContains, ['last fling']);
R.check('...AND on the exact start date', fl2.match.startDate, '2026-08-30');
R.check('...AND on location evidence', fl2.match.requiredEvidenceAny, ['valley ridge','antioch']);
R.check('it will not rename the live record', fl2.keepExistingName, true);
R.check('and carries no name to write', fl2.show.name, undefined);
R.check('every markPassed still carries evidence',
  PKG2.operations.filter(o=>o.op==='markPassed')
    .every(o=>((o.match||{}).requiredEvidenceAny||[]).length>0), true);

// ---- the realistic board: what the cloud actually holds ----
function realBoard(){
  return [
    show({name:'The Last Fling Artisan Market',startDate:'2026-08-30',id:'sh_fling',
      location:'Valley Ridge Golf Course, Antioch, IL',boothCost:0,confirmed:false}),
    show({name:'Party on the Pavement',startDate:'2026-09-19',id:'sh_pop',confirmed:false,
      boothCost:450,depositDue:'2026-08-22',location:'Racine, WI'}),
    show({name:'Sip & Sleigh — Carol Stream',startDate:'2026-11-07',id:'sh_ss1',location:'Carol Stream, IL'}),
    show({name:'Sip & Sleigh — North Aurora',startDate:'2026-11-20',id:'sh_ss2',location:'North Aurora, IL'}),
    show({name:'Kris Kringle — Carol Stream',startDate:'2026-12-04',id:'sh_kk1',location:'Carol Stream, IL'}),
    show({name:'Kris Kringle — North Aurora',startDate:'2026-12-12',id:'sh_kk2',location:'North Aurora, IL'}),
    show({name:'Kris Kringle Christmas Market',startDate:'2026-12-05',id:'sh_other',
      location:'Oconomowoc, WI',organizer:'Oconomowoc Chamber',
      notes:'Unrelated to The Rustic Fox — the note names them on purpose, to prove notes are not evidence.'}),
    show({name:'Cranberry Fest',startDate:'2026-09-25',id:'sh_cf',location:'Warrens, WI'}),
    show({name:'Wonderful World of Weddings',startDate:'2027-01-30',id:'sh_www',boothCost:1087.80,
      location:'West Allis, WI',boothPayments:[{amount:250,date:'2026-08-18',note:'Deposit paid'}],
      depositDue:'2026-09-30'})
  ];
}

// ---- v1 against the real board: the bug was real ----
setState(realBoard());
const v1plan=C.pkgPlan(PKG,C.S);
const v1fling=v1plan.ops.find(o=>/Last Fling/.test(o.label));
R.check('v1 would NOT have matched the live record', v1fling.action!=='update', true);
// With the near-duplicate guard now in place v1 is stopped rather than
// duplicating — but its selector still never finds the record, which is the
// underlying defect v2 fixes.
R.check('v1 is now blocked instead of duplicating', v1fling.blocked, true);
R.check('and the block explains it would duplicate',
  /WOULD DUPLICATE/.test(v1fling.notes.join(' ')), true);

// ---- v2 against the real board ----
setState(realBoard());
const before2=C.S.shows.length;
let p2=C.pkgPlan(PKG2,C.S);
R.check('v2 plans cleanly', p2.ok, true);
R.check('v2 blocks nothing', p2.blockedCount, 0);
R.check('v2 creates exactly TWO records, not three', p2.createCount, 2);
const f2=p2.ops.find(o=>/Last Fling/.test(o.label));
R.check('the Last Fling op is an UPDATE', f2.action, 'update');
R.check('and it targets the existing record', f2.target.id, 'sh_fling');
R.check('matched by fragment + date + evidence',
  /name contains.*last fling.*starts exactly 2026-08-30.*valley ridge/.test(f2.how), true);
R.check('the update does not touch the name',
  f2.changes.some(c=>c.field==='name'), false);

const wwwBefore2=JSON.stringify(C.S.shows.find(s=>s.id==='sh_www'));
const otherBefore2=JSON.stringify(C.S.shows.find(s=>s.id==='sh_other'));
C.pkgExecute(PKG2,p2,C.S);

R.check('NO DUPLICATE: board grew by exactly 2', C.S.shows.length, before2+2);
R.check('exactly one Last Fling record exists',
  C.S.shows.filter(s=>/last fling/i.test(s.name)).length, 1);
const flingRec=C.S.shows.find(s=>/last fling/i.test(s.name));
R.check('it is the SAME record, by id', flingRec.id, 'sh_fling');
R.check('its name was preserved, not overwritten', flingRec.name, 'The Last Fling Artisan Market');
R.check('booth cost was applied', flingRec.boothCost, 68);
R.check('mileage was applied', flingRec.miles, 33);
R.check('it is now confirmed', flingRec.confirmed, true);
R.check('the payment landed once', flingRec.boothPayments.length, 1);
R.check('and it is paid in full', C.boothBalance(flingRec), 0);
R.check('hours were applied', [flingRec.openTime,flingRec.closeTime], ['12:00','16:00']);

R.check('Mistletoe & Martinis was created once',
  C.S.shows.filter(s=>/Mistletoe/.test(s.name)).length, 1);
const mm2=C.S.shows.find(s=>/Mistletoe/.test(s.name));
R.check('Mistletoe paid in full', [mm2.boothCost,C.boothPaid(mm2)], [100,100]);
R.check('Party on the Pavement is passed', C.isPassed(C.S.shows.find(s=>s.id==='sh_pop')), true);
R.check('and NOT missed', C.isMissed(C.S.shows.find(s=>s.id==='sh_pop')), false);
R.check('exactly four Rustic Fox records passed',
  ['sh_ss1','sh_ss2','sh_kk1','sh_kk2'].filter(id=>C.isPassed(C.S.shows.find(s=>s.id===id))).length, 4);
R.check('five records passed in total', C.S.shows.filter(s=>C.isPassed(s)).length, 5);
R.check('the replacement Rustic Fox market was created once',
  C.S.shows.filter(s=>/Rustic Fox Holiday Market/.test(s.name)).length, 1);
R.check('Wonderful World of Weddings is byte-for-byte unchanged',
  JSON.stringify(C.S.shows.find(s=>s.id==='sh_www')), wwwBefore2);
R.check('the unrelated Kris Kringle is byte-for-byte unchanged',
  JSON.stringify(C.S.shows.find(s=>s.id==='sh_other')), otherBefore2);
R.check('Cranberry Fest is still upcoming', C.isUpcoming(C.S.shows.find(s=>s.id==='sh_cf')), true);

// ---- reapply: zero additional changes ----
R.check('RE-PLANNING v2 FINDS NOTHING LEFT TO DO', C.pkgPlan(PKG2,C.S).changeCount, 0);
const afterFirst=JSON.stringify(C.S);
C.pkgExecute(PKG2,C.pkgPlan(PKG2,C.S),C.S);
R.check('REAPPLYING v2 CHANGES THE STATE NOT AT ALL', JSON.stringify(C.S), afterFirst);
R.check('still exactly one Last Fling',
  C.S.shows.filter(s=>/last fling/i.test(s.name)).length, 1);
R.check('still one payment on it',
  C.S.shows.find(s=>/last fling/i.test(s.name)).boothPayments.length, 1);

// ---- a DIFFERENT Last Fling must be left completely alone ----
// Same fragment, wrong date.
setState([show({name:'The Last Fling Artisan Market',startDate:'2027-08-29',id:'wrongYear',
  location:'Valley Ridge Golf Course, Antioch, IL'})]);
p2=C.pkgPlan(PKG2,C.S);
let fw=p2.ops.find(o=>/Last Fling/.test(o.label));
R.check('a Last Fling on ANOTHER DATE is not updated', fw.action!=='update', true);
R.check('and it is reported as considered-and-skipped',
  /NOT TOUCHED/.test(fw.notes.join(' ')), true);
C.pkgExecute(PKG2,p2,C.S);
R.check('the wrong-year record is untouched', C.S.shows.find(s=>s.id==='wrongYear').boothCost, 0);

// Same fragment, same date, wrong venue.
setState([show({name:'The Last Fling Street Fair',startDate:'2026-08-30',id:'wrongPlace',
  location:'Naperville, IL',organizer:'Naperville Jaycees'})]);
p2=C.pkgPlan(PKG2,C.S);
fw=p2.ops.find(o=>/Last Fling/.test(o.label));
R.check('a Last Fling at ANOTHER VENUE is not updated', fw.action!=='update', true);
R.check('and the evidence miss is explained',
  /NOT TOUCHED/.test(fw.notes.join(' ')), true);
const wpBefore=JSON.stringify(C.S.shows.find(s=>s.id==='wrongPlace'));
C.pkgExecute(PKG2,p2,C.S);
R.check('the other organizer Last Fling is byte-for-byte untouched',
  JSON.stringify(C.S.shows.find(s=>s.id==='wrongPlace')), wpBefore);

// Both decoys present alongside the real one: only the real one moves.
setState(realBoard().concat([
  show({name:'The Last Fling Artisan Market',startDate:'2027-08-29',id:'wrongYear',
    location:'Valley Ridge Golf Course, Antioch, IL'}),
  show({name:'The Last Fling Street Fair',startDate:'2026-08-30',id:'wrongPlace',
    location:'Naperville, IL',organizer:'Naperville Jaycees'})
]));
p2=C.pkgPlan(PKG2,C.S);
fw=p2.ops.find(o=>/Last Fling/.test(o.label));
R.check('with three Last Flings on the board it still updates', fw.action, 'update');
R.check('and that one is the right record', fw.target.id, 'sh_fling');
R.check('v2 still plans cleanly with the decoys present', p2.ok, true);
C.pkgExecute(PKG2,p2,C.S);
R.check('decoy: wrong year untouched', C.S.shows.find(s=>s.id==='wrongYear').boothCost, 0);
R.check('decoy: wrong venue untouched', C.S.shows.find(s=>s.id==='wrongPlace').boothCost, 0);
R.check('the real record was updated', C.S.shows.find(s=>s.id==='sh_fling').boothCost, 68);

// =======================================================================
R.section('11. Near-duplicate and multi-match guards');

// The guard that would have caught v1 on its own, independent of any package.
setState([show({name:'The Last Fling Artisan Market',startDate:'2026-08-30',id:'a',
  location:'Valley Ridge Golf Course, Antioch, IL'})]);
R.check('a shorter name on the same date is a near-duplicate',
  C.pkgNearDuplicates(C.S,'The Last Fling','2026-08-30').length, 1);
R.check('a longer name on the same date is too',
  C.pkgNearDuplicates(C.S,'The Last Fling Artisan Market 2026','2026-08-30').length, 1);
R.check('the SAME date is required — a different date is not a duplicate',
  C.pkgNearDuplicates(C.S,'The Last Fling','2026-08-31').length, 0);
R.check('an unrelated name on the same date is not a duplicate',
  C.pkgNearDuplicates(C.S,'Cranberry Fest','2026-08-30').length, 0);
R.check('a missing date never reports a duplicate',
  C.pkgNearDuplicates(C.S,'The Last Fling','').length, 0);

// A create whose name overlaps an existing record on the same date is blocked
// at plan time AND refused at execute time.
setState([show({name:'The Last Fling Artisan Market',startDate:'2026-08-30',id:'a',
  location:'Valley Ridge Golf Course, Antioch, IL'})]);
const dupOp={op:'upsertShow',label:'dup',
  match:{name:'The Last Fling',startDate:'2026-08-30'},
  show:{name:'The Last Fling',startDate:'2026-08-30',numDays:1,boothCost:68}};
const dupPlan=C.pkgPlan(pkg([dupOp]),C.S);
R.check('a near-duplicate create is BLOCKED at plan time', dupPlan.ops[0].blocked, true);
R.check('the package becomes unapplyable', dupPlan.ok, false);
R.check('and the block names the existing record',
  /WOULD DUPLICATE.*Last Fling Artisan Market/.test(dupPlan.ops[0].notes.join(' ')), true);
// Even if a plan were forced through, execute refuses on its own.
const forced={idx:0,tag:'forced',op:'upsertShow',label:'dup',action:'create',target:null,
  changes:[],notes:[],blocked:false};
const forcedRes=C.pkgExecute(pkg([dupOp]),{ops:[forced]},C.S);
R.check('EXECUTE REFUSES THE DUPLICATE ON ITS OWN', forcedRes[0].status, 'skipped');
R.check('and the board did not grow', C.S.shows.length, 1);

// An update that matches more than one record must never pick one silently.
setState([
  show({name:'Spring Market North',startDate:'2026-05-02',id:'m1',location:'Aurora, IL'}),
  show({name:'Spring Market South',startDate:'2026-05-02',id:'m2',location:'Aurora, IL'})
]);
const multiOp={op:'upsertShow',label:'multi',
  match:{nameContains:['spring market'],startDate:'2026-05-02',requiredEvidenceAny:['aurora']},
  show:{boothCost:99}};
const multiPlan=C.pkgPlan(pkg([multiOp]),C.S);
R.check('an update matching two records is BLOCKED', multiPlan.ops[0].blocked, true);
R.check('it names both candidates',
  /Spring Market North/.test(multiPlan.ops[0].notes.join(' '))&&
  /Spring Market South/.test(multiPlan.ops[0].notes.join(' ')), true);
R.check('and nothing was changed', [C.S.shows[0].boothCost,C.S.shows[1].boothCost], [0,0]);

// startDate genuinely narrows a nameContains selector.
setState([
  show({name:'Spring Market',startDate:'2026-05-02',id:'y1',location:'Aurora, IL'}),
  show({name:'Spring Market',startDate:'2027-05-01',id:'y2',location:'Aurora, IL'})
]);
const datedPlan=C.pkgPlan(pkg([{op:'upsertShow',label:'dated',
  match:{nameContains:['spring market'],startDate:'2026-05-02',requiredEvidenceAny:['aurora']},
  show:{boothCost:55}}]),C.S);
R.check('startDate narrows nameContains to one record', datedPlan.ops[0].action, 'update');
R.check('and it is the right year', datedPlan.ops[0].target.id, 'y1');
R.check('the other year is reported as skipped',
  /NOT TOUCHED/.test(datedPlan.ops[0].notes.join(' ')), true);

R.done();
