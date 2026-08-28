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
R.section('6b. Package upsert: blank fields never overwrite, notes append');
// Ported from the Booked Show Handoff design: a blank incoming field must
// never erase a filled one, and notes accumulate instead of being replaced.
// pkgPlan and pkgExecute share one policy (pkgFieldOutcome) so the preview
// can never promise a change pkgExecute then declines to make.

setState([show({name:'Blank Field Test',startDate:FUTURE,id:'sh_blank',
  location:'Antioch, IL',miles:33,notes:'existing organizer note'})]);

const blankLoc={op:'upsertShow',match:{name:'Blank Field Test',startDate:FUTURE},
  show:{location:'',miles:0,boothCost:75}};
let blankPlan=C.pkgPlan(pkg([blankLoc]),C.S);
R.check('blank location is not offered as a change',
  blankPlan.ops[0].changes.some(c=>c.field==='location'), false);
R.check('zero miles is offered — 0 is a real value, not blank',
  blankPlan.ops[0].changes.some(c=>c.field==='miles'), true);
R.check('a real boothCost is offered as a change',
  blankPlan.ops[0].changes.some(c=>c.field==='boothCost'), true);

C.pkgExecute(pkg([blankLoc]),blankPlan,C.S);
R.check('blank location did NOT overwrite the existing one',
  C.S.shows.find(s=>s.id==='sh_blank').location, 'Antioch, IL');
R.check('zero miles DID land — 0 is a legitimate value',
  C.S.shows.find(s=>s.id==='sh_blank').miles, 0);
R.check('boothCost DID land', C.S.shows.find(s=>s.id==='sh_blank').boothCost, 75);
R.check('notes were left untouched by an operation that named no notes field',
  C.S.shows.find(s=>s.id==='sh_blank').notes, 'existing organizer note');

const addNote={op:'upsertShow',match:{name:'Blank Field Test',startDate:FUTURE},
  show:{notes:'accepted, awaiting payment'}};
C.pkgExecute(pkg([addNote]),C.pkgPlan(pkg([addNote]),C.S),C.S);
R.check('a new note is APPENDED, not replacing the old one',
  C.S.shows.find(s=>s.id==='sh_blank').notes,
  'existing organizer note\naccepted, awaiting payment');

// Re-planning and re-applying the exact same note must settle to nothing —
// this is the "no-op re-paste writes nothing" guarantee.
let renotePlan=C.pkgPlan(pkg([addNote]),C.S);
R.check('re-planning the same note finds nothing left to change', renotePlan.changeCount, 0);
C.pkgExecute(pkg([addNote]),renotePlan,C.S);
R.check('the note was not duplicated by a replay',
  C.S.shows.find(s=>s.id==='sh_blank').notes,
  'existing organizer note\naccepted, awaiting payment');

const blankNote={op:'upsertShow',match:{name:'Blank Field Test',startDate:FUTURE},show:{notes:''}};
let blankNotePlan=C.pkgPlan(pkg([blankNote]),C.S);
R.check('a blank note is never offered as a change',
  blankNotePlan.ops[0].changes.some(c=>c.field==='notes'), false);
C.pkgExecute(pkg([blankNote]),blankNotePlan,C.S);
R.check('a blank note did not erase the existing notes',
  C.S.shows.find(s=>s.id==='sh_blank').notes,
  'existing organizer note\naccepted, awaiting payment');

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


// =======================================================================
R.section('12. v3 package: reinstate Party on the Pavement as passed history');

// The failure this section exists to prevent: Party on the Pavement is ABSENT
// from Justin's board — deleted at some point — while the pop_racine_20260818
// migration marker still records it as seeded. The marker suppresses
// re-seeding, so nothing brings it back, and v2's markPassed operation only
// ever MATCHES an existing record. Against the real board it returned
// UNMATCHED and skipped, leaving no record at all: not in Upcoming, and not in
// Passed / Not Doing history either. The decision simply vanished.
//
// v3 replaces that operation with a create-or-update carrying the passed
// fields, so the historical record is reinstated already in the passed state.

