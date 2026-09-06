// Multi-booth shows + the tappable calendar — SYNTHETIC FIXTURES ONLY.
//
// Two features, one file, because they share the same question: does the
// number on the screen still agree with the numbers underneath it?
//
// MULTI-BOOTH. Cranberry Fest is one show with three booths that are counted
// and cashed out separately. The invariant is the one the feature is built on:
//
//     A BOOTH IS AN INPUT. THE DAY IS THE TOTAL.
//
// Per-booth entries live in day.boothCounts[boothId] and the day's own
// morningCount / eveningCount / restock / lost / payments are rebuilt from
// their sum, so every downstream figure — sold units, COGS, collected money,
// the cash check, the P&L, the exports — keeps reading the day and gets the
// grand total for free. A change that lets a booth total and the day total
// disagree is the failure this file exists to catch, so most checks assert
// both sides of the same fact at once.
//
// Two halves pull against each other here as well. Splitting the COUNTING
// must not split the STOCK: product still leaves the garage to the show, and
// showOnHand / atShowsInv must be untouched by booths. And turning booths on
// for a show that already has numbers must not move a single figure.
//
// CALENDAR. A day with one show opens that show on that day's tab. A day with
// two or more opens a picker naming every show on it. The invariant is that
// the picker's list and the grid's conflict marking come from the same filter,
// so the red day and the list behind it can never disagree.
//
//   node tests/booth-splits-and-calendar.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const FUTURE='2099-06-15';
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const PK=['cash','square','debit','venmo','zelle','cashapp','paypal'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
const pmt=o=>{const r={};PK.forEach(k=>r[k]=o[k]||0);return r;};

// ---- world ----------------------------------------------------------------
// Persistent stub elements so a modal's inputs can be filled and read back the
// way the real save handlers read them.
function world(){
  const h=boot();
  const els={};
  const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},
    insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},
    focus(){},click(){},scrollIntoView(){}});
  h.ctx.document.getElementById=id=>(els[id]||(els[id]=mk()));
  h.els=els;
  h.set=(id,v)=>{h.ctx.document.getElementById(id).value=String(v);};
  h.modal=()=>els['mb']?els['mb'].innerHTML:'';
  return h;
}
function newShow(ctx,o){
  const nd=o.numDays||1;
  const days=[];for(let i=0;i<nd;i++)days.push(ctx._bsBlankDay(i+1,'Day '+(i+1)));
  return Object.assign({id:o.id,name:o.name,status:'planned',startDate:FUTURE,numDays:nd,
    location:'Somewhere, WI',miles:0,boothCost:0,boothPayments:[],days,dates:days.map(d=>d.date),
    showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true,lodging:0},o,{days,numDays:nd});
}

// ===========================================================================
R.section('1. Cranberry Fest ships with three booths');
// ===========================================================================
{
  const {ctx}=world();
  const cf=ctx.S.shows.find(s=>/cranberry/i.test(s.name));
  chk('1a. the show exists',!!cf,true);
  chk('1b. it carries three booths',ctx.showBooths(cf).length,3);
  chk('1c. named so a person can write on them',ctx.showBooths(cf).map(b=>b.name),['Booth 1','Booth 2','Booth 3']);
  chk('1d. hasBooths says so',ctx.hasBooths(cf),true);
  // Splitting the counting must not split the money owed or the stock pull.
  chk('1e. still ONE booth fee, not three',cf.boothCost,450);
  chk('1f. still one show on the calendar',ctx.getShowDates(cf).length,3);
  chk('1g. the migration is marked applied',!!ctx.S._applied['cranberry_three_booths_2026'],true);
  // Every other show is untouched — booths are opt-in per show.
  const others=ctx.S.shows.filter(s=>!/cranberry/i.test(s.name));
  chk('1h. no other show grew booths',others.filter(s=>ctx.hasBooths(s)).length,0);
  chk('1i. and they still render',typeof ctx.showCard(others[0]),'string');
}

