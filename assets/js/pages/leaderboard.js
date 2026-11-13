/* leaderboard.js — dipindah dari <script> inline (leaderboard.html). */
(()=>{
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}addEventListener('resize',fit);fit();
/* Data = SERVER (RoomService.getLeaderboard -> RPC get_leaderboard). Tidak ada data contoh. Avatar pemain lain = tampilan asli dari server (AppearanceService). */
const PD=window.PlayerData,IC='assets/ng/komponen/';
const SV=()=>!!(PD.serverMode&&PD.serverMode()),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
const SET=()=>PD.settings();
const buzz=()=>{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FA=window.FrameAvatar;
const TABS=[['global','GLOBAL','bola-dunia-garis'],['teman','TEMAN','grup-pengguna'],['mingguan','MINGGUAN','jam-bulat']];
const SCOPE={global:'global',teman:'friends',mingguan:'weekly'};
const CHARS=['steve','alex','creeper','zombie','skeleton','villager','ender'];
const hash=s=>[...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
const myKey=()=>{try{const it=ItemCatalog.byId(PlayerData.equippedId('skin'));return it&&it.gameKey||'steve'}catch(e){return'steve'}};
/* wajah lama (UT.CharacterData) hanya cadangan bila CharacterFace tidak tersedia */
const oldFace=r=>UT.CharacterData.face('player',r.me?myKey():CHARS[hash(r.uid)%CHARS.length],{label:r.name});
/* Pemain lain = tampilan asli dari server (appearance_get_many); belum punya data = tampilan awal builder. 'Kamu' = tampilan aktif sendiri. */
const APP={},EMPTY={look:null,equipped:{},gear_dye:{}};let MEV=0;
const appKey=r=>String(r.uid||'').toLowerCase();
const face=r=>{const CF=UT.CharacterFace;if(!CF)return oldFace(r);
 if(r.me){const h=CF.html();if(h)return h}
 else{const u=CF.urlData(APP[appKey(r)]||EMPTY);if(u)return '<img src="'+u+'" alt="" draggable="false" style="width:100%;height:100%;object-fit:contain;display:block">'}
 return oldFace(r)};
const avatar=(r,sz)=>{const fid=r.me?FA.mine():(APP[appKey(r)]&&APP[appKey(r)].equipped&&APP[appKey(r)].equipped.frame)||undefined;
 return FA.wrap('<span class="av">'+face(r)+'</span>',sz+'px',fid)};
async function loadAppr(rows){
 try{const AS=UT.AppearanceService&&UT.AppearanceService.get();if(!AS)return;
  const ids=rows.filter(r=>!r.me&&r.uid&&!APP[appKey(r)]).map(r=>r.uid);if(!ids.length)return;
  const r=await AS.usersAppearance(ids);if(!r||!r.ok)return;Object.assign(APP,r.byId);draw()}catch(e){}}
/* baris sendiri memakai PlayerData: tarik tampilan/outfit aktif dari server dulu (tanpa membuka halaman Karakter) */
try{const A=PD.serverMode&&PD.serverMode()&&UT.AppearanceService&&UT.AppearanceService.get();if(A)A.refreshThrottled().catch(()=>{});
 if(PD.subscribe)PD.subscribe(r=>{if(r==='server-appearance'||r==='server-outfits'){MEV++;try{draw()}catch(e){}}})}catch(e){}

/* ---- state ---- */
let tab='global';
const CACHE={};   /* tab -> {state:'loading'|'ok'|'error', rows:[], at} */
const cur=()=>CACHE[tab]||{state:'loading',rows:[]};
async function load(t,force){
 const c=CACHE[t];
 if(c&&c.state==='ok'&&!force&&Date.now()-c.at<20000)return;
 CACHE[t]={state:'loading',rows:(c&&c.rows)||[]};if(t===tab)draw();
 try{
  await import('../../../assets/js/multiplayer/room-service.js');
  const rows=await UT.Multiplayer.RoomService.getLeaderboard(SCOPE[t],50);
  CACHE[t]={state:'ok',at:Date.now(),rows:(rows||[]).map(r=>({pos:Number(r.pos),uid:r.uid,name:r.pname,lv:r.lvl,score:Number(r.score),wins:r.wins,plays:r.plays,me:!!r.is_me}))};
 }catch(e){console.warn('[leaderboard] gagal memuat',e);CACHE[t]={state:'error',rows:(c&&c.rows)||[]}}
 if(t===tab)draw();
 if(CACHE[t].state==='ok')loadAppr(CACHE[t].rows);
}

/* ---- render ---- */
function renderCurrency(){$('#v-em').textContent=PD.walletReady()?fmt(PD.gems()):'—';$('#v-co').textContent=PD.walletReady()?fmt(PD.coins()):'—'}
function drawTabs(){$('#ltabs').innerHTML=TABS.map(t=>'<button class="lt'+(t[0]===tab?' on':'')+'" data-k="'+t[0]+'"><img class="ul" src="'+IC+'ikon-navigasi/garis-bawah-tab-emas.webp" alt=""><img class="ic" src="'+IC+'glyph-putih/'+t[2]+'.webp" alt=""><span>'+t[1]+'</span></button>').join('')}
function drawPodium(rows){
 const order=[1,0,2];
 $('#podium').innerHTML='<img class="pimg" src="'+IC+'leaderboard/podium-juara-voxel.webp" alt="">'+order.map(i=>{const p=rows[i];
  const sz=i===0?136:104;return '<div class="pd p'+(i+1)+(p?'':' empty')+'">'+(p?avatar(p,sz):'<span class="emp" style="width:'+sz+'px;height:'+sz+'px">?</span>')+'<div class="pn ttl">'+(p?esc(p.name)+(p.me?' ★':''):'Belum ada')+'</div><div class="ps">'+(p?fmt(p.score):'&nbsp;')+'</div></div>'}).join('')}
function drawMe(rows){
 const mine=rows.find(r=>r.me),L=PD.levelInfo(),nm=mine&&mine.name||PD.profile().name;
 const me=mine||{me:true,name:nm,uid:''};
 $('#mycard').innerHTML='<div class="row me"><div class="lbl ttl">POSISI KAMU</div>'+avatar(me,84)+'<div class="grow"><div class="nm ttl">'+esc(nm)+'</div><div class="sb">Lv. '+(mine&&mine.lv!=null?mine.lv:L.level)+' · '+(mine?fmt(mine.score)+' poin':'Belum masuk peringkat')+'</div></div><div class="big ttl">'+(mine?'#'+fmt(mine.pos):'—')+'</div></div>'}
function drawRows(c){
 const box=$('#rows'),note=t=>{box.innerHTML='<div class="empty">'+t+'</div>'};
 if(c.state==='loading'&&!c.rows.length)return note('Memuat peringkat…');
 if(c.state==='error'&&!c.rows.length)return note('Tidak dapat terhubung ke server.<br><small>Ketuk untuk coba lagi</small>');
 if(!c.rows.length)return note(tab==='teman'?'Belum ada temanmu yang bermain.<br><small>Tambah teman lewat menu Teman</small>':tab==='mingguan'?'Belum ada yang bermain minggu ini.':'Belum ada pemain di peringkat.<br><small>Selesaikan satu pertandingan untuk masuk</small>');
 box.innerHTML=c.rows.map(o=>'<div class="row rw'+(o.me?' me':'')+'" data-n="'+esc(o.name)+'" data-r="'+o.pos+'"><span class="no">'+fmt(o.pos)+'</span>'+avatar(o,64)+'<div class="grow"><div class="nm">'+esc(o.name)+(o.me?' (Kamu)':'')+'</div><div class="lv">Lv. '+esc(o.lv==null?'—':o.lv)+'</div></div><span class="sc">'+fmt(o.score)+'</span><span class="wn">'+(o.wins==null?'—':fmt(o.wins))+'</span></div>').join('')}
function draw(){
 const c=cur();drawTabs();drawPodium(c.rows);drawMe(c.rows);drawRows(c);renderCurrency()}

/* ---- aksi ---- */
$('#ltabs').addEventListener('click',e=>{const b=e.target.closest('.lt');if(!b||tab===b.dataset.k)return;tab=b.dataset.k;buzz();draw();load(tab)});
$('#rows').addEventListener('click',e=>{
 const r=e.target.closest('.rw');if(r){buzz();toast(r.dataset.n+' — peringkat #'+r.dataset.r);return}
 if(cur().state==='error'&&!cur().rows.length)load(tab,true)});
let okFn=null,mOpen=false;
function modal(t,x){$('#mt').textContent=t;$('#mx').innerHTML=x;$('#md').classList.add('on');mOpen=true}
const closeM=()=>{$('#md').classList.remove('on');mOpen=false};
$('#m-no').addEventListener('click',closeM);
$('#md').addEventListener('click',e=>{if(e.target.id==='md')closeM()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&mOpen)closeM()});
$('#reward').addEventListener('click',()=>{buzz();modal('Hadiah Peringkat','Hadiah peringkat musiman<br>segera hadir.')});

/* ---- navigasi + dompet ---- */
$('#back').addEventListener('click',()=>nav('lobby.html'));
$('#cur-em').addEventListener('click',()=>nav('tambang.html?from=leaderboard.html'));
$('#cur-co').addEventListener('click',()=>nav('shop.html?coin=1'));
try{if(!window.__curSub){window.__curSub=1;PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')try{renderCurrency()}catch(e){}})}}catch(e){}
UT.Events.on('currencyChanged',renderCurrency);
UT.Events.on('frameChanged',()=>draw());

draw();load(tab);
addEventListener('pageshow',e=>{if(e.persisted)load(tab,true)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!mOpen)load(tab,true)});
if(SV()&&UT.LiveSync){const LS=UT.LiveSync;
 LS.add('wallet',()=>{const W=WS();return W?W.refresh():{ok:true}});
 LS.add('board',()=>load(tab,true).then(()=>({ok:cur().state==='ok'})),{minGap:20000});
 LS.start({interval:20000});
}
document.documentElement.classList.add('ut-ready');
if(SV()&&WS())WS().refresh().then(renderCurrency); /* saldo dari server */
})();
