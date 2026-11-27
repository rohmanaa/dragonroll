/* frame.js — dipindah dari <script> inline (frame.html). Modul 'frame': mandiri/embed = mount otomatis saat skrip dimuat; di shell (play.html) = view sendiri
   (tanpa iframe): bar tab Inventory dipasang di sini, navigasi lewat UT.Spa.go, timer/listener/langganan dilepas lewat env saat unmount. */
UT.PageModule.define('frame',function(env){
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
/* frame hadiah (source 'event', mis. seri Login 30 hari) disembunyikan sampai dimiliki: tanpa spoiler. Dihitung ulang tiap pakai karena kepemilikan bisa berubah. */
const frAll=()=>IC.items.filter(i=>i.kind==='frame'&&!i.off&&(i.source!=='event'||PD.owns(i.id)));
const isOwned=i=>PD.owns(i.id),isUsed=i=>PD.isEquipped(i.id);
const canSell=i=>!!i&&((typeof i.price==='number'&&i.price>0)||(typeof i.gems==='number'&&i.gems>0))&&!i.starter;
const art=i=>AR.frame(i.id);
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
  if(sel&&frAll().includes(sel))return;
  sel=frAll().find(isUsed)||frAll().find(isOwned)||frAll()[0]||null;
}
function draw(){
  if(env.disposed)return;
  pickDefault();
  renderAct();
  let html=frAll().map(x=>{
    const m=isOwned(x),on=isUsed(x),sell=canSell(x);
    const st=on?'st-used':m?'st-own':'st-lock';
    return `<button class="fslot ${st}${x===sel?' sel':''}${m?'':' lk'}" data-id="${x.id}" aria-label="${x.name} — ${on?'dipakai':m?'dimiliki':sell?'beli '+fmtPrice(x.gems>0?x.gems:x.price):'tidak dijual'}"><div class="th">${art(x)}</div>${on?'<img class="ck" src="assets/images/ui/white-glyphs/centang.webp" alt="">':''}</button>`}).join('');
  for(let i=frAll().length;i<Math.max(20,Math.ceil(frAll().length/5)*5);i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  if(!sel){$('#fpv').innerHTML='';$('#nm').textContent='Frame';$('#rar').textContent='';$('#ds').textContent='Belum ada frame di game ini.';showWallet();return}
  const f=sel,mine=isOwned(f),on=isUsed(f),r=RAR[f.rarity]||RAR.common;
  $('#fpv').innerHTML=art(f);
  $('#nm').textContent=f.name;
  $('#rar').textContent=r[0];$('#rar').style.color=r[1];
  $('#ds').textContent=f.desc+(mine?'':(canSell(f)?' Belum dimiliki — ini hanya preview, beli untuk memakainya.':' Belum dimiliki dan tidak dijual. Hanya preview.'));
  showWallet();
}
function buySelected(f){
  if(!PD.walletReady()){toast('Menunggu saldo dari server...');return}
  const coins=PD.coins();
  if(f.gems>0){
    const gems=PD.gems();
    if(gems<f.gems)modal('Emerald tidak cukup',`Kamu butuh ${fmt(f.gems-gems)} Emerald lagi.<br>Saldo kamu ${fmt(gems)} Emerald.`,'TUTUP','DAPATKAN EMERALD',()=>nav('tambang.html?from=frame.html'));
    else modal('Konfirmasi',`Beli ${f.name}<br>seharga ${fmt(f.gems)} Emerald?`,'BATAL','BELI',()=>buy(f));
    return;
  }
  if(coins<f.price)modal('Coin tidak cukup',`Kamu butuh ${fmt(f.price-coins)} Coin lagi.<br>Saldo kamu ${fmt(coins)} Coin.`,'TUTUP','DAPATKAN COIN',()=>nav('shop.html?coin=1'));
  else modal('Konfirmasi',`Beli ${f.name}<br>seharga ${fmt(f.price)} Coin?`,'BATAL','BELI',()=>buy(f));
}
$('#grid').onclick=e=>{
  const c=e.target.closest('.fslot');if(!c)return;
  const f=frAll().find(x=>x.id===c.dataset.id);if(!f)return;
  sel=f;
  snd('button');draw();
};

/* ---- tombol aksi tunggal (kanan bawah): Beli / Pakai / Dipakai / Tidak dijual ---- */
function renderAct(){
  const b=$('#act'); if(!b)return;
  const f=sel; const sp=b.querySelector('span');
  if(!f){b.style.display='none';return}
  b.style.display='';
  const m=isOwned(f),on=isUsed(f),sell=canSell(f);
  b.classList.toggle('ut-c-d',on||(!m&&!sell)); b.classList.toggle('ut-c-y',!(on||(!m&&!sell)));   /* HUD: kuning = aksi (PAKAI/BELI), gelap = tidak bisa diklik */
  if(on){b.dataset.mode='used';b.disabled=true;sp.textContent='DIPAKAI'}
  else if(m){b.dataset.mode='equip';b.disabled=false;sp.textContent='PAKAI'}
  else if(sell){b.dataset.mode='buy';b.disabled=false;sp.textContent='BELI '+fmtPrice(f.gems>0?f.gems:f.price)+(f.gems>0?' EMERALD':' COIN')}
  else {b.dataset.mode='no';b.disabled=true;sp.textContent='TIDAK DIJUAL'}
}
$('#act').onclick=()=>{
  const f=sel; if(!f)return; const mode=$('#act').dataset.mode;
  if(mode==='equip'){equip(f);return}
  if(mode==='buy'){buySelected(f);return}
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
env.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('#md').classList.contains('on'))closeM();else nav('lobby.html')});

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
/* ---- navigasi ---- */
$('#back').onclick=()=>{snd('button');nav('lobby.html')};
$('#cur-co').onclick=()=>nav('shop.html?coin=1');
$('#cur-em').onclick=()=>nav('tambang.html?from=frame.html');

/* ---- sinkron: event + live-sync (saldo/inventory dari server) ---- */
env.own(UT.Events.on('currencyChanged',()=>showWallet()));
['inventoryChanged','skinChanged','frameChanged'].forEach(n=>env.own(UT.Events.on(n,draw)));
try{env.own(PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')showWallet()}))}catch(e){}
if(UT.LiveSync){UT.LiveSync.add('wallet',()=>UT.WalletService.get().refresh());UT.LiveSync.start({interval:20000});env.own(()=>{UT.LiveSync.remove('wallet');UT.LiveSync.stop()})}
if(SV()&&WS())WS().refresh().then(r=>{if(r&&r.ok){showWallet();draw()}});

/* skala kanvas 1920x1080 */
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}
env.addEventListener('resize',fit);fit();
if(MANAGED&&UT.InvTabs)UT.InvTabs.mountChrome(env,'frame',nav,snd);
draw();
document.documentElement.classList.add('ut-ready');
});