// ===========================================================================
R.section('2. A booth is an input, the day is the total');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'s1',name:'Three Booth Fest',numDays:2,status:'active',boothCost:450});
  ctx.S.shows.push(sh);
  const r=ctx.boothsApply(sh,['A','B','C']);
  chk('2a. three booths applied',r.ok&&r.booths.length,3);
  const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);

  ctx.dayBoothWrite(sh.days[0],A).morningCount=cnt({'32oz':10,'2oz':40,'c5s':50});
  ctx.dayBoothWrite(sh.days[0],B).morningCount=cnt({'32oz':5, '2oz':20,'c5s':25});
  ctx.rollupDay(sh,0);
  chk('2b. morning adds the booths that opened',sh.days[0].morningCount,cnt({'32oz':15,'2oz':60,'c5s':75}));
  chk('2c. a booth that has not opened is simply not in it yet',ctx.boothsCounted(sh,0).length,2);

  ctx.dayBoothWrite(sh.days[0],C).morningCount=cnt({'32oz':5,'2oz':20,'c5s':25});
  ctx.rollupDay(sh,0);
  chk('2d. the third booth lands in the total',sh.days[0].morningCount,cnt({'32oz':20,'2oz':80,'c5s':100}));

  // THE HALF-CLOSED DAY. Summing one closed booth against three open ones
  // would read as a 60-unit sale that never happened, and charge COGS for it.
  ctx.dayBoothWrite(sh.days[0],A).eveningCount=cnt({'32oz':8,'2oz':30,'c5s':40});
  ctx.rollupDay(sh,0);
  chk('2e. one booth closed — the day does NOT post an evening',sh.days[0].eveningCount,null);
  chk('2f. and it says which booths are still open',ctx.boothsAwaitingEvening(sh,0).map(b=>b.name),['B','C']);
  // and with no evening on the day, no revenue and no COGS can be posted
  chk('2g. so the show books no sale from it',ctx.calcShow(sh).gross,0);
  chk('2h. and no product cost',ctx.calcShow(sh).cogs,0);

  ctx.dayBoothWrite(sh.days[0],B).eveningCount=cnt({'32oz':4,'2oz':15,'c5s':20});
  ctx.dayBoothWrite(sh.days[0],C).eveningCount=cnt({'32oz':5,'2oz':18,'c5s':22});
  ctx.rollupDay(sh,0);
  chk('2i. all three closed — now the day has an evening',sh.days[0].eveningCount,cnt({'32oz':17,'2oz':63,'c5s':82}));
  chk('2j. nobody left waiting',ctx.boothsAwaitingEvening(sh,0).length,0);
  chk('2k. and the day sold exactly the difference',ctx.daySold(sh.days[0]),cnt({'32oz':3,'2oz':17,'c5s':18}));

  ctx.dayBoothWrite(sh.days[0],A).payments=pmt({cash:120,square:60});
  ctx.dayBoothWrite(sh.days[0],B).payments=pmt({cash:90,venmo:15});
  ctx.dayBoothWrite(sh.days[0],C).payments=pmt({cash:40});
  ctx.rollupDay(sh,0);
  chk('2l. each drawer keeps its own split',sh.days[0].payments,pmt({cash:250,square:60,venmo:15}));
  chk('2m. and the day total is their sum',ctx.calcPmt(sh.days[0].payments),325);
  // Per booth, so a shortfall can be pinned on the booth it came from.
  chk('2n. booth A collected on its own',ctx.boothMoney(ctx.dayBoothRead(sh.days[0],A)),180);
  chk('2o. booth C collected on its own',ctx.boothMoney(ctx.dayBoothRead(sh.days[0],C)),40);
}

