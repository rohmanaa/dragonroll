/* misi.js — dipindah dari <script> inline (misi.html). */
(()=>{
const $=s=>document.querySelector(s),fmt=n=>n.toLocaleString('id-ID'),PD=window.PlayerData,Q=UT.Quest;
/* B5: akun login + flag -> misi dari SERVER (hari WIB). QS = hasil quest_get; progres login dilaporkan ke server, hadiah dihitung server. */
const SV=()=>PD.serverMode(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
let QS=null,RESET_AT=0,busy=false;
const SRV=()=>SV()&&!!QS;
function applyQ(r){if(!r||!Array.isArray(r.quests))return false;QS=r;RESET_AT=Date.now()+(+r.seconds_to_reset||0)*1000;return true}
const qList=()=>SRV()?QS.quests.map(q=>{const d=Q.DEFS.find(x=>x.id===q.id)||{};return{id:q.id,title:d.title||q.id,desc:d.desc||'',goal:q.goal,reward:q.reward,icon:d.icon||'items/dadu',progress:Math.min(q.goal,q.progress),status:q.status}}):[];
const qBonusState=()=>SRV()?QS.bonus.status:'locked';
const qBonus=()=>SRV()?QS.bonus.reward:Q.BONUS;
const WM={'jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','sudah-klaim':'Sudah diklaim.','belum-selesai':'Misi belum selesai.','terkunci':'Selesaikan semua misi dulu.'};
async function reloadQ(){const w=WS();if(!w)return;if(applyQ(await w.questGet())){await w.refresh();render()}}
/* Jalankan klaim server lalu muat ulang misi + saldo; fn dipanggil dengan hasil RPC. */
async function srvClaim(call,onOk){if(busy)return;busy=true;try{const r=await call(WS());if(r&&r.ok)onOk(r);else toast(WM[r&&r.reason]||'Gagal klaim, coba lagi');await reloadQ()}finally{busy=false}render()}
const IMG=p=>'<img class="ic" src="assets/Images/icon/'+p+'.webp" alt="" draggable="false" decoding="async">';
const COIN=IMG('currency/coin');
const SFX={click:'button',claim:'power',chest:'chest'};
function playSound(n){try{if(!PD.settings().sound)return;UT.Audio.play(SFX[n]||'button')}catch(e){}}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
function pulse(sel){const e=$(sel);if(!e)return;e.classList.remove('pulse');void e.offsetWidth;e.classList.add('pulse')}

function renderCurrency(){try{$('#gemV').textContent=(PD.walletReady()?fmt(PD.gems()):'—');$('#coinV').textContent=(PD.walletReady()?fmt(PD.coins()):'—')}catch(e){}}
function render(){
 const L=qList();
 $('#cntT').textContent=L.length+' Misi';
 $('#list').innerHTML=L.map(q=>{
  const pct=Math.round(q.progress/q.goal*100);
  const act=q.status==='ready'?'<button class="cbtn" data-claim="'+q.id+'">Klaim</button>'
          :q.status==='claimed'?'<div class="done-tag"><svg width="20" height="20" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" fill="none" stroke="#9fe08f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>Diklaim</div>':'';
  return '<div class="row '+q.status+'"><div class="ri">'+IMG(q.icon)+'</div><div class="tx"><b>'+q.title+'</b><small>'+q.desc+'</small><div class="bar"><i style="width:'+pct+'%"></i><span>'+q.progress+'/'+q.goal+'</span></div></div><div class="rw">'+(q.status==='todo'?'<small>Reward:</small>':'')+'<div class="amt">'+COIN+'<b>'+q.reward+'</b></div>'+act+'</div></div>';
 }).join('');
 $('#totV').textContent=fmt(L.reduce((a,q)=>a+q.reward,0));
 const can=L.some(q=>q.status==='ready'),ca=$('#claimAll');
 ca.disabled=!can;ca.classList.toggle('off',!can);
 $('#bnV').textContent=fmt(qBonus());
 const bs=qBonusState(),cb=$('#claimBonus');
 cb.disabled=bs!=='ready';cb.classList.toggle('off',bs!=='ready');
 cb.textContent=bs==='claimed'?'Sudah Diklaim':'Klaim Bonus';
 $('#chest').classList.toggle('glow',bs==='ready');
 renderCurrency();
}
function tick(){const s=SRV()?Math.max(0,Math.ceil((RESET_AT-Date.now())/1000)):0;
 if(SRV()&&s===0&&!tick.rf){tick.rf=1;reloadQ().finally(()=>setTimeout(()=>{tick.rf=0},3000))}
 $('#cd').textContent=[s/3600|0,(s%3600)/60|0,s%60].map(v=>String(v).padStart(2,'0')).join(':');
 if(tick.d!==undefined&&s>tick.last+5){render()} /* lewat tengah malam: misi baru */
 tick.last=s;tick.d=1}
function bumpMis(){} /* missions_done kini dihitung server di quest_claim / quest_claim_all (S2) */
$('#list').addEventListener('click',e=>{const b=e.target.closest('[data-claim]');if(!b)return;
 if(!SV()){toast('Silakan login untuk klaim misi.');return}
 srvClaim(w=>w.questClaim(b.dataset.claim),r=>{bumpMis(1);playSound('claim');pulse('#coin');toast('+'+fmt(r.coins)+' Coin diterima!')});});
$('#claimAll').addEventListener('click',()=>{if(!SV()){toast('Silakan login untuk klaim misi.');return}srvClaim(w=>w.questClaimAll(),r=>{bumpMis(r.count||1);playSound('claim');pulse('#coin');toast('+'+fmt(r.coins)+' Coin diterima!')})});
$('#claimBonus').addEventListener('click',()=>{if(!SV()){toast('Silakan login untuk klaim misi.');return}srvClaim(w=>w.questClaimBonus(),r=>{playSound('chest');pulse('#coin');toast('Bonus +'+fmt(r.coins)+' Coin +'+fmt(r.gems||0)+' Emerald diterima!')})});
document.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>{playSound('click');(window.__go||function(u){location.href=u})(b.dataset.buy==='gem'?'tambang.html?from='+encodeURIComponent(/embed=1/.test(location.search)?'hadiah-misi.html':location.pathname.split('/').pop()):'shop.html?coin=1')}));
$('#back').addEventListener('click',()=>{playSound('click');(window.__go||function(u){location.href=u})('lobby.html')});
try{PD.subscribe(renderCurrency)}catch(e){}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(SV())reloadQ();else render()}});
if(SV()&&WS()){const w=WS();w.questTrack('login').then(()=>reloadQ()); /* membuka Misi = login hari ini (dilaporkan ke server) */}
render();tick();setInterval(tick,1000);
})();
