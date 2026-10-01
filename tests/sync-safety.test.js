// v70 sync safety. Runs the app's real sync code against a fake Supabase table.
//
// The invariant: a device writes the cloud document only when it can prove the
// write drops nothing the cloud has. That needs (1) a successful read this
// session, (2) this device's copy descending from the row it read (the saved
// sync base), (3) a compare-and-swap on that row's version, and (4) no
// restored copy waiting in quarantine. Anything else blocks until the owner
// resolves it explicitly. Old v69 tabs cannot be stopped from the client at
// all; section 6 models the proposed SERVER guard (tools/proposed-server-guard.sql,
// exercised against real Postgres in tests/server-guard.test.sh).
//
// All amounts here are fabricated test values. Run: node tests/sync-safety.test.js
'use strict';
const {boot,reporter}=require('./harness');
const {execSync}=require('child_process');
const fs=require('fs'),os=require('os'),path=require('path');
const R=reporter();

// ---- Fake Supabase: one row per account. mode: ok | error | throw | garbage.
// guard:true models the proposed server trigger (revision must advance by
// exactly one; an insert must carry revision 1; history of replaced rows kept).
function fakeSb(row,opt){
  opt=opt||{};
  const db={row:row?JSON.parse(JSON.stringify(row)):null,mode:opt.mode||'ok',guard:!!opt.guard,
    hasRevision:!!opt.guard||!!(row&&row.revision!=null),writes:[],history:[],tick:0,beforeWrite:null};
  db.stamp=()=>'2026-10-01T00:00:'+String(++db.tick).padStart(2,'0')+'.000Z';
  const clone=o=>JSON.parse(JSON.stringify(o));
  const out=()=>{ const r={user_id:'u1',data_key:'bs_state',data_value:clone(db.row.data_value),updated_at:db.row.updated_at};
    if(db.hasRevision)r.revision=db.row.revision||0; return r; };
  const guardErr=m=>({data:null,error:{code:'P0001',message:m}});
  db.client={from(){return{
    select(){const q={eq(){return q;},async maybeSingle(){
      if(db.mode==='throw')throw new Error('Failed to fetch');
      if(db.mode==='error')return {data:null,error:{message:'JWT expired',code:'401'}};
      if(db.mode==='garbage')return {data:{data_value:'<html>',updated_at:'x'},error:null};
      return {data:db.row?out():null,error:null};
    }};return q;},
    update(v){const w={};const q={eq(k,val){w[k]=val;return q;},async select(){
      if(db.beforeWrite){const f=db.beforeWrite;db.beforeWrite=null;f();}
      db.writes.push({kind:'update',where:w,value:clone(v)});
      if(!db.hasRevision&&v.revision!==undefined)return {data:null,error:{message:'column "revision" does not exist'}};
      if(!db.row||db.row.updated_at!==w.updated_at)return {data:[],error:null};
      if(w.revision!==undefined&&(db.row.revision||0)!==w.revision)return {data:[],error:null};
      if(db.guard&&v.revision!==(db.row.revision||0)+1)return guardErr('bs_state: revision must be exactly the stored revision + 1');
      if(db.guard)db.history.push(clone(db.row));
      db.row={data_value:clone(v.data_value),updated_at:db.stamp(),revision:db.hasRevision?(v.revision!==undefined?v.revision:(db.row.revision||0)):undefined};
      return {data:[out()],error:null};
    }};return q;},
    insert(v){return{async select(){
      if(db.beforeWrite){const f=db.beforeWrite;db.beforeWrite=null;f();}
      db.writes.push({kind:'insert',value:clone(v)});
      if(!db.hasRevision&&v.revision!==undefined)return {data:null,error:{message:'Could not find the \'revision\' column of \'app_data\' in the schema cache'}};
      if(db.guard&&v.revision!==1)return guardErr('bs_state: a new row must start at revision 1');
      if(db.row)return {data:null,error:{code:'23505',message:'duplicate key'}};
      db.row={data_value:clone(v.data_value),updated_at:db.stamp(),revision:v.revision};
      return {data:[out()],error:null};
    }};},
    // what v69 does on every save
    async upsert(v){ db.writes.push({kind:'upsert',value:clone(v)});
      if(db.guard&&v.revision!==1)return {error:{code:'P0001',message:'bs_state: a new row must start at revision 1'}}; // BEFORE INSERT fires first
      if(db.guard)db.history.push(clone(db.row));
      db.row={data_value:clone(v.data_value),updated_at:db.stamp(),revision:db.row&&db.row.revision}; return {error:null}; }
  };}};
  return db;
}
function realDoc(b){
  const d=JSON.parse(JSON.stringify(b.ctx.INIT));
  for(let i=0;i<20;i++)d.shows.push({id:'sh'+i,name:'Show '+i,status:'completed',days:[]});
  d.testPaid=100; d._updatedAt='2026-09-30T20:00:00.000Z';
  return d;
}
const settle=()=>new Promise(r=>setTimeout(r,900));
function wired(db,seed,appPath){
  const w=boot(seed,appPath);
  w.ctx.__db=db; w.run('sb=__db.client;_cloudUser={id:"u1",email:"x"};');
  w.ctx.toast=()=>{}; w.ctx.mOpen=()=>{}; w.ctx.mClose=()=>{};
  return w;
}
const doneIn=d=>((d&&d.shows)||[]).filter(s=>s.status==='completed').length;
const paid=db=>db.row.data_value.testPaid;
// A device that has synced before: it adopted the cloud with the owner's OK.
// (Written so it also runs on the pre-fix code, where the same setup is
// "hydrate and tap OK", to show each FINDING section fails there.)
async function synced(db){ const w=wired(db);
  if(w.run('typeof cloudResolve')!=='function'){ w.ctx.confirm=()=>true; await w.run('cloudHydrate()'); return w; }
  await w.run('cloudHydrate()'); const r=await resolve(w,'cloud');
  if(!r.ok)throw new Error('setup: '+r.reason); return w; }