const PKG3=JSON.parse(fs.readFileSync(path.join(__dirname,'..','packages','2026-08-26-show-sync-v3.json'),'utf8'));
R.check('v3 declares the right format', PKG3.format, 'bs-show-update-package');
R.check('v3 has a distinct package id', PKG3.packageId, 'pkg_2026-08-26_show-sync_v3');
R.check('v3 id ends in _v3', /_v3$/.test(PKG3.packageId), true);
R.check('v3 supersedes v2', PKG3.supersedes, 'pkg_2026-08-26_show-sync_v2');
R.check('v3 is not the v2 id', PKG3.packageId===PKG2.packageId, false);
R.check('v3 preserves six operations', PKG3.operations.length, 6);

// The five approved operations must be untouched, field for field.
const V3_UNCHANGED=[0,1,3,4,5];
R.check('the other five operations are byte-for-byte v2',
  V3_UNCHANGED.every(i=>JSON.stringify(PKG3.operations[i])===JSON.stringify(PKG2.operations[i])), true);
R.check('and only operation 3 differs',
  PKG3.operations.findIndex((o,i)=>JSON.stringify(o)!==JSON.stringify(PKG2.operations[i])), 2);

const party3=PKG3.operations[2];
R.check('the Party operation is now an upsert', party3.op, 'upsertShow');
R.check('it matches the name', party3.match.nameContains, ['party on the pavement']);
R.check('...AND the exact start date', party3.match.startDate, '2026-09-19');
R.check('...AND requires Racine evidence', party3.match.requiredEvidenceAny, ['racine']);
R.check('it will not rename an existing record', party3.keepExistingName, true);
R.check('it stores the passed state', party3.show.passed, true);
R.check('with the required reason', party3.show.passedReason, 'Justin decided not to participate in 2026.');
R.check('and the required revisit', party3.show.passedRevisit, '2027 application cycle');
// "Does not create a payment" — this show was never approved and never paid.
R.check('it creates NO payment', party3.boothPayments, undefined);
// Canonical seed facts, not invented ones.
R.check('booth cost from the seed', party3.show.boothCost, 450);
R.check('mileage from the seed', party3.show.miles, 24);
R.check('location from the seed', party3.show.location, 'Racine, WI');
R.check('hours from the seed', [party3.show.openTime,party3.show.closeTime], ['12:00','19:00']);
R.check('application deadline from the seed', party3.show.depositDue, '2026-08-22');
R.check('confirmed false, as it was never approved', party3.show.confirmed, false);
R.check('the seed notes carried verbatim', party3.show.notes.length, 1176);
R.check('notes start as the seed does', /^PARTY ON THE PAVEMENT \(23rd annual\)/.test(party3.show.notes), true);
// Documented departure: the seed's projected $4 parking is deliberately absent,
// because calcYTD counts a non-completed show's showExpenses as money spent and
// we are not going.
R.check('the projected parking expense is deliberately omitted', party3.show.showExpenses, undefined);
R.check('and the departure is documented', (PKG3.seedDepartures||[]).length, 2);

// ---- Party ABSENT: created once, and passed ----
function boardNoParty(){
  return realBoard().filter(s=>!/pavement/i.test(s.name));
}
setState(boardNoParty());
R.check('the fixture really has no Party record',
  C.S.shows.filter(s=>/pavement/i.test(s.name)).length, 0);
const beforeAbsent=C.S.shows.length;
let p3=C.pkgPlan(PKG3,C.S);
R.check('v3 plans cleanly with Party absent', p3.ok, true);
R.check('nothing blocked', p3.blockedCount, 0);
const pOp=p3.ops[2];
R.check('the Party operation is a CREATE', pOp.action, 'create');
R.check('and it contributes 19 field changes', pOp.changes.length, 19);
C.pkgExecute(PKG3,p3,C.S);
R.check('exactly one Party record now exists',
  C.S.shows.filter(s=>/pavement/i.test(s.name)).length, 1);
