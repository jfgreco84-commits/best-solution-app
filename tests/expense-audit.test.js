// v77 — expense audit: paper towels, shelf liner, lunch, no candy, gas, booth + miles fill.
// SYNTHETIC FIXTURES ONLY.
//
//   node tests/expense-audit.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const {ctx,run}=boot();
const r2=n=>Math.round(n*100)/100;
const blank=()=>({v:7,inventory:{},shows:[],reps:[],prices:{},settings:{},_applied:{}});
const full=()=>{ const d=blank(); ctx.applyOneTimeUpdates(d); return d; };
const mk=(o)=>Object.assign(ctx.buildPlannedShow({name:'Test Show',location:'Racine, WI',startDate:'2027-03-06',numDays:1}),o||{});

R.section('1. Paper towels: 2 rolls per person per day');
{ const d=full(); ctx.S=d; d.settings.paperPackPrice=18; // $3 a roll
  d.reps=[{id:'rep_self',name:'Froggy',isSelf:true,active:true},{id:'rep_a',name:'A',active:true},{id:'rep_b',name:'B',active:false}];
  const solo=mk(); chk('1a. Froggy alone, 1 day = 1 roll (estimate)',ctx.showPaperRolls(solo),1);
  const two=mk({repIds:['rep_a']}); chk('1b. 2-person booth, 1 day = 2 rolls',ctx.showPaperRolls(two),2);
  const cran=mk({numDays:3,repIds:['rep_a','rep_b']}); chk('1c. 3 people x 3 days = 9 rolls (inactive rep still worked it)',ctx.showPaperRolls(cran),9);
  chk('1d. cost = rolls x pack/6',ctx.showPaperCost(cran),27);
  const crew=mk({repIds:['rep_a'],repOnlyShow:true}); chk('1e. crew-run show: Froggy not counted',ctx.showPaperRolls(crew),1);
  const self=mk({repIds:['rep_self']}); chk('1f. Froggy listed on the crew is not counted twice',ctx.showPaperRolls(self),1);
  cran.paperRolls=16; chk('1g. a real count wins over the estimate',[ctx.showPaperRolls(cran),ctx.showPaperCost(cran)],[16,48]);
  cran.paperRolls=0; chk('1h. a real count of 0 is 0',ctx.showPaperRolls(cran),0);
  d.settings.paperRollsPerPersonDay=2; chk('1i. estimate rate comes from Setup',ctx.showPaperRolls(two),4);
  const V=ctx.bxView(d); cran.paperRolls=16; chk('1j. snapshot engine agrees',V.paperCost(cran),48); }

R.section('2. Shelf liner, lunch, no candy');
{ const d=full(); ctx.S=d;
  const sh=mk({numDays:2});
  chk('2a. liner = 2 rolls every 4 shows = half a roll @ $12.49',ctx.showLinerCost(sh),6.25);
  chk('2b. lunch = $20 x 2 days',ctx.showLunchCost(sh),40);
  sh.showExpenses=[{id:'f',cat:'food',amount:30}];
  chk('2c. $30 of food logged on a 2-day show: lunch is the other $10',ctx.showLunchCost(sh),10);
  sh.showExpenses=[{id:'f',cat:'food',amount:357}]; chk('2c2. food logged over the budget: no extra lunch',ctx.showLunchCost(sh),0);
  chk('2d. no candy function left',typeof ctx.candyPerShow,'undefined');
  chk('2e. candy gone from supplies, paper + liner added',[d.supplies.some(x=>/candy/i.test(x.name)),d.supplies.some(x=>x.id==='sup_paper'),d.supplies.some(x=>x.id==='sup_liner')],[false,true,true]);
  chk('2f. settings defaults',[d.settings.paperPackPrice,d.settings.linerRollCost,d.settings.lunchPerDay,'candyPerShow' in d.settings],[17.5,12.49,20,false]); }

R.section('3. Missed / passed shows carry no overhead');
{ const d=full(); ctx.S=d;
  const past=mk({startDate:'2025-01-04'}); chk('3a. missed show',[ctx.showPaperCost(past),ctx.showLinerCost(past),ctx.showLunchCost(past)],[0,0,0]);
  const p=mk({passed:true}); chk('3b. passed show',[ctx.showPaperCost(p),ctx.showLinerCost(p),ctx.showLunchCost(p)],[0,0,0]); }

