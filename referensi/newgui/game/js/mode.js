/* =========================================================================
   LOGIKA — mengikuti README (mode.html)
   - Carousel peta loop (swipe, panah, dots). Peta dari ItemCatalog: World & Nether + The End (terkunci, SOON). Pilihan disimpan di Prefs['roomMap'].
   - Hanya satu tile flip terbuka dalam satu waktu.
   - Quick Start: modal "MENCARI LAWAN…" 2,4 dtk (SIMULASI), lalu "LAWAN DITEMUKAN!" -> RoomFlow.launch(cfg) ke gameplay.
   - Create Room: RoomFlow.navigate('room', {mode, format, count}) -> room.html.
   NAVIGATE=false: hanya toast tujuan (halaman lain belum ada di repo GUI).
   ========================================================================= */
const NAVIGATE=true;
const MAPS=[
  {id:'world',name:'WORLD',sub:'Minecraft · Finis Block 100 · Ender Dragon',goal:'Ender Dragon di Block 100',sky:['#6cc4ff','#c8ecff'],ground:['#78cc4e','#58a33a','#8d6038']},
  {id:'nether',name:'NETHER',sub:'Finis Block 120 · Wither',goal:'Wither di Block 120',sky:['#4a0d12','#a1301a'],ground:['#a33a3a','#7a2828','#4b2020']},
  {id:'end',name:'THE END',sub:'Segera hadir',goal:'Belum tersedia',sky:['#120b25','#2b1a52'],ground:['#d9d9a8','#a8a87a','#6e6e50'],locked:true}
];
const SOONMSG='The End segera hadir';
const Prefs={get(k,d){try{return localStorage.getItem('dragonroll:pref:'+k)||d}catch(e){return d}},set(k,v){try{localStorage.setItem('dragonroll:pref:'+k,v)}catch(e){}}};
let cur=Math.max(0,MAPS.findIndex(m=>m.id===Prefs.get('roomMap','world')&&!m.locked));
const fmt=n=>Number(n).toLocaleString('en-US');
const $=s=>document.querySelector(s);
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2000)}
function nav(url){ if(!NAVIGATE){toast('→ '+url);return} $('#fade').classList.add('on');setTimeout(()=>location.href=url,330) }

/* saldo (tiruan) */
setTimeout(()=>{$('#v-em').textContent=fmt(120);$('#v-co').textContent=fmt(2500)},500);

/* ---- peta: gambar SVG isometrik kecil per peta ---- */
function mapSVG(m){
  const [s1,s2]=m.sky,[g1,g2,g3]=m.ground;
  const tile=(cx,cy,w,d,t,l,r)=>{const h=w/2;return `<polygon points="${cx-w/2},${cy} ${cx},${cy+h/2} ${cx},${cy+h/2+d} ${cx-w/2},${cy+d}" fill="${l}"/><polygon points="${cx},${cy+h/2} ${cx+w/2},${cy} ${cx+w/2},${cy+d} ${cx},${cy+h/2+d}" fill="${r}"/><polygon points="${cx},${cy-h/2} ${cx+w/2},${cy} ${cx},${cy+h/2} ${cx-w/2},${cy}" fill="${t}"/>`};
  let deco='';
  if(m.id==='world') deco=tile(300,285,40,60,'#a8794a','#7e5530','#684526')+tile(300,235,120,46,'#4caf3a','#368a2a','#2b7222')+tile(480,330,36,40,'#a8794a','#7e5530','#684526')+tile(480,295,90,36,'#5cc443','#3f9a30','#318028');
  if(m.id==='nether') deco=tile(330,300,70,90,'#2d2020','#241818','#1a1010')+tile(480,330,56,60,'#ff8a1f','#d9620f','#b84a08')+tile(260,340,44,40,'#ffb21f','#ea8a12','#c46d0a');
  if(m.id==='end') deco=tile(300,285,80,120,'#3a2a6e','#2c2058','#21184a')+tile(300,250,24,26,'#c77dff','#a24fe0','#8238c0');
  const stars=m.id==='end'?Array.from({length:30},(_,i)=>`<rect x="${(i*97)%600}" y="${(i*53)%260}" width="4" height="4" fill="#fff" opacity=".8"/>`).join(''):'';
  const lava=m.id==='nether'?'<rect x="0" y="560" width="600" height="130" fill="#ff6a1a" opacity=".85"/><rect x="0" y="560" width="600" height="14" fill="#ffd45a" opacity=".8"/>':'';
  return `<svg viewBox="0 0 600 690" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sk${m.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs>
   <rect width="600" height="690" fill="url(#sk${m.id})"/>${stars}${lava}
   <g transform="translate(0,80)">${tile(300,320,360,70,g1,g2,g3)}
   ${deco}</g></svg>`;
}
const track=$('#track');
MAPS.forEach(m=>{
  const d=document.createElement('div');d.className='map'+(m.locked?' locked':'');
  d.innerHTML=`<div class="pic">${mapSVG(m)}<div class="tag">${m.locked?'SOON':'PETA'}</div><div class="nm ttl">${m.name}</div><div class="lock"><img src="assets/komponen/ikon-item/gembok.webp" alt=""></div></div>`;
  track.appendChild(d);
});
const dots=$('#dots');MAPS.forEach((_,i)=>{const e=document.createElement('i');e.onclick=()=>show(i);dots.appendChild(e)});
function show(i,instant){
  cur=(i+MAPS.length)%MAPS.length;
  track.style.transition=instant?'none':'';track.style.transform=`translateX(${-cur*100}%)`;
  [...dots.children].forEach((e,k)=>e.classList.toggle('on',k===cur));
  const m=MAPS[cur];
  $('#mapinfo').innerHTML=m.locked?`<b>${m.name}</b> — ${m.sub}`:`<b>${m.name}</b><br>${m.sub}`;
  if(m.locked){toast(SOONMSG)} else Prefs.set('roomMap',m.id);
}
$('#prev').onclick=()=>show(cur-1);$('#next').onclick=()=>show(cur+1);
{ let x0=null;const v=$('#view');
  v.addEventListener('pointerdown',e=>{x0=e.clientX});
  addEventListener('pointerup',e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>50)show(cur+(dx<0?1:-1))});
  addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(cur-1);if(e.key==='ArrowRight')show(cur+1)}); }
