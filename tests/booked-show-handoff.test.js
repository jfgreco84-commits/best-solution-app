// Booked Show Handoff intake — SYNTHETIC FIXTURES ONLY.
//
// The intake writes show records, so these tests exist to pin down the three
// rules that keep it safe: identity matches the replay guard's key, derived
// money is never stored, and a blank never overwrites a filled-in field.
// Every show and dollar figure below is invented.
//
//   node tests/booked-show-handoff.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const HANDOFF=(o)=>Object.assign({
  event_name:'',event_date_start:'',event_date_end:'',organizer:'',venue:'',address:'',
  show_hours:'',setup_hours:'',booth_type:'',booth_size:'',booth_fee:null,invoice_number:'',
  payment_status:'',amount_paid:null,balance_due:null,payment_date:'',status:'',conflict:'',
  staffing_notes:'',organizer_contact:'',source_reference:'',notes:''},o);

function world(shows){
  const h=boot();
  if(h.bootError)throw h.bootError;
  const {ctx}=h;
  ctx.S.shows=shows||[];
  ctx.saveS=()=>{};
  ctx.toast=()=>{};
  ctx.mOpen=()=>{};
  ctx.mClose=()=>{};
  const apply=(rows)=>{
    ctx.BH_PENDING=ctx.bhPlan(rows);
    ctx.window.__lastSave=0;            // _dupGuard is time-based; tests fire fast
    ctx.bhApply();
    return ctx.S.shows;
  };
  return {h,ctx,store:h.store,apply,
    plan:(rows)=>ctx.bhPlan(rows),
    find:(n)=>ctx.S.shows.find(s=>ctx.mrgNormName(s.name)===ctx.mrgNormName(n))};
}
const existing=(o)=>Object.assign({id:'sh_x',name:'Old Show',status:'planned',startDate:'2099-05-05',
  numDays:1,location:'',boothCost:0,boothPayments:[],days:[{dayNum:1,date:'May 5',morningCount:null,
  eveningCount:null,payments:{},expenses:{},repSales:[],repPay:{},notes:'',status:'open'}],
  showExpenses:[],repIds:[],repOnlyShow:false,confirmed:true},o);

R.section('=== 1. PARSING ===');
{
  const w=world();
  chk('array of objects', w.ctx.bhParse('[{"event_name":"A"},{"event_name":"B"}]').rows.length, 2);
  chk('a single object is accepted', w.ctx.bhParse('{"event_name":"A"}').rows.length, 1);
  chk('a ```json fence is tolerated',
      w.ctx.bhParse('```json\n{"event_name":"A"}\n```').rows.length, 1);
  chk('malformed JSON is reported, not thrown',
      /not valid JSON/.test(w.ctx.bhParse('{oops').error), true);
  chk('empty paste is reported', w.ctx.bhParse('   ').error, 'Nothing pasted.');
  chk('a bare array of strings yields no rows',
      w.ctx.bhParse('["a","b"]').error, 'No show objects found in that JSON.');
}

R.section('=== 2. DATES AND HOURS ===');
{
  const w=world(), c=w.ctx;
  chk('ISO date', c.bhDate('2026-11-27'), '2026-11-27');
  chk('US date', c.bhDate('11/27/2026'), '2026-11-27');
  chk('Feb 30 is rejected, not rolled forward', c.bhDate('2026-02-30'), null);
  chk('month 13 rejected', c.bhDate('2026-13-01'), null);
  chk('junk rejected', c.bhDate('next Tuesday'), null);
  chk('12h range', c.bhHours('12:00 PM - 5:00 PM'), ['12:00','17:00']);
  chk('compact 12h', c.bhHours('10am-4pm'), ['10:00','16:00']);
  chk('noon stays noon', c.bhHours('12:00 PM - 1:00 PM'), ['12:00','13:00']);
  chk('midnight maps to 00', c.bhHours('12:00 AM - 3:00 AM'), ['00:00','03:00']);
  chk('24h range passes through', c.bhHours('10:00 - 16:00'), ['10:00','16:00']);
  chk('"10 - 4pm" reads as morning to afternoon', c.bhHours('10 - 4pm'), ['10:00','16:00']);
  chk('"7 - 9pm" reads as an evening show', c.bhHours('7 - 9pm'), ['19:00','21:00']);
  chk('"12 - 5pm" starts at noon', c.bhHours('12 - 5pm'), ['12:00','17:00']);
  chk('unreadable hours give null', c.bhHours('all day'), null);
  chk('multi-day span becomes numDays', c.bhDays('2027-01-30','2027-01-31'), 2);
  chk('same day is 1', c.bhDays('2027-01-30','2027-01-30'), 1);
  chk('missing end date is 1', c.bhDays('2027-01-30',''), 1);
}

