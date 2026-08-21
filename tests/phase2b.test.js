// Phase 2B — controlled cloud reconciliation. SYNTHETIC FIXTURES ONLY.
//
// Nothing here touches a real Supabase account, a real export, or any real
// business data. The Supabase client is a fake this file fully controls, so
// every write, read and race is observable and deterministic.
//
//   node tests/phase2b.test.js
'use strict';
const {boot,reporter,el}=require('./harness.js');
const R=reporter();
const chk=R.check;

const SK=['32oz','16oz','8oz','2oz','c5s','c5l'];
const day=(n,seed)=>({dayNum:n,date:'',
  morningCount:SK.reduce((o,k)=>(o[k]=20,o),{}),
  eveningCount:SK.reduce((o,k)=>(o[k]=20-(seed%4),o),{}),
  payments:{cash:10*seed,card:5*seed,venmo:0,zelle:0,check:0},
  expenses:{food:5},repSales:[],workers:[],restock:{},lost:{},locked:false});
const show=(id,name,startDate,days,seed)=>({id,name,startDate,numDays:days,boothCost:100+(seed||1),
  boothPayments:[{id:'bp_'+seed,date:'2026-01-05',amount:50,method:'card',note:'deposit'}],
  showExpenses:[{cat:'lodging',amount:80,note:'motel'}],
  days:Array.from({length:days},(_,d)=>day(d+1,(seed||1)+d)),
  workers:[],repPayMeta:{},costs:{},prices:null,notes:'note '+seed,confirmed:true});

// The three device-only shows carry the manifest identities. The names and ids
// are the app's own manifest constants; all sales figures here are invented.
function build(ctx){
  const M=ctx.P2B_MANIFEST;
  const shared=[]; for(let i=1;i<=32;i++)shared.push(show('sh_'+i,'Synthetic Show '+i,'2026-0'+((i%8)+1)+'-1'+(i%9),2,i));
  // 32 shared shows x 2 days = 64 cloud day records... the fixture needs 71, so
  // give seven of them an extra day. 35 device shows must total 75.
  for(let i=0;i<7;i++){ shared[i].numDays=3; shared[i].days.push(day(3,i+50)); }
  const extra=M.shows.map((m,i)=>show(m.id,m.name,m.startDate,[1,2,1][i],200+i));
  const reps=Array.from({length:12},(_,i)=>({id:'rep_'+i,name:'Rep '+i,active:true}));
  const cloud={shows:JSON.parse(JSON.stringify(shared)),reps:JSON.parse(JSON.stringify(reps)),
    inventory:{'32oz':10},settings:{irsRate:0.7},costs:{'32oz':4.5},
    _applied:{old_marker_v1:true},cloudOnlyMystery:{keep:'me'},
    _updatedAt:'2026-08-19T09:00:00.000Z'};
  const local=JSON.parse(JSON.stringify(cloud));
  delete local.cloudOnlyMystery;
  local.shows=local.shows.concat(JSON.parse(JSON.stringify(extra)));
  local._applied={old_marker_v1:true};
  M.markers.forEach(k=>{local._applied[k]=true;});
  local.cogsHistory=[{id:'cogs_historical',effectiveFrom:'1900-01-01',effectiveTo:'2026-07-31',
      costs:SK.reduce((o,k)=>(o[k]=6,o),{})},
    {id:'cogs_current_2026_08',effectiveFrom:'2026-08-01',effectiveTo:null,
      costs:SK.reduce((o,k)=>(o[k]=4,o),{})}];
  local.cogsHistoryMeta={seededBy:'phase2a',seededAt:'2026-08-20'};
  local._updatedAt='2026-08-20T18:00:00.000Z';
  return {local,cloud};
}