R.check('the board grew by exactly one for it', C.S.shows.length, beforeAbsent+3); // party + mistletoe + rf
let party=C.S.shows.find(s=>/pavement/i.test(s.name));
R.check('it is PASSED', C.isPassed(party), true);
R.check('it is NOT missed', C.isMissed(party), false);
R.check('it is NOT upcoming', C.isUpcoming(party), false);
R.check('the reason is recorded', party.passedReason, 'Justin decided not to participate in 2026.');
R.check('the revisit is recorded', party.passedRevisit, '2027 application cycle');
R.check('the source names the package', party.passedSource, 'pkg_2026-08-26_show-sync_v3');
R.check('NO payment was created', party.boothPayments.length, 0);
R.check('the booth cost is preserved as history', party.boothCost, 450);
R.check('the full seed notes are preserved', (party.notes||'').length, 1176);
R.check('the day scaffolding was built', (party.days||[]).length, 1);

// ---- kept out of every forward-looking surface ----
R.check('not in any pipeline bucket',
  C.pipelineBuckets(C.S.shows.filter(s=>C.isUpcoming(s))).planned.filter(s=>/pavement/i.test(s.name)).length, 0);
R.check('raises no payment-due alert despite carrying a deposit date',
  C.depositAlerts(400).filter(x=>/pavement/i.test(x.sh.name)).length, 0);
R.check('and it really does carry that date', party.depositDue, '2026-08-22');
R.check('its $450 booth is not in the owed total',
  C.calcBoothTally().owed, C.S.shows.filter(s=>s.status!=='completed'&&!C.isPassed(s))
    .reduce((t,s)=>t+(s.boothCost||0),0));
R.check('it creates no schedule conflict', C.showConflicts(party).length, 0);
R.check('it is off the calendar',
  C.S.shows.filter(s=>!C.isPassed(s)).filter(s=>/pavement/i.test(s.name)).length, 0);
R.check('it is not a transfer target',
  C.transferableShows().filter(s=>/pavement/i.test(s.name)).length, 0);
R.check('it is not counted as a booked show',
  C.S.shows.filter(s=>!C.isMissed(s)&&!C.isPassed(s)).filter(s=>/pavement/i.test(s.name)).length, 0);
// And it IS in the history it belongs in.
R.check('it appears in Passed / Not Doing',
  C.S.shows.filter(s=>C.isPassed(s)).filter(s=>/pavement/i.test(s.name)).length, 1);

// ---- the rest of the package still behaves ----
R.check('Last Fling was UPDATED, not duplicated',
  C.S.shows.filter(s=>/last fling/i.test(s.name)).length, 1);
R.check('and it is still the original record', C.S.shows.find(s=>/last fling/i.test(s.name)).id, 'sh_fling');
R.check('its name is still the organizer name',
  C.S.shows.find(s=>/last fling/i.test(s.name)).name, 'The Last Fling Artisan Market');
R.check('five Rustic Fox + Party records are passed', C.S.shows.filter(s=>C.isPassed(s)).length, 5);
R.check('the unrelated Kris Kringle is untouched', C.isPassed(C.S.shows.find(s=>s.id==='sh_other')), false);

// ---- reapply: zero changes, no duplicate ----
R.check('RE-PLANNING v3 FINDS NOTHING LEFT TO DO', C.pkgPlan(PKG3,C.S).changeCount, 0);
const afterV3=JSON.stringify(C.S);
C.pkgExecute(PKG3,C.pkgPlan(PKG3,C.S),C.S);
R.check('REAPPLYING v3 CHANGES NOTHING', JSON.stringify(C.S), afterV3);
R.check('still exactly one Party record',
  C.S.shows.filter(s=>/pavement/i.test(s.name)).length, 1);
