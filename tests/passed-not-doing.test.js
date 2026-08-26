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
R.section('9. The real shipped package plans correctly against a synthetic board');

const PKG=JSON.parse(fs.readFileSync(path.join(__dirname,'..','packages','2026-08-26-show-sync.json'),'utf8'));
R.check('shipped package declares the right format', PKG.format, 'bs-show-update-package');
R.check('shipped package declares version 1', PKG.version, 1);
R.check('shipped package has five operations', PKG.operations.length, 5);

// A synthetic board shaped like the real one: the two new shows absent, Party
// on the Pavement pending, the four Rustic Fox holiday shows present.
setState([
  show({name:'Party on the Pavement',startDate:'2026-09-19',id:'sh_pop',confirmed:false,boothCost:450,depositDue:'2026-08-22'}),
  show({name:'Sip & Sleigh — Carol Stream',startDate:'2026-11-07',id:'sh_ss1'}),
  show({name:'Sip & Sleigh — North Aurora',startDate:'2026-11-20',id:'sh_ss2'}),
  show({name:'Kris Kringle — Carol Stream',startDate:'2026-12-04',id:'sh_kk1'}),
  show({name:'Kris Kringle — North Aurora',startDate:'2026-12-12',id:'sh_kk2'}),
  show({name:'Cranberry Fest',startDate:'2026-09-25',id:'sh_cf'}),
  show({name:'Wonderful World of Weddings',startDate:'2027-01-30',id:'sh_www',boothCost:1087.80,
    boothPayments:[{amount:250,date:'2026-08-18',note:'Deposit paid'}],depositDue:'2026-09-30'})
]);
plan=C.pkgPlan(PKG,C.S);
R.check('shipped package plans cleanly', plan.ok, true);
R.check('nothing in it is blocked', plan.blockedCount, 0);
R.check('it creates exactly three shows', plan.createCount, 3);
const popOp=plan.ops.find(o=>/Pavement/.test(o.label));
R.check('Party on the Pavement is a markPassed', popOp.action, 'markPassed');
R.check('and matches exactly one record', popOp.changes.length, 1);
const rfOp=plan.ops.find(o=>/Rustic Fox 2026 holiday series/.test(o.label));
R.check('the Rustic Fox sweep matches four records', rfOp.changes.length, 4);
R.check('the sweep does not touch Cranberry Fest',
  rfOp.targets.some(t=>t.id==='sh_cf'), false);
R.check('the sweep does not touch Wonderful World of Weddings',
  rfOp.targets.some(t=>t.id==='sh_www'), false);

const wwwBefore=JSON.stringify(C.S.shows.find(s=>s.id==='sh_www'));
C.pkgExecute(PKG,plan,C.S);
R.check('board grew from 7 to 10 shows', C.S.shows.length, 10);
R.check('Wonderful World of Weddings is byte-for-byte untouched',
  JSON.stringify(C.S.shows.find(s=>s.id==='sh_www')), wwwBefore);
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
R.check('REPLAYING the shipped package creates no duplicates', C.S.shows.length, 10);
R.check('REPLAY adds no duplicate payments',
  [C.boothPaid(C.S.shows.find(s=>/Last Fling/.test(s.name))),
   C.boothPaid(C.S.shows.find(s=>/Mistletoe/.test(s.name)))], [68,100]);

// The three new shows must be real bookings on every forward-looking surface.
const upNow=C.S.shows.filter(s=>C.isUpcoming(s));
R.check('five shows upcoming after the sync', upNow.length, 5);
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

R.done();
