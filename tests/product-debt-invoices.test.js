// Product debt: sequential supplier invoices.
//
// The invariant this file exists to protect is that two product orders from the
// same supplier are two obligations and never one. Invoice 1 ($4,048, six Zelle
// payments, paid in full) and Invoice 2 ($5,985, no payments) must each carry
// their own total, payments, balance and status, and nothing a later invoice
// does may alter an earlier one.
//
// The expected figures are written out here rather than read from the app, so a
// silent drift in PD_MM_INVOICES fails this file instead of passing against
// itself. They are the same figures BEST_SOLUTION_APP.html already ships; see
// the note in tests/README.md.
//
//   node tests/product-debt-invoices.test.js
'use strict';
const {boot,reporter,el}=require('./harness.js');

// Stub the modal's inputs: the app reads them with $$(id).value.
function withFields(w,fields){
  w.ctx.document.getElementById=id=>{ const e=el(); if(id in fields)e.value=fields[id]; return e; };
  w.ctx.window.__lastSave=0;   // _dupGuard() ignores a second save inside 900ms
}

const R=reporter();
const chk=(n,g,w)=>R.check(n,g,w);
const money=n=>Math.round(n*100)/100;

function fresh(){ const w=boot(); if(w.bootError)throw w.bootError; return w; }
function pd(w){ return w.ctx.S.productDebt; }
function inv(w,num){ return w.ctx.pdSorted(pd(w)).filter(i=>i.number===num)[0]; }

R.section('=== 1. THE MIGRATED SHAPE ===');
{
  const w=fresh();
  const p=pd(w);
  chk('supplier kept',p.supplier,'Mark Martone');
  chk('two invoices',w.ctx.pdInvoices(p).length,2);
  chk('legacy payments field is gone',('payments' in p),false);
  chk('legacy originalBalance field is gone',('originalBalance' in p),false);
  chk('invoices are numbered 1 and 2',w.ctx.pdSorted(p).map(i=>i.number),[1,2]);
  chk('every payment carries an id',
    w.ctx.pdInvoices(p).every(i=>(i.payments||[]).every(x=>!!x.id)),true);
}

R.section('=== 2. INVOICE 1 — PAID IN FULL (reqs 1-5) ===');
{
  const w=fresh(); const i1=inv(w,1);
  chk('req 1  original total is 4048.00',money(i1.originalTotal),4048);
  chk('req 2  payments total 4048.00',w.ctx.pdPaid(i1),4048);
  chk('req 2b six payments, on the stated dates and amounts',
    i1.payments.map(p=>[p.date,money(p.amount)]),
    [['2026-05-01',250],['2026-05-15',250],['2026-05-29',250],
     ['2026-07-24',250],['2026-07-27',3000],['2026-08-21',48]]);
  chk('req 3  balance is 0.00',w.ctx.pdBalance(i1),0);
  chk('req 4  every payment is Zelle',[...new Set(i1.payments.map(p=>p.method))],['Zelle']);
  chk('req 4b no payment is Venmo',i1.payments.some(p=>/venmo/i.test(p.method||'')),false);
  chk('req 5  status is paid',i1.status,'paid');
  chk('req 5b pdIsPaid agrees',w.ctx.pdIsPaid(i1),true);
  chk('paid-in-full date is the last payment date',i1.paidInFullDate,'2026-08-21');
  chk('progress is 100%',w.ctx.pdPct(i1),100);
  chk('order detail is the first pallet',w.ctx.pdItemsText(i1),
    '32 oz: 10 cases · 16 oz: 10 cases · 8 oz: 21 cases · 2 oz: 7 cases');
  chk('shipping was free',i1.shipping,'Free');
  chk('the order date is left blank, not guessed from the first payment',i1.createdDate,'');
}