R.check('still no payment on it',
  C.S.shows.find(s=>/pavement/i.test(s.name)).boothPayments.length, 0);

// ---- Party already PENDING: updated in place, not duplicated ----
setState(boardNoParty().concat([
  show({name:'Party on the Pavement',startDate:'2026-09-19',id:'sh_pending_party',
    location:'Racine, WI',confirmed:false,boothCost:450,depositDue:'2026-08-22'})
]));
p3=C.pkgPlan(PKG3,C.S);
R.check('with Party pending the operation is an UPDATE', p3.ops[2].action, 'update');
R.check('and it targets the existing record', p3.ops[2].target.id, 'sh_pending_party');
const pendingCount=C.S.shows.length;
C.pkgExecute(PKG3,p3,C.S);
R.check('no second Party record was created',
  C.S.shows.filter(s=>/pavement/i.test(s.name)).length, 1);
party=C.S.shows.find(s=>/pavement/i.test(s.name));
R.check('it is the SAME record, by id', party.id, 'sh_pending_party');
R.check('it is now passed', C.isPassed(party), true);
R.check('and not missed', C.isMissed(party), false);
R.check('it left Pending / Applied',
  C.pipelineBuckets(C.S.shows.filter(s=>C.isUpcoming(s))).pending.filter(s=>/pavement/i.test(s.name)).length, 0);
R.check('board grew only by the two creates', C.S.shows.length, pendingCount+2);

// ---- Party already PASSED: no additional changes ----
R.check('re-planning against the passed record finds nothing', C.pkgPlan(PKG3,C.S).changeCount, 0);
const passedSnapshot=JSON.stringify(C.S.shows.find(s=>/pavement/i.test(s.name)));
C.pkgExecute(PKG3,C.pkgPlan(PKG3,C.S),C.S);
R.check('and applying again leaves the record identical',
  JSON.stringify(C.S.shows.find(s=>/pavement/i.test(s.name))), passedSnapshot);

// ---- same name and date, WRONG location: untouched, and no duplicate ----
setState(boardNoParty().concat([
  show({name:'Party on the Pavement',startDate:'2026-09-19',id:'sh_wrong_town',
    location:'Kenosha, WI',organizer:'Kenosha Downtown Association',confirmed:false,boothCost:200})
]));
const wrongBefore=JSON.stringify(C.S.shows.find(s=>s.id==='sh_wrong_town'));
const wrongCount=C.S.shows.length;
p3=C.pkgPlan(PKG3,C.S);
R.check('the operation is BLOCKED rather than matching the wrong town', p3.ops[2].blocked, true);
R.check('the whole package becomes unapplyable', p3.ok, false);
R.check('the block explains it refuses to create a duplicate',
  /refusing to create/.test(p3.ops[2].notes.join(' ')), true);
R.check('and it names the record it would not touch',
  /NOT TOUCHED/.test(p3.ops[2].notes.join(' ')), true);
C.pkgExecute(PKG3,p3,C.S);
R.check('THE WRONG-TOWN RECORD IS BYTE-FOR-BYTE UNTOUCHED',
  JSON.stringify(C.S.shows.find(s=>s.id==='sh_wrong_town')), wrongBefore);
// pkgExecute skips the blocked operation but still runs the other five, so the
// board grows by the two legitimate creates. What must NOT happen is a second
// Party record appearing beside the wrong-town one.
R.check('no second Party record was created beside it',
  C.S.shows.filter(s=>/pavement/i.test(s.name)).length, 1);
R.check('the board grew only by the two unrelated creates', C.S.shows.length, wrongCount+2);
// And in the real flow nothing would run at all, because the package is
// unapplyable while any operation is blocked.
R.check('pkgApply would refuse the whole package', C.pkgPlan(PKG3,C.S).ok!==true, true);
R.check('it is still not passed', C.isPassed(C.S.shows.find(s=>s.id==='sh_wrong_town')), false);

