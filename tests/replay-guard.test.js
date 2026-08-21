// Tests for the MIGRATION REPLAY GUARD.
//
// The centrepiece is section 5: a faithful replay of the 2026-08-20 incident.
// Two independent browser-storage copies of the same account, a cloud document
// that is missing the Aug 18 migration markers, and the adoption sequence that
// minted a second set of sh_auto_ ids for three shows that already existed.
//
// No real business data is used and no network client of any kind is created.
// The cloud is a plain object in this file.
'use strict';
const {boot,reporter}=require('./harness');
const R=reporter();
const chk=(n,g,w)=>R.check(n,g,w);

// ---------------------------------------------------------------- fixtures
const SEEDED=['shows_20260518v2','rustic_fox_20260518','holiday_markets_v1',
  'st_martins_20260518','hours_and_shows_v1','rf_holiday_20260518',
  'pewaukee_beach_20260626','shows_add_20260818','pop_racine_20260818'];

// The three shows at the centre of the incident, by name and start date.
const THREE=[
  ['Whole Bead Show — Milwaukee Pop-up','2026-10-27'],
  ['Wonderful World of Weddings','2027-01-30'],
  ['Party on the Pavement','2026-09-19']];

function show(name,startDate,id){
  return {id:id,name:name,startDate:startDate,numDays:1,dates:['x'],
    boothCost:0,boothPayments:[],miles:0,repIds:[],repOnlyShow:false,
    status:'planned',confirmed:true,showExpenses:[],days:[{dayNum:1,date:'x'}],
    packedInventory:null,createdAt:'2026-08-18T21:36:11.124Z'};
}

// Zero the ledger's diagnostic log without disturbing the recorded identities,
// so a section can count exactly what its own action produced.
function clearLog(w){
  const raw=w.store['dd_bs_seedlog_v1'];
  if(!raw)return;
  const o=JSON.parse(raw); o.log=[];
  w.store['dd_bs_seedlog_v1']=JSON.stringify(o);
}

const days=st=>(st.shows||[]).reduce((n,sh)=>n+((sh.days||[]).length),0);
const key=(w,sh)=>w.ctx.mrgShowKey(sh.name,sh.startDate);
const canon=o=>JSON.stringify((function c(x){return Array.isArray(x)?x.map(c):
  (x&&typeof x==='object'?Object.keys(x).sort().reduce((r,k)=>(r[k]=c(x[k]),r),{}):x);})(o));

// A "browser storage copy": its own localStorage, its own booted app.
function browser(){
  const w=boot();
  if(w.bootError)throw w.bootError;
  return w;
}

// ------------------------------------------------------------------ 1. keys
R.section('=== 1. NORMALIZED IDENTITY KEY ===');
{
  const w=browser();
  const K=w.ctx.mrgShowKey;
  chk('em dash and comma fold to the same key',
    K('Whole Bead Show — Milwaukee','2026-10-27')===K('Whole Bead Show, Milwaukee','2026-10-27'),true);
  chk('en dash folds too',
    K('A – B','2026-01-01')===K('A - B','2026-01-01'),true);
  chk('non-breaking hyphen folds too',
    K('A ‑ B','2026-01-01')===K('A - B','2026-01-01'),true);
  chk('case is ignored',K('PARTY on the Pavement','2026-09-19')===K('party on the pavement','2026-09-19'),true);
  chk('surrounding whitespace is ignored',K('  Cranberry  Fest ','2026-09-25')===K('Cranberry Fest','2026-09-25'),true);
  chk('a different start date is a DIFFERENT key',
    K('Rustic Fox','2026-05-03')===K('Rustic Fox','2026-06-07'),false);
  chk('a different name is a different key',K('Alpha','2026-01-01')===K('Beta','2026-01-01'),false);
  chk('missing name does not throw',typeof K(null,'2026-01-01'),'string');
  chk('missing date does not throw',typeof K('Alpha',null),'string');
}

