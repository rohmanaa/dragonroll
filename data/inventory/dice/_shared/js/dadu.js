/* dadu.js — dipindah dari <script> inline (dadu.html). Modul 'dadu': mandiri/embed = mount otomatis saat skrip dimuat; di shell (play.html) = view sendiri
   (tanpa iframe): DiceKit memakai renderer bersama (sharedGL:'inv-dadu', dilepas saat unmount), navigasi lewat UT.Spa.go,
   timer/listener/langganan dilepas lewat env.
   Tampilan = sama dengan halaman Pet (tanpa tab): baris kartu .pc (nama, thumbnail, bar aksi harga/GUNAKAN), ikon mata / badan kartu = pratinjau 3D di modal #pv. */
UT.PageModule.define('dadu',function(env){
const $=s=>document.querySelector(s);
const PD=window.PlayerData,IC=window.ItemCatalog,AR=window.ItemArt;
const SV=()=>PD.serverMode(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SET=()=>PD.settings();
const fmt=n=>Number(n).toLocaleString('id-ID');
const fmtPrice=n=>n>=100000?Math.round(n/1000)+'k':n>=1000?(n/1000).toLocaleString('id-ID',{maximumFractionDigits:1})+'k':fmt(n);
const GEM='assets/images/ui/gem-medal-icons/berlian-hijau.webp',KOIN='assets/images/ui/hud/ikon-koin-emas.webp',LOCK='assets/images/ui/white-glyphs/gembok.webp';
const RAR={common:['Biasa','#cfc8ea'],rare:['Langka','#4db3e6'],epic:['Epik','#b07cff'],legendary:['Legendaris','#ffd45a']};
const WMSG={'saldo-kurang':'Coin tidak cukup.','gem-kurang':'Emerald tidak cukup.','sudah-dimiliki':'Item sudah dimiliki.','tidak-tersedia':'Item tidak tersedia.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...'};
/* data dari ItemCatalog + PlayerData (bukan data sendiri); off:true = takedown sementara */
const FR=IC.items.filter(i=>i.kind==='dice'&&!i.off);
const isOwned=i=>PD.owns(i.id),isUsed=i=>PD.isEquipped(i.id);
const canSell=i=>!!i&&((typeof i.price==='number'&&i.price>0)||(typeof i.gems==='number'&&i.gems>0))&&!i.starter;
const kitOK=i=>!!(window.DiceKit&&i&&window.DiceKit.has(i.gameKey));
/* kartu: warna asli = tekstur yang sama dengan preview 3D; cadangan SVG bila kit belum siap */
/* deskripsi singkat: kalimat pertama saja, maks ~64 karakter */
const brief=d=>{d=String(d||'').trim();const first=d.split(/(?<=[.!?])\s+/)[0]||d;if(first.length<=64)return first;const cut=first.slice(0,62),i=cut.lastIndexOf(' ');return (i>30?cut.slice(0,i):cut)+'…'};
const THUMBS=new Map();
const art=i=>{try{if(kitOK(i)){let u=THUMBS.get(i.gameKey);if(!u){u=window.DiceKit.thumb(i.gameKey,300);if(u)THUMBS.set(i.gameKey,u)}if(u)return '<img class="dthumb" src="'+u+'" alt="" draggable="false">'}}catch(e){}return AR.dice(i.id)};
/* ---- DiceKit: dadu 3D asli (fisika kocok-lempar, material, partikel, suara); angka lempar hanya visual ---- */
/* Ukuran dadu di layar = ukuran kanvas / (jarak kamera ~ camScale). Kanvas pratinjau di modal 500px tinggi: camScale .45 (ukuran dadu ~ kanvas/camScale) = ukuran dadu sama dengan kanvas 700px/.628 sebelumnya. */
const CAM_SCALE=.45;
let KIT=null;
function prepKitSound(){let v=1;try{const p=parseInt(UT.Prefs.get('sfxVol',100),10);if(!isNaN(p))v=Math.max(0,Math.min(100,p))/100}catch(e){}KIT.setSound(!!SET().sound&&v>0);KIT.setVolume(v)}
function rollPreview(){if(!KIT||!sel||!kitOK(sel))return;prepKitSound();KIT.roll()}
function throwPreview(){if(!KIT||!sel||!kitOK(sel))return;prepKitSound();KIT.rollWhenReady()}
function syncKit(){if(KIT&&sel&&kitOK(sel))KIT.equip(sel.gameKey)}
function mountKit(){
  if(env.disposed||KIT||!window.DiceKit)return;
  if(!previewOpen())return; /* dadu 3D hanya dibuat saat modal pratinjau terbuka (dibuang saat ditutup) */
  const host=$('#fpv');if(!host)return;
  try{
    const k=sel&&kitOK(sel)?sel.gameKey:'klasik';
    host.innerHTML='';
    KIT=window.DiceKit.mount(host,{diceId:k,quality:(SET().graphics==='high'||SET().graphics==='ultra')?'high':'auto',camScale:CAM_SCALE,sound:!!SET().sound,sharedGL:'inv-dadu'});
  }catch(e){KIT=null;console.warn('DiceKit gagal, memakai pratinjau sederhana',e)}
}
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

/* ---- gambar ulang ---- */
function pickDefault(){
  if(sel&&FR.includes(sel))return;
  sel=FR.find(isUsed)||FR.find(isOwned)||FR[0]||null;
}
const IC_GEM=GEM,IC_COIN=KOIN;
const EYE_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="#fff"/></svg>';
/* bar bawah kartu = tombol aksi: harga (belum dimiliki) -> beli; GUNAKAN (dimiliki); DIPAKAI (aktif; dadu selalu ada satu yang dipakai) */
function actionBar(f,m,on,sell){
  if(on)return '<button class="pc-pr no" type="button" disabled>DIPAKAI</button>';
  if(m)return '<button class="pc-pr own" type="button" data-act="use">GUNAKAN</button>';
  if(!sell)return '<button class="pc-pr no" type="button" disabled>TIDAK DIJUAL</button>';
  const gems=f.gems>0;
  return '<button class="pc-pr" type="button" data-act="use"><b>'+fmtPrice(gems?f.gems:f.price)+'</b><img src="'+(gems?IC_GEM:IC_COIN)+'" alt=""></button>';
}
/* Grid hanya dibangun ulang bila isinya berubah (dimiliki / dipakai / harga / thumbnail); penanda pilihan (.sel) dipasang terpisah */
let lastGridHtml='';
function drawGrid(){
  const html=FR.map(x=>{
    const m=isOwned(x),on=isUsed(x),sell=canSell(x);
    const rar=RAR[x.rarity]?x.rarity:'common';
    const state=on?'dipakai':m?'dimiliki':sell?'beli '+fmtPrice(x.gems>0?x.gems:x.price):'tidak dijual';
    const check=on?'<img class="ck" src="assets/images/ui/white-glyphs/centang.webp" alt="">':'';
    return '<article class="pc r-'+rar+(m?' own':'')+(on?' used':'')+'" data-id="'+x.id+'"><div class="pc-sel">'
      +'<div class="pc-top" role="group" aria-label="'+x.name+', '+RAR[rar][0]+', '+state+'">'
      +'<span class="pc-nm">'+x.name+'</span>'
      +'<span class="pc-th">'+art(x)+check+'</span></div>'
      +actionBar(x,m,on,sell)+'</div>'
      +'<button class="pc-ic pc-eye" type="button" data-act="preview" aria-label="Pratinjau '+x.name+'" title="Pratinjau">'+EYE_SVG+'</button>'
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
/* isi modal pratinjau + dadu 3D terpilih (tanpa membangun ulang grid) */
function updatePreview(){
  if(env.disposed)return;
  if(!sel){if(!KIT)$('#fpv').innerHTML='';$('#nm').textContent='Dadu';$('#rar').textContent='';$('#ds').textContent='Belum ada dadu di game ini.';return}
  const f=sel,r=RAR[f.rarity]||RAR.common;
  if(KIT)syncKit();else if(previewOpen())$('#fpv').innerHTML='<div class="fb3d">'+AR.dice(f.id)+'</div>';
  $('#nm').textContent=f.name;
  $('#rar').textContent=r[0];$('#rar').style.color=r[1];
  $('#ds').textContent=brief(f.desc);
}
const previewOpen=()=>$('#pv').classList.contains('on');
function openPreview(){
  $('#pv').classList.add('on');$('#pv').setAttribute('aria-hidden','false');
  mountKit();updatePreview();throwPreview();
  try{$('#pvClose').focus({preventScroll:true})}catch(e){}
}
function closePreview(){
  $('#pv').classList.remove('on');$('#pv').setAttribute('aria-hidden','true');
  try{if(KIT)KIT.dispose()}catch(e){}KIT=null; /* dadu 3D & renderer bersama dilepas selama modal tertutup */
}
function buySelected(f){
  if(!PD.walletReady()){toast('Menunggu saldo dari server...');return}
  const coins=PD.coins();
  if(f.gems>0){
    const gems=PD.gems();
    if(gems<f.gems)modal('Emerald tidak cukup',`Kamu butuh ${fmt(f.gems-gems)} Emerald lagi.<br>Saldo kamu ${fmt(gems)} Emerald.`,'TUTUP','DAPATKAN EMERALD',()=>nav('tambang.html?from=dadu.html'));
    else modal('Konfirmasi',`Beli ${f.name}<br>seharga ${fmt(f.gems)} Emerald?`,'BATAL','BELI',()=>buy(f));
    return;
  }
  if(coins<f.price)modal('Coin tidak cukup',`Kamu butuh ${fmt(f.price-coins)} Coin lagi.<br>Saldo kamu ${fmt(coins)} Coin.`,'TUTUP','DAPATKAN COIN',()=>nav('shop.html?coin=1'));
  else modal('Konfirmasi',`Beli ${f.name}<br>seharga ${fmt(f.price)} Coin?`,'BATAL','BELI',()=>buy(f));
}
/* ketuk bar bawah = beli / pakai; ikon mata ATAU badan kartu = pratinjau 3D (modal) */
$('#grid').onclick=e=>{
  const c=e.target.closest('.pc');if(!c)return;
  const f=FR.find(x=>x.id===c.dataset.id);if(!f)return;
  const btn=e.target.closest('[data-act]'),act=btn?btn.dataset.act:'preview';
  sel=f;snd('button');
  if(act==='use'){runAction(f);return}
  markSelected();openPreview();
};
/* beli bila belum dimiliki, pakai bila sudah (dadu yang sedang dipakai tidak bisa dilepas) */
function runAction(f){
  if(!isOwned(f)){if(canSell(f))buySelected(f);else toast('Dadu ini tidak dijual.');return}
  if(!isUsed(f))equip(f);
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
env.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('#md').classList.contains('on'))closeM();else if(previewOpen())closePreview();else nav('lobby.html')});
$('#pvClose').onclick=closePreview;
$('#pv').onclick=e=>{if(e.target.id==='pv')closePreview()};

/* ---- aksi: pakai / beli (beli lewat WalletService/PlayerData; klien tidak mengubah saldo sendiri) ---- */
function equip(f){
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
/* ---- klik preview = lempar ---- */
$('#fpv').onclick=rollPreview;

/* ---- navigasi ---- */
$('#back').onclick=()=>{snd('button');nav('lobby.html')};
$('#cur-co').onclick=()=>nav('shop.html?coin=1');
$('#cur-em').onclick=()=>nav('tambang.html?from=dadu.html');

/* ---- sinkron: event + live-sync (saldo/inventory dari server) ---- */
env.own(UT.Events.on('currencyChanged',()=>showWallet()));
['inventoryChanged','diceChanged'].forEach(n=>env.own(UT.Events.on(n,draw)));
try{env.own(PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')showWallet()}))}catch(e){}
if(UT.LiveSync){UT.LiveSync.add('wallet',()=>UT.WalletService.get().refresh());UT.LiveSync.start({interval:20000});env.own(()=>{UT.LiveSync.remove('wallet');UT.LiveSync.stop()})}
if(SV()&&WS())WS().refresh().then(r=>{if(r&&r.ok){showWallet();draw()}});

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
/* unmount: DiceKit dibuang (animasi, listener, fisika) dan renderer bersama dilepas */
env.own(()=>{try{if(KIT)KIT.dispose()}catch(e){}KIT=null});
draw();
env.addEventListener('dicekit-ready',()=>{draw();if(previewOpen()){mountKit();syncKit()}}); /* kit siap -> kartu berganti ke warna asli; dadu 3D bila modal sedang terbuka */
document.documentElement.classList.add('ut-ready');
});
