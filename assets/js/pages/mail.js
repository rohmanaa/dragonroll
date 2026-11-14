/* mail.js — dipindah dari <script> inline (mail.html). */
(()=>{
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}addEventListener('resize',fit);fit();
/* Kotak masuk = SERVER (supabase/migrations/202611260001_player_mail.sql) lewat UT.MailService. Tidak ada surat/dompet tiruan:
   tanpa akun login halaman hanya menampilkan ajakan masuk. Hadiah masuk ke dompet server (MailService mencerminkannya ke PlayerData). */
const PD=window.PlayerData,IC='assets/ng/komponen/';
const MS=()=>window.UT&&UT.MailService&&UT.MailService.get(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SV=()=>!!(PD.serverMode&&PD.serverMode());
const esc=s=>String(s==null?'':s).replace(/[&<>"\x27]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MSG={'tidak-ada':'Surat tidak ditemukan.','tanpa-hadiah':'Surat ini tidak berisi hadiah.','sudah-diklaim':'Hadiah sudah diklaim.','kedaluwarsa':'Surat sudah kedaluwarsa.','tidak-ada-hadiah':'Tidak ada hadiah untuk diklaim.','hadiah-belum-diklaim':'Klaim hadiahnya dulu sebelum menghapus surat.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','mode-lokal':'Masuk ke akun untuk memakai Mail.'};
const SET=()=>PD.settings();
const buzz=()=>{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const BUILT=['lobby.html','shop.html','profile.html','tambang.html','friendship.html','settings.html','powerup.html','frame.html','dadu.html','efek.html','karakter.html','mode.html','room.html','leaderboard.html','hadiah-misi.html','inventory.html'];
const FROM=(()=>{const f=new URLSearchParams(location.search).get('from');return f&&BUILT.includes(f.split('?')[0])?f:'lobby.html'})();

/* ---- state ---- */
let mails=[],tab='all',state='loading'; /* loading | ok | local | error */
const pending=m=>m.kind==='reward'&&!m.claimed;
const unreadN=()=>mails.filter(m=>!m.read).length,pendN=()=>mails.filter(pending).length;
const ago=at=>{const d=Math.floor((Date.now()-new Date(at).getTime())/864e5);return d<=0?'Hari ini':d===1?'Kemarin':d<7?d+' hari lalu':d<30?Math.floor(d/7)+' minggu lalu':Math.floor(d/30)+' bulan lalu'};
const rwHtml=m=>'<div class="rw">'+(m.gems?'<span><img src="'+IC+'ikon-gem-medali/berlian-hijau.webp" alt="">'+fmt(m.gems)+'</span>':'')+(m.coins?'<span><img src="'+IC+'hud/ikon-koin-emas.webp" alt="">'+fmt(m.coins)+'</span>':'')+'</div>';

/* ---- render ---- */
function renderCurrency(){$('#v-em').textContent=PD.walletReady()?fmt(PD.gems()):'—';$('#v-co').textContent=PD.walletReady()?fmt(PD.coins()):'—'}
function draw(){
  const un=unreadN(),pn=pendN(),ok=state==='ok';
  $('#tabs').innerHTML='<button class="tabb'+(tab==='all'?' on':'')+'" data-k="all">SEMUA'+(un?'<i>'+un+'</i>':'')+'</button><button class="tabb'+(tab==='reward'?' on':'')+'" data-k="reward">HADIAH'+(pn?'<i>'+pn+'</i>':'')+'</button><button class="tabb'+(tab==='system'?' on':'')+'" data-k="system">SISTEM</button>';
  $('#sum').textContent=ok?mails.length+' surat · '+un+' belum dibaca':state==='loading'?'Memuat…':'';
  $('#readAll').classList.toggle('dis',!(ok&&un));$('#claimAll').classList.toggle('dis',!(ok&&pn));
  const a=mails.filter(m=>tab==='all'||m.kind===tab);
  if(!ok){$('#list').innerHTML='<div class="empty">'+(state==='loading'?'Memuat…':state==='local'?'Masuk ke akun untuk membuka Mail.':'Tidak dapat terhubung ke server.<br><small style="font:800 28px var(--font-body)">Ketuk untuk coba lagi</small>')+'</div>';return}
  $('#list').innerHTML=a.length?a.map(m=>{
    const ico=m.kind==='reward'?'ikon-item/kado-merah':m.read?'glyph-putih/surat-terbuka':'ikon-item/surat-segel';
    const act=pending(m)?'<button class="btn sm ok" data-claim="'+m.id+'"><img src="'+IC+'tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span>KLAIM</span></button>':m.kind==='reward'?'<button class="btn sm off"><img src="'+IC+'tombol-dan-kontrol/tombol-abu-polos.webp" alt=""><span>DIKLAIM</span></button>':'';
    return '<div class="row mr'+(m.read?'':' unread')+'" data-open="'+m.id+'"><div class="mi"><img src="'+IC+ico+'.webp" alt=""></div><div class="grow"><div class="nm ttl">'+esc(m.title)+(m.read?'':'<i></i>')+'</div><div class="sb">'+esc(m.body)+'</div></div>'+(m.kind==='reward'?rwHtml(m):'')+act+'<div class="tm">'+ago(m.at)+'</div><button class="rm" data-del="'+m.id+'" aria-label="Hapus"><img src="'+IC+'glyph-putih/tong-sampah.webp" alt=""></button></div>'}).join('')
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
    if(r&&r.ok){mails=mails.filter(x=>x.id!==m.id);draw();toast('Surat dihapus')}else{fail(r);load()}
  });
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tabb');if(b){tab=b.dataset.k;draw()}});
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
  if(r&&r.ok){mails.forEach(m=>m.read=true);draw()}else fail(r);
});
$('#claimAll').addEventListener('click',async()=>{
  const r=await MS().claimAll();
  if(r&&r.ok){buzz();toast(r.count+' hadiah diklaim');await load();renderCurrency()}else{fail(r);if(r&&r.reason!=='sedang-diproses')load()}
});

/* ---- modal ---- */
let okFn=null,mOpen=false;
function modal(t,x,noL,okL,ok){$('#mt').textContent=t;$('#mx').innerHTML=x;$('#m-no span').textContent=noL;$('#m-ok span').textContent=okL;okFn=ok;$('#m-ok').style.display=okL?'':'none';$('#md').classList.add('on');mOpen=true}
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
try{if(!window.__curSub){window.__curSub=1;PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')try{renderCurrency()}catch(e){}})}}catch(e){}
UT.Events.on('currencyChanged',renderCurrency);

draw();renderCurrency();load();
setInterval(()=>{if(!document.hidden&&state==='ok'&&!mOpen)load()},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state==='ok'&&!mOpen)load()});
document.documentElement.classList.add('ut-ready');
if(SV()&&WS())WS().refresh().then(renderCurrency); /* saldo dari server */
})();