// ------------------------------------------------------- 2. duplicate block
R.section('=== 2. NEVER A SECOND ROW FOR THE SAME NAME + START DATE ===');
{
  const w=browser();
  w.store['dd_bs_seedlog_v1']='';
  const d={shows:[show('Party on the Pavement','2026-09-19','sh_a')],_applied:{}};
  chk('identical name is refused',w.ctx.mrgPushShow(d,show('Party on the Pavement','2026-09-19','sh_b'),'m'),'duplicate-blocked');
  chk('still one row',d.shows.length,1);
  chk('the original id is untouched',d.shows[0].id,'sh_a');
  chk('dash variant of the same name is refused',
    w.ctx.mrgPushShow(d,show('party  on   the pavement','2026-09-19','sh_c'),'m'),'duplicate-blocked');
  chk('still one row after the variant',d.shows.length,1);
  // A same-name row at another date is the SAME event with a corrected date -
  // later migrations move seeded dates. Creating here would duplicate it at the
  // stale date. Only migrations reach this funnel; the UI add path does not.
  chk('same name on a different date is ALSO refused',
    w.ctx.mrgPushShow(d,show('Party on the Pavement','2027-09-18','sh_d'),'m'),'duplicate-blocked');
  chk('still one row',d.shows.length,1);
  chk('the surviving row keeps its own date',d.shows[0].startDate,'2026-09-19');
  chk('a genuinely different name IS allowed',
    w.ctx.mrgPushShow(d,show('Some Other Fair','2027-09-18','sh_e'),'m'),'created');
  chk('two rows now',d.shows.length,2);
  chk('the refusals were recorded',
    w.ctx.mrgLogRead().filter(x=>/duplicate-blocked/.test(x.action)).length,3);
  chk('and nothing was written into the state document',
    Object.keys(d).filter(k=>k.indexOf('_mrg')===0).length,0);
}

// ------------------------------------------------------------- 3. ledger
R.section('=== 3. THE LEDGER SURVIVES REPLACEMENT OF dd_bs_v7 ===');
{
  const w=browser();
  w.store['dd_bs_seedlog_v1']='';
  const d={shows:[],_applied:{}};
  chk('first creation succeeds',w.ctx.mrgPushShow(d,show('Alpha Fair','2026-07-01','sh_first'),'m'),'created');
  chk('ledger key is separate from the state key',
    Object.keys(w.store).filter(k=>k==='dd_bs_seedlog_v1').length,1);

  // Simulate exactly what adoptCloud does to storage: replace dd_bs_v7 wholesale.
  delete w.store['dd_bs_v7'];
  const fresh={shows:[],_applied:{}};
  chk('after the state key is destroyed, the prior identity is restored',
    w.ctx.mrgPushShow(fresh,show('Alpha Fair','2026-07-01','sh_second'),'m'),'identity-restored');
  chk('the row exists',fresh.shows.length,1);
  chk('and carries the ORIGINAL id, not the new one',fresh.shows[0].id,'sh_first');
  const log=w.ctx.mrgLogRead().slice().reverse().find(x=>x.action==='identity-restored');
  chk('the restoration names the id this device already held',log&&log.keptId,'sh_first');
  chk('the restoration names the id it discarded',log&&log.discardedId,'sh_second');
}

// -------------------------------------------------- 4. name check is NOT enough
R.section('=== 4. A NAME CHECK ALONE DOES NOT PROTECT AFTER A PULL ===');
{
  const w=browser();
  // This is the exact shape of the old guard: has(fragment) over d.shows.
  const oldGuardWouldCreate=docShows=>!docShows.some(sh=>(sh.name||'').toLowerCase().includes('whole bead'));
  const withRow=[show('Whole Bead Show — Milwaukee Pop-up','2026-10-27','sh_orig')];
  const afterPull=[]; // the adopted cloud document does not contain the show at all

  chk('with the row present, the old name guard correctly declines',oldGuardWouldCreate(withRow),false);
  chk('after a pull removed it, the old name guard would CREATE AGAIN',oldGuardWouldCreate(afterPull),true);

  // The funnel, given the same two situations, plus a ledger entry from the
  // first creation, declines in BOTH.
  w.store['dd_bs_seedlog_v1']='';
  const d1={shows:[],_applied:{}};
  w.ctx.mrgPushShow(d1,show('Whole Bead Show — Milwaukee Pop-up','2026-10-27','sh_orig'),'shows_add_20260818');
  const d2={shows:[],_applied:{}}; // the adopted document: row gone
  chk('the funnel intervenes where the name guard would not',
    w.ctx.mrgPushShow(d2,show('Whole Bead Show — Milwaukee Pop-up','2026-10-27','sh_new'),'shows_add_20260818'),
    'identity-restored');
  chk('so no second identity is minted',d2.shows[0].id,'sh_orig');
}

