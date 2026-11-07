/* Stage 4.1.25 — harness uji Auto Roll Ownership (Node, tanpa dependensi). HANYA verifikasi; TIDAK dimuat game.
   Menjalankan: node audit/4/stage-4.1.25-harness.js
   Kode yang diuji = blok Auto Roll ASLI yang diekstrak dari game/gameplay.html (bukan salinan), dengan stub DOM/doRoll.
   Batas: ini BUKAN browser test; render, klik nyata, dan animasi 3D tidak dijalankan. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'..','..','gameplay.html'),'utf8');
const a=html.indexOf('/* Auto roll (4.1.25 ownership)'),b=html.indexOf("$('btnCam').addEventListener");
if(a<0||b<0) throw new Error('blok Auto Roll tidak ditemukan');
const block=html.slice(a,b);
let pass=0,fail=0; const ok=(c,n)=>{ c?pass++:fail++; console.log((c?'  ok   ':'  FAIL ')+n); };

function make(opts){
  opts=opts||{}; const store=new Map(Object.entries(opts.storage||{})); let tick=null,now=0,rolls=0;
  const el={disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(e,f){this.click=f;}};
  const roll={disabled:false};
  const S={players:opts.players||[{idx:0,cpu:false},{idx:1,cpu:true}],cur:0,busy:false,paused:false,gameOver:false,gameId:1};
  const ctx={ $:id=>id==='btnAuto'?el:roll, document:{getElementById:()=>null}, AWK:{running:false}, DH:{on:false},
    ensureAudio(){}, fb(){}, performance:{now:()=>now}, setInterval:f=>{tick=f;}, localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},
    doRoll(){ if(S.busy) return; S.busy=true; roll.disabled=true; rolls++; } };
  const vars=['players','cur','busy','paused','gameOver','gameId'];
  const src=vars.map(v=>`Object.defineProperty(globalThis,'${v}',{get:()=>S.${v},set:x=>{S.${v}=x},configurable:true});`).join('')+block+';globalThis.__api={get autoRoll(){return autoRoll}};';
  ctx.S=S; vm.createContext(ctx); vm.runInContext(src,ctx);
  return {S,el,roll,store,api:ctx.__api,run(ms,step){ for(let t=0;t<ms;t+=(step||150)){ now+=(step||150); tick(); } },get rolls(){return rolls;},ctx};
}
const click=h=>h.el.click();

console.log('\n## Giliran lokal');
let h=make(); h.run(150); ok(h.el.disabled===false,'tombol aktif di giliran pemain lokal');
click(h); ok(h.api.autoRoll===true&&h.el.attrs['aria-pressed']==='true','toggle ON'); ok(h.store.get('ut-autoroll')==='1','ON tersimpan');
h.run(3000,150); ok(h.rolls===1,'roll tepat 1x setelah jeda (rolls='+h.rolls+')');
ok(h.run(5000)===undefined&&h.rolls===1,'tidak double roll selama busy (animasi/rolling)');

console.log('\n## Giliran CPU / pemain lain');
h=make({storage:{'ut-autoroll':'1'}}); ok(h.api.autoRoll===true,'status ON dipulihkan dari storage');
h.S.cur=1; h.run(5000); ok(h.el.disabled===true,'disabled saat giliran CPU'); ok(h.rolls===0,'tidak roll di giliran CPU'); ok(h.el.attrs['aria-pressed']==='true','status ON tetap tersimpan/terlihat');
click(h); ok(h.store.get('ut-autoroll')==='1'&&h.api.autoRoll===true,'klik saat disabled tidak mengubah status');
h=make({players:[{idx:0,cpu:false},{idx:1,cpu:false}],storage:{'ut-autoroll':'1'}}); h.S.cur=1; h.run(5000);
ok(h.el.disabled===true&&h.rolls===0,'pemain manusia lain (idx 1) tidak di-auto-roll');
h.S.cur=0; h.S.busy=false; h.roll.disabled=false; h.run(3000); ok(h.rolls===1,'kembali ke giliran lokal -> roll 1x');

console.log('\n## Guard lain');
for(const [k,v] of [['busy',true],['paused',true],['gameOver',true]]){ h=make({storage:{'ut-autoroll':'1'}}); h.S[k]=v; h.run(4000); ok(h.rolls===0,'tidak roll saat '+k); }
h=make({storage:{'ut-autoroll':'1'}}); h.S.gameOver=true; h.run(300); ok(h.el.disabled===true,'disabled saat game selesai');
h=make({storage:{'ut-autoroll':'1'}}); h.roll.disabled=true; h.run(4000); ok(h.rolls===0,'tidak roll saat tombol Roll disabled');
h=make({storage:{'ut-autoroll':'1'}}); h.run(600); h.S.gameId=2; h.run(450); ok(h.rolls===0,'game baru mereset penghitung jeda');
h=make(); h.S.cur=1; h.ctx.eval; click(h); ok(h.api.autoRoll===false,'toggle ditolak saat bukan giliran lokal');
h=make({storage:{'ut-autoroll':'1'}}); click(h); ok(h.api.autoRoll===false&&h.store.get('ut-autoroll')==='0','toggle OFF tersimpan'); h.run(4000); ok(h.rolls===0,'OFF -> tidak roll');
console.log('\nHASIL: '+pass+' pass, '+fail+' fail'); process.exit(fail?1:0);
