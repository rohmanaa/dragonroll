/* Tes rig karakter bersama: semua item gear x 2 gender terbangun tanpa error (three.js asli di Node, kanvas palsu). */
const fs=require('fs'),vm=require('vm'),assert=require('assert');process.chdir(require('path').join(__dirname,'..'));
const ctx2d=new Proxy({}, {get:(t,k)=>k in t?t[k]:()=>{}, set:(t,k,v)=>{t[k]=v;return true}});
const sandbox={console, Math, JSON, Object, Array, Date, Number, String, Error, Promise, setTimeout, clearTimeout, Uint8Array, Float32Array, Uint16Array, Uint32Array, Int32Array, ArrayBuffer, DataView, Map, Set, WeakMap, Symbol, Infinity, NaN, parseFloat, parseInt, isNaN, RegExp, Boolean, Function};
sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
sandbox.document={createElement:()=>({width:0,height:0,getContext:()=>ctx2d,style:{},addEventListener(){}}),createElementNS:()=>({style:{},getContext:()=>ctx2d}) };
sandbox.devicePixelRatio=1; sandbox.navigator={userAgent:'node'}; sandbox.localStorage={getItem(){return null},setItem(){},removeItem(){}};
sandbox.addEventListener=()=>{}; sandbox.removeEventListener=()=>{};
vm.createContext(sandbox);
const load=f=>vm.runInContext(fs.readFileSync(f,'utf8'),sandbox,{filename:f});
load('assets/js/vendor/three.min.js');
load('assets/js/item-catalog.js');
const THREE=sandbox.THREE; console.log('THREE', THREE.REVISION, 'ItemCatalog', !!sandbox.ItemCatalog);
load('assets/js/character-rig.js');
const R=sandbox.UT.CharacterRig.create(THREE,{});
const cnt=g=>{let n=0;g.traverse(o=>{if(o.isMesh)n++});return n};
console.log('default meshes', cnt(R.root));
// semua gear dari katalog, kedua gender
const IC=sandbox.ItemCatalog; const gear=IC.items.filter(i=>i.kind==='gear');
console.log('gear items in catalog', gear.length);
const looks=[{gender:'m',skin:'s1',eyes:{id:'round',dye:'blue'},hair:{id:'short',dye:'brown'},body:{height:1,build:1}},
             {gender:'f',skin:'s4',eyes:{id:'lash',dye:'green'},hair:{id:'bob',dye:'pink'},body:{height:1.05,build:0.95}}];
let ok=0,bad=[];
looks.forEach(look=>{
  const eq={}, dye={};
  
  // pasang satu per satu supaya tiap item terbangun sedikitnya sekali
  gear.forEach(it=>{
    const a={look,equipped:{[it.slot]:it.id},gearDye:{[it.id]:'red'}};
    try{R.setAppearance(a);R.update(0.016);ok++}catch(e){bad.push([it.id,e.message])}
  });
  // semua slot sekaligus
  const all={};gear.forEach(it=>{all[it.slot]=it.id});
  try{R.setAppearance({look,equipped:all,gearDye:{}});R.update(0.016);ok++}catch(e){bad.push(['ALL',e.message])}
});
console.log('built',ok,'fail',bad.length,bad.slice(0,5));
['idle','wave','dance','victory','cheer','laugh','celebrate'].forEach(em=>{R.setEmote(em);for(let i=0;i<30;i++)R.update(0.033);});
['walk','run','pose1','pose2','pose3'].forEach(m=>{R.setMode(m);for(let i=0;i<20;i++)R.update(0.033);});
console.log('anim ok; meshes now', cnt(R.root), 'cfg.gender', R.config().gender);
R.dispose(); console.log('dispose ok', cnt(R.root));

assert.ok(gear.length>=60,'katalog gear terbaca');assert.strictEqual(bad.length,0,'semua item terbangun: '+JSON.stringify(bad.slice(0,3)));assert.strictEqual(ok,gear.length*2+2);
console.log('rig OK');
