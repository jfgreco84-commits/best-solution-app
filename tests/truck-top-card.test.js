// v43 — the truck at the top of the show screen. SYNTHETIC FIXTURES ONLY.
//
// At Cranberry the truck card was only on the day screen, under the day tabs
// at the very bottom of the show. Froggy could not find what was left in the
// truck. v43 puts "🚚 In the truck right now" at the top of a running booth
// show, and splits the Stock tab's show card into 🚚 Truck and 🎪 Booths.
//
//   node tests/truck-top-card.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter();
const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
function dayKey(offset){ const d=new Date(); d.setDate(d.getDate()+offset); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

const h=boot(); const {ctx}=h;
const els={};
const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},
  classList:{add(){},remove(){},toggle(){},contains:()=>false},
  querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},
  insertAdjacentHTML(p,x){this.innerHTML+=x;},setAttribute(){},getAttribute:()=>null,addEventListener(){},
  focus(){},click(){},scrollIntoView(){},scrollTo(){}});
ctx.document.getElementById=id=>(els[id]||(els[id]=mk()));
const set=(id,v)=>{ctx.document.getElementById(id).value=String(v);};
ctx.S.shows=[]; ctx.S.transfers=[];
ctx.S.inventory=cnt({'32oz':50,'16oz':50,'8oz':100,'2oz':100,'c5s':400,'c5l':100});

const days=[];for(let i=0;i<3;i++)days.push(ctx._bsBlankDay(i+1,'Day '+(i+1)));
const sh={id:'cr',name:'Cranberry',status:'planned',numDays:3,startDate:dayKey(0),location:'Warrens, WI',miles:0,
  boothCost:0,boothPayments:[],dates:days.map(d=>d.date),showExpenses:[],workers:[],repIds:[],prices:null,
  confirmed:true,lodging:0,packedInventory:null,days};
ctx.S.shows.push(sh);
ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);

R.section('1. Not packed yet: the card says how to get stock into the truck');
sh.status='active';
chk('1a. card shows',/In the truck right now/.test(ctx.truckTopCardHTML(sh)),true);
chk('1b. and says nothing is packed',/Nothing packed/.test(ctx.truckTopCardHTML(sh)),true);
sh.status='planned';
chk('1c. a planned show gets no card',ctx.truckTopCardHTML(sh),'');

R.section('2. Take All: everything is in the truck');
ctx.showPackModal('cr'); ctx.pkAll('cr');
SK.forEach(k=>set('pk_'+k,ctx.S.inventory[k]));
ctx.confirmPack('cr');
let html=ctx.truckTopCardHTML(sh);
chk('2a. total is everything packed',/800 units/.test(html),true);
chk('2b. says no booth counted yet',/no booth counted yet/.test(html),true);

R.section('3. Booths take their share; the truck drops');
ctx.boothSetStock(sh,0,A,'morning',cnt({'c5s':60,'2oz':20}));
ctx.boothSetStock(sh,0,B,'morning',cnt({'c5s':50,'2oz':20}));
ctx.boothSetStock(sh,0,C,'morning',cnt({'c5s':40,'2oz':20}));
html=ctx.truckTopCardHTML(sh);
chk('3a. total 800 − 210 on booths',/590 units/.test(html),true);
chk('3b. C5-S shows 250 in the truck',/>250</.test(html),true);
chk('3c. and 150 on booths',/150 on booths/.test(html),true);
chk('3d. matches truckNow',ctx.truckNow(sh).c5s,250);
chk('3e. Count the truck button is there',/openTruckCount\('cr',0\)/.test(html),true);

R.section('4. The show screen puts the truck ABOVE the scoreboard and P&L');
ctx.go('show','cr',0);
const page=els['pg-show'].innerHTML;
const iT=page.indexOf('id="truckTop"'), iG=page.indexOf('>Gross<');
chk('4a. truck card on the show screen',iT>0,true);
chk('4b. above the Gross / Profit card',iT<iG,true);