R.section('4. calcShow books it, the receipt and P&L add up');
{ const d=full(); ctx.S=d; d.reps=[{id:'rep_self',name:'Froggy',isSelf:true,active:true}];
  const sh=mk({status:'completed',startDate:'2026-10-03',miles:20,numDays:1}); d.shows.push(sh);
  const t=ctx.calcShow(sh);
  chk('4a. lunch in calcShow',t.lunch,20);
  chk('4b. supplyCost = paper + liner',r2(t.supplyCost),r2(ctx.showPaperCost(sh)+ctx.showLinerCost(sh)));
  const V=ctx.bxView(d), v=V.calcShow(sh);
  chk('4c. snapshot engine agrees on expenses',r2(v.expenses),r2(t.expenses));
  chk('4d. snapshot engine agrees on lunch + supplies',[v.lunch,r2(v.supplyCost)],[t.lunch,r2(t.supplyCost)]);
  const html=ctx.showExpenseRowsHTML(sh);
  chk('4e. receipt names lunch and paper rolls, no candy',[/Lunch/.test(html),/paper rolls/.test(html),/candy/i.test(html)],[true,true,false]); }

R.section('5. Gas');
{ const d=full(); ctx.S=d;
  const sh=mk({miles:100,totalMiles:300,gasPrice:4,mpg:20});
  chk('5a. estimate uses totalMiles when set',r2(ctx.showGas(sh)),60);
  sh.showExpenses=[{id:'g',cat:'fuel',amount:75}];
  const be=ctx.calcBreakEven(sh);
  chk('5b. break-even: fuel receipt is the gas, estimate not added on top',[be.parts.gas,be.parts.showExp],[0,75]);
  const be2=ctx.calcBreakEven(mk({miles:35,gasPrice:4,mpg:17.5,numDays:1}));
  chk('5c. no receipt: estimate used',r2(be2.parts.gas),16);
  chk('5d. default gas moved off $3.50',d.settings.gasPrice,4.2); }

R.section('6. One-time fill on a full board');
{ const d=full();
  const f=(re,dt)=>d.shows.find(s=>re.test(s.name)&&s.startDate===dt);
  chk('6a. Rustic Fox Carol Stream Aug/Sep/Oct: $60 booth, paid',[ '2026-08-02','2026-09-06','2026-10-04'].map(dt=>{const s=f(/rustic fox/i,dt);return [s.boothCost,ctx.boothPaid?s.boothPayments.reduce((t,p)=>t+p.amount,0):0];}),[[60,60],[60,60],[60,60]]);
  const fx=f(/fox & found/i,'2026-10-17');
  chk('6b. Fox & Found Oct 17: $60 owed, confirmed',[fx.boothCost,fx.boothPayments.length,/confirmed by Froggy/.test(fx.notes)],[60,0,true]);
  const may=f(/rustic fox/i,'2026-05-03');
  chk('6c. pre-contract Rustic Fox (May): no booth, passed with a reason',[may.boothCost,may.passed,/contract/.test(may.passedReason)],[0,true,true]);
  chk('6c2. all eight pre-contract markets passed',d.shows.filter(s=>/rustic fox|fox & found/i.test(s.name)&&s.startDate<'2026-10-01'&&s.passed).length,8);
  const sm=f(/st\.? martin/i,'2026-09-06');
  chk('6c3. St. Martins $245 paid',[sm.boothCost,sm.boothPayments.reduce((t,p)=>t+p.amount,0)],[245,245]);
  chk('6c4. every Sip & Sleigh / Kris Kringle placeholder passed',d.shows.filter(s=>/sip & sleigh|kris kringle/i.test(s.name)).every(s=>s.passed),true);
  chk('6d. blank miles filled',['Polish Fest','Waukesha County Fair','McHenry County Fair','Burgoo','Baraboo'].map(n=>d.shows.find(s=>s.name.indexOf(n)>=0).miles),[32,22,45,150,110]);
  chk('6e. Maxwell Street 14 mi',d.shows.filter(s=>/maxwell/i.test(s.name)).every(s=>s.miles===14),true);
  chk('6f. finished show frozen at its month gas price',f(/rustic fox/i,'2026-08-02').gasPrice,4.05);
  chk('6g. upcoming show keeps the default',d.shows.find(s=>/women.?s expo/i.test(s.name)).gasPrice==null,true);
  ctx.applyOneTimeUpdates(d); // other seeds finish on the second load
  const keep=JSON.stringify(d.shows);
  delete d._applied['expense_audit_v77']; ctx.applyOneTimeUpdates(d);
  chk('6h. rerun changes nothing, no double payment',JSON.stringify(d.shows),keep); }

