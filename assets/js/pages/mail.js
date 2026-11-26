/* mail.js — dipindah dari blok script inline (mail.html). Tahap 3 SPA: dibungkus UT.PageModule ('mail'); halaman mandiri otomatis mount,
   unmount() melepas timer, listener, langganan dan polling. Callback async dijaga env.disposed (DOM view sudah dibuang saat callback selesai). */
UT.PageModule.define('mail',function(env){
const {setTimeout,clearTimeout,setInterval,addEventListener}=env;
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}addEventListener('resize',fit);fit();
/* Kotak masuk = SERVER (supabase/migrations/202611260001_player_mail.sql) lewat UT.MailService. Tidak ada surat/dompet tiruan:
   tanpa akun login halaman hanya menampilkan ajakan masuk. Hadiah masuk ke dompet server (MailService mencerminkannya ke PlayerData). */
const PD=window.PlayerData,IC='assets/images/ui/';
const MS=()=>window.UT&&UT.MailService&&UT.MailService.get(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SV=()=>!!(PD.serverMode&&PD.serverMode());
const esc=s=>String(s==null?'':s).replace(/[&<>"\x27]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MSG={'tidak-ada':'Surat tidak ditemukan.','tanpa-hadiah':'Surat ini tidak berisi hadiah.','sudah-diklaim':'Hadiah sudah diklaim.','kedaluwarsa':'Surat sudah kedaluwarsa.','tidak-ada-hadiah':'Tidak ada hadiah untuk diklaim.','hadiah-belum-diklaim':'Klaim hadiahnya dulu sebelum menghapus surat.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','mode-lokal':'Masuk ke akun untuk memakai Mail.'};
const SET=()=>PD.settings();
const buzz=()=>{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)};
let tt;function toast(m){if(env.disposed)return;const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
/* di shell (play.html) SEMUA target lewat UT.Spa.go (view atau iframe) agar shell tidak ditinggalkan; halaman mandiri: fade 330 ms lalu pindah halaman biasa */
const nav=u=>{if(UT.Spa&&UT.Spa.go){UT.Spa.go(u);return}$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const BUILT=['lobby.html','shop.html','profile.html','tambang.html','friendship.html','settings.html','powerup.html','frame.html','dadu.html','efek.html','karakter.html','mode.html','room.html','leaderboard.html','hadiah-misi.html','inventory.html'];
/* di shell location.search milik play.html (?go=...): parameter halaman (?from=) diambil dari URL rute aktif */
const search=()=>{if(UT.AccountHub&&UT.AccountHub.query&&UT.AccountHub.active&&UT.AccountHub.active())return UT.AccountHub.query();const c=UT.Spa&&UT.Spa.current&&UT.Spa.current();if(c&&c.name==='mail'){const i=c.url.indexOf('?');return i<0?'':c.url.slice(i).split('#')[0]}return location.search};
const FROM=(()=>{const f=new URLSearchParams(search()).get('from');return f&&BUILT.includes(f.split('?')[0])?f:'lobby.html'})();

/* ---- state ---- */
let mails=[],tab='all',state='loading'; /* loading | ok | local | error */
const pending=m=>m.kind==='reward'&&!m.claimed;
const unreadN=()=>mails.filter(m=>!m.read).length,pendN=()=>mails.filter(pending).length;
const ago=at=>{const d=Math.floor((Date.now()-new Date(at).getTime())/864e5);return d<=0?'Hari ini':d===1?'Kemarin':d<7?d+' hari lalu':d<30?Math.floor(d/7)+' minggu lalu':Math.floor(d/30)+' bulan lalu'};
const rwHtml=m=>'<div class="rw">'+(m.gems?'<span><img src="'+IC+'gem-medal-icons/berlian-hijau.webp" alt="">'+fmt(m.gems)+'</span>':'')+(m.coins?'<span><img src="'+IC+'hud/ikon-koin-emas.webp" alt="">'+fmt(m.coins)+'</span>':'')+'</div>';

/* ---- render ---- */
function renderCurrency(){if(env.disposed)return;$('#v-em').textContent=PD.walletReady()?fmt(PD.gems()):'—';$('#v-co').textContent=PD.walletReady()?fmt(PD.coins()):'—'}
function draw(){
  if(env.disposed)return;
  const un=unreadN(),pn=pendN(),ok=state==='ok';
  $('#tabs').innerHTML='<button class="ut-ul-i'+(tab==='all'?' on':'')+'" data-k="all">SEMUA'+(un?'<i class="bd">'+un+'</i>':'')+'</button><button class="ut-ul-i'+(tab==='reward'?' on':'')+'" data-k="reward">HADIAH'+(pn?'<i class="bd">'+pn+'</i>':'')+'</button><button class="ut-ul-i'+(tab==='system'?' on':'')+'" data-k="system">SISTEM</button>';
  $('#sum').textContent=ok?mails.length+' surat · '+un+' belum dibaca':state==='loading'?'Memuat…':'';
  $('#readAll').classList.toggle('dis',!(ok&&un));$('#claimAll').classList.toggle('dis',!(ok&&pn));
  const a=mails.filter(m=>tab==='all'||m.kind===tab);
  if(!ok){$('#list').innerHTML='<div class="empty">'+(state==='loading'?'Memuat…':state==='local'?'Masuk ke akun untuk membuka Mail.':'Tidak dapat terhubung ke server.<br><small style="font:800 28px var(--font-body)">Ketuk untuk coba lagi</small>')+'</div>';return}
  $('#list').innerHTML=a.length?a.map(m=>{
    const ico=m.kind==='reward'?'item-icons/kado-merah':m.read?'white-glyphs/surat-terbuka':'item-icons/surat-segel';
    const act=pending(m)?'<button class="btn sm ok ut-gl ut-c-g" data-claim="'+m.id+'"><img src="'+IC+'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>KLAIM</span></button>':m.kind==='reward'?'<button class="btn sm off ut-gl ut-c-d"><img src="assets/images/buttons/tombol-abu-polos.webp" alt=""><span>DIKLAIM</span></button>':'';
    return '<div class="row mr'+(m.read?'':' unread')+'" data-open="'+m.id+'"><div class="mi"><img src="'+IC+ico+'.webp" alt=""></div><div class="grow"><div class="nm ttl">'+esc(m.title)+(m.read?'':'<i></i>')+'</div><div class="sb">'+esc(m.body)+'</div></div>'+(m.kind==='reward'?rwHtml(m):'')+act+'<div class="tm">'+ago(m.at)+'</div><button class="rm ut-gl ut-c-r sm" data-del="'+m.id+'" aria-label="Hapus"><img src="'+IC+'white-glyphs/tong-sampah.webp" alt=""></button></div>'}).join('')
   :'<div class="empty">Tidak ada surat.</div>';
}

/* ---- muat dari server ---- */
let loading=false;
async function load(){
  if(loading)return;
  const S=MS();
  if(!SV()||!S){state='local';draw();return}
  loading=true;
  const r=await S.list(100);
  loading=false;
  if(env.disposed)return;
  if(r&&r.ok){mails=r.mails||[];state='ok'}
  else if(r&&(r.reason==='mode-lokal'||r.reason==='belum-login'))state='local';
  else if(state!=='ok')state='error';   /* gagal sesaat saat sudah tampil: biarkan daftar lama */
  draw();
}
const fail=r=>{toast(MSG[r&&r.reason]||'Gagal, coba lagi.')};

/* ---- aksi ---- */
const find=id=>mails.find(m=>m.id===id);
function markRead(m){if(m.read)return;m.read=true;draw();MS().read(m.id)}
async function claim(m){
  const r=await MS().claim(m.id);
  if(env.disposed)return;
  if(r&&r.ok){m.claimed=true;m.read=true;buzz();toast('Hadiah diklaim');draw();renderCurrency();return}
  if(r&&(r.reason==='sudah-diklaim')){m.claimed=true;draw()}
  fail(r);if(r&&(r.reason==='kedaluwarsa'||r.reason==='tidak-ada'))load();
}
function openMail(m){
  markRead(m);
  modal(m.title,esc(m.body)+(m.kind==='reward'?rwHtml(m):'')+'<span class="tmx">'+ago(m.at)+'</span>','TUTUP',pending(m)?'KLAIM':'',()=>claim(m));
}
function askDelete(m){
  if(pending(m)){toast(MSG['hadiah-belum-diklaim']);return}
  modal('Hapus surat','Hapus surat<br>"'+esc(m.title)+'"?','BATAL','HAPUS',async()=>{
    const r=await MS().remove(m.id);
    if(env.disposed)return;
    if(r&&r.ok){mails=mails.filter(x=>x.id!==m.id);draw();toast('Surat dihapus')}else{fail(r);load()}
  });
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b){tab=b.dataset.k;draw()}});
$('#list').addEventListener('click',e=>{
  if(state==='error'){state='loading';draw();load();return}
  if(state!=='ok')return;
  const g=a=>{const t=e.target.closest('['+a+']');return t&&t.getAttribute(a)};let id,m;
  if(id=g('data-claim')){if(m=find(id))claim(m)}
  else if(id=g('data-del')){if(m=find(id))askDelete(m)}
  else if(id=g('data-open')){if(m=find(id))openMail(m)}
});
$('#readAll').addEventListener('click',async()=>{
  const r=await MS().readAll();
  if(env.disposed)return;
  if(r&&r.ok){mails.forEach(m=>m.read=true);draw()}else fail(r);
});
$('#claimAll').addEventListener('click',async()=>{
  const r=await MS().claimAll();
  if(env.disposed)return;
  if(r&&r.ok){buzz();toast(r.count+' hadiah diklaim');await load();renderCurrency()}else{fail(r);if(r&&r.reason!=='sedang-diproses')load()}
});

/* ---- modal ---- */
let okFn=null,mOpen=false;
function modal(t,x,noL,okL,ok){if(env.disposed)return;$('#mt').textContent=t;$('#mx').innerHTML=x;$('#m-no span').textContent=noL;$('#m-ok span').textContent=okL;okFn=ok;$('#m-ok').style.display=okL?'':'none';$('#m-ok').classList.toggle('ut-c-r',okL==='HAPUS');$('#m-ok').classList.toggle('ut-c-g',okL!=='HAPUS');$('#md').classList.add('on');mOpen=true}
const closeM=()=>{$('#md').classList.remove('on');mOpen=false};
$('#m-no').addEventListener('click',closeM);
$('#m-ok').addEventListener('click',()=>{closeM();if(okFn)okFn()});
$('#md').addEventListener('click',e=>{if(e.target.id==='md')closeM()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&mOpen)closeM()});

/* ---- navigasi + dompet ---- */
$('#back').addEventListener('click',()=>nav(FROM));
$('#home').addEventListener('click',()=>nav('lobby.html'));
$('#cur-em').addEventListener('click',()=>nav('tambang.html?from=mail.html'));
$('#cur-co').addEventListener('click',()=>nav('shop.html?coin=1'));
/* penjaga window.__curSub dihapus: dengan SPA langganan harus dipasang tiap mount dan dilepas saat unmount */
try{env.own(PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')try{renderCurrency()}catch(e){}}))}catch(e){}
env.own(UT.Events.on('currencyChanged',renderCurrency));

draw();renderCurrency();load();
setInterval(()=>{if(!document.hidden&&state==='ok'&&!mOpen)load()},30000);
env.on(document,'visibilitychange',()=>{if(!document.hidden&&state==='ok'&&!mOpen)load()});
document.documentElement.classList.add('ut-ready');
if(SV()&&WS())WS().refresh().then(()=>{if(!env.disposed)renderCurrency()}); /* saldo dari server */
});
