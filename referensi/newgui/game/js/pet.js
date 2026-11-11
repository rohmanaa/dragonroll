/* pet.html: koleksi Pet — pola sama dengan efek.html (preview, info, grid kartu, tombol aksi; beli lewat modal Konfirmasi, Coin kurang -> Dapatkan Coin).
   Ikon pet sementara emoji (belum ada aset ilustrasi pet di kit). Kepemilikan/pilihan tiruan di localStorage (di proyek utama: ItemCatalog + PD.equip). */
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

/* ---- katalog pet (preview: emoji + animasi; di proyek utama: model pet voxel 3D yang mengikuti karakter) ---- */
const RAR=[['Biasa','#cfc8ea'],['Langka','#4db3e6'],['Epik','#b07cff'],['Legendaris','#ffd45a'],['Mitos','#ff6a5e']];
const DC=[
  {id:'kucing',n:'Kucing Oren',e:'🐱',c:'#ffb35a',r:0,price:0,d:'Teman setia yang suka tidur di atas kartu. Bawaan setiap pemain.'},
  {id:'anjing',n:'Anjing Pudel',e:'🐶',c:'#d9a066',r:0,price:400,d:'Selalu semangat menyambut setiap lemparan dadu.'},
  {id:'kelinci',n:'Kelinci Salju',e:'🐰',c:'#ffd0e0',r:1,price:700,d:'Lincah melompat mengikuti langkah pionmu.'},
  {id:'rubah',n:'Rubah Api',e:'🦊',c:'#ff8a3a',r:1,price:900,d:'Cerdik dan gesit, suka mengintip jalan pintas.'},
  {id:'panda',n:'Panda Santai',e:'🐼',c:'#e8e8f0',r:2,price:1500,d:'Tenang dan menggemaskan, membawa keberuntungan pelan-pelan.'},
  {id:'naga',n:'Naga Mini',e:'🐲',c:'#4be07a',r:3,price:3000,d:'Anak naga pemberani yang menyemburkan api kecil.'},
  {id:'unicorn',n:'Unicorn Pelangi',e:'🦄',c:'#ff7bf0',r:4,price:null,d:'Hadiah eksklusif peringkat tertinggi. Tidak dijual.'}
];
const OWN_K='dragonroll:own:pet',USE_K='dragonroll:pref:pet';
let owned=LS(OWN_K,[]);if(!owned.includes('kucing'))owned.unshift('kucing');
let used=RAW(USE_K);if(!DC.some(f=>f.id===used&&owned.includes(f.id)))used='kucing';
let sel=used;
const has=id=>owned.includes(id);
const petEm=f=>`<span class="em">${f.e}</span>`;

/* ---- tab kategori koleksi ---- */

/* ---- gambar ulang ---- */
function draw(){
  const f=DC.find(x=>x.id===sel),mine=has(f.id),on=f.id===used;
  let html=DC.map(x=>{
    const m=has(x.id);
    const pr=m?'':(x.price==null?`<div class="pr no"><img src="${IC}glyph-putih/gembok.webp" alt=""></div>`:`<div class="pr"><img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(x.price)}</div>`);
    return `<button class="fslot${x.id===sel?' sel':''}${m?'':' lk'}" data-id="${x.id}">${x.id===used?'<span class="tag">DIPAKAI</span>':''}<div class="dc" style="--c:${x.c}">${petEm(x)}</div>${pr}</button>`}).join('');
  for(let i=DC.length;i<18;i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  $('#fpv').innerHTML=`<div class="dice petv" id="die" style="--c:${f.c}"><i class="glow"></i>${petEm(f)}</div>`;
  $('#nm').textContent=f.n;
  $('#rar').textContent=RAR[f.r][0];$('#rar').style.color=RAR[f.r][1];
  $('#ds').textContent=f.d;
  const b=$('#use'),sp=b.querySelector('span');
  b.classList.remove('off');
  if(mine){sp.textContent=on?'DIPAKAI':'PAKAI';b.classList.toggle('off',on)}
  else if(f.price==null){sp.textContent='TIDAK DIJUAL';b.classList.add('off')}
  else sp.innerHTML=`<img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(f.price)}`;
}
$('#grid').onclick=e=>{const c=e.target.closest('.fslot');if(c){sel=c.dataset.id;draw()}};

/* ---- sapa pet: melompat sesaat ---- */
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
  if(has(f.id)){if(f.id!==used){equip(f.id);draw();toast(f.n+' ikut denganmu')}return}
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