R.section('=== 3. INVOICE 2 — OPEN AND FRESH (reqs 6-8) ===');
{
  const w=fresh(); const i2=inv(w,2);
  chk('req 6  original total is 5985.00',money(i2.originalTotal),5985);
  chk('req 7  paid is 0.00',w.ctx.pdPaid(i2),0);
  chk('req 7b it carries no payments at all',i2.payments.length,0);
  chk('req 8  balance is 5985.00',w.ctx.pdBalance(i2),5985);
  chk('status is open',i2.status,'open');
  chk('no paid-in-full date',i2.paidInFullDate,null);
  chk('progress is 0%',w.ctx.pdPct(i2),0);
  chk('order detail is the second pallet',w.ctx.pdItemsText(i2),
    '32 oz: 10 cases · 16 oz: 15 cases · 8 oz: 20 cases · 2 oz: 5 cases · C5X: 8 cases');
  chk('it is the one open invoice',w.ctx.pdOpenInvoice(pd(w)).number,2);
  chk('only one invoice is open',w.ctx.pdOpenInvoices(pd(w)).length,1);
  chk('its order date is left blank, not invented',i2.createdDate,'');
}

R.section('=== 4. NOTHING IS MERGED ===');
{
  const w=fresh(); const T=w.ctx.pdTotals(pd(w));
  // The roll-up may add the invoices up. What it may never do is present that
  // sum as ONE invoice, which is what the old single record did.
  chk('roll-up counts two separate invoices',T.count,2);
  chk('roll-up open balance is invoice 2 alone',T.balance,5985);
  chk('roll-up paid is invoice 1 alone',T.paid,4048);
  chk('roll-up invoiced is the sum of the two',T.original,10033);
  const h=w.ctx.secDebt();
  chk('no 40% figure anywhere on the page',/\b40% paid\b/.test(h),false);
  chk('the merged $10,033.00 is never shown as one invoice balance',
    /Balance Owed[\s\S]{0,200}\$10,033\.00/.test(h),false);
  chk('invoice 1 is labelled',h.indexOf('Invoice 1')>=0,true);
  chk('invoice 2 is labelled',h.indexOf('Invoice 2')>=0,true);
  chk('PAID IN FULL badge is rendered',h.indexOf('PAID IN FULL')>=0,true);
  chk('OPEN badge is rendered',h.indexOf('>OPEN<')>=0,true);
  // Invoice 2 is the active one and must come first on the page.
  chk('the active invoice is rendered above the completed history',
    h.indexOf('Invoice 2')<h.indexOf('Invoice 1'),true);
  chk('completed history is collapsed by default (a View toggle, not the payments)',
    /pdToggleCard/.test(h),true);
  chk('a collapsed invoice 1 does not print its payment rows',
    h.indexOf('Payment 6')<0,true);
}

R.section('=== 5. EXPANDING INVOICE 1 SHOWS THE FULL HISTORY ===');
{
  const w=fresh(); const i1=inv(w,1);
  w.ctx.pdToggleCard(i1.id);
  const h=w.ctx.secDebt();
  chk('all six payments are listed once expanded',
    ['2026-05-01','2026-05-15','2026-05-29','2026-07-24','2026-07-27','2026-08-21']
      .every(d=>h.indexOf(d)>=0),true);
  chk('the order detail is shown',h.indexOf('8 oz: 21 cases')>=0,true);
  chk('the methods are shown',h.indexOf('Zelle')>=0,true);
  w.ctx.pdToggleCard(i1.id);
  chk('it collapses again',w.ctx.secDebt().indexOf('2026-07-27')<0,true);
}

