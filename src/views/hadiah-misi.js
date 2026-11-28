/* hadiah-misi.js — dipindah dari blok script inline (hadiah-misi.html). Tahap 3 SPA: dibungkus UT.PageModule ('hadiah-misi'); halaman mandiri otomatis mount,
   unmount() melepas timer, listener, langganan (PlayerData, Events) dan LiveSync. Callback async dijaga env.disposed (DOM view sudah dibuang saat callback selesai). */
UT.PageModule.define('hadiah-misi',function(env){
const {setTimeout,clearTimeout,setInterval,addEventListener}=env;
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
function fit(){const st=$('#stage'),k=Math.min(innerWidth/1920,innerHeight/1080)||1;st.style.transform='scale('+k+')';st.style.setProperty('--hub-ex',Math.max(0,(innerWidth/k-1920)/2).toFixed(1)+'px');st.style.setProperty('--hub-ey',Math.max(0,(innerHeight/k-1080)/2).toFixed(1)+'px')}  /* --hub-ex/--hub-ey: bingkai #pmodal penuh sampai tepi layar (sama dengan Profil/Aura/Pet) */addEventListener('resize',fit);fit();
/* transparansi panel (Pengaturan -> slider, Prefs 'panelTransparency'): 0% pekat .. 70%; bawaan 16% — sama seperti Shop/Pet/Aura/hub */
function applyPanelAlpha(){try{let t=parseInt(UT.Prefs.get('panelTransparency',16),10);if(!isFinite(t))t=16;document.documentElement.style.setProperty('--panel-a',(1-Math.max(0,Math.min(70,t))/100).toFixed(2))}catch(e){}}
applyPanelAlpha();
try{if(UT.Prefs&&UT.Prefs.on)env.own(UT.Prefs.on(n=>{if(n==='panelTransparency')applyPanelAlpha()}))}catch(e){}
/* Semua status & klaim = SERVER: hadiah harian (daily_reward_get / claim_daily_reward) dan misi (quest_get / quest_claim*) lewat UT.WalletService.
   Hari reset = WIB. Klien hanya menampilkan; nominal & item ditentukan server. Tanpa akun login: hanya ajakan masuk, tidak ada data tiruan. */
const PD=window.PlayerData,IC='assets/images/ui/',Q=UT.Quest,AC=UT.Achievement;
const SV=()=>!!(PD.serverMode&&PD.serverMode()),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SET=()=>PD.settings();
const buzz=()=>{if(SET().vibration&&navigator.vibrate)navigator.vibrate(20)};
const playSound=n=>{try{if(SET().sound)UT.Audio.play(n==='claim'?'power':n==='chest'?'chest':'button')}catch(e){}};
let rewardFxSequence=0;
function rewardBurst(el,kind,tier){
 const PF=UT.ParticleFX,FX=UT.GameplayFX;if(!el||!PF||typeof PF.burstFromElement!=='function')return;
 const styles={
  coin:{count:12,tier:'L1',colors:['#ffd24a','#fff3ad','#e99b26'],shape:'bar',distance:48,size:7},
  gem:{count:12,tier:'L2',colors:['#55ddff','#b8f5ff','#7a9dff'],shape:'square',distance:54,size:7},
  mixed:{count:16,tier:'L3',colors:['#ffd24a','#55ddff','#fff3ad','#b8f5ff'],shape:'square',distance:58,size:7},
  chest:{count:14,tier:'L2',colors:['#ffd24a','#fff3ad','#d99c4a'],shape:'square',distance:56,size:8},
  item:{count:14,tier:'L3',colors:['#c9a0ff','#ffe5a0','#ffffff'],shape:'bar',distance:60,size:7},
  legendary:{count:18,tier:'L4',colors:['#ffe27a','#ffffff','#b7a2ff','#ffd24a'],shape:'square',distance:68,size:8}
 };
 const s=styles[kind]||styles.mixed,seq=++rewardFxSequence,seed=Math.imul(seq,2654435761)>>>0,actualTier=tier||s.tier;
 if(FX&&typeof FX.n==='function'&&typeof FX.limit==='function'&&typeof PF.configure==='function')PF.configure({maxParticles:FX.limit(),maxBurst:FX.n(18,'L4')});
 PF.burstFromElement(el,Object.assign({},s,{count:FX&&typeof FX.n==='function'?FX.n(s.count,actualTier):s.count,duration:620,seed,fid:'reward-claim-'+seq}));
}
let tt;function toast(m){if(env.disposed)return;const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
/* di shell (play.html) SEMUA target lewat UT.Spa.go (view atau iframe) agar shell tidak ditinggalkan; halaman mandiri: fade 330 ms lalu pindah halaman biasa */
const nav=u=>{if(UT.Spa&&UT.Spa.go){UT.Spa.go(u);return}$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const WM={'jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','sudah-klaim':'Sudah diklaim.','belum-selesai':'Misi belum selesai.','terkunci':'Selesaikan semua misi dulu.','mode-lokal':'Masuk ke akun untuk mengklaim.'};
const bump=()=>['#cur-em','#cur-co'].forEach(s=>{const e=$(s);e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')});

/* ---- tab ---- */
/* di shell location.search milik play.html (?go=...): parameter halaman (?tab=) diambil dari URL rute aktif */
const search=()=>{const c=UT.Spa&&UT.Spa.current&&UT.Spa.current();if(c&&c.name==='hadiah-misi'){const i=c.url.indexOf('?');return i<0?'':c.url.slice(i).split('#')[0]}return location.search};
const Q0=new URLSearchParams(search()).get('tab');
let tab=(Q0==='misi'||Q0==='daily')?'misi':(Q0==='ach'||Q0==='achievement')?'ach':'hadiah';

/* ---- hadiah harian (server) ---- */
let SD=null,DRESET=0,dbusy=false,dScrolled=false;
/* Label hadiah login 30 hari. Nominal SEBENARNYA diputuskan server (_daily_reward_for di supabase/migrations/202611390001_daily_reward_30.sql);
   tests/daily-reward-30.test.js menjaga keduanya tetap sama. Bolos 1 hari (WIB) = ulang dari Hari 1 (streak ketat, dihitung server). */
const DAYS=30,C1='item-icons/koin-tumpuk',C2='gem-medal-icons/kantong-koin',GM='gem-medal-icons/berlian-biru',BX='chest-packs/peti-kayu';
const R=[
 {t:'300 Coin',ic:C1},{t:'500 Coin',ic:C2},{t:'Mystery Box ×1',ic:BX},{t:'5 Gem',ic:GM},{t:'800 Coin',ic:C1},{t:'10 Gem',ic:GM},{t:'2.000 Coin + 15 Gem',ic:C2},
 {t:'400 Coin',ic:C1},{t:'600 Coin',ic:C2},{t:'8 Gem',ic:GM},{t:'1.000 Coin',ic:C1},{t:'Mystery Box ×1',ic:BX},{t:'12 Gem',ic:GM},{t:'3.000 Coin + 20 Gem',ic:C2},
 {t:'500 Coin',ic:C1},{t:'700 Coin',ic:C2},{t:'10 Gem',ic:GM},{t:'1.200 Coin',ic:C1},{t:'Mystery Box ×1',ic:BX},{t:'15 Gem',ic:GM},{t:'4.000 Coin + 25 Gem',ic:C2},
 {t:'600 Coin',ic:C1},{t:'800 Coin',ic:C2},{t:'12 Gem',ic:GM},{t:'Frame Misteri',ic:'item-icons/frame-misteri',fm:1},{t:'Mystery Box ×1',ic:BX},{t:'18 Gem',ic:GM},{t:'3.000 Coin + 20 Gem',ic:C2},
 {t:'2.000 Coin',ic:C1},{t:'6.000 Coin + 50 Gem',ic:'chest-packs/peti-emas'}];
function applyDaily(r){if(!r||!r.ok)return false;SD={claimed:+r.claimed||0,today:!!r.claimed_today,box:+r.box||0};DRESET=Date.now()+(+r.seconds_to_reset||0)*1000;return true}
const dState=i=>!SD?'wait':i<SD.claimed?'done':(i===SD.claimed&&!SD.today&&SD.claimed<DAYS)?'now':'wait';
const dayNow=()=>!!SD&&!SD.today&&SD.claimed<DAYS;
async function reloadD(){const w=WS();if(!w)return;const d=await w.dailyGet();if(env.disposed)return;if(applyDaily(d))render()}
async function claimDay(target){
 if(dbusy)return;if(!SV()){toast(WM['mode-lokal']);return}
 dbusy=true;
 try{const w=WS(),r=w?await w.claimDaily():{ok:false,reason:'jaringan'};
  if(env.disposed)return;
  if(!r.ok){toast(WM[r.reason]||'Klaim gagal.');await reloadD();return}
  const row=R[(r.day||1)-1]||R[0];let msg=row.t;
  if(r.type==='box')msg='Mystery Box ×1 diterima! Buka lewat halaman Hadiah Harian.';
  else if(r.type==='powerup')msg=row.t+' diterima (Power)';
  /* Hari 30: frame eksklusif (tidak dijual, jadi tidak ada spoiler di kalender/Toko). Baru terungkap di sini setelah diklaim. */
  const fi=r.item&&UT.ItemCatalog&&UT.ItemCatalog.byId?UT.ItemCatalog.byId(r.item):null;
  if(r.item)msg+='<br>+ '+(fi?fi.name:'Frame eksklusif')+' masuk ke Frame-mu!';
  applyDaily({ok:true,claimed:r.day,claimed_today:true,box:(SD?SD.box:0)+(r.box?1:0),seconds_to_reset:r.seconds_to_reset});
  playSound('claim');buzz();bump();render();renderCurrency();
  modal('Hadiah Diklaim!','<img class="mi'+(row.cls?' '+row.cls:'')+'" src="'+(fi&&fi.image?fi.image:IC+row.ic+'.webp')+'" alt="">'+msg);
  rewardBurst($('#box'),r.type==='box'?'chest':r.type==='powerup'?'item':r.gems>0?(r.coins>0?'mixed':'gem'):'coin')}
 finally{dbusy=false}}
function vHadiah(){
 let h='';
 if(!SV())h+='<div class="msg">Masuk ke akun untuk<br>mengklaim hadiah harian.</div>';
 h+='<div class="dlist scr" id="dlist"><div class="dgrid">';
 R.forEach((d,i)=>{const n=i+1,st=dState(i),ms=n%7===0,grand=n===DAYS;
  const vr=st==='now'?' hp':(ms||grand)?' gold':'';
  h+='<div class="dc ut-sc'+vr+(st==='done'?' off':'')+' '+st+(ms?' ms':'')+(d.fm?' fm':'')+(grand?' grand':'')+'" data-i="'+i+'"><span class="ut-sc-l">Hari '+n+(d.x?' · '+d.x:'')+'</span><span class="ut-sc-ico"><img class="di '+(d.cls||'')+'" src="'+(d.src||IC+d.ic+'.webp')+'" alt=""></span><span class="ut-sc-v dt">'+d.t+'</span>'+(st==='done'?'<img class="ck" src="'+IC+'white-glyphs/centang.webp" alt="">':'')+'</div>'});
 h+='</div></div><div class="foot" style="bottom:20px"><div class="note">'+(SD?'Login tiap hari tanpa bolos · Reset 00.00 WIB : <span style="color:#ff6f8d" id="rs">'+resetIn(DRESET)+'</span>':'')+'</div>'+(dayNow()?'<button class="btn cl ut-gl ut-c-y" data-day="1"><img src="'+IC+'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>KLAIM</span></button>':'')+'</div>';
 return h}

/* ---- misi harian (server) ---- */
let QS=null,QRESET=0,qbusy=false;
const QI={login:'item-icons/kalender',play:'item-icons/pedang-silang',win:'item-icons/piala',dice:'white-glyphs/dadu',ladder:'achievement/ach-tangga',dragon:'achievement/ach-naga',chest:'chest-packs/peti-kayu',skill:'achievement/ach-pedang'};
function applyQ(r){if(!r||!Array.isArray(r.quests))return false;QS=r;QRESET=Date.now()+(+r.seconds_to_reset||0)*1000;return true}
const qList=()=>QS?QS.quests.map(q=>{const d=Q.DEFS.find(x=>x.id===q.id)||{};return{id:q.id,title:d.title||q.id,desc:d.desc||'',goal:q.goal,reward:q.reward,progress:Math.min(q.goal,q.progress),status:q.status}}):[];
const bonusSt=()=>QS?QS.bonus.status:'locked',bonusRw=()=>QS?QS.bonus.reward:Q.BONUS;
async function reloadQ(){const w=WS();if(!w)return;const q=await w.questGet();if(env.disposed)return;if(applyQ(q)){await w.refresh();if(env.disposed)return;render()}}
async function srvClaim(call,onOk){
 if(qbusy)return;if(!SV()){toast(WM['mode-lokal']);return}
 qbusy=true;try{const r=await call(WS());if(env.disposed)return;if(r&&r.ok)onOk(r);else toast(WM[r&&r.reason]||'Gagal klaim, coba lagi');await reloadQ()}finally{qbusy=false}render();renderCurrency()}
function vMisi(){
 const L=qList(),rdyN=L.filter(q=>q.status==='ready').length,bs=bonusSt();
 if(!QS)return '<div class="msg">'+(SV()?'Memuat misi…':'Masuk ke akun untuk<br>membuka misi harian.')+'</div>';
 let h='<div class="hdr ut-sc hp"><span class="ut-sc-ico alas"><img src="'+IC+'item-icons/gulungan-pena.webp" alt=""></span><div class="ut-sc-info"><span class="ut-sc-l">Selesaikan semua misi harian</span><span class="ut-sc-v">MISI HARIAN</span>'+
   '<span class="rs ut-sc-l"><img src="'+IC+'missions/ikon-jam-weker.webp" alt="">Reset dalam : <b id="rs">'+resetIn(QRESET)+'</b></span></div>'+
   (bs==='ready'?'<button class="btn cl sm ut-gl ut-c-y" data-bonus="1"><img src="'+IC+'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>KLAIM</span></button>':'')+
   '<span class="rbox ut-sc-ico" style="'+(bs==='claimed'?'opacity:.5':'')+'"><img src="'+IC+'hud/ikon-koin-emas.webp" alt=""><b>'+fmt(bonusRw())+'</b></span></div>';
 h+='<div class="qlist scr" id="qlist">';
 L.forEach((q,i)=>{const ready=q.status==='ready',cl=q.status==='claimed';
   h+='<div class="row ut-sc'+(ready?' hp ready':'')+(cl?' off fin':'')+'">'+(ready?'<div class="rbadge"><img src="'+IC+'missions/lencana-notifikasi-merah-segi-delapan.webp" alt=""><b>!</b></div>':'')+
    '<span class="ut-sc-ico"><img class="ri" src="'+IC+(QI[q.id]||'item-icons/gulungan-pena')+'.webp" alt=""></span><div class="ut-sc-info"><span class="ut-sc-l">'+esc(q.desc)+'</span><span class="ut-sc-v">'+esc(q.title)+'</span>'+
    '</div>'+(ready?'':'<span class="pt ut-sc-v">'+q.progress+' / '+q.goal+'</span>')+
    (ready?'<span class="rbox ut-sc-ico">'+'<img src="'+IC+'hud/ikon-koin-emas.webp" alt="">'+'<b>'+fmt(q.reward)+'</b></span><button class="btn cl ut-gl ut-c-y" data-q="'+esc(q.id)+'"><img src="'+IC+'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>KLAIM</span></button>'
     :'<span class="rbox ut-sc-ico '+(cl?'done':'')+'"><img src="'+IC+(cl?'white-glyphs/centang':'hud/ikon-koin-emas')+'.webp" alt=""><b>'+(cl?'SELESAI':fmt(q.reward))+'</b></span>')+'</div>'});
 h+='</div>';
 const all=L.length&&L.every(q=>q.status==='claimed');
 h+='<div class="foot"><div class="note">'+(rdyN?rdyN+' misi siap diklaim':all?(bs==='claimed'?'Semua hadiah hari ini sudah diklaim':bs==='ready'?'Bonus siap diklaim!':''):'Selesaikan semua misi untuk bonus '+fmt(bonusRw())+' Coin + 3 Emerald')+'</div>'+
  (rdyN?'<button class="btn cl wide ut-gl ut-c-y" data-qall="1"><img src="'+IC+'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>KLAIM SEMUA</span></button>':'')+'</div>';
 return h}

/* ---- achievement (server: get_my_profile + claim_achievement) ---- */
let SP=null,SPS='loading',abusy=false;   /* SP = get_my_profile; SPS: loading | ok | error */
const AI={peti:'chest-packs/peti-emas',naga:'achievement/ach-naga',aktif:'item-icons/gerbang-dungeon',menang:'achievement/ach-piala',tangga:'achievement/ach-tangga',ular:'achievement/ach-ular',skill:'achievement/ach-pedang',dadu:'feature-icons/dadu',papan:'achievement/ach-bumi',login:'achievement/ach-kalender',streak:'item-icons/podium',skin:'achievement/ach-buku',emerald:'gem-medal-icons/berlian-hijau',strategi:'achievement/ach-kuda',legenda:'gem-medal-icons/medali-1',boss:'gem-medal-icons/medali-2',teman:'gem-medal-icons/medali-3',level:'gem-medal-icons/petir-emas'};
const ownedSkinN=()=>{try{return PD.ownedItems().filter(o=>o.item.kind==='skin').length}catch(e){return 0}};
const aList=()=>AC.info(SP);
async function loadSP(){
 if(!SV())return;
 try{await import('../multiplayer/progress-service.js');const sp=await UT.Multiplayer.Progress.getMyProfile();
  if(env.disposed)return;
  if(sp){SP=sp.exists?sp:{counters:{},claims:{}};SPS='ok'}else if(SPS!=='ok')SPS='error'}
 catch(e){if(env.disposed)return;console.warn('[achievement] gagal memuat',e);if(SPS!=='ok')SPS='error'}
 render()}
async function claimAch(id,target){
 const a=aList().find(x=>x.id===id);if(!a||a.pend<1||abusy)return;abusy=true;
 try{await import('../multiplayer/progress-service.js');
  const r=await UT.Multiplayer.Progress.claimAchievement(id,null),stars=Math.min(3,+(r&&r.stars)||0);
  if(env.disposed)return;
  if(!r||!r.ok){SP=Object.assign({},SP,{claims:Object.assign({},SP&&SP.claims,{[id]:Math.max(a.cl,+(r&&r.claimed)||0)})});toast('Belum ada reward untuk diklaim');return}
  SP=Object.assign({},SP,{claims:Object.assign({},SP&&SP.claims,{[id]:stars})});
  PD.applyServerWallet({coins:r.wallet_coins,gems:r.wallet_gems});
  const rw=AC.reward(a.cl,stars,a.rew),def=AC.ACH.find(x=>x[0]===id),rank=def&&def[5]==='legendaris'?'legendary':'mixed';playSound('claim');buzz();bump();toast('+'+fmt(rw[0])+' Coin  +'+fmt(rw[1])+' Emerald');rewardBurst(target,rank)}
 catch(e){if(env.disposed)return;console.warn('[achievement] klaim gagal',e);toast('Butuh koneksi untuk klaim.')}
 finally{abusy=false;render();renderCurrency()}}
function vAch(){
 if(!SV())return '<div class="msg">Masuk ke akun untuk<br>melihat pencapaian.</div>';
 if(SPS==='loading')return '<div class="msg">Memuat pencapaian…</div>';
 if(SPS==='error')return '<div class="msg">Tidak dapat terhubung ke server.<small>Ketuk untuk coba lagi</small></div>';
 return '<div class="alist scr" id="alist">'+aList().map(a=>{
  const ready=a.pend>0,fin=a.done&&a.cl>=3,rw=ready?AC.reward(a.cl,a.st,a.rew):a.rew[Math.min(a.st,2)],g=a.tg;
  const two=(c,e)=>'<span><img src="'+IC+'hud/ikon-koin-emas.webp" alt=""><b>'+fmt(c)+'</b></span><span><img src="'+IC+'gem-medal-icons/berlian-hijau.webp" alt=""><b>'+fmt(e)+'</b></span>';
   return '<div class="row ach ut-sc'+(ready?' hp ready':'')+(fin?' off fin':'')+'">'+(ready?'<div class="rbadge"><img src="'+IC+'missions/lencana-notifikasi-merah-segi-delapan.webp" alt=""><b>!</b></div>':'')+
    '<span class="ut-sc-ico"><img class="ri" src="'+IC+(AI[a.id]||'item-icons/piala')+'.webp" alt=""></span><div class="ut-sc-info"><span class="ut-sc-l">'+esc(a.desc)+' '+fmt(g)+'×</span><span class="ut-sc-v">'+esc(a.name)+'</span>'+
    '</div>'+'<div class="stars">'+[0,1,2].map(k=>'<img src="'+IC+'stage-chapter/bintang-stage-'+(k<a.st?'emas':'kosong')+'.webp" alt="">').join('')+'</div>'+(ready?'':'<span class="pt ut-sc-v">'+fmt(Math.min(a.v,g))+' / '+fmt(g)+'</span>')+
    (ready?'<span class="rbox two ut-sc-ico">'+two(rw[0],rw[1])+'</span><button class="btn cl ut-gl ut-c-y" data-a="'+esc(a.id)+'"><img src="'+IC+'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>KLAIM</span></button>'
     :'<span class="rbox two ut-sc-ico '+(fin?'done':'')+'">'+(fin?'<img src="'+IC+'white-glyphs/centang.webp" alt=""><b>SELESAI</b>':two(rw[0],rw[1]))+'</span>')+'</div>'}).join('')+'</div>'}

/* ---- util + render ---- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function resetIn(at){const s=Math.max(0,Math.ceil((at-Date.now())/1000));return [s/3600|0,(s%3600)/60|0,s%60].map(v=>String(v).padStart(2,'0')).join(':')}
const badge=n=>n?'<span class="bd"><img src="'+IC+'missions/lencana-notifikasi-merah-segi-delapan.webp" alt=""><b>'+n+'</b></span>':'';
const cnt={misi:()=>qList().filter(q=>q.status==='ready').length+(bonusSt()==='ready'?1:0),hadiah:()=>dayNow()?1:0,ach:()=>SPS==='ok'?aList().filter(a=>a.pend>0).length:0};
function renderCurrency(){if(env.disposed)return;{const em=$('#v-em'),co=$('#v-co');if(em)em.textContent=PD.walletReady()?fmt(PD.gems()):'—';if(co)co.textContent=PD.walletReady()?fmt(PD.coins()):'—'}}
function render(){
 if(env.disposed)return;
 const L=[['hadiah','HADIAH','item-icons/kado-merah'],['misi','MISI','missions/ikon-tab-harian-centang'],['ach','PENCAPAIAN','missions/ikon-tab-pencapaian-medali']];
 $('#tabs').innerHTML=L.map(a=>'<button class="tab ut-tab'+(tab===a[0]?' on':'')+'" type="button" role="tab" data-k="'+a[0]+'" aria-selected="'+(tab===a[0])+'"><img class="ic" src="'+IC+a[2]+'.webp" alt=""><span class="lb">'+a[1]+'</span>'+badge(cnt[a[0]]())+'</button>').join('');
 const sc=($('#alist')||{}).scrollTop||0, qsc=($('#qlist')||{}).scrollTop||0, dsc=($('#dlist')||{}).scrollTop||0;
 $('#body').innerHTML=tab==='misi'?vMisi():tab==='ach'?vAch():vHadiah();
 const al=$('#alist');if(al)al.scrollTop=sc;
 const ql=$('#qlist');if(ql)ql.scrollTop=qsc;
 const dl=$('#dlist');if(dl){if(!dScrolled&&SD){const cur=dl.querySelector('.dc.now')||dl.querySelector('.dc.wait');if(cur)dl.scrollTop=Math.max(0,cur.offsetTop-24);dScrolled=true}else dl.scrollTop=dsc}
 $('#title').textContent=tab==='misi'?'Misi Harian':tab==='ach'?'Pencapaian':'Hadiah Harian';
 renderCurrency()}

/* ---- modal ---- */
let mOpen=false;
function modal(t,x){if(env.disposed)return;$('#mt').textContent=t;$('#mx').innerHTML=x;$('#md').classList.add('on');mOpen=true}
const closeM=()=>{$('#md').classList.remove('on');mOpen=false};
$('#m-ok').addEventListener('click',closeM);
$('#md').addEventListener('click',e=>{if(e.target.id==='md')closeM()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&mOpen)closeM()});

/* ---- aksi ---- */
function setTab(k){tab=k;if(!(UT.Spa&&UT.Spa.go)){try{history.replaceState(null,'','?tab='+k)}catch(e){}}   /* di shell URL milik play.html: jangan diubah */
 render();if(k==='misi'&&!setTab.t){setTab.t=1;trackLogin()}}
function trackLogin(){const w=WS();if(SV()&&w)w.questTrack('login').then(()=>reloadQ())}   /* membuka Misi = login hari ini (dilaporkan ke server) */
$('#tabs').addEventListener('click',e=>{const t=e.target.closest('.tab');if(t&&t.dataset.k!==tab){buzz();setTab(t.dataset.k)}});
$('#body').addEventListener('click',e=>{
 if(tab==='ach'&&SPS==='error'&&!e.target.closest('button')){SPS='loading';render();loadSP();return}
 const dc=e.target.closest('.dc');
 if(dc&&tab==='hadiah'){const st=dState(+dc.dataset.i);if(st==='now')claimDay(dc);else if(SD)toast(st==='done'?'Hadiah sudah diklaim.':+dc.dataset.i>SD.claimed?'Belum waktunya, login besok!':'Sudah klaim hari ini, kembali besok!');return}
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.a)claimAch(b.dataset.a,b);
 else if(b.dataset.day)claimDay(b);
 else if(b.dataset.q)srvClaim(w=>w.questClaim(b.dataset.q),r=>{playSound('claim');buzz();bump();toast('+'+fmt(r.coins)+' Coin diterima!');rewardBurst(b,r.gems>0?'mixed':'coin')});
 else if(b.dataset.qall)srvClaim(w=>w.questClaimAll(),r=>{playSound('claim');buzz();bump();toast('+'+fmt(r.coins)+' Coin diterima!');rewardBurst(b,r.gems>0?'mixed':'coin')});
 else if(b.dataset.bonus)srvClaim(w=>w.questClaimBonus(),r=>{playSound('chest');buzz();bump();toast('Bonus +'+fmt(r.coins)+' Coin +'+fmt(r.gems||0)+' Emerald diterima!');rewardBurst(b,r.gems>0?'mixed':'coin')})});

/* ---- navigasi + dompet ---- */
$('#back').addEventListener('click',()=>nav('lobby.html'));
$('#cur-em').addEventListener('click',()=>nav('tambang.html?from=hadiah-misi.html'));
$('#cur-co').addEventListener('click',()=>nav('shop.html?coin=1'));
/* penjaga window.__curSub dihapus: dengan SPA langganan harus dipasang tiap mount dan dilepas saat unmount */
try{env.own(PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')try{renderCurrency()}catch(e){}}))}catch(e){}
env.own(UT.Events.on('currencyChanged',renderCurrency));

/* ---- hitung mundur (hari reset WIB) ---- */
let rf=0;
setInterval(()=>{
 const el=$('#rs'),at=tab==='misi'?QRESET:DRESET;if(el)el.textContent=resetIn(at);
 if(SD&&Date.now()>=DRESET&&!rf){rf=1;reloadD().finally(()=>setTimeout(()=>{rf=0},3000))}
 if(QS&&Date.now()>=QRESET&&!rf){rf=1;reloadQ().finally(()=>setTimeout(()=>{rf=0},3000))}
},1000);
env.on(document,'visibilitychange',()=>{if(!document.hidden&&SV()&&!mOpen){reloadD();if(tab==='misi'||QS)reloadQ();loadSP()}});

render();
document.documentElement.classList.add('ut-ready');
if(SV()&&WS()){
 WS().refresh().then(()=>{if(!env.disposed)renderCurrency()});          /* saldo dari server */
 reloadD();                                     /* hadiah harian */
 if(tab==='misi'){setTab.t=1;trackLogin()}else reloadQ();
 loadSP();
 if(UT.LiveSync){UT.LiveSync.add('wallet',()=>WS().refresh());UT.LiveSync.add('ach',()=>loadSP().then(()=>({ok:SPS==='ok'})),{minGap:30000});UT.LiveSync.start({interval:20000});
  /* LiveSync bersifat global: lepas tugas halaman ini dan hentikan saat keluar (halaman berikut memulai ulang sendiri) */
  env.own(()=>{UT.LiveSync.remove('wallet');UT.LiveSync.remove('ach');UT.LiveSync.stop()})}
}
});
