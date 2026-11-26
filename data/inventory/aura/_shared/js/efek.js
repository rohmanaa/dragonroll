/* efek.js — dipindah dari <script> inline (efek.html). Modul 'efek': mandiri/embed = mount otomatis saat skrip dimuat; di shell (play.html) = view sendiri
   (tanpa iframe): renderer pratinjau milik UT.SharedGL (acquire saat mount, release saat unmount),
   navigasi lewat UT.Spa.go, timer/listener/langganan/rAF dilepas lewat env.
   Tampilan = sama dengan halaman Pet (tanpa tab): baris kartu .pc (nama, thumbnail, bar aksi harga/GUNAKAN/LEPAS), ikon mata / badan kartu = pratinjau 3D di modal #pv. */
UT.PageModule.define('efek',function(env){
const $=s=>document.querySelector(s);
const PD=window.PlayerData,IC=window.ItemCatalog,AR=window.ItemArt;
const SV=()=>PD.serverMode(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SET=()=>PD.settings();
const fmt=n=>Number(n).toLocaleString('id-ID');
const fmtPrice=n=>n>=100000?Math.round(n/1000)+'k':n>=1000?(n/1000).toLocaleString('id-ID',{maximumFractionDigits:1})+'k':fmt(n);
const GEM='assets/images/ui/gem-medal-icons/berlian-hijau.webp',KOIN='assets/images/ui/hud/ikon-koin-emas.webp',LOCK='assets/images/ui/white-glyphs/gembok.webp',STAR='assets/images/ui/white-glyphs/bintang-kilau.webp';
const RAR={common:['Biasa','#cfc8ea'],uncommon:['Tidak Biasa','#6fe08a'],rare:['Langka','#4db3e6'],epic:['Epik','#b07cff'],legendary:['Legendaris','#ffd45a'],mythic:['Mitos','#ff6a5e'],divine:['Ilahi','#fff2b0']};
const WMSG={'saldo-kurang':'Coin tidak cukup.','gem-kurang':'Emerald tidak cukup.','sudah-dimiliki':'Item sudah dimiliki.','tidak-tersedia':'Item tidak tersedia.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...'};
/* Efek = Aura karakter (UT.AuraFX). Item katalog kind 'aura' (off:true = takedown); slot 'aura' OPSIONAL: "Tanpa Efek" = PD.unequip('aura'). */
const FX=window.UT&&UT.AuraFX;
const NONE={id:'__none',none:true,name:'Tanpa Efek',rarity:'common',price:0,desc:'Tampil polos tanpa aura.'};
const AU=IC.items.filter(i=>i.kind==='aura'&&!i.off&&(!FX||FX.AURAS.some(a=>a.id===i.gameKey)));
const FR=[NONE].concat(AU);
const isOwned=i=>i.none||PD.owns(i.id),isUsed=i=>i.none?!PD.equippedId('aura'):PD.isEquipped(i.id);
const canSell=i=>!!i&&!i.none&&((typeof i.price==='number'&&i.price>0)||(typeof i.gems==='number'&&i.gems>0))&&!i.starter;
const art=i=>i.none?'<img class="nonestar" src="'+STAR+'" alt="">':AR.aura(i.id);
let sel=null;
const buzz=()=>{try{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)}catch(e){}};
const snd=n=>{try{if(SET().sound)UT.Audio.play(n||'button')}catch(e){}};
const MANAGED=!!(UT.PageModule&&UT.PageModule.managed);
let tt;function toast(m){if(env.disposed)return;const t=$('#toast');t.textContent=m;t.classList.add('on');env.clearTimeout(tt);tt=env.setTimeout(()=>t.classList.remove('on'),1900)}
/* di shell semua target lewat UT.Spa.go; mandiri/embed: fade 330 ms lalu pindah halaman biasa */
const nav=u=>{if(MANAGED&&UT.Spa&&UT.Spa.go){UT.Spa.go(u);return}$('#fade').classList.add('on');env.setTimeout(()=>{location.href=u},330)};

/* ---- dompet ---- */
function showWallet(bump){
  if(env.disposed)return;
  const ok=PD.walletReady();
  $('#v-em').textContent=ok?fmt(PD.gems()):'—';$('#v-co').textContent=ok?fmt(PD.coins()):'—';
  if(bump){const e=$('#cur-co');e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')}
}

/* ---- preview 3D: karakter pemain (BlockyCharacter, tampilan/outfit akun) + AuraSystem; ganti aura = setAura ---- */
const FXSCALE=2.5,CY=3.2,DIST=16,FOV=36,LOOK_UP=1.1; /* LOOK_UP: titik bidik dinaikkan => karakter + aura turun di kanvas (ujung atas aura tinggi spt Celestial tidak terpotong) */
const GL_OWNER='inv-efek';
let R=null,gl=!!(typeof THREE!=='undefined'&&FX&&window.UT&&UT.BlockyCharacter);
const fxQ=()=>{const g=SET().graphics;return g==='ultra'?'ultra':g==='high'?FX.detectQuality():g==='normal'?'medium':'low'};
function rigInit(){
  if(R||!gl)return;
  try{
    const host=$('#fpv');host.innerHTML='';
    /* renderer + kanvas = milik UT.SharedGL (satu per sesi); kanvas bersama dipasang di host, dilepas saat unmount */
    const acquired=UT.SharedGL.acquire(GL_OWNER,{shadows:false}),r=acquired.renderer,cv=acquired.canvas;host.appendChild(cv);
    const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(FOV,1,.1,100);
    scene.add(new THREE.AmbientLight(0xffffff,.7),new THREE.HemisphereLight(0xcfeaff,0x6a9a50,.6));
    const sun=new THREE.DirectionalLight(0xfff2d8,.9);sun.position.set(6,12,8);scene.add(sun);
    const holder=new THREE.Group();scene.add(holder);
    R={r,scene,cam,holder,cv,host,rot:0,vel:0,drag:false,lx:0,fx:null,moved:0};
    /* kanvas bersama dipakai ulang antar halaman: semua listener dilepas saat unmount */
    const ls=[],on=(t,ev,fn)=>{t.addEventListener(ev,fn);ls.push(()=>t.removeEventListener(ev,fn))};
    on(cv,'pointerdown',e=>{R.drag=true;R.moved=0;R.lx=e.clientX;try{cv.setPointerCapture(e.pointerId)}catch(_){}});
    on(cv,'pointermove',e=>{if(R.drag){R.vel=(e.clientX-R.lx)*.012;R.rot+=R.vel;R.moved+=Math.abs(e.clientX-R.lx);R.lx=e.clientX}});
    const up=()=>{R.drag=false};on(cv,'pointerup',up);on(cv,'pointercancel',up);
    /* ketuk (bukan geser) = aura melompat/bereaksi */
    on(cv,'click',()=>{if(R.moved<6&&R.fx&&R.fx.aura)try{R.fx.aura.jump()}catch(e){}});
    const ro=new ResizeObserver(fitRig);ro.observe(host);fitRig();env.requestAnimationFrame(loop);
    env.own(()=>{
      ls.forEach(f=>f());try{ro.disconnect()}catch(e){}
      try{if(R&&R.fx)R.fx.sys.dispose()}catch(e){}
      try{if(R)R.scene.traverse(o=>{try{if(o.geometry)o.geometry.dispose()}catch(_){}if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{try{if(m.map)m.map.dispose();m.dispose()}catch(_){}})})}catch(e){}
      try{UT.SharedGL.release(GL_OWNER)}catch(e){}
      R=null;
    });
  }catch(e){gl=false;R=null;try{UT.SharedGL.release(GL_OWNER)}catch(_){}console.warn('WebGL tidak tersedia',e)}
}
function fitRig(){
  if(!R)return;const w=R.host.clientWidth,h=R.host.clientHeight;if(!w||!h)return;
  R.r.setPixelRatio(SET().graphics==='ultra'?Math.min(devicePixelRatio||1,2):SET().graphics==='high'?Math.min(devicePixelRatio||1,1.5):1);R.r.setSize(w,h,false);
  R.cam.aspect=w/h;R.cam.fov=FOV*(w/h<.8?1.15:1);R.cam.updateProjectionMatrix();
}
function clearChar(){
  if(!R||!R.fx)return;
  try{R.fx.sys.dispose()}catch(e){}
  R.holder.remove(R.fx.w);R.fx=null;
}
function buildChar(){
  clearChar();
  const ch=UT.BlockyCharacter.create(THREE);ch.loadFromPlayer();ch.setMode('idle');ch.tick(.016); /* pose rig baru terpasang setelah tick pertama: ukur telapak kaki SETELAH itu */
  const w=new THREE.Group();w.scale.setScalar(FXSCALE);w.add(ch.root);R.holder.add(w);
  R.scene.updateMatrixWorld(true);
  const bb=new THREE.Box3().setFromObject(ch.root),hh=bb.max.y-bb.min.y;w.position.y+=.14-bb.min.y;R.scene.updateMatrixWorld(true);
  const sys=new FX.AuraSystem(R.scene,R.cam,{quality:fxQ()});
  R.fx={ch,w,sys,aura:null,height:hh>.1?hh:ch.height()*FXSCALE,id:null};
}
function setAura(id){
  if(!R)return;if(!R.fx)buildChar();
  const f=R.fx;if(f.id===id)return;
  if(!id){if(f.aura){try{f.aura.despawn()}catch(e){}f.aura=null}f.id=null;return}
  if(f.aura)f.aura.setAura(id);else f.aura=f.sys.attach(f.ch.root,id,{},{height:f.height});
  f.id=id;
}
let lastT=0;
function loop(now){
  if(env.disposed)return;
  env.requestAnimationFrame(loop);
  if(!R||!R.fx||!R.host.offsetParent)return;
  const t=(now||0)/1000,dt=Math.min(.05,Math.max(0,t-lastT));lastT=t;
  if(!R.drag){R.vel*=.95;R.rot+=R.vel+.004}
  R.holder.rotation.y=R.rot;
  R.fx.ch.tick(dt);R.fx.sys.update(dt);
  R.cam.position.set(0,CY+LOOK_UP+1,DIST);R.cam.lookAt(0,CY+LOOK_UP,0);R.r.render(R.scene,R.cam);
}
function syncPreview(){
  if(!sel)return;
  if(R){setAura(sel.none?null:sel.gameKey);return}
  $('#fpv').innerHTML='<div class="fb3d">'+(sel.none?'<img src="'+STAR+'" alt="" style="width:40%;opacity:.8">':AR.aura(sel.id))+'</div>'; /* cadangan tanpa WebGL */
}

/* ---- gambar ulang ---- */
function pickDefault(){
  if(sel&&FR.includes(sel))return;
  sel=FR.find(x=>!x.none&&isUsed(x))||NONE;
}
const IC_GEM=GEM,IC_COIN=KOIN;
const EYE_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="#fff"/></svg>';
/* bar bawah kartu = tombol aksi: harga (belum dimiliki) -> beli; GUNAKAN / LEPAS (dimiliki); "Tanpa Efek" yang aktif = DIPAKAI */
function actionBar(f,m,on,sell){
  if(on&&f.none)return '<button class="pc-pr no ut-gl ut-c-d" type="button" disabled>DIPAKAI</button>';
  if(on)return '<button class="pc-pr used ut-gl ut-c-r" type="button" data-act="use">LEPAS</button>';
  if(m)return '<button class="pc-pr own ut-gl ut-c-g" type="button" data-act="use">GUNAKAN</button>';
  if(!sell)return '<button class="pc-pr no ut-gl ut-c-d" type="button" disabled>TIDAK DIJUAL</button>';
  const gems=f.gems>0;
  return '<button class="pc-pr ut-gl ut-c-y" type="button" data-act="use"><b>'+fmtPrice(gems?f.gems:f.price)+'</b><img src="'+(gems?IC_GEM:IC_COIN)+'" alt=""></button>';
}
/* Grid hanya dibangun ulang bila isinya berubah (dimiliki / dipakai / harga); penanda pilihan (.sel) dipasang terpisah */
let lastGridHtml='';
function drawGrid(){
  const html=FR.map(x=>{
    const m=isOwned(x),on=isUsed(x),sell=canSell(x);
    const rar=RAR[x.rarity]?x.rarity:'common';
    const state=on?'dipakai':m?'dimiliki':sell?'beli '+fmtPrice(x.gems>0?x.gems:x.price):'tidak dijual';
    const check=on?'<img class="ck" src="assets/images/ui/white-glyphs/centang.webp" alt="">':'';
    return '<article class="pc r-'+rar+(m?' own':'')+(on?' used':'')+'" data-id="'+x.id+'"><div class="pc-sel">'
      +'<div class="pc-top" role="group" aria-label="'+x.name+(x.none?'':', '+RAR[rar][0])+', '+state+'">'
      +'<span class="pc-nm">'+x.name+'</span>'
      +'<span class="pc-th">'+art(x)+check+'</span></div>'
      +actionBar(x,m,on,sell)+'</div>'
      +'<button class="pc-ic pc-eye ut-gl ut-c-b" type="button" data-act="preview" aria-label="Pratinjau '+x.name+'" title="Pratinjau">'+EYE_SVG+'</button>'
      +'</article>';
  }).join('');
  if(html!==lastGridHtml){$('#grid').innerHTML=html;lastGridHtml=html}
  markSelected();
}
function markSelected(){
  const id=sel&&sel.id;
  $('#grid').querySelectorAll('.pc').forEach(c=>c.classList.toggle('sel',c.dataset.id===id));
}
function draw(){
  if(env.disposed)return;
  pickDefault();
  drawGrid();
  updatePreview();
  showWallet();
}
/* isi modal pratinjau + aura terpilih di karakter 3D (tanpa membangun ulang grid) */
function updatePreview(){
  if(env.disposed||!sel)return;
  const f=sel,r=RAR[f.rarity]||RAR.common;
  $('#nm').textContent=f.name;
  $('#rar').textContent=f.none?'':r[0];$('#rar').style.color=r[1];
  syncPreview();
}
const previewOpen=()=>$('#pv').classList.contains('on');
function openPreview(){
  $('#pv').classList.add('on');$('#pv').setAttribute('aria-hidden','false');
  updatePreview();fitRig();
  try{$('#pvClose').focus({preventScroll:true})}catch(e){}
}
function closePreview(){
  $('#pv').classList.remove('on');$('#pv').setAttribute('aria-hidden','true');
}
function buySelected(f){
  if(!PD.walletReady()){toast('Menunggu saldo dari server...');return}
  const coins=PD.coins();
  if(f.gems>0){
    const gems=PD.gems();
    if(gems<f.gems)modal('Emerald tidak cukup',`Kamu butuh ${fmt(f.gems-gems)} Emerald lagi.<br>Saldo kamu ${fmt(gems)} Emerald.`,'TUTUP','DAPATKAN EMERALD',()=>nav('tambang.html?from=efek.html'));
    else modal('Konfirmasi',`Beli ${f.name}<br>seharga ${fmt(f.gems)} Emerald?`,'BATAL','BELI',()=>buy(f));
    return;
  }
  if(coins<f.price)modal('Coin tidak cukup',`Kamu butuh ${fmt(f.price-coins)} Coin lagi.<br>Saldo kamu ${fmt(coins)} Coin.`,'TUTUP','DAPATKAN COIN',()=>nav('shop.html?coin=1'));
  else modal('Konfirmasi',`Beli ${f.name}<br>seharga ${fmt(f.price)} Coin?`,'BATAL','BELI',()=>buy(f));
}
/* ketuk bar bawah = beli / pakai / lepas; ikon mata ATAU badan kartu = pratinjau 3D (modal) */
$('#grid').onclick=e=>{
  const c=e.target.closest('.pc');if(!c)return;
  const f=FR.find(x=>x.id===c.dataset.id);if(!f)return;
  const btn=e.target.closest('[data-act]'),act=btn?btn.dataset.act:'preview';
  sel=f;snd('button');
  if(act==='use'){runAction(f);return}
  markSelected();openPreview();
};
/* geser baris kartu: roda mouse (vertikal/horizontal) -> ke samping; seret dengan mouse / jari / pena + momentum.
   Kanvas 1920x1080 diskalakan (transform), jadi 1px layar = 1/k px scrollLeft (k dihitung dari ukuran tampil grid). Ketukan biasa tetap = klik kartu. */
(function(){
  const g=$('#grid');if(!g)return;
  const sc=()=>{const w=g.offsetWidth,r=g.getBoundingClientRect();return w&&r.width?r.width/w:1};
  g.style.touchAction='none'; /* seret ditangani sendiri di bawah (touch-action:pan-x bawaan tidak menggeser di dalam kanvas berskala) */
  g.addEventListener('wheel',e=>{
    if(g.scrollWidth<=g.clientWidth)return;
    const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!d)return;
    e.preventDefault();g.scrollLeft+=d*(e.deltaMode===1?32:1)/sc();
  },{passive:false});
  let drag=null,dragged=false,fling=0,raf=0;
  const stopFling=()=>{fling=0;if(raf){env.cancelAnimationFrame(raf);raf=0}};
  g.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    stopFling();drag={id:e.pointerId,x:e.clientX,left:g.scrollLeft,moving:false,lx:e.clientX,lt:performance.now(),v:0};
  });
  g.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const k=sc(),dx=(e.clientX-drag.x)/k;
    if(!drag.moving){
      if(Math.abs(dx)<6)return;
      drag.moving=true;g.classList.add('drag');
      try{g.setPointerCapture(e.pointerId)}catch(_){}
    }
    const now=performance.now(),dt=Math.max(1,now-drag.lt);
    drag.v=.8*drag.v+.2*((drag.lx-e.clientX)/k/dt*16); /* px scrollLeft per frame (16ms) */
    drag.lx=e.clientX;drag.lt=now;
    g.scrollLeft=drag.left-dx;
  });
  function end(e){
    if(!drag||e.pointerId!==drag.id)return;
    if(drag.moving){
      dragged=true;env.setTimeout(()=>{dragged=false},0);
      try{g.releasePointerCapture(e.pointerId)}catch(_){}
      if(e.type==='pointerup'&&performance.now()-drag.lt<80&&Math.abs(drag.v)>1){ /* lepas sambil bergerak = momentum */
        fling=drag.v;
        const step=()=>{fling*=.95;g.scrollLeft+=fling;if(Math.abs(fling)>.4&&!env.disposed)raf=env.requestAnimationFrame(step);else raf=0};
        raf=env.requestAnimationFrame(step);
      }
    }
    g.classList.remove('drag');drag=null;
  }
  g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
  g.addEventListener('dragstart',e=>e.preventDefault());
  g.addEventListener('click',e=>{if(!dragged)return;e.stopPropagation();e.preventDefault()},true); /* seretan bukan ketukan */
})();

