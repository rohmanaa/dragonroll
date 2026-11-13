/* =========================================================================
   LOGIKA — mengikuti README (room.html)
   - vsc/local (offline): pemain dibuat di klien (Bot atau Pemain 2..n), semua otomatis siap. START -> launch.
   - online: host membuat room (kode 6 karakter, awal PRIVAT, maxPlayers 2 solo / 4 team). Tamu masuk lewat kode (role=guest&code=...).
     Syarat START (check): online team harus 4 pemain 2 vs 2; online solo min. 2 pemain; kamu READY; semua pemain lain READY; hanya host.
     Pemain online TIDAK mengirim power loadout dan memakai skin/dadu akun masing-masing.
   - Team offline: host bisa memindah pemain antar tim (maks. 2 per tim).
   - Keluar: leaveRoom (ditolak bila game berjalan: GAME_IN_PROGRESS).
   Server/realtime DISIMULASIKAN (teman bergabung otomatis setelah diundang). NAVIGATE=false -> hanya toast.
   ========================================================================= */
const NAVIGATE=true;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const q=new URLSearchParams(location.search);
const MODE=['vsc','local','online'].includes(q.get('mode'))?q.get('mode'):'vsc';
const FORMAT=q.get('format')==='team'?'team':'solo';
let COUNT=Math.min(4,Math.max(2,+q.get('count')||2));
const ROLE=q.get('role')==='guest'?'guest':'host';
const ONLINE=MODE==='online';
let MAXP=ONLINE?(FORMAT==='team'?4:2):COUNT;
if(!ONLINE&&FORMAT==='team')COUNT=4;
const isHost=ROLE==='host';
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2000)}
function nav(u){if(!NAVIGATE){toast('→ '+u);return}$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)}

/* ---- ikon Equipment & Power: dibaca dari pilihan di halaman koleksi (localStorage), data ringkas sama dengan halamannya ---- */
const K='assets/komponen/';
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const RAW=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const E_FRAME=[['perunggu','Frame Perunggu','slot-coklat'],['perak','Frame Perak','slot-biru'],['zamrud','Frame Zamrud','slot-hijau'],['ametis','Frame Ametis','slot-ungu'],['emas','Frame Emas','slot-terpilih'],['naga','Frame Naga','slot-merah']];
const E_DICE=[['putih','Dadu Putih','grayscale(1) brightness(1.9) contrast(.9)'],['klasik','Dadu Klasik','none'],['rumput','Dadu Rumput','hue-rotate(110deg) saturate(1.1)'],['samudra','Dadu Samudra','hue-rotate(200deg) saturate(1.2)'],['zamrud','Dadu Zamrud','hue-rotate(160deg) saturate(1.3) brightness(1.15)'],['ametis','Dadu Ametis','hue-rotate(260deg) saturate(1.1)'],['api','Dadu Api','hue-rotate(40deg) saturate(2) brightness(1.3)'],['bayangan','Dadu Bayangan','grayscale(1) brightness(.45) contrast(1.2)']];
const E_FX=[['none','Tanpa Efek','glyph-putih/bintang-kilau',1],['api','Aura Api','ikon-gem-medali/kristal-api'],['es','Aura Es','ikon-gem-medali/panji-es'],['petir','Aura Petir','ikon-gem-medali/petir-emas'],['zamrud','Aura Zamrud','ikon-gem-medali/berlian-hijau'],['ametis','Aura Ametis','ikon-gem-medali/berlian-ungu'],['darah','Aura Rubi','ikon-gem-medali/berlian-merah'],['naga','Aura Naga','ikon-gem-medali/petir-ungu']];
const E_POWER=[['iron','Iron Sword','ikon-item/pedang'],['diamond','Diamond Sword','ikon-item/pedang-silang'],['netherite','Netherite Sword','ikon-item/panji-pedang'],['shield','Wooden Shield','ikon-item/perisai-kayu'],['tnt','TNT','ikon-item/bom'],['feather','Feather','glyph-putih/bulu',1],['apple','Golden Apple','glyph-putih/apple',1],['totem','Totem','ikon-item/piala'],['pearl','Ender Pearl','ikon-gem-medali/berlian-ungu'],['odd','Ramuan Ganjil','ikon-item/ramuan-ungu'],['even','Ramuan Genap','ikon-item/ramuan-biru'],['fire','Fire Charge','ikon-gem-medali/kristal-api'],['ice','Ice Crystal','ikon-gem-medali/berlian-biru'],['blaze','Blaze Core','ikon-gem-medali/petir-emas'],['trident','Trident','ikon-gem-medali/panah-tombak'],['dragon','Dragon Crystal','ikon-gem-medali/berlian-merah'],['star','Nether Star','ikon-item/bintang']];
const KEYS={skin:'SKIN',frame:'FRAME',dice:'DADU',fx:'EFEK'};
/* halaman koleksi yang dibuka di modal layar penuh */
const PAGES={skin:'karakter.html',frame:'frame.html',dice:'dadu.html',fx:'efek.html',power:'powerup.html'};
const LOAD_K='dragonroll:pref:powerLoadout';
const pref=(key,list,def)=>{const id=RAW('dragonroll:pref:'+key),own=LS('dragonroll:own:'+key,[]);return list.find(x=>x[0]===id&&(x[0]===def||own.includes(id)))||list.find(x=>x[0]===def)};
const readLoadout=()=>{const own=LS('dragonroll:own:power',{})||{},ids=LS(LOAD_K,[]);return (Array.isArray(ids)?ids:[]).map(id=>E_POWER.find(x=>x[0]===id)).filter(p=>p&&(own[p[0]]??1)>0).slice(0,5)};
const MAP={world:{n:'WORLD',goal:'Ender Dragon di Block 100',end:100,c:['#6cc4ff','#c8ecff','#78cc4e','#58a33a','#8d6038']},
           nether:{n:'NETHER',goal:'Wither di Block 120',end:120,c:['#4a0d12','#a1301a','#a33a3a','#7a2828','#4b2020']}};
