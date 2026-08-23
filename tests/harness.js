// Minimal test harness for BEST_SOLUTION_APP.html.
//
// The app is one HTML file with no build step, so there is nothing to import.
// This extracts the inline scripts, runs them in a Node vm with a stub DOM, and
// hands back the sandbox so tests can call the app's own functions directly.
//
// Top-level `let` and `const` bindings live in a script's lexical scope and are
// not reachable from the sandbox object, so this throwaway copy promotes the
// column-0 declarations to `var`. The app file itself is never modified.
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');

const APP=path.join(__dirname,'..','BEST_SOLUTION_APP.html');

function el(){return{innerHTML:'',textContent:'',style:{},value:'',checked:false,dataset:{},children:[],
  classList:{add(){},remove(){},toggle(){},contains:()=>false},
  querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},removeChild(){},remove(){},
  insertAdjacentHTML(){},setAttribute(){},getAttribute:()=>null,addEventListener(){},
  focus(){},click(){},scrollIntoView(){}};}

// `seed` pre-populates localStorage before the app's scripts run, so a test can
// simulate a page refresh that finds a value already on the device.
function boot(seed){
  const html=fs.readFileSync(APP,'utf8');
  let js=''; const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m;
  while((m=re.exec(html)))js+=m[1]+'\n';
  js=js.replace(/^let /gm,'var ').replace(/^const /gm,'var ');
  const store={}; if(seed)Object.keys(seed).forEach(k=>{store[k]=String(seed[k]);});
  const ctx={console:{log(){},warn(){},error(){}},TextEncoder,TextDecoder,URL,
    Blob:class{constructor(a){this.a=a;}},
    localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},
      removeItem:k=>{delete store[k];},get length(){return Object.keys(store).length;},
      key:i=>Object.keys(store)[i]||null},
    document:{addEventListener(){},getElementById:el,querySelectorAll:()=>[],querySelector:()=>null,
      body:{style:{},appendChild(){},removeChild(){}},createElement:el},
    window:{addEventListener(){},location:{href:'',hash:''},
      matchMedia:()=>({matches:false,addEventListener(){}})},
    navigator:{userAgent:'node',onLine:true},
    setTimeout,setInterval:()=>0,clearTimeout,clearInterval,
    fetch:()=>Promise.reject(new Error('network is disabled in tests')),
    alert(){},confirm:()=>false,prompt:()=>null};
  ctx.globalThis=ctx; ctx.self=ctx; vm.createContext(ctx);
  let bootError=null;
  try{ vm.runInContext(js,ctx); }catch(e){ bootError=e; }
  return {ctx,store,el,run:src=>vm.runInContext(src,ctx),bootError};
}

function reporter(){
  let pass=0,fail=0; const failures=[];
  const short=v=>{const j=JSON.stringify(v);return (j&&j.length>90)?j.slice(0,80)+'…':j;};
  return {
    check(name,got,want){
      const ok=JSON.stringify(got)===JSON.stringify(want);
      if(ok)pass++; else {fail++; failures.push(name);}
      console.log((ok?'  PASS  ':'  FAIL  ')+name+'   got='+short(got)+(ok?'':'  want='+short(want)));
    },
    section(t){ console.log('\n'+t); },
    done(){
      console.log('\n'+(fail?('FAILED '+fail+' of '+(pass+fail)):('ALL '+pass+' CHECKS PASS')));
      if(fail)failures.forEach(f=>console.log('    failed: '+f));
      process.exit(fail?1:0);
    }
  };
}
module.exports={boot,reporter,el,APP};
