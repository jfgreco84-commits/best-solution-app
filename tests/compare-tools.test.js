// The comparison and snapshot tools are read-only by construction. This pins
// that (no write calls exist in their source) and checks the report on
// fixtures shaped like the real Sep 30 backup vs a damaged cloud copy.
// Run: node tests/compare-tools.test.js
'use strict';
const fs=require('fs'),path=require('path');
const {boot,reporter}=require('./harness');
const C=require('../tools/bs-compare.js');
const crypto=require('crypto'),vm=require('vm');
const R=reporter();
const src=f=>fs.readFileSync(path.join(__dirname,'..','tools',f),'utf8');

R.section('Read-only by construction');
['cloud-snapshot.html','compare.html','bs-compare.js'].forEach(f=>{
  const s=src(f);
  R.check(f+': no upsert/insert/update/delete/rpc call',/\.(upsert|insert|update|delete|rpc)\s*\(/.test(s),false);
  R.check(f+': never touches localStorage',/localStorage/.test(s),false);
});
const snap=src('cloud-snapshot.html');
R.check('snapshot: session is not persisted',/persistSession:false/.test(snap),true);
R.check('snapshot: no unpinned CDN library',/cdn\.jsdelivr|unpkg|@supabase\/supabase-js@2"/.test(snap),false);
{ const m=snap.match(/src="(vendor\/[^"]+)" integrity="([^"]+)"/);
  const want=m&&('sha384-'+crypto.createHash('sha384').update(fs.readFileSync(path.join(__dirname,'..','tools',m[1]))).digest('base64'));
  R.check('snapshot: vendored library matches its integrity hash',!!m&&m[2]===want,true); }
const fin=snap.slice(snap.indexOf('finally{'));
R.check('snapshot: sign-out runs in finally (no-row and error paths too)',/finally\{[\s\S]*signOut\(\{scope:'local'\}\)/.test(snap),true);
R.check('snapshot: sign-out error is reported',/so\.error/.test(fin),true);
R.check('snapshot: password field cleared',/pwEl\.value=''/.test(fin)&&/pwEl\.value='';\s*\n\s*var si=/.test(snap),true);
R.check('snapshot: blob URL revoked',/revokeObjectURL/.test(fin),true);
R.check('snapshot: no claim that it "cannot save anything"',/cannot save anything/i.test(snap),false);

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

R.section('Exhaustive diff is complete and untruncated');
{ const X=JSON.parse(JSON.stringify(A)), Y=JSON.parse(JSON.stringify(A));
  X.big=Array.from({length:600},(_,i)=>i); Y.big=Array.from({length:600},(_,i)=>i+1);
  Y.longText='x'.repeat(500);
  const full=C.exhaustive(X,Y,{});
  R.check('all 601 differences present (summary caps at 400)',full.count,601);
  R.check('summary is capped',C.compare(X,Y).allDiffs.length,400);
  R.check('values are not clipped',full.differences.find(d=>d.path==='longText').b.length,500);
  R.check('summary text says it is not a repair ledger',/NOT A REPAIR LEDGER/.test(C.toText(C.compare(X,Y))),true); }

R.section('compare.html: a failed or changed comparison never leaves an old report downloadable');
(async()=>{
  const html=src('compare.html'), js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
  const els={}, mk=id=>els[id]||(els[id]={id,textContent:'',files:null,listeners:{},addEventListener(t,f){this.listeners[t]=f;}});
  ['fa','fb','ha','hb','out'].forEach(mk);
  const downloads=[];
  const ctx={bsCompare:C,crypto:crypto.webcrypto,TextEncoder,Blob:class{constructor(p){this.p=p;}},
    URL:{createObjectURL:b=>{downloads.push(b.p.join(''));return 'blob:x';},revokeObjectURL(){}},
    alert:m=>{downloads.push('ALERT:'+m);},setTimeout:()=>0,
    FileReader:class{readAsText(f){this.result=f.text;setImmediate(()=>this.onload());}},
    document:{getElementById:mk,createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}}};
  vm.createContext(ctx); vm.runInContext(js,ctx);
  const file=(name,obj)=>({name,size:1,text:typeof obj==='string'?obj:JSON.stringify(obj)});
  els.fa.files=[file('a.json',A)]; els.fb.files=[file('b.json',B)];
  await ctx.go(); ctx.save();
  R.check('first compare produced a report',downloads.length===1&&/BEST SOLUTION DATA COMPARISON/.test(downloads[0]),true);
  R.check('full 64-hex hashes in the report',/sha256 [0-9a-f]{64}\)/.test(downloads[0]),true);
  els.fb.files=[file('broken.json','{not json')];
  await ctx.go(); ctx.save(); ctx.saveFull();
  R.check('after a failed compare there is nothing to download',downloads.slice(1).every(d=>/^ALERT:/.test(d)),true);
  els.fb.files=[file('b.json',B)]; await ctx.go();
  els.fa.listeners.change(); ctx.save();
  R.check('changing an input clears the previous report',/^ALERT:/.test(downloads[downloads.length-1]),true);
  R.done();
})();
