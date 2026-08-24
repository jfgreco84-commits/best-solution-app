// Sequential supplier invoices (pd*) — Product Debt page.
//
// The invariant this file exists to protect: a supplier is a STACK of
// invoices, never one rolling balance. No figure on the page and no figure in
// an export may be produced by adding one invoice's total or payments to
// another's. Invoice 1 was settled in full and is frozen history; invoice 2 is
// a separate, fresh obligation that starts at zero paid.
//
// Every expected figure below is read from the app's own PD_MM_SEED rather
// than retyped, so the test asserts against the real ledger without this
// public repo carrying a second copy of it. The legacy fixture the migration
// runs against is built from that same seed.
'use strict';
const {boot,reporter}=require('./harness');
const R=reporter();
const chk=R.check.bind(R);

// ---- the pre-migration record, rebuilt from the app's own ledger ----
// One combined debt: both orders' totals added into originalBalance, every
// payment on one list, methods living in free-text notes.
function legacyState(ctx){
  const seed=ctx.PD_MM_SEED;
  const combined=seed.reduce((t,i)=>t+i.total,0);
  const pmts=seed[0].payments.map(p=>({
    amount:p.amount, date:p.date,
    // On the device the method had nowhere to live but the note: two rows were
    // mislabelled "Venmo", and the closing row carried a "Zelle — ..." prefix
    // in front of the owner's own text.
    note:(p.date==='2026-07-24'||p.date==='2026-07-27')?'Venmo'
       : (p.date==='2026-08-21')?'Zelle — first pallet paid in full, shipping free'
       : p.note
  }));
  return {v:7,inventory:{'32oz':1},shows:[],supplies:[],reps:[],otherExpenses:[],
    transfers:[],batmanBorrow:{},settings:{},prices:{},_applied:{},
    productDebt:{supplier:'Mark Martone',originalBalance:combined,payments:pmts}};
}
function device(){
  // A device holding the old combined record, then refreshed.
  const probe=boot();
  const seeded=legacyState(probe.ctx);
  return boot({dd_bs_v7:JSON.stringify(seeded)});
}

const b=device();
chk('app boots clean',b.bootError?b.bootError.message:null,null);
const C=b.ctx, S=C.S;
const inv1=C.pdInvoices(S).filter(i=>i.number===1)[0];
const inv2=C.pdInvoices(S).filter(i=>i.number===2)[0];
const SEED=C.PD_MM_SEED;

R.section('=== 1-5. INVOICE 1 — PAID IN FULL ===');
chk('1. invoice 1 total is the first pallet total',inv1.total,SEED[0].total);
chk('1b. and that total is 4048',inv1.total,4048);
chk('2. invoice 1 payments total the same figure',C.pdPaid(inv1),4048);
chk('2b. all six payments carried across',(inv1.payments||[]).length,6);
chk('2c. every confirmed payment survived, by date+amount',
  SEED[0].payments.every(sp=>inv1.payments.some(p=>p.date===sp.date&&p.amount===sp.amount)),true);
chk('3. invoice 1 balance is zero',C.pdBalance(inv1),0);
chk('4. every invoice 1 payment is Zelle',
  inv1.payments.map(p=>p.method).filter((m,i,a)=>a.indexOf(m)===i),['Zelle']);
chk('4b. no payment note still claims Venmo',
  inv1.payments.filter(p=>/venmo/i.test(p.note||'')).length,0);
chk('4c. a method typed into a note is not repeated beside the method field',
  inv1.payments.filter(p=>/^\s*zelle\s*[—–:-]/i.test(p.note||'')).length,0);
chk('4d. and the rest of that note is kept verbatim',
  inv1.payments.filter(p=>p.date==='2026-08-21')[0].note,
  'first pallet paid in full, shipping free');
chk('5. derived status is paid',C.pdStatus(inv1),'paid');
chk('5b. stored status matches the derived one',inv1.status,'paid');
chk('5c. settled on the date of the closing payment',inv1.paidDate,'2026-08-21');
chk('5d. the page renders PAID IN FULL',/PAID IN FULL/.test(C.pdInvoiceCard(inv1,false)),true);
chk('5e. nothing was parked as unassigned',(S.productDebt.unassignedPayments||[]).length,0);
chk('5f. invoice 1 order detail is the first pallet',
  inv1.items.map(i=>i.label+':'+i.cases).join(','),
  SEED[0].items.map(i=>i.label+':'+i.cases).join(','));
