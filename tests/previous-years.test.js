// v72 — 📅 Previous Years on every show screen. SYNTHETIC FIXTURES ONLY.
//
//   node tests/previous-years.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;

const {ctx}=boot();
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const show=(id,name,location,startDate,extra)=>Object.assign({id,name,location,startDate,status:'planned',numDays:1,
  days:[ctx._bsBlankDay(1,'Day 1')],boothPayments:[],showExpenses:[],workers:[],repIds:[]},extra||{});
const world=shows=>({v:7,inventory:{},shows,reps:[],settings:{},_applied:{}});
const pick=(sh,st)=>ctx.previousYears(sh,st).map(y=>y.year+':'+y.rec.name+':'+y.rec.sd);

// ===========================================================================
R.section('1. The 2025 workbook data lines up with the 2025 season list');
// ===========================================================================
{
  chk('1a. one detail row per 2025 show',ctx.SHOWS_2025_DETAIL.length,ctx.SHOWS_2025.length);
  const bad=ctx.SHOWS_2025.filter((s,i)=>{ const x=ctx.SHOWS_2025_DETAIL[i];
    const dayTot={}; SK.forEach(k=>dayTot[k]=x.days.reduce((t,d)=>t+(d.sold[k]||0),0));
    return SK.some(k=>dayTot[k]!==x.sold[k]); }).map(s=>s.name);
  chk('1b. every show: days add up to the show total, size by size',bad,[]);
  const b=ctx.SHOWS_2025_DETAIL[13];
  chk('1c. Burgoo 2025 sold 7/37/22/80/100/22',SK.map(k=>b.sold[k]),[7,37,22,80,100,22]);
  chk('1d. Burgoo 2025 day 1 3/9/22/29/34/13',SK.map(k=>b.days[0].sold[k]),[3,9,22,29,34,13]);
  chk('1e. Burgoo 2025 day 2 4/28/0/51/66/9',SK.map(k=>b.days[1].sold[k]),[4,28,0,51,66,9]);
  chk('1f. Burgoo 2025 collected by method',b.pay,{cash:2355,square:915,venmo:145});
  chk('1g. first day dates are in 2025',ctx.SHOWS_2025_DETAIL.every(x=>/^2025-\d{2}-\d{2}$/.test(x.sd)),true);
}
// ===========================================================================
R.section('2. Each 2026 show finds the same show in 2025');
// ===========================================================================
{
  const shows=[
    show('s_burgoo','Burgoo Fest','Utica, IL','2026-10-10',{numDays:2}),
    show('s_cran','Cranberry Fest','Warrens, WI','2026-09-25'),
    show('s_stm','St. Martins Fair','Franklin, WI','2026-09-06'),
    show('s_mxjun','Maxwell Street Days — Jun','Mukwonago, WI','2026-06-13'),
    show('s_mxjul','Maxwell Street Days — Jul','Mukwonago, WI','2026-07-18'),
    show('s_mxaug','Maxwell Street Days — Aug','Mukwonago, WI','2026-08-15'),
    show('s_rfjun','Rustic Fox — Carol Stream (Jun)','Carol Stream, IL','2026-06-07'),
    show('s_rfsep','Rustic Fox — Carol Stream (Sep)','Carol Stream, IL','2026-09-06'),
    show('s_rfoct','Rustic Fox — Carol Stream (Oct)','Carol Stream, IL','2026-10-04'),
    show('s_ffaug','Fox & Found — North Aurora (Aug)','North Aurora, IL','2026-08-15'),
    show('s_ffoct','Fox & Found — North Aurora (Oct)','North Aurora, IL','2026-10-17'),
    show('s_sscs','Sip & Sleigh — Carol Stream','Carol Stream, IL','2026-11-07'),
    show('s_ssna','Sip & Sleigh — North Aurora','North Aurora, IL','2026-11-20'),
    show('s_kkcs','Kris Kringle — Carol Stream','Carol Stream, IL','2026-12-04'),
    show('s_kkna','Kris Kringle — North Aurora','North Aurora, IL','2026-12-12'),
    show('s_bar','Baraboo Christmas Market','Baraboo, WI','2026-11-21'),
    show('s_mch','McHenry County Fair','McHenry County, IL','2026-08-04'),
  ];
  const st=world(shows); ctx.S=st;
  const by=id=>shows.find(s=>s.id===id);
  chk('2a. Burgoo → Burgoo 2025',pick(by('s_burgoo'),st),['2025:Burgoo Fest:2025-10-10']);
  chk('2b. Cranberry → Cranberry 2025',pick(by('s_cran'),st),['2025:Cranberry Fest:2025-09-25']);
  chk('2c. St. Martins Fair → St. Martins Fest (renamed, date moved a week)',pick(by('s_stm'),st),['2025:St. Martins Fest:2025-08-30']);
  chk('2d. Maxwell Jun → Mukwonago Maxwell Jun',pick(by('s_mxjun'),st),['2025:Mukwonago Maxwell:2025-06-07']);
  chk('2e. Maxwell Jul → Mukwonago Maxwell Jul',pick(by('s_mxjul'),st),['2025:Mukwonago Maxwell:2025-07-19']);
  chk('2f. Maxwell Aug → nothing (no August show in 2025)',pick(by('s_mxaug'),st),[]);
  chk('2g. Rustic Fox CS Jun → nothing (2025 started in Sep)',pick(by('s_rfjun'),st),[]);
  chk('2h. Rustic Fox CS Sep 6 → Sep 6 2025, not Sep 20',pick(by('s_rfsep'),st),['2025:Rustic Fox — Carol Stream:2025-09-06']);
  chk('2i. Rustic Fox CS Oct → Oct 4 2025',pick(by('s_rfoct'),st),['2025:Rustic Fox — Carol Stream:2025-10-04']);
  chk('2j. Fox & Found NA Aug → Rustic Fox N. Aurora Aug 2025',pick(by('s_ffaug'),st),['2025:Rustic Fox — N. Aurora:2025-08-08']);
  chk('2k. Fox & Found NA Oct → nothing (only August in 2025)',pick(by('s_ffoct'),st),[]);
  chk('2l. Sip & Sleigh CS → its own town',pick(by('s_sscs'),st),['2025:Sip & Sleigh — Carol Stream:2025-11-07']);
  chk('2m. Sip & Sleigh NA → its own town',pick(by('s_ssna'),st),['2025:Sip & Sleigh — N. Aurora:2025-11-14']);
  chk('2n. Kris Kringle CS → Kris Kringle CS 2025',pick(by('s_kkcs'),st),['2025:Kris Kringle — Carol Stream:2025-12-15']);
  chk('2o. Kris Kringle NA → nothing (not worked in 2025)',pick(by('s_kkna'),st),[]);
  chk('2p. Baraboo Christmas → Baraboo Womens Market',pick(by('s_bar'),st),['2025:Baraboo Womens Market:2025-11-22']);
  chk('2q. a new show → nothing',pick(by('s_mch'),st),[]);
}
// ===========================================================================
R.section('3. A finished 2026 show becomes a previous year in 2027');
// ===========================================================================
{
  const b26=show('s_b26','Burgoo Fest','Utica, IL','2026-10-10',{status:'completed',numDays:1,boothCost:156});
  const d=b26.days[0];
  d.morningCount={'32oz':10,'16oz':10,'8oz':10,'2oz':10,c5s:10,c5l:10};
  d.eveningCount={'32oz':8,'16oz':5,'8oz':10,'2oz':0,c5s:4,c5l:9};
  d.payments={cash:300,square:100};
  const b27=show('s_b27','Burgoo Fest','Utica, IL','2027-10-09');
  const st=world([b26,b27]); ctx.S=st;
  const ys=ctx.previousYears(b27,st);
  chk('3a. two years, newest first',ys.map(y=>y.year),[2026,2025]);
  chk('3b. 2026 sold comes from the counts',SK.map(k=>ys[0].rec.sold[k]),[2,5,0,10,6,1]);
  chk('3c. 2026 collected comes from the payments',ys[0].rec.pay,{cash:300,square:100});
  chk('3d. 2026 gross is what was collected',ys[0].rec.gross,400);
  chk('3e. the 2026 show does not list itself',ctx.previousYears(b26,st).map(y=>y.year),[2025]);
  const passed=show('s_px','Burgoo Fest','Utica, IL','2026-10-10',{status:'completed',passed:true});
  ctx.S=world([passed,b27]);
  chk('3f. a passed show is never history',ctx.previousYears(b27,ctx.S).map(y=>y.year),[2025]);
}
// ===========================================================================
R.section('4. The drop-down renders on any show');
// ===========================================================================
{
  const sh=show('s_burgoo','Burgoo Fest','Utica, IL','2026-10-10');
  ctx.S=world([sh]);
  const h=ctx.previousYearsHTML(sh);
  chk('4a. button is called Previous Years',/📅 Previous Years/.test(h),true);
  chk('4b. lists 2025',/\(2025\)/.test(h),true);
  chk('4c. shows Day 1 and Day 2 columns',/Day 1/.test(h)&&/Day 2/.test(h),true);
  chk('4d. shows 268 bottles total (110 + 158)',/268 total/.test(h),true);
  chk('4e. shows the money collected',/Collected \$3,415\.00/.test(h),true);
  const none=show('s_new','Brand New Show','Somewhere, WI','2026-10-10');
  chk('4f. a show with no history still gets the button',/📅 Previous Years/.test(ctx.previousYearsHTML(none))&&/No earlier year/.test(ctx.previousYearsHTML(none)),true);
  const nodate=show('s_nd','Burgoo Fest','Utica, IL','');
  chk('4g. a show with no date does not crash',/No earlier year/.test(ctx.previousYearsHTML(nodate)),true);
}
R.done();