R.section('7. Never overwrites what is there');
{ const d=full(); const sh=d.shows.find(s=>/rustic fox/i.test(s.name)&&s.startDate==='2026-09-06');
  const d2=blank(); d2._applied={}; ctx.applyOneTimeUpdates(d2);
  const own=d2.shows.find(s=>/rustic fox/i.test(s.name)&&s.startDate==='2026-09-06');
  own.boothCost=75; own.boothPayments=[]; own.miles=88; own.gasPrice=3.99;
  delete d2._applied['expense_audit_v77']; ctx.applyOneTimeUpdates(d2);
  chk('7a. booth, miles, gas price kept',[own.boothCost,own.boothPayments.length,own.miles,own.gasPrice],[75,0,88,3.99]);
  const d3=blank(); d3.settings.gasPrice=4; ctx.applyOneTimeUpdates(d3);
  chk('7b. his old $4.00 default moves to the Oct 2026 price (he asked for gas to be updated)',d3.settings.gasPrice,4.2);
  const d4=blank(); d4.shows=[]; d4._applied={}; Object.keys(ctx.MRG_SEED_RECORDS).forEach(k=>d4._applied[k]=true);
  ctx.applyOneTimeUpdates(d4);
  chk('7c. no shows yet: waits',!!d4._applied['expense_audit_v77'],false); }

R.section('8. The Social Market Co. shows');
{ const d=full(); const g=re=>d.shows.filter(s=>re.test(s.name));
  const want=[['Harvest & Handmade Market','2026-09-12',78],['A Girls Day Out Market','2026-09-13',68],['Merry Makers Expo','2026-11-08',103],
    ['Holly Jolly Christmas Market','2026-11-14',78],['Shop Small Sunday Market','2026-11-22',68],['Small Business Saturday Market','2026-11-28',78],
    ['Winter Wonderland Market','2026-12-06',68],['Bridal Expo — The Ten Hotel','2027-01-17',178],["Galentine's Day Market",'2027-02-07',118]];
  chk('8a. all nine on the board, booth = what was paid, nothing owed',want.map(w=>{ const s=d.shows.find(x=>x.name===w[0]&&x.startDate===w[1]);
    return s?[s.boothCost,s.boothPayments.reduce((t,p)=>t+p.amount,0)]:null; }),want.map(w=>[w[2],w[2]]));
  chk('8b. hours that are not 12-4',[g(/small business saturday/i)[0].days[0].openTime,g(/galentine/i)[0].days[0].openTime],['11:00','10:00']);
  ctx.applyOneTimeUpdates(d); delete d._applied['social_market_v77']; ctx.applyOneTimeUpdates(d);
  chk('8c. reload never duplicates a show or a payment',[g(/holly jolly/i).length,g(/holly jolly/i)[0].boothPayments.length],[1,1]);
  const d2=blank(); d2.shows.push(Object.assign(ctx.buildPlannedShow({name:'Holly Jolly Xmas Market',startDate:'2026-11-14',numDays:1}),{boothPayments:[{id:'mine',amount:75,date:'2026-08-21'}]}));
  ctx.applyOneTimeUpdates(d2);
  chk('8d. one he typed in himself: name kept, $75 payment not doubled',[d2.shows.filter(s=>/holly jolly/i.test(s.name)).length,d2.shows.filter(s=>/holly jolly/i.test(s.name)).map(s=>[s.name,s.boothPayments.length])],[1,[['Holly Jolly Xmas Market',1]]]);
  const rf=ctx.buildPlannedShow({name:'The Rustic Fox Holiday Market (Holiday Weekend)',location:'The Rustic Fox, 1790 Towne Center Drive, North Aurora, IL 60542',startDate:'2026-11-07',numDays:1});
  ctx.v77FillMiles({shows:[rf]});
  chk('8e. Rustic Fox holiday market in North Aurora gets 77 mi, not Carol Stream 91',rf.miles,77); }