// A fresh sandbox and fake Supabase per scenario.
function world(opts){
  opts=opts||{};
  const h=boot(); const {ctx,store,run}=h;
  const {local,cloud}=build(ctx);
  if(opts.mutate)opts.mutate(local,cloud,ctx);
  const box={cloud:JSON.parse(JSON.stringify(cloud)),token:'2026-08-19T09:00:00.000000+00:00',
    writes:[],updateAttempts:[],readFilters:[],selectCols:null,readCount:0,
    failWrite:opts.failWrite||false,corruptAfterWrite:opts.corruptAfterWrite||null,
    afterRead:opts.afterRead||null,dropToken:opts.dropToken||false,reorderKeysOnRead:opts.reorderKeysOnRead||false};
  store['dd_bs_v7']=JSON.stringify(local);
  ctx.__mem=JSON.parse(JSON.stringify(local)); run('S=__mem;');
  ctx.__box=box; ctx.__el=el;
  run(`sb={from:function(){return{
    select:function(cols){ __box.selectCols=cols; var f={};
      var q={eq:function(col,val){ f[col]=val; return q; },
        maybeSingle:async function(){
          __box.readFilters.push(JSON.parse(JSON.stringify(f)));
      __box.readCount++;
      var doc=JSON.parse(JSON.stringify(__box.cloud));
      var tok=(__box.dropToken?null:__box.token);
      if(__box.afterRead&&__box.readCount===__box.afterRead.onRead){
        var landLater=__box.afterRead.apply;
        Promise.resolve().then(function(){ landLater(__box); });  // lands after this read returns
      }
      if(__box.reorderKeysOnRead&&__box.writes.length>0){
        var out={}; Object.keys(doc).sort().reverse().forEach(function(k){out[k]=doc[k];}); doc=out;
      }
      return {data:{data_value:doc,updated_at:tok},error:null};
        }};
      return q; },
    update:function(patch){
      var f={};
      var api={eq:function(col,val){f[col]=val;return api;},
        select:async function(){
          __box.updateAttempts.push(JSON.parse(JSON.stringify(f)));
          if(__box.failWrite)return {data:null,error:{message:'simulated network failure'}};
          if(f.updated_at!==__box.token)return {data:[],error:null};   // compare-and-swap miss
          __box.writes.push(JSON.parse(JSON.stringify(patch.data_value)));
          __box.cloud=JSON.parse(JSON.stringify(patch.data_value));
          __box.token=patch.updated_at;
          if(__box.corruptAfterWrite)__box.cloud=__box.corruptAfterWrite(__box.cloud);
          return {data:[{data_value:__box.cloud,updated_at:__box.token}],error:null};
        }};
      return api;
    }};}};_cloudUser={id:'u1'};`);
  run("$$=function(id){var e=__el(); if(typeof __phrase!=='undefined'&&id==='p2b_phrase')e.value=__phrase; return e;};");
  // Preconditions for THIS synthetic fixture. Production passes none, so the
  // independently verified constants in the app apply there.
  const P={deviceFp:ctx.bxFingerprint(local),cloudFp:ctx.bxFingerprint(cloud),
    device:{shows:35,days:75},cloud:{shows:32,days:71}};
  return {ctx,store,run,box,local,cloud,P,
    stage:()=>ctx.p2bStage(P),
    ready:async function(){ await ctx.p2bStage(P); ctx.p2bDownloadBackup(); ctx.p2bToggleBackupConfirmed(true); }};
}
const frozen=w=>JSON.stringify({ls:w.store['dd_bs_v7'],cloud:w.box.cloud,token:w.box.token});
const PHRASE='ADD 8 ITEMS TO CLOUD';