chk('5g. shipping on invoice 1 is free',inv1.shipping,'Free');

R.section('=== 6-8. INVOICE 2 — OPEN AND FRESH ===');
chk('6. invoice 2 total is the second order total',inv2.total,SEED[1].total);
chk('6b. and that total is 5985',inv2.total,5985);
chk('7. invoice 2 paid is zero',C.pdPaid(inv2),0);
chk('7b. invoice 2 holds no payments at all',(inv2.payments||[]).length,0);
chk('8. invoice 2 balance is the full total',C.pdBalance(inv2),5985);
chk('8b. derived status is open',C.pdStatus(inv2),'open');
chk('8c. invoice 2 is the one open invoice',C.pdOpenInvoice(S).id,inv2.id);
chk('8d. invoice 2 order detail includes C5X',
  inv2.items.map(i=>i.label+':'+i.cases).join(','),
  SEED[1].items.map(i=>i.label+':'+i.cases).join(','));
chk('8e. no paid-in-full date on an open invoice',inv2.paidDate,null);

R.section('=== NOTHING IS MERGED ===');
const T=C.pdSupplierTotals(S);
chk('exactly two invoices',T.invoices,2);
chk('one paid, one open',[T.paid,T.open],[1,1]);
chk('the roll-up figures are available but never merged into one invoice',
  [T.totalInvoiced,T.totalPaid,T.totalOwed],[10033,4048,5985]);
chk('the legacy combined balance field is gone',S.productDebt.originalBalance,undefined);
chk('the legacy shared payment list is gone',S.productDebt.payments,undefined);
const page=C.secDebt();
chk('the page never shows a single combined original',/\$10,033/.test(page),false);
chk('the page never shows the old 40% figure',/40% paid/.test(page),false);
chk('the page names the summary as a roll-up, not one debt',
  /not one combined debt/.test(page),true);
chk('the active invoice is rendered above the paid history',
  page.indexOf('ACTIVE INVOICE')<page.indexOf('PAID INVOICES'),true);
chk('the settled invoice starts collapsed',/tap to expand/.test(page),true);
chk('and can be expanded',(function(){C.pdOpenCards[inv1.id]=true;
  const p=C.secDebt(); C.pdOpenCards[inv1.id]=false;
  // expanded shows the full order line and every payment date
  return /32 oz/.test(p)&&SEED[0].payments.every(x=>p.indexOf(x.date)>=0);})(),true);
chk('a settled invoice offers no Log Payment button',
  /Log Payment to Invoice 1/.test(C.pdInvoiceCard(inv1,false)),false);
chk('a settled invoice offers no remove-payment control',
  /pdRemovePayment/.test(C.pdInvoiceCard(inv1,false)),false);

R.section('=== 9. A PAYMENT LANDS ON INVOICE 2 ONLY ===');
{
  const before1=JSON.stringify(inv1);
  const fields={'dpt_amt':{value:'100'},'dpt_date':{value:'2026-08-24'},
                'dpt_method':{value:'Zelle'},'dpt_note':{value:'reversible test payment'}};
  C.$$=id=>fields[id]||b.el();
  C.window.__lastSave=0;
  C.saveDebtPmt(inv2.id);
  chk('9. the test payment is on invoice 2',C.pdPaid(inv2),100);
  chk('9b. invoice 2 balance drops by exactly that much',C.pdBalance(inv2),5885);
  chk('9c. invoice 2 is still open',C.pdStatus(inv2),'open');
  chk('9d. invoice 1 is untouched, byte for byte',JSON.stringify(inv1),before1);
  chk('9e. it defaults to the open invoice with no id given',(function(){
    C.window.__lastSave=0; C.saveDebtPmt();
    const ok=C.pdPaid(inv2)===200; return ok;})(),true);
  chk('9f. an open invoice does offer remove',/pdRemovePayment/.test(C.pdInvoiceCard(inv2,true)),true);
  // reverse both test payments
  C.confirm=()=>true;
  C.pdRemovePayment(inv2.id,inv2.payments.length-1);
  C.pdRemovePayment(inv2.id,inv2.payments.length-1);
  chk('9g. removing them restores invoice 2 exactly',
    [C.pdPaid(inv2),C.pdBalance(inv2),(inv2.payments||[]).length],[0,5985,0]);
  chk('9h. invoice 1 still untouched after the reversal',JSON.stringify(inv1),before1);
  chk('9i. a payment is refused on a settled invoice',(function(){
    const b4=JSON.stringify(inv1); C.window.__lastSave=0; C.saveDebtPmt(inv1.id);
    return JSON.stringify(inv1)===b4;})(),true);
}