R.section('=== 6. A PAYMENT LANDS ON ONE INVOICE ONLY (req 9) ===');
{
  const w=fresh();
  const before1=JSON.stringify(inv(w,1));
  // Straight through the app's own save path, with the modal fields stubbed.
  const fields={dpt_inv:inv(w,2).id,dpt_amt:'500',dpt_date:'2026-08-24',
    dpt_method:'Zelle',dpt_note:'TEST PAYMENT'};
  withFields(w,fields);
  w.ctx.saveDebtPmt();
  chk('the payment is on invoice 2',inv(w,2).payments.length,1);
  chk('invoice 2 paid is 500.00',w.ctx.pdPaid(inv(w,2)),500);
  chk('invoice 2 balance drops to 5485.00',w.ctx.pdBalance(inv(w,2)),5485);
  chk('invoice 2 is still open',inv(w,2).status,'open');
  chk('invoice 1 is byte-identical',JSON.stringify(inv(w,1)),before1);

  // ... and removing it puts invoice 2 back exactly where it was.
  w.ctx.confirm=()=>true;
  w.ctx.pdDeletePmt(inv(w,2).id,inv(w,2).payments[0].id);
  chk('the test payment is reversible',inv(w,2).payments.length,0);
  chk('invoice 2 balance is 5985.00 again',w.ctx.pdBalance(inv(w,2)),5985);
  chk('invoice 1 is still byte-identical',JSON.stringify(inv(w,1)),before1);
}

R.section('=== 7. PAYING AN INVOICE OFF MARKS IT PAID IN FULL ===');
{
  const w=fresh();
  const i2=inv(w,2);
  i2.payments.push(w.ctx.pdMakePayment({amount:5985,date:'2026-09-01',method:'Zelle'}));
  w.ctx.pdSyncStatus(i2);
  chk('status flips to paid on its own',i2.status,'paid');
  chk('paid-in-full date is the closing payment date',i2.paidInFullDate,'2026-09-01');
  chk('no invoice is open now',w.ctx.pdOpenInvoice(pd(w)),null);
  // and taking the payment back reopens it, so a mis-keyed payment is recoverable
  i2.payments.pop(); w.ctx.pdSyncStatus(i2);
  chk('removing it reopens the invoice',i2.status,'open');
  chk('the paid-in-full date is cleared with it',i2.paidInFullDate,null);
}

R.section('=== 8. INVOICE 3 CHANGES NOTHING BEFORE IT (req 11) ===');
{
  const w=fresh();
  const before=JSON.stringify([inv(w,1),inv(w,2)]);
  chk('the next number is 3',w.ctx.pdNextNumber(pd(w)),3);
  const fields={ninv_num:'3',ninv_total:'2500',ninv_date:'2026-10-01',
    ninv_items:'32 oz: 12\n8 oz: 6\nC5X: 4',ninv_ship:'Free',ninv_note:'Third pallet'};
  withFields(w,fields);
  w.ctx.confirm=()=>true;   // invoice 2 is still open, so the app asks first
  w.ctx.saveNewInvoice();
  const i3=inv(w,3);
  chk('invoice 3 exists',!!i3,true);
  chk('its total is what was typed',money(i3.originalTotal),2500);
  chk('it starts with no payments',i3.payments.length,0);
  chk('its balance is its own total',w.ctx.pdBalance(i3),2500);
  chk('it is open',i3.status,'open');
  chk('its order lines parsed',i3.items,[{label:'32 oz',cases:12},{label:'8 oz',cases:6},{label:'C5X',cases:4}]);
  chk('invoices 1 and 2 are byte-identical',JSON.stringify([inv(w,1),inv(w,2)]),before);
  chk('a duplicate number is refused',(function(){
    const n=w.ctx.pdInvoices(pd(w)).length; w.ctx.window.__lastSave=0; w.ctx.saveNewInvoice();
    return w.ctx.pdInvoices(pd(w)).length===n; })(),true);
  chk('unlimited invoices: number 4 is next',w.ctx.pdNextNumber(pd(w)),4);
}