(async()=>{

R.section('=== FIXTURE SANITY ===');
{
  const w=world();
  chk('fixture: 35 device shows', w.local.shows.length, 35);
  chk('fixture: 75 device day records', w.local.shows.reduce((t,s)=>t+s.days.length,0), 75);
  chk('fixture: 32 cloud shows', w.cloud.shows.length, 32);
  chk('fixture: 71 cloud day records', w.cloud.shows.reduce((t,s)=>t+s.days.length,0), 71);
  chk('fixture: 12 reps on both sides', [w.local.reps.length,w.cloud.reps.length], [12,12]);
  chk('the app carries the real verified preconditions', w.ctx.P2B_PRECOND,
      {deviceFp:'630f8db0/86919',cloudFp:'67c10862/80102',device:{shows:35,days:75},cloud:{shows:32,days:71}});
}

R.section('=== 1. THE EXPECTED EIGHT-ADDITION SCENARIO ===');
{
  const w=world();
  const r=await w.stage();
  chk('staging succeeds', r.ok, true);
  chk('exactly 8 authorized additions', r.op.auth.total, 8);
  chk('counts are 8/0/0/0/0', r.op.validation.counts,
      {additions:8,changes:0,deletions:0,blocked:0,needsReview:0});
  chk('a version token was captured', typeof r.op.cloudToken, 'string');
  chk('NOTHING written by staging', w.box.writes.length, 0);
  chk('no update was even attempted', w.box.updateAttempts.length, 0);
  w.ctx.p2bDownloadBackup(); w.ctx.p2bToggleBackupConfirmed(true);
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('apply succeeds', ap.ok, true);
  chk('verification passed', ap.verification.ok, true);
  chk('exactly one write', w.box.writes.length, 1);
  chk('exactly one row updated', ap.audit.rowsUpdated, 1);
  chk('cloud now has 35 shows', w.box.cloud.shows.length, 35);
  chk('cloud now has 75 day records', w.box.cloud.shows.reduce((t,s)=>t+s.days.length,0), 75);
  chk('the version token advanced', ap.audit.versionToken.after!==ap.audit.versionToken.before, true);
  chk('the receipt describes the compare-and-swap', /compare-and-swap/.test(ap.receipt), true);
}

R.section('=== 1b. THE CONDITIONAL QUERY IS WHAT WE CLAIM ===');
{
  const w=world(); await w.ready();
  await w.ctx.p2bApply(PHRASE);
  const f=w.box.updateAttempts[0];
  chk('filters on user_id', f.user_id, 'u1');
  chk('filters on data_key', f.data_key, 'bs_state');
  chk('filters on the exact version token', f.updated_at, '2026-08-19T09:00:00.000000+00:00');
  chk('exactly three filters, nothing looser', Object.keys(f).sort(), ['data_key','updated_at','user_id']);
  chk('no upsert path exists in the write', /upsert/.test(w.ctx.p2bWriteOnce.toString()), false);
}

R.section('=== 2. ANOTHER CLIENT WRITES BETWEEN THE FINAL READ AND OUR WRITE ===');
{
  // The competing write lands AFTER our final fresh read has returned, so our
  // fingerprint checks all pass and only the compare-and-swap can catch it.
  // This is the exact race an unconditional upsert would have lost.
  const competing={shows:[{id:'sh_competitor',name:'Written by another device',
      startDate:'2026-12-01',numDays:1,days:[],boothPayments:[],showExpenses:[]}],
    _applied:{},someoneElse:'must survive',reps:[]};
  const w=world({afterRead:{onRead:2,apply:box=>{
    box.cloud=JSON.parse(JSON.stringify(competing));
    box.token='2026-08-19T09:05:00.000000+00:00';
  }}});
  await w.ready();                       // reads 1 (stage). apply does read 2.
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('our write is refused', ap.ok, false);
  chk('the conditional update matched ZERO rows',
      ap.errors.some(e=>/matched zero rows|changed while you were confirming/.test(e)), true);
  chk('exactly one update was attempted', w.box.updateAttempts.length, 1);
  chk('it carried the STALE token', w.box.updateAttempts[0].updated_at, '2026-08-19T09:00:00.000000+00:00');
  chk('no write landed', w.box.writes.length, 0);
  chk('the competing update survives EXACTLY', w.box.cloud, competing);
  chk('their unknown field is intact', w.box.cloud.someoneElse, 'must survive');
  chk('their token is unchanged', w.box.token, '2026-08-19T09:05:00.000000+00:00');
  const again=await w.ctx.p2bApply(PHRASE);
  chk('no automatic retry', again.ok, false);
  chk('still zero writes', w.box.writes.length, 0);
  chk('the competing document is still untouched', w.box.cloud, competing);
}

R.section('=== 2b. NO VERSION TOKEN MEANS NO WRITE ===');
{
  const w=world({dropToken:true});
  const r=await w.stage();
  chk('staging still describes the work', r.ok, true);
  w.ctx.p2bDownloadBackup(); w.ctx.p2bToggleBackupConfirmed(true);
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('apply refuses without a token', ap.ok, false);
  chk('and says why', /version token/.test(ap.errors[0]), true);
  chk('ZERO writes and zero attempts', [w.box.writes.length,w.box.updateAttempts.length], [0,0]);
}

R.section('=== 3. THE EXACT AUTHORIZATION MANIFEST ===');
{
  const w=world();
  const M=w.ctx.P2B_MANIFEST;
  chk('manifest names three shows by stable id', M.shows.map(x=>x.id), [
    'sh_auto_wholebeadshowmilwauk_1787088971124554',
    'sh_auto_wonderfulworldofwedd_1787088971124589',
    'sh_auto_partyonthepavement_1787088971125819']);
  chk('manifest names three markers', M.markers,
      ['shows_add_20260818','pop_racine_20260818','cogs_history_v1']);
  chk('manifest names two fields', M.fields, ['cogsHistory','cogsHistoryMeta']);
  chk('eight items in total', M.shows.length+M.markers.length+M.fields.length, 8);
}
// substitution: a different show, still eight additions
{
  const w=world({mutate:(l,c,ctx)=>{ l.shows[34].id='sh_not_authorized'; }});
  const r=await w.stage();
  chk('a substituted show id is refused', r.ok, false);
  chk('it names the unauthorized id', r.errors.some(e=>/UNAUTHORIZED show/.test(e)), true);
  chk('and the missing authorized one', r.errors.some(e=>/authorized show is missing/.test(e)), true);
  chk('ZERO writes', w.box.writes.length, 0);
}
// a wholly different set of eight
{
  const w=world({mutate:(l,c,ctx)=>{
    l.shows.length=32;
    for(let i=0;i<3;i++)l.shows.push(show('sh_other_'+i,'Other Show '+i,'2026-1'+i+'-01',[1,2,1][i],300+i));
    l._applied={old_marker_v1:true,other_a:true,other_b:true,other_c:true};
    delete l.cogsHistory; delete l.cogsHistoryMeta;
    l.otherFieldOne={a:1}; l.otherFieldTwo={b:2};
  }});
  const r=await w.stage();
  chk('a different set of eight cannot pass', r.ok, false);
  chk('ZERO writes', w.box.writes.length, 0);
}
// substituted name / start date on an authorized id
{
  const w=world({mutate:(l)=>{ l.shows[32].name='Renamed Behind Our Back'; }});
  const r=await w.stage();
  chk('a renamed authorized show is refused', r.ok, false);
  chk('it names the mismatch', r.errors.some(e=>/is named/.test(e)), true);
}
{
  const w=world({mutate:(l)=>{ l.shows[33].startDate='2099-01-01'; }});
  const r=await w.stage();
  chk('a moved start date is refused', r.ok, false);
  chk('it names the date mismatch', r.errors.some(e=>/starts 2099-01-01/.test(e)), true);
}
// missing manifest item
{
  const w=world({mutate:(l)=>{ l.shows.splice(34,1); }});
  const r=await w.stage();
  chk('a missing authorized show is refused', r.ok, false);
  chk('ZERO writes', w.box.writes.length, 0);
}
{
  const w=world({mutate:(l)=>{ delete l._applied['pop_racine_20260818']; }});
  const r=await w.stage();
  chk('a missing marker is refused', r.ok, false);
}
{
  const w=world({mutate:(l)=>{ delete l.cogsHistoryMeta; }});
  const r=await w.stage();
  chk('a missing field is refused', r.ok, false);
}
// duplicated manifest item
{
  const w=world({mutate:(l)=>{ l.shows.push(JSON.parse(JSON.stringify(l.shows[32]))); }});
  const r=await w.stage();
  chk('a duplicated authorized show is refused', r.ok, false);
  chk('ZERO writes', w.box.writes.length, 0);
}
// altered content on an authorized id
{
  const w=world();
  const auth={shows:[{id:w.ctx.P2B_MANIFEST.shows[0].id,label:'x',
    record:Object.assign(show(w.ctx.P2B_MANIFEST.shows[0].id,w.ctx.P2B_MANIFEST.shows[0].name,
      w.ctx.P2B_MANIFEST.shows[0].startDate,1,9),{boothCost:99999})}],
    markers:w.ctx.P2B_MANIFEST.markers.slice(),
    fields:w.ctx.P2B_MANIFEST.fields.map(f=>({field:f,value:w.local[f]}))};
  // only one show supplied, and its content differs from the device copy
  const errs=w.ctx.p2bManifestCheck(auth,w.local);
  chk('an altered record is caught', errs.some(e=>/does not match the staged device record/.test(e)), true);
  chk('and the two missing shows are caught', errs.filter(e=>/missing from the proposal/.test(e)).length, 2);
}

R.section('=== 3b. THE EXACT STORED NAME, EM DASH AND ALL ===');
{
  const w=world();
  const m=w.ctx.P2B_MANIFEST.shows[0];
  // The stored record uses U+2014 EM DASH. A comma, a hyphen or an en dash are
  // all different records as far as this check is concerned.
  chk('the manifest carries the em-dash spelling', m.name, 'Whole Bead Show \u2014 Milwaukee Pop-up');
  chk('and it really is U+2014', m.name.charCodeAt(16), 0x2014);
  chk('not a comma', m.name.indexOf(',')>=0, false);
  chk('not a plain hyphen', m.name.indexOf(' - ')>=0, false);
  chk('not an en dash', m.name.indexOf('\u2013')>=0, false);
  // the app's own migration, which created the record, must agree
  const src=require('fs').readFileSync(require('./harness.js').APP,'utf8');
  chk('the migration that created the show uses the same spelling',
      src.indexOf("name:'Whole Bead Show \u2014 Milwaukee Pop-up'")>=0, true);
}
// the exact stored spelling is ACCEPTED
{
  const w=world();
  const r=await w.stage();
  chk('the verified spelling stages cleanly', r.ok, true);
  chk('and the authorized record carries it',
      r.op.auth.shows.find(x=>x.id==='sh_auto_wholebeadshowmilwauk_1787088971124554').record.name,
      'Whole Bead Show \u2014 Milwaukee Pop-up');
}
// every near-miss spelling is REJECTED
{
  const NEAR=[['a comma','Whole Bead Show, Milwaukee Pop-up'],
              ['a hyphen','Whole Bead Show - Milwaukee Pop-up'],
              ['an en dash','Whole Bead Show \u2013 Milwaukee Pop-up'],
              ['no separator','Whole Bead Show Milwaukee Pop-up'],
              ['different case','whole bead show \u2014 milwaukee pop-up'],
              ['trailing space','Whole Bead Show \u2014 Milwaukee Pop-up ']];
  for(const [label,name] of NEAR){
    const w=world({mutate:l=>{ l.shows[32].name=name; }});
    const r=await w.stage();
    chk('rejected, '+label, r.ok, false);
    chk('  and it names the mismatch, '+label, r.errors.some(e=>/is named/.test(e)), true);
    chk('  ZERO writes, '+label, w.box.writes.length, 0);
  }
}

R.section('=== 3c. THE CLOUD READ FILTERS ON USER AND KEY ===');
{
  const w=world();
  await w.stage();
  chk('at least one read happened', w.box.readFilters.length>0, true);
  const f=w.box.readFilters[0];
  chk('filters on the authenticated user_id', f.user_id, 'u1');
  chk('filters on data_key', f.data_key, 'bs_state');
  chk('exactly those two filters, nothing looser', Object.keys(f).sort(), ['data_key','user_id']);
  chk('every read is filtered the same way',
      w.box.readFilters.every(x=>x.user_id==='u1'&&x.data_key==='bs_state'), true);
  chk('it selects the version token as well as the document', w.box.selectCols, 'data_value,updated_at');
}
{
  // the filters must still be present on the FINAL fresh read, not just the first
  const w=world(); await w.ready();
  const before=w.box.readFilters.length;
  await w.ctx.p2bApply(PHRASE);
  chk('the apply path re-read the cloud', w.box.readFilters.length>before, true);
  chk('and every one of those reads was scoped to the user',
      w.box.readFilters.every(x=>x.user_id==='u1'&&x.data_key==='bs_state'), true);
}
{
  // signed out means no read is attempted at all
  const w=world();
  w.run('_cloudUser=null;');
  const r=await w.ctx.bxCloudRead();
  chk('signed out is reported, not queried', r.status, 'signed_out');
  chk('and no read was issued', w.box.readFilters.length, 0);
}

R.section('=== 4. PRECONDITIONS ===');
{
  const w=world();
  const bad=w.ctx.p2bPrecondCheck(w.local,w.cloud);   // against the REAL constants
  chk('the synthetic fixture does not match the real preconditions', bad.length>0, true);
  chk('it reports the device fingerprint', bad.some(e=>/device fingerprint is/.test(e)), true);
  chk('and the cloud fingerprint', bad.some(e=>/cloud fingerprint is/.test(e)), true);
  const good=w.ctx.p2bPrecondCheck(w.local,w.cloud,w.P);
  chk('and matches its own declared preconditions', good, []);
}
{
  const w=world({mutate:(l)=>{ l.inventory['32oz']=11; }});   // device moved before staging
  const r=await w.stage();
  chk('a changed device fingerprint aborts at staging', r.ok, false);
  chk('ZERO writes', w.box.writes.length, 0);
}

R.section('=== 5. FINGERPRINT DRIFT BETWEEN PREVIEW AND WRITE ===');
{
  const w=world(); await w.ready();
  const l=JSON.parse(w.store['dd_bs_v7']); l.shows[0].notes='edited on the device';
  w.store['dd_bs_v7']=JSON.stringify(l);
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('device drift aborts', ap.ok, false);
  chk('it names the device', /device copy changed/.test(ap.errors[0]), true);
  chk('ZERO writes', w.box.writes.length, 0);
}
{
  const w=world(); await w.ready();
  w.box.cloud=JSON.parse(JSON.stringify(w.box.cloud)); w.box.cloud.shows[0].notes='another device';
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('cloud drift aborts', ap.ok, false);
  chk('it names the cloud', /cloud copy changed/.test(ap.errors[0]), true);
  chk('ZERO writes', w.box.writes.length, 0);
}

R.section('=== 6. THE BACKUP GATE ===');
{
  const w=world();
  await w.stage();
  const a1=await w.ctx.p2bApply(PHRASE);
  chk('refused before any download', a1.ok, false);
  chk('it names the download', /has not been downloaded/.test(a1.errors[0]), true);
  w.ctx.p2bDownloadBackup();
  const a2=await w.ctx.p2bApply(PHRASE);
  chk('downloading alone is NOT enough', a2.ok, false);
  chk('it asks for the Files confirmation', /visible in your Files app/.test(a2.errors[0]), true);
  chk('ZERO writes so far', w.box.writes.length, 0);
  w.ctx.p2bToggleBackupConfirmed(true);
  const a3=await w.ctx.p2bApply(PHRASE);
  chk('allowed once confirmed', a3.ok, true);
  chk('exactly one write', w.box.writes.length, 1);
}
{
  const w=world();
  await w.stage();
  const before=frozen(w);
  w.ctx.p2bDownloadBackup();
  chk('creating the backup changes neither source', frozen(w), before);
  const op=w.ctx._p2b||null;
  chk('the backup is held in memory', typeof w.ctx.p2bRedownloadBackup, 'function');
  w.ctx.p2bToggleBackupConfirmed(true);
  w.ctx.p2bToggleBackupConfirmed(false);
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('un-ticking the box blocks the write again', ap.ok, false);
  chk('ZERO writes', w.box.writes.length, 0);
}

R.section('=== 7. ORDER-INDEPENDENT VERIFICATION ===');
{
  const w=world();
  chk('canonical form ignores key order',
      w.ctx.p2bCanon({b:1,a:{d:2,c:[1,{f:1,e:2}]}}), w.ctx.p2bCanon({a:{c:[1,{e:2,f:1}],d:2},b:1}));
  chk('but not values', w.ctx.p2bSameDeep({a:1},{a:2}), false);
  chk('and not array order', w.ctx.p2bSameDeep({a:[1,2]},{a:[2,1]}), false);
  chk('null and missing are the same', w.ctx.p2bSameDeep({a:null},{a:undefined}), true);
  chk('JSON.stringify would have disagreed',
      JSON.stringify({b:1,a:2})===JSON.stringify({a:2,b:1}), false);
}
{
  // The POST-WRITE read returns the same document with its keys in a different
  // order, exactly as a jsonb round-trip can. JSON.stringify equality would have
  // called that a mismatch; the canonical comparison must not.
  const w=world({reorderKeysOnRead:true});
  await w.ready();
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('reordered keys still verify', ap.ok, true);
  chk('verification reported no failures', ap.verification.failures, []);
  chk('exactly one write', w.box.writes.length, 1);
  const reordered={}; Object.keys(w.box.writes[0]).sort().reverse().forEach(k=>{reordered[k]=w.box.writes[0][k];});
  chk('and the key order really was different on the way back',
      JSON.stringify(Object.keys(reordered))!==JSON.stringify(Object.keys(w.box.writes[0])), true);
  chk('which JSON.stringify would have called a mismatch',
      JSON.stringify(reordered)!==JSON.stringify(w.box.writes[0]), true);
  chk('but the canonical comparison does not', w.ctx.p2bSameDeep(reordered,w.box.writes[0]), true);
}

R.section('=== 8. POST-WRITE VERIFICATION FAILURES ===');
const CORRUPTIONS=[
  ['a changed show', c=>{c.shows[0].boothCost=99999;return c;}],
  ['a removed show', c=>{c.shows.pop();return c;}],
  ['a stripped marker', c=>{delete c._applied.pop_racine_20260818;return c;}],
  ['a mangled schedule', c=>{c.cogsHistory=[];return c;}],
  ['an unauthorized extra field', c=>{c.sneaky=true;return c;}]
];
for(const [label,fn] of CORRUPTIONS){
  const w=world({corruptAfterWrite:c=>fn(JSON.parse(JSON.stringify(c)))});
  await w.ready();
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('verification catches '+label, ap.ok, false);
  chk('  and reports a discrepancy for '+label, ap.errors.length>0, true);
  chk('  audit records FAILED for '+label, ap.audit.verification, 'FAILED');
  chk('  no automatic retry after '+label, w.box.writes.length, 1);
  chk('  the receipt points at the backup for '+label, /pre-write backup/i.test(ap.receipt), true);
}

R.section('=== 9. NOTHING IS MODIFIED ===');
{
  const w=world();
  const beforeEach={}; w.box.cloud.shows.forEach(s=>beforeEach[s.id]=JSON.stringify(s));
  const beforeLS=w.store['dd_bs_v7'];
  await w.ready();
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('applied', ap.ok, true);
  let touched=0;
  w.box.cloud.shows.forEach(s=>{ if(beforeEach[s.id]&&beforeEach[s.id]!==JSON.stringify(s))touched++; });
  chk('not one pre-existing cloud show was modified', touched, 0);
  chk('the unknown cloud field survives', w.box.cloud.cloudOnlyMystery, {keep:'me'});
  chk('the pre-existing cloud marker survives', w.box.cloud._applied.old_marker_v1, true);
  chk('inventory untouched', w.box.cloud.inventory, {'32oz':10});
  chk('reps untouched', w.box.cloud.reps.length, 12);
  chk('settings untouched', w.box.cloud.settings, {irsRate:0.7});
  chk('nothing was deleted', w.box.cloud.shows.length>=32, true);
  const b=JSON.parse(beforeLS), a=JSON.parse(w.store['dd_bs_v7']);
  chk('only the audit log was added to the device copy',
      Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])), ['cloudReconAudit']);
  chk('device shows byte-identical', JSON.stringify(a.shows), JSON.stringify(b.shows));
  chk('device _updatedAt not bumped', a._updatedAt, b._updatedAt);
}