R.section('=== 10. A REFRESH KEEPS BOTH INVOICES ===');
{
  const b2=boot({dd_bs_v7:b.store['dd_bs_v7']});
  const i1=b2.ctx.pdInvoices(b2.ctx.S).filter(i=>i.number===1)[0];
  const i2=b2.ctx.pdInvoices(b2.ctx.S).filter(i=>i.number===2)[0];
  chk('10. both invoices survive the reload',b2.ctx.pdInvoices(b2.ctx.S).length,2);
  chk('10b. invoice 1 still 4048 paid in full',[i1.total,b2.ctx.pdPaid(i1),b2.ctx.pdBalance(i1),b2.ctx.pdStatus(i1)],
    [4048,4048,0,'paid']);
  chk('10c. invoice 2 still 5985 open with nothing paid',
    [i2.total,b2.ctx.pdPaid(i2),b2.ctx.pdBalance(i2),b2.ctx.pdStatus(i2)],[5985,0,5985,'open']);
  chk('10d. the migration does not run twice',b2.ctx.S._applied['mm_sequential_invoices_v1'],true);
  chk('10e. no third invoice appeared',b2.ctx.pdInvoices(b2.ctx.S).map(i=>i.number),[1,2]);
  chk('10f. a pre-migration backup key was written',
    Object.keys(b.store).filter(k=>k.indexOf('dd_bs_pre_pdinvoices_')===0).length,1);
  const bak=JSON.parse(Object.keys(b.store).filter(k=>k.indexOf('dd_bs_pre_pdinvoices_')===0)
    .map(k=>b.store[k])[0]);
  chk('10g. and it holds the old combined record verbatim',
    [bak.productDebt.originalBalance,(bak.productDebt.payments||[]).length],[10033,6]);
}

R.section('=== 11. INVOICE 3 CHANGES NOTHING ===');
{
  const before=JSON.stringify(C.pdInvoices(C.S));
  const nf={'ni_total':{value:'2400'},'ni_date':{value:'2026-09-15'},'ni_ship':{value:'Free'},
            'ni_note':{value:''},'ni_lbl0':{value:'32 oz'},'ni_qty0':{value:'12'},
            'ni_lbl1':{value:'8 oz'},'ni_qty1':{value:'6'}};
  C.$$=id=>nf[id]||b.el();
  C.confirm=()=>true; C.window.__lastSave=0;
  C.saveNewInvoice();
  const invs=C.pdInvoices(C.S);
  chk('11. invoice 3 exists',invs.map(i=>i.number),[1,2,3]);
  const i3=invs[2];
  chk('11b. with its own total, zero paid, full balance',
    [i3.total,C.pdPaid(i3),C.pdBalance(i3),C.pdStatus(i3)],[2400,0,2400,'open']);
  chk('11c. and its own order detail',i3.items.map(x=>x.label+':'+x.cases).join(','),'32 oz:12,8 oz:6');
  chk('11d. invoices 1 and 2 are unchanged, byte for byte',
    JSON.stringify(invs.slice(0,2)),before);
  chk('11e. ids are unique',invs.map(i=>i.id).filter((v,i,a)=>a.indexOf(v)===i).length,3);
  chk('11f. the lowest-numbered unpaid invoice is still the default target',
    C.pdOpenInvoice(C.S).number,2);
  chk('11g. two open invoices raise a diagnostic',(function(){
    const d=C.bxDiagnose(C.S,null,null).filter(x=>x.code==='DEBT_MULTI_OPEN');
    return d.length===1&&d[0].count===2;})(),true);
  // put the device back to two invoices
  C.S.productDebt.invoices.splice(2,1);
  chk('11h. removed again cleanly',C.pdInvoices(C.S).map(i=>i.number),[1,2]);
}

