/* efek.js — dipindah dari <script> inline (efek.html). */
(()=>{
const $=s=>document.querySelector(s);
const PD=window.PlayerData,IC=window.ItemCatalog,AR=window.ItemArt;
const SV=()=>PD.serverMode(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SET=()=>PD.settings();
const fmt=n=>Number(n).toLocaleString('id-ID');
const fmtPrice=n=>n>=100000?Math.round(n/1000)+'k':n>=1000?(n/1000).toLocaleString('id-ID',{maximumFractionDigits:1})+'k':fmt(n);
const GEM='assets/ng/komponen/ikon-gem-medali/berlian-hijau.webp',KOIN='assets/ng/komponen/hud/ikon-koin-emas.webp',LOCK='assets/ng/komponen/glyph-putih/gembok.webp',STAR='assets/ng/komponen/glyph-putih/bintang-kilau.webp';
const RAR={common:['Biasa','#cfc8ea'],uncommon:['Tidak Biasa','#6fe08a'],rare:['Langka','#4db3e6'],epic:['Epik','#b07cff'],legendary:['Legendaris','#ffd45a'],mythic:['Mitos','#ff6a5e'],divine:['Ilahi','#fff2b0']};
const WMSG={'saldo-kurang':'Coin tidak cukup.','gem-kurang':'Emerald tidak cukup.','sudah-dimiliki':'Item sudah dimiliki.','tidak-tersedia':'Item tidak tersedia.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...'};
/* Efek = Aura karakter (UT.AuraFX). Item katalog kind 'aura' (off:true = takedown); slot 'aura' OPSIONAL: "Tanpa Efek" = PD.unequip('aura'). */
const FX=window.UT&&UT.AuraFX;
const NONE={id:'__none',none:true,name:'Tanpa Efek',rarity:'common',price:0,desc:'Tampil polos tanpa aura.'};
const AU=IC.items.filter(i=>i.kind==='aura'&&!i.off&&(!FX||FX.AURAS.some(a=>a.id===i.gameKey)));
const FR=[NONE].concat(AU);
const isOwned=i=>i.none||PD.owns(i.id),isUsed=i=>i.none?!PD.equippedId('aura'):PD.isEquipped(i.id);
const canSell=i=>!!i&&!i.none&&((typeof i.price==='number'&&i.price>0)||(typeof i.gems==='number'&&i.gems>0))&&!i.starter;
const art=i=>i.none?'<img src="'+STAR+'" alt="">':AR.aura(i.id);
let sel=null;
const buzz=()=>{try{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)}catch(e){}};
const snd=n=>{try{if(SET().sound)UT.Audio.play(n||'button')}catch(e){}};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>{location.href=u},330)};