show(cur,true);

/* ---- tile flip: satu terbuka dalam satu waktu ---- */
const flips=[...document.querySelectorAll('.flip')];
const closeAll=()=>flips.forEach(f=>f.classList.remove('open'));
function selectedMap(){const m=MAPS[cur];if(m.locked){toast(SOONMSG);return null}return m}
flips.forEach(f=>{
  f.querySelector('.front').addEventListener('click',()=>{ if(!selectedMap())return; const was=f.classList.contains('open');closeAll();if(!was)f.classList.add('open') });
  f.querySelector('.close').addEventListener('click',e=>{e.stopPropagation();f.classList.remove('open')});
});
/* isi tombol opsi */
document.querySelectorAll('.opts').forEach(o=>{
  const pairs=o.dataset.pairs?o.dataset.pairs.split('|').map(p=>p.split(':')):null;
  const counts=o.dataset.counts?o.dataset.counts.split(','):['2','3','4'];
  const list=pairs?pairs.map(([f,c,l,s])=>({format:f,count:c,label:l,sub:s})):counts.map(c=>({format:o.dataset.format,count:c,label:o.dataset.format==='team'?'2 vs 2':c,sub:o.dataset.format==='team'?'4 pemain':'pemain'}));
  const color=o.closest('#quick')?'ungu':'hijau';
  list.forEach(it=>{
    const b=document.createElement('button');b.className='opt';
    b.innerHTML=`<img src="assets/komponen/tombol-dan-kontrol/tombol-${pairs&&it.format==='team'?'kuning':color==='ungu'?'ungu':'hijau'}-polos.webp" alt=""><span>${it.label}</span><small>${it.sub}</small>`;
    b.onclick=e=>{e.stopPropagation();pick(o.dataset,it)};o.appendChild(b);
  });
});
function pick(ds,it){
  const m=selectedMap();if(!m)return;
  const cfg={mode:ds.mode||'quick',format:it.format,count:+it.count,map:m.id};
  if(ds.kind==='quick') ranked(cfg);
  else nav(`room.html?mode=${cfg.mode}&format=${cfg.format}&count=${cfg.count}`);
}

/* ---- Quick Start (simulasi pencarian lawan) ---- */
let timers=[];
function ranked(cfg){
  const modal=$('#modal');modal.classList.add('on');
  $('#mt').textContent='MENCARI LAWAN…';$('#ms').textContent=(cfg.format==='team'?'Team 2 vs 2':'Solo '+cfg.count+' pemain')+' · '+MAPS.find(x=>x.id===cfg.map).name;
  $('#spin').style.display='';$('#mplayers').innerHTML='';
  timers.push(setTimeout(()=>{
    $('#mt').textContent='LAWAN DITEMUKAN!';$('#spin').style.display='none';
    $('#mplayers').innerHTML=['Kamu',...Array.from({length:cfg.count-1},(_,i)=>'Lawan '+(i+1))].map(n=>`<div>${n}</div>`).join('');
    timers.push(setTimeout(()=>{modal.classList.remove('on');toast('Gameplay segera hadir')},1100));
  },2400));
}
$('#mcancel').onclick=()=>{timers.forEach(clearTimeout);timers=[];$('#modal').classList.remove('on')};
$('#back').onclick=()=>nav('lobby.html');

/* skala kanvas */
function fit(){const s=Math.min(innerWidth/1920,innerHeight/1080);$('#stage').style.transform='scale('+s+')'}
addEventListener('resize',fit);fit();