R.section('=== 3. CREATE ===');
{
  const w=world();
  w.apply([HANDOFF({event_name:'Galentine Market',event_date_start:'2027-02-07',
    venue:'The Ten Hotel',address:'6161 W Grand Ave, Gurnee, IL',show_hours:'10:00 AM - 4:00 PM',
    booth_fee:118,amount_paid:118,payment_date:'2026-08-24',status:'Booked / Paid',
    invoice_number:'001941',organizer_contact:'A Person',notes:'Late fee waived.'})]);
  const sh=w.find('Galentine Market');
  chk('the show exists', !!sh, true);
  chk('start date', sh.startDate, '2027-02-07');
  chk('venue and address became location', sh.location, 'The Ten Hotel · 6161 W Grand Ave, Gurnee, IL');
  chk('booth cost', sh.boothCost, 118);
  chk('one booth payment', sh.boothPayments.length, 1);
  chk('  for the right amount and date',
      [sh.boothPayments[0].amount, sh.boothPayments[0].date], [118,'2026-08-24']);
  chk('  noting the invoice', /001941/.test(sh.boothPayments[0].note), true);
  chk('hours on the show', [sh.openTime,sh.closeTime], ['10:00','16:00']);
  chk('hours on day 1', [sh.days[0].openTime,sh.days[0].closeTime], ['10:00','16:00']);
  chk('confirmed (Booked/Paid)', sh.confirmed, true);
  chk('status is planned, not invented', sh.status, 'planned');
  chk('notes carried', sh.notes, 'Late fee waived.');
  chk('handoff-only fields are namespaced under .booking',
      [sh.booking.invoiceNumber, sh.booking.organizerContact], ['001941','A Person']);
  chk('balance_due is NOT stored on the record', 'balanceDue' in sh || 'balance_due' in sh, false);
  chk('payment_status is NOT stored on the record', 'paymentStatus' in sh, false);
  chk('the app derives the balance instead', w.ctx.boothBalance(sh), 0);
}

R.section('=== 4. IDEMPOTENT RE-PASTE ===');
{
  const row=HANDOFF({event_name:'Repeat Fest',event_date_start:'2099-09-09',
    venue:'Hall',booth_fee:100,amount_paid:100,payment_date:'2099-01-01',status:'Paid'});
  const w=world();
  w.apply([row]);
  const after1=JSON.stringify(w.ctx.S.shows);
  const n1=w.ctx.S.shows.length;
  const plan2=w.plan([row]);
  chk('the second paste is an UPDATE, not a create', plan2[0].action, 'update');
  chk('  with nothing left to change', plan2[0].changes.length, 0);
  w.apply([row]);
  chk('no second show was created', w.ctx.S.shows.length, n1);
  chk('no second payment was logged', w.find('Repeat Fest').boothPayments.length, 1);
  chk('the record is byte-for-byte unchanged', JSON.stringify(w.ctx.S.shows), after1);

  // A later handoff that only adds an invoice number must still be seen.
  const w2=world();
  w2.apply([row]);
  const p3=w2.plan([Object.assign({},row,{invoice_number:'INV-77'})]);
  chk('an invoice-number-only update is not mistaken for a no-op', p3[0].changes.length, 1);
  w2.apply([Object.assign({},row,{invoice_number:'INV-77'})]);
  chk('  and it lands in .booking', w2.find('Repeat Fest').booking.invoiceNumber, 'INV-77');
  chk('  without adding a second payment', w2.find('Repeat Fest').boothPayments.length, 1);
}

