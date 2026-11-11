/* sub.js — fungsi bersama halaman leaderboard, friendship, tambang (kanvas 1920x1080, dompet tiruan, toast, navigasi). */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function fit(){$('#stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`}addEventListener('resize',fit);fit();
const IC='assets/komponen/';
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const SAVE=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const fmt=n=>Number(n).toLocaleString('en-US');
const BUILT=['karakter.html','mode.html','settings.html','room.html','mission.html','shop.html','profile.html','frame.html','dadu.html','efek.html','powerup.html','leaderboard.html','friendship.html','tambang.html','lobby.html','mail.html','pet.html'];
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const go=u=>BUILT.includes(u.split('?')[0])?nav(u):toast('Segera hadir');
/* dompet — kunci sama dengan lobby/shop */
const WK='dragonroll:lobby:demo';
const wallet=()=>{const w=LS(WK,{});return{name:w.name??'Ryuen',emerald:w.emerald??120,coin:w.coin??2500}};
function setWallet(p){const w=LS(WK,{}),c=wallet();w.emerald=p.emerald??c.emerald;w.coin=p.coin??c.coin;SAVE(WK,w);showWallet(true)}
function showWallet(bump){const w=wallet();$('#v-em').textContent=fmt(w.emerald);$('#v-co').textContent=fmt(w.coin);
  if(bump){['#cur-em','#cur-co'].forEach(i=>{const e=$(i);e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')})}}
showWallet();
/* modal konfirmasi */
let okFn=null;
function modal(t,x,noL,okL,ok){$('#mt').textContent=t;$('#mx').innerHTML=x;$('#m-no span').textContent=noL;$('#m-ok span').textContent=okL;okFn=ok;$('#m-ok').style.display=okL?'':'none';$('#md').classList.add('on')}
const closeM=()=>$('#md').classList.remove('on');
$('#m-no').onclick=closeM;$('#m-ok').onclick=()=>{closeM();if(okFn)okFn()};$('#md').onclick=e=>{if(e.target.id==='md')closeM()};
const FROM=(()=>{const f=new URLSearchParams(location.search).get('from');return f&&BUILT.includes(f.split('?')[0])?f:'lobby.html'})();
$('#back').onclick=()=>nav(FROM);$('#home').onclick=()=>nav('lobby.html');