// ------------------------------------------- 5. the 2026-08-20 incident, replayed
R.section('=== 5. THE 2026-08-20 INCIDENT, REPLAYED END TO END ===');
{
  // A cloud document that is three shows behind and carries none of the Aug 18
  // markers - exactly the state of the real cloud row.
  const cloudDoc=()=>{
    const ap={}; SEEDED.forEach(m=>{ if(m!=='shows_add_20260818'&&m!=='pop_racine_20260818')ap[m]=true; });
    return {v:7,shows:[show('Cranberry Fest','2026-09-25','sh_cloud_cran')],_applied:ap,
      _updatedAt:'2026-08-18T21:06:48.961Z'};
  };

  // ---- Copy A: the canonical device. Already holds the three shows. ----
  const A=browser();
  const aState={v:7,shows:THREE.map((t,i)=>show(t[0],t[1],'sh_orig_'+i))
      .concat([show('Cranberry Fest','2026-09-25','sh_cloud_cran')]),
    _applied:{},_updatedAt:'2026-08-18T21:06:48.961Z'};
  SEEDED.forEach(m=>aState._applied[m]=true);
  A.store['dd_bs_v7']=JSON.stringify(aState);
  A.store['dd_bs_seedlog_v1']='';            // start this copy's ledger empty
  A.ctx.mrgLedgerReconcile(aState);
  chk('A: the ledger learned all four identities',
    Object.keys(JSON.parse(A.store['dd_bs_seedlog_v1']).entries).length,4);

  // A adopts the cloud copy. WITHOUT marker inheritance the three shows would
  // vanish and then be re-seeded under fresh ids. WITH it, no re-seed is tried.
  const incoming=cloudDoc();
  // The incoming document does NOT contain the three shows, so the two markers
  // that seed them must be WITHHELD. Inheriting them would gate the migrations
  // shut and the three records would simply be gone from the adopted state.
  const withheld=A.ctx.mrgWithheldMarkers(incoming,aState).map(x=>x.marker).sort();
  chk('A: the two Aug 18 seed markers are WITHHELD',withheld,
    ['pop_racine_20260818','shows_add_20260818']);
  const inherited=A.ctx.mrgInheritSeedMarkers(incoming,aState);
  chk('A: neither Aug 18 marker was taken',inherited.filter(m=>/20260818/.test(m)),[]);
  chk('A: the adopted document still lacks shows_add_20260818',!!incoming._applied['shows_add_20260818'],false);
  chk('A: the adopted document still lacks pop_racine_20260818',!!incoming._applied['pop_racine_20260818'],false);
  chk('A: the withholding is recorded in the ledger log',
    A.ctx.mrgLogRead().some(x=>x.action==='marker-withheld'),true);
  chk('A: and NOT on the state document',
    Object.keys(incoming).filter(k=>k.indexOf('_mrg')===0).length,0);
  chk('A: a marker whose records ARE present is still inherited',
    A.ctx.mrgWithheldMarkers(incoming,aState).every(x=>/20260818/.test(x.marker)),true);

  // The seeds therefore run, and the ledger hands each one back the id this
  // device already held rather than letting it mint a new one.
  THREE.forEach((t,i)=>{
    chk('A: replay of "'+t[0].slice(0,22)+'" keeps the original id',
      A.ctx.mrgPushShow(incoming,show(t[0],t[1],'sh_replay_'+i),'shows_add_20260818'),'identity-restored');
  });
  chk('A: no fresh id survived the replay',
    incoming.shows.filter(sh=>/^sh_replay_/.test(sh.id)).length,0);
  chk('A: the three came back under their original ids',
    incoming.shows.filter(sh=>/^sh_orig_/.test(sh.id)).length,3);

  // ---- Copy B: a second, never-used browser storage on the same account. ----
  // This is the copy that actually adopted the cloud on Aug 20. It has its own
  // localStorage, so it has its own ledger.
  const B=browser();
  const bFresh={v:7,shows:THREE.map((t,i)=>show(t[0],t[1],'sh_B_first_'+i)),_applied:{}};
  SEEDED.forEach(m=>bFresh._applied[m]=true);
  B.store['dd_bs_seedlog_v1']='';            // B's ledger is its own, and empty
  B.ctx.mrgLedgerReconcile(bFresh);
  const bIncoming=cloudDoc();
  B.ctx.mrgInheritSeedMarkers(bIncoming,bFresh);
  chk('B: the Aug 18 markers are withheld here too',!!bIncoming._applied['shows_add_20260818'],false);
  THREE.forEach((t,i)=>{
    chk('B: replay of "'+t[0].slice(0,22)+'" keeps B\'s own id',
      B.ctx.mrgPushShow(bIncoming,show(t[0],t[1],'sh_B_second_'+i),'shows_add_20260818'),'identity-restored');
  });
  chk('B: no fresh id survived either',
    bIncoming.shows.filter(sh=>/^sh_B_second_/.test(sh.id)).length,0);

  // The two copies never share a ledger, and neither invented a new id.
  const aLed=JSON.parse(A.store['dd_bs_seedlog_v1']).entries;
  const bLed=JSON.parse(B.store['dd_bs_seedlog_v1']).entries;
  const k=A.ctx.mrgShowKey(THREE[0][0],THREE[0][1]);
  chk('A defends its own id',aLed[k].id,'sh_orig_0');
  chk('B defends its own id',bLed[k].id,'sh_B_first_0');
  chk('the two ledgers are independent',aLed[k].id===bLed[k].id,false);
}