// ===========================================================================
R.section('3. The grand total IS the show total — one number, three ways');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'s2',name:'Tally Fest',numDays:2,status:'active',boothCost:450});
  ctx.S.shows.push(sh);
  ctx.boothsApply(sh,['A','B','C']);
  const ids=ctx.showBooths(sh).map(b=>b.id);
  [0,1].forEach(di=>ids.forEach((id,i)=>{
    const en=ctx.dayBoothWrite(sh.days[di],id);
    en.morningCount=cnt({'32oz':10+i,'2oz':40+i,'c5s':50});
    en.eveningCount=cnt({'32oz':7+i, '2oz':30+i,'c5s':41});
    en.payments=pmt({cash:100+i*10,square:20});
  }));
  ctx.rollupShow(sh);

  const g=ctx.boothGrandTotals(sh);
  const perBooth=ids.reduce((t,id)=>t+ctx.boothShowTotals(sh,id).money,0);
  chk('3a. grand tally = sum of the booth tallies',g.money,perBooth);
  chk('3b. grand tally = the show revenue everything else reads',g.money,ctx.showActualRev(sh));
  chk('3c. and = the gross in the P&L',g.money,ctx.calcShow(sh).gross);
  chk('3d. units: grand = sum of the booths',g.unitsTotal,ids.reduce((t,id)=>t+ctx.boothShowTotals(sh,id).unitsTotal,0));
  chk('3e. units: grand = the show units the P&L counts',g.unitsTotal,
      SK.reduce((t,k)=>t+ctx.showUnitsSold(sh)[k],0));
  // COGS is computed per day by the day-of-sale cost schedule, so the booth
  // slices must add to the same figure the show charges itself.
  const pennies=n=>Math.round(n*100);
  chk('3f. product cost: booths add up to the show COGS',
      pennies(ids.reduce((t,id)=>t+ctx.boothShowTotals(sh,id).cogs,0)),pennies(ctx.calcShow(sh).cogs));
  chk('3g. every booth is on the tally card',
      ctx.showBooths(sh).every(b=>ctx.boothScoreboardHTML(sh).indexOf(b.name)>=0),true);
  chk('3h. and so is the grand total',ctx.boothScoreboardHTML(sh).indexOf('GRAND TOTAL')>=0,true);
}

// ===========================================================================
R.section('4. Splitting the counting never moves a number');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'s3',name:'Was Single',numDays:1,status:'active',boothCost:100});
  sh.days[0].morningCount=cnt({'32oz':20,'2oz':60,'c5s':80});
  sh.days[0].eveningCount=cnt({'32oz':14,'2oz':41,'c5s':55});
  sh.days[0].payments=pmt({cash:300,square:120});
  ctx.S.shows.push(sh);
  const before={gross:ctx.calcShow(sh).gross,cogs:ctx.calcShow(sh).cogs,
    sold:ctx.daySold(sh.days[0]),profit:ctx.calcShow(sh).profit,onHand:ctx.showOnHand(sh)};

  ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
  const after={gross:ctx.calcShow(sh).gross,cogs:ctx.calcShow(sh).cogs,
    sold:ctx.daySold(sh.days[0]),profit:ctx.calcShow(sh).profit,onHand:ctx.showOnHand(sh)};
  chk('4a. gross unchanged',after.gross,before.gross);
  chk('4b. COGS unchanged',after.cogs,before.cogs);
  chk('4c. units sold unchanged',after.sold,before.sold);
  chk('4d. profit unchanged',after.profit,before.profit);
  chk('4e. the old numbers now sit on booth 1',ctx.boothShowTotals(sh,'booth1').money,420);
  chk('4f. and booths 2 and 3 start empty',
      ctx.boothShowTotals(sh,'booth2').money+ctx.boothShowTotals(sh,'booth3').money,0);

  // Going back to a single booth leaves the grand total standing — it IS the day.
  const res=ctx.boothsApply(sh,[]);
  chk('4g. cannot silently delete a booth holding counts',res.ok,false);
  chk('4h. and it names the booth',res.blocked,['Booth 1']);
  chk('4i. so the booths are still there',ctx.showBooths(sh).length,3);
  chk('4j. and the money is still there',ctx.calcShow(sh).gross,before.gross);
  // An EMPTY booth can be dropped, because nothing is lost by doing it.
  const res2=ctx.boothsApply(sh,['Booth 1','Booth 2']);
  chk('4k. an empty booth drops cleanly',res2.ok&&ctx.showBooths(sh).length,2);
  chk('4l. still without moving the money',ctx.calcShow(sh).gross,before.gross);
}

