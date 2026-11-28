/* powerup.js â€” dipindah dari <script> inline (powerup.html). */
(()=>{
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
function fit(){const k=Math.min(innerWidth/1920,innerHeight/1080);$('#stage').style.transform='scale('+k+')';document.documentElement.style.setProperty('--k',k)}addEventListener('resize',fit);fit();
// ---- data: inventory BUKAN database sendiri. Item & kepemilikan dibaca dari ItemCatalog + PlayerData.
const PD=window.PlayerData,IC=window.ItemCatalog,AR=window.ItemArt;
const SV=()=>PD.serverMode(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();   /* akun login + flag = dompet server */
const RN={common:'Biasa',rare:'Langka',epic:'Epik',legendary:'Legendaris'},RC={common:'#cfc8ea',rare:'#4db3e6',epic:'#b07cff',legendary:'#ffd45a'};
const KINDS=['powerup'];   /* halaman ini hanya Power-up */
const CI={};KINDS.forEach(k=>CI[k]=IC.items.filter(i=>i.kind===k&&!i.off)); /* off:true = takedown sementara (item-catalog.js) */
let LIST=[]; /* hanya Power yang dimiliki (stok > 0): diisi ulang di refresh() */
const SET=()=>PD.settings();
/* Efek visual Power (data/power/power-fx.js): partikel keluar saat Power dipilih/dilihat; catatan efek ikut tampil di deskripsi. Modul tak termuat -> dilewati. */
const PFX={at(i,el){try{if(P3D.on())return;if(i&&i.kind==='powerup'&&window.UT&&UT.PowerFX)UT.PowerFX.playAtElement(i.gameKey,el||$('#fpv'))}catch(e){}},
 note(i){try{const fx=window.UT&&UT.PowerFX,d=i&&i.kind==='powerup'&&fx&&fx.DATA[fx.keyFor(i.gameKey)];return d?' Efek: '+d.note+'.':''}catch(e){return''}}};
const canSell=i=>!!i&&typeof i.price==='number'&&i.price>0&&!i.starter;
const qty=i=>PD.qty(i.id);
const COIN='<img src="assets/images/ui/hud/ikon-koin-emas.webp" alt="">';
const fmtPrice=n=>n>=100000?Math.round(n/1000)+'k':n>=1000?(n/1000).toLocaleString('id-ID',{maximumFractionDigits:1})+'k':fmt(n);
const SFX={click:'button',select:'button',open:'button',error:'button',coin:'button',purchase:'power',chest:'chest'};
function playSound(n){if(!SET().sound)return;try{UT.Audio.play(SFX[n]||'button')}catch(e){}}
const buzz=()=>{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const WMSG={'jumlah-tidak-valid':'Jumlah tidak valid.','stok-penuh':'Stok sudah penuh (maks. 999).','op-id-tidak-valid':'Pembelian gagal, coba lagi.','saldo-kurang':'Coin tidak cukup.','sudah-dimiliki':'Item sudah dimiliki.','tidak-tersedia':'Item tidak tersedia.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...'};

let sel=null;
const thumb=i=>i.icon?'<img src="'+i.icon+'" alt="">':(AR&&AR.powerup?AR.powerup(i.id):'');

// ---- render
function renderGrid(){
  let html=LIST.map(i=>{
    const k=qty(i);
    return '<button class="fslot ut-slot st-own'+(i===sel?' sel':'')+'" data-id="'+i.id+'" aria-label="'+i.name+' â€” stok Ã—'+k+', ketuk untuk lihat detail"><div class="dc" style="--c:'+RC[i.rarity]+'">'+thumb(i)+'</div><span class="chip-n">'+k+'</span></button>'}).join('');
  html+='<button class="fslot ut-slot add" type="button" data-add aria-label="Tambah Power-up, buka Toko"><span class="pl">+</span></button>';
  $('#grid').innerHTML=html;
  $('#empty').hidden=LIST.length>0;
}
function renderInfo(){
  const i=sel;if(!i)return;
  const c=RC[i.rarity],n=qty(i);
  $('#pa').innerHTML='<div class="dice pw" id="die" style="--c:'+c+'"><i class="ring"></i>'+thumb(i)+'</div>';
  $('#nm').textContent=i.name;
  const r=$('#rar');r.textContent=RN[i.rarity]+' Â· stok Ã—'+n;r.style.color=c;
  $('#ds').textContent=i.desc+(IC.powerMapNote(i.id)?' ['+IC.powerMapNote(i.id)+']':'')+PFX.note(i)+' Stok baru berkurang saat dipakai di pertandingan.';
}
function refresh(){LIST=CI.powerup.filter(i=>qty(i)>0);if(!sel||!LIST.includes(sel))sel=LIST[0]||null;renderGrid();renderInfo();if(!sel&&$('#pv').classList.contains('on'))closePv();P3D.sync()}
function pick(i){
  if(sel===i)return; /* pilihan sama: sudah dirender, modal tinggal dibuka */
  stopNetherStarPreview();
  sel=i;
  renderInfo();P3D.load();P3D.sync();
}
/* ---- modal pratinjau: nama, rarity, deskripsi + pratinjau 3D/2D. Di dalam Inventory (iframe) memberi tahu induk agar judul/tab ikut digelapkan */
function tellParent(open){try{if(parent&&parent!==window)parent.postMessage({type:'ut-inv-modal',open:!!open},'*')}catch(e){}}
function openPv(){$('#pv').classList.add('on');$('#pv').setAttribute('aria-hidden','false');tellParent(true);try{$('#pvClose').focus({preventScroll:true})}catch(e){}}
function closePv(){$('#pv').classList.remove('on');$('#pv').setAttribute('aria-hidden','true');stopNetherStarPreview();tellParent(false)}
$('#pvClose').addEventListener('click',()=>{playSound('click');closePv()});
$('#pv').addEventListener('click',e=>{if(e.target.id==='pv'){playSound('click');closePv()}});
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#pv').classList.contains('on'))closePv()});
$('#grid').addEventListener('click',e=>{
  const c=e.target.closest('.fslot');if(!c)return;
  if(c.hasAttribute('data-add')){playSound('click');nav('shop.html?tab=power');return}
  const i=LIST.find(x=>x.id===c.dataset.id);if(!i)return;
  pick(i);playSound('open');openPv();
});
$('#goShop').addEventListener('click',()=>{playSound('click');nav('shop.html')});

/* ---- pratinjau 3D hidup (src/renderers/power-3d): dimuat malas; gagal/WebGL mati = tampilan 2D (showThemeArt) */
function showThemeArt(on){$('#fpv').classList.toggle('art2d',!!on)}
const hasPreviewObserver=typeof IntersectionObserver==='function';
let previewIntersecting=!hasPreviewObserver;
let netherStarTimers=[],netherStarAudio=[];
function stopNetherStarPreview(){
 netherStarTimers.forEach(id=>{clearTimeout(id);clearInterval(id)});netherStarTimers=[];
 netherStarAudio.forEach(a=>a.pause());netherStarAudio=[];
}
function playNetherStarPreview(){
 stopNetherStarPreview();if(SET().sound===false)return;
 const stages=[['nether-star-activation.mp3',0,400],['nether-star-charge.mp3',350,800],['nether-star-release.mp3',1050,700],['nether-star-finish.mp3',1650,800]];
 const rate=0.85*(0.98+Math.random()*0.04);
 const playStage=(file,duration)=>{
  if(SET().sound===false)return;
  const a=new Audio('assets/audio/sfx/powerup/'+file);a.volume=0.9;a.playbackRate=rate;netherStarAudio.push(a);
  a.addEventListener('error',()=>console.warn('[powerup-audio] gagal memutar '+file),{once:true});
  let result;try{result=a.play()}catch(e){console.warn('[powerup-audio] gagal memutar '+file,e);return}
  if(result&&typeof result.catch==='function')result.catch(e=>console.warn('[powerup-audio] gagal memutar '+file,e));
  netherStarTimers.push(setTimeout(()=>{
   const initial=a.volume,started=Date.now();
   const fade=setInterval(()=>{
    const progress=Math.min(1,(Date.now()-started)/80);a.volume=initial*(1-progress);
    if(progress>=1){clearInterval(fade);a.pause()}
   },20);
   netherStarTimers.push(fade);
  },Math.max(0,duration-80)));
 };
 stages.forEach(([file,delay,duration])=>{
  if(delay===0)playStage(file,duration);
  else netherStarTimers.push(setTimeout(()=>playStage(file,duration),delay));
 });
}
const P3D={inst:null,mod:null,state:0,key:null,visible:previewIntersecting&&!document.hidden,
 off(){$('#fpv').classList.remove('p3d');showThemeArt(true);this.key=null;if(this.inst)this.inst.stop()},
 on(){return !!this.inst&&$('#fpv').classList.contains('p3d')},
 sync(){const i=sel;if(!i||!this.inst||!this.mod.supports(i.gameKey)){this.off();return false}
  if(!this.visible){this.inst.stop();return false}
  if(this.key===i.gameKey&&this.on()){this.inst.start();return true}
  try{this.inst.setSound(false);if(this.inst.show(i.gameKey)){this.key=i.gameKey;$('#fpv').classList.add('p3d');showThemeArt(false);this.inst.start();return true}}catch(e){console.warn('[power3d]',e)}
  this.off();return false},
 activate(){const i=sel,star=!!i&&i.gameKey==='nether_star',sound=SET().sound!==false;
  if(this.inst)this.inst.setSound(sound&&!star,star?0.9:1);
  if(star&&sound)playNetherStarPreview();else stopNetherStarPreview();
  return this.inst?this.inst.activate():false},
 setVisible(visible){if(this.visible===visible)return;this.visible=visible;if(!visible){stopNetherStarPreview();if(this.inst)this.inst.stop();return}if(this.inst)this.sync();else this.load()},
 load(){if(this.state||!this.visible)return;this.state=1;
  import('../../../../../src/renderers/power-3d/power-show.js').then(m=>{this.mod=m;const graphics=SET().graphics,scale=Math.min(innerWidth/1920,innerHeight/1080);const quality=graphics==='low'||scale<.7?'low':(graphics==='high'||graphics==='ultra')?'high':undefined;this.inst=m.mount($('#p3d'),{quality});this.state=2;
   const sh=$('#fpv');let x=0,y=0;sh.addEventListener('pointerdown',e=>{x=e.clientX;y=e.clientY});
   sh.addEventListener('click',e=>{if(this.on()&&Math.hypot(e.clientX-x,e.clientY-y)<6)this.activate()}); /* ketuk = aktifkan; geser = putar */
   this.sync()
  }).catch(e=>{this.state=3;console.warn('[power3d] tidak tersedia, memakai tampilan lama',e)})}};
const previewObserver=hasPreviewObserver?new IntersectionObserver(entries=>{
  const entry=entries.find(item=>item.target===$('#fpv'));
  if(!entry)return;
  previewIntersecting=entry.isIntersecting&&entry.intersectionRatio>0;
  P3D.setVisible(previewIntersecting&&!document.hidden);
}):null;
if(previewObserver)previewObserver.observe($('#fpv'));
document.addEventListener('visibilitychange',()=>P3D.setVisible(previewIntersecting&&!document.hidden));

/* ---- putar efek: 3D bila ada, bila tidak animasi 2D + partikel PowerFX */
let rolling=false;
function roll(){
  if(P3D.on()){P3D.activate();return}
  if(rolling)return;rolling=true;
  if(sel&&sel.gameKey==='nether_star')playNetherStarPreview();
  const d=$('#die');if(d)d.classList.add('burst');
  PFX.at(sel);
  setTimeout(()=>{if(d)d.classList.remove('burst');rolling=false},1000);
}
$('#pa').addEventListener('click',roll);

/* ---- navigasi + sinkron */
$('#back').addEventListener('click',()=>{playSound('click');nav('lobby.html')});
try{if(!window.__curSub){window.__curSub=1;PD.subscribe(r=>{if(r==='server-wallet'||r==='storage')try{refresh()}catch(e){}})}}catch(e){} /* inventory dari server memperbarui daftar */
UT.Events.on('inventoryChanged',refresh);

refresh();if(P3D.visible)P3D.load();
document.documentElement.classList.add('ut-ready');
if(SV()&&WS())WS().refresh().then(r=>{if(r.ok)refresh()}); /* saldo & inventory dari server */
})();