R.section('=== 12. EXPORT AND RESTORE KEEP THEM APART ===');
{
  const st=JSON.parse(JSON.stringify(C.S));
  const csv=(function(){
    const files=C.bxCsvFiles(st,{exportSourceLabel:'t',exportSourceFingerprint:'t',
      exportedAt:'t',appVersion:'t',featureBuild:'t'});
    return files.filter(f=>f.name==='11_product_debt.csv')[0].text;})();
  const rows=csv.split(/\r?\n/).filter(l=>l&&l[0]!=='#');
  const body=rows.slice(1);
  chk('12. one export row per payment, both invoices represented',body.length,7); // 6 + the empty invoice 2
  const inv1Rows=body.filter(l=>/^Mark Martone,1,/.test(l));
  const inv2Rows=body.filter(l=>/^Mark Martone,2,/.test(l));
  chk('12b. six rows, all stamped invoice 1, all PAID, all Zelle, none over 4048',
    [inv1Rows.length,inv1Rows.every(l=>/,PAID,/.test(l)&&/,Zelle,/.test(l)),
     inv1Rows.every(l=>l.indexOf('4048.00')>=0)],[6,true,true]);
  chk('12c. invoice 2 exports as one OPEN row with no payments logged',
    [inv2Rows.length,/,5985\.00,OPEN,/.test(inv2Rows[0]),
     /NO PAYMENTS LOGGED,0\.00,5985\.00$/.test(inv2Rows[0])],[1,true,true]);
  chk('12c2. and the two invoices never share a running balance',
    inv1Rows[inv1Rows.length-1].split(',').slice(-1)[0],'0.00');
  chk('12d. the export carries no combined 10033 total',/10033/.test(csv),false);
  chk('12e. counts report invoices and payments separately',
    (function(){const c=C.bxCounts(st);return [c.productDebtInvoices,c.productDebtPayments];})(),[2,6]);
  const summary=(function(){
    const meta={exportSourceLabel:'t',exportSourceFingerprint:'t',exportedAt:'2026-08-24T00:00:00Z',
      appVersion:'t',featureBuild:'t',baseCommit:'t',backupBranch:'t',featureCommit:'t',
      builtOn:'t',phase:'t',localBackupSlots:0,capturedAllCopies:true,coverageNote:'',
      cloudStatus:'',cloudStatusCode:0,counts:C.bxCounts(st),_sources:{},_recon:{available:false}};
    return C.bxSummary(st,meta,[],{sources:{},selected:'memory',localBackups:[],meta:meta,
      comparison:null,cloudRead:null});})();
  chk('12f. the summary lists each invoice on its own line, with its own status',
    [/Invoice 1 .*PAID on 2026-08-21/.test(summary),/Invoice 2 .*OPEN/.test(summary)],[true,true]);
  chk('12f2. and reports the supplier account without merging the orders',
    /still owed of \$10,033\.00 invoiced across 2 invoice/.test(summary),true);

  // restore the exported state onto a device that never saw the migration
  const fresh=boot();
  fresh.ctx.S=null;
  fresh.ctx._applyStateObj(JSON.parse(JSON.stringify(st)));
  const r1=fresh.ctx.pdInvoices(fresh.ctx.S).filter(i=>i.number===1)[0];
  const r2=fresh.ctx.pdInvoices(fresh.ctx.S).filter(i=>i.number===2)[0];
  chk('12g. a restore keeps invoice 1 settled at 4048',
    [r1.total,fresh.ctx.pdPaid(r1),fresh.ctx.pdStatus(r1)],[4048,4048,'paid']);
  chk('12h. and invoice 2 open at 5985 with no payments',
    [r2.total,fresh.ctx.pdPaid(r2),(r2.payments||[]).length,fresh.ctx.pdStatus(r2)],
    [5985,0,0,'open']);
  chk('12i. payment methods survive the round trip',
    r1.payments.map(p=>p.method).filter((m,i,a)=>a.indexOf(m)===i),['Zelle']);

  // and a LEGACY backup restored onto this build is upgraded, not left broken
  const legacyFile=Object.assign(legacyState(C),{inventory:{'32oz':1},shows:[]});
  const f2=boot(); f2.ctx.S=null;
  f2.ctx._applyStateObj(JSON.parse(JSON.stringify(legacyFile)));
  chk('12j. an OLD backup restores into the invoice shape, losing no payment',
    [f2.ctx.pdInvoices(f2.ctx.S).length,f2.ctx.pdPaymentCount(f2.ctx.S)],[1,6]);
  chk('12k. with the legacy fields cleared away',
    [f2.ctx.S.productDebt.payments,f2.ctx.S.productDebt.originalBalance],[undefined,undefined]);
}

