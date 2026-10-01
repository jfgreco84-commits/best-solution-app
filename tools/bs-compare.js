// Best Solution: field-by-field comparison of two saved copies of the app data
// (e.g. the Sep 30 Desktop backup vs a read-only cloud snapshot). Pure function,
// no I/O, works in the browser (window.bsCompare) and in Node (require).
// It never changes either input.
(function(root){
  'use strict';
  const num=v=>{const n=parseFloat(v);return isFinite(n)?n:0;};
  const r2=n=>Math.round(n*100)/100;
  const money=n=>'$'+r2(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const J=v=>JSON.stringify(v===undefined?null:v);
  const done=d=>((d&&d.shows)||[]).filter(s=>s&&s.status==='completed').length;
  const sum=(a,f)=>(a||[]).reduce((t,x)=>t+num(f?f(x):x),0);
  function dayMoney(sh){return sum(sh.days,d=>sum(Object.values((d&&d.payments)||{})));}
  function showSummary(sh){
    return {name:sh.name||'',status:sh.status||'',startDate:sh.startDate||'',numDays:sh.numDays||0,
      passed:!!sh.passed,boothCost:num(sh.boothCost),boothPaid:r2(sum(sh.boothPayments,x=>x&&x.amount)),
      depositDue:sh.depositDue||'',gross:r2(dayMoney(sh)),
      morning:J((sh.days||[]).map(d=>d&&d.morningCount)),evening:J((sh.days||[]).map(d=>d&&d.eveningCount)),
      packed:J(sh.packedInventory||null),returned:J(sh.returned||null),returnedAt:sh.returnedAt||'',
      completedAt:sh.completedAt||'',payRound:J(sh.payRound||null),
      workersPaid:r2(sum(sh.workers,w=>w&&w.paid)),showExpenses:r2(sum(sh.showExpenses,x=>x&&x.amount))};
  }
  function deepDiff(a,b,path,out,limit){
    if(out.length>=limit)return;
    if(J(a)===J(b))return;
    const oa=a&&typeof a==='object',ob=b&&typeof b==='object';
    if(oa&&ob&&Array.isArray(a)===Array.isArray(b)){
      const keys=Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
      keys.forEach(k=>deepDiff(a[k],b[k],path?path+'.'+k:k,out,limit));
    } else out.push({field:path,a:a,b:b});
  }
  function inv2(d){return (((d&&d.productDebt)||{}).invoices||[]).filter(i=>num(i.number)===2)[0]||null;}
  function invoiceView(inv){
    if(!inv)return null;
    const paid=r2(sum(inv.payments,p=>p&&p.amount));
    return {number:num(inv.number),total:r2(num(inv.total)),paid,balance:r2(num(inv.total)-paid),status:inv.status||'',
      payments:(inv.payments||[]).map(p=>({date:p.date||'',amount:r2(num(p.amount)),note:p.note||'',id:p.id||''}))};
  }
  function www(d){return ((d&&d.shows)||[]).find(s=>s&&/wonderful world of weddings/i.test(s.name||''))||null;}
  function cranberry(d){return ((d&&d.shows)||[]).find(s=>s&&/cranberry/i.test(s.name||'')&&String(s.startDate||'').indexOf('2026-09')===0)||null;}
  function v69Status(d){
    const i=inv2(d), w=www(d);
    const mm2000=((i&&i.payments)||[]).filter(p=>num(p.amount)===2000&&p.date==='2026-09-30').length;
    const w418=((w&&w.boothPayments)||[]).filter(p=>Math.abs(num(p.amount)-418.9)<0.005&&p.date==='2026-09-30').length;
    return {marker:!!((d&&d._applied)||{})['www_pay2_mm_2000_v69'],martone2000Entries:mm2000,www418Entries:w418,
      inv2Paid:i?r2(sum(i.payments,p=>p&&p.amount)):null,wwwPaid:w?r2(sum(w.boothPayments,p=>p&&p.amount)):null,
      wwwNextDue:w?(w.depositDue||''):null};
  }
  function compare(A,B,opt){
    opt=opt||{}; const la=opt.labelA||'A', lb=opt.labelB||'B';
    const rep={labelA:la,labelB:lb,headline:{},shows:{onlyA:[],onlyB:[],changed:[]},inventory:[],reps:[],
      invoices:[],www:null,cranberry:null,v69:{A:v69Status(A),B:v69Status(B)},markers:{onlyA:[],onlyB:[]},
      otherExpenses:null,onlineSales:null,settings:[],allDiffs:[],allDiffCount:0};
    rep.headline={A:{shows:(A.shows||[]).length,finished:done(A),updatedAt:A._updatedAt||'',syncProtocol:A._syncProtocol||null},
                  B:{shows:(B.shows||[]).length,finished:done(B),updatedAt:B._updatedAt||'',syncProtocol:B._syncProtocol||null}};
    const ma={},mb={}; (A.shows||[]).forEach(s=>{if(s)ma[s.id]=s;}); (B.shows||[]).forEach(s=>{if(s)mb[s.id]=s;});
    Object.keys(ma).forEach(id=>{ if(!mb[id])rep.shows.onlyA.push({id,name:ma[id].name,status:ma[id].status}); });
    Object.keys(mb).forEach(id=>{ if(!ma[id])rep.shows.onlyB.push({id,name:mb[id].name,status:mb[id].status}); });
    Object.keys(ma).forEach(id=>{ if(!mb[id])return; const x=showSummary(ma[id]),y=showSummary(mb[id]);
      const f=Object.keys(x).filter(k=>J(x[k])!==J(y[k])).map(k=>({field:k,a:x[k],b:y[k]}));
      const raw=[]; deepDiff(ma[id],mb[id],'',raw,1e6);
      if(f.length||raw.length)rep.shows.changed.push({id,name:ma[id].name,fields:f,rawFieldCount:raw.length}); });
    const ia=A.inventory||{},ib=B.inventory||{};
    Array.from(new Set(Object.keys(ia).concat(Object.keys(ib)))).forEach(k=>{ if(J(ia[k])!==J(ib[k]))rep.inventory.push({sku:k,a:ia[k],b:ib[k]}); });
    const ra={},rb={}; (A.reps||[]).forEach(r=>{ra[r.id]=r;}); (B.reps||[]).forEach(r=>{rb[r.id]=r;});
    Array.from(new Set(Object.keys(ra).concat(Object.keys(rb)))).forEach(id=>{ const x=ra[id],y=rb[id];
      if(J(x)===J(y))return;
      rep.reps.push({id,name:(x||y).name,inA:!!x,inB:!!y,paidA:x?r2(sum(x.payments,p=>p&&p.amount)):null,paidB:y?r2(sum(y.payments,p=>p&&p.amount)):null}); });
    const na={},nb={}; (((A.productDebt||{}).invoices)||[]).forEach(i=>{na[num(i.number)]=i;}); (((B.productDebt||{}).invoices)||[]).forEach(i=>{nb[num(i.number)]=i;});
    Array.from(new Set(Object.keys(na).concat(Object.keys(nb)))).sort().forEach(n=>{
      const x=invoiceView(na[n]),y=invoiceView(nb[n]);
      rep.invoices.push({number:+n,a:x,b:y,same:J(x)===J(y)}); });
    const wa=www(A),wb=www(B);
    rep.www={a:wa?{paid:r2(sum(wa.boothPayments,p=>p&&p.amount)),cost:num(wa.boothCost),nextDue:wa.depositDue||'',payments:wa.boothPayments||[]}:null,
             b:wb?{paid:r2(sum(wb.boothPayments,p=>p&&p.amount)),cost:num(wb.boothCost),nextDue:wb.depositDue||'',payments:wb.boothPayments||[]}:null};
    const ca=cranberry(A),cb=cranberry(B);
    rep.cranberry={a:ca?showSummary(ca):null,b:cb?showSummary(cb):null};
    const ka=Object.keys(A._applied||{}),kb=Object.keys(B._applied||{});
    rep.markers.onlyA=ka.filter(k=>kb.indexOf(k)<0); rep.markers.onlyB=kb.filter(k=>ka.indexOf(k)<0);
    rep.otherExpenses={a:{count:(A.otherExpenses||[]).length,total:r2(sum(A.otherExpenses,x=>x&&x.amount))},b:{count:(B.otherExpenses||[]).length,total:r2(sum(B.otherExpenses,x=>x&&x.amount))}};
    const oa=((A.settings||{}).onlineSales)||[],ob=((B.settings||{}).onlineSales)||[];
    rep.onlineSales={a:{count:oa.length,total:r2(sum(oa,x=>x&&x.amount))},b:{count:ob.length,total:r2(sum(ob,x=>x&&x.amount))}};
    deepDiff(A.settings||{},B.settings||{},'settings',rep.settings,200);
    const all=[]; deepDiff(A,B,'',all,1e6); rep.allDiffCount=all.length; rep.allDiffs=all.slice(0,400);
    return rep;
  }
  function toText(rep){
    const L=[],A=rep.labelA,B=rep.labelB,h=rep.headline;
    const p=s=>L.push(s);
    p('BEST SOLUTION DATA COMPARISON');
    p('A = '+A); p('B = '+B); p('');
    p('HEADLINE');
    p('  Shows:     A '+h.A.shows+' ('+h.A.finished+' finished)   B '+h.B.shows+' ('+h.B.finished+' finished)');
    p('  Last save: A '+(h.A.updatedAt||'none')+'   B '+(h.B.updatedAt||'none'));
    p('  Total field differences: '+rep.allDiffCount); p('');
    p('MARK MARTONE INVOICES');
    rep.invoices.forEach(i=>{
      const f=v=>v?('paid '+money(v.paid)+' of '+money(v.total)+', balance '+money(v.balance)+', '+v.payments.length+' payments'):'MISSING';
      p('  Invoice #'+i.number+(i.same?'  (same)':'  ** DIFFERENT **'));
      p('    A: '+f(i.a)); p('    B: '+f(i.b));
      if(!i.same){ const k=x=>x.date+' '+money(x.amount); const sa=(i.a?i.a.payments:[]).map(k),sb=(i.b?i.b.payments:[]).map(k);
        sa.filter(x=>sb.indexOf(x)<0).forEach(x=>p('    only in A: '+x)); sb.filter(x=>sa.indexOf(x)<0).forEach(x=>p('    only in B: '+x)); }
    }); p('');
    p('V69 PAYMENTS (Martone $2,000 on 9/30, WWW $418.90 on 9/30)');
    ['A','B'].forEach(s=>{const v=rep.v69[s]; p('  '+s+': v69 marker '+(v.marker?'SET':'not set')+' · Martone 9/30 $2,000 entries: '+v.martone2000Entries+' · WWW 9/30 $418.90 entries: '+v.www418Entries+' · inv #2 paid '+(v.inv2Paid==null?'n/a':money(v.inv2Paid))+' · WWW paid '+(v.wwwPaid==null?'n/a':money(v.wwwPaid))+' · WWW next due '+(v.wwwNextDue||'n/a'));
      if(v.martone2000Entries>1||v.www418Entries>1)p('  ** '+s+' HAS A DUPLICATE v69 PAYMENT **'); });
    p('');
    p('WONDERFUL WORLD OF WEDDINGS');
    ['a','b'].forEach(s=>{const w=rep.www[s]; p('  '+s.toUpperCase()+': '+(w?('paid '+money(w.paid)+' of '+money(w.cost)+', next due '+(w.nextDue||'none')+' · '+w.payments.map(x=>(x.date||'?')+' '+money(num(x.amount))).join(', ')):'MISSING'));});
    p('');
    p('CRANBERRY FEST (Sep 2026)');
    const ca=rep.cranberry.a,cb=rep.cranberry.b;
    if(!ca||!cb)p('  A: '+(ca?'present':'MISSING')+'   B: '+(cb?'present':'MISSING'));
    if(ca||cb)Object.keys(ca||cb).forEach(k=>{const x=ca?ca[k]:null,y=cb?cb[k]:null; p('  '+(J(x)===J(y)?'  ':'**')+' '+k+': A '+J(x)+(J(x)===J(y)?'':'   B '+J(y)));});
    p('');
    p('SHOWS');
    p('  Only in A: '+(rep.shows.onlyA.map(s=>s.name+' ['+s.status+']').join(' · ')||'none'));
    p('  Only in B: '+(rep.shows.onlyB.map(s=>s.name+' ['+s.status+']').join(' · ')||'none'));
    rep.shows.changed.forEach(s=>{ p('  Changed: '+s.name+' ('+s.rawFieldCount+' raw fields)');
      s.fields.forEach(f=>p('      '+f.field+': A '+J(f.a)+'  B '+J(f.b))); });
    p('');
    p('GARAGE INVENTORY'); if(!rep.inventory.length)p('  same'); rep.inventory.forEach(x=>p('  '+x.sku+': A '+x.a+'  B '+x.b)); p('');
    p('REPS'); if(!rep.reps.length)p('  same'); rep.reps.forEach(r=>p('  '+r.name+': '+(!r.inA?'only in B':!r.inB?'only in A':'paid A '+money(r.paidA)+'  B '+money(r.paidB)+(r.paidA===r.paidB?' (other fields differ)':'')))); p('');
    p('OTHER EXPENSES  A '+rep.otherExpenses.a.count+' / '+money(rep.otherExpenses.a.total)+'   B '+rep.otherExpenses.b.count+' / '+money(rep.otherExpenses.b.total));
    p('ONLINE SALES    A '+rep.onlineSales.a.count+' / '+money(rep.onlineSales.a.total)+'   B '+rep.onlineSales.b.count+' / '+money(rep.onlineSales.b.total));
    p('ONE-TIME UPDATE MARKERS only in A: '+(rep.markers.onlyA.join(', ')||'none'));
    p('ONE-TIME UPDATE MARKERS only in B: '+(rep.markers.onlyB.join(', ')||'none'));
    p(''); p('SETTINGS'); if(!rep.settings.length)p('  same'); rep.settings.forEach(x=>p('  '+x.field+': A '+J(x.a)+'  B '+J(x.b)));
    p(''); p('FIRST '+rep.allDiffs.length+' RAW DIFFERENCES (of '+rep.allDiffCount+')');
    rep.allDiffs.forEach(x=>p('  '+x.field+': A '+J(x.a).slice(0,80)+'  B '+J(x.b).slice(0,80)));
    return L.join('\n');
  }
  const api={compare,toText,v69Status};
  if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.bsCompare=api;
})(typeof window!=='undefined'?window:this);
