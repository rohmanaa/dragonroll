/* tambang.html (README bagian 6): 3 slot tambang pasif. Aksi per slot: Buka (bayar Coin), Ambil emerald, Percepat (boost, batas harian),
   upgrade Kecepatan (Lv 1-5) dan Peti/kapasitas (Lv 1-5). Klien memperkirakan stok = stock + rate*waktu; di proyek utama kebenaran dari server (MineService mine_*).
   Di sini semua TIRUAN di localStorage. */
const KEY='dragonroll:mine';
const RATE=[6,9,13,18,24];          /* emerald per jam, per level kecepatan */
const CAP=[30,60,100,150,240];      /* kapasitas peti, per level */
const UP=[0,600,1500,3200,6000];    /* biaya naik KE level n (Coin) */
const OPEN=[0,1500,4000];           /* biaya buka slot */
const BOOST={mult:2,ms:30*60*1000,perDay:3,cost:0};
const today=()=>new Date().toISOString().slice(0,10);
function fresh(){const n=Date.now();return{day:today(),boosts:0,slots:[{open:1,spd:1,cap:1,stock:0,t:n,bu:0},{open:0,spd:1,cap:1,stock:0,t:n,bu:0},{open:0,spd:1,cap:1,stock:0,t:n,bu:0}]}}
let M=LS(KEY,null)||fresh();
if(M.day!==today()){M.day=today();M.boosts=0}
const save=()=>SAVE(KEY,M);
/* stok perkiraan, memperhitungkan jendela boost */
function est(s,now=Date.now()){
  if(!s.open)return 0;
  const r=RATE[s.spd-1]/3600000,cap=CAP[s.cap-1];
  const bEnd=Math.min(now,s.bu),bs=Math.max(0,bEnd-s.t);
  const total=(now-s.t)*r+bs*r*(BOOST.mult-1);
  return Math.min(cap,s.stock+total);
}
function settle(s){const now=Date.now();s.stock=est(s,now);s.t=now;if(s.bu<now)s.bu=0}
const rateNow=s=>RATE[s.spd-1]*(s.bu>Date.now()?BOOST.mult:1);
function summary(){const t=M.slots.filter(s=>s.open).reduce((a,s)=>a+rateNow(s),0);$('#sum').innerHTML=`Produksi total <b>${t}</b> emerald / jam`}
function build(){
  $('#slots').innerHTML=M.slots.map((s,i)=>{
    if(!s.open)return `<div class="slot lock"><div class="hd ttl">TAMBANG ${i+1}</div><img class="big" src="${IC}glyph-putih/gembok.webp" alt=""><p>Slot terkunci</p>
      <button class="btn" data-open="${i}"><img src="${IC}tombol-dan-kontrol/tombol-kuning-polos.webp" alt=""><span><img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(OPEN[i])}</span></button></div>`;
    const maxS=s.spd>=5,maxC=s.cap>=5;
    return `<div class="slot" data-i="${i}"><div class="hd ttl">TAMBANG ${i+1}</div>
      <div class="chest"><img src="${IC}paket-chest/peti-kayu.webp" alt="" onerror="this.src='${IC}ikon-item/tas-kulit.webp'"><div class="pill"><img src="${IC}ikon-gem-medali/berlian-hijau.webp" alt=""><b data-st="${i}">0</b><small data-cp="${i}"></small></div></div>
      <i class="bar"><u data-bar="${i}"></u></i>
      <div class="rt" data-rt="${i}"></div>
      <div class="acts">
        <button class="btn" data-col="${i}"><img src="${IC}tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span>AMBIL</span></button>
        <button class="btn" data-boost="${i}"><img src="${IC}tombol-dan-kontrol/tombol-biru-polos.webp" alt=""><span data-bt="${i}">PERCEPAT</span></button>
      </div>
      <div class="ups">
        <button class="up" data-up="spd:${i}" ${maxS?'disabled':''}><em>Kecepatan Lv ${s.spd}</em><span>${maxS?'MAKS':`<img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(UP[s.spd])}`}</span></button>
        <button class="up" data-up="cap:${i}" ${maxC?'disabled':''}><em>Peti Lv ${s.cap}</em><span>${maxC?'MAKS':`<img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(UP[s.cap])}`}</span></button>
      </div></div>`}).join('');
  summary();tick();
}
/* perbarui angka berjalan tanpa membangun ulang tombol */
function tick(){
  const now=Date.now();
  M.slots.forEach((s,i)=>{if(!s.open)return;
    const v=est(s,now),cap=CAP[s.cap-1],b=$(`[data-st="${i}"]`);if(!b)return;
    b.textContent=Math.floor(v);$(`[data-cp="${i}"]`).textContent='/ '+cap;
    $(`[data-bar="${i}"]`).style.width=(v/cap*100)+'%';
    const boosted=s.bu>now;
    $(`[data-rt="${i}"]`).innerHTML=`${rateNow(s)} / jam${boosted?` <em>×${BOOST.mult} ${Math.ceil((s.bu-now)/60000)} mnt</em>`:''}${v>=cap?' <em class="full">PETI PENUH</em>':''}`;
    const bt=$(`[data-bt="${i}"]`);bt.textContent=boosted?'AKTIF':`PERCEPAT ${BOOST.perDay-M.boosts}/${BOOST.perDay}`;
    $(`[data-boost="${i}"]`).classList.toggle('off',boosted||M.boosts>=BOOST.perDay);
    $(`[data-col="${i}"]`).classList.toggle('off',Math.floor(v)<1);
  });
}
setInterval(tick,500);
$('#slots').onclick=e=>{
  const g=a=>e.target.closest(`[${a}]`)?.getAttribute(a);let v;
  if((v=g('data-open'))!=null){const i=+v,c=OPEN[i];
    if(wallet().coin<c){modal('Coin tidak cukup',`Butuh ${fmt(c)} Coin untuk membuka tambang ini.`,'TUTUP','DAPATKAN COIN',()=>go('shop.html?coin=1'));return}
    modal('Buka tambang',`Buka Tambang ${i+1}<br>seharga ${fmt(c)} Coin?`,'BATAL','BUKA',()=>{setWallet({coin:wallet().coin-c});const s=M.slots[i];s.open=1;s.t=Date.now();s.stock=0;save();build();toast('Tambang '+(i+1)+' dibuka')})}
  else if((v=g('data-col'))!=null){const s=M.slots[+v],n=Math.floor(est(s));if(n<1)return;
    settle(s);s.stock-=n;save();setWallet({emerald:wallet().emerald+n});tick();toast('+'+n+' Emerald diambil')}
  else if((v=g('data-boost'))!=null){const s=M.slots[+v];
    if(s.bu>Date.now())return;if(M.boosts>=BOOST.perDay){toast('Batas percepat harian habis');return}
    settle(s);s.bu=Date.now()+BOOST.ms;M.boosts++;save();summary();tick();toast('Produksi ×'+BOOST.mult+' selama 30 menit')}
  else if((v=g('data-up'))!=null){const [k,ix]=v.split(':'),s=M.slots[+ix],lv=s[k],c=UP[lv],nm=k==='spd'?'Kecepatan':'Peti';
    if(lv>=5)return;
    if(wallet().coin<c){modal('Coin tidak cukup',`Butuh ${fmt(c)} Coin untuk upgrade ${nm}.<br>Saldo kamu ${fmt(wallet().coin)} Coin.`,'TUTUP','DAPATKAN COIN',()=>go('shop.html?coin=1'));return}
    modal('Konfirmasi',`Upgrade ${nm} ke Lv ${lv+1}<br>seharga ${fmt(c)} Coin?`,'BATAL','UPGRADE',()=>{settle(s);setWallet({coin:wallet().coin-c});s[k]=lv+1;save();build();toast(nm+' naik ke Lv '+(lv+1))})}
};
$('#cur-co').onclick=()=>go('shop.html?coin=1');
build();
