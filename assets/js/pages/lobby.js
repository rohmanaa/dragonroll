/* lobby.js — dipindah dari <script> inline (lobby.html). */
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
const PD=window.PlayerData,AR=window.ItemArt;
const SET=()=>PD.settings();
const buzz=()=>{try{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)}catch(e){}};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}

/* ---------- data: SEMUA dari PlayerData (single source of truth); saldo "—" sampai server membalas ---------- */
let SRV_XP=0;
function lvInfo(xp){let L=1,left=Math.max(0,Math.floor(+xp)||0);while(left>=400+100*(L-1)&&L<999){left-=400+100*(L-1);L++}return{level:L,xpIn:left,xpMax:400+100*(L-1)}}
function renderAvatar(){const fb=()=>(AR&&(AR.face(PD.equippedId('skin'))||AR.face('skin.steve')))||'';if(UT.CharacterFace)UT.CharacterFace.mount($('#ava'),fb);else $('#ava').innerHTML=fb()}
function applyFrame(){const f=window.ItemCatalog.byId(PD.equippedId('frame')),im=$('#avf');if(im){im.src=(f&&f.image)||'data/frame/frame-default.webp';if(window.FrameFX)FrameFX.upgrade(im)}}
function setNum(id,txt){const e=$(id);if(!e||e.textContent===txt)return;const had=e.textContent&&e.textContent!=='—';e.textContent=txt;if(had){e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')}}
function renderCurrency(){const ok=PD.walletReady();setNum('#v-em',ok?fmt(PD.gems()):'—');setNum('#v-co',ok?fmt(PD.coins()):'—')}
function renderName(){const n=(PD.profile()&&PD.profile().name)||'Pemain';$('#nm').textContent=n;const h=$('#ht-name');if(h)h.textContent=n}
function renderXp(){const i=lvInfo(Math.max(PD.xp?PD.xp():0,SRV_XP)),pct=Math.min(100,i.xpIn/i.xpMax*100);
 $('#lvnum').textContent=i.level;$('#xptxt').textContent=fmt(i.xpIn)+' / '+fmt(i.xpMax);$('#xpfill').style.width=pct+'%';
 $('#xpnote').textContent='Butuh '+fmt(i.xpMax-i.xpIn)+' XP lagi ke Level '+Math.min(999,i.level+1);
 const l=$('#ht-lv'),p=$('#ht-pct'),f=$('#ht-fill');if(l)l.textContent=i.level;if(p)p.textContent=pct.toFixed(1)+'%';if(f)f.setAttribute('width',Math.max(0,326*pct/100))}
/* event: UI ikut berubah tanpa reload halaman */
UT.Events.on('currencyChanged',()=>{renderCurrency();renderXp()});
if(PD.subscribe)PD.subscribe(()=>{renderName();renderXp();renderCurrency()});
UT.Events.on('skinChanged',()=>{renderAvatar();buildHero()});
UT.Events.on('frameChanged',applyFrame);

/* ---------- navigasi (peta ACT) ---------- */
const ACT={profil:'profile.html',karakter:'karakter.html',frame:'frame.html',dadu:'dadu.html',efek:'efek.html',powerup:'powerup.html',pet:'pet.html',leaderboard:'leaderboard.html',toko:'shop.html',beliCoin:'shop.html?coin=1',teman:'friendship.html',hadiahMisi:'hadiah-misi.html',tambang:'tambang.html?from=lobby.html',settings:'settings.html',mail:'mail.html?from=lobby.html',mulai:'mode.html'};
/* halaman GUI baru yang datanya belum disambung ke server: tetap "segera hadir" */
const SOON={guild:'Guild segera hadir',babi:'Celengan segera hadir',hadiahGratis:'Hadiah gratis segera hadir',chest:'Chest segera hadir'};
function go(act){if(SOON[act]){toast(SOON[act]);return}const url=ACT[act];if(!url)return;const f=$('#fade');f.classList.add('on');setTimeout(()=>{location.href=url},330)}
document.querySelectorAll('[data-act]').forEach(el=>el.addEventListener('click',()=>{buzz();go(el.dataset.act)}));
addEventListener('pageshow',e=>{if(e.persisted)$('#fade').classList.remove('on')});

/* ================= 3D: karakter, bayangan, aura, dan animasi lobby main ================= */
const cv=$('#gl3d'),isLow=()=>document.documentElement.getAttribute('data-graphics')==='low';
let G3=false,renderer=null,scene,cam,hero,bc=null,bcW=null,AUR=null,auraQ=false,contact=null;
try{
 if(typeof THREE!=='undefined'&&UT.BlockyCharacter&&UT.FloatingIsland&&cv){
  renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
  renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0xa8ecff,22,90);
  const amb=new THREE.AmbientLight(0xdff6ff,.42),hemi=new THREE.HemisphereLight(0xb4eeff,0x6a9a50,.5);
  scene.add(amb,hemi);
  const sun=new THREE.DirectionalLight(0xffd88a,1.05);
  sun.position.set(16,20,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.03;
  Object.assign(sun.shadow.camera,{left:-24,right:24,top:16,bottom:-14,near:1,far:60});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0008;scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,40),new THREE.ShadowMaterial({opacity:.34,depthWrite:false}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,-2.62,0);floor.receiveShadow=true;scene.add(floor);
  hero=new THREE.Group();hero.position.set(0,-2.60,0);hero.scale.setScalar(.9);hero.rotation.y=-.3;scene.add(hero);
  contact=UT.FloatingIsland.contactShadow(THREE,3.6,2.2,.9);
  contact.position.set(0,-2.62,.12);scene.add(contact);
  cam=new THREE.PerspectiveCamera(36,1,.1,250);
  cam.position.set(0,1.5,26);cam.lookAt(0,3,0);
  const lamp=new THREE.PointLight(0xffb866,0,18,2);lamp.position.set(-4.5,2.25,6.5);scene.add(lamp);
  const moods={
   day:{amb:[0xdff6ff,.42],hemi:[0xb4eeff,0x6a9a50,.5],sun:[0xffd88a,1.05],fog:0xa8ecff,lamp:0},
   night:{amb:[0x6a82d8,.36],hemi:[0x5676c8,0x1e2e52,.46],sun:[0xa9c2ff,.7],fog:0x142a66,lamp:1.9}
  };
  const lightState={amb:new THREE.Color(),hemi:new THREE.Color(),ground:new THREE.Color(),sun:new THREE.Color(),fog:new THREE.Color()};
  const lightIntensity={amb:0,hemi:0,sun:0,lamp:0};
  const moodColor=new THREE.Color();
  let moodTarget=null,moodTime=0;
  function applyMood(){
   amb.color.copy(lightState.amb);amb.intensity=lightIntensity.amb;
   hemi.color.copy(lightState.hemi);hemi.groundColor.copy(lightState.ground);hemi.intensity=lightIntensity.hemi;
   sun.color.copy(lightState.sun);sun.intensity=lightIntensity.sun;
   scene.fog.color.copy(lightState.fog);lamp.intensity=lightIntensity.lamp;
  }
  function setMood(name,instant){
   const mood=moods[name]||moods.day;
   moodTarget={colors:{amb:mood.amb[0],hemi:mood.hemi[0],ground:mood.hemi[1],sun:mood.sun[0],fog:mood.fog},
    levels:{amb:mood.amb[1],hemi:mood.hemi[2],sun:mood.sun[1],lamp:mood.lamp}};
   if(instant){
    Object.keys(moodTarget.colors).forEach(key=>lightState[key].set(moodTarget.colors[key]));
    Object.assign(lightIntensity,moodTarget.levels);applyMood();moodTime=0;
   }else moodTime=1.8;
  }
  function stepMood(dt){
   if(moodTime<=0||!moodTarget)return;
   moodTime-=dt;const alpha=1-Math.exp(-dt*5);
   Object.keys(moodTarget.colors).forEach(key=>lightState[key].lerp(moodColor.set(moodTarget.colors[key]),alpha));
   Object.keys(moodTarget.levels).forEach(key=>{lightIntensity[key]+=(moodTarget.levels[key]-lightIntensity[key])*alpha});
   applyMood();
  }
  setMood(window.UT.Ambience?window.UT.Ambience.resolved():'day',true);
  if(window.UT.Ambience)window.UT.Ambience.on(detail=>setMood(detail.resolved,false));
  G3=true;
 }
}catch(e){console.error('[lobby] gagal membuat adegan 3D',e);G3=false;renderer=null}
function applyLights(){
 if(!renderer)return;
 const highQuality=!isLow();
 renderer.shadowMap.enabled=highQuality;
}
addEventListener('ut-ambience',applyLights);applyLights();
function fit3d(){
 if(!G3)return;
 const dpr=window.devicePixelRatio||1;
 renderer.setPixelRatio(isLow()?1:Math.min(dpr,1.25));
 renderer.setSize(innerWidth,innerHeight,false);
 cam.aspect=innerWidth/innerHeight;
 const aspect=cam.aspect,baseFov=36;
 cam.fov=aspect<16/9?2*Math.atan(Math.tan(baseFov*Math.PI/360)*(16/9)/aspect)*180/Math.PI:baseFov;
 cam.updateProjectionMatrix();
 const stage=$('#stage').getBoundingClientRect();
 cam.setViewOffset(innerWidth,innerHeight,Math.round(innerWidth/2-(stage.left+stage.width/2)),0,innerWidth,innerHeight);
 renderer.render(scene,cam);
}
function buildHero(){
 if(!G3)return;
 if(bcW)hero.remove(bcW);
 bc=UT.BlockyCharacter.create(THREE);bc.loadFromPlayer();bc.tick(.016);
 bc.root.traverse(o=>{if(o.isMesh)o.receiveShadow=false});
 bcW=new THREE.Group();bcW.scale.setScalar(4.8);bcW.add(bc.root);hero.add(bcW);auraQ=true;
}
function syncAura(){try{if(!(UT.AuraView&&UT.AuraFX))return;if(!AUR)AUR=UT.AuraView.create(scene,cam);scene.updateMatrixWorld(true);AUR.only(bc.root,UT.AuraView.equippedKey(),{facing:-hero.rotation.y})}catch(e){console.error('[lobby] gagal memasang efek aura',e)}}
buildHero();
PD.subscribe&&PD.subscribe(r=>{if(r==='equip'||r==='pageshow'||r==='storage')buildHero();else if(r==='server-appearance'||r==='server-outfits'){renderAvatar();buildHero()}});
addEventListener('pageshow',e=>{if(e.persisted)buildHero()});
const lobbyActs=[
 [[0,()=>bc.setMode('run')],[1.5,()=>bc.act('flip')],[2.5,()=>bc.setMode('idle')]],
 [[0,()=>bc.setMode('run')],[1.3,()=>bc.jump()],[2.2,()=>bc.act('roll')],[3.1,()=>bc.setMode('idle')]],
 [[0,()=>bc.act('backflip')]],[[0,()=>bc.act('spin')]],[[0,()=>bc.act('wave')]],[[0,()=>bc.act('cheer')]]
];
const calmMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOBBY_MOTION_SCALE=.72;
let currentAct=null,actTime=0,actIndex=0,idleDelay=7,lastAct=-1;
function lobbyBusy(){return !!currentAct||!!(bc&&(bc.acting||bc.airborne))}
function startLobbyAct(){
 if(!bc)return;
 let index;
 do{index=Math.floor(Math.random()*lobbyActs.length)}while(index===lastAct&&lobbyActs.length>1);
 lastAct=index;currentAct=lobbyActs[index];actTime=0;actIndex=0;idleDelay=9+Math.random()*6;
}
function stepLobby(dt){
 if(currentAct){
  actTime+=dt;
  while(actIndex<currentAct.length&&actTime>=currentAct[actIndex][0])currentAct[actIndex++][1]();
  if(actIndex>=currentAct.length&&!bc.acting&&!bc.airborne)currentAct=null;
  return;
 }
 if(calmMotion||document.hidden||lobbyBusy())return;
 idleDelay-=dt;if(idleDelay<=0)startLobbyAct();
}
$('#stage').addEventListener('pointerdown',event=>{
 if(event.target!==$('#stage')||lobbyBusy())return;
 const rect=$('#stage').getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width;
 if(x>.36&&x<.64){if(Math.random()<.25)bc.jump();else startLobbyAct();buzz()}
});
function fit(){const s=Math.min(innerWidth/1920,innerHeight/1080),st=$('#stage');st.style.transform='scale('+s+')';fit3d()}
if(G3){
 let lastFrame=null,frameDebt=0;
 document.addEventListener('visibilitychange',()=>{lastFrame=null;frameDebt=0});
 (function loop(ts){
  requestAnimationFrame(loop);
  if(document.hidden){lastFrame=ts;frameDebt=0;return}
  const frameInterval=1000/(isLow()?30:60);
  if(lastFrame===null){lastFrame=ts;frameDebt=frameInterval}
  else{frameDebt+=Math.min(ts-lastFrame,50);lastFrame=ts}
  if(frameDebt<frameInterval)return;
  const dt=Math.min(frameDebt/1000,.05);frameDebt%=frameInterval;
  const motionDt=dt*LOBBY_MOTION_SCALE;
  stepMood(dt);bc.tick(motionDt);stepLobby(motionDt);
  if(auraQ){auraQ=false;syncAura()}if(AUR)AUR.update(motionDt);renderer.render(scene,cam);
 })(performance.now());
}
addEventListener('resize',fit);addEventListener('ut-ambience',()=>{applyLights();fit()});fit();

/* ---------- init + sinkron server ---------- */
renderAvatar();if(UT.CharacterFace)UT.CharacterFace.watch(renderAvatar);applyFrame();renderName();renderCurrency();renderXp();
const SRV=!!(PD.serverMode&&PD.serverMode());
/* B5: akun login + flag -> saldo & inventory dari server */
if(SRV&&UT.WalletService&&UT.WalletService.get())UT.WalletService.get().refresh();
/* Karakter di lobi = tampilan aktif akun di SERVER, tanpa harus membuka halaman Karakter dulu (maks 1x/20 dtk). */
(function(){const A=PD.serverMode&&PD.serverMode()&&UT.AppearanceService&&UT.AppearanceService.get();if(A)A.refreshThrottled().catch(()=>{})})();
/* login harian + XP server (tanpa membuat sesi baru; gagal/offline -> tetap data lokal) */
const loadProgress=()=>import('../../../assets/js/multiplayer/progress-service.js').then(()=>UT.Multiplayer.Progress);
loadProgress().then(P=>P.dailyLogin&&P.dailyLogin()).catch(()=>{});
const pullXp=()=>loadProgress().then(P=>P.getMyProfile()).then(pr=>{const x=pr&&+pr.xp;if(x>0&&Math.floor(x)!==SRV_XP){SRV_XP=Math.floor(x);renderXp()}return {ok:true}}).catch(()=>({ok:false}));
pullXp();
/* titik merah Teman = ada permintaan pertemanan masuk */
const pullFriends=()=>import('../../../assets/js/multiplayer/room-service.js').then(()=>UT.Multiplayer.RoomService.listRequests()).then(r=>{const d=$('#friendDot');if(d)d.hidden=!(r&&r.length);return {ok:true}}).catch(()=>({ok:false}));
pullFriends();
/* titik merah Mail = ada surat belum dibaca / hadiah belum diklaim (RPC ringkas, tidak membuat surat sambutan) */
const pullMail=()=>{const M=UT.MailService&&UT.MailService.get();return M?M.summary().then(r=>{const d=$('#mailDot');if(d)d.hidden=!(r&&r.ok&&(r.unread||r.pending));return {ok:!!(r&&r.ok)}}):{ok:true}};
pullMail();

/* ---------- LIVE: data tetap mutakhir tanpa refresh (live-sync.js: timer ~20 dtk saat tab terlihat + saat tab aktif lagi/online) ---------- */
if(SRV&&UT.LiveSync){const LS=UT.LiveSync;
 LS.add('wallet',()=>{const W=UT.WalletService&&UT.WalletService.get();return W?W.refresh():{ok:true}});
 LS.add('xp',pullXp);
 LS.add('appearance',()=>{const A=UT.AppearanceService&&UT.AppearanceService.get();return A?A.refreshThrottled().then(()=>({ok:true}),()=>({ok:false})):{ok:true}},{minGap:20000});
 LS.add('friends',pullFriends,{minGap:40000});
 LS.add('mail',pullMail,{minGap:40000});
 LS.start({interval:20000});
}
