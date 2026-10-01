// v70 sync safety. Covers the bug that let a failed cloud read become a full
// upload of whatever this device held (on a wiped phone, the empty defaults):
//   cloudPull() returned null for "no row" AND for "read failed", and
//   cloudHydrate() answered null with cloudPush().
// The invariant: a write only ever follows a successful read of the same row,
// and only lands if the row is still exactly what was read (compare-and-swap).
// Run: node tests/sync-safety.test.js
'use strict';
const {boot,reporter}=require('./harness');
const R=reporter();

// A fake Supabase table with one row per (user_id,data_key). `mode` decides how
// reads behave: ok | none | error | throw | garbage.
function fakeSb(row,mode){
  const db={row:row?JSON.parse(JSON.stringify(row)):null,mode:mode||'ok',writes:[],tick:0};
  db.stamp=()=>'2026-10-01T00:00:'+String(++db.tick).padStart(2,'0')+'.000Z';
  db.client={from(){return{
    select(){const q={eq(){return q;},async maybeSingle(){
      if(db.mode==='throw')throw new Error('Failed to fetch');
      if(db.mode==='error')return {data:null,error:{message:'JWT expired',code:'401'}};
      if(db.mode==='garbage')return {data:{data_value:'<html>',updated_at:'x'},error:null};
      if(!db.row)return {data:null,error:null};
      return {data:{data_value:JSON.parse(JSON.stringify(db.row.data_value)),updated_at:db.row.updated_at},error:null};
    }};return q;},
    update(v){const w={};const q={eq(k,val){w[k]=val;return q;},async select(){
      db.writes.push({kind:'update',where:w,value:v});
      if(!db.row||db.row.updated_at!==w.updated_at)return {data:[],error:null};
      db.row={data_value:JSON.parse(JSON.stringify(v.data_value)),updated_at:db.stamp()};
      return {data:[{updated_at:db.row.updated_at}],error:null};
    }};return q;},
    insert(v){return{async select(){
      db.writes.push({kind:'insert',value:v});
      if(db.row)return {data:null,error:{code:'23505',message:'duplicate key'}};
      db.row={data_value:JSON.parse(JSON.stringify(v.data_value)),updated_at:db.stamp()};
      return {data:[{updated_at:db.row.updated_at}],error:null};
    }};},
    async upsert(v){ db.writes.push({kind:'upsert',value:v}); db.row={data_value:v.data_value,updated_at:db.stamp()}; return {error:null}; }
  };}};
  return db;
}
// A realistic "real" cloud document: 20 finished shows.
function realDoc(boot0){
  const d=JSON.parse(JSON.stringify(boot0.ctx.INIT));
  for(let i=0;i<20;i++)d.shows.push({id:'sh'+i,name:'Show '+i,status:'completed',days:[]});
  d._updatedAt='2026-09-30T20:00:00.000Z';
  return d;
}
async function settle(){ await new Promise(r=>setTimeout(r,900)); }
function wired(db,localSeed){
  const w=boot(localSeed);
  w.ctx.__db=db; w.run('sb=__db.client;_cloudUser={id:"u1",email:"x"};');
  return w;
}
const doneIn=d=>((d&&d.shows)||[]).filter(s=>s.status==='completed').length;