const mapId=(()=>{try{const v=localStorage.getItem('dragonroll:pref:roomMap');return MAP[v]?v:'world'}catch(e){return 'world'}})();
const img=(p,glyph,style)=>`<img ${glyph?'class="glyph" ':''}src="${K}${p}.webp" alt=""${style?` style="${style}"`:''}>`;

/* ---- header ---- */
const MODENAME={vsc:'VS COMPUTER',local:'MULTI PLAYER',online:'ONLINE'};
function drawChips(){$('#chips').innerHTML=`<span class="chip">${MODENAME[MODE]}</span><span class="chip">${FORMAT==='team'?'TEAM 2 vs 2':'SOLO'}</span><span class="chip">${MAXP} pemain</span><span class="chip ${ONLINE?'on':''}">${ONLINE?(isHost?'● HOST':'● TAMU'):'OFFLINE'}</span>`}
drawChips();

/* ---- equipment ---- */
function equipItem(k){
  if(k==='skin'){const h=getHero();return {n:h.name,html:`<img src="${heroIcon(h)}" alt="">`}}
  if(k==='frame'){const f=pref('frame',E_FRAME,'perunggu'),h=getHero(),ph=RAW('dragonroll:profile:photo');
    const av=ph?`<img src="${ph}" alt="">`:(h.art?`<img src="${h.art}" alt="">`:`<img class="ico" src="${heroIcon(h)}" alt="">`);
    return {n:f[1],html:`<div class="fr"><img class="fb" src="${K}slot-equipment/${f[2]}.webp" alt=""><div class="av">${av}</div></div>`}}
  if(k==='dice'){const d=pref('dice',E_DICE,'putih');return {n:d[1],html:img('new-icon/dadu',0,(d[2]==='none'?'':'filter:'+d[2]+' drop-shadow(0 4px 3px rgba(0,0,0,.45))'))}}
  const x=pref('fx',E_FX,'none');return {n:x[1],html:img(x[2],x[3])};
}
function drawEquip(){
  $('#eqgrid').innerHTML=Object.keys(KEYS).map(k=>{const it=equipItem(k);
   return `<button class="slot" data-k="${k}"><span class="chg">✎</span><div class="k">${KEYS[k]}</div>${it.html}<div class="v">${it.n}</div></button>`}).join('');
  $$('#eqgrid .slot').forEach(b=>b.onclick=()=>openPage(b.dataset.k));
}
/* ---- power loadout ---- */
function drawPower(){
  if(ONLINE){$('#power').classList.add('dis')}
  const ld=readLoadout();
  $('#prow').innerHTML=Array.from({length:5},(_,i)=>{const p=ld[i];
    return p?`<div class="ps full" data-i="${i}">${img(p[2],p[3])}<span class="x" data-x="${i}">×</span></div>`:`<div class="ps" data-i="${i}"><b>+</b></div>`}).join('');
  $('#pinfo').textContent=ONLINE?'Mode online: power loadout tidak dikirim, kamu memakai skin & dadu dari akunmu.':(ld.length?ld.map(p=>p[1]).join(' · '):'Pilih sampai 5 power-up untuk dibawa.');
  $$('#prow .ps').forEach(e=>e.onclick=ev=>{
    if(ev.target.dataset.x!=null){const ids=ld.map(p=>p[0]);ids.splice(+ev.target.dataset.x,1);try{localStorage.setItem(LOAD_K,JSON.stringify(ids))}catch(e){}drawPower();return}
    openPage('power')});
}
/* ---- map ---- */
function drawMap(){
  const m=MAP[mapId],c=m.c;
  const t=(cx,cy,w,d,a,l,r)=>{const h=w/2;return `<polygon points="${cx-w/2},${cy} ${cx},${cy+h/2} ${cx},${cy+h/2+d} ${cx-w/2},${cy+d}" fill="${l}"/><polygon points="${cx},${cy+h/2} ${cx+w/2},${cy} ${cx+w/2},${cy+d} ${cx},${cy+h/2+d}" fill="${r}"/><polygon points="${cx},${cy-h/2} ${cx+w/2},${cy} ${cx},${cy+h/2} ${cx-w/2},${cy}" fill="${a}"/>`};
  $('#mpic').innerHTML=`<svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect width="300" height="150" fill="url(#mg)"/>${t(150,60,190,36,c[2],c[3],c[4])}</svg>`;
  $('#mtxt').innerHTML=`<div class="n ttl">${m.n}</div><div>Garis finis: <b>Block ${m.end}</b></div><div>Boss: <b>${m.goal.split(' di ')[0]}</b></div><div>Tangga 5 · Ular 5 · Peti 7</div>`;
}
/* ---- modal layar penuh: halaman koleksi (karakter/frame/dadu/efek/powerup) di iframe ---- */
let pageFrame=null;
function openPage(kind){
  if(!PAGES[kind])return;
  const box=$('#pageModal');
  box.innerHTML=`<iframe id="pageFrame" src="${PAGES[kind]}?embed=1" title="${kind}"></iframe>`;
  pageFrame=$('#pageFrame');
  box.classList.add('on');
}
function closePage(){
  const box=$('#pageModal');box.classList.remove('on');box.innerHTML='';pageFrame=null;
  drawEquip();drawPower();
}
addEventListener('message',e=>{if(pageFrame&&e.source===pageFrame.contentWindow&&e.data&&e.data.type==='room-close')closePage()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&pageFrame)closePage()});

