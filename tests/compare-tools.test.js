// The comparison and snapshot tools are read-only by construction. This pins
// that (no write calls exist in their source) and checks the report on
// fixtures shaped like the real Sep 30 backup vs a damaged cloud copy.
// Run: node tests/compare-tools.test.js
'use strict';
const fs=require('fs'),path=require('path');
const {boot,reporter}=require('./harness');
const C=require('../tools/bs-compare.js');
const R=reporter();
const src=f=>fs.readFileSync(path.join(__dirname,'..','tools',f),'utf8');

R.section('Read-only by construction');
['cloud-snapshot.html','compare.html','bs-compare.js'].forEach(f=>{
  const s=src(f);
  R.check(f+': no upsert/insert/update/delete/rpc call',/\.(upsert|insert|update|delete|rpc)\s*\(/.test(s),false);
  R.check(f+': never touches localStorage',/localStorage/.test(s),false);
});
R.check('snapshot: session is not persisted',/persistSession:false/.test(src('cloud-snapshot.html')),true);

R.section('Report on a Sep 30-shaped backup vs a cloud that took the v69 payments twice and lost a show');
const w=boot();
const A=JSON.parse(JSON.stringify(w.run('S')));
const inv2=d=>d.productDebt.invoices.filter(i=>+i.number===2)[0];
inv2(A).payments=[{amount:2500,date:'2026-09-01'},{amount:500,date:'2026-09-28'}];
const www=d=>d.shows.filter(s=>/wonderful world/i.test(s.name))[0];
www(A).boothPayments=[{amount:250,date:'2026-08-18'}];
const B=JSON.parse(JSON.stringify(A));
inv2(B).payments.push({amount:2000,date:'2026-09-30'},{amount:2000,date:'2026-09-30'});
www(B).boothPayments.push({amount:418.9,date:'2026-09-30'});
B._applied.www_pay2_mm_2000_v69=true;
const gone=B.shows.splice(0,1)[0];
B.inventory.c5s=1;
const rep=C.compare(A,B,{labelA:'backup',labelB:'cloud'});
R.check('A inv #2 paid 3000',rep.v69.A.inv2Paid,3000);
R.check('B inv #2 paid 7000',rep.v69.B.inv2Paid,7000);
R.check('B duplicate Martone flagged',rep.v69.B.martone2000Entries,2);
R.check('B WWW paid 668.90',rep.v69.B.wwwPaid,668.9);
R.check('marker only in B',rep.markers.onlyB,['www_pay2_mm_2000_v69']);
R.check('lost show listed as only in A',rep.shows.onlyA.map(s=>s.id),[gone.id]);
R.check('inventory c5s difference',rep.inventory.map(x=>x.sku),['c5s']);
const txt=C.toText(rep);
R.check('text names the duplicate',/HAS A DUPLICATE v69 PAYMENT/.test(txt),true);
R.check('text shows invoice #2 balances',/Invoice #2\s+\*\* DIFFERENT \*\*/.test(txt),true);
R.check('inputs untouched',inv2(A).payments.length,2);
R.check('identical copies: zero differences',C.compare(A,JSON.parse(JSON.stringify(A))).allDiffCount,0);
R.done();
