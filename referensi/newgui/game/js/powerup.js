/* powerup.html (README "Pola umum": preview, info, grid kartu, tombol aksi; item belum dimiliki tetap tampil & bisa di-preview;
   beli lewat modal Konfirmasi, Coin kurang -> modal dengan tombol Dapatkan Coin).
   Preview: satu aset dadu kit + filter warna; "Coba lempar" = animasi kocok-lempar sederhana (di proyek utama: Dice Kit 3D + fisika).
   Dompet/kepemilikan tiruan di localStorage (di proyek utama: ItemCatalog + WalletService.buy + PD.equip). */
const $=s=>document.querySelector(s);
function fit(){$('#stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`}addEventListener('resize',fit);fit();
const IC='assets/komponen/';
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const RAW=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const SAVE=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const fmt=n=>Number(n).toLocaleString('en-US');

/* halaman yang sudah ada (sama dengan BUILT di lobby.js) */
const BUILT=['karakter.html','mode.html','settings.html','room.html','mission.html','shop.html','profile.html','frame.html','dadu.html','efek.html','powerup.html','leaderboard.html','friendship.html','tambang.html','mail.html','pet.html'];
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const go=u=>BUILT.includes(u.split('?')[0])?nav(u):toast('Segera hadir');

/* ---- dompet (sama dengan lobby/shop) ---- */
const WK='dragonroll:lobby:demo';
const wallet=()=>{const w=LS(WK,{});return{emerald:w.emerald??120,coin:w.coin??2500}};
function setCoin(c){const w=LS(WK,{}),cur=wallet();w.emerald=cur.emerald;w.coin=c;SAVE(WK,JSON.stringify(w));showWallet(true)}
function showWallet(bump){const w=wallet();$('#v-em').textContent=fmt(w.emerald);$('#v-co').textContent=fmt(w.coin);
  if(bump){const e=$('#cur-co');e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')}}
showWallet();

/* ---- katalog power-up (17, data PUR di gameplay/config). Consumable: tidak bisa di-equip, hanya jumlah dimiliki (xN). ---- */
const RAR=[['Biasa','#cfc8ea'],['Langka','#4db3e6'],['Epik','#b07cff'],['Legendaris','#ffd45a']];
const DC=[
  {id:'iron',n:'Iron Sword',ic:'ikon-item/pedang',r:0,c:'#c8d0dc',d:'Serang musuh di dekatmu: lawan mundur 2 petak.'},
  {id:'diamond',n:'Diamond Sword',ic:'ikon-item/pedang-silang',r:1,c:'#6fe6ff',d:'Serang musuh di dekatmu: lawan mundur 3 petak.'},
  {id:'netherite',n:'Netherite Sword',ic:'ikon-item/panji-pedang',r:2,c:'#a47ad8',d:'Serang musuh di dekatmu: lawan mundur 5 petak.'},
  {id:'shield',n:'Wooden Shield',ic:'ikon-item/perisai-kayu',r:0,c:'#c99a5b',d:'Menahan 1 serangan yang datang padamu.'},
  {id:'tnt',n:'TNT',ic:'ikon-item/bom',r:1,c:'#ff5a3a',d:'Pemain terdepan terpental mundur 6 petak.'},
  {id:'feather',n:'Feather',ic:'glyph-putih/bulu',g:1,r:1,c:'#ffffff',d:'Giliran tambahan: lempar dadu sekali lagi.'},
  {id:'apple',n:'Golden Apple',ic:'glyph-putih/apple',g:1,r:1,c:'#ffd45a',d:'+3 pada hasil dadu berikutnya.'},
  {id:'totem',n:'Totem',ic:'ikon-item/piala',r:2,c:'#ffe27a',d:'Pilih pakai saat kena ular, mob, atau serangan agar lolos.'},
  {id:'pearl',n:'Ender Pearl',ic:'ikon-gem-medali/berlian-ungu',r:2,c:'#2fd1a8',d:'Tukar posisi dengan pemain terdepan.'},
  {id:'odd',n:'Ramuan Ganjil',ic:'ikon-item/ramuan-ungu',r:1,c:'#b07cff',d:'Dadu berikutnya dipastikan ganjil (1, 3, atau 5).'},
  {id:'even',n:'Ramuan Genap',ic:'ikon-item/ramuan-biru',r:1,c:'#4db3e6',d:'Dadu berikutnya dipastikan genap (2, 4, atau 6).'},
  {id:'fire',n:'Fire Charge',ic:'ikon-gem-medali/kristal-api',r:1,c:'#ff7a2a',d:'Lontaran bola api ke lawan di depanmu.'},
  {id:'ice',n:'Ice Crystal',ic:'ikon-gem-medali/berlian-biru',r:2,c:'#6fd8ff',d:'Bekukan pemain terdepan selama satu giliran.'},
  {id:'blaze',n:'Blaze Core',ic:'ikon-gem-medali/petir-emas',r:2,c:'#ffb02a',d:'Semua musuh di depanmu mundur 2 petak.'},
  {id:'trident',n:'Trident',ic:'ikon-gem-medali/panah-tombak',r:2,c:'#4be0d0',d:'Tombak tiga mata: serang lawan terdekat dari jauh.'},
  {id:'dragon',n:'Dragon Crystal',ic:'ikon-gem-medali/berlian-merah',r:3,c:'#ff4a5e',d:'Meluncur ke tangga terdekat, atau maju 6 petak.'},
  {id:'star',n:'Nether Star',ic:'ikon-item/bintang',r:3,c:'#fff3a0',d:'Semua musuh mundur 3 petak + kamu dapat giliran tambahan.'}
];
const NOBOSS=['feather','odd','even'];/* tidak bisa dipakai di fase boss (boss:false) */
const OWN_K='dragonroll:own:power';
const cnt=LS(OWN_K,null)||(()=>{const o={};DC.forEach((x,i)=>o[x.id]=[3,2,1,2,2,3,2,1,1,2,2,1,1,1,1,0,0][i]);SAVE(OWN_K,JSON.stringify(o));return o})();
let sel=DC[0].id;
const dieImg=f=>`<img ${f.g?'class="glyph" ':''}src="${IC}${f.ic}.webp" alt="">`;

/* ---- tab kategori koleksi ---- */

/* ---- gambar ulang ---- */
function draw(){
  const f=DC.find(x=>x.id===sel),n=cnt[f.id]||0;
  let html=DC.map(x=>{const k=cnt[x.id]||0;
    return `<button class="fslot${x.id===sel?' sel':''}${k?'':' lk'}" data-id="${x.id}"><div class="dc" style="--c:${x.c}">${dieImg(x)}</div><div class="pr cn">×${k}</div></button>`}).join('');
  for(let i=DC.length;i<18;i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  $('#fpv').innerHTML=`<div class="dice pw" id="die" style="--c:${f.c}"><i class="ring"></i>${dieImg(f)}</div>`;
  $('#nm').textContent=f.n;
  $('#rar').textContent=RAR[f.r][0]+' · dimiliki ×'+n;$('#rar').style.color=RAR[f.r][1];
  $('#ds').textContent=f.d+(NOBOSS.includes(f.id)?' (Tidak bisa dipakai di fase boss.)':'');
  const b=$('#use');b.classList.add('off');b.querySelector('span').textContent='TIDAK DIJUAL';
}
$('#grid').onclick=e=>{const c=e.target.closest('.fslot');if(c){sel=c.dataset.id;draw();roll()}};

/* ---- putar efek visual (di proyek utama: PowerFX) ---- */
let rolling=false;
function roll(){
  if(rolling)return;rolling=true;
  const d=$('#die');d.classList.add('burst');
  setTimeout(()=>{d.classList.remove('burst');rolling=false},1000);
}
$('#roll').onclick=roll;$('#fpv').onclick=roll;
$('#use').onclick=()=>toast('Power-up didapat dari gameplay atau hadiah');

/* ---- modal ---- */
let okFn=null;
function modal(t,x,noL,okL,ok){
  $('#mt').textContent=t;$('#mx').innerHTML=x;
  $('#m-no span').textContent=noL;$('#m-ok span').textContent=okL;
  okFn=ok;$('#md').classList.add('on');
}
const closeM=()=>$('#md').classList.remove('on');
$('#m-no').onclick=closeM;
$('#m-ok').onclick=()=>{closeM();if(okFn)okFn()};
$('#md').onclick=e=>{if(e.target.id==='md')closeM()};

$('#back').onclick=$('#home').onclick=()=>nav('lobby.html');
$('#cur-co').onclick=()=>go('shop.html?coin=1');
draw();