/* ---- pemain ---- */
const COL=['#3d8bff','#ff5468','#43b63a','#f1b21f'];
let players=[];let access='private';
const code=(()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];return q.get('code')||s})();
function initPlayers(){
  const me={id:'me',name:'Ryuen',me:true,host:isHost,ready:false,team:0};
  players=[me];
  if(!ONLINE){
    for(let i=1;i<COUNT;i++)players.push({id:'p'+i,name:MODE==='vsc'?'Bot '+i:'Pemain '+(i+1),bot:MODE==='vsc',ready:true,team:FORMAT==='team'?(i%2===1?1:0):i%2});
    if(FORMAT==='team'){players.forEach((p,i)=>p.team=i<2?0:1)}
  }else if(!isHost){
    players=[{id:'h',name:'RajaBlok',host:true,ready:true,team:0},{...me,host:false,team:1}];
  }
}
function teamOf(p){return FORMAT==='team'?p.team:null}
function unlockSlot(){
  if(!isHost){toast('Hanya host yang bisa membuka slot');return}
  if(MAXP>=4)return;
  MAXP++;
  if(!ONLINE){const i=players.length;players.push({id:'p'+i,name:MODE==='vsc'?'Bot '+i:'Pemain '+(i+1),bot:MODE==='vsc',ready:true,team:i%2})}
  toast('Slot dibuka ('+MAXP+'/4)');draw();drawChips();
}
function check(){
  const n=players.length;
  if(ONLINE){
    if(FORMAT==='team'){if(n<4)return {ok:false,why:`Team butuh 4 pemain (${n}/4)`};
      const a=players.filter(p=>p.team===0).length,b=n-a;if(a!==2||b!==2)return {ok:false,why:'Tim harus 2 vs 2'}}
    else if(n<2)return {ok:false,why:'Butuh minimal 2 pemain'};
  }
  const me=players.find(p=>p.me);
  if(!me.ready)return {ok:false,why:'Tekan READY dulu'};
  if(players.some(p=>!p.me&&!p.ready))return {ok:false,why:'Menunggu semua pemain READY'};
  if(ONLINE&&!isHost)return {ok:false,why:'Menunggu host memulai'};
  return {ok:true,why:'Semua siap!'};
}
function row(p){
  const c=COL[(p.team!=null&&FORMAT==='team'?p.team:players.indexOf(p))%4];
  const bd=p.host?'<span class="badge host">HOST</span>':p.bot?'<span class="badge bot">BOT</span>':'';
  const st=p.ready?'<span class="badge rdy">READY</span>':'<span class="badge wait">BELUM</span>';
  const mv=(!ONLINE&&FORMAT==='team'&&!p.me&&isHost)?`<button class="mv" data-mv="${p.id}" title="Pindah tim">⇄</button>`:'';
  return `<div class="pl ${p.me?'me':''}"><div class="av" style="background:${c};border-color:#fff">${p.name[0]}</div><div><div class="nm ttl">${p.name}${p.me?' (Kamu)':''}</div><div class="sb">${p.bot?'Computer':ONLINE?'Online':'Lokal'}</div></div><div class="grow"></div>${mv}${bd}${st}</div>`;
}
function draw(){
  const L=$('#list');let h='';
  if(FORMAT==='team'){
    [0,1].forEach(t=>{const g=players.filter(p=>p.team===t);
      h+=`<div class="team"><i style="background:${COL[t]}"></i>TIM ${t?'MERAH':'BIRU'} <span style="font-size:20px;opacity:.8">${g.length}/2</span></div>`+g.map(row).join('');
      for(let i=g.length;i<2;i++)h+=`<div class="pl empty">Menunggu pemain…</div>`});
  }else{
    h=players.map(row).join('');
    for(let i=players.length;i<MAXP;i++)h+=`<div class="pl empty">Menunggu pemain…</div>`;
    for(let i=MAXP;i<4;i++)h+=`<button class="pl empty lock" data-unlock="1"><img src="${K}glyph-putih/gembok.webp" alt=""><span>SLOT TERKUNCI</span><b>${isHost?'BUKA':'HOST'}</b></button>`;
  }
  L.className=FORMAT==='team'?'cmp':'';L.innerHTML=h;
  $$('[data-unlock]').forEach(b=>b.onclick=unlockSlot);
  $$('[data-mv]').forEach(b=>b.onclick=()=>{const p=players.find(x=>x.id===b.dataset.mv);const to=p.team?0:1;
    if(players.filter(x=>x.team===to).length>=2){toast('Tim penuh (maks. 2)');return}p.team=to;draw()});
  const me=players.find(p=>p.me);
  $('#ready span').textContent=me.ready?'BATAL READY':'READY';
  $('#ready').style.display='';
  const c=check();$('#why').textContent=c.why;
  $('#start').classList.toggle('off',!c.ok);
  $('#start').style.display=(ONLINE&&!isHost)?'none':'';
}
/* ---- bar atas Player Room ---- */
function drawBar(){
  if(!ONLINE){$('#bar').innerHTML=`<div id="code" style="font-size:24px"><span>${MODE==='vsc'?'Lawan bot — bot otomatis siap, tekan READY':'Satu perangkat, bermain bergantian — tekan READY'}</span></div>`;return}
  $('#bar').innerHTML=`<div id="code"><span>KODE ROOM</span><b>${code}</b><button id="cp1">SALIN</button></div>`+
    (isHost?`<button class="btn bsm" id="bacc"><img src="${K}tombol-dan-kontrol/tombol-ungu-polos.webp" alt=""><span>${access==='private'?'PRIVAT':'PUBLIK'}</span></button><button class="btn bsm" id="binv"><img src="${K}tombol-dan-kontrol/tombol-biru-polos.webp" alt="" onerror="this.src='${K}tombol-dan-kontrol/tombol-biru.webp'"><span>INVITE</span></button>`:'');
  $('#cp1').onclick=()=>copy(code);
  if(isHost){$('#bacc').onclick=()=>openInvite();$('#binv').onclick=()=>openInvite()}
}
function copy(t){try{navigator.clipboard.writeText(t)}catch(e){}toast('Tersalin: '+t)}
/* ---- invite ---- */
const FR=[['Budi_Blox','Di lobi'],['SiNaga99','Di lobi'],['Mira','Di lobi'],['Kevin_X','Sibuk']];
let invited=new Set();
function openInvite(){
  $('#icode').textContent='Kode: '+code;$('#ilink').textContent=location.origin&&location.origin!=='null'?location.origin+location.pathname+'?mode=online&role=guest&code='+code:'room.html?mode=online&role=guest&code='+code;
  $$('#acc button').forEach(b=>b.classList.toggle('on',b.dataset.v===access));
  $('#friends').innerHTML=FR.map((f,i)=>{const busy=f[1]==='Sibuk',on=invited.has(i);
   return `<div class="fr"><div class="av" style="background:${COL[(i+2)%4]};border-color:#fff">${f[0][0]}</div><div class="grow">${f[0]}<small>${f[1]}</small></div>
    <button class="btn inv ${busy||on?'off':''}" data-f="${i}"><img src="${K}tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span>${on?'TERKIRIM':'UNDANG'}</span></button></div>`}).join('');
  $$('#friends [data-f]').forEach(b=>b.onclick=()=>invite(+b.dataset.f));
  $('#invite').classList.add('on');
}
$$('#acc button').forEach(b=>b.onclick=()=>{access=b.dataset.v;$$('#acc button').forEach(x=>x.classList.toggle('on',x===b));drawBar();toast('Akses room: '+(access==='private'?'Privat':'Publik'))});
$$('[data-copy]').forEach(b=>b.onclick=()=>copy(b.dataset.copy==='code'?code:$('#ilink').textContent));
$('#idone').onclick=()=>$('#invite').classList.remove('on');
function invite(i){
  if(players.length>=MAXP){toast('Room penuh');return}
  invited.add(i);openInvite();toast('Undangan dikirim ke '+FR[i][0]);
  setTimeout(()=>{ /* simulasi: teman bergabung via realtime */
    if(players.length>=MAXP)return;
    const t=FORMAT==='team'?(players.filter(p=>p.team===0).length<2?0:1):0;
    const np={id:'f'+i,name:FR[i][0],ready:false,team:t};players.push(np);draw();toast(np.name+' bergabung');
    setTimeout(()=>{np.ready=true;draw()},1600+Math.random()*1800);
  },1500);
}
/* ---- tombol utama ---- */
$('#ready').onclick=()=>{const me=players.find(p=>p.me);me.ready=!me.ready;draw()};
$('#start').onclick=()=>{
  const c=check();if(!c.ok){toast(c.why);return}
  const cfg=`mode=${MODE==='vsc'?'cpu':players.length}&theme=${mapId}&format=${FORMAT}`;
  toast('Memulai…');setTimeout(()=>toast('Gameplay segera hadir'),400);
};
function leave(){
  if(window.__gameRunning){toast('GAME_IN_PROGRESS');return}
  nav(ONLINE?'mode.html':'mode.html');
}
$('#back').onclick=leave;$('#leave').onclick=leave;

initPlayers();drawEquip();drawPower();drawMap();drawBar();draw();
/* dari friendship.html: ?invite=<id teman> -> host online langsung mengirim undangan */
if(ONLINE&&isHost&&q.get('invite')){
  try{const fl=(JSON.parse(localStorage.getItem('dragonroll:friends'))||{}).friends||[];
    const f=fl.find(x=>x.id===q.get('invite'));
    if(f){let i=FR.findIndex(x=>x[0]===f.name);if(i<0){FR.push([f.name,'Di lobi']);i=FR.length-1}setTimeout(()=>invite(i),600)}}catch(e){}
}
/* tamu online: tiruan host menekan ready lalu memulai */
if(ONLINE&&!isHost)setTimeout(()=>toast('Terhubung ke room '+code),500);
/* skala */
function fit(){const s=Math.min(innerWidth/1920,innerHeight/1080);$('#stage').style.transform='scale('+s+')'}
addEventListener('resize',fit);fit();