// ---------------------------------------------- 6. inheritance is narrow
R.section('=== 6. MARKER INHERITANCE IS NARROW AND ONE-WAY ===');
{
  const w=browser();
  const cur={_applied:{shows_add_20260818:true,cogs_history_v1:true,real_prices_v1:true,
    jun2026_expense_fix_v4:true}};
  // the incoming document DOES carry both records the marker seeds
  const inc={_applied:{},shows:[show('Whole Bead Show — Milwaukee Pop-up','2026-10-27','a'),
    show('Wonderful World of Weddings','2027-01-30','b')]};
  const took=w.ctx.mrgInheritSeedMarkers(inc,cur);
  chk('only show-seeding markers are inherited',took,['shows_add_20260818']);
  chk('cogs_history_v1 is NOT inherited',!!inc._applied['cogs_history_v1'],false);
  chk('a data-fix marker is NOT inherited',!!inc._applied['real_prices_v1'],false);
  chk('another data-fix marker is NOT inherited',!!inc._applied['jun2026_expense_fix_v4'],false);

  const inc2={_applied:{shows_add_20260818:true},shows:[]};
  chk('an already-present marker is not re-taken',w.ctx.mrgInheritSeedMarkers(inc2,{_applied:{}}),[]);
  chk('a null current state is safe',w.ctx.mrgInheritSeedMarkers({_applied:{},shows:[]},null),[]);
  chk('a null incoming document is safe',w.ctx.mrgInheritSeedMarkers(null,cur),[]);
  chk('inheritance never removes a marker from the source',!!cur._applied['cogs_history_v1'],true);
}

// ------------------------------------------------- 7. real load path, no data
R.section('=== 7. THE REAL LOAD PATH STILL BEHAVES ===');
{
  const w=browser();
  const d=w.ctx.loadS();
  const key=sh=>w.ctx.mrgShowKey(sh.name,sh.startDate);
  const keys=d.shows.map(key);
  chk('a first-ever load produces no duplicate name+date',keys.length,new Set(keys).size);
  chk('every show has an id',d.shows.every(sh=>!!sh.id),true);
  const ids=d.shows.map(sh=>sh.id);
  chk('every id is unique',ids.length,new Set(ids).size);
  chk('all three Aug 18 shows are present',
    THREE.every(t=>d.shows.some(sh=>key(sh)===w.ctx.mrgShowKey(t[0],t[1]))),true);
  chk('the seed markers are set',SEEDED.every(m=>d._applied[m]===true),true);
  chk('no duplicate was blocked on a clean first load',
    w.ctx.mrgLogRead().filter(x=>x.action==='duplicate-blocked').length,0);
  chk('the guard added no field to the state document',
    Object.keys(d).filter(k=>k.indexOf('_mrg')===0).length,0);

  // Persist and load again: idempotent, no new rows, no new ids.
  w.store['dd_bs_v7']=JSON.stringify(d);
  const before=JSON.stringify(d.shows.map(sh=>[sh.id,sh.name,sh.startDate]));
  const d2=w.ctx.loadS();
  chk('a second load adds nothing',d2.shows.length,d.shows.length);
  chk('a second load changes no identity',
    JSON.stringify(d2.shows.map(sh=>[sh.id,sh.name,sh.startDate])),before);
}

// ------------- 7b. REGRESSION: a populated ledger must not blank the app
R.section('=== 7b. A SURVIVING LEDGER MUST NOT STOP A FROM-SCRATCH BUILD ===');
{
  // An earlier draft of this guard REFUSED to create any show whose key was in
  // the ledger. That made the app come up empty whenever dd_bs_v7 was cleared
  // or failed to parse while dd_bs_seedlog_v1 survived - a worse failure than
  // the one being fixed. This pins the corrected behaviour.
  const w=browser();
  const first=w.ctx.loadS();
  const n=first.shows.length;
  chk('the first build produced the full show list',n>30,true);
  const firstIds=first.shows.map(sh=>sh.id).sort();

  // Wipe only the state key. The ledger survives, as it is designed to.
  delete w.store['dd_bs_v7'];
  clearLog(w);
  chk('the ledger survived',Object.keys(JSON.parse(w.store['dd_bs_seedlog_v1']).entries).length,n);

  const second=w.ctx.loadS();
  chk('the app rebuilds the full show list, it does not come up empty',second.shows.length,n);
  chk('and every id is the SAME one this device used before',
    JSON.stringify(second.shows.map(sh=>sh.id).sort()),JSON.stringify(firstIds));
  chk('every restoration was logged',
    w.ctx.mrgLogRead().filter(x=>x.action==='identity-restored').length,n);
  const k2=second.shows.map(sh=>w.ctx.mrgShowKey(sh.name,sh.startDate));
  chk('no duplicate name+date',k2.length,new Set(k2).size);
}