(async()=>{
  const b0=boot();
  const REAL=realDoc(b0);
  const ROW={data_value:REAL,updated_at:'2026-09-30T20:00:00.000Z'};

  R.section('1. Forced failed read on a wiped device writes NOTHING');
  for(const mode of ['error','throw','garbage']){
    const db=fakeSb(ROW,mode); const w=wired(db);   // fresh device = defaults, 0 finished
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check(mode+': no write attempted',db.writes.length,0);
    R.check(mode+': cloud still has 20 finished',doneIn(db.row.data_value),20);
    R.check(mode+': sync shows error, not synced',w.run('_syncState'),'error');
    await w.run('cloudSyncNow()'); await settle();
    R.check(mode+': Sync Now after failed read still writes nothing',db.writes.length,0);
  }

  R.section('2. "No row" is not "read failed": first upload is an insert, never an overwrite');
  { const db=fakeSb(null,'ok'); const w=wired(db);
    w.run('S.shows.push({id:"a",name:"A",status:"completed",days:[]});');
    await w.run('cloudHydrate()'); await settle();
    R.check('one insert',db.writes.map(x=>x.kind),['insert']);
    R.check('row now exists',!!db.row,true);
    // another device created the row between our read and our insert
    const db2=fakeSb(null,'ok'); const w2=wired(db2);
    w2.run('S.shows.push({id:"a",name:"A",status:"completed",days:[]});');
    const r=w2.run('cloudRead()'); const rr=await r; R.check('read says none',rr.status,'none');
    db2.row=JSON.parse(JSON.stringify(ROW));
    const p=await w2.run('cloudPush()');
    R.check('insert over an existing row is refused',p.ok,false);
    R.check('real row untouched',doneIn(db2.row.data_value),20);
  }

  R.section('3. Successful read adopts the richer cloud and later writes are CAS');
  { const db=fakeSb(ROW,'ok'); const w=wired(db); w.ctx.confirm=()=>true; // owner taps OK on "load the cloud copy"
    await w.run('cloudHydrate()');
    R.check('device adopted 20 finished',w.run('doneShows(S)'),20);
    R.check('no write during hydrate',db.writes.length,0);
    w.run('S.notes_test=1;saveS()'); await settle();
    R.check('save is a conditional update',db.writes.map(x=>x.kind),['update']);
    R.check('pinned to the version it read',db.writes[0].where.updated_at,'2026-09-30T20:00:00.000Z');
    R.check('cloud got the change',db.row.data_value.notes_test,1);
    R.check('cloud snapshot kept on device before writing',Object.keys(w.store).some(k=>k.indexOf('dd_bs_cloudsnap_')===0),true);
  }

  R.section('3b. Device is behind the cloud and owner taps Cancel: pause, never overwrite');
  { const db=fakeSb(ROW,'ok'); const w=wired(db); w.ctx.confirm=()=>false;
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check('no write',db.writes.length,0);
    R.check('cloud keeps 20 finished',doneIn(db.row.data_value),20);
  }

  R.section('4. Conflicting version: another device wrote after our read');
  { const db=fakeSb(ROW,'ok'); const w=wired(db); w.ctx.confirm=()=>true;
    await w.run('cloudHydrate()');
    const newer=JSON.parse(JSON.stringify(REAL)); newer.otherDevice=true;
    db.row={data_value:newer,updated_at:'2026-10-01T09:00:00.000Z'};
    w.run('S.mine=1;saveS()'); await settle();
    R.check('write attempted once and matched zero rows',db.writes.length,1);
    R.check('other device\'s write survives',db.row.data_value.otherDevice,true);
    R.check('our stale copy did not land',db.row.data_value.mine,undefined);
    R.check('sync now needs a fresh read',w.run('_cloudVerified'),false);
    w.run('S.mine=2;saveS()'); await settle();
    R.check('no further writes until re-read',db.writes.length,1);
  }

  R.section('5. Older/newer protocol: a doc written by a newer sync protocol is never overwritten');
  { const fut=JSON.parse(JSON.stringify(REAL)); fut._syncProtocol=99;
    const db=fakeSb({data_value:fut,updated_at:'2026-10-01T10:00:00.000Z'},'ok'); const w=wired(db);
    w.ctx.confirm=()=>true;
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check('no write over a newer protocol',db.writes.length,0);
    R.check('pushes stamp our protocol',w.run('SYNC_PROTOCOL'),2);
  }

  R.section('6. Fewer finished shows than the cloud: still refused (v67 guard kept)');
  { const db=fakeSb(ROW,'ok'); const w=wired(db);
    w.run('S.shows.push({id:"x",name:"X",status:"completed",days:[]});S._updatedAt="2026-10-02T00:00:00.000Z";');
    w.ctx.confirm=()=>false; // owner taps Cancel on "load the cloud copy"
    await w.run('cloudHydrate()'); w.run('saveS()'); await settle();
    R.check('cloud not overwritten by a 1-show device',doneIn(db.row.data_value),20);
    R.check('no write',db.writes.length,0);
  }

  R.section('7. Emergency restore never pushes the old Sep 26 copy to the cloud');
  { const src=b0.run('emergencyRestore.toString()');
    R.check('no cloudPush inside emergencyRestore',/cloudPush\(/.test(src),false); }

  R.section('8. Duplicate migration: v69 can never add Martone $2,000 or WWW $418.90 twice');
  { const w=boot();
    // The app's own seeded ledger and WWW show, set to where they stood on Sep 29.
    w.run('var __d=JSON.parse(JSON.stringify(S));__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].payments=[{amount:2500,date:"2026-09-01"},{amount:500,date:"2026-09-28"}];__d.shows.filter(s=>/wonderful world/i.test(s.name))[0].boothPayments=[{amount:250,date:"2026-08-18"}];');
    const d=w.run('__d');
    const paid2=()=>w.run('__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].payments.reduce((t,p)=>t+pdNum(p.amount),0)');
    const wwwPaid=()=>w.run('__d.shows.filter(s=>/wonderful world/i.test(s.name))[0].boothPayments.reduce((t,p)=>t+(+p.amount),0)');
    w.run('delete __d._applied.www_pay2_mm_2000_v69;applyOneTimeUpdates(__d)');
    R.check('first run: invoice 2 paid = 5000',paid2(),5000);
    R.check('first run: invoice 2 balance = 985',w.run('__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].total')-paid2(),985);
    R.check('first run: WWW paid = 668.90',Math.round(wwwPaid()*100)/100,668.9);
    w.run('delete __d._applied.www_pay2_mm_2000_v69;applyOneTimeUpdates(__d)');
    R.check('re-run without marker: still 5000',paid2(),5000);
    R.check('migration payment keeps its id',w.run('__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].payments.some(p=>p.id==="pd_mm_inv2_2026_09_30")'),true);
    R.check('re-run without marker: WWW still 668.90',Math.round(wwwPaid()*100)/100,668.9);
    // A ledger where the $2,000 was keyed by hand AND another entry moved the
    // total off 3000 must still not get a second $2,000.
    w.run('delete __d._applied.www_pay2_mm_2000_v69;__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].payments=__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].payments.filter(p=>!(pdNum(p.amount)===2000&&p.date==="2026-09-30"));__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].payments.push({amount:2000,date:"2026-09-30"});applyOneTimeUpdates(__d)');
    R.check('hand-entered $2,000 is recognised, no second one',paid2(),5000);
    R.check('exactly one 9/30 $2,000 on the ledger',w.run('__d.productDebt.invoices.filter(i=>pdNum(i.number)===2)[0].payments.filter(p=>pdNum(p.amount)===2000&&p.date==="2026-09-30").length'),1);
  }

  R.done();
})().catch(e=>{console.error(e);process.exit(1);});