R.section('8b. A show he logged under another name is adopted, not duplicated');
{ const d=blank(); const own=ctx.buildPlannedShow({name:'Valley Ridge Market',location:'Antioch, IL',startDate:'2026-09-13',numDays:1});
  own.status='completed'; own.days[0].payments.cash=310; d.shows.push(own); ctx.applyOneTimeUpdates(d);
  const on13=d.shows.filter(s=>s.startDate==='2026-09-13');
  chk('8b1. still one show on Sep 13, his name and sales kept',[on13.length,on13[0].name,on13[0].days[0].payments.cash,on13[0].status],[1,'Valley Ridge Market',310,'completed']);
  chk('8b2. booth payment added to his record',on13[0].boothPayments.map(p=>p.amount),[68]); }

R.section('8c. His real Sep 12 + Sep 13 records (from his phone, Oct 18)');
{ const d=blank();
  const h=ctx.buildPlannedShow({name:'Harvest & Handmade Market',location:'McHenry VFW Post 4600 · 3002 W IL Route 120, McHenry, IL 60051',startDate:'2026-09-12',numDays:1,boothCost:78,miles:39});
  h.status='completed'; Object.assign(h.days[0].payments,{cash:205,square:100,zelle:20});
  const g=ctx.buildPlannedShow({name:'A Girls Day Out Market',location:'Valley Ridge Golf Course · 40150 N IL-59, Antioch, IL 60002',startDate:'2026-09-13',numDays:1,boothCost:68,miles:33});
  g.status='completed'; g.days[0].payments.cash=499;
  d.shows.push(h,g); ctx.applyOneTimeUpdates(d);
  chk('8c1. one record each, his names, still completed',[d.shows.filter(s=>s.startDate==='2026-09-12'&&/harvest/i.test(s.name)).length,d.shows.filter(s=>s.startDate==='2026-09-13'&&/girl/i.test(s.name)).length,h.status,g.status],[1,1,'completed','completed']);
  chk('8c2. his money and miles untouched',[ctx.calcShow(h).gross,ctx.calcShow(g).gross,h.miles,g.miles],[325,499,39,33]);
  chk('8c3. booth stays $78 / $68 (no double count)',[ctx.calcShow(h).booth,ctx.calcShow(g).booth],[78,68]);
  chk('8c4. no "recovered" text in the notes',/recover/i.test(h.notes+g.notes),false); }

R.section('9. Mistletoe & Martinis is $125');
{ const d=blank(); const m=Object.assign(ctx.buildPlannedShow({name:'Mistletoe & Martinis',location:'Countryside Banquets, Lakemoor, IL',startDate:'2026-11-27',numDays:1,boothCost:100,miles:35}),
    {boothPayments:[{amount:100,date:'2026-08-25',note:'paid by phone'}]});
  d.shows.push(m); ctx.applyOneTimeUpdates(d);
  chk('9a. sticker $100 -> $125, payment untouched, $25 shows as owed',[m.boothCost,m.boothPayments.length,m.boothPayments[0].amount],[125,1,100]);
  delete d._applied['expense_audit_v77']; ctx.applyOneTimeUpdates(d);
  chk('9b. rerun does not add the note twice',(m.notes.match(/Booth \$125 \(v77\)/g)||[]).length,1); }

R.section('10. v78 real paper counts');
{ const d=full(); const c=d.shows.find(s=>/cranberry/i.test(s.name)&&s.startDate.startsWith('2026-09')), b=d.shows.find(s=>/burgoo/i.test(s.name)&&s.startDate.startsWith('2026-10'));
  chk('10a. Cranberry 16, Burgoo 4',[c.paperRolls,b.paperRolls],[16,4]);
  b.paperRolls=6; delete d._applied['paper_actuals_v78']; ctx.applyOneTimeUpdates(d);
  chk('10b. a count he changed is never overwritten',b.paperRolls,6); }