// -------------------------------- 8. full adopt-then-reload, through loadS()
R.section('=== 8. ADOPT A MARKER-LESS CLOUD COPY, THEN RELOAD ===');
{
  // BLOCKER 1 REGRESSION. An earlier version of this section asserted
  // after.shows.length === shrunk - it validated the LOSS of the three shows.
  // Inheriting a marker whose records are absent suppresses the migration and
  // the records never come back. The requirement is the opposite: the records
  // must be restored, under their canonical ids.
  const w=browser();
  const first=w.ctx.loadS();
  const before=first.shows.length, beforeDays=days(first);
  const originalIds={};
  THREE.forEach(t=>{
    const sh=first.shows.find(x=>key(w,x)===w.ctx.mrgShowKey(t[0],t[1]));
    originalIds[t[0]]=sh&&sh.id;
  });
  chk('the three shows exist before adoption',Object.values(originalIds).every(Boolean),true);

  // The adopted document looks like the real cloud row: the same shows MINUS
  // the three, and without the two Aug 18 markers.
  const adopted=JSON.parse(JSON.stringify(first));
  adopted.shows=adopted.shows.filter(sh=>
    !THREE.some(t=>key(w,sh)===w.ctx.mrgShowKey(t[0],t[1])));
  delete adopted._applied['shows_add_20260818'];
  delete adopted._applied['pop_racine_20260818'];

  const withheld=w.ctx.mrgWithheldMarkers(adopted,first).map(x=>x.marker).sort();
  chk('both Aug 18 markers are WITHHELD, not inherited',withheld,
    ['pop_racine_20260818','shows_add_20260818']);
  const took=w.ctx.mrgInheritSeedMarkers(adopted,first);
  chk('and neither was taken',took.filter(m=>/20260818/.test(m)).length,0);

  w.store['dd_bs_v7']=JSON.stringify(adopted);
  const after=w.ctx.loadS();

  chk('the full show count is restored',after.shows.length,before);
  chk('the full day count is restored',days(after),beforeDays);
  chk('every one of the three came back',
    THREE.every(t=>after.shows.some(sh=>key(w,sh)===w.ctx.mrgShowKey(t[0],t[1]))),true);
  chk('each under its CANONICAL id, not a new one',
    THREE.every(t=>{const sh=after.shows.find(x=>key(w,x)===w.ctx.mrgShowKey(t[0],t[1]));
      return sh&&sh.id===originalIds[t[0]];}),true);
  const ak=after.shows.map(sh=>key(w,sh));
  chk('no duplicate name+date',ak.length,new Set(ak).size);
  const ai=after.shows.map(sh=>sh.id);
  chk('no duplicate id',ai.length,new Set(ai).size);
  chk('no business field was lost from any of the three',
    THREE.every(t=>{
      const a=first.shows.find(x=>key(w,x)===w.ctx.mrgShowKey(t[0],t[1]));
      const b=after.shows.find(x=>key(w,x)===w.ctx.mrgShowKey(t[0],t[1]));
      return canon(a)===canon(b);}),true);
  chk('the guard added no field to the state',
    Object.keys(after).filter(x=>x.indexOf('_mrg')===0).length,0);
}

// ------------------------- 9. the same, WITHOUT layer 1 - layer 2 must hold
R.section('=== 9. LAYER 2 ALONE, WITH LAYER 1 DELIBERATELY SKIPPED ===');
{
  const w=browser();
  const first=w.ctx.loadS();
  const before=first.shows.length, beforeDays=days(first);
  const originalIds9={};
  THREE.forEach(t=>{
    const sh=first.shows.find(x=>key(w,x)===w.ctx.mrgShowKey(t[0],t[1]));
    originalIds9[t[0]]=sh&&sh.id;
  });
  const adopted=JSON.parse(JSON.stringify(first));
  adopted.shows=adopted.shows.filter(sh=>
    !THREE.some(t=>key(w,sh)===w.ctx.mrgShowKey(t[0],t[1])));
  delete adopted._applied['shows_add_20260818'];
  delete adopted._applied['pop_racine_20260818'];

  // No mrgInheritSeedMarkers call at all. The seeds WILL run this time.
  clearLog(w);
  w.store['dd_bs_v7']=JSON.stringify(adopted);
  const after=w.ctx.loadS();

  chk('the seeds did run',!!after._applied['shows_add_20260818'],true);
  chk('the full show count is restored',after.shows.length,before);
  chk('the full day count is restored',days(after),beforeDays);
  const restored=w.ctx.mrgLogRead().filter(x=>x.action==='identity-restored');
  chk('three identities were restored',restored.length,3);
  chk('each kept the id this device already held',
    restored.every(r=>typeof r.keptId==='string'&&r.keptId.indexOf('sh_auto_')===0),true);
  chk('and each discarded a freshly minted one',
    restored.every(r=>r.discardedId&&r.discardedId!==r.keptId),true);
  chk('every restored id matches the pre-adoption id',
    THREE.every(t=>{const sh=after.shows.find(x=>key(w,x)===w.ctx.mrgShowKey(t[0],t[1]));
      return sh&&sh.id===originalIds9[t[0]];}),true);
  const ids=after.shows.map(sh=>sh.id);
  chk('no duplicate id',ids.length,new Set(ids).size);
  const kk=after.shows.map(sh=>key(w,sh));
  chk('no duplicate name+date',kk.length,new Set(kk).size);
}

