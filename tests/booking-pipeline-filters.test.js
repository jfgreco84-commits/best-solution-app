// Booking Pipeline tap-to-filter — SYNTHETIC FIXTURES ONLY.
//
// The three pipeline cards on the Shows page are buttons that filter the
// Upcoming list. The point of these tests is the invariant that motivated the
// feature: a card's displayed count and the list it opens must never disagree,
// because both read pipelineBuckets(). Every show below is invented; no real
// export and no real financial figure is committed here.
//
//   node tests/booking-pipeline-filters.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const KEY='dd_bs_ui_pipefilter';

// ---- fixtures -------------------------------------------------------------
// Dates are pinned far enough out that isMissed() is false whenever the suite
// runs; "past" is pinned far enough back that it is always missed.
const FUTURE='2099-06-15', PAST='2000-06-15';

function sh(o){
  return Object.assign({id:o.id,name:o.name,status:'planned',startDate:FUTURE,numDays:1,
    location:'Somewhere, IL',miles:10,boothCost:0,boothPayments:[],days:[],
    showExpenses:[],workers:[],repIds:[],costs:{},prices:null,confirmed:true},o);
}
const pay=(amt)=>[{id:'bp',date:'2026-01-05',amount:amt,method:'card',note:'booth'}];

// 3 booth-paid · 2 owe ($120 + $45.50 = $165.50) · 2 pending
// plus decoys that must stay out of every bucket.
function fixtureShows(){
  return [
    sh({id:'p1',name:'Paid One',   boothCost:100,boothPayments:pay(100)}),
    sh({id:'p2',name:'Paid Two',   boothCost:75, boothPayments:pay(80)}),   // overpaid
    sh({id:'p3',name:'Paid Three', boothCost:50, boothPayments:pay(30).concat(pay(20))}),
    sh({id:'o1',name:'Owe One',    boothCost:200,boothPayments:pay(80), depositDue:'2099-09-30'}),
    sh({id:'o2',name:'Owe Two',    boothCost:45.5,boothPayments:[]}),
    sh({id:'n1',name:'Pending One',boothCost:0,  confirmed:false}),
    sh({id:'n2',name:'Pending Two',boothCost:60, boothPayments:pay(10),confirmed:false}),
    // decoys
    sh({id:'d1',name:'No Booth Cost',   boothCost:0}),
    sh({id:'d2',name:'Active Show',     boothCost:90,boothPayments:pay(90),status:'active'}),
    sh({id:'d3',name:'Completed Show',  boothCost:90,boothPayments:pay(90),status:'completed'}),
    sh({id:'d4',name:'Missed Show',     boothCost:90,boothPayments:[],startDate:PAST}),
  ];
}

// ---- world ----------------------------------------------------------------
// Gives rShows() a stable #pg-shows to write into and records scrollIntoView.
function world(seed){
  const h=boot(seed);
  if(h.bootError)throw h.bootError;
  const {ctx}=h;
  const page={innerHTML:''};
  const scrolls=[];
  const focused=[];
  const anchor={scrollIntoView(opt){scrolls.push(opt||{});}};
  const nodes={'pg-shows':page,'showsListTop':anchor};
  ['paid','owe','pending'].forEach(k=>{nodes['pf-'+k]={focus(opt){focused.push([k,(opt&&opt.preventScroll)||false]);}};});
  const base=ctx.document.getElementById;
  ctx.document.getElementById=(id)=>nodes[id]||base(id);
  ctx.$$=ctx.document.getElementById;

  ctx.S.shows=fixtureShows();
  ctx.showsTab='upcoming';
  ctx.shows2025Mode=false;
  // saveS() would write state and kick the cloud queue; nothing here needs it.
  ctx.saveS=()=>{};
  return {h,ctx,page,scrolls,focused,store:h.store,
    html:()=>page.innerHTML,
    // The show cards rShows() emitted, in order. showCard() opens with
    // `<div class="sc ` and nothing nested inside it reuses that class.
    cards:()=>(page.innerHTML.match(/onclick="go\('show','([^']+)',0\)"/g)||[])
      .map(m=>m.match(/'show','([^']+)'/)[1]),
    pressed:()=>['paid','owe','pending'].filter(k=>
      new RegExp('id="pf-'+k+'" aria-pressed="true"').test(page.innerHTML))};
}