R.section('11. Review fixes (Oct 18)');
{ const d=full(); ctx.S=d;
  const kk=Object.assign(ctx.buildPlannedShow({name:'Kris Kringle Christmas Market',location:'Pewaukee, WI',startDate:'2026-12-05',numDays:1,boothCost:150}),{boothPayments:[{amount:150,date:'2026-09-01'}]});
  const ss=ctx.buildPlannedShow({name:'Sip and Sleigh Holiday Market',location:'Kenosha, WI',startDate:'2026-11-29',numDays:1});
  const d2=blank(); d2.shows.push(kk,ss); d2.shows.push(ctx.buildPlannedShow({name:'Kris Kringle — Carol Stream',location:'Carol Stream, IL',startDate:'2026-12-04',numDays:3}));
  ctx.applyOneTimeUpdates(d2);
  chk('11a. another organizer\'s Kris Kringle / Sip and Sleigh is never passed',[!!kk.passed,!!ss.passed],[false,false]);
  chk('11b. the old placeholder still is',!!d2.shows.find(s=>s.name==='Kris Kringle — Carol Stream').passed,true);
  const d3=blank(); d3.settings.gasPrice=4; const old=ctx.buildPlannedShow({name:'Old Show',location:'Racine, WI',startDate:'2025-12-06',numDays:1,miles:40}); old.status='completed'; d3.shows.push(old);
  ctx.applyOneTimeUpdates(d3);
  chk('11c. a finished show with no month reading keeps the old $4.00, not the new default',[old.gasPrice,d3.settings.gasPrice],[4,4.2]);
  const z=ctx.buildPlannedShow({name:'Racine Holiday Pop-up',location:'Racine, WI',startDate:'2026-11-30',numDays:1}); z.miles=0;
  const d4=full(); d4.shows.push(z); ctx.applyOneTimeUpdates(d4); ctx.applyOneTimeUpdates(d4);
  chk('11d. a 0 he typed is not refilled on every load',z.miles,0);
  chk('11e. town only, not the street ("N Milwaukee Ave, Chicago")',ctx.v77FillMiles({shows:[Object.assign(ctx.buildPlannedShow({name:'Logan Square Holiday Market',location:'2755 N Milwaukee Ave, Chicago',startDate:'2026-12-01',numDays:1}),{miles:0})]}),[]);
  chk('11f. "Maxwell Street Market" in Chicago is not Mukwonago',ctx.v77FillMiles({shows:[Object.assign(ctx.buildPlannedShow({name:'Maxwell Street Market',location:'Chicago, IL',startDate:'2026-12-01',numDays:1}),{miles:0})]}),[]);
  const p=ctx.buildPlannedShow({name:'Test',location:'Racine, WI',startDate:'2027-03-06',numDays:1}); p.paperRolls=4;
  (d.supplies.find(x=>x.id==='sup_paper')||{}).cost=2.9167; p.supplyUse=[{name:'Paper Towels (Bounty)',qty:4}];
  chk('11g. paper towels logged in Supplies Used are not counted twice',ctx.showSupplyCost(p),ctx.showPaperCost(p)+ctx.showLinerCost(p));
  chk('11h. snapshot engine agrees',ctx.bxView(d).supplyCost(p),ctx.showSupplyCost(p));
  const k1=Object.assign(ctx.buildPlannedShow({name:'Kane County Flea Market',location:'St Charles, IL',startDate:'2026-06-06',numDays:2,miles:71}),{status:'completed'});
  const k2=Object.assign(ctx.buildPlannedShow({name:'Kane county flea market',location:'St. Charles IL',startDate:'2026-10-03',numDays:2}),{status:'completed',miles:0});
  const d5=blank(); d5.shows.push(k1,k2); ctx.applyOneTimeUpdates(d5);
  chk('11i. Kane County (Oct) gets the June miles',k2.miles,71); }

R.done();