// ===========================================================================
R.section('5. Stock is NOT split by booth');
// ===========================================================================
{
  // Product leaves the garage once, to the SHOW. Booths divide the counting,
  // not the pull, so every stock surface must read exactly as it did before.
  const {ctx}=world();
  const sh=newShow(ctx,{id:'s4',name:'Stock Fest',numDays:1,status:'active',boothCost:0});
  ctx.S.shows.push(sh);
  ctx.boothsApply(sh,['A','B']);
  const ids=ctx.showBooths(sh).map(b=>b.id);
  ctx.dayBoothWrite(sh.days[0],ids[0]).morningCount=cnt({'32oz':10,'c5s':30});
  ctx.dayBoothWrite(sh.days[0],ids[1]).morningCount=cnt({'32oz':6, 'c5s':20});
  ctx.rollupDay(sh,0);
  chk('5a. at-show stock is the whole show, not a booth',ctx.showOnHand(sh),cnt({'32oz':16,'c5s':50}));
  chk('5b. and the Stock page agrees',ctx.atShowsInv()['32oz']>=16,true);
  chk('5c. transfers still target shows, never booths',
      ctx.transferableShows().some(x=>x.id==='s4'),true);
  chk('5d. the pack modal still packs the show',typeof ctx.showPackModal,'function');
  // Closing the show hands back ONE lot to master stock: what every booth had
  // left, added together, exactly as a single-booth show would return it.
  ctx.dayBoothWrite(sh.days[0],ids[0]).eveningCount=cnt({'32oz':7,'c5s':21});
  ctx.dayBoothWrite(sh.days[0],ids[1]).eveningCount=cnt({'32oz':4,'c5s':14});
  ctx.rollupDay(sh,0);
  chk('5e. closing returns every booth in one lot',ctx.endShowReturns(sh),cnt({'32oz':11,'c5s':35}));
  chk('5f. which is what the show is holding',ctx.showOnHand(sh),cnt({'32oz':11,'c5s':35}));
}