R.section('=== 5. A BLANK NEVER OVERWRITES ===');
{
  const w=world([existing({name:'Filled In',startDate:'2099-05-05',location:'Real Venue, WI',
    boothCost:250,notes:'hand-typed note',openTime:'09:00',closeTime:'15:00'})]);
  w.apply([HANDOFF({event_name:'Filled In',event_date_start:'2099-05-05'})]);   // everything blank
  const sh=w.find('Filled In');
  chk('location survives', sh.location, 'Real Venue, WI');
  chk('booth cost survives', sh.boothCost, 250);
  chk('notes survive', sh.notes, 'hand-typed note');
  chk('hours survive', [sh.openTime,sh.closeTime], ['09:00','15:00']);
  chk('an unrecognised status leaves confirmed alone', sh.confirmed, true);

  const w2=world([existing({name:'Filled In',startDate:'2099-05-05',boothCost:250,notes:'first note'})]);
  w2.apply([HANDOFF({event_name:'Filled In',event_date_start:'2099-05-05',booth_fee:300,notes:'second note'})]);
  const s2=w2.find('Filled In');
  chk('a real value does update', s2.boothCost, 300);
  chk('notes append rather than replace', s2.notes, 'first note — second note');
}

R.section('=== 6. DUPLICATE PROTECTION ===');
{
  const w=world([existing({name:'Same Name Show',startDate:'2099-03-01'})]);
  const p=w.plan([HANDOFF({event_name:'Same Name Show',event_date_start:'2099-08-08'})]);
  chk('same name, different date is NOT auto-merged', p[0].action, 'ambiguous');
  chk('  and it warns which date is on file', /2099-03-01/.test(p[0].flags[0]), true);
  const before=JSON.stringify(w.ctx.S.shows);
  w.apply([HANDOFF({event_name:'Same Name Show',event_date_start:'2099-08-08'})]);
  chk('  and writes nothing at all', JSON.stringify(w.ctx.S.shows), before);

  const w2=world();
  const dup=[HANDOFF({event_name:'Twice',event_date_start:'2099-04-04'}),
             HANDOFF({event_name:'Twice',event_date_start:'2099-04-04'})];
  const p2=w2.plan(dup);
  chk('a repeat inside one paste is rejected', [p2[0].action,p2[1].action], ['create','rejected']);
  w2.apply(dup);
  chk('  so only one show is created', w2.ctx.S.shows.length, 1);

  const w3=world();
  chk('dash variants match the replay guard normaliser',
      w3.ctx.mrgNormName('Rustic Fox — Carol Stream'), w3.ctx.mrgNormName('Rustic Fox - Carol Stream'));
}

R.section('=== 7. REJECTIONS ===');
{
  const w=world();
  const p=w.plan([HANDOFF({event_name:'',event_date_start:'2099-01-01'}),
                  HANDOFF({event_name:'No Date'}),
                  HANDOFF({event_name:'Bad Date',event_date_start:'2026-02-30'})]);
  chk('a nameless row is rejected', p[0].action, 'rejected');
  chk('a dateless row is rejected', p[1].action, 'rejected');
  chk('an impossible date is rejected', p[2].action, 'rejected');
  const before=JSON.stringify(w.ctx.S.shows);
  w.apply([HANDOFF({event_name:'',event_date_start:'2099-01-01'})]);
  chk('rejected rows write nothing', JSON.stringify(w.ctx.S.shows), before);
}