/* beli bila belum dimiliki; GUNAKAN bila dimiliki; LEPAS bila sedang dipakai ("Tanpa Efek" = tidak ada aura) */
function runAction(f){
  if(!isOwned(f)){if(canSell(f))buySelected(f);else toast('Efek ini tidak dijual.');return}
  if(isUsed(f)){if(!f.none)equip(NONE);return}
  equip(f);
}

/* ---- modal ---- */
let okFn=null;
function modal(t,x,noL,okL,ok){
  $('#mt').textContent=t;$('#mx').innerHTML=x;
  $('#m-no span').textContent=noL;$('#m-ok span').textContent=okL;
  okFn=ok;$('#md').classList.add('on');
}
const closeM=()=>$('#md').classList.remove('on');
$('#m-no').onclick=closeM;
$('#m-ok').onclick=()=>{closeM();if(okFn)okFn()};
$('#md').onclick=e=>{if(e.target.id==='md')closeM()};
env.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('#md').classList.contains('on'))closeM();else if(previewOpen())closePreview();else nav(backTarget())});
$('#pvClose').onclick=closePreview;
$('#pv').onclick=e=>{if(e.target.id==='pv')closePreview()};

/* ---- aksi: pakai / lepas / beli (beli lewat WalletService/PlayerData; klien tidak mengubah saldo sendiri) ---- */
function equip(f){
  if(f.none){const r=PD.unequip('aura');toast(r&&r.ok?'Efek dilepas.':'Gagal melepas efek.');snd('button');draw();return}
  const r=PD.equip(f.id);
  if(r&&r.ok){toast(f.name+' dipakai');snd('button');buzz()}else{toast('Gagal memakai item.');snd('button')}
  draw();
}
async function buy(f){
  const r=SV()?await WS().buy(f.id):PD.purchase(f.id);
  if(!r||!r.ok){toast(WMSG[r&&r.reason]||'Pembelian gagal.');return}
  snd('power');buzz();toast('Pembelian berhasil!');
  try{PD.equip(f.id)}catch(e){} /* langsung dipakai, sama seperti halaman Karakter */
  showWallet(true);draw();
}
/* ---- navigasi ---- */
/* asal pembuka Efek (lobby / profil) dibaca dari ?from=; di shell URL lengkapnya ada di UT.Spa.current(). Selain daftar putih -> lobby */
function backTarget(){
  let src=location.search;
  try{const c=UT.Spa&&UT.Spa.current&&UT.Spa.current();if(c&&c.url&&c.url.indexOf('?')>=0)src=c.url.slice(c.url.indexOf('?'))}catch(e){}
  const f=new URLSearchParams(src).get('from')||'';
  return /^(lobby|profile)\.html$/.test(f)?f:'lobby.html';
}
$('#back').onclick=()=>{snd('button');nav(backTarget())};
$('#cur-co').onclick=()=>nav('shop.html?coin=1');
$('#cur-em').onclick=()=>nav('tambang.html?from=efek.html');

