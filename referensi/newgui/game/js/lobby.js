/* =========================================================================
   LOGIKA — mengikuti README (lobby.html)
   - Peta navigasi ACT
   - Level/XP: level 1 butuh 400 XP, tiap level +100 (maks. 999); XP server menang bila lebih tinggi
   - Saldo tampil "—" sampai server membalas (walletReady)
   - MAIL: mail.html; "Hadiah gratis": toast "segera hadir"
   Halaman tujuan belum ada di repo GUI ini, maka NAVIGATE=false hanya menampilkan toast.
   Set NAVIGATE=true di proyek utama agar benar-benar berpindah halaman.
   ========================================================================= */
const NAVIGATE=true;
/* Halaman yang sudah ada di folder game/ — tambahkan nama file di sini saat halaman baru selesai dibuat */
const BUILT=['karakter.html','mode.html','settings.html','room.html','mission.html','shop.html','profile.html','frame.html','dadu.html','efek.html','powerup.html','leaderboard.html','friendship.html','tambang.html','mail.html','pet.html'];
const ACT={
  profil:'profile.html', karakter:'karakter.html', frame:'frame.html', dadu:'dadu.html', efek:'efek.html', powerup:'powerup.html',
  leaderboard:'leaderboard.html', toko:'shop.html', beliCoin:'shop.html?coin=1', teman:'friendship.html', hadiahMisi:'mission.html',
  tambang:'tambang.html?from=lobby.html', mail:'mail.html', pet:'pet.html', settings:'settings.html', mulai:'mode.html', chest:'shop.html?tab=chest'
};
const SOON={guild:'Guild segera hadir',babi:'Celengan segera hadir',hadiahGratis:'Hadiah gratis segera hadir'};

/* ---- PlayerData tiruan (di proyek utama diganti PlayerData asli) ---- */
const KEY='dragonroll:lobby:demo';
const PD={
  data:Object.assign({name:'Ryuen',xp:683,emerald:120,coin:2500},(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}})()),
  ready:false,
  save(){try{localStorage.setItem(KEY,JSON.stringify(this.data))}catch(e){}}
};
function lvInfo(xp){
  let lv=1,need=400;
  while(xp>=need && lv<999){xp-=need;lv++;need=400+100*(lv-1)}
  return {lv,cur:lv>=999?need:xp,need};
}
const fmt=n=>Number(n).toLocaleString('en-US');

function render(){
  const d=PD.data,L=lvInfo(d.xp);
  document.getElementById('nm').textContent=d.name;
  document.getElementById('lvnum').textContent=L.lv;
  document.getElementById('xptxt').textContent=L.cur+' / '+L.need;
  document.getElementById('xpfill').style.width=Math.min(100,L.cur/L.need*100)+'%';
  document.getElementById('xpnote').textContent='Butuh '+(L.need-L.cur)+' XP lagi ke Level '+Math.min(999,L.lv+1);
  document.getElementById('v-em').textContent=PD.ready?fmt(d.emerald):'—';
  document.getElementById('v-co').textContent=PD.ready?fmt(d.coin):'—';
}
/* titik merah Mail: ada surat belum dibaca / hadiah belum diklaim */
try{const M=JSON.parse(localStorage.getItem('dragonroll:mail'));const md=document.getElementById('mailDot');if(M&&md)md.hidden=!M.mails.some(m=>!m.read||(m.rw&&!m.claimed))}catch(e){}
render();
document.getElementById('xpfill').style.width='0';
setTimeout(()=>{PD.ready=true;render();
  ['cur-em','cur-co'].forEach(i=>{const e=document.getElementById(i);e.classList.add('bump')});
  /* Multiplayer.Progress.dailyLogin() dipanggil di sini pada proyek utama */
},700);

/* ---- syarat Chest: minimal main 10 kali. Hitungan di localStorage 'dragonroll:stats:played' (di proyek utama: jumlah match dari server).
   Untuk uji coba: buka lobby.html?played=10 ---- */
