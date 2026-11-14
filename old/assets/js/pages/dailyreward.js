/* dailyreward.js — dipindah dari <script> inline (dailyreward.html). */
(()=>{
const $=s=>document.querySelector(s),fmt=n=>n.toLocaleString('id-ID');
// ---------- icons
const I={
gem:'<img class="ci" src="assets/Images/icon/currency/emerald.webp" alt="" draggable="false">',
coin:'<img class="ci" src="assets/Images/icon/currency/coin.webp" alt="" draggable="false">',
coins:'<svg viewBox="0 0 24 24"><ellipse cx="9" cy="17" rx="7" ry="3.500" fill="#e0a020" stroke="#c98a0c"/><ellipse cx="9" cy="14.500" rx="7" ry="3.500" fill="#ffc83a" stroke="#c98a0c"/><circle cx="16" cy="9" r="6" fill="#ffc83a" stroke="#c98a0c" stroke-width="1.200"/><text x="16" y="12" font-size="8" font-weight="900" text-anchor="middle" fill="#c98a0c">$</text></svg>',
box:'<svg viewBox="0 0 24 24"><path d="M12 2 3 6.500v11L12 22l9-4.500v-11z" fill="#a85ae8" stroke="#6a2ab0" stroke-width="1.200" stroke-linejoin="round"/><path d="M3 6.500 12 11l9-4.500M12 11v11" fill="none" stroke="#d6a8ff" stroke-width="1"/><text x="7.500" y="17.500" font-size="7" font-weight="900" fill="#fff" rotate="-8">?</text><text x="15" y="15" font-size="6" font-weight="900" fill="#ffe36a">?</text></svg>',
dice:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4.500" fill="#fff" stroke="#9ab4e0" stroke-width="1.200"/><g fill="#2f6fd0"><circle cx="8" cy="8" r="1.700"/><circle cx="16" cy="8" r="1.700"/><circle cx="12" cy="12" r="1.700"/><circle cx="8" cy="16" r="1.700"/><circle cx="16" cy="16" r="1.700"/></g></svg>',
skin:()=>UT.CharacterData.face('player','ender'), /* wajah Enderman dari UT.CharacterData */
ck:'<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
gift:'<svg viewBox="0 0 24 24"><path d="M4 11h16v10H4z" fill="#f5a623" stroke="#b86a0a" stroke-width=".8"/><path d="M3 8h18v4H3z" fill="#ffd24d" stroke="#b86a0a" stroke-width=".8"/><path d="M10.500 8h3v13h-3z" fill="#e8372c"/><path d="M12 8C8 8 7 3 10 3.600c1.600.5 2 4.400 2 4.400Zm0 0c4 0 5-5 2-4.400-1.600.5-2 4.400-2 4.400Z" fill="#ff5a3c" stroke="#b01e14" stroke-width=".8"/></svg>'};
$('#tgift').innerHTML='<img class="ic" src="assets/Images/icon/lobby/gift.webp" alt="" draggable="false" decoding="async">';$('#gemI').innerHTML=I.gem;$('#coinI').innerHTML=I.coin;
// ---------- data (reward table memakai ID canonical dari ItemCatalog; lihat DATA_MIGRATION.md)
const PD=window.PlayerData,IC=window.ItemCatalog;
/* B5: akun login + flag -> status & klaim dari SERVER (hari WIB, tanggal bukan dari jam perangkat). SD = hasil daily_reward_get. */
const SV=()=>PD.serverMode(),WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get();
let SD=null,RESET_AT=0,busy=false;
const SRV=()=>SV()&&!!SD;
function applyDaily(r){if(!r||!r.ok)return false;SD={claimed:+r.claimed||0,claimed_today:!!r.claimed_today,box:+r.box||0};D.claimed=SD.claimed;BAG.box=SD.box;RESET_AT=Date.now()+(+r.seconds_to_reset||0)*1000;return true}
const R=[
 {h:'Hari 1',a:'x300',t:'300 Coin',ic:I.coin,ty:'coin',n:300},
 {h:'Hari 2',a:'x500',t:'500 Coin',ic:I.coin,ty:'coin',n:500},
 {h:'Hari 3',a:'x1',t:'Mystery Box x1',ic:I.box,ty:'box',n:1},
 {h:'Hari 4',a:'x5',t:'5 Gem',ic:I.gem,ty:'gem',n:5},
 {h:'Hari 5',a:'x800',t:'800 Coin',ic:I.coin,ty:'coin',n:800},
 {h:'Hari 6',a:'x10',t:'10 Gem',ic:I.gem,ty:'gem',n:10},
 {h:'Hari 7',a:'2.000+15',sub:'Coin + Gem',t:'2.000 Coin + 15 Gem',ic:I.coins,ty:'mix',big:1}];
// ---------- state: currency/ownership dari PlayerData. Status klaim harian HANYA dari server (daily_reward_get); key 'inv' tidak dibaca/ditulis lagi.
let D={claimed:0};
let BAG={box:0};
const doneToday=()=>!!(SD&&SD.claimed_today);
// ---------- helpers
const SET=()=>PD.settings();
const SFX={click:'button',select:'button',open:'button',error:'button',coin:'button',purchase:'power',chest:'chest'};
function playSound(n){if(!SET().sound)return;try{UT.Audio.play(SFX[n]||'button')}catch(e){}}
const buzz=()=>{if(SET().vibration&&navigator.vibrate)navigator.vibrate(20)};
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),1700)}
function sparkle(el,n=16){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;for(let i=0;i<n;i++){const s=document.createElement('i');s.className='sp';s.style.left=cx+'px';s.style.top=cy+'px';const a=Math.random()*6.28,d=40+Math.random()*80;s.style.setProperty('--dx',Math.cos(a)*d+'px');s.style.setProperty('--dy',Math.sin(a)*d+'px');document.body.appendChild(s);setTimeout(()=>s.remove(),900)}}
function pulse(id){const e=$(id);e.classList.remove('pulse');void e.offsetWidth;e.classList.add('pulse')}
// ---------- modal
const modal=$('#modal');let mOpen=false;
function openModal(html,init){$('#mb').innerHTML=html;modal.style.display='grid';requestAnimationFrame(()=>modal.classList.add('show'));mOpen=true;playSound('open');init&&init();$('#mx').focus()}
function closeModal(){if(!mOpen)return;mOpen=false;modal.classList.remove('show');setTimeout(()=>{if(!mOpen)modal.style.display='none'},250)}
$('#mx').addEventListener('click',closeModal);modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
// ---------- render
function state(i){return i<D.claimed?'done':(i===D.claimed&&!doneToday()&&D.claimed<7)?'now':'wait'}
function renderDays(){
 $('#days').innerHTML=R.map((r,i)=>{const st=state(i);
  return `<div class="day ${st} ${r.big?'big':''}" data-i="${i}" role="button" tabindex="0" aria-label="${r.h}: ${r.t}"><div class="hd">${r.h}</div><div class="ic">${r.ic}</div><div class="am ${r.s?'s':''}">${r.a}${r.sub?`<small>${r.sub}</small>`:''}</div><button class="st">${st==='done'?I.ck+'Diklaim':st==='now'?'Klaim':'Menunggu'}</button></div>`}).join('');
 document.querySelectorAll('.day').forEach(d=>{const go=()=>{const i=+d.dataset.i,st=state(i);if(st==='now')claim(i,d);else if(st==='done'){toast('Hadiah sudah diklaim.');playSound('click')}else{toast(i>D.claimed?'Belum waktunya, login besok!':'Sudah klaim hari ini, kembali besok!');playSound('error')}};
  d.addEventListener('click',go);d.addEventListener('keydown',e=>{if(e.key==='Enter')go()})});
 const tr=$('#track');tr.querySelectorAll('.nd').forEach(n=>n.remove());
 for(let i=0;i<7;i++){const n=document.createElement('div');n.className='nd'+(i<D.claimed?' dn':'');tr.appendChild(n)}
 $('#fill').style.width=`calc((100% - 2.6rem) * ${Math.min(D.claimed,6)/6})`;
 renderCurrency()}
