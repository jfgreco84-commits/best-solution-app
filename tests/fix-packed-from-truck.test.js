// v44 — the truck count is right, the packed number was wrong. SYNTHETIC FIXTURES ONLY.
// Cranberry day 1: boxes were miscounted at packing (8oz read as 2oz, extra
// C5 Large). The booths and the truck are counted by hand; one tap moves the
// show's packed total so the app's truck equals the count. Garage untouched.
//   node tests/fix-packed-from-truck.test.js
'use strict';
const {boot,reporter}=require('./harness.js');
const R=reporter(); const chk=R.check;
const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const cnt=o=>{const r={};SK.forEach(k=>r[k]=o[k]||0);return r;};
function dayKey(offset){ const d=new Date(); d.setDate(d.getDate()+offset); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
const {ctx}=boot();
const els={}; const mk=()=>({innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},insertAdjacentHTML(p,x){this.innerHTML+=x;},setAttribute(){},getAttribute:()=>null,addEventListener(){},focus(){},click(){},scrollIntoView(){},scrollTo(){}});
ctx.document.getElementById=id=>(els[id]||(els[id]=mk()));
const set=(id,v)=>{ctx.document.getElementById(id).value=String(v);};
ctx.S.shows=[]; ctx.S.transfers=[];
// What the app THOUGHT was packed (wrong): 2oz 160 too many, 8oz 48 too few, C5L 24 too few.
ctx.S.inventory=cnt({'32oz':59,'16oz':108,'8oz':208,'2oz':331,'c5s':550,'c5l':175});
const dd=[];for(let i=0;i<3;i++)dd.push(ctx._bsBlankDay(i+1,'Day '+(i+1)));
const sh={id:'cr',name:'Cranberry',status:'planned',numDays:3,startDate:dayKey(0),location:'Warrens, WI',miles:0,boothCost:0,boothPayments:[],dates:dd.map(d=>d.date),showExpenses:[],workers:[],repIds:[],prices:null,confirmed:true,lodging:0,packedInventory:null,days:dd};
ctx.S.shows.push(sh); ctx.boothsApply(sh,['Booth 1','Booth 2','Booth 3']);
ctx.showPackModal('cr'); ctx.pkAll('cr'); SK.forEach(k=>set('pk_'+k,ctx.S.inventory[k])); ctx.confirmPack('cr');
const [A,B,C]=ctx.showBooths(sh).map(b=>b.id);
// Froggy's counts
ctx.boothSetStock(sh,0,A,'morning',cnt({'32oz':22,'16oz':35,'8oz':59,'2oz':72,'c5s':132,'c5l':23}));
ctx.boothSetStock(sh,0,B,'morning',cnt({'32oz':21,'16oz':37,'8oz':76,'2oz':9,'c5s':130,'c5l':36}));
ctx.boothSetStock(sh,0,C,'morning',cnt({'32oz':16,'16oz':36,'8oz':49,'2oz':90,'c5s':148,'c5l':16}));
R.section('1. Before: the app has the truck wrong');
chk('1a. app truck 2oz (160 phantom)',ctx.truckNow(sh)['2oz'],160);
chk('1b. app truck 8oz (48 short of 72)',ctx.truckNow(sh)['8oz'],24);
chk('1c. app truck C5-L (24 short of 124)',ctx.truckNow(sh).c5l,100);
const g0=JSON.stringify(ctx.S.inventory);
ctx.saveTruckCount('cr',0,cnt({'8oz':72,'c5s':140,'c5l':124}));
const tc=ctx.truckCountDiff(sh,0);
chk('1d. count shows the differences',[tc.diff['2oz'],tc.diff['8oz'],tc.diff.c5l,tc.diff.c5s],[-160,48,24,0]);
chk('1e. the audit flags it',ctx.auditShow(sh).some(x=>x.code==='truckCount'),true);
chk('1f. truck card offers the fix',/My truck count is right/.test(ctx.truckCardHTML(sh,0)),true);
chk('1g. top card offers the fix',/My truck count is right/.test(ctx.truckTopCardHTML(sh)),true);
R.section('2. One tap fixes it');
const r=ctx.fixPackedFromTruckCount('cr',0);
chk('2a. ok',r.ok,true);
chk('2b. packed now matches reality',SK.map(k=>sh.packedInventory[k]),[59,108,256,171,550,199]);
chk('2c. app truck now equals the count',SK.map(k=>ctx.truckNow(sh)[k]),[0,0,72,0,140,124]);
chk('2d. audit clean on the truck',ctx.auditShow(sh).some(x=>x.code==='truckCount'),false);
chk('2e. garage untouched',JSON.stringify(ctx.S.inventory),g0);
chk('2f. logged on the show',/packed count fixed/.test(JSON.stringify(sh.invLog)),true);
chk('2g. logged in the audit log',ctx.S.settings.audit.log.some(x=>x.type==='packFix'),true);
chk('2h. button gone once fixed',/My truck count is right/.test(ctx.truckCardHTML(sh,0)),false);
chk('2i. a second tap refuses',ctx.fixPackedFromTruckCount('cr',0).ok,false);
chk('2j. Stock tab holds the real total',ctx.showOnHand(sh)['2oz'],171);
R.done();