/* ---- sinkron: event + live-sync (saldo/inventory dari server) ---- */
env.own(UT.Events.on('currencyChanged',()=>showWallet()));
['inventoryChanged','auraChanged'].forEach(n=>env.own(UT.Events.on(n,draw)));
try{env.own(PD.subscribe(r=>{
  if(r==='server-wallet'||r==='storage'||r==='pageshow')showWallet();
  if(r==='server-appearance'||r==='server-outfits'){try{if(R&&!env.disposed){clearChar();syncPreview()}}catch(e){}} /* karakter pratinjau = tampilan aktif akun di server */
}))}catch(e){}
if(UT.LiveSync){UT.LiveSync.add('wallet',()=>UT.WalletService.get().refresh());UT.LiveSync.start({interval:20000});env.own(()=>{UT.LiveSync.remove('wallet');UT.LiveSync.stop()})}
if(SV()&&WS())WS().refresh().then(r=>{if(r&&r.ok){showWallet();draw()}});
try{const A=SV()&&UT.AppearanceService&&UT.AppearanceService.get();if(A)A.refreshThrottled().catch(()=>{})}catch(e){}

/* skala kanvas 1920x1080 + sisa layar di luar kanvas (--hub-ex/--hub-ey) agar bingkai #pmodal penuh sampai tepi layar (sama dengan Pet) */
function fit(){
  const k=Math.min(innerWidth/1920,innerHeight/1080)||1,st=$('#stage');
  st.style.transform='scale('+k+')';
  st.style.setProperty('--hub-ex',Math.max(0,(innerWidth/k-1920)/2).toFixed(1)+'px');
  st.style.setProperty('--hub-ey',Math.max(0,(innerHeight/k-1080)/2).toFixed(1)+'px');
}
/* transparansi panel (Pengaturan, Prefs 'panelTransparency'): 0% pekat .. 70%; bawaan 16% */
function applyPanelAlpha(){
  try{let t=parseInt(UT.Prefs.get('panelTransparency',16),10);if(!isFinite(t))t=16;document.documentElement.style.setProperty('--panel-a',(1-Math.max(0,Math.min(70,t))/100).toFixed(2))}catch(e){}
}
applyPanelAlpha();
try{if(UT.Prefs&&UT.Prefs.on)env.own(UT.Prefs.on(n=>{if(n==='panelTransparency')applyPanelAlpha()}))}catch(e){}
env.addEventListener('resize',fit);fit();
rigInit();draw();
document.documentElement.classList.add('ut-ready');
});