function renderCurrency(){try{$('#gemV').textContent=(PD.walletReady()?fmt(PD.gems()):'—');$('#coinV').textContent=(PD.walletReady()?fmt(PD.coins()):'—')}catch(e){}}
try{if(!window.__curSub){window.__curSub=1;PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')try{renderCurrency()}catch(e){}})}}catch(e){} /* Tahap 6d: saldo tampil '—' sampai server membalas, lalu otomatis diperbarui */
// ---------- claim (semua reward lewat transaksi PlayerData: atomik, tidak bisa digandakan)
function done(r,msg,el){playSound('purchase');buzz();sparkle(el,22);pulse(r.ty==='gem'?'#gem':'#coin');renderDays();
 openModal(`<h2>Hadiah Diklaim!</h2><div class="rw">${r.ic}</div><div>${msg}</div><button class="ok" id="okb">Mantap!</button>`,()=>$('#okb').addEventListener('click',()=>{playSound('click');closeModal()}))}
function claim(i,el){if(!SV()){toast('Silakan login untuk mengklaim hadiah.');playSound('error');return}return claimServer(i,el)}
/* Akun server: nominal & item ditentukan server (claim_daily_reward); klien hanya menampilkan hasilnya. */
async function claimServer(i,el){if(busy)return;busy=true;
 try{const w=WS(),r=w?await w.claimDaily():{ok:false,reason:'jaringan'};
  if(!r.ok){const m={'sudah-klaim':'Sudah klaim hari ini, kembali besok!','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.'};
   toast(m[r.reason]||'Klaim gagal.');playSound('error');const d=await w.dailyGet();if(applyDaily(d)){renderDays();tick()}return}
  const row=R[(r.day||i+1)-1]||R[i];let msg=row.t;
  if(r.type==='box')msg='Mystery Box x1 diterima! Buka lewat tombol "Buka Box".';
  applyDaily({ok:true,claimed:r.day,claimed_today:true,box:(SD?SD.box:0)+(r.box?1:0),seconds_to_reset:r.seconds_to_reset});
  done(row,msg,el);renderBox()}
 finally{busy=false}}
/* Mystery Box: hadiah diundi server (open_mystery_box). Tombol muncul di panel kanan selama punya box. */
function renderBox(){let b=$('#openbox');if(!b){b=document.createElement('button');b.id='openbox';b.className='ok';b.style.cssText='position:absolute;left:.8rem;width:18.3rem;top:26.2rem;margin:0;height:4.4rem;font-size:1.9rem';b.addEventListener('click',openBox);$('#rt').appendChild(b)}
 const n=BAG.box|0;b.style.display=n>0&&SV()?'block':'none';b.textContent='Buka Box ('+n+')'}
async function openBox(){if(busy)return;busy=true;
 try{const w=WS(),r=w?await w.openBox():{ok:false,reason:'jaringan'};
  if(!r.ok){toast(r.reason==='tidak-ada-box'?'Tidak ada Mystery Box.':'Gagal membuka box.');playSound('error');const d=w&&await w.dailyGet();if(d&&applyDaily(d))renderBox();return}
  BAG.box=+r.box||0;const parts=[];if(r.coins)parts.push('+'+fmt(r.coins)+' Coin');if(r.gems)parts.push('+'+fmt(r.gems)+' Gem');
  playSound('purchase');buzz();renderCurrency();renderBox();
  openModal('<h2>Mystery Box!</h2><div class="rw">'+(r.gems?I.gem:I.coin)+'</div><div>'+parts.join(' ')+'</div><button class="ok" id="okb">Mantap!</button>',()=>$('#okb').addEventListener('click',()=>{playSound('click');closeModal()}))}
 finally{busy=false}}
// ---------- list modal
$('#see').addEventListener('click',()=>{playSound('click');
 openModal('<h2>Semua Hadiah</h2>'+R.map((r,i)=>`<div class="row ${state(i)==='now'?'cl':''}"><div class="ri">${r.ic}</div><div>${r.h}<small>${r.t}</small></div><span class="tag">${state(i)==='done'?'Diklaim':state(i)==='now'?'Klaim!':'Menunggu'}</span></div>`).join(''))});
// ---------- misc buttons
document.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>{playSound('click');(window.__go||function(u){location.href=u})(b.dataset.buy==='gem'?'tambang.html?from='+encodeURIComponent(/embed=1/.test(location.search)?'hadiah-misi.html':location.pathname.split('/').pop()):'shop.html?coin=1')}));
$('#back').addEventListener('click',()=>{playSound('click');(window.__go||function(u){location.href=u})('lobby.html')});
// ---------- countdown
function tick(){
 if(SRV()){const sec=Math.max(0,Math.ceil((RESET_AT-Date.now())/1000));
  $('#cd').textContent=[sec/3600|0,(sec%3600)/60|0,sec%60].map(v=>String(v).padStart(2,'0')).join(':');
  if(sec===0&&!tick.rf){tick.rf=1;WS().dailyGet().then(d=>{if(applyDaily(d))renderDays()}).finally(()=>setTimeout(()=>{tick.rf=0},3000))}
  return}
 $('#cd').textContent='--:--:--'}  /* tanpa server (belum login): hitung mundur tidak tersedia */
