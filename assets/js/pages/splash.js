/* splash.js — dipindah dari <script> inline (splash.html). */
(()=>{
const $=s=>document.querySelector(s);
const q=new URLSearchParams(location.search);
/* tujuan: halaman yang sedang dibuka (guard) atau lobby; hanya file .html lokal */
const nx=q.get("next")||"lobby.html";
const dest=/^[a-z0-9_-]+\.html(\?[^#]*)?$/i.test(nx)&&!/^(splash|loading)\.html/i.test(nx)?nx:"lobby.html";
let booted=false;try{booted=sessionStorage.getItem("ut:booted")==="1"}catch(e){}
const quick=!!q.get("next")&&booted; /* dialihkan guard di tengah sesi: tanpa bar, langsung masuk bila sudah login */
const ASSETS=[
  'assets/css/base.css',
  'assets/css/shared-ui.css',
  'assets/css/scene-bg.css',
  'assets/js/ambience.js',
  'assets/css/night-fog.css',
  'assets/js/night-fog.js',
  'assets/Images/fx/fog1.webp',
  'assets/Images/fx/fog2.webp',
  'assets/js/scene-bg.js',
  'assets/js/floating-island.js',
  'assets/js/character-data.js',
  'assets/js/character-view.js',
  'assets/js/mob-view.js',
  'assets/js/landscape.js',
  'assets/js/boot-guard.js',
  'assets/js/item-catalog.js',
  'assets/js/item-art.js',
  'assets/js/player-data.js',
  'assets/js/app.js',
  'assets/js/game-integration.js',
  'hud/ui-core.js',
  'hud/components/button.css',
  'hud/components/button.js',
  'assets/sfx/ui/button-click.mp3',
  'assets/sfx/ui/chest-reward.mp3',
  'assets/sfx/ui/game-lose.mp3',
  'assets/sfx/ui/power-claim.mp3',
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
  'assets/js/vendor/three.min.js',
  'assets/css/fonts.css'
];
ASSETS.unshift(dest.split("?")[0]);
let pct=0;
function mb(b){return (b/1048576).toFixed(b<10485760?1:0)}
/* info.fresh = ada aset yang belum tersimpan di perangkat -> tampilkan "Mengunduh aset" (hanya sekali); selain itu "Loading" biasa */
function setPct(p,kind,info){pct=p;$("#fill").style.width=p+"%";
  $("#lbl").textContent=(info&&info.fresh&&p<100)?"Mengunduh aset… "+mb(info.dlGot)+" / "+mb(info.dlTotal)+" MB ("+Math.round(p)+"%)":"Loading… "+Math.round(p)+"%"}
let leaving=false;
function go(){
  if(leaving)return;leaving=true;
  try{sessionStorage.setItem("ut:booted","1");sessionStorage.setItem("ut:fadein","1")}catch(e){}
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
else UT_Preload.runAuto(ASSETS,(p,k,i)=>{setPct(p,k,i)}).then(()=>{setPct(100);setTimeout(afterLoad,300)});

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

/* aksi akun asli: validasi & pesan galat dari UT.Auth (username 3–16, password min. 6) */
async function submit(btn,errId,fn){
  setErr(errId,"");btn.disabled=true;const lbl=btn.querySelector("span"),t=lbl.textContent;lbl.textContent="Tunggu...";
  try{
    if(!(window.UT&&UT.Auth))throw new Error("Modul akun belum siap. Muat ulang halaman.");
    const user=await fn();show(null);showTap(user.username);
  }catch(e){setErr(errId,(e&&e.message)||"Gagal. Coba lagi.")}
  btn.disabled=false;lbl.textContent=t;
}
$("#li-ok").onclick=()=>submit($("#li-ok"),"#li-err",()=>UT.Auth.signIn($("#li-id").value,$("#li-pw").value));
$("#su-ok").onclick=()=>submit($("#su-ok"),"#su-err",()=>UT.Auth.signUp($("#su-us").value,$("#su-pw").value));
document.documentElement.classList.add("ut-ready");
})();