// =========================================================================
R.section('=== 1. BUCKETS ARE THE SINGLE SOURCE OF TRUTH ===');
{
  const w=world();
  const up=w.ctx.S.shows.filter(s=>w.ctx.isUpcoming(s));
  const B=w.ctx.pipelineBuckets(up);
  chk('upcoming excludes completed and missed', up.map(s=>s.id).sort(),
      ['d1','d2','n1','n2','o1','o2','p1','p2','p3']);
  chk('planned excludes the active show', B.planned.map(s=>s.id).sort(),
      ['d1','n1','n2','o1','o2','p1','p2','p3']);
  chk('booth paid = 3', B.paid.map(s=>s.id), ['p1','p2','p3']);
  chk('owe booth = 2', B.owe.map(s=>s.id), ['o1','o2']);
  chk('pending / applied = 2', B.pending.map(s=>s.id), ['n1','n2']);
  chk('owe total is the sum of the same rows', B.oweTotal, 165.5);
  chk('owe total equals the bucket recomputed independently',
      B.oweTotal, B.owe.reduce((t,s)=>t+w.ctx.boothBalance(s),0));
  chk('a show with no booth cost is in no bucket',
      ['paid','owe','pending'].filter(k=>B[k].some(s=>s.id==='d1')), []);
  chk('buckets do not mutate the show list', w.ctx.S.shows.length, 11);
  chk('null-safe on an empty season',
      w.ctx.pipelineBuckets([]).planned.length + w.ctx.pipelineBuckets(null).planned.length, 0);
}

R.section('=== 2. EACH CARD\'S LIST EXACTLY EQUALS ITS COUNT ===');
{
  for(const [key,label,ids] of [['paid','Booth Paid',['p1','p2','p3']],
                                ['owe','Owe Booth',['o1','o2']],
                                ['pending','Pending / Applied',['n1','n2']]]){
    const w=world();
    w.ctx.rShows();
    const unfiltered=w.cards();
    // The number the card renders, read back out of the DOM the app produced.
    const card=w.html().match(new RegExp('id="pf-'+key+'"[\\s\\S]*?class="sv sm [^"]*">(\\d+)<'));
    const shown=card?parseInt(card[1],10):-1;

    w.ctx.setPipelineFilter(key);
    chk(key+': list equals the count on the card', w.cards().length, shown);
    chk(key+': list is exactly the bucket rows', w.cards(), ids);
    chk(key+': the other upcoming shows are gone',
        unfiltered.filter(id=>!ids.includes(id)).some(id=>w.cards().includes(id)), false);
    chk(key+': banner names the filter and the count',
        w.html().includes('Showing: '+label+' ('+ids.length+')'), true);
    chk(key+': only that card reads as pressed', w.pressed(), [key]);
    chk(key+': it scrolled down to the list', w.scrolls.length, 1);
    chk(key+': the scroll targets the list anchor', w.html().includes('id="showsListTop"'), true);
  }
}

R.section('=== 3. OWE BOOTH MATCHES THE DOLLAR TOTAL ON THE CARD ===');
{
  const w=world();
  w.ctx.rShows();
  const B=w.ctx.pipelineBuckets(w.ctx.S.shows.filter(s=>w.ctx.isUpcoming(s)));
  const total=w.ctx.fmt(B.oweTotal);
  chk('the card shows the total', w.html().includes(total+' total'), true);
  w.ctx.setPipelineFilter('owe');
  chk('the filtered list carries the same total', w.html().includes(total+' owed'), true);
  chk('and the rows in it add up to exactly that',
      w.ctx.fmt(w.cards().map(id=>w.ctx.S.shows.find(s=>s.id===id))
        .reduce((t,s)=>t+w.ctx.boothBalance(s),0)), total);
}

R.section('=== 4. CLEAR FILTER / TAP-AGAIN ===');
{
  const w=world();
  w.ctx.rShows();
  const all=w.cards();
  chk('nothing is pressed to start', w.pressed(), []);
  chk('no banner to start', w.html().includes('Showing:'), false);

  w.ctx.setPipelineFilter('paid');
  chk('filtered down', w.cards().length, 3);
  chk('a Show All button is offered', w.html().includes('✕ Show All ('+all.length+')'), true);

  w.ctx.clearPipelineFilter();
  chk('Show All restores the whole Upcoming list', w.cards(), all);
  chk('the banner is gone', w.html().includes('Showing:'), false);
  chk('no card is pressed', w.pressed(), []);
  chk('the stored preference is cleared', w.store[KEY], undefined);

  w.ctx.setPipelineFilter('owe');
  chk('re-filtered', w.cards(), ['o1','o2']);
  const before=w.scrolls.length;
  chk('tapping the active card again clears it', w.ctx.setPipelineFilter('owe'), null);
  chk('  and the full list is back', w.cards(), all);
  chk('  and clearing does not scroll', w.scrolls.length, before);

  chk('switching to another card swaps the filter',
      [w.ctx.setPipelineFilter('paid'), w.ctx.setPipelineFilter('pending')].join(','), 'paid,pending');
  chk('  leaving only the last one pressed', w.pressed(), ['pending']);
  chk('an unknown key is ignored, not applied', w.ctx.setPipelineFilter('bogus'), null);
  chk('  and leaves the full list', w.cards(), all);
}