R.section('=== 10. THE AUDIT DOES NOT TRIGGER AN ORDINARY SYNC PUSH ===');
{
  const w=world();
  chk('the audit never calls saveS', /saveS\(\)/.test(w.ctx.p2bPersistAudit.toString()), false);
  chk('and never queues a cloud push', /cloudQueuePush/.test(w.ctx.p2bPersistAudit.toString()), false);
  let pushed=0; w.ctx.cloudPush=async()=>{pushed++;};
  await w.ready();
  await w.ctx.p2bApply(PHRASE);
  await new Promise(r=>setTimeout(r,60));
  chk('no full-document push fired', pushed, 0);
  chk('still exactly one cloud write', w.box.writes.length, 1);
  chk('Sync Now is still present and separate', typeof w.ctx.cloudSyncNow, 'function');
  chk('Phase 2B never calls it', /cloudPush|cloudSyncNow/.test(w.ctx.p2bApply.toString()), false);
}

R.section('=== 11. NO MUTATION FROM STAGING, PREVIEW, DOWNLOAD OR CANCEL ===');
{
  const w=world();
  const before=frozen(w);
  await w.stage();
  chk('staging mutates nothing', frozen(w), before);
  w.ctx.p2bDownloadBackup();
  chk('downloading mutates nothing', frozen(w), before);
  w.ctx.p2bToggleBackupConfirmed(true);
  chk('confirming mutates nothing', frozen(w), before);
  w.ctx.p2bClose();
  chk('cancelling mutates nothing', frozen(w), before);
  chk('and nothing is staged afterwards', (await w.ctx.p2bApply(PHRASE)).ok, false);
  chk('zero writes and zero update attempts', [w.box.writes.length,w.box.updateAttempts.length], [0,0]);
}

R.section('=== 12. THE PHRASE ===');
{
  for(const bad of ['','add 8 items to cloud','ADD 8 ITEMS TO CLOUD ',' ADD 8 ITEMS TO CLOUD',
                    'ADD 8 ITEM TO CLOUD','ADD8ITEMSTOCLOUD','ADD 3 ITEMS TO CLOUD','yes']){
    const w=world(); await w.ready();
    const ap=await w.ctx.p2bApply(bad);
    chk('refused: '+JSON.stringify(bad), ap.ok===false&&w.box.writes.length===0, true);
  }
}

R.section('=== 13. WRITE FAILURE ===');
{
  const w=world({failWrite:true}); await w.ready();
  const ap=await w.ctx.p2bApply(PHRASE);
  chk('reported as a failure', ap.ok, false);
  chk('the cloud is untouched', w.box.cloud.shows.length, 32);
  chk('no write recorded', w.box.writes.length, 0);
  const ap2=await w.ctx.p2bApply(PHRASE);
  chk('no automatic retry', ap2.ok, false);
  chk('still no write', w.box.writes.length, 0);
}

R.done();
})();