// ------------------------------------------------ 10. storage unavailable
R.section('=== 10. THE LEDGER MAY BE UNAVAILABLE ===');
{
  const w=browser();
  w.store['dd_bs_seedlog_v1']='';
  // Safari private mode and a full quota both throw on setItem.
  const realSet=w.ctx.localStorage.setItem;
  w.ctx.localStorage.setItem=()=>{throw new Error('QuotaExceededError');};
  const d={shows:[],_applied:{}};
  chk('creation still works when the ledger cannot be written',
    w.ctx.mrgPushShow(d,show('Alpha','2026-01-01','sh_x'),'m'),'created');
  chk('the row was added',d.shows.length,1);
  chk('a duplicate is STILL refused without a writable ledger',
    w.ctx.mrgPushShow(d,show('Alpha','2026-01-01','sh_y'),'m'),'duplicate-blocked');
  chk('still one row',d.shows.length,1);
  w.ctx.localStorage.setItem=realSet;

  const realGet=w.ctx.localStorage.getItem;
  w.ctx.localStorage.getItem=()=>{throw new Error('SecurityError');};
  chk('an unreadable ledger does not throw',
    w.ctx.mrgPushShow({shows:[],_applied:{}},show('Beta','2026-01-01','sh_z'),'m'),'created');
  w.ctx.localStorage.getItem=realGet;

  w.store['dd_bs_seedlog_v1']='{not json';
  chk('a corrupt ledger is treated as empty',
    w.ctx.mrgPushShow({shows:[],_applied:{}},show('Gamma','2026-01-01','sh_g'),'m'),'created');
}

// ---------------------------------- 11. Phase 2B gates are not weakened
R.section('=== 11. PHASE 2B AND ID MATCHING ARE UNCHANGED ===');
{
  const w=browser();
  chk('the manifest still names three shows',w.ctx.P2B_MANIFEST.shows.length,3);
  chk('the expected addition count is still 8',w.ctx.P2B_EXPECTED_ADDITIONS,8);
  chk('the confirmation phrase is unchanged',w.ctx.P2B_PHRASE,'ADD 8 ITEMS TO CLOUD');
  chk('the precondition device fingerprint is untouched by this branch',
    w.ctx.P2B_PRECOND.deviceFp,'50dfbbf5/86918');
  chk('the manifest name still uses the em dash',
    w.ctx.P2B_MANIFEST.shows.some(s=>s.name.indexOf('—')>=0),true);

  // ID matching must still be id-first, and must still refuse a fallback match
  // between two records that both carry explicit but different ids.
  const a={shows:[{id:'sh_1',name:'Alpha',startDate:'2026-01-01'}]};
  const b={shows:[{id:'sh_2',name:'Alpha',startDate:'2026-01-01'}]};
  const m=w.ctx.bxMatchShows(a,b);
  chk('two different explicit ids never fall back to a name match',m.pairs.length,0);
  chk('both are reported as unmatched',m.onlyLocal.length+m.onlyCloud.length,2);
  const c={shows:[{id:'sh_1',name:'Alpha',startDate:'2026-01-01'}]};
  const m2=w.ctx.bxMatchShows(a,c);
  chk('a shared id still matches',m2.pairs.length,1);
}

// ================= REQUIRED REGRESSIONS FROM INDEPENDENT REVIEW =================

R.section('=== 12. THE MARKER->RECORDS TABLE MUST NOT DRIFT (req E) ===');
{
  // Rebuild MRG_SEED_RECORDS from a clean run of the real migrations and
  // compare. If a migration gains or loses a seeded show, this fails.
  const w=browser();
  const real=w.ctx.mrgPushShow, seen={};
  w.ctx.mrgPushShow=function(d,sh,marker){
    const r=real(d,sh,marker);
    if(r==='created'||r==='identity-restored')
      (seen[marker]=seen[marker]||[]).push(w.ctx.mrgNormName(sh.name));
    return r;
  };
  w.store['dd_bs_v7']=''; w.store['dd_bs_seedlog_v1']='';
  w.ctx.loadS();
  w.ctx.mrgPushShow=real;
  const declared=w.ctx.MRG_SEED_RECORDS;
  Object.keys(declared).forEach(m=>{
    chk('declared records match the migration: '+m,
      (seen[m]||[]).slice().sort(),declared[m].slice().sort());
  });
  chk('no migration seeds shows without a declared entry',
    Object.keys(seen).filter(m=>!declared[m]),[]);
}