const CHEST_MIN=10,PLAYED_K='dragonroll:stats:played';
(function(){const q=new URLSearchParams(location.search).get('played');if(/^\d+$/.test(q||''))try{localStorage.setItem(PLAYED_K,q)}catch(e){}})();
const played=()=>{try{return Math.max(0,parseInt(localStorage.getItem(PLAYED_K),10)||0)}catch(e){return 0}};
function chestTile(){
  const el=document.querySelector('[data-act="chest"]');if(!el)return;
  const n=played(),ok=n>=CHEST_MIN;
  el.classList.toggle('soon',!ok);
  const tag=el.querySelector('.tag');if(tag)tag.textContent=ok?'GRATIS':'🔒 '+Math.min(n,CHEST_MIN)+'/'+CHEST_MIN;
  const b=el.querySelector('.tm b');if(b)b.textContent=ok?'Buka sekarang':'Main '+CHEST_MIN+'x dulu';
}
chestTile();
/* ---- toast & navigasi ---- */
let tt;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
function go(act){
  if(SOON[act]){toast(SOON[act]);return}
  if(act==='chest'&&played()<CHEST_MIN){toast('Chest terbuka setelah main minimal '+CHEST_MIN+' kali ('+played()+'/'+CHEST_MIN+')');return}
  const url=ACT[act]; if(!url)return;
  if(!NAVIGATE){toast('→ '+url);return}
  if(!BUILT.includes(url.split('?')[0])){toast('Segera hadir');return}
  const f=document.getElementById('fade');f.classList.add('on');setTimeout(()=>{location.href=url},330);
}
document.querySelectorAll('[data-act]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.act)));

/* ---- skala kanvas ---- */
function fit(){
  const s=Math.min(innerWidth/1920,innerHeight/1080);
  document.getElementById('stage').style.transform='scale('+s+')';
}
addEventListener('resize',fit);fit();

/* ---- pulau voxel melayang (SVG isometrik) ---- */
const NS='http://www.w3.org/2000/svg';
const isl=document.getElementById('island');
function poly(pts,fill,extra){const p=document.createElementNS(NS,'polygon');p.setAttribute('points',pts.map(q=>q.join(',')).join(' '));p.setAttribute('fill',fill);
  p.setAttribute('stroke','rgba(20,30,10,.35)');p.setAttribute('stroke-width','2');p.setAttribute('stroke-linejoin','round');if(extra)for(const k in extra)p.setAttribute(k,extra[k]);isl.appendChild(p)}
function slab(cx,cy,w,d,c){ // cy = pusat diamond atas
  const h=w/2,N=[cx,cy-h/2],E=[cx+w/2,cy],S=[cx,cy+h/2],W=[cx-w/2,cy];
  poly([W,S,[S[0],S[1]+d],[W[0],W[1]+d]],c.l);
  poly([S,E,[E[0],E[1]+d],[S[0],S[1]+d]],c.r);
  poly([N,E,S,W],c.t);
}
const DIRT={t:'#8d6038',l:'#9b6a40',r:'#7b5230'}, STONE={t:'#7d808c',l:'#8a8d99',r:'#666975'}, DEEP={t:'#5d606c',l:'#6a6d79',r:'#4e515c'};
const GRASS={t:'#78cc4e',l:'#58a33a',r:'#478a2e'};
slab(960,872,150,70,DEEP);
slab(960,800,290,76,DEEP);
slab(960,728,430,76,STONE);
slab(960,654,560,80,DIRT);
// sisi tanah + pita rumput di atas
{const cx=960,cy=580,w=640,h=w/2,d=84,g=28;
  const W=[cx-w/2,cy],S=[cx,cy+h/2],E=[cx+w/2,cy],N=[cx,cy-h/2];
  poly([W,S,[S[0],S[1]+d],[W[0],W[1]+d]],DIRT.l);
  poly([S,E,[E[0],E[1]+d],[S[0],S[1]+d]],DIRT.r);
  poly([W,S,[S[0],S[1]+g],[W[0],W[1]+g]],GRASS.l);
  poly([S,E,[E[0],E[1]+g],[S[0],S[1]+g]],GRASS.r);
  poly([N,E,S,W],GRASS.t);
  // petak kotak-kotak di permukaan
  for(let i=1;i<8;i++){const a=i/8;
    const l=document.createElementNS(NS,'line');l.setAttribute('x1',W[0]+(N[0]-W[0])*a);l.setAttribute('y1',W[1]+(N[1]-W[1])*a);
    l.setAttribute('x2',S[0]+(E[0]-S[0])*a);l.setAttribute('y2',S[1]+(E[1]-S[1])*a);l.setAttribute('stroke','rgba(40,100,20,.22)');isl.appendChild(l);
    const m=document.createElementNS(NS,'line');m.setAttribute('x1',W[0]+(S[0]-W[0])*a);m.setAttribute('y1',W[1]+(S[1]-W[1])*a);
    m.setAttribute('x2',N[0]+(E[0]-N[0])*a);m.setAttribute('y2',N[1]+(E[1]-N[1])*a);m.setAttribute('stroke','rgba(40,100,20,.22)');isl.appendChild(m);}
}
// pohon & semak voxel (urut dari belakang ke depan)
const LEAF={t:'#4caf3a',l:'#368a2a',r:'#2b7222'}, LEAF2={t:'#5cc443',l:'#3f9a30',r:'#318028'}, WOOD={t:'#a8794a',l:'#7e5530',r:'#684526'};
function tree(x,y,s){slab(x,y,34*s,64*s,WOOD);slab(x,y-58*s,120*s,46*s,LEAF);slab(x,y-100*s,80*s,40*s,LEAF2)}
tree(830,545,1);
tree(1090,525,.85);
slab(1180,600,70,30,LEAF);
slab(760,622,56,24,LEAF2);
// batu kecil
slab(1115,650,56,26,STONE);

/* ---- karakter: mengikuti layar Equipment (penerapan/fcuBiA) ----
   Hero chibi di atas pedestal batu bertingkat, nama di bawahnya, lalu "Level" + persen + bar XP. */
function cyl(cx,cy,rx,ry,h,top,side,line){
  return `<path d="M${cx-rx},${cy} v${h} a${rx},${ry} 0 0 0 ${rx*2},0 v${-h} Z" fill="${side}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>`+
         `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${top}" stroke="${line}" stroke-width="3"/>`;
}
const H=getHero(),HL=lvInfo(PD.data.xp),HFEET=608;
const HART=H.art||heroIcon(H),HW=H.art?290:190,HH=H.art?Math.round(290*598/619):190;
document.getElementById('avatarImg').src=HART;
const hero=document.createElementNS(NS,'g');hero.id='hero';
hero.innerHTML=`
 <g transform="translate(960,0)">
  <ellipse cx="0" cy="${HFEET+32}" rx="190" ry="36" fill="rgba(10,25,50,.28)"/>
  ${cyl(0,HFEET+12,162,39,24,'#4b4370','#2f2949','#17122b')}
  ${cyl(0,HFEET+1,128,31,20,'#5d5486','#3b3459','#17122b')}
  ${cyl(0,HFEET-8,95,23,16,'#6f66a0','#463e6b','#17122b')}
  <ellipse cx="0" cy="${HFEET-8}" rx="74" ry="17" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/>
  <g class="bob"><image href="${HART}" x="${-HW/2}" y="${HFEET-6-HH+(H.art?8:0)}" width="${HW}" height="${HH}" preserveAspectRatio="xMidYMax meet"/></g>
 </g>`;
isl.appendChild(hero);

/* nama + level + bar XP di bawah pedestal (tidak ikut melompat) */
const tag=document.createElementNS(NS,'g');tag.id='herotag';tag.setAttribute('pointer-events','none');
const ty=HFEET+96,bw=330,pct=Math.min(100,HL.cur/HL.need*100);
tag.innerHTML=`
 <text x="960" y="${ty}" text-anchor="middle" class="svt" font-size="54">${H.name}</text>
 <text x="${960-bw/2-16}" y="${ty+58}" text-anchor="end" class="svt" font-size="64">${HL.lv}</text>
 <text x="${960-bw/2}" y="${ty+30}" class="svb" font-size="26">Level</text>
 <text x="${960+bw/2}" y="${ty+30}" text-anchor="end" class="svb" font-size="22">${pct.toFixed(1)}%</text>
 <rect x="${960-bw/2}" y="${ty+38}" width="${bw}" height="18" rx="3" fill="#1c1730" stroke="#0e0a1c" stroke-width="2"/>
 <rect x="${960-bw/2+2}" y="${ty+40}" width="${Math.max(0,(bw-4)*pct/100)}" height="14" rx="2" fill="#b9c3ff"/>`;
isl.appendChild(tag);
let busy=false;
hero.addEventListener('click',()=>{
  if(busy)return;busy=true;
  const a=Math.random()<.5?'jump':'spin';
  hero.classList.add(a);
  setTimeout(()=>{hero.classList.remove(a);busy=false},a==='jump'?560:720);
  document.getElementById('hint').style.display='none';
});

/* ---- kilau + hitung mundur hadiah gratis ---- */
{const st=document.getElementById('stage');
 for(let i=0;i<14;i++){const e=document.createElement('i');e.className='spark';
  e.style.left=(560+Math.random()*800)+'px';e.style.top=(300+Math.random()*520)+'px';e.style.animationDelay=(Math.random()*4)+'s';
  e.style.scale=.5+Math.random();st.insertBefore(e,document.getElementById('hint'))}
 let sec=2*3600+59*60;setInterval(()=>{sec=Math.max(0,sec-1);document.getElementById('fgT').textContent=Math.floor(sec/3600)+'j '+String(Math.floor(sec%3600/60)).padStart(2,'0')+'m'},1000)}