// ---------- 3D
let ok=typeof THREE!=='undefined';
const M=(c,r=.7)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
const bx=(w,h,d,m,x=0,y=0,z=0,p)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;p&&p.add(o);return o};
function island(){return UT.FloatingIsland.create(THREE,{seed:5,bob:0,scale:.92})} /* komponen bersama: assets/js/floating-island.js */
function hero(){const g=UT.MobView.make(THREE,'chicken',{mood:'happy'}); /* ayam senang menyambut hadiah (assets/js/mob-view.js) */
 g.rotation.y=.35;g.position.x=-.5;const root=new THREE.Group();root.add(g,island());root.userData.anim=t=>{g.userData.anim(t);root.position.y=Math.sin(t*1.3)*.08};return root}
function chest(){const g=new THREE.Group(),pu=M(0x8a3ad8,.5),go=M(0xffc83a,.35),gl=new THREE.MeshBasicMaterial({color:0xfff3a0});
 bx(5,2.6,3.4,pu,0,1.3,0,g);bx(5.2,1.6,3.6,pu,0,3.1,0,g);
 [-1.8,1.8].forEach(x=>{bx(.7,2.8,3.6,go,x,1.3,0,g);bx(.7,1.8,3.8,go,x,3.1,0,g)});
 bx(5.3,.4,3.7,go,0,2.5,0,g);bx(1.2,1.4,.3,go,0,2.2,1.75,g);bx(.5,.5,.35,M(0x6a2ab0),0,2.2,1.9,g);
 bx(3.4,.7,2.4,gl,0,4.1,0,g);
 const sp=[];for(let i=0;i<18;i++){const q=bx(.22,.22,.22,gl,0,0,0,g);q.castShadow=false;sp.push(q)}
 g.userData.anim=t=>{g.rotation.y=Math.sin(t*.7)*.5;g.position.y=-1.6+Math.sin(t*1.8)*.15;sp.forEach((q,i)=>{const a=t*1.2+i*.9,h=((t*.8+i*.37)%1);q.position.set(Math.cos(a)*(2.6+Math.sin(i)),3+h*3.5,Math.sin(a)*2);q.scale.setScalar(1-h);q.rotation.y=a})};return g}