R.section('=== 8. STATUS MAPS ONTO THE BOOKING PIPELINE ===');
{
  const w=world();
  w.apply([
    HANDOFF({event_name:'Applied One',event_date_start:'2099-06-01',status:'Applied',booth_fee:50}),
    HANDOFF({event_name:'Accepted One',event_date_start:'2099-06-02',status:'Accepted',booth_fee:80}),
    HANDOFF({event_name:'Paid One',event_date_start:'2099-06-03',status:'Booked / Paid',
             booth_fee:90,amount_paid:90,payment_date:'2099-01-01'})]);
  const up=w.ctx.S.shows.filter(s=>w.ctx.isUpcoming(s));
  const B=w.ctx.pipelineBuckets(up);
  chk('Applied  -> Pending / Applied', B.pending.map(s=>s.name), ['Applied One']);
  chk('Accepted -> Owe Booth',         B.owe.map(s=>s.name),     ['Accepted One']);
  chk('Paid     -> Booth Paid',        B.paid.map(s=>s.name),    ['Paid One']);
  chk('the owed total is the app’s own arithmetic', B.oweTotal, 80);
  chk('every imported show reaches Upcoming', up.length, 3);
}

R.section('=== 9. NEEDS ATTENTION ===');
{
  const w=world();
  const flags=(o)=>w.plan([HANDOFF(o)])[0].flags.join(' | ');
  chk('accepted with no fee is flagged',
      /NO pipeline bucket/.test(flags({event_name:'A',event_date_start:'2099-07-01',status:'Accepted'})), true);
  chk('accepted and unpaid is flagged with the amount',
      /\$80\.00 still owed/.test(flags({event_name:'B',event_date_start:'2099-07-02',status:'Accepted',booth_fee:80})), true);
  chk('missing venue is flagged',
      /No venue or address/.test(flags({event_name:'C',event_date_start:'2099-07-03'})), true);
  chk('missing hours is flagged',
      /No show hours/.test(flags({event_name:'D',event_date_start:'2099-07-04'})), true);
  chk('missing setup time is flagged',
      /No setup time/.test(flags({event_name:'E',event_date_start:'2099-07-05'})), true);
  chk('a balance_due that disagrees with the app is flagged',
      /app computes/.test(flags({event_name:'F',event_date_start:'2099-07-06',booth_fee:100,
        amount_paid:25,balance_due:0,status:'Accepted'})), true);
  chk('"Paid" with money still outstanding is flagged',
      /still outstanding/.test(flags({event_name:'G',event_date_start:'2099-07-07',booth_fee:100,
        amount_paid:25,payment_status:'Paid',status:'Accepted'})), true);
  const w2=world([existing({name:'Already Booked',startDate:'2099-08-15',numDays:2})]);
  chk('a date collision is flagged by name',
      /Date conflict with Already Booked/.test(
        w2.plan([HANDOFF({event_name:'New Clash',event_date_start:'2099-08-16'})])[0].flags.join(' | ')), true);
}

R.section('=== 10. AUDIT TRAIL ===');
{
  const w=world();
  w.apply([HANDOFF({event_name:'Audited Show',event_date_start:'2099-10-10',booth_fee:60,status:'Accepted'})]);
  const log=w.ctx.mrgLogRead();
  const mine=log.filter(e=>String(e.action).indexOf('handoff-')===0);
  chk('the import is logged', mine.length, 1);
  chk('  as a create', mine[0].action, 'handoff-create');
  chk('  against the replay-guard key', mine[0].key, w.ctx.mrgShowKey('Audited Show','2099-10-10'));
  chk('  naming the fields it touched', mine[0].fields.indexOf('booth cost')>=0, true);
  chk('the log lives outside the state document',
      JSON.stringify(w.ctx.S).indexOf('handoff-create'), -1);
}

R.section('=== 11. UNRELATED RECORDS ARE NOT TOUCHED ===');
{
  const other=existing({id:'sh_keep',name:'Untouched Show',startDate:'2099-12-25',
    boothCost:400,notes:'do not touch',location:'Somewhere'});
  const w=world([other]);
  const before=JSON.stringify(other);
  w.apply([HANDOFF({event_name:'Brand New',event_date_start:'2099-11-11',booth_fee:70,status:'Accepted'})]);
  chk('the pre-existing show is byte-for-byte unchanged',
      JSON.stringify(w.ctx.S.shows.find(s=>s.id==='sh_keep')), before);
  chk('and the new one was added alongside it', w.ctx.S.shows.length, 2);
}

R.done();
