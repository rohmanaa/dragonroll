/* chest.js — halaman Chest. Semua status & hadiah = SERVER (chest_get / chest_claim_daily / chest_start / chest_open_now / chest_collect)
   lewat UT.WalletService. Klien hanya menampilkan; syarat main, waktu buka, biaya gem, dan isi hadiah ditentukan server (hari reset = WIB). */
(()=>{
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}addEventListener('resize',fit);fit();
const PD=window.PlayerData,IC='assets/images/ui/';
const SV=()=>!!(PD.serverMode&&PD.serverMode()),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SET=()=>PD.settings();
const buzz=()=>{if(SET().vibration&&navigator.vibrate)navigator.vibrate(20)};
const playSound=n=>{try{if(SET().sound)UT.Audio.play(n==='chest'?'chest':'button')}catch(e){}};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const WM={'jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','mode-lokal':'Masuk ke akun untuk memakai Chest.',
 'sudah-klaim':'Chest ini sudah diklaim hari ini.','belum-selesai':'Main dulu sampai syaratnya terpenuhi.','penuh':'Penyimpanan penuh (10/10). Ambil chest dulu.',
 'slot-penuh':'Maksimal 3 chest diproses. Tunggu salah satu selesai.','sudah-dibuka':'Chest ini sudah dalam proses.','gem-kurang':'Gem tidak cukup.',
 'belum-siap':'Chest belum siap diambil.','belum-dibuka':'Mulai buka chest dulu.','sudah-diambil':'Chest sudah diambil.','tidak-ada':'Chest tidak ditemukan.','sudah-dibayar':'Sudah dibayar.'};
const KIND={wood:{nm:'Peti Kayu',im:'chest-packs/peti-kayu'},silver:{nm:'Peti Perak',im:'chest-packs/peti-perak'},gold:{nm:'Peti Emas',im:'chest-packs/peti-emas'}};
const NEED_TXT={wood:'game',silver:'game',gold:'game'};

/* ---- state server ---- */
let S=null,AT=0,busy=false,mOpen=false;
function apply(r){if(!r||r.ok===false||!Array.isArray(r.daily))return false;S=r;AT=Date.now();return true}
const secsLeft=c=>c.status==='opening'?Math.max(0,c.seconds_left-Math.floor((Date.now()-AT)/1000)):c.seconds_left;
const isReady=c=>c.status==='ready'||(c.status==='opening'&&secsLeft(c)<=0);
const skipCost=c=>{const s=secsLeft(c);return s<=0?0:Math.max(1,Math.ceil(s/1800))};
const resetSecs=()=>S?Math.max(0,S.seconds_to_reset-Math.floor((Date.now()-AT)/1000)):0;
const hms=s=>{s=Math.max(0,Math.ceil(s));return [s/3600|0,(s%3600)/60|0,s%60].map(v=>String(v).padStart(2,'0')).join(':')};
const clock=s=>{s=Math.max(0,Math.ceil(s));return s>=3600?hms(s):String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};

function renderCurrency(){$('#v-em').textContent=PD.walletReady()?fmt(PD.gems()):'—';$('#v-co').textContent=PD.walletReady()?fmt(PD.coins()):'—'}
const bump=()=>['#cur-em','#cur-co'].forEach(s=>{const e=$(s);e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')});

/* ---- 3 kolom atas: chest yang SEDANG DIBUKA (timer / CEPAT / AMBIL). Klaim chest harian ada di Lobby. ---- */
function oc(c){
 const k=KIND[c.kind],rd=isReady(c),head='<img class="im" src="'+IC+k.im+'.webp" alt=""><div class="nm">'+k.nm+'</div>';
 if(rd)return '<div class="dc ready">'+head+'<div class="tx tm">Siap diambil!</div>'+
  '<button class="btn" data-collect="'+c.id+'"><img src="'+IC+'buttons-and-controls/tombol-kuning-polos.webp" alt=""><span>AMBIL</span></button></div>';
 const left=secsLeft(c);
 return '<div class="dc opening">'+head+'<div class="tx tm" data-tm="'+c.id+'">'+clock(left)+'</div>'+
  '<button class="btn" data-skip="'+c.id+'"><img src="'+IC+'buttons-and-controls/tombol-biru-polos.webp" alt=""><span>CEPAT <img class="gm" src="'+IC+'gem-medal-icons/berlian-hijau.webp" alt=""><b data-sc="'+c.id+'">'+skipCost(c)+'</b></span></button></div>'}
function vDaily(){
 const hd='<div class="hd"><span>Sedang Dibuka <b>'+(S?S.opening:0)+' / '+(S?S.max_open:3)+'</b></span><small>Chest harian diklaim di Lobby</small></div>';
 if(!S)return hd;
 const act=S.chests.filter(c=>c.status!=='stored').sort((a,b)=>(isReady(b)-isReady(a))||secsLeft(a)-secsLeft(b)||a.id-b.id);
 let h=hd+'<div class="dcs">';
 for(let i=0;i<S.max_open;i++)h+=act[i]?oc(act[i]):'<div class="dc empty"><div class="em">Slot kosong<small>Pilih chest di penyimpanan,<br>lalu tekan BUKA</small></div></div>';
 return h+'</div>'}

/* ---- penyimpanan ---- */
function slot(c){
 const k=KIND[c.kind],rd=isReady(c);
 if(rd)return '<div class="sl has ready"><img class="im" src="'+IC+k.im+'.webp" alt=""><div class="nm">'+k.nm+'</div><div class="st">Siap diambil!</div>'+
  '<button class="btn" data-collect="'+c.id+'"><img src="'+IC+'buttons-and-controls/tombol-kuning-polos.webp" alt=""><span>AMBIL</span></button></div>';
 if(c.status==='opening')return '<div class="sl has opening"><img class="im" src="'+IC+k.im+'.webp" alt=""><div class="nm">'+k.nm+'</div><div class="st tm" data-tm="'+c.id+'">'+clock(secsLeft(c))+'</div>'+
  '<button class="btn" data-skip="'+c.id+'"><img src="'+IC+'buttons-and-controls/tombol-biru-polos.webp" alt=""><span>CEPAT <img class="gm" src="'+IC+'gem-medal-icons/berlian-hijau.webp" alt=""><b data-sc="'+c.id+'">'+skipCost(c)+'</b></span></button></div>';
 const full=S.opening>=S.max_open;
 return '<div class="sl has"><img class="im" src="'+IC+k.im+'.webp" alt=""><div class="nm">'+k.nm+'</div><div class="st">'+clock(c.open_secs)+' untuk dibuka</div>'+
  '<button class="btn'+(full?' off':'')+'" data-start="'+c.id+'"'+(full?' disabled':'')+'><img src="'+IC+'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>BUKA</span></button></div>'}
function vStore(){
 const hd='<div class="hd"><span>Penyimpanan <b>'+(S?S.count:0)+' / '+(S?S.max_storage:10)+'</b></span><small>Diproses: '+(S?S.opening:0)+' / '+(S?S.max_open:3)+'</small></div>';
 if(!S)return hd;
 const list=S.chests.filter(c=>c.status==='stored').sort((a,b)=>a.id-b.id);
 let h=hd+'<div class="slots">',busyN=S.opening;
 for(let i=0;i<S.max_storage;i++){
  if(list[i])h+=slot(list[i]);
  else if(busyN>0){busyN--;h+='<div class="sl busy"><div class="em">Sedang dibuka</div></div>'}
  else h+='<div class="sl"><div class="em">Kosong</div></div>'}
 return h+'</div>'}

function render(){
 $('#daily').className='sec';$('#store').className='sec';
 $('#daily').innerHTML=vDaily();$('#store').innerHTML=vStore();
 const old=$('.msg');if(old)old.remove();
 if(!SV()||!S){const m=document.createElement('div');m.className='msg';m.innerHTML=SV()?'Memuat…':'Masuk ke akun untuk<br>memakai Chest.';$('#stage').appendChild(m)}
 renderCurrency()}

/* ---- aksi (semua lewat server) ---- */
async function reload(){const w=WS();if(!w)return;const r=await w.chestGet();if(apply(r))render()}
async function act(call,onOk){
 if(busy)return;if(!SV()){toast(WM['mode-lokal']);return}
 busy=true;
 try{const w=WS(),r=w?await call(w):{ok:false,reason:'jaringan'};
  if(r&&r.ok){apply(r);onOk&&onOk(r)}else{toast(WM[r&&r.reason]||'Gagal, coba lagi');await reload()}}
 finally{busy=false;render()}}
const kindOf=id=>{const c=S&&S.chests.find(x=>x.id===id);return c?c.kind:'wood'};
document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-claim],button[data-start],button[data-skip],button[data-collect]');if(!b||b.disabled)return;buzz();
 if(b.dataset.claim)return act(w=>w.chestClaimDaily(b.dataset.claim),()=>{playSound('button');toast('Chest masuk ke penyimpanan!')});
 const id=+(b.dataset.start||b.dataset.skip||b.dataset.collect);
 if(b.dataset.start)return act(w=>w.chestStart(id),()=>toast('Chest mulai dibuka.'));
 if(b.dataset.skip)return act(w=>w.chestOpenNow(id),()=>{playSound('button');bump();renderCurrency()});
 if(b.dataset.collect){const k=kindOf(id);return act(w=>w.chestCollect(id),r=>{playSound('chest');bump();renderCurrency();
  let x='<div class="rays"></div><img class="mi" src="'+IC+KIND[k].im+'.webp" alt="">';
  x+='<div class="rw"><img src="'+IC+'hud/ikon-koin-emas.webp" alt="">+'+fmt(r.coins)+' Coin</div>';
  if(r.gems>0)x+='<div class="rw"><img src="'+IC+'gem-medal-icons/berlian-hijau.webp" alt="">+'+fmt(r.gems)+' Gem</div>';
  if(r.xp>0)x+='<div class="rw">+'+fmt(r.xp)+' XP</div>';
  modal(KIND[k].nm+' Terbuka!',x,true)})}});