R.section('=== 9. A REFRESH PRESERVES BOTH INVOICES (req 10) ===');
{
  const w=fresh();
  w.ctx.window.__lastSave=0;
  w.ctx.saveS();                                   // writes dd_bs_v7
  const again=boot({dd_bs_v7:w.store['dd_bs_v7']}); // page reload on the same device
  chk('no boot error on reload',!again.bootError,true);
  const p=again.ctx.S.productDebt;
  chk('still two invoices',again.ctx.pdInvoices(p).length,2);
  chk('invoice 1 still paid in full',again.ctx.pdSorted(p)[0].status,'paid');
  chk('invoice 1 still holds six payments',again.ctx.pdSorted(p)[0].payments.length,6);
  chk('invoice 2 balance survives the reload',again.ctx.pdBalance(again.ctx.pdSorted(p)[1]),5985);
  chk('the reload did not re-seed a third copy',
    again.ctx.pdInvoices(p).map(i=>i.number),[1,2]);
  chk('productDebt is unchanged across the reload',
    JSON.stringify(p),JSON.stringify(w.ctx.S.productDebt));
}

R.section('=== 10. CONVERTING A DEVICE THAT STILL HOLDS THE OLD RECORD ===');
{
  // The shape the live device was actually in: one rolling $10,033 balance with
  // all six payments on it, two of them mislabelled Venmo.
  const seedW=fresh();
  const doc=JSON.parse(JSON.stringify(seedW.ctx.S));
  delete doc._applied['debt_invoices_v1'];
  doc.productDebt={supplier:'Mark Martone',originalBalance:10033,payments:[
    {amount:250,date:'2026-05-01',note:'Payment 1'},
    {amount:250,date:'2026-05-15',note:'Payment 2'},
    {amount:250,date:'2026-05-29',note:'Payment 3'},
    {amount:250,date:'2026-07-24',note:'Venmo'},
    {amount:3000,date:'2026-07-27',note:'Venmo'},
    {amount:48,date:'2026-08-21',note:'Zelle — INVOICE 1 FIRST PALLET PAID IN FULL $4,048'}]};
  const w=boot({dd_bs_v7:JSON.stringify(doc)});
  chk('no boot error converting the old record',!w.bootError,true);
  const p=w.ctx.S.productDebt;
  chk('it splits into two invoices',w.ctx.pdInvoices(p).length,2);
  chk('invoice 1 total is 4048.00',money(w.ctx.pdSorted(p)[0].originalTotal),4048);
  chk('invoice 1 paid is 4048.00',w.ctx.pdPaid(w.ctx.pdSorted(p)[0]),4048);
  chk('invoice 1 holds exactly the six historic payments',
    w.ctx.pdSorted(p)[0].payments.length,6);
  chk('every one of them now reads Zelle',
    [...new Set(w.ctx.pdSorted(p)[0].payments.map(x=>x.method))],['Zelle']);
  chk('invoice 2 balance is 5985.00',w.ctx.pdBalance(w.ctx.pdSorted(p)[1]),5985);
  chk('invoice 2 inherited none of them',w.ctx.pdSorted(p)[1].payments.length,0);
  chk('the legacy fields are cleared',[('payments' in p),('originalBalance' in p)],[false,false]);
  chk('a pre-split backup of the whole document was written first',
    Object.keys(w.store).filter(k=>k.indexOf('dd_bs_predebt_v1_')===0).length,1);
  const bk=JSON.parse(w.store[Object.keys(w.store).filter(k=>k.indexOf('dd_bs_predebt_v1_')===0)[0]]);
  chk('the backup holds the pre-split record',
    [bk.productDebt.originalBalance,(bk.productDebt.payments||[]).length],[10033,6]);
  chk('the backup holds the rest of the document too',bk.shows.length,doc.shows.length);
}

