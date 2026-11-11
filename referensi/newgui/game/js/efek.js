/* efek.html (README "Pola umum": preview, info, grid kartu, tombol aksi; item belum dimiliki tetap tampil & bisa di-preview;
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

/* ---- katalog efek/aura (preview: ikon + aura CSS; di proyek utama: BlockyCharacter + AuraFX voxel 3D) ---- */
const RAR=[['Biasa','#cfc8ea'],['Langka','#4db3e6'],['Epik','#b07cff'],['Legendaris','#ffd45a'],['Mitos','#ff6a5e']];
const DC=[
  {id:'none',n:'Tanpa Efek',ic:'glyph-putih/bintang-kilau',g:1,c:'#cfc8ea',r:0,price:0,d:'Tampil polos tanpa aura. Bawaan setiap pemain.'},
  {id:'api',n:'Aura Api',ic:'ikon-gem-medali/kristal-api',c:'#ff7a2a',r:1,price:500,d:'Nyala api voxel menyelimuti karaktermu.'},
  {id:'es',n:'Aura Es',ic:'ikon-gem-medali/panji-es',c:'#6fd8ff',r:1,price:500,d:'Kepingan es dingin berputar pelan di sekelilingmu.'},
  {id:'petir',n:'Aura Petir',ic:'ikon-gem-medali/petir-emas',c:'#ffe04a',r:2,price:900,d:'Percikan listrik menyambar di sekitar tubuh.'},
  {id:'zamrud',n:'Aura Zamrud',ic:'ikon-gem-medali/berlian-hijau',c:'#4be07a',r:2,price:900,d:'Serpihan zamrud melayang dari dalam tambang.'},
  {id:'ametis',n:'Aura Ametis',ic:'ikon-gem-medali/berlian-ungu',c:'#b07cff',r:3,price:1400,d:'Kabut ungu misterius yang membawa keberuntungan.'},
  {id:'darah',n:'Aura Rubi',ic:'ikon-gem-medali/berlian-merah',c:'#ff4a5e',r:3,price:1400,d:'Bara merah menyala untuk para penantang.'},
  {id:'naga',n:'Aura Naga',ic:'ikon-gem-medali/petir-ungu',c:'#ff3df0',r:4,price:null,d:'Hadiah eksklusif penakluk Ender Dragon. Tidak dijual.'}
];
const OWN_K='dragonroll:own:fx',USE_K='dragonroll:pref:fx';
let owned=LS(OWN_K,[]);if(!owned.includes('none'))owned.unshift('none');
let used=RAW(USE_K);if(!DC.some(f=>f.id===used&&owned.includes(f.id)))used='none';
let sel=used;
const has=id=>owned.includes(id);
const dieImg=f=>`<img ${f.g?'class="glyph" ':''}src="${IC}${f.ic}.webp" alt="">`;
const auraHtml=f=>f.id==='none'?'':`<i class="ring"></i><i class="ring r2"></i>`+Array.from({length:8},(_,i)=>`<u style="--a:${i*45}deg;--d:${(i*.23).toFixed(2)}s"></u>`).join('');

/* ---- tab kategori koleksi ---- */

/* ---- gambar ulang ---- */
function draw(){
  const f=DC.find(x=>x.id===sel),mine=has(f.id),on=f.id===used;
  let html=DC.map(x=>{
    const m=has(x.id);
    const pr=m?'':(x.price==null?`<div class="pr no"><img src="${IC}glyph-putih/gembok.webp" alt=""></div>`:`<div class="pr"><img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(x.price)}</div>`);
    return `<button class="fslot${x.id===sel?' sel':''}${m?'':' lk'}" data-id="${x.id}">${x.id===used?'<span class="tag">DIPAKAI</span>':''}<div class="dc" style="--c:${x.c}">${dieImg(x)}</div>${pr}</button>`}).join('');
  for(let i=DC.length;i<18;i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  $('#fpv').innerHTML=`<div class="dice aura" id="die" style="--c:${f.c}">${auraHtml(f)}${dieImg(f)}</div>`;
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

/* ---- coba efek: aura meledak sesaat ---- */
let rolling=false;
function roll(){
  if(rolling)return;rolling=true;
  const d=$('#die');d.classList.add('burst');
  setTimeout(()=>{d.classList.remove('burst');rolling=false},1000);
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