R.section('=== 5. SURVIVES A REFRESH ===');
{
  const w=world();
  w.ctx.setPipelineFilter('owe');
  chk('the choice is stored outside S', w.store[KEY], 'owe');
  chk('S is not where it went', JSON.stringify(w.ctx.S).includes('pipefilter'), false);

  // Refresh: a brand new sandbox that finds the key already on the device.
  const w2=world({[KEY]:'owe'});
  chk('the filter is restored on load', w2.ctx.pipelineFilter, 'owe');
  w2.ctx.rShows();
  chk('  and the list renders filtered', w2.cards(), ['o1','o2']);
  chk('  with the banner', w2.html().includes('Showing: Owe Booth (2)'), true);
  chk('  and the card pressed', w2.pressed(), ['owe']);

  const w3=world({[KEY]:'garbage'});
  chk('a junk stored value is ignored', w3.ctx.pipelineFilter, null);
  w3.ctx.rShows();
  chk('  and the full list renders', w3.cards().length, 9);
}

R.section('=== 6. COMPLETED / MISSED / 2025 ARE UNTOUCHED ===');
{
  const w=world({[KEY]:'paid'});
  w.ctx.showsTab='completed'; w.ctx.rShows();
  chk('completed tab ignores the pipeline filter', w.cards(), ['d3']);
  chk('  and shows no pipeline card', w.html().includes('Booking Pipeline'), false);
  chk('  and no filter banner', w.html().includes('Showing:'), false);

  w.ctx.pipelineFilter='owe';
  w.ctx.showsTab='missed'; w.ctx.rShows();
  chk('missed tab ignores it too', w.cards(), ['d4']);
  chk('  and still warns about missed shows', w.html().includes("dates passed"), true);

  w.ctx.pipelineFilter='paid';
  w.ctx.shows2025Mode=true; w.ctx.rShows();
  chk('2025 season view is unaffected', w.html().includes('2025 SEASON TOTALS'), true);
  chk('  and renders no pipeline filter UI', w.html().includes('class="sbox grb pf"'), false);

  // Switching tabs drops a filter that only means anything on Upcoming.
  w.ctx.shows2025Mode=false;
  w.ctx.pipeFilterReset();
  chk('pipeFilterReset clears memory and storage',
      [w.ctx.pipelineFilter, w.store[KEY]], [null, undefined]);
}

R.section('=== 7. ACCESSIBILITY ===');
{
  const w=world();
  w.ctx.rShows();
  const html=w.html();
  for(const k of ['paid','owe','pending']){
    chk(k+' is a real button', new RegExp('<button type="button" class="sbox[^"]*pf" id="pf-'+k+'"').test(html), true);
    chk(k+' exposes toggle state', html.includes('id="pf-'+k+'" aria-pressed="false"'), true);
    chk(k+' names what it controls', new RegExp('id="pf-'+k+'"[\\s\\S]{0,200}aria-controls="showsListTop"').test(html), true);
    chk(k+' has a spoken label', new RegExp('id="pf-'+k+'"[\\s\\S]{0,300}aria-label="[^"]+"').test(html), true);
  }
  chk('the three sit in a labelled group', html.includes('role="group" aria-label="Booking pipeline filters"'), true);
  w.ctx.setPipelineFilter('paid');
  chk('the active one flips aria-pressed', w.html().includes('id="pf-paid" aria-pressed="true"'), true);
  chk('the banner announces itself', w.html().includes('role="status" aria-live="polite"'), true);

  // The page is re-rendered from scratch on every tap, so a keyboard user would
  // be dumped back at the top of the document without this.
  chk('focus lands back on the card that was activated', w.focused, [['paid',true]]);
  w.ctx.setPipelineFilter('paid');
  chk('  and again when the same card clears the filter', w.focused[1], ['paid',true]);
  w.ctx.setPipelineFilter('owe');
  w.ctx.clearPipelineFilter();
  chk('  and Show All returns focus to the card it cleared',
      w.focused[w.focused.length-1], ['owe',true]);
  chk('an unknown key focuses nothing', (w.ctx.setPipelineFilter('nope'), w.focused.length), 4);
}

R.section('=== 8. NO SHOW RECORD IS MODIFIED ===');
{
  const w=world();
  const before=JSON.stringify(w.ctx.S.shows);
  // Whatever the app wrote while booting is not this feature's doing; only the
  // keys that appear *after* the first tap belong to it.
  const keysAtBoot=Object.keys(w.store).sort();
  w.ctx.rShows();
  w.ctx.setPipelineFilter('paid'); w.ctx.setPipelineFilter('owe');
  w.ctx.setPipelineFilter('pending'); w.ctx.clearPipelineFilter();
  w.ctx.showsTab='completed'; w.ctx.rShows();
  w.ctx.showsTab='upcoming'; w.ctx.setPipelineFilter('owe'); w.ctx.rShows();
  chk('every show record is byte-for-byte unchanged', JSON.stringify(w.ctx.S.shows), before);
  chk('the app state key was never written', w.store['dd_bs_v7'], undefined);
  chk('filtering added exactly one key, the UI preference',
      Object.keys(w.store).sort().filter(k=>!keysAtBoot.includes(k)), [KEY]);
  chk('  and rewrote none of the keys that were already there',
      keysAtBoot.filter(k=>!(k in w.store)), []);
}

R.done();