/* ---- dompet ---- */
function showWallet(bump){
  const ok=PD.walletReady();
  $('#v-em').textContent=ok?fmt(PD.gems()):'—';$('#v-co').textContent=ok?fmt(PD.coins()):'—';
  if(bump){const e=$('#cur-co');e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')}
}

/* ---- preview 3D: karakter pemain (BlockyCharacter, tampilan/outfit akun) + AuraSystem; ganti aura = setAura ---- */
const FXSCALE=2.5,CY=3.2,DIST=15,FOV=36;
let R=null,gl=!!(typeof THREE!=='undefined'&&FX&&window.UT&&UT.BlockyCharacter);
const fxQ=()=>SET().graphics==='high'?FX.detectQuality():'low';
function rigInit(){
  if(R||!gl)return;
  try{
    const host=$('#fpv'),cv=document.createElement('canvas');host.innerHTML='';host.appendChild(cv);
    const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
    const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(FOV,1,.1,100);
    scene.add(new THREE.AmbientLight(0xffffff,.7),new THREE.HemisphereLight(0xcfeaff,0x6a9a50,.6));
    const sun=new THREE.DirectionalLight(0xfff2d8,.9);sun.position.set(6,12,8);scene.add(sun);
    const holder=new THREE.Group();scene.add(holder);
    R={r,scene,cam,holder,cv,host,rot:0,vel:0,drag:false,lx:0,fx:null,moved:0};
    cv.addEventListener('pointerdown',e=>{R.drag=true;R.moved=0;R.lx=e.clientX;try{cv.setPointerCapture(e.pointerId)}catch(_){}});
    cv.addEventListener('pointermove',e=>{if(R.drag){R.vel=(e.clientX-R.lx)*.012;R.rot+=R.vel;R.moved+=Math.abs(e.clientX-R.lx);R.lx=e.clientX}});
    const up=()=>{R.drag=false};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    /* ketuk (bukan geser) = aura melompat/bereaksi */
    cv.addEventListener('click',()=>{if(R.moved<6&&R.fx&&R.fx.aura)try{R.fx.aura.jump()}catch(e){}});
    new ResizeObserver(fitRig).observe(host);fitRig();requestAnimationFrame(loop);
  }catch(e){gl=false;R=null;console.warn('WebGL tidak tersedia',e)}
}
function fitRig(){
  if(!R)return;const w=R.host.clientWidth,h=R.host.clientHeight;if(!w||!h)return;
  R.r.setPixelRatio(SET().graphics==='high'?Math.min(devicePixelRatio||1,1.5):1);R.r.setSize(w,h,false);
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
  requestAnimationFrame(loop);
  if(!R||!R.fx||!R.host.offsetParent)return;
  const t=(now||0)/1000,dt=Math.min(.05,Math.max(0,t-lastT));lastT=t;
  if(!R.drag){R.vel*=.95;R.rot+=R.vel+.004}
  R.holder.rotation.y=R.rot;
  R.fx.ch.tick(dt);R.fx.sys.update(dt);
  R.cam.position.set(0,CY+1,DIST);R.cam.lookAt(0,CY,0);R.r.render(R.scene,R.cam);
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
function draw(){
  pickDefault();
  let html=FR.map(x=>{
    const m=isOwned(x),on=isUsed(x),sell=canSell(x),state=m?`<span class="pr ${on?'used':'owned'}"${on?(x.none?'':' data-action="unequip"'):' data-action="equip"'}>${on?'DIPAKAI':'DIMILIKI'}</span>`
      :sell?`<span class="pr buy" data-action="buy"><img src="${x.gems>0?GEM:KOIN}" alt="">${fmtPrice(x.gems>0?x.gems:x.price)}</span>`:`<span class="pr no"><img src="${LOCK}" alt="">TIDAK DIJUAL</span>`;
    const label=on?'dipakai':m?'dimiliki':sell?'beli '+fmtPrice(x.gems>0?x.gems:x.price):'tidak dijual';
    return `<button class="fslot${x===sel?' sel':''}${m?'':' lk'}" data-id="${x.id}" aria-label="${x.name} — ${label}"><div class="th${x.none?' none':''}">${art(x)}</div>${state}</button>`}).join('');
  for(let i=FR.length;i<Math.max(20,Math.ceil(FR.length/5)*5);i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  const f=sel,r=RAR[f.rarity]||RAR.common;
  $('#nm').textContent=f.name;
  $('#rar').textContent=f.none?'':r[0];$('#rar').style.color=r[1];
  $('#ds').textContent=f.desc;
  syncPreview();showWallet();
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
$('#grid').onclick=e=>{
  const c=e.target.closest('.fslot');if(!c)return;
  const f=FR.find(x=>x.id===c.dataset.id);if(!f)return;
  const action=e.target.closest('[data-action]'),act=action&&action.dataset.action;
  sel=f;
  if(act==='buy'){snd('button');draw();buySelected(f);return}
  if(act==='equip'){equip(f);return}
  if(act==='unequip'){equip(NONE);return}
  snd('button');draw();
};

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
addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('#md').classList.contains('on'))closeM();else nav('lobby.html')});

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
$('#back').onclick=()=>{snd('button');nav('lobby.html')};
$('#cur-co').onclick=()=>nav('shop.html?coin=1');
$('#cur-em').onclick=()=>nav('tambang.html?from=efek.html');

/* ---- sinkron: event + live-sync (saldo/inventory dari server) ---- */
UT.Events.on('currencyChanged',()=>showWallet());
['inventoryChanged','auraChanged'].forEach(n=>UT.Events.on(n,draw));
try{PD.subscribe(r=>{
  if(r==='server-wallet'||r==='storage'||r==='pageshow')showWallet();
  if(r==='server-appearance'||r==='server-outfits'){try{if(R){clearChar();syncPreview()}}catch(e){}} /* karakter pratinjau = tampilan aktif akun di server */
})}catch(e){}
if(UT.LiveSync){UT.LiveSync.add('wallet',()=>UT.WalletService.get().refresh());UT.LiveSync.start({interval:20000})}
if(SV()&&WS())WS().refresh().then(r=>{if(r&&r.ok){showWallet();draw()}});
try{const A=SV()&&UT.AppearanceService&&UT.AppearanceService.get();if(A)A.refreshThrottled().catch(()=>{})}catch(e){}

/* skala kanvas 1920x1080 */
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}
addEventListener('resize',fit);fit();
rigInit();draw();
document.documentElement.classList.add('ut-ready');
})();