R.section('=== 11. A PAYMENT THE OLD RECORD HELD AND THE SPLIT DOES NOT IS CARRIED OVER ===');
{
  const seedW=fresh();
  const doc=JSON.parse(JSON.stringify(seedW.ctx.S));
  delete doc._applied['debt_invoices_v1'];
  doc.productDebt={supplier:'Mark Martone',originalBalance:10033,payments:[
    {amount:250,date:'2026-05-01',note:'Payment 1'},
    {amount:77.5,date:'2026-06-11',note:'one-off cash drop'}]};
  const w=boot({dd_bs_v7:JSON.stringify(doc)});
  const i1=w.ctx.pdSorted(w.ctx.S.productDebt)[0];
  const extra=i1.payments.filter(p=>p.date==='2026-06-11')[0];
  chk('the unknown payment is not dropped',!!extra,true);
  chk('its amount is untouched',money(extra.amount),77.5);
  chk('it is marked as carried over rather than silently merged',
    /carried over from the pre-invoice record/.test(extra.note||''),true);
  chk('a payment already on the invoice is not duplicated',
    i1.payments.filter(p=>p.date==='2026-05-01').length,1);
  chk('invoice 2 is untouched by the carry-over',
    w.ctx.pdPaid(w.ctx.pdSorted(w.ctx.S.productDebt)[1]),0);
}

R.section('=== 12. EXPORT AND RESTORE KEEP THE INVOICES APART (req 12) ===');
{
  const w=fresh();
  // (a) the JSON backup / import path, which assigns a parsed document straight to S
  const backup=JSON.parse(JSON.stringify(w.ctx.S));
  const w2=fresh();
  withFields(w2,{});
  w2.ctx._applyStateObj(backup);
  const p2=w2.ctx.S.productDebt;
  chk('restore keeps two invoices',w2.ctx.pdInvoices(p2).length,2);
  chk('restore keeps invoice 1 paid in full',w2.ctx.pdSorted(p2)[0].status,'paid');
  chk('restore keeps all six payments on invoice 1',w2.ctx.pdSorted(p2)[0].payments.length,6);
  chk('restore keeps their methods',
    [...new Set(w2.ctx.pdSorted(p2)[0].payments.map(x=>x.method))],['Zelle']);
  chk('restore keeps invoice 2 empty and open',
    [w2.ctx.pdSorted(p2)[1].payments.length,w2.ctx.pdBalance(w2.ctx.pdSorted(p2)[1])],[0,5985]);

  // (b) the CSV in the full data export
  const files=w.ctx.bxCsvFiles(w.ctx.S,{exportSourceLabel:'test',exportSourceFingerprint:'x',
    exportedAt:'2026-08-24T00:00:00Z',appVersion:'test',featureBuild:'test'});
  const csv=files.filter(f=>f.name==='11_product_debt.csv')[0];
  chk('the product debt CSV is produced',!!csv,true);
  const rows=csv.text.split('\n').filter(l=>l&&l.indexOf('# source:')!==0);
  const head=rows[0].split(',').map(c=>c.replace(/^"|"$/g,''));
  chk('it is keyed by invoice',head.indexOf('invoice_number')>=0,true);
  chk('it records the method',head.indexOf('method')>=0,true);
  const body=rows.slice(1);
  chk('six payment rows for invoice 1 plus one placeholder row for invoice 2',body.length,7);
  chk('every invoice 1 row carries its own total',
    body.filter(l=>/^"?Mark Martone"?,1,/.test(l)).every(l=>l.indexOf('4048.00')>=0),true);
  chk('the invoice 2 row says no payments logged',
    body.filter(l=>/^"?Mark Martone"?,2,/.test(l))[0].indexOf('NO PAYMENTS LOGGED')>=0,true);
  chk('no row totals the two invoices together',csv.text.indexOf('10033')<0,true);

  // (c) the plain-text summary in the same export
  const meta={exportSourceLabel:'test',exportSourceFingerprint:'x',exportedAt:'2026-08-24T00:00:00Z',
    appVersion:'test',featureBuild:'test',exportSourceUpdatedAt:'x',counts:w.ctx.bxCounts(w.ctx.S)};
  const txt=String(w.ctx.bxSummary(w.ctx.S,meta,[],{sources:{memory:{},device:{},cloud:{}},coverage:{}}));
  chk('the summary breaks the debt out per invoice',
    /Invoice 1:/.test(txt)&&/Invoice 2:/.test(txt),true);
  chk('it states invoice 1 as paid in full',/Invoice 1:.*PAID IN FULL/.test(txt),true);
  chk('it states invoice 2 as open, owing 5985',/Invoice 2:[^\n]*\$5,985\.00[^\n]*OPEN/.test(txt),true);
  chk('it says the invoices are separate',/across 2 separate invoices/.test(txt),true);
  // (d) record counts used by the diagnostics card
  const c=w.ctx.bxCounts(w.ctx.S);
  chk('counts report two invoices',c.productDebtInvoices,2);
  chk('counts report six payments',c.productDebtPayments,6);
}