R.section('=== NO UNRELATED DATA TOUCHED ===');
{
  // Control: take a device that has already run every historical migration,
  // wind ONLY the debt record back to the old combined shape, drop ONLY this
  // migration's marker, and boot again. Every other migration is already
  // marked, so the single thing that runs is the invoice split. Anything that
  // moves outside productDebt was moved by it.
  const before=JSON.parse(JSON.stringify(C.S));
  const wound=JSON.parse(JSON.stringify(C.S));
  delete wound._applied['mm_sequential_invoices_v1'];
  wound.productDebt=JSON.parse(JSON.stringify(legacyState(C).productDebt));
  const after=boot({dd_bs_v7:JSON.stringify(wound)}).ctx.S;
  const strip=o=>{const c=JSON.parse(JSON.stringify(o));delete c.productDebt;delete c._applied;
    delete c._updatedAt;return c;};
  chk('every field outside productDebt is identical',
    JSON.stringify(strip(after)),JSON.stringify(strip(before)));
  chk('shows, inventory, reps, supplies and expenses all untouched',
    ['shows','inventory','reps','supplies','otherExpenses','transfers','batmanBorrow','settings','prices']
      .filter(k=>JSON.stringify(after[k])!==JSON.stringify(before[k])),[]);
  chk('the only marker it adds is its own',
    Object.keys(after._applied).filter(k=>!(k in wound._applied)),['mm_sequential_invoices_v1']);
  chk('and it lands back on the same two invoices',
    after.productDebt.invoices.map(i=>[i.number,i.total,i.status].join(':')),
    ['1:4048:paid','2:5985:open']);
  const BASE=['v','reps','costs','shows','prices','freight','_applied','settings','supplies',
    'inventory','transfers','_updatedAt','productDebt','batmanBorrow','otherExpenses',
    'cogsHistory','cogsHistoryMeta'];
  chk('no new top-level state key',Object.keys(after).filter(k=>BASE.indexOf(k)<0),[]);
}

R.section('=== NOTHING IS EVER SILENTLY DROPPED ===');
{
  // a payment on the old record that is NOT on the confirmed ledger must be
  // parked and visible, never folded into an invoice or deleted.
  const probe=boot();
  const odd=legacyState(probe.ctx);
  odd.productDebt.payments.push({amount:17.5,date:'2026-06-09',note:'mystery row'});
  const d=boot({dd_bs_v7:JSON.stringify(odd)});
  const un=d.ctx.S.productDebt.unassignedPayments;
  chk('the stray payment is parked, not lost',un.map(p=>p.amount),[17.5]);
  chk('it is counted against no invoice',
    d.ctx.pdInvoices(d.ctx.S).map(i=>d.ctx.pdPaid(i)),[4048,0]);
  chk('it is still counted as a record that exists',d.ctx.pdPaymentCount(d.ctx.S),7);
  chk('the page surfaces it for review',/Unassigned payments/.test(d.ctx.secDebt()),true);
  chk('and it raises a CRITICAL diagnostic',(function(){
    const g=d.ctx.bxDiagnose(d.ctx.S,null,null).filter(x=>x.code==='DEBT_UNASSIGNED');
    return g.length===1&&g[0].sev==='CRITICAL'&&g[0].count===1;})(),true);
}

R.section('=== NO VALUE IS INVENTED ===');
{
  chk('no invoice date was made up for invoice 1',inv1.createdDate,null);
  chk('no invoice date was made up for invoice 2',inv2.createdDate,null);
  chk('the paid-in-full date is the closing payment date, not a guess',
    inv1.paidDate,inv1.payments[inv1.payments.length-1].date);
}

R.section('=== 13. MOBILE LAYOUT ===');
{
  C.pdOpenCards[inv1.id]=true;
  const html=C.secDebt();
  C.pdOpenCards[inv1.id]=false;
  chk('13. nothing is pinned to a width a phone cannot hold',
    (html.match(/(^|[^-])width:\s*(\d{3,})px/g)||[]).length,0);
  chk('13b. every flex row is allowed to wrap or shrink',
    (html.match(/display:flex/g)||[]).length>0&&/flex-wrap:wrap/.test(html),true);
  chk('13c. free-text notes break instead of overflowing',/overflow-wrap:anywhere/.test(html),true);
  chk('13d. stat boxes are proportional, not fixed',/flex:1 1 \d+%/.test(html),true);
  chk('13e. the note cell that holds the long text is the breakable one',
    /overflow-wrap:anywhere">(?:(?!<\/span>).)*shipping free/.test(html),true);
  chk('13f. the payment date column cannot be squeezed out by a long note',
    /flex:0 0 78px/.test(html),true);
}

R.done();
