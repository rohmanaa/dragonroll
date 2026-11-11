/* dadu.html (README "Pola umum": preview, info, grid kartu, tombol aksi; item belum dimiliki tetap tampil & bisa di-preview;
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

/* ---- katalog dadu (aset new-icon/dadu.webp, varian warna = filter CSS) ---- */
const RAR=[['Biasa','#cfc8ea'],['Langka','#4db3e6'],['Epik','#b07cff'],['Legendaris','#ffd45a'],['Mitos','#ff6a5e']];
const DC=[
  {id:'putih',n:'Dadu Putih',f:'grayscale(1) brightness(1.9) contrast(.9)',r:0,price:0,d:'Dadu bawaan untuk setiap pemain baru.'},
  {id:'klasik',n:'Dadu Klasik',f:'none',r:0,price:300,d:'Dadu merah ala permainan papan tradisional.'},
  {id:'rumput',n:'Dadu Rumput',f:'hue-rotate(110deg) saturate(1.1)',r:1,price:400,d:'Hijau segar, seperti padang rumput di pagi hari.'},
  {id:'samudra',n:'Dadu Samudra',f:'hue-rotate(200deg) saturate(1.2)',r:1,price:600,d:'Biru dalam yang tenang sebelum badai datang.'},
  {id:'zamrud',n:'Dadu Zamrud',f:'hue-rotate(160deg) saturate(1.3) brightness(1.15)',r:2,price:900,d:'Berkilau hijau zamrud dari dalam tambang.'},
  {id:'ametis',n:'Dadu Ametis',f:'hue-rotate(260deg) saturate(1.1)',r:2,price:1200,d:'Ungu pekat yang membawa keberuntungan.'},
  {id:'api',n:'Dadu Api',f:'hue-rotate(40deg) saturate(2) brightness(1.3)',r:3,price:1500,d:'Membara dan panas, lemparan penuh semangat.'},
  {id:'bayangan',n:'Dadu Bayangan',f:'grayscale(1) brightness(.45) contrast(1.2)',r:4,price:null,d:'Hadiah eksklusif penakluk Wither. Tidak dijual.'}
];
const OWN_K='dragonroll:own:dice',USE_K='dragonroll:pref:dice';
let owned=LS(OWN_K,[]);if(!owned.includes('putih'))owned.unshift('putih');
let used=RAW(USE_K);if(!DC.some(f=>f.id===used&&owned.includes(f.id)))used='putih';
let sel=used;
const has=id=>owned.includes(id);
const dieImg=f=>`<img src="${IC}new-icon/dadu.webp" alt="" style="filter:${f.f}">`;

/* ---- tab kategori koleksi ---- */

/* ---- gambar ulang ---- */
function draw(){
  const f=DC.find(x=>x.id===sel),mine=has(f.id),on=f.id===used;
  let html=DC.map(x=>{
    const m=has(x.id);
    const pr=m?'':(x.price==null?`<div class="pr no"><img src="${IC}glyph-putih/gembok.webp" alt=""></div>`:`<div class="pr"><img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(x.price)}</div>`);
    return `<button class="fslot${x.id===sel?' sel':''}${m?'':' lk'}" data-id="${x.id}">${x.id===used?'<span class="tag">DIPAKAI</span>':''}<div class="dc">${dieImg(x)}</div>${pr}</button>`}).join('');
  for(let i=DC.length;i<18;i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  $('#fpv').innerHTML=`<div class="dice" id="die">${dieImg(f)}</div>`;
  $('#nm').textContent=f.n;
  $('#rar').textContent=RAR[f.r][0];$('#rar').style.color=RAR[f.r][1];
  $('#ds').textContent=f.d;
  const b=$('#use'),sp=b.querySelector('span');
  b.classList.remove('off');
  if(mine){sp.textContent=on?'DIGUNAKAN':'GUNAKAN';b.classList.toggle('off',on)}
  else if(f.price==null){sp.textContent='TIDAK DIJUAL';b.classList.add('off')}
  else sp.innerHTML=`<img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(f.price)}`;
}
$('#grid').onclick=e=>{const c=e.target.closest('.fslot');if(c){sel=c.dataset.id;draw()}};

/* ---- coba lempar: kocok-lempar sederhana + hasil acak 1-6 ---- */
let rolling=false;
function roll(){
  if(rolling)return;rolling=true;
  const d=$('#die');d.classList.add('rolling');
  setTimeout(()=>{d.classList.remove('rolling');rolling=false;toast('Hasil lempar: '+(1+Math.floor(Math.random()*6)))},1050);
}
$('#roll').onclick=roll;$('#fpv').onclick=roll;

/* ---- aksi: pakai / beli ---- */
function equip(id){used=id;SAVE(USE_K,id)}
$('#use').onclick=()=>{
  const f=DC.find(x=>x.id===sel);
  if(has(f.id)){if(f.id!==used){equip(f.id);draw();toast(f.n+' dipakai')}return}
  if(f.price==null)return;
  if(wallet().coin<f.price)modal('Coin tidak cukup',`Butuh ${fmt(f.price)} Coin untuk ${f.n}.<br>Saldo kamu ${fmt(wallet().coin)} Coin.`,'TUTUP','DAPATKAN COIN',()=>go('shop.html?coin=1'));
  else modal('Konfirmasi',`Beli ${f.n}<br>seharga ${fmt(f.price)} Coin?`,'BATAL','BELI',()=>{
    setCoin(wallet().coin-f.price);owned.push(f.id);SAVE(OWN_K,JSON.stringify(owned));equip(f.id);draw();toast(f.n+' dibeli dan dipakai')});
};

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
