// Supplier invoices + Booking Pipeline filtering.
'use strict';
const H=require('./harness.js');
const R=H.reporter(), chk=R.check;
const w=H.boot(); if(w.bootError) throw w.bootError;
const c=w.ctx;

const INV1={id:'inv_1',name:'Invoice 1: First Pallet',closed:true,
  lines:[{sku:'32 oz',cases:10,amount:540},{sku:'16 oz',cases:10,amount:750},
         {sku:'8 oz',cases:21,amount:1638},{sku:'2 oz',cases:7,amount:1120}],
  subtotal:4048,shipping:0,shippingPending:false,
  payments:[{date:'2026-05-01',amount:250,method:'Zelle'},{date:'2026-05-15',amount:250,method:'Zelle'},
            {date:'2026-05-29',amount:250,method:'Zelle'},{date:'2026-07-24',amount:250,method:'Zelle'},
            {date:'2026-07-27',amount:3000,method:'Zelle'},{date:'2026-08-21',amount:48,method:'Zelle'}]};
const INV2={id:'inv_2',name:'Invoice 2: New Order',closed:false,
  lines:[{sku:'32 oz',cases:10,amount:540},{sku:'16 oz',cases:15,amount:1125},
         {sku:'8 oz',cases:20,amount:1560},{sku:'2 oz',cases:5,amount:800},
         {sku:'C5X',cases:8,amount:1960}],
  subtotal:5985,shipping:null,shippingPending:true,payments:[]};
const PD={supplier:'Mark Martone',defaultMethod:'Zelle',invoices:[INV1,INV2]};

R.section('=== 1. TWO SEPARATE INVOICES, NOT ONE RUNNING BALANCE ===');
chk('two invoices',c.pdInvoices(PD).length,2);
chk('invoice 1 total',c.pdTotalOf(INV1),4048);
chk('invoice 1 paid',c.pdPaidOn(INV1),4048);
chk('invoice 1 balance',c.pdBalanceOf(INV1),0);
chk('invoice 1 is PAID IN FULL',c.pdIsPaid(INV1),true);
chk('invoice 1 progress is 100%',c.pdPctOf(INV1),100);
chk('invoice 2 subtotal',INV2.subtotal,5985);
chk('invoice 2 paid',c.pdPaidOn(INV2),0);
chk('invoice 2 balance',c.pdBalanceOf(INV2),5985);
chk('invoice 2 is NOT paid',c.pdIsPaid(INV2),false);
chk('invoice 2 progress is 0%',c.pdPctOf(INV2),0);
chk('invoice 2 flags shipping pending',INV2.shippingPending,true);

R.section('=== 2. THE $4,048 IS NOT PROGRESS AGAINST INVOICE 2 ===');
chk('outstanding is invoice 2 only',c.pdOutstanding(PD),5985);
chk('paid historically is invoice 1 only',c.pdPaidTotal(PD),4048);
chk('open invoices',c.pdOpenCount(PD),1);
chk('paid invoices',c.pdPaidCount(PD),1);
chk('supplier-wide shipping pending',c.pdShippingPending(PD),true);
chk('no combined 10033 total is ever produced',
    c.pdOutstanding(PD)+c.pdPaidTotal(PD)===10033 && c.pdOutstanding(PD)!==10033, true);
chk('a 40%-style combined progress is impossible: each invoice has its own',
    [c.pdPctOf(INV1),c.pdPctOf(INV2)],[100,0]);

R.section('=== 3. EVERY HISTORICAL PAYMENT IS ZELLE ===');
chk('six payments on invoice 1',INV1.payments.length,6);
chk('all Zelle',INV1.payments.every(p=>p.method==='Zelle'),true);
chk('no Venmo anywhere',JSON.stringify(PD).indexOf('Venmo'),-1);
chk('no generic Payment N labels',/Payment \d/.test(JSON.stringify(PD)),false);
chk('dates preserved',INV1.payments.map(p=>p.date),
  ['2026-05-01','2026-05-15','2026-05-29','2026-07-24','2026-07-27','2026-08-21']);
chk('amounts preserved',INV1.payments.map(p=>p.amount),[250,250,250,250,3000,48]);
chk('they total exactly 4048',INV1.payments.reduce((t,p)=>t+p.amount,0),4048);

