
    if (window.__NO_THREE) { throw new Error('Three.js tidak dimuat'); }
(function(){
'use strict';
const $=id=>document.getElementById(id);
function showBootErr(){
  const p=document.createElement('p'); p.className='err';
  p.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99;margin:0;background:#fff;padding:12px 16px;border:3px solid #9B1C1C;box-shadow:0 4px 0 #9B1C1C';
  p.textContent='Grafik 3D tidak bisa dimulai di perangkat ini. Muat ulang halaman atau coba browser lain.';
  document.body.appendChild(p);
}
if(!window.THREE){ showBootErr(); return; }
if(!(window.UT&&UT.GameplayVoxelGeom)){ showBootErr(); return; }

/* ---------- Musik latar ---------- */
let bgMusic=null,musicOn=true,musicVol=30; /* volume musik bawaan 30% (bisa diubah di Pengaturan / menu jeda) */
try{ const mv=parseInt(UT.Prefs.get('musicVol',30),10); musicVol=isNaN(mv)?30:Math.max(0,Math.min(100,mv)); musicOn=UT.Prefs.get('musicOn',true)!==false; }catch(e){}
const MUSIC=['assets/music/first_light_particles.mp3','assets/music/community.mp3','assets/music/sunset_plains.mp3','assets/music/rainy.mp3']; /* playlist BGM gameplay: diputar berurutan, lalu ulang dari awal */
let musicIdx=0;
function ensureMusic(){
  if(bgMusic) return;
  try{
    bgMusic=new Audio(); bgMusic.src=MUSIC[musicIdx]; bgMusic.loop=false; bgMusic.preload='auto';
    bgMusic.addEventListener('ended',function(){ musicIdx=(musicIdx+1)%MUSIC.length; bgMusic.src=MUSIC[musicIdx]; playMusic(); });
  }
  catch(e){ bgMusic=null; }
}
function playMusic(){
  ensureMusic(); if(!bgMusic||!musicOn) return null;
  try{ bgMusic.volume=musicVol/100; const r=bgMusic.play(); if(r&&r.catch) r.catch(()=>{}); return r||null; }catch(e){ return null; }
}
function stopMusic(){
  if(!bgMusic) return; try{ bgMusic.pause(); }catch(e){}
}
function setMusicVol(v){ musicVol=Math.max(0,Math.min(100,v)); try{ UT.Prefs.set('musicVol',musicVol); }catch(e){} if(bgMusic) bgMusic.volume=musicVol/100; if(DM.active&&DM.a&&!DM.a.paused) DM.a.volume=musicVol/100; }
function setMusicOn(v){ musicOn=!!v; try{ UT.Prefs.set('musicOn',musicOn); }catch(e){} if(musicOn){ if(DM.active) dragonMusicStart(); else playMusic(); } else { stopMusic(); dragonMusicHalt(); } }
/* ---------- Musik Naga (muncul-naga.mp3): mulai saat pemain pertama masuk Block 100, loop + fade in/out, berhenti saat naga kalah / game selesai / game baru ---------- */
const DM={a:null,active:false,raf:0,fadeIn:2000,fadeOut:2500};
function dmTarget(){ return Math.max(0,Math.min(1,musicVol/100)); }
function dmFade(to,ms,done){
  cancelAnimationFrame(DM.raf); const a=DM.a; if(!a){ if(done) done(); return; }
  const from=a.volume,t0=performance.now();
  (function step(t){ const k=Math.min(1,(t-t0)/Math.max(1,ms)); try{ a.volume=Math.max(0,Math.min(1,from+(to-from)*k)); }catch(e){}
    if(k<1) DM.raf=requestAnimationFrame(step); else if(done) done(); })(t0);
}
function dragonMusicStart(){
  DM.active=true; if(!musicOn) return;
  try{
    if(!DM.a){ DM.a=new Audio('assets/music/muncul-naga.mp3'); DM.a.loop=true; DM.a.preload='auto'; }
    stopMusic();                                   /* BGM biasa dijeda selama pertarungan naga */
    DM.a.volume=0; const r=DM.a.play(); if(r&&r.catch) r.catch(()=>{});
    dmFade(dmTarget(),DM.fadeIn);
  }catch(e){}
}
function dragonMusicHalt(){ cancelAnimationFrame(DM.raf); if(DM.a){ try{ DM.a.pause(); DM.a.currentTime=0; }catch(e){} } }
function dragonMusicStop(instant){ try{ if(MP_SEQ===0) mpCue({k:'dmusic',i:!!instant}); }catch(e){}
  if(!DM.active&&!(DM.a&&!DM.a.paused)) return; DM.active=false;
  if(instant||!DM.a){ dragonMusicHalt(); return; }
  dmFade(0,DM.fadeOut,()=>{ dragonMusicHalt(); playMusic(); }); /* BGM biasa lanjut setelah fade out */
}

/* ---------- Aturan papan ---------- */
const ROW_H=0.8;
/* Data statis papan/mob/power dari gameplay/js/config.js (single source: UT.Gameplay.Config). */
let LADDERS=UT.Gameplay.Config.LADDERS;
let SNAKES=UT.Gameplay.Config.SNAKES;
const DMG=UT.Gameplay.Config.DMG;
let MOBT={};UT.Gameplay.Config.MOB_POSITIONS.forEach(m=>m[1].forEach(n=>MOBT[n]=m[0]));
const MOBCOL=UT.Gameplay.Config.MOB_COLOR;
const MOBNAME=UT.Gameplay.Config.MOB_NAME;
const MOBBACK=UT.Gameplay.Config.MOB_BACK;
const MOBTHEME=UT.Gameplay.Config.MOB_THEME_ONLY;
function mobOn(n,themeKey){ const k=MOBT[n]; return (k&&(!MOBTHEME[k]||themeKey===MOBTHEME[k]))?k:null; }
let CHESTS=UT.Gameplay.Config.CHESTS;
let BOSS='dragon',BOARD_CUSTOM=false,MAPDEF=null; /* BOSS: 'dragon' = fase Ender Dragon di GOAL; selain itu sementara = sampai di GOAL langsung menang */
let GOAL=100; /* petak akhir (fase boss). Default 100; map bisa menimpa lewat UT.Gameplay.Maps (def.goal) */
/* Aturan per map: def.rules = {ladders, snakes, chests:[...], mobs:[[nama,[petak]],...]}; yang tidak diisi memakai UT.Gameplay.Config (default World). */
function applyMapRules(def){
  const C=UT.Gameplay.Config,R=(def&&def.rules)||{};
  GOAL=(def&&def.goal)||100; BOSS=(def&&def.boss)||'dragon'; MAPDEF=def||null; BOARD_CUSTOM=!!(def&&typeof def.board==='function');
  TILES=BOARD_CUSTOM?def.board():GV.buildTiles();
  if(BOARD_CUSTOM){ const cells=Object.assign({},TILES.extra||{}); for(let i=1;i<TILES.length;i++){ const t=TILES[i]; cells[Math.floor(t.x)+','+Math.floor(t.z)]=t.h; } TILES.cells=cells; }
  applyView((def&&def.view)||DEFAULT_VIEW);
  LADDERS=R.ladders||C.LADDERS; SNAKES=R.snakes||C.SNAKES; CHESTS=R.chests?new Set(R.chests):C.CHESTS;
  MOBT={}; (R.mobs||C.MOB_POSITIONS).forEach(m=>m[1].forEach(n=>MOBT[n]=m[0]));
}
const PLAYER_DEFS=[
  {name:'Steve',key:'steve',hex:0x2F80FF,css:'#2a78d6'},
  {name:'Alex',key:'alex',hex:0xFF8A1A,css:'#d9791c'},
  {name:'Creeper',key:'creeper',hex:0x4DB84A,css:'#3f9f2a'},
  {name:'Enderman',key:'ender',hex:0xA855F7,css:'#3a2a52'},
  {name:'Zombie',key:'zombie',hex:0x2DB5A6,css:'#2b8f87'},
  {name:'Skeleton',key:'skeleton',hex:0xD0D0D0,css:'#6f7378'}
];
/* Stage 4.1.14.9: skin PNG 64x64 (renderer 3D bertekstur = gameplay/js/skin-uv.js). Daftar TERPISAH agar PLAYER_DEFS
   (urutan default + pemilihan CPU acak) tidak berubah. Pawn palette tetap dibuat dulu sebagai fallback (Steve). */
const PNG_DEFS=[
  {name:'Hero',key:'hero',hex:0xE5484D,css:'#c93a3f',png:true},
  {name:'Knight',key:'knight',hex:0x9AA7B8,css:'#6f7a89',png:true},
  {name:'Ninja Red',key:'ninja_red',hex:0xD62828,css:'#a81f1f',png:true},
  {name:'Pejabat',key:'pejabat',hex:0x6B6B7B,css:'#5a5a68',png:true},
  {name:'Sakura',key:'sakura',hex:0xFF8FB8,css:'#d9709a',png:true},
  {name:'Warden',key:'warden',hex:0x2AA5A0,css:'#1f7f7a',png:true}
];
/* Warna khas pemain ala Ludo, ditentukan per KURSI (urutan giliran awal), bukan per skin: Merah, Biru, Kuning, Hijau.
   Dipilih agak lembut (tidak neon) supaya nyaman di mata. Dipakai HUD (--pc), outline bidak yang sedang main, dan benjolan saat dimakan ular. */
const SEAT_COLORS=[
  {name:'Merah',hex:0xE5484D,css:'#e5484d'},
  {name:'Biru',hex:0x3B7DDD,css:'#3b7ddd'},
  {name:'Kuning',hex:0xF2B632,css:'#f2b632'},
  {name:'Hijau',hex:0x3FB36B,css:'#3fb36b'}
];
const VILLAGER_DEF={name:'Villager',key:'villager',hex:0xC9A24A,css:'#a8832f'}; /* khusus Computer; tidak masuk PLAYER_DEFS (urutan default tetap) */
const SKIN3D={},SKIN_IMG={};
function refreshFaces(){ try{ if(typeof renderChips==='function'&&players&&players.length) renderChips(); }catch(e){} }
/* Muat texture PNG (ItemArt.loadSkinTexture + makeSkinTexture). Gagal -> null (pawn tetap palette/Steve). */
function loadSkin3D(k){
  if(SKIN3D[k]) return SKIN3D[k];
  return SKIN3D[k]=(async()=>{
    try{
      const IA=window.ItemArt,SU=UT.GameplaySkin; if(!IA||!SU||!SU.buildModel) return null;
      const id='skin.'+k,r=await IA.loadSkinTexture(id); if(!r||!r.ok||!r.image) return null;
      const it=window.ItemCatalog&&ItemCatalog.byId(id); let slim=!!(it&&it.arms==='slim');
      if(!it||!it.arms) slim=SU.detectSlim(r.image)===true;
      SKIN_IMG[k]=r.image; return {tex:IA.makeSkinTexture(THREE,r.image),slim};
    }catch(e){ return null; }
  })().then(v=>{ if(v) refreshFaces(); return v; });
}
/* Pion pemain 1 (lokal, bukan CPU/online) = karakter baru dari halaman Karakter (UT.BlockyCharacter + PlayerData). Gagal/tak tersedia -> pion lama tetap dipakai. */
/* Aksi karakter baru: 'attack' (ayun senjata) / 'block' (bertahan dgn perisai saat kena serang). Aman dipanggil untuk pion mana pun (diabaikan bila bukan karakter baru). */
function pawnAct(pawn,type,dur){ try{ const b=pawn&&pawn.userData&&pawn.userData.bc; if(b&&b.act) b.act(type,dur); }catch(e){} }
/* Ganti model pion (mis. setelah tampilan pemain lain dari server tiba). spec: <0 = milik sendiri, >=0 = preset, objek = baris room_appearance_get. */
/* Aura (slot 'aura', dipilih di halaman Efek) menempel ke pion karakter baru: milik sendiri = aura yang dipakai; pemain lain = aura dari data server.
   Satu AuraSystem untuk seluruh scene; dipasang malas di loop frame setelah pion masuk scene. Kualitas dibatasi 'medium' (banyak pion). */
let PAURA=null;
function pawnAuraCtl(){ if(!PAURA&&UT.AuraView&&UT.AuraFX){ try{ const q=UT.AuraView.quality(); PAURA=UT.AuraView.create(scene,camera,{quality:q==='high'?'medium':q}); }catch(e){} } return PAURA; }
function repawnNew(pawn,spec){ try{ const u=pawn&&pawn.userData,pal=u&&u.pal; if(!pal) return; if(u.bc&&PAURA) PAURA.clear(u.bc.root); u.auraOn=false; if(u.png){ pawn.remove(u.png); u.png=null; u.bc=null; u.bcLast=null; u.bcMode=null; } pal.visible=true; upgradePawnNew(pawn,pal,spec); }catch(e){} }
/* Online: pemain lokal = tampilannya sendiri; pemain lain = tampilan dari server (room_appearance_get), tanpa data = preset. */
async function applyOnlineLooks(gid,attempt){
  if(!ONLINE_ROOM) return;
  attempt=attempt|0;
  const me=MP_ID?players.find(q=>q.networkId===MP_ID):null; if(attempt===0&&me&&me.pawn) repawnNew(me.pawn,-1);
  const by={};
  try{ const AS=UT.AppearanceService&&UT.AppearanceService.get&&UT.AppearanceService.get();
    if(AS){
      /* kirim tampilan sendiri dulu (baris tampilan di server bisa belum ada / usang) agar pemain lain melihat outfit kita */
      if((attempt===0||attempt===2||attempt===5)&&AS.pushAppearance){ try{ const pr=await Promise.race([AS.pushAppearance(),new Promise(r=>setTimeout(r,4000))]); if(pr&&pr.ok===false) console.warn('[tampilan] gagal dikirim ke server',pr); }catch(e){} } /* kirim ulang beberapa kali: pemain lain harus melihat outfit/aksesoris kita */
      if(AS.roomAppearance){ const r=await AS.roomAppearance(ROOM_CFG.roomId); if(r&&r.ok&&Array.isArray(r.players)) r.players.forEach(x=>{ by[String(x.user_id).toLowerCase()]=x; }); }
    } }catch(e){}
  if(gid!==gameId) return;
  let missing=0;
  players.forEach(p=>{ if(p===me||!p.pawn) return;
    if(p.cpu){ if(attempt===0&&NEW_CHAR_CPU) repawnNew(p.pawn,2+p.idx*3); return; }
    const a=p.networkId&&by[String(p.networkId).toLowerCase()];
    if(a){ try{ const di=a.equipped&&a.equipped.dice, it=di&&window.ItemCatalog.byId(di); p.diceKey=(it&&it.gameKey)||null; }catch(e){} /* dadu yang dipasang pemain lain (dari server) -> dilempar dengan dadunya sendiri */
      if(!p.pawn.userData.lookFromServer||p.pawn.userData.lookRev!==JSON.stringify([a.look,a.equipped,a.gear_dye])){ p.pawn.userData.lookFromServer=true; p.pawn.userData.lookRev=JSON.stringify([a.look,a.equipped,a.gear_dye]); repawnNew(p.pawn,a); } }
    else{ missing++; if(attempt===0) repawnNew(p.pawn,2+p.idx*3); }
  });
  refreshFaces();
  /* tampilan pemain lain belum ada di server (belum sempat terkirim): coba lagi beberapa kali, tidak menunggu refresh */
  /* tarik ulang berkala (bukan hanya saat data belum ada): tampilan pemain lain yang baru dikirim/berubah ikut terpasang; hanya dipasang ulang bila isinya berubah */
  if(attempt<14) setTimeout(()=>applyOnlineLooks(gid,attempt+1),attempt<6?2500:8000);
}
const NEW_CHAR_CPU=false; /* false = pion CPU tetap Villager (bukan karakter preset/skin pemain) */
/* Bersorak: lengan terangkat + lompat berulang selama dur detik (menang / sampai di puncak tangga). */
function pawnCheer(pawn,dur){ try{ const b=pawn&&pawn.userData&&pawn.userData.bc; if(!b||!b.act) return; dur=dur||2.4; b.act('cheer',dur); b.jump(); for(let i=1;i<dur/0.85;i++) setTimeout(()=>{ try{ if(b.acting==='cheer') b.jump(); }catch(e){} },i*850); }catch(e){} }
function upgradePawnNew(g,pal,seed){ /* seed<0 = penampilan pemain (PlayerData); >=0 = tampilan siap pakai (CPU / pemain lokal lain) */
  try{
    if(!(UT.BlockyCharacter&&window.PlayerData&&window.ItemCatalog)) return;
    const ch=UT.BlockyCharacter.create(THREE); if(seed&&typeof seed==='object') ch.loadFromData(seed.look,seed.equipped,seed.gear_dye||seed.gearDye); else if(seed>=0) ch.loadPreset(seed); else ch.loadFromPlayer(); ch.tick(0.016); /* satu tick: pose rig terpasang sebelum diukur */
    const w=new THREE.Group(); w.add(ch.root);
    w.updateMatrixWorld(true);
    const bb=new THREE.Box3().setFromObject(ch.root),h=ch.height(); /* tinggi badan (tanpa topi) agar semua pion sama tinggi */
    if(!(h>0.1)) return;
    const sc=0.92/h; w.scale.setScalar(sc); w.position.y=-bb.min.y*sc; /* tinggi ~ pion lama (0.9), telapak di y=0 */
    w.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; } });
    g.add(w); pal.visible=false; g.userData.png=w; g.userData.bc=ch; g.userData.bcSeed=(seed==null?-1:seed);
    { const AVw=UT.AuraView; g.userData.auraKey=AVw?((seed&&typeof seed==='object')?AVw.keyFromEquipped(seed.equipped):((seed==null||seed<0)?AVw.equippedKey():null)):null; g.userData.auraOn=false; g.userData.auraH=0.92; } /* tinggi dunia pion = 0.92 */
    if(g.userData.outlineOn) pawnOutline(g,true,g.userData.outlineHex);
  }catch(e){ console.warn('karakter baru gagal dimuat, pakai pion lama',e); }
}
function upgradePawnPNG(g,pal,k){
  loadSkin3D(k).then(m=>{
    if(!m) return;
    const mdl=UT.GameplaySkin.buildModel(THREE,m.tex,{slim:m.slim}); g.add(mdl); pal.visible=false; g.userData.png=mdl; if(g.userData.outlineOn) pawnOutline(g,true,g.userData.outlineHex);
  }).catch(()=>{});
}
/* Geometri papan murni (tile serpentine, tinggi terrain) = UT.GameplayVoxelGeom (gameplay/js/voxel-geom.js). Rumus dipindah apa adanya. */
const GV=UT.GameplayVoxelGeom;
let TILES=GV.buildTiles();
function terrainTop(x,z){ if(TILES.cells){ const h=TILES.cells[Math.floor(x)+','+Math.floor(z)]; return h===undefined?0:h; } return GV.terrainTop(TILES,x,z); }
function topAt(x,z,r){ if(TILES.cells) return Math.max(terrainTop(x,z),terrainTop(x+r,z),terrainTop(x-r,z),terrainTop(x,z+r),terrainTop(x,z-r)); return GV.topAt(TILES,x,z,r); }
function mcBlock(n,themeKey){
  if(n>=99) return 0xE6E3A6;
  if(mobOn(n,themeKey)) return MOBCOL[mobOn(n,themeKey)];
  if(LADDERS[n]) return 0xE2BE3C;
  if(SNAKES[n]) return 0xD9577A;
  const r=Math.random();
  if(n<=20) return r<0.28?0x8A5B33:0x5A9E3C;
  if(n<=40) return r<0.25?0xD9C98A:0xE8D9A0;
  if(n<=60) return r<0.12?0xE8D9A0:(r<0.5?0x2F5FCC:0x3F76E4);
  if(n<=80) return r<0.3?0x8E8E8E:(r<0.4?0x9A9490:0x5A9E3C);
  return r<0.1?0xE0561A:(r<0.25?0x5A4636:(r<0.6?0x8A2B2B:0x6E2222));
}
/*LOGIC-END*/

const PAD={x:-7.2,y:0.03,z:4.5}; /* geser ke kiri agar tidak menempel board; y = pantat bidak duduk di kayu (lihat addCampfire) */
const SLOT=[[-0.3,-0.3],[0.3,-0.3],[-0.3,0.3],[0.3,0.3]];
function slotPos(pi,n){
  const o=SLOT[pi];
  if(n===0) return new THREE.Vector3(PAD.x+o[0]*2.2,PAD.y,PAD.z+o[1]*2.2); /* duduk di 4 kayu mengelilingi api unggun */
  const t=TILES[n];
  /* Bidak di TENGAH petak. Bila ada pemain lain di petak yang sama, semua berbagi cincin kecil (radius 0.2) agar tidak menumpuk. */
  let PL=[]; try{ PL=players||[]; }catch(e){}
  const grp=PL.filter(q=>q&&(q.idx===pi||q.pos===n)).map(q=>q.idx);
  if(grp.indexOf(pi)<0) grp.push(pi);
  grp.sort((a,b)=>a-b);
  if(grp.length<=1) return new THREE.Vector3(t.x,t.h,t.z);
  const k=grp.indexOf(pi),a=Math.PI*0.25+k*(Math.PI*2/grp.length),r=grp.length===2?0.18:0.22;
  return new THREE.Vector3(t.x+Math.cos(a)*r,t.h,t.z+Math.sin(a)*r);
}

/* ---------- Tema ---------- */
const THEMES=UT.Gameplay.Themes.LIST; /* data tema dari gameplay/js/themes.js (single source). Urutan array menentukan seed dunia (indexOf) dan tema default (THEMES[0]). */

/* ---------- Renderer ---------- */
const coarse=matchMedia('(pointer:coarse)').matches;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try{
  renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:true,alpha:true});
}catch(err){ showBootErr(); return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene();
const FX=(window.UT&&UT.GameplayFX)||null; /* modul tak termuat -> efek visual dilewati, gameplay tetap jalan */
if(FX) FX.init(scene);
const camera=new THREE.PerspectiveCamera(38,1,0.1,250);

const hemi=new THREE.HemisphereLight(0xFFFFFF,0xB9D7A0,0.84);
scene.add(hemi);
const sun=new THREE.DirectionalLight(0xFFFFFF,0.64);
sun.position.set(-9,24,14);
sun.castShadow=true;
sun.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048);
const sc=sun.shadow.camera; sc.left=-15; sc.right=15; sc.top=15; sc.bottom=-15; sc.near=2; sc.far=75;
sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.02;
scene.add(sun); scene.add(sun.target);

/* ---------- Pembangun voxel (kubus digabung per kelompok) ---------- */
let seed=20241022;
function rnd(){ seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^(seed>>>15),1|seed); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }
function jit(hex,amt){ const c=new THREE.Color(hex); c.offsetHSL(0,0,(rnd()-0.5)*amt); return c; }
function pick(a){ return a[Math.floor(rnd()*a.length)]; }

/*GEOM-START*/
/* Pembangun kotak voxel murni (FACES/CORNERS/EDGES, makeBatch, addBox, addOBox) dipindah ke gameplay/js/voxel-geom.js; batas audit marker tetap. */
const makeBatch=GV.makeBatch,addBox=GV.addBox,addOBox=GV.addOBox;
/*GEOM-END*/
const MAT=new THREE.MeshLambertMaterial({vertexColors:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const LINE_MAT=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.6});
function buildBatch(b,opt){
  opt=opt||{};
  const g=new THREE.Group();
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(b.nor,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(b.col,3));
  geo.setIndex(new THREE.BufferAttribute(b.n>65000?new Uint32Array(b.idx):new Uint16Array(b.idx),1));
  const m=new THREE.Mesh(geo,opt.mat||MAT);
  m.castShadow=opt.cast!==false; m.receiveShadow=opt.receive!==false;
  g.add(m);
  if(b.lpos.length){
    const lg=new THREE.BufferGeometry();
    lg.setAttribute('position',new THREE.Float32BufferAttribute(b.lpos,3));
    lg.setAttribute('color',new THREE.Float32BufferAttribute(b.lcol,3));
    g.add(new THREE.LineSegments(lg,opt.lineMat||LINE_MAT));
  }
  return g;
}

/* ---------- Dunia (dibangun ulang saat ganti tema) ---------- */
const world=new THREE.Group(); scene.add(world);
const sky=new THREE.Group(); scene.add(sky);
let clouds=[],snow=null,LADINFO={},SNAKEINFO={},theme=THEMES[0],themeKey=THEMES[0].key,worldToken=0;
function disposeGroup(g){
  g.traverse(o=>{
    if(o.geometry&&o.geometry.dispose) o.geometry.dispose();
    if(o.material&&o.material.map){ o.material.map.dispose(); o.material.dispose(); }
  });
  while(g.children.length) g.remove(g.children[0]);
}
/* objek yang memudar saat menghalangi pandangan: awan, pohon, dekorasi besar */
const fades=[];
function fadeable(parent,b,cx,cy,cz,rad,opt){
  opt=opt||{};
  const mat=new THREE.MeshLambertMaterial({vertexColors:true,transparent:true,opacity:1,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const lmat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.6});
  const g=buildBatch(b,{mat,lineMat:lmat,cast:opt.cast,receive:opt.receive});
  parent.add(g);
  fades.push({mat,lmat,cx,cy,cz,rad,k:1,base:opt.base||1,obj:opt.follow?g:null});
  return g;
}
function item(x,z,h,r,draw){
  const b=makeBatch(); draw(b);
  fadeable(world,b,x,h/2,z,Math.max(r,h*0.5)+0.3);
}
function updateFades(dt,pts){
  const C=camera.position,rate=Math.min(1,dt*7);
  for(let i=0;i<fades.length;i++){
    const f=fades[i],q=f.obj?f.obj.position:null;
    const cx=q?q.x:f.cx,cy=q?q.y:f.cy,cz=q?q.z:f.cz;
    let hit=false;
    for(let j=0;j<pts.length&&!hit;j++){
      const T=pts[j],sx=T.x-C.x,sy=T.y-C.y,sz=T.z-C.z,L2=sx*sx+sy*sy+sz*sz||1;
      let t=((cx-C.x)*sx+(cy-C.y)*sy+(cz-C.z)*sz)/L2;
      if(t>0.985) continue;
      if(t<0) t=0;
      const ex=C.x+sx*t-cx,ey=C.y+sy*t-cy,ez=C.z+sz*t-cz;
      if(ex*ex+ey*ey+ez*ez<f.rad*f.rad) hit=true;
    }
    const overBoard=f.obj&&(cx>-8.2&&cx<7.2&&Math.abs(cz)<7.2);
    if(overBoard) hit=true;
    f.k+=(((hit?0.04:1))-f.k)*rate;
    f.mat.opacity=f.k*f.base; f.mat.depthWrite=f.k>0.97;
    f.lmat.opacity=0.6*f.k;
  }
}
/* ===== TAMBAHAN: api/obor, cahaya malam, makhluk berkeliling, pertanian, air terjun ===== */
let lseed=7771;
function lr(){ lseed=(lseed+0x6D2B79F5)|0; let t=Math.imul(lseed^(lseed>>>15),1|lseed); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }
function ljit(hex,amt){ const c=new THREE.Color(hex); c.offsetHSL(0,0,(lr()-0.5)*amt); return c; }

const haloTex=(function(){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const g=cv.getContext('2d');
  const r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.3,'rgba(255,255,255,0.45)'); r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(cv);
})();
function makeHalo(x,y,z,size,color){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,color:color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  s.position.set(x,y,z); s.scale.setScalar(size); s.renderOrder=3; return s;
}
const FLM1=new THREE.MeshBasicMaterial({color:0xFF8A1E}),FLM2=new THREE.MeshBasicMaterial({color:0xFFE066});
const FIRES=[],WINS=[],SMOKE=[],FLIGHTS=[],PLIGHTS=[];
/* jumlah lampu dibuat tetap (intensitas 0 di siang hari) supaya shader tidak dikompilasi ulang */
for(let i=0;i<5;i++){ const L=new THREE.PointLight(0xFFAA55,0,7,2); L.position.set(0,-50,0); scene.add(L); FLIGHTS.push(L); }
for(let i=0;i<4;i++){ const L=new THREE.PointLight(0xFFE3A8,0,2.6,2); L.position.set(0,-50,0); scene.add(L); PLIGHTS.push(L); }
function clearFX(){
  FIRES.length=0; WINS.length=0;
  SMOKE.forEach(s=>s.m.material.dispose()); SMOKE.length=0;
  PORTALS.forEach(P=>{ P.planes.forEach(m=>m.material.dispose()); P.halo.material.dispose(); P.sparks.forEach(S=>S.m.material.dispose()); }); PORTALS.length=0;
  FLIGHTS.forEach(L=>{ L.intensity=0; L.position.set(0,-50,0); });
  ROAM.length=0; ROAMQ.length=0; NOWALK.length=0; lseed=7771;
  BEES.length=0; HOST.length=0; HOSTQ.length=0; ARROWS.length=0; RANCH.bees.length=0;
}
function addFlame(x,y,z,s,o){
  o=o||{};
  const g=new THREE.Group(); g.position.set(x,y,z);
  const m1=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.2,0.16),FLM1); m1.position.y=0.1;
  const m2=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.15,0.09),FLM2); m2.position.y=0.085;
  g.add(m1); g.add(m2); g.scale.setScalar(s); world.add(g);
  const halo=makeHalo(x,y+0.14*s,z,o.halo||1.6,0xFFA040); world.add(halo);
  const f={g,halo,s,ph:Math.random()*10,hal:o.hal===undefined?0.5:o.hal,lt:null,li:0};
  FIRES.push(f); return f;
}
function addTorch(B,x,y0,z){
  addBox(B,x,y0+0.28,z,0.07,0.56,0.07,0x5A3A1E,{edge:false});
  addBox(B,x,y0+0.58,z,0.13,0.05,0.13,0x2E2E2E,{edge:false});
  return addFlame(x,y0+0.6,z,0.8,{halo:1.3,hal:0.4});
}
/* rumah warga: obor di kiri-kanan pintu + jendela yang menyala saat malam */
function addHouseExtras(B,x,z,y0){
  blockRect(x,z,1.35,1.2);
  [-1,1].forEach(s=>addTorch(B,x+s*0.95,y0,z+0.9));
  [-0.45,0.45].forEach(a=>{
    const wx=x+a,wy=y0+0.55;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.19,0.19),new THREE.MeshBasicMaterial({color:0x9ADFF5}));
    m.position.set(wx,wy,z+0.634); world.add(m);
    const halo=makeHalo(wx,wy,z+0.85,1.5,0xFFC860); world.add(halo);
    WINS.push({m,halo});
  });
}
function addCampfire(B,x,z){
  blockRect(x,z,1.5,1.5);
  const F={edge:false};
  for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; addBox(B,x+Math.cos(a)*0.46,0.07,z+Math.sin(a)*0.46,0.15,0.14,0.15,ljit(0x8A8A8A,0.12)); }
  addBox(B,x,0.03,z,0.7,0.06,0.7,0x2A2522,F);
  [0.2,1.0,1.8,2.6].forEach(a=>addBox(B,x,0.16,z,0.62,0.1,0.1,ljit(0x6B4423,0.08),{yaw:a}));
  /* 4 kayu duduk: satu per slot pemain (posisi = SLOT*2.2, sama dengan slotPos(…,0)); bidak duduk di sini sebelum mulai */
  SLOT.forEach(o=>{
    const sx=x+o[0]*2.2,sz=z+o[1]*2.2,yaw=(o[0]*o[1]>0)?Math.PI/4:-Math.PI/4;
    addBox(B,sx,0.12,sz,0.62,0.24,0.28,ljit(0x7A4E2A,0.08),{yaw:yaw});
    addBox(B,sx,0.245,sz,0.64,0.03,0.30,ljit(0x8A5B33,0.06),{yaw:yaw,edge:false});
  });
  const f=addFlame(x,0.12,z,1.7,{halo:3.2,hal:0.6}); f.lt=FLIGHTS[4]; f.li=2.1; f.lt.position.set(x,0.8,z);
  addFlame(x+0.14,0.1,z-0.1,1.0,{halo:0,hal:0}); addFlame(x-0.12,0.1,z+0.12,1.15,{halo:0,hal:0});
  for(let i=0;i<6;i++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.14),new THREE.MeshBasicMaterial({color:0x9A9A9A,transparent:true,opacity:0,depthWrite:false}));
    world.add(m); SMOKE.push({m,x,y:0.9,z,k:i/6,sp:0.28,ph:i*1.3});
  }
}
function addFarm(B,ox,oz){
  ox=ox||0; oz=oz||0; const p0=B.pos.length,l0=B.lpos.length; /* geser seluruh pertanian ke (ox,oz) */
  const x0=-12.8,x1=-8.4,z0=6.7,z1=11.7,F={edge:false},cx=(x0+x1)/2,cz=(z0+z1)/2;
  blockRect(cx+ox,cz+oz,(x1-x0)/2+0.6,(z1-z0)/2+0.6);
  for(let x=x0+0.3;x<x1-0.1;x+=0.55) for(let z=z0+0.3;z<z1-0.1;z+=0.55) addBox(B,x,0.02,z,0.55,0.04,0.55,ljit(0x8B6A3E,0.14),F);
  const beds=[7.5,8.3,10.1,10.9],kinds=['wheat','wheat','carrot','pumpkin'];
  for(let s=0;s<9;s++){
    const x=-12.1+0.4*s;
    beds.forEach((z,bi)=>{
      addBox(B,x,0.07,z,0.4,0.1,0.7,ljit(bi===1||bi===2?0x4A2F1A:0x5E3F22,0.1),F);
      const k=kinds[bi];
      if(k==='wheat'){
        for(let r=0;r<2;r++) for(let c=0;c<3;c++){
          const ripe=lr()<0.55,h=ripe?0.42:0.2+lr()*0.15,px=x-0.13+c*0.13,pz=z-0.15+r*0.3;
          addBox(B,px,0.12+h/2,pz,0.05,h,0.05,ljit(ripe?0xD9B44A:0x86C23E,0.08),F);
          if(ripe) addBox(B,px,0.14+h,pz,0.07,0.1,0.07,ljit(0xE8C85A,0.06),F);
        }
      }else if(k==='carrot'){
        for(let c=0;c<3;c++){ const px=x-0.12+c*0.12,pz=z+(c%2?0.12:-0.12); addBox(B,px,0.19,pz,0.1,0.14,0.1,ljit(0x4FA83A,0.1),F); addBox(B,px,0.28,pz,0.05,0.08,0.05,ljit(0x6BC24A,0.1),F); if(lr()<0.6) addBox(B,px,0.13,pz,0.05,0.04,0.05,0xF08A2A,F); }
      }else if(s%2===0){
        const mel=lr()<0.35;
        addBox(B,x+0.1,0.25,z,0.28,0.26,0.28,ljit(mel?0x6FB04A:0xE8892A,0.08)); addBox(B,x+0.1,0.41,z,0.05,0.07,0.05,0x4A7A2A,F);
        addBox(B,x-0.15,0.15,z+0.12,0.16,0.04,0.16,ljit(0x4FA83A,0.1),F);
      }
    });
    if(s<7) addBox(B,x,0.035,9.2,0.4,0.05,0.7,ljit(0x4FA0FF,0.05),F); else addBox(B,x,0.045,9.2,0.4,0.05,0.7,ljit(0xA89060,0.08),F);
  }
  /* pagar dengan pintu di sisi yang menghadap papan */
  const post=(px,pz)=>addBox(B,px,0.24,pz,0.08,0.48,0.08,ljit(0x8A5B33,0.06),F);
  const gap=(px,pz)=>pz<z0+0.01&&px>-11.25&&px<-10.15;
  for(let px=x0;px<=x1+0.01;px+=0.8) [z0,z1].forEach(pz=>{ if(gap(px,pz)) return; post(px,pz); if(px+0.8<=x1+0.01&&!gap(px+0.4,pz)){ addBox(B,px+0.4,0.2,pz,0.8,0.04,0.04,ljit(0x7A4E2A,0.06),F); addBox(B,px+0.4,0.36,pz,0.8,0.04,0.04,ljit(0x7A4E2A,0.06),F); } });
  for(let pz=z0+0.8;pz<z1-0.01;pz+=0.8) [x0,x1].forEach(px=>{ post(px,pz); addBox(B,px,0.2,pz-0.4,0.04,0.04,0.8,ljit(0x7A4E2A,0.06),F); addBox(B,px,0.36,pz-0.4,0.04,0.04,0.8,ljit(0x7A4E2A,0.06),F); });
  [[x0,z0+0.4],[x1,z1-0.4]].forEach(q=>{ addBox(B,q[0],0.2,q[1],0.04,0.04,0.8,0x7A4E2A,F); addBox(B,q[0],0.36,q[1],0.04,0.04,0.8,0x7A4E2A,F); });
  /* orang-orangan sawah */
  const sx=-9.1,sz=9.2;
  addBox(B,sx,0.5,sz,0.06,1.0,0.06,0x6B4423,F); addBox(B,sx,0.78,sz,0.62,0.06,0.06,0x6B4423,F);
  addBox(B,sx,0.62,sz,0.22,0.3,0.14,ljit(0xC9A23A,0.08),F);
  addBox(B,sx,1.06,sz,0.22,0.2,0.2,0xE8892A); addBox(B,sx-0.05,1.08,sz+0.105,0.05,0.04,0.02,0x1A1A1A,F); addBox(B,sx+0.05,1.08,sz+0.105,0.05,0.04,0.02,0x1A1A1A,F); addBox(B,sx,1.01,sz+0.105,0.1,0.03,0.02,0x1A1A1A,F);
  addBox(B,sx,1.2,sz,0.34,0.05,0.34,0x4A3322,F); addBox(B,sx,1.27,sz,0.2,0.1,0.2,0x4A3322,F);
  [-0.32,0.32].forEach(a=>addBox(B,sx+a,0.74,sz,0.08,0.1,0.06,0xD9B44A,F));
  /* jerami */
  addBox(B,-13.5,0.17,8.0,0.5,0.34,0.7,ljit(0xD9B44A,0.08)); addBox(B,-13.5,0.51,8.0,0.5,0.34,0.7,ljit(0xD9B44A,0.08)); addBox(B,-13.5,0.17,9.0,0.5,0.34,0.7,ljit(0xD9B44A,0.08));
  [8.0,9.0].forEach(z=>addBox(B,-13.5,0.17,z,0.52,0.05,0.72,0x8A6A22,F));
  for(let i=p0;i<B.pos.length;i+=3){ B.pos[i]+=ox; B.pos[i+2]+=oz; }
  for(let i=l0;i<B.lpos.length;i+=3){ B.lpos[i]+=ox; B.lpos[i+2]+=oz; }
  addTorch(B,-11.4+ox,0,z0-0.15+oz); addTorch(B,-10.0+ox,0,z0-0.15+oz);
  queueAnimal(-10.9+ox,5.7+oz,0,'villager');
}
/* gunungan + air terjun bertingkat: air mulai dari kolam di puncak lalu jatuh per tingkat sampai ke sungai */
function cascadeHill(B,dir,u0,u1,v0,v1,stone,K){
  K=K||1; /* K = pengali tinggi gunung */
  const E=dir==='e',vc=(v0+v1)/2,W=0.9,F={edge:false};
  const bx=(u,v,y,du,h,dv,c,o)=>E?addBox(B,u,y*K,v,du,h*K,dv,c,o):addBox(B,v,y*K,u,dv,h*K,du,c,o);
  const fu=l=>u1-0.5*l,bu=l=>u0+0.15*l,wv=l=>(v1-v0)-0.6*l;
  if(E) blockRect((u0+u1)/2,vc,(u1-u0)/2+0.3,(v1-v0)/2+0.3); else blockRect(vc,(u0+u1)/2,(v1-v0)/2+0.3,(u1-u0)/2+0.3);
  for(let l=0;l<3;l++){
    const du=fu(l)-bu(l),uc=(fu(l)+bu(l))/2;
    bx(uc,vc,(l+0.5)*0.5,du,0.5,wv(l),ljit(stone?0x7F7F7F:0x8A5B33,0.07));
    bx(uc,vc,(l+1)*0.5+0.02,du-0.04,0.06,wv(l)-0.04,ljit(stone?0x6E8F5A:0x5A9E3C,0.05),F);
  }
  const ps=bu(2)+0.25,pu=(ps+fu(2))/2,pd=fu(2)-ps;
  bx(ps+pd*0.3,vc,1.6,pd*0.6,0.1,1.4,ljit(0x4FA0FF,0.05),F);
  bx(ps+pd*0.8,vc,1.6,pd*0.4,0.1,W,ljit(0x5AAEFF,0.05),F);
  [-1,1].forEach(s=>bx(pu,vc+s*0.78,1.62,pd,0.14,0.12,ljit(stone?0x6A6A6A:0x7A4E2A,0.06)));
  for(let l=2;l>=0;l--){
    const face=fu(l)+0.045;
    bx(face,vc,(l+0.5)*0.5+0.025,0.09,0.55,W,ljit(0x4FA0FF,0.05),F);
    for(let s=0;s<3;s++) bx(face+0.05,vc-0.3+s*0.3+(l%2?0.06:-0.06),(l+0.5)*0.5+0.03,0.03,0.5,0.05,0xCFE9FF,F);
    if(l>0){ const a=fu(l)+0.09,b=fu(l-1); bx((a+b)/2,vc,l*0.5+0.075,b-a,0.05,W,ljit(0x5AAEFF,0.05),F); }
  }
  for(let i=0;i<6;i++) bx(u1+0.12+(i%2)*0.1,vc-0.45+i*0.18,0.07,0.15,0.1,0.15,ljit(0xEAF6FF,0.04),F);
}

/* ---------- makhluk berkeliling (domba, babi, sapi, ayam, penduduk) ---------- */
const ROAM=[],ROAMQ=[],NOWALK=[],TREEPOS=[],DECOR_SEED=[],GHASTS=[],LAVAFALLS=[];
/* peternakan + mob liar: state (dibersihkan di clearFX) */
const BEES=[],HOST=[],HOSTQ=[],ARROWS=[];
const RB=1;                                            /* tinggi tanah dasar peternakan (kaki lereng, di sini jalan batu mulai naik) */
const RANCH={x0:10.4,x1:19.4,z0:-7.2,z1:2.8,y:RB,bees:[]};   /* peternakan berundak di lereng gunung kanan board; gunung di sekelilingnya tetap utuh */
/* 4 kandang berundak di kiri-kanan jalan batu tengah (x 14.6..15.8) yang naik ke utara (-z); pintu 'e'/'w' menghadap jalan.
   Selang-seling kiri/kanan dan beda tinggi (y): babi paling rendah, lalu ayam, domba, sapi paling tinggi. Kandang babi = ukuran lama /1.2 */
const PENS=[
  {k:'pig',x0:12.0,x1:14.5,z0:-0.7,z1:2.8,gate:'e',y:RB},
  {k:'chicken',x0:15.9,x1:18.9,z0:-2.6,z1:1.6,gate:'w',y:1.5},
  {k:'sheep',x0:11.5,x1:14.5,z0:-4.9,z1:-1.1,gate:'e',y:2.0},
  {k:'cow',x0:15.9,x1:18.9,z0:-7.2,z1:-3.4,gate:'w',y:3.0}];
/* jalan batu: [z_awal, z_akhir, tinggi permukaan]; tinggi sama = jalan datar, beda = anak tangga */
const PATH=[[2.8,0.6,1.0],[0.6,0.3,1.25],[0.3,0.0,1.5],[0.0,-1.1,1.5],[-1.1,-1.4,1.75],[-1.4,-1.7,2.0],[-1.7,-3.6,2.0],[-3.6,-3.9,2.25],[-3.9,-4.2,2.5],[-4.2,-4.5,2.75],[-4.5,-4.8,3.0],[-4.8,-7.2,3.0]];
const PATHX=15.2,PATHW=1.2;
const HZ={x0:-6.2,x1:3.6,z0:8.8,z1:11.7};              /* zona jelajah mob jahat: bawah, di pinggir pohon */
const GZ={x0:-6.4,x1:4.2,z0:6.9,z1:11.8};              /* zona patroli golem (mencakup zona mob jahat) */
let MCFLAT=false;                                      /* true hanya untuk tema minecraft: ratakan tanah kandang & zona mob */
function blockRect(cx,cz,hx,hz){ NOWALK.push([cx-hx,cx+hx,cz-hz,cz+hz]); }
function penBlocked(x,z){ for(let i=0;i<NOWALK.length;i++){ const r=NOWALK[i]; if(x>r[0]&&x<r[1]&&z>r[2]&&z<r[3]) return true; } return false; } /* hewan kandang: di atas dataran, hanya terhalang benda (palung, jerami, pohon), bukan tinggi gunung */
function walkBlocked(x,z){
  if(Math.abs(x)<5.9&&Math.abs(z)<5.9) return true;
  if(x>4.9&&x<9.1&&z>-30) return true; /* air sungai kanan (termasuk hilir yang melebar) */
  if(hAt(x,z)>0) return true;
  if(TILES.cells&&(TILES.cells[Math.floor(x)+','+Math.floor(z)]!==undefined||(TILES.fort&&x>TILES.fort.x0-1&&x<TILES.fort.x1+1&&z>TILES.fort.z0-1&&z<TILES.fort.z1+1))) return true; /* papan Nether: pulau & benteng */
  for(let i=0;i<NOWALK.length;i++){ const r=NOWALK[i]; if(x>r[0]&&x<r[1]&&z>r[2]&&z<r[3]) return true; }
  return false;
}
const MOB_CAP=3; /* World: maksimal 3 per jenis hewan/mob di luar board */
const capped=(Q,kind)=>themeKey==='minecraft'&&Q.filter(q=>q.kind===kind).length>=MOB_CAP;
function queueAnimal(x,z,yaw,kind,c1,c2){ if(capped(ROAMQ,kind)) return; ROAMQ.push({x,z,yaw,kind,c1,c2}); }
function mkPart(g,px,py,pz,draw,far){
  const b=makeBatch(); draw(b);
  const p=new THREE.Group(); p.position.set(px,py,pz); p.add(buildBatch(b,{cast:!far})); g.add(p); return p;
}
function makeCreature(kind,c1,c2,far){
  const g=new THREE.Group(),F={edge:false},o={g,kind,legs:[],head:null,tail:null,wings:[],speed:0.4,cur:0,ph:Math.random()*6,ph0:Math.random()*6,state:'idle',t:Math.random()*3,wt:0,eat:false,graze:true,rad:3,x:0,z:0,yaw:0,tx:0,tz:0,hx:0,hz:0};
  const P=(px,py,pz,fn)=>mkPart(g,px,py,pz,fn,far);
  const legs4=(hx,hz,hip,len,w,col,hoof)=>[[-hx,hz],[hx,hz],[-hx,-hz],[hx,-hz]].forEach(q=>o.legs.push(P(q[0],hip,q[1],b=>{ addBox(b,0,-len/2,0,w,len,w,ljit(col,0.07),F); addBox(b,0,-len+0.02,0.01,w+0.005,0.04,w+0.015,hoof,F); })));
  if(kind==='sheep'){
    const wool=c1||0xF2F2F2,skin=c2||0xC9B59A;
    P(0,0.36,0,b=>{ addBox(b,0,0,0,0.34,0.3,0.5,ljit(wool,0.05)); for(let i=0;i<8;i++) addBox(b,(lr()-0.5)*0.34,(lr()-0.4)*0.3,(lr()-0.5)*0.5,0.09,0.09,0.09,ljit(wool,0.1),F); addBox(b,0,-0.13,0,0.3,0.06,0.44,ljit(wool,0.08),F); });
    legs4(0.1,0.17,0.22,0.2,0.07,skin,0x3A3A3A);
    o.head=P(0,0.44,0.25,b=>{ addBox(b,0,0,0.07,0.17,0.17,0.17,ljit(skin,0.05)); addBox(b,0,0.1,0.05,0.2,0.07,0.2,ljit(wool,0.06),F); [-1,1].forEach(a=>{ addBox(b,a*0.055,0.02,0.16,0.035,0.035,0.02,0x151515,F); addBox(b,a*0.115,0.02,0.04,0.07,0.04,0.05,ljit(skin,0.05),F); }); addBox(b,0,-0.05,0.155,0.07,0.04,0.02,0x8A6A5A,F); });
    o.tail=P(0,0.42,-0.27,b=>addBox(b,0,0,-0.02,0.1,0.1,0.08,ljit(wool,0.05),F));
    o.speed=0.32;
  }else if(kind==='pig'){
    const pk=c1||0xF0A8A8,dk=c2||0xD98888;
    P(0,0.3,0,b=>{ addBox(b,0,0,0,0.3,0.26,0.46,ljit(pk,0.05)); addBox(b,0,-0.1,0,0.28,0.06,0.42,ljit(dk,0.05),F); addBox(b,0,0.1,0.05,0.2,0.05,0.24,ljit(pk,0.07),F); });
    legs4(0.09,0.15,0.19,0.17,0.08,dk,0x6A4A4A);
    o.head=P(0,0.34,0.24,b=>{ addBox(b,0,0,0.08,0.22,0.2,0.2,ljit(pk,0.05)); addBox(b,0,-0.03,0.2,0.12,0.08,0.05,ljit(dk,0.04),F); [-1,1].forEach(a=>{ addBox(b,a*0.03,-0.03,0.226,0.02,0.03,0.01,0x4A2A2A,F); addBox(b,a*0.06,0.04,0.18,0.035,0.035,0.02,0x151515,F); addBox(b,a*0.09,0.12,0.04,0.07,0.06,0.04,ljit(dk,0.05),F); }); });
    o.tail=P(0,0.38,-0.24,b=>addBox(b,0,0,-0.025,0.04,0.07,0.04,ljit(dk,0.05),F));
    o.speed=0.38;
  }else if(kind==='cow'){
    const wh=c1||0xF2F2F2,sp=c2||0x3A2A22;
    P(0,0.4,0,b=>{ addBox(b,0,0,0,0.32,0.32,0.6,ljit(wh,0.04)); addBox(b,0.165,0.02,0.1,0.02,0.16,0.2,ljit(sp,0.05),F); addBox(b,-0.165,-0.03,-0.12,0.02,0.14,0.18,ljit(sp,0.05),F); addBox(b,0,0.165,0.0,0.16,0.02,0.22,ljit(sp,0.05),F); addBox(b,0,-0.18,-0.12,0.1,0.05,0.12,0xF0B8B8,F); });
    legs4(0.1,0.2,0.26,0.24,0.09,wh,0x2A2A2A);
    o.head=P(0,0.5,0.34,b=>{ addBox(b,0,0,0.08,0.22,0.22,0.2,ljit(wh,0.04)); addBox(b,0,-0.06,0.2,0.15,0.1,0.05,0xE8B8B0,F); [-1,1].forEach(a=>{ addBox(b,a*0.1,0.14,0.05,0.04,0.09,0.04,0xD8CBA0,F); addBox(b,a*0.14,0.05,0.04,0.1,0.04,0.05,ljit(sp,0.05),F); addBox(b,a*0.06,0.05,0.18,0.035,0.035,0.02,0x151515,F); }); });
    o.tail=P(0,0.52,-0.32,b=>addBox(b,0,-0.1,-0.01,0.04,0.22,0.04,ljit(sp,0.05),F));
    o.speed=0.3;
  }else if(kind==='strider'){ /* Nether: pengganti sapi. 2 kaki panjang, badan merah, rambut api di punggung */
    const bd=c1||0xA82E2E,dk=c2||0x6E1818;
    [-1,1].forEach(a=>o.legs.push(P(a*0.1,0.4,0,b=>{ addBox(b,0,-0.2,0,0.09,0.4,0.09,ljit(dk,0.06),F); addBox(b,0,-0.38,0.02,0.1,0.05,0.14,0x3A0C0C,F); })));
    P(0,0.54,0,b=>{
      addBox(b,0,0,0,0.36,0.3,0.36,ljit(bd,0.05)); addBox(b,0,-0.11,0,0.34,0.06,0.34,ljit(dk,0.05),F);
      [-1,1].forEach(a=>addBox(b,a*0.185,0,0.05,0.03,0.2,0.2,ljit(bd,0.08),F));
      [[-0.1,-0.08],[0.08,0.02],[-0.05,0.1],[0.1,-0.1],[0,0]].forEach(q=>addBox(b,q[0],0.2,q[1],0.04,0.12+lr()*0.06,0.04,ljit(0xE05A32,0.1),F));
      [-1,1].forEach(a=>addBox(b,a*0.09,0.05,0.182,0.05,0.05,0.02,0x151515,F)); addBox(b,0,-0.06,0.182,0.14,0.03,0.02,0x2A0A0A,F);
    });
    o.speed=0.35; o.graze=false; o.rad=3;
  }else if(kind==='chicken'){
    P(0,0.21,0,b=>{ addBox(b,0,0,0,0.14,0.13,0.2,ljit(c1||0xF4F4F4,0.04)); addBox(b,0,0.08,-0.11,0.06,0.1,0.04,ljit(0xE8E8E8,0.04),F); });
    [-1,1].forEach(a=>o.legs.push(P(a*0.04,0.15,0,b=>{ addBox(b,0,-0.07,0,0.025,0.14,0.025,0xE89A2A,F); addBox(b,0,-0.14,0.02,0.07,0.015,0.06,0xE89A2A,F); })));
    [-1,1].forEach(a=>o.wings.push(P(a*0.08,0.25,0,b=>addBox(b,a*0.01,-0.04,0,0.02,0.08,0.14,ljit(0xE2E2E2,0.05),F))));
    o.head=P(0,0.3,0.1,b=>{ addBox(b,0,0.04,0.03,0.09,0.1,0.09,ljit(c1||0xF4F4F4,0.04)); addBox(b,0,0.11,0.02,0.03,0.04,0.06,0xD22B2B,F); addBox(b,0,0.03,0.085,0.04,0.03,0.04,0xF0A020,F); addBox(b,0,-0.01,0.07,0.02,0.04,0.02,0xD22B2B,F); [-1,1].forEach(a=>addBox(b,a*0.047,0.06,0.05,0.015,0.025,0.025,0x151515,F)); });
    o.speed=0.55; o.rad=2;
  }else if(kind==='fisher'){ /* villager memancing di tepi sungai kanan (di luar board): diam di tempat, joran + senar + pelampung */
    [-1,1].forEach(a=>o.legs.push(P(a*0.07,0.26,0,b=>addBox(b,0,-0.13,0,0.12,0.26,0.12,ljit(0x6B4E32,0.06),F))));
    P(0,0.46,0,b=>{ addBox(b,0,0,0,0.26,0.4,0.18,ljit(0x7A5A3A,0.05)); addBox(b,0,0.0,0.1,0.32,0.1,0.1,ljit(0x5E4328,0.05),F); });
    o.head=P(0,0.66,0,b=>{ addBox(b,0,0.08,0,0.22,0.24,0.22,ljit(0xD9A77A,0.04)); addBox(b,0,0.04,0.14,0.06,0.12,0.06,0xC08A5F,F); [-1,1].forEach(a=>addBox(b,a*0.05,0.1,0.115,0.05,0.04,0.02,0x2E8B2E,F)); addBox(b,0,0.15,0.115,0.2,0.03,0.02,0x4A3A2A,F); });
    const rod=P(0.14,0.5,0.15,b=>{ addBox(b,0,0,0.5,0.04,0.04,1.0,0x7A5530,F); addBox(b,0,-0.03,0.04,0.07,0.08,0.16,0x4A3322,F); }); rod.rotation.x=-0.6;
    const line=P(0.14,0.56,1.24,b=>addBox(b,0,0,0,0.012,1.13,0.012,0xEEEEEE,F)); line.rotation.x=-0.478; /* tengah antara ujung joran (y1.06,z0.98) dan pelampung (y0.06,z1.5) */
    o.bob=P(0.14,0.06,1.5,b=>{ addBox(b,0,0,0,0.08,0.08,0.08,0xE23B3B,F); addBox(b,0,0.06,0,0.08,0.05,0.08,0xFFFFFF,F); });
    o.speed=0.3; o.graze=false; o.rad=0; /* rad 0 = tidak pernah berkeliling */
  }else{ /* villager */
    [-1,1].forEach(a=>o.legs.push(P(a*0.07,0.26,0,b=>addBox(b,0,-0.13,0,0.12,0.26,0.12,ljit(0x6B4E32,0.06),F))));
    P(0,0.46,0,b=>{ addBox(b,0,0,0,0.26,0.4,0.18,ljit(0x7A5A3A,0.05)); addBox(b,0,0.0,0.1,0.32,0.1,0.1,ljit(0x5E4328,0.05),F); addBox(b,0,0.12,0.1,0.08,0.1,0.1,ljit(0x5E4328,0.05),F); });
    o.head=P(0,0.66,0,b=>{ addBox(b,0,0.08,0,0.22,0.24,0.22,ljit(0xD9A77A,0.04)); addBox(b,0,0.04,0.14,0.06,0.12,0.06,0xC08A5F,F); [-1,1].forEach(a=>addBox(b,a*0.05,0.1,0.115,0.05,0.04,0.02,0x2E8B2E,F)); addBox(b,0,0.15,0.115,0.2,0.03,0.02,0x4A3A2A,F); });
    o.speed=0.3; o.graze=false; o.rad=2.2;
  }
  o.g=g; return o;
}
/* Strider berjalan DI lava (bukan melayang di atasnya): permukaan lava papan Nether y=-0.2, kaki terendam ±0.25. Di darat tetap y0. */
const STRIDER_WADE_Y=-0.45;
function roamGy(o){ return (o.kind==='strider'&&BOARD_CUSTOM&&nIsLava(o.x,o.z))?STRIDER_WADE_Y:(o.y0||0); }
function spawnRoamers(){
  ROAMQ.forEach(q=>{
    const far=Math.abs(q.x)>13||Math.abs(q.z)>12,o=makeCreature(q.kind,q.c1,q.c2,far);
    o.x=o.hx=q.x; o.z=o.hz=q.z; o.yaw=q.yaw||0; o.y0=(q.pen&&q.pen.y)||0; o.sy=roamGy(o); o.g.position.set(o.x,o.sy,o.z); o.g.rotation.y=o.yaw; if(q.kind==='chicken') o.g.scale.setScalar(0.7); /* ayam diperkecil */
    if(q.pen){ o.pen=q.pen; o.rad=4; } /* hewan kandang: hanya berkeliling di dalam pagar */
    world.add(o.g); ROAM.push(o);
  });
  ROAMQ.length=0;
  spawnLife();
}
function pickRoamTarget(o){
  for(let a=0;a<8;a++){
    const ang=lr()*6.283,d=0.7+lr()*1.8,nx=o.x+Math.sin(ang)*d,nz=o.z+Math.cos(ang)*d;
    if(Math.hypot(nx-o.hx,nz-o.hz)>o.rad) continue;
    if(o.pen&&!(inPen(o.pen,nx,nz,0.3)&&inPen(o.pen,(nx+o.x)/2,(nz+o.z)/2,0.3))) continue;
    const wb=o.pen?penBlocked:walkBlocked;
    if(wb(nx,nz)||wb((nx+o.x)/2,(nz+o.z)/2)) continue;
    o.tx=nx; o.tz=nz; o.state='walk'; o.wt=0; o.eat=false; return;
  }
  o.t=1+lr()*2;
}
function updateRoam(dt,t){
  if(reduce) return;
  for(let i=0;i<ROAM.length;i++){
    const o=ROAM[i];
    if(o.state==='walk'){
      o.wt+=dt;
      const dx=o.tx-o.x,dz=o.tz-o.z,d=Math.hypot(dx,dz);
      if(d<0.06||o.wt>14){ o.state='idle'; o.t=1.5+lr()*4; o.eat=o.graze&&lr()<0.65; }
      else{
        let da=Math.atan2(dx,dz)-o.yaw; da=Math.atan2(Math.sin(da),Math.cos(da)); o.yaw+=da*Math.min(1,dt*7);
        const sp=o.speed*Math.max(0,1-Math.abs(da)/1.2),st=Math.min(d,sp*dt);
        const nx=o.x+Math.sin(o.yaw)*st,nz=o.z+Math.cos(o.yaw)*st;
        const wb=o.pen?penBlocked:walkBlocked;
        if((wb(nx,nz)&&!wb(o.x,o.z))||(o.pen&&!inPen(o.pen,nx,nz,0.25))){ o.state='idle'; o.t=0.4; }
        else{ o.x=nx; o.z=nz; }
        o.cur+=(sp-o.cur)*Math.min(1,dt*6);
      }
    }else{
      o.cur+=(0-o.cur)*Math.min(1,dt*6); o.t-=dt;
      if(o.t<=0) pickRoamTarget(o);
    }
    const k=Math.min(1,o.cur/o.speed);
    o.ph+=dt*(3+o.cur*(o.kind==='chicken'?26:15));
    const sw=Math.sin(o.ph)*0.7*k,L=o.legs;
    if(L.length===4){ L[0].rotation.x=sw; L[3].rotation.x=sw; L[1].rotation.x=-sw; L[2].rotation.x=-sw; }
    else if(L.length===2){ L[0].rotation.x=sw; L[1].rotation.x=-sw; }
    if(o.head){
      let hp=0;
      if(o.state==='idle'&&o.eat) hp=o.kind==='chicken'?0.9*Math.max(0,Math.sin(t*7+o.ph0)):0.85+0.1*Math.sin(t*5+o.ph0);
      else hp=0.08*Math.sin(o.ph*2)*k;
      o.head.rotation.x+=(hp-o.head.rotation.x)*Math.min(1,dt*7);
      if(o.kind==='villager') o.head.rotation.y=o.state==='idle'?Math.sin(t*0.8+o.ph0)*0.5:0;
    }
    if(o.bob){ o.bob.position.y=0.06+Math.sin(t*2.1+o.ph0)*0.012-Math.max(0,Math.sin(t*0.45+o.ph0*3)-0.93)*1.2; } /* pelampung naik-turun, sesekali tersentak */
    if(o.tail) o.tail.rotation.z=Math.sin(t*6+o.ph0)*0.35*(0.4+k);
    for(let w=0;w<o.wings.length;w++) o.wings[w].rotation.z=(w?1:-1)*(0.08+0.2*Math.max(0,Math.sin(t*12+o.ph0))*k);
    const gy=roamGy(o); o.sy=(o.sy===undefined)?gy:o.sy+(gy-o.sy)*Math.min(1,dt*6); /* naik/turun halus saat masuk/keluar lava */
    o.g.position.set(o.x,o.sy+Math.abs(Math.sin(o.ph))*0.02*k,o.z); o.g.rotation.y=o.yaw;
  }
}

/* ===== PETERNAKAN (kandang di kaki gunung kanan) + MOB LIAR (golem vs zombie/skeleton/creeper/spider) ===== */
function inPen(R,x,z,m){ m=m||0; return x>R.x0+m&&x<R.x1-m&&z>R.z0+m&&z<R.z1-m; }
const inR=(R,x,z)=>x>R.x0&&x<R.x1&&z>R.z0&&z<R.z1;
function queuePen(x,z,yaw,kind,c1,c2,pen){ if(capped(ROAMQ,kind)) return; ROAMQ.push({x,z,yaw,kind,c1,c2,pen:pen||RANCH}); }
/* dinding batu berpiksel untuk tebing kandang: lumut menetes di atas, batu bata kasar bervariasi, kerikil/tanah liat, blok menonjol (relief).
   (fx,fz) = pusat bidang, (dx,dz) = normal keluar, len = panjang, y dari yBot..yTop. Deterministik (hash), tidak memakai rnd(). */
function wallPix(B,fx,fz,dx,dz,len,yTop,yBot,sd){
  const tx=dz,tz=-dx,nc=Math.max(1,Math.round(len/0.3)),cw=len/nc,RH=0.25,H=yTop-yBot; if(H<=0.01) return;
  const nr=Math.max(1,Math.ceil(H/RH-0.001));
  for(let i=0;i<nc;i++){
    const off=-len/2+cw*(i+0.5),cx=fx+tx*off,cz=fz+tz*off,drip=1+(islH(cx+sd,cz,51)<0.4?1:0);
    for(let r=0;r<nr;r++){
      const y0=yTop-r*RH,hh=Math.min(RH,y0-yBot); if(hh<=0.001) break;
      const rr=islH(cx*1.7+r*3.3,cz*1.3-r*2.1+sd,52);
      let hex; if(r<drip) hex=ISL.moss[(i+r)&1];
      else if(rr<0.06) hex=ISL.clay; else if(rr<0.12) hex=ISL.gravel; else if(rr<0.2) hex=ISL.dirt[Math.floor(rr*20)&3];
      else hex=ISL.stone[Math.floor(islH(cx,cz+r,53)*4)&3];
      let c=new THREE.Color(hex).offsetHSL(0,0,(islH(cx,cz,54+r)-0.5)*0.07+(r===nr-1?-0.05:0)); /* baris bawah sedikit lebih gelap */
      addSideQuad(B,cx+dx*0.012,y0-hh/2,cz+dz*0.012,dx,dz,cw,hh,c);
      if(r>=drip&&rr>0.72){ /* blok batu menonjol (relief) */
        const pw=cw*0.86,ph=hh*0.82,pc=new THREE.Color(ISL.stone[Math.floor(rr*40)&3]).offsetHSL(0,0,(rr-0.85)*0.12);
        addBox(B,cx+dx*0.045,y0-hh/2,cz+dz*0.045,dx?0.07:pw,ph,dx?pw:0.07,pc,{edge:false});
      }
    }
  }
}
function addRanch(DB){
  const F={edge:false},W=ljit,TORCH=[];
  const post=(px,pz,h)=>{ h=h||0.48; addBox(DB,px,h/2,pz,0.09,h,0.09,W(0x8A5B33,0.06),F); };
  const railX=(x,z,w)=>[0.2,0.36].forEach(y=>addBox(DB,x,y,z,w,0.04,0.04,W(0x7A4E2A,0.06),F));
  const railZ=(x,z,d)=>[0.2,0.36].forEach(y=>addBox(DB,x,y,z,0.04,0.04,d,W(0x7A4E2A,0.06),F));
  const GROUND={cow:0x7C6A3A,pig:0x6E5A34,sheep:0x7C6A3A,chicken:0x8E7A44};
  /* satu kandang: platform batu + tanah + jerami + pagar (pintu menghadap jalan batu) + obor + isi khas hewan.
     Dibangun di koordinat lokal (lx melintang pintu, lz menuju pintu) lalu diputar sesuai gate 's'/'n'/'e'/'w'; y relatif ke tinggi kandang. */
  function buildPen(P){
    const sw=P.gate==='e'||P.gate==='w',W_=sw?P.z1-P.z0:P.x1-P.x0,D_=sw?P.x1-P.x0:P.z1-P.z0,hw=W_/2,hd=D_/2;
    const cx=(P.x0+P.x1)/2,cz=(P.z0+P.z1)/2,nx=5,nz=4,sx=W_/nx,sz=D_/nz;
    const f={s:[0,1],n:[0,-1],e:[1,0],w:[-1,0]}[P.gate],r=sw?[0,1]:[1,0];
    const w2=(lx,lz)=>[cx+lx*r[0]+lz*f[0],cz+lx*r[1]+lz*f[1]];
    const bl=(lx,y,lz,bw,bh,bd,c,o)=>{ const q=w2(lx,lz); addBox(DB,q[0],y,q[1],sw?bd:bw,bh,sw?bw:bd,c,o); };
    const brl=(lx,lz,hx,hz)=>{ const q=w2(lx,lz); blockRect(q[0],q[1],sw?hz:hx,sw?hx:hz); };
    const lpost=(lx,lz,h)=>{ h=h||0.48; bl(lx,h/2,lz,0.09,h,0.09,W(0x8A5B33,0.06),F); };
    const lrailX=(lx,lz,w)=>[0.2,0.36].forEach(y=>bl(lx,y,lz,w,0.04,0.04,W(0x7A4E2A,0.06),F));
    const lrailZ=(lx,lz,d)=>[0.2,0.36].forEach(y=>bl(lx,y,lz,0.04,0.04,d,W(0x7A4E2A,0.06),F));
    /* platform batu penahan tanah (kandang yang lebih tinggi dari tanah dasar) */
    const up=P.y-RB;
    if(up>0.01){
      addBox(DB,cx,-up/2,cz,P.x1-P.x0+0.3,up,P.z1-P.z0+0.3,W(0x777770,0.06));
      addBox(DB,cx,-0.04,cz,P.x1-P.x0+0.34,0.1,P.z1-P.z0+0.34,W(0x4F9A34,0.07),F);
      /* tebing kandang: dinding batu berpiksel di keempat sisi platform */
      const hx=(P.x1-P.x0+0.3)/2+0.03,hz=(P.z1-P.z0+0.3)/2+0.03,sd=P.x0*3+P.z0;
      wallPix(DB,cx+hx,cz,1,0,P.z1-P.z0+0.3,-0.09,-up,sd); wallPix(DB,cx-hx,cz,-1,0,P.z1-P.z0+0.3,-0.09,-up,sd+7);
      wallPix(DB,cx,cz+hz,0,1,P.x1-P.x0+0.3,-0.09,-up,sd+13); wallPix(DB,cx,cz-hz,0,-1,P.x1-P.x0+0.3,-0.09,-up,sd+19);
    }
    bl(0,0.02,0,W_,0.04,D_,W(GROUND[P.k],0.08),F);
    for(let i=0;i<7;i++) bl(-hw+0.4+lr()*(W_-0.8),0.05,-hd+0.4+lr()*(D_-0.8),0.3+lr()*0.3,0.03,0.25+lr()*0.25,W(0xD9B44A,0.1),F);
    for(let i=0;i<=nx;i++){ const lx=-hw+i*sx; [-hd,hd].forEach(lz=>{ const gate=(lz===hd&&(i===2||i===3)); lpost(lx,lz,gate?0.7:0.48); if(i<nx&&!(lz===hd&&i===2)) lrailX(lx+sx/2,lz,sx); }); }
    for(let k=1;k<nz;k++){ const lz=-hd+k*sz; [-hw,hw].forEach(lx=>lpost(lx,lz)); }
    for(let k=0;k<nz;k++){ const lz=-hd+k*sz+sz/2; [-hw,hw].forEach(lx=>lrailZ(lx,lz,sz)); }
    [w2(-hw+2*sx-0.28,hd+0.12),w2(-hw+3*sx+0.28,hd+0.12)].forEach(q=>TORCH.push([q[0],P.y,q[1]])); /* obor dipasang setelah lift */
    const zT=-hd+0.5; /* garis belakang kandang (jauh dari pintu) */
    if(P.k!=='chicken'&&P.k!=='pig'){ /* palung minum (sapi, domba) */
      bl(0,0.12,zT,1.0,0.16,0.26,W(0x7A4E2A,0.06)); bl(0,0.17,zT,0.88,0.05,0.16,0x4FA0FF,F); brl(0,zT,0.62,0.3);
    }
    if(P.k==='cow'||P.k==='sheep'){ /* jerami bale di pojok belakang */
      [[-hw+0.6,zT],[-hw+0.6,zT+0.65]].forEach(q=>{ bl(q[0],0.17,q[1],0.6,0.34,0.5,W(0xD9B44A,0.08)); bl(q[0],0.17,q[1],0.62,0.05,0.52,0x8A6A22,F); }); brl(-hw+0.6,zT+0.32,0.4,0.62);
    }
    if(P.k==='pig'){ /* kubangan lumpur + palung makan */
      bl(0.5,0.045,0,1.2,0.02,0.9,W(0x5A4028,0.06),F);
      bl(-hw+0.9,0.12,zT,1.0,0.16,0.26,W(0x7A4E2A,0.06)); bl(-hw+0.9,0.17,zT,0.88,0.05,0.16,0xC98A4A,F); brl(-hw+0.9,zT,0.62,0.3);
    }
    if(P.k==='chicken'){ /* kandang ayam kecil + palung biji */
      const hx=hw-0.85;
      bl(hx,0.25,zT,1.0,0.5,0.7,W(0x9A6B3A,0.06)); bl(hx,0.54,zT,1.12,0.08,0.82,W(0x7A3E22,0.05)); bl(hx,0.2,zT+0.36,0.26,0.3,0.02,0x2A1A0A,F);
      brl(hx,zT,0.6,0.45);
      bl(-hw+0.9,0.1,zT,0.8,0.12,0.22,W(0x7A4E2A,0.06)); bl(-hw+0.9,0.15,zT,0.7,0.04,0.14,0xE8C85A,F); brl(-hw+0.9,zT,0.5,0.28);
    }
    /* hewan: di tengah kandang, jauh dari palung */
    const lay={cow:[[-0.9,0.5,'cow'],[0.9,2.2,'cow']],pig:[[-0.8,0.6,'pig'],[0.3,3.0,'pig'],[1.1,1.4,'pig']],sheep:[[-1.1,0.2,'sheep'],[0,4.0,'sheep'],[1.1,5.2,'sheep']],chicken:[[-1.2,0.9,'chicken'],[-0.4,3.3,'chicken'],[0.4,1.6,'chicken'],[0.9,5.0,'chicken']]}[P.k];
    lay.forEach(a=>{ const q=w2(a[0],0.15); queuePen(q[0],q[1],a[1],a[2],undefined,undefined,P); });
  }
  /* jalan batu tengah yang naik ke atas lereng: badan batu, tiap tinggi ada ubin kerikil; beda tinggi = anak tangga */
  function buildPath(){
    PATH.forEach(s=>{
      const za=s[0],zb=s[1],top=s[2],len=za-zb,zm=(za+zb)/2,body=top-RB;
      if(body>0.01){ addBox(DB,PATHX,RB+body/2,zm,PATHW,body,len,W(0x77776F,0.06),F);
        [-1,1].forEach(sg=>wallPix(DB,PATHX+sg*(PATHW/2+0.03),zm,sg,0,len,top-0.02,RB,za*5+sg)); } /* sisi jalan batu: dinding berpiksel */
      const nzt=Math.max(1,Math.round(len/0.4)),tz=len/nzt;
      for(let j=0;j<nzt;j++) for(let c=-1;c<=1;c++) addBox(DB,PATHX+c*0.4,top+0.02,za-tz*(j+0.5),0.37,0.04,tz*0.92,W(0x9A9A90,0.1),F);
    });
    /* plaza batu di kaki lereng (awal jalan) */
    for(let ix=0;ix<8;ix++) for(let iz=0;iz<3;iz++) if(!((ix===0||ix===7)&&iz===2)&&Math.abs(13.7+ix*0.4-PATHX)>0.65) addBox(DB,13.7+ix*0.4,RB+0.02,2.5-iz*0.4,0.37,0.04,0.37,W(0x9A9A90,0.1),F);
    /* tiang obor di pinggir jalan pada tiap tangga */
    [[0.9,1.0],[-1.05,1.5],[-3.7,2.0]].forEach(t=>{ addTorch(DB,PATHX+PATHW/2+0.05,t[1],t[0]); });
  }
  buildPath();
  PENS.forEach(P=>lift(DB,()=>buildPen(P),P.y)); /* tiap kandang dibangun di y=0 lalu diangkat ke tingginya sendiri */
  lift(DB,()=>{ /* pohon, sarang lebah, bunga: di tanah dasar */
  /* pohon + sarang lebah di pinggir peternakan, di luar pagar */
  const hive=(x,y,z)=>{ addBox(DB,x,y,z,0.28,0.28,0.28,W(0xE2B24A,0.05)); addBox(DB,x,y-0.07,z,0.3,0.05,0.3,0x8A5B1E,F); addBox(DB,x,y+0.07,z,0.3,0.05,0.3,0x8A5B1E,F); addBox(DB,x,y-0.04,z+0.145,0.1,0.06,0.02,0x2A0A0A,F); };
  [[10.9,1.8,0.7],[19.0,2.3,0.75]].forEach(o=>{ addOak(DB,o[0],o[1],o[2]); blockRect(o[0],o[1],0.5,0.5); hive(o[0]+0.28,0.78,o[1]); RANCH.bees.push({cx:o[0]+0.28,cy:0.95,cz:o[1],r:0.5},{cx:o[0]+0.28,cy:1.2,cz:o[1],r:0.7}); });
  addBox(DB,17.3,0.3,2.3,0.08,0.6,0.08,W(0x6B4423,0.05),F); hive(17.3,0.74,2.3); RANCH.bees.push({cx:17.3,cy:0.9,cz:2.3,r:0.5},{cx:17.3,cy:0.85,cz:2.3,r:0.7});
  addOak(DB,11.2,-6.2,0.8); blockRect(11.2,-6.2,0.5,0.5); /* pohon di pojok atas kiri lereng */
  /* bunga di sekitar sarang */
  for(let i=0;i<14;i++){ const x=10.6+lr()*8.4,z=2.0+lr()*0.7; if(x>13.4&&x<17.0) continue; addBox(DB,x,0.09,z,0.1,0.18,0.1,[0xF0453A,0xFFD23F,0xFFFFFF,0xFF7EB6][Math.floor(lr()*4)],F); }
  },RB);
  TORCH.forEach(t=>addTorch(DB,t[0],t[1],t[2])); RANCH.bees.forEach(b=>{ b.cy+=RB; });
  /* mob liar di bawah board, di pinggir pohon (1 golem saja). Mob jahat hanya muncul malam: lihat syncHostNight */
  [['golem',-1.8,7.8],['zombie',-4.6,9.8],['zombie',-0.8,10.8],['skeleton',-2.6,9.4],['skeleton',1.8,10.2],['creeper',0.6,9.2],['spider',-5.0,11.0],['spider',2.8,11.0]]
    .forEach(q=>{ if(!capped(HOSTQ,q[0])) HOSTQ.push({kind:q[0],x:q[1],z:q[2]}); });
}
/* ---- model voxel mob liar ---- */
function makeHostile(kind){
  const g=new THREE.Group(),F={edge:false},W=ljit;
  const o={g,kind,legs:[],arms:[],head:null,x:0,z:0,y:0,vy:0,yaw:0,ph:Math.random()*6,mode:'idle',t:0.5+Math.random()*2,wt:0,cur:0,tx:0,tz:0,hp:3,max:3,sp:0.34,reach:0.6,dmg:1,cd:0.5,swing:0,hitT:-1,tgt:null,life:'alive',tm:0,hurt:0,sight:2.2,wz:HZ,foes:[],blocked:false,resp:7};
  const P=(px,py,pz,fn)=>mkPart(g,px,py,pz,fn,false);
  const face=(b,y,z,w,c)=>[-1,1].forEach(a=>addBox(b,a*w,y,z,0.05,0.05,0.02,c,F));
  if(kind==='zombie'){
    [-1,1].forEach(a=>o.legs.push(P(a*0.07,0.3,0,b=>addBox(b,0,-0.15,0,0.12,0.3,0.12,W(0x3B3F9E,0.06),F))));
    P(0,0.6,0,b=>addBox(b,0,0,0,0.26,0.3,0.14,W(0x1CA8B8,0.05)));
    [-1,1].forEach(a=>o.arms.push(P(a*0.19,0.72,0,b=>addBox(b,0,0,0.12,0.1,0.1,0.28,W(0x5E9E4A,0.05),F))));
    o.head=P(0,0.88,0,b=>{ addBox(b,0,0,0,0.24,0.24,0.24,W(0x5E9E4A,0.04)); face(b,0.03,0.125,0.06,0x1A1A1A); addBox(b,0,-0.06,0.125,0.1,0.03,0.02,0x1D3D18,F); });
    o.max=o.hp=6; o.sp=0.34; o.reach=0.6; o.sight=1.2; o.foes=['skeleton','golem'];
  }else if(kind==='skeleton'){
    [-1,1].forEach(a=>o.legs.push(P(a*0.06,0.3,0,b=>addBox(b,0,-0.15,0,0.06,0.3,0.06,0xDADADA,F))));
    P(0,0.6,0,b=>{ addBox(b,0,0,0,0.2,0.3,0.1,0xBEBEBE); [-0.07,0,0.07].forEach(y=>addBox(b,0,y,0.055,0.16,0.03,0.02,0x1A1A1A,F)); });
    [-1,1].forEach(a=>o.arms.push(P(a*0.15,0.72,0,b=>{ addBox(b,0,0,0.12,0.05,0.05,0.26,0xDADADA,F); if(a<0) addBox(b,-0.02,0,0.22,0.03,0.4,0.03,0x5A3A1E,F); })));
    o.head=P(0,0.87,0,b=>{ addBox(b,0,0,0,0.22,0.22,0.22,0xDADADA); face(b,0.02,0.115,0.05,0x1A1A1A); addBox(b,0,-0.06,0.115,0.1,0.03,0.02,0x1A1A1A,F); });
    o.max=o.hp=4; o.sp=0.38; o.reach=1.9; o.sight=1.5; o.foes=['zombie','golem'];
  }else if(kind==='creeper'){
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(q=>o.legs.push(P(q[0]*0.06,0.15,q[1]*0.07,b=>addBox(b,0,-0.075,0,0.09,0.15,0.09,W(0x2F7F2E,0.06),F))));
    P(0,0.32,0,b=>addBox(b,0,0,0,0.2,0.34,0.13,W(0x4DB84A,0.06)));
    o.head=P(0,0.62,0,b=>{ addBox(b,0,0,0,0.24,0.24,0.24,W(0x4DB84A,0.05)); face(b,0.03,0.125,0.05,0x101010); addBox(b,0,-0.03,0.125,0.06,0.08,0.02,0x101010,F); addBox(b,0,-0.08,0.125,0.1,0.04,0.02,0x101010,F); });
    o.max=o.hp=3; o.sp=0.32; o.sight=0;
  }else if(kind==='spider'){
    P(0,0.16,-0.17,b=>addBox(b,0,0.02,0,0.26,0.2,0.3,W(0x2A2024,0.06)));
    P(0,0.15,0.02,b=>addBox(b,0,0,0,0.18,0.14,0.14,W(0x3A2E32,0.05),F));
    o.head=P(0,0.17,0.15,b=>{ addBox(b,0,0,0,0.16,0.14,0.14,W(0x2A2024,0.05)); [-1,1].forEach(a=>{ addBox(b,a*0.04,0.03,0.075,0.04,0.04,0.02,0xE02020,F); addBox(b,a*0.065,0.0,0.075,0.025,0.025,0.02,0xE02020,F); }); });
    [-1,1].forEach(s=>[-0.13,-0.04,0.05,0.14].forEach((z,i)=>o.legs.push(P(s*0.08,0.16,z,b=>{ addBox(b,s*0.15,0.02,0,0.3,0.04,0.04,0x3A2E32,F); addBox(b,s*0.3,-0.06,0,0.04,0.2,0.04,0x2A2024,F); }))));
    o.max=o.hp=3; o.sp=0.6; o.sight=0;
  }else{ /* golem besi */
    const st=0xC9C9C2,dk=0x9A9A92,lt=0xB5B5AC,vn=0x5E8A3E,vn2=0x4A7330;
    [-1,1].forEach(a=>o.legs.push(P(a*0.13,0.4,0,b=>{ addBox(b,0,-0.2,0,0.17,0.4,0.17,W(dk,0.05),F); addBox(b,0,-0.37,0.025,0.19,0.06,0.23,W(0x7E7E76,0.05),F); addBox(b,0,-0.12,0.088,0.1,0.14,0.01,vn2,F); })));
    P(0,0.55,0,b=>{ addBox(b,0,0,0,0.3,0.14,0.2,W(dk,0.05)); addBox(b,0,0.0,0.105,0.32,0.04,0.01,0x7E7E76,F); });
    P(0,0.88,0,b=>{
      addBox(b,0,0,0,0.52,0.5,0.3,W(st,0.05)); addBox(b,0,0.28,0,0.62,0.12,0.3,W(lt,0.05));
      addBox(b,-0.12,0.06,0.152,0.2,0.16,0.02,W(lt,0.04),F); addBox(b,0.14,-0.12,0.152,0.18,0.14,0.02,W(dk,0.04),F);
      addBox(b,0.12,-0.04,0.158,0.14,0.2,0.02,vn,F); addBox(b,0.12,-0.2,0.158,0.07,0.12,0.02,vn2,F); addBox(b,-0.16,0.12,0.158,0.1,0.1,0.02,vn,F);
      addBox(b,-0.08,-0.15,0.152,0.02,0.16,0.02,0x7E7E76,F); addBox(b,0.0,0.0,-0.152,0.3,0.3,0.02,W(dk,0.05),F);
    });
    [-1,1].forEach(a=>o.arms.push(P(a*0.36,1.08,0,b=>{ addBox(b,0,-0.3,0,0.13,0.62,0.14,W(st,0.05)); addBox(b,0,0.04,0,0.17,0.12,0.18,W(lt,0.05),F); addBox(b,0,-0.58,0,0.17,0.14,0.17,W(dk,0.05),F); addBox(b,0,-0.4,0.072,0.07,0.22,0.01,vn,F);
      if(a>0){ addBox(b,0.0,-0.66,0.1,0.015,0.14,0.015,0x2E7D2E,F); addBox(b,0.0,-0.58,0.1,0.07,0.06,0.04,0xE03030,F); } })));
    o.head=P(0,1.3,0.04,b=>{ addBox(b,0,0,0,0.26,0.26,0.24,W(st,0.04)); addBox(b,0,0.06,0.125,0.28,0.035,0.03,0x7E7E76,F); addBox(b,0,-0.04,0.14,0.07,0.16,0.08,0x8A5B3A,F); addBox(b,0,-0.11,0.16,0.07,0.03,0.04,0x6E4528,F); face(b,0.03,0.127,0.07,0xE8C33A); });
    o.max=o.hp=14; o.sp=0.3; o.reach=0.95; o.dmg=2; o.sight=1.3; o.wz=GZ; o.foes=['zombie','skeleton','creeper','spider']; o.cd=1.0;
  }
  return o;
}
function spawnLife(){
  HOSTQ.forEach(q=>{
    const o=makeHostile(q.kind); o.x=q.x; o.z=q.z; o.yaw=Math.random()*6.28; o.g.position.set(o.x,0,o.z); o.g.rotation.y=o.yaw;
    world.add(o.g); HOST.push(o);
  });
  HOSTQ.length=0;
  syncHostNight();
  RANCH.bees.forEach(c=>{
    const g=new THREE.Group(),F={edge:false},wings=[];
    mkPart(g,0,0,0,b=>{ addBox(b,0,0,0,0.07,0.06,0.1,0xF2C21B,F); addBox(b,0,0,-0.02,0.072,0.062,0.025,0x222222,F); addBox(b,0,0,0.03,0.072,0.062,0.025,0x222222,F); addBox(b,0,0,0.055,0.04,0.04,0.02,0x222222,F); },true);
    [-1,1].forEach(a=>wings.push(mkPart(g,a*0.03,0.04,0,b=>addBox(b,a*0.03,0,0,0.06,0.01,0.05,0xDFF3FF,F),true)));
    const bee={g,wings,c,a:Math.random()*6.28,w:(0.8+Math.random()*0.7)*(Math.random()<0.5?-1:1),ph:Math.random()*6};
    world.add(g); BEES.push(bee);
  });
}
/* ---- perilaku ---- */
const ARW_GEO=new THREE.BoxGeometry(0.03,0.03,0.3),ARW_MAT=new THREE.MeshLambertMaterial({color:0x6B4B2A});
function shootArrow(o,T){
  const m=new THREE.Mesh(ARW_GEO,ARW_MAT),sx=o.x+Math.sin(o.yaw)*0.25,sz=o.z+Math.cos(o.yaw)*0.25,d=Math.hypot(T.x-sx,T.z-sz);
  m.position.set(sx,0.6,sz); m.rotation.y=Math.atan2(T.x-sx,T.z-sz); world.add(m);
  ARROWS.push({m,sx,sz,tx:T.x,tz:T.z,t:0,T:Math.max(0.15,d/4.5),from:o,tgt:T});
}
function hurtMob(T,amt,from){
  if(T.life!=='alive') return;
  T.hp-=amt; T.hurt=0.4;
  const dx=T.x-from.x,dz=T.z-from.z,l=Math.hypot(dx,dz)||1,kb=from.kind==='golem'?0.5:0.2,nx=T.x+dx/l*kb,nz=T.z+dz/l*kb;
  if(inR(GZ,nx,nz)&&!walkBlocked(nx,nz)){ T.x=nx; T.z=nz; }
  if(from.kind==='golem') T.vy=3.2; /* golem melempar lawannya ke atas */
  sparkle(new THREE.Vector3(T.x,T.y+0.5,T.z));
  if(T.hp<=0){ T.life='dying'; T.tm=0.8; T.resp=(T.kind==='golem'?12:9)+Math.random()*6; T.tgt=null; T.hitT=-1; }
  else if(!T.tgt&&T.foes.includes(from.kind)) T.tgt=from; /* balas menyerang */
}
function respawnMob(o){
  const R=o.wz;
  for(let i=0;i<20;i++){
    const x=R.x0+0.4+Math.random()*(R.x1-R.x0-0.8),z=R.z0+0.4+Math.random()*(R.z1-R.z0-0.8);
    if(walkBlocked(x,z)) continue;
    let far=true; for(let j=0;j<HOST.length;j++){ const q=HOST[j]; if(q!==o&&q.life==='alive'&&Math.hypot(q.x-x,q.z-z)<1.0) far=false; }
    if(!far&&i<18) continue;
    o.x=x; o.z=z; break;
  }
  o.hp=o.max; o.life='spawn'; o.tm=0.4; o.tgt=null; o.cd=1; o.y=0; o.vy=0; o.hurt=0; o.mode='idle'; o.t=1;
  o.g.visible=true; o.g.rotation.z=0; o.g.scale.setScalar(0.01); sparkle(new THREE.Vector3(o.x,0.5,o.z));
}
/* Mob jahat (zombie/skeleton/creeper/spider) hanya ada saat MALAM. Siang: disembunyikan & dinonaktifkan (life='day'), panah dibuang.
   Malam: muncul lagi lewat respawnMob (efek spawn, HP penuh). Golem (ramah) tetap ada. Dipanggil dari applyLook (ganti siang/malam) dan spawnLife (dunia baru). */
const NIGHT_MOBS={zombie:1,skeleton:1,creeper:1,spider:1};
const SPAWN_GAP=[8,15];           /* jeda antar mob muncul saat malam (detik) */
const BURN_DELAY=20;              /* mob mulai terbakar acak 0-20 dtk setelah siang */
const BURN_DUR=[10,18];           /* lama terbakar sampai hilang (detik) */
function restoreBurn(o){
  if(o.bm){ o.bm.forEach(e=>{ e.mesh.material=e.orig; if(e.mat.dispose) e.mat.dispose(); }); o.bm=null; }
  o.burn=false; o.burnIn=-1;
}
function hostEnter(o){
  restoreBurn(o); respawnMob(o);
  if(reduce){ o.life='alive'; o.tm=0; o.g.scale.setScalar(1); o.g.position.set(o.x,0,o.z); o.g.rotation.y=o.yaw; } /* gerak dikurangi: updateLife tidak jalan, langsung tampil penuh */
}
function hostToDay(o){
  restoreBurn(o); o.life='day'; o.tgt=null; o.mode='idle'; o.hurt=0; o.spawnIn=0; o.g.visible=false; o.g.rotation.z=0; o.g.scale.setScalar(1);
}
function syncHostNight(){
  let gap=1;
  for(let i=0;i<HOST.length;i++){
    const o=HOST[i]; if(!NIGHT_MOBS[o.kind]) continue;
    if(night){
      if(o.life==='day'){
        if(reduce) hostEnter(o);
        else{ o.spawnIn=gap; gap+=SPAWN_GAP[0]+Math.random()*(SPAWN_GAP[1]-SPAWN_GAP[0]); } /* muncul satu per satu */
      }else restoreBurn(o); /* malam kembali sebelum terbakar habis: batal terbakar */
    }else{
      o.spawnIn=0;
      if(o.life==='day') continue;
      if(reduce||o.life==='gone'||o.life==='dying') hostToDay(o);
      else if(!o.burn&&!(o.burnIn>=0)){ o.burnIn=Math.random()*BURN_DELAY; o.burnTot=BURN_DUR[0]+Math.random()*(BURN_DUR[1]-BURN_DUR[0]); }
    }
  }
  if(!night&&ARROWS.length){ ARROWS.forEach(a=>world.remove(a.m)); ARROWS.length=0; }
}
/* siang: mob terbakar pelan-pelan (kedip api, makin gosong, mengecil) lalu hilang; malam: muncul satu per satu */
function updateNightMobs(dt,t){
  for(let i=0;i<HOST.length;i++){
    const o=HOST[i]; if(!NIGHT_MOBS[o.kind]) continue;
    if(night){
      if(o.life==='day'&&o.spawnIn>0){ o.spawnIn-=dt; if(o.spawnIn<=0) hostEnter(o); }
      continue;
    }
    if(o.life==='gone'||o.life==='dying'&&o.tm<=0){ hostToDay(o); continue; }
    if(o.life==='day') continue;
    if(!o.burn&&o.burnIn>=0){
      o.burnIn-=dt;
      if(o.burnIn<=0){
        o.burn=true; o.burnLeft=o.burnTot||12; o.bm=[]; o.fxT=0;
        o.g.traverse(m=>{ if(m.isMesh&&m.material&&!Array.isArray(m.material)&&m.material.emissive){ const c=m.material.clone(); o.bm.push({mesh:m,orig:m.material,mat:c}); m.material=c; } });
      }
    }
    if(!o.burn) continue;
    o.burnLeft-=dt;
    const k=Math.max(0,o.burnLeft/(o.burnTot||12)),fl=Math.sin(t*28+o.ph)>0;
    if(o.bm) o.bm.forEach(e=>{ e.mat.emissive.setHex(fl?0xFF5A00:0x7A1A00); e.mat.color.lerp(CHAR,Math.min(1,dt*0.35)); });
    if(o.life==='alive') o.g.scale.setScalar(0.7+0.3*k);
    o.fxT-=dt; if(o.fxT<=0){ o.fxT=0.3; sparkle(new THREE.Vector3(o.x+(Math.random()-0.5)*0.2,o.y+0.3+Math.random()*0.5,o.z+(Math.random()-0.5)*0.2)); }
    if(o.burnLeft<=0){ sparkle(new THREE.Vector3(o.x,0.5,o.z)); hostToDay(o); }
  }
}
const CHAR=new THREE.Color(0x1a1008);
function stepMob(o,tx,tz,sp,dt){
  const dx=tx-o.x,dz=tz-o.z,d=Math.hypot(dx,dz); o.blocked=false;
  let da=Math.atan2(dx,dz)-o.yaw; da=Math.atan2(Math.sin(da),Math.cos(da)); o.yaw+=da*Math.min(1,dt*8);
  const v=sp*Math.max(0,1-Math.abs(da)/1.2),st=Math.min(d,v*dt),nx=o.x+Math.sin(o.yaw)*st,nz=o.z+Math.cos(o.yaw)*st;
  if(inR(GZ,nx,nz)&&!walkBlocked(nx,nz)){ o.x=nx; o.z=nz; o.cur+=(v-o.cur)*Math.min(1,dt*6); }
  else{ o.cur*=0.85; o.blocked=true; }
  return d;
}
function pickWander(o){
  const R=o.wz;
  if(!inR(R,o.x,o.z)){ o.tx=Math.min(R.x1-0.4,Math.max(R.x0+0.4,o.x)); o.tz=Math.min(R.z1-0.4,Math.max(R.z0+0.4,o.z)); o.mode='walk'; o.wt=0; return; }
  for(let a=0;a<10;a++){
    const nx=o.x+(Math.random()-0.5)*4,nz=o.z+(Math.random()-0.5)*3;
    if(!inR(R,nx,nz)||walkBlocked(nx,nz)||walkBlocked((nx+o.x)/2,(nz+o.z)/2)) continue;
    o.tx=nx; o.tz=nz; o.mode='walk'; o.wt=0; return;
  }
  o.t=1+Math.random()*2;
}
function updateLife(dt,t){
  if(reduce) return;
  /* lebah: terbang melingkar di sekitar sarang/bunga */
  for(let i=0;i<BEES.length;i++){
    const b=BEES[i],c=b.c; b.a+=dt*b.w;
    const x=c.cx+Math.cos(b.a)*c.r,z=c.cz+Math.sin(b.a)*c.r*0.8,y=c.cy+0.12*Math.sin(b.a*2.3+b.ph);
    const vx=-Math.sin(b.a)*b.w,vz=Math.cos(b.a)*0.8*b.w;
    b.g.position.set(x,y,z); b.g.rotation.y=Math.atan2(vx,vz);
    const fl=0.6*Math.sin(t*70+b.ph); b.wings[0].rotation.z=fl; b.wings[1].rotation.z=-fl;
  }
  /* panah skeleton */
  for(let i=ARROWS.length-1;i>=0;i--){
    const a=ARROWS[i]; a.t+=dt; const k=Math.min(1,a.t/a.T);
    a.m.position.set(a.sx+(a.tx-a.sx)*k,0.6+Math.sin(k*Math.PI)*0.12-k*0.1,a.sz+(a.tz-a.sz)*k);
    if(k>=1){ if(a.tgt.life==='alive'&&Math.hypot(a.tgt.x-a.tx,a.tgt.z-a.tz)<0.55) hurtMob(a.tgt,1,a.from); world.remove(a.m); ARROWS.splice(i,1); }
  }
  updateNightMobs(dt,t);
  for(let i=0;i<HOST.length;i++){
    const o=HOST[i];
    if(o.life==='day') continue;
    if(o.life==='dying'){
      o.tm-=dt; const k=Math.max(0,o.tm/0.8); o.g.rotation.z=(1-k)*1.45; o.g.position.y=o.y*k;
      if(o.tm<=0){ o.life='gone'; o.g.visible=false; o.tm=o.resp; }
      continue;
    }
    if(o.life==='gone'){ o.tm-=dt; if(o.tm<=0) respawnMob(o); continue; }
    if(o.life==='spawn'){
      o.tm-=dt; o.g.scale.setScalar(Math.max(0.01,1-Math.max(0,o.tm)/0.4)); o.g.position.set(o.x,0,o.z); o.g.rotation.y=o.yaw;
      if(o.tm<=0){ o.life='alive'; o.g.scale.setScalar(1); }
      continue;
    }
    o.cd=Math.max(0,o.cd-dt); o.hurt=Math.max(0,o.hurt-dt); o.swing=Math.max(0,o.swing-dt);
    /* cari lawan */
    if(o.tgt&&(o.tgt.life!=='alive'||Math.hypot(o.tgt.x-o.x,o.tgt.z-o.z)>Math.max(o.sight,2.4)*1.7)) o.tgt=null;
    if(!o.tgt&&o.foes.length){
      let bd=o.sight;
      for(let j=0;j<HOST.length;j++){ const f=HOST[j]; if(f===o||f.life!=='alive'||o.foes.indexOf(f.kind)<0) continue; const d=Math.hypot(f.x-o.x,f.z-o.z); if(d<bd){ bd=d; o.tgt=f; } }
    }
    if(o.tgt){
      const T=o.tgt,dx=T.x-o.x,dz=T.z-o.z,d=Math.hypot(dx,dz);
      if(d>o.reach*0.85) stepMob(o,T.x,T.z,o.sp*1.3,dt);
      else{ let da=Math.atan2(dx,dz)-o.yaw; da=Math.atan2(Math.sin(da),Math.cos(da)); o.yaw+=da*Math.min(1,dt*9); o.cur*=0.8; }
      if(o.blocked){ o.tgt=null; o.mode='idle'; o.t=0.5; }
      else if(d<=o.reach&&o.cd<=0&&o.swing<=0){ o.cd=o.kind==='golem'?1.5:1.1; o.swing=0.5; o.hitT=o.kind==='golem'?0.28:0.2; }
    }else if(o.mode==='walk'){
      o.wt+=dt; const d=stepMob(o,o.tx,o.tz,o.sp,dt);
      if(d<0.06||o.wt>12||o.blocked){ o.mode='idle'; o.t=(o.kind==='golem'?4:1.5)+Math.random()*(o.kind==='golem'?6:4); }
    }else{
      o.cur+=(0-o.cur)*Math.min(1,dt*6); o.t-=dt; if(o.t<=0) pickWander(o);
    }
    if(o.hitT>=0){
      o.hitT-=dt;
      if(o.hitT<0){ const T=o.tgt; if(T&&T.life==='alive'){ if(o.kind==='skeleton') shootArrow(o,T); else if(Math.hypot(T.x-o.x,T.z-o.z)<=o.reach*1.4) hurtMob(T,o.dmg,o); } }
    }
    /* fisika loncat (dilempar golem) */
    if(o.y>0||o.vy>0){ o.vy-=14*dt; o.y+=o.vy*dt; if(o.y<=0){ o.y=0; o.vy=0; } }
    /* animasi */
    const k=Math.min(1,o.cur/o.sp);
    o.ph+=dt*(3+o.cur*(o.kind==='spider'?30:14));
    const sw=Math.sin(o.ph)*0.6*k,L=o.legs;
    if(o.kind==='spider'){ for(let q=0;q<L.length;q++) L[q].rotation.y=Math.sin(o.ph+(q%2?Math.PI:0)+q*0.9)*0.4*k; }
    else if(L.length===4){ L[0].rotation.x=sw; L[3].rotation.x=sw; L[1].rotation.x=-sw; L[2].rotation.x=-sw; }
    else if(L.length===2){ L[0].rotation.x=sw; L[1].rotation.x=-sw; }
    const p=o.swing>0?1-o.swing/0.5:0;
    if(o.kind==='golem'){
      const a=o.swing>0?(p<0.55?-2.4*(p/0.55):-2.4*Math.max(0,1-(p-0.55)/0.2)):0;
      o.arms[0].rotation.x=o.swing>0?a:-sw*0.8; o.arms[1].rotation.x=o.swing>0?a:sw*0.8;
    }else if(o.kind==='zombie'){
      const a=o.swing>0?-(0.2+0.9*Math.sin(p*Math.PI)):-0.05+0.06*Math.sin(t*2+o.ph);
      o.arms[0].rotation.x=a; o.arms[1].rotation.x=a;
    }else if(o.kind==='skeleton'){
      const a=o.swing>0?-0.5*Math.sin(p*Math.PI):0; o.arms[0].rotation.x=a; o.arms[1].rotation.x=a;
    }
    if(o.head) o.head.rotation.x+=(((o.kind==='creeper'||o.kind==='spider')?0:0.05*Math.sin(o.ph*2)*k)-o.head.rotation.x)*Math.min(1,dt*7);
    const jx=o.hurt>0?Math.sin(t*60)*0.03:0,bob=Math.abs(Math.sin(o.ph))*0.015*k;
    let sc=1; if(o.kind==='creeper'&&o.hurt>0) sc=1+0.1*Math.abs(Math.sin(t*20));
    o.g.scale.setScalar(sc);
    o.g.position.set(o.x+jx,o.y+bob,o.z); o.g.rotation.y=o.yaw; o.g.rotation.z=0;
  }
}

/* ---------- api, lampu malam, cahaya bidak ---------- */
function applyNightFX(){
  WINS.forEach(w=>{ w.m.material.color.setHex(night?0xFFD268:0x9ADFF5); w.halo.visible=night; w.halo.material.opacity=night?0.55:0; });
}
function updateFX(dt,t){
  updatePortals(dt,t);
  if(skyStars) skyStars.material.opacity=0.8+0.2*Math.sin(t*2.1);
  for(let i=0;i<FIRES.length;i++){
    const f=FIRES[i],fl=0.86+0.14*Math.sin(t*13+f.ph)+0.07*Math.sin(t*29+f.ph*1.7);
    if(f.out){ if(f.lt) f.lt.intensity=0; continue; } /* api sudut papan padam: digantikan tower (Dragon Awakening) */
    f.g.scale.set(f.s*(0.92+0.08*fl),f.s*fl,f.s*(0.92+0.08*fl));
    f.halo.material.opacity=f.hal*(night?1:0.1)*fl;
    if(f.lt) f.lt.intensity=night?f.li*(0.8+0.2*fl):0;
  }
  for(let i=0;i<SMOKE.length;i++){
    const s=SMOKE[i]; s.k+=dt*s.sp; if(s.k>1) s.k-=1; const k=s.k;
    s.m.position.set(s.x+Math.sin(k*5+s.ph)*0.12,s.y+k*1.5,s.z+Math.cos(k*4+s.ph)*0.08);
    s.m.scale.setScalar(0.6+k*1.6); s.m.material.opacity=0.3*(1-k)*Math.min(1,k*6);
  }
  for(let i=0;i<PLIGHTS.length;i++){
    const p=players[i],L=PLIGHTS[i];
    if(night&&p&&!coarse){ L.position.set(p.pawn.position.x,p.pawn.position.y+0.7,p.pawn.position.z); L.intensity=0.55; } else L.intensity=0;
    if(p&&p.pawn.userData.halo) p.pawn.userData.halo.visible=night;
  }
}

function addCreeper(B,x,z,h){
  const g=0x4DB84A,d=0x2F7F2E,l=0x66CC5E,k=0x101010,F={edge:false};
  const q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(a=>q(a[0]*0.06,0.075,a[1]*0.07,0.09,0.15,0.09,jit(d,0.08)));
  q(0,0.32,0,0.2,0.3,0.12,g);
  [[-0.06,0.4,0x3B9A3A],[0.05,0.3,0x3B9A3A],[-0.03,0.22,l],[0.07,0.42,l]].forEach(a=>q(a[0],a[1],0.062,0.05,0.05,0.01,a[2],F));
  q(0,0.6,0,0.24,0.24,0.24,g);
  q(0,0.725,0,0.2,0.01,0.2,l,F);
  [[-0.08,0.68,0x3B9A3A],[0.07,0.55,0x3B9A3A],[0.0,0.7,l],[-0.09,0.54,l]].forEach(a=>q(a[0],a[1],0.126,0.04,0.04,0.005,a[2],F));
  [-1,1].forEach(a=>q(a*0.055,0.645,0.127,0.06,0.06,0.02,k,F));
  q(0,0.585,0.127,0.06,0.06,0.02,k,F);
  q(0,0.53,0.127,0.1,0.06,0.02,k,F);
  [-1,1].forEach(a=>q(a*0.04,0.49,0.127,0.03,0.04,0.02,k,F));
}
function addEnderman(B,x,z,h){
  const k=0x15121C,k2=0x241C30,e=0xDD66FF,F={edge:false};
  const q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  [-1,1].forEach(a=>{ q(a*0.045,0.25,0,0.06,0.5,0.06,k); q(a*0.045,0.02,0.015,0.065,0.04,0.09,k2); });
  q(0,0.65,0,0.16,0.3,0.1,k);
  q(0,0.5,0,0.17,0.04,0.105,k2,F);
  [-1,1].forEach(a=>{ q(a*0.115,0.6,0,0.04,0.52,0.05,k); q(a*0.115,0.33,0,0.045,0.06,0.055,k2); });
  q(0,0.94,0,0.2,0.2,0.2,k); q(0,0.865,0.002,0.202,0.04,0.202,k2,F);
  [-1,1].forEach(a=>{ q(a*0.055,0.955,0.103,0.07,0.04,0.02,e,F); q(a*0.055,0.955,0.113,0.03,0.03,0.01,0xFFE6FF,F); });
  q(0,0.88,0.103,0.12,0.015,0.02,0x0A0810,F);
  [[-0.2,0.5,0.06],[0.21,0.82,-0.05],[0.16,0.3,0.1],[-0.17,1.12,0]].forEach(a=>q(a[0],a[1],a[2],0.03,0.03,0.03,e,F));
}
function addMcHouse(B,x,z){
  /* Rumah detail: pondasi batu, tiang sudut kayu, papan, atap bertingkat + bubungan, pintu berbingkai, jendela berbingkai + daun jendela + kotak bunga, cerobong. Footprint & posisi jendela/pintu sama dengan versi lama (glow jendela & blockRect tetap pas). Tanpa rnd() ekstra agar seed dunia tidak bergeser. */
  const w=0xB98A4E,r=0x7A4A2A,F={edge:false},wd=0x3E2612,Q=(dx,dy,dz,ww,hh,dd,c,f)=>addBox(B,x+dx,dy,z+dz,ww,hh,dd,c,f);
  addBox(B,x,0.45,z,1.5,0.9,1.2,jit(w,0.05));                       /* dinding (1x jit seperti dulu) */
  Q(0,0.06,0,1.57,0.12,1.27,0x8A8A8A); Q(-0.55,0.06,0.636,0.28,0.12,0.01,0x777777,F); Q(0.5,0.06,0.636,0.22,0.12,0.01,0x9A9A9A,F); /* pondasi batu */
  [-1,1].forEach(a=>[-1,1].forEach(b=>Q(a*0.745,0.47,b*0.595,0.1,0.94,0.1,0x5A3A1E))); /* tiang sudut */
  [0.3,0.62].forEach(y=>{ Q(0,y,0.603,1.38,0.025,0.01,0xA07840,F); Q(0,y,-0.603,1.38,0.025,0.01,0xA07840,F); }); /* garis papan depan & belakang */
  [0.3,0.62].forEach(y=>{ Q(0.753,y,0,0.01,0.025,1.1,0xA07840,F); Q(-0.753,y,0,0.01,0.025,1.1,0xA07840,F); });
  /* atap */
  Q(0,0.91,0,1.74,0.04,1.44,0x4A2E18,F);
  Q(0,1.0,0,1.7,0.2,1.4,r); Q(0,1.2,0,1.3,0.2,1.0,r); Q(0,1.4,0,0.9,0.2,0.6,r);
  Q(0,1.535,0,0.96,0.07,0.66,0x5E3820); Q(0,1.58,0,0.5,0.04,0.3,0x4A2E18,F);
  [1.0,1.2,1.4].forEach((y,k)=>{ const ww=[1.71,1.31,0.91][k],dd=[1.41,1.01,0.61][k]; Q(0,y-0.085,0,ww,0.03,dd,0x6A3F22,F); }); /* garis genteng */
  /* pintu */
  Q(0,0.32,0.605,0.38,0.66,0.02,wd); Q(0,0.3,0.61,0.3,0.6,0.04,0x5B3A1E);
  Q(0,0.3,0.633,0.01,0.56,0.01,0x3E2612,F); Q(0,0.46,0.633,0.26,0.01,0.01,0x3E2612,F); Q(0,0.2,0.633,0.26,0.01,0.01,0x3E2612,F);
  Q(0.09,0.3,0.636,0.035,0.035,0.02,0xFFD23F,F); Q(0,0.03,0.74,0.46,0.06,0.2,0x9A9A9A); Q(0,0.065,0.7,0.4,0.01,0.1,0xB0B0B0,F);
  /* jendela depan (posisi sama dengan glow) */
  [-1,1].forEach(a=>{ const cx=a*0.45;
    Q(cx,0.55,0.603,0.33,0.33,0.02,wd);
    Q(cx,0.55,0.61,0.25,0.25,0.04,0x9ADFF5);
    Q(cx,0.55,0.645,0.012,0.25,0.012,wd,F); Q(cx,0.55,0.645,0.25,0.012,0.012,wd,F);
    Q(cx+a*0.2,0.55,0.62,0.07,0.31,0.03,0x2F6B3A); Q(cx-a*0.2,0.55,0.62,0.07,0.31,0.03,0x2F6B3A);
    Q(cx,0.36,0.66,0.34,0.07,0.1,0x6A4220);
    [[-0.1,0xE24A4A],[-0.03,0xFFD23F],[0.04,0xFF8FC8],[0.1,0xE24A4A]].forEach(f=>Q(cx+f[0],0.415,0.665,0.045,0.05,0.045,f[1],F));
    Q(cx+0.0,0.39,0.665,0.3,0.02,0.06,0x2F7F2E,F);
  });
  /* jendela samping */
  [-1,1].forEach(a=>{ Q(a*0.753,0.55,0,0.02,0.3,0.3,wd); Q(a*0.762,0.55,0,0.02,0.22,0.22,0x9ADFF5); Q(a*0.772,0.55,0,0.012,0.22,0.012,wd,F); Q(a*0.772,0.55,0,0.012,0.012,0.22,wd,F); });
  /* cerobong */
  Q(0.5,1.45,-0.2,0.22,0.55,0.22,0x6E6E6E); [1.3,1.45,1.6].forEach((y,k)=>Q(0.5,y,-0.087,0.22,0.03,0.01,0x5A5A5A,F));
  Q(0.5,1.75,-0.2,0.3,0.06,0.3,0x4E4E4E); Q(0.5,1.8,-0.2,0.16,0.05,0.16,0x1A1A1A,F);
  /* peti kayu kecil di samping */
  Q(-0.98,0.12,0.5,0.24,0.24,0.24,0xA8742E); Q(-0.98,0.12,0.5,0.25,0.03,0.25,0x6A4220,F); Q(-0.98,0.2,0.5,0.25,0.03,0.25,0x6A4220,F);
}
function addPortal(B,x,z,y0){
  for(let i=0;i<4;i++) for(let j=0;j<5;j++){
    const edge=(i===0||i===3||j===0||j===4);
    addBox(B,x+(i-1.5)*0.4,0.2+j*0.4,z,0.4,0.4,edge?0.4:0.12,edge?jit(0x1E1236,0.05):jit(0x9B30FF,0.1),{edge:edge});
  }
  addPortalFX(x,z,y0||0);
}
/* ---------- Portal Nether: bagian ungu menyala tipis (siang/malam) + sparkle kecil transparan. Murni visual. ---------- */
const PORTALS=[],PORTAL_COL=0xB45CFF;
const PORTAL_PLANE=new THREE.PlaneGeometry(0.76,1.16),PORTAL_SPARK=new THREE.BoxGeometry(0.05,0.05,0.05);
function addPortalFX(x,z,y0){
  const mk=()=>new THREE.MeshBasicMaterial({color:PORTAL_COL,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const planes=[0.07,-0.07].map(dz=>{ const m=new THREE.Mesh(PORTAL_PLANE,mk()); m.position.set(x,y0+1.0,z+dz); if(dz<0) m.rotation.y=Math.PI; m.renderOrder=3; world.add(m); return m; });
  const halo=makeHalo(x,y0+1.0,z,2.6,PORTAL_COL); world.add(halo);
  const sparks=[]; const n=coarse?5:9;
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(PORTAL_SPARK,mk()); m.renderOrder=4; world.add(m);
    sparks.push({m,k:Math.random(),sp:0.22+Math.random()*0.25,ox:(Math.random()-0.5)*0.6,oz:(Math.random()<0.5?-1:1)*(0.1+Math.random()*0.12),ph:Math.random()*6.28});
  }
  PORTALS.push({planes,halo,sparks,x,z,y0,ph:Math.random()*6.28});
}
function updatePortals(dt,t){
  for(let i=0;i<PORTALS.length;i++){
    const P=PORTALS[i],pulse=reduce?0.5:0.5+0.5*Math.sin(t*1.8+P.ph);
    const a=(night?0.3:0.13)+(night?0.12:0.06)*pulse;
    P.planes.forEach(m=>{ m.material.opacity=a; });
    P.halo.material.opacity=(night?0.45:0.14)*(0.75+0.25*pulse);
    for(let j=0;j<P.sparks.length;j++){
      const S=P.sparks[j];
      if(reduce){ S.m.material.opacity=0; continue; }
      S.k+=dt*S.sp; if(S.k>1) S.k-=1; const k=S.k;
      S.m.position.set(P.x+S.ox+Math.sin(k*6+S.ph)*0.04,P.y0+0.45+k*1.1,P.z+S.oz);
      S.m.rotation.y+=dt*2; S.m.scale.setScalar(0.7+0.5*Math.sin(t*7+S.ph));
      S.m.material.opacity=(night?0.7:0.45)*Math.sin(k*Math.PI)*(0.6+0.4*Math.sin(t*9+S.ph));
    }
  }
}
function addPillar(B,x,z,hgt){
  for(let y=0;y<hgt;y+=0.4) addBox(B,x,y+0.2,z,0.5,0.4,0.5,jit(0x1A1A24,0.05));
  addBox(B,x,hgt+0.2,z,0.28,0.28,0.28,0xFF55CC);
}
function addHill(B,x0,x1,z0,z1,n,stone){
  for(let l=0;l<n;l++){
    const i=l*0.55,w=x1-x0-2*i,d=z1-z0-2*i; if(w<=0.3||d<=0.3) break;
    addBox(B,(x0+x1)/2,(l+0.5)*0.5,(z0+z1)/2,w,0.5,d,jit(stone?0x7F7F7F:0x8A5B33,0.06));
    addBox(B,(x0+x1)/2,(l+1)*0.5+0.02,(z0+z1)/2,w-0.04,0.06,d-0.04,jit(stone?0x6E8F5A:0x5A9E3C,0.05),{edge:false});
  }
}
function addAnimal(B,x,z,yaw,cow,cc,dd){
  const o={yaw},c=cc||(cow?0xF2F2F2:0xF0A8A8),d=dd||(cow?0x3A2A22:0xD98888);
  addBox(B,x,0.3,z,0.28,0.26,0.5,c,o); addBox(B,x+Math.sin(yaw)*0.3,0.38,z+Math.cos(yaw)*0.3,0.22,0.22,0.2,c,o);
  [[-0.1,0.18],[0.1,0.18],[-0.1,-0.18],[0.1,-0.18]].forEach(q=>addBox(B,x+q[0]*Math.cos(yaw)+q[1]*Math.sin(yaw),0.09,z-q[0]*Math.sin(yaw)+q[1]*Math.cos(yaw),0.08,0.18,0.08,d,o));
  if(cow) addBox(B,x,0.44,z,0.2,0.04,0.22,d,o);
}
function addBamboo(B,x,z){ for(let i=0;i<5;i++){ const h=1.2+rnd()*1.4,bx=x+(rnd()-0.5)*0.7,bz=z+(rnd()-0.5)*0.7; for(let y=0;y<h;y+=0.3) addBox(B,bx,y+0.15,bz,0.09,0.3,0.09,jit(0x6FBF3A,0.08),{edge:false}); } }
function mcH(x,z){
  if(MCFLAT){
    if(x>0&&x<4&&z<-7&&z>-13) return 0;      /* tanah datar lama (di belakang portal), dibiarkan */
    if(x>10&&x<20&&z>-7.6&&z<3) return RB;   /* tanah dasar peternakan berundak di lereng kanan (kandang diangkat sendiri-sendiri); gunung lain tetap */
    if(x>-8&&x<4&&z>6&&z<13) return 0;       /* strip datar di bawah board untuk mob liar */
  }
  if(x>4.8&&x<9.8&&z>-30) return 0; /* koridor sungai kanan sampai hulu: gunung air mentok di tepi belakang peta */
  if(x>-16.6&&x<-7.4&&z>-4.6&&z<4.6) return 0; /* gunung + sungai kiri di dekat hutan */
  const d=Math.max(Math.abs(x)-8,Math.abs(z)-7); if(d<=0) return 0;
  const n=Math.sin(x*0.22)+Math.cos(z*0.27)+Math.sin((x+z)*0.13)*1.2+0.4;
  return Math.max(0,Math.round(n*Math.min(1,d/14)*3.2)/2);
}
const hAt=(x,z)=>mcH(2*Math.floor(x/2)+1,2*Math.round(z/2));
/* batas pulau World: kolom tanah x dari -ISLXL sampai ISLXR, z dari -ISLZT (atas, sampai gunung air) sampai ISLZB (bawah) (blok pulau 2x2, tepi = batas + 1). ISLZR = batas dekor/sungai di bawah (di luar itu: gunung selatan) */
const ISLXL=22,ISLXR=22,ISLZT=22,ISLZB=18,ISLZR=14; /* bawah: +3 blok besar berbentuk gunung batu (addSouthMountain), z 15..18 */
const snapB=B=>({p:B.pos.length,n:B.nor.length,c:B.col.length,i:B.idx.length,lp:B.lpos.length,lc:B.lcol.length,v:B.n});
const rollB=(B,s)=>{ B.pos.length=s.p; B.nor.length=s.n; B.col.length=s.c; B.idx.length=s.i; B.lpos.length=s.lp; B.lcol.length=s.lc; B.n=s.v; };
function lift(B,fn,h){
  const p0=B.pos.length,l0=B.lpos.length; fn();
  for(let i=p0+1;i<B.pos.length;i+=3) B.pos[i]+=h;
  for(let i=l0+1;i<B.lpos.length;i+=3) B.lpos[i]+=h;
}
/* ===== Rumput ala referensi + pohon / batu / semak dari blok pixel kecil ===== */
const GRASS_REF={h:0.275,s:0.46,l:[0.395,0.425,0.455,0.487,0.52]}; /* s = kejenuhan (naikkan kalau mau lebih cerah seperti referensi); l = 5 nuansa gelap→terang */
function hsl2hex(h,s,l){ const a=s*Math.min(l,1-l),f=n=>{ const k=(n+h*12)%12; return l-a*Math.max(-1,Math.min(k-3,9-k,1)); }; return (Math.round(f(0)*255)<<16)|(Math.round(f(8)*255)<<8)|Math.round(f(4)*255); }
const GRASS_PAL=GRASS_REF.l.map(l=>hsl2hex(GRASS_REF.h,GRASS_REF.s,l));
const sgh=(x,z,k)=>{ const v=Math.sin(x*12.9898+z*78.233+k*37.719)*43758.5453; return v-Math.floor(v); };
function sgn(x,z,k){ const x0=Math.floor(x),z0=Math.floor(z),fx=x-x0,fz=z-z0,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz),a=sgh(x0,z0,k),b=sgh(x0+1,z0,k),c=sgh(x0,z0+1,k),d=sgh(x0+1,z0+1,k); return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz; }
/* ===== Gaya detail pulau melayang (floating-island.js v2) untuk tanah World: palet zaitun/sage alami, tanah & tanah liat bervariasi, lumut menetes.
   Deterministik per koordinat (TIDAK memakai rnd()/lr()), jadi urutan acak dunia tidak bergeser. ===== */
const ISL={grass:[0x6a9440,0x5d8738,0x76a049,0x537c3a],olive:0x86973f,sage:0x5a8452,moss:[0x5a8744,0x4e7a3e],dirt:[0x8b5d3a,0x7d5233,0x96683f,0x6e4a2e],clay:0xa8794a,gravel:0x8c8b90,stone:[0x9a9ca6,0x868a96,0xaeb0b8,0x7c808c],flowers:[0xc97b8a,0xd8b95a,0xdedacc,0x8f84b8,0xc98a4e]};
function islH(a,b,k){ const h=Math.sin(a*127.1+b*311.7+(k||0)*74.7)*43758.5453; return h-Math.floor(h); }
function islGrass(x,z){
  const fx=Math.floor(x),fz=Math.floor(z),patch=islH(Math.floor(x/2),Math.floor(z/2),1),rr=islH(x,z,2);
  const soil=sgn(x/4.2,z/4.2,13); /* tambalan tanah terbuka / tanah liat / kerikil di tengah rumput */
  if(soil>0.8){ const q=islH(x,z,8); return new THREE.Color(q<0.18?ISL.gravel:q<0.4?ISL.clay:ISL.dirt[Math.floor(islH(x,z,9)*4)&3]).offsetHSL(0,0,(islH(x,z,3)-0.5)*0.05); }
  if(soil>0.74&&rr<0.55) return new THREE.Color(ISL.moss[(fx+fz)&1]).offsetHSL(0,0,(islH(x,z,3)-0.5)*0.04); /* tepi tambalan: lumut */
  const hex=patch>0.8?ISL.olive:patch<0.16?ISL.sage:ISL.grass[((fx+fz)&1)?(rr<0.2?2:0):(rr<0.2?3:1)];
  return new THREE.Color(hex).offsetHSL(0,0,(islH(x,z,3)-0.5)*0.03);
}
function islSide(base,hi,x,z){ /* sisi tanah/batu kolom World: tanah coklat bervariasi + tanah liat + kerikil; kolom tinggi = batu abu-kebiruan */
  const rr=islH(x,z,4);
  if(hi) return new THREE.Color(ISL.stone[Math.floor(rr*4)&3]).offsetHSL(0,0,(islH(x,z,5)-0.5)*0.05);
  const hex=rr<0.07?ISL.clay:rr<0.12?ISL.gravel:ISL.dirt[Math.floor(islH(x,z,6)*4)&3];
  return new THREE.Color(hex).offsetHSL(0,0,(islH(x,z,5)-0.5)*0.05);
}
function grassShade(x,z){
  if(themeKey==='minecraft') return islGrass(x,z);
  let v=sgn(x/3.4,z/3.4,5)*0.42+sgn(x/1.4,z/1.4,9)*0.18+sgh(x,z,2)*0.40; /* gerombol besar + sedang + acak per petak */
  v=Math.max(0,Math.min(0.999,(v-0.5)*1.9+0.5));
  return new THREE.Color(GRASS_PAL[Math.floor(v*5)]).offsetHSL(0,0,(sgh(x,z,3)-0.5)*0.012);
}
/* satu muka atas saja (4 vertex) — untuk tambalan rumput, jauh lebih hemat daripada kotak penuh */
function addTopQuad(B,cx,y,cz,sx,sz,color){
  const hx=sx/2,hz=sz/2,base=B.n;
  [[-1,1],[1,1],[1,-1],[-1,-1]].forEach(v=>{ B.pos.push(cx+v[0]*hx,y,cz+v[1]*hz); B.nor.push(0,1,0); B.col.push(color.r,color.g,color.b); });
  B.idx.push(base,base+1,base+2,base,base+2,base+3); B.n+=4;
}
/* isi permukaan size x size dengan tambalan 1x1; sebagian petak dipecah jadi 4 kotak 0.5 */
function grassTile(B,cx,cz,size,y){
  const Q=[[-1,-1],[1,-1],[-1,1],[1,1]];
  if(size>1.01){ const q=size/4; Q.forEach(d=>grassTile(B,cx+d[0]*q,cz+d[1]*q,size/2,y)); return; }
  if(sgh(cx,cz,7)<0.24||themeKey==='minecraft'){ const q=size/4;
    Q.forEach(d=>{ const qx=cx+d[0]*q,qz=cz+d[1]*q,col=grassShade(qx,qz); addTopQuad(B,qx,y,qz,size/2,size/2,col);
      if(themeKey==='minecraft'&&size<=1.01) for(let k=0;k<2;k++){ /* bintik piksel terang/gelap 0.25 (tekstur butiran ala pulau) */
        if(sgh(qx,qz,20+k)>0.42) continue;
        const px=qx+(sgh(qx,qz,22+k)-0.5)*0.25,pz=qz+(sgh(qx,qz,24+k)-0.5)*0.25;
        addTopQuad(B,px,y+0.004,pz,0.25,0.25,col.clone().offsetHSL(0,0,(sgh(qx,qz,26+k)<0.5?-0.045:0.05))); } }); return; }
  addTopQuad(B,cx,y,cz,size,size,grassShade(cx,cz));
}
/* PRNG sendiri untuk dekorasi baru: TIDAK menyentuh rnd()/lr() sehingga letak pohon, rumah, hewan, dll tidak bergeser */
function mkRng(s){ let a=s|0; return ()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function shade(hex,amt,r){ return new THREE.Color(hex).offsetHSL(0,0,(r()-0.5)*amt); }
/* gundukan dari blok kecil (heightmap kubah). Hanya kubus yang terlihat dibuat (sisi yang tertutup tetangga dibuang). Dipakai batu & semak bulat. */
function addDomePix(B,x,z,o,r){
  const u=o.u,w=o.w,d=o.d,pk=o.pk,cxm=(w-1)/2,czm=(d-1)/2,H=[];
  for(let i=0;i<w;i++){ H[i]=[]; for(let j=0;j<d;j++){ const dx=(i-cxm)/(w/2),dz=(j-czm)/(d/2); H[i][j]=Math.max(0,Math.round(pk*(1-(dx*dx+dz*dz)*o.fall)+(r()-0.5)*o.rough)); } }
  H[Math.floor(w/2)][Math.floor(d/2)]=Math.max(H[Math.floor(w/2)][Math.floor(d/2)],pk);
  const hh=(i,j)=>(i<0||j<0||i>=w||j>=d)?0:H[i][j];
  for(let i=0;i<w;i++) for(let j=0;j<d;j++){
    const h=H[i][j]; if(!h) continue;
    const nb=Math.min(hh(i-1,j),hh(i+1,j),hh(i,j-1),hh(i,j+1));
    for(let k=Math.min(nb,h-1);k<h;k++) addBox(B,x+(i-cxm)*u,u*(k+0.5),z+(j-czm)*u,u,u,u,o.color(k,h,pk,r));
  }
  return H;
}
function rockColor(k,h,pk,r){ let c=shade(0x8E8E8E,0.07,r); c.offsetHSL(0,0,Math.min(0.1,k/pk*0.1)+(k===h-1?0.05:0)); if(k===0&&r()<0.07) c=shade(0x6E9A4C,0.1,r); return c; }
function bushColor(k,h,pk,r){ const c=shade(0x3C9A2A,0.1,r); c.offsetHSL(0,0.02,Math.min(0.12,k/pk*0.1)+(k===h-1?0.04:0)); return c; }
function addRockPix(B,x,z,big,r){
  const o=big?{u:0.13,w:5+Math.floor(r()*3),d:4+Math.floor(r()*3),pk:3+Math.floor(r()*3),fall:0.9,rough:1.6,color:rockColor}
             :{u:0.1,w:3+Math.floor(r()*2),d:3,pk:2,fall:0.8,rough:1.0,color:rockColor};
  addDomePix(B,x,z,o,r);
  const np=big?1+Math.floor(r()*3):Math.floor(r()*2); /* kerikil kecil di sekitar */
  for(let i=0;i<np;i++){ const a=r()*6.283,d=o.w*o.u*0.5+0.1+r()*0.25,s=0.07+r()*0.06; addBox(B,x+Math.cos(a)*d,s/2,z+Math.sin(a)*d,s,s,s,shade(0x9A9A9A,0.1,r)); }
  return [o.w*o.u/2+0.12,o.d*o.u/2+0.12];
}
function addBushPix(B,x,z,r){
  const n=5+Math.floor(r()*2),o={u:0.1,w:n,d:n-(r()<0.5?1:0),pk:3,fall:1.0,rough:1.2,color:bushColor},H=addDomePix(B,x,z,o,r);
  if(r()<0.55){ const FL=[0xFFD23F,0xFF7EB6,0xFFFFFF,0x4FB4F0],m=1+Math.floor(r()*3); /* bunga kecil di pucuk semak */
    for(let i=0;i<m;i++){ const a=Math.floor(r()*o.w),b=Math.floor(r()*o.d); if(!H[a][b]) continue; addBox(B,x+(a-(o.w-1)/2)*o.u,o.u*H[a][b]+0.035,z+(b-(o.d-1)/2)*o.u,0.07,0.07,0.07,FL[Math.floor(r()*4)],{edge:false}); } }
}
/* rumpun rumput: bilah tipis dari blok kecil, tengah lebih tinggi (seperti rumpun di gambar referensi) */
function addTuft(B,x,z,s,r){
  const n=8+Math.floor(r()*5),R=0.3*s,G=[0x3E9E2C,0x4FB535,0x66CC3E];
  for(let i=0;i<n;i++){
    const a=r()*6.283,d=Math.sqrt(r())*R,w=(0.065+r()*0.03)*s,h=(0.13+(1-d/R)*0.3+r()*0.1)*s;
    addBox(B,x+Math.cos(a)*d,h/2,z+Math.sin(a)*d,w,h,w,shade(G[Math.min(2,Math.floor(h/s/0.2))],0.08,r),{edge:false});
  }
}
/* sebar batu + semak + rumpun di luar board (tema berumput). Menghindari board, sungai, gunung, peternakan, pertanian, rumah, jalan, dan pohon. */
function addFlowerIsl(B,x,z,r){
  const fh=0.26+r()*0.16,c=ISL.flowers[Math.floor(r()*ISL.flowers.length)];
  addBox(B,x,fh/2,z,0.06,fh,0.06,0x4f7f33,{edge:false});
  addBox(B,x,fh+0.05,z,0.2,0.14,0.2,c,{edge:false});
  addBox(B,x,fh+0.14,z,0.07,0.05,0.07,0xf6e08a,{edge:false});
}
function addMushIsl(B,x,z){
  addBox(B,x,0.1,z,0.13,0.2,0.13,0xe8dcc0,{edge:false});
  addBox(B,x,0.24,z,0.34,0.12,0.34,0xc2503f,{edge:false});
  addBox(B,x+0.08,0.31,z+0.06,0.08,0.03,0.08,0xffffff,{edge:false});
}
function addGrassScenery(DB,th){
  const mc=th.decor==='mc',r=mkRng(0x6A55+THEMES.indexOf(th)*131),placed=th.decor==='mc'?DECOR_SEED.map(a=>a.slice()):[];
  const ok=(x,z,pad)=>{
    if(mc&&(x<-ISLXL+1.5||x>ISLXR-1.5||z<-ISLZT+1.5||z>ISLZR-1.5)) return false; /* pulau World lebih kecil */
    if(Math.abs(x)<6.2&&Math.abs(z)<6.2) return false;                  /* board + pagar */
    if(Math.abs(x-PAD.x)<1.8&&Math.abs(z-PAD.z)<1.8) return false;     /* area start */
    if(x>4.6&&x<10.2&&z>-30) return false;                              /* sungai kanan + jembatan */
    if(x>-17&&x<-7&&z>-5&&z<5) return false;                            /* gunung/sungai kiri */
    if(x>9.6&&x<21&&z>-8.6&&z<4.4) return false;                        /* peternakan */
    if(x>-14&&x<-8&&z>6&&z<12.5) return false;                          /* pertanian */
    if(mc&&x>-8.5&&x<4.8&&z>6&&z<13.5) return false;                    /* zona mob liar di bawah board */
    if(mc&&x>-1.5&&x<5&&z<-5.5&&z>-14) return false;                    /* portal */
    if(penBlocked(x,z)) return false;
    for(let i=0;i<TREEPOS.length;i++){ const t=TREEPOS[i]; if(Math.hypot(x-t[0],z-t[1])<0.8*t[2]+pad) return false; }
    for(let i=0;i<placed.length;i++){ const p=placed[i]; if(Math.hypot(x-p[0],z-p[1])<p[2]+pad) return false; }
    return true;
  };
  const place=(count,tries,pad,build)=>{
    let n=0,t=0;
    while(n<count&&t++<tries){
      const x=(r()-0.5)*62,z=(r()-0.5)*54,dd=Math.hypot(x,z*1.1);
      if(r()>1-0.65*Math.min(1,Math.max(0,(dd-12)/32))) continue;      /* lebih rapat di dekat board, makin jarang ke kejauhan */
      const h=hAt(x,z); if(h>=2.5||!ok(x,z,pad)) continue;
      let rad=pad; lift(DB,()=>{ rad=build(x,z)||pad; },h); placed.push([x,z,rad]); n++;
    }
  };
  place(46,1600,0.5,(x,z)=>{ const big=r()<0.6,hx=addRockPix(DB,x,z,big,r); if(big) blockRect(x,z,hx[0],hx[1]); return Math.max(hx[0],hx[1]); });
  place(40,1600,0.5,(x,z)=>{ addBushPix(DB,x,z,r); return 0.55; });
  place(190,3000,0.3,(x,z)=>{ addTuft(DB,x,z,0.9+r()*0.5,r); return 0.35; });
  if(mc){ /* dekor gaya pulau: bunga warna-warni + jamur (PRNG sendiri, dipanggil setelah dekor lama) */
    place(80,3000,0.28,(x,z)=>{ addFlowerIsl(DB,x,z,r); return 0.28; });
    place(8,800,0.4,(x,z)=>{ addMushIsl(DB,x,z); return 0.4; });
    place(110,3000,0.3,(x,z)=>{ addTuft(DB,x,z,1.1+r()*0.7,r); return 0.35; }); /* jumbai rumput tambahan */
  }
}
/* kotak sisi vertikal 1 muka (normal sumbu dx/dz), dipakai untuk piksel tebing tanah */
function addSideQuad(B,cx,cy,cz,dx,dz,w,hh,color){
  const tx=dz,tz=-dx,hw=w/2,hy=hh/2,base=B.n;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(v=>{ B.pos.push(cx+tx*hw*v[0],cy+hy*v[1],cz+tz*hw*v[0]); B.nor.push(dx,0,dz); B.col.push(color.r,color.g,color.b); });
  B.idx.push(base,base+1,base+2,base,base+2,base+3); B.n+=4;
}
function islDepth(gx,gz){ const c=Math.min(((gx<0?gx+ISLXL:ISLXR-gx))/2,((gz<0?gz+ISLZT:ISLZB-gz))/2); return Math.min(4.4,1.0+c*0.62); }
function addIslUnder(TB){ /* alas pulau: tanah di tepi, makin ke tengah makin dalam & berbatu (melancip seperti pulau melayang) */
  for(let gx=-ISLXL;gx<=ISLXR;gx+=2) for(let gz=-ISLZT;gz<=ISLZB;gz+=2){
    const dp=islDepth(gx,gz),rr=islH(gx,gz,41),edge=dp<1.7;
    const hex=rr<0.05?0xd9a441:rr<0.1?0xb09a78:edge?ISL.dirt[Math.floor(islH(gx,gz,42)*4)&3]:ISL.stone[Math.floor(islH(gx,gz,43)*4)&3];
    addBox(TB,gx,-0.4-dp/2,gz,2,dp,2,new THREE.Color(hex).offsetHSL(0,0,(islH(gx,gz,44)-0.5)*0.06),{edge:false});
  }
}
function addIslCliff(TB,gx,gz,h){
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{
    const ox=gx+d[0]*2,oz=gz+d[1]*2,out=ox<-ISLXL||ox>ISLXR||oz<-ISLZT||oz>ISLZB;
    const nh=out?-0.4-islDepth(gx,gz):mcH(ox,oz); if(nh>=h-0.01) return;
    const rows=Math.max(1,Math.ceil((h-nh)/0.5-0.001));
    for(let sg=0;sg<4;sg++){
      const o=(sg-1.5)*0.5,wx=gx+d[0]*1.025+(d[1]?o:0),wz=gz+d[1]*1.025+(d[0]?o:0);
      /* panjang lumut menetes tiap segmen: 1-2 baris */
      const drip=1+(islH(wx,wz,31)<0.45?1:0);
      for(let rw=0;rw<rows;rw++){
        const y0=h-rw*0.5,hh=Math.min(0.5,y0-nh); if(hh<=0.001) break;
        const cy=y0-hh/2,rr=islH(wx+rw*3.1,wz-rw*1.7,32);
        let hex; if(rw<drip) hex=ISL.moss[(sg+rw)&1];
        else if(rr<0.07) hex=ISL.clay; else if(rr<0.12) hex=ISL.gravel;
        else if((h-rw*0.5<0.7&&h>1.2)||y0-hh<-0.2) hex=ISL.stone[Math.floor(rr*4)&3];
        else hex=ISL.dirt[Math.floor(islH(wx,wz+rw,33)*4)&3];
        const c=new THREE.Color(hex).offsetHSL(0,0,(islH(wx,wz,34+rw)-0.5)*0.06);
        addSideQuad(TB,wx,cy,wz,d[0],d[1],0.5,hh,c);
        if(rr>0.78) addSideQuad(TB,wx+(d[0]?0.004*d[0]:(islH(wx,wz,35)-0.5)*0.2),cy+(islH(wx,wz,36)-0.5)*0.15,wz+(d[1]?0.004*d[1]:(islH(wx,wz,35)-0.5)*0.2),d[0],d[1],0.16,0.16,c.clone().offsetHSL(0,0,rr<0.9?-0.06:0.08)); /* butir piksel */
      }
    }
  });
}
function buildMcTerrain(TB,th){
  const mc=th.key==='minecraft',grassy=mc||th.key==='rumput',G=mc?0x4A8F33:th.ground,W=mc?0x98643B:th.wall[0],S=mc?0x7A7A7A:th.deep[0],M=mc?0x8A8F86:th.deep[1];
  /* rumput di luar board mengikuti gambar referensi: tambalan kotak 5 nuansa hijau (gerombol besar + acak per petak + sesekali kotak 0.5).
     Warna & pola dari grassShade()/grassTile() (deterministik per koordinat, TIDAK memakai rnd() supaya urutan acak dunia tidak bergeser). */
  const BM=UT.Gameplay.Biomes,PK=mc?BM.MC.PK:(BM.PK[th.key]||BM.FALLBACK.PK),R=mc?BM.MC.R:(BM.R[th.key]||BM.FALLBACK.R);
  for(let ix=-7.5;ix<=7.5;ix+=1) for(let iz=-6.5;iz<=6.5;iz+=1){
    if(Math.abs(ix)<5&&Math.abs(iz)<5) continue;
    { const j=jit(G,0.08); /* jit tetap dipanggil agar urutan rnd() sama */
      if(grassy){ addBox(TB,ix,-0.1,iz,1,0.2,1,mc?ISL.grass[1]:GRASS_PAL[2],{edge:false}); }
      else addBox(TB,ix,-0.1,iz,1,0.2,1,j); }
  }
  for(let gx=-ISLXL;gx<=ISLXR;gx+=2) for(let gz=-ISLZT;gz<=ISLZB;gz+=2){
    if(Math.abs(gx)+1<=8&&Math.abs(gz)+1<=7) continue;
    const h=mcH(gx,gz),hi=h>=1.5;
    { const sc=jit(hi?S:W,0.07); /* jit tetap dipanggil agar urutan rnd() sama */
      addBox(TB,gx,(h-0.6)/2,gz,2,h+0.2,2,mc?islSide(sc,hi,gx,gz):sc,{edge:false});
      if(mc) addIslCliff(TB,gx,gz,h); } /* tebing berlapis piksel: lumut menetes, tanah, tanah liat, kerikil, batu */
    { const j=jit(h>=3.5?PK:(h>=2.5?M:G),0.08);
      /* naik 0.02 agar tidak sebidang (z-fighting) dengan rumput 1x1 sekeliling board yang menimpa strip gz=+-7 */
      if(grassy&&h<2.5){ addBox(TB,gx,h-0.08,gz,2,0.2,2,mc?ISL.grass[1]:GRASS_PAL[2],{edge:false}); }
      else addBox(TB,gx,h-0.08,gz,2,0.2,2,j); }
  }
  if(mc) addIslUnder(TB);
  for(let z=7;z<=(mc?ISLZR:28);z+=1) addBox(TB,7+0.5*Math.sin(z*0.7),-0.04,z,1.8+z*0.04,0.16,1,jit(R,0.06),{edge:false});
  /* jembatan kayu melengkung di sungai kanan: di bawah board (z=9, ~3.5 dari tepi board) agar tidak menempel board */
  { const bz=9,bxc=7+0.5*Math.sin(bz*0.7),wr=1.8+bz*0.04,half=wr/2+0.8,x0=bxc-half,x1=bxc+half,len=x1-x0,Wd=1.1,n=Math.round(len/0.36),pw=len/n;
    const dY=i=>0.2+Math.round(Math.sin((i+0.5)/n*Math.PI)*3)*0.05;
    for(let i=0;i<n;i++){ const x=x0+pw*(i+0.5),y=dY(i);
      addBox(TB,x,y,bz,pw*0.94,0.06,Wd,i%2?0x9A6B3A:0xB07A42); /* papan */
      addBox(TB,x,(0.06+y-0.03)/2,bz,pw,y-0.09,Wd-0.3,0x5A3A1E,{edge:false}); /* penopang di bawah papan */
      [-1,1].forEach(sd=>addBox(TB,x,y+0.2,bz+sd*0.5,pw,0.06,0.07,0x6B4423)); /* pagar */
      if(i%3===1) [-1,1].forEach(sd=>addBox(TB,x,y+0.14,bz+sd*0.5,0.09,0.28,0.09,0x5A3A1E));
    }
    /* tiang ujung lebih tinggi + obor */
    [[x0+0.06,0],[x1-0.06,n-1]].forEach(e=>[-1,1].forEach(sd=>{ const y=dY(e[1]); addBox(TB,e[0],y+0.26,bz+sd*0.5,0.13,0.52,0.13,0x4A2F1A); addBox(TB,e[0],y+0.54,bz+sd*0.5,0.18,0.05,0.18,0x2E2E2E); }));
    /* tangga/undakan di kedua tepi */
    [[x0-0.45,0.07],[x0-0.17,0.14],[x1+0.17,0.14],[x1+0.45,0.07]].forEach(st=>addBox(TB,st[0],st[1]/2,bz,0.3,st[1],Wd,0x8A5B33));
    /* pilar batu di tepi air */
    [bxc-wr/2-0.1,bxc+wr/2+0.1].forEach(px=>[-1,1].forEach(sd=>addBox(TB,px,0.14,bz+sd*0.4,0.28,0.36,0.28,0x8A8A8A)));
    addTorch(TB,x0-0.2,0,bz-0.75); addTorch(TB,x0-0.2,0,bz+0.75); addTorch(TB,x1+0.2,0,bz-0.75); addTorch(TB,x1+0.2,0,bz+0.75);
  }
}
const BIO=UT.Gameplay.Biomes.BIO;
function addWideFar(DB,th){
  const d=th.decor,A=({oak:[addOak,addOak],desert:[addCactus,addPalm],snow:[addPine,addPine],jungle:[addJungleTree,addJungleTree],nether:[addNetherTree,addNetherTree]})[d]||[addOak,addOak];
  const NBC=(d==='nether'&&BOARD_CUSTOM); /* papan Nether: pohon ditaruh per biome di darat (addNetherBiomes), bukan acak di atas lava */
  const cnt=NBC?0:(d==='desert'?80:150); let n=0,t=0;
  while(n<cnt&&t++<1500){
    const x=(rnd()-0.5)*64,z=(rnd()-0.5)*56; if(Math.abs(x)<14&&Math.abs(z)<12) continue;
    const sc=0.8+rnd()*0.7,f=rnd()<0.3?A[1]:A[0]; lift(DB,()=>f(DB,x,z,sc),hAt(x,z)); n++;
  }
  [[-13,-10],[12,-12],[16,10],[-15,9],[22,-4]].forEach((q,i)=>lift(DB,()=>{
    if(d==='oak') addMcHouse(DB,q[0],q[1]);
    else if(d==='desert') addPyramid(DB,q[0],q[1],i%2?3:2.2,0.4);
    else if(d==='snow') (i%2?addSnowman:addIgloo)(DB,q[0],q[1]);
    else if(d==='nether') (i%2?addPortal(DB,q[0],q[1],hAt(q[0],q[1])):(NBC&&nOnLava(q[0],q[1],0.5)?0:addPillar(DB,q[0],q[1],3))); /* tiang tidak di atas lava */
    else addCave(DB,q[0],q[1]);
  },hAt(q[0],q[1])));
  [[-13,-10],[12,-12],[16,10],[-15,9],[22,-4]].forEach(q=>{ blockRect(q[0],q[1],2.2,2.2); if(d==='oak') addHouseExtras(DB,q[0],q[1],hAt(q[0],q[1])); });
  if(NBC) addNetherBiomes(DB,th);
  if(d==='nether') [[-20,10,-14],[18,12,-18],[24,9,12]].forEach(g=>addFlyGhast(g[0],g[1],g[2]));
  if(d==='jungle') for(let i=0;i<18;i++){ const x=(rnd()-0.5)*56,z=(rnd()-0.5)*48; if(Math.abs(x)<12&&Math.abs(z)<10) continue; lift(DB,()=>(i%3?addMushroom:addBamboo)(DB,x,z),hAt(x,z)); }
  const pal=BIO[th.key]||BIO.rumput;
  for(let i=0,k=0;i<300&&k<12;i++){
    const x=(rnd()-0.5)*50,z=(rnd()-0.5)*44;
    if(Math.abs(x)<9&&Math.abs(z)<8||hAt(x,z)>0||(x>5&&x<10&&z>-5)||(NBC&&x>-10&&x<14&&z>-10.6&&z<7.2)) continue;
    if(NBC&&k%2===0&&nOnLava(x,z)) continue; /* babi tidak di atas lava */
    const c=pal[k%2],sd=(d==='nether'&&k%2===1); queueAnimal(x,z,rnd()*6.28,k%2===0?'pig':(sd?'strider':'cow'),sd?undefined:c[0],sd?undefined:c[1]); k++; /* nether: sapi diganti Strider */
  }
}
function addMcFar(DB){
  let n=0,t=0;
  while(n<150&&t++<1200){
    const x=(rnd()-0.5)*64,z=(rnd()-0.5)*56;
    if(Math.abs(x)<14&&Math.abs(z)<12) continue;
    const s=0.8+rnd()*0.7;
    if((x>-17&&x<-7.5&&z>-4&&z<4)||(x>4.4&&x<9.8&&z>-30)||(x>9.8&&x<20.4&&z>-8&&z<4)) continue; /* area gunung/sungai + dataran peternakan */
    const sn=snapB(DB); lift(DB,()=>addOak(DB,x,z,s),hAt(x,z)); n++;
    if(themeKey==='minecraft'&&(x<-ISLXL+1.5||x>ISLXR-1.5||z<-ISLZT+1.5||z>ISLZR-1.5)) rollB(DB,sn); /* di luar pulau kecil: buang (rnd sudah terpakai, urutan acak aman) */
  }
  [[-13,-10],[-15,9]].forEach(q=>{ lift(DB,()=>addMcHouse(DB,q[0],q[1]),hAt(q[0],q[1])); addHouseExtras(DB,q[0],q[1],hAt(q[0],q[1])); });
  /* hewan ternak tidak lagi berkeliaran bebas: semuanya tinggal di kandang (lihat addRanch) */
}
/* gunung batu di sisi bawah (selatan) pulau: +3 blok besar (z 15..18), bentuk seperti gunung kiri: batu abu-abu berlumut, tebing tinggi di tepi luar dan turun ke arah board. Tanpa rnd() (deterministik) agar seed dunia tidak bergeser. */
function addSouthMountain(DB){
  const st=[0x7F7F7F,0x777777,0x898989,0x707070,0x8E8E8E],moss=[0x6E8F5A,0x5F8A4A],hs=(a,b)=>{ const v=Math.sin(a*127.1+b*311.7)*43758.5453; return v-Math.floor(v); };
  for(let ix=-ISLXL;ix<=ISLXR+1;ix+=1){
    const x=ix-0.5+0.5, ridge=1+0.45*Math.sin(ix*0.31)+0.3*Math.sin(ix*0.77+1.3); /* punggung bergelombang: puncak + lembah */
    for(let jz=0;jz<3;jz++){
      const z=15.5+jz,u=(jz+1)/3,base=hAt(x,z);
      const hgt=Math.max(1,Math.round((0.8+u*u*3.6*ridge+(hs(ix,jz)-0.5)*0.9)*2)/2); /* makin ke tepi luar makin tinggi (tebing) */
      const top=base+hgt,q=Math.floor(hs(ix+3,jz+7)*5)%5;
      addBox(DB,x,(top-0.1)/2,z,1,top+0.1,1,st[q],{edge:false});
      if(hs(ix+9,jz+2)<0.3) addBox(DB,x,top+0.04,z,1,0.08,1,moss[(ix+jz)&1],{edge:false}); /* lumut di puncak */
    }
  }
}
function addMcEnv(DB){
  addMcFar(DB);
  addSouthMountain(DB);
  /* gunung hulu dimundurkan: kiri ke arah hutan, kanan ke belakang (utara). Sungai menyambung tanpa celah dari hulu sampai terrain z>=7. */
  /* sisi kiri: bukan sungai/gunung lagi, diganti pertanian kedua (lahan datar, lihat mcH) */
  blockRect(-11.6+MT_SHIFT,-0.2,3.2,3.5); /* area kiri board = gunung batu penutup Dragon Arena (Feature 2; dulu farm) — dekorasi/hewan tidak masuk */
  cascadeHill(DB,'s',-22.9,-20.5,5.2,8.8,false,2); /* tinggi 2x; gunung air mentok di tepi belakang pulau */
  for(let z=-20.0;z<=6.0;z+=1){ addBox(DB,7+0.5*Math.sin(z*0.7),-0.04,z,1.6,0.16,1,jit(0x3F76E4,0.06),{edge:false}); waterDetail(DB,7+0.5*Math.sin(z*0.7),z,0.04,1.6,1,Math.round(z*4)+100,4,3); } /* menutup -8.5..6.5; terrain mulai 6.5 */
  const blocked=(x,z)=>(Math.abs(x)<5.4&&Math.abs(z)<5.4)||(Math.abs(x-PAD.x)<1.4&&Math.abs(z-PAD.z)<1.4)||(x>5.3&&z<-4.5)||(x>6&&x<8.1&&z>-9)||(z<-5.5&&x>-6.4&&x<2)||(Math.abs(x+6.9)<1.2&&Math.abs(z+3.6)<1.2)||(Math.abs(x-4.2)<1.2&&Math.abs(z+6.3)<1.2);
  item(-6.9,-3.6,1.6,1.3,b=>addMcHouse(b,-6.9,-3.6)); item(4.2,-6.3,1.6,1.3,b=>addMcHouse(b,4.2,-6.3));
  item(0.2,-6.4,2.3,1.4,b=>addPortal(b,0.2,-6.4));
  blockRect(PAD.x,PAD.z,1.3,1.3); blockRect(0.2,-6.4,1.3,1.0);
  addHouseExtras(DB,-6.9,-3.6,0); addHouseExtras(DB,4.2,-6.3,0);
  addFarm(DB);
  /* hewan dekat board dihapus -> pindah ke kandang (addRanch) */
  queueAnimal(-6.9,-2.0,0.4,'villager'); queueAnimal(5.85,2.2,Math.PI/2,'fisher'); /* villager kanan: di luar board, memancing di tepi sungai */
  const FL=[]; DECOR_SEED.length=0;
  for(let i=0;i<90;i++){
    const x=(rnd()*15)-7.5,z=(rnd()*13)-6.5; if(blocked(x,z)||Math.abs(x-7)<1) continue;
    FL.push([x,z,pick([0xF0453A,0xFFD23F,0xFFFFFF,0xFF7EB6,0x6AA8FF,0xB066FF])]); /* rnd tetap sama; dipasang setelah kandang/pohon ada */
  }
  addRanch(DB); /* kandang ternak + pohon + lebah (di kaki gunung kanan) & mob liar di bawah */
  /* Bunga kecil: buang yang bentrok dengan benda (kandang/pagar, pohon, villager/pemancing) atau bunga lain yang terlalu dekat */
  FL.forEach(f=>{
    const x=f[0],z=f[1];
    if(penBlocked(x,z)) return;
    if(TREEPOS.some(t=>Math.hypot(x-t[0],z-t[1])<0.8*t[2]+0.15)) return;
    if([[-6.9,-2.0],[5.85,2.2]].some(a=>Math.hypot(x-a[0],z-a[1])<0.5)) return;
    if(DECOR_SEED.some(k=>Math.hypot(x-k[0],z-k[1])<0.22)) return;
    DECOR_SEED.push([x,z,0.16]);
    addBox(DB,x,0.07,z,0.14,0.14,0.14,f[2],{edge:false});
  });
  addGrassScenery(DB,theme); /* batu + semak + rumpun pixel kecil di luar board */
}
function tileColor(n,t,th){
  if(n===GOAL) return th.goalTile;
  if(LADDERS[n]) return th.ladderTile;
  if(SNAKES[n]) return th.snakeTile;
  return ((t.col+t.row)%2===0)?th.tileA:th.tileB;
}

/* dekorasi */
/* Pohon gaya referensi: batang pendek + kanopi rumpun kubus berukuran beragam. Variasi memakai mkRng (hash posisi);
   burnOakRnd() menghabiskan rnd() persis seperti versi lama supaya letak pohon/rumah/hewan lain tidak bergeser. */
function burnOakRnd(){
  for(let i=0;i<3;i++) rnd();
  for(let ly=0;ly<3;ly++) for(let ix=-1;ix<=1;ix++) for(let iz=-1;iz<=1;iz++){
    if(ly===2&&Math.abs(ix)+Math.abs(iz)>1) continue;
    if(ly===1&&Math.abs(ix)===1&&Math.abs(iz)===1&&rnd()<0.4) continue;
    rnd();
  }
}
function addOak(DB,x,z,s){
  burnOakRnd(); TREEPOS.push([x,z,s]);
  const r=mkRng((Math.floor(x*977)^Math.floor(z*1553)^0x9E3779B9)|0),c=0.58*s,tr=0.7*s,F=0x4FBF3A;
  [0,1].forEach(i=>addBox(DB,x,tr*(i+0.5)/2,z,0.34*s,tr/2,0.34*s,shade(0x7A4F2A,0.1,r)));
  const y0=tr*0.82;
  const put=(dx,dy,dz,sz,dl)=>addBox(DB,x+dx*c+(r()-0.5)*0.14*s,y0+dy+sz/2,z+dz*c+(r()-0.5)*0.14*s,sz,sz,sz,shade(F,0.12,r).offsetHSL(0,0,dl));
  for(let ix=-1;ix<=1;ix++) for(let iz=-1;iz<=1;iz++){ if(ix&&iz&&r()<0.35) continue; put(ix,0,iz,c*(0.86+r()*0.28),-0.04); }
  [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(q=>put(q[0]*0.8,c*0.78,q[1]*0.8,c*(0.78+r()*0.24),0));
  put(0,c*1.5,0,c*0.7,0.04); if(r()<0.6) put((r()-0.5)*1.2,c*1.45,(r()-0.5)*1.2,c*0.5,0.05);
  for(let i=0;i<3;i++){ const a=r()*6.283; put(Math.cos(a)*1.25,-c*0.05,Math.sin(a)*1.25,c*0.4,-0.06); } /* kubus kecil di tepi kanopi */
}
function addCactus(DB,x,z,s){
  const u=0.3*s,g=0x3FA64A;
  for(let i=0;i<5;i++) addBox(DB,x,u*(i+0.5),z,u,u,u,jit(g,0.08));
  addBox(DB,x+u,u*2.5,z,u,u,u,jit(g,0.08)); addBox(DB,x+u,u*3.5,z,u,u,u,jit(g,0.08));
  addBox(DB,x-u,u*1.5,z,u,u,u,jit(g,0.08)); addBox(DB,x-u,u*2.5,z,u,u,u,jit(g,0.08));
  addBox(DB,x,u*5.15,z,u*0.5,u*0.3,u*0.5,0xFF7EB6,{edge:false});
}
function addPalm(DB,x,z,s){
  const u=0.34*s;
  for(let i=0;i<6;i++) addBox(DB,x+0.04*i*s,u*(i+0.5),z,u*0.9,u,u*0.9,jit(0x9A6A3B,0.08));
  const tx=x+0.24*s,ty=u*6;
  addBox(DB,tx,ty+0.05,z,u,u*0.6,u,jit(0x3FA64A,0.08));
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{
    for(let j=1;j<=3;j++) addBox(DB,tx+d[0]*u*j*0.95,ty+0.1-0.06*j*j*0.5,z+d[1]*u*j*0.95,u*(d[0]?1:0.5),u*0.28,u*(d[1]?1:0.5),jit(j<3?0x3FA64A:0x2E8B3E,0.1));
  });
}
function addPyramid(DB,x,z,base,layerH){
  let i=0;
  for(let size=base;size>0.5;size-=0.6,i++){
    addBox(DB,x,layerH*(i+0.5),z,size,layerH,size,jit(i%2?0xF1C970:0xE8B85E,0.06));
  }
  addBox(DB,x,layerH*0.5,z+base/2+0.02,0.5,layerH*0.9,0.06,0x5A3A18,{edge:false});
}
function addPine(DB,x,z,s){
  for(let i=0;i<2;i++) addBox(DB,x,0.15*s+0.3*s*i,z,0.3*s,0.3*s,0.3*s,jit(0x7A4F26,0.08));
  [[1.8,0.55],[1.3,1.0],[0.8,1.45]].forEach(t=>{
    const w=t[0]*s;
    addBox(DB,x,t[1]*s+0.1*s,z,w,0.45*s,w,jit(0x2E8B57,0.1));
    addBox(DB,x,t[1]*s+0.34*s,z,w*0.96,0.1*s,w*0.96,0xFFFFFF,{edge:false});
  });
  addBox(DB,x,1.95*s,z,0.3*s,0.3*s,0.3*s,0xFFFFFF);
}
function addSnowman(DB,x,z){
  addBox(DB,x,0.45,z,0.9,0.9,0.9,0xFFFFFF);
  addBox(DB,x,1.25,z,0.7,0.7,0.7,0xFFFFFF);
  addBox(DB,x,1.85,z,0.5,0.5,0.5,0xFFFFFF);
  addBox(DB,x,1.85,z+0.3,0.08,0.08,0.3,0xFF8A2B,{edge:false});
  addBox(DB,x-0.12,1.95,z+0.26,0.06,0.06,0.04,0x15202B,{edge:false});
  addBox(DB,x+0.12,1.95,z+0.26,0.06,0.06,0.04,0x15202B,{edge:false});
  addBox(DB,x,2.12,z,0.56,0.1,0.56,0xE53935); addBox(DB,x,2.3,z,0.36,0.28,0.36,0xE53935);
  addBox(DB,x-0.55,1.3,z,0.5,0.06,0.06,0x7A4F26,{edge:false});
  addBox(DB,x+0.55,1.3,z,0.5,0.06,0.06,0x7A4F26,{edge:false});
}
function addIgloo(DB,x,z){
  const R=[2.6,2.3,1.7,0.9];
  for(let ly=0;ly<4;ly++){
    for(let ix=-3;ix<=3;ix++){
      for(let iz=-3;iz<=3;iz++){
        if(Math.hypot(ix,iz)>R[ly]*0.9) continue;
        if(ly<2&&Math.abs(ix)<=0&&iz>=1) continue;
        addBox(DB,x+ix*0.5,0.25+ly*0.5,z+iz*0.5,0.5,0.5,0.5,jit(0xE6F7FF,0.06));
      }
    }
  }
  addBox(DB,x,0.5,z+1.1,0.5,1.0,0.5,0x2A5F80,{edge:false});
}
function addJungleTree(DB,x,z,s){
  const u=0.55*s;
  for(let i=0;i<5;i++) addBox(DB,x,u*(i+0.5),z,0.5*s,u,0.5*s,jit(0x6B4423,0.08));
  const y0=u*5;
  [[5,0],[3,1],[1,2]].forEach(L=>{
    const n=L[0];
    for(let ix=0;ix<n;ix++) for(let iz=0;iz<n;iz++){
      if(n===5&&(ix%4===0)&&(iz%4===0)) continue;
      addBox(DB,x+(ix-(n-1)/2)*u,y0+u*(L[1]+0.5),z+(iz-(n-1)/2)*u,u,u,u,jit(L[1]===2?0x35B25B:0x1E8A45,0.12));
    }
  });
  for(let i=0;i<3;i++) addBox(DB,x+(i-1)*u*1.9,y0-u*0.9,z+u*2.2,0.12,u*1.6,0.12,jit(0x2E9E58,0.1),{edge:false});
}
function addCave(DB,x,z){
  addBox(DB,x,0.9,z-0.4,2.2,1.8,0.3,0x0B1511,{edge:false});
  addBox(DB,x-1.2,0.9,z,0.6,1.8,0.9,jit(0x7C8C86,0.08)); addBox(DB,x+1.2,0.9,z,0.6,1.8,0.9,jit(0x7C8C86,0.08));
  addBox(DB,x,2.0,z,3.0,0.6,0.9,jit(0x8B9A94,0.08));
  addBox(DB,x-0.3,1.0,z-0.2,0.2,0.2,0.1,0xFFE14D,{edge:false});
  addBox(DB,x+0.3,1.0,z-0.2,0.2,0.2,0.1,0xFFE14D,{edge:false});
}
function addMushroom(DB,x,z){
  addBox(DB,x,0.1,z,0.12,0.2,0.12,0xFFF4E0,{edge:false});
  addBox(DB,x,0.25,z,0.34,0.12,0.34,0xE53935,{edge:false});
  addBox(DB,x,0.32,z,0.1,0.04,0.1,0xFFFFFF,{edge:false});
}
function addChest(B,x,y,z){ addBox(B,x,y+0.07,z,0.22,0.14,0.16,0xA8742E); addBox(B,x,y+0.17,z,0.22,0.06,0.16,0x7A4E1C); addBox(B,x,y+0.12,z+0.085,0.05,0.06,0.02,0xFFD23A,{edge:false}); }
function decorate(DB,th){
  if(th.decor==='mc'){ addMcEnv(DB); return; }
  addWideFar(DB,th);
  const spots=[[6.5,4.5],[7,1.5],[6.4,-2.5],[7,-5.5],[-6.8,-0.8],[-7,-5.8],[6.8,6],[-2.8,6.2],[3.5,6.4],[0.5,-6.2],[-3.5,-6.4],[5.5,-6.3],[-7,2.2]];
  if(th.decor==='oak'){
    const FL=[0xF0453A,0xFFD23F,0xFFFFFF,0xFF7EB6];
    for(let i=0;i<46;i++){
      const x=(rnd()*15)-7.5,z=(rnd()*13)-6.5;
      if(Math.abs(x)<5.2&&Math.abs(z)<5.2) continue;
      if(Math.abs(x-PAD.x)<1.3&&Math.abs(z-PAD.z)<1.3) continue;
      addBox(DB,x,0.07,z,0.14,0.14,0.14,pick(FL),{edge:false});
    }
    addGrassScenery(DB,th); /* batu + semak + rumpun pixel kecil di luar board */
  }else if(th.decor==='desert'){
    item(6.6,-4.2,1.6,1.8,b=>addPyramid(b,6.6,-4.2,2.6,0.4)); item(-6.6,-5.6,1.6,1.5,b=>addPyramid(b,-6.6,-5.6,2.0,0.4));
    for(let i=0;i<30;i++){
      const x=(rnd()*15)-7.5,z=(rnd()*13)-6.5;
      if(Math.abs(x)<5.2&&Math.abs(z)<5.2) continue;
      if(Math.abs(x-PAD.x)<1.3&&Math.abs(z-PAD.z)<1.3) continue;
      addBox(DB,x,0.09,z,0.18,0.18,0.18,jit(0xC98E4A,0.1),{edge:false});
    }
  }else if(th.decor==='snow'){
    item(-6.5,-3.2,2.2,2.0,b=>addIgloo(b,-6.5,-3.2)); item(6.6,3.6,2.5,0.9,b=>addSnowman(b,6.6,3.6)); item(-6.4,5.6,2.5,0.9,b=>addSnowman(b,-6.4,5.6));
  }else if(th.decor==='nether'){
    item(-6.4,-3.4,2.2,1.4,b=>addPortal(b,-6.4,-3.4));
    for(let i=0;i<26;i++){
      const x=(rnd()*15)-7.5,z=(rnd()*13)-6.5;
      if(Math.abs(x)<5.2&&Math.abs(z)<5.2) continue;
      if(Math.abs(x-PAD.x)<1.3&&Math.abs(z-PAD.z)<1.3) continue;
      addBox(DB,x,0.1,z,0.2,0.2,0.2,jit(0xFFD76A,0.1),{edge:false});
    }
  }else{
    item(-6.3,-3.4,2.4,1.8,b=>addCave(b,-6.3,-3.4));
    for(let i=0;i<14;i++){
      const x=(rnd()*15)-7.5,z=(rnd()*13)-6.5;
      if(Math.abs(x)<5.2&&Math.abs(z)<5.2) continue;
      if(Math.abs(x-PAD.x)<1.3&&Math.abs(z-PAD.z)<1.3) continue;
      addMushroom(DB,x,z);
    }
  }
}

function makeCloud(th,x,y,z,s){
  const b=makeBatch(),n=5+Math.floor(rnd()*4),cc=new THREE.Color(th.cloud);
  for(let i=0;i<n;i++){
    const c=cc.clone(); c.offsetHSL(0,0,-rnd()*0.05);
    addBox(b,(i-n/2)*1.3+(rnd()-0.5)*0.6,(rnd()-0.5)*0.5,(rnd()-0.5)*1.2,1.6+rnd()*1.6,0.8+rnd()*0.4,1.4+rnd(),c,{edge:false});
  }
  const g=fadeable(sky,b,x,y,z,3.2*s,{cast:false,receive:false,follow:true,base:0.9});
  g.position.set(x,y,z); g.scale.setScalar(s);
  clouds.push({g,speed:0.18+rnd()*0.22});
}

/* tangga: mengikuti lintasan yang diangkat di atas blok/teras yang menghalangi (mis. petak 21 dan 40), dengan tiang penyangga */
function buildLadders(th){
  const out={},LB=makeBatch();
  Object.keys(LADDERS).forEach(key=>{
    const from=+key,to=LADDERS[key],A=TILES[from],B=TILES[to];
    const dx=B.x-A.x,dz=B.z-A.z,dy=B.h-A.h,hl=Math.hypot(dx,dz)||1;
    const N=Math.max(8,Math.round(hl/0.3)),P=[];
    for(let i=0;i<=N;i++){
      const t=i/N,x=A.x+dx*t,z=A.z+dz*t,base=A.h+dy*t;
      P.push({x,z,y:(i>0&&i<N)?Math.max(base,topAt(x,z,0.34)+0.14):base});
    }
    for(let i=1;i<N;i++) P[i].y=Math.max(P[i].y,P[i-1].y-0.2);
    for(let i=N-1;i>=1;i--) P[i].y=Math.max(P[i].y,P[i+1].y-0.2);
    const sgx=-dz/hl,sgz=dx/hl,seg=[],cum=[0];
    for(let i=0;i<N;i++){
      const F=[P[i].x,P[i].y,P[i].z],T=[P[i+1].x,P[i+1].y,P[i+1].z];
      const d=[T[0]-F[0],T[1]-F[1],T[2]-F[2]],L=Math.hypot(d[0],d[1],d[2]);
      const dn=[d[0]/L,d[1]/L,d[2]/L],hz=Math.hypot(dn[0],dn[2])||1;
      const s=[-dn[2]/hz,0,dn[0]/hz];
      const n=[s[1]*dn[2]-s[2]*dn[1],s[2]*dn[0]-s[0]*dn[2],s[0]*dn[1]-s[1]*dn[0]];
      const M=[F[0]+d[0]/2,F[1]+d[1]/2,F[2]+d[2]/2];
      seg.push({F,dn,s,n,L}); cum.push(cum[i]+L);
      [-1,1].forEach(sd=>{
        addOBox(LB,[M[0]+s[0]*0.25*sd,M[1],M[2]+s[2]*0.25*sd],
          [dn[0]*(L/2+0.06),dn[1]*(L/2+0.06),dn[2]*(L/2+0.06)],[s[0]*0.05,0,s[2]*0.05],[n[0]*0.045,n[1]*0.045,n[2]*0.045],jit(th.rail,0.06));
      });
    }
    const total=cum[N];
    for(let t=0.1,k=0;t<=total-0.08;t+=0.17){
      while(k<N-1&&t>cum[k+1]) k++;
      const sg=seg[k],u=t-cum[k],Q=[sg.F[0]+sg.dn[0]*u,sg.F[1]+sg.dn[1]*u,sg.F[2]+sg.dn[2]*u];
      addOBox(LB,Q,[sg.s[0]*0.25,0,sg.s[2]*0.25],[sg.dn[0]*0.035,sg.dn[1]*0.035,sg.dn[2]*0.035],[sg.n[0]*0.035,sg.n[1]*0.035,sg.n[2]*0.035],jit(th.rung,0.08));
    }
    /* tiang penyangga di bagian yang melayang di atas tanah */
    for(let i=2;i<N-1;i+=3){
      const gy=topAt(P[i].x,P[i].z,0.12),hgt=P[i].y-0.05-gy;
      if(hgt>0.3) [-1,1].forEach(sd=>addBox(LB,P[i].x+sgx*0.25*sd,gy+hgt/2,P[i].z+sgz*0.25*sd,0.06,hgt,0.06,jit(th.rail,0.06),{edge:false}));
    }
    const path=P.map(p=>new THREE.Vector3(p.x,p.y+0.08,p.z));
    out[from]={p1:path[0].clone(),p2:path[N].clone(),path};
  });
  world.add(buildBatch(LB));
  return out;
}

/* kepala ular dengan rahang bawah yang bisa membuka */
function makeSnakeHead(pal){
  const up=makeBatch(),jw=makeBatch(),dark=new THREE.Color(pal[0]).multiplyScalar(0.62);
  addBox(up,0,0.08,0,0.6,0.28,0.62,pal[0]);
  addBox(up,0,0.23,-0.08,0.3,0.04,0.34,pal[1],{edge:false});
  [-1,1].forEach(sd=>{
    addBox(up,0.16*sd,0.2,0.18,0.17,0.14,0.17,0xFFFFFF,{edgeK:0.35});
    addBox(up,0.16*sd,0.27,0.23,0.08,0.04,0.08,0x15202B,{edge:false});
    addBox(up,0.16*sd,0.3,0.15,0.2,0.04,0.14,dark,{edge:false});
    addBox(up,0.17*sd,-0.12,0.27,0.06,0.14,0.06,0xFFFFFF,{edge:false});
  });
  addBox(up,0,-0.075,0,0.5,0.03,0.52,0xB3202A,{edge:false});
  addBox(jw,0,-0.03,0.28,0.54,0.1,0.56,new THREE.Color(pal[0]).multiplyScalar(0.9));
  [-1,1].forEach(sd=>addBox(jw,0.17*sd,0.04,0.45,0.05,0.08,0.05,0xFFFFFF,{edge:false}));
  const tg=new THREE.Group();
  const tb=makeBatch();
  addBox(tb,0,0.025,0.4,0.08,0.02,0.3,0xE53935,{edge:false});
  addBox(tb,-0.04,0.025,0.58,0.04,0.02,0.12,0xE53935,{edge:false});
  addBox(tb,0.04,0.025,0.58,0.04,0.02,0.12,0xE53935,{edge:false});
  tg.add(buildBatch(tb,{cast:false}));
  const head=new THREE.Group(); head.rotation.order='YXZ'; head.scale.setScalar(0.6); /* kepala diperkecil agar seukuran badan */
  head.add(buildBatch(up));
  const jaw=new THREE.Group(); jaw.position.set(0,-0.1,-0.28);
  jaw.add(buildBatch(jw)); jaw.add(tg);
  tg.position.set(0,0,0);
  head.add(jaw);
  return {head,jaw,tongue:tg};
}

/* ular: tubuh meliuk menuruni teras, kepala di atas petak */
const SNAKE_HEAD_SCALE=0.5; /* kepala ular lebih kecil dari badan-scale */
const SNAKE_SCALE=0.7; /* ukuran ular (badan + kepala) relatif ke ukuran lama */
function buildSnakes(th){
  const out={},SB=makeBatch(),dyn=new THREE.Group();
  let si=0;
  Object.keys(SNAKES).forEach(key=>{
    const head=+key,tail=SNAKES[key],H=TILES[head],Tt=TILES[tail],pal=th.snakes[si++%th.snakes.length];
    const dx=Tt.x-H.x,dz=Tt.z-H.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,px=-uz,pz=ux;
    const N=Math.round(len*9),yH=H.h+0.34,yT=Tt.h+0.2,kw=Math.max(1,Math.round(len/1.7));
    const pts=[];
    for(let i=0;i<=N;i++){
      const t=i/N,dd=t*len;
      const wob=0.33*Math.pow(Math.sin(Math.PI*t),0.8)*Math.sin(t*Math.PI*2*kw);
      const x=H.x+dx*t+px*wob,z=H.z+dz*t+pz*wob;
      const u=Math.min(1,Math.max(0,(dd-0.6)/Math.max(0.5,len-0.6)));
      const s=(0.32-0.17*t)*SNAKE_SCALE;
      let y=yT+(yH-yT)*Math.pow(1-u,1.25);
      y=Math.max(y,topAt(x,z,s*0.5)+0.08+s/2);
      pts.push({x,y,z,s});
    }
    for(let i=1;i<=N;i++) pts[i].y=Math.max(pts[i].y,pts[i-1].y-0.08);
    for(let i=N-1;i>=0;i--) pts[i].y=Math.max(pts[i].y,pts[i+1].y-0.08);
    pts.forEach((p,i)=>{
      const acc=Math.floor(i/4)%3===2;
      addBox(SB,p.x,p.y,p.z,p.s,p.s,p.s,jit(acc?pal[1]:pal[0],0.05));
    });
    const fx=-ux,fz=-uz,yaw=Math.atan2(fx,fz);
    const hd=makeSnakeHead(pal);
    hd.head.position.set(H.x,yH,H.z); hd.head.rotation.y=yaw; hd.head.scale.setScalar(SNAKE_HEAD_SCALE);
    dyn.add(hd.head);
    const bridge=[];
    const bm=new THREE.MeshLambertMaterial({color:pal[0]}),bg=new THREE.BoxGeometry(0.2,0.2,0.2);
    for(let i=0;i<3;i++){ const m=new THREE.Mesh(bg,bm); m.castShadow=true; m.visible=false; dyn.add(m); bridge.push(m); }
    out[head]={
      path:pts,head:hd.head,jaw:hd.jaw,tongue:hd.tongue,bridge,busy:false,phase:rnd()*6,
      rest:{x:H.x,y:yH,z:H.z},neckTopY:yH,f:[fx,fz],
      bitePos:new THREE.Vector3(H.x+fx*0.42,H.h,H.z+fz*0.42)
    };
  });
  world.add(buildBatch(SB));
  world.add(dyn);
  return out;
}

/* angka petak */
function labelTexture(text,w,h,fs,fill,line){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const g=cv.getContext('2d');
  g.textAlign='center'; g.textBaseline='middle'; g.lineJoin='round';
  g.font='700 '+fs+'px Silkscreen, monospace';
  g.lineWidth=fs*0.2; g.strokeStyle=line; g.strokeText(text,w/2,h/2+fs*0.04);
  g.fillStyle=fill; g.fillText(text,w/2,h/2+fs*0.04);
  const tex=new THREE.CanvasTexture(cv);
  tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy()||1);
  return tex;
}
function buildLabels(th){
  const geo=new THREE.PlaneGeometry(0.72,0.72); /* nomor petak 1.2x (0.6 -> 0.72) */
  for(let n=1;n<=GOAL;n++){
    const t=TILES[n];
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:labelTexture(String(n),128,128,n>=100?40:54,th.label,th.labelLine),transparent:true,depthWrite:false,fog:false})); /* fog:false: nomor tidak ikut memudar jadi warna langit saat kamera jauh */
    m.rotation.x=-Math.PI/2; m.position.set(t.x,t.h+0.012,t.z); m.renderOrder=2;
    world.add(m);
  }
  const st=new THREE.Mesh(new THREE.PlaneGeometry(1.8,0.45),new THREE.MeshBasicMaterial({map:labelTexture('START',256,64,40,th.label,th.labelLine),transparent:true,depthWrite:false,fog:false}));
  st.rotation.x=-Math.PI/2; st.position.set(PAD.x,0.012,PAD.z+1.5); st.renderOrder=2;
  world.add(st);
}
const fontReady=(document.fonts&&document.fonts.load)
  ?Promise.race([document.fonts.load('700 40px Silkscreen'),new Promise(r=>setTimeout(r,2500))]).catch(()=>{})
  :Promise.resolve();

let night=false,nightObjs=[],torchMeshes=[],skyStars=null;
const PHASE_SEC=12*60;                         /* mode auto: tiap fase siang/malam 12 menit */
let autoDN=false,phaseT=0;
try{ autoDN=UT.Prefs.get('autoDN',false)===true; }catch(e){}
const skyDome=new THREE.Group(); scene.add(skyDome); /* ikut posisi kamera, jadi bintang/bulan selalu 'tak terhingga jauh' */
/* SINKRON dengan Pengaturan > Suasana (PlayerData.settings().ambience: day | night | system; cermin di UT.Prefs 'ambience'): itulah sumber siang/malam saat game dibuka. Kunci lama 'night' hanya cadangan bila Suasana belum ada. */
function ambienceNight(){
  try{
    let m=null; const PD=window.PlayerData; if(PD&&PD.settings) m=(PD.settings()||{}).ambience;
    if(m!=='day'&&m!=='night'&&m!=='system'){ const a=UT.Prefs.get('ambience',null); m=a&&a.mode; }
    if(m==='night') return true; if(m==='day') return false;
    if(m==='system') return !!(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  }catch(e){}
  return null;
}
function ambienceWrite(v){ try{ const PD=window.PlayerData; if(PD&&PD.setSettings) PD.setSettings({ambience:v?'night':'day'}); }catch(e){} } /* ubah manual di game -> Pengaturan & lobby ikut */
try{ const an=ambienceNight(); night=(an===null)?(UT.Prefs.get('night',false)===true):an; }catch(e){}
const mixHex=(a,b,k)=>'#'+new THREE.Color(a).lerp(new THREE.Color(b),k).getHexString();
/* corak petak (4x4 blok): hanya 2 warna utama per petak = border (12 blok) lebih gelap + tengah (4 blok) sedikit lebih terang. Warna dasar petak tetap dari tileBlock(). */
function tileShade(bc,n,t,i,j,themeKey){
  const k=(n===GOAL||LADDERS[n]||SNAKES[n]||mobOn(n,themeKey))?0.6:1;
  const ring=(i===0||i===4||j===0||j===4);
  const d=ring?-0.06:0.03;
  const c=new THREE.Color(bc); c.offsetHSL(0,0,d*k); return c;
}
function tileBlock(n,t,th){
  if(n===GOAL) return th.goalTile;
  if(mobOn(n,th.key)) return MOBCOL[mobOn(n,th.key)];
  if(LADDERS[n]) return th.ladderTile;
  if(SNAKES[n]) return th.snakeTile;
  const r=rnd(); if(t.bio&&NI_TILE[t.bio]) return r<0.5?NI_TILE[t.bio][1]:NI_TILE[t.bio][0]; /* papan Nether: warna petak per biome */
  return r<0.22?th.wall[0]:(r<0.6?th.tileB:th.tileA);
}
function updateNightUI(){
  $('btnNight').textContent='Mode: '+(autoDN?'Auto · ':'')+(night?'Malam':'Siang');
  if($('nDay')) $('nDay').setAttribute('aria-pressed',String(!night));
  if($('nNight')) $('nNight').setAttribute('aria-pressed',String(night));
}
function applyLook(th){
  const rs=document.documentElement.style;
  document.body.classList.toggle('th-nether',th.key==='nether'); /* HUD ikut warna Nether (CSS body.th-nether) */
  document.body.classList.toggle('th-world',th.key==='minecraft'); /* HUD ikut warna World: daun + kayu (CSS body.th-world) */
  const top=night?mixHex(th.skyTop,'#060a22',0.9):th.skyTop,bot=night?mixHex(th.skyBot,'#1c2a5e',0.82):th.skyBot;
  rs.setProperty('--sky-top',top); rs.setProperty('--sky-bot',bot);
  rs.setProperty('--hud-bg',mixHex(th.wall[0],'#000000',night?0.86:0.78)); rs.setProperty('--hud-edge',mixHex(th.wall[0],'#ffffff',night?0.02:0.12)); rs.setProperty('--ttl',th.sw[0]);
  hemi.color.setHex(night?0x8FA6FF:0xFFFFFF); hemi.intensity=night?0.5:(th.key==='minecraft'?0.72:0.84); hemi.groundColor.setHex(night?0x1A2340:th.hemi);
  sun.color.setHex(night?0xA9BCFF:0xFFFFFF); sun.intensity=night?0.42:(th.key==='minecraft'?0.56:0.64);
  scene.fog=new THREE.Fog(new THREE.Color(bot),night?38:32,night?80:64);
  nightObjs.forEach(o=>{ skyDome.remove(o); if(o.geometry) o.geometry.dispose(); }); nightObjs=[]; skyStars=null;
  if(night){
    const cnt=900,arr=new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){ const a=Math.random()*Math.PI*2,e=0.03+Math.pow(Math.random(),0.8)*1.35,r=110; arr[i*3]=Math.cos(a)*Math.cos(e)*r; arr[i*3+1]=Math.sin(e)*r; arr[i*3+2]=Math.sin(a)*Math.cos(e)*r; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(arr,3));
    const st=new THREE.Points(g,new THREE.PointsMaterial({color:0xFFFFFF,size:2.6,sizeAttenuation:false,fog:false,transparent:true}));
    st.frustumCulled=false; skyStars=st;
    const moon=new THREE.Group(); moon.position.set(38,17,-98);
    moon.add(new THREE.Mesh(new THREE.BoxGeometry(9,9,2),new THREE.MeshBasicMaterial({color:0xF4F1D0,fog:false})));
    [[-1.8,1.6,2.8],[1.9,-1.2,2.3],[-0.6,-2.4,1.9]].forEach(c=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(c[2],c[2],0.2),new THREE.MeshBasicMaterial({color:0xD9D5A6,fog:false})); m.position.set(c[0],c[1],1.05); moon.add(m); });
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,color:0xF4F1D0,transparent:true,opacity:0.45,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})); gl.scale.setScalar(34); gl.position.z=-1; moon.add(gl);
    moon.lookAt(0,0,0);
    skyDome.add(st); skyDome.add(moon); nightObjs.push(st,moon);
  }
  applyNightFX(); syncHostNight();
  document.body.classList.toggle('night',night); updateNightUI();
}
function addSkeleton(B,x,z,h){
  const w=0xDADADA,w2=0xBEBEBE,d=0x1A1A1A,F={edge:false};
  const q=(dx,dy,dz,ww,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,ww,hh,dd,c,f);
  [-1,1].forEach(a=>{ q(a*0.06,0.15,0,0.06,0.3,0.06,w); q(a*0.06,0.015,0.02,0.07,0.03,0.1,w2,F); q(a*0.06,0.16,0.032,0.05,0.04,0.01,w2,F); });
  q(0,0.32,0,0.17,0.05,0.08,w2);
  q(0,0.47,-0.005,0.17,0.28,0.07,0x2A2A2A);
  q(0,0.47,0,0.03,0.28,0.04,w2,F);
  [0.37,0.44,0.51,0.58].forEach(y=>q(0,y,0.012,0.2,0.035,0.09,w));
  [-1,1].forEach(a=>{ q(a*0.15,0.64,0,0.07,0.07,0.07,w2); q(a*0.17,0.45,0,0.05,0.28,0.05,w); });
  q(0,0.72,0,0.22,0.22,0.22,w);
  q(0,0.835,0,0.18,0.01,0.18,w2,F);
  [-1,1].forEach(a=>q(a*0.055,0.74,0.115,0.065,0.065,0.02,d,F));
  q(0,0.69,0.115,0.035,0.045,0.02,0x6F6F6F,F);
  q(0,0.64,0.115,0.12,0.04,0.02,d,F);
  [-0.04,0,0.04].forEach(a=>q(a,0.64,0.123,0.02,0.04,0.01,0xF0F0F0,F));
  q(-0.24,0.5,0.12,0.03,0.18,0.03,0x5A3A1E); q(-0.24,0.64,0.1,0.03,0.1,0.03,0x5A3A1E,F); q(-0.24,0.36,0.1,0.03,0.1,0.03,0x5A3A1E,F);
  q(-0.24,0.5,0.075,0.01,0.4,0.01,0xEDEDED,F);
}
function addZombie(B,x,z,h){
  const sk=0x5E9E4A,sk2=0x4A8A38,sh=0x1CA8B8,sh2=0x137F8C,pn=0x3B3F9E,pn2=0x2A2D75,d=0x1A1A1A,F={edge:false};
  const q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  [-1,1].forEach(a=>{ q(a*0.07,0.15,0,0.12,0.3,0.12,pn); q(a*0.07,0.03,0.015,0.13,0.06,0.15,0x2A2A2A,F); q(a*0.07,0.2,0.062,0.07,0.09,0.01,pn2,F); });
  q(-0.07,0.08,0.062,0.07,0.07,0.01,sk2,F);
  q(0,0.45,0,0.26,0.3,0.14,sh);
  [-0.09,0,0.09].forEach(a=>q(a,0.31,0,0.07,0.06,0.145,sh2,F));
  q(0.05,0.5,0.072,0.08,0.08,0.01,sk2,F);
  [-1,1].forEach(a=>{ q(a*0.19,0.56,0.04,0.1,0.1,0.12,sh); q(a*0.19,0.52,0.16,0.1,0.1,0.18,sk); q(a*0.19,0.52,0.265,0.105,0.105,0.04,sk2,F); });
  q(0,0.72,0,0.24,0.24,0.24,sk);
  q(0,0.835,-0.005,0.25,0.06,0.25,0x3F7A30);
  q(0,0.79,0.12,0.24,0.03,0.01,0x3F7A30,F);
  [-1,1].forEach(a=>{ q(a*0.06,0.74,0.126,0.06,0.05,0.02,d,F); q(a*0.075,0.74,0.133,0.025,0.04,0.01,0x2B2B8A,F); });
  q(0,0.69,0.126,0.04,0.05,0.02,sk2,F);
  q(0,0.645,0.126,0.11,0.03,0.02,0x1D3D18,F);
  q(-0.07,0.67,0.126,0.04,0.04,0.01,sk2,F);
}
function addWarden(B,x,z,h){
  const c=0x0E3A44,g=0x38E0D0,k=0x08242B,t=0x15525E,gb=0xA8FFF2,F={edge:false};
  const q=(dx,dy,dz,w,hh,dd,cc,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,cc,f);
  [-1,1].forEach(a=>{ q(a*0.13,0.25,0,0.16,0.5,0.16,k); q(a*0.13,0.03,0.03,0.18,0.06,0.22,0x041419); q(a*0.13,0.2,0.082,0.1,0.14,0.01,t,F); });
  q(0,0.5,0,0.4,0.12,0.24,k);
  q(0,0.78,0,0.5,0.5,0.28,c);
  q(0,1.0,0,0.54,0.08,0.3,t);
  [0.7,0.78,0.86].forEach(y=>q(0,y,0.145,0.3,0.05,0.02,g,F));
  [-1,1].forEach(a=>q(a*0.07,0.78,0.15,0.04,0.2,0.02,k,F));
  q(0,0.78,0.152,0.07,0.07,0.02,gb,F);
  [-1,1].forEach(a=>{
    q(a*0.34,0.62,0.04,0.14,0.6,0.16,c); q(a*0.34,0.92,0.04,0.2,0.1,0.2,t);
    q(a*0.34,0.98,0.04,0.17,0.04,0.17,g,F);
    q(a*0.34,0.3,0.06,0.18,0.16,0.18,k); q(a*0.34,0.33,0.15,0.12,0.06,0.02,g,F);
  });
  [-0.14,0,0.14].forEach(a=>q(a,0.82,-0.15,0.06,0.18+Math.abs(a)*0.2,0.06,g,F));
  q(0,1.2,0,0.4,0.28,0.28,t);
  [-1,1].forEach(a=>{ q(a*0.27,1.28,0,0.2,0.2,0.06,c); q(a*0.31,1.4,0,0.06,0.1,0.05,g,F); q(a*0.1,1.2,0.145,0.07,0.04,0.02,0x000000,F); });
  q(0,1.12,0.145,0.2,0.04,0.02,0x000000,F);
  [-0.07,0,0.07].forEach(a=>q(a,1.4,0,0.05,0.1,0.05,g,F)); q(0,1.46,0,0.09,0.05,0.09,gb,F);
}
function addVillager(B,x,z,h){
  const sk=0xD9A77A,sk2=0xC08A5F,rb=0x7A5A3A,rb2=0x5E4328,F={edge:false};
  const q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  q(0,0.25,0,0.24,0.5,0.2,rb);
  q(0,0.03,0,0.26,0.06,0.22,rb2);
  q(0,0.4,0.106,0.04,0.3,0.01,rb2,F);
  q(0,0.5,0.106,0.26,0.03,0.012,0x8C6B45,F);
  q(0,0.38,0.12,0.3,0.1,0.1,rb2);
  [-1,1].forEach(a=>q(a*0.1,0.38,0.172,0.09,0.08,0.03,sk,F));
  q(0,0.64,0,0.22,0.24,0.22,sk);
  q(0,0.6,0.14,0.06,0.12,0.06,sk2);
  q(0,0.7,0.116,0.2,0.03,0.02,0x4A3A2A,F);
  [-1,1].forEach(a=>{ q(a*0.05,0.665,0.117,0.055,0.045,0.02,0xFFFFFF,F); q(a*0.04,0.665,0.126,0.028,0.04,0.01,0x2E8B2E,F); });
  q(0,0.58,0.117,0.1,0.02,0.01,sk2,F);
  q(0,0.765,0,0.24,0.03,0.24,0x6B4A2A,F);
}
function addBlaze(B,R){
  const F={edge:false},BC=0xF2B02A;
  /* variasi warna deterministik (BUKAN rnd() terseed: urutan rnd() dunia tidak boleh bergeser) */
  const hs=(i,j)=>{ let x=Math.imul(i*374761393+j*668265263+7,1274126177); x^=x>>>13; x=Math.imul(x,1103515245); return ((x>>>0)%1000)/1000; };
  const sh=(hex,a)=>{ const k=1+a*1.5,c=v=>Math.max(0,Math.min(255,Math.round(v*k))); return (c(hex>>16&255)<<16)|(c(hex>>8&255)<<8)|c(hex&255); }; /* warna angka (dipakai juga oleh tools/character-data) */
  /* KEPALA: kubus dasar + kulit piksel 6x6 di depan/belakang/kiri/kanan (tiap petak beda terang-gelapnya) */
  addBox(B,0,0.75,0,0.26,0.26,0.26,BC);
  const N=6,T=0.26/N,TH=0.008,E=0.13+TH/2;
  for(let a=0;a<N;a++) for(let b=0;b<N;b++){
    const u=-0.13+T/2+a*T,v=0.62+T/2+b*T;
    addBox(B,u,v,E,T,T,TH,sh(BC,(hs(a,b)-0.5)*0.16),F);
    addBox(B,u,v,-E,T,T,TH,sh(BC,(hs(a+9,b)-0.5)*0.2-0.03),F);
    addBox(B,E,v,u,TH,T,T,sh(BC,(hs(a,b+9)-0.5)*0.16),F);
    addBox(B,-E,v,u,TH,T,T,sh(BC,(hs(a+5,b+5)-0.5)*0.16),F);
  }
  addBox(B,0,0.89,0,0.2,0.04,0.2,0xFFD23F,F);                       /* lempeng mahkota */
  /* lapis 1: rongga mata, pipi, batang hidung, bingkai mulut, dagu, bintik bara di dahi */
  [-1,1].forEach(a=>{ addBox(B,a*0.06,0.78,0.143,0.085,0.07,0.01,0x7A4308,F); addBox(B,a*0.1,0.69,0.143,0.04,0.045,0.01,0xD9801A,F); });
  addBox(B,0,0.755,0.143,0.032,0.06,0.01,0xD98A1A,F);
  addBox(B,0,0.69,0.143,0.14,0.05,0.01,0x3A1E08,F);
  addBox(B,0,0.635,0.143,0.22,0.02,0.01,0xC9781A,F);
  [[-0.07,0.85],[0.04,0.856],[0.09,0.842]].forEach(c=>addBox(B,c[0],c[1],0.143,0.025,0.025,0.01,0xFFE27A,F));
  /* lapis 2: putih mata, alis miring (sisi dalam lebih rendah = galak), bara dalam mulut */
  [-1,1].forEach(a=>{ addBox(B,a*0.06,0.78,0.151,0.062,0.046,0.006,0xFFF6D0,F); addBox(B,a*0.04,0.826,0.151,0.04,0.018,0.006,0x7A3A06,F); addBox(B,a*0.085,0.838,0.151,0.035,0.018,0.006,0x7A3A06,F); });
  addBox(B,0,0.688,0.151,0.11,0.028,0.006,0xFF5A14,F);
  /* lapis 3: pupil + kilau mata, gigi runcing atas-bawah */
  [-1,1].forEach(a=>{ addBox(B,a*0.058,0.778,0.158,0.028,0.04,0.006,0x2A1A0A,F); addBox(B,a*0.066,0.79,0.162,0.01,0.01,0.004,0xFFFFFF,F); });
  [-0.04,0,0.04].forEach(x=>addBox(B,x,0.7,0.155,0.018,0.016,0.008,0xFFE9A0,F));
  [-0.02,0.02].forEach(x=>addBox(B,x,0.678,0.155,0.018,0.016,0.008,0xFFE9A0,F));
  /* sisi: tiga celah ventilasi gelap; belakang: takik bara */
  [-1,1].forEach(a=>[0.7,0.75,0.8].forEach(y=>addBox(B,a*0.1385,y,-0.01,0.012,0.018,0.11,0x7A4308,F)));
  addBox(B,0,0.75,-0.1385,0.07,0.09,0.012,0x7A4308,F);
  /* mahkota api: 6 lidah tiga tingkat (dasar oranye, tengah kuning, ujung putih-kuning) */
  [[0,0,0.17],[-0.07,0.05,0.12],[0.07,0.05,0.12],[-0.06,-0.06,0.1],[0.06,-0.06,0.1],[0,0.08,0.08]].forEach(f=>{
    const hb=f[2]*0.55,hm=f[2]*0.3; let y=0.91;
    addBox(B,f[0],y+hb/2,f[1],0.055,hb,0.055,0xF28A1A,F); y+=hb;
    addBox(B,f[0],y+hm/2,f[1],0.04,hm,0.04,0xFFB02A,F); y+=hm;
    addBox(B,f[0],y+0.02,f[1],0.022,0.04,0.022,0xFFE98A,F);
  });
  for(let r=0;r<3;r++){ const n=r===2?4:6; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+r*0.5,rad=r===2?0.2:(r?0.26:0.2); addBox(R,Math.cos(a)*rad,0.2+r*0.2,Math.sin(a)*rad,0.06,r===2?0.2:0.28,0.06,r?0xFFD23F:0xF28A1A); if(r===1) addBox(R,Math.cos(a)*rad,0.2+r*0.2,Math.sin(a)*rad,0.075,0.05,0.075,0xFFF0A0,F); } }
}
function addNetherTree(DB,x,z,s){
  const w=rnd()<0.4,st=w?0x1F6B6B:0x6A1A2A,cap=w?0x2AB8A8:0xB02A3A,h=1.2*s;
  for(let y=0;y<h;y+=0.3) addBox(DB,x,y+0.15,z,0.28,0.3,0.28,jit(st,0.06));
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) addBox(DB,x+i*0.4,h+0.15,z+j*0.4,0.4,0.3,0.4,jit(cap,0.1),{edge:false});
  addBox(DB,x,h+0.45,z,0.4,0.3,0.4,jit(cap,0.1),{edge:false});
}
function addGhast(B,x,y,z){
  addBox(B,x,y,z,2,2,2,0xEDEDED); [-0.5,0.5].forEach(a=>addBox(B,x+a,y+0.1,z+1.01,0.3,0.45,0.02,0x2A2A2A,{edge:false})); addBox(B,x,y-0.5,z+1.01,0.6,0.3,0.02,0x2A2A2A,{edge:false});
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) addBox(B,x+i*0.7,y-1.5,z+j*0.7,0.25,1,0.25,0xE0E0E0,{edge:false});
}

/* ---------- Ghast terbang (animasi): badan melayang berkeliling, tentakel mengayun ---------- */
function makeGhast(){
  const g=new THREE.Group(),B=makeBatch(),F={edge:false};
  const mat=new THREE.MeshLambertMaterial({vertexColors:true,transparent:true,opacity:1,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const lmat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.6});
  const BO={mat,lineMat:lmat,cast:false};
  addBox(B,0,0,0,2,2,2,0xEDEDED);
  [-0.5,0.5].forEach(a=>addBox(B,a,0.1,1.01,0.3,0.45,0.02,0x2A2A2A,F)); addBox(B,0,-0.5,1.01,0.6,0.3,0.02,0x2A2A2A,F);
  g.add(buildBatch(B,BO));
  const tents=[];
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++){
    const TB=makeBatch(); addBox(TB,0,-0.5,0,0.25,1,0.25,0xE0E0E0,F);
    const p=new THREE.Group(); p.position.set(i*0.7,-1,j*0.7); p.add(buildBatch(TB,BO)); g.add(p);
    tents.push({p,ph:(i+1)*1.7+(j+1)*2.3});
  }
  return {g,tents,mat,lmat,k:1};
}
function addFlyGhast(x,y,z){
  const o=makeGhast(),k=GHASTS.length;
  Object.assign(o,{cx:x,cy:Math.max(y,10),cz:z,rx:6+(k%3)*1.5,rz:4.5+(k%2)*1.5,sp:0.16+0.04*(k%3),ph:k*2.1,ph2:k*1.3});
  o.g.position.set(x,o.cy,z); world.add(o.g); GHASTS.push(o);
}
/* Ghast yang menutupi pandangan kamera (garis kamera -> pion/papan) atau melintas di atas papan: jadi transparan (tetap terlihat samar), solid lagi setelah menyingkir */
function updateGhastFade(dt,pts){
  const C=camera.position,rate=Math.min(1,dt*7);
  for(let i=0;i<GHASTS.length;i++){
    const o=GHASTS[i],q=o.g.position; let hit=false;
    for(let j=0;j<pts.length&&!hit;j++){
      const T=pts[j],sx=T.x-C.x,sy=T.y-C.y,sz=T.z-C.z,L2=sx*sx+sy*sy+sz*sz||1;
      let u=((q.x-C.x)*sx+(q.y-C.y)*sy+(q.z-C.z)*sz)/L2;
      if(u>0.985) continue;
      if(u<0) u=0;
      const ex=C.x+sx*u-q.x,ey=C.y+sy*u-q.y,ez=C.z+sz*u-q.z;
      if(ex*ex+ey*ey+ez*ez<3.6*3.6) hit=true;
    }
    if(q.x>LOCK_BOX.minX&&q.x<LOCK_BOX.maxX&&q.z>LOCK_BOX.minZ&&q.z<LOCK_BOX.maxZ) hit=true; /* di atas area papan */
    o.k+=((hit?0.15:1)-o.k)*rate; if(!hit&&o.k>0.97) o.k=1;
    o.mat.opacity=o.k; o.mat.depthWrite=o.k>0.97; o.lmat.opacity=0.6*o.k; o.g.visible=true;
  }
}
function updateGhasts(dt,t){
  if(RMQ.matches) return;
  for(let i=0;i<GHASTS.length;i++){
    const o=GHASTS[i],a=t*o.sp+o.ph,
      x=o.cx+Math.sin(a)*o.rx+Math.sin(a*2.3+1)*1.2, z=o.cz+Math.sin(a*0.77+o.ph2)*o.rz, y=o.cy+Math.sin(a*1.6)*0.9,
      dx=x-o.g.position.x, dz=z-o.g.position.z;
    if(dx*dx+dz*dz>1e-7){ let da=Math.atan2(dx,dz)-o.g.rotation.y; da=Math.atan2(Math.sin(da),Math.cos(da)); o.g.rotation.y+=da*Math.min(1,dt*2.5); o.g.rotation.z=-da*0.25; }
    o.g.position.set(x,y,z);
    for(let j=0;j<o.tents.length;j++){ const q=o.tents[j]; q.p.rotation.x=Math.sin(t*2.2+q.ph)*0.22; q.p.rotation.z=Math.cos(t*1.9+q.ph*1.3)*0.22; }
  }
}
/* ---------- Mob Nether di papan (petak): model voxel kecil, menghadap +z ---------- */
function addStrider(B,x,z,h){
  const F={edge:false},q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  [-1,1].forEach(a=>{ q(a*0.1,0.2,0,0.1,0.4,0.1,0x7A1818); q(a*0.1,0.025,0.03,0.12,0.05,0.16,0x3A0C0C,F); });
  q(0,0.56,0,0.44,0.32,0.4,0xB02A2A); q(0,0.43,0,0.42,0.06,0.38,0x7A1818,F);
  [-1,1].forEach(a=>q(a*0.225,0.52,0.04,0.03,0.2,0.22,0x9A2222,F));
  [[-0.12,-0.1],[0.1,0],[-0.04,0.1],[0.13,-0.12],[0,-0.04],[-0.14,0.06]].forEach((p,i)=>q(p[0],0.78+(i%2)*0.03,p[1],0.05,0.14+(i%3)*0.03,0.05,0xE05A32,F));
  [-1,1].forEach(a=>{ q(a*0.1,0.6,0.202,0.07,0.06,0.02,0xFFF1D0,F); q(a*0.1,0.6,0.212,0.035,0.05,0.01,0x151515,F); });
  q(0,0.5,0.202,0.2,0.04,0.02,0x2A0A0A,F);
}
function addMagmaCube(B,x,z,h){
  const F={edge:false},q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  q(0,0.26,0,0.5,0.5,0.5,0x3E1A10);
  [0.1,0.26,0.42].forEach(y=>q(0,y,0,0.52,0.05,0.52,0xFF6A1A,F));
  [-1,1].forEach(a=>q(a*0.1,0.32,0.256,0.1,0.07,0.01,0xFFD23F,F));
  q(0,0.17,0.256,0.22,0.05,0.01,0xFF6A1A,F);
}
function addPiglinLike(B,x,z,h,o){
  const F={edge:false},s=o.s||1,q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx*s,h+dy*s,z+dz*s,w*s,hh*s,dd*s,c,f);
  [-1,1].forEach(a=>q(a*0.07,0.14,0,0.12,0.28,0.12,o.pants));
  q(0,0.43,0,0.28,0.34,0.18,o.cloth); q(0,0.3,0.1,0.3,0.06,0.02,o.belt||0xFFD23F,F);
  [-1,1].forEach(a=>q(a*0.2,0.43,0.02,0.1,0.32,0.12,o.skin));
  q(0,0.74,0,0.3,0.26,0.26,o.skin); q(0,0.7,0.15,0.14,0.1,0.06,o.snout);
  [-1,1].forEach(a=>{
    q(a*0.04,0.7,0.185,0.025,0.04,0.02,0x2A1A1A,F); q(a*0.08,0.66,0.17,0.035,0.06,0.03,0xF2F2E0,F);
    q(a*0.2,0.8,0,0.1,0.12,0.05,o.snout,F);
    q(a*0.07,0.8,0.136,0.06,0.04,0.02,0xFFFFFF,F); q(a*0.07,0.8,0.146,0.03,0.04,0.01,o.eye,F);
  });
  if(o.crown) q(0,0.89,0,0.3,0.04,0.26,0xFFD23F,F);
  if(o.weapon==='sword'){ q(0.2,0.5,0.16,0.04,0.04,0.34,0xFFD23F,F); q(0.2,0.5,0.0,0.1,0.04,0.04,0x8A5A1A,F); }
  if(o.weapon==='axe'){ q(0.2,0.5,0.16,0.04,0.04,0.36,0x5A3A1A,F); q(0.2,0.56,0.32,0.05,0.18,0.12,0xFFD23F,F); }
}
function addPiglin(B,x,z,h){ addPiglinLike(B,x,z,h,{skin:0xD99A78,snout:0xC47A5A,cloth:0xB5651D,pants:0x6A4A2A,eye:0x2A1A1A,weapon:'sword'}); }
function addPiglinBrute(B,x,z,h){ addPiglinLike(B,x,z,h,{skin:0xB87050,snout:0x9A5A3A,cloth:0x3A3A3A,pants:0x2A2A2A,eye:0xD22B2B,weapon:'axe',crown:true,s:1.1}); }
function addZombifiedPiglin(B,x,z,h){ addPiglinLike(B,x,z,h,{skin:0x8FA878,snout:0x6F8A5A,cloth:0x5A4A3A,pants:0x3A3A5A,eye:0x2A2A2A,weapon:'sword'}); }
function addHoglinLike(B,x,z,h,o){
  const F={edge:false},q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  [[-0.14,0.22],[0.14,0.22],[-0.14,-0.22],[0.14,-0.22]].forEach(p=>q(p[0],0.13,p[1],0.12,0.26,0.12,o.dk));
  q(0,0.42,0,0.46,0.34,0.7,o.body); q(0,0.62,0,0.2,0.1,0.5,o.mane,F);
  q(0,0.4,0.42,0.34,0.3,0.26,o.body); q(0,0.33,0.57,0.26,0.16,0.06,o.snout);
  [-1,1].forEach(a=>{ q(a*0.1,0.44,0.6,0.04,0.12,0.04,0xF2F2E0,F); q(a*0.2,0.58,0.4,0.12,0.06,0.08,o.body,F); q(a*0.09,0.48,0.552,0.04,0.04,0.02,0x151515,F); });
  if(o.zombie){ q(0.12,0.5,0.0,0.14,0.14,0.02,0x8A5A5A,F); q(-0.1,0.46,-0.2,0.12,0.12,0.02,0x3A2A2A,F); q(0.24,0.42,0.1,0.02,0.14,0.14,0x8A5A5A,F); }
}
function addGhastTile(B,x,z,h){ /* Ghast mini yang melayang di atas petak */
  const F={edge:false},q=(dx,dy,dz,w,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,f);
  q(0,0.95,0,0.6,0.6,0.6,0xEDEDED);
  [-1,1].forEach(a=>q(a*0.15,0.98,0.302,0.09,0.14,0.01,0x2A2A2A,F)); q(0,0.8,0.302,0.18,0.09,0.01,0x2A2A2A,F);
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) q(i*0.2,0.5,j*0.2,0.07,0.3+((i+j)&1)*0.08,0.07,0xE0E0E0,F);
}
function addHoglin(B,x,z,h){ addHoglinLike(B,x,z,h,{body:0xA8714A,dk:0x7A4E30,mane:0x5A3A20,snout:0xD9A07A}); }
function addZoglin(B,x,z,h){ addHoglinLike(B,x,z,h,{body:0x6F8F6A,dk:0x4A6A48,mane:0x3A4A38,snout:0x8FA878,zombie:true}); }
/* Chest detail + SHARED: geometri & material dibangun SEKALI (CHEST_PROTO), tiap chest di papan hanya clone ringan yang berbagi geometri/material (hemat memori & draw call). Hanya grup tutup (lid) yang terpisah per chest agar animasi buka/tutup tetap independen. */
let CHEST_PROTO=null;
function buildChestProto(){
  const B=makeBatch(),L=makeBatch(),F={edge:false},iron=0x3A3A42,gold=0xFFD23F;
  /* badan: alas gelap + 3 papan bersusun + strap besi + tiang sudut */
  addBox(B,0,0.015,0,0.31,0.03,0.23,0x4A2E14,F);
  addBox(B,0,0.05,0,0.30,0.04,0.22,0xB07C34); addBox(B,0,0.09,0,0.30,0.04,0.22,0xA06E2C); addBox(B,0,0.125,0,0.30,0.03,0.22,0xB88340);
  [-1,1].forEach(a=>{ addBox(B,a*0.1,0.075,0,0.03,0.15,0.226,iron,F); [0.04,0.11].forEach(y=>addBox(B,a*0.1,y,0.1135,0.018,0.018,0.004,0xB9B9C4,F)); });
  [-1,1].forEach(a=>[-1,1].forEach(b=>addBox(B,a*0.15,0.075,b*0.11,0.026,0.15,0.026,0x5A3A18)));
  /* rongga dalam + isi emas/permata (terlihat saat tutup terbuka) */
  addBox(B,0,0.139,0,0.27,0.006,0.19,0x24160A,F);
  addBox(B,-0.06,0.147,0.03,0.05,0.012,0.05,gold,F); addBox(B,0.05,0.147,0.0,0.05,0.012,0.045,0xFFE070,F); addBox(B,0.0,0.152,-0.04,0.03,0.022,0.03,0x5BE0E8,F); addBox(B,0.09,0.15,0.05,0.03,0.016,0.03,0xE24A4A,F);
  /* plat kunci depan */
  addBox(B,0,0.1,0.113,0.05,0.07,0.012,gold,F); addBox(B,0,0.095,0.12,0.012,0.026,0.004,0x3A2A00,F);
  /* tutup: papan + atas melengkung + strap + braket + kait emas */
  addBox(L,0,0.025,0.11,0.30,0.05,0.22,0x7A4E1C); addBox(L,0,0.06,0.11,0.30,0.02,0.17,0x8A5A24); addBox(L,0,0.0,0.225,0.05,0.08,0.02,gold,F); addBox(L,0,0.0,0.236,0.012,0.026,0.004,0x3A2A00,F);
  [-1,1].forEach(a=>{ addBox(L,a*0.1,0.035,0.11,0.03,0.072,0.226,iron,F); addBox(L,a*0.15,0.035,0.0,0.026,0.07,0.026,0x5A3A18,F); addBox(L,a*0.15,0.035,0.22,0.026,0.07,0.026,0x5A3A18,F); });
  const body=buildBatch(B),lid=buildBatch(L);
  return {body,lid};
}
function makeChest(){
  if(!CHEST_PROTO) CHEST_PROTO=buildChestProto();
  const g=new THREE.Group();
  g.add(CHEST_PROTO.body.clone()); /* clone() berbagi geometry & material */
  const lid=new THREE.Group(); lid.position.set(0,0.14,-0.11);
  lid.add(CHEST_PROTO.lid.clone()); g.add(lid); g.userData.lid=lid; return g;
}
const CHEST_SCALE=1.8; /* ukuran final Chest */
const RMQ=matchMedia('(prefers-reduced-motion: reduce)'); /* dibaca live: idle Chest berhenti otomatis saat reduced-motion aktif */
let MOBOBJ={},CHESTOBJ={};
/* Detail tambahan mob (tanpa rnd()/jit() agar seed dunia tidak bergeser). Dipanggil setelah builder dasar. */
function detailCreeper(B,x,z,h){
  const d=0x2F7F2E,m=0x3B9A3A,l=0x78D870,F={edge:false},q=(dx,dy,dz,w,hh,dd,c)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,F);
  [-1,1].forEach(a=>{ q(a*0.121,0.62,0.02,0.01,0.06,0.06,m); q(a*0.121,0.55,-0.05,0.01,0.05,0.05,d); q(a*0.121,0.68,-0.06,0.01,0.04,0.04,l); q(a*0.101,0.34,0.0,0.01,0.07,0.05,d); q(a*0.101,0.27,0.03,0.01,0.05,0.04,l); });
  q(0,0.62,-0.121,0.06,0.06,0.01,m); q(-0.07,0.56,-0.121,0.05,0.05,0.01,d); q(0.06,0.68,-0.121,0.05,0.04,0.01,l);
  q(0,0.47,0,0.245,0.025,0.245,d); q(0,0.2,0.0,0.19,0.02,0.1,d);
  [-1,1].forEach(a=>[-1,1].forEach(b=>q(a*0.06,0.02,b*0.07,0.095,0.03,0.095,0x20601F)));
}
function detailEnderman(B,x,z,h){
  const k2=0x241C30,k3=0x30244A,F={edge:false},q=(dx,dy,dz,w,hh,dd,c)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,F);
  [0.58,0.66,0.74].forEach(y=>q(0,y,0.052,0.14,0.018,0.008,k2)); q(0,0.8,0,0.1,0.08,0.085,k2);
  q(0,0.65,-0.052,0.1,0.26,0.008,k3);
  [-1,1].forEach(a=>{ q(a*0.115,0.31,0.02,0.05,0.035,0.045,k2); q(a*0.115,0.62,0.03,0.02,0.04,0.02,k3); q(a*0.045,0.1,0.052,0.05,0.04,0.008,k3); });
  q(0,0.955,-0.103,0.14,0.05,0.008,k3); q(0,1.04,0,0.16,0.01,0.16,k3);
}
function detailSkeleton(B,x,z,h){
  const w=0xDADADA,w2=0xBEBEBE,F={edge:false},q=(dx,dy,dz,ww,hh,dd,c)=>addBox(B,x+dx,h+dy,z+dz,ww,hh,dd,c,F);
  [0.38,0.45,0.52,0.59].forEach(y=>q(0,y,-0.05,0.19,0.03,0.02,w));
  q(0,0.47,-0.05,0.025,0.28,0.02,w2);
  q(0.08,0.5,-0.08,0.075,0.3,0.05,0x6A4A2A); q(0.08,0.5,-0.08,0.085,0.02,0.06,0x4A3018); q(0.065,0.68,-0.08,0.015,0.05,0.015,0xF0F0F0); q(0.09,0.68,-0.08,0.015,0.05,0.015,0xC03030); q(0.08,0.66,-0.08,0.015,0.04,0.015,0xF0F0F0);
  [-1,1].forEach(a=>{ q(a*0.17,0.29,0,0.06,0.035,0.06,w2); q(a*0.06,0.3,0.0,0.075,0.03,0.075,w2); q(a*0.111,0.72,0,0.01,0.12,0.14,w2); });
}
function detailZombie(B,x,z,h){
  const sk=0x5E9E4A,sk2=0x4A8A38,hr=0x2E5A24,F={edge:false},q=(dx,dy,dz,w,hh,dd,c)=>addBox(B,x+dx,h+dy,z+dz,w,hh,dd,c,F);
  q(0,0.31,0,0.27,0.035,0.145,0x1A6F7A);
  [-1,1].forEach(a=>{ q(a*0.06,0.775,0.127,0.07,0.02,0.01,hr); q(a*0.125,0.72,0,0.02,0.06,0.04,sk2); q(a*0.19,0.5,0.1,0.11,0.025,0.13,0x137F8C); });
  q(-0.06,0.3,0.074,0.06,0.04,0.01,sk2); q(0.07,0.29,0.074,0.05,0.03,0.01,sk2);
  q(0,0.6,0.0,0.14,0.03,0.145,0x137F8C); q(0,0.835,-0.14,0.24,0.04,0.02,hr);
}
function buildMobs(th){
  MOBOBJ={}; CHESTOBJ={};
  const mk={creeper:(B,x,z,h)=>{ addCreeper(B,x,z,h); detailCreeper(B,x,z,h); },ender:(B,x,z,h)=>{ addEnderman(B,x,z,h); detailEnderman(B,x,z,h); },skeleton:(B,x,z,h)=>{ addSkeleton(B,x,z,h); detailSkeleton(B,x,z,h); },zombie:(B,x,z,h)=>{ addZombie(B,x,z,h); detailZombie(B,x,z,h); },warden:addWarden,villager:addVillager,
    strider:addStrider,magma_cube:addMagmaCube,piglin:addPiglin,piglin_brute:addPiglinBrute,zombified_piglin:addZombifiedPiglin,hoglin:addHoglin,zoglin:addZoglin,ghast:addGhastTile};
  for(let n=1;n<=GOAL;n++){
    const t=TILES[n],k=mobOn(n,th.key);
    if(k){
      const B=makeBatch(),g=new THREE.Group(); let rods=null;
      if(k==='blaze'){ const R=makeBatch(); addBlaze(B,R); g.add(buildBatch(B)); rods=new THREE.Group(); rods.add(buildBatch(R)); g.add(rods); }
      else{ mk[k](B,0,0,0); g.add(buildBatch(B)); }
      g.position.set(t.x,t.h,t.z); world.add(g);
      MOBOBJ[n]={g,k,x:t.x,y:t.h,z:t.z,s:(k==='warden'||k==='piglin_brute')?1.1:1,ph:n,react:0,rods,fire:(k==='blaze'?makeBlazeFire():null)};
    }
    if(CHESTS.has(n)){
      const c=makeChest(); c.position.set(t.x,t.h,t.z-0.34); c.scale.setScalar(CHEST_SCALE); world.add(c);
      const sp=new THREE.Mesh(new THREE.OctahedronGeometry(0.07),new THREE.MeshBasicMaterial({color:0xFFD23F})); sp.position.set(t.x,t.h+0.6,t.z-0.34); world.add(sp);
      const gl=new THREE.Mesh(new THREE.SphereGeometry(0.3,12,8),new THREE.MeshBasicMaterial({color:0xFFD23F,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); gl.position.set(t.x,t.h+0.28,t.z-0.34); gl.visible=false; world.add(gl);
      CHESTOBJ[n]={g:c,lid:c.userData.lid,spark:sp,glow:gl,sy:t.h+0.6,open:0,a:0,x:t.x,y:t.h,z:t.z-0.34};
    }
  }
}
/* ---------- Partikel api Blaze: kubus kecil berpool (tanpa alokasi per frame), warna putih-kuning -> oranye -> merah -> asap ---------- */
const BF_COL=[0xFFF2A0,0xFFD23F,0xFF8A1A,0xE0451A],BF_SMOKE=0x3A2A26,BF_POOL=44;
function makeBlazeFire(){
  const grp=new THREE.Group(),geo=new THREE.BoxGeometry(1,1,1);
  const mats=BF_COL.map(c=>new THREE.MeshBasicMaterial({color:c,fog:false}));
  mats.push(new THREE.MeshBasicMaterial({color:BF_SMOKE,transparent:true,opacity:0.5,depthWrite:false}));
  const ps=[];
  for(let i=0;i<BF_POOL;i++){ const me=new THREE.Mesh(geo,mats[0]); me.visible=false; me.castShadow=false; me.receiveShadow=false; grp.add(me); ps.push({me,life:0,max:1,vx:0,vy:0,vz:0,s:0.05,ph:i*1.7}); }
  world.add(grp);
  return {grp,mats,ps,acc:0,i:0};
}
function blazeFireStep(m,dt,t,hot){
  const f=m.fire; if(!f) return;
  const calm=RMQ.matches||document.hidden;       /* reduced-motion / tab tersembunyi: tidak memancarkan api baru */
  if(!calm){
    f.acc+=dt*(hot?38:22);
    let guard=6;
    while(f.acc>=1&&guard--){
      f.acc-=1;
      let p=null; for(let k=0;k<BF_POOL;k++){ const c=f.ps[(f.i+k)%BF_POOL]; if(c.life<=0){ p=c; f.i=(f.i+k+1)%BF_POOL; break; } }
      if(!p) break;
      const crown=Math.random()<0.45;              /* 45% dari mahkota kepala, sisanya dari batang yang berputar */
      const a=Math.random()*Math.PI*2,r=crown?Math.random()*0.09:0.1+Math.random()*0.16;
      p.me.position.set(m.x+Math.cos(a)*r,m.y+(crown?0.95+Math.random()*0.1:0.12+Math.random()*0.6),m.z+Math.sin(a)*r);
      p.max=p.life=crown?0.5+Math.random()*0.4:0.6+Math.random()*0.5;
      p.vx=(Math.random()-0.5)*0.18; p.vz=(Math.random()-0.5)*0.18; p.vy=(crown?0.7:0.45)+Math.random()*0.5;
      p.s=crown?0.04+Math.random()*0.045:0.05+Math.random()*0.05;
      p.me.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); p.me.visible=true;
    }
  }
  for(let k=0;k<BF_POOL;k++){
    const p=f.ps[k]; if(p.life<=0) continue;
    p.life-=dt;
    if(p.life<=0){ p.me.visible=false; continue; }
    const u=1-p.life/p.max;                         /* 0 baru lahir -> 1 padam */
    p.me.position.x+=(p.vx+Math.sin(t*7+p.ph)*0.12)*dt; p.me.position.z+=(p.vz+Math.cos(t*6+p.ph)*0.12)*dt; p.me.position.y+=p.vy*dt;
    p.me.rotation.x+=dt*2.5; p.me.rotation.y+=dt*3;
    p.me.material=u<0.14?f.mats[0]:u<0.38?f.mats[1]:u<0.66?f.mats[2]:u<0.86?f.mats[3]:f.mats[4];
    p.me.scale.setScalar(p.s*(1-0.65*u));
  }
}
function sparkle(pos){ if(FX) FX.sparkle(pos); } /* visual: UT.GameplayFX */
function mobReact(n){ if(MOBOBJ[n]) MOBOBJ[n].react=1.6; }
/* Lifecycle Chest: open=1 menahan tutup terbuka sampai closeChest() dipanggil (tidak lagi timer otomatis). */
function openChest(n){ mpCue({k:'chest',n:n,o:1}); const c=CHESTOBJ[n]; if(!c) return; c.open=1; sparkle(new THREE.Vector3(c.x,c.y+0.35,c.z)); }
function closeChest(n){ mpCue({k:'chest',n:n,o:0}); const c=CHESTOBJ[n]; if(c) c.open=0; }
function updateMobs(dt,t){
  updateGhasts(dt,t); updateLavafalls(t); updateWither(dt,t); updateFort(dt,t); updateWFX(dt);
  const pw=players.map(p=>p.pawn.position);
  for(const n in MOBOBJ){
    const m=MOBOBJ[n],g=m.g; let best=null,bd=1e9;
    pw.forEach(q=>{ const d=Math.hypot(q.x-m.x,q.z-m.z); if(d<bd){ bd=d; best=q; } });
    const near=bd<2.6; m.react=Math.max(0,m.react-dt); const rx=m.react>0;
    const lx=near?best.x:camera.position.x,lz=near?best.z:camera.position.z;
    let dy=Math.atan2(lx-m.x,lz-m.z)-g.rotation.y; dy=Math.atan2(Math.sin(dy),Math.cos(dy));
    g.rotation.y+=dy*Math.min(1,dt*(near?8:2.5));
    let y=Math.abs(Math.sin(t*(near?9:2)+m.ph))*(near?0.07:0.012)*(m.k==='warden'?0.6:1),sc=1,jx=0;
    if(m.k==='ghast') y=0.12*Math.sin(t*1.5+m.ph)+0.1;
    if(m.k==='magma_cube'){ const hp=Math.abs(Math.sin(t*(near?4:1.6)+m.ph)); y=hp*(near?0.28:0.14); sc=1+0.1*(1-hp)-0.04*hp; }
    if(m.k==='creeper'&&(near||rx)) sc=1+0.12*Math.abs(Math.sin(t*(rx?22:12)));
    if(m.k==='ender'&&(near||rx)) jx=(Math.random()-0.5)*0.05;
    if(m.k==='warden'&&(near||rx)){ jx=Math.sin(t*40)*0.02*(rx?2:1); sc=1+0.03*Math.sin(t*14)*(rx?2:1); }
    if(rx) y+=0.1*Math.abs(Math.sin(t*16));
    g.position.set(m.x+jx,m.y+y,m.z); g.scale.setScalar(m.s*sc);
    if(m.rods) m.rods.rotation.y+=dt*(near?6:2.2);
    if(m.fire) blazeFireStep(m,dt,t,near||rx);
  }
  if(FX) FX.updateSparks(dt);
  for(const n in CHESTOBJ){
    const c=CHESTOBJ[n]; /* a = 0..1 tutup terbuka, mengejar c.open (1=buka, 0=tutup) */
    c.a+=(c.open-c.a)*Math.min(1,dt*7); if(Math.abs(c.open-c.a)<0.01) c.a=c.open;
    const idle=!RMQ.matches&&c.open===0&&c.a===0, ph=Number(n);
    let lx=0,by=0,sc=CHEST_SCALE;
    if(idle){ /* idle: napas ringan, naik-turun tipis, tutup bergetar sesekali */
      sc=CHEST_SCALE*(1+0.018*Math.sin(t*1.6+ph)); by=0.025*Math.sin(t*1.3+ph*1.7);
      const vb=Math.sin(t*0.45+ph*2.3); if(vb>0.985) lx=-0.07*Math.abs(Math.sin(t*38));
    }
    c.g.scale.setScalar(sc); c.g.position.y=c.y+by;
    c.lid.rotation.x=-1.25*c.a+lx;
    c.glow.visible=c.a>0.02; c.glow.material.opacity=0.28*c.a; c.glow.scale.setScalar(1+0.12*Math.sin(t*6));
    c.spark.rotation.y+=dt*(RMQ.matches?0:2); c.spark.position.y=c.sy+(RMQ.matches?0:Math.sin(t*3+ph)*0.04); c.spark.scale.setScalar(1+1.2*c.a);
  }
}
async function fly(p,to,dur,hgt){
  const a=p.pawn.position.clone(),b=slotPos(p.idx,to);
  await tween(dur,k=>{ p.pawn.position.lerpVectors(a,b,k); p.pawn.position.y+=Math.sin(k*Math.PI)*hgt; });
  p.pawn.position.copy(b);
}
/* ---------- Dragon Feature 1: Portal Block 100 (visual + trigger) ----------
   Tile 100 = portal gelap berbintik energi. Dormant (sangat subtle) sampai ada pemain di petak 100, lalu efek menguat
   dan End Crystal muncul. Hanya visual: tidak mengubah nomor/posisi tile, gerak, dadu, giliran, ular, tangga, HUD, kamera.
   Memakai 1 InstancedMesh (geometri+material bersama), 2 bidang glow, 1 kristal; tanpa lampu dinamis. Tidak memakai rnd() dunia. */
var PORTAL=null;
function buildPortal(t){
  const g=new THREE.Group(); g.position.set(t.x,t.h,t.z);
  let sd=1357; const lr2=()=>(sd=(sd*16807)%2147483647)/2147483647; /* PRNG lokal: urutan rnd() dunia tidak terganggu */
  const N=46,geo=new THREE.BoxGeometry(1,1,1);
  const pm=new THREE.MeshBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending});
  const inst=new THREE.InstancedMesh(geo,pm,N); inst.frustumCulled=false;
  const pt=[],pal=[0x4AEDD9,0xE040FF,0xB59CFF,0xFFFFFF];
  for(let i=0;i<N;i++) pt.push({x:(lr2()-0.5)*0.88,z:(lr2()-0.5)*0.88,ph:lr2()*6.283,sp:0.5+lr2()*1.1,c:new THREE.Color(pal[i%4]),rise:i%3===0});
  inst.setColorAt(0,pt[0].c); g.add(inst);
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,0.9)'); gr.addColorStop(0.4,'rgba(255,255,255,0.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gr; x.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(c);
  const mkPlane=(col,sz,y)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(sz,sz),new THREE.MeshBasicMaterial({map:tex,color:col,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    m.rotation.x=-Math.PI/2; m.position.y=y; m.frustumCulled=false; g.add(m); return m; };
  const glow=mkPlane(0x7A4DFF,2.2,0.035), ring=mkPlane(0x4AEDD9,1.4,0.045);
  /* End Crystal: tersembunyi sampai portal aktif */
  const cr=new THREE.Group(); cr.position.y=1.3; cr.visible=false; cr.scale.setScalar(0.001);
  const core=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.26,0.26),new THREE.MeshBasicMaterial({color:0xE040FF}));
  const shell=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.42),new THREE.MeshBasicMaterial({color:0x4AEDD9,transparent:true,opacity:0.38,depthWrite:false}));
  core.rotation.set(0.6155,0,Math.PI/4); shell.rotation.copy(core.rotation); cr.add(core,shell); g.add(cr);
  return {g,inst,pt,glow,ring,cr,core,shell,act:0,on:false,m4:new THREE.Matrix4(),q:new THREE.Quaternion(),p:new THREE.Vector3(),sc:new THREE.Vector3(),col:new THREE.Color()};
}
function updatePortal(dt,now){
  const P=PORTAL; if(!P) return;
  const t=now*0.001,want=players.some(p=>p.pos===GOAL)?1:0;
  if(want&&!P.on){ P.on=true; if(AWK.done) dragon.visible=true; } /* Feature 2: naga baru boleh tampil setelah Awakening selesai (AWK.done) */
  else if(!want&&P.on){ P.on=false; dragon.visible=false; }
  P.act+=(want-P.act)*Math.min(1,dt*2.2); const a=P.act;
  P.glow.material.opacity=(0.16+0.5*a)*(0.8+0.2*Math.sin(t*(1.5+2.5*a)));
  P.glow.scale.setScalar(1+0.07*Math.sin(t*(1.2+2*a))+0.35*a);
  const k=(t*(0.3+0.7*a))%1; P.ring.scale.setScalar(0.7+k*0.9); P.ring.material.opacity=(1-k)*(0.1+0.45*a);
  const br=0.3+0.7*a;
  for(let i=0;i<P.pt.length;i++){
    const o=P.pt[i],tw=0.5+0.5*Math.sin(t*(1.2+o.sp*2)+o.ph);
    let y=0.03,s=0.035+0.05*tw*(0.45+0.55*a);
    if(o.rise&&a>0.04){ const r=((t*0.32*o.sp+o.ph)%1); y+=r*1.05*a; s*=1-0.75*r; }
    P.p.set(o.x,y+s/2,o.z); P.sc.set(s,s,s); P.m4.compose(P.p,P.q,P.sc); P.inst.setMatrixAt(i,P.m4);
    P.inst.setColorAt(i,P.col.copy(o.c).multiplyScalar(br*(0.35+0.65*tw)));
  }
  P.inst.instanceMatrix.needsUpdate=true; if(P.inst.instanceColor) P.inst.instanceColor.needsUpdate=true;
  P.cr.visible=false; /* Feature 2: End Crystal pindah ke tower Dragon Arena; portal Block 100 tetap menyala (glow + partikel) */
}

/* ---------- Dragon Feature 2: Dragon Awakening ----------
   Pemain pertama tiba di Block 100 -> gempa -> kayu bingkai jadi bedrock -> 4 End Crystal di tengah -> 6 tower kecil (pengganti api sudut) -> Dragon spawn, crystal menyetrum -> naga terbang di atas papan -> gameplay unlock.
   Hanya 1x per game (AWK.done). Selama AWK.running semua kontrol gameplay dikunci. Tanpa Crystal progression / Dragon attack (fitur berikutnya). */
const AWK={done:false,running:false};
var ARENA=null,MOUNT=null;
const MT_SHIFT=0.8; /* gunung batu kiri board digeser ke kanan (mendekati board) agar tidak memakan sisi kiri pulau */
const ARENA_POS={x:-11.6,z:-0.2},ARENA_SIZE={w:5.2,d:5.6},ARENA_TOWER_H=3.3;
/* ---------- Tekstur voxel dekoratif (arena, tower bedrock, kayu papan, air) ----------
   Deterministik (hash lokal) dan TIDAK memakai rnd(): urutan acak dunia (pohon/hewan/rumah) tidak bergeser. Hanya menambah kotak kecil di atas geometri lama. */
function hrn(a,b,c,d){ let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,-1640531527)^Math.imul(d|0,1274126177); h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; }
function palAt(pal,r){ return pal[Math.min(pal.length-1,Math.floor(r*pal.length))]; }
function vcol(hex,seed,a,b,amt){ const c=new THREE.Color(hex); c.offsetHSL(0,0,(hrn(a,b,seed,91)-0.5)*amt); return c; }
/* kotak besar dipecah jadi voxel kecil, hanya lapisan permukaan (hemat); tiap voxel warna beda dari palet */
function voxShell(B,cx,cy,cz,w,h,d,u,pal,seed,o){
  const nx=Math.max(1,Math.round(w/u)),ny=Math.max(1,Math.round(h/u)),nz=Math.max(1,Math.round(d/u)),sx=w/nx,sy=h/ny,sz=d/nz;
  for(let i=0;i<nx;i++) for(let j=0;j<ny;j++) for(let k=0;k<nz;k++){
    if(i>0&&i<nx-1&&j>0&&j<ny-1&&k>0&&k<nz-1) continue;
    addBox(B,cx-w/2+sx*(i+0.5),cy-h/2+sy*(j+0.5),cz-d/2+sz*(k+0.5),sx,sy,sz,vcol(palAt(pal,hrn(i,j*7+k,seed,3)),seed,i+k*13,j,0.035),o);
  }
}
/* Bedrock: abu-abu gelap, bintik hitam & abu terang, tidak satu warna */
const BEDROCK=[0x1B1B1B,0x1B1B1B,0x262626,0x262626,0x303030,0x3B3B3B,0x3B3B3B,0x4A4A4A,0x585858,0x0D0D0D,0x0D0D0D,0x6A6A6A];
/* Papan kayu: lembar papan acak panjang, serat, paku, dan garis sambungan di sisi luar. alongX = sumbu panjang strip */
function woodTop(B,cx,cz,w,d,topY,base,seed){
  const E={edge:false},alongX=w>=d,L=alongX?w:d,N=alongX?d:w,rows=Math.max(1,Math.round(N/0.125)),rw=N/rows;
  const sh=(dl,a,b)=>vcol(base,seed,a,b,0.0).offsetHSL(0,0,dl);
  for(let r=0;r<rows;r++){
    let pos=-L/2-hrn(r,seed,5,1)*0.7,si=0;
    while(pos<L/2){
      const len=0.6+hrn(r,si,seed,2)*0.9,a=Math.max(pos,-L/2),b=Math.min(pos+len,L/2);
      if(b-a>0.06){
        const sl=b-a,mid=(a+b)/2,lc=-N/2+rw*(r+0.5),dl=(hrn(r,si,seed,3)-0.5)*0.17+((r+si)%2?0.02:-0.02);
        const px=alongX?cx+mid:cx+lc,pz=alongX?cz+lc:cz+mid;
        addBox(B,px,topY+0.0125,pz,alongX?sl-0.02:rw-0.02,0.025,alongX?rw-0.02:sl-0.02,sh(dl,si,r),E);
        for(let g=0;g<2;g++){ const off=(hrn(r,si,seed,10+g)-0.5)*rw*0.55,gl=sl*(0.5+hrn(r,si,seed,20+g)*0.4);
          addBox(B,alongX?px+(hrn(r,si,seed,30+g)-0.5)*(sl-gl):px+off,topY+0.027,alongX?pz+off:pz+(hrn(r,si,seed,30+g)-0.5)*(sl-gl),alongX?gl:0.014,0.006,alongX?0.014:gl,sh(dl-0.09,si,r+g),E); }
        [-1,1].forEach(e=>{ if(sl>0.3) addBox(B,alongX?px+e*(sl/2-0.07):px,topY+0.028,alongX?pz:pz+e*(sl/2-0.07),0.04,0.008,0.04,0x2B2B2B,E); });
      }
      pos+=len; si++;
    }
  }
  /* sambungan papan vertikal di dua sisi panjang */
  const half=N/2+0.006;
  for(let t=-L/2+0.35;t<L/2-0.1;t+=0.62+hrn(Math.round(t*10),seed,6,1)*0.2) [-1,1].forEach(sd=>{
    addBox(B,alongX?cx+t:cx+sd*half,topY-0.34,alongX?cz+sd*half:cz+t,alongX?0.016:0.012,0.62,alongX?0.012:0.016,sh(-0.14,Math.round(t*10),sd),E);
  });
}
/* air: sel kecil dengan variasi biru (tanpa garis putih) */
const WATERPAL=[0x2D6BD8,0x3A7BE6,0x4789EE,0x2A62C6,0x3470DC,0x5596F2];
function waterDetail(B,cx,cz,y,w,d,seed,nx,nz){
  const E={edge:false},sx=w/nx,sz=d/nz;
  for(let i=0;i<nx;i++) for(let j=0;j<nz;j++)
    addBox(B,cx-w/2+sx*(i+0.5),y+0.006,cz-d/2+sz*(j+0.5),sx*0.98,0.012,sz*0.98,vcol(palAt(WATERPAL,hrn(i,j,seed,4)),seed,i,j,0.04),E);
}
const CRYSTAL_N=6; /* jumlah End Crystal progression (angka dadu 1..6): sekarang di puncak 6 tower kecil di pinggir papan */
/* ---------- Dragon Awakening versi papan ----------
   Tidak ada lagi arena kiri / tower besar. Alur: bidak 100 -> gempa -> kayu bingkai papan jadi bedrock -> 4 End Crystal pembangkit muncul
   di tengah papan -> 6 tower kecil (menggantikan 4 api sudut + 2 di tengah sisi kiri/kanan) muncul dengan End Crystal -> naga bangkit,
   crystal menyetrum naga (regenerasi) -> naga terbang di atas area papan World. Petak & dekor papan TIDAK berubah. */
const TOWER_SPOTS=[[-5.25,-5.25],[5.25,-5.25],[5.25,5.25],[-5.25,5.25],[-5.25,0],[5.25,0]]; /* urutan = End Crystal 1..6 */
const TOWER_BASE=1.15,TOWER_H=2.15,TOWER_CRY=TOWER_BASE+TOWER_H+0.55; /* dasar = permukaan bingkai luar; crystal melayang di atas kepala tower */
const CC_N=4,CC_R=1.5,CC_Y=1.9,CC_TOP=3.7; /* 4 crystal pembangkit: cincin di tengah papan; titik naga bangkit di atasnya */
const DRAGON_S=1; /* skala naga (dulu 1.3, sempat 2.2) */
const FLY={on:false,a:0,blend:0,cx:0,cz:0.8,rx:4.6,rz:2.8,y:8,dip:5,spd:0.2}; /* tinggi dasar y 8 (naik-turun +-0.5), lalu menukik turun sampai dip=5 (jadi sekitar y 3, dekat papan) di ujung kiri & kanan jalur angka delapan (jauh dari menara tengah). jalur terbang naga: angka delapan di atas area papan; blend 0 = melayang di titik bangkit, 1 = di jalur */
const QUAKE={amp:0}; /* getar kamera saat gempa */
var CORNERF=[]; /* api 4 sudut papan: diganti tower saat Awakening */
const ease3=k=>k*k*(3-2*k);
const _bv=new THREE.Vector3();
function placeBeam(m,a,b,w){ _bv.copy(b).sub(a); const L=_bv.length(); m.position.copy(a).addScaledVector(_bv,0.5); m.lookAt(b); m.scale.set(w,w,Math.max(0.001,L)); }
function crystalMesh(cs,ss){
  const cg=new THREE.Group();
  const cc=new THREE.Mesh(new THREE.BoxGeometry(cs,cs,cs),new THREE.MeshBasicMaterial({color:0xE040FF}));
  const sh=new THREE.Mesh(new THREE.BoxGeometry(ss,ss,ss),new THREE.MeshBasicMaterial({color:0x4AEDD9,transparent:true,opacity:0.38,depthWrite:false}));
  cc.rotation.set(0.6155,0,Math.PI/4); sh.rotation.copy(cc.rotation); cg.add(cc,sh); return {cg,cc,sh};
}
function buildArena(){
  const g=new THREE.Group(); g.visible=false;
  const E={edge:false};
  const glowTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,0.9)'); gr.addColorStop(0.4,'rgba(255,255,255,0.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gr; x.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); })();
  const mkSprite=(col)=>{ const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); m.visible=false; m.frustumCulled=false; g.add(m); return m; };
  const mkBeam=(col)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); m.visible=false; m.frustumCulled=false; g.add(m); return m; };
  /* kayu bingkai -> bedrock: lapisan bedrock sedikit lebih besar dari bingkai kayu, tumbuh dari bawah menutupi kayu */
  const FB=makeBatch(),FT=TILES[1].h,FO=FT+0.4;
  [[0,5.125,10.5,0.25,FT],[0,-5.125,10.5,0.25,FT],[5.125,0,0.25,10,FT],[-5.125,0,0.25,10,FT],
   [0,5.375,11,0.25,FO],[0,-5.375,11,0.25,FO],[5.375,0,0.25,10.5,FO],[-5.375,0,0.25,10.5,FO]].forEach((f,fi)=>{ const top=f[4]; voxShell(FB,f[0],(top-0.25)/2,f[1],f[2]+0.03,top+0.27,f[3]+0.03,0.22,BEDROCK,40+fi,E); });
  const frame=buildBatch(FB); frame.scale.y=0.001; frame.visible=false; g.add(frame);
  /* 6 tower kecil bedrock di pinggir papan (kaki lebar, batang, kepala lebar) */
  const towers=TOWER_SPOTS.map((q,i)=>{
    const tg=new THREE.Group(),TB=makeBatch(); tg.position.set(q[0],TOWER_BASE,q[1]); tg.visible=false;
    voxShell(TB,0,0.2,0,0.95,0.4,0.95,0.16,BEDROCK,50+i,E); voxShell(TB,0,1.15,0,0.62,1.5,0.62,0.155,BEDROCK,60+i,E); voxShell(TB,0,2.025,0,0.86,0.25,0.86,0.14,BEDROCK,70+i,E);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(c=>addBox(TB,c[0]*0.34,2.2,c[1]*0.34,0.1,0.1,0.1,0xE040FF,E));
    tg.add(buildBatch(TB)); g.add(tg); return tg; });
  /* 4 End Crystal pembangkit naga di tengah papan */
  const cm=[]; for(let i=0;i<CC_N;i++){ const m=crystalMesh(0.42,0.7); m.cg.visible=false; m.cg.scale.setScalar(0.001); g.add(m.cg); m.bm=mkBeam(0xE040FF); cm.push(m); }
  const burstS=mkSprite(0xE8B8FF);
  /* partikel energi spiral yang naik ke titik bangkit */
  const N=40,inst=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending}),N);
  inst.frustumCulled=false; let sd=2468; const lr2=()=>(sd=(sd*16807)%2147483647)/2147483647,pal=[0x4AEDD9,0xE040FF,0xB59CFF,0xFFFFFF],pt=[];
  for(let i=0;i<N;i++) pt.push({ph:lr2()*6.283,sp:0.5+lr2()*0.9,r:0.6+lr2()*1.3,c:new THREE.Color(pal[i%4])});
  inst.setColorAt(0,pt[0].c); g.add(inst);
  /* End Crystal progression 1..6: melayang di atas tiap tower; tampilan mengikuti pemain yang sedang giliran */
  const cvs=TOWER_SPOTS.map((q,i)=>{
    const m=crystalMesh(0.42,0.7),cg=m.cg; cg.position.set(q[0],TOWER_CRY,q[1]); cg.visible=false; g.add(cg);
    const c3=document.createElement('canvas'); c3.width=c3.height=64; const x3=c3.getContext('2d'); x3.fillStyle='rgba(10,6,20,0.7)'; x3.fillRect(8,8,48,48); x3.strokeStyle='#4AEDD9'; x3.lineWidth=3; x3.strokeRect(8,8,48,48); x3.fillStyle='#FFFFFF'; x3.font='bold 36px sans-serif'; x3.textAlign='center'; x3.textBaseline='middle'; x3.fillText(String(i+1),32,34);
    const lab=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c3),transparent:true,opacity:0,depthWrite:false})); lab.rotation.x=-Math.PI/2; lab.position.set(q[0],TOWER_CRY+0.62,q[1]); lab.visible=false; g.add(lab);
    const fl=mkSprite(0xFFFFFF);
    return {cg,cc:m.cc,cs2:m.sh,lab,fl,s:0,want:0,flash:0,hb:mkBeam(0xE040FF),hb2:mkBeam(0x9FFFF4)};
  });
  /* paket energi yang mengalir dari crystal ke naga (gimik regenerasi) */
  const HP=CRYSTAL_N*3,hp=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xB8FFF6,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending}),HP); hp.frustumCulled=false; hp.visible=false; g.add(hp);
  return {cv:cvs,act:-1,g,frame,towers,cm,burstS,inst,pt,hp,bed:0,tower:0,cc:0,ccE:0,burst:0,heal:0,m4:new THREE.Matrix4(),q:new THREE.Quaternion(),p:new THREE.Vector3(),sc:new THREE.Vector3(),col:new THREE.Color(),ca:new THREE.Vector3(),cb:new THREE.Vector3(),ct:new THREE.Vector3()};
}
function updateArena(dt,now){
  const A=ARENA; if(!A||!A.g.visible) return;
  const t=now*0.001,en=A.ccE,cs=ease3(A.cc);
  /* bingkai: kayu -> bedrock */
  A.frame.visible=A.bed>0.005; A.frame.scale.y=Math.max(0.001,ease3(A.bed));
  /* tower tumbuh bergantian dari pinggir papan; api sudut mengecil lalu padam */
  for(let i=0;i<A.towers.length;i++){ const k=ease3(clamp(A.tower*1.7-i*0.14,0,1)),tg=A.towers[i]; tg.visible=k>0.005; tg.scale.set(1,Math.max(0.001,k),1); }
  if(A.tower>0){ const k=clamp(A.tower*2.2,0,1); for(const f of CORNERF){ f.s=f.s0*Math.max(0.001,1-k); if(k>=1&&!f.out){ f.out=true; f.g.visible=false; f.halo.visible=false; } } }
  /* 4 crystal pembangkit: mengorbit pelan, beam menyatu di titik bangkit naga */
  A.ct.set(0,CC_TOP,0);
  for(let i=0;i<CC_N;i++){
    const m=A.cm[i],ang=i*Math.PI/2+Math.PI/4+t*(0.25+0.5*en);
    m.cg.visible=cs>0.01; m.cg.scale.setScalar(Math.max(0.001,cs));
    m.cg.position.set(Math.cos(ang)*CC_R,CC_Y+Math.sin(t*2+i)*0.1,Math.sin(ang)*CC_R); m.cg.rotation.y=t*(1.1+2.4*en);
    m.cc.material.color.setHex(en>0.5?0xFF6AFF:0xE040FF); m.sh.material.opacity=0.28+0.25*en+0.15*Math.sin(t*4);
    const bo=en*cs*(0.4+0.2*Math.sin(t*9+i)); m.bm.visible=bo>0.02; if(m.bm.visible){ m.bm.material.opacity=bo; placeBeam(m.bm,m.cg.position,A.ct,0.05+0.08*en); }
  }
  const bs=A.burstS; bs.visible=A.burst>0.01; if(bs.visible){ bs.position.set(0,CC_TOP,0); bs.material.opacity=Math.min(1,A.burst); bs.scale.setScalar(1+5.5*A.burst); }
  const on=en>0.02&&cs>0.5;
  for(let i=0;i<A.pt.length;i++){
    const o=A.pt[i];
    if(!on){ A.p.set(0,-9,0); A.sc.set(0.001,0.001,0.001); }
    else{ const k=((t*0.35*o.sp+o.ph)%1),ang=o.ph+t*(1.2+o.sp)+k*5,r=o.r*(1-k)+0.12,s2=(0.05+0.05*en)*(1-0.6*k); A.p.set(Math.cos(ang)*r,CC_Y-0.3+k*(CC_TOP-CC_Y+0.3),Math.sin(ang)*r); A.sc.set(s2,s2,s2); }
    A.m4.compose(A.p,A.q,A.sc); A.inst.setMatrixAt(i,A.m4); A.inst.setColorAt(i,A.col.copy(o.c).multiplyScalar(0.4+0.6*en));
  }
  A.inst.instanceMatrix.needsUpdate=true; if(A.inst.instanceColor) A.inst.instanceColor.needsUpdate=true;
  /* End Crystal progression di puncak tower + beam penyetrum ke naga */
  const dOK=A.heal>0.01&&dragon.visible&&!DRG.defeated; A.ct.set(dragon.position.x,dragon.position.y+0.15,dragon.position.z);
  let hn=0;
  for(let i=0;i<A.cv.length;i++){
    const c=A.cv[i],act=(i===A.act);
    c.s+=(c.want-c.s)*Math.min(1,dt*(c.want?4:9)); if(Math.abs(c.want-c.s)<0.004) c.s=c.want;
    c.flash=Math.max(0,c.flash-dt*1.6);
    c.cg.visible=c.s>0.02; c.cg.scale.setScalar(Math.max(0.001,c.s*(act?1.18+0.1*Math.sin(t*5):1)));
    c.cg.position.y=TOWER_CRY+Math.sin(t*2+i)*0.07; c.cg.rotation.y=t*(act?2.4:1);
    c.cs2.material.opacity=act?0.5:0.22; c.cc.material.color.setHex(act?0xFF8CFF:0xB030D0);
    c.lab.visible=c.s>0.5; c.lab.material.opacity=act?1:0.45;
    c.fl.visible=c.flash>0.01||act; c.fl.material.opacity=Math.min(1,c.flash*0.9+(act?0.12+0.08*Math.sin(t*5):0)); c.fl.scale.setScalar(0.8+(1-c.flash)*(c.flash>0?2.6:0.5)); c.fl.position.copy(c.cg.position);
    const live=dOK&&c.want&&c.s>0.5,bo=live?A.heal*(0.5+0.22*Math.sin(t*8+i*1.3)):0;
    c.hb.visible=c.hb2.visible=bo>0.02;
    if(c.hb.visible){ c.hb.material.opacity=bo*0.32; c.hb2.material.opacity=bo*0.7; A.ca.copy(c.cg.position); placeBeam(c.hb,A.ca,A.ct,0.09+0.03*Math.sin(t*11+i)); placeBeam(c.hb2,A.ca,A.ct,0.028); }
    for(let j=0;j<3;j++){ /* 3 paket per beam, mengalir crystal -> naga */
      const idx=i*3+j;
      if(live){ const k=(t*0.8+j/3+i*0.17)%1; A.p.copy(c.cg.position).lerp(A.ct,k); const sz=0.1*(0.5+0.5*Math.sin(k*Math.PI)); A.sc.set(sz,sz,sz); hn++; }
      else{ A.p.set(0,-9,0); A.sc.set(0.001,0.001,0.001); }
      A.m4.compose(A.p,A.q,A.sc); A.hp.setMatrixAt(idx,A.m4);
    }
  }
  A.hp.visible=hn>0; A.hp.instanceMatrix.needsUpdate=true;
}
/* ---------- Dragon Feature 2 (Mountain Collapse): gunung batu penutup Dragon Arena ----------
   Menggantikan farm kiri board. Formasi voxel (tebing barat, gunung kecil, bebatuan di kaki) berdiri tepat di atas arena yang tersembunyi.
   Satu InstancedMesh batu + satu retakan + satu debu; semua dikendalikan 4 angka (shake/crack/collapse/dust) yang di-tween awakenDragon, sama pola dengan ARENA.
   Pose runtuh per batu deterministik (awal -> akhir), jadi state akhir (rubble) mudah dipulihkan setelah ganti tema. PRNG lokal: urutan rnd() dunia tidak terganggu. */
const MT_CELL=0.8,MT_NX=7,MT_NZ=8,MT_MAXH=6;
function buildMountain(){
  const g=new THREE.Group(); g.position.set(ARENA_POS.x+MT_SHIFT,-0.04,ARENA_POS.z);
  let sd=7919; const r=()=>(sd=(sd*16807)%2147483647)/2147483647,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hx=MT_NX*MT_CELL/2,hz=MT_NZ*MT_CELL/2,H=[];
  for(let i=0;i<MT_NX;i++){ H.push([]); for(let j=0;j<MT_NZ;j++){
    const u=(i+0.5)/MT_NX,v=(j+0.5)/MT_NZ,dz=Math.abs(2*v-1),prof=u<0.34?1:Math.pow(Math.max(0,1-(u-0.34)/0.66*0.9),1.3); /* barat = tebing tinggi, timur = lereng turun ke papan */
    const h=5.6*prof*(1-0.45*Math.pow(dz,1.6))+1.5*Math.max(0,1-Math.hypot((u-0.58)*1.7,(v-0.18)*2.4)*1.3)+(r()-0.5)*0.8; /* + puncak kecil kedua */
    H[i].push(cl(Math.round(h),1,MT_MAXH));
  } }
  /* titik jatuh dibatasi: tidak ke papan/Start (api unggun) */
  const okAt=(x,z)=>{ const wx=ARENA_POS.x+MT_SHIFT+x,wz=ARENA_POS.z+z; return wx<=-8.3&&Math.hypot(wx-PAD.x,wz-PAD.z)>2.5; };
  const SINK_X=2.6+0.55,SINK_Z=2.8+0.55; /* mendarat di atas jejak arena (+margin) -> tertelan lubang arena, bukan jadi rubble */
  const ch=[],stones=[0x7F7F7F,0x777777,0x898989,0x707070,0x8E8E8E],moss=[0x6E8F5A,0x5F8A4A],dirt=[0x7A5A3A,0x8A6A44];
  function mk(x0,y0,z0,s,hex,stat){
    const c={x0,y0,z0,s,hex,stat,ph:r()*6.283,xf:x0,zf:z0,yf:y0,rx:0,ry:0,rz:0,sink:false,d:0};
    if(stat){ c.rx=(r()-0.5)*0.5; c.ry=r()*3.14; c.rz=(r()-0.5)*0.5; ch.push(c); return; }
    const a=Math.atan2(z0,x0)+(r()-0.5)*0.9; let push=0.6+r()*1.5+(y0/4.8)*1.1,xf=x0+Math.cos(a)*push,zf=z0+Math.sin(a)*push;
    for(let k=0;k<8&&!okAt(xf,zf);k++){ push*=0.72; xf=x0+Math.cos(a)*push; zf=z0+Math.sin(a)*push; }
    c.xf=xf; c.zf=zf; c.sink=Math.abs(xf)<SINK_X&&Math.abs(zf)<SINK_Z; c.yf=c.sink?-1.8:s*0.38;
    c.rx=(r()-0.5)*1.1; c.ry=r()*3.14; c.rz=(r()-0.5)*1.1;
    c.d=0.08*r()+0.46*cl(Math.hypot(x0+hx*0.6,z0*0.8)/(1.7*hx),0,1); /* runtuh menjalar dari tebing barat ke timur */
    ch.push(c);
  }
  for(let i=0;i<MT_NX;i++) for(let j=0;j<MT_NZ;j++) for(let l=0;l<H[i][j];l++){
    const top=l===H[i][j]-1; let hex=stones[Math.floor(r()*stones.length)];
    if(l===0) hex=0x636363; else if(top&&r()<0.28) hex=moss[Math.floor(r()*2)]; else if(r()<0.07) hex=dirt[Math.floor(r()*2)];
    mk((i+0.5)*MT_CELL-hx,(l+0.5)*MT_CELL,(j+0.5)*MT_CELL-hz,MT_CELL*0.985,hex,false);
  }
  for(let n=0,t=0;n<14&&t<80;t++){ /* bebatuan voxel di kaki gunung (tetap, ikut bergetar) */
    const a=r()*6.283,x=Math.cos(a)*(hx+0.5+r()*1.1),z=Math.sin(a)*(hz+0.5+r()*1.1); if(!okAt(x,z)) continue;
    const s=0.3+r()*0.28; mk(x,s*0.5,z,s,stones[Math.floor(r()*stones.length)],true); n++;
  }
  const col=new THREE.Color(),m4=new THREE.Matrix4();
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xFFFFFF}),ch.length); im.frustumCulled=false;
  ch.forEach((c,i)=>{ col.setHex(c.hex).multiplyScalar(0.9+0.2*r()); im.setColorAt(i,col); m4.makeScale(c.s,c.s,c.s); m4.setPosition(c.x0,c.y0,c.z0); im.setMatrixAt(i,m4); });
  g.add(im);
  /* retakan di permukaan atas: zigzag dari dataran tebing, muncul bertahap */
  const topY=(x,z)=>H[cl(Math.floor((x+hx)/MT_CELL),0,MT_NX-1)][cl(Math.floor((z+hz)/MT_CELL),0,MT_NZ-1)]*MT_CELL,cr=[];
  for(let a=0;a<8;a++){
    let ang=(a/8)*6.283+r()*0.5,x=-hx+1.0+r()*0.6,z=(r()-0.5)*1.2;
    for(let m=0;m<6;m++){
      ang+=(r()-0.5)*1.1; const len=0.4+r()*0.25,nx=x+Math.cos(ang)*len,nz=z+Math.sin(ang)*len; if(Math.abs(nx)>hx-0.05||Math.abs(nz)>hz-0.05) break;
      cr.push({x:(x+nx)/2,z:(z+nz)/2,y:topY((x+nx)/2,(z+nz)/2)+0.025,ang:Math.atan2(nx-x,nz-z),len,m}); x=nx; z=nz;
    }
  }
  const ck=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xFFFFFF}),Math.max(1,cr.length)); ck.frustumCulled=false; ck.setColorAt(0,col.setHex(0x14101C)); g.add(ck);
  /* debu: kubus abu-krem transparan, naik & melebar lalu menyusut */
  const pf=[]; for(let i=0;i<64;i++){ const a=r()*6.283; pf.push({x:(r()-0.5)*2*(hx+0.4),z:(r()-0.5)*2*(hz+0.4),dx:Math.cos(a)*(0.6+r()),dz:Math.sin(a)*(0.6+r()),h:0.9+r()*2.0,sz:0.5+r()*0.6,s:r()*0.55}); }
  const ds=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xC9C1B0,transparent:true,opacity:0.5,depthWrite:false}),pf.length); ds.frustumCulled=false; g.add(ds);
  return {g,im,ck,ds,ch,cr,pf,shake:0,crack:0,collapse:0,dust:0,sig:-1,m4,q:new THREE.Quaternion(),eu:new THREE.Euler(),p:new THREE.Vector3(),sc:new THREE.Vector3(),col:new THREE.Color(),c2:new THREE.Color()};
}
function updateMountain(dt,now){
  const M=MOUNT; if(!M) return;
  const t=now*0.001,sh=M.shake,ck=M.crack,c=M.collapse,ds=M.dust,sig=sh+ck*3+c*7+ds*13;
  const trembling=(sh>0||ck>0)&&c<=0; /* getaran bergantung waktu: update tiap frame selama belum runtuh */
  if(!trembling&&sig===M.sig) return; M.sig=sig;
  const amp=(sh*0.04+ck*0.05)*(reduce?0.5:1),sm=(a,b,x)=>{ const k=Math.max(0,Math.min(1,(x-a)/(b-a))); return k*k*(3-2*k); };
  for(let i=0;i<M.ch.length;i++){
    const o=M.ch[i],w=(c<=0||o.stat)?0:Math.max(0,Math.min(1,(c-o.d)/0.45));
    let x=o.x0,y=o.y0,z=o.z0,k=1,rx=o.stat?o.rx:0,ry=o.stat?o.ry:0,rz=o.stat?o.rz:0;
    if(w<=0){ const a=amp*(o.stat?0.5:(0.4+0.6*o.y0/4.8)); if(a>0){ x+=Math.sin(t*47+o.ph)*a; z+=Math.sin(t*53+o.ph*1.7)*a; y+=Math.abs(Math.sin(t*61+o.ph))*a*0.3; } }
    else{
      const e=1-(1-w)*(1-w); x=o.x0+(o.xf-o.x0)*e; z=o.z0+(o.zf-o.z0)*e; rx=o.rx*e; ry=o.ry*e; rz=o.rz*e;
      if(o.sink){ y=o.y0+(o.yf-o.y0)*w*w; k=1-sm(0.6,1,w); }
      else{ const u=Math.min(1,w/0.78); y=o.yf+(o.y0-o.yf)*(1-u*u); if(w>0.78) y+=Math.sin(Math.PI*(w-0.78)/0.22)*0.16*o.s; } /* jatuh dipercepat lalu memantul kecil */
    }
    M.eu.set(rx,ry,rz); M.q.setFromEuler(M.eu); M.p.set(x,y,z); const s=Math.max(0.0001,o.s*k); M.sc.set(s,s,s); M.m4.compose(M.p,M.q,M.sc); M.im.setMatrixAt(i,M.m4);
  }
  M.im.instanceMatrix.needsUpdate=true;
  const fade=1-Math.max(0,Math.min(1,c*8)); M.col.setHex(0x14101C); M.c2.setHex(0xC040FF); M.col.lerp(M.c2,Math.min(1,ck*ck));
  for(let i=0;i<M.cr.length;i++){
    const o=M.cr[i],q=Math.max(0,Math.min(1,ck*7-o.m))*fade;
    M.eu.set(0,o.ang,0); M.q.setFromEuler(M.eu); M.p.set(o.x,o.y,o.z); M.sc.set(q>0?0.075:0.0001,q>0?0.05:0.0001,Math.max(0.0001,o.len*q)); M.m4.compose(M.p,M.q,M.sc); M.ck.setMatrixAt(i,M.m4); M.ck.setColorAt(i,M.col);
  }
  M.ck.instanceMatrix.needsUpdate=true; if(M.ck.instanceColor) M.ck.instanceColor.needsUpdate=true;
  M.q.set(0,0,0,1);
  for(let i=0;i<M.pf.length;i++){
    const o=M.pf[i],w=Math.max(0,Math.min(1,(ds-o.s)/0.45)); let s=0.0001;
    if(w>0&&w<1){ s=o.sz*(0.3+1.4*Math.sin(Math.PI*Math.pow(w,0.7))); M.p.set(o.x+o.dx*w*1.6,0.15+w*o.h,o.z+o.dz*w*1.6); } else M.p.set(0,-9,0);
    M.sc.set(s,s,s); M.m4.compose(M.p,M.q,M.sc); M.ds.setMatrixAt(i,M.m4);
  }
  M.ds.instanceMatrix.needsUpdate=true;
}
function applyMountainState(){ const M=MOUNT; if(!M) return; const fin=AWK.done; M.shake=0; M.crack=0; M.collapse=fin?1:0; M.dust=fin?1:0; M.sig=-1; } /* selesai = rubble diam; belum = gunung utuh */
/* state Awakening sesuai AWK: dipanggil setelah world dibangun ulang (ganti tema) & saat game baru */
function flamesOut(out){ for(const f of CORNERF){ f.out=!!out; f.s=out?0.001:f.s0; f.g.visible=!out; f.halo.visible=!out; } }
function applyArenaState(){
  applyMountainState(); applyFortState(); /* map Nether: benteng/jembatan/skeleton/Wither (no-op bila FORT tak ada) */
  FLY.on=false; FLY.blend=0; FLY.a=0; QUAKE.amp=0;
  const A=ARENA; if(!A) return;
  const fin=AWK.done;
  A.g.visible=fin; A.bed=fin?1:0; A.tower=fin?1:0; A.cc=0; A.ccE=0; A.burst=0; A.heal=fin?1:0; /* selesai: bingkai bedrock + 6 tower + crystal menyetrum naga */
  A.cv.forEach(c=>{ c.want=0; c.s=0; c.flash=0; }); A.act=-1;
  flamesOut(fin);
  if(fin){ FLY.on=true; FLY.blend=1; syncCrystals(); }
}
/* Bidak yang sudah mencapai target 100 tetap di petak 100 (tidak ada arena kiri lagi); hanya ditandai siap melawan boss dan menghadap tengah papan. */
async function gatherArena(gid){
  if(!AWK.done) return;
  for(const pl of players){
    if(pl.pos!==GOAL||pl.inArena||!pl.pawn) continue;
    pl.inArena=true; pl.pawn.rotation.y=Math.atan2(-pl.pawn.position.x,-pl.pawn.position.z);
  }
}
function resetAwakening(){
  AWK.done=false; AWK.running=false; document.body.classList.remove('awk-lock');
  clearBossFx();
  applyArenaState();
}
/* ---------- Dragon Feature 3: End Crystal progression (per player) ----------
   p.crystal = jumlah crystal yang sudah dihancurkan pemain itu (0..6); p.dragonReady = READY menyerang Dragon (setelah semua crystal hancur).
   Crystal n hanya hancur bila pemain melempar angka n; selain itu tidak ada progress. Tidak menyentuh progress pemain lain.
   Tampilan 6 crystal di arena mengikuti pemain yang sedang giliran (pemain yang tidak di Block 100 = semua utuh). */
function crystalDone(p){ if(!p.cdone) p.cdone=new Array(CRYSTAL_N).fill(false); return p.cdone; } /* crystal n hancur bila pemain melempar n; urutan bebas */
function syncCrystals(){
  const A=ARENA; if(!A||!AWK.done) return;
  const p=players[cur],d=(p&&p.pos===GOAL)?crystalDone(p):new Array(CRYSTAL_N).fill(false);
  A.cv.forEach((c,i)=>{ c.want=d[i]?0:1; }); A.act=-1; /* tanpa target: semua crystal yang masih utuh setara */
}
/* ---------- Dragon Feature 5: Dragon Attack ----------
   Hanya pemain yang sudah menghancurkan semua Crystal (p.dragonReady) yang boleh menyerang. Angka serangan datang dari Special Dice (Feature 4);
   damage/HP/animasi/kemenangan tetap memakai hitDragon + playTurn existing (tidak ada combat baru). */
function canAttackDragon(p){ return !!(p&&p.dragonReady&&p.crystal>=CRYSTAL_N&&p.pos===GOAL&&AWK.done&&!AWK.running&&!gameOver&&!DRG.defeated); }
let BOSS_FX_TIMER=0;
function bossFxRoot(){
  let root=document.getElementById('bossFx');
  if(root) return root;
  root=document.createElement('div'); root.id='bossFx'; root.setAttribute('aria-hidden','true');
  const label=document.createElement('b'); label.className='boss-hit-label'; label.textContent='Critical';
  const damage=document.createElement('span'); damage.className='boss-hit-damage';
  root.appendChild(label); root.appendChild(damage); document.body.appendChild(root);
  return root;
}
function setBossFightFx(active){
  const root=active?bossFxRoot():document.getElementById('bossFx');
  if(!root) return;
  root.classList.toggle('fight',!!active);
  if(active) root.classList.add('active');
  else if(!root.classList.contains('hit')) root.classList.remove('active');
}
function bossCinemaHit(){
  if(reduce) return;
  let layer=document.getElementById('hitFx');
  if(!layer){ layer=document.createElement('div'); layer.id='hitFx'; document.body.appendChild(layer); }
  const add=(cls,style)=>{ const e=document.createElement('div'); e.className=cls; Object.assign(e.style,style||{}); layer.appendChild(e); setTimeout(()=>e.remove(),800); };
  add('hf-cinema');
  add('hf-wave',{left:(window.innerWidth/2)+'px',top:(window.innerHeight/2)+'px'});
  [-26,-8,10,28].forEach((d,i)=>add('hf-wind',{left:(window.innerWidth/2-20+i*6)+'px',top:(window.innerHeight/2+d)+'px',animationDelay:(i*40)+'ms'}));
  add('hf-flash');
  document.body.classList.add('hf-shake'); setTimeout(()=>document.body.classList.remove('hf-shake'),360);
}
function bossHitFx(damage,remote,keepVignette){
  if(!remote&&MP_SEQ===0) mpCue({k:'bosshfx',dmg:damage,fight:!!keepVignette});
  const root=bossFxRoot(),damageEl=root.querySelector('.boss-hit-damage');
  damageEl.textContent='-'+Math.max(0,Number(damage)||0);
  root.classList.toggle('critical',!!keepVignette);
  if(keepVignette) root.classList.add('fight');
  root.classList.add('active');
  root.classList.remove('hit'); void root.offsetWidth; root.classList.add('hit');
  bossCinemaHit();
  clearTimeout(BOSS_FX_TIMER);
  BOSS_FX_TIMER=setTimeout(()=>{
    BOSS_FX_TIMER=0; root.classList.remove('hit');
    if(!root.classList.contains('fight')) root.classList.remove('active');
  },700);
}
function clearBossFx(){
  clearTimeout(BOSS_FX_TIMER); BOSS_FX_TIMER=0;
  const root=document.getElementById('bossFx');
  if(root) root.classList.remove('active','fight','hit','critical');
}
function showDragonBoss(p,gid,text,ttl){
  const awakening=AWK.running;
  hud('showCombat',awakening?'':p.name,awakening?'':'Ender Dragon',awakening?'':text,{hp:p.dhp,maxHp:p.hpMax,bossName:'Ender Dragon',owner:p.name,gid,ttl:awakening?30000:ttl,awakening});
}
/* ---------- Dragon Feature 6: Dragon Defeat & Reward ----------
   Efek/suara/feedback kalah memakai yang existing di hitDragon + celebrate (sfx.dragonDeath, panel "Ender Dragon kalah!", konfeti, sfx.win).
   Hadiah = PlayerData.grant existing (nominal: UT.Gameplay.Config.DRAGON_REWARD). Tidak ada currency/reward system baru.
   Anti-ganda: (1) DRG.defeated menutup hitDragon begitu naga kalah, (2) DRG.done/busy mengunci settle, (3) token unik per game dicocokkan dengan catatan tersimpan.
   Catatan kemenangan lokal 'ut-dragon-win' sudah dihapus (Tahap 4); hadiah & batas harian di server. */
const DRG={defeated:false,done:false,busy:false,token:'',result:null,text:'',rewardStatus:null,reward:null};
function resetDragonDefeat(){ DRG.defeated=false; DRG.done=false; DRG.busy=false; DRG.result=null; DRG.text=''; DRG.rewardStatus=null; DRG.reward=null; DRG.token='dw-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); }
function setBossRewardStatus(gid,message){ DRG.rewardStatus={gameId:gid,message}; setWinRewardStatus(gid,message); }
/* Tahap 4: catatan kemenangan lokal ('ut-dragon-win') dihapus. Hadiah & batas harian ditentukan SERVER (serverBossClaim);
   anti-ganda tetap lewat DRG.done/busy (sinkron) + token per game yang dicocokkan server. Sisa key lama dibersihkan sekali. */
try{ for(let i=localStorage.length-1;i>=0;i--){ const k=localStorage.key(i); if(k&&(k==='ut-dragon-win'||k.indexOf('ut-dragon-win:corrupt:')===0)) localStorage.removeItem(k); } }catch(e){}
/* Idempoten: panggilan ke-2 dst untuk game yang sama TIDAK memberi hadiah lagi. Sinkron (tanpa await) agar tidak bisa disela game baru. */
function settleDragonDefeat(p){
  if(DRG.done||DRG.busy) return {status:'duplicate'};
  DRG.busy=true;
  try{
    if(p.cpu){ DRG.done=true; return DRG.result={status:'no-reward'}; } /* CPU menang = pemain kalah: tidak ada hadiah */
    if(window.PlayerData&&PlayerData.serverMode&&PlayerData.serverMode()){ /* hadiah ditentukan & dibayar SERVER (async); klien tidak memberi koin/gem */
      DRG.done=true; serverBossClaim(p,gameId);
      return DRG.result={status:'pending'};
    }
    return DRG.result={status:'unavailable'}; /* tanpa akun login: tidak ada jalur lokal, hadiah tidak diberikan */
  }finally{ DRG.busy=false; }
}
/* B5: klaim hadiah boss ke server. Online: hanya pemenang yang boleh (server memeriksa); room harus sudah 'finished' -> coba ulang sebentar.
   Lawan CPU/lokal: idempoten per token match, dibatasi harian oleh server. Nominal dari server, bukan dari klien. */
async function serverBossClaim(p,gid){
  const W=window.UT&&UT.WalletService&&UT.WalletService.get();
  if(!W){ setBossRewardStatus(gid,'Hadiah boss tidak dapat dimuat.'); return; }
  try{
    let r;
    if(ONLINE_ROOM){
      if(!isLocalPlayer(p)) return; /* hanya perangkat pemenang yang mengklaim */
      for(let n=0;n<7;n++){ r=await W.claimBossOnline(ROOM_CFG.roomId); if(!r||(r.reason!=='room_not_finished'&&r.reason!=='no_result')) break; await new Promise(ok=>setTimeout(ok,1500)); }
    }else r=await W.claimBossCpu(DRG.token);
    const bn=BOSS==='wither'?'Wither':'Dragon';
    if(r&&r.ok&&!r.duplicate){
      if(!Number.isFinite(r.reward_coins)||r.reward_coins<0||!Number.isFinite(r.reward_gems)||r.reward_gems<0){
        setBossRewardStatus(gid,'Data hadiah '+bn+' tidak lengkap.');
        return;
      }
      const parts=[]; if(r.reward_coins>0) parts.push('+'+r.reward_coins+' Coin'); if(r.reward_gems>0) parts.push('+'+r.reward_gems+' Gem');
      DRG.reward={gameId:gid,coins:r.reward_coins,gems:r.reward_gems};
      setWinReward(gid,'coins',r.reward_coins); setWinReward(gid,'gems',r.reward_gems);
      DRG.text='Hadiah: '+parts.join(' · ')+'.';
      if(DRG.rewardStatus&&DRG.rewardStatus.gameId===gid) DRG.rewardStatus=null;
      setMsg(p.name+' mendapat hadiah '+bn+': '+parts.join(', ')+'.'); try{ sfx.rewardpower(); hud('showResult','Hadiah '+bn,parts.join('  '),{ttl:2200,gid}); }catch(e){}
    }else if(r&&(r.reason==='daily_cap'||r.reason==='terlalu-cepat')){
      setBossRewardStatus(gid,'Batas hadiah '+bn+' harian tercapai.'); setMsg(DRG.rewardStatus.message);
    }else if(r&&r.ok===false&&r.reason!=='sudah-klaim'&&r.reason!=='not_winner'&&r.reason!=='mode-lokal'){
      setBossRewardStatus(gid,'Hadiah '+bn+' gagal disimpan.'); setMsg(DRG.rewardStatus.message);
    }else if(!r) setBossRewardStatus(gid,'Hadiah '+bn+' tidak dapat dimuat.');
  }catch(e){ setBossRewardStatus(gid,'Hadiah boss gagal dimuat.'); console.warn('[wallet] klaim boss gagal',e); }
}
/* Dipanggil playTurn setelah efek kemenangan (celebrate). Settle sudah terjadi saat naga kalah; di sini hanya feedback hadiah. */
async function dragonDefeatReward(p,gid){
  const R=(DRG.done?DRG.result:null)||settleDragonDefeat(p);
  if(!R||R.status!=='granted'){
    if(R&&(R.status==='failed'||R.status==='unavailable')) setMsg('Hadiah '+(BOSS==='wither'?'Wither':'Dragon')+' gagal disimpan.');
    return;
  }
  const parts=[]; if(R.coins>0) parts.push('+'+R.coins+' Coin'); if(R.gems>0) parts.push('+'+R.gems+' Gem');
  DRG.text='Hadiah: '+parts.join(' · ')+'.';
  const bn=BOSS==='wither'?'Wither':'Dragon';
  setMsg(p.name+' mendapat hadiah '+bn+': '+parts.join(', ')+'.');
  sfx.rewardpower(); hud('showResult','Hadiah '+bn,parts.join('  '),{ttl:2200,gid});
  await sleep(1500);
}
async function crystalRoll(p,v,gid){
  const S=async pr=>{ await pr; if(gid!==gameId) throw STALE; },n=v,d=crystalDone(p);
  if(n>CRYSTAL_N||d[n-1]){
    const why=n>CRYSTAL_N?'Tidak ada Crystal '+n+'.':'Crystal '+n+' sudah hancur.';
    setMsg(p.name+' melempar '+v+'. '+why+' Tidak ada progress.'); fb('event','dragon',why+' (dapat '+v+')',{gid,ttl:1800}); if(d[n-1]) sfx.crystalDestroyed(); else sfx.bounce(); /* Crystal n sudah hancur -> suara 'crystal was destroyed', bukan bounce */
    await S(sleep(900)); return false;
  }
  d[n-1]=true; p.crystal++; syncCrystals();
  const c=ARENA&&ARENA.cv[n-1]; if(c){ c.flash=1; } sfx.crystalBreak();
  setMsg(p.name+' menghancurkan Crystal '+n+'! ('+p.crystal+'/'+CRYSTAL_N+')'); fb('event','dragon','Crystal '+n+' hancur! '+p.crystal+'/'+CRYSTAL_N,{gid,ttl:1800});
  await S(sleep(900)); renderChips();
  if(p.crystal>=CRYSTAL_N){
    p.dragonReady=true; setMsg(p.name+' READY menyerang Ender Dragon!'); fb('event','dragon',p.name+' READY menyerang Dragon!',{gid,ttl:2400}); sfx.crystalsCleared();
    hud('hideCombat');
    renderChips(); await S(sleep(700));
  }
  return true;
}
/* Kamera saat Dragon bangkit: menyorot tengah papan (tempat 4 crystal & naga muncul), sedikit lebih jauh agar 6 tower di pinggir ikut terlihat. Pergeseran dihitung seperti fortCamPan (mode LOCK / ANGLE). */
const AWK_CAM={zoomK:1.12,topY:2.2}; /* zoomK >1 = lebih jauh; topY = tinggi titik sorot */
function awakenCamPan(){
  let bx=CAM_BASE.x,bz=CAM_BASE.z,by=CAM_BASE.y;
  if(camLocked()){ bx=lockCenter.x; bz=lockCenter.z; by=LOCK_BOX.y; }
  else if(isTopDown){ bx=0; bz=0; by=3.5; }
  else if(!camFollowing()){ bx=camHold.x; bz=camHold.z; by=camHold.y; }
  else if(focus){ bx+=focus.position.x*0.35; bz+=focus.position.z*0.35; by+=(focus.position.y-CAM_BASE.y)*0.45; }
  return {x:clamp(-bx,-PAN_MAX,PAN_MAX),z:clamp(-bz,-PAN_MAX,PAN_MAX),y:Math.max(0,AWK_CAM.topY-by)};
}
async function awakenDragon(p,gid){
  if(AWK.done||AWK.running) return; /* hanya 1x */
  const S=async pr=>{ await pr; if(gid!==gameId) throw STALE; },F=reduce?0.35:1,A=ARENA,Dd=dragon.userData;
  const QW=(d,fn)=>S(tween(d,k=>{ if(gid===gameId) fn(k); })); /* tween lama tidak dibersihkan saat game baru: jangan tulis ke state game lain */
  AWK.running=true; document.body.classList.add('awk-lock'); setBossFightFx(true); setRoll(false); clearTurnTimer(); dragonMusicStart();
  showDragonBoss(p,gid,'',30000);
  const pg={x:panGoal.x,z:panGoal.z,zoom:goal.zoom}; let finished=false,qk=null,tw=null,ar=null;
  try{
    while(paused) await S(sleep(200)); /* pause dibuka sebelum sequence: tunggu dilanjutkan */
    setMsg('Block 100 aktif! Papan mulai bergetar...'); fb('event','dragon','Dragon Awakening!',{gid,ttl:2600}); qk=sfx.quakeStart(); /* SFX existing (assets/sfx/dragon-awakening.mp3, fallback sintetis); tanpa audio system baru */
    if(!A){ await S(sleep(700*F)); FLY.on=true; FLY.blend=1; dragon.position.set(0,FLY.y,0); dragon.visible=true; showDragonBoss(p,gid,'Ender Dragon bangkit!',8000); finished=true; return; }
    A.g.visible=true;
    { const c=awakenCamPan(); panGoal.x=c.x; panGoal.z=c.z; panGoal.y=c.y; goal.zoom=pg.zoom*AWK_CAM.zoomK; } /* kamera menyorot tengah papan (kosmetik; dipulihkan di akhir) */
    /* 2. gempa */
    await QW(1.3*F,k=>{ QUAKE.amp=0.2*k; });
    /* 3. kayu bingkai papan berubah jadi bedrock */
    setMsg('Kayu papan berubah menjadi bedrock...'); ar=sfx.arenaUp();
    await QW(2.0*F,k=>{ A.bed=k; QUAKE.amp=0.2; });
    sfx.arenaStop(ar); ar=null;
    await QW(0.6*F,k=>{ QUAKE.amp=0.2*(1-k); }); sfx.quakeStop(qk); qk=null; QUAKE.amp=0;
    /* 4. 4 End Crystal pembangkit naga muncul di tengah papan */
    setMsg('4 End Crystal pembangkit muncul di tengah papan...'); sfx.crystalAppear();
    await QW(0.9*F,k=>{ A.cc=k; });
    hud('hideCombat'); setBossFightFx(false);
    setMsg('Energi Crystal berkumpul...'); await QW(1.3*F,k=>{ A.ccE=k; });
    /* 5. 6 tower kecil (menggantikan api di pinggir papan) muncul dengan End Crystal */
    setMsg('6 Tower Crystal muncul di pinggir papan...'); tw=sfx.towerRise();
    await QW(1.7*F,k=>{ A.tower=k; });
    sfx.crystalAppear(); A.cv.forEach(c=>{ c.want=1; c.flash=0.7; }); A.act=0; /* progress per pemain ditentukan saat giliran (syncCrystals) */
    await S(sleep(500*F));
    /* 6. naga muncul di atas tengah papan; 4 crystal pembangkit habis, 6 crystal tower menyetrum naga (regenerasi) */
    setMsg('Ender Dragon bangkit!'); sfx.dragonSpawn();
    dragon.visible=true; FLY.on=true; FLY.blend=0; FLY.a=0; Dd.dy=0; Dd.shk=0; Dd.hd=0; Dd.roll=0; dragon.position.set(0,CC_TOP,0); dragon.scale.setScalar(0.05);
    await QW(0.6*F,k=>{ A.burst=Math.sin(k*Math.PI*0.5); });
    await QW(1.0*F,k=>{ dragon.scale.setScalar(0.05+(DRAGON_S-0.05)*k); A.burst=1-k; });
    sfx.towerStop(tw); tw=null; dragon.scale.setScalar(DRAGON_S);
    await QW(0.8*F,k=>{ A.cc=1-k; A.ccE=1-k; });
    setMsg('Crystal menyetrum Dragon: regenerasi aktif!'); sfx.crystalAppear();
    await QW(0.9*F,k=>{ A.heal=k; });
    /* 7. naga lepas landas dan terbang di atas area papan World */
    setMsg('Ender Dragon terbang di atas papan!');
    await QW(2.4*F,k=>{ FLY.blend=ease3(k); });
    finished=true;
  }finally{
    sfx.quakeStop(qk); sfx.towerStop(tw); sfx.arenaStop(ar);
    if(gid===gameId){ /* STALE (game baru) ditangani resetAwakening di startGame */
      if(!finished&&A){ A.bed=1; A.tower=1; A.cc=0; A.ccE=0; A.burst=0; A.heal=1; A.cv.forEach(c=>{ c.want=1; }); flamesOut(true); dragon.visible=true; FLY.on=true; FLY.blend=1; dragon.scale.setScalar(DRAGON_S); } /* error tak terduga: jangan sampai game macet */
      hud('hideCombat');
      QUAKE.amp=0; panGoal.x=pg.x; panGoal.z=pg.z; panGoal.y=0; goal.zoom=pg.zoom; AWK.done=true; AWK.running=false; document.body.classList.remove('awk-lock'); applyMountainState();
    }
  }
}
/* ---------- Finale Nether (BOSS 'wither'): Benteng + 6 Skeleton Hitam + Wither 120 HP ----------
   Alur: pemain menginjak petak GOAL -> kamera menyorot tengah benteng + musik boss -> 6 Skeleton Hitam muncul -> tembok barat (sisi papan) runtuh -> jembatan muncul
   -> bidak menyeberang. Skeleton n mati bila pemain melempar n (dadu tahan-lepas yang sama dengan fase Crystal The End; pemain menyerang dgn animasi memukul).
   Semua mati -> gemuruh, Wither muncul dari bawah benteng (kubus terlempar). Wither (120 HP, damage = angka dadu x DMG) dilawan dgn dadu tahan-lepas yang sama.
   Skeleton & Wither TIDAK menyerang. Menang/kalah lewat celebrate -> finishGame (sama seperti Ender Dragon). Memakai ulang AWK/DRG/crystalDone/p.crystal/p.dragonReady/p.dhp. */
const WITHER_HP=120,WF={risen:false,cam:false,shot:false,SC:1.5};
function fortSlot(pi){ const F=FORT; return new THREE.Vector3(F.x0+0.45,F.fl,F.cz+[-0.66,-0.22,0.22,0.66][pi%4]); } /* tepat di ujung jembatan (jembatan berakhir di x0): x0+0.45 = tepat di balik ambang masuk; z dirapatkan agar sejajar lebar jembatan */
function fitZoom(w,h){ const t=Math.tan(camera.fov*Math.PI/360),a=camera.aspect||1,m=1.1; return Math.max((w/2*m)/(t*a),(h/2*m)/t)/baseDist; }
function fortZoom(close){ const z=close?fitZoom(8.4,7.0):fitZoom(10.4,8.6); return camLocked()?z:Math.max(0.4,z); }
function fortCamPan(){ /* pergeseran kamera agar tengah benteng ada di tengah layar (sesuai mode LOCK / ANGLE) */
  let bx=CAM_BASE.x,bz=CAM_BASE.z;
  if(camLocked()){ bx=lockCenter.x; bz=lockCenter.z; }
  else if(isTopDown){ bx=0; bz=0; }
  else if(!camFollowing()){ bx=camHold.x; bz=camHold.z; }
  else if(focus){ bx+=focus.position.x*0.35; bz+=focus.position.z*0.35; }
  return {x:clamp(FORT.cx-bx,-PAN_MAX,PAN_MAX),z:clamp(FORT.cz-bz,-PAN_MAX,PAN_MAX)};
}
function syncBossCam(){ /* saat pemain yang giliran ada di benteng: kamera menyorot benteng; selain itu kembali ke papan utuh (hanya mode LOCK) */
  if(BOSS!=='wither'||!FORT||AWK.running||!camLocked()) return;
  const p=players[cur],want=!!(p&&AWK.done&&p.pos===GOAL&&p.inArena&&!gameOver);
  if(want){ const c=fortCamPan(); panGoal.x=c.x; panGoal.z=c.z; goal.zoom=fortZoom(true); WF.cam=true; }
  else if(WF.cam){ WF.cam=false; panGoal.x=0; panGoal.z=0; goal.zoom=lockZoom(); }
}
/* Skeleton Hitam: tengkorak & tulang hitam, mata menyala oranye, memegang pedang batu */
function addWSkeleton(B,x,z,h){
  const w=0x2A2A30,w2=0x1B1B20,d=0x0A0A0C,F={edge:false};
  const q=(dx,dy,dz,ww,hh,dd,c,f)=>addBox(B,x+dx,h+dy,z+dz,ww,hh,dd,c,f);
  [-1,1].forEach(a=>{ q(a*0.06,0.15,0,0.06,0.3,0.06,w); q(a*0.06,0.015,0.02,0.07,0.03,0.1,w2,F); });
  q(0,0.32,0,0.17,0.05,0.08,w2);
  q(0,0.47,-0.005,0.17,0.28,0.07,0x121216);
  q(0,0.47,0,0.03,0.28,0.04,w2,F);
  [0.37,0.44,0.51,0.58].forEach(y=>q(0,y,0.012,0.2,0.035,0.09,w));
  [-1,1].forEach(a=>{ q(a*0.15,0.64,0,0.07,0.07,0.07,w2); q(a*0.17,0.45,0,0.05,0.28,0.05,w); });
  q(0,0.72,0,0.22,0.22,0.22,w);
  q(0,0.835,0,0.18,0.01,0.18,w2,F);
  [-1,1].forEach(a=>{ q(a*0.055,0.74,0.115,0.065,0.065,0.02,d,F); q(a*0.055,0.74,0.126,0.03,0.03,0.01,0xFF6A1A,F); });
  q(0,0.64,0.115,0.12,0.04,0.02,d,F);
  q(0.24,0.5,0.12,0.04,0.46,0.025,0x6A6A76); q(0.24,0.27,0.12,0.1,0.04,0.04,0x3A2A1E); q(0.24,0.2,0.12,0.04,0.12,0.04,0x3A2A1E); /* pedang batu */
}
function numSprite(n){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const g=cv.getContext('2d');
  g.fillStyle='rgba(18,8,8,.85)'; g.beginPath(); g.arc(32,32,28,0,6.2832); g.fill(); g.lineWidth=4; g.strokeStyle='#ff8a1a'; g.stroke();
  g.fillStyle='#fff'; g.font='bold 38px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(n),32,35);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false,fog:false}));
  s.scale.setScalar(0.4); s.position.y=1.5; s.renderOrder=5; return s;
}
/* Kubus pecahan (batu/tulang/debu): satu InstancedMesh bersama, dipakai tembok runtuh, skeleton mati, Wither muncul/kalah */
const WFX={n:150,o1:new THREE.Color(0xFF7A12),o2:new THREE.Color(0xD92B0A),o3:new THREE.Color(0x3A3236),im:null,st:[],i:0,on:false,m4:new THREE.Matrix4(),q:new THREE.Quaternion(),e:new THREE.Euler(),p:new THREE.Vector3(),s:new THREE.Vector3(),c:new THREE.Color()};
function wfxInit(){
  if(WFX.im) return;
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xFFFFFF}),WFX.n); im.frustumCulled=false;
  WFX.c.setHex(0x888888); WFX.m4.makeScale(0.0001,0.0001,0.0001);
  for(let i=0;i<WFX.n;i++){ WFX.st.push({life:0,max:1,x:0,y:-50,z:0,vx:0,vy:0,vz:0,rx:0,ry:0,a:0,b:0,s:0.1,fl:-99,g:9,fire:0}); im.setColorAt(i,WFX.c); im.setMatrixAt(i,WFX.m4); }
  scene.add(im); WFX.im=im;
}
function burstCubes(x,y,z,n,o){
  o=o||{}; wfxInit(); const cols=o.cols||[0x2A2A30,0x3C3C46,0x55555E,0x1C161E];
  for(let k=0;k<n;k++){
    const s=WFX.st[WFX.i]; WFX.i=(WFX.i+1)%WFX.n; const a=Math.random()*6.2832,sp=(o.sp||2.2)*(0.4+Math.random()*0.8);
    s.x=x+(Math.random()-0.5)*(o.spread||0.3); s.y=y; s.z=z+(Math.random()-0.5)*(o.spread||0.3);
    s.vx=Math.cos(a)*sp; s.vz=Math.sin(a)*sp; s.vy=(o.up||3)*(0.5+Math.random()*0.7);
    s.s=(o.size||0.14)*(0.6+Math.random()*0.9); s.life=s.max=(o.life||1.3)*(0.7+Math.random()*0.5);
    s.rx=(Math.random()-0.5)*8; s.ry=(Math.random()-0.5)*8; s.a=Math.random()*6; s.b=Math.random()*6; s.fl=o.floor===undefined?-99:o.floor; s.g=o.grav===undefined?9:o.grav; s.fire=o.fire?1:0;
    WFX.im.setColorAt(WFX.i===0?WFX.n-1:WFX.i-1,WFX.c.setHex(cols[Math.floor(Math.random()*cols.length)])); WFX.im.instanceColor.needsUpdate=true; WFX.on=true;
  }
}
/* Ledakan api + asap (ganti kubus warna-warni): blok kecil warna api naik pelan seperti semburan api naga, lalu asap abu-abu. k = skala besar ledakan */
function fireBurst(x,y,z,k,floor){
  k=k||1; const fl=floor===undefined?-99:floor;
  burstCubes(x,y,z,Math.round(16*k),{fire:1,up:1.5*k,sp:0.9,size:0.055,spread:0.25*k,grav:-1.2,life:0.9,floor:fl});            /* api: kecil, naik, kuning->oranye->merah */
  burstCubes(x,y+0.1,z,Math.round(8*k),{cols:[0x26262B,0x34343A,0x4A4A52],up:0.9,sp:0.45,size:0.09,spread:0.3*k,grav:-0.9,life:1.7,floor:fl}); /* asap */
}
function updateWFX(dt){
  if(!WFX.im||!WFX.on) return; let any=false;
  for(let i=0;i<WFX.n;i++){
    const s=WFX.st[i]; if(s.life<=0) continue;
    s.life-=dt;
    if(s.life<=0){ WFX.m4.makeScale(0.0001,0.0001,0.0001); WFX.im.setMatrixAt(i,WFX.m4); continue; }
    any=true; s.vy-=s.g*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.z+=s.vz*dt; s.a+=s.rx*dt; s.b+=s.ry*dt;
    if(s.y<s.fl+s.s*0.5){ s.y=s.fl+s.s*0.5; s.vy=0; s.vx*=0.85; s.vz*=0.85; s.rx*=0.7; s.ry*=0.7; } /* mendarat di lantai benteng */
    const k=Math.min(1,s.life/(s.max*0.35)),sc=s.s*k;
    if(s.fire){ const t=1-s.life/s.max,c=WFX.c; if(t<0.3) c.setHex(0xFFD23C).lerp(WFX.o1,t/0.3); else if(t<0.65) c.copy(WFX.o1).lerp(WFX.o2,(t-0.3)/0.35); else c.copy(WFX.o2).lerp(WFX.o3,(t-0.65)/0.35); WFX.im.setColorAt(i,c); WFX.im.instanceColor.needsUpdate=true; }
    WFX.e.set(s.a,s.b,0); WFX.q.setFromEuler(WFX.e); WFX.p.set(s.x,s.y,s.z); WFX.s.set(sc,sc,sc); WFX.m4.compose(WFX.p,WFX.q,WFX.s); WFX.im.setMatrixAt(i,WFX.m4);
  }
  WFX.im.instanceMatrix.needsUpdate=true; if(!any) WFX.on=false;
}
function wfxClear(){ if(!WFX.im) return; WFX.m4.makeScale(0.0001,0.0001,0.0001); for(let i=0;i<WFX.n;i++){ WFX.st[i].life=0; WFX.im.setMatrixAt(i,WFX.m4); } WFX.im.instanceMatrix.needsUpdate=true; WFX.on=false; }
/* Dibangun addFortress (BOSS 'wither'): jembatan 3 blok (tersembunyi), puing tembok, 6 Skeleton Hitam (tersembunyi). pg = grup tembok barat. */
function buildWitherFort(Fo,pg){
  const x0=Fo.x0,x1=Fo.x1,z0=Fo.z0,z1=Fo.z1,y=Fo.y,cx=(x0+x1)/2,cz=(z0+z1)/2,T=0.5,F={edge:false};
  const f={x0,x1,z0,z1,y,cx,cz,T,fl:y+0.04,pg,bridge:[],sk:[],rub:null};
  for(let i=0;i<3;i++){ /* jembatan: blok batu hitam + pagar rendah, muncul satu per satu dari lava */
    const b=makeBatch();
    addBox(b,0,-0.46,0,1,0.92,1,jit(0x241821,0.05));
    addBox(b,0,-0.08,0,1,0.16,1,jit([0x34262F,0x3C2D37,0x2C2029][i],0.05),F);
    [-1,1].forEach(a=>{ addBox(b,0,0.1,a*0.44,1,0.14,0.12,jit(0x2A1C24,0.04),F); [-1,1].forEach(c=>addBox(b,c*0.44,0.2,a*0.44,0.12,0.3,0.12,jit(0x4A2A38,0.04),F)); });
    const g=new THREE.Group(); g.add(buildBatch(b)); g.position.set(x0-2.5+i,y,cz); g.visible=false; world.add(g); f.bridge.push({g,x:g.position.x});
  }
  const rb=makeBatch(); /* puing tembok runtuh di ambang masuk */
  for(let k=0;k<9;k++){ const sz=0.14+fhash(k,41)*0.2; addBox(rb,x0+0.1+fhash(k,42)*0.55,y+sz*0.4,cz+(fhash(k,43)-0.5)*3.0,sz,sz*(0.6+fhash(k,44)*0.6),sz*(0.8+fhash(k,45)*0.4),shHex([0x2B1B24,0x35212D,0x231820][k%3],(fhash(k,46)-0.5)*0.2),F); }
  f.rub=buildBatch(rb); f.rub.visible=false; world.add(f.rub);
  const px=[cx-1.25,cx,cx+1.25],pz=[cz-1.55,cz+1.55]; /* baris utara 1-3, baris selatan 4-6 (kiri -> kanan) */
  for(let i=0;i<6;i++){
    const sx=px[i%3],sz=pz[i<3?0:1],sb=makeBatch(); addWSkeleton(sb,0,0,0);
    const sg=new THREE.Group(),body=buildBatch(sb),lab=numSprite(i+1); sg.add(body); sg.add(lab);
    sg.position.set(sx,f.fl,sz); sg.rotation.y=Math.atan2(cx-sx,cz-sz); sg.scale.setScalar(1.35); sg.visible=false; world.add(sg);
    f.sk.push({g:sg,body,lab,x:sx,z:sz,s:0,want:0,busy:false,ph:i*1.7});
  }
  FORT=f; return f;
}
function updateFort(dt,t){
  const F=FORT; if(!F) return;
  F.sk.forEach(s=>{
    if(s.busy) return;
    s.s+=(s.want-s.s)*Math.min(1,dt*(s.want?5:9)); if(Math.abs(s.want-s.s)<0.004) s.s=s.want;
    if(s.s<=0.02){ s.g.visible=false; return; }
    s.g.visible=true; s.g.scale.setScalar(1.35*(0.25+0.75*s.s)); s.g.position.y=F.fl-(1-s.s)*0.5+(reduce?0:0.012*Math.sin(t*2+s.ph)); /* naik dari dalam lantai */
    s.body.rotation.y=reduce?0:0.14*Math.sin(t*0.9+s.ph); s.lab.material.opacity=s.s;
  });
}
function syncSkeletons(){ /* skeleton yang tampil = milik pemain yang giliran (di benteng & belum READY); yang sudah ia kalahkan hilang */
  const F=FORT; if(!F||!AWK.done||BOSS!=='wither') return;
  const p=players[cur],show=!!(p&&p.pos===GOAL&&p.inArena&&!p.dragonReady&&!gameOver),d=show?crystalDone(p):null;
  F.sk.forEach((s,i)=>{ s.want=(show&&!d[i])?1:0; });
}
function applyFortState(){ /* keadaan benteng sesuai AWK.done: dipanggil setelah world dibangun ulang & saat game baru */
  const F=FORT; if(!F) return; const fin=AWK.done;
  if(!fin){ WF.risen=false; WF.cam=false; WF.shot=false; }
  F.pg.visible=!fin; F.pg.rotation.set(0,0,0); F.pg.position.set(F.x0+F.T/2,F.y,F.cz);
  F.rub.visible=fin; F.bridge.forEach(b=>{ b.g.visible=fin; b.g.position.set(b.x,F.y,F.cz); });
  F.sk.forEach(s=>{ s.busy=false; s.s=0; s.want=0; s.g.visible=false; s.g.position.y=F.fl; s.g.rotation.set(0,Math.atan2(F.cx-s.x,F.cz-s.z),0); s.g.scale.setScalar(1.35); s.body.rotation.set(0,0,0); s.lab.visible=true; });
  const w=WITHER; if(w){ const up=fin&&WF.risen; w.g.visible=up; w.halo.visible=up; w.dy=0; w.sc=up?WF.SC:1.1; w.shk=0; w.hurt=0; }
  wfxClear(); if(fin) syncSkeletons();
}
async function wallCollapse(gid){
  const F=FORT,pg=F.pg,Fk=reduce?0.35:1,bx=F.x0+F.T/2,S=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  await S(tween(1.2*Fk,k=>{ pg.position.z=F.cz+(Math.random()-0.5)*0.05*k; pg.rotation.z=(Math.random()-0.5)*0.03*k; if(!reduce&&Math.random()<0.2) burstCubes(bx-0.1,F.y+0.9+Math.random()*0.8,F.cz+(Math.random()-0.5)*3,2,{up:0.5,sp:0.9,size:0.07}); })); /* retak & bergetar */
  pg.position.z=F.cz;
  await S(tween(1.5*Fk,k=>{ const e=k*k; pg.rotation.z=e*1.15; pg.position.x=bx-e*0.5; pg.position.y=F.y-Math.max(0,k-0.4)*5.2; /* roboh ke arah papan lalu tenggelam ke lava */
    if(Math.random()<0.55) burstCubes(bx-e*1.0,F.y+0.9*(1-e)+0.2,F.cz+(Math.random()-0.5)*3.4,2,{up:1.8,sp:1.8,size:0.1}); }));
  pg.visible=false; F.rub.visible=true; burstCubes(bx-0.4,F.y+0.3,F.cz,26,{up:2.6,sp:2.6,size:0.1,spread:2.6,floor:F.y,life:1.6});
}
async function crossBridge(p,gid){
  const F=FORT,pw=p.pawn,to=fortSlot(p.idx),S=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  pw.rotation.order='XYZ'; sfx.hop();
  await S(glide(pw,[pw.position.clone(),new THREE.Vector3(F.x0-2.5,F.y,F.cz),new THREE.Vector3(F.x0-0.5,F.y,F.cz),to],reduce?7:2.4,null,0.07));
  pw.position.copy(to); pw.rotation.y=Math.PI/2; /* menghadap timur (ke altar & skeleton) */
}
async function gatherFort(gid){
  if(!AWK.done||!FORT) return;
  for(const pl of players){ if(pl.pos!==GOAL||pl.inArena||!pl.pawn) continue; pl.inArena=true; await crossBridge(pl,gid); }
}
async function awakenWither(p,gid){
  if(AWK.done||AWK.running) return; /* hanya 1x */
  const F=FORT; if(!F){ AWK.done=true; return; }
  const S=async pr=>{ await pr; if(gid!==gameId) throw STALE; },Fk=reduce?0.35:1;
  AWK.running=true; document.body.classList.add('awk-lock'); setBossFightFx(true); setRoll(false); clearTurnTimer(); dragonMusicStart(); /* musik boss (sama seperti pertarungan naga di World) */
  const sv={px:panGoal.x,pz:panGoal.z,zoom:goal.zoom}; let qk=null,finished=false;
  try{
    while(paused) await S(sleep(200));
    setMsg('Benteng Nether terbangun...'); fb('event','dragon','Benteng Nether terbangun!',{gid,ttl:2600});
    const c=fortCamPan(); panGoal.x=c.x; panGoal.z=c.z; goal.zoom=fortZoom(false); WF.shot=true; /* kamera menyorot tengah benteng, agak jauh */
    await S(sleep(1200*Fk));
    setMsg('Skeleton Hitam muncul dari lantai benteng!');
    for(const s of F.sk){ s.want=1; sfx.pop(); burstCubes(s.x,F.fl+0.05,s.z,8,{up:2,sp:1.2,size:0.09,cols:[0x1C161E,0x2A2A30,0x55555E],floor:F.fl}); await S(sleep(260*Fk)); }
    await S(sleep(700*Fk));
    setMsg('Tembok benteng runtuh!'); fb('event','dragon','Tembok benteng runtuh!',{gid,ttl:2000}); qk=sfx.quakeStart();
    await S(wallCollapse(gid)); sfx.quakeStop(qk); qk=null;
    setMsg('Jembatan muncul menuju benteng...');
    for(const b of F.bridge){ b.g.visible=true; sfx.pop(); await S(tween(0.5*Fk,k=>{ b.g.position.y=F.y-2.6*(1-(1-k)*(1-k)); })); b.g.position.y=F.y; burstCubes(b.x,F.y+0.1,F.cz,6,{up:1.6,sp:1.3,size:0.08,cols:[0x34262F,0x3C2D37,0x4A2A38]}); }
    await S(sleep(350*Fk));
    setMsg(p.name+' menyeberangi jembatan...'); p.inArena=true; await S(crossBridge(p,gid));
    finished=true;
  }finally{
    sfx.quakeStop(qk);
    if(gid===gameId){ /* STALE (game baru) ditangani resetAwakening di startGame */
      if(!finished){ F.pg.visible=false; F.rub.visible=true; F.bridge.forEach(b=>{ b.g.visible=true; b.g.position.y=F.y; }); } /* error tak terduga: jangan sampai game macet */
      WF.shot=false; panGoal.x=sv.px; panGoal.z=sv.pz; goal.zoom=camLocked()?lockZoom():sv.zoom; AWK.done=true; AWK.running=false; document.body.classList.remove('awk-lock');
    }
  }
}
/* Pukulan: bidak melompat ke depan skeleton, ayun (condong mundur lalu maju), skeleton terhempas & hancur jadi tulang */
async function punchSkeleton(p,i,gid){
  const F=FORT,s=F.sk[i],pw=p.pawn,Fk=reduce?0.4:1,S=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  s.busy=true; s.s=1; s.want=1; s.g.visible=true; s.g.scale.setScalar(1.35); s.g.position.y=F.fl; s.lab.visible=false; focus=pw;
  const dir=new THREE.Vector3(pw.position.x-s.x,0,pw.position.z-s.z); if(dir.lengthSq()<1e-4) dir.set(-1,0,0); dir.normalize();
  const hit=new THREE.Vector3(s.x+dir.x*0.62,F.fl,s.z+dir.z*0.62),slot=fortSlot(p.idx);
  try{
    await S(hopTo(pw,hit,0.45*Fk,0.6)); pw.rotation.order='YXZ'; pw.rotation.y=Math.atan2(s.x-hit.x,s.z-hit.z);
    pawnAct(pw,'attack',0.6*Fk);
    await S(tween(0.22*Fk,k=>{ pw.rotation.x=-0.5*k; }));                       /* ancang-ancang */
    await S(tween(0.12*Fk,k=>{ pw.rotation.x=-0.5+1.3*k; }));                   /* pukul */
    sfx.hundred(); fireBurst(s.x,F.fl+0.5,s.z,0.6,F.fl);
    await S(Promise.all([tween(0.3*Fk,k=>{ pw.rotation.x=0.8*(1-k); }),tween(0.3*Fk,k=>{ s.body.rotation.x=-0.45*Math.sin(Math.min(1,k*1.6)*Math.PI/2); s.g.position.x=s.x-dir.x*0.12*k; s.g.position.z=s.z-dir.z*0.12*k; })]));
    sfx.crystalBreak();
    await S(tween(0.55*Fk,k=>{ s.body.rotation.x=-0.45-1.1*k; s.g.position.y=F.fl-0.45*k*k; s.g.scale.setScalar(1.35*(1-0.75*k)); }));    /* roboh & hancur */
    fireBurst(s.x,F.fl+0.3,s.z,1,F.fl);
    await S(hopTo(pw,slot,0.45*Fk,0.45)); pw.rotation.y=Math.PI/2;
  }finally{
    pw.rotation.order='XYZ'; pw.rotation.x=0;
    if(gid===gameId){ s.busy=false; s.s=0; s.want=0; s.g.visible=false; s.g.position.set(s.x,F.fl,s.z); s.g.scale.setScalar(1.35); s.body.rotation.set(0,0,0); s.lab.visible=true; }
  }
}
async function skeletonRoll(p,v,gid){
  const S=async pr=>{ await pr; if(gid!==gameId) throw STALE; },n=v,d=crystalDone(p);
  if(d[n-1]){
    const why='Skeleton '+n+' sudah dikalahkan.'; setMsg(p.name+' melempar '+v+'. '+why+' Tidak ada progress.'); fb('event','dragon',why+' (dapat '+v+')',{gid,ttl:1800}); sfx.bounce();
    await S(sleep(900)); return false;
  }
  await S(punchSkeleton(p,n-1,gid));
  d[n-1]=true; p.crystal++; syncSkeletons(); renderChips();
  setMsg(p.name+' mengalahkan Skeleton '+n+'! ('+p.crystal+'/'+CRYSTAL_N+')'); fb('event','dragon','Skeleton '+n+' kalah! '+p.crystal+'/'+CRYSTAL_N,{gid,ttl:1800});
  await S(sleep(800));
  if(p.crystal>=CRYSTAL_N){
    p.dragonReady=true; renderChips();
    if(!WF.risen) await S(witherRise(p,gid));
    setMsg(p.name+' READY menyerang Wither!'); fb('event','dragon',p.name+' READY menyerang Wither!',{gid,ttl:2400}); sfx.crystalsCleared(); await S(sleep(700));
  }
  return true;
}
/* Wither muncul dari bawah benteng: gemuruh, kubus terlempar, naik menembus altar */
async function witherRise(p,gid){
  const F=FORT,w=WITHER; if(!w||WF.risen) return; WF.risen=true;
  const Fk=reduce?0.35:1,S=async pr=>{ await pr; if(gid!==gameId) throw STALE; },qk=sfx.quakeStart();
  setMsg('Semua Skeleton kalah! Benteng bergemuruh...'); fb('event','dragon','Sesuatu bangkit dari bawah benteng...',{gid,ttl:2600});
  w.dy=-2.6; w.sc=0.5; w.g.visible=true; w.halo.visible=true;
  try{
    await S(tween(1.5*Fk,k=>{ w.shk=(Math.random()-0.5)*0.07*k; if(!reduce&&Math.random()<0.4) burstCubes(w.x+(Math.random()-0.5)*1.6,F.fl,w.z+(Math.random()-0.5)*1.6,2,{up:1.6,sp:1.4,size:0.09,floor:F.fl}); })); /* gemuruh */
    sfx.dragonSpawn();
    await S(tween(2.3*Fk,k=>{ const e=1-Math.pow(1-k,3); w.dy=-2.6*(1-e); w.sc=0.5+(WF.SC-0.5)*e; w.shk=(Math.random()-0.5)*0.04*(1-k);
      if(!reduce&&Math.random()<0.7) burstCubes(w.x+(Math.random()-0.5)*1.5,F.fl+0.1,w.z+(Math.random()-0.5)*1.5,3,{up:3.6,sp:2.6,size:0.12,floor:F.fl,life:1.5}); })); /* naik, kubus terpental */
    w.dy=0; w.sc=WF.SC; w.shk=0; burstCubes(w.x,F.fl+0.3,w.z,34,{up:4,sp:3.2,size:0.12,spread:1.2,floor:F.fl,life:1.6});
    await S(sleep(600*Fk));
  }finally{ sfx.quakeStop(qk); if(gid===gameId){ w.shk=0; w.dy=0; w.sc=WF.SC; } }
}
/* Serangan ke Wither: bidak melompat ke depan altar & memukul; damage = angka dadu x DMG dari HP 120 per pemain (pola sama dgn hitDragon) */
async function hitWither(p,v){
  if(!canAttackDragon(p)) return;
  const w=WITHER,F=FORT,pw=p.pawn,dmg=v*DMG,gid=gameId,Fk=reduce?0.4:1,slot=fortSlot(p.idx);
  const dir=new THREE.Vector3(w.x-pw.position.x,0,w.z-pw.position.z); if(dir.lengthSq()<1e-4) dir.set(1,0,0); dir.normalize();
  const hit=new THREE.Vector3(w.x-dir.x*1.35,F.fl,w.z-dir.z*1.35);
  focus=pw; sfx.dragonHurt();
  try{
    await hopTo(pw,hit,0.4*Fk,0.55); if(gid!==gameId) throw STALE; pawnAct(pw,'attack');
    pw.rotation.order='YXZ'; pw.rotation.y=Math.atan2(w.x-hit.x,w.z-hit.z);
    await tween(0.2*Fk,k=>{ pw.rotation.x=-0.5*k; }); await tween(0.12*Fk,k=>{ pw.rotation.x=-0.5+1.3*k; }); if(gid!==gameId) throw STALE;
    sfx.hundred(); w.hurt=1; fireBurst(w.x-dir.x*0.5,w.y0+0.5,w.z-dir.z*0.5,0.7,F.fl);
    await Promise.all([tween(0.5*Fk,k=>{ pw.rotation.x=0.8*(1-k); }),tween(0.5*Fk,k=>{ w.shk=Math.sin(k*40)*0.07*(1-k); })]); w.shk=0; if(gid!==gameId) throw STALE;
    await hopTo(pw,slot,0.4*Fk,0.45); pw.rotation.y=Math.PI/2;
  }finally{ pw.rotation.order='XYZ'; pw.rotation.x=0; w.shk=0; }
  if(gid!==gameId) throw STALE;
  p.dhp=Math.max(0,p.dhp-dmg); bossHitFx(dmg,false,false); hud('showCombat','','','',{hp:p.dhp,maxHp:p.hpMax,bossName:'Wither',owner:p.name,gid,ttl:900}); msBump(p,'dragon_hits'); renderChips(); hud('updatePlayer',p);
  if(p.dhp>0){ setMsg('Wither '+p.name+' tersisa '+p.dhp+'/'+p.hpMax+'.'); return; }
  DRG.defeated=true; dragonMusicStop(); settleDragonDefeat(p); /* sama dgn naga: tutup serangan lanjutan + simpan hadiah 1x (sinkron) */
  sfx.dragonDeath(); setMsg('Wither kalah!'); hud('showResult','Wither kalah!',p.name+' menang!',{ttl:2600,gid});
  fireBurst(w.x,w.y0+0.6,w.z,2.2,F.fl); setTimeout(()=>{ if(gid===gameId) fireBurst(w.x,w.y0+1.0,w.z,1.6,F.fl); },450);
  await tween(1.6*Fk,k=>{ w.dy=-k*2.6; w.sc=WF.SC*(1-0.8*k); w.shk=Math.sin(k*60)*0.05*(1-k); });
  w.g.visible=false; w.halo.visible=false; w.shk=0;
}
/* Giliran pemain yang sudah di petak akhir map Wither: lawan Skeleton (angka dadu = nomor Skeleton) lalu Wither */
async function witherPhase(p,v,gid){
  const A=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  if(!AWK.done) await A(awakenWither(p,gid)); /* jaga-jaga: Wither tak boleh dilawan sebelum benteng terbuka */
  await A(gatherFort(gid));
  if(!p.dragonReady) await A(skeletonRoll(p,v,gid));
  else{
    if(!canAttackDragon(p)){ nextTurn(); return; }
    await A(hitWither(p,v));
    if(p.dhp<=0){ await A(celebrate(p)); await A(dragonDefeatReward(p,gid)); finishGame(p); return; }
  }
  if(v===6||p.extra){ p.extra=false; busy=false; beginTurn(true); } else nextTurn();
}
/* capture-phase guard: selama awakening klik/Enter/Space ke tombol HUD apa pun diabaikan (pelengkap CSS .awk-lock) */
document.addEventListener('click',e=>{ if(AWK.running&&e.target.closest&&e.target.closest('button,select,input,a')){ e.stopImmediatePropagation(); e.preventDefault(); } },true);
/* ---------- Papan sendiri (map dengan def.board): lava, alas Start, dekor dari def.props ---------- */
/* ---------- Biome Nether di pinggir lava (Crimson, Warped, Soul Sand Valley + Bone Block, Basalt Deltas) ---------- */
const NB_GROUND={crimson:[0x9A2A3A,0x7A1E2C],warped:[0x1F8F86,0x167068],soul:[0x6A5A48,0x54463A],basalt:[0x4C4C54,0x3A3A42]};
/* Tepi lava tidak kotak: di pita sekitar persegi lava (x -15..19, z -14..12) tiap sel 1x1 lava/darat ditentukan noise halus -> teluk & tanjung */
function nLavaNoise(cx,cz){ return sgn(cx/2.5,cz/2.5,11)*0.7+sgn(cx/1.1,cz/1.1,23)*0.3; }
function nIsLava(x,z){
  const cx=Math.floor(x)+0.5,cz=Math.floor(z)+0.5,dOut=Math.max(-15-cx,cx-19,-14-cz,cz-12);
  if(dOut<=-3) return true; if(dOut>=3.5) return false;
  return dOut<(nLavaNoise(cx,cz)-0.4)*5;
}
function nOnLava(x,z,m){ m=m||0; return nIsLava(x,z)||(m>0&&(nIsLava(x+m,z)||nIsLava(x-m,z)||nIsLava(x,z+m)||nIsLava(x,z-m))); }
function netherBiomeAt(x,z){
  const dx=Math.max(-15-x,x-19),dz=Math.max(-14-z,z-12),d=Math.max(dx,dz);
  if(d<=-4||d>13) return null;
  if(dx>dz) return x<0?'crimson':'soul';
  return z<0?'warped':'basalt';
}
function addFungus(B,x,z,s,warped){
  const st=warped?0x1F6B6B:0x6A1A2A,cap=warped?0x2AB8A8:0xB02A3A,wart=warped?0x14B485:0xA01E2E,h=1.2*s,F={edge:false};
  for(let y=0;y<h;y+=0.3) addBox(B,x,y+0.15,z,0.28,0.3,0.28,jit(st,0.06));
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) addBox(B,x+i*0.4,h+0.15,z+j*0.4,0.4,0.3,0.4,jit(i||j?cap:wart,0.1),F);
  addBox(B,x,h+0.45,z,0.4,0.3,0.4,jit(wart,0.1),F);
  addBox(B,x+0.4,h-0.1,z,0.14,0.14,0.14,0xFFC85A,F); addBox(B,x-0.4,h-0.1,z+0.4,0.14,0.14,0.14,0xFFC85A,F); /* shroomlight */
  if(!warped) [[0.6,0.2],[-0.6,-0.3],[0.2,-0.6]].forEach(q=>{ addBox(B,x+q[0],h-0.35,z+q[1],0.05,0.7,0.05,0xC02A3A,F); }); /* weeping vines */
  else [[0.5,0.5],[-0.5,0.3]].forEach(q=>addBox(B,x+q[0],0.08,z+q[1],0.05,0.16,0.05,0x14B485,F)); /* warped roots */
}
function addBoneBlock(B,x,y,z,s){ addBox(B,x,y+s/2,z,s,s,s,0xE8E2CC); addBox(B,x,y+s+0.004,z,s*0.7,0.01,s*0.7,0xCFC8A8,{edge:false}); }
function addBonePile(B,x,z){ const s=0.4; addBoneBlock(B,x,0,z,s); addBoneBlock(B,x+0.42,0,z+0.1,s); addBoneBlock(B,x+0.1,s,z+0.05,s); }
function addBoneFossil(B,x,z){ /* tulang punggung + rusuk dari Bone Block + tengkorak */
  const s=0.45;
  for(let i=-3;i<=3;i++) addBoneBlock(B,x+i*s,0,z,s);
  [-2,0,2].forEach(i=>[-1,1].forEach(sd=>{ addBoneBlock(B,x+i*s,0,z+sd*s,s); addBoneBlock(B,x+i*s,s,z+sd*s*1.3,s); addBoneBlock(B,x+i*s,2*s,z+sd*s*0.8,s); }));
  addBoneBlock(B,x+4*s,0,z,s*1.7); [-1,1].forEach(a=>addBox(B,x+4*s+0.76,0.4,z+a*0.2,0.02,0.16,0.14,0x3A3226,{edge:false}));
}
function addSoulFire(B,x,z){ const F={edge:false}; addBox(B,x,0.04,z,0.34,0.08,0.34,0x3A2E22); addBox(B,x,0.22,z,0.2,0.3,0.2,0x3AC8E8,F); addBox(B,x,0.38,z,0.1,0.2,0.1,0x9AF0FF,F); }
function addBasalt(B,x,z,maxH,maxW){ /* maxH/maxW (opsional): dipakai di atas papan agar rendah & tidak melebar ke petak */
  const hh=Math.min(0.5+rnd()*2.2,maxH||9),w=Math.min(0.5+rnd()*0.4,maxW||9),F={edge:false}; let y=0,st=maxH?Math.min(0.5,maxH/2):0.5;
  for(let i=0;y<hh;i++,y+=st) addBox(B,x,y+st/2,z,w,st,w,jit(i%2?0x4C4C54:0x3A3A42,0.06),F);
  if(!maxH&&rnd()<0.2) addBox(B,x+0.5,0.12,z,0.4,0.24,0.4,0xC0501A,F); /* magma block */
}
function addNetherBiomes(DB,th){
  const pil=[[-13,-10],[12,-12],[16,10],[-15,9],[22,-4]];
  lift(DB,()=>addBoneFossil(DB,23,5),hAt(23,5)); lift(DB,()=>addBoneFossil(DB,24,-8),hAt(24,-8));
  let n=0,t=0;
  while(n<120&&t++<3000){
    const x=(rnd()-0.5)*66,z=(rnd()-0.5)*58;
    if(nOnLava(x,z,0.8)||(Math.abs(x)<14&&Math.abs(z)<12)||pil.some(q=>Math.hypot(q[0]-x,q[1]-z)<2.6)) continue;
    const b=netherBiomeAt(x,z),sc=0.8+rnd()*0.7,r=rnd();
    lift(DB,()=>{
      if(b==='crimson') (r<0.05?addBonePile(DB,x,z):addFungus(DB,x,z,sc,false));
      else if(b==='warped') (r<0.05?addBonePile(DB,x,z):addFungus(DB,x,z,sc,true));
      else if(b==='soul'){ if(r<0.4) addSoulFire(DB,x,z); else if(r<0.6) addBonePile(DB,x,z); }
      else if(b==='basalt'){ if(r<0.6) addBasalt(DB,x,z); else if(r<0.65) addBonePile(DB,x,z); }
      else if(r<0.5) addNetherTree(DB,x,z,sc);
    },hAt(x,z)); n++;
  }
}
/* ---------- Pulau biome papan Nether (redesain mengikuti gambar referensi): darat per biome di sela jalan, tebing berlapis, fungus raksasa, Benteng Nether ---------- */
const NI_TILE={crimson:[0x8A2B2B,0x6E2222],warped:[0x2A9D8F,0x1F8278],soul:[0x8F7F66,0x76684F],basalt:[0x55555E,0x3F3F48]};
const NI_CLIFF={crimson:[0x5A1818,0x4A1212,0x6A1E1E],warped:[0x14504C,0x0F403D,0x1A5F5A],soul:[0x4A3E32,0x3A3026,0x55483A],basalt:[0x2A2A30,0x222228,0x34343C]};
const NI_TOP={crimson:[0x9A2A3A,0x862433,0x7A1E2C],warped:[0x1F8F86,0x1A7A72,0x167068],soul:[0x7A6A55,0x665846,0x5A4D3C],basalt:[0x4C4C54,0x3E3E46,0x44444C]};
function buildNetherIslands(TB,th){
  const I=TILES.island,F={edge:false};
  Object.keys(I).sort().forEach(k=>{
    const c=I[k],cl=NI_CLIFF[c.bio],tp=NI_TOP[c.bio],h=c.h;
    if(c.bridge&&BOSS==='wither') return;                                   /* jembatan ke benteng: baru MUNCUL saat fase Wither (buildWitherFort) */
    addBox(TB,c.x,(h-0.95)/2,c.z,1,h+0.05,1,jit(cl[0],0.06),F);            /* tebing bawah (turun ke lava) */
    addBox(TB,c.x,h-0.325,c.z,1,0.25,1,jit(cl[1+Math.floor(rnd()*2)],0.07),F); /* lapis tebing atas */
    let top=tp[Math.floor(rnd()*3)];
    if(c.bridge) top=[0x34262F,0x3C2D37,0x2C2029][((c.x*2+c.z*3)|0)&1?1:0];     /* jalan ke benteng: batu hitam polos */
    else if(c.edge&&rnd()<0.28) top=(c.bio==='warped'?0x0F3F3C:0xC0501A);        /* tepi: magma / batu hangus */
    addBox(TB,c.x,h-0.1,c.z,1,0.2,1,jit(top,0.08),F);                       /* permukaan nylium / soul sand / basalt */
  });
}
/* ---------- Dekorasi kecil di atas papan Nether: semua muat di dalam 1 sel (setengah lebar <= 0.3, tinggi <= 0.7) agar tidak menutupi petak ---------- */
/* jamur mini (fungus): batang pendek + tudung pipih, crimson merah / warped teal */
function addMiniFungus(B,x,z,s,warped){
  const st=warped?0x1F6B6B:0x6A1A2A,cap=warped?[0x2AB8A8,0x1FA090]:[0xB02A3A,0x962030],wart=warped?0x14B485:0xA01E2E,F={edge:false},h=0.26*s;
  addBox(B,x,h/2,z,0.16,h,0.16,jit(st,0.06));
  addBox(B,x,h+0.07,z,0.56*s,0.14,0.56*s,jit(cap[0],0.08),F);
  addBox(B,x,h+0.2,z,0.34*s,0.12,0.34*s,jit(cap[1],0.08),F);
  addBox(B,x,h+0.28,z,0.14,0.05,0.14,jit(wart,0.1),F);
  addBox(B,x+0.28*s,h+0.04,z,0.07,0.07,0.07,0xFFC85A,F); /* shroomlight */
}
/* pohon mini Nether (crimson / warped): batang ramping + tajuk wart 2 lapis (crimson: ada sulur menjuntai) */
function addMiniTree(B,x,z,s,warped){
  const st=warped?0x1B5E5E:0x6A1A2A,cap=warped?[0x14B485,0x1FB5A5]:[0xD43A3A,0xA01E2E],F={edge:false},h=0.36*s;
  addBox(B,x,h/2,z,0.16,h,0.16,jit(st,0.06));
  [[0,0],[0.2,0],[-0.2,0],[0,0.2],[0,-0.2]].forEach(q=>addBox(B,x+q[0],h+0.07,z+q[1],0.2,0.14,0.2,jit(cap[0],0.08),F));
  addBox(B,x,h+0.21,z,0.22,0.14,0.22,jit(cap[1],0.08),F);
  if(!warped) [[0.24,0.04],[-0.24,-0.04]].forEach(q=>addBox(B,x+q[0],h-0.05,z+q[1],0.04,0.2,0.04,0xC02A3A,F)); /* weeping vines */
  else addBox(B,x+0.22,h-0.02,z,0.07,0.07,0.07,0xFFC85A,F);
}
/* gundukan batu: 3 tumpukan balok batu bertingkat + 1-2 kerikil, tinggi <= ~0.4 */
function addRockMound(B,x,z,s){
  const F={edge:false},C=[0x6A6A72,0x58585F,0x46464D,0x34343B],c=()=>jit(C[Math.floor(rnd()*C.length)],0.06),k=s||1;
  addBox(B,x,0.08*k,z,0.58*k,0.16*k,0.5*k,c());
  addBox(B,x-0.02,0.22*k,z+0.01,0.4*k,0.12*k,0.34*k,c(),F);
  addBox(B,x+0.02,0.33*k,z,0.22*k,0.1*k,0.2*k,c(),F);
  addBox(B,x+0.3*k,0.05,z-0.12,0.14,0.1,0.14,c(),F);
  if(rnd()<0.6) addBox(B,x-0.28*k,0.04,z+0.16,0.1,0.08,0.12,c(),F);
}
/* titik (x,z) harus menjauh dari garis tangga/ular (agar dekorasi tidak menimpa/menutupi jalurnya) */
function nearLadderSnake(x,z,r){
  const P={x:x,z:z},chk=(a,b)=>{ const A=TILES[a],B=TILES[b]; if(!A||!B) return false;
    const dx=B.x-A.x,dz=B.z-A.z,L2=dx*dx+dz*dz||1; let t=((x-A.x)*dx+(z-A.z)*dz)/L2; t=Math.max(0,Math.min(1,t));
    return Math.hypot(x-(A.x+dx*t),z-(A.z+dz*t))<r; };
  return Object.keys(LADDERS).some(k=>chk(+k,LADDERS[k]))||Object.keys(SNAKES).some(k=>chk(+k,SNAKES[k]));
}
/* ---------- Benteng Nether: tembok bata detail, altar batu, Wither beranimasi ---------- */
var WITHER=null,FORT=null; /* FORT = state finale Nether (lihat buildWitherFort) */
function shHex(hex,a){ const k=1+a*1.5,c=v=>Math.max(0,Math.min(255,Math.round(v*k))); return (c(hex>>16&255)<<16)|(c(hex>>8&255)<<8)|c(hex&255); } /* warna angka (aman utk tools/character-data) */
function fhash(a,b){ let x=Math.imul(Math.floor(a*97)+Math.imul(Math.floor(b*131),7919)+13,0x9E3779B1); x^=x>>>15; x=Math.imul(x,0x85EBCA6B); x^=x>>>13; return ((x>>>0)%10000)/10000; } /* deterministik, tanpa rnd() terseed */
/* tengkorak Wither: kubus gelap + kulit piksel 4x4, rongga mata, alis, hidung, tulang pipi, retakan, gigi atas (depan = +z) */
function addWitherSkull(B,s,key){
  const F={edge:false},BO=0x34343C,n=4,T=s/n,TH=0.008,E=s/2+TH/2;
  addBox(B,0,0,0,s,s,s,BO);
  for(let a=0;a<n;a++) for(let b=0;b<n;b++){
    const u=-s/2+T/2+a*T,v=-s/2+T/2+b*T;
    addBox(B,u,v,E,T,T,TH,shHex(BO,(fhash(a+key,b)-0.5)*0.34),F);
    addBox(B,u,v,-E,T,T,TH,shHex(BO,(fhash(a,b+key+4)-0.5)*0.34-0.05),F);
    addBox(B,E,v,u,TH,T,T,shHex(BO,(fhash(a+7,b+key)-0.5)*0.34),F);
    addBox(B,-E,v,u,TH,T,T,shHex(BO,(fhash(a+3,b+key+9)-0.5)*0.34),F);
    addBox(B,u,E,v,T,TH,T,shHex(BO,(fhash(a+key,b+11)-0.5)*0.3+0.04),F);
  }
  const z1=s/2+0.012,D=0.008;
  [-1,1].forEach(a=>{
    addBox(B,a*s*0.235,s*0.08,z1,s*0.32,s*0.22,D,0x0C0C10,F);                 /* rongga mata */
    addBox(B,a*s*0.38,-s*0.17,z1,s*0.15,s*0.15,D,0x4C4C56,F);                 /* tulang pipi */
    addBox(B,a*s*0.2,s*0.27,z1,s*0.4,s*0.07,D+0.004,0x1C1C22,F);              /* alis (miring: sisi luar lebih rendah) */
    addBox(B,a*s*0.42,s*0.22,z1,s*0.14,s*0.06,D+0.004,0x1C1C22,F);
  });
  addBox(B,0,-s*0.12,z1,s*0.12,s*0.22,D,0x0C0C10,F);                         /* lubang hidung */
  addBox(B,0,-s*0.37,z1,s*0.7,s*0.05,D,0x0C0C10,F);                          /* garis mulut */
  addBox(B,s*0.08,s*0.36,z1+0.004,s*0.05,s*0.2,0.006,0x16161C,F);            /* retakan dahi */
  addBox(B,s*0.13,s*0.25,z1+0.004,s*0.12,s*0.04,0.006,0x16161C,F);
  addBox(B,E+0.004,s*0.15,-s*0.1,0.006,s*0.3,s*0.05,0x16161C,F);             /* retakan sisi */
  addBox(B,-E-0.004,s*0.1,s*0.12,0.006,s*0.25,s*0.05,0x16161C,F);
  for(let i=-2;i<=2;i++) addBox(B,i*s*0.15,-s/2-s*0.025,s/2-s*0.06,s*0.07,s*0.07,s*0.07,0x8A8A94,F); /* gigi atas */
}
/* badan Wither: tulang belakang bersendi, 4 rusuk, leher, ekor 3 ruas */
function addWitherBody(B){
  const F={edge:false};
  for(let k=0;k<7;k++){ const y=0.02+k*0.095,c=k%2?0x3A3A42:0x2C2C32; addBox(B,0,y,0,0.1,0.085,0.1,c); if(k%2) [-1,1].forEach(a=>addBox(B,a*0.07,y,0,0.04,0.04,0.04,0x4A4A54,F)); }
  [[0.64,0.62],[0.53,0.54],[0.42,0.46],[0.31,0.38]].forEach((r,i)=>{ const y=r[0],w=r[1],c=i%2?0x34343C:0x2C2C32;
    addBox(B,0,y,0,w,0.06,0.07,c);
    [-1,1].forEach(a=>{ addBox(B,a*(w/2-0.02),y-0.05,0.015,0.05,0.07,0.06,0x3C3C46,F); addBox(B,a*(w/2-0.02),y-0.095,0.045,0.04,0.045,0.05,0x4A4A54,F); });
  });
  addBox(B,0,0.72,0,0.09,0.09,0.09,0x34343C);                               /* leher */
  [[0,-0.1,-0.07,0.085],[0,-0.17,-0.15,0.065],[0,-0.22,-0.24,0.05]].forEach(t=>addBox(B,t[0],t[1],t[2],t[3],t[3],t[3],0x2C2C32));
}
/* altar: tumpukan batu retak (deepslate/blackstone), batu lepas di kaki, tiga undak, rune menyala, pasir jiwa berbentuk T. Mengembalikan tinggi permukaan. */
function addWitherAltar(B,cx,cz,y){
  const DS=[0x2A2A30,0x34343C,0x222228,0x3C3C46],F={edge:false};
  const pal=(i,j,a)=>shHex(DS[Math.floor(fhash(i,j+a)*4)],(fhash(j,i+a)-0.5)*0.2);
  addBox(B,cx,y+0.08,cz,1.5,0.16,1.5,0x1C161E);
  for(let k=0;k<4;k++) addBox(B,cx+(fhash(k,21)-0.5)*1.0,y+0.162,cz+(fhash(k,22)-0.5)*1.0,0.22,0.012,0.03,0xFF6A14,F);  /* urat lava di dasar */
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+fhash(k,1)*0.4,r=0.78+fhash(k,2)*0.14,sz=0.14+fhash(k,3)*0.14,h=0.08+fhash(k,4)*0.16; /* batu lepas di kaki */
    addBox(B,cx+Math.cos(a)*r,y+h/2,cz+Math.sin(a)*r,sz,h,sz*(0.8+fhash(k,5)*0.4),pal(k,7,0)); }
  let yy=y+0.16;
  [[1.2,3],[0.93,3],[0.66,2]].forEach((s,si)=>{ const w=s[0],n=s[1],h=0.16,c=w/n;
    addBox(B,cx,yy+h/2,cz,w,h,w,0x120E14,F);                                /* isian gelap = celah antar batu */
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const dh=(fhash(i+si*5,j)-0.5)*0.03;
      addBox(B,cx-w/2+c/2+i*c,yy+h/2+dh/2,cz-w/2+c/2+j*c,c-0.012,h+dh,c-0.012,pal(i+si*3,j,si*11)); }
    if(si===0) [-1,0,1].forEach(k=>addBox(B,cx+k*0.3,yy+0.08,cz+w/2+0.008,0.07,0.07,0.014,k===0?0x7FD8FF:0xFF8A1A,F)); /* rune menyala di muka depan */
    yy+=h; });
  const c3=0.22; /* permukaan atas: pasir jiwa membentuk T (tempat memanggil Wither) */
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){ const soul=(j===0)||(i===1),col=soul?shHex(0x5B4636,(fhash(i,j+30)-0.5)*0.15):shHex(0x26262C,(fhash(i,j+31)-0.5)*0.2);
    addBox(B,cx-c3+i*c3,yy+0.025,cz-c3+j*c3,c3-0.012,0.05,c3-0.012,col);
    if(soul) [[-0.05,-0.04],[0.05,0.05]].forEach(o=>addBox(B,cx-c3+i*c3+o[0],yy+0.052,cz-c3+j*c3+o[1],0.04,0.006,0.04,0x2E2218,F)); }
  return yy+0.05-y;
}
/* Wither beranimasi: melayang naik-turun, 3 kepala menoleh, rahang bergerak, mata berkedip/berpendar, meraung tiap ~7 dtk, jiwa biru naik */
function makeWither(cx,cz,y0){
  const S=1.1,g=new THREE.Group(); g.position.set(cx,y0+0.06,cz); g.scale.setScalar(S);
  const EYE=new THREE.MeshBasicMaterial({color:0xDDEEFF,fog:false});
  const BB=makeBatch(); addWitherBody(BB); g.add(buildBatch(BB));
  const heads=[];
  const mkHead=(s,x,y,key,ph)=>{
    const hg=new THREE.Group(); hg.position.set(x,y,0);
    const SB=makeBatch(); addWitherSkull(SB,s,key); hg.add(buildBatch(SB));
    const jaw=new THREE.Group(); jaw.position.set(0,-s/2+0.012,-s/2+0.05);
    const JB=makeBatch(),F={edge:false};
    addBox(JB,0,-s*0.05,s*0.42,s*0.84,s*0.12,s*0.78,0x2A2A30);
    for(let i=0;i<4;i++) addBox(JB,(i-1.5)*s*0.2,s*0.03,s*0.8,s*0.07,s*0.08,s*0.07,0x8A8A94,F);
    jaw.add(buildBatch(JB)); hg.add(jaw);
    const geo=new THREE.BoxGeometry(s*0.26,s*0.13,0.012);
    const eyes=[-1,1].map(a=>{ const m=new THREE.Mesh(geo,EYE); m.position.set(a*s*0.235,s*0.08,s/2+0.022); hg.add(m); return m; });
    g.add(hg); heads.push({g:hg,jaw,eyes,ph});
  };
  mkHead(0.32,0,0.86,0,0); mkHead(0.24,-0.31,0.74,3,1.7); mkHead(0.24,0.31,0.74,6,3.4);
  world.add(g);
  const halo=makeHalo(cx,y0+0.7,cz,2.4,0x6FA8FF); world.add(halo);
  const geo=new THREE.BoxGeometry(1,1,1),mats=[0xF0FAFF,0x9FD8FF,0x4A78B8].map(c=>new THREE.MeshBasicMaterial({color:c,fog:false}));
  mats.push(new THREE.MeshBasicMaterial({color:0x1A1A24,transparent:true,opacity:0.5,depthWrite:false}));
  const sg=new THREE.Group(),ps=[]; world.add(sg);
  for(let i=0;i<28;i++){ const me=new THREE.Mesh(geo,mats[0]); me.visible=false; sg.add(me); ps.push({me,life:0,max:1,vx:0,vy:0,vz:0,s:0.04,ph:i*1.3}); }
  WITHER={g,heads,EYE,halo,ps,mats,acc:0,i:0,x:cx,z:cz,y0:y0,dy:0,sc:S,shk:0,hurt:0};
  if(BOSS==='wither'){ g.visible=false; halo.visible=false; } /* map fase Wither: Wither baru muncul dari bawah benteng setelah semua Skeleton kalah */
  return WITHER;
}
function updateWither(dt,t){
  const w=WITHER; if(!w) return;
  if(!w.g.visible){ for(let k=0;k<28;k++){ const p=w.ps[k]; p.life=0; p.me.visible=false; } return; }
  w.hurt=Math.max(0,w.hurt-dt*2.2); w.g.scale.setScalar(w.sc); w.g.position.x=w.x+w.shk; w.halo.position.y=w.y0+0.7+w.dy*0.5;
  const calm=reduce, ph=t%7, roar=calm?0:(ph<1?Math.sin(ph*Math.PI):0);
  w.g.position.y=w.y0+0.06+w.dy+(calm?0:0.035*Math.sin(t*1.7)+0.03*roar);
  w.g.rotation.y=calm?0:0.12*Math.sin(t*0.45);
  const shake=roar*Math.sin(t*55)*0.05;
  w.heads.forEach((h,i)=>{
    h.g.rotation.y=calm?0:((i===0?0.5*Math.sin(t*0.6):0.45*Math.sin(t*0.8+h.ph))+shake);
    h.g.rotation.x=calm?0:(0.05*Math.sin(t*1.3+h.ph)-0.12*roar);
    h.jaw.rotation.x=0.05+(calm?0:(0.04+0.04*Math.sin(t*2.1+h.ph)+0.5*roar));
    const blink=(!calm&&((t+h.ph)%5.3)<0.12)?0.15:1;
    h.eyes.forEach(e=>{ e.scale.y=blink; });
  });
  const it=Math.min(1,0.72+0.2*Math.sin(t*3)+0.5*roar),hu=w.hurt;
  w.EYE.color.setRGB(Math.min(1,0.87*it+hu),0.93*it*(1-0.8*hu),it*(1-0.85*hu)); /* terkena serangan: mata & aura memerah sesaat */
  w.halo.material.color.setHex(hu>0.05?0xFF4A3A:0x6FA8FF);
  w.halo.material.opacity=(night?0.38:0.16)*(0.75+0.25*Math.sin(t*1.9))+0.3*roar+0.35*hu;
  if(!calm&&!document.hidden){
    w.acc+=dt*(9+32*roar); let guard=6;
    while(w.acc>=1&&guard--){
      w.acc-=1;
      let p=null; for(let k=0;k<28;k++){ const c=w.ps[(w.i+k)%28]; if(c.life<=0){ p=c; w.i=(w.i+k+1)%28; break; } }
      if(!p) break;
      const a=Math.random()*Math.PI*2,r=0.12+Math.random()*0.4;
      p.me.position.set(w.x+Math.cos(a)*r,w.y0+0.15+Math.random()*0.9,w.z+Math.sin(a)*r);
      p.max=p.life=1.2+Math.random()*0.8; p.vx=(Math.random()-0.5)*0.12; p.vz=(Math.random()-0.5)*0.12; p.vy=0.25+Math.random()*0.35+0.4*roar;
      p.s=0.03+Math.random()*0.035; p.me.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); p.me.visible=true;
    }
  }
  for(let k=0;k<28;k++){
    const p=w.ps[k]; if(p.life<=0) continue;
    p.life-=dt; if(p.life<=0){ p.me.visible=false; continue; }
    const u=1-p.life/p.max;
    p.me.position.x+=(p.vx+Math.sin(t*3+p.ph)*0.05)*dt; p.me.position.z+=(p.vz+Math.cos(t*2.6+p.ph)*0.05)*dt; p.me.position.y+=p.vy*dt;
    p.me.rotation.x+=dt*1.5; p.me.rotation.y+=dt*2;
    p.me.material=u<0.2?w.mats[0]:u<0.55?w.mats[1]:u<0.85?w.mats[2]:w.mats[3];
    p.me.scale.setScalar(p.s*(1-0.6*u));
  }
}
function addFortress(B,Fo){
  const B0=B; /* B bisa dialihkan sementara ke batch tembok barat (bisa runtuh) */
  const x0=Fo.x0,x1=Fo.x1,z0=Fo.z0,z1=Fo.z1,y=Fo.y,cx=(x0+x1)/2,cz=(z0+z1)/2,w=x1-x0,d=z1-z0,F={edge:false},BR=[0x2B1B24,0x231820,0x35212D,0x2F1E28],bk=()=>jit(pick(BR),0.05),T=0.5;
  const BRK=[0x472431,0x3F1F2B,0x4E2937,0x38192A],TW=0.9; /* TW = lebar menara sudut: bata/pilaster dipangkas di antara menara */
  addBox(B,cx,(y-0.8)/2,cz,w,y+0.3,d,jit(0x1E1418,0.04),F);        /* dasar benteng turun ke lava */
  addBox(B,cx,y-0.1,cz,w,0.2,d,jit(0x2A1C24,0.05),F);              /* lantai halaman */
  /* tembok bata: badan, susunan bata bergeser 0.25 (panjang bervariasi), pilaster, jendela berbingkai, retakan, plint & cornice, gerigi bertutup, rantai + lentera jiwa di sisi dalam */
  const wall=(ax,a0,a1,c0,c1,H,dir)=>{
    const X=ax==='x',cc=(c0+c1)/2,t=c1-c0,s0=a0+TW,s1=a1-TW,len=s1-s0,mid=(s0+s1)/2,mk=(p,q,yy,sa,sb,sc,col,o)=>X?addBox(B,p,yy,q,sa,sb,sc,col,o):addBox(B,q,yy,p,sc,sb,sa,col,o);
    addBox(B,X?(a0+a1)/2:cc,y+H/2,X?cc:(a0+a1)/2,X?a1-a0:t,H,X?t:a1-a0,bk());
    const fo=cc+dir*(t/2+0.004),fi=cc-dir*(t/2+0.004);
    [[fo,0],[fi,23]].forEach(f=>{
      for(let r=0;r<Math.round(H/0.25);r++){ let s=s0-(r%2?0.25:0),i=0;
        while(s<s1){ const l=0.5+(fhash(r+f[1],i)<0.25?0.12:0),e=Math.min(s+l,s1),sa=Math.max(s,s0);
          if(e-sa>0.06) mk((sa+e)/2,f[0],y+0.125+r*0.25,e-sa-0.03,0.22,0.012,shHex(BRK[Math.floor(fhash(r*3+f[1],i+5)*4)],(fhash(i+f[1],r)-0.5)*0.22),F);
          s=e; i++; } }
    });
    [1/3,2/3].forEach(k=>{ const p=s0+len*k; mk(p,cc+dir*(t/2+0.05),y+(H+0.12)/2,0.22,H+0.12,0.1,bk()); mk(p,cc+dir*(t/2+0.06),y+H+0.1,0.3,0.08,0.16,jit(0x4A2A38,0.05),F); });
    mk(mid,cc+dir*(t/2+0.02),y+0.85,0.4,0.5,0.02,0x120A0E,F);                      /* bingkai jendela */
    mk(mid,cc+dir*(t/2+0.032),y+0.85,0.26,0.36,0.02,0xFF8A1A,F);                   /* kaca menyala */
    mk(mid,cc+dir*(t/2+0.04),y+0.85,0.03,0.36,0.02,0x120A0E,F); mk(mid,cc+dir*(t/2+0.04),y+0.85,0.26,0.03,0.02,0x120A0E,F);
    for(let k=0;k<3;k++) mk(s0+fhash(k,len*10)*len,fo+dir*0.004,y+0.3+fhash(k,len*10+3)*0.9,0.02,0.28+fhash(k,5)*0.2,0.01,0x120C10,F); /* retakan */
    mk((s0+s1)/2,cc,y+0.1,len,0.2,t+0.1,jit(0x231820,0.04),F);                     /* plint */
    mk((s0+s1)/2,cc,y+H-0.04,len,0.1,t+0.1,jit(0x231820,0.04),F);                  /* cornice */
    const n=Math.floor(len/0.6);
    for(let i=0;i<n;i++){ if(fhash(i,len*7+a0)<0.08) continue; const p=s0+(i+0.5)*0.6; mk(p,cc,y+H+0.15,0.4,0.3,t,bk(),F); mk(p,cc,y+H+0.31,0.44,0.04,t+0.04,jit(0x4A2A38,0.05),F); }
    const ci=cc-dir*(t/2+0.02);                                                     /* sisi dalam: rantai + lentera jiwa */
    for(let k=0;k<5;k++) mk(mid,ci,y+H-0.08-k*0.09,0.03,0.07,0.03,k%2?0x4A4A54:0x32323A,F);
    mk(mid,ci,y+H-0.6,0.16,0.2,0.16,0x1A1A22,F); mk(mid,ci-dir*0.002,y+H-0.6,0.1,0.14,0.1,0x9FE8FF,F);
  };
  wall('x',x0,x1,z0,z0+T,1.5,-1);                 /* dinding utara (belakang) */
  wall('x',x0,x1,z1-T,z1,1.5,1);                  /* dinding selatan (depan) */
  wall('z',z0+T,z1-T,x1-T,x1,1.5,1);              /* dinding timur */
  /* dinding barat (sisi papan): map dengan fase Wither = TERTUTUP penuh (grup terpisah, runtuh saat Wither dibangunkan, lalu jembatan muncul);
     selain itu DIBUKA seluruhnya: hanya menara sudut + ambang lantai batu */
  if(BOSS==='wither'){
    const WB=makeBatch(); B=WB; wall('z',z0+T,z1-T,x0,x0+T,1.5,-1); B=B0;
    const px=x0+T/2,pg=new THREE.Group(),wg=buildBatch(WB); pg.position.set(px,y,cz); wg.position.set(-px,-y,-cz); pg.add(wg); world.add(pg);
    buildWitherFort(Fo,pg);
  }
  addBox(B,x0+0.15,y+0.03,cz,0.3,0.12,d-2*T,jit(0x3A2C35,0.04),F);   /* ambang masuk dari jembatan */
  [[x0+0.45,z0+0.45],[x1-0.45,z0+0.45],[x0+0.45,z1-0.45],[x1-0.45,z1-0.45]].forEach(q=>{ /* 4 menara sudut berdetail + obor api */
    const sx=q[0]<cx?-1:1,sz=q[1]<cz?-1:1;
    addBox(B,q[0],y+1.4,q[1],0.9,2.8,0.9,bk());
    [0.6,1.9].forEach(h=>addBox(B,q[0],y+h,q[1],0.98,0.1,0.98,jit(0x231820,0.04),F));                 /* cincin pita */
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(o=>addBox(B,q[0]+o[0]*0.43,y+1.4,q[1]+o[1]*0.43,0.1,2.8,0.1,jit(0x4A2A38,0.05),F)); /* tiang sudut */
    addBox(B,q[0]+sx*0.46,y+1.3,q[1],0.03,0.4,0.07,0x0A0508,F); addBox(B,q[0],y+1.3,q[1]+sz*0.46,0.07,0.4,0.03,0x0A0508,F); /* celah panah */
    addBox(B,q[0]+sx*0.46,y+2.3,q[1],0.03,0.3,0.06,0xFF8A1A,F); addBox(B,q[0],y+2.3,q[1]+sz*0.46,0.06,0.3,0.03,0xFF8A1A,F);
    addBox(B,q[0],y+2.82,q[1],1.04,0.12,1.04,jit(0x231820,0.04),F);                                    /* lantai menara */
    [[-1,-1],[1,-1],[-1,1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(o=>{ addBox(B,q[0]+o[0]*0.4,y+3.02,q[1]+o[1]*0.4,0.2,0.28,0.2,bk(),F); addBox(B,q[0]+o[0]*0.4,y+3.18,q[1]+o[1]*0.4,0.23,0.04,0.23,jit(0x4A2A38,0.05),F); });
    addBox(B,q[0],y+2.9,q[1],0.4,0.1,0.4,0x14090E,F); addFlame(q[0],y+2.95,q[1],1.3,{halo:2.0,hal:0.45});
  });
  /* lantai halaman: batu hitam papan catur 0.5 + jalur lebih terang dari gerbang barat ke altar (tanpa lava) */
  const FL=[0x2E222A,0x382A33],PA=[0x4A3A46,0x54424F],nx=Math.round((w-2*T)/0.5),nz=Math.round((d-2*T)/0.5);
  for(let i=0;i<nx;i++) for(let j=0;j<nz;j++){
    const fx=x0+T+0.25+i*0.5,fz=z0+T+0.25+j*0.5,onPath=Math.abs(fz-cz)<0.26&&fx<cx;
    addBox(B,fx,y+0.02,fz,0.5,0.04,0.5,jit((onPath?PA:FL)[(i+j)&1],0.03),F);
  }
  const top=addWitherAltar(B,cx,cz,y);                                  /* altar batu detail */
  makeWither(cx,cz,y+top);                                              /* Wither beranimasi (grup terpisah, digerakkan updateWither) */
}
function decorateNetherIslands(DB,th){
  const I=TILES.island,F={edge:false};
  Object.keys(I).sort().forEach(k=>{
    const c=I[k]; if(c.bridge) return; if(c.edge&&rnd()<0.6) return;
    const r=rnd(),x=c.x+(rnd()-0.5)*0.2,z=c.z+(rnd()-0.5)*0.2,h=c.h,bio=c.bio;
    if(nearLadderSnake(c.x,c.z,0.8)) return; /* jauhi jalur tangga & ular */
    if(bio==='crimson'||bio==='warped'){
      const wp=bio==='warped';
      if(r<0.22) lift(DB,()=>addMiniTree(DB,x,z,0.85+rnd()*0.3,wp),h);
      else if(r<0.42) lift(DB,()=>addMiniFungus(DB,x,z,0.85+rnd()*0.3,wp),h);
      else if(r<0.52) addBox(DB,x,h+0.13,z,0.26,0.26,0.26,jit(wp?0x14B485:0xA01E2E,0.1),F);
      else if(r<0.58) addBox(DB,x,h+0.04,z,0.4,0.08,0.4,0xFFC85A,F);
    }else if(bio==='soul'){
      if(r<0.28) lift(DB,()=>addSoulFire(DB,x,z),h);
      else if(r<0.56) lift(DB,()=>addRockMound(DB,x,z,0.9+rnd()*0.3),h); /* gundukan batu (pengganti tulang putih) */
    }else{
      if(r<0.55) lift(DB,()=>addBasalt(DB,x,z,0.9,0.5),h);
      else if(r<0.66) lift(DB,()=>addSoulFire(DB,x,z),h);
      else if(r<0.72) addBox(DB,x,h+0.1,z,0.3,0.2,0.3,0xC0501A,F);
    }
  });
  if(TILES.fort) addFortress(DB,TILES.fort);
}
function buildCustomGround(TB,th){
  const LAV=[0xFF8A1A,0xFFA02A,0xFF7A12,0xFFC03A],S=th.deep[0],W=th.wall[0]; /* lava cerah oranye dengan bercak kuning */
  const hsh=(x,z)=>(Math.imul(Math.floor(x*4)*73+19,0x9E3779B1)^Math.imul(Math.floor(z*4)*131+7,0x85EBCA6B))>>>0;
  /* lava dalam: sel 2x2 (x -12..16, z -11..9) */
  for(let gx=-11;gx<=15;gx+=2) for(let gz=-10;gz<=8;gz+=2) addBox(TB,gx,-0.35,gz,2,0.3,2,LAV[hsh(gx,gz)%4],{edge:false});
  /* pinggiran: sel 1x1 lava / darat sesuai nIsLava (garis pantai tidak kotak, ada kerak lava dan batu hangus di tepi) */
  const nearLava=(cx,cz)=>nIsLava(cx+1,cz)||nIsLava(cx-1,cz)||nIsLava(cx,cz+1)||nIsLava(cx,cz-1);
  for(let cx=-17.5;cx<=21.5;cx+=1) for(let cz=-16.5;cz<=14.5;cz+=1){
    if(cx>=-12&&cx<=16&&cz>=-11&&cz<=9) continue;
    const k=hsh(cx,cz);
    if(nIsLava(cx,cz)){
      let c=LAV[k%4];
      if(k%3===0&&(!nIsLava(cx+1,cz)||!nIsLava(cx-1,cz)||!nIsLava(cx,cz+1)||!nIsLava(cx,cz-1))) c=0xB03A12; /* kerak lava mendingin di tepi */
      addBox(TB,cx,-0.35,cz,1,0.3,1,c,{edge:false}); continue;
    }
    const h=hAt(cx,cz),nb=th.key==='nether'?netherBiomeAt(cx,cz):null;
    let top=nb?NB_GROUND[nb][k%4===0?1:0]:th.ground;
    if(nearLava(cx,cz)) top=(k%5===0)?0xC0501A:0x2E1010; /* tepi: magma block / batu hangus */
    addBox(TB,cx,(h-0.6)/2,cz,1,h+0.2,1,jit(h>=1.5?S:W,0.07),{edge:false});
    addBox(TB,cx,h-0.1,cz,1,0.2,1,jit(top,0.08),{edge:false});
  }
  for(let gx=-33;gx<=33;gx+=2) for(let gz=-28;gz<=28;gz+=2){
    if(gx>=-17&&gx<=21&&gz>=-16&&gz<=14) continue; /* area pita 1x1 di atas */
    const h=mcH(gx,gz);
    addBox(TB,gx,(h-0.6)/2,gz,2,h+0.2,2,jit(h>=1.5?S:W,0.07),{edge:false});
    const nb=th.key==='nether'?netherBiomeAt(gx,gz):null; /* tanah di pinggir lava diwarnai sesuai biome */
    addBox(TB,gx,h-0.1,gz,2,0.2,2,nb?jit(NB_GROUND[nb][(gx+gz)%4===0?1:0],0.08):jit(th.ground,0.08));
  }
  addBox(TB,PAD.x,-0.25,PAD.z,2.6,0.5,2.6,jit(th.wall[1],0.05)); /* alas area Start di atas lava */
  addBox(TB,PAD.x+1.7,-0.04,PAD.z,1.2,0.1,0.8,0x3A2A1A); /* papan penghubung ke petak 1 */
  if(TILES.island) buildNetherIslands(TB,th);
}
/* ---------- Lavafall: lava mengalir turun dari tepi board ke lautan lava (warna mengalir) ---------- */
function buildLavafalls(){
  const FALLS=TILES.falls||[[3,0,1],[9,0,1],[14,1,0],[26,-1,0],[30,0,-1],[70,0,-1],[75,0,-1],[109,0,-1],[115,0,-1]]; /* [petak, arah keluar x, arah keluar z] */
  FALLS.forEach((f,fi)=>{
    const t=TILES[f[0]]; if(!t) return;
    const dx=f[1],dz=f[2],px=t.x+dx*0.62,pz=t.z+dz*0.62,top=t.h,H=top+0.2;
    if(H<0.3) return;
    const g=new THREE.Group(),segs=[],n=Math.max(2,Math.round(H/0.25)),sh=H/n,w=dx?0.22:0.7,d=dx?0.7:0.22,geo=new THREE.BoxGeometry(w,sh*1.02,d);
    for(let i=0;i<n;i++){ const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xFF8A1A})); m.position.set(px,top-sh*(i+0.5),pz); g.add(m); segs.push(m); }
    const lip=new THREE.Mesh(new THREE.BoxGeometry(dx?0.34:0.95,0.08,dx?0.95:0.34),new THREE.MeshBasicMaterial({color:0xFF9A2A})); lip.position.set(t.x+dx*0.55,top,t.z+dz*0.55); g.add(lip);
    const sp=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.05,1.2),new THREE.MeshBasicMaterial({color:0xFFD060,transparent:true,opacity:0.85})); sp.position.set(px,-0.17,pz); g.add(sp);
    world.add(g); LAVAFALLS.push({segs,sp,ph:fi*1.7});
  });
}
const LF_A=new THREE.Color(0xFF5A10),LF_B=new THREE.Color(0xFFC24A);
function updateLavafalls(t){
  for(let i=0;i<LAVAFALLS.length;i++){
    const f=LAVAFALLS[i];
    for(let j=0;j<f.segs.length;j++) f.segs[j].material.color.copy(LF_A).lerp(LF_B,0.5+0.5*Math.sin(t*3.2-j*0.9+f.ph));
    f.sp.material.opacity=0.6+0.3*Math.sin(t*4+f.ph);
  }
}
function decorateCustom(DB,th){
  addWideFar(DB,th);
  if(th.key==='nether'){ buildLavafalls(); if(TILES.island) decorateNetherIslands(DB,th); }
  const D=MAPDEF||{},B=jit(th.wall[1],0.05);
  (D.props||[]).forEach(q=>{
    if(q[0]==='ghast'){ addFlyGhast(q[1],q[2],q[3]); return; }
    addBox(DB,q[1],-0.1,q[2],1.4,0.5,1.4,B); /* alas batu kecil di atas lava */
    if(q[0]==='tree') addNetherTree(DB,q[1],q[2],q[3]||1); else if(q[0]==='pillar') addPillar(DB,q[1],q[2],q[3]||3);
  });
}
function buildWorld(key){
  const th=THEMES.find(x=>x.key===key)||THEMES[0];
  theme=th; themeKey=th.key;
  applyMapRules(UT.Gameplay.Maps&&UT.Gameplay.Maps.get(th.key));
  const tk=++worldToken;
  seed=20241022+THEMES.indexOf(th)*977;
  PORTAL=null; ARENA=null; MOUNT=null; WITHER=null; FORT=null; CORNERF.length=0; disposeGroup(world); disposeGroup(sky);
  clouds=[]; snow=null; LADINFO={}; SNAKEINFO={}; fades.length=0; TREEPOS.length=0; GHASTS.length=0; LAVAFALLS.length=0; clearFX();
  const rs=document.documentElement.style;
  rs.setProperty('--sky-top',th.skyTop); rs.setProperty('--sky-bot',th.skyBot);
  hemi.groundColor.setHex(th.hemi);
  scene.fog=(th.key==='minecraft')?new THREE.Fog(new THREE.Color(th.skyBot),32,64):null;

  const TB=makeBatch();
  for(let n=1;n<=GOAL;n++){
    const t=TILES[n],colTop=t.h-0.2,hh=colTop+0.5;
    addBox(TB,t.x,-0.5+hh/2,t.z,1,hh,1,jit(t.bio&&NI_CLIFF[t.bio]?pick(NI_CLIFF[t.bio]):pick(th.wall),0.06));
    if(n===GOAL&&BOSS==='dragon'){ /* Block 100 = portal: permukaan hitam gelap (4x4 kotak seperti tile lain) + rim ungu tipis */
      for(let i=0;i<4;i++) for(let j=0;j<4;j++) addBox(TB,t.x+(i-1.5)*0.235,t.h-0.1,t.z+(j-1.5)*0.235,0.235,0.2,0.235,(i===0||i===3||j===0||j===3)?0x0A0712:0x161024,{edge:false}); /* 2 warna: border gelap + tengah sedikit lebih terang (tanpa papan catur) */
      [[0,-0.47,0.96,0.06],[0,0.47,0.96,0.06],[-0.47,0,0.06,0.88],[0.47,0,0.06,0.88]].forEach(f=>addBox(TB,t.x+f[0],t.h+0.012,t.z+f[1],f[2],0.024,f[3],0x2B1659,{edge:false}));
      continue;
    }
    {
      const bc=th.key==='minecraft'?mcBlock(n,th.key):tileBlock(n,t,th);
      for(let i=0;i<5;i++) for(let j=0;j<5;j++) addBox(TB,t.x+(i-2)*0.188,t.h-0.1,t.z+(j-2)*0.188,0.188,0.2,0.188,tileShade(bc,n,t,i,j,th.key),{edge:false}); /* grid 5x5: border 1 blok, tengah 3x3 (lebih besar dari 2x2) */
      for(let k=0;k<16;k++) rnd(); /* pertahankan jumlah panggilan rnd() lama (16 blok) agar seed dunia/dekor tidak bergeser */
      /* dekor kecil di sudut petak dibuang bila petak ini berisi mob/chest (bentrok). Argumen tetap dievaluasi -> urutan rnd() & seed dunia tidak berubah. */
      const decorOK=!(mobOn(n,th.key)||CHESTS.has(n)),dbox=(x,y,z,w,h,d,c,o)=>{ if(decorOK) addBox(TB,x,y,z,w,h,d,c,o); };
      const cx=()=>t.x+(rnd()<0.5?-0.34:0.34),cz=()=>t.z+(rnd()<0.5?-0.34:0.34);
      if(bc===0x5A9E3C&&rnd()<0.6) dbox(cx(),t.h+0.08,cz(),0.1,0.16,0.1,pick([0xF0453A,0xFFD23F,0xFF7EB6,0xFFFFFF,0x6AA8FF]),{edge:false});
      if(bc===0x8E8E8E) for(let k=0;k<3;k++) dbox(cx(),t.h+0.04,cz(),0.12,0.08,0.12,pick([0x222222,0x4AEDD9,0xFFD23F,0xD8AF93]),{edge:false});
      if((bc===0x3F76E4||bc===0x2F5FCC)&&rnd()<0.3) dbox(cx(),t.h+0.02,cz(),0.22,0.03,0.22,0x2E8B2E,{edge:false});
      if(bc===0x3F76E4||bc===0x2F5FCC) waterDetail(TB,t.x,t.z,t.h,0.94,0.94,n+200,3,3); /* riak air detail */
      if(bc===0x8A2B2B&&rnd()<0.3) dbox(cx(),t.h+0.06,cz(),0.1,0.12,0.1,0xE0561A,{edge:false});
    }
  }
  MCFLAT=(th.decor==='mc');
  if(BOARD_CUSTOM) buildCustomGround(TB,th); else buildMcTerrain(TB,th);
  if(!BOARD_CUSTOM){
    /* frame kayu 2 lapis: lapis DALAM (menempel petak) rata dengan permukaan petak, lapis LUAR lebih tinggi */
    const FT=TILES[1].h,FO=FT+0.4; /* FT = tinggi permukaan petak, FO = tinggi lapis luar */
    [[0,5.125,10.5,0.25,FT],[0,-5.125,10.5,0.25,FT],[5.125,0,0.25,10,FT],[-5.125,0,0.25,10,FT],
     [0,5.375,11,0.25,FO],[0,-5.375,11,0.25,FO],[5.375,0,0.25,10.5,FO],[-5.375,0,0.25,10.5,FO]].forEach((f,fi)=>{ const wb=th.key==='minecraft'?0x6B4424:th.wall[1],top=f[4]; addBox(TB,f[0],(top-0.25)/2,f[1],f[2],top+0.25,f[3],jit(wb,0.08)); }); /* tanpa corak papan kayu di permukaan atas */
    [[-5.25,5.25],[5.25,5.25],[-5.25,-5.25],[5.25,-5.25]].forEach(q=>{ addBox(TB,q[0],1.15,q[1],0.1,0.5,0.1,0x4E3118); addBox(TB,q[0],1.43,q[1],0.18,0.06,0.18,0x2E2E2E); });
  }
  // area mulai
  const SP=UT.Gameplay.Biomes.PALETTES.sandy,SPK=th.key==='salju'?SP.salju:SP.default,sandy=SPK[0],sandy2=SPK[1];
  /* blok Start: hanya border (tanpa isi warna) + api unggun & 4 kayu duduk di dalamnya */
  [[0,-0.95,2.04,0.14],[0,0.95,2.04,0.14],[-0.95,0,0.14,1.9],[0.95,0,0.14,1.9]].forEach(f=>addBox(TB,PAD.x+f[0],0.04,PAD.z+f[1],f[2],0.08,f[3],sandy2));
  addCampfire(TB,PAD.x,PAD.z);
  // bendera di petak 100
  const G=TILES[GOAL];
  for(let y=0;y<2.2;y+=0.4) addBox(TB,G.x-0.36,G.h+0.2+y,G.z-0.36,0.12,0.4,0.12,0xE9E4D4);
  addBox(TB,G.x-0.36,G.h+2.35,G.z-0.36,0.22,0.22,0.22,0xFFD23F);
  for(let c=0;c<4;c++) for(let r=0;r<2;r++) addBox(TB,G.x-0.36+0.22+c*0.22,G.h+2.05-r*0.22,G.z-0.36,0.22,0.22,0.05,(c+r)%2===0?th.flag:0xFFFFFF);
  world.add(buildBatch(TB));
  if(BOSS==='dragon'){
  PORTAL=buildPortal(TILES[GOAL]); world.add(PORTAL.g);
  ARENA=buildArena(); world.add(ARENA.g);
  /* arena kiri & gunung batu dihapus: Dragon Awakening kini terjadi di papan (bingkai bedrock + 6 tower menggantikan api sudut) */
  }
  buildMobs(th);

  /* obor di 4 sudut papan: api berkedip + lampu (menyala saat malam) */
  torchMeshes=[];
  (BOARD_CUSTOM?[]:[[-5.25,5.25],[5.25,5.25],[-5.25,-5.25],[5.25,-5.25]]).forEach((q,i)=>{
    const f=addFlame(q[0],1.46,q[1],1.2,{halo:2.0,hal:0.5}); f.lt=FLIGHTS[i]; f.li=1.25; f.lt.position.set(q[0],1.75,q[1]); f.s0=f.s; CORNERF.push(f);
  });

  const DB=makeBatch();
  if(BOARD_CUSTOM) decorateCustom(DB,th); else decorate(DB,th);
  world.add(buildBatch(DB));
  applyArenaState();
  spawnRoamers();

  LADINFO=buildLadders(th);
  SNAKEINFO=buildSnakes(th);

  if(th.key!=='nether') [[-16,8,-8,1.1],[-4,10,-13,1.3],[12,8.5,3,1],[18,11,-10,1.2],[-20,7.5,7,0.9],[5,12,-16,1.4]].forEach(c=>makeCloud(th,c[0],c[1],c[2],c[3])); /* Nether tanpa awan */
  if(th.snow||th.ember){
    const cnt=240,arr=new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){ arr[i*3]=(rnd()-0.5)*26; arr[i*3+1]=rnd()*14; arr[i*3+2]=(rnd()-0.5)*26; }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
    const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:th.ember||0xFFFFFF,size:0.16,sizeAttenuation:true}));
    sky.add(pts); snow={pts,arr,cnt};
  }
  fontReady.then(()=>{ if(tk===worldToken) buildLabels(th); });

  applyLook(th);
  const tb=$('btnTheme'); if(tb) tb.textContent='Maps: '+th.name;
  document.querySelectorAll('.tbtn').forEach(b=>b.setAttribute('aria-pressed',b.getAttribute('data-theme')===th.key?'true':'false'));
}

/* ---------- Pion ---------- */
function makePawn(d,nc){
  const b=makeBatch(),k=d.key,F={edge:false};
  const bx=(x,y,z,w,h,e,c,o)=>addBox(b,x,y,z,w,h,e,typeof c==='number'?jit(c,0.05):c,o);
  const head=(c,y)=>{ for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let l=-1;l<=1;l++) addBox(b,i*0.1,y+j*0.1,l*0.1,0.1,0.1,0.1,jit(c,0.09),F); };
  if(k==='creeper'){
    [-1,1].forEach(a=>[-1,1].forEach(z=>bx(a*0.09,0.09,z*0.08,0.14,0.18,0.14,0x2F7F2E)));
    for(let i=0;i<3;i++) bx(0,0.26+i*0.12,0,0.3,0.13,0.2,i%2?0x4DB84A:0x5FC95B);
    head(0x55C455,0.64);
    [-1,1].forEach(a=>{ bx(a*0.07,0.69,0.152,0.07,0.07,0.02,0x101010,F); bx(a*0.06,0.52,0.152,0.04,0.08,0.02,0x101010,F); });
    bx(0,0.6,0.152,0.07,0.1,0.02,0x101010,F); bx(0,0.55,0.152,0.12,0.06,0.02,0x101010,F);
  }else if(k==='ender'){
    [-1,1].forEach(a=>{ bx(a*0.04,0.25,0,0.06,0.5,0.06,0x15121C); bx(a*0.1,0.6,0,0.045,0.56,0.045,0x15121C); });
    bx(0,0.65,0,0.16,0.3,0.1,0x1B1824); head(0x15121C,0.97);
    [-1,1].forEach(a=>{ bx(a*0.07,0.98,0.152,0.07,0.035,0.02,0xE879F9,F); bx(a*0.07,0.98,0.162,0.03,0.035,0.01,0xA21CAF,F); });
  }else if(k==='villager'){ /* 4.1.14.10: karakter Computer = Villager humanoid (bukan Mob). Proporsi sama dgn Steve/Alex -> hop/glide/kamera tetap. */
    const rb=0x7A5A3A,sk=0xD9A77A;
    [-1,1].forEach(a=>{ bx(a*0.07,0.11,0,0.13,0.22,0.13,0x5E4328); bx(a*0.07,0.025,0.012,0.13,0.05,0.15,0x3B2A18,F); });
    bx(0,0.36,0,0.28,0.28,0.15,rb); bx(0,0.2,0,0.3,0.12,0.17,0x6B4B2A);
    bx(0,0.34,0.1,0.32,0.1,0.1,0x6B4B2A); /* tangan bersilang khas Villager */
    head(sk,0.64);
    bx(0,0.7,0.152,0.24,0.03,0.02,0x4A3A2A,F);
    [-1,1].forEach(a=>{ bx(a*0.065,0.66,0.152,0.06,0.045,0.02,0xFFFFFF,F); bx(a*0.065,0.66,0.162,0.03,0.045,0.01,0x2E8B2E,F); });
    bx(0,0.6,0.17,0.07,0.13,0.07,0xC08A5F,F);
  }else{
    const PP={alex:{skin:0xE8B48A,hair:0xD4701C,top:0x4FA84A,pants:0x6B4B2A,eye:0x2F8F3F},zombie:{skin:0x5E9E4A,hair:0x2F5F2A,top:0x1CA8B8,pants:0x3B3F9E,eye:0x1D1D6A},skeleton:{skin:0xE8E8E8,hair:0xCFCFCF,top:0xD6D6D6,pants:0xBDBDBD,eye:0x111111},steve:{skin:0xC58C62,hair:0x4A2E13,top:0x1CA8B8,pants:0x3B3F9E,eye:0x3B4FD8}},P=PP[k]||PP.steve;
    [-1,1].forEach(a=>{ bx(a*0.07,0.11,0,0.13,0.22,0.13,P.pants); bx(a*0.07,0.025,0.012,0.13,0.05,0.15,0x555560,F); bx(a*0.2,0.42,0,0.1,0.17,0.11,P.top); bx(a*0.2,0.27,0,0.1,0.12,0.11,P.skin); });
    bx(0,0.36,0,0.28,0.28,0.15,P.top);
    head(P.skin,0.64);
    bx(0,0.8,0,0.31,0.06,0.31,P.hair); bx(0,0.72,-0.14,0.31,0.2,0.04,P.hair,F); bx(0,0.76,0.15,0.3,0.05,0.02,P.hair,F);
    [-1,1].forEach(a=>{ bx(a*0.155,0.73,0,0.02,0.12,0.3,P.hair,F); bx(a*0.07,0.65,0.152,0.07,0.05,0.02,0xFFFFFF,F); bx(a*0.055,0.65,0.162,0.035,0.05,0.01,P.eye,F); });
    bx(0,0.615,0.152,0.05,0.03,0.02,0x8A5B3A,F);
    if(k==='steve') bx(0,0.57,0.152,0.1,0.03,0.02,0x5A3820,F); else bx(0,0.57,0.152,0.06,0.025,0.02,0xB0563A,F);
  }
  const g=new THREE.Group();
  const pal=buildBatch(b); g.add(pal); g.userData.pal=pal;
  if(d.png) upgradePawnPNG(g,pal,d.key); /* PNG gagal dimuat -> tetap palette (Steve) */
  if(nc!=null) upgradePawnNew(g,pal,nc);
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(0.13),new THREE.MeshLambertMaterial({color:d.hex,emissive:d.hex,emissiveIntensity:0.35}));
  marker.position.y=1.22; marker.visible=false;
  g.add(marker); g.userData.marker=marker;
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,color:0xFFE6A8,transparent:true,opacity:0.3,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  halo.scale.setScalar(1.2); halo.position.y=0.45; halo.visible=false; halo.renderOrder=3; g.add(halo); g.userData.halo=halo;
  return g;
}
/* Outline bidak yang sedang main: salinan mesh bidak yang diperlebar di ruang layar (lebar tetap relatif tinggi layar), digambar di kedalaman pusat bidak
   (digeser sedikit ke belakang) agar tetap terlihat dari atas/LOCK dan tidak tertutup tile. Satu lapis: warna kursi (tanpa putih). */
function olMaterial(col,th,c){
  const m=new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,depthWrite:false,fog:false});
  m.onBeforeCompile=sh=>{
    sh.uniforms.uOC={value:c}; sh.uniforms.uOT={value:th};
    sh.vertexShader='uniform vec3 uOC;uniform float uOT;\n'+sh.vertexShader.replace('#include <project_vertex>',`
      vec4 mvPosition=modelViewMatrix*vec4(transformed,1.0);
      vec4 pc=projectionMatrix*mvPosition;
      vec4 cv=modelViewMatrix*vec4(uOC,1.0); cv.z-=0.25;
      vec4 cc=projectionMatrix*cv;
      float asp=projectionMatrix[1][1]/projectionMatrix[0][0];
      vec2 d=pc.xy/pc.w-cc.xy/cc.w; d.x*=asp;
      float dl=length(d); vec2 dir=dl>1e-5?d/dl:vec2(0.0,1.0);
      vec2 nd=pc.xy/pc.w+vec2(dir.x/asp,dir.y)*2.0*uOT;
      gl_Position=vec4(nd*pc.w,(cc.z/cc.w)*pc.w,pc.w);`);
  };
  m.customProgramCacheKey=()=>'ut-pawn-outline';
  return m;
}
/* Panduan Ramuan Ganjil/Genap: petak di depan pemain yang bisa dituju (ganjil = +1/+3/+5, genap = +2/+4/+6, ditambah p.bonus) diberi
   bingkai tipis berwarna bidak pemain. Hanya visual (tanpa mengubah logika dadu); hilang saat flag dipakai (doRoll) / game reset. */
const GUIDE=new THREE.Group(); scene.add(GUIDE);
const GUIDE_GEO=new THREE.BoxGeometry(1,1,1),GUIDE_MAT={};
function guideMat(hex){ return GUIDE_MAT[hex]||(GUIDE_MAT[hex]=new THREE.MeshBasicMaterial({color:hex,depthWrite:false})); }
function syncDiceGuide(){
  while(GUIDE.children.length) GUIDE.remove(GUIDE.children[0]); /* geometri/material dipakai bersama, tidak di-dispose */
  if(gameOver) return;
  players.forEach(p=>{
    if(!(p.odd||p.even)||p.pos<0||p.pos>=GOAL) return;
    const first=p.odd?1:2,bn=p.bonus||0;
    for(let v=first;v<=6;v+=2){
      const n=p.pos+v+bn,t=TILES[n]; if(!t||n>GOAL) continue;
      [[0,-0.46,1,0.08],[0,0.46,1,0.08],[-0.46,0,0.08,0.84],[0.46,0,0.08,0.84]].forEach(f=>{
        const m=new THREE.Mesh(GUIDE_GEO,guideMat(p.hex)); m.scale.set(f[2],0.03,f[3]); m.position.set(t.x+f[0],t.h+0.025,t.z+f[1]); m.renderOrder=3; GUIDE.add(m);
      });
    }
  });
}
function pawnOutline(g,on,hex){
  (g.userData.olList||[]).forEach(h=>{ if(h.parent) h.parent.remove(h); h.material.dispose(); }); g.userData.olList=[];
  g.userData.outlineOn=!!on; g.userData.outlineHex=hex;
  if(!on) return;
  g.updateWorldMatrix(true,true);
  const T=[]; g.traverse(o=>{ if(o.isMesh&&o!==g.userData.marker&&!o.userData.ol&&!/Over$/.test(o.name)) T.push(o); });
  const cw=g.localToWorld(new THREE.Vector3(0,0.45,0));
  T.forEach(m=>{
    const c=m.worldToLocal(cw.clone());
    [[hex,0.0085,1]].forEach(a=>{
      const h=new THREE.Mesh(m.geometry,olMaterial(a[0],a[1],c)); h.userData.ol=true; h.renderOrder=a[2]; h.frustumCulled=false;
      m.add(h); g.userData.olList.push(h);
    });
  });
}
const lump=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xFFFFFF}));
lump.castShadow=true; lump.visible=false;

/* ---------- Animasi dasar ---------- */
const tweens=[];
function tween(dur,fn,ease){ return new Promise(res=>{ tweens.push({t:0,dur:Math.max(0.01,dur),fn,ease,res}); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let focus=null;
function hopTo(pawn,to,dur,hop){
  const from=pawn.position.clone(),dx=to.x-from.x,dz=to.z-from.z;
  if(dx*dx+dz*dz>1e-4) pawn.rotation.y=Math.atan2(dx,dz);
  return tween(dur,k=>{ pawn.position.lerpVectors(from,to,k); pawn.position.y+=Math.sin(Math.PI*k)*hop; });
}
function glide(pawn,pts,speed,ease,bob){
  const seg=[];let total=0;
  for(let i=1;i<pts.length;i++){ const l=pts[i].distanceTo(pts[i-1]); seg.push(l); total+=l; }
  return tween(Math.max(0.2,total/speed),k=>{
    let d=k*total,i=0;
    while(i<seg.length-1&&d>seg[i]){ d-=seg[i]; i++; }
    const f=seg[i]>0?Math.min(1,d/seg[i]):1;
    pawn.position.lerpVectors(pts[i],pts[i+1],f);
    if(bob) pawn.position.y+=Math.abs(Math.sin(k*total*3.4))*bob;
    const dx=pts[i+1].x-pts[i].x,dz=pts[i+1].z-pts[i].z;
    if(dx*dx+dz*dz>1e-4) pawn.rotation.y=Math.atan2(dx,dz);
  },ease);
}
function faceCamera(pawn){
  let r=pawn.rotation.y; r=Math.atan2(Math.sin(r),Math.cos(r));
  return tween(0.18,k=>{ pawn.rotation.y=r*(1-k); });
}
const lerp=(a,b,k)=>a+(b-a)*k;

/* ---------- Suara ---------- */
/* SFX = UT.GameplayAudio (gameplay/js/audio.js). Kapan suara dimainkan tetap ditentukan di sini; mute/musik/persistence tetap di sini. */
let muted=false;
const GA=window.UT&&UT.GameplayAudio;
function ensureAudio(){ try{ if(GA) GA.ensure(); }catch(e){} }
const sfx0=GA?GA.sfx:new Proxy({},{get:()=>()=>{}});
/* MP: suara hasil aksi (hit/chest/reward/power/pop) dimainkan host lalu di-mirror ke tamu lewat cue 'sfx'. Suara gerak (hop/ladder) sudah dimainkan tamu sendiri lewat cue walk/climb/bite. */
const SFX_DENY={roll:1,rollStop:1,hop:1,ladder:1,ladderStop:1,hiss:1,chomp:1,gulp:1,quakeStart:1,quakeStop:1,towerRise:1,towerStop:1,arenaUp:1,arenaStop:1,dragonSpawn:1,shuffleTick:1}; /* dimainkan tamu sendiri (walk/climb/bite & sequence boss) atau butuh handle lokal */
let MP_SEQ=0; /* >0 = host sedang menjalankan sequence yang juga dijalankan ulang di tamu -> jangan mirror suara/FX di dalamnya (hindari dobel) */
const sfx=new Proxy(sfx0,{get(t,k){ const v=t[k]; if(typeof v!=='function'||typeof k!=='string'||SFX_DENY[k]) return v; return function(...a){ try{ if(MP_SEQ===0) mpCue({k:'sfx',n:k,a:k==='power'?[a[0]]:[]}); }catch(e){} return v.apply(t,a); }; }}); /* modul tak termuat -> senyap, game tetap jalan (bukan implementasi audio kedua) */

/* ---------- Dadu ---------- */
/* Presentation dadu = UT.GameplayDiceUI (gameplay/js/dice-ui.js). Hasil dadu (random/Ramuan/6/tiga 6) tetap ditentukan di gameplay ini. */
function showDie(v,anim){
  const visual=$('dieScene');
  if(visual&&Number.isInteger(v)&&v>=1&&v<=6) visual.setAttribute('aria-label','Hasil dadu '+v);
  const D=window.UT&&UT.GameplayDiceUI; return D?D.showDie(v,anim):Promise.resolve(v);
}
function dice3dOn(){ const D=window.UT&&UT.GameplayDiceUI; return !!(D&&D.ready); }
/* Lempar dadu 3D asli (Dice Kit): kocok + fisika berakhir di angka v (angka tetap dari gameplay). Selesai saat dadu mendarat dan angka tampil;
   dadu dipercepat (speed 1,7) dan dipaksa mendarat bila >3 dtk; batas 4,5 dtk agar game tidak macet. Tanpa dadu 3D (modul gagal) / reduce-motion: jeda singkat seperti dulu. */
/* Dadu yang dilempar = dadu milik pelempar: CPU = klasik; online: diri sendiri = dadu terpasang, pemain lain = dadu terpasang mereka (dari server, cadangan klasik);
   offline: pemain 1 (akun ini) = dadu terpasang, pemain manusia lain (hotseat) = klasik. */
function diceKeyFor(p){
  if(!p||p.cpu) return 'klasik';
  if(ONLINE_ROOM) return (MP_ID&&p.networkId===MP_ID)?diceKey:(p.diceKey||'klasik');
  return p.idx===0?diceKey:'klasik';
}
function dieRoll(v,pl){
  /* Dadu DILEMPAR bidak giliran dan jatuh di dekatnya (UT.GameplayDiceThrow, gameplay/js/dice-throw.js). Angka v tetap dari gameplay.
     Indikator di dekat profil (#dieScene) menampilkan hasil saat dadu dunia mendarat. Modul/bidak tak ada atau reduce-motion -> dadu panel lama. */
  const T=window.UT&&UT.GameplayDiceThrow, pw=pl&&pl.pawn;
  if(!reduce&&T&&T.ready&&pw&&pw.visible!==false&&Number.isInteger(v)&&v>=1&&v<=6){
    let rs=null; const ownSfx=!T.kitReady; /* DiceKit punya suara sendiri; suara game dipakai hanya untuk dadu cadangan */
    /* titik jatuh: DI PAPAN, tepat 1 petak di depan bidak */
    let land=null; try{ const k=1, ti=Math.min(GOAL,(pl.pos||0)+k), tt=TILES[ti]; if(tt&&ti>(pl.pos||0)) land=new THREE.Vector3(tt.x,tt.h,tt.z); }catch(e){}
    /* Tiap pemain melempar dadunya sendiri (diceKeyFor); setSkin menunggu skin terpasang sebelum dilempar */
    const sk=(T.setSkin&&T.setSkin(diceKeyFor(pl)))||Promise.resolve();
    const p=Promise.resolve(sk).then(()=>T.throwFrom(pw.position,v,{ camera:camera, canvas:$('c'), target:camTarget, land:land,
      onThrow:()=>{ try{ T.hideNumber(); }catch(e){} pawnAct(pw,'attack'); if(ownSfx){ try{ rs=sfx.roll(); }catch(e){} } },
      onBounce:()=>{ if(ownSfx){ try{ sfx.bounce(); }catch(e){} } },
      onLand:()=>{ try{ sfx.rollStop(rs); }catch(e){} if(!specialDiceActive(pl)||isLocalPlayer(pl)) T.showNumber(v); /* mode serang Crystal/Boss: angka di atas emoji hanya untuk pemilik */ } }));
    const t=setTimeout(()=>{ try{ T.skip(); }catch(e){} },2800); /* terlalu lama (FPS rendah): paksa mendarat agar pion tidak mendahului */
    return Promise.race([p,sleep(3800)]).then(()=>clearTimeout(t));
  }
  const p=showDie(v,!reduce);
  if(reduce) return sleep(250);
  if(!dice3dOn()) return sleep(1300);
  const D=window.UT.GameplayDiceUI, t=setTimeout(()=>{ try{ D.finish(); }catch(e){} },3000); /* dadu terlalu lama (FPS rendah/guling di tepi): paksa rebah di angkanya agar pion tidak mendahului */
  return Promise.race([p,sleep(4500)]).then(()=>clearTimeout(t));
}
function syncDiceSound(){ try{ const D=window.UT&&UT.GameplayDiceUI; if(D){ D.setSound(!muted); D.setVolume(sfxVol/100); } }catch(e){} try{ const T=window.UT&&UT.GameplayDiceThrow; if(T){ T.setSound(!muted); T.setVolume(sfxVol/100); } }catch(e){} }
try{ const T=window.UT&&UT.GameplayDiceThrow; if(T) T.init(scene); }catch(e){ console.error(e); }
try{ const D=window.UT&&UT.GameplayDiceUI; if(D&&!(window.UT.GameplayDiceThrow&&UT.GameplayDiceThrow.ready)) D.init(); }catch(e){ console.error(e); } /* panel dadu lama hanya bila dadu lempar tak ada (hemat 1 WebGL context) */
showDie(1,false);

/* ---------- Konfeti ---------- */
function spawnConfetti(pos){ if(MP_SEQ===0&&pos) mpCue({k:'confetti',x:pos.x,y:pos.y,z:pos.z}); if(FX) FX.spawnConfetti(pos); } /* visual: UT.GameplayFX */
function spawnExplosion(pos,kind){ if(MP_SEQ===0&&pos) mpCue({k:'blast',x:pos.x,y:pos.y,z:pos.z,kind:kind}); if(FX&&FX.spawnExplosion) FX.spawnExplosion(pos,kind); else if(FX) FX.spawnConfetti(pos); } /* ledakan = serpihan kecil + asap (kind 'ender' = ungu Enderman, default = api), bukan konfeti */
function clearConfetti(){ if(FX) FX.clearConfetti(); }
/* Firework 2D (4.1.23.4): 1 visual + 1 SFX per game, dipanggil HANYA dari celebrate(p) (event kemenangan, satu-satunya jalur menuju finishGame). FW_GID = gameId terakhir yang sudah dirayakan -> tak bisa dobel dalam satu game.
   Posisi: titik di atas pion pemenang diproyeksikan ke layar (dibaca sekali saat event, bukan tiap frame). Modul tak termuat/error -> dilewati, gameplay tetap jalan. */
/* Efek visual Power (partikel/asap/percikan): data per Power ada di data/power/power-fx.js (UT.PowerFX). Titik efek = pion di layar (diproyeksikan sekali saat dipanggil). Modul tak termuat -> dilewati. */
function powerFxPawn(key,pl){
  if(MP_SEQ===0) mpCue({k:'pfx',key:key,pid:pl&&pl.networkId});
  if(key==='shield_block'||key==='totem_block'){ try{ sfx.powerBlock(key); }catch(e){} } /* suara menahan serangan: juga saat reduce-motion */
  try{
    if(!pl||!pl.pawn||reduce) return;
    /* Efek Power selalu di TENGAH layar (bukan di atas pion). Canvas 3D = sebesar canvas game (1 layar) agar aura/partikel tidak terpotong; model power sendiri diperkecil 1,5x (SHRINK di power-overlay.js) dari ukuran dasar 90% sisi pendek layar (320-760px) */
    const r=$('c').getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    const size=Math.round(Math.max(320,Math.min(760,Math.min(r.width,r.height)*0.9)));
    const O=window.UT&&UT.PowerOverlay; if(O&&O.supports(key)&&O.playAt(key,x,y,{size,rect:{left:r.left,top:r.top,width:r.width,height:r.height}})) return; /* 3D: model + aura + partikel */
    const PF=window.UT&&UT.PowerFX; if(PF) PF.play(key,x,y); /* cadangan 2D */
  }catch(e){}
}
let FW_GID=-1;
function fireworkCelebrate(p){
  try{
    const FW=window.UT&&UT.FireworkFX; if(!FW||FW_GID===gameId) return; FW_GID=gameId;
    const r=$('c').getBoundingClientRect(),v=p.pawn.position.clone(); v.y+=2.5; v.project(camera);
    const cl=(n,a,b)=>Math.max(a,Math.min(b,n));
    FW.burstAt(r.left+cl((v.x+1)/2,0.12,0.88)*r.width, r.top+cl((1-v.y)/2,0.12,0.88)*r.height);
  }catch(e){}
}

/* ---------- Naga (desain orisinal: "Naga Zamrud") ----------
   Naga bergaya fantasi: sisik merah gelap bercorak hitam, perut perunggu berpelat, tanduk obsidian, duri bara, sayap selaput merah-hitam.
   API tetap: dragon.userData = {wR,wL,y0,dy,shk,mats} (+ head,jaw,tail,wRo,wLo,mouth,open untuk animasi & semburan api). */
const DPAL={body:0x7E1515,dark:0x140809,hi:0xB5321F,belly:0xD9A24A,belly2:0x8A5A22,horn:0x2B1B1A,spike:0xF2862A,claw:0xD8C9A8,eye:0xFFB41A,pupil:0x120A06,tooth:0xFFF1D6,mouth:0xC4361A,mem1:0x1C0606,mem2:0x6B0F10,mem3:0xB8301E};
function dVec(a,b){ return [b[0]-a[0],b[1]-a[1],b[2]-a[2]]; }
function dLerp(a,b,k){ return [a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k]; }
/* tulang/kotak miring dari titik a ke b (tebal th) */
function dBone(B,a,b,th,col){
  const U=[(b[0]-a[0])/2,(b[1]-a[1])/2,(b[2]-a[2])/2],len=Math.hypot(U[0],U[1],U[2])||1e-3,u=[U[0]/len,U[1]/len,U[2]/len];
  const ref=Math.abs(u[1])<0.9?[0,1,0]:[1,0,0];
  let v=[u[1]*ref[2]-u[2]*ref[1],u[2]*ref[0]-u[0]*ref[2],u[0]*ref[1]-u[1]*ref[0]]; const vl=Math.hypot(v[0],v[1],v[2])||1; v=[v[0]/vl,v[1]/vl,v[2]/vl];
  const w=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],h=th/2;
  addOBox(B,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[U[0]*1.06,U[1]*1.06,U[2]*1.06],[v[0]*h,v[1]*h,v[2]*h],[w[0]*h,w[1]*h,w[2]*h],col);
}
/* segitiga berwarna per-titik (selaput sayap / sirip) */
function dTri(B,p,q,r,cp,cq,cr){
  const e1=dVec(p,q),e2=dVec(p,r); let n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]]; const l=Math.hypot(n[0],n[1],n[2])||1; n=[n[0]/l,n[1]/l,n[2]/l];
  const base=B.n; [[p,cp],[q,cq],[r,cr]].forEach(a=>{ const c=new THREE.Color(a[1]); B.pos.push(a[0][0],a[0][1],a[0][2]); B.nor.push(n[0],n[1],n[2]); B.col.push(c.r,c.g,c.b); });
  B.idx.push(base,base+1,base+2); B.n+=3;
}
/* rantai ruas menyempit: pts = [x,y,z,tebal]; cb(i) = warna ruas ke-i */
function dChain(B,pts,cb){ for(let i=0;i<pts.length-1;i++){ const a=pts[i],b=pts[i+1]; dBone(B,a,b,(a[3]+b[3])/2,cb(i)); } }
function dSpike(B,x,y,z,s,col,tip){ addBox(B,x,y+s*0.45,z,s*0.9,s*0.9,s*0.9,col,{edge:false}); addBox(B,x,y+s*1.15,z,s*0.5,s*0.7,s*0.5,tip,{edge:false}); }
function dWing(sg,P,mk,DW){
  const mx=p=>[sg*p[0],p[1],p[2]],root=new THREE.Group(),outer=new THREE.Group();
  const IB=makeBatch(),IM=makeBatch(),OB=makeBatch(),OM=makeBatch(),Ep=mx([1.0,0.22,-0.1]);
  dBone(IB,[sg*0.05,0,0],Ep,0.2,P.body); addBox(IB,sg*0.02,0.02,0.02,0.3,0.3,0.3,P.dark);
  dTri(IM,[0,0,0],Ep,mx([0,-0.3,-1.55]),P.mem1,P.mem2,P.mem1); /* selaput antara lengan atas dan badan */
  outer.position.set(Ep[0],Ep[1],Ep[2]);
  const O=[0,0,0],W=mx([0.95,0.1,0.12]),Bp=mx([-1.0,-0.45,-1.45]);
  const T=[[2.05,-0.05,-0.15],[1.85,-0.25,-0.95],[1.35,-0.42,-1.6],[0.7,-0.5,-1.95]].map(mx);
  dBone(OB,O,W,0.15,P.body); dBone(OB,W,[W[0]+sg*0.12,W[1]+0.06,W[2]+0.4],0.1,P.horn); /* lengan bawah + cakar pergelangan */
  T.forEach(t=>{ dBone(OB,W,t,0.075,P.hi); addBox(OB,t[0],t[1],t[2],0.1,0.1,0.1,P.spike,{edge:false}); });
  for(let i=0;i<3;i++){ const a=T[i],b=T[i+1],m=dLerp(dLerp(a,b,0.5),W,0.16); /* tepi belakang bergerigi (scallop) */
    dTri(OM,W,a,m,P.mem1,P.mem3,P.mem2); dTri(OM,W,m,b,P.mem1,P.mem2,P.mem3); }
  dTri(OM,O,W,T[3],P.mem1,P.mem1,P.mem3); dTri(OM,O,T[3],Bp,P.mem1,P.mem3,P.mem1);
  root.add(mk(IB)); root.add(mk(IM,DW)); outer.add(mk(OB)); outer.add(mk(OM,DW)); root.add(outer);
  return {root,outer};
}
function makeDragon(){
  const g=new THREE.Group(),rig=new THREE.Group(),P=DPAL; rig.scale.setScalar(0.66); g.add(rig);
  const DM=new THREE.MeshLambertMaterial({vertexColors:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const DW=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const DL=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.6});
  const DB=new THREE.MeshBasicMaterial({vertexColors:true});
  const mk=(B,mat)=>buildBatch(B,{mat:mat||DM,lineMat:DL});
  /* --- badan: torso, corak punggung, pelat perut, sisik sisi, kaki --- */
  const BB=makeBatch();
  addBox(BB,0,0,0,0.8,0.55,1.5,P.body); addBox(BB,0,0.04,0.62,0.9,0.62,0.55,P.body); addBox(BB,0,0,-0.65,0.7,0.5,0.55,P.body);
  addBox(BB,0,0.31,0,0.34,0.07,1.5,P.dark,{edge:false}); addBox(BB,0,0.37,0.62,0.4,0.07,0.55,P.dark,{edge:false}); addBox(BB,0,0.27,-0.65,0.3,0.07,0.55,P.dark,{edge:false});
  for(let i=0;i<9;i++) addBox(BB,0,-0.31,-0.85+i*0.24,0.62-(i<2?0.12:0),0.07,0.2,i%2?P.belly2:P.belly,{edge:false});
  for(const s of [-1,1]) for(let i=0;i<5;i++) for(let j=0;j<2;j++) addBox(BB,s*0.41,0.1-0.17*j,-0.55+i*0.3+(j%2)*0.15,0.05,0.12,0.2,(i+j)%2?P.hi:P.dark,{edge:false});
  for(const z of [-0.5,-0.18,0.14,0.46]) addBox(BB,0,0.02,z,0.83,0.58,0.09,P.dark,{edge:false}); /* pita hitam melintang (corak harimau) */
  for(let i=0;i<6;i++) dSpike(BB,0,0.34,0.72-i*0.28,0.16-i*0.008,P.spike,P.horn);
  const NK=[[0,0.2,0.8,0.5],[0,0.42,1.1,0.44],[0,0.68,1.35,0.4],[0,0.95,1.55,0.36],[0,1.2,1.72,0.34]];
  dChain(BB,NK,i=>i%2?P.dark:P.hi);
  for(let i=0;i<NK.length-1;i++){ const a=NK[i],b=NK[i+1]; addBox(BB,0,(a[1]+b[1])/2-0.1,(a[2]+b[2])/2+0.13,0.26,0.05,0.15,i%2?P.belly2:P.belly,{edge:false}); if(i<3) dSpike(BB,0,(a[1]+b[1])/2+0.18,(a[2]+b[2])/2-0.08,0.13,P.spike,P.horn); }
  for(const s of [-1,1]){
    dBone(BB,[s*0.42,-0.2,0.55],[s*0.58,-0.5,0.42],0.2,P.body); dBone(BB,[s*0.58,-0.5,0.42],[s*0.5,-0.7,0.72],0.14,P.dark); addBox(BB,s*0.5,-0.74,0.8,0.2,0.08,0.26,P.hi);
    dBone(BB,[s*0.4,-0.18,-0.6],[s*0.64,-0.5,-0.45],0.26,P.body); dBone(BB,[s*0.64,-0.5,-0.45],[s*0.52,-0.8,-0.82],0.16,P.dark); addBox(BB,s*0.52,-0.86,-0.7,0.24,0.08,0.34,P.hi);
    for(const [fx,fz] of [[0.5,0.97],[0.6,0.97],[0.44,0.97]]) addBox(BB,s*(fx),-0.76,fz,0.05,0.06,0.12,P.claw,{edge:false});
    for(const d of [-0.07,0,0.07]) addBox(BB,s*0.52+d,-0.88,-0.5,0.05,0.06,0.14,P.claw,{edge:false});
  }
  rig.add(mk(BB));
  /* --- kepala: tengkorak, moncong, alis, tanduk, pipi, gigi; rahang bawah terpisah (membuka saat menyembur api) --- */
  const head=new THREE.Group(); head.position.set(0,1.28,1.78); rig.add(head);
  const HB=makeBatch(),EB=makeBatch(),JB=makeBatch();
  addBox(HB,0,0,0,0.5,0.42,0.5,P.body); addBox(HB,0,-0.05,0.38,0.34,0.24,0.42,P.hi); addBox(HB,0,-0.04,0.62,0.3,0.2,0.1,P.dark);
  addBox(HB,0,0.23,0.05,0.2,0.06,0.5,P.dark,{edge:false});
  for(const s of [-1,1]){
    addBox(HB,s*0.07,0.02,0.68,0.05,0.05,0.04,P.pupil,{edge:false}); addBox(HB,s*0.17,0.2,0.12,0.18,0.07,0.28,P.dark,{edge:false});
    addBox(HB,s*0.28,-0.1,-0.1,0.1,0.1,0.2,P.horn,{edge:false}); addBox(HB,s*0.24,-0.04,-0.28,0.08,0.08,0.14,P.spike,{edge:false});
    dBone(HB,[s*0.15,0.2,-0.12],[s*0.27,0.4,-0.45],0.11,P.horn); dBone(HB,[s*0.27,0.4,-0.45],[s*0.31,0.42,-0.9],0.07,P.spike);
    addBox(EB,s*0.255,0.07,0.15,0.06,0.1,0.13,P.eye,{edge:false}); addBox(EB,s*0.288,0.07,0.15,0.02,0.09,0.04,P.pupil,{edge:false});
    for(const z of [0.44,0.56,0.68]) addBox(HB,s*0.13,-0.2,z,0.05,0.09,0.05,P.tooth,{edge:false});
  }
  head.add(mk(HB)); head.add(buildBatch(EB,{mat:DB,cast:false}));
  const jaw=new THREE.Group(); jaw.position.set(0,-0.17,-0.05); head.add(jaw);
  addBox(JB,0,-0.04,0.38,0.3,0.1,0.7,P.dark); addBox(JB,0,0.0,0.4,0.22,0.04,0.5,P.mouth,{edge:false});
  for(const s of [-1,1]) for(const z of [0.5,0.62]) addBox(JB,s*0.1,0.05,z,0.045,0.08,0.045,P.tooth,{edge:false});
  jaw.add(mk(JB));
  const mouth=new THREE.Object3D(); mouth.position.set(0,-0.12,0.74); head.add(mouth);
  /* --- ekor: ruas menyempit, duri punggung, pelat perut, sirip ujung --- */
  const tail=new THREE.Group(); tail.position.set(0,0,-0.9); rig.add(tail);
  const TB=makeBatch(),TM=makeBatch();
  const TP=[[0,0,0,0.4],[0,-0.02,-0.55,0.34],[0,0.04,-1.1,0.27],[0,0.16,-1.65,0.21],[0,0.32,-2.15,0.15],[0,0.5,-2.6,0.1]];
  dChain(TB,TP,i=>i%2?P.dark:P.body);
  for(let i=0;i<TP.length-1;i++){ const a=TP[i],b=TP[i+1]; addBox(TB,0,(a[1]+b[1])/2-(a[3]+b[3])/4,(a[2]+b[2])/2,0.2,0.04,0.3,i%2?P.belly2:P.belly,{edge:false}); dSpike(TB,0,(a[1]+b[1])/2+(a[3]+b[3])/4,(a[2]+b[2])/2,0.14-i*0.016,P.spike,P.horn); }
  dTri(TM,[0,0.5,-2.62],[0,0.72,-3.3],[0.3,0.55,-2.88],P.spike,P.horn,P.belly2); dTri(TM,[0,0.5,-2.62],[0,0.72,-3.3],[-0.3,0.55,-2.88],P.spike,P.horn,P.belly2);
  tail.add(mk(TB)); tail.add(mk(TM,DW));
  /* --- sayap (2 ruas: lengan + ujung yang melentur) --- */
  const R=dWing(1,P,mk,DW),L=dWing(-1,P,mk,DW);
  R.root.position.set(0.42,0.3,0.4); L.root.position.set(-0.42,0.3,0.4); rig.add(R.root); rig.add(L.root);
  const T=TILES[GOAL]; g.position.set(T.x,T.h+2.4,T.z);
  g.userData={wR:R.root,wL:L.root,wRo:R.outer,wLo:L.outer,head,jaw,tail,rig,mouth,open:0,y0:T.h+2.4,dy:0,shk:0,mats:[]};
  const seen=new Set(); g.traverse(o=>{ if(o.material&&!seen.has(o.material)){ seen.add(o.material); g.userData.mats.push(o.material); } });
  g.visible=false; /* dormant: naga baru tampil saat ada pemain di Block 100 */
  scene.add(g); return g;
}
const dragon=makeDragon();
/* ---------- Efek naga 3D (kubus piksel halus, murni visual: TANPA damage / efek gameplay) ----------
   Api: hanya dari mulut saat menyembur (kuning -> oranye -> merah -> gelap, transparan memudar).
   Asap: terus naik pelan dari sudut bibir kiri & kanan, seperti asap api unggun. */
const DFX=(()=>{
  const grp=new THREE.Group(); scene.add(grp);
  const geo=new THREE.BoxGeometry(1,1,1),FIRE=[],SMK=[];
  const mk=(n,arr)=>{ for(let i=0;i<n;i++){ const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false})); m.visible=false; grp.add(m); arr.push({m,life:0,max:1,vx:0,vy:0,vz:0,s:0.1,ph:0,side:0,spark:false}); } };
  mk(220,FIRE); mk(56,SMK);
  const RAMP=[[0,0xFFF3B0],[0.18,0xFFCB3A],[0.45,0xFF7A14],[0.75,0xE0300E],[1,0x5A0C08]].map(a=>[a[0],new THREE.Color(a[1])]);
  const SC0=new THREE.Color(0x3A3A40),SC1=new THREE.Color(0xA0A0AA),tmp=new THREE.Color();
  function ramp(t,out){ for(let i=1;i<RAMP.length;i++){ if(t<=RAMP[i][0]){ const a=RAMP[i-1],b=RAMP[i]; return out.copy(a[1]).lerp(b[1],(t-a[0])/(b[0]-a[0]||1)); } } return out.copy(RAMP[RAMP.length-1][1]); }
  const free=arr=>{ for(const q of arr) if(q.life<=0) return q; return null; };
  const V=new THREE.Vector3(),M=new THREE.Vector3(),T=new THREE.Vector3(),Dv=new THREE.Vector3(),LP=new THREE.Vector3();
  let acc=0,sacc=[0,0],clock=0;
  function emitFire(dir,sp,n,k){
    for(let i=0;i<n;i++){ const q=free(FIRE); if(!q) return;
      const spark=Math.random()<0.12, j=0.2;
      V.copy(dir).add(LP.set((Math.random()-.5)*j,(Math.random()-.5)*j,(Math.random()-.5)*j)).normalize();
      const v=sp*(spark?1.25:0.72+Math.random()*0.5);
      q.vx=V.x*v; q.vy=V.y*v; q.vz=V.z*v; q.spark=spark;
      q.max=q.life=spark?0.9+Math.random()*0.5:0.55+Math.random()*0.5; q.s=spark?0.06+Math.random()*0.05:0.17+Math.random()*0.17;
      q.m.position.set(M.x+(Math.random()-.5)*0.05,M.y+(Math.random()-.5)*0.05,M.z+(Math.random()-.5)*0.05);
      q.m.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); q.m.visible=true; }
  }
  function emitSmoke(side,head){
    const q=free(SMK); if(!q) return;
    head.localToWorld(LP.set(side*0.15,-0.11,0.5+Math.random()*0.1));        /* sudut bibir kiri / kanan */
    q.m.position.copy(LP); q.side=side; q.ph=Math.random()*6.28;
    q.vx=side*(0.03+Math.random()*0.07); q.vy=0.5+Math.random()*0.3; q.vz=(Math.random()-.5)*0.06;
    q.max=q.life=1.9+Math.random()*1.0; q.s=0.09+Math.random()*0.05;
    q.m.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); q.m.visible=true;
  }
  function step(dt,o){
    clock+=dt;
    if(o.fire){ /* api: arah = ke pemain aktif, mulai dari mulut */
      const D=dragon.userData; D.head.updateWorldMatrix(true,false); D.mouth.getWorldPosition(M);
      const pl=players[cur];
      if(pl&&pl.pawn){ T.copy(pl.pawn.position); T.y+=0.35; } else { D.head.localToWorld(T.set(0,-0.1,3)); }
      Dv.copy(T).sub(M); const dist=Dv.length()||1; Dv.divideScalar(dist);
      const reach=Math.max(2.2,Math.min(dist,6.5)),sp=reach/0.7;
      acc+=dt*(o.fire>0?150*o.fire:0); const n=Math.floor(acc); acc-=n; if(n) emitFire(Dv,sp,n);
    } else acc=0;
    if(o.smoke){ const D=dragon.userData; D.head.updateWorldMatrix(true,false);
      for(let i=0;i<2;i++){ sacc[i]+=dt*6.5; while(sacc[i]>=1){ sacc[i]-=1; emitSmoke(i?1:-1,D.head); } } }
    for(const q of FIRE){ if(q.life<=0) continue; q.life-=dt; if(q.life<=0){ q.m.visible=false; q.m.material.opacity=0; continue; }
      const t=1-q.life/q.max; q.vy+=1.6*dt; q.m.position.x+=q.vx*dt; q.m.position.y+=q.vy*dt; q.m.position.z+=q.vz*dt;
      const sz=q.s*(q.spark?1-0.6*t:(0.55+0.95*Math.sqrt(t))*(1-0.45*t)); q.m.scale.setScalar(sz);
      q.m.material.color.copy(ramp(q.spark?Math.min(1,t*0.8):t,tmp));
      q.m.material.opacity=(t<0.08?t/0.08:Math.pow(1-(t-0.08)/0.92,1.3))*(q.spark?0.95:0.92); }
    for(const q of SMK){ if(q.life<=0) continue; q.life-=dt; if(q.life<=0){ q.m.visible=false; q.m.material.opacity=0; continue; }
      const t=1-q.life/q.max; q.m.position.x+=(q.vx+Math.sin(clock*1.8+q.ph)*0.07)*dt; q.m.position.y+=q.vy*dt*(1-0.35*t); q.m.position.z+=(q.vz+Math.cos(clock*1.5+q.ph)*0.05)*dt;
      q.m.scale.setScalar(q.s*(1+2.4*t)); q.m.material.color.copy(SC0).lerp(SC1,t);
      q.m.material.opacity=0.62*Math.min(1,t/0.12)*Math.pow(1-t,1.2); }
  }
  function clear(){ for(const q of FIRE.concat(SMK)){ q.life=0; q.m.visible=false; q.m.material.opacity=0; } acc=0; sacc[0]=sacc[1]=0; }
  return {step,clear};
})();
const DFIRE={t:0,on:false,next:0,DUR:1.9};
function dragonFireOK(){ return dragon.visible&&AWK.done&&!AWK.running&&!DRG.defeated&&!gameOver&&!paused&&!reduce&&!document.hidden&&players.length>0; }
function dragonBreathe(){ if(DFIRE.on||!dragonFireOK()) return false; DFIRE.on=true; DFIRE.t=0; return true; }
function dragonFireStop(){ DFIRE.on=false; }
function updateDragonFire(dt,now){
  const D=dragon.userData,ok=dragonFireOK();
  let fire=0;
  if(!DFIRE.on){
    D.open=Math.max(0,(D.open||0)-dt*3);
    if(!DFIRE.next) DFIRE.next=now+4000+Math.random()*3000;
    else if(now>=DFIRE.next){ DFIRE.next=now+7000+Math.random()*4000; dragonBreathe(); }
  } else if(!ok){ dragonFireStop(); }
  else {
    DFIRE.t+=dt; const k=DFIRE.t/DFIRE.DUR;
    if(k>=1) dragonFireStop();
    else { D.open=k<0.12?k/0.12:(k>0.82?(1-k)/0.18:1); /* rahang membuka selama menyembur */
      fire=(k<0.12?k/0.12:(k>0.8?Math.max(0,(1-k)/0.2):1)); }
  }
  DFX.step(dt,{fire:DFIRE.on?fire:0,smoke:ok||(dragon.visible&&!reduce&&!document.hidden&&AWK.done&&!AWK.running&&!DRG.defeated&&!gameOver)});
}
/* ---------- Naga terbang di atas papan World ----------
   Jalur = angka delapan di atas area papan (FLY). Heading mengikuti arah gerak (dihaluskan), miring (roll) saat berbelok.
   Transparan seperti awan bila naga dekat kamera / memotong garis pandang kamera ke titik sorot, supaya tidak menutupi papan & bidak. */
function dragonFlight(dt,now){
  const D=dragon.userData,b=FLY.blend;
  if(D.hd===undefined){ D.hd=0; D.roll=0; }
  if(b>0) FLY.a+=dt*FLY.spd*b;
  const a=FLY.a,px=FLY.cx+FLY.rx*Math.sin(a),pz=FLY.cz+FLY.rz*Math.sin(2*a),py=FLY.y+0.5*Math.sin(a*1.7+0.6)-FLY.dip*Math.pow(Math.abs(Math.sin(a)),6);
  dragon.position.x=px*b; dragon.position.z=pz*b;
  dragon.position.y=CC_TOP+(py-CC_TOP)*b+Math.sin(now*0.003)*0.18+D.dy;
  if(b>0.03){
    const th=Math.atan2(FLY.rx*Math.cos(a),2*FLY.rz*Math.cos(2*a)); let df=th-D.hd; df=Math.atan2(Math.sin(df),Math.cos(df));
    D.hd+=df*Math.min(1,dt*3); D.roll+=(-clamp(df*1.4,-0.55,0.55)-D.roll)*Math.min(1,dt*3);
  } else { D.roll+=(0-D.roll)*Math.min(1,dt*3); }
  dragon.rotation.y=D.hd+D.shk+Math.sin(now*0.0015)*0.05; dragon.rotation.z=D.roll;
}
const _fa=new THREE.Vector3(),_fb=new THREE.Vector3(),_fc=new THREE.Vector3();
function dragonFade(dt){
  const D=dragon.userData; if(!D.fm){ D.fm=D.mats.map(m=>({m,o:m.opacity,t:m.transparent,dw:m.depthWrite})); D.op=1; D.opA=1; }
  let target=1;
  if(FLY.on&&dragon.visible&&FLY.blend>0.05){
    const cd=baseDist*cam.zoom,dc=camera.position.distanceTo(dragon.position);
    target=Math.min(target,0.22+0.78*clamp((dc-cd*0.62)/(cd*0.3),0,1)); /* dekat kamera -> memudar */
    _fb.copy(camTarget).sub(camera.position); const L=_fb.length()||1; _fb.divideScalar(L);
    _fc.copy(dragon.position).sub(camera.position); const along=_fc.dot(_fb);
    if(along>0&&along<L){ _fa.copy(_fc).addScaledVector(_fb,-along); target=Math.min(target,0.22+0.78*clamp((_fa.length()-1.6*DRAGON_S/1.3)/(2.2*DRAGON_S/1.3),0,1)); } /* memotong garis pandang -> memudar */
  }
  D.op+=(target-D.op)*Math.min(1,dt*6);
  if(Math.abs(D.op-D.opA)<0.004&&!(D.op>=0.999&&D.opA<0.999)) return;
  D.opA=D.op; const op=D.op;
  D.fm.forEach(e=>{ const tr=op<0.995||e.t; if(e.m.transparent!==tr){ e.m.transparent=tr; e.m.needsUpdate=true; } e.m.opacity=e.o*op; e.m.depthWrite=op>0.9&&e.dw; });
}
function resetDragon(){ dragon.visible=false; dragon.scale.setScalar(DRAGON_S); dragon.userData.dy=0; dragon.userData.shk=0; dragon.userData.open=0; dragon.userData.hd=0; dragon.userData.roll=0; dragon.rotation.z=0; FLY.on=false; FLY.blend=0; FLY.a=0; dragonFireStop(); DFIRE.next=0; DFX.clear(); }
/* Serangan ke Ender Dragon = memanah (naga terbang, jadi jarak jauh): pion berdiri menyamping menghadap naga, membidik ke atas, menarik busur, lalu anak panah melesat ke naga.
   Mengembalikan true bila animasi busur dimainkan; false (pion lama tanpa rig busur) -> pemanggil memakai animasi serang biasa. */
const BOWA_GEO=new THREE.BoxGeometry(0.05,0.05,0.75),BOWA_MAT=new THREE.MeshLambertMaterial({color:0xC9A56A});
async function bowShootDragon(p,gid,onShoot){
  const pw=p.pawn,bc=pw&&pw.userData&&pw.userData.bc; if(!(bc&&bc.act&&bc.bow&&bc.bowReleaseAt)||!dragon.visible) return false;
  const dur=reduce?0.7:1.2,t0=performance.now(),oldYaw=pw.rotation.y,tg=new THREE.Vector3();
  const aimAt=()=>tg.copy(dragon.position); aimAt();
  const dx=tg.x-pw.position.x,dz=tg.z-pw.position.z,hd=Math.hypot(dx,dz)||1,el=Math.atan2(tg.y-(pw.position.y+1.1),hd);
  pw.rotation.y=Math.atan2(dx,dz); bc.setBowAim(Math.max(0,Math.min(1.1,el))); bc.act('bow',dur);
  await sleep(bc.bowReleaseAt(dur)*1000); if(gid!==gameId){ pw.rotation.y=oldYaw; return true; }
  try{ sfx.skeltonSh(); }catch(e){}
  try{ if(onShoot) onShoot(); }catch(e){} /* overlay merah/Critical muncul tepat saat bidak melepas panah */
  const a=new THREE.Mesh(BOWA_GEO,BOWA_MAT),s0=new THREE.Vector3(); bc.bow.getWorldPosition(s0); aimAt(); a.position.copy(s0); a.lookAt(tg); world.add(a);
  const fl=Math.max(0.18,Math.min(0.5,s0.distanceTo(tg)/22)),to=new THREE.Vector3();
  try{ await tween(fl,k=>{ aimAt(); to.copy(s0).lerp(tg,k); to.y+=Math.sin(k*Math.PI)*0.35; a.position.copy(to); a.lookAt(tg); }); }finally{ world.remove(a); }
  await sleep(Math.max(0,dur*1000-(performance.now()-t0))); pw.rotation.y=oldYaw; /* tunggu animasi selesai lalu hadap seperti semula */
  return true;
}
async function hitDragon(p,v){
   if(!canAttackDragon(p)) return; /* Feature 5: pemain yang belum READY (Crystal 1-4) tidak boleh melukai Dragon */
   const D=dragon.userData,dmg=v*DMG,gid=gameId;
   hud('hideCombat');
   let fxDone=false; const fireFx=()=>{ if(fxDone||gid!==gameId) return; fxDone=true; bossHitFx(dmg,false,true); }; /* overlay merah sekali, bersamaan dengan bidak menembak */
   if(!(await bowShootDragon(p,gid,fireFx))){ fireFx(); pawnAct(p.pawn,'attack'); await hopTo(p.pawn,p.pawn.position.clone(),0.38,0.6); } /* panah mendarat -> naga kena */
   if(gid!==gameId) return;
   sfx.dragonHurt(); mpCue({k:'dfx',t:'hurt'});
   sfx.hundred();
   await tween(0.5,k=>{ D.shk=Math.sin(k*40)*0.3*(1-k); D.mats.forEach(m=>m.color.setHex(k<0.6?0xFF5555:0xFFFFFF)); });
   D.shk=0; D.mats.forEach(m=>m.color.setHex(0xFFFFFF));
   p.dhp=Math.max(0,p.dhp-dmg); fireFx(); msBump(p,'dragon_hits'); renderChips();
   if(p.dhp>0){ setMsg('Naga '+p.name+' tersisa '+p.dhp+'/100.'); setTimeout(()=>{ try{ dragonBreathe(); }catch(e){} },700); return; } /* semburan api = visual saja, tanpa damage */
   DRG.defeated=true; dragonMusicStop(); settleDragonDefeat(p); /* Feature 6: naga kalah -> tutup serangan lanjutan + simpan status & hadiah 1x (sinkron, sebelum animasi) */
   sfx.dragonDeath(); mpCue({k:'dfx',t:'death'});
   setMsg('Ender Dragon kalah!'); hud('showResult','Ender Dragon kalah!',p.name+' menang!',{ttl:2600,gid}); spawnConfetti(dragon.position);
   await tween(1.3,k=>{ D.dy=-k*3; dragon.scale.setScalar(DRAGON_S*(1-k*0.85)); });
   dragon.visible=false;
}
async function explode(p){
  const pos=p.pawn.position.clone(); pos.y+=0.5;
  const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xFF9A2A,transparent:true,opacity:0.8,fog:false})); /* kilatan api kecil (dulu kubus oranye besar) */
  m.position.copy(pos); scene.add(m); sfx.bounce(); spawnExplosion(pos);
  await tween(0.32,k=>{ m.scale.setScalar(0.15+k*0.85); m.material.opacity=0.8*(1-k)*(1-k); });
  scene.remove(m); m.geometry.dispose(); m.material.dispose();
}
async function teleport(p,to,fire){
  const fx=fire==='ender'?(v=>spawnExplosion(v,'ender')):fire?spawnExplosion:spawnConfetti; /* 'ender' = ungu-hitam + asap; true (TNT) = api; false (Chest) = konfeti */
  fx(p.pawn.position);
  await tween(0.3,k=>p.pawn.scale.setScalar(1-k));
  p.pawn.position.copy(slotPos(p.idx,to)); fx(p.pawn.position);
  await tween(0.3,k=>p.pawn.scale.setScalar(k)); p.pawn.scale.setScalar(1);
}

/* ---------- Kamera dan input ---------- */
/* Titik pandang dasar = PUSAT papan di permukaan petak (tengah 4 petak 45,46,36,35). Dulu y=2.8 (melayang) membuat titik tengah layar jatuh ke ~petak 75/76/85/86 saat kamera miring. */
const CAM_BASE={x:0,y:0.4,z:1};
const cam={yaw:0.5,pitch:0.55,zoom:1},goal={yaw:0.5,pitch:0.55,zoom:1},camTarget=new THREE.Vector3(0,CAM_BASE.y,CAM_BASE.z);
let baseDist=22,isTopDown=false;
var camRefit=null; /* 4.2.2: diisi setelah state kamera ada; dipanggil onResize agar framing LOCK responsif */
const pan={x:0,z:0,y:0},panGoal={x:0,z:0,y:0},PAN_MAX=16; /* y = geser titik pandang ke atas (mis. menyorot puncak Tower); 0 = normal */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function onResize(){
  const w=window.innerWidth,h=window.innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  const t=Math.tan(camera.fov*Math.PI/360);
  baseDist=Math.max(11,5.9/(t*camera.aspect),6.6/t)*0.76;
  camera.updateProjectionMatrix();
  if(camRefit) camRefit();
}
window.addEventListener('resize',onResize); window.addEventListener('orientationchange',onResize); onResize();
/* Stage 4.2.1 (Camera Part 1): mode ANGLE / kamera kustom. Memakai ulang cam/goal/pan/focus + resetCam; TIDAK ada engine kamera kedua.
   ANGLE ON = preset + follow + reset aktif. ANGLE OFF = perilaku kamera lama tidak berubah (mode LOCK dikerjakan di Part 2). */
/* CAM_LOG (sementara, untuk uji kamera): panel kecil di pojok kiri bawah berisi nilai kamera, ketuk panel untuk menyalin ke clipboard. Hapus dengan set CAM_LOG=false atau buang blok ini. */
const CAM_LOG=false; let camLogEl=null,camLogT=0,camLogTxt='';
function camLogUpdate(now,dist){
  if(!CAM_LOG||now-camLogT<200) return; camLogT=now;
  const f=v=>(Math.round(v*1000)/1000);
  camLogTxt=['CAMLOG','preset='+camCfg.preset+' angle='+camCfg.angle+' follow='+camCfg.follow+' top='+isTopDown+' pov='+POV.on,
    'yaw='+f(cam.yaw)+' pitch='+f(cam.pitch)+' ('+f(cam.pitch*180/Math.PI)+'deg) zoom='+f(cam.zoom),
    'goal yaw='+f(goal.yaw)+' pitch='+f(goal.pitch)+' zoom='+f(goal.zoom),
    'baseDist='+f(baseDist)+' dist='+f(dist)+' near='+f(camera.near)+' fov='+f(camera.fov)+' aspect='+f(camera.aspect),
    'camPos='+f(camera.position.x)+','+f(camera.position.y)+','+f(camera.position.z),
    'target='+f(camTarget.x)+','+f(camTarget.y)+','+f(camTarget.z),
    'pan='+f(pan.x)+','+f(pan.y)+','+f(pan.z)+' panGoal='+f(panGoal.x)+','+f(panGoal.y)+','+f(panGoal.z),
    'screen='+window.innerWidth+'x'+window.innerHeight+' dpr='+f(window.devicePixelRatio||1)].join('\n');
  if(!camLogEl){
    camLogEl=document.createElement('pre'); camLogEl.id='camLog';
    camLogEl.style.cssText='position:fixed;left:6px;bottom:6px;z-index:99999;margin:0;padding:6px 8px;max-width:92vw;font:10px/1.35 monospace;color:#0f0;background:rgba(0,0,0,.72);border-radius:6px;white-space:pre-wrap;pointer-events:auto';
    camLogEl.addEventListener('click',()=>{ try{ navigator.clipboard.writeText(camLogTxt); camLogEl.style.outline='1px solid #0f0'; setTimeout(()=>{camLogEl.style.outline='';},400); }catch(e){} });
    document.body.appendChild(camLogEl);
  }
  camLogEl.textContent=camLogTxt+'\n(ketuk untuk salin)';
}
const CAM_PITCH=0.62+14*Math.PI/180; /* sudut default 0.62 rad (35.5 derajat) dinaikkan 14 derajat (49.5 derajat): kamera lebih tinggi, pandangan lebih ke bawah */
const CAM_PITCH_HIGH=0.73; /* Default (Free) & Front = 41.8 derajat, nilai final dari log kamera pemilik (layar 1920x945); POV tetap memakai CAM_PITCH */
const CAM_ZOOM_HIGH=1.105; /* nilai final dari log kamera pemilik; papan diikuti kamera (Follow) sehingga tidak perlu muat utuh */
const CAM_ZOOM=1.1; /* sedikit lebih jauh agar papan tetap muat di layar (sudut lebih tinggi = papan terproyeksi lebih tinggi) */
const CAM_PRESETS={
  free:{yaw:0.006,pitch:CAM_PITCH_HIGH,zoom:CAM_ZOOM_HIGH,px:-0.01,pz:0.15},     /* sudut default (yaw 0.006, pitch 0.73, zoom 1.105, pan x -0.01 z 0.15); default awal = ANGLE aktif, FOLLOW mati (hold) */
  front:{yaw:0.006,pitch:CAM_PITCH_HIGH,zoom:CAM_ZOOM_HIGH,px:-0.01,pz:0.15},
  top:{yaw:0,pitch:Math.PI/2-0.05,zoom:1.0,top:true} /* Top Angle = aturan POV Atas lama (87 derajat, titik pandang di tengah papan), sedikit lebih jauh (zoom 0.88 -> 1.0) */
};
CAM_PRESETS.pov={yaw:0,pitch:CAM_PITCH,zoom:CAM_ZOOM}; /* POV Bidak: kamera orang pertama dari mata bidak (lihat blok POV di bawah) */
const CAM_ORDER=['free','front','top','pov'],CAM_NAMES={free:'Free',front:'Front',top:'Top',pov:'POV'}; /* hanya 4 sudut; preset lama (back/left/right/iso) dihapus, pilihan tersimpan lama jatuh ke Free */
const camCfg={angle:true,preset:'free',follow:false},camHold={x:CAM_BASE.x,y:CAM_BASE.y,z:CAM_BASE.z};
let hudMenuOpen=false;
/* Stage 4.2.2 (Camera Part 2): ANGLE OFF = LOCK (top-down 90 derajat, papan utuh di tengah, input kamera mati). Memakai ulang cam/goal/pan/resetCam; tanpa engine kedua. */
const camLocked=()=>!camCfg.angle;
const camFollowing=()=>camCfg.angle&&camCfg.follow;
/* geser/gulir/cubit/putar kamera di sudut Free; POV: geser = tengok sekeliling; Front dan Top = sudut tetap (tanpa input kamera). */
const camInputOff=()=>camLocked()||(camCfg.preset!=='free'&&camCfg.preset!=='pov'); /* POV: geser = tengok sekeliling, cubit/gulir = zoom (FOV) */
/* kotak yang harus terlihat utuh: papan 10x10 (x,z -5..5) + area Start (api unggun di PAD x=-7.2,z=4.5, radius sekitar 1.4). Dihitung sekali dari data, bukan angka ajaib per layar */
const DEFAULT_VIEW={minX:-8.7,maxX:5.3,minZ:-5.3,maxZ:6.0}; /* map dengan papan sendiri mengisi def.view */
const LOCK_BOX=Object.assign({y:0.5,margin:1.14},DEFAULT_VIEW);
const LOCK_UP=0.5; /* LOCK: papan digeser naik di layar (titik pandang turun ke +z sebesar ini); ubah angka ini untuk naik/turun lagi */
const lockCenter={x:(LOCK_BOX.minX+LOCK_BOX.maxX)/2,z:(LOCK_BOX.minZ+LOCK_BOX.maxZ)/2+LOCK_UP};
function applyView(v){ LOCK_BOX.minX=v.minX; LOCK_BOX.maxX=v.maxX; LOCK_BOX.minZ=v.minZ; LOCK_BOX.maxZ=v.maxZ; lockCenter.x=(v.minX+v.maxX)/2; lockCenter.z=(v.minZ+v.maxZ)/2+LOCK_UP; }
function lockZoom(){
  /* framing responsif: jarak kamera agar kotak (lebar x tinggi) + margin muat di viewport apa pun (portrait/landscape/tablet/desktop) */
  const t=Math.tan(camera.fov*Math.PI/360),a=camera.aspect||1;
  const hw=(LOCK_BOX.maxX-LOCK_BOX.minX)/2*LOCK_BOX.margin,hh=(LOCK_BOX.maxZ-LOCK_BOX.minZ)/2*LOCK_BOX.margin;
  return Math.max(hw/(t*a),hh/t)/baseDist;
}
const lockPreset=()=>({yaw:0,pitch:Math.PI/2,zoom:lockZoom()});
let camSnap=null; /* konfigurasi ANGLE yang disimpan saat masuk LOCK */
function camSave(){ try{ UT.Prefs.set('cam',{angle:camCfg.angle,preset:camCfg.preset,follow:camCfg.follow,snap:camSnap}); }catch(e){} }
function camLoad(){ try{ const o=UT.Prefs.get('cam',null); if(o&&typeof o==='object'){ camCfg.angle=true; /* LOCK dihapus: pengaturan lama yang tersimpan LOCK diabaikan */ camCfg.preset=CAM_PRESETS[o.preset]?o.preset:'free'; camCfg.follow=o.follow!==false; const q=o.snap,ok=v=>typeof v==='number'&&isFinite(v); if(q&&ok(q.yaw)&&ok(q.pitch)&&ok(q.zoom)&&ok(q.px)&&ok(q.pz)&&q.hold&&ok(q.hold.x)&&ok(q.hold.y)&&ok(q.hold.z)) camSnap={yaw:q.yaw,pitch:clamp(q.pitch,0.22,Math.PI/2),zoom:clamp(q.zoom,0.4,1.5),px:q.px,pz:q.pz,top:q.top===true,hold:{x:q.hold.x,y:q.hold.y,z:q.hold.z}}; } }catch(e){} }
function camHoldHere(){ camHold.x=camTarget.x-pan.x; camHold.y=camTarget.y; camHold.z=camTarget.z-pan.z; } /* bekukan titik pandang saat FOLLOW dimatikan (tanpa loncat) */
function resetCam(P){
  if(!(P&&typeof P.yaw==='number')) P=camCfg.angle?CAM_PRESETS[camCfg.preset]:lockPreset();
  if(camInputOff()){ ptrs.clear(); pinch=0; rotating=false; }
  isTopDown=!!P.top;
  const k=Math.round(cam.yaw/(Math.PI*2)); cam.yaw-=k*Math.PI*2;
  goal.yaw=P.yaw+Math.PI*2*Math.round((cam.yaw-P.yaw)/(Math.PI*2)); /* putar lewat jalur terpendek */
  goal.pitch=P.pitch; goal.zoom=P.zoom; panGoal.x=P.px||0; panGoal.z=P.pz||0; panGoal.y=0; /* px/pz opsional di preset (geser titik pandang) */
  camHold.x=CAM_BASE.x; camHold.y=CAM_BASE.y; camHold.z=CAM_BASE.z;
}
const ICON_LOCK='<img class="hi sm" src="assets/Images/icon/tabler/lock.svg" alt="" draggable="false">',ICON_OPEN='<img class="hi sm" src="assets/Images/icon/tabler/lock-open.svg" alt="" draggable="false">',ICON_CAM='<img class="hi sm" src="assets/Images/icon/tabler/camera.svg" alt="" draggable="false">';
function camUI(){
  /* tombol LOCK/ANGLE sudah dihapus: kamera selalu mode ANGLE */
  if(!camCfg.angle) camMenuClose();
  $('camGrp').hidden=!(camCfg.angle||hudMenuOpen); document.body.classList.toggle('cam-angle',camCfg.angle); document.body.classList.toggle('cam-lock',!camCfg.angle); cv.style.cursor=(camCfg.angle&&(camCfg.preset==='free'||camCfg.preset==='pov'))?'grab':'default';
  $('btnPreset').innerHTML=ICON_CAM+CAM_NAMES[camCfg.preset];
  const f=$('btnFollow'); f.setAttribute('aria-pressed',String(camCfg.follow));
}
function setHudMenuOpen(open){
  hudMenuOpen=!!open;
  const tools=document.querySelector('#hud .tools');
  tools.classList.toggle('open',hudMenuOpen);
  $('btnMenu').setAttribute('aria-expanded',String(hudMenuOpen));
  $('camGrp').hidden=!(camCfg.angle||hudMenuOpen);
  $('btnSnd').hidden=!hudMenuOpen;
  $('btnPause').hidden=!hudMenuOpen;
}
function camSetAngle(v){
  v=!!v; if(v===camCfg.angle||AWK.running) return;
  if(!v){
    /* ANGLE ON -> OFF: simpan konfigurasi ANGLE (preset, follow tetap di camCfg), lalu kunci kamera */
    camSnap={yaw:goal.yaw,pitch:goal.pitch,zoom:goal.zoom,px:panGoal.x,pz:panGoal.z,top:isTopDown,hold:{x:camHold.x,y:camHold.y,z:camHold.z}};
    camCfg.angle=false; resetCam();
  }else{
    /* ANGLE OFF -> ON: pulihkan kamera ANGLE terakhir (preset + penyesuaian manual) dan status FOLLOW terakhir */
    camCfg.angle=true;
    if(camSnap){
      const q=camSnap;
      isTopDown=q.top;
      const k=Math.round((cam.yaw-q.yaw)/(Math.PI*2)); goal.yaw=q.yaw+Math.PI*2*k; goal.pitch=q.pitch; goal.zoom=q.zoom;
      panGoal.x=q.px; panGoal.z=q.pz; camHold.x=q.hold.x; camHold.y=q.hold.y; camHold.z=q.hold.z;
    }else resetCam();
  }
  camSave(); camUI();
}
function camSetFollow(v){
  const was=camFollowing(); camCfg.follow=!!v;
  if(was&&!camFollowing()) camHoldHere();
  camSave(); camUI();
}
function camSetPreset(k){
  camCfg.preset=CAM_PRESETS[k]?k:'free';
  if(camCfg.angle) resetCam();
  camSave(); camUI();
}
/* ---------- Popover pilihan sudut kamera (custom) ----------
   Klik tombol preset -> daftar sudut muncul di bawah tombol; pilih = camSetPreset(k). Tutup: pilih item, tap di luar, Esc, resize/rotasi, atau ANGLE dimatikan. Satu implementasi untuk desktop & mobile (tanpa <select> native). */
var camMenuEl=null; /* var: aman dipanggil camUI() sebelum baris ini dieksekusi */
function camMenuClose(){ if(camMenuEl){ camMenuEl.hidden=true; } const b=$('btnPreset'); if(b) b.setAttribute('aria-expanded','false'); }
function camMenuOpen(){
  const b=$('btnPreset'); if(!b||AWK.running) return;
  if(!camMenuEl){
    camMenuEl=document.createElement('div'); camMenuEl.id='camMenu'; camMenuEl.setAttribute('role','menu'); camMenuEl.setAttribute('aria-label','Pilih sudut kamera'); camMenuEl.hidden=true;
    camMenuEl.addEventListener('click',e=>{ const it=e.target.closest&&e.target.closest('button[data-k]'); if(!it) return; ensureAudio(); camSetPreset(it.getAttribute('data-k')); camMenuClose(); b.focus&&b.focus(); });
    camMenuEl.addEventListener('keydown',e=>{
      const its=[...camMenuEl.querySelectorAll('button')],i=its.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){ e.preventDefault(); its[(i+1)%its.length].focus(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); its[(i-1+its.length)%its.length].focus(); }
      else if(e.key==='Escape'||e.key==='Tab'){ if(e.key==='Escape') e.preventDefault(); camMenuClose(); b.focus&&b.focus(); }
    });
    document.body.appendChild(camMenuEl);
    document.addEventListener('pointerdown',e=>{ if(!camMenuEl||camMenuEl.hidden) return; if(camMenuEl.contains(e.target)||(b.contains&&b.contains(e.target))) return; camMenuClose(); },true);
    window.addEventListener('resize',camMenuClose); window.addEventListener('orientationchange',camMenuClose);
  }
  camMenuEl.innerHTML=CAM_ORDER.map(k=>'<button type="button" role="menuitemradio" data-k="'+k+'" aria-checked="'+(k===camCfg.preset)+'"><span>'+CAM_NAMES[k]+'</span><span class="ck" aria-hidden="true">&#10003;</span></button>').join('');
  camMenuEl.hidden=false;
  /* posisi: tepat di bawah tombol, rata kiri tombol, dijaga tetap di dalam layar (mobile) */
  const r=b.getBoundingClientRect(),w=camMenuEl.offsetWidth,vw=document.documentElement.clientWidth;
  let left=Math.max(8,Math.min(r.left,vw-w-8)); camMenuEl.style.left=left+'px'; camMenuEl.style.top=(r.bottom+10)+'px';
  camMenuEl.style.setProperty('--ax',Math.max(16,Math.min(w-16,r.left+r.width/2-left))+'px');
  b.setAttribute('aria-expanded','true'); b.setAttribute('aria-haspopup','menu');
  const act=camMenuEl.querySelector('[aria-checked=true]'); if(act&&act.focus) act.focus({preventScroll:true});
}
function camMenuToggle(){ if(camMenuEl&&!camMenuEl.hidden) camMenuClose(); else camMenuOpen(); }
function camNextPreset(){ camSetPreset(CAM_ORDER[(CAM_ORDER.indexOf(camCfg.preset)+1)%CAM_ORDER.length]); }
/* ---------- POV Bidak (orang pertama) ----------
   Kamera di mata bidak pemain; geser layar = tengok kiri/kanan/atas/bawah, cubit/roda = zoom (FOV).
   POV hanya untuk bidak milik sendiri, tidak pernah pindah ke bidak orang lain/CPU. Online: bidak pemain lokal (kalau belum ada: tidak ada POV).
   Offline: bidak pemain manusia (hotseat: bidak manusia yang terakhir/sedang giliran; giliran CPU tidak memindahkan POV). Bidak sendiri disembunyikan selama POV. */
const POV={yaw:0,pitch:0,gy:0,gp:0,fov:72,pawn:null,own:null,px:0,pz:0,look:0,on:false,baseFov:38,baseNear:0.1};
const povActive=()=>camCfg.angle&&camCfg.preset==='pov';
function povPawn(){
  try{
    if(typeof ONLINE_ROOM!=='undefined'&&ONLINE_ROOM){ const m=MP_ID?players.find(q=>q.networkId===MP_ID):null; return (m&&m.pawn)?m.pawn:null; } /* online: hanya milik sendiri, tanpa fallback ke pemain lain */
    const c=players[cur]; if(c&&c.pawn&&!c.cpu) POV.own=c; /* offline: ikut manusia yang sedang giliran; giliran CPU tidak mengubahnya */
    if(!POV.own||players.indexOf(POV.own)<0||!POV.own.pawn) POV.own=players.find(q=>!q.cpu&&q.pawn)||null;
    return POV.own?POV.own.pawn:null;
  }catch(e){}
  return null;
}
const povWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function povLook(dx,dy){
  POV.gy-=dx*0.005; POV.gp=clamp(POV.gp-dy*0.005,-1.25,1.25); POV.look=performance.now(); /* geser kanan = tengok kanan, geser atas = tengok atas */
}
function povRelease(){
  if(POV.pawn){ POV.pawn.visible=true; POV.pawn=null; }
  if(POV.on){ POV.on=false; camera.fov=POV.baseFov; camera.near=POV.baseNear; camera.updateProjectionMatrix(); }
}
function povUpdate(pw,dt,now){
  if(!POV.on){ POV.on=true; POV.baseFov=camera.fov; POV.baseNear=camera.near; camera.near=0.04; POV.pawn=null; }
  if(pw!==POV.pawn){
    if(POV.pawn) POV.pawn.visible=true;
    POV.pawn=pw; pw.visible=false;
    POV.gy=POV.yaw=Math.atan2(-pw.position.x,-pw.position.z); POV.gp=POV.pitch=-0.12; /* awal: menghadap tengah papan */
    POV.px=pw.position.x; POV.pz=pw.position.z;
  }
  pw.visible=false;
  const mx=pw.position.x-POV.px,mz=pw.position.z-POV.pz; POV.px=pw.position.x; POV.pz=pw.position.z;
  if(mx*mx+mz*mz>1e-5&&now-POV.look>1400){ POV.gy=POV.yaw+povWrap(Math.atan2(mx,mz)-POV.yaw); POV.gp+=(-0.12-POV.gp)*0.05; } /* saat bidak berjalan, pandangan ikut arah jalan */
  const m=1-Math.exp(-dt*12);
  POV.yaw+=povWrap(POV.gy-POV.yaw)*m; POV.pitch+=(POV.gp-POV.pitch)*m;
  const sc=pw.scale&&pw.scale.y||1,eye=0.78*sc,cp=Math.cos(POV.pitch);
  const fx=Math.sin(POV.yaw),fz=Math.cos(POV.yaw);
  camera.up.set(0,1,0);
  camera.position.set(pw.position.x+fx*0.1*sc,pw.position.y+eye,pw.position.z+fz*0.1*sc);
  camera.lookAt(camera.position.x+fx*cp,camera.position.y+Math.sin(POV.pitch),camera.position.z+fz*cp);
  if(Math.abs(camera.fov-POV.fov)>0.05){ camera.fov+=(POV.fov-camera.fov)*m; camera.updateProjectionMatrix(); }
}
const cv=$('c'),ptrs=new Map();let pinch=0,twist=0,rotating=false;
const span=()=>{ const a=Array.from(ptrs.values()); return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); };
const ang=()=>{ const a=Array.from(ptrs.values()); return Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x); };
const mid=()=>{ const a=Array.from(ptrs.values()); return {x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}; };
/* geser papan di bidang tanah, searah layar (bebas ke mana saja) */
function panBy(dx,dy){
  const wpp=2*baseDist*cam.zoom*Math.tan(camera.fov*Math.PI/360)/window.innerHeight;
  const sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);
  panGoal.x+=-(cy*dx)*wpp + (-sy)*dy*wpp;
  panGoal.z+= (sy*dx)*wpp + (-cy)*dy*wpp;
  panGoal.x=clamp(panGoal.x,-PAN_MAX,PAN_MAX); panGoal.z=clamp(panGoal.z,-PAN_MAX,PAN_MAX);
}
/* pinch/gesture zoom halaman browser tidak boleh aktif (LOCK: kamera dan layar tidak boleh bergeser/zoom lewat sentuhan) */
document.addEventListener('touchmove',e=>{ if(e.touches&&e.touches.length>1&&(camLocked()||e.target===cv||!e.target.closest('input,select,textarea'))) e.preventDefault(); },{passive:false});
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault()));
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  if(camInputOff()||AWK.running) return; /* LOCK atau sudut selain Free: tidak ada drag/pan/rotate/pinch */
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  rotating=(e.button===2||e.shiftKey);
  if(ptrs.size===2){ pinch=span(); twist=ang(); }
  cv.style.cursor=rotating?'crosshair':'grabbing';
});
cv.addEventListener('pointermove',e=>{
  if(camInputOff()||AWK.running) return;
  const p=ptrs.get(e.pointerId); if(!p) return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
  if(povActive()){
    if(ptrs.size===1) povLook(dx,dy);
    else if(ptrs.size===2){ const d=span(); if(pinch>0&&d>0) POV.fov=clamp(POV.fov*pinch/d,45,95); pinch=d; }
    return;
  }
  if(ptrs.size===1){
    if(rotating){ goal.yaw-=dx*0.006; goal.pitch=clamp(goal.pitch+dy*0.005,0.22,1.3); }
    else panBy(dx,dy);
  }else if(ptrs.size===2){
    const d=span(); if(pinch>0&&d>0) goal.zoom=clamp(goal.zoom*pinch/d,0.4,1.5); pinch=d;
    let da=ang()-twist; twist=ang();
    if(da>Math.PI) da-=Math.PI*2; if(da<-Math.PI) da+=Math.PI*2;
    goal.yaw-=da;                       /* putar dua jari = putar papan */
    /* dua jari geser ke atas/bawah = ubah sudut miring */
    goal.pitch=clamp(goal.pitch+dy*0.0025,0.22,1.3);
  }
});
const endPtr=e=>{ ptrs.delete(e.pointerId); pinch=0; if(ptrs.size===1){ const q=Array.from(ptrs.values())[0]; } if(!ptrs.size){ rotating=false; cv.style.cursor='grab'; } };
cv.addEventListener('pointerup',endPtr); cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{ e.preventDefault(); if(camInputOff()||AWK.running) return; if(povActive()){ POV.fov=clamp(POV.fov*Math.exp(e.deltaY*0.001),45,95); return; } goal.zoom=clamp(goal.zoom*Math.exp(e.deltaY*0.001),0.4,1.5); },{passive:false});

/* ---------- Permainan ---------- */
const STALE={};
let paused=false;
let players=[],cur=0,busy=false,gameOver=false,gameId=0,mode='cpu',pendingTheme=null,winnerIndex=-1;
const ROOM_CFG=(()=>{try{return UT.RoomFlow&&UT.RoomFlow.lastRoom?UT.RoomFlow.lastRoom():null}catch(e){return null}})();
const ONLINE_ROOM=!!(ROOM_CFG&&ROOM_CFG.mode==='online'&&ROOM_CFG.roomId);
const ONLINE_HOST=!!(ONLINE_ROOM&&ROOM_CFG.host!==false);
/* Resume: Tahap 5b — status 'sedang main' diambil lobby dari server (RoomService.activeRoom); tidak ada key lokal. Sisa key lama dibersihkan. */
try{ localStorage.removeItem('ut-mp-active'); }catch(e){}
let MP_SYNC=null,MP_ID=null,MP_CONNECTING=false,MP_APPLYING=false;
const MP_LEFT=new Set(); /* networkId pemain yang keluar dari game: disembunyikan dari HUD & tidak ikut 'Main lagi' */
if(ONLINE_ROOM) document.body.classList.add('mp-online');

function setMsg(t){ $('msg').textContent=t; }
/* Stage 4.0.9: jembatan presentasi ke UT.GameplayHUD (gameplay/js/hud.js). Aman bila HUD tidak termuat; tidak mengubah state/logic. */
const HUD_MIRROR={showCombat:1,showResult:1,hideCombat:1};
function hud(f,...a){ try{ if(HUD_MIRROR[f]&&MP_SEQ===0&&ONLINE_ROOM&&ONLINE_HOST) mpCue({k:'hud',f:f,a:JSON.parse(JSON.stringify(a))}); }catch(e){} return hud0(f,...a); }
function hud0(f,...a){ try{ const H=window.UT&&UT.GameplayHUD; if(H&&H[f]) H[f](...a); }catch(e){ console.error(e); } }
function mpFbMirrorable(k,a){ const o=a[a.length-1]; if(k==='short') return !(o&&typeof o==='object'&&o.local); return k==='event'&&o&&typeof o==='object'&&o.gid!==undefined&&!o.local; }
function fb(k,...a){ try{ if(ONLINE_ROOM&&ONLINE_HOST&&mpFbMirrorable(k,a)) mpCue({k:'fb',f:k,a:JSON.parse(JSON.stringify(a))}); }catch(e){} return fb0(k,...a); }
function fb0(k,...a){ try{ const F=window.UT&&UT.Gameplay&&UT.Gameplay.Feedback; if(F&&typeof F[k]==='function') return F[k](...a); if(k==='event'){ hud('showEvent',...a); return true; } }catch(e){ console.error(e); } return false; }
if(window.UT&&UT.GameplayHUD) UT.GameplayHUD.init({getGameId:()=>gameId,isPaused:()=>paused});
function setRoll(on){ $('btnRoll').disabled=!on; }
function isHostPlayer(p){ try{ const h=(ROOM_CFG.players||[]).find(x=>x.kind==='host'); return !!(h&&p&&p.networkId===h.id); }catch(e){ return false; } }
function canControlPlayer(p){return !!p&&!p.cpu&&(!ONLINE_ROOM||!!(MP_ID&&p.networkId===MP_ID));}
function submitRoll(value){const opt=Number.isInteger(value)?{value:value}:undefined;if(!ONLINE_ROOM){ensureAudio();doRoll(opt);return;}const p=players[cur];if(!canControlPlayer(p)||busy||paused||gameOver)return;ensureAudio();if(ONLINE_HOST){doRoll(opt);return;}if(MP_SYNC)MP_SYNC.requestRoll({playerId:MP_ID,value:Number.isInteger(value)?value:null}).catch(e=>console.error('[multiplayer] roll request failed',e));}
const FC={
 steve:{p:{h:'#4a2e13',H:'#3a2410',s:'#c58c62',w:'#fff',b:'#3b4fd8',n:'#a56a45',m:'#5a3820'},f:['hhhhhhhh','hHhhhhHh','hssssssh','swbssbws','sssnnsss','ssmmmmss','smmmmmms','ssmmmmss']},
 alex:{p:{o:'#d4701c',O:'#b85a10',s:'#e8b48a',w:'#fff',g:'#2f8f3f',n:'#c98b66',m:'#b0563a'},f:['oooooooo','oOooooOo','osssssso','swgssgws','sssnnsss','sssmmsss','ssssssss','ssssssss']},
 creeper:{p:{g:'#5fb34a',G:'#3f8a35',k:'#0b0b0b'},f:['gGggGggg','gkkggkkg','gkkggkkg','gggkkggg','ggkkkkgg','ggkkkkgg','ggkggkgg','gGggggGg']},
 ender:{p:{b:'#141414',B:'#222',p:'#e879f9',q:'#a21caf'},f:['bbbbbbbb','bBbbbbBb','bbbbbbbb','bbbbbbbb','pqpbbpqp','bbbbbbbb','bBbbbbBb','bbbbbbbb']}};
FC.zombie={p:{h:'#2f5f2a',s:'#5e9e4a',S:'#4c8a3b',w:'#fff',b:'#2a2a8a',m:'#1d3d18'},f:['hhhhhhhh','hsssssSh','ssssssss','swbssbws','sssSsSss','ssmmmmss','smmmmmms','ssmsmsss']};
FC.skeleton={p:{k:'#e8e8e8',K:'#c4c4c4',d:'#222',m:'#8a8a8a'},f:['kkkkkkkk','kKkkkkKk','kkkkkkkk','kddkkddk','kddkkddk','kkkddkkk','kmdmdmkk','kkkkkkkk']};
FC.villager={p:{s:'#d9a77a',b:'#4a3a2a',w:'#fff',g:'#2e8b2e',n:'#c08a5f',m:'#8a5b3a'},f:['ssssssss','ssssssss','bbbbbbbb','swgssgws','sssnnsss','sssnnsss','sssmmsss','ssssssss']};
const FURL={},FCV={};
/* Frame avatar (data/frame/*.webp): wajah pemain digabung dengan frame jadi SATU gambar, sehingga baris pemain, kartu READY,
   skor, dan panel giliran otomatis menampilkannya. Frame yang dipakai pemain lokal (pemain 1, bukan CPU) = equipped.frame; lainnya = frame default. */
const FRM={},FFURL={};
(function(){ try{ window.ItemCatalog.items.filter(i=>i.kind==='frame').forEach(i=>{ const im=new Image(); im.onload=()=>{ try{ if(typeof renderChips==='function'&&typeof players!=='undefined'&&players&&players.length) renderChips(); }catch(e){} }; im.src=i.image; FRM[i.id]=im; }); }catch(e){} })();
function frameWait(){ return Promise.all(Object.keys(FRM).map(k=>{ const im=FRM[k]; return im.complete?0:new Promise(r=>{ im.addEventListener('load',r); im.addEventListener('error',r); }); })); }
function myProfileName(){ try{ return window.PlayerData.profile().name||''; }catch(e){ return ''; } } /* nama pemain lokal = profil PlayerData (sama dgn Lobby/Profil/Room) */
function frameOf(p){ if(ONLINE_ROOM){ /* online: frame = profil publik pemain itu (server: set_game_public_profile); diri sendiri = yang sedang dipakai; tak ada / tak dikenal = default */
    try{ let f=null;
      if(p&&MP_ID&&p.networkId===MP_ID) f=window.PlayerData.equippedId('frame');
      else { const x=((ROOM_CFG&&ROOM_CFG.players)||[]).find(q=>q.id===(p&&p.networkId)); f=x&&x.pub&&x.pub.frameId; }
      if(f&&FRM[f]) return f; }catch(e){}
    return 'frame.default'; }
  try{ if(p&&!p.cpu&&p.idx===0){ const f=window.PlayerData.equippedId('frame'); if(f&&FRM[f]) return f; } }catch(e){} return 'frame.default'; }
function newFaceSrc(p){ const u=p&&p.pawn&&p.pawn.userData; if(!u||u.bcSeed==null||!UT.CharacterFace) return ''; const sd=u.bcSeed; if(sd&&typeof sd==='object') return UT.CharacterFace.urlData?UT.CharacterFace.urlData(sd):''; return sd<0?UT.CharacterFace.url():(UT.CharacterFace.urlPreset?UT.CharacterFace.urlPreset(sd):''); }
function newFaceImg(p){
  try{
    const src=newFaceSrc(p); if(!src) return null;
    let e=NIMG[src];
    if(!e){ e=NIMG[src]={img:null,id:++NFN}; const im=new Image(); im.onload=()=>{ e.img=im; refreshFaces(); }; im.src=src; }
    return e.img?{img:e.img,id:e.id}:null;
  }catch(e){ return null; }
}
function framedFaceNew(p){
  const nf=newFaceImg(p); if(!nf) return ''; const ni=nf.img;
  const fid=frameOf(p), fi=FRM[fid], ready=!!(fi&&fi.complete&&fi.naturalWidth), ck='new|'+nf.id+'|'+(ready?fid:'-');
  if(FFURL[ck]) return FFURL[ck];
  try{
    const S=192,cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d');
    x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.drawImage(ni,S*.16,S*.16,S*.68,S*.68);
    if(ready) x.drawImage(fi,0,0,S,S);
    return FFURL[ck]=cv.toDataURL();
  }catch(e){ return ''; }
}
function framedFace(p){
  { const nf=framedFaceNew(p); if(nf) return nf; } /* pion karakter baru (pemain 1 / preset CPU & pemain lokal) */
  const base=faceURL(p.key), fid=frameOf(p), fi=FRM[fid], cv0=FCV[p.key];
  if(!cv0||!fi||!fi.complete||!fi.naturalWidth) return base;
  const ck=p.key+'|'+fid; if(FFURL[ck]) return FFURL[ck];
  try{
    const S=192,cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d');
    x.imageSmoothingEnabled=false; x.drawImage(cv0,S*.16,S*.16,S*.68,S*.68);
    x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.drawImage(fi,0,0,S,S);
    return FFURL[ck]=cv.toDataURL();
  }catch(e){ return base; }
}
function faceURL(k){
  if(FURL[k]) return FURL[k];
  if(PNG_DEFS.some(d=>d.key===k)){ /* wajah dari texture PNG (kepala + hat); belum siap -> wajah Steve tanpa disimpan di cache */
    const im=SKIN_IMG[k]; if(!im) return faceURL('steve');
    const cv=document.createElement('canvas'); cv.width=cv.height=16; const x=cv.getContext('2d'); x.imageSmoothingEnabled=false;
    x.drawImage(im,8,8,8,8,0,0,16,16); x.drawImage(im,40,8,8,8,0,0,16,16); FCV[k]=cv; return FURL[k]=cv.toDataURL();
  }
  const c=FC[k],cv=document.createElement('canvas'); cv.width=cv.height=16; const x=cv.getContext('2d');
  c.f.forEach((r,j)=>[...r].forEach((l,i)=>{ x.fillStyle=c.p[l]; x.fillRect(i*2,j*2,2,2); }));
  for(let i=0;i<16;i++)for(let j=0;j<16;j++){ x.fillStyle='rgba(0,0,0,'+(Math.random()*0.14).toFixed(2)+')'; x.fillRect(i,j,1,1); }
  x.fillStyle='rgba(255,255,255,.22)'; x.fillRect(0,0,16,1); x.fillRect(0,0,1,16);
  FCV[k]=cv; return FURL[k]=cv.toDataURL();
}
const PUN=UT.Gameplay.Config.PUN;
const PUR=UT.Gameplay.Config.PUR||{}; /* aturan Power (data) — dipakai usePU/cpuPUValid/HUD */
/* Loadout Power: hanya Power yang dipilih di Room (sessionStorage 'ut-room' -> cfg.powers) yang dibawa ke gameplay (tombol HUD + stok awal).
   Tanpa konfigurasi Room (null) = perilaku lama (semua Power). ID & efek Power tidak berubah. */
/* Takedown sementara: Power dengan off:true di item-catalog.js tidak muncul, tidak dipilih, tidak dipakai (CPU & pemain). Stok/ID/aturan tetap utuh. */
const puOn=k=>{ try{ const it=window.ItemCatalog&&ItemCatalog.byId(k); return !(it&&it.off); }catch(e){ return true; } };
/* Power per map (item-catalog.js maps:[...]): tidak cocok dengan map aktif (themeKey) = tidak masuk HUD/stok awal/CPU, pemakaian ditolak sebelum konsumsi. themeKey dibaca saat dipakai (bukan saat load). */
const puMapOk=k=>{ try{ return ItemCatalog.powerOnMap(k,themeKey); }catch(e){ return true; } };
const puAvail=k=>puOn(k)&&puMapOk(k);
const PU_SEL=(()=>{ try{ const r=JSON.parse(sessionStorage.getItem('ut-room')||'null'); if(r&&Array.isArray(r.powers)) return r.powers.filter((k,i,a)=>PUN[k]&&puOn(k)&&a.indexOf(k)===i); }catch(e){} return null; })();
/* ---- Stok Power = SERVER (Inventory akun) ----
   Room hanya memilih jumlah yang DIBAWA (PU_CARRY / roomPowers.carry); stok TIDAK berkurang di loadout. Stok dikurangi SERVER
   (UT.WalletService.usePower -> use_powerup) tepat saat Power benar-benar dipakai; unit yang tidak terpakai tetap di Inventory.
   Yang membayar hanya pemilik akun di perangkat ini: offline = pemain 1 manusia (bukan CPU); online = pemain ber-networkId == MP_ID.
   CPU / pemain lain di perangkat yang sama tidak mengurangi stok akun ini. Server tak terjangkau = power TIDAK dipakai.
   Mode lokal / tanpa akun server: tanpa cek stok. Batas jujur: dadu & aksi masih diputuskan klien/host (Tahap 2: validasi server),
   jadi klien yang dimodifikasi bisa melewati pembayaran; stok yang sah tetap tidak bisa dipakai melebihi isi Inventory-nya. */
const PU_CARRY_MAX=(window.ItemCatalog&&ItemCatalog.POWER_CARRY_MAX)||3;
const wsPower=()=>{ try{ const W=window.UT&&UT.WalletService&&UT.WalletService.get(); return (W&&W.enabled&&W.enabled())?W:null; }catch(e){ return null; } };
const stockOfPower=k=>{ try{ return Math.max(0,Number(window.PlayerData&&PlayerData.qty(k))||0); }catch(e){ return 0; } };
const cleanCarry=(m,k)=>{ const n=Math.floor(Number(m&&m[k])); return Math.max(1,Math.min(PU_CARRY_MAX,n>=1?n:1)); };
const carriedFor=(k,m)=>{ const n=cleanCarry(m,k); return wsPower()?Math.min(n,stockOfPower(k)):n; }; /* dibawa <= stok milik akun ini */
const PU_CARRY=(()=>{ try{ const r=JSON.parse(sessionStorage.getItem('ut-room')||'null'); return (r&&r.carry&&typeof r.carry==='object')?r.carry:{}; }catch(e){ return {}; } })();
const powerPaidHere=p=>!!p&&!p.cpu&&(ONLINE_ROOM?!!(MP_ID&&p.networkId===MP_ID):p.idx===0);
const PU_NONCE=Math.random().toString(36).slice(2,8); let PU_SEQ=0; const PU_PAID={}; let PU_START=null;
const PU_DENY={'stok-habis':'Stok power habis. Beli lagi di halaman Power-up.','jaringan':'Tidak dapat terhubung ke server, power tidak dipakai.','belum-login':'Sesi berakhir, login ulang untuk memakai power.'};
async function spendPower(k){
  const W=wsPower(); if(!W) return {ok:true,local:true};
  const base=ONLINE_ROOM?String((ROOM_CFG&&ROOM_CFG.roomId)||'room')+'-'+gameId:MATCH_TOKEN;
  try{ const r=await W.usePower(k,'pu:'+base+':'+k+':'+PU_NONCE+(++PU_SEQ)); return (r&&r.ok)?r:{ok:false,reason:(r&&r.reason)||'jaringan'}; }
  catch(e){ return {ok:false,reason:'jaringan'}; }
}
function powerDenied(r){ const m=PU_DENY[r&&r.reason]||'Power tidak dapat dipakai.'; try{ fb('event','info',m); }catch(e){} setMsg(m); }
/* tamu online: host yang memutuskan pemakaian, jadi stok dibayar SETELAH snapshot host menunjukkan unit berkurang (selisih dari loadout awal; PU_PAID = ledger anti-dobel) */
function puSettle(v){
  if(!v||!v.loadout||!v.pu) return; if(!PU_START){ PU_START=Object.assign({},v.pu); return; }
  Object.keys(PUN).forEach(k=>{ const used=Math.max(0,(PU_START[k]||0)-(v.pu[k]||0)); while((PU_PAID[k]||0)<used){ PU_PAID[k]=(PU_PAID[k]||0)+1; spendPower(k).then(r=>{ if(!r.ok) powerDenied(r); }); } });
}
/* online: tiap pemain membawa Power pilihannya sendiri (UT.Prefs 'roomPowers', sama dengan room.html); dikirim ke host lewat broadcast 'loadout' */
const MY_CARRY=(()=>{ try{ const d=UT.Prefs.get('roomPowers',{}); return (d.carry&&typeof d.carry==='object')?d.carry:{}; }catch(e){ return {}; } })();
const MY_SEL=(()=>{ try{ const d=UT.Prefs.get('roomPowers',{}); return (d.equipped||[]).filter((k,i,a)=>PUN[k]&&puOn(k)&&a.indexOf(k)===i).slice(0,5).filter(k=>!wsPower()||stockOfPower(k)>0); }catch(e){ return []; } })();
const MY_FIT=(()=>{ const o={}; MY_SEL.forEach(k=>{ o[k]=carriedFor(k,MY_CARRY); }); return o; })(); /* jumlah yang dibawa, sudah dibatasi stok akun ini */
const puKeys=()=>(ONLINE_ROOM?MY_SEL:(PU_SEL||Object.keys(PUN))).filter(puAvail);
const puZero=()=>{ const o={}; Object.keys(PUN).forEach(k=>{ o[k]=0; }); return o; }; /* semua Power dari PUN (17), bukan daftar tetap */
function loadoutPU(keys,carry){ const o=puZero(); (keys||[]).filter((k,i,a)=>PUN[k]&&puAvail(k)&&a.indexOf(k)===i).slice(0,5).forEach(k=>{ o[k]=cleanCarry(carry,k); }); return o; } /* carry = jumlah dibawa per jenis (1..PU_CARRY_MAX) */
function seatPU(i,d){ /* pemain 1 (pemilik akun) membawa jumlah pilihannya dan hanya yang DIMILIKI; CPU / pemain lain: seperti semula */
  const o=startPU(); if(ONLINE_ROOM||i!==0||d.cpu||!wsPower()) return o;
  Object.keys(o).forEach(k=>{ if(o[k]>0) o[k]=PU_SEL?carriedFor(k,PU_CARRY):Math.min(1,stockOfPower(k)); });
  return o;
}
function startPU(){ if(ONLINE_ROOM) return loadoutPU([]); const o=puZero(); if(PU_SEL){ PU_SEL.filter(puAvail).forEach(k=>{ o[k]=1; }); return o; } const ks=Object.keys(o).filter(puAvail).sort(()=>Math.random()-0.5); o[ks[0]]=1; o[ks[1]]=1; return o; }
/* Chest = event/reward container. Power BUKAN reward Chest (Power = item Shop/Inventory; bobot Power di pool = 0).
   Guard: 1 landing = 1 trigger/opening/reward/closing. Trigger kedua (saat lifecycle berjalan, atau token landing sama) -> ditolak.
   Chest Feature 2: Reward Pool (data: UT.Gameplay.Config.CHEST_POOL). resolveChestReward() -> applyChestReward(), dipanggil 1x di fase OPEN. */
const CHEST_LC={active:false,seq:0,done:new Set(),rewards:0};
function chestToken(p){ return 'L'+gameId+':'+p.idx+':'+p.pos+':'+(++CHEST_LC.seq); }
/* CHEST-REWARD:BEGIN */
const CHEST_CFG=UT.Gameplay.Config;
function chestPoolTotal(){ return (CHEST_CFG.CHEST_POOL||[]).reduce((a,r)=>a+r.w,0); }
/* Weighted random. Total harus 1000 (=100%); bila pool rusak -> 'empty' (aman, tidak pernah reward lain/Power). rnd bisa disuntik utk test. */
function resolveChestReward(rnd){
  const r=UT.Gameplay.Core.pickChestReward(CHEST_CFG.CHEST_POOL||[],rnd); /* undian reward = game-core.js */
  if(r.invalid) console.error('CHEST_POOL total '+chestPoolTotal()+' != 1000');
  return {id:r.id};
}
/* Dadu khusus (Pasti 6 dari Chest; Ganjil/Genap dari Power Ramuan): hanya mengubah NILAI roll berikutnya. Satu roll -> semua flag (lucky/odd/even) direset. Lucky > Odd/Even (flag eksklusif, lihat chestFlag). */
function chestDiceForce(p){
  let v=0;
  if(p.lucky) v=6;
  else if(p.odd) v=[1,3,5][Math.floor(Math.random()*3)];
  else if(p.even) v=[2,4,6][Math.floor(Math.random()*3)];
  p.lucky=p.odd=p.even=false;
  return v;
}
/* Online: mode dadu untuk server (angka diundi server). Mereset flag seperti chestDiceForce. */
function chestDiceMode(p){ const m=p.lucky?'lucky':p.odd?'odd':p.even?'even':'normal'; p.lucky=p.odd=p.even=false; return m; }
function chestFlag(p,k){ p.lucky=p.odd=p.even=false; p[k]=true; } /* flag dadu terbaru (Chest atau Ramuan) menggantikan flag sebelumnya */
/* Terapkan reward -> {text}. Currency/XP hanya untuk pemain manusia (CPU tidak mendapat currency). Surprise hanya memindahkan pion (tanpa memicu event petak tujuan). */
async function applyChestReward(p,rw,gid){
  const MOVES=CHEST_CFG.CHEST_MOVE||[1,2,3];
  switch(rw.id){
    case 'maju': case 'mundur':{
      const d=MOVES[Math.floor(Math.random()*MOVES.length)]*(rw.id==='mundur'?-1:1),to=UT.Gameplay.Core.chestMove(p.pos,d),mv=to-p.pos;
      /* gerak DITUNDA: giveChest menjalankannya setelah card tertutup & peti menutup */
      const from=p.pos;
      return {text:mv===0?'Tidak bergerak':(mv>0?'Maju ':'Mundur ')+Math.abs(mv)+' langkah',
        after:mv===0?null:async()=>{ await walk(p,from,to); if(gid!==gameId) return; p.pos=to; renderChips(); }};
    }
    case 'tangga': case 'ular':{
      const src=rw.id==='tangga'?LADDERS:SNAKES,ahead=UT.Gameplay.Core.chestNearest(p.pos,src);
      if(ahead==null) return {text:rw.id==='tangga'?'Lucky! Tapi tidak ada tangga di depanmu':'Unlucky! Tapi tidak ada ular di depanmu'};
      const to=ahead;
      return {text:rw.id==='tangga'?'Lucky! Meluncur ke Tangga di petak '+to:'Unlucky! Meluncur ke Ular di petak '+to,
        after:async()=>{ sfx.pop(); await teleport(p,to); if(gid!==gameId) return; p.pos=to; renderChips(); }};
    }
    case 'bonus': p.bonus=2; renderChips(); return {text:'Bonus Langkah! Dadu berikutnya +2'};
    case 'lucky': chestFlag(p,'lucky'); return {text:'Pasti 6! Dadu berikutnya 6'};
    case 'addroll': p.extra=true; return {text:'Add Roll! Roll tambahan'};
    default: return {text:'Kosong'}; /* empty: tidak ada perubahan state */
  }
}
/* CHEST-REWARD:END */
async function giveChest(p,tok){
   tok=tok||chestToken(p);
   if(CHEST_LC.active||CHEST_LC.done.has(tok)) return {status:'rejected'};
   CHEST_LC.active=true; CHEST_LC.done.add(tok); const n=p.pos,gid=gameId;
   msBump(p,'chests');
   try{ if(isLocalPlayer(p)) import(new URL('assets/js/multiplayer/progress-service.js', document.baseURI).href).then(()=>UT.Multiplayer.Progress.bumpCounter('chests',1)).catch(()=>{}); }catch(e){}
   try{
     openChest(n); sfx.chest(); /* OPEN: lid membuka + glow + sparkle + SFX open */
     await sleep(reduce?200:550); if(gid!==gameId) return {status:'stale'};
     const rw=resolveChestReward(); CHEST_LC.rewards++; /* reward tepat 1x per lifecycle */
     const res=await applyChestReward(p,rw,gid); if(gid!==gameId) return {status:'stale'};
     setMsg(p.name+' membuka peti: '+res.text+'.');
     if(FBK){ mpCue({k:'ccard',w:p.name,t:res.text}); FBK.showChestRewardCard(p.name,res.text); sfx.rewardpower(); } else fb('event','chest','Chest: '+res.text); /* compact reward card + SFX reward 1x per reward */
     await sleep(reduce?600:1200); if(gid!==gameId) return {status:'stale'}; /* Chest tetap OPEN selama card tampil */
     mpCue({k:'ccard_hide'}); if(FBK) FBK.hideChestRewardCard();
     sfx.chestClose(); closeChest(n); await sleep(reduce?150:350); /* CLOSE */
     if(gid!==gameId) return {status:'stale'};
     if(res.after){ await res.after(); if(gid!==gameId) return {status:'stale'}; } /* urutan: peti buka -> card -> card tutup -> peti tutup -> pion jalan */
     return {status:'accepted',reward:rw.id};
   }finally{ if(FBK) FBK.hideChestRewardCard(); closeChest(n); CHEST_LC.active=false; }
}
try{ fb('setRewardPresenter',showPUCard); }catch(e){ console.error(e); }
/* Presentasi visual feedback = UT.GameplayFeedback (gameplay/js/feedback.js). Routing teks/HUD tetap UT.Gameplay.Feedback (fb(...)); kapan kartu tampil tetap ditentukan di sini. */
const FBK=(window.UT&&UT.GameplayFeedback)||null; /* modul tak termuat -> presentasi visual dilewati, gameplay tetap jalan */
if(FBK) FBK.init({sfx,sleep,reduce});
async function showPUCard(p,k){ if(FBK) return FBK.showPUCard(p,k); }
function showAttackCard(attacker,defender,weapon,desc,o){ mpCue({k:'atk',a:[attacker,defender,weapon,desc],powerHit:!!(o&&o.powerHit)}); if(FBK) FBK.showAttackCard(attacker,defender,weapon,desc,o); }
/* Power Hit: card tengah (#puCard) dipanggil dari titik target BENAR-BENAR kena (tidak diblok Totem). Suara hit dimainkan pemanggil (sfx.playerHurt), jadi card dibisukan agar tidak dobel. */
function powerHitCard(p,T,k,effect){ showAttackCard(p.name,T.name,k,'Kena! '+effect,{silent:true,powerHit:true}); }
/* CPU hanya memilih Power yang valid (aturan sama dengan usePU): punya stok, bukan Pedang/Totem di fase Dragon, TNT wajib punya target. */
/* ---------- Aturan Power (data di UT.Gameplay.Config.PUR; 17 Power) ----------
   Target dihitung HANYA dari pemain yang masih di papan (pos>0 && pos<GOAL). CPU & manusia memakai fungsi yang sama (puTargets/cpuPUValid/usePU). */
function puFoes(p){ return players.filter(q=>q!==p&&q.pos>0&&q.pos<GOAL); }
function puTargets(p,k){
  const R=PUR[k]; if(!R||!R.target) return [];
  const F=puFoes(p),dist=q=>Math.abs(q.pos-p.pos);
  switch(R.target){
    case 'same': return F.filter(q=>q.pos===p.pos).slice(0,1); /* Iron Sword: musuh di petak yang SAMA */
    case 'near': return F.filter(q=>dist(q)<=R.range).sort((a,b)=>dist(a)-dist(b)||b.pos-a.pos).slice(0,1);
    case 'ahead': return F.filter(q=>q.pos>p.pos&&q.pos-p.pos<=R.range).sort((a,b)=>a.pos-b.pos).slice(0,1);
    case 'leader': { const L=F.slice().sort((a,b)=>b.pos-a.pos)[0]; return L&&(R.kind!=='swap'||L.pos>p.pos)?[L]:[]; } /* swap: harus ada pemain DI DEPAN */
    case 'allAhead': return F.filter(q=>q.pos>p.pos);
    case 'all': return F;
  }
  return [];
}
const puBossBlocked=(p,k)=>!!(p&&p.pos===GOAL&&PUR[k]&&PUR[k].boss===false); /* fase Naga/Wither: Power khusus papan ditolak SEBELUM konsumsi */
function puNoTargetMsg(k){ const R=PUR[k]||{},n=PUN[k][1]; return R.target==='same'?n+' butuh musuh di petak yang sama denganmu.':R.kind==='swap'?'Tidak ada pemain di depanmu.':(R.target==='near'||R.target==='ahead')?n+': tidak ada musuh dalam jangkauan.':n+' belum punya target.'; }
/* CPU hanya memilih Power yang valid (aturan sama dengan usePU): punya stok, bukan Power khusus-papan di fase Dragon, target ada. */
function cpuPUValid(p,k){
  const R=PUR[k]; if(!p||!R||!p.pu[k]||!puAvail(k)) return false;
  if(R.kind==='totem') return false; /* Totem diputuskan saat kena ular/mob/serangan (askTotem) */
  if(puBossBlocked(p,k)) return false;
  if(R.kind==='trap') return p.pos<GOAL-1&&TRAPS.filter(t=>t.owner===p.idx).length<TRAP_MAX&&puFoes(p).length>0&&cpuTrapTile(p,k)!=null;
  if(R.kind==='guard') return !p.guard;
  if(R.kind==='dice') return !(p.odd||p.even||p.lucky); /* dadu berikutnya sudah ditentukan -> jangan boros */
  if(R.kind==='freeze') return puTargets(p,k).some(q=>!q.frozen);
  if(R.kind==='self'){ if(R.bonus) return !(p.bonus>0); return true; }
  return puTargets(p,k).length>0;
}
/* Pertahanan korban serangan Power: Wooden Shield (otomatis, habis 1x) lebih dulu, lalu pilihan Totem. Mengembalikan 'guard' | 'totem' | false. */
async function puDefend(q,gid,what){
  if(q.guard){ q.guard=false; return 'guard'; }
  return (await askTotem(q,gid,what))?'totem':false;
}
/* Ice Crystal: pemain beku melewatkan giliran berikutnya. Dipanggil dari nextTurn (satu titik pergantian giliran). */
function skipFrozen(){
  for(let i=0;i<players.length&&players[cur]&&players[cur].frozen;i++){
    const q=players[cur]; q.frozen=false; puFx('pr:'+q.idx,'pfx-hit');
    setMsg(q.name+' membeku — giliran dilewati.'); try{ fb('event','info',q.name+' membeku — giliran dilewati',{ttl:1800}); }catch(e){}
    cur=(cur+1)%players.length;
  }
}
/* ---------- JEBAKAN di petak (TNT, Fire Charge, Blaze Core) ----------
   Pasang di petak 1..range di depan pemasang (pilih lewat #trapBar; CPU memilih sendiri). Musuh yang MENDARAT tepat di petak itu memicu: ia dan pemain
   dalam `radius` petak (selain pemasang) mundur `back`; Wooden Shield/Totem bisa menahan per korban. Pemasang kebal. Sekali pakai, kelihatan semua pemain.
   State TRAPS ikut snapshot multiplayer (host = sumber kebenaran). Aturan/angka = UT.Gameplay.Config.PUR (kind:'trap'). */
const TRAP_MAX=2; /* jebakan aktif per pemain */
let PICK_GUARD=0,TRAPS=[],TRAP_SEQ=0,TRAP_PICK=null; const TRAPM={},TRAPTEX={};
function trapTex(key){
  if(TRAPTEX[key]) return TRAPTEX[key];
  let url=''; try{ url=ItemCatalog.byId(key).icon; }catch(e){}
  const tx=new THREE.TextureLoader().load(url);
  if(THREE.SRGBColorSpace) tx.colorSpace=THREE.SRGBColorSpace; else if(THREE.sRGBEncoding) tx.encoding=THREE.sRGBEncoding;
  return (TRAPTEX[key]=tx);
}
/* Model jebakan: blok 3D yang DUDUK di petak (seperti chest), bukan sprite melayang. Geometri dibangun sekali per jenis (TRAPPROTO), dipakai ulang lewat clone. */
const TRAPPROTO={},TRAP_SIZE=0.95,TRAP_SCALE=1.8/1.6; /* objek jebakan 1.6x lebih kecil dari ukuran Chest (1.8); cincin efek di petak tetap ukuran penuh */
function buildTrapProto(key){
  const B=makeBatch(),F={edge:false},q=(x,y,z,w,h,d,c)=>addBox(B,x,y,z,w,h,d,c,F);
  if(key==='tnt'){ /* blok TNT: badan merah, 2 pita putih bertuliskan blok hitam, sumbu di atas */
    q(0,0.09,0,0.2,0.18,0.2,0xD8322A);
    [0.045,0.135].forEach(y=>q(0,y,0,0.206,0.02,0.206,0xB02620));
    q(0,0.09,0,0.208,0.06,0.208,0xF2F2EC);
    [-0.05,-0.017,0.017,0.05].forEach((x,i)=>{ q(x,0.09,0.1045,i%2?0.022:0.026,0.034,0.004,0x2A2A2A); q(x,0.09,-0.1045,i%2?0.022:0.026,0.034,0.004,0x2A2A2A); });
    q(0,0.19,0,0.02,0.03,0.02,0x5A3A18); q(0,0.212,0,0.014,0.014,0.014,0xFFB93A);
  } else if(key==='fire_charge'){ /* Fire Charge: bola api bersudut di atas alas hitam */
    q(0,0.015,0,0.19,0.03,0.19,0x2B2420);
    q(0,0.09,0,0.14,0.12,0.14,0xE8541C); q(0,0.095,0,0.17,0.07,0.1,0xF27A1E); q(0,0.095,0,0.1,0.07,0.17,0xF27A1E);
    q(0,0.12,0,0.07,0.1,0.07,0xFFC040); q(0,0.16,0,0.04,0.06,0.04,0xFFE27A);
  } else { /* blaze_core: inti kuning-emas berbingkai batang Blaze di atas alas */
    q(0,0.015,0,0.2,0.03,0.2,0x3A2C14);
    q(0,0.1,0,0.13,0.13,0.13,0xF2B01E); q(0,0.1,0,0.085,0.085,0.145,0xFFD84A); q(0,0.1,0,0.145,0.085,0.085,0xFFD84A);
    q(0,0.1,0,0.05,0.05,0.15,0xFFF3B0);
    [-1,1].forEach(a=>[-1,1].forEach(b=>q(a*0.085,0.1,b*0.085,0.03,0.15,0.03,0xE8761A)));
  }
  return buildBatch(B);
}
const TRAP_AURA={tnt:0xff5a3c,fire_charge:0xff8a1e,blaze_core:0xffc83a}; /* aura = warna power, outline = warna pemain */
const TRAPTX={};
function cvTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); if(THREE.SRGBColorSpace) t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; }
function tntBricks(g,w,h){ g.fillStyle='#c94632'; g.fillRect(0,0,w,h); const bh=h/8,bw=w/4; for(let r=0;r<8;r++) for(let c=-1;c<5;c++){ g.fillStyle=((r+c+8)%3)?'#e2644a':'#d24d36'; g.fillRect(c*bw+(r%2?bw/2:0)+2,r*bh+2,bw-4,bh-4); } }
function tntSideTex(){ return TRAPTX.tS||(TRAPTX.tS=cvTex(256,256,(g,w,h)=>{ tntBricks(g,w,h); g.fillStyle='#f5f0e6'; g.fillRect(0,92,w,76); g.fillStyle='#1b1b1b'; g.fillRect(0,80,w,13); g.fillRect(0,167,w,13); g.font='bold 62px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('TNT',w/2,131); })); }
function tntTopTex(){ return TRAPTX.tT||(TRAPTX.tT=cvTex(256,256,(g,w,h)=>{ tntBricks(g,w,h); g.fillStyle='#1b1b1b'; g.beginPath(); g.arc(w/2,h/2,22,0,7); g.fill(); })); }
function fireTex(){ return TRAPTX.fi||(TRAPTX.fi=cvTex(128,128,(g,w,h)=>{ g.fillStyle='#e8541c'; g.fillRect(0,0,w,h); for(let i=0;i<70;i++){ g.fillStyle=['#f58a24','#ffc040','#c83c12','#ffd870'][i%4]; g.globalAlpha=.55; g.beginPath(); g.arc(Math.random()*w,Math.random()*h,6+Math.random()*14,0,7); g.fill(); } g.globalAlpha=1; })); }
function coreTex(){ return TRAPTX.co||(TRAPTX.co=cvTex(128,128,(g,w,h)=>{ const r=g.createRadialGradient(w/2,h/2,4,w/2,h/2,w*.7); r.addColorStop(0,'#fff0a0'); r.addColorStop(.6,'#f6bd2a'); r.addColorStop(1,'#d98a12'); g.fillStyle=r; g.fillRect(0,0,w,h); g.strokeStyle='rgba(120,60,0,.35)'; g.lineWidth=3; g.strokeRect(6,6,w-12,h-12); })); }
/* Model 3D jebakan (bukan gambar pipih): TNT = kubus bata + pita putih + sumbu; Fire Charge = bola api berlidah api; Blaze Core = inti emas dikelilingi batang Blaze. body = mesh yang diberi outline warna pemain. */
function trapModel(key){
  const g=new THREE.Group(),L=(c,e)=>new THREE.MeshLambertMaterial(Object.assign({color:c},e||{})); let body;
  if(key==='tnt'){
    const S=tntSideTex(),m=[new THREE.MeshLambertMaterial({map:S}),new THREE.MeshLambertMaterial({map:S}),new THREE.MeshLambertMaterial({map:tntTopTex()}),L(0xb83c2a),new THREE.MeshLambertMaterial({map:S}),new THREE.MeshLambertMaterial({map:S})];
    body=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),m); body.position.y=.25; g.add(body);
    const cu=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.5,0),new THREE.Vector3(0,.58,.02),new THREE.Vector3(.07,.66,.05),new THREE.Vector3(.13,.68,.04)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(cu,10,.014,6),L(0x3a2a1a)));
    const sp=new THREE.Mesh(new THREE.SphereGeometry(.034,8,6),new THREE.MeshBasicMaterial({color:0xffb93a,fog:false})); sp.position.set(.13,.68,.04); g.add(sp);
    g.rotation.y=.55;
  }else if(key==='fire_charge'){
    body=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshLambertMaterial({map:fireTex(),emissive:0x5a1c00})); body.position.y=.24; g.add(body);
    const fm=new THREE.MeshLambertMaterial({color:0xffe9a0,emissive:0x8a6a20});
    for(let i=0;i<7;i++){ const a=i*Math.PI*2/7,pv=new THREE.Group(); pv.rotation.y=a; const cg=new THREE.ConeGeometry(.075,.34,6); cg.translate(0,.17,0); const c=new THREE.Mesh(cg,fm); c.position.set(.13,.26,0); c.rotation.z=-1.05; pv.add(c); g.add(pv); }
  }else{
    body=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),new THREE.MeshLambertMaterial({map:coreTex(),emissive:0x7a4a00})); body.position.y=.3; body.rotation.set(.35,.6,.1); g.add(body);
    const rm=new THREE.MeshLambertMaterial({color:0xf08a1c,emissive:0x8a3a00});
    for(let i=0;i<6;i++){ const a=i*Math.PI/3,r=new THREE.Mesh(new THREE.BoxGeometry(.055,.34,.055),rm); r.position.set(Math.cos(a)*.34,.3+(i%2?.06:-.04),Math.sin(a)*.34); g.add(r); }
  }
  return {g:g,body:body};
}
function trapGroup(key,hex,ghost){
  const g=new THREE.Group(),op=ghost?0.55:1;
  /* cincin warna pemain rata di permukaan petak (penanda pemilik) */
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.34,0.46,32),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:0.9*op,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.03; g.add(ring);
  const M=trapModel(key),m=M.g; m.position.y=0.03; g.add(m);
  /* outline warna pemain: salinan badan yang diperbesar, hanya sisi belakang (inverted hull) */
  const ol=new THREE.Mesh(M.body.geometry,new THREE.MeshBasicMaterial({color:hex,side:THREE.BackSide,fog:false,toneMapped:false}));
  ol.position.copy(M.body.position); ol.rotation.copy(M.body.rotation); ol.scale.setScalar(1.09); m.add(ol);
  if(ghost) m.traverse(o=>{ if(o.isMesh&&o.material&&!Array.isArray(o.material)){ o.material=o.material.clone(); o.material.transparent=true; o.material.opacity=0.55; o.material.depthWrite=false; } else if(o.isMesh&&Array.isArray(o.material)){ o.material=o.material.map(q=>{ const c=q.clone(); c.transparent=true; c.opacity=0.55; c.depthWrite=false; return c; }); } o.castShadow=false; });
  else m.traverse(o=>{ if(o.isMesh&&o!==ol) o.castShadow=true; });
  /* aura dari objek: halo berwarna power, berdenyut (opasitas saja, tidak bergerak naik-turun) */
  const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,color:TRAP_AURA[key]||0xffa040,transparent:true,opacity:0.4*op,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  aura.scale.setScalar(1.5); aura.position.y=0.32; g.add(aura);
  g.userData={ring:ring,sp:m,aura:aura,op:op,y0:0,ph:Math.random()*6,born:performance.now()};
  return g;
}
function trapOwner(id){ return players.find(q=>q.idx===id)||null; }
function trapShow(t){
  const old=TRAPM[t.id]; if(old) scene.remove(old);
  const tl=TILES[t.tile]; if(!tl) return;
  const o=trapOwner(t.owner),g=trapGroup(t.key,(o&&o.hex)||0xffffff,false);
  g.position.set(tl.x,tl.h,tl.z); scene.add(g); TRAPM[t.id]=g;
}
function trapAdd(p,key,tile){
  const R=PUR[key]||{}; const t={id:++TRAP_SEQ,tile:tile,owner:p.idx,key:key,back:R.back|0,radius:R.radius|0};
  TRAPS.push(t); trapShow(t); return t;
}
function trapRemove(t){ const i=TRAPS.indexOf(t); if(i>=0) TRAPS.splice(i,1); const g=TRAPM[t.id]; if(g){ scene.remove(g); delete TRAPM[t.id]; } }
function trapsClear(){ TRAPS.slice().forEach(trapRemove); TRAPS=[]; TRAP_SEQ=0; }
function trapTick(now){ /* melayang + cincin berputar + muncul membesar (dipanggil frame()) */
  for(const id in TRAPM){ const g=TRAPM[id],u=g.userData,age=Math.min(1,(performance.now()-u.born)/320);
    u.ring.rotation.z+=0.012; u.aura.material.opacity=u.op*(0.32+0.16*Math.sin(performance.now()/380+u.ph)); g.scale.setScalar(0.4+0.6*age*(2-age)); } /* tidak melayang: model tetap di permukaan petak */
}
function trapsSync(list){ /* guest: samakan dengan snapshot host */
  const key=a=>a.map(t=>t.id+':'+t.tile+':'+t.key).join('|');
  if(key(TRAPS)===key(list)) return;
  trapsClear(); list.forEach(v=>{ const t={id:v.id,tile:v.tile,owner:v.owner,key:v.key,back:v.back|0,radius:v.radius|0}; TRAPS.push(t); TRAP_SEQ=Math.max(TRAP_SEQ,t.id); trapShow(t); });
}
const trapRange=(p,k)=>{ const R=PUR[k]||{}; return {lo:p.pos+1,hi:Math.min(GOAL-1,p.pos+(R.range||6))}; };
const trapTileOk=(p,k,n)=>{ const r=trapRange(p,k); return Number.isInteger(n)&&n>=r.lo&&n<=r.hi&&!TRAPS.some(t=>t.tile===n); };
function cpuTrapTile(p,k){ /* CPU: 2–5 petak di depan, hindari petak yang sudah berjebakan */
  const r=trapRange(p,k),c=[]; for(let n=Math.min(r.hi,r.lo+1);n<=Math.min(r.hi,r.lo+4);n++) if(trapTileOk(p,k,n)) c.push(n);
  return c.length?c[Math.floor(Math.random()*c.length)]:null;
}
/* Pilih petak (manusia): petak yang BOLEH diberi outline hijau (yang tidak boleh = tanpa outline, mis. sudah ada jebakan); tap petak hijau untuk memilih,
   pratinjau jebakan transparan di petak terpilih, kamera mengikuti. Resolve(petak) atau null (batal).
   Online tamu: host diberi tahu (phase 'pick'/'cancel') supaya timer auto roll giliran ini berhenti selama tamu memilih. */
function trapPickNotify(k,phase){ try{ if(MP_SYNC&&MP_ID) MP_SYNC.requestPower({playerId:MP_ID,power:k,phase:phase}).catch(()=>{}); }catch(e){} }
function trapPick(p,k){
  return new Promise(res=>{
    if(TRAP_PICK){ res(null); return; }
    const r=trapRange(p,k),allowed=[]; for(let n=r.lo;n<=r.hi;n++) if(trapTileOk(p,k,n)&&TILES[n]) allowed.push(n);
    if(!allowed.length){ res(null); return; }
    const remote=ONLINE_ROOM&&!ONLINE_HOST; /* tamu: host yang menjalankan; jangan ubah busy lokal */
    if(!remote){ busy=true; setRoll(false); clearTurnTimer(); } else { clearTurnTimer(); trapPickNotify(k,'pick'); }
    let tile=allowed.indexOf(Math.min(r.hi,r.lo+2))>=0?Math.min(r.hi,r.lo+2):allowed[0];
    const ghost=trapGroup(k,p.hex||0xffffff,true); scene.add(ghost); TRAP_PICK=ghost;
    /* outline hijau di setiap petak yang boleh + kotak tak terlihat sebagai sasaran tap */
    const marks=new THREE.Group(),hits=[],lineMat=new THREE.LineBasicMaterial({color:0x3dff7a,transparent:true,opacity:0.95,depthTest:false}),hitMat=new THREE.MeshBasicMaterial({visible:false});
    allowed.forEach(n=>{ const tl=TILES[n];
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.94,0.04,0.94)),lineMat); e.position.set(tl.x,tl.h+0.03,tl.z); e.renderOrder=999; marks.add(e);
      const h=new THREE.Mesh(new THREE.BoxGeometry(1,0.5,1),hitMat); h.position.set(tl.x,tl.h,tl.z); h.userData.tile=n; marks.add(h); hits.push(h); });
    scene.add(marks);
    const bar=$('trapBar'),txt=$('trapTxt'),ok=$('trapOk'),cv=$('c');
    const upd=()=>{ const tl=TILES[tile]; ghost.position.set(tl.x,tl.h,tl.z); txt.textContent=PUN[k][1]+' → petak '+tile+' ('+(tile-p.pos)+' di depan)'; ok.disabled=false; focus=ghost; };
    let down=null;
    const onDown=e=>{ down={x:e.clientX,y:e.clientY}; };
    const onUp=e=>{ if(!down) return; const dx=e.clientX-down.x,dy=e.clientY-down.y; down=null; if(dx*dx+dy*dy>64) return; /* geser kamera = bukan tap */
      const rc=cv.getBoundingClientRect(),m=new THREE.Vector2(((e.clientX-rc.left)/rc.width)*2-1,-((e.clientY-rc.top)/rc.height)*2+1),rcs=new THREE.Raycaster();
      rcs.setFromCamera(m,camera); const hit=rcs.intersectObjects(hits,false)[0];
      if(hit&&hit.object.userData.tile!==tile){ tile=hit.object.userData.tile; sfx.pop&&sfx.pop(); upd(); } };
    cv.addEventListener('pointerdown',onDown); cv.addEventListener('pointerup',onUp);
    const cleanup=()=>{ scene.remove(ghost); scene.remove(marks); lineMat.dispose(); marks.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); TRAP_PICK=null; bar.hidden=true; cv.removeEventListener('pointerdown',onDown); cv.removeEventListener('pointerup',onUp); ok.onclick=$('trapNo').onclick=null; focus=p.pawn; };
    ok.onclick=()=>{ if(!trapTileOk(p,k,tile)) return; cleanup(); if(!remote) busy=false; res(tile); };
    $('trapNo').onclick=()=>{ cleanup(); if(!remote){ busy=false; setRoll(true); startTurnTimer(); } else { trapPickNotify(k,'cancel'); startTurnTimer(); } res(null); };
    bar.hidden=false; upd();
  });
}
/* Dipanggil resolveTileAt: pemain p baru mendarat. true = p terpental mundur (lewati efek petak lama: tangga/ular/mob). */
async function trapCheck(p,gid){
  const t=TRAPS.find(q=>q.tile===p.pos&&q.owner!==p.idx); if(!t) return false;
  const tl=TILES[t.tile],bp=TRAPM[t.id]?TRAPM[t.id].position.clone():(tl?new THREE.Vector3(tl.x,tl.h,tl.z):null); /* gunakan petak jebakan bila model visual belum terpasang */
  trapRemove(t); /* sekali pakai: hapus dulu agar tidak terpicu ganda */
  const owner=trapOwner(t.owner),key=t.key,nm=PUN[key]?PUN[key][1]:'Jebakan';
  const vs=players.filter(q=>q.idx!==t.owner&&q.pos>0&&q.pos<GOAL&&Math.abs(q.pos-t.tile)<=t.radius).sort((a,b)=>(b===p)-(a===p));
  setMsg(nm+(owner?' milik '+owner.name:'')+' meledak di petak '+t.tile+'!'); fb('event','info',nm+' meledak di petak '+t.tile+'!',{gid});
  sfx.power(key,'trigger'); if(bp){ bp.y+=0.4; spawnExplosion(bp); } /* ledakan selalu terlihat di papan, termasuk mode reduce-motion */
  await sleep(reduce?100:320); if(gid!==gameId) throw STALE;
  let moved=false; const parts=[];
  for(const q of vs){
    const by=await puDefend(q,gid,nm+(owner?' '+owner.name:'')); if(gid!==gameId) throw STALE;
    if(by){ pawnAct(q.pawn,'block'); puFx('pr:'+q.idx,'pfx-shield'); powerFxPawn(by==='guard'?'shield_block':'totem_block',q); parts.push(q.name+' menahan'); continue; }
    const from=q.pos,to=Math.max(1,from-t.back);
    sfx.playerHurt(); hitBlastFx(q); pawnAct(q.pawn,'block');
    await teleport(q,to,true); if(gid!==gameId) throw STALE; q.pos=to; if(q===p) moved=true; renderChips();
    parts.push(q.name+(from-to>0?' mundur '+(from-to):' tidak bergerak'));
  }
  const po={gid,icon:PUN[key][0],desc:parts.join(', ')||'tidak ada korban'}; fb('short',key,nm,owner?owner.name:'',po)||hud('showPower',key,nm,owner?owner.name:'',po);
  if(ONLINE_ROOM&&ONLINE_HOST) try{ publishTurnState(); }catch(e){}
  return moved;
}
const PU_PFX={sword:'pfx-sword',diamond_sword:'pfx-sword',netherite_sword:'pfx-sword',trident:'pfx-sword',tnt:'pfx-tnt',fire_charge:'pfx-tnt',blaze_core:'pfx-tnt',feather:'pfx-feather',totem:'pfx-totem',wooden_shield:'pfx-totem',golden_apple:'pfx-totem',grass:'pfx-grass',potion_odd:'pfx-potion_odd',potion_even:'pfx-potion_even'};
async function usePU(k,cpu,tileArg){
  const p=players[cur],R=PUR[k];
  if(!p||!R||busy||gameOver||AWK.running||!p.pu[k]||(p.cpu&&!cpu)) return;
  if(ONLINE_ROOM&&!ONLINE_HOST){if(canControlPlayer(p)&&MP_SYNC){ (async()=>{ let tile; if(R.kind==='trap'){ tile=await trapPick(p,k); if(tile==null) return; } MP_SYNC.requestPower({playerId:MP_ID,power:k,tile:tile}).catch(e=>console.error('[multiplayer] power request failed',e)); })(); } return;}
  const deny=m=>{ if(cpu) return; fb('event','info',m); setMsg(m); }; /* ditolak SEBELUM konsumsi; CPU diam-diam */
  /* Fase Dragon = p.pos===GOAL (kondisi existing di playTurn): Power khusus papan (boss:false) ditolak, stok tidak berkurang. */
  if(puBossBlocked(p,k)){ if(!cpu){ const m=PUN[k][1]+' tidak dapat digunakan saat melawan Ender Dragon.'; fb('short',k,PUN[k][1],p.name,{text:m,icon:PUN[k][0],local:true})||hud('showPower',k,PUN[k][1],p.name,{text:m,icon:PUN[k][0]}); } return; }
  if(R.kind==='totem'){ if(!cpu){ const m='Totem aktif otomatis: kamu akan ditanya pakai atau tidak saat kena ular, mob jahat, atau serangan Power.'; fb('event','info',m); setMsg(m); } return; } /* Totem = keputusan saat kena (askTotem), bukan aktivasi di depan */
  if(!puOn(k)) return deny(PUN[k][1]+' sedang dinonaktifkan sementara.'); /* takedown: ditolak sebelum konsumsi */
  if(!puMapOk(k)) return deny(PUN[k][1]+': '+ItemCatalog.powerMapNote(k)+' — tidak bisa dipakai di map '+ItemCatalog.mapName(themeKey)+'.'); /* Power per map: stok tidak berkurang */
  const gid=gameId,T=puTargets(p,k);
  if(R.kind==='guard'&&p.guard) return deny('Wooden Shield sudah aktif.');
  if(R.kind==='dice'&&(p.odd||p.even||p.lucky)) return deny('Dadu berikutnya sudah ditentukan (Ramuan / Pasti 6). Lempar dulu.');
  if(R.kind==='freeze'&&!T.some(q=>!q.frozen)) return deny(T.length?T[0].name+' sudah membeku.':puNoTargetMsg(k));
  if((R.kind==='strike'||R.kind==='area'||R.kind==='swap'||R.kind==='freeze')&&!T.length) return deny(puNoTargetMsg(k));
  let tile=null;
  if(R.kind==='trap'){
    if(p.pos>=GOAL-1) return deny(PUN[k][1]+': tidak ada petak di depanmu untuk dipasangi.');
    if(TRAPS.filter(t=>t.owner===p.idx).length>=TRAP_MAX) return deny('Maksimal '+TRAP_MAX+' jebakan aktif. Tunggu ada yang terpicu.');
    tile=tileArg!=null?tileArg:(cpu?cpuTrapTile(p,k):await trapPick(p,k)); /* manusia: pilih petak (batal = stok utuh); tamu: petak dari permintaan; CPU: otomatis */
    if(tile==null) return;
    if(gid!==gameId||busy||gameOver||players[cur]!==p) return; /* kondisi berubah selama memilih */
    if(!trapTileOk(p,k,tile)) return deny('Petak '+tile+' tidak valid untuk jebakan.');
  }
  if(!cpu&&powerPaidHere(p)){ /* bayar stok di SERVER dulu; gagal = power tidak dipakai & tanpa efek */
    busy=true; let r; try{ r=await spendPower(k); }catch(e){ r={ok:false,reason:'jaringan'}; }
    if(gid!==gameId||gameOver) return;
    if(!r.ok){ busy=false; powerDenied(r); return; }
  }
  busy=true; setRoll(false); clearTurnTimer(); p.activePower=k; p.pu[k]--; msBump(p,'skills',k); sfx.power(k); setMsg(p.name+' memakai '+PUN[k][1]+': '+PUN[k][2]+'.');
  const offense=R.kind==='strike'||R.kind==='area'||R.kind==='swap'||R.kind==='freeze'||R.kind==='trap';
  if(R.extra) p.extra=true;
  if(R.bonus) p.bonus=(p.bonus||0)+R.bonus;
  if(R.kind==='dice') chestFlag(p,R.flag);
  if(R.kind==='guard') p.guard=true;
  puFx('pb:'+p.idx+':'+k,PU_PFX[k]||'pfx-totem'); if(offense) pawnAct(p.pawn,'attack'); if(R.kind==='guard') pawnAct(p.pawn,'block');
  if(R.kind==='guard'||R.kind==='dice'||(R.kind==='self'&&!R.ladder)) powerFxPawn(k,p); /* serang: efek keluar di target saat KENA (bukan saat diblok) */
  renderChips();
  const old={}; T.forEach(q=>{ old[q.idx]=q.pos; }); const oldP=p.pos; let hit=false; const blocked=[],hits=[]; /* blocked = [{q,by}] korban yang menahan */
  const melee=/sword$/.test(k)&&k!=='trident';
  try{
    if(R.kind==='strike'||R.kind==='area'){
      await sleep(reduce?100:250);
      for(const q of T){
        const by=await puDefend(q,gid,PUN[k][1]+' '+p.name);
        if(by){ blocked.push({q,by}); continue; }
        const from=q.pos,to=Math.max(1,from-R.back); hits.push(q); hit=true;
        powerFxPawn(k,q); if(R.kind==='strike') powerHitCard(p,q,k,q.name+(from-to>0?' mundur '+(from-to)+' petak':' tidak bergerak'));
        hitBlastFx(q); sfx.playerHurt(); pawnAct(q.pawn,'block');
        if(melee) await fly(q,to,0.45,1.1); else await teleport(q,to,true);
        q.pos=to; renderChips();
      }
      if(R.self&&hits.length){ const to=Math.min(GOAL-1,p.pos+R.self); if(to>p.pos){ await teleport(p,to); p.pos=to; renderChips(); } } /* Trident: kamu maju bila kena */
    }
    if(R.kind==='swap'){ const L=T[0],by=await puDefend(L,gid,PUN[k][1]+' '+p.name);
      if(by) blocked.push({q:L,by}); else { const a=p.pos,b=L.pos; hit=true; hits.push(L); powerFxPawn(k,p); powerFxPawn(k,L); powerHitCard(p,L,k,'Bertukar posisi dengan '+L.name+' ('+a+' ↔ '+b+')'); hitBlastFx(L); sfx.playerHurt(); await teleport(p,b); p.pos=b; await teleport(L,a); L.pos=a; renderChips();
        /* Bertukar = mendarat di petak baru: jebakan di petak tujuan ikut terpicu (dulu dilewati, jadi TNT di petak itu tidak meledak) */
        await trapCheck(p,gid); if(gid!==gameId) throw STALE; await trapCheck(L,gid); if(gid!==gameId) throw STALE; } }
    if(R.kind==='freeze'){ const L=T.find(q=>!q.frozen)||T[0],by=await puDefend(L,gid,PUN[k][1]+' '+p.name);
      if(by) blocked.push({q:L,by}); else { L.frozen=true; hit=true; hits.push(L); powerFxPawn(k,L); powerHitCard(p,L,k,L.name+' membeku: giliran berikutnya dilewati'); hitBlastFx(L); sfx.playerHurt(); pawnAct(L.pawn,'block'); } }
    if(R.kind==='trap'){ await sleep(reduce?60:200); trapAdd(p,k,tile); sfx.pop(); if(ONLINE_ROOM&&ONLINE_HOST) try{ publishTurnState(); }catch(e){} }
    if(R.ladder){ /* Dragon Crystal: meluncur ke Tangga terdekat di depan (lalu naik); tanpa tangga: maju fallback petak */
      const ah=UT.Gameplay.Core.chestNearest(p.pos,LADDERS),from=p.pos;
      powerFxPawn(k,p);
      if(ah!=null){ await teleport(p,ah); if(gid!==gameId) return; p.pos=ah; }
      else{ const to=Math.min(GOAL-1,from+(R.fallback||6)); if(to>from){ await walk(p,from,to); if(gid!==gameId) return; p.pos=to; } }
      renderChips(); await resolveTileAt(p,gid); renderChips();
    }
  }catch(e){ if(e===STALE) return; console.error(e); }
  if(gid!==gameId) return;
  blocked.forEach(({q,by})=>{ pawnAct(q.pawn,'block'); puFx('pr:'+q.idx,'pfx-shield'); powerFxPawn(by==='guard'?'shield_block':'totem_block',q); }); if(blocked.length){ sfx.pop(); renderChips(); }
  /* Feedback: Power bertarget yang KENA = card tengah #puCard (powerHitCard, dipanggil di cabang efek). Power self/area/diblok = banner HUD singkat. Urutan: pakai → efek → feedback → lanjut. */
  const mv=q=>{ const d=old[q.idx]-q.pos; return q.name+(d>0?' mundur '+d+' petak':' tidak bergerak'); };
  if(offense&&R.kind!=='trap'){
    const parts=hits.map(q=>R.kind==='swap'?'Bertukar posisi dengan '+q.name:R.kind==='freeze'?q.name+' membeku':mv(q)).concat(blocked.map(b=>b.q.name+' menahan dengan '+(b.by==='guard'?'Wooden Shield':'Totem')));
    setMsg(p.name+' → '+PUN[k][1]+' → '+parts.join(', '));
    if(R.kind==='area'||!hit){ const po={gid,icon:PUN[k][0],desc:parts.join(', ')}; fb('short',k,PUN[k][1],p.name,po)||hud('showPower',k,PUN[k][1],p.name,po); } /* hit tunggal: card tengah sudah tampil */
  }else{
    let desc=PUN[k][2]; if(R.ladder) desc=p.pos>oldP?'Maju dari '+oldP+' ke '+p.pos:desc; if(R.kind==='trap') desc='Jebakan dipasang di petak '+tile+'. Musuh yang mendarat di sana mundur '+R.back+'.';
    const po={gid,icon:PUN[k][0],desc}; fb('short',k,PUN[k][1],p.name,po)||hud('showPower',k,PUN[k][1],p.name,po);
  }
  p.activePower=null; busy=false; if(!p.cpu) setRoll(true); focus=p.pawn; renderChips(); startTurnTimer(); /* setelah Power, hitung ulang 10 dtk */
}
/* Stage 4.1.21 — feedback Power lewat sistem class-toggle existing (renderChips + data-state). renderChips() membangun ulang DOM, jadi feedback disimpan sebagai
   cap waktu pendek lalu dipasang ulang dengan animation-delay negatif (animasi lanjut, tidak restart). Tanpa timer/rAF/listener baru; kedaluwarsa otomatis. */
const PUFX={}, PUFX_MS=650;
function puFx(key,cls){ mpCue({k:'pufx',key:key,cls:cls}); if(reduce) return; PUFX[key]={cls,t:performance.now()}; }
function puFxApply(el,key){ const f=PUFX[key]; if(!f) return; const e=performance.now()-f.t; if(e>=PUFX_MS){ delete PUFX[key]; return; } el.classList.add(f.cls); el.style.setProperty('--fx-d',(-e)+'ms'); }
function turnTag(){ return gameOver?'Selesai':ORD(cur); } /* teks chip panel Giliran: 1st/2nd/... atau Selesai saat game berakhir */
function ORD(i){ return ['1st','2nd','3rd','4th'][i]||(i+1)+'th'; } /* urutan giliran (index players[] = urutan giliran) */
function syncOppTurn(){ const c=players[cur]; document.body.classList.toggle('opp-turn',!!(c&&!canControlPlayer(c)&&!gameOver)); } /* Roll & Auto disembunyikan saat bukan giliran pemain ini (CPU / pemain online lain) */
const GAME_HUD_ASSETS='referensi/newgui/game/assets/komponen/';
const GAME_HUD_POWER_ART={
  feather:['glyph-putih','bulu'],tnt:['ikon-item','bom'],totem:['ikon-item','helm-sayap'],
  potion_odd:['ikon-item','ramuan-hijau'],potion_even:['ikon-item','ramuan-ungu'],
  ender_pearl:['ikon-gem-medali','berlian-ungu'],diamond_sword:['ikon-item','pedang'],
  wooden_shield:['ikon-item','perisai-kayu'],golden_apple:['glyph-putih','apple'],
  ice_crystal:['glyph-putih','kepingan-salju'],trident:['ikon-gem-medali','panah-tombak'],
  dragon_crystal:['ikon-gem-medali','gem-heksagon-ungu'],nether_star:['ikon-gem-medali','petir-emas']
};
function gameHudAsset(group,name){ return GAME_HUD_ASSETS+group+'/'+name+'.webp'; }
function gameHudImage(group,name,className,alt){
  const im=document.createElement('img'); im.src=gameHudAsset(group,name); im.alt=alt||''; im.draggable=false;
  if(className) im.className=className;
  return im;
}
let TURN_BAR={player:null,total:0,remaining:0,active:false};
function updateTurnBar(player,seconds,total){
  if(!player||!total) return;
  const percent=Math.max(0,Math.min(100,seconds*1000/total*100));
  TURN_BAR={player:player,total:total,remaining:seconds,active:true};
  const seat=players.indexOf(player),bar=$('players').querySelector('.pg[data-seat="'+seat+'"] .turn-progress');
  if(!bar) return;
  bar.hidden=false; bar.setAttribute('aria-valuenow',String(Math.round(percent)));
  bar.firstElementChild.style.width=percent+'%';
}
function clearTurnBar(){
  TURN_BAR={player:null,total:0,remaining:0,active:false};
  $('players').querySelectorAll('.turn-progress').forEach(bar=>{ bar.hidden=true; });
}
function renderChips(){
  try{ syncOppTurn(); }catch(e){}
  try{ syncDiceGuide(); }catch(e){ console.error(e); }
  const box=$('players'),sc=$('scores'),pu=$('pus'); box.textContent=''; sc.textContent=''; pu.textContent='';
  const readyScreen=$('readyScreen'),readyVisible=!!(readyScreen&&!readyScreen.hidden);
  const autoOn=(()=>{ try{ return !!autoRoll; }catch(e){ return false; } })(); /* tombol Auto milik pemain lokal -> chip AUTO (try: autoRoll dideklarasi setelah fungsi ini) */
  const localSeat=players.findIndex(p=>ONLINE_ROOM?!!(MP_ID&&p.networkId===MP_ID):(p.idx===0&&!p.cpu));
  players.forEach((p,i)=>{
    const isLocal=i===localSeat,slot=localSeat<0?i:(isLocal?0:(i<localSeat?i+1:i));
    const showTurnChip=i===cur&&!gameOver&&!readyVisible; /* penanda giliran untuk pemain aktif di semua kursi */
    const turnChip=null; /* chip YOUR TURN/GILIRAN dihapus: giliran aktif ditandai glow panel + bar waktu */
    if(turnChip){ turnChip.className='turn-chip'+(isLocal?'':' opp'); turnChip.textContent=isLocal?'YOUR TURN':'GILIRAN'; }
    const group=document.createElement('div'); group.className='pg p'+slot+(ONLINE_ROOM&&p.left?' off':''); group.dataset.seat=String(i);
    const card=document.createElement('div'); card.className='pr pl'+(i===cur&&!gameOver?' on act':'')+(p.shield?' shielded':'')+((ONLINE_ROOM?isHostPlayer(p):(p.idx===0&&!p.cpu))?' host':'')+(ONLINE_ROOM&&MP_ID&&p.networkId===MP_ID?' me':''); puFxApply(card,'pr:'+p.idx); card.style.setProperty('--pc',p.css);
    const avatar=document.createElement('div'); avatar.className='av';
    const im=document.createElement('img'); im.src=framedFace(p); im.alt=p.name;
    const order=document.createElement('span'); order.className='tn'; order.setAttribute('aria-label','Giliran ke-'+(p.turnOrder||i+1));
    order.appendChild(gameHudImage('hud',i%2?'lencana-hex-merah':'lencana-hex-hijau'));
    const orderNumber=document.createElement('b'); orderNumber.textContent=String(p.turnOrder||i+1); order.appendChild(orderNumber);
    avatar.appendChild(im); avatar.appendChild(order);
    const content=document.createElement('div'); content.className='mid';
    const timer=document.createElement('div'); timer.className='turn-progress';
    timer.setAttribute('role','progressbar'); timer.setAttribute('aria-label','Sisa waktu giliran '+p.name);
    timer.setAttribute('aria-valuemin','0'); timer.setAttribute('aria-valuemax','100');
    timer.hidden=!(TURN_BAR.active&&TURN_BAR.player===p);
    const timerFill=document.createElement('u');
    if(!timer.hidden){
      const percent=Math.max(0,Math.min(100,TURN_BAR.remaining*1000/TURN_BAR.total*100));
      timer.setAttribute('aria-valuenow',String(Math.round(percent)));
      timerFill.style.width=percent+'%';
    }
    timer.appendChild(timerFill);
    if(i===cur&&!gameOver) content.appendChild(timer);
    const head=document.createElement('div'); head.className='r1';
    const name=document.createElement('span'); name.className='nm';
    if((ONLINE_ROOM?isHostPlayer(p):(p.idx===0&&!p.cpu))) name.appendChild(gameHudImage('ikon-item','mahkota','cr'));
    name.appendChild(document.createTextNode(p.name)); head.appendChild(name);
    const isAuto=!!(p.cpu||p.auto||(ONLINE_ROOM&&p.left&&!p.cpu)||(!gameOver&&(p.autoRoll||(autoOn&&isLocalPlayer(p)))));
    if(isLocal||isAuto||p.left){
      const badge=p.cpu?'cpu':(isAuto?'auto':'local');
      const tag=document.createElement('span'); tag.className='tag '+badge;
      const tagText=document.createElement('span'); tagText.textContent=p.cpu?'CPU':(isAuto?'AUTO':'AKU'); tag.appendChild(tagText); head.appendChild(tag);
    }
    if(p.activePower&&PUN[p.activePower]){
      const art=GAME_HUD_POWER_ART[p.activePower],using=document.createElement('span');
      using.className='pu-using'; using.title='Memakai '+PUN[p.activePower][1];
      using.setAttribute('aria-label','Memakai '+PUN[p.activePower][1]);
      if(art) using.appendChild(gameHudImage(art[0],art[1]));
      const powerName=document.createElement('span'); powerName.textContent=PUN[p.activePower][1]; using.appendChild(powerName);
      head.appendChild(using);
    }
    content.appendChild(head);
    const row=document.createElement('div'); row.className='r2';
    const position=document.createElement('span'); position.className='ps';
    position.hidden=BOSS==='dragon'&&p.pos===GOAL&&p.dragonReady;
    const goalStatus=p.pos===GOAL&&p.dragonReady?(BOSS==='wither'?'Wither ':'Naga ')+p.dhp:'';
    position.textContent=ONLINE_ROOM&&p.left?'Terputus':(p.pos===0?'Mulai':'Petak '+p.pos+(goalStatus?' - '+goalStatus:''));
    row.appendChild(position);
    const buffs=document.createElement('span'); buffs.className='bf';
    function addBuff(groupName,icon,label,count){
      const item=document.createElement('span'); item.className='bi'; item.title=label; item.setAttribute('aria-label',label);
      item.appendChild(gameHudImage(groupName,icon));
      if(count){ const amount=document.createElement('em'); amount.textContent=count; item.appendChild(amount); }
      buffs.appendChild(item);
    }
    if(p.bonus) addBuff('ikon-item','sepatu-sayap','Bonus langkah +'+p.bonus,'+'+p.bonus);
    if(p.extra) addBuff('glyph-putih','bulu','Giliran tambahan');
    if(p.odd) addBuff('ikon-item','ramuan-hijau','Dadu ganjil berikutnya');
    if(p.even) addBuff('ikon-item','ramuan-ungu','Dadu genap berikutnya');
    if(p.lucky) addBuff('ikon-gem-medali','semanggi','Dadu pasti enam');
    if(p.shield) addBuff('ikon-item','batu-rune','Kebal serangan');
    if(p.guard) addBuff('ikon-item','perisai-kayu','Perisai');
    if(p.frozen) addBuff('glyph-putih','kepingan-salju','Beku');
    row.appendChild(buffs); content.appendChild(row);
    card.appendChild(avatar); card.appendChild(content);
    const extra=document.createElement('div'); extra.className='px';
    if(p.pos===GOAL&&!p.dragonReady){
      const crystals=document.createElement('div'); crystals.className='cx'; crystals.setAttribute('role','img'); crystals.setAttribute('aria-label',(BOSS==='wither'?'Skeleton':'Crystal')+' '+p.crystal+' dari '+CRYSTAL_N);
      const gem=gameHudImage('glyph-putih','kristal-heksagon','cg'); crystals.appendChild(gem);
      const count=document.createElement('b'); count.className='ttl cn'+(p.crystal>=CRYSTAL_N?' ok':''); count.textContent=p.crystal+'/'+CRYSTAL_N; crystals.appendChild(count);
      const skulls=document.createElement('div'); skulls.className='sks';
      for(let n=0;n<CRYSTAL_N;n++){ const skull=document.createElement('span'); skull.className='sk6'+(p.cdone&&p.cdone[n]?' d':''); skull.setAttribute('aria-hidden','true'); const icon=document.createElement('i'); skull.appendChild(icon); skulls.appendChild(skull); }
      crystals.appendChild(skulls);
      extra.appendChild(crystals);
    }
    if(p.pos===GOAL&&p.dragonReady){
      const hp=document.createElement('div'); hp.className='hpb'; hp.setAttribute('role','img'); hp.setAttribute('aria-label',(BOSS==='wither'?'Wither':'Ender Dragon')+' '+p.dhp+' dari '+(p.hpMax||100)+' HP');
      hp.appendChild(gameHudImage('hud','bar-hp-boss'));
      const track=document.createElement('s'),fill=document.createElement('u'); fill.style.width=Math.max(0,Math.min(100,(p.dhp/(p.hpMax||100))*100))+'%'; track.appendChild(fill); hp.appendChild(track); extra.appendChild(hp);
    }
    const topSeat=slot===1||slot===2; /* kursi atas: penanda di atas frame/kepala; kursi bawah: tepat di bawah frame */
    const appendCard=()=>{ if(turnChip&&topSeat) group.appendChild(turnChip); group.appendChild(card); if(turnChip&&!topSeat) group.appendChild(turnChip); };
    if(extra.childNodes.length){
      if(slot===1||slot===2){ appendCard(); group.appendChild(extra); }
      else { group.appendChild(extra); appendCard(); }
    }else appendCard();
    box.appendChild(group);
    const r=document.createElement('div'); r.className='sr'; r.style.color=p.key==='ender'?'#c9a2ff':p.css;
    const im2=document.createElement('img'); im2.src=framedFace(p); im2.alt='';
    const n2=document.createElement('span'); n2.textContent=p.name;
    const sv=document.createElement('b'); sv.style.color='#fff'; sv.textContent=p.score;
    r.appendChild(im2); r.appendChild(n2); r.appendChild(sv); sc.appendChild(r);
  });
  const c=players[cur];
  $('turnName').textContent=c?c.name:''; { const tn_=document.querySelector('#side .tn'),tb=tn_&&tn_.querySelector('h3'); if(tb&&c) tb.textContent=c.name; if(tn_&&c&&c.css) tn_.style.setProperty('--tnc',c.css); } if(c) $('turnName').style.color=c.key==='ender'?'#c9a2ff':'#fff';
  if(c){ const tnAv=$('tnAv'),tnImg=$('tnAvImg'),tnStatus=$('tnSt'); tnImg.src=framedFace(c); tnImg.alt=c.name; tnAv.style.setProperty('--pc',c.css||'#ffd45a'); tnStatus.textContent=c.left?'Terputus':(c.cpu?'AUTO':(ONLINE_ROOM?'Online':'Lokal')); $('tnLv').hidden=true; }
  const pw=(ONLINE_ROOM&&MP_ID)?(players.find(q=>q.networkId===MP_ID)||c):c; /* online: panel Power = milik pemain lokal, aktif hanya saat gilirannya */
  const pwTurn=!ONLINE_ROOM||(pw===c);
  const keys=puKeys(); pu.style.setProperty('--gh-pu-cols',String(Math.max(1,Math.min(9,keys.length)))); keys.forEach(k=>{
    const bt=document.createElement('button'); bt.type='button'; bt.className='pb'; bt.title=PUN[k][1]+': '+PUN[k][2];
    bt.setAttribute('aria-label',PUN[k][1]+': '+PUN[k][2]); UT.Gameplay.Config.setPuIcon(bt,k);
    const art=GAME_HUD_POWER_ART[k],icon=bt.querySelector('.puimg'); if(art&&icon) icon.src=gameHudAsset(art[0],art[1]);
    const lb=document.createElement('em'); lb.textContent=PUN[k][3]||PUN[k][1].split(' ')[0]; bt.appendChild(lb);
    const n=document.createElement('b'); n.textContent=pw?pw.pu[k]:0; bt.appendChild(n);
    bt.disabled=!pw||!pwTurn||pw.cpu||busy||gameOver||!pw.pu[k]||puBossBlocked(pw,k)||(PUR[k]&&PUR[k].kind==='totem'&&pw.pos===GOAL);
    bt.dataset.state=(!pw||!pw.pu[k])?'empty':(bt.disabled?'locked':'ready'); /* HUD: ready/locked/empty utk styling */ if(pw) puFxApply(bt,'pb:'+pw.idx+':'+k);
    bt.insertBefore(gameHudImage('slot-equipment',bt.dataset.state==='locked'?'slot-terkunci':'slot-coklat','gh-pu-frame'),bt.firstChild);
    bt.addEventListener('click',()=>{ ensureAudio(); usePU(k); });
    pu.appendChild(bt);
  });
  { const pnl=pu.closest('.pnl.pu'); if(pnl) pnl.style.display=puKeys().length?'':'none'; } /* tanpa Power terpilih: panel Power disembunyikan */
}
function applyPendingTheme(){
  if(pendingTheme){ const k=pendingTheme; pendingTheme=null; buildWorld(k); }
}
function beginTurn(extra){
  applyPendingTheme();
  const p=players[cur];
  if(FBK) FBK.setCurrentMarker(players,cur);
  players.forEach((q,i)=>pawnOutline(q.pawn,i===cur&&!gameOver,q.hex));
  focus=p.pawn; renderChips(); syncCrystals(); syncSkeletons(); syncBossCam(); syncRollLabel(); try{ syncAutoBtn(); }catch(e){}
  if(extra) hud('showTurn',p,{extra:true}); /* toast "Giliran X" dihapus (sudah ada penanda giliran di panel Pemain); "Giliran tambahan!" tetap karena tidak ada penanda lain */
  if(extra) setMsg(p.name+' dapat giliran tambahan, lempar lagi.'+(p.cpu?'':' Tekan Roll.'));
  else setMsg(p.cpu?p.name+' sedang melempar dadu...':(mode==='cpu'?'Giliranmu. Tekan Roll.':'Giliran '+p.name+'. Tekan Roll.'));
  specialHint(p); setRoll(ONLINE_ROOM?canControlPlayer(p):!p.cpu); startTurnTimer();
  if(ONLINE_ROOM)publishGameSnapshot();
  if(p.cpu){ const gid=gameId; setTimeout(async()=>{ if(gid!==gameId||gameOver) return; const ks=Object.keys(PUN).filter(k=>cpuPUValid(p,k)).sort(()=>Math.random()-0.5); const go=()=>{ if(gid!==gameId||gameOver) return; if(busy||paused){ setTimeout(go,paused?250:500); return; } doRoll(); }; if(paused){ go(); return; } if(ks.length&&Math.random()<0.6) await usePU(ks[0],true); go(); },950); }
}
/* 4.1.15.6: snapshot state giliran (baca-saja) agar modul lain/uji bisa membaca tanpa mengekspos players. Sumber kebenaran tetap players[]+cur. */
function publishTurnState(){
  players.forEach((q,i)=>{ if(!q.turnOrder) q.turnOrder=i+1; }); /* tanpa shuffle (?ready=0): urutan awal */
  try{ const C=UT.Gameplay.Core; C.turn={ turnOrder:players.map(q=>({id:q.idx,name:q.name,turnOrder:q.turnOrder||0,cpu:!!q.cpu})), get currentTurnIndex(){ return cur; }, get currentPlayerId(){ return players[cur]?players[cur].idx:null; } }; }catch(e){}
}
/* AFK giliran manusia: 10 dtk tanpa Roll -> auto roll. 3x berturut-turut tidak roll (atau keluar game) -> pemain jadi AUTO (HUD: label AUTO di bawah foto).
   Online: HOST yang menjalankan timer untuk semua pemain (tamu hanya menampilkan hitung mundur). Roll manual mengembalikan kendali (afkReset). */
const AFK_TURN_MS=10000,AFK_MAX_MISS=3,AFK_AUTO_MS=2000; /* pemain AUTO: roll setelah 2 dtk (masih sempat ambil alih dengan menekan Roll) */
function afkMiss(p){ p.afkMiss=(p.afkMiss|0)+1; if(p.afkMiss>=AFK_MAX_MISS){ p.auto=true; return true; } return false; }
function afkReset(p){ if(p){ p.afkMiss=0; p.auto=false; p.left=false; } }
function clearTurnTimer(){ try{ if(UT.GameplayAFK) UT.GameplayAFK.clear('turn'); }catch(e){} clearTurnBar(); }
function startTurnTimer(){
  clearTurnTimer();
  const A=UT.GameplayAFK,p=players[cur]; if(!A||!p||p.cpu||paused||busy||gameOver||document.getElementById('readyScreen')) return;
  const gid=gameId,who=p;
  const wasAuto=!!who.auto;
  const duration=wasAuto?AFK_AUTO_MS:AFK_TURN_MS;
  const tick=s=>{
    if(gid!==gameId||busy||paused||gameOver||players[cur]!==who) return;
    updateTurnBar(who,s,duration);
    if(s<=5&&s>0) setMsg(who.name+': auto roll dalam '+s+' dtk');
  };
  if(ONLINE_ROOM&&!ONLINE_HOST){ A.start('turn',duration,()=>{},tick); return; } /* tamu: hanya hitung mundur tampilan; host yang me-roll */
  A.start('turn',duration,()=>{
    if(gid!==gameId||gameOver||players[cur]!==who||busy||paused) return; /* sudah main / pindah giliran / jeda -> abaikan */
    if(wasAuto){ fb('event','info',who.name+' AUTO — roll otomatis',{gid}); doRoll({afk:true}); return; }
    const toAuto=afkMiss(who);
    setMsg(toAuto?who.name+' tidak aktif 3x. Mode AUTO aktif.':who.name+' tidak aktif. Auto roll...');
    fb('event','info',who.name+(toAuto?' AFK 3x — mode AUTO':' AFK — auto roll'),{gid});
    if(toAuto){ try{ renderChips(); }catch(e){} }
    doRoll({afk:true});
  },tick);
}
/* Rapikan bidak di petak yang sama (berbagi cincin kecil) setelah ada yang datang/pergi; sendirian = tepat di tengah. */
function settlePawns(){
  try{ players.forEach(q=>{ if(!q.pawn||!(q.pos>0)||q.pos>=GOAL) return; const to=slotPos(q.idx,q.pos),pw=q.pawn,from=pw.position.clone(); if(from.distanceTo(to)<0.03||Math.abs(from.y-to.y)>0.6) return; tween(0.25,k=>pw.position.lerpVectors(from,to,k)); }); }catch(e){}
}
function nextTurn(){ settlePawns(); cur=(cur+1)%players.length; skipFrozen(); busy=false; beginTurn(); }

async function walk(p,from,to){
  if(ONLINE_ROOM&&ONLINE_HOST) mpCue({k:'walk',pid:p.networkId,from:from,to:to});
  const dir=to>from?1:-1;
  p.pawn.userData.bcStyle=Math.abs(to-from)>=5?'run':'walk'; /* karakter baru: lari bila lompat jauh (dadu 5-6 / petak jauh), jalan bila dekat */
  try{
  for(let c=from;c!==to;c+=dir){
    const dst=slotPos(p.idx,c+dir),d=p.pawn.position.distanceTo(dst);
    sfx.hop();
    await hopTo(p.pawn,dst,0.16+0.12*d,0.28+0.06*d);
  }
  } finally { p.pawn.userData.bcStyle='walk'; }
}
async function climb(p,from,to){
  if(ONLINE_ROOM&&ONLINE_HOST) mpCue({k:'climb',pid:p.networkId,from:from,to:to});
  const L=LADINFO[from];
  await hopTo(p.pawn,L.p1.clone(),0.3,0.25);
  const snd=sfx.ladder(); /* suara naik tangga mulai saat pion benar-benar naik & berhenti (fade) saat sampai atas */
  try{ await glide(p.pawn,L.path?L.path.map(v=>v.clone()):[L.p1.clone(),L.p2.clone()],1.7,null,0.07); } finally{ sfx.ladderStop(snd); }
  await hopTo(p.pawn,slotPos(p.idx,to),0.3,0.3);
  pawnCheer(p.pawn,1.4); /* sampai di atas tangga */
}

/* kepala ular: posisi relatif terhadap posisi istirahat */
function poseHead(S,fw,dy,pitch,jawOpen){
  const h=S.head;
  h.position.set(S.rest.x+S.f[0]*fw,S.rest.y+dy,S.rest.z+S.f[1]*fw);
  h.rotation.x=pitch; S.jaw.rotation.x=jawOpen;
  const nx=S.rest.x,ny=S.neckTopY,nz=S.rest.z;
  const ex=h.position.x-nx,ey=h.position.y-ny,ez=h.position.z-nz,dist=Math.hypot(ex,ey,ez);
  S.bridge.forEach((m,i)=>{
    const t=(i+1)/(S.bridge.length+1);
    m.visible=dist>0.32; m.position.set(nx+ex*t,ny+ey*t,nz+ez*t);
  });
}
function resetSnakes(){
  Object.keys(SNAKEINFO).forEach(k=>{ const S=SNAKEINFO[k]; S.busy=false; poseHead(S,0,0,0,0); });
  scene.remove(lump); lump.visible=false;
}
/* caplok: kepala menyambar, rahang menutup, pion ditelan, benjolan turun ke ekor, pion dimuntahkan */
async function bite(p,from,to,gid){
  if(ONLINE_ROOM&&ONLINE_HOST) mpCue({k:'bite',pid:p.networkId,from:from,to:to});
  const S=SNAKEINFO[from],pts=S.path;
  const A=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  S.busy=true;
  const LUNGE=0.3; /* tinggi kepala saat menyambar (kepala kini rendah di atas petak, tanpa tiang) */
  await A(hopTo(p.pawn,S.bitePos.clone(),0.35,0.3));
  pawnAct(p.pawn,'sad',1.8); /* digigit ular */
  p.pawn.rotation.y=Math.atan2(-S.f[0],-S.f[1]);
  focus=p.pawn;
  sfx.hiss();
  await A(tween(0.4,k=>poseHead(S,0,0.18*k,-0.45*k,1.05*k)));
  await A(tween(0.2,k=>poseHead(S,lerp(0,0.42,k),lerp(0.18,LUNGE,k),lerp(-0.45,0.9,k),1.05),k=>k*k));
  S.head.updateMatrixWorld(true);
  const mouth=S.head.localToWorld(new THREE.Vector3(0,-0.12,0.42));
  const p0=p.pawn.position.clone();
  sfx.chomp();
  await A(tween(0.16,k=>{
    poseHead(S,0.42,LUNGE,0.9,lerp(1.05,0.02,k));
    p.pawn.position.lerpVectors(p0,mouth,k);
    p.pawn.scale.setScalar(lerp(1,0.2,k));
  }));
  p.pawn.visible=false;
  await A(tween(0.18,k=>poseHead(S,0.42,LUNGE,0.9+0.12*Math.sin(k*24),0.02)));
  sfx.gulp();
  scene.add(lump); lump.visible=true; lump.material.color.setHex(p.hex); focus=lump;
  const back=tween(0.45,k=>poseHead(S,lerp(0.42,0,k),lerp(LUNGE,0,k),lerp(0.9,0,k),0));
  const total=pts.length,dur=Math.max(1.0,total*0.036);
  let ate=false; /* suara 'makan' dipicu dari progres animasi: saat benjolan mencapai tengah badan ular */
  const trip=tween(dur,k=>{
    if(!ate&&k>=0.5&&gid===gameId){ ate=true; sfx.caplokular(); }
    const f=k*(total-1),i=Math.floor(f),j=Math.min(total-1,i+1),r=f-i,a=pts[i],b=pts[j];
    lump.position.set(lerp(a.x,b.x,r),lerp(a.y,b.y,r),lerp(a.z,b.z,r));
    lump.scale.setScalar(lerp(a.s,b.s,r)*1.75*(1+0.12*Math.sin(k*34)));
  },k=>k*k*(3-2*k));
  await A(Promise.all([back,trip]));
  const end=pts[total-1];
  scene.remove(lump); lump.visible=false;
  sfx.pop();
  p.pawn.visible=true; p.pawn.scale.setScalar(0.2);
  p.pawn.position.set(end.x,end.y,end.z); focus=p.pawn;
  await A(Promise.all([
    hopTo(p.pawn,slotPos(p.idx,to),0.55,0.8),
    tween(0.4,k=>p.pawn.scale.setScalar(lerp(0.2,1,k)))
  ]));
  p.pawn.scale.setScalar(1);
  S.busy=false;
}
/* Stage 4.1.24.D.1: sumber kebenaran hasil KALAH = mode vs Computer dan pemenang adalah Computer (sama dengan 'lost' di finishGame). */
function isPlayerDefeat(p){ return mode==='cpu'&&!!p&&!!p.cpu; }
async function celebrate(p){
  const defeat=isPlayerDefeat(p); /* CPU menang = pemain kalah: tanpa fanfare/firework kemenangan pemain; suara kalah diputar di finishGame */
  if(!defeat) sfx.victory();
  spawnConfetti(p.pawn.position);
  if(!defeat) fireworkCelebrate(p);
  for(let i=0;i<3;i++) await hopTo(p.pawn,p.pawn.position.clone(),0.38,0.5);
}
/* Efek mob di petak p.pos. Dipakai playTurn (setelah dadu) DAN setelah Chest 'Kejutan' memindahkan pemain. */
/* Efek hit 2D di posisi pion: gelombang + garis angin + flash merah + guncangan layar */
function hitBlastFx(p){
  if(MP_SEQ===0) mpCue({k:'hitfx',pid:p&&p.networkId});
  if(reduce) return;
  try{
    let L=document.getElementById('hitFx'); if(!L){ L=document.createElement('div'); L.id='hitFx'; document.body.appendChild(L); }
    const r=$('c').getBoundingClientRect(),v=p.pawn.position.clone(); v.y+=0.6; v.project(camera);
    const x=r.left+(v.x*0.5+0.5)*r.width,y=r.top+(-v.y*0.5+0.5)*r.height;
    const add=(cls,st)=>{ const e=document.createElement('div'); e.className=cls; Object.assign(e.style,st||{}); L.appendChild(e); setTimeout(()=>e.remove(),800); };
    add('hf-cinema');
    add('hf-wave',{left:x+'px',top:y+'px'});
    [-26,-8,10,28].forEach((d,i)=>add('hf-wind',{left:(x-20+i*6)+'px',top:(y+d)+'px',animationDelay:(i*40)+'ms'}));
    add('hf-flash');
    document.body.classList.add('hf-shake'); setTimeout(()=>document.body.classList.remove('hf-shake'),360);
  }catch(e){ console.error(e); }
}
async function resolveMobAt(p,gid){
  const A=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  const k=mobOn(p.pos,themeKey); mobReact(p.pos);
  const ME=UT.Gameplay.Core.mobEffect(k,p.pos,{goal:GOAL,back:MOBBACK}); /* aturan efek mob = game-core.js */
  if(k==='creeper'){
    setMsg('Creeper meledak! '+p.name+' terlempar mundur 2 blok.'); fb('event','mob','Creeper! Meledak, mundur 2 blok',{gid});
    sfx.creeper(); pawnAct(p.pawn,'block',1.1);
    await A(sleep(300)); sfx.playerHurt(); hitBlastFx(p); await A(explode(p));
    const to=ME.to; await A(walk(p,p.pos,to)); p.pos=to;
  }else if(k==='ender'){
    const to=ME.to;
    setMsg('Enderman! '+p.name+' teleport '+(to>p.pos?'maju':'mundur')+' ke '+to+'.'); fb('event','mob','Enderman! Teleport ke '+to,{gid});
    sfx.enderman();
    await A(sleep(300)); await A(teleport(p,to,'ender')); p.pos=to;
  }else if(k==='villager'){
    const to=ME.to; setMsg('Villager membantu! '+p.name+' maju 5 blok ke '+to+'.'); fb('event','mob','Villager membantu! Maju 5 blok',{gid}); sfx.villager(); p.score+=5;
    await A(sleep(500)); await A(walk(p,p.pos,to)); p.pos=to;
}else if(k==='strider'){
    const to=ME.to; setMsg('Strider membantu! '+p.name+' maju 3 blok ke '+to+'.'); fb('event','mob','Strider membantu! Maju 3 blok',{gid}); sfx.villager(); p.score+=3;
    await A(sleep(500)); await A(walk(p,p.pos,to)); p.pos=to;
}else if(k==='skeleton'){
    setMsg('Skeleton menembak! '+p.name+' terpental mundur 1 blok.'); fb('event','mob','Skeleton! Terpental mundur 1 blok',{gid});
    sfx.skeltonSh(); pawnAct(p.pawn,'block',0.9);
    const to=ME.to; await A(sleep(400)); sfx.playerHurt(); hitBlastFx(p); await A(fly(p,to,0.45,0.9)); p.pos=to;
  }else{
    const bk=MOBBACK[k],to=ME.to;
    setMsg(MOBNAME[k]+' menghantam! '+p.name+' terpental mundur '+bk+' blok ke '+to+'.'); fb('event','mob',MOBNAME[k]+'! Mundur '+bk+' blok',{gid});
    showAttackCard(MOBNAME[k],p.name,'hit',MOBNAME[k]+' menghantam '+p.name+' dan mundur '+bk+' blok.');
    sfx.hit(); sfx.playerHurt(); hitBlastFx(p); pawnAct(p.pawn,'block',0.9);
    await A(sleep(450)); await A(fly(p,to,bk>3?0.8:0.45,bk>3?2.4:0.9)); p.pos=to;
  }
}
/* Totem = pilihan strategi: saat kena ULAR / MOB JAHAT, pemain manusia ditanya pakai atau tidak (CPU otomatis pakai bila punya). Shield lama (p.shield) tetap dihormati. */
function totemModal(p,what,gid){
  return new Promise(res=>{
    const ov=document.createElement('div'); ov.className='tm-ov'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
    ov.innerHTML='<div class="tm-box"><div class="tm-ic"></div><h4>Pakai Totem?</h4><p class="tm-d"></p><div class="tm-bt"><button type="button" class="tm-y"></button><button type="button" class="tm-n">Tidak</button></div><small class="tm-t"></small></div>';
    ov.querySelector('.tm-d').textContent=p.name+' kena '+what+'! Totem bisa menahannya (sisa '+p.pu.totem+').';
    ov.querySelector('.tm-y').textContent='Pakai Totem';
    try{ UT.Gameplay.Config.setPuIcon(ov.querySelector('.tm-ic'),'totem'); }catch(e){}
    const tt=ov.querySelector('.tm-t'); let left=12;
    const upd=()=>{ tt.textContent='Otomatis dipakai dalam '+left+' detik'; };
    const done=v=>{ clearInterval(iv); ov.remove(); res(v); };
    const iv=setInterval(()=>{ if(gid!==gameId){ done(false); return; } left--; if(left<=0) done(true); else upd(); },1000);
    ov.querySelector('.tm-y').addEventListener('click',()=>{ ensureAudio(); done(true); });
    ov.querySelector('.tm-n').addEventListener('click',()=>done(false));
    upd(); document.body.appendChild(ov);
    try{ ov.querySelector('.tm-y').focus(); }catch(e){}
  });
}
async function askTotem(p,gid,what){
  if(p.shield){ p.shield=false; return true; }
  if(!p.pu||!(p.pu.totem>0)) return false;
  if(p.cpu){ p.pu.totem--; return true; }
  setMsg(p.name+' kena '+what+'. Pakai Totem?');
  let use;
  if(ONLINE_ROOM&&ONLINE_HOST&&p.networkId&&p.networkId!==MP_ID&&!p.left&&!p.auto){ /* korban = tamu: tanya di layarnya, bukan di layar host */
    try{ fb('event','info',p.name+' kena '+what+' — memilih Totem...',{gid,ttl:2400}); }catch(e){}
    use=await mpAskGuestTotem(p,what,gid);
  } else if(ONLINE_ROOM&&p.networkId&&p.networkId!==MP_ID){ use=true; } /* tamu keluar/AUTO: otomatis pakai */
  else use=await totemModal(p,what,gid);
  if(gid!==gameId) throw STALE;
  if(use&&powerPaidHere(p)){ const r=await spendPower('totem'); if(gid!==gameId) throw STALE; if(!r.ok){ use=false; powerDenied(r); } } /* pemilik Totem di perangkat ini membayar stok saat memutuskan memakai */
  if(use) p.pu.totem--; else { setMsg(p.name+' memilih tidak memakai Totem.'); try{ fb('event','info',p.name+' memilih tidak memakai Totem',{gid,ttl:1800}); }catch(e){} }
  return use;
}
/* Efek petak tujuan: tangga / shield / ular / mob. Dipakai setelah dadu DAN setelah Chest 'Kejutan' memindahkan pion. */
async function resolveTileAt(p,gid){
  const A=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  const posBefore=p.pos;
  if(await trapCheck(p,gid)){ /* jebakan di petak ini: bila p terpental mundur, efek petak lama (tangga/ular/mob) dilewati, TAPI petak tempat ia mendarat (mis. ada mob) tetap diproses */
    if(gid!==gameId) throw STALE;
    if(p.pos!==posBefore&&p.pos>0&&p.pos<GOAL){ renderChips(); await resolveTileAt(p,gid); }
    return;
  }
  if(LADDERS[p.pos]){
    const to=LADDERS[p.pos]; setMsg('Tangga! '+p.name+' naik dari '+p.pos+' ke '+to+'.'); fb('event','ladder','Naik Tangga! +'+(to-p.pos)+' langkah',{gid}); /* suara naik = sfx.ladder() di climb(); tidak ditumpuk dengan ladder-up.mp3 */
    msBump(p,'ladders'); await A(sleep(350)); await A(climb(p,p.pos,to)); p.pos=to; p.score+=10;
  }else if((SNAKES[p.pos]||(mobOn(p.pos,themeKey)&&mobOn(p.pos,themeKey)!=='villager'&&mobOn(p.pos,themeKey)!=='strider'))&&await askTotem(p,gid,SNAKES[p.pos]?'Ular':MOBNAME[mobOn(p.pos,themeKey)])){
    p.shield=false; puFx('pr:'+p.idx,'pfx-hit'); powerFxPawn('totem_block',p); renderChips(); setMsg(PUN.totem[1]+' melindungi '+p.name+'!'); fb('event','shield',PUN.totem[1]+' melindungi '+p.name+'!',{gid}); sfx.pop(); await A(sleep(900));
  }else if(SNAKES[p.pos]){
    const to=SNAKES[p.pos]; msBump(p,'snakes');
    hitBlastFx(p);
    if(!SNAKEINFO[p.pos]){ p.pos=to; setMsg('Ular! '+p.name+' turun ke '+to+'.'); fb('event','snake','Kena Ular! Turun ke '+to,{gid}); await A(sleep(350)); await A(hopTo(p.pawn,slotPos(p.idx,to),0.5,0.8)); }
    else{ setMsg('Dicaplok ular! '+p.name+' turun dari '+p.pos+' ke '+to+'.'); fb('event','snake','Kena Ular! Turun ke '+to,{gid}); sfx.naiktangga(); await A(sleep(350)); await A(bite(p,p.pos,to,gid)); }
    p.pos=to;
  }else if(mobOn(p.pos,themeKey)){
    await A(resolveMobAt(p,gid));
  }
}
async function resolveAfterChestMove(p,gid){ await resolveTileAt(p,gid); renderChips(); }
async function playTurn(p,v,gid,bn){
  const A=async pr=>{ await pr; if(gid!==gameId) throw STALE; };
  focus=p.pawn;
  if(p.pos===GOAL){
    if(BOSS==='wither'){ await A(witherPhase(p,v,gid)); return; } /* map Nether: Skeleton Hitam lalu Wither */
    if(!AWK.done) await A(awakenDragon(p,gid)); /* jaga-jaga: naga tak boleh diserang sebelum Awakening */
    await A(gatherArena(gid));
    if(!p.dragonReady){ /* Feature 3: belum READY -> lawan End Crystal, bukan Dragon */
      await A(crystalRoll(p,v,gid));
      if(v===6||p.extra){ p.extra=false; busy=false; beginTurn(true); } else nextTurn();
      return;
    }
    if(!canAttackDragon(p)){ nextTurn(); return; } /* guard Feature 5 */
    sfx.dragonIdle();
    await A(hitDragon(p,v));
    if(p.dhp<=0){ await A(celebrate(p)); await A(dragonDefeatReward(p,gid)); finishGame(p); return; } /* Feature 6: efek menang -> hadiah -> layar menang */
    if(v===6||p.extra){ p.extra=false; busy=false; beginTurn(true); } else nextTurn();
    return;
  }
  const PM=UT.Gameplay.Core.planMove(p.pos,v+(bn||0),GOAL); /* aturan gerak/pantulan = game-core.js */
  await A(walk(p,p.pos,PM.to)); if(!PM.over) p.pos=PM.to; /* kelebihan: hanya LEWAT petak GOAL lalu memantul, jadi p.pos tidak boleh jadi GOAL (bila tidak, panel Crystal/portal muncul padahal tidak berhenti di 100) */
  if(PM.over){
    renderChips();
    setMsg('Kelebihan '+PM.over+'. '+p.name+' memantul mundur ke '+PM.bounceTo+'.'); fb('event','bounce','Kelebihan '+PM.over+'! Memantul ke '+PM.bounceTo,{gid}); sfx.bounce();
    await A(sleep(300)); await A(walk(p,GOAL,PM.bounceTo)); p.pos=PM.bounceTo;
  }
  renderChips();
  if(p.pos===GOAL&&BOSS==='wither'){ setMsg(p.name+' tiba di Benteng Nether! Siap lawan Wither.'); fb('event','dragon',p.name+' tiba di Benteng Nether! Siap lawan Wither',{gid,ttl:2400}); sfx.hundred(); sfx.win(); await A(sleep(900)); await A(awakenWither(p,gid)); await A(gatherFort(gid)); nextTurn(); return; }
  if(p.pos===GOAL&&BOSS!=='dragon'){ /* map tanpa fase boss: tiba di petak akhir = menang */
    setMsg(p.name+' tiba di petak '+GOAL+'!'); fb('event','dragon',p.name+' tiba di petak '+GOAL+'!',{gid,ttl:2400}); sfx.hundred(); sfx.win(); await A(sleep(900)); await A(celebrate(p)); finishGame(p); return;
  }
  if(p.pos===GOAL){ setMsg(p.name+' tiba di The End! Lempar dadu untuk melawan Ender Dragon.'); fb('event','dragon',p.name+' tiba di The End! Siap lawan Ender Dragon',{gid,ttl:2400}); sfx.hundred(); sfx.win(); await A(sleep(900)); await A(awakenDragon(p,gid)); await A(gatherArena(gid)); nextTurn(); return; }
  await A(resolveTileAt(p,gid));
  if(CHESTS.has(p.pos)){ const pre=p.pos; await A(giveChest(p,chestToken(p))); if(p.pos!==pre) await A(resolveAfterChestMove(p,gid)); }
  renderChips();
  await A(faceCamera(p.pawn));
  if(v===6||p.extra){ p.extra=false; busy=false; beginTurn(true); }
  else nextTurn();
}
/* ---------- Dragon Feature 4: Special Dice Control ----------
   Memperluas dadu existing (showDie + doRoll), BUKAN sistem dadu baru. Mode khusus hanya untuk pemain manusia yang berada di Block 100 setelah Awakening
   (fase End Crystal dan fase serang Dragon). Tahan tombol Roll: angka berputar 1>2>3>4>5>6>1...; lepas: angka saat itu dipilih dan diteruskan ke doRoll({value}).
   Dadu normal (di luar Block 100, CPU, AFK auto-roll) tidak berubah. Pointer Events: pointerdown/up/cancel (+lostpointercapture, blur, visibilitychange, watchdog) agar tombol tidak stuck. */
const DICE_HOLD_MS=170,DH={on:false,id:null,v:1,timer:0,gid:0};
function specialDiceActive(p){ return !!(p&&!p.cpu&&p.pos===GOAL&&AWK.done&&!gameOver); }
function specialHint(p){
  if(!specialDiceActive(p)||AWK.running) return;
  if(BOSS==='wither') setMsg(p.dragonReady?p.name+': tahan Roll, lepas untuk memilih angka serangan ke Wither.':p.name+': tahan Roll, lepas di angka 1-6 untuk mengalahkan Skeleton bernomor sama.');
  else setMsg(p.dragonReady?'Serang Ender Dragon!':p.name+': tahan Roll, lepas di angka 1-4 untuk menghancurkan Crystal bernomor sama.');
}
function syncRollLabel(){
  const b=$('btnRoll'),p=players[cur],sp=specialDiceActive(p),dragonAttack=!!(sp&&BOSS==='dragon'&&p.dragonReady);
  b.classList.toggle('special',sp); b.classList.toggle('boss-attack',dragonAttack); b.classList.toggle('holding',DH.on);
  b.textContent=DH.on?'Lepas':(dragonAttack?'Serang':(sp?'Hancurkan':'Roll'));
  dmShow(sp&&!AWK.running&&canControlPlayer(players[cur])); if(sp&&!DH.on) dmDraw(0); /* bar 1-6 ikut hilang bersama Roll/Auto saat bukan giliran pemain ini */
}
const DM_SWEEP_MS=850; /* waktu satu sapuan kiri -> kanan */
function dmSeg(x){ return Math.max(1,Math.min(6,Math.floor(x*6)+1)); }
function dmShow(on){ const m=$('diceMeter'); if(m) m.hidden=!on; }
function dmDraw(x){
  const n=$('dmNeedle'),m=$('diceMeter'); if(!n||!m) return;
  n.style.left=(x*100)+'%'; const bar=m.querySelector('.dm-bar'); if(bar) bar.style.setProperty('--dm-x',x.toFixed(4)); /* isi bar halus mengikuti jarum (bolak-balik) */
  const k=dmSeg(x); m.querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',i+1===k));
}
function holdStart(id){
  if(DH.on||busy||paused||gameOver||AWK.running||$('btnRoll').disabled||!specialDiceActive(players[cur])) return false;
  DH.on=true; DH.id=id; DH.v=1; DH.gid=gameId; clearTurnTimer(); syncRollLabel();
  dmShow(true); DH.t0=performance.now(); DH.x=0; dmDraw(0); showDie(1,false);
  const step=now=>{
    if(!DH.on) return;
    /* watchdog: bila kondisi berubah saat ditahan (game baru, jeda, tombol nonaktif, giliran lain) -> batal, tidak stuck */
    if(DH.gid!==gameId||busy||paused||gameOver||AWK.running||$('btnRoll').disabled||!specialDiceActive(players[cur])){ holdEnd(false); return; }
    const ph=((now-DH.t0)/DM_SWEEP_MS)%2,x=ph<1?ph:2-ph; /* ping-pong 0..1..0 */
    DH.x=x; dmDraw(x);
    const v=dmSeg(x); if(v!==DH.v){ DH.v=v; showDie(v,false); try{ UT.GameplayDiceThrow.showNumber(v); }catch(e){} }
    DH.raf=requestAnimationFrame(step);
  };
  DH.raf=requestAnimationFrame(step);
  return true;
}
function holdEnd(select){
  if(!DH.on) return;
  const v=DH.v,gid=DH.gid; DH.on=false; DH.id=null; cancelAnimationFrame(DH.raf); DH.raf=0; clearInterval(DH.timer); DH.timer=0;
  try{ $('btnRoll').releasePointerCapture&&DH.pc&&$('btnRoll').releasePointerCapture(DH.pc); }catch(e){} DH.pc=null;
  syncRollLabel();
  if(select&&gid===gameId&&!busy&&!paused&&!gameOver&&specialDiceActive(players[cur])){ submitRoll(v); }
  else if(gid===gameId&&!busy&&!gameOver){ startTurnTimer(); } /* batal: dadu kembali normal, timer AFK jalan lagi */
}
(function wireSpecialDice(){
  const b=$('btnRoll');
  b.style.touchAction='none'; b.style.userSelect='none'; b.style.webkitUserSelect='none'; b.style.webkitTouchCallout='none';
  b.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0) return;
    if(DH.on||!specialDiceActive(players[cur])||b.disabled) return;
    e.preventDefault(); ensureAudio();
    if(holdStart(e.pointerId)){ DH.pc=e.pointerId; try{ b.setPointerCapture(e.pointerId); }catch(err){} }
  });
  const up=e=>{ if(DH.on&&e.pointerId===DH.id) holdEnd(true); },cancel=e=>{ if(DH.on&&e.pointerId===DH.id) holdEnd(false); };
  b.addEventListener('pointerup',up); b.addEventListener('pointercancel',cancel); b.addEventListener('lostpointercapture',cancel);
  window.addEventListener('pointerup',up,true); window.addEventListener('pointercancel',cancel,true); /* fallback bila capture gagal (lepas di luar tombol) */
  window.addEventListener('blur',()=>holdEnd(false)); document.addEventListener('visibilitychange',()=>{ if(document.hidden) holdEnd(false); });
window.addEventListener('pagehide',()=>dragonMusicStop(true));
  b.addEventListener('contextmenu',e=>{ if(specialDiceActive(players[cur])) e.preventDefault(); });
  /* keyboard (aksesibilitas): Space/Enter tahan = putar, lepas = pilih */
  b.addEventListener('keydown',e=>{ if((e.key===' '||e.key==='Enter')&&specialDiceActive(players[cur])){ e.preventDefault(); if(!e.repeat&&holdStart('kbd')) DH.id='kbd'; } });
  b.addEventListener('keyup',e=>{ if((e.key===' '||e.key==='Enter')&&DH.on&&DH.id==='kbd'){ e.preventDefault(); holdEnd(true); } });
  b.addEventListener('blur',()=>holdEnd(false));
})();
/* Online: minta angka dadu 1-6 ke server (RPC roll_game_dice). Retry memakai eventId yang sama, jadi angka tidak diundi ulang. */
async function serverRoll(p,mode,value){
  if(!MP_SYNC||!MP_SYNC.rollDice) throw new Error('SYNC_NOT_READY');
  const eid=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});
  for(let n=0;;n++){
    try{
      const row=await MP_SYNC.rollDice({playerId:p.networkId||null,eventId:eid,mode:mode||'normal',value:Number.isInteger(value)?value:null});
      const v=row&&row.payload?Number(row.payload.v):NaN;
      if(Number.isInteger(v)&&v>=1&&v<=6) return v;
      throw new Error('BAD_ROLL');
    }catch(e){
      const t=String((e&&(e.message||e.code))||e);
      if(n>=3||/ROOM_NOT_PLAYING|ROOM_ACCESS_DENIED|AUTH_REQUIRED|ROLL_TARGET_NOT_IN_ROOM|ROLL_FOR_OTHER|INVALID_DICE/.test(t)) throw e;
      await sleep(/ROLL_TOO_FAST/.test(t)?800:400*(n+1));
    }
  }
}
async function doRoll(opt){
  if((ONLINE_ROOM&&!ONLINE_HOST)||busy||paused||gameOver||!players.length||AWK.running) return;
  if(DH.on) holdEnd(false); /* tombol roll tidak boleh tertinggal dalam mode tahan */
  busy=true; setRoll(false); clearTurnTimer();
  const gid=gameId,p=players[cur];if(!p.cpu&&!(opt&&opt.afk)) afkReset(p); /* roll manual = pemain aktif lagi */ let v=1;
  const spOK=!!(opt&&Number.isInteger(opt.value)&&opt.value>=1&&opt.value<=6&&specialDiceActive(p)); /* Special Dice: angka dipilih lewat tahan-lepas (hanya di Block 100) */
  if(ONLINE_ROOM){ /* online (host): angka dadu (termasuk modifier) diundi server dan tercatat di game_events; tidak ada fallback Math.random */
    const fl={lucky:p.lucky,odd:p.odd,even:p.even};
    const mode=spOK?'special':chestDiceMode(p); /* flag dadu (Pasti 6 / Ramuan Ganjil / Ramuan Genap) berlaku 1 roll */
    if(!spOK){ try{ syncDiceGuide(); }catch(e){} }
    try{ v=await serverRoll(p,mode,spOK?opt.value:null); }
    catch(e){ console.error('[multiplayer] server dice failed',e); p.lucky=fl.lucky; p.odd=fl.odd; p.even=fl.even; try{ syncDiceGuide(); }catch(e2){} if(gid!==gameId) return; busy=false; setMsg('Dadu dari server gagal. Coba lagi.'); setRoll(canControlPlayer(players[cur])); startTurnTimer(); return; }
    if(gid!==gameId) return;
  } else {
    v=1+Math.floor(Math.random()*6);
    if(spOK) v=opt.value;
    else{ const cv=chestDiceForce(p); if(cv) v=cv; try{ syncDiceGuide(); }catch(e){} } /* flag dadu (Pasti 6 / Ramuan Ganjil / Ramuan Genap) berlaku 1 roll */
  }
  const rs=dice3dOn()?null:sfx.roll(); mpCue({k:'roll',pid:p.networkId,v:v}); /* dadu 3D punya suara sendiri (kocok, benturan) */
  try{
    await dieRoll(v,p); sfx.rollStop(rs); if(gid!==gameId) return;
    setMsg(p.name+' melempar '+v+'.'); msBump(p,'dice');
    const SX=UT.Gameplay.Core.sixesAfter(p.sixes,v,3); p.sixes=SX.sixes; /* aturan tiga-6 = game-core.js */
    await sleep(300); if(gid!==gameId) return;
    if(SX.forfeit){
      sfx.bounce();
      setMsg(p.name+' dapat 6 tiga kali berturut-turut. Giliran hangus.'); hud('showResult','Tiga kali 6!','Giliran hangus.',{gid,ttl:1500});
      await sleep(1500); if(gid!==gameId) return;
      nextTurn(); return;
    }
    const bn=p.bonus; p.bonus=0; await playTurn(p,v,gid,bn);
  }catch(e){
    if(e!==STALE){ console.error(e); busy=false; setRoll(ONLINE_ROOM?canControlPlayer(players[cur]):!players[cur].cpu); startTurnTimer(); }
  }
}
let MATCH_TOKEN=''; /* id unik per match (hanya untuk lawan CPU); online memakai roomId+gameId supaya refresh tidak menghitung ulang */
/* Statistik match untuk profil/achievement disimpan per pemain (p.ms). Online: host menghitung untuk semua pemain manusia dan menyertakannya di snapshot, jadi tamu mengirim statistiknya sendiri. */
let CH_SENT=0; /* jumlah peti tamu yang sudah dikirim ke server (reset tiap match) */
function msReset(){ CH_SENT=0; }
function msBump(p,k,id){ try{ if(!p||p.cpu) return; const m=p.ms||(p.ms={dice:0,ladders:0,snakes:0,skills:0,dragon_hits:0,chests:0,skill_ids:[]}); m[k]=(m[k]||0)+1; if(id&&!m.skill_ids.includes(id)&&m.skill_ids.length<8) m.skill_ids.push(id); }catch(e){} }
let MATCH_DONE=''; /* token match yang sudah dicatat -> 1x per match walau finishGame terpanggil lagi (snapshot/refresh) */
function resetWinResultDetails(){
  const slots=$('winRewardSlots');
  slots.querySelectorAll('[data-reward]').forEach(card=>{ card.hidden=true; card.querySelector('[data-reward-value]').textContent=''; });
  const status=$('winRewardStatus'); status.textContent=''; status.hidden=true;
}
function setWinReward(gid,key,amount){
  if(!gameOver||gameId!==gid) return;
  const card=$('winRewardSlots').querySelector('[data-reward="'+key+'"]'),value=Number(amount);
  if(!card||!Number.isFinite(value)||value<0) return;
  card.querySelector('[data-reward-value]').textContent='+'+Math.floor(value).toLocaleString('id-ID');
  card.hidden=false;
}
function setWinRewardStatus(gid,message){
  if(!gameOver||gameId!==gid) return;
  const status=$('winRewardStatus'); status.textContent=message; status.hidden=!message;
}
function updateWinLevelProgress(gid){
  if(gid!==undefined&&(!gameOver||gameId!==gid)) return;
  const PD=window.PlayerData,info=PD&&typeof PD.levelInfo==='function'?PD.levelInfo():null;
  if(!info||!Number.isFinite(+info.level)||!Number.isFinite(+info.xpIn)||!Number.isFinite(+info.xpMax)||info.xpMax<=0){
    $('winLevelLabel').textContent='--';
    $('winXpLabel').textContent='Progres belum tersedia';
    $('winXpFill').style.width='0%';
    $('winXpBar').setAttribute('aria-valuenow','0');
    $('winXpBar').setAttribute('aria-valuetext','Progres belum tersedia');
    return;
  }
  const percent=Math.max(0,Math.min(100,Math.round(info.xpIn/info.xpMax*100)));
  $('winLevelLabel').textContent=String(Math.floor(info.level));
  $('winXpLabel').textContent=Math.floor(info.xpIn).toLocaleString('id-ID')+' / '+Math.floor(info.xpMax).toLocaleString('id-ID')+' XP';
  $('winXpFill').style.width=percent+'%';
  $('winXpBar').setAttribute('aria-valuenow',String(percent));
  $('winXpBar').setAttribute('aria-valuetext',Math.floor(info.xpIn)+' dari '+Math.floor(info.xpMax)+' XP');
}
/* Catat hasil match ke statistik pemain (level/XP/leaderboard). Hanya: lawan CPU, atau online (pemain lokal ikut main).
   Mode lokal gantian (2-4 pemain di 1 layar) tidak dicatat: tidak jelas siapa "kamu". Gagal = diam-diam, tidak mengganggu game. */
function recordMatchResult(winner){
  try{
    const PD=window.PlayerData; if(!PD||typeof PD.applyServerStats!=='function') return false;
    let token,won,roomId=null;
    if(ONLINE_ROOM){
      const me=players.find(q=>isLocalPlayer(q)); if(!me||me.left) return false;
      won=isLocalPlayer(winner); roomId=ROOM_CFG.roomId; token='room:'+roomId+':g'+gameId;
    }else if(mode==='cpu'){
      won=!winner.cpu; token='cpu:'+MATCH_TOKEN;
    }else return false;
    if(MATCH_DONE===token) return true; MATCH_DONE=token;
    if(PD.serverMode&&PD.serverMode()){ recordMatchServer(PD,{token,won,roomId,gameId}); return true; } /* Tahap 6b: server menghitung XP/poin, klien hanya menampilkan. Tanpa akun login: tidak dicatat (login wajib). */
    return false;
  }catch(e){ console.error('[stats]',e); return false; }
}
/* Tahap 6b: hasil match akun login. Server (submit_match_result) satu-satunya yang menghitung XP/poin/statistik;
   setelah diterima, profil server dibaca ulang dan disalin ke cache PlayerData. Gagal/offline = tidak tercatat (tanpa tulis lokal). */
async function recordMatchServer(PD,m){
  try{
    const lp=players.find(q=>isLocalPlayer(q)),mm=(lp&&lp.ms)||{},ST={dice:mm.dice|0,ladders:mm.ladders|0,snakes:mm.snakes|0,skills:mm.skills|0,dragon_hits:mm.dragon_hits|0,skill_ids:(mm.skill_ids||[]).slice()};
    const lvBefore=PD.levelInfo().level;
    await import(new URL('assets/js/multiplayer/room-service.js', document.baseURI).href); await import(new URL('assets/js/multiplayer/progress-service.js', document.baseURI).href);
    const RS=UT.Multiplayer&&UT.Multiplayer.RoomService;
    if(!RS||!RS.submitMatchResult){ setWinRewardStatus(m.gameId,'Hasil pertandingan tidak dapat dimuat.'); return; }
    let r=null;
    for(let n=0;n<=6;n++){
      r=await RS.submitMatchResult({matchId:m.token,won:m.won,name:PD.profile().name,xpTotal:0,roomId:m.roomId,mode:ONLINE_ROOM?'online':'cpu',players:players.length,stats:ST});
      if(r&&r.ok===false&&r.reason==='room_not_finished'&&n<6){ await new Promise(ok=>setTimeout(ok,1500)); continue; } /* server baru mencatat bila room sudah 'finished' */
      break;
    }
    if(!r||r.ok===false||r.duplicate||r.ignored){
      setWinRewardStatus(m.gameId,r&&r.duplicate?'Hasil pertandingan sudah pernah dicatat.':'Hasil pertandingan gagal dicatat.');
      return;
    }
    if(!Number.isFinite(r.xp_gain)||r.xp_gain<0||!Number.isFinite(r.points)||r.points<0){
      setWinRewardStatus(m.gameId,'Data hadiah pertandingan tidak lengkap.');
      return;
    }
    setWinReward(m.gameId,'xp',r.xp_gain);
    setWinReward(m.gameId,'points',r.points);
    const sp=await UT.Multiplayer.Progress.getMyProfile();
    if(!sp||!sp.exists){
      const bossStatus=DRG.rewardStatus&&DRG.rewardStatus.gameId===m.gameId?DRG.rewardStatus.message:'';
      setWinRewardStatus(m.gameId,bossStatus||'XP dan poin tercatat, tetapi progres level belum tersinkron.');
      return;
    }
    const a=PD.applyServerStats({xp:sp.xp,plays:sp.plays,wins:sp.wins,streak:sp.streak,bestStreak:sp.best_streak,points:sp.points,weekPoints:sp.week_points,name:sp.name});
    updateWinLevelProgress(m.gameId);
    const bossStatus=DRG.rewardStatus&&DRG.rewardStatus.gameId===m.gameId?DRG.rewardStatus.message:'';
    setWinRewardStatus(m.gameId,bossStatus||(a&&a.ok?'':'XP dan poin tercatat, tetapi progres level gagal disimpan.'));
    const won=!!r.won,bits=['+'+(r.xp_gain|0)+' XP']; if(r.points>0) bits.push('+'+r.points+' poin'); if(a&&a.ok&&a.level>lvBefore) bits.push('LEVEL '+a.level+'!');
    try{ setTimeout(()=>{ if(gameOver&&gameId===m.gameId) setMsg((won?'Menang! ':'Kalah. ')+bits.join(' · ')); },300); }catch(e){}
    try{ const W=UT.WalletService&&UT.WalletService.get(); if(W) W.questTrack(won?'win':'play'); }catch(e){} /* progres misi dihitung server (win juga menghitung play) */
  }catch(e){ console.warn('[stats] gagal mencatat ke server',e); setWinRewardStatus(m.gameId,'Hasil pertandingan gagal dimuat.'); }
}
let RES_GID=-1; /* Stage 4.1.24.D.1: gameId terakhir yang sudah memutar suara hasil -> 1x per game, tak bisa dobel */
function finishGame(p,fromRemote){
  clearBossFx();
  gameOver=true; winnerIndex=players.indexOf(p); clearTurnTimer(); if(!fromRemote)p.score+=50; try{ syncAutoBtn(); }catch(e){} renderChips(); if(FBK) FBK.hideMarker(p); pawnOutline(p.pawn,false);
  setMsg(BOSS==='dragon'?p.name+' mengalahkan Ender Dragon!':BOSS==='wither'?p.name+' mengalahkan Wither!':p.name+' sampai di petak '+GOAL+'!'); setRoll(false);
  const lost=isPlayerDefeat(p);
  if(lost) pawnAct(p.pawn,'sad',2.4); else pawnCheer(p.pawn,2.6); /* karakter baru: sorak saat menang, sedih saat kalah */
  resetWinResultDetails();
  updateWinLevelProgress(gameId);
  $('winRewardsTitle').textContent=lost?'PROGRES PERTANDINGAN':'HADIAH';
  const resultRecorded=recordMatchResult(p);
  const bossReward=DRG.reward&&DRG.reward.gameId===gameId?DRG.reward:null;
  if(bossReward){ setWinReward(gameId,'coins',bossReward.coins); setWinReward(gameId,'gems',bossReward.gems); }
  const bossStatus=DRG.rewardStatus&&DRG.rewardStatus.gameId===gameId?DRG.rewardStatus.message:'';
  setWinRewardStatus(gameId,bossStatus||(resultRecorded?'Memuat hasil pertandingan...':'Hasil mode ini tidak disimpan ke profil.'));
  if(lost&&RES_GID!==gameId){ RES_GID=gameId; sfx.defeat(); } /* event hasil KALAH (bukan perubahan teks/render): 1x per game */
  $('win').dataset.state=lost?'lose':'win';
  $('winEyebrow').textContent=lost?'Level gagal':'Sampai di petak '+GOAL;
  $('winTitle').textContent=lost?'Kamu kalah':(mode==='cpu'&&!p.cpu)?'Kamu menang':p.name+' menang';
  $('winText').textContent=(p.cpu?'Komputer lebih beruntung kali ini. Coba lagi?':'Pionmu lebih dulu sampai di puncak. Mau main lagi?')+(DRG.text&&!p.cpu?' '+DRG.text:'');
  setTimeout(()=>{ if(gameOver) $('win').hidden=false; },500);
  if(!fromRemote)publishGameSnapshot();
}
function startGame(m,keys){
  mode=m; gameId++; MATCH_TOKEN=Date.now().toString(36)+Math.random().toString(36).slice(2,8); msReset(); busy=false; gameOver=false; winnerIndex=-1; hud('reset');
  try{ if(UT.GameplayAFK) UT.GameplayAFK.clearAll(); if(UT.GameplayReady) UT.GameplayReady.cancel(); }catch(e){} /* 4.1.15: bersihkan timer Ready/AFK saat (re)start */
  if(PAURA) PAURA.clearAll(); players.forEach(p=>scene.remove(p.pawn)); players=[]; clearConfetti();
  trapsClear(); applyPendingTheme(); resetSnakes(); resetDragon(); resetAwakening(); resetDragonDefeat(); dragonMusicStop(true);
  let defs;
  keys=keys||(m==='cpu'?['steve','villager']:PLAYER_DEFS.slice(0,+m).map(d=>d.key));
  if(m==='cpu') keys=[keys[0]||'steve','villager']; /* 4.1.14.10: Computer selalu Villager, bukan Mob/skin acak */
  defs=keys.map((k,i)=>{ const d=Object.assign({},PLAYER_DEFS.find(x=>x.key===k)||PNG_DEFS.find(x=>x.key===k)||(k==='villager'?VILLAGER_DEF:null)||PLAYER_DEFS[0]); if(m==='cpu'&&i===1){ d.cpu=true; d.name+=' CPU'; } if(ONLINE_ROOM&&ROOM_CFG.players&&ROOM_CFG.players[i]){d.name=ROOM_CFG.players[i].name||d.name;d.networkId=ROOM_CFG.players[i].id;d.team=ROOM_CFG.players[i].team||0;d.cpu=false;} const sc=SEAT_COLORS[i%SEAT_COLORS.length]; d.css=sc.css; d.hex=sc.hex; d.color=sc.name; return d; });
  if(ONLINE_ROOM&&MP_LEFT.size){ const stay=defs.filter(d=>!d.networkId||!MP_LEFT.has(d.networkId)); if(stay.length) defs=stay; } /* 'Main lagi': pemain yang sudah keluar tidak ikut lagi */
  defs.forEach((d,i)=>{
    const pawn=makePawn(d,ONLINE_ROOM?null:(i===0&&!d.cpu?-1:(d.cpu&&!NEW_CHAR_CPU?null:2+i*3))); /* online: pion lama dulu, diganti applyOnlineLooks setelah identitas & tampilan dari server tiba */ pawn.position.copy(slotPos(i,0)); pawn.rotation.y=Math.atan2(-SLOT[i][0],-SLOT[i][1]); scene.add(pawn); /* duduk menghadap api */
    players.push({idx:i,networkId:d.networkId||null,team:d.team||0,name:(!ONLINE_ROOM&&i===0&&!d.cpu&&myProfileName())||d.name,key:d.key,css:d.css,hex:d.hex,color:d.color,cpu:!!d.cpu,pos:0,sixes:0,dhp:BOSS==='wither'?WITHER_HP:100,hpMax:BOSS==='wither'?WITHER_HP:100,crystal:0,cdone:new Array(CRYSTAL_N).fill(false),dragonReady:false,inArena:false,pawn,score:0,bonus:0,extra:false,odd:false,even:false,lucky:false,shield:false,pu:seatPU(i,d)});
  });
  cur=0; resetCam();
  $('win').hidden=true;
  document.body.classList.add('playing');
  showDie(1,false);
  /* 4.1.15: Ready Screen sebelum giliran pertama. ?ready=0 / modul tak termuat -> langsung main seperti sebelumnya. */
  const gidR=gameId,goPlay=()=>{ if(gidR!==gameId) return; publishTurnState(); beginTurn(); },RD=window.UT&&UT.GameplayReady;
  if(!ONLINE_ROOM&&RD&&RD.show&&UT.GameplayAFK&&new URLSearchParams(location.search).get('ready')!=='0'){
    setRoll(false); setMsg('Pilih kartu untuk menentukan urutan giliran.'); focus=players[0].pawn; renderChips();
    const pre=players.filter(q=>PNG_DEFS.some(d=>d.key===q.key)).map(q=>loadSkin3D(q.key)).concat([frameWait()]); /* tunggu wajah PNG (maks 1,5 dtk) */
    Promise.race([Promise.all(pre),sleep(1500)]).catch(()=>{}).then(()=>{ if(gidR!==gameId) return; return RD.show(players,{face:q=>framedFace(q),sfx:n=>{ try{ sfx[n]&&sfx[n](); }catch(e){} }}); }).then(r=>{ if(!r) return; if(gidR!==gameId) return;
      /* 4.1.15.6: hasil shuffle = sumber giliran. Urutkan ulang players[] (nextTurn/cur existing dipakai apa adanya); p.idx (slot api unggun) tidak berubah. */
      if(Array.isArray(r)&&r.length===players.length&&r.every(q=>players.indexOf(q)>-1)){ players.length=0; r.forEach(q=>players.push(q)); }
      cur=0; goPlay(); }).catch(e=>{ console.error(e); goPlay(); });
  }else goPlay();
}


/* ---------- Supabase multiplayer snapshot bridge ----------
   The host runs the existing game engine. Guests send roll intents and apply committed snapshots.
   Three.js objects stay local; only plain JSON gameplay state is synchronized. */
/* Cue animasi: host menyiarkan isyarat visual (dadu, langkah, tangga, ular); tamu memutarnya berurutan.
   Snapshot yang datang saat animasi tamu berjalan ditahan sampai antrean selesai. */
let MP_CUE_CHAIN=Promise.resolve(),MP_CUE_N=0,MP_PENDING_SNAP=null;
const MPFB={fb:1,sfx:1,atk:1,ccard:1,ccard_hide:1,chest:1,hitfx:1,bosshfx:1,pfx:1,pufx:1,confetti:1,blast:1,dmusic:1,hud:1,dfx:1,seq:1};
function mpCue(c){ if(!ONLINE_ROOM||!ONLINE_HOST||!MP_SYNC||!MP_SYNC.sendCue) return; try{ MP_SYNC.sendCue(c).catch(()=>{}); }catch(e){} }
function mpPlayerByNet(id){ return players.find(q=>q.networkId===id); }
function mpRunCue(c){
  const p=mpPlayerByNet(c.pid); if(!p) return Promise.resolve();
  if(c.k==='roll'){ const rs=dice3dOn()?null:sfx.roll(); setMsg(p.name+' melempar dadu...'); return dieRoll(c.v,p).then(()=>{ try{ sfx.rollStop(rs); }catch(e){} setMsg(p.name+' melempar '+c.v+'.'); }); }
  if(c.k==='walk') return walk(p,c.from,c.to);
  if(c.k==='climb') return climb(p,c.from,c.to);
  if(c.k==='bite') return bite(p,c.from,c.to,gameId);
  return Promise.resolve();
}
/* Cue feedback (tamu): pemain mana pun melihat/mendengar hasil aksi yang sama dengan host. Tidak ada gate giliran. */
function mpFixGid(a){ return (a||[]).map(x=>(x&&typeof x==='object'&&!Array.isArray(x)&&x.gid!==undefined)?Object.assign({},x,{gid:gameId}):x); }
function mpRunFeedbackCue(c){
  try{
    if(c.k==='fb'){ const a=mpFixGid(c.a); if(c.f==='short'&&!fb0(c.f,...a)){ const o=a[3]||{}; hud0('showPower',a[0],a[1],a[2],o); } else if(c.f!=='short') fb0(c.f,...a); }
    else if(c.k==='seq'){ return mpRunSeq(c); }
    else if(c.k==='confetti'){ spawnConfetti(new THREE.Vector3(c.x,c.y,c.z)); }
    else if(c.k==='blast'){ spawnExplosion(new THREE.Vector3(c.x,c.y,c.z),c.kind); }
    else if(c.k==='dmusic'){ dragonMusicStop(c.i); }
    else if(c.k==='hud'){ hud0(c.f,...mpFixGid(c.a)); }
    else if(c.k==='dfx'){ return mpDragonFx(c.t); }
    else if(c.k==='sfx'){ const f=sfx0[c.n]; if(typeof f==='function'){ /* suara aksi pemain lain: lebih pelan (MP_SFX_GAIN) dari suara aksi sendiri; volume dibaca saat dipanggil, jadi cukup diturunkan sesaat lalu dikembalikan */
        const base=sfxVol/100; try{ if(GA&&GA.setSfxVolume) GA.setSfxVolume(base*MP_SFX_GAIN); f.apply(sfx0,c.a||[]); } finally{ try{ if(GA&&GA.setSfxVolume) GA.setSfxVolume(base); }catch(e){} } } }
    else if(c.k==='atk'){ if(FBK) FBK.showAttackCard(c.a[0],c.a[1],c.a[2],c.a[3],{silent:true,powerHit:!!c.powerHit}); }
    else if(c.k==='ccard'){ if(FBK) FBK.showChestRewardCard(c.w,c.t); clearTimeout(MP_CCARD_T); MP_CCARD_T=setTimeout(()=>{ if(FBK) FBK.hideChestRewardCard(); },2500); }
    else if(c.k==='ccard_hide'){ clearTimeout(MP_CCARD_T); if(FBK) FBK.hideChestRewardCard(); }
    else if(c.k==='chest'){ if(c.o) openChest(c.n); else closeChest(c.n); }
    else if(c.k==='hitfx'){ const q=mpPlayerByNet(c.pid); if(q) hitBlastFx(q); }
    else if(c.k==='bosshfx'){ bossHitFx(c.dmg,true,!!c.fight); }
    else if(c.k==='pfx'){ const q=mpPlayerByNet(c.pid); if(q) powerFxPawn(c.key,q); }
    else if(c.k==='pufx'){ puFx(c.key,c.cls); }
  }catch(e){ console.error('[multiplayer] feedback cue failed',e); }
  return Promise.resolve();
}
let MP_CCARD_T=0;
const MP_SFX_GAIN=0.6; /* 60% dari volume SFX pemain; ubah angka ini untuk lebih pelan/keras */
/* Sequence boss/kemenangan: host menjalankan fungsi aslinya, tamu menjalankan fungsi yang SAMA secara lokal (animasi, kamera, musik, SFX-nya sendiri). Hanya presentasi; state tetap dari host lewat snapshot. */
function mpRunSeq(c){
  const p=c.pid?mpPlayerByNet(c.pid):null,gid=gameId;
  if(c.n==='celebrate'&&p) return celebrate(p);
  if(c.n==='awakenDragon'&&p) return awakenDragon(p,gid);
  if(c.n==='awakenWither'&&p) return awakenWither(p,gid);
  if(c.n==='gatherArena') return gatherArena(gid);
  if(c.n==='gatherFort') return gatherFort(gid);
  return Promise.resolve();
}
async function mpDragonFx(t){
  const D=dragon&&dragon.userData; if(!D) return;
  if(t==='hurt'){ await tween(0.5,k=>{ D.shk=Math.sin(k*40)*0.3*(1-k); D.mats.forEach(m=>m.color.setHex(k<0.6?0xFF5555:0xFFFFFF)); }); D.shk=0; D.mats.forEach(m=>m.color.setHex(0xFFFFFF)); }
  else if(t==='death'){ spawnConfetti(dragon.position); await tween(1.3,k=>{ D.dy=-k*3; dragon.scale.setScalar(DRAGON_S*(1-k*0.85)); }); dragon.visible=false; }
}
/* Bungkus sequence: host kirim cue 'seq' lalu jalankan aslinya (MP_SEQ>0 menahan mirror suara/FX di dalamnya). */
function mpWrapSeq(name,fn,withPid){
  return function(...a){
    if(!(ONLINE_ROOM&&ONLINE_HOST)) return fn.apply(this,a);
    const q=withPid?a[0]:null; mpCue({k:'seq',n:name,pid:q&&q.networkId});
    MP_SEQ++; let r; try{ r=fn.apply(this,a); }catch(e){ MP_SEQ--; throw e; }
    return Promise.resolve(r).finally(()=>{ MP_SEQ--; });
  };
}
celebrate=mpWrapSeq('celebrate',celebrate,true);
awakenDragon=mpWrapSeq('awakenDragon',awakenDragon,true);
awakenWither=mpWrapSeq('awakenWither',awakenWither,true);
gatherArena=mpWrapSeq('gatherArena',gatherArena,false);
gatherFort=mpWrapSeq('gatherFort',gatherFort,false);
/* Totem: keputusan dibuat di layar KORBAN, bukan di layar host. Host menunggu jawaban (maks 15 dtk -> otomatis pakai, sama seperti timeout modal). */
let MP_TOTEM=null;
function mpAskGuestTotem(p,what,gid){
  return new Promise(res=>{
    const id='t'+Date.now()+Math.random().toString(36).slice(2,6);
    const done=v=>{ if(MP_TOTEM&&MP_TOTEM.id===id){ clearTimeout(MP_TOTEM.t); MP_TOTEM=null; res(v); } };
    MP_TOTEM={id:id,res:done,t:setTimeout(()=>done(true),15000)};
    mpCue({k:'totem_ask',id:id,pid:p.networkId,what:what});
  });
}
function onMpTotemAnswer(pl){ if(MP_TOTEM&&pl&&pl.id===MP_TOTEM.id) MP_TOTEM.res(!!pl.use); }
async function mpGuestTotemPrompt(c){
  const p=mpPlayerByNet(c.pid); if(!p||p.networkId!==MP_ID) return; /* hanya korban yang melihat modal */
  const use=await totemModal(p,c.what,gameId);
  try{ if(MP_SYNC&&MP_SYNC.sendTotemAnswer) await MP_SYNC.sendTotemAnswer({id:c.id,playerId:MP_ID,use:!!use}); }catch(e){ console.error('[multiplayer] totem answer failed',e); }
}
function onMpCue(c){
  if(!ONLINE_ROOM||ONLINE_HOST) return;
  if(c&&c.k==='totem_ask'){ mpGuestTotemPrompt(c); return; } /* di luar antrean animasi: modal harus segera muncul */
  MP_CUE_N++;
  MP_CUE_CHAIN=MP_CUE_CHAIN.then(()=>(c&&MPFB[c.k])?mpRunFeedbackCue(c):mpRunCue(c)).catch(e=>{ if(e!==STALE) console.error('[multiplayer] cue failed',e); }).then(()=>{
    MP_CUE_N--;
    if(MP_CUE_N===0&&MP_PENDING_SNAP){ const s=MP_PENDING_SNAP; MP_PENDING_SNAP=null; applyGameSnapshot(s); }
  });
}
function makeGameSnapshot(){
 return {traps:TRAPS.map(t=>({id:t.id,tile:t.tile,owner:t.owner,key:t.key,back:t.back,radius:t.radius})),cur:cur,gameOver:gameOver,winnerIndex:winnerIndex,awake:!!AWK.done,witherRisen:!!WF.risen,
  dragonVisible:!!dragon.visible,dragonDefeated:!!DRG.defeated,dragonDone:!!DRG.done,dragonText:DRG.text||'',night:!!night,
  players:players.map(p=>({networkId:p.networkId,name:p.name,pos:p.pos,sixes:p.sixes,dhp:p.dhp,hpMax:p.hpMax,
   crystal:p.crystal,cdone:Array.isArray(p.cdone)?p.cdone.slice():[],dragonReady:!!p.dragonReady,inArena:!!p.inArena,
   score:p.score,bonus:p.bonus,extra:!!p.extra,odd:!!p.odd,even:!!p.even,lucky:!!p.lucky,shield:!!p.shield,guard:!!p.guard,frozen:!!p.frozen,
   pu:Object.assign({},p.pu),ms:p.ms?Object.assign({},p.ms,{skill_ids:(p.ms.skill_ids||[]).slice()}):null,turnOrder:p.turnOrder||0,loadout:!!p.loadout,auto:!!p.auto,left:!!p.left,afkMiss:p.afkMiss|0,
   pawn:p.pawn?{x:p.pawn.position.x,y:p.pawn.position.y,z:p.pawn.position.z,ry:p.pawn.rotation.y}:null}))};
}
function applyGameSnapshot(s){
 if(!ONLINE_ROOM||!s||!Array.isArray(s.players)||s.players.length!==players.length)return;
 if(!ONLINE_HOST&&MP_CUE_N>0){MP_PENDING_SNAP=s;return;}
 MP_APPLYING=true;
 try{
  s.players.forEach((v,i)=>{const p=players[i];if(!p)return;
   ['pos','sixes','dhp','hpMax','crystal','dragonReady','inArena','score','bonus','extra','odd','even','lucky','shield','guard','frozen','turnOrder','loadout','auto','left','afkMiss'].forEach(k=>{if(v[k]!==undefined)p[k]=v[k]});
   p.cdone=Array.isArray(v.cdone)?v.cdone.slice():new Array(CRYSTAL_N).fill(false);
   if(v.pu&&typeof v.pu==='object'){p.pu=Object.assign({},v.pu);if(!ONLINE_HOST&&powerPaidHere(p))puSettle(v);}
   if(v.ms&&typeof v.ms==='object')p.ms=v.ms;
   if(v.pawn&&p.pawn){p.pawn.position.set(v.pawn.x,v.pawn.y,v.pawn.z);p.pawn.rotation.y=v.pawn.ry||0;}
  });
  if(!ONLINE_HOST){ try{ const lp=players.find(q=>isLocalPlayer(q)),d=lp&&lp.ms?Math.min(20,(lp.ms.chests|0)-CH_SENT):0; if(d>0){ CH_SENT+=d; import(new URL('assets/js/multiplayer/progress-service.js', document.baseURI).href).then(()=>UT.Multiplayer.Progress.bumpCounter('chests',d)).catch(()=>{}); } }catch(e){} }
  if(!ONLINE_HOST&&Array.isArray(s.traps))trapsSync(s.traps);
  cur=Math.max(0,Math.min(players.length-1,Number(s.cur)||0));winnerIndex=Number.isInteger(s.winnerIndex)?s.winnerIndex:-1;
  busy=false;gameOver=!!s.gameOver;AWK.done=!!s.awake;AWK.running=false;WF.risen=!!s.witherRisen;
  DRG.defeated=!!s.dragonDefeated;DRG.done=!!s.dragonDone;DRG.text=s.dragonText||'';dragon.visible=!!s.dragonVisible;
  if(typeof s.night==='boolean'&&night!==s.night)setNight(s.night);
  if(AWK.done)applyArenaState();
  renderChips();syncCrystals();syncSkeletons();syncBossCam();
  if(gameOver){const w=players[winnerIndex>=0&&winnerIndex<players.length?winnerIndex:0];if(w)finishGame(w,true);}
  else beginTurn();
 }finally{MP_APPLYING=false;}
}
function publishGameSnapshot(){
 if(!ONLINE_ROOM||!ONLINE_HOST||!MP_SYNC||MP_APPLYING||!players.length)return;
 MP_SYNC.publish({roomConfig:ROOM_CFG,snapshot:makeGameSnapshot()}).catch(e=>console.error('[multiplayer] snapshot publish failed',e));
}
function initMultiplayerBridge(){
 if(!ONLINE_ROOM||MP_CONNECTING)return;MP_CONNECTING=true;
 const G=window.UT&&UT.Multiplayer&&UT.Multiplayer.GameSync;
 if(!G){console.error('[multiplayer] game sync module missing');return;}
 G.connect({roomId:ROOM_CFG.roomId,isHost:ONLINE_HOST,roomConfig:ROOM_CFG,
  onRollRequest:payload=>{if(!ONLINE_HOST||!payload||busy||paused||gameOver||AWK.running)return;const p=players[cur];if(!p||p.networkId!==payload.playerId)return;ensureAudio();doRoll(Number.isInteger(payload.value)?{value:payload.value}:undefined)},
  onPowerRequest:payload=>{if(ONLINE_HOST&&payload&&payload.phase){ /* tamu sedang memilih petak jebakan: tahan timer auto roll (pengaman 45 dtk bila tamu putus) */
    if(busy||paused||gameOver)return;const q=players[cur];if(!q||q.networkId!==payload.playerId)return;
    clearTimeout(PICK_GUARD);if(payload.phase==='pick'){clearTurnTimer();PICK_GUARD=setTimeout(()=>{if(!busy&&!gameOver&&players[cur]===q)startTurnTimer();},45000);}else startTurnTimer();return;}
    if(!ONLINE_HOST||!payload||busy||paused||gameOver||AWK.running)return;clearTimeout(PICK_GUARD);const p=players[cur];if(!p||p.networkId!==payload.playerId||!p.pu[payload.power])return;usePU(payload.power,false,Number.isInteger(payload.tile)?payload.tile:null)},
  onCue:onMpCue,
  onPeerLeft:key=>{ if(!key||key===MP_ID) return; MP_LEFT.add(key); const q=mpPlayerByNet(key); if(q&&!q.cpu) q.left=true; try{ renderChips(); }catch(e){} }, /* semua klien (host/tamu, juga saat game over) */
  onPeerJoin:key=>{ if(!key||key===MP_ID) return; MP_LEFT.delete(key); const q=mpPlayerByNet(key); if(q&&q.left){ q.left=false; try{ renderChips(); }catch(e){} } mpBroadcastAutoRoll(); }, /* pemain (re)join: kirim ulang status Auto milik kita agar chip-nya benar */
  onTotemAnswer:onMpTotemAnswer,
  onEmote:onMpEmote,
  onAutoRoll:onMpAutoRoll,
  onPlayerLeft:key=>{ if(!ONLINE_HOST||gameOver||!key||key===MP_ID) return; const q=mpPlayerByNet(key); if(!q||q.cpu||q.auto) return; q.auto=true; q.left=true; q.afkMiss=AFK_MAX_MISS; try{ fb('event','info',q.name+' keluar — mode AUTO',{gid:gameId,ttl:2200}); }catch(e){} renderChips(); publishGameSnapshot(); if(players[cur]===q&&!busy&&!paused) startTurnTimer(); },
  onPlayerJoin:key=>{ if(!ONLINE_HOST||gameOver||!key||key===MP_ID) return; const q=mpPlayerByNet(key); if(!q||!q.left) return; afkReset(q); renderChips(); publishGameSnapshot(); if(players[cur]===q&&!busy&&!paused) startTurnTimer(); }, /* kembali ke game -> kendali dikembalikan */
  onHostLeft:()=>{ if(ONLINE_HOST||gameOver) return; try{ setMsg('Host meninggalkan permainan. Kembali ke menu...'); fb('event','info','Host meninggalkan permainan',{gid:gameId,ttl:2600}); }catch(e){} setTimeout(exitToRoom,2600); },
  onLoadout:pl=>{ if(!ONLINE_HOST||!pl) return; const p=mpPlayerByNet(pl.playerId); if(!p||p.loadout||p.pos>0) return; p.pu=loadoutPU(Array.isArray(pl.powers)?pl.powers:[],pl.carry); p.loadout=true; renderChips(); publishGameSnapshot(); },
  onSnapshot:applyGameSnapshot
 }).then(sync=>{MP_SYNC=sync;MP_ID=sync.identity.id;if(sync.initialSnapshot)applyGameSnapshot(sync.initialSnapshot);applyOnlineLooks(gameId); /* pion karakter baru: milik sendiri + tampilan pemain lain dari server */
   const me=mpPlayerByNet(MP_ID);
   if(ONLINE_HOST){ if(me&&!me.loadout){ me.pu=loadoutPU(MY_SEL,MY_FIT); me.loadout=true; } if(!sync.initialSnapshot)publishGameSnapshot(); }
   else if(sync.sendLoadout){ /* tamu: kirim ulang sampai host mengakui lewat snapshot */ let n=0; const t=setInterval(()=>{ const q=mpPlayerByNet(MP_ID); if(!q||q.loadout||++n>40){ clearInterval(t); return; } sync.sendLoadout({playerId:MP_ID,powers:MY_SEL,carry:MY_FIT}).catch(()=>{}); },1500); sync.sendLoadout({playerId:MP_ID,powers:MY_SEL,carry:MY_FIT}).catch(()=>{}); }
   mpBroadcastAutoRoll(); beginTurn()})
 .catch(e=>{MP_CONNECTING=false;console.error('[multiplayer] game sync connection failed',e);setMsg('Koneksi multiplayer terputus. Muat ulang untuk mencoba kembali.')});
}

/* ---------- Kontrol antarmuka ---------- */
const LOBBY_URL='lobby.html'; /* fallback bila tidak ada data room */
function exitToRoom(){
  if(ONLINE_ROOM){ /* room online masih berstatus 'playing' -> room.html akan meluncurkan game lagi; keluar langsung ke Mode Selection */
    try{ sessionStorage.setItem('ut-mp-exited',String(ROOM_CFG.roomId)); sessionStorage.removeItem('ut-room'); sessionStorage.removeItem('ut-multiplayer-room'); localStorage.removeItem('ut-mp-active'); }catch(e){}
    const bye=()=>{ try{ if(MP_SYNC&&MP_SYNC.close) MP_SYNC.close(); }catch(e){} location.href='mode.html'; };
    const srv=()=>{ try{ const RS=window.UT&&UT.Multiplayer&&UT.Multiplayer.RoomService; return RS&&RS.exitRoom?Promise.race([RS.exitRoom(ROOM_CFG.roomId).catch(()=>{}),sleep(900)]):Promise.resolve(); }catch(e){ return Promise.resolve(); } }; /* keluarkan dari room di server agar room lama tidak 'playing' selamanya */
    if(ONLINE_HOST&&MP_SYNC&&MP_SYNC.announceLeave&&!gameOver){ Promise.race([MP_SYNC.announceLeave().catch(()=>{}),sleep(700)]).then(srv).then(bye); } else srv().then(bye); /* host keluar -> beri tahu tamu */
    return;
  }
  if(window.UT&&UT.RoomFlow) UT.RoomFlow.exitGame(); else location.href=LOBBY_URL; } /* kembali ke room/mode asal masuk */
function chooseTheme(key){
  if(busy){ pendingTheme=key; document.querySelectorAll('.tbtn').forEach(b=>b.setAttribute('aria-pressed',b.getAttribute('data-theme')===key?'true':'false')); const t=THEMES.find(x=>x.key===key); $('btnTheme').textContent='Maps: '+t.name; return; }
  pendingTheme=null; buildWorld(key);
}
let lastSkins=null;
function setNight(v){ night=v; phaseT=0; try{ UT.Prefs.set('night',!!v); }catch(e){} applyLook(theme); }
function setAuto(v){ autoDN=v; phaseT=0; try{ UT.Prefs.set('autoDN',!!v); }catch(e){} }
function cycleMode(){ /* Siang -> Malam -> Auto -> Siang */
  if(ONLINE_ROOM&&!ONLINE_HOST){ try{ fb('event','info','Hanya host yang bisa mengubah siang/malam',{gid:gameId,ttl:1800}); }catch(e){} return; } /* online: hanya host; tamu mengikuti snapshot */
  if(autoDN){ setAuto(false); setNight(false); }
  else if(night){ setAuto(true); setNight(night); }
  else setNight(true);
  if(!autoDN) ambienceWrite(night); /* Siang/Malam manual = menyimpan pilihan Suasana; mode Auto tidak mengubahnya */
  if(ONLINE_ROOM) publishGameSnapshot();
}
function tickAuto(dt){ if(!autoDN||paused||gameOver) return; if(ONLINE_ROOM&&!ONLINE_HOST) return; phaseT+=dt; if(phaseT>=PHASE_SEC){ setNight(!night); if(ONLINE_ROOM) publishGameSnapshot(); } }
$('btnNight').addEventListener('click',()=>{ cycleMode(); });
/* Daftar dadu dibaca dari ItemCatalog (satu sumber; kepemilikan & harga di server), bukan array hardcode. */
const DICE=(window.ItemCatalog?window.ItemCatalog.items.filter(i=>i.kind==='dice'&&i.art).map(i=>({key:i.gameKey,name:i.name.replace(/^Dadu /,''),bg:i.art.bg,pip:i.art.pip,edge:i.art.edge})):[]);
if(!DICE.length) DICE.push({key:'klasik',name:'Klasik',bg:'#ffffff',pip:'#1b2a3b',edge:'#1b2a3b'}); /* cadangan bila katalog gagal dimuat */
function equippedGameKey(slot){ try{ const it=window.ItemCatalog.byId(window.PlayerData.equippedId(slot)); return (it&&it.gameKey)||null; }catch(e){ return null; } } /* Tahap 5a: pilihan dadu/tema dari PlayerData, bukan key lokal */
let diceKey=equippedGameKey('dice')||'klasik';
function applyDice(k){
  const d=DICE.find(x=>x.key===k)||DICE[0]; diceKey=d.key;
  try{ const D=window.UT&&UT.GameplayDiceUI; if(D&&D.setSkin) D.setSkin(d.key); }catch(e){} try{ const T=window.UT&&UT.GameplayDiceThrow; if(T&&T.setSkin) T.setSkin(d.key); }catch(e){} /* skin = material dadu 3D asli (Dice Kit), sama dengan preview Inventory */
  $('btnDice').textContent='Dadu: '+d.name;
  document.querySelectorAll('.dbtn').forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-d')===d.key)));
}
$('btnDice').addEventListener('click',()=>applyDice(DICE[(DICE.findIndex(x=>x.key===diceKey)+1)%DICE.length].key));
applyDice(diceKey);
updateNightUI();
$('btnRoll').addEventListener('click',()=>{ if(specialDiceActive(players[cur])) return; /* mode khusus ditangani pointer/keyboard hold */ submitRoll(); });
/* Auto roll (4.1.25 ownership): hanya menjalankan giliran PEMAIN LOKAL lewat doRoll() yang sama dengan tombol Roll/AFK.
   Pemain lokal = pemain non-CPU dengan idx 0 (pemilik profil PlayerData; konvensi sama dengan frameOf). Sistem turn/ID tetap players[]+cur+p.idx.
   Tombol disabled (bukan dihapus, agar layout tetap) saat giliran pemain lain/CPU, jeda, busy, atau game selesai. Status ON/OFF TIDAK disimpan (selalu OFF saat game dibuka). */
const AUTO_ROLL_DELAY=900; let autoRoll=false,autoSince=0,autoGid=-1;
try{ localStorage.removeItem('ut-autoroll'); }catch(e){} /* AUTO selalu mulai OFF dan tidak disimpan di perangkat (bersihkan sisa nilai lama) */
function localPlayerIdx(){ return ONLINE_ROOM?players.findIndex(p=>p.networkId===MP_ID):0; }
function isLocalPlayer(p){ return !!p&&!p.cpu&&(ONLINE_ROOM?!!(MP_ID&&p.networkId===MP_ID):p.idx===localPlayerIdx()); }
function autoCanRoll(){ const p=players[cur]; return isLocalPlayer(p)&&!busy&&!paused&&!gameOver&&!AWK.running&&!DH.on&&!$('btnRoll').disabled&&!document.getElementById('readyScreen'); }
function syncAutoBtn(){ const b=$('btnAuto'); if(!b) return; b.setAttribute('aria-pressed',String(autoRoll)); b.disabled=!(players.length&&isLocalPlayer(players[cur])&&!gameOver); }
function setAutoRoll(on){ if(!isLocalPlayer(players[cur])) return; autoRoll=!!on; autoSince=0; syncAutoBtn(); mpBroadcastAutoRoll(); try{ renderChips(); }catch(e){} try{ fb('event','info','Auto roll '+(autoRoll?'aktif':'mati'),{gid:gameId,ttl:1200,local:true}); }catch(e){} }
$('btnAuto').addEventListener('click',()=>{ if($('btnAuto').disabled) return; ensureAudio(); setAutoRoll(!autoRoll); });
syncAutoBtn();
setInterval(()=>{
  syncAutoBtn();
  if(autoGid!==gameId){ autoGid=gameId; autoSince=0; return; } /* game baru: reset penghitung */
  if(!autoRoll||!autoCanRoll()){ autoSince=0; return; }
  const now=performance.now(); if(!autoSince){ autoSince=now; return; }
  if(now-autoSince>=AUTO_ROLL_DELAY){ autoSince=0; ensureAudio(); submitRoll(); } /* doRoll() set busy sinkron -> tick berikut tidak bisa roll ganda */
},150);
$('btnCam').addEventListener('click',()=>resetCam());
camLoad(); camUI();
$('btnMenu').addEventListener('click',()=>setHudMenuOpen(!hudMenuOpen));
camRefit=()=>{ if(camLocked()) goal.zoom=WF.cam?fortZoom(true):(WF.shot?fortZoom(false):lockZoom()); };
if(camLocked()){ resetCam(); cam.yaw=goal.yaw; cam.pitch=goal.pitch; cam.zoom=goal.zoom; camTarget.set(lockCenter.x,LOCK_BOX.y,lockCenter.z); } /* mulai langsung di LOCK tanpa gerakan kamera */
$('btnPreset').addEventListener('click',camMenuToggle);
$('btnFollow').addEventListener('click',()=>camSetFollow(!camCfg.follow));
/* Pintasan keyboard (desktop): 1 = ganti sudut kamera, 2 = ikuti bidak (nyala/mati), 3 = reset kamera. Esc = menu jeda (pause.js). */
document.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey) return;
  if(e.key!=='1'&&e.key!=='2'&&e.key!=='3') return;
  const t=e.target,tag=t&&t.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable)) return;
  if(!document.body.classList.contains('playing')||paused||AWK.running) return;
  const win=$('win'); if(win&&!win.hidden) return;
  const pm=$('pauseMenu'); if(pm&&!pm.hidden) return;
  e.preventDefault(); ensureAudio();
  if(e.key==='1'){ camMenuClose(); camNextPreset(); }
  else if(e.key==='2') camSetFollow(!camCfg.follow);
  else resetCam();
});
$('btnTheme').addEventListener('click',()=>{
  const now=pendingTheme||themeKey,i=THEMES.findIndex(t=>t.key===now);
  chooseTheme(THEMES[(i+1)%THEMES.length].key);
});
$('btnSnd').addEventListener('click',()=>{ muted=!muted; if(GA) GA.setMuted(muted); syncDiceSound(); setMusicOn(!muted); ensureAudio(); const t=muted?'mati':'nyala'; $('btnSnd').innerHTML='<img class="hi" src="referensi/newgui/game/assets/komponen/glyph-putih/'+(muted?'speaker-mati':'speaker-suara')+'.webp" alt="" draggable="false">Suara: '+t; $('btnSnd').setAttribute('aria-label','Suara: '+t); $('btnSnd').classList.toggle('muted',muted); });
function paintRange(el){ if(el) el.style.setProperty('--p',el.value+'%'); }
let sfxVol=100; try{ const sv=parseInt(UT.Prefs.get('sfxVol',NaN),10); if(!isNaN(sv)) sfxVol=Math.max(0,Math.min(100,sv)); }catch(e){}
function setSfxVol(v){ sfxVol=Math.max(0,Math.min(100,v)); try{ UT.Prefs.set('sfxVol',sfxVol); }catch(e){} try{ if(GA&&GA.setSfxVolume) GA.setSfxVolume(sfxVol/100); }catch(e){} syncDiceSound(); }
setSfxVol(sfxVol);
window.addEventListener('ut:dice3d-ready',syncDiceSound); /* dadu 3D dimuat belakangan -> samakan suara */
UT.GameplayPause.bind({
  isPaused:()=>paused,
  setPaused:value=>{ paused=value; },
  isReadyRunning:()=>AWK.running,
  isOnlineGuest:()=>ONLINE_ROOM&&!ONLINE_HOST,
  getMode:()=>mode,
  closeHudMenu:()=>setHudMenuOpen(false),
  isNight:()=>night,
  isAutoDN:()=>autoDN,
  cycleMode:cycleMode,
  setMusicOn:setMusicOn,
  getMusicVol:()=>musicVol,
  setMusicVol:setMusicVol,
  getSfxVol:()=>sfxVol,
  setSfxVol:setSfxVol,
  paintRange:paintRange,
  onSfxCommit:()=>{ ensureAudio(); try{ if(GA) GA.play('pop'); }catch(e){} },
  clearTurnTimer:clearTurnTimer,
  startTurnTimer:startTurnTimer,
  ensureAudio:ensureAudio,
  restart:()=>startGame(mode,lastSkins),
  exitToRoom:exitToRoom,
  isPlaying:()=>document.body.classList.contains('playing'),
  isWinHidden:()=>$('win').hidden
});
$('btnAgain').addEventListener('click',()=>{ ensureAudio(); startGame(mode,lastSkins); });
$('btnToMenu').addEventListener('click',exitToRoom);

/* ---------- Loop render ---------- */
let last=performance.now();
/* ---------- Emote di atas pion (lokal + sinkron online) ---------- */
const EMOTE_OK=['\u{1F600}','\u{1F602}','\u{1F60E}','\u{1F621}','\u{1F62D}','\u{1F44D}'], EM_LIVE=[];
const EMOTE_PAWN_GAP_PX=100;
function showEmote(p,emoji){
  if(!p||!p.pawn||EMOTE_OK.indexOf(emoji)<0) return;
  const old=EM_LIVE.findIndex(e=>e.p===p); if(old>=0){ EM_LIVE[old].el.remove(); EM_LIVE.splice(old,1); }
  const el=document.createElement('div'); el.className='pawn-emote'; el.textContent=emoji; el.style.opacity='0'; document.body.appendChild(el);
  EM_LIVE.push({p:p,el:el,t0:performance.now()}); updateEmotes(performance.now());
}
function updateEmotes(now){
  if(!EM_LIVE.length) return;
  const r=$('c').getBoundingClientRect();
  for(let i=EM_LIVE.length-1;i>=0;i--){
    const e=EM_LIVE[i],age=now-e.t0;
    if(age>2400){ e.el.remove(); EM_LIVE.splice(i,1); continue; }
    const v=e.p.pawn.position.clone(); v.project(camera);
    if(v.z>1){ e.el.style.opacity='0'; continue; }
    const x=r.left+(v.x*0.5+0.5)*r.width, y=r.top+(-v.y*0.5+0.5)*r.height-EMOTE_PAWN_GAP_PX;
    const pop=Math.min(1,age/160), fade=age>2000?Math.max(0,1-(age-2000)/400):1, rise=reduce?0:Math.min(14,age/60);
    e.el.style.opacity=String(pop*fade);
    e.el.style.transform='translate('+x.toFixed(1)+'px,'+(y-rise).toFixed(1)+'px) translate(-50%,-100%) scale('+(0.6+0.4*pop).toFixed(3)+')';
  }
}
function myEmotePlayer(){
  if(ONLINE_ROOM) return mpPlayerByNet(MP_ID);
  const t=players[cur]; if(t&&!t.cpu) return t;
  return players.find(q=>!q.cpu)||null;
}
window.addEventListener('ut:emote',e=>{
  const em=e.detail&&e.detail.emoji; if(EMOTE_OK.indexOf(em)<0) return;
  const p=myEmotePlayer(); if(!p) return; e.preventDefault();
  showEmote(p,em);
  if(ONLINE_ROOM&&MP_SYNC&&MP_SYNC.sendEmote){ try{ MP_SYNC.sendEmote({playerId:MP_ID,emoji:em}).catch(()=>{}); }catch(er){} }
});
/* Chip AUTO terlihat semua pemain: status tombol Auto tiap pemain disiarkan (bukan dari snapshot host) lalu disimpan di p.autoRoll */
function mpBroadcastAutoRoll(){ try{ if(ONLINE_ROOM&&MP_SYNC&&MP_SYNC.sendAutoRoll&&MP_ID) MP_SYNC.sendAutoRoll({playerId:MP_ID,on:!!autoRoll}).catch(()=>{}); }catch(e){} }
function onMpAutoRoll(pl){ const p=mpPlayerByNet(pl&&pl.playerId); if(!p||p.networkId===MP_ID) return; p.autoRoll=!!pl.on; try{ renderChips(); }catch(e){} }
function onMpEmote(pl){ const p=mpPlayerByNet(pl&&pl.playerId); if(p&&p.networkId!==MP_ID) showEmote(p,pl.emoji); }

function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  if(TRAPS.length||TRAP_PICK) trapTick(now);
  for(let i=tweens.length-1;i>=0;i--){
    const tw=tweens[i]; tw.t+=dt;
    const k=Math.min(1,tw.t/tw.dur);
    tw.fn(tw.ease?tw.ease(k):k);
    if(k>=1){ tweens.splice(i,1); tw.res(); }
  }
  for(let i=0;i<players.length;i++){ const pw=players[i].pawn,b=pw&&pw.userData.bc; if(b){ try{
    /* karakter baru: mode jalan otomatis dari kecepatan horizontal pion (lompat/tangga/ular), idle bila diam; teleport (terlalu cepat) = idle */
    const u=pw.userData,lp=u.bcLast||(u.bcLast=pw.position.clone()),sp=dt>0?Math.hypot(pw.position.x-lp.x,pw.position.z-lp.z)/dt:0; lp.copy(pw.position);
    if(sp>0.5&&sp<14) u.bcHold=0.15; else u.bcHold=Math.max(0,(u.bcHold||0)-dt);
    const md=u.bcHold>0?(u.bcStyle==='run'?'run':'walk'):'idle'; if(md!==u.bcMode){ u.bcMode=md; b.setMode(md); }
    b.tick(dt);
    if(u.auraKey&&!u.auraOn&&pw.parent){ const A=pawnAuraCtl(); if(A){ A.set(b.root,u.auraKey,{height:u.auraH}); u.auraOn=true; } } /* aura menempel setelah pion masuk scene */
    }catch(e){ players[i].pawn.userData.bc=null; } } }
  if(PAURA) PAURA.update(dt);
  const m=1-Math.exp(-dt*10);
  cam.yaw+=(goal.yaw-cam.yaw)*m; cam.pitch+=(goal.pitch-cam.pitch)*m; cam.zoom+=(goal.zoom-cam.zoom)*m;
  let tx=CAM_BASE.x,ty=CAM_BASE.y,tz=CAM_BASE.z;
  if(camLocked()){
    tx=lockCenter.x; ty=LOCK_BOX.y; tz=lockCenter.z; /* LOCK: tetap di tengah papan, tidak ikut bidak/giliran/animasi */
  }else if(isTopDown){
    tx=0; tz=0; ty=3.5;
  }else if(!camFollowing()){
    tx=camHold.x; ty=camHold.y; tz=camHold.z; /* ANGLE ON + FOLLOW OFF: kamera diam, tidak ikut giliran/bidak */
  }else if(focus){
    tx+=focus.position.x*0.35; tz+=focus.position.z*0.35; ty+=(focus.position.y-CAM_BASE.y)*0.45;
  }
  pan.x+=(panGoal.x-pan.x)*m; pan.z+=(panGoal.z-pan.z)*m; pan.y+=(panGoal.y-pan.y)*m;
  tx+=pan.x; tz+=pan.z; ty+=pan.y;
  const f=m*0.6;
  camTarget.x+=(tx-camTarget.x)*f; camTarget.y+=(ty-camTarget.y)*f; camTarget.z+=(tz-camTarget.z)*f;
  const dist=baseDist*cam.zoom,cp=Math.cos(cam.pitch);
  camera.position.set(camTarget.x+dist*Math.sin(cam.yaw)*cp,camTarget.y+dist*Math.sin(cam.pitch),camTarget.z+dist*Math.cos(cam.yaw)*cp);
  if(QUAKE.amp>0.001&&!POV.on){ const qa=QUAKE.amp; camera.position.x+=(Math.random()-0.5)*qa; camera.position.y+=(Math.random()-0.5)*qa*0.8; camera.position.z+=(Math.random()-0.5)*qa; } /* gempa Dragon Awakening */
  camera.up.set(-Math.sin(cam.yaw),0,-Math.cos(cam.yaw)); /* setara up (0,1,0) untuk pitch<90, tetapi tidak degenerate di 90 derajat */
  camera.lookAt(camTarget); camLogUpdate(now,dist);
  /* Presisi depth: near 0.1 terlalu dekat -> permukaan nyaris sebidang (rumput/air/pulau) berkedip (z-fighting) saat kamera bergerak. near ikut jarak kamera; mode POV tetap near kecil. */
  if(!POV.on){ const nn=clamp(dist*0.15,0.4,2); /* near besar (hingga 5) memotong aura/efek yang dekat kamera = aura pion sendiri (yang diikuti kamera) tampak tidak lengkap */ if(Math.abs(camera.near-nn)>0.02){ camera.near=nn; camera.updateProjectionMatrix(); } }
  { const pw=povActive()?povPawn():null; if(pw) povUpdate(pw,dt,now); else povRelease(); } /* POV Bidak menimpa posisi/arah kamera di atas */
  skyDome.position.copy(camera.position);
  if(!reduce){
    clouds.forEach(c=>{ c.g.position.x+=c.speed*dt; if(c.g.position.x>24) c.g.position.x=-24; });
    Object.keys(SNAKEINFO).forEach(k=>{
      const S=SNAKEINFO[k]; if(S.busy) return;
      const ph=now*0.002+S.phase;
      S.head.position.y=S.rest.y+Math.sin(ph)*0.035;
      S.head.rotation.x=Math.sin(ph*0.8)*0.06;
      S.tongue.scale.z=0.55+0.45*Math.abs(Math.sin(now*0.007+S.phase));
    });
    if(snow){
      const a=snow.arr;
      for(let i=0;i<snow.cnt;i++){
        a[i*3+1]-=dt*(0.9+(i%5)*0.15); a[i*3]+=Math.sin(now*0.0007+i)*dt*0.25;
        if(a[i*3+1]<0) a[i*3+1]=14;
      }
      snow.pts.geometry.attributes.position.needsUpdate=true;
    }
  }
  updatePortal(dt,now); updateArena(dt,now); updateMountain(dt,now);
  { const D=dragon.userData,fy=(FLY.on&&dragon.visible)?1:0,wf=0.006+0.003*fy,wr=Math.sin(now*wf)*(0.55+0.4*fy),wo=Math.sin(now*wf-0.7)*(0.3+0.25*fy); /* terbang: kepak lebih cepat & lebar */
    D.wR.rotation.z=wr; D.wL.rotation.z=-wr; D.wRo.rotation.z=wo; D.wLo.rotation.z=-wo; /* ujung sayap melentur sedikit tertinggal */
    D.tail.rotation.y=Math.sin(now*0.0022)*(0.28+0.2*fy); D.rig.rotation.x=Math.sin(now*wf)*0.03;
    D.head.rotation.x=Math.sin(now*0.0027)*0.05-0.32*(D.open||0); D.head.rotation.y=Math.sin(now*0.0013)*0.12; D.jaw.rotation.x=0.04+0.5*(D.open||0);
    if(FLY.on) dragonFlight(dt,now); else{ dragon.position.y=D.y0+Math.sin(now*0.003)*0.18+D.dy; dragon.rotation.y=Math.sin(now*0.0015)*0.2+D.shk; dragon.rotation.z=0; }
    try{ dragonFade(dt); }catch(e){ console.error(e); }
    try{ updateDragonFire(dt,now); }catch(e){ console.error(e); } }
  if(FBK) FBK.updateTurnMarkers(players,now,dt);
  try{ updateEmotes(now); }catch(er){}
  if(FX) FX.updateConfetti(dt);
  const watch=[camTarget];
  if(focus) watch.push(focus.position);
  players.forEach(p=>watch.push(p.pawn.position));
  updateMobs(dt,now/1000);
  updateFX(dt,now/1000); updateRoam(dt,now/1000); updateLife(dt,now/1000); tickAuto(dt);
  updateFades(dt,watch); updateGhastFade(dt,watch);
  renderer.render(scene,camera);
}

/* ---------- Konfigurasi dari lobby ---------- */
function readLobbyConfig(){
  const q=new URLSearchParams(location.search);
  let ss=null;
  try{ ss=JSON.parse(sessionStorage.getItem('ut-config')||'null'); }catch(e){ ss=null; }
  if(!ss||typeof ss!=='object') ss=null;
  const validSkin=k=>typeof k==='string'&&(PLAYER_DEFS.some(d=>d.key===k)||PNG_DEFS.some(d=>d.key===k));
  const validMode=m=>m==='cpu'||m==='2'||m==='3'||m==='4';
  const pickParam=(name,isValid)=>{ const v=q.get(name); return v!==null&&isValid(v)?v:null; };
  const themeKeys=THEMES.map(t=>t.key),diceKeys=DICE.map(d=>d.key);
  let mode=pickParam('mode',validMode);
  if(!mode&&ss&&validMode(ss.mode)) mode=ss.mode;
  let skins=[];
  const rawSkins=q.get('skins')!==null?q.get('skins'):(ss&&Array.isArray(ss.skins)?ss.skins.join(','):null);
  if(rawSkins) String(rawSkins).split(',').forEach(k=>{ k=String(k).trim(); if(validSkin(k)&&skins.indexOf(k)<0) skins.push(k); });
  if(!mode) mode='cpu';
  if(mode==='cpu'){
    if(!skins.length) skins=['steve'];
    skins=[skins[0],'villager']; /* Computer = Villager (4.1.14.10) */
  }else{
    const n=+mode;
    if(skins.length<n) skins=PLAYER_DEFS.slice(0,n).map(d=>d.key);
    else skins=skins.slice(0,n);
  }
  let theme=pickParam('theme',k=>themeKeys.indexOf(k)>-1);
  if(!theme&&ss&&themeKeys.indexOf(ss.theme)>-1) theme=ss.theme;
  let dice=pickParam('dice',k=>diceKeys.indexOf(k)>-1);
  if(!dice&&ss&&diceKeys.indexOf(ss.dice)>-1) dice=ss.dice;
  let night=null;
  if(q.get('night')==='0'||q.get('night')==='1') night=q.get('night');
  else if(ss&&(ss.night==='0'||ss.night==='1')) night=ss.night;
  return {mode,skins,theme,dice,night};
}
const CFG=readLobbyConfig();
if(CFG.dice) applyDice(CFG.dice);
if(CFG.night!==null) night=CFG.night==='1';
const saved=equippedGameKey('theme');
buildWorld(CFG.theme||saved||THEMES[0].key);
lastSkins=CFG.skins.slice();
/* Urutan audio Gameplay: init audio -> BGM -> SFX boleh. Browser (Android) hanya menganggap pointerup/touchend/click/keydown sebagai aktivasi untuk sentuhan,
   jadi unlock diulang pada gesture valid sampai play() BGM berhasil. Fase capture: berjalan SEBELUM handler tombol (mis. Roll) sehingga SFX tidak mendahului BGM. */
ensureMusic();
(function(){
  const EV=['pointerdown','pointerup','touchend','keydown','click']; let done=false;
  const finish=()=>{ if(done) return; done=true; EV.forEach(e=>document.removeEventListener(e,unlock,true)); };
  function unlock(){
    if(done) return;
    ensureAudio();
    const r=playMusic();                 /* BGM dicoba lebih dulu (null bila dimatikan/tidak didukung) */
    if(GA&&GA.setReady) GA.setReady(true); /* baru setelah itu SFX gameplay boleh bunyi; gagal BGM tidak menahan SFX/gameplay */
    if(r&&r.then) r.then(finish,()=>{}); else finish();
  }
  EV.forEach(e=>document.addEventListener(e,unlock,true));
})();
startGame(CFG.mode,CFG.skins.slice());
if(ONLINE_ROOM){addEventListener('ut:multiplayer-game-sync-ready',initMultiplayerBridge,{once:true});if(UT.Multiplayer&&UT.Multiplayer.GameSync)initMultiplayerBridge();}
/*TEST-HOOK*/
requestAnimationFrame(frame);
})();