R.section('=== 13. A PRE-INVOICE DOCUMENT STILL READS CORRECTLY ===');
{
  // A backup file from before this change can be restored straight into S
  // without passing through the migration. Readers must not throw or drop it.
  const w=fresh();
  const legacy={supplier:'Mark Martone',originalBalance:1000,
    payments:[{amount:400,date:'2026-01-05',note:'check'}]};
  const list=w.ctx.pdInvoices(legacy);
  chk('it reads as one invoice',list.length,1);
  chk('with the legacy balance as its total',money(list[0].originalTotal),1000);
  chk('and the legacy payment on it',w.ctx.pdPaid(list[0]),400);
  chk('balance is computed, not merged',w.ctx.pdBalance(list[0]),600);
  chk('reading does not mutate the legacy record',('invoices' in legacy),false);
  chk('an empty record reads as no invoices',w.ctx.pdInvoices({}).length,0);
  chk('totals of an empty record are zero',
    w.ctx.pdTotals({}),{original:0,paid:0,balance:0,count:0,openCount:0,payments:0});
}

R.section('=== 14. THE MISSING ORDER DATE IS ASKED FOR, NOT GUESSED ===');
{
  const w=fresh();
  const h=w.ctx.secDebt();
  chk('the open invoice says the order date is not recorded',
    h.indexOf('order date not recorded')>=0,true);
  chk('and offers to set it',/openInvoiceDate/.test(h),true);
  const before1=JSON.stringify(inv(w,1));
  withFields(w,{idt_date:'2026-08-19'});
  w.ctx.saveInvoiceDate(inv(w,2).id);
  chk('setting it records the date on that invoice',inv(w,2).createdDate,'2026-08-19');
  chk('and changes nothing else on it',
    [w.ctx.pdPaid(inv(w,2)),w.ctx.pdBalance(inv(w,2)),inv(w,2).status,inv(w,2).payments.length],
    [0,5985,'open',0]);
  chk('and does not touch the other invoice',JSON.stringify(inv(w,1)),before1);
  chk('the page then shows the date instead of the notice',
    w.ctx.secDebt().indexOf('Ordered 2026-08-19')>=0,true);
  // a completed invoice keeps its date visible even while collapsed
  withFields(w,{idt_date:'2026-04-28'});
  w.ctx.saveInvoiceDate(inv(w,1).id);
  chk('a collapsed completed invoice shows its order date too',
    w.ctx.secDebt().indexOf('Ordered 2026-04-28')>=0,true);
}

R.section('=== 15. NO NEW TOP-LEVEL STATE FIELD ===');
{
  const w=fresh();
  const BASE=['v','reps','costs','shows','prices','freight','_applied','settings','supplies',
    'inventory','transfers','_updatedAt','productDebt','batmanBorrow','otherExpenses',
    'cogsHistory','cogsHistoryMeta'];
  chk('the invoices live inside productDebt, not beside it',
    Object.keys(w.ctx.S).filter(k=>BASE.indexOf(k)<0),[]);
  chk('the expanded-card state is screen-only and never saved',
    JSON.stringify(w.ctx.S).indexOf('_pdExpanded')<0,true);
}

R.done();