R.section('=== 4. NEW PAYMENTS GO TO THE OPEN INVOICE ===');
chk('default target is invoice 2',c.pdDefaultInvoice(PD).id,'inv_2');
chk('a closed invoice is never the default',c.pdDefaultInvoice(PD).closed,false);
{ const pd=JSON.parse(JSON.stringify(PD));
  w.ctx.S={productDebt:pd};
  w.ctx.$$=id=>({'dpt_amt':{value:'1000'},'dpt_date':{value:'2026-09-01'},
    'dpt_note':{value:''},'dpt_method':{value:'Zelle'},'dpt_inv':{value:'inv_2'}}[id]||null);
  w.ctx.saveS=()=>{}; w.ctx.mClose=()=>{}; w.ctx.toast=()=>{};
  c.saveDebtPmt();
  const i2=pd.invoices.find(i=>i.id==='inv_2');
  chk('payment landed on invoice 2',i2.payments.length,1);
  chk('  with the method recorded',i2.payments[0].method,'Zelle');
  chk('  invoice 2 balance drops',c.pdBalanceOf(i2),4985);
  chk('invoice 1 untouched',pd.invoices.find(i=>i.id==='inv_1').payments.length,6);
  chk('invoice 1 still paid in full',c.pdBalanceOf(pd.invoices[0]),0); }
{ const pd=JSON.parse(JSON.stringify(PD));
  w.ctx.S={productDebt:pd};
  w.ctx.$$=id=>({'dpt_amt':{value:'50'},'dpt_date':{value:'2026-09-01'},
    'dpt_note':{value:''},'dpt_method':{value:'Zelle'},'dpt_inv':{value:'inv_1'}}[id]||null);
  let msg=''; w.ctx.toast=m=>{msg=m;};
  c.saveDebtPmt();
  chk('a payment aimed at the CLOSED invoice is refused',
      pd.invoices.find(i=>i.id==='inv_1').payments.length,6);
  chk('  and it says why',/closed/i.test(msg),true); }

R.section('=== 5. THE OLD SINGLE-BALANCE SHAPE STILL READS CORRECTLY ===');
{ const legacy={supplier:'Mark Martone',originalBalance:10000,
    payments:[{date:'2026-05-01',amount:250},{date:'2026-07-27',amount:3000}]};
  const inv=c.pdInvoices(legacy);
  chk('presented as one invoice',inv.length,1);
  chk('its total',c.pdTotalOf(inv[0]),10000);
  chk('its paid',c.pdPaidOn(inv[0]),3250);
  chk('its balance',c.pdBalanceOf(inv[0]),6750);
  chk('outstanding matches',c.pdOutstanding(legacy),6750);
  chk('empty debt yields no invoices',c.pdInvoices({}).length,0);
  chk('undefined debt yields no invoices',c.pdInvoices(undefined).length,0); }

R.section('=== 6. BOOKING PIPELINE BUCKETS ARE MUTUALLY EXCLUSIVE ===');
{ const mk=(id,confirmed,cost,paid)=>({id,name:id,startDate:'2026-12-01',confirmed,
    boothCost:cost,boothPayments:paid?[{amount:paid,date:'2026-01-01'}]:[],days:[{dayNum:1}],status:'planned'});
  const planned=[mk('a',true,100,100),mk('b',true,100,0),mk('c',false,70,70),mk('d',false,0,0),mk('e',true,0,0)];
  const pend=planned.filter(s=>s.confirmed===false);
  const booked=planned.filter(s=>s.confirmed!==false);
  const paidS=booked.filter(s=>(s.boothCost||0)>0&&c.boothBalance(s)<=0);
  const oweS=booked.filter(s=>(s.boothCost||0)>0&&c.boothBalance(s)>0);
  chk('paid',paidS.map(s=>s.id),['a']);
  chk('owe',oweS.map(s=>s.id),['b']);
  chk('pending',pend.map(s=>s.id),['c','d']);
  const ids=[...paidS,...oweS,...pend].map(s=>s.id);
  chk('no show appears in two buckets',ids.length,new Set(ids).size);
  chk('a PAID but UNCONFIRMED show counts as pending only',
      [paidS.some(s=>s.id==='c'),pend.some(s=>s.id==='c')],[false,true]); }

R.section('=== 7. THE TAP HANDLER TOGGLES ===');
c.pipeFilter=null;
c.rShows=()=>{};
c.pipeTap('paid');   chk('tapping sets the filter',c.pipeFilter,'paid');
c.pipeTap('owe');    chk('tapping another switches',c.pipeFilter,'owe');
c.pipeTap('owe');    chk('tapping the same one clears',c.pipeFilter,null);
R.done();