// ---- Wonderful World of Weddings, through the whole of v3 ----
setState(boardNoParty());
const wwwV3Before=JSON.stringify(C.S.shows.find(s=>s.id==='sh_www'));
C.pkgExecute(PKG3,C.pkgPlan(PKG3,C.S),C.S);
R.check('WONDERFUL WORLD OF WEDDINGS IS BYTE-FOR-BYTE UNCHANGED',
  JSON.stringify(C.S.shows.find(s=>s.id==='sh_www')), wwwV3Before);
R.check('its balance is still owed in full', C.boothBalance(C.S.shows.find(s=>s.id==='sh_www')), 837.8);
R.check('and it is still the only entry in Owe Booth',
  C.pipelineBuckets(C.S.shows.filter(s=>C.isUpcoming(s))).owe.map(s=>s.id), ['sh_www']);

// ---- v3 vs v2: the difference is exactly one operation ----
setState(boardNoParty());
const v2plan=C.pkgPlan(PKG2,C.S);
const v3plan=C.pkgPlan(PKG3,C.S);
R.check('v2 leaves the Party operation UNMATCHED', v2plan.ops[2].action, 'none');
R.check('and says so plainly', /UNMATCHED/.test(v2plan.ops[2].notes.join(' ')), true);
R.check('v3 adds exactly 19 field changes over v2',
  v3plan.changeCount-v2plan.changeCount, 19);
R.check('and exactly one more creation',
  v3plan.createCount-v2plan.createCount, 1);
R.check('every other operation plans identically',
  V3_UNCHANGED.every(i=>v2plan.ops[i].changes.length===v3plan.ops[i].changes.length), true);


// =======================================================================
R.section('13. v35 Load Latest Approved Package: catalog, origin, checksum, aliases');

// One button replaces "find the file, download it, open the app, choose it".
// It removes handling, not gates — so the things worth testing are the three
// rules that make a one-tap fetch safe at all: it will only fetch from this
// app's own packages folder, it will only accept bytes whose SHA-256 matches
// the reviewed value, and it refuses to offer Apply for a package already on
// the board under either of its names.

const CAT=JSON.parse(fs.readFileSync(path.join(__dirname,'..','packages','approved-show-packages.json'),'utf8'));

// ---- the shipped catalog ----
R.check('catalog declares the right format', CAT.format, 'bs-approved-package-catalog');
R.check('catalog declares version 1', CAT.version, 1);
R.check('the shipped catalog validates', C.pkgCatalogValidate(CAT).ok, true);
R.check('it names v3 as latest', CAT.latest.packageId, 'pkg_2026-08-26_show-sync_v3');
R.check('with the underscore spelling as an alias', CAT.latest.aliases, ['pkg_2026-08-26_show_sync_v3']);
R.check('the file is a bare filename', /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(CAT.latest.file), true);
R.check('the sha256 is 64 hex characters', /^[0-9a-f]{64}$/.test(CAT.latest.sha256), true);
R.check('and a byte count is declared', CAT.latest.bytes, 11300);
// The catalog must describe the package that is actually committed beside it.
const V3TXT=fs.readFileSync(path.join(__dirname,'..','packages',CAT.latest.file),'utf8');
const V3BYTES=new TextEncoder().encode(V3TXT).length;
R.check('the named file exists and parses',
  JSON.parse(V3TXT).packageId, CAT.latest.packageId);
// The declared byte count is of the COMMITTED bytes (LF). A Windows checkout
// with core.autocrlf=true holds the same file with CRLF and is larger — the
// same condition that makes the button refuse a local copy, so it is tolerated
// here rather than reported as a broken catalog.
R.check('the declared byte count matches the committed file (or this is a CRLF checkout)',
  V3BYTES===CAT.latest.bytes || V3TXT.indexOf('\r\n')>=0, true);