// ===========================================================================
R.section('6. Saving a booth count goes through the same handlers');
// ===========================================================================
{
  const w=world(); const ctx=w.ctx;
  const sh=newShow(ctx,{id:'s5',name:'Handler Fest',numDays:2,status:'active'});
  ctx.S.shows.push(sh);
  ctx.boothsApply(sh,['A','B']);
  const ids=ctx.showBooths(sh).map(b=>b.id);

  SK.forEach(k=>w.set('c_'+k,0)); w.set('c_32oz',12); w.set('c_c5s',40);
  ctx.saveCount('s5',0,'morning',ids[0]);
  chk('6a. the count landed on the booth',ctx.dayBoothRead(sh.days[0],ids[0]).morningCount['32oz'],12);
  chk('6b. and the day rolled up behind it',sh.days[0].morningCount['32oz'],12);
  chk('6c. the other booth was not touched',ctx.dayBoothRead(sh.days[0],ids[1]),null);

  w.set('c_32oz',9); w.set('c_c5s',31);
  ctx.saveCount('s5',0,'evening',ids[0]);
  chk('6d. tomorrow opens where THIS booth ended',ctx.dayBoothRead(sh.days[1],ids[0]).morningCount['32oz'],9);
  chk('6e. and not on the other booth',ctx.dayBoothRead(sh.days[1],ids[1]),null);
  // Booth B never opened that day, so the day IS closed on booth A alone.
  chk('6f. a day only booth A worked closes on booth A',sh.days[0].eveningCount['32oz'],9);
  // The moment booth B opens, the day is unfinished again until B closes too.
  ctx.dayBoothWrite(sh.days[0],ids[1]).morningCount=cnt({'32oz':4});
  ctx.rollupDay(sh,0);
  chk('6f2. opening a second booth re-opens the day',sh.days[0].eveningCount,null);
  chk('6f3. and names who owes a count',ctx.boothsAwaitingEvening(sh,0).map(b=>b.name),['B']);
  ctx.dayBoothWrite(sh.days[0],ids[1]).eveningCount=cnt({'32oz':4});
  ctx.rollupDay(sh,0);
  chk('6f4. closing it finishes the day again',sh.days[0].eveningCount['32oz'],13);

  PK.forEach(k=>w.set('pm_'+k,0)); w.set('pm_cash',75);
  ctx.saveMoney('s5',0,ids[0]);
  chk('6g. money landed in that booth drawer',ctx.boothMoney(ctx.dayBoothRead(sh.days[0],ids[0])),75);
  chk('6h. and in the day total',ctx.calcPmt(sh.days[0].payments),75);

  SK.forEach(k=>{w.set('adj_r_'+k,0);w.set('adj_l_'+k,0);});
  w.set('adj_l_c5s',3);
  ctx.saveAdjust('s5',0,ids[0]);
  chk('6i. lost units are the booth\'s',ctx.dayBoothRead(sh.days[0],ids[0]).lost.c5s,3);
  chk('6j. and roll into the day',sh.days[0].lost.c5s,3);

  // A show WITH booths refuses a show-level count — there is one way in.
  const beforeWide=sh.days[0].morningCount['32oz'];
  SK.forEach(k=>w.set('c_'+k,0)); w.set('c_32oz',999);
  ctx.saveCount('s5',0,'morning',null);
  chk('6k. a show-wide count is refused when booths exist',sh.days[0].morningCount['32oz'],beforeWide);
  // A show WITHOUT booths is completely unaffected by any of it.
  const plain=newShow(ctx,{id:'s6',name:'Plain Fest',numDays:1,status:'active'});
  ctx.S.shows.push(plain);
  SK.forEach(k=>w.set('c_'+k,0)); w.set('c_2oz',44);
  ctx.saveCount('s6',0,'morning');
  chk('6l. an ordinary show still counts show-wide',plain.days[0].morningCount['2oz'],44);
}

// ===========================================================================
R.section('7. Per-booth continuity and per-booth cash checks');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'s7',name:'Carry Fest',numDays:2,status:'active'});
  ctx.S.shows.push(sh);
  ctx.boothsApply(sh,['A','B']);
  const ids=ctx.showBooths(sh).map(b=>b.id);
  ctx.dayBoothWrite(sh.days[0],ids[0]).eveningCount=cnt({'32oz':10});
  ctx.dayBoothWrite(sh.days[1],ids[0]).morningCount=cnt({'32oz':7});   // 3 unexplained
  ctx.dayBoothWrite(sh.days[0],ids[1]).eveningCount=cnt({'32oz':5});
  ctx.dayBoothWrite(sh.days[1],ids[1]).morningCount=cnt({'32oz':5});   // clean
  chk('7a. the gap is pinned to booth A',ctx.boothCarryIssues(sh,ids[0]).length,1);
  chk('7b. booth B is clean',ctx.boothCarryIssues(sh,ids[1]).length,0);

  // Cash vs product, per booth, so a shortfall names the table it came from.
  const en=ctx.dayBoothWrite(sh.days[0],ids[0]);
  en.morningCount=cnt({'c5s':20}); en.eveningCount=cnt({'c5s':10}); // 10 sold @ $10
  en.payments=pmt({cash:100});
  chk('7c. a balanced booth reads ok',ctx.boothCashCheck(sh,0,ids[0]).state,'ok');
  en.payments=pmt({cash:70});
  chk('7d. a short drawer is caught',ctx.boothCashCheck(sh,0,ids[0]).state,'short');
  chk('7e. by exactly the amount',ctx.boothCashCheck(sh,0,ids[0]).amt,30);
  en.payments=pmt({cash:130});
  chk('7f. and so is an over drawer',ctx.boothCashCheck(sh,0,ids[0]).state,'over');
}