R.section('=== 13. INHERITANCE REQUIRES EVERY SEEDED RECORD (req E) ===');
{
  const w=browser();
  const cur={_applied:{shows_add_20260818:true}};
  const both=[show('Whole Bead Show — Milwaukee Pop-up','2026-10-27','a'),
              show('Wonderful World of Weddings','2027-01-30','b')];
  chk('both records present -> inherited',
    w.ctx.mrgInheritSeedMarkers({_applied:{},shows:both.slice()},cur),['shows_add_20260818']);
  chk('one record missing -> WITHHELD',
    w.ctx.mrgInheritSeedMarkers({_applied:{},shows:[both[0]]},cur),[]);
  chk('no records at all -> WITHHELD',
    w.ctx.mrgInheritSeedMarkers({_applied:{},shows:[]},cur),[]);
  const why=w.ctx.mrgWithheldMarkers({_applied:{},shows:[both[0]]},cur);
  chk('the reason names the missing record',why[0]&&why[0].missing,['wonderful world of weddings']);

  // Matching is by NAME, not name+date: later migrations move seeded dates.
  chk('a moved start date still counts as present',
    w.ctx.mrgInheritSeedMarkers({_applied:{},shows:[
      show('Whole Bead Show — Milwaukee Pop-up','2099-01-01','a'),
      show('Wonderful World of Weddings','2099-01-02','b')]},cur),['shows_add_20260818']);
  chk('st_martins seeds Aug 30 but is matched at its corrected Sep 06 date',
    w.ctx.mrgInheritSeedMarkers({_applied:{},shows:[show('St. Martins Fair','2026-09-06','x')]},
      {_applied:{st_martins_20260518:true}}),['st_martins_20260518']);
}

R.section('=== 14. SAFARI LEDGER POISONING IS REPAIRED (blocker 2, req D) ===');
{
  // The secondary storage holds ledger entries pointing at the SUPERSEDED ids.
  // It then adopts a document carrying the CANONICAL ids. The present record
  // is the authority: the ledger must be repaired, and the superseded ids must
  // stop being restorable anywhere.
  const SUP={'Whole Bead Show — Milwaukee Pop-up':'sh_auto_wholebeadshowmilwauk_178726411239739',
             'Wonderful World of Weddings':'sh_auto_wonderfulworldofwedd_1787264112397189',
             'Party on the Pavement':'sh_auto_partyonthepavement_1787264112399590'};
  const CAN={'Whole Bead Show — Milwaukee Pop-up':'sh_auto_wholebeadshowmilwauk_1787088971124554',
             'Wonderful World of Weddings':'sh_auto_wonderfulworldofwedd_1787088971124589',
             'Party on the Pavement':'sh_auto_partyonthepavement_1787088971125819'};
  const safari=browser();
  safari.store['dd_bs_seedlog_v1']='';
  // poison the ledger with the superseded identities
  const poisoned={shows:THREE.map(t=>show(t[0],t[1],SUP[t[0]])),_applied:{}};
  safari.ctx.mrgLedgerReconcile(poisoned);
  const led0=JSON.parse(safari.store['dd_bs_seedlog_v1']).entries;
  chk('the ledger starts poisoned',
    THREE.every(t=>led0[safari.ctx.mrgShowKey(t[0],t[1])].id===SUP[t[0]]),true);

  // adopt a document carrying the canonical ids
  clearLog(safari);
  const incoming={shows:THREE.map(t=>show(t[0],t[1],CAN[t[0]])),_applied:{}};
  const res=safari.ctx.mrgLedgerReconcile(incoming);
  chk('three ledger entries were repaired',res.repaired,3);
  const led1=JSON.parse(safari.store['dd_bs_seedlog_v1']).entries;
  chk('the ledger now holds the CANONICAL ids',
    THREE.every(t=>led1[safari.ctx.mrgShowKey(t[0],t[1])].id===CAN[t[0]]),true);
  chk('no superseded id survives anywhere in the ledger',
    Object.keys(led1).filter(k=>/1787264112/.test(led1[k].id)).length,0);
  chk('the present records were NOT altered',
    incoming.shows.map(sh=>sh.id).sort(),Object.keys(CAN).map(n=>CAN[n]).sort());
  chk('still three rows, no duplicate',incoming.shows.length,3);
  chk('the repair is logged outside the state document',
    safari.ctx.mrgLogRead().filter(x=>x.action==='ledger-repaired').length,3);
  chk('and nothing was written into the state document',
    Object.keys(incoming).filter(k=>k.indexOf('_mrg')===0).length,0);

  // A stale ledger must never override an explicit id on a present record.
  const doc2={shows:[show('Whole Bead Show — Milwaukee Pop-up','2026-10-27',CAN['Whole Bead Show — Milwaukee Pop-up'])],_applied:{}};
  safari.ctx.mrgLedgerReconcile(doc2);
  chk('a present record keeps its explicit id',doc2.shows[0].id,CAN['Whole Bead Show — Milwaukee Pop-up']);

  // And the superseded id can no longer be restored by a later seed.
  const gone={shows:[],_applied:{}};
  safari.ctx.mrgPushShow(gone,show('Whole Bead Show — Milwaukee Pop-up','2026-10-27','sh_fresh'),'shows_add_20260818');
  chk('a later restore hands back the canonical id, not the superseded one',
    gone.shows[0].id,CAN['Whole Bead Show — Milwaukee Pop-up']);
}

