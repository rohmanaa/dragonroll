/* splash.html (README bagian 3): loading -> cek login -> lobby. Akun disimulasikan di localStorage (tanpa Supabase).
   Login dan Sign up = dua dialog terpisah. Sign up dengan email yang sudah terdaftar -> diarahkan ke Login. */
const $=s=>document.querySelector(s);
const AKEY='dragonroll:auth', UKEY='dragonroll:users', EKEY='dragonroll:accounts';
const params=new URLSearchParams(location.search);
const next=/^[\w-]+\.html$/.test(params.get('next')||'')?params.get('next'):'lobby.html';
const ASSETS=['assets/komponen/karakter-monster/hero-shuri-pemanah.webp','assets/komponen/logo/bar-loading-bingkai-kosong.webp','assets/komponen/logo/bar-loading-isi-biru.webp','assets/komponen/hud/efek-titik-berputar.webp'];
const enc=p=>btoa(unescape(encodeURIComponent(p)));
/* akun baru: array {email,username,pw}; akun lama (UKEY: username->pw) tetap bisa login */
function accounts(){try{return JSON.parse(localStorage.getItem(EKEY))||[]}catch(e){return[]}}
function legacy(){try{return JSON.parse(localStorage.getItem(UKEY))||{}}catch(e){return{}}}
function session(){try{return JSON.parse(localStorage.getItem(AKEY))||JSON.parse(sessionStorage.getItem(AKEY))}catch(e){return null}}
let pct=0;
function setPct(p){pct=p;$('#fill').style.width=p+'%';$('#lbl').textContent='Loading… '+Math.round(p)+'%'}
function go(){sessionStorage.setItem('dragonroll:booted','1');$('#fade').classList.add('on');setTimeout(()=>location.replace(next),400)}
/* TAP TO START (gmyIel): muncul setelah loading selesai (sudah login) atau setelah login/sign up berhasil; sentuh layar -> lobby */
let tapped=false;
function showTap(username){
  document.body.classList.add('ready');$('#hi').textContent=username?'Halo, '+username:'';
  const t0=Date.now(),start=()=>{if(tapped||Date.now()-t0<600)return;tapped=true;go()};
  $('#intro').onclick=start;
  addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')start()});
}
function loaded(){
  const s=session();
  if(s)showTap(s.username);
  else openLogin()
}
(function load(){
  let n=0;const total=ASSETS.length;
  ASSETS.forEach(a=>{const i=new Image();i.onload=i.onerror=()=>{n++};i.src=a});
  const iv=setInterval(()=>{setPct(Math.min(100,pct+3+Math.random()*5));if(pct>=100&&n>=total){clearInterval(iv);setTimeout(loaded,300)}},90);
})();

/* ---- dialog ---- */
const ML=$('#m-login'),MS=$('#m-signup');
function show(m){ML.classList.toggle('on',m===ML);MS.classList.toggle('on',m===MS);$('#loginbtn').hidden=!!m||!!session()}
function setErr(id,t,info){const e=$(id);e.textContent=t||'';e.classList.toggle('info',!!info)}
function openLogin(prefill,msg){show(ML);setErr('#li-err',msg||'',!!msg);$('#li-pw').value='';if(prefill)$('#li-id').value=prefill;setTimeout(()=>(prefill?$('#li-pw'):$('#li-id')).focus(),60)}
function openSignup(){show(MS);setErr('#su-err','');setTimeout(()=>$('#su-em').focus(),60)}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>show(null));
$('#loginbtn').onclick=()=>openLogin();
$('#to-signup').onclick=e=>{e.preventDefault();openSignup()};
$('#to-login').onclick=e=>{e.preventDefault();openLogin()};
$('#forgot').onclick=e=>{e.preventDefault();setErr('#li-err','Reset password lewat email belum tersedia di versi demo.',true)};
document.querySelectorAll('.inp input,.rem input').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'){(i.closest('#m-login')?$('#li-ok'):$('#su-ok')).click()}}));

function finish(username,remember){
  const v=JSON.stringify({username});
  try{localStorage.removeItem(AKEY);sessionStorage.removeItem(AKEY)}catch(e){}
  try{(remember?localStorage:sessionStorage).setItem(AKEY,v)}catch(e){}
  try{const d=JSON.parse(localStorage.getItem('dragonroll:lobby:demo'))||{};d.name=username;localStorage.setItem('dragonroll:lobby:demo',JSON.stringify(d))}catch(e){}
  show(null);showTap(username);
}

/* LOGIN: username atau email + password */
$('#li-ok').onclick=()=>{
  const id=$('#li-id').value.trim(),pw=$('#li-pw').value;
  if(!id)return setErr('#li-err','Isi username atau email');
  if(!pw)return setErr('#li-err','Isi password');
  const low=id.toLowerCase(),acc=accounts().find(a=>a.email===low||a.username.toLowerCase()===low);
  if(acc){if(acc.pw!==enc(pw))return setErr('#li-err','Username/email atau password salah');return finish(acc.username,$('#li-rem').checked)}
  const L=legacy();
  if(L[id]!==undefined&&L[id]===enc(pw))return finish(id,$('#li-rem').checked);
  setErr('#li-err',id.includes('@')?'Email belum terdaftar. Silakan Sign up.':'Username/email atau password salah');
};

/* SIGN UP: email + username + password. Email sudah ada -> arahkan ke Login */
$('#su-ok').onclick=()=>{
  const em=$('#su-em').value.trim().toLowerCase(),us=$('#su-us').value.trim(),pw=$('#su-pw').value,A=accounts();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em))return setErr('#su-err','Email tidak valid');
  if(A.some(a=>a.email===em))return openLogin(em,'Email sudah terdaftar. Silakan login.');
  if(!/^[A-Za-z0-9_]{3,16}$/.test(us))return setErr('#su-err','Username 3–16 karakter (huruf, angka, _)');
  if(A.some(a=>a.username.toLowerCase()===us.toLowerCase())||legacy()[us]!==undefined)return setErr('#su-err','Username sudah dipakai');
  if(pw.length<6)return setErr('#su-err','Password minimal 6 karakter');
  A.push({email:em,username:us,pw:enc(pw)});localStorage.setItem(EKEY,JSON.stringify(A));
  finish(us,true);
};