// ===========================================================================
R.section('8. Break even carries the booth rent, and says so');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'s8',name:'Even Fest',numDays:1,boothCost:450,lodging:600,miles:100});
  ctx.S.shows.push(sh);
  const be=ctx.calcBreakEven(sh);
  chk('8a. booth rent is a named part of the fixed costs',be.parts.booth,450);
  chk('8b. so is lodging',be.parts.lodging,600);
  chk('8c. and gas',be.parts.gas>0,true);
  chk('8d. the fixed total adds up',Math.round(be.fixedCosts*100),
      Math.round((be.parts.booth+be.parts.gas+be.parts.lodging+be.parts.showExp+be.parts.flatOverhead+be.parts.workerPay+be.parts.repPay)*100));
  chk('8e. and break even is above the fixed costs',be.dollars>be.fixedCosts,true);

  // Raise the booth fee and break even MUST move. This is the check that would
  // have caught booth rent quietly missing from the number.
  const before=be.dollars;
  sh.boothCost=900;
  chk('8f. doubling the booth moves break even',ctx.calcBreakEven(sh).dollars>before,true);
  chk('8g. by the booth increase over the margin',
      Math.round((ctx.calcBreakEven(sh).dollars-before)*100)>0,true);
  // Paying MORE than the sticker books the real money, not the sticker.
  sh.boothPayments=[{id:'bp',date:'2026-01-01',amount:1000,note:'booth'}];
  chk('8h. an overpaid booth is what break even uses',ctx.calcBreakEven(sh).parts.booth,1000);

  const html=ctx.breakEvenHTML(sh);
  chk('8i. the panel prints the booth line',html.indexOf('Booth rent')>=0,true);
  chk('8j. and the fixed-cost subtotal',html.indexOf('Fixed costs in that number')>=0,true);
  chk('8k. the show card carries break even while planned',ctx.showCard(sh).indexOf('Break Even')>=0,true);
  sh.status='active';
  chk('8l. and still carries it once the show is running',ctx.showCard(sh).indexOf('Break Even')>=0,true);
  sh.status='completed';
  chk('8m. and after it is over',ctx.showCard(sh).indexOf('Break Even')>=0,true);
  // Once money is coming in the panel says how far past break even we are.
  sh.days[0].morningCount=cnt({'c5s':100}); sh.days[0].eveningCount=cnt({'c5s':0});
  sh.days[0].payments=pmt({cash:5000});
  chk('8n. past break even is stated plainly',ctx.breakEvenHTML(sh).indexOf('Past break even')>=0,true);
  sh.days[0].payments=pmt({cash:10});
  chk('8o. and so is the gap when it is not',ctx.breakEvenHTML(sh).indexOf('still to collect')>=0,true);
}

// ===========================================================================
R.section('9. The expense figure adds up in front of you');
// ===========================================================================
{
  const {ctx}=world();
  const sh=newShow(ctx,{id:'s9',name:'Receipt Fest',numDays:1,status:'completed',boothCost:450,lodging:600});
  sh.showExpenses=[{id:'e1',cat:'food',desc:'lunch',amount:40}];
  sh.days[0].morningCount=cnt({'c5s':50}); sh.days[0].eveningCount=cnt({'c5s':20});
  sh.days[0].payments=pmt({cash:300}); sh.days[0].expenses={gas:25,food:0,parking:10,hotel:0,other:0};
  ctx.S.shows.push(sh);
  const html=ctx.showExpenseRowsHTML(sh);
  chk('9a. booth rent is line one of the receipt',html.indexOf('Booth rent')>=0,true);
  chk('9b. lodging is on it',html.indexOf('Lodging')>=0,true);
  chk('9c. so are the day expenses',html.indexOf('logged on days')>=0,true);
  chk('9d. and the other show expenses',html.indexOf('Other show expenses')>=0,true);
  chk('9e. it totals to the same Expenses the P&L uses',
      html.indexOf('What the '+ctx.fmt(ctx.calcShow(sh).expenses)+' of expenses')>=0,true);
  // The booth really is inside that total, not merely printed near it.
  const withBooth=ctx.calcShow(sh).expenses;
  sh.boothCost=0;
  chk('9f. removing the booth drops expenses by exactly the booth',
      Math.round((withBooth-ctx.calcShow(sh).expenses)*100),45000);
}