const rigs=[];
function rig(cv,build,cy,dist,fov,cx=0,up=1,lk=1){if(!ok)return;try{const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});r.shadowMap.enabled=true;
 const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(fov,1,.1,100);sc.add(new THREE.AmbientLight(0xffffff,.65*lk),new THREE.HemisphereLight(0xcfeaff,0x6a9a50,.6*lk));
 const sun=new THREE.DirectionalLight(0xfff2d8,.9*lk);sun.position.set(6,12,8);sun.castShadow=true;sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.mapSize.set(1024,1024);sc.add(sun);
 const m=build();sc.add(m);rigs.push({r,sc,cam,cv,m,cy,dist,cx,up})}catch(e){ok=false;console.warn('WebGL unavailable',e)}}
function fit(){rigs.forEach(o=>{const w=o.cv.clientWidth,h=o.cv.clientHeight;if(!w||!h)return;o.r.setPixelRatio(Math.min(devicePixelRatio,1.5));o.r.setSize(w,h,false);o.cam.aspect=w/h;o.cam.updateProjectionMatrix()})}
function loop(){requestAnimationFrame(loop);const t=clock.getElapsedTime();rigs.forEach(o=>{o.m.userData.anim(t);o.cam.position.set(o.cx,o.cy+o.up,o.dist);o.cam.lookAt(o.cx,o.cy,0);o.r.render(o.sc,o.cam)})}
let clock;
if(ok){rig($('#glh'),hero,1.6,19,38,1.4,3,.72);rig($('#glc'),chest,2.3,18,34)}
if(ok&&rigs.length){clock=new THREE.Clock();new ResizeObserver(fit).observe(document.body);fit();requestAnimationFrame(loop)}
else{$('#hero').innerHTML='<div style="height:100%;display:grid;place-items:center;font-size:6rem">🧑‍🚀</div>';$('#chest').innerHTML='<div style="height:100%;display:grid;place-items:center;font-size:8rem">🎁</div>'}
// ---------- init
renderDays();renderBox();tick();setInterval(tick,1000);
if(SV()&&WS()){const sm=document.querySelector('#rst small');if(sm)sm.textContent='Reset 00.00 WIB:';WS().refresh().then(()=>renderCurrency());WS().dailyGet().then(d=>{if(applyDaily(d)){renderDays();renderBox();tick()}})} /* B5: status dari server */
document.documentElement.classList.add('ut-ready'); /* 4.1.17B: render awal selesai -> tampilkan halaman */
})();
