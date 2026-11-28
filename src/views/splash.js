/* splash.js â€” dipindah dari blok script inline (splash.html). */
(()=>{
const $=s=>document.querySelector(s);
const q=new URLSearchParams(location.search);
/* tujuan: halaman yang sedang dibuka (guard) atau lobby; hanya file .html lokal */
const nx=q.get("next")||"lobby.html";
const dest=/^[a-z0-9_-]+\.html(\?[^#]*)?$/i.test(nx)&&!/^(splash|loading)\.html/i.test(nx)?nx:"lobby.html";
let booted=false;try{booted=sessionStorage.getItem("ut:booted")==="1"}catch(e){}
const quick=!!q.get("next")&&booted; /* dialihkan guard di tengah sesi: tanpa bar, langsung masuk bila sudah login */
const ASSETS=[
  'src/styles/base.css',
  'src/styles/shared-ui.css',
  'src/styles/scene-bg.css',
  'src/systems/ambience.js',
  'src/styles/night-fog.css',
  'src/renderers/night-fog.js',
  'assets/images/effects/fx-fog-1.webp',
  'assets/images/effects/fx-fog-2.webp',
  'src/renderers/scene-bg.js',
  'src/fx/floating-island.js',
  'data/inventory/character/_shared/js/character-data.js',
  'data/inventory/character/_shared/js/character-view.js',
  'src/boot/mob-view.js',
  'src/boot/landscape.js',
  'src/boot/boot-guard.js',
  'src/stores/item-catalog.js',
  'src/renderers/item-art.js',
  'src/stores/player-data.js',
  'src/core/app.js',
  'src/services/game-integration.js',
  'src/components/ui-core.js',
  'src/components/button/button.css',
  'src/components/button/button.js',
  'assets/audio/sfx/ui/button-click.mp3',
  'assets/audio/sfx/ui/chest-reward.mp3',
  'assets/audio/sfx/ui/game-lose.mp3',
  'assets/audio/sfx/ui/power-claim.mp3',
  'shop.html',
  'karakter.html',
  'inventory.html',
  'frame.html',
  'dadu.html',
  'efek.html',
  'powerup.html',
  'hadiah-misi.html',
  'profile.html',
  'lobby.html',
  'mode.html',
  'room.html',
  'gameplay.html',
  'settings.html',
  'leaderboard.html',
  'friendship.html',
  'tambang.html',
  'promosi/placeholder.webp',
  'data/power/3d/sword.png',
  'data/power/3d/feather.png',
  'data/power/3d/tnt.png',
  'data/power/3d/totem.png',
  'data/power/3d/potion_odd.png',
  'data/power/3d/potion_even.png',
  'data/power/3d/grass.png',
  'src/vendor/three.min.js',
  'src/styles/fonts.css',
  'assets/images/ui/achievement/ach-pedang.webp'
];
ASSETS.unshift(dest.split("?")[0]);
let pct=0;

/* ---- SYSTEM LOG: SATU baris di atas bar loading = kategori yang sedang dimuat ("Loading gambar... 12/80 Â· 340/900"); pesan sistem (cek pembaruan) menggantikannya ---- */
const LOG=(()=>{
  const line=$("#syslog");
  if(!line)return{sys(){},ev(){}};
  const CATS=["halaman","style","script","data","font","gambar","efek","sfx","musik"];
  const cat=u=>{const p=u.split("?")[0],x=((p.match(/\.([a-z0-9]+)$/i)||[])[1]||"").toLowerCase();
    if(/^(mp3|ogg|m4a|opus|wav)$/.test(x)||(x==="webm"&&/audio/.test(p)))return/\/sfx\//.test(p)?"sfx":"musik";
    if(/^(png|webp|jpe?g|gif|svg|ico)$/.test(x))return/\/effects\/|\/aura\/|(^|[-_\/])(fx|efek|fog|particle|spark|glow)([-_.\d]|$)/i.test(p)?"efek":"gambar";
    if(x==="js")return"script";if(x==="css")return"style";if(x==="html")return"halaman";if(/^woff2?$|^ttf$/.test(x))return"font";return"data"};
  const C={};let sysMsg="",total=0,done=0,cur="",dirty=false,urlCat={};
  function paint(){if(dirty)return;dirty=true;requestAnimationFrame(()=>{dirty=false;
    let t=sysMsg;
    if(!t){const c=C[cur];t=c?"Loading "+cur+"... "+c.done+"/"+c.total+(total?" Â· "+done+"/"+total:""):""}
    line.textContent=t;
    /* satu teks saja di bar: setelah fase unduh selesai, rincian "Loading gambarâ€¦ n/m" menggantikan label */
    if(window.__lblLoad&&!window.__lblDl)$("#lbl").textContent=t||$("#lbl").textContent})}
  function ev(e){
    if(e.type==="sys"){sysMsg=e.msg;return paint()}
    if(e.type==="plan"){sysMsg="";total=e.total;(e.urls||[]).forEach(u=>{const k=cat(u);urlCat[u]=k;(C[k]=C[k]||{total:0,done:0}).total++});
      cur=CATS.find(k=>C[k])||"";return paint()}
    if(e.type==="start")return;
    const k=urlCat[e.url]||cat(e.url),c=C[k];done++;
    if(c){c.done++;cur=k}
    paint();
  }
  return{sys:m=>ev({type:"sys",msg:m}),ev};
})();
try{window.UT_Preload&&(UT_Preload.onFile=LOG.ev)}catch(e){}
function mb(b){return (b/1048576).toFixed(b<10485760?1:0)}
/* info.fresh = ada aset yang belum tersimpan di perangkat -> tampilkan "Mengunduh aset" (hanya sekali); selain itu "Loading" biasa */
function setPct(p,kind,info){pct=p;$("#fill").style.width=p+"%";
  window.__lblLoad=true;window.__lblDl=!!(info&&info.fresh&&p<100);
  const lb=$("#lbl");
  if(window.__lblDl)lb.textContent="Mengunduh asetâ€¦ "+mb(info.dlGot)+" / "+mb(info.dlTotal)+" MB ("+Math.round(p)+"%)";
  else{const s=$("#syslog");lb.textContent=(s&&s.textContent)||("Loadingâ€¦ "+Math.round(p)+"%")}}
let leaving=false;
function go(){
  if(leaving)return;leaving=true;
  try{sessionStorage.setItem("ut:booted","1");sessionStorage.setItem("ut:fadein","1")}catch(e){}
  try{window.parent!==window&&parent.UTShell&&parent.UTShell.enter&&parent.UTShell.enter()}catch(e){} /* musik mulai dari ketukan masuk (satu pemutar milik pembungkus) */
  $("#fade").classList.add("on");
  const rm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(()=>location.replace(dest),rm?150:700);
}
/* TAP TO START: muncul setelah loading selesai & sudah login; sentuh layar -> tujuan */
let tapped=false;
function showTap(username){
  if(quick){go();return}
  document.body.classList.add("ready");$("#hi").textContent=username?"Halo, "+username:"";
  const t0=Date.now(),start=()=>{if(tapped||Date.now()-t0<600)return;tapped=true;go()};
  $("#intro").onclick=start;
  addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")start()});
}
/* tunggu modul akun (ES module) siap, lalu cek sesi tersimpan */
function authReady(){return new Promise(res=>{if(window.UT&&UT.Auth)return res(true);addEventListener("ut:auth-module-ready",()=>res(true),{once:true});setTimeout(()=>res(false),8000)})}
function afterLoad(){
  authReady().then(ok=>ok?UT.Auth.check():null).then(user=>{
    if(user)showTap(user.username);else openLogin();
  }).catch(()=>openLogin());
}
try{window.PlayerData&&PlayerData.snapshot()}catch(e){} /* jalankan migrasi/muat state sekali sebelum halaman tampil */
if(quick){document.body.classList.add("quick");afterLoad()}
else{
  /* URUTAN: 1) cek pembaruan ke server DULU (sebelum mengunduh aset apa pun) -> 2) bila ada, modal Unduh Data (X = tunda) -> 3) baru bar loading memuat aset */
  $("#lbl").textContent="Memeriksa pembaruanâ€¦";LOG.sys("Cek pembaruanâ€¦");
  Promise.resolve(UT.Update&&UT.Update.promptOnSplash(2500,{
    /* modal hanya konfirmasi; progres unduhan pembaruan tampil di bar splash ini */
    progress:ev=>{const p=ev.total>0?Math.min(100,Math.round(ev.loaded/ev.total*100)):0;$("#fill").style.width=p+"%";
      $("#lbl").textContent="Mengunduh pembaruanâ€¦ "+(ev.total>0?mb(ev.loaded)+" / "+mb(ev.total)+" MB ("+p+"%)":"")},
    status:t=>{$("#lbl").textContent=t;LOG.sys(t);if(/^Mengunduh/.test(t))$("#fill").style.width="0%";else if(/^(Menyiapkan|Memulai)/.test(t))$("#fill").style.width="100%"}
  })).catch(()=>{})
    .then(()=>UT_Preload.runAuto(ASSETS,(p,k,i)=>{setPct(p,k,i)}))
    .then(()=>{setPct(100);LOG.sys("Siap âœ“ cek loginâ€¦");setTimeout(afterLoad,300)});
}

/* ---- dialog login / sign up ---- */
const ML=$("#m-login"),MS=$("#m-signup");
function show(m){ML.classList.toggle("on",m===ML);MS.classList.toggle("on",m===MS);$("#loginbtn").hidden=!!m||document.body.classList.contains("ready")}
function setErr(id,t,info){const e=$(id);e.textContent=t||"";e.classList.toggle("info",!!info)}
function openLogin(prefill){show(ML);setErr("#li-err","");$("#li-pw").value="";if(prefill)$("#li-id").value=prefill;setTimeout(()=>(prefill?$("#li-pw"):$("#li-id")).focus(),60)}
function openSignup(){show(MS);setErr("#su-err","");setTimeout(()=>$("#su-us").focus(),60)}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>show(null));
$("#loginbtn").onclick=()=>openLogin();
$("#to-signup").onclick=e=>{e.preventDefault();openSignup()};
$("#to-login").onclick=e=>{e.preventDefault();openLogin()};
document.querySelectorAll(".inp input").forEach(i=>i.addEventListener("keydown",e=>{if(e.key==="Enter"){(i.closest("#m-login")?$("#li-ok"):$("#su-ok")).click()}}));

/* aksi akun asli: validasi & pesan galat dari UT.Auth (username 3â€“16, password min. 6) */
async function submit(btn,errId,fn){
  setErr(errId,"");btn.disabled=true;const lbl=btn.querySelector("span"),t=lbl.textContent;lbl.textContent="Tunggu...";
  try{
    if(!(window.UT&&UT.Auth))throw new Error("Modul akun belum siap. Muat ulang halaman.");
    const user=await fn();show(null);showTap(user.username);
  }catch(e){setErr(errId,(e&&e.message)||"Gagal. Coba lagi.")}
  btn.disabled=false;lbl.textContent=t;
}
$("#li-ok").onclick=()=>submit($("#li-ok"),"#li-err",()=>UT.Auth.signIn($("#li-id").value,$("#li-pw").value));
/* Sign up: wajib centang Ketentuan Layanan + Kebijakan Privasi; setelah akun jadi, persetujuan dicatat di server (gagal dicatat -> Lobby meminta konfirmasi) */
$("#su-ok").onclick=()=>submit($("#su-ok"),"#su-err",async()=>{
  if(!$("#su-tos").checked)throw new Error("Centang persetujuan Ketentuan Layanan dan Kebijakan Privasi dulu.");
  const user=await UT.Auth.signUp($("#su-us").value,$("#su-pw").value);
  try{if(UT.Tos)await UT.Tos.accept()}catch(e){}
  return user;
});
document.documentElement.classList.add("ut-ready");
})();