const kindOf=w=>w.run('typeof _cloudDivergent!=="undefined"&&_cloudDivergent?_cloudDivergent.kind:null');
const resolve=(w,a,b)=>w.run('typeof cloudResolve==="function"?cloudResolve('+JSON.stringify(a)+','+JSON.stringify(b)+'):Promise.resolve({ok:false,reason:"no resolver"})');

(async()=>{
  const b0=boot();
  const REAL=realDoc(b0);
  const ROW={data_value:REAL,updated_at:'2026-09-30T20:00:00.000Z'};

  R.section('1. Forced failed read on a wiped device writes NOTHING');
  for(const mode of ['error','throw','garbage']){
    const db=fakeSb(ROW,{mode}); const w=wired(db);
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check(mode+': no write attempted',db.writes.length,0);
    R.check(mode+': sync shows error',w.run('_syncState'),'error');
    await w.run('cloudSyncNow()'); await settle();
    R.check(mode+': Sync Now after failed read still writes nothing',db.writes.length,0);
    R.check(mode+': cloud still has 20 finished',doneIn(db.row.data_value),20);
  }

  R.section('2. "No row" is not "read failed"; an INSERT never overwrites a row that appeared');
  { const db=fakeSb(null); const w=wired(db);
    await w.run('cloudHydrate()'); await settle();
    R.check('INSERT with revision 1, retried without it while the column does not exist yet',db.writes.map(x=>x.kind+':'+(x.value.revision===undefined?'-':x.value.revision)),['insert:1','insert:-']);
    R.check('row created',!!db.row,true);
  }
  { const db=fakeSb(null,{guard:true}); const w=wired(db);
    await w.run('cloudHydrate()');
    R.check('with the server guard: one INSERT at revision 1',db.writes.map(x=>x.kind+':'+x.value.revision),['insert:1']);
  }
  { // the race: hydrate reads "none", another device creates the row before our INSERT runs
    const db=fakeSb(null); const w=wired(db);
    db.beforeWrite=()=>{ db.row=JSON.parse(JSON.stringify(ROW)); };
    await w.run('cloudHydrate()');
    R.check('INSERT was actually attempted',db.writes.filter(x=>x.kind==='insert').length>=1,true);
    R.check('existing row preserved',doneIn(db.row.data_value),20);
    R.check('device now blocked, not verified',w.run('_cloudVerified'),false);
    w.run('saveS()'); await settle();
    R.check('no further writes',db.writes.filter(x=>x.kind!=='insert').length,0);
  }

  R.section('3. First read on a device with no sync base: nothing written until the owner chooses');
  { const db=fakeSb(ROW); const w=wired(db);
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check('no write',db.writes.length,0);
    R.check('divergence raised',!!kindOf(w),true);
    const r=await resolve(w,'cloud');
    R.check('owner loads the cloud copy',r.ok&&w.run('doneShows(S)'),20);
    w.run('S.note1=1;saveS()'); await settle();
    R.check('then saves are conditional updates',db.writes.map(x=>x.kind),['update']);
    R.check('pinned to the version it read',(db.writes[0]||{where:{}}).where.updated_at,'2026-09-30T20:00:00.000Z');
    R.check('cloud got the change',db.row.data_value.note1,1);
    R.check('cloud snapshot kept on the device',Object.keys(w.store).some(k=>k.indexOf('dd_bs_cloudsnap_')===0),true);
  }
  { // fast-forward: device has no edits since its base, cloud moved -> adopt, no prompt
    const db=fakeSb(ROW); const A=await synced(db); const B=await synced(db);
    B.run('S.testPaid=300;saveS()'); await settle();
    await A.run('cloudHydrate()');
    R.check('clean device takes the newer cloud without asking',A.run('S.testPaid'),300);
    R.check('and wrote nothing',db.writes.length,1);
  }

  R.section('4. FINDING 1: conflict, later local edit, equal finished shows, retry via Sync Now');
  { const db=fakeSb(ROW); const A=await synced(db); const B=await synced(db);
    B.run('S.testPaid=300;saveS()'); await settle();
    R.check('B saved 300',paid(db),300);
    A.run('S.unrelated="later edit";saveS()'); await settle();
    R.check('A first write conflicts, cloud keeps 300',paid(db),300);
    R.check('equal finished shows on both',A.run('doneShows(S)')===doneIn(db.row.data_value),true);
    await A.run('cloudSyncNow()'); await settle();
    R.check('Sync Now does NOT upload A over B',paid(db),300);
    R.check('A is held as diverged',kindOf(A),'both');
    A.run('saveS()'); await settle();
    R.check('later saves still blocked',paid(db),300);
    const r1=await resolve(A,'device','');
    R.check('overwrite without the typed phrase is refused',r1.ok,false);
    const r2=await resolve(A,'cloud');
    R.check('loading the cloud copy brings 300 to A',r2.ok&&A.run('S.testPaid'),300);
    const before=db.writes.length;
    A.run('S.another=1;saveS()'); await settle();
    R.check('A syncs normally again',db.writes.length===before+1&&paid(db)===300&&db.row.data_value.another===1,true);
  }
  { // explicit overwrite only with the phrase AND an unchanged cloud since the comparison
    const db=fakeSb(ROW); const A=await synced(db); const B=await synced(db);
    B.run('S.testPaid=300;saveS()'); await settle();
    A.run('S.x=1;saveS()'); await settle(); await A.run('cloudSyncNow()'); await settle();
    B.run('S.testPaid=400;saveS()'); await settle();
    const r=await resolve(A,'device','OVERWRITE CLOUD');
    R.check('cloud moved again after the comparison: overwrite refused',r.ok,false);
    R.check('cloud keeps 400',paid(db),400);
  }

  R.section('5. FINDING 2: restores are held on the device, pending saves cancelled, across reload');
  { // 2A: verified, autosave pending, then the REAL emergencyRestore (fetch + decrypt mocked)
    // Same device, no other writer, same finished-show count: nothing but the
    // restore path itself stands between the queued autosave and the cloud.
    const db=fakeSb(ROW); const A=await synced(db);
    A.run('S.testPaid=300;saveS()'); await settle();
    R.check('setup: cloud at 300',paid(db),300);
    A.run('S.pending=1;saveS()'); // 800 ms autosave queued, token verified
    const old=JSON.parse(JSON.stringify(REAL)); old.testPaid=100;
    const pass='test-pass-1234', enc=new TextEncoder(), salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    const base=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:1000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);
    const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(old))));
    const b64=u=>Buffer.from(u).toString('base64');
    A.ctx.crypto=crypto; A.ctx.atob=atob;
    A.ctx.fetch=async()=>({ok:true,json:async()=>({iter:1000,salt:b64(salt),iv:b64(iv),ct:b64(ct)})});
    const real$$=A.ctx.$$; A.ctx.$$=id=>id==='er_pass'?{value:pass}:real$$(id);
    await A.run('emergencyRestore()');
    R.check('restore applied on the device',A.run('S.testPaid'),100);
    await settle(); await settle();
    R.check('queued autosave did not write the restored copy',paid(db),300);
    R.check('quarantine recorded',!!A.store.dd_bs_sync_quarantine,true);
    await A.run('cloudSyncNow()'); await settle();
    R.check('Sync Now does not upload it either',paid(db),300);
  }
  { // 2B: reload from the restored local copy, cloud has NO row
    const db=fakeSb(null); const old=JSON.parse(JSON.stringify(REAL));
    const w=wired(db,{dd_bs_v7:JSON.stringify(old),dd_bs_sync_quarantine:JSON.stringify({reason:'restored'})});
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check('fresh boot + no row: no INSERT of the restored copy',db.writes.length,0);
  }
  { // 2C: reload with a cloud row
    const db=fakeSb(ROW); const old=JSON.parse(JSON.stringify(REAL)); old.testPaid=1;
    const w=wired(db,{dd_bs_v7:JSON.stringify(old),dd_bs_sync_quarantine:JSON.stringify({reason:'restored'})});
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle(); await w.run('cloudSyncNow()'); await settle();
    R.check('fresh boot + row: nothing written',db.writes.length,0);
    R.check('held as restored',kindOf(w),'restored');
  }
  for(const [label,call] of [['device backup restore','restoreDeviceBackup("dd_bs_backup_1")'],['import','__imp()'],['file restore (_applyStateObj)','_applyStateObj(JSON.parse(localStorage.getItem("dd_bs_backup_1")))']]){
    const db=fakeSb(ROW); const A=await synced(db);
    const old=JSON.parse(JSON.stringify(REAL)); old.testPaid=7; A.store.dd_bs_backup_1=JSON.stringify(old);
    A.ctx.confirm=()=>true; A.ctx.location={reload(){}};
    A.run('var __imp=()=>{ const o=$$; $$=id=>id==="importTxt"?{value:localStorage.getItem("dd_bs_backup_1")}:o(id); try{ applyImport(); }finally{ $$=o; } }');
    A.run('S.q=1;saveS()'); A.run(call); await settle(); A.run('saveS()'); await settle();
    R.check(label+': restored copy never reaches the cloud',paid(db),100);
    R.check(label+': quarantined',!!A.store.dd_bs_sync_quarantine,true);
  }
  { const src=fs.readFileSync(path.join(__dirname,'..','restore.html'),'utf8');
    R.check('restore.html quarantines what it writes',/dd_bs_sync_quarantine/.test(src),true); }
  { // the owner can release a held restore only explicitly
    const db=fakeSb(ROW); const old=JSON.parse(JSON.stringify(REAL)); old.testPaid=5;
    const w=wired(db,{dd_bs_v7:JSON.stringify(old),dd_bs_sync_quarantine:JSON.stringify({reason:'restored'})});
    await w.run('cloudHydrate()');
    const r=await resolve(w,'device','OVERWRITE CLOUD');
    R.check('typed overwrite releases it (same finished count)',r.ok&&paid(db),5);
    R.check('quarantine cleared',w.store.dd_bs_sync_quarantine,undefined);
  }

  R.section('6. FINDING 3: v69 tabs. A protocol stamp cannot stop them; the proposed server guard does');
  const v69=path.join(os.tmpdir(),'bs-v69-'+process.pid+'.html');
  fs.writeFileSync(v69,execSync('git show 7498c9e:BEST_SOLUTION_APP.html',{cwd:path.join(__dirname,'..'),maxBuffer:1<<26}));
  { // threat model: no server guard. v69 keeps the stamp and overwrites. This is the risk, not a pass condition of the app.
    const db=fakeSb(ROW); const doc=JSON.parse(JSON.stringify(REAL)); doc._syncProtocol=2;
    const old=wired(db,{dd_bs_v7:JSON.stringify(doc)},v69);
    db.row.data_value.testPaid=300;
    await old.run('cloudPush()');
    R.check('[threat] without the server guard a stamped v69 copy still overwrites (300 -> 100)',paid(db),100);
  }
  { // with the guard: same stale v69 write is refused at the server, row intact
    const db=fakeSb(Object.assign({},ROW,{revision:5}),{guard:true}); const doc=JSON.parse(JSON.stringify(REAL)); doc._syncProtocol=2;
    const old=wired(db,{dd_bs_v7:JSON.stringify(doc)},v69);
    db.row.data_value.testPaid=300;
    const r=await old.run('cloudPush()');
    R.check('guarded: v69 upsert refused',r.ok,false);
    R.check('guarded: cloud keeps 300',paid(db),300);
    // and v70 still works against the guard, bumping the revision
    const A=await synced(db); A.run('S.y=1;saveS()'); await settle();
    R.check('guarded: v70 write lands with revision 6',db.row.revision,6);
    R.check('guarded: replaced versions kept in history',db.history.length,1);
  }
  fs.unlinkSync(v69);

  R.section('7. FINDING 4: a Phase 2B write is never followed by an ordinary overwrite');
  { const db=fakeSb(ROW); const A=await synced(db);
    const doc=JSON.parse(JSON.stringify(db.row.data_value)); doc.testPaid=300;
    await A.run('p2bWriteOnce('+JSON.stringify(doc)+','+JSON.stringify(db.row.updated_at)+')');
    R.check('Phase 2B wrote 300',paid(db),300);
    R.check('S still holds 100',A.run('S.testPaid'),100);
    A.run('S.z=1;saveS()'); await settle();
    R.check('ordinary save does not replace 300',paid(db),300);
    await A.run('cloudSyncNow()'); await settle();
    R.check('nor does Sync Now (held as diverged)',paid(db),300);
  }
  { const db=fakeSb(ROW); const A=await synced(db);
    const doc=JSON.parse(JSON.stringify(db.row.data_value)); doc.testPaid=300;
    await A.run('p2bWriteOnce('+JSON.stringify(doc)+','+JSON.stringify(db.row.updated_at)+')');
    await A.run('cloudSyncNow()');
    R.check('no local edits: the device simply takes the Phase 2B result',A.run('S.testPaid'),300);
  }

  R.section('8. Newer protocol, and the v67 finished-shows rule');
  { const fut=JSON.parse(JSON.stringify(REAL)); fut._syncProtocol=99;
    const db=fakeSb({data_value:fut,updated_at:'2026-10-01T10:00:00.000Z'}); const w=wired(db);
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check('no write over a newer protocol',db.writes.length,0); }
  { const db=fakeSb(ROW); const w=wired(db);
    w.run('S.shows.push({id:"x",name:"X",status:"completed",days:[]});');
    await w.run('cloudHydrate()');
    const r=await resolve(w,'device','OVERWRITE CLOUD');
    R.check('typed overwrite refused when the cloud has more finished shows',r.ok,false);
    R.check('cloud keeps 20 finished',doneIn(db.row.data_value),20); }

  R.section('9. Duplicate migration: v69 can never add Martone $2,000 or WWW $418.90 twice');
  { const w=boot();
    w.run('var __d=JSON.parse(JSON.stringify(S));var I2=()=>__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0];var WW=()=>__d.shows.filter(s=>/wonderful world/i.test(s.name))[0];I2().payments=[{amount:2500,date:"2026-09-01"},{amount:500,date:"2026-09-28"}];WW().boothPayments=[{amount:250,date:"2026-08-18"}];');
    const paid2=()=>w.run('I2().payments.reduce((t,p)=>t+pdNum(p.amount),0)');
    const wwwPaid=()=>Math.round(w.run('WW().boothPayments.reduce((t,p)=>t+(+p.amount),0)')*100)/100;
    w.run('delete __d._applied.www_pay2_mm_2000_v69;applyOneTimeUpdates(__d)');
    R.check('first run: invoice 2 paid = 5000',paid2(),5000);
    R.check('first run: invoice 2 balance = 985',w.run('I2().total')-paid2(),985);
    R.check('first run: WWW paid = 668.90',wwwPaid(),668.9);
    R.check('migration payment keeps its id',w.run('I2().payments.some(p=>p.id==="pd_mm_inv2_2026_09_30")'),true);
    w.run('delete __d._applied.www_pay2_mm_2000_v69;applyOneTimeUpdates(__d)');
    R.check('re-run without marker: still 5000',paid2(),5000);
    R.check('re-run without marker: WWW still 668.90',wwwPaid(),668.9);
    w.run('delete __d._applied.www_pay2_mm_2000_v69;I2().payments=I2().payments.filter(p=>!(pdNum(p.amount)===2000&&p.date==="2026-09-30"));I2().payments.push({amount:2000,date:"2026-09-30"});applyOneTimeUpdates(__d)');
    R.check('hand-entered $2,000 is recognised, no second one',paid2(),5000);
  }

  R.done();
})().catch(e=>{console.error(e);process.exit(1);});
