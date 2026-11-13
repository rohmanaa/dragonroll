/* dadu.js — dipindah dari <script> inline (dadu.html). */
(()=>{
const $=s=>document.querySelector(s);
const PD=window.PlayerData,IC=window.ItemCatalog,AR=window.ItemArt;
const SV=()=>PD.serverMode(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SET=()=>PD.settings();
const fmt=n=>Number(n).toLocaleString('id-ID');
const fmtPrice=n=>n>=100000?Math.round(n/1000)+'k':n>=1000?(n/1000).toLocaleString('id-ID',{maximumFractionDigits:1})+'k':fmt(n);
const GEM='assets/ng/komponen/ikon-gem-medali/berlian-hijau.webp',KOIN='assets/ng/komponen/hud/ikon-koin-emas.webp',LOCK='assets/ng/komponen/glyph-putih/gembok.webp';
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
const art=i=>{try{if(kitOK(i)){const u=window.DiceKit.thumb(i.gameKey,160);if(u)return '<img class="dthumb" src="'+u+'" alt="" draggable="false">'}}catch(e){}return AR.dice(i.id)};
/* ---- DiceKit: dadu 3D asli (fisika kocok-lempar, material, partikel, suara); angka lempar hanya visual ---- */
/* Ukuran dadu di layar = ukuran kanvas / (jarak kamera ~ camScale). Kanvas 700px dengan camScale .628 = dadu 1,3x dari versi 360px/.42. */
const CAM_SCALE=.628;
let KIT=null;
function prepKitSound(){let v=1;try{const p=parseInt(UT.Prefs.get('sfxVol',100),10);if(!isNaN(p))v=Math.max(0,Math.min(100,p))/100}catch(e){}KIT.setSound(!!SET().sound&&v>0);KIT.setVolume(v)}
function rollPreview(){if(!KIT||!sel||!kitOK(sel))return;prepKitSound();KIT.roll()}
function throwPreview(){if(!KIT||!sel||!kitOK(sel))return;prepKitSound();KIT.rollWhenReady()}
function syncKit(){if(KIT&&sel&&kitOK(sel))KIT.equip(sel.gameKey)}
function mountKit(){
  if(KIT||!window.DiceKit)return;
  const host=$('#fpv');if(!host)return;
  try{
    const k=sel&&kitOK(sel)?sel.gameKey:'klasik';
    host.innerHTML='';
    KIT=window.DiceKit.mount(host,{diceId:k,quality:SET().graphics==='high'?'high':'auto',camScale:CAM_SCALE,sound:!!SET().sound});
  }catch(e){KIT=null;console.warn('DiceKit gagal, memakai pratinjau sederhana',e)}
}
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

/* ---- gambar ulang ---- */
function pickDefault(){
  if(sel&&FR.includes(sel))return;
  sel=FR.find(isUsed)||FR.find(isOwned)||FR[0]||null;
}
function draw(){
  pickDefault();
  let html=FR.map(x=>{
    const m=isOwned(x),sell=canSell(x);
    const on=isUsed(x),state=m?`<span class="pr ${on?'used':'owned'}"${on?'':' data-action="equip"'}>${on?'DIPASANG':'DIMILIKI'}</span>`
      :sell?`<span class="pr buy" data-action="buy"><img src="${x.gems>0?GEM:KOIN}" alt="">${fmtPrice(x.gems>0?x.gems:x.price)}</span>`:`<span class="pr no"><img src="${LOCK}" alt="">TIDAK DIJUAL</span>`;
    return `<button class="fslot${x===sel?' sel':''}${m?'':' lk'}" data-id="${x.id}" aria-label="${x.name} — ${on?'dipasang':m?'dimiliki':sell?'beli '+fmtPrice(x.gems>0?x.gems:x.price):'tidak dijual'}"><div class="th">${art(x)}</div>${state}</button>`}).join('');
  for(let i=FR.length;i<Math.max(20,Math.ceil(FR.length/5)*5);i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  if(!sel){if(!KIT)$('#fpv').innerHTML='';$('#nm').textContent='Dadu';$('#rar').textContent='';$('#ds').textContent='Belum ada dadu di game ini.';showWallet();return}
  const f=sel,mine=isOwned(f),on=isUsed(f),r=RAR[f.rarity]||RAR.common;
  if(KIT)syncKit();else $('#fpv').innerHTML='<div class="fb3d">'+AR.dice(f.id)+'</div>';
  $('#nm').textContent=f.name;
  $('#rar').textContent=r[0];$('#rar').style.color=r[1];
  $('#ds').textContent=brief(f.desc);
  showWallet();
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
$('#grid').onclick=e=>{
  const c=e.target.closest('.fslot');if(!c)return;
  const f=FR.find(x=>x.id===c.dataset.id);if(!f)return;
  const action=e.target.closest('[data-action]'),act=action&&action.dataset.action;
  sel=f;
  if(act==='buy'){draw();buySelected(f);return}
  if(act==='equip'){equip(f);throwPreview();return}
  snd('button');draw();throwPreview();
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
UT.Events.on('currencyChanged',()=>showWallet());
['inventoryChanged','diceChanged'].forEach(n=>UT.Events.on(n,draw));
try{PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')showWallet()})}catch(e){}
if(UT.LiveSync){UT.LiveSync.add('wallet',()=>UT.WalletService.get().refresh());UT.LiveSync.start({interval:20000})}
if(SV()&&WS())WS().refresh().then(r=>{if(r&&r.ok){showWallet();draw()}});

/* skala kanvas 1920x1080 */
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}
addEventListener('resize',fit);fit();
draw();mountKit();
window.addEventListener('dicekit-ready',()=>{mountKit();draw()}); /* kit siap -> dadu 3D tampil & kartu berganti ke warna asli */
document.documentElement.classList.add('ut-ready');
})();