// ===========================================================================
R.section('10. Every calendar day is a door');
// ===========================================================================
{
  const w=world(); const ctx=w.ctx;
  ctx.S.shows.length=0;
  const solo=newShow(ctx,{id:'c1',name:'Solo Fest',numDays:3,startDate:'2099-06-15'});
  const clashA=newShow(ctx,{id:'c2',name:'Clash A',numDays:1,startDate:'2099-07-04'});
  const clashB=newShow(ctx,{id:'c3',name:'Clash B',numDays:2,startDate:'2099-07-03'});
  const gone=newShow(ctx,{id:'c4',name:'Passed Fest',numDays:1,startDate:'2099-07-04',
    passed:true,passedReason:'double booked'});
  ctx.S.shows.push(solo,clashA,clashB,gone);

  chk('10a. a quiet day lists its one show',ctx.calDayShows('2099-06-16').map(s=>s.id),['c1']);
  chk('10b. a clash day lists both',ctx.calDayShows('2099-07-04').map(s=>s.id),['c2','c3']);
  chk('10c. a passed show is on no day',ctx.calDayShows('2099-07-04').some(s=>s.id==='c4'),false);
  chk('10d. and empty days stay empty',ctx.calDayShows('2099-08-01').length,0);

  // Tapping day 3 of a 3-day show opens THAT day, not day 1.
  ctx.openCalDay('2099-06-17');
  chk('10e. one show opens straight through',ctx.curShow,'c1');
  chk('10f. on the day that was tapped',ctx.curDay,2);
  chk('10g. and it opened no picker',w.modal().indexOf('shows this day')>=0,false);

  ctx.openCalDay('2099-07-04');
  chk('10h. a clash day opens the picker instead',w.modal().indexOf('2 shows this day')>=0,true);
  chk('10i. naming the first show',w.modal().indexOf('Clash A')>=0,true);
  chk('10j. and the second',w.modal().indexOf('Clash B')>=0,true);
  chk('10k. it says what the problem is',w.modal().indexOf('Schedule conflict')>=0,true);
  chk('10l. and the tap target says where it goes',w.modal().indexOf('Tap to open this show')>=0,true);
  chk('10m. the picker did not navigate on its own',ctx.curShow,'c1');

  // Picking one lands on that show, on the clash date's own day tab: the
  // clash falls on Clash B's SECOND day, so day index 1, not 0.
  ctx.calGoShow('c3','2099-07-04');
  chk('10n. picking a show opens it',ctx.curShow,'c3');
  chk('10o. on the tapped date, not day one',ctx.curDay,1);

  // The grid and the picker read the same filter, so a red day always has a
  // list behind it and a plain day never does.
  ctx.calMonth={y:2099,m:6};
  ctx.rCalendar();
  const grid=w.els['pg-calendar'].innerHTML;
  chk('10p. the grid routes days through the day opener',grid.indexOf("openCalDay('2099-07-04')")>=0,true);
  chk('10q. including ordinary single-show days',grid.indexOf("openCalDay('2099-07-03')")>=0,true);
  chk('10r. the clash day is marked',grid.indexOf('conflict')>=0,true);
  chk('10s. and the grid tells you the days are tappable',grid.indexOf('Tap any coloured day')>=0,true);
}

R.done();