function modal(t,x,fx){$('#mt').textContent=t;$('#mx').innerHTML=x;const md=$('#md');md.classList.toggle('fx',!!fx);
 const old=md.querySelector('.flash');if(old)old.remove();
 if(fx){const f=document.createElement('div');f.className='flash';md.appendChild(f)} /* kilatan cahaya lembut saat peti terbuka */
 md.classList.remove('on');void md.offsetWidth;md.classList.add('on');mOpen=true}
function closeM(){const md=$('#md');md.classList.remove('on','fx');const f=md.querySelector('.flash');if(f)f.remove();mOpen=false}
$('#m-ok').addEventListener('click',closeM);
$('#back').addEventListener('click',()=>nav('lobby.html'));
$('#cur-em').addEventListener('click',()=>nav('tambang.html?from=chest.html'));
$('#cur-co').addEventListener('click',()=>nav('shop.html?coin=1'));
addEventListener('pageshow',e=>{if(e.persisted)$('#fade').classList.remove('on')});
try{if(!window.__curSub){window.__curSub=1;PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')try{renderCurrency()}catch(e){}})}}catch(e){}
UT.Events.on('currencyChanged',renderCurrency);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&SV()&&!mOpen&&!busy)reload()});

/* ---- ticker 1 detik: timer, biaya cepat, reset harian; chest yang timernya habis -> render ulang ---- */
setInterval(()=>{
 if(!S)return;
 const rs=$('#rs');if(rs)rs.textContent=hms(resetSecs());
 let flip=false;
 S.chests.forEach(c=>{if(c.status!=='opening')return;
  const el=document.querySelector('[data-tm="'+c.id+'"]');
  if(secsLeft(c)<=0){if(el)flip=true;return}
  if(el)el.textContent=clock(secsLeft(c));
  const sc=document.querySelector('[data-sc="'+c.id+'"]');if(sc)sc.textContent=skipCost(c)});
 if(flip&&!busy)render();
 if(S.all_claimed&&resetSecs()<=0&&!busy)reload()},1000);

/* ---- mulai ---- */
render();
if(SV()&&WS()){WS().refresh().then(renderCurrency);reload()}
else addEventListener('load',()=>{if(SV()&&WS()){WS().refresh().then(renderCurrency);reload()}});
if(UT.LiveSync){UT.LiveSync.add('wallet',()=>WS().refresh());UT.LiveSync.start({interval:20000})}
})();