R.check('every history entry also names a bare filename',
  (CAT.history||[]).every(h=>/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(h.file)), true);
R.check('and a valid checksum',
  (CAT.history||[]).every(h=>/^[0-9a-f]{64}$/.test(h.sha256)), true);

// ---- catalog validation refuses malformed input ----
const goodCat=()=>JSON.parse(JSON.stringify(CAT));
R.check('a non-object is refused', C.pkgCatalogValidate('nope').ok, false);
R.check('null is refused', C.pkgCatalogValidate(null).ok, false);
R.check('an array is refused', C.pkgCatalogValidate([]).ok, false);
let bad=goodCat(); bad.format='something-else';
R.check('the wrong format is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); bad.version=99;
R.check('a future version is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); delete bad.latest;
R.check('a missing latest entry is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); delete bad.latest.packageId;
R.check('a latest entry with no packageId is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); delete bad.latest.file;
R.check('a latest entry with no file is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); bad.latest.sha256='abc';
R.check('a short checksum is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); delete bad.latest.sha256;
R.check('a missing checksum is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); bad.latest.sha256='z'.repeat(64);
R.check('a non-hex checksum is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); bad.latest.bytes=0;
R.check('a zero byte count is refused', C.pkgCatalogValidate(bad).ok, false);
bad=goodCat(); bad.latest.aliases='not-a-list';
R.check('a non-list aliases field is refused', C.pkgCatalogValidate(bad).ok, false);
// The catalog is data, and its errors have to be readable.
R.check('refusals explain themselves', C.pkgCatalogValidate({format:'x',version:1}).errors.length>0, true);

// ---- same-origin and packages-folder enforcement ----
const BASE='https://jfgreco84-commits.github.io/best-solution-app/BEST_SOLUTION_APP.html';
const ok=f=>C.pkgResolveInPackages(f,BASE);
R.check('a plain filename resolves inside packages/',
  ok('2026-08-26-show-sync-v3.json').url.pathname,
  '/best-solution-app/packages/2026-08-26-show-sync-v3.json');
R.check('and it carries no error', ok('2026-08-26-show-sync-v3.json').error, undefined);
R.check('the catalog file itself resolves', !!ok('approved-show-packages.json').url, true);

// Everything below must be refused. These are the shapes an attacker-supplied
// or corrupted catalog would use to point the app somewhere else.
const REFUSE=[
  ['another host','https://evil.example/pkg.json'],
  ['http on another host','http://evil.example/pkg.json'],
  ['protocol-relative','//evil.example/pkg.json'],
  ['an absolute path','/etc/passwd.json'],
  ['a root-relative path into another repo','/other-repo/packages/pkg.json'],
  ['parent traversal','../secrets.json'],
  ['nested traversal','../../packages/pkg.json'],
  ['traversal that lands back inside','../packages/pkg.json'],
  ['a subdirectory','sub/pkg.json'],
  ['a backslash path','..\\\\secrets.json'],
  ['percent-encoded traversal','%2e%2e%2fsecrets.json'],
  ['a data: URL','data:application/json,{}'],
  ['a javascript: URL','javascript:alert(1)'],
  ['a file: URL','file:///etc/passwd.json'],
  ['a query string','pkg.json?x=1'],
  ['a fragment','pkg.json#x'],
  ['a non-json extension','pkg.txt'],
  ['no extension','pkg'],
  ['an empty name',''],
  ['whitespace only','   '],
  ['a leading dot','.hidden.json'],
  ['a leading dash','-pkg.json'],
  ['null',null],
  ['a number',12345]
];
let refusedAll=true, leaked=[];
REFUSE.forEach(pair=>{
  const r=C.pkgResolveInPackages(pair[1],BASE);
  if(!r.error||r.url){refusedAll=false;leaked.push(pair[0]);}
});
R.check('EVERY off-limits path shape is refused', refusedAll, true);
R.check('and none of them leaked through', leaked, []);
R.check('refusals say what was refused',
  /will not fetch/.test(C.pkgResolveInPackages('../secrets.json',BASE).error||''), true);
// The origin test is on the RESULT, not just the input pattern.
R.check('a same-name file under a different origin base still resolves to that origin',
  C.pkgResolveInPackages('pkg.json','https://elsewhere.test/app/x.html').url.origin,
  'https://elsewhere.test');

// ---- checksum: everything that is not a clean match refuses ----
const HASH='bb2c65eac49074e58f553711c385bc3856381d20a19dc8421f81a2d353fc8abb';
R.check('an exact match passes', C.pkgChecksumMatches(HASH,HASH), true);
R.check('an uppercase expectation still matches', C.pkgChecksumMatches(HASH,HASH.toUpperCase()), true);
R.check('a one-character difference REFUSES',
  C.pkgChecksumMatches(HASH,HASH.slice(0,63)+(HASH[63]==='b'?'c':'b')), false);
R.check('a null digest refuses', C.pkgChecksumMatches(null,HASH), false);
R.check('an undefined digest refuses', C.pkgChecksumMatches(undefined,HASH), false);
R.check('an empty digest refuses', C.pkgChecksumMatches('',HASH), false);
R.check('a truncated digest refuses', C.pkgChecksumMatches(HASH.slice(0,32),HASH), false);
R.check('an uppercase digest refuses (we normalise to lowercase before comparing)',
  C.pkgChecksumMatches(HASH.toUpperCase(),HASH), false);
R.check('a non-string digest refuses', C.pkgChecksumMatches(12345,HASH), false);
R.check('a missing expectation refuses', C.pkgChecksumMatches(HASH,null), false);
R.check('a malformed expectation refuses', C.pkgChecksumMatches(HASH,'abc'), false);
R.check('two nulls still refuse', C.pkgChecksumMatches(null,null), false);
// The failure this rule exists to prevent: "could not compute" must never
// read as "fine".
R.check('an uncomputable digest is a refusal, not a pass', C.pkgChecksumMatches(null,HASH), false);

// ---- alias recognition ----
const V3='pkg_2026-08-26_show-sync_v3', V3U='pkg_2026-08-26_show_sync_v3';
R.check('the hyphen id knows the underscore id', C.pkgAliasSet(V3).indexOf(V3U)>=0, true);
R.check('and the underscore id knows the hyphen id', C.pkgAliasSet(V3U).indexOf(V3)>=0, true);
R.check('an id always includes itself', C.pkgAliasSet(V3)[0], V3);
R.check('the set has no duplicates', C.pkgAliasSet(V3,[V3,V3U]).length, 2);
R.check('catalog-declared aliases are honoured',
  C.pkgAliasSet('pkg_other',['pkg_other_alt']), ['pkg_other','pkg_other_alt']);
R.check('an unrelated id gets no aliases', C.pkgAliasSet('pkg_unrelated'), ['pkg_unrelated']);
// Deliberately NOT a general hyphen/underscore normaliser: two different
// packages whose ids happen to differ that way must stay different.
R.check('a lookalike pair not in the table is NOT merged',
  C.pkgAliasSet('pkg_some-thing_v9').indexOf('pkg_some_thing_v9'), -1);

// ---- already applied, under either name ----
setState([]);
C.S._pkgApplied={}; C.S._pkgApplied[V3]={appliedAt:'2026-08-27T10:00:00.000Z'};
R.check('applied under the hyphen id is seen', !!C.pkgAppliedRecord(V3,C.S), true);
R.check('and is ALSO seen when asked about the underscore id',
  !!C.pkgAppliedRecord(V3U,C.S), true);
R.check('the alias hit reports which id actually carried it',
  C.pkgAppliedRecord(V3U,C.S).id, V3);
R.check('and flags that it matched via an alias', C.pkgAppliedRecord(V3U,C.S).viaAlias, true);
R.check('a direct hit is not flagged as an alias', C.pkgAppliedRecord(V3,C.S).viaAlias, false);

setState([]);
C.S._pkgApplied={}; C.S._pkgApplied[V3U]={appliedAt:'2026-08-27T10:00:00.000Z'};
R.check('applied under the UNDERSCORE id is seen from the hyphen id',
  !!C.pkgAppliedRecord(V3,C.S), true);
R.check('and reports the underscore id as the carrier', C.pkgAppliedRecord(V3,C.S).id, V3U);

setState([]);
R.check('an untouched board reports nothing applied', C.pkgAppliedRecord(V3,C.S), null);
R.check('and pkgIsApplied agrees', C.pkgIsApplied(V3,C.S), false);

// The idempotency gate must hold through the alias on the PASTE path too, not
// only through the new button.
setState(realBoard());
C.S._pkgApplied={}; C.S._pkgApplied[V3U]={appliedAt:'2026-08-27T10:00:00.000Z'};
const aliasPlan=C.pkgPlan(PKG3,C.S);
R.check('a pasted v3 is refused when the alias is already recorded', aliasPlan.ok, false);
R.check('and it plans zero changes', aliasPlan.changeCount, 0);
R.check('the refusal names the other id',
  /other id/.test(aliasPlan.errors.join(' ')), true);
// While an unrelated package is unaffected by the alias table.
const otherPkg=pkg([{op:'markPassed',match:{name:'Nothing'},reason:'x'}],'pkg_unrelated_v1');
R.check('an unrelated package is not blocked by it', C.pkgPlan(otherPkg,C.S).ok, true);

// ---- the friendly already-current screen ----
// pkgRenderAlreadyCurrent must not offer Apply. It is a courtesy screen for a
// board that is already up to date, and an Apply button there would invite a
// double-apply that the gates would then have to refuse.
setState([]);
C.S._pkgApplied={}; C.S._pkgApplied[V3U]={appliedAt:'2026-08-27T10:00:00.000Z'};
const hit=C.pkgAppliedRecord(CAT.latest.packageId,C.S,CAT.latest.aliases);
R.check('the shipped catalog entry is recognised as already applied via its alias',
  !!hit&&hit.viaAlias, true);
let rendered='';
const realMOpen=C.mOpen; C.mOpen=h=>{rendered=h;};
C.pkgRenderAlreadyCurrent(CAT.latest,hit);
C.mOpen=realMOpen;
R.check('the screen says you already have the latest approved show update',
  /You already have the latest approved show update/.test(rendered), true);
R.check('it offers NO Apply control', /Apply \d+ Change|onclick="pkgApply\(\)/.test(rendered), false);
R.check('and no confirmation checkbox', /pkg_ack/.test(rendered), false);
R.check('it names the package', rendered.indexOf(CAT.latest.packageId)>=0, true);
R.check('it explains the id it was recorded under', rendered.indexOf(V3U)>=0, true);
R.check('it shows when it was applied', /2026-08-27 10:00/.test(rendered), true);
R.check('and it offers a way onward', /View Shows/.test(rendered), true);
R.check('rendering it changed no show data', C.S.shows.length, 0);

// ---- the gates the button hands off to are untouched ----
R.check('pkgApply is still async', C.pkgApply.constructor.name, 'AsyncFunction');
R.check('the apply gate still exists', typeof C.pkgGate, 'function');
R.check('the cloud divergence check still exists', typeof C.pkgCloudDivergence, 'function');
R.check('the cloud verification still exists', typeof C.pkgVerifyCloud, 'function');
R.check('the manual fallback is still available', typeof C.pkgPreviewFromText, 'function');
R.check('and so is file upload', typeof C.pkgPickFile, 'function');

R.done();