R.section('5. Stock tab splits the show into truck and booths');
ctx.go('stock'); ctx.setStockView('shows');
const st=(els['pg-stock']||{}).innerHTML||'';
chk('5a. rendered',st.length>0,true);
chk('5b. the show card is there',/Cranberry/.test(st),true);
chk('5c. with a truck line',/🚚 Truck<\/span> <span[^>]*>[^<]*C5-S: 250/.test(st),true);
chk('5d. and a booths line',/🎪 Booths<\/span> <span[^>]*>[^<]*C5-S: 150/.test(st),true);

R.section('6. Stock value by booth: cost, retail and profit, per booth and all together');
{
  const h2=boot(); const c2=h2.ctx;
  c2.document.getElementById=ctx.document.getElementById;
  c2.S.shows=[]; c2.S.transfers=[]; delete c2.S.cogsHistory; c2.S.costs={};
  c2.S.inventory=cnt({'32oz':100,'16oz':150,'8oz':300,'2oz':400,'c5s':600,'c5l':200});
  const dd=[];for(let i=0;i<3;i++)dd.push(c2._bsBlankDay(i+1,'Day '+(i+1)));
  const cr={id:'cr2',name:'Cranberry',status:'planned',numDays:3,startDate:dayKey(0),location:'Warrens, WI',miles:0,
    boothCost:0,boothPayments:[],dates:dd.map(d=>d.date),showExpenses:[],workers:[],repIds:[],
    prices:{'32oz':30,'16oz':25,'8oz':20,'2oz':12.5,c5s:12.5,c5l:25},confirmed:true,lodging:0,packedInventory:null,days:dd};
  c2.S.shows.push(cr); c2.boothsApply(cr,['Booth 1','Booth 2','Booth 3']);
  c2.showPackModal('cr2'); c2.pkAll('cr2'); SK.forEach(k=>set('pk_'+k,c2.S.inventory[k])); c2.confirmPack('cr2');
  const table=cnt({'32oz':24,'16oz':40,'8oz':72,'2oz':114,'c5s':174,'c5l':42});
  c2.showBooths(cr).forEach(b=>c2.boothSetStock(cr,0,b.id,'morning',table));
  const v=c2.stockValue(cr,0,c2.boothOnHand(cr,0,c2.showBooths(cr)[0].id));
  const cost=24*c2.getCost('32oz')+40*c2.getCost('16oz')+72*c2.getCost('8oz')+114*c2.getCost('2oz')+174*c2.getCost('c5s')+42*c2.getCost('c5l');
  chk('6a. one booth: 466 units',v.units,466);
  chk('6b. one booth retail at Cranberry prices',v.retail,7810);
  chk('6c. one booth cost at COGS',Math.round(v.cogs*100)/100,Math.round(cost*100)/100);
  chk('6d. profit = retail − cost',Math.round(v.profit*100),Math.round((7810-cost)*100));
  const t=c2.boothValueTallyHTML(cr,0);
  chk('6e. tally lists every booth',['Booth 1','Booth 2','Booth 3'].every(n=>t.indexOf(n)>=0),true);
  chk('6f. all booths retail $23,430.00',t.indexOf('$23,430.00')>=0,true);
  chk('6g. has the truck row',/🚚 Truck/.test(t),true);
  const truckRetail=c2.stockValue(cr,0,c2.showLedger(cr)[0].truck).retail;
  chk('6h. whole show retail = booths + truck',t.indexOf(c2.fmt(23430+truckRetail))>=0,true);
  const card=c2.boothDayCardHTML(cr,0,c2.showBooths(cr)[0]);
  chk('6i. the booth card shows its own retail',card.indexOf('$7,810.00')>=0,true);
  chk('6j. and its own cost',card.indexOf(c2.fmt(v.cogs))>=0,true);
  chk('6k. day screen puts the tally above the booth cards',(()=>{const x=c2.dayBoothsHTML(cr,0);return x.indexOf('boothValueTally')>=0&&x.indexOf('boothValueTally')<x.indexOf('Booth 1 <span');})(),true);
}

R.done();
