/* shop.html — Toko (README): hanya jual Coin. Tukar Emerald -> Coin: 10->500, 40->2.500, 120->10.000 (paket ke-3 "BEST").
   Tab EMERALD: "Tonton Iklan" (simulasi hitung mundur, +5 Emerald). Dompet demo di localStorage (sama dengan lobby/mission);
   proyek utama memakai WalletService.exchange(i) dan klaim iklan lewat server. ?coin=1 membuka tab Coin dan menyorot kartu. ?from=<halaman> untuk tombol Back. */
const $=s=>document.querySelector(s);
function fit(){$('#stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`}addEventListener('resize',fit);fit();
const IC='assets/komponen/';
const WKEY='dragonroll:lobby:demo';
const rd=k=>{try{return JSON.parse(localStorage.getItem(k))||{}}catch(e){return{}}};
const wr=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const fmt=n=>Number(n).toLocaleString('en-US');
function wallet(){const w=rd(WKEY);return{emerald:w.emerald??120,coin:w.coin??2500}}
function addWallet(d){const w=rd(WKEY),c=wallet();w.emerald=c.emerald+(d.emerald||0);w.coin=c.coin+(d.coin||0);wr(WKEY,w);showWallet(true)}
function showWallet(bump){const w=wallet();$('#v-em').textContent=fmt(w.emerald);$('#v-co').textContent=fmt(w.coin);
  if(bump)['#cur-em','#cur-co'].forEach(s=>{const e=$(s);e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')})}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2000)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};

/* ---- data ---- */
const COINS=[
  {t:'Koin Kecil',coin:500,em:10,img:'paket-gold/gold-koin-sedikit.webp',g:'#ffd04a'},
  {t:'Tumpukan Koin',coin:2500,em:40,img:'paket-gold/gold-tumpukan.webp',g:'#ffb02a'},
  {t:'Kantong Koin',coin:10000,em:120,img:'paket-gold/gold-kantong.webp',g:'#ff8f1f',best:true}];
const AD_REWARD=5,AD_SECONDS=3;
const Q=new URLSearchParams(location.search);
const TABS=['chest','coin','emerald'];
let tab=Q.get('coin')==='1'?'coin':(TABS.includes(Q.get('tab'))?Q.get('tab'):'chest');


/* ---- CHEST: dapat aksesori karakter (koleksi) + Coin. Kepemilikan tiruan di localStorage (di proyek utama: ItemCatalog + server).
   Aksesori kembar -> diganti Coin sesuai kelangkaan. Peti Kayu: tombol Open (tonton iklan simulasi) 1x per 24 jam, atau bayar Emerald. ---- */
const OWN_K='dragonroll:own:aksesoris',FREE_K='dragonroll:chest:free',CNT_K='dragonroll:chest:opened';
const RAR=[['Biasa','#cfc8ea'],['Langka','#4db3e6'],['Epik','#b07cff'],['Legendaris','#ffd45a']];
const DUP=[50,150,400,1000];                       /* Coin pengganti aksesori kembar, per kelangkaan */
const ACC=[
  {id:'tas',n:'Tas Kulit',ic:'ikon-item/tas-kulit',r:0},
  {id:'kompas',n:'Kompas Tua',ic:'ikon-item/kompas',r:0},
  {id:'lentera',n:'Lentera Kecil',ic:'ikon-gem-medali/lentera',r:0},
  {id:'semanggi',n:'Semanggi Hoki',ic:'ikon-gem-medali/semanggi',r:0},
  {id:'jamur',n:'Jamur Ajaib',ic:'ikon-gem-medali/jamur',r:0},
  {id:'megafon',n:'Megafon',ic:'ikon-item/megafon',r:0},
  {id:'kalung',n:'Kalung Permata',ic:'ikon-gem-medali/kalung-permata',r:1},
  {id:'cincin',n:'Cincin Permata',ic:'ikon-item/cincin-permata',r:1},
  {id:'helm',n:'Helm Ksatria',ic:'ikon-item/helm-ksatria',r:1},
  {id:'sarung',n:'Sarung Tangan Besi',ic:'ikon-gem-medali/sarung-tangan-besi',r:1},
  {id:'bajak',n:'Bendera Bajak Laut',ic:'ikon-gem-medali/bendera-bajak-laut',r:1},
  {id:'panji',n:'Panji Pedang',ic:'ikon-item/panji-pedang',r:1},
  {id:'helmsayap',n:'Helm Bersayap',ic:'ikon-item/helm-sayap',r:2},
  {id:'sepatu',n:'Sepatu Bersayap',ic:'ikon-item/sepatu-sayap',r:2},
  {id:'es',n:'Panji Es',ic:'ikon-gem-medali/panji-es',r:2},
  {id:'api',n:'Kristal Api',ic:'ikon-gem-medali/kristal-api',r:2},
  {id:'medali',n:'Medali Juara',ic:'ikon-gem-medali/medali-1',r:3},
  {id:'mahkota',n:'Mahkota Naga',ic:'ikon-item/mahkota',r:3}
];
/* w = bobot peluang [Biasa,Langka,Epik,Legendaris]; coin = hadiah uang acak [min,maks] */
const CHESTS=[
  {id:'kayu',t:'Peti Kayu',img:'paket-chest/peti-kayu.webp',price:20,w:[70,25,5,0],coin:[200,600],g:'#ff3b2f',ad:true,tag:'POPULAR',tagc:'merah'},
  {id:'perak',t:'Peti Perak',img:'paket-chest/peti-perak.webp',price:60,w:[40,45,14,1],coin:[600,1500],g:'#3aa0ff'},
  {id:'emas',t:'Peti Emas',img:'paket-chest/peti-emas.webp',price:100,w:[10,50,32,8],coin:[1500,4000],g:'#38e070',tag:'BEST',tagc:'biru'},
  {id:'legend',t:'Peti Legendaris',img:'paket-chest/peti-legendaris.webp',price:200,w:[0,30,55,15],coin:[4000,9000],g:'#ffa526'}
];
const owned=()=>{const a=rd(OWN_K);return Array.isArray(a)?a:[]};
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function pickAcc(ch){
  let t=ch.w.reduce((a,b)=>a+b,0),x=Math.random()*t,r=0;
  for(;r<3;r++){if(x<ch.w[r])break;x-=ch.w[r]}
  const pool=ACC.filter(a=>a.r===r);return pool[Math.floor(Math.random()*pool.length)];
}
const freeLeft=()=>Math.max(0,(+localStorage.getItem(FREE_K)||0)+86400e3-Date.now());
const hm=ms=>{const m=Math.ceil(ms/60e3);return Math.floor(m/60)+'j '+String(m%60).padStart(2,'0')+'m'};
let opening=false;
const CHEST_MIN=10,PLAYED_K='dragonroll:stats:played';   /* syarat: main minimal 10 kali (sama dengan lobby) */
const played=()=>Math.max(0,parseInt(localStorage.getItem(PLAYED_K),10)||0);
function openChest(i,viaAd){
  if(opening)return;
  if(played()<CHEST_MIN)return toast(`Chest terbuka setelah main minimal ${CHEST_MIN} kali (${played()}/${CHEST_MIN})`);const ch=CHESTS[i],w=wallet();
  if(viaAd){if(freeLeft()>0)return toast('Iklan tersedia lagi dalam '+hm(freeLeft()));return watch(()=>doOpen(i,true))}
  if(w.emerald<ch.price){
    ask({title:'EMERALD TIDAK CUKUP',text:`Kamu butuh ${fmt(ch.price-w.emerald)} Emerald lagi untuk ${ch.t}.`,ok:'DAPATKAN EMERALD',okImg:'tombol-kuning-polos',fn:()=>setTab('emerald')});return;
  }
  ask({title:`BUKA ${ch.t.toUpperCase()}?`,text:`${fmt(ch.price)} Emerald → 1 aksesori + hadiah Coin`,ok:'BUKA',fn:()=>doOpen(i,false)});
}
function doOpen(i,isFree){
  const ch=CHESTS[i];opening=true;
  if(isFree)localStorage.setItem(FREE_K,String(Date.now()));
  const acc=pickAcc(ch),own=owned(),dup=own.includes(acc.id);
  let coin=rnd(ch.coin[0],ch.coin[1]);if(dup)coin+=DUP[acc.r];
  if(!dup){own.push(acc.id);wr(OWN_K,own)}
  localStorage.setItem(CNT_K,String((+localStorage.getItem(CNT_K)||0)+1));
  addWallet({coin:coin,emerald:isFree?0:-ch.price});
  /* animasi: peti bergoyang, lalu hasil muncul */
  $('#rw-chest').src=IC+ch.img;$('#rbox').className='shake';$('#rw-res').style.display='none';$('#rw').classList.add('on');
  setTimeout(()=>{
    $('#rbox').className='';$('#rw-chest').style.display='none';
    $('#rw-img').src=IC+acc.ic+'.webp';$('#rw-nm').textContent=acc.n;
    $('#rw-rar').textContent=RAR[acc.r][0];$('#rw-rar').style.color=RAR[acc.r][1];
    $('#rw-ico').style.setProperty('--c',RAR[acc.r][1]);
    $('#rw-tag').textContent=dup?'DUPLIKAT':'BARU!';$('#rw-tag').className=dup?'dup':'new';
    $('#rw-sub').textContent=dup?`Aksesori sudah dimiliki → bonus +${fmt(DUP[acc.r])} Coin`:'Aksesori baru untuk koleksimu';
    $('#rw-cv').textContent='+'+fmt(coin);
    $('#rw-res').style.display='';
  },1100);
}
$('#rw-ok').onclick=()=>{$('#rw').classList.remove('on');$('#rw-chest').style.display='';opening=false;render()};
setInterval(()=>{const e=$('#free-t');if(e){const l=freeLeft();if(l===0)render();else e.textContent=hm(l)}},30000);

/* ---- render ---- */
function render(hl){
  document.querySelectorAll('.tabb').forEach(b=>b.classList.toggle('on',b.dataset.k===tab));
  if(tab==='coin'){
    $('#cards').innerHTML=COINS.map((p,i)=>`<div class="card fx${hl?' hl':''}" style="--g:${p.g}">
      ${p.best?`<img class="rib" src="${IC}banner-label/pita-badge-biru.webp" alt=""><span class="rt">BEST</span>`:''}
      <div class="nm">${p.t}</div><div class="pic"><i class="glow"></i><img src="${IC}${p.img}" alt=""><i class="spk s1"></i><i class="spk s2"></i><i class="spk s3"></i></div>
      <div class="amt">${fmt(p.coin)} Coin</div>
      <button class="btn buy" data-i="${i}"><img src="${IC}tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span><img src="${IC}ikon-gem-medali/berlian-hijau.webp" alt="">${p.em}</span></button></div>`).join('');
  }else if(tab==='chest'){
    const fl=freeLeft();
    $('#cards').innerHTML=CHESTS.map((c,i)=>{
      const gem=`<button class="btn buy blue" data-c="${i}"><img src="${IC}tombol-dan-kontrol/tombol-biru-polos.webp" alt=""><span><img src="${IC}ikon-gem-medali/berlian-hijau.webp" alt="">${fmt(c.price)}</span></button>`;
      const ad=c.ad?`<button class="btn buy ad${fl>0?' dis':''}" data-ad="${i}"><img src="${IC}tombol-dan-kontrol/tombol-kuning-polos.webp" alt=""><span><img src="${IC}ikon-gem-medali/televisi.webp" alt="">${fl>0?`<small id="free-t">${hm(fl)}</small>`:'Open'}</span></button>`:'';
      return `<div class="card chest fx${c.ad?' two':''}" style="--g:${c.g}">
      ${c.tag?`<img class="rib" src="${IC}banner-label/pita-badge-${c.tagc}.webp" alt=""><span class="rt">${c.tag}</span>`:''}
      <div class="nm">${c.t}</div><div class="pic"><i class="glow"></i><img src="${IC}${c.img}" alt=""><i class="spk s1"></i><i class="spk s2"></i><i class="spk s3"></i></div>
      <div class="amt sm"><small>Aksesori + ${fmt(c.coin[0])}–${fmt(c.coin[1])} Coin</small></div>
      <div class="brow">${ad}${gem}</div></div>`}).join('');
  }else{
    $('#cards').innerHTML=`<div class="card fx" style="--g:#38e070">
      <div class="nm">Tonton Iklan</div><div class="pic"><i class="glow"></i><img src="${IC}ikon-gem-medali/televisi.webp" alt="" style="max-height:230px"><i class="spk s1"></i><i class="spk s2"></i><i class="spk s3"></i></div>
      <div class="amt">+${AD_REWARD} Emerald<small>Iklan simulasi (${AD_SECONDS} detik)</small></div>
      <button class="btn buy" id="watch"><img src="${IC}tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span>TONTON</span></button></div>`;
  }
}
function setTab(k,hl){tab=k;render(hl)}
$('#tabs').onclick=e=>{const b=e.target.closest('.tabb');if(b)setTab(b.dataset.k)};
$('#cur-em').onclick=()=>setTab('emerald');
$('#cur-co').onclick=()=>setTab('coin',true);

/* ---- dialog ---- */
const dlg=$('#dlg');let onOk=null;
function ask({title,text,ok='OK',okImg='tombol-hijau-polos',cancel=true,fn}){
  $('#dlg-t').textContent=title;$('#dlg-s').textContent=text;$('#dlg-oktx').textContent=ok;
  $('#dlg-okimg').src=`${IC}tombol-dan-kontrol/${okImg}.webp`;$('#dlg-no').style.display=cancel?'':'none';
  onOk=fn;dlg.classList.add('on');
}
const closeDlg=()=>{dlg.classList.remove('on');onOk=null};
$('#dlg-no').onclick=closeDlg;
$('#dlg-ok').onclick=()=>{const f=onOk;closeDlg();if(f)f()};
dlg.addEventListener('click',e=>{if(e.target===dlg)closeDlg()});
addEventListener('keydown',e=>{if(e.key==='Escape')closeDlg()});

/* ---- tukar Emerald -> Coin ---- */
function buy(i){
  const p=COINS[i],w=wallet();
  if(w.emerald<p.em){
    ask({title:'EMERALD TIDAK CUKUP',text:`Kamu butuh ${fmt(p.em-w.emerald)} Emerald lagi untuk paket ini.`,ok:'DAPATKAN EMERALD',okImg:'tombol-kuning-polos',fn:()=>setTab('emerald')});return;
  }
  ask({title:'TUKAR EMERALD?',text:`${fmt(p.em)} Emerald → ${fmt(p.coin)} Coin`,ok:'TUKAR',fn:()=>{addWallet({emerald:-p.em,coin:p.coin});toast(`+${fmt(p.coin)} Coin`)}});
}
/* ---- tonton iklan (simulasi) ---- */
let adBusy=false;
function watch(cb){
  if(adBusy)return;adBusy=true;let n=AD_SECONDS;
  $('#ad-n').textContent=n;$('#ad').classList.add('on');
  const iv=setInterval(()=>{n--;if(n>0){$('#ad-n').textContent=n;return}
    clearInterval(iv);$('#ad').classList.remove('on');adBusy=false;
    if(cb)return cb();addWallet({emerald:AD_REWARD});toast(`+${AD_REWARD} Emerald`)},1000);
}
$('#cards').addEventListener('click',e=>{
  const b=e.target.closest('.buy');if(!b)return;
  if(b.id==='watch')watch();else if(b.dataset.ad!==undefined)openChest(+b.dataset.ad,true);else if(b.dataset.c!==undefined)openChest(+b.dataset.c);else buy(+b.dataset.i);
});

/* ---- navigasi ---- */
const from=(Q.get('from')||'').match(/^[\w-]+\.html$/)?Q.get('from'):'lobby.html';
$('#back').onclick=()=>nav(from);$('#home').onclick=()=>nav('lobby.html');
showWallet();render(Q.get('coin')==='1');