R.section('=== 15. NO NEW STATE FIELD, ANYWHERE (req F) ===');
{
  const w=browser();
  const d=w.ctx.loadS();
  const BASE=['v','reps','costs','shows','prices','freight','_applied','settings','supplies',
    'inventory','transfers','_updatedAt','productDebt','batmanBorrow','otherExpenses',
    'cogsHistory','cogsHistoryMeta'];
  // _updatedAt only exists once saveS() has run, so assert containment rather
  // than equality: no key may appear that is not in the known set.
  chk('no top-level key outside the known set',Object.keys(d).filter(k=>BASE.indexOf(k)<0),[]);
  chk('no _mrg field on the state',Object.keys(d).filter(k=>k.indexOf('_mrg')===0),[]);
  chk('no show carries a guard field',
    d.shows.every(sh=>Object.keys(sh).every(k=>k.indexOf('_mrg')!==0)),true);
  // and after an adoption cycle too
  const ad=JSON.parse(JSON.stringify(d));
  ad.shows=ad.shows.filter(sh=>!THREE.some(t=>key(w,sh)===w.ctx.mrgShowKey(t[0],t[1])));
  delete ad._applied['shows_add_20260818']; delete ad._applied['pop_racine_20260818'];
  w.ctx.mrgInheritSeedMarkers(ad,d);
  w.store['dd_bs_v7']=JSON.stringify(ad);
  const after=w.ctx.loadS();
  chk('still no key outside the known set after adoption',
    Object.keys(after).filter(k=>BASE.indexOf(k)<0),[]);
  chk('and no field was dropped either',
    Object.keys(d).filter(k=>Object.keys(after).indexOf(k)<0),[]);
}

R.section('=== 16. SEEDED IDS ARE UNIQUE EVEN ON A COLLISION ===');
{
  // buildPlannedShow truncates the name to 20 chars, so the six
  // "Rustic Fox - Carol Stream (...)" shows share a prefix and are separated
  // only by Date.now() plus a 0-999 random. Seeded in the same millisecond,
  // they collide intermittently - which is exactly what Phase 2B quarantines.
  const w=browser();
  w.store['dd_bs_seedlog_v1']='';
  const d={shows:[show('Existing Fair','2026-01-01','sh_auto_dup_123')],_applied:{}};
  clearLog(w);
  chk('a colliding id is still created',
    w.ctx.mrgPushShow(d,show('Another Fair','2026-02-02','sh_auto_dup_123'),'m'),'created');
  chk('two rows',d.shows.length,2);
  chk('but the second id was made unique',d.shows[1].id,'sh_auto_dup_1231');
  chk('no duplicate id',d.shows.map(x=>x.id).length,new Set(d.shows.map(x=>x.id)).size);
  chk('the collision was logged',
    w.ctx.mrgLogRead().filter(x=>x.action==='id-collision-avoided').length,1);

  // three-way collision
  chk('a third collision also resolves',
    w.ctx.mrgPushShow(d,show('Third Fair','2026-03-03','sh_auto_dup_123'),'m'),'created');
  chk('and gets its own id',d.shows[2].id,'sh_auto_dup_1232');
  const ids=d.shows.map(x=>x.id);
  chk('all three ids distinct',ids.length,new Set(ids).size);

  // an id claimed in the ledger for a DIFFERENT show is also avoided
  w.ctx.mrgLedgerReconcile(d);            // now sh_auto_dup_123 is claimed too
  const d2={shows:[],_applied:{}};
  chk('an id already claimed in the ledger is avoided',
    w.ctx.mrgPushShow(d2,show('Fourth Fair','2026-04-04','sh_auto_dup_123'),'m'),'created');
  chk('  by taking a free variant',d2.shows[0].id!=='sh_auto_dup_123',true);

  // repeated clean builds must never produce a duplicate id
  let bad=0;
  for(let i=0;i<25;i++){
    const b=browser(); b.store['dd_bs_v7']=''; b.store['dd_bs_seedlog_v1']='';
    const st=b.ctx.loadS();
    const x=st.shows.map(sh=>sh.id);
    if(x.length!==new Set(x).size)bad++;
  }
  chk('25 clean builds, zero duplicate ids',bad,0);
}

R.done();
