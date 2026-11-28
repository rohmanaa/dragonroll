/* lobby.js — dipindah dari <script> inline (lobby.html). Tahap 1 SPA: dibungkus modul UT.PageModule ('lobby').
   Halaman mandiri otomatis mount; unmount() melepas timer, rAF, listener, langganan, LiveSync, dan renderer. */
UT.PageModule.define('lobby',function(env){
const{setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,addEventListener,removeEventListener}=env;
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('id-ID');
const PD=window.PlayerData,AR=window.ItemArt;
{const RB=window.UT&&UT.Hud&&UT.Hud.get&&UT.Hud.get('resource-bar');if(RB)RB.hydrate(document)}  /* Emerald/Coin: komponen bersama (idempoten) */
const SET=()=>PD.settings();
const buzz=()=>{try{if(SET().vibration&&navigator.vibrate)navigator.vibrate(15)}catch(e){}};
let tt;function toast(m){const md=$('#chestMd'),t=(md&&!md.hidden&&$('#cm-toast'))||$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}

/* ---------- data: SEMUA dari PlayerData (single source of truth); saldo "—" sampai server membalas ---------- */
let SRV_XP=0;
function lvInfo(xp){let L=1,left=Math.max(0,Math.floor(+xp)||0);while(left>=400+100*(L-1)&&L<999){left-=400+100*(L-1);L++}return{level:L,xpIn:left,xpMax:400+100*(L-1)}}
function renderAvatar(){const fb=()=>(AR&&(AR.face(PD.equippedId('skin'))||AR.face('skin.steve')))||'';if(UT.CharacterFace)UT.CharacterFace.mount($('#ava'),fb);else $('#ava').innerHTML=fb()}
function applyFrame(){const f=window.ItemCatalog.byId(PD.equippedId('frame')),im=$('#avf');if(im){im.src=(f&&f.image)||'data/frame/frame-default.webp';if(window.FrameFX)FrameFX.upgrade(im)}}
function setNum(id,txt){const e=$(id);if(!e||e.textContent===txt)return;const had=e.textContent&&e.textContent!=='—';e.textContent=txt;if(had){e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')}}
function renderCurrency(){const ok=PD.walletReady();setNum('#v-em',ok?fmt(PD.gems()):'—');setNum('#v-co',ok?fmt(PD.coins()):'—')}
function renderName(){const n=(PD.profile()&&PD.profile().name)||'Pemain';const h=$('#ht-name');if(h)h.textContent=n}
function renderXp(){const i=lvInfo(Math.max(PD.xp?PD.xp():0,SRV_XP)),pct=Math.min(100,i.xpIn/i.xpMax*100);
 const lv=$('#lvnum');lv.textContent=i.level;lv.classList.toggle('w3',String(i.level).length>=3);
 const l=$('#ht-lv'),p=$('#ht-pct'),f=$('#ht-fill');if(l)l.textContent=i.level;if(p)p.textContent=pct.toFixed(1)+'%';if(f)f.setAttribute('width',Math.max(0,326*pct/100))}
/* event: UI ikut berubah tanpa reload halaman */
env.own(UT.Events.on('currencyChanged',()=>{renderCurrency();renderXp()}));
if(PD.subscribe)env.own(PD.subscribe(()=>{renderName();renderXp();renderCurrency()}));
env.own(UT.Events.on('skinChanged',()=>{renderAvatar();buildHero()}));
env.own(UT.Events.on('frameChanged',applyFrame));

/* ---------- navigasi (peta ACT) ---------- */
const ACT={profil:'profile.html',karakter:'karakter.html',inventory:'inventory.html',leaderboard:'leaderboard.html',toko:'shop.html',beliCoin:'shop.html?coin=1',teman:'friendship.html',hadiahMisi:'hadiah-misi.html',dadu:'dadu.html',efek:'efek.html',tambang:'tambang.html?from=lobby.html',settings:'settings.html',mail:'mail.html?from=lobby.html',pet:'pet.html',mulai:'mode.html'};
/* halaman GUI baru yang datanya belum disambung ke server: tetap "segera hadir" */
const SOON={guild:'Guild segera hadir',mancing:'Mancing masih terkunci'};
/* Profil · Teman · Pesan · Pengaturan = SATU halaman hub (profile.html?tab=...), bukan modal; tombol Kembali di hub mengarah balik ke Lobby (&from=lobby.html). */
const HUB_TAB={profil:'profil',teman:'teman',mail:'pesan',settings:'setelan'};
function navTo(url){if(!/^[a-z0-9_-]+\.html(\?[^#]*)?(#.*)?$/i.test(url)||/^(play|index|splash)\.html/i.test(url))return;
 if(UT.Spa&&UT.Spa.go){UT.Spa.go(url);return}
 const f=$('#fade');if(f)f.classList.add('on');setTimeout(()=>{location.href=url},330)}
function go(act){if(act==='chest'){openChest();return}if(SOON[act]){toast(SOON[act]);return}if(HUB_TAB[act]){navTo('profile.html?tab='+HUB_TAB[act]+'&from=lobby.html');return}const url=ACT[act];if(!url)return;
 if(UT.Spa&&UT.Spa.go){UT.Spa.go(url);return}  /* di shell (play.html): pindah rute tanpa muat ulang; layar memuat milik shell */
 const f=$('#fade');f.classList.add('on');setTimeout(()=>{location.href=url},330)}
document.querySelectorAll('[data-act]').forEach(el=>el.addEventListener('click',()=>{buzz();go(el.dataset.act)}));
addEventListener('pageshow',e=>{if(e.persisted)$('#fade').classList.remove('on')});
/* grup lipat (Tambang, Mancing, Ranking): tombol < menutup/membuka */
{const g=$('#grp'),t=$('#grpt');if(g&&t)t.addEventListener('click',()=>{buzz();const shut=g.classList.toggle('shut');t.setAttribute('aria-expanded',String(!shut));t.setAttribute('aria-label',shut?'Buka menu':'Tutup menu')})}

/* ================= 3D: karakter, bayangan, aura, dan animasi lobby main ================= */
const cv=$('#gl3d'),isLow=()=>document.documentElement.getAttribute('data-graphics')==='low';
let G3=false,renderer=null,scene,cam,hero,bc=null,bcW=null,AUR=null,auraQ=false,contact=null,sunL=null,shLast=-1;
/* tingkat bayangan mengikuti Pengaturan > Grafik: Rendah/Normal = tanpa peta bayangan (cukup bayangan semu di kaki); Tinggi 1024; Ultra 2048 */
function shTier(){const g=document.documentElement.getAttribute('data-graphics');return g==='ultra'?2048:g==='high'?1024:0}
try{
 if(typeof THREE!=='undefined'&&UT.BlockyCharacter&&UT.FloatingIsland&&cv){
  renderer=UT.SharedGL.acquire('lobby',{canvas:cv,shadows:true}).renderer;  /* satu renderer + satu kanvas untuk seluruh sesi (state direset tiap acquire) */
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0xa8ecff,22,90);
  const amb=new THREE.AmbientLight(0xdff6ff,.42),hemi=new THREE.HemisphereLight(0xb4eeff,0x6a9a50,.5);
  scene.add(amb,hemi);
  const sun=new THREE.DirectionalLight(0xffd88a,1.05);
  sun.position.set(16,20,10);sun.castShadow=shTier()>0;sun.shadow.mapSize.set(shTier()||1024,shTier()||1024);sunL=sun;sun.shadow.normalBias=.03;
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
  if(window.UT.Ambience)env.own(window.UT.Ambience.on(detail=>setMood(detail.resolved,false)));
  G3=true;
 }
}catch(e){console.error('[lobby] gagal membuat adegan 3D',e);G3=false;try{UT.SharedGL.release('lobby')}catch(_){}renderer=null}
/* unmount: buang geometri/material/tekstur adegan, lepas renderer bersama (renderer TIDAK dibuang; dipakai halaman berikutnya) */
env.own(()=>{try{if(scene)scene.traverse(o=>{if(o.geometry)o.geometry.dispose();const m=o.material;(Array.isArray(m)?m:m?[m]:[]).forEach(x=>{if(x.map)x.map.dispose();x.dispose()})});if(AUR&&AUR.clearAll)AUR.clearAll()}catch(e){console.error('[lobby] dispose gagal',e)}try{UT.SharedGL.release('lobby')}catch(e){}renderer=null;G3=false});
function applyLights(){
 if(!renderer)return;
 const s=shTier();if(s===shLast)return;shLast=s;
 renderer.shadowMap.enabled=s>0;
 if(sunL){sunL.castShadow=s>0;if(s>0){sunL.shadow.mapSize.set(s,s);if(sunL.shadow.map){sunL.shadow.map.dispose();sunL.shadow.map=null}}}
 if(scene)scene.traverse(o=>{const m=o.material;(Array.isArray(m)?m:m?[m]:[]).forEach(x=>{x.needsUpdate=true})});
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
const unsubHero=PD.subscribe&&PD.subscribe(r=>{if(r==='equip'||r==='pageshow'||r==='storage')buildHero();else if(r==='server-appearance'||r==='server-outfits'){renderAvatar();buildHero()}});env.own(unsubHero);
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
function fit(){const s=Math.min(innerWidth/1920,innerHeight/1080),st=$('#stage');st.style.transform='scale('+s+')';document.documentElement.style.setProperty('--ls',s);fit3d()}
if(G3){
 let lastFrame=null,frameDebt=0;
 env.on(document,'visibilitychange',()=>{lastFrame=null;frameDebt=0});
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
renderAvatar();if(UT.CharacterFace)env.own(UT.CharacterFace.watch(renderAvatar));applyFrame();renderName();renderCurrency();renderXp();
const SRV=!!(PD.serverMode&&PD.serverMode());
/* B5: akun login + flag -> saldo & inventory dari server */
if(SRV&&UT.WalletService&&UT.WalletService.get())UT.WalletService.get().refresh();
/* Karakter di lobi = tampilan aktif akun di SERVER, tanpa harus membuka halaman Karakter dulu (maks 1x/20 dtk). */
(function(){const A=PD.serverMode&&PD.serverMode()&&UT.AppearanceService&&UT.AppearanceService.get();if(A)A.refreshThrottled().catch(()=>{})})();
/* login harian + XP server (tanpa membuat sesi baru; gagal/offline -> tetap data lokal) */
const loadProgress=()=>import('../../../src/multiplayer/progress-service.js').then(()=>UT.Multiplayer.Progress);
loadProgress().then(P=>{if(env.disposed)return;return P.dailyLogin&&P.dailyLogin()}).catch(()=>{});
/* ID pemain di bawah nama (format sama dengan halaman Profil: # + 8 huruf pertama user id); tanpa sesi login -> kosong & tersembunyi */
import('../../../src/multiplayer/client.js').then(()=>UT.Multiplayer.getClient()).then(c=>c.auth.getSession()).then(({data})=>{
 if(env.disposed||!data||!data.session)return;const e=$('#ht-id');if(e)e.textContent='ID #'+data.session.user.id.slice(0,8).toUpperCase()}).catch(()=>{});
/* lencana merah berangka (aset lencana-notifikasi-merah-segi-delapan): tampil hanya bila n>0; angka >99 jadi 99+ */
function setBadge(id,n){const el=$('#'+id);if(!el)return;n=Math.max(0,Math.floor(+n)||0);el.hidden=!n;if(!n)return;
 const t=n>99?'99+':String(n);el.querySelector('b').textContent=t;el.classList.toggle('w2',t.length===2);el.classList.toggle('w3',t.length>=3)}
/* Misi & Hadiah = login harian siap klaim + misi siap klaim + bonus misi + pencapaian yang punya bintang belum diklaim (hitungan sama dengan tab di halaman Misi & Hadiah) */
/* lencana di tombol profil = surat berhadiah belum diklaim + permintaan teman masuk (Pesan & Teman kini ada di dalam Profil) */
const PN={mail:0,fr:0};const paintProf=()=>setBadge('profDot',PN.mail+PN.fr);
const QN={login:0,misi:0,ach:0};
const paintQuestBadge=()=>setBadge('questDot',QN.login+QN.misi+QN.ach);
const pullXp=()=>loadProgress().then(P=>P.getMyProfile()).then(pr=>{if(env.disposed)return {ok:false};const x=pr&&+pr.xp;if(x>0&&Math.floor(x)!==SRV_XP){SRV_XP=Math.floor(x);renderXp()}
 try{const AC=UT.Achievement;if(AC&&pr&&pr.exists!==false){QN.ach=AC.info(pr).filter(a=>a.pend>0).length;paintQuestBadge()}}catch(_){}
 return {ok:true}}).catch(()=>({ok:false}));
pullXp();
const pullQuest=()=>{const W=UT.WalletService&&UT.WalletService.get();if(!SRV||!W)return {ok:true};
 return Promise.all([W.dailyGet?W.dailyGet():null,W.questGet?W.questGet():null]).then(([d,q])=>{
  if(env.disposed)return {ok:false};
  if(d&&d.ok)QN.login=(!d.claimed_today&&(+d.claimed||0)<30)?1:0;
  if(q&&Array.isArray(q.quests))QN.misi=q.quests.filter(x=>x.status==='ready').length+((q.bonus&&q.bonus.status==='ready')?1:0);
  paintQuestBadge();return {ok:true}}).catch(()=>({ok:false}))};
pullQuest();
/* titik merah Teman = ada permintaan pertemanan masuk */
const pullFriends=()=>import('../../../src/multiplayer/room-service.js').then(()=>UT.Multiplayer.RoomService.listRequests()).then(r=>{if(env.disposed)return {ok:false};PN.fr=(r&&r.length)||0;paintProf();return {ok:true}}).catch(()=>({ok:false}));
pullFriends();
/* lencana Pesan = jumlah surat berisi hadiah yang belum diklaim (RPC ringkas, tidak membuat surat sambutan) */
const pullMail=()=>{const M=UT.MailService&&UT.MailService.get();return M?M.summary().then(r=>{if(env.disposed)return {ok:false};if(r&&r.ok){PN.mail=Math.max(0,+r.pending||0);paintProf()}return {ok:!!(r&&r.ok)}}):{ok:true}};
pullMail();
/* ---------- Chest: tombol di Lobby (kiri Inventory) = modal TIMELINE progres game hari ini (Kayu -> Silver -> Gold).
   Tiap titik punya syarat jumlah game (server); bila tercapai muncul tombol KLAIM kecil. Chest hasil klaim MASUK INVENTORY (tab Chest), dibuka dari sana.
   Lencana tombol = jumlah chest harian siap klaim. ---------- */
const CIC='assets/images/ui/',CK={wood:{nm:'Kayu',im:'chest-packs/peti-kayu'},silver:{nm:'Silver',im:'chest-packs/peti-perak'},gold:{nm:'Gold',im:'chest-packs/peti-emas'}};
const CWM={'jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','sudah-klaim':'Chest ini sudah diklaim hari ini.','belum-selesai':'Main dulu sampai syaratnya terpenuhi.','penuh':'Penyimpanan inventory penuh (10/10). Buka chest di Inventory dulu.','tidak-ada':'Chest tidak ditemukan.'};
let CS=null,cBusy=false;
function renderChest(S){
 if(!S||!Array.isArray(S.daily))return;
 CS=S;setBadge('chestDot',S.daily.filter(d=>d.status==='ready').length);
 const md=$('#chestMd');if(md&&!md.hidden)paintChest()}
const pullChest=()=>{const W=UT.WalletService&&UT.WalletService.get();return W&&W.chestGet?W.chestGet().then(r=>{if(env.disposed)return {ok:false};if(r&&r.ok!==false)renderChest(r);return {ok:!!(r&&r.ok!==false)}}):{ok:true}};
pullChest();
/* posisi titik (% lebar) dan isi bar: bar berjalan per ruas (mulai -> titik 1 -> titik 2 -> titik 3) menurut jumlah game hari ini */
const CPOS=[16,50,84],CSTART=4;
function chestFill(plays,needs){let prev=0,from=CSTART;
 for(let i=0;i<needs.length;i++){const to=CPOS[i]||CPOS[CPOS.length-1];
  if(plays<=needs[i])return Math.max(0,from+(to-from)*((plays-prev)/Math.max(1,needs[i]-prev)));
  prev=needs[i];from=to}
 return CPOS[CPOS.length-1]}
function chestHtml(){
 if(!CS)return '<div class="cempty">Memuat…</div>';
 const D=CS.daily,needs=D.map(d=>+d.need||0),top=Math.max.apply(null,needs.concat([1])),plays=Math.max(0,+CS.plays_today||0);
 const fill=chestFill(plays,needs);
 let h='<div class="tot"><b>'+Math.min(plays,top)+' / '+top+'</b> game hari ini<small>Reset tiap hari (WIB) · chest hasil klaim masuk Inventory</small></div>';
 h+='<div class="tl"><div class="trk"><div class="fil" style="width:'+Math.max(0,Math.min(100,(fill-CSTART)/(CPOS[CPOS.length-1]-CSTART)*100)).toFixed(1)+'%"></div></div>';
 D.forEach((d,i)=>{const k=CK[d.kind]||CK.wood,st=d.status,done=st==='claimed',reached=done||st==='ready';
  h+='<div class="nd '+(reached?'ok':'todo')+'" style="left:'+(CPOS[i]||50)+'%"><img class="im" src="'+CIC+k.im+'.webp" alt=""><div class="nm">'+k.nm+'</div>'+
   '<div class="mk">'+(reached?'<img src="'+CIC+'missions/ikon-tab-harian-centang.webp" alt="">':needs[i])+'</div><div class="rq">'+needs[i]+' game</div><div class="act">'+
   (st==='ready'?'<button class="cb ut-gl ut-c-g" type="button" data-claim="'+d.kind+'"><span>KLAIM</span></button>':done?'<i>Diklaim</i>':'<i>'+Math.min(plays,needs[i])+' / '+needs[i]+'</i>')+'</div></div>'});
 return h+'</div>'}
function paintChest(){const b=$('#cm-body');if(b)b.innerHTML=chestHtml()}
function openChest(){
 if(!SRV){toast('Masuk ke akun untuk memakai Chest.');return}
 $('#chestMd').hidden=false;paintChest();pullChest()}
function closeChest(){const md=$('#chestMd');if(md)md.hidden=true}
async function claimChest(kind){
 if(cBusy)return;cBusy=true;
 try{const W=UT.WalletService&&UT.WalletService.get(),r=W?await W.chestClaimDaily(kind):{ok:false,reason:'jaringan'};
  if(env.disposed)return;
  if(r&&r.ok){renderChest(r);toast('Chest masuk ke Inventory!')}else{toast(CWM[r&&r.reason]||'Gagal, coba lagi');await pullChest()}}
 finally{cBusy=false;if(!env.disposed)paintChest()}}
{const md=$('#chestMd');if(md){
 env.on(md,'click',e=>{
  if(e.target===md||e.target.closest('#cm-x')){buzz();closeChest();return}
  const b=e.target.closest('button[data-claim]');if(!b||b.disabled)return;buzz();claimChest(b.dataset.claim)});
 env.on(document,'keydown',e=>{if(e.key==='Escape'&&!md.hidden)closeChest()})}}

/* lencana Tambang = isi Gudang yang siap diklaim (sistem Tambang World: RPC tambang_get -> store). Rumus sama dengan tambang_claim:
   barang jadi + semua ore + kayu, KECUALI cadangan bahan bakar (coal 5, wood 10) yang tidak ikut diklaim. Diperbarui tiap 60 dtk. */
const MINE_KEEP={coal:5,wood:10};
function mineClaimable(st){if(!st)return 0;let n=0;const sum=o=>Object.keys(o||{}).reduce((a,k)=>a+Math.max(0,+o[k]||0),0);
 n+=sum(st.goods);Object.keys(st.ore||{}).forEach(k=>{n+=Math.max(0,(+st.ore[k]||0)-(MINE_KEEP[k]||0))});n+=Math.max(0,(+st.wood||0)-MINE_KEEP.wood);return Math.floor(n)}
const pullMine=()=>{const T=UT.TambangService&&UT.TambangService.get();if(!SRV||!T)return {ok:true};
 return T.get().then(r=>{if(env.disposed)return {ok:false};if(r&&r.ok&&r.store){setBadge('mineDot',mineClaimable(r.store))}return {ok:!!(r&&r.ok)}}).catch(()=>({ok:false}))};
pullMine();setInterval(()=>{if(!document.hidden)pullMine()},60000);

/* ---------- Hati / nyawa: 5 default, -1 tiap match dimulai, +1 tiap 15 menit (server: hearts-service). Tamu = 5 penuh tanpa batas. ---------- */
const HRT=UT.HeartsService&&UT.HeartsService.get&&UT.HeartsService.get();
(function(){const val=$('#v-ht'),tm=$('#htime'),chip=$('#cur-ht');if(!val||!tm||!chip)return;
 const mmss=s=>{s=Math.max(0,s|0);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
 let key='';
 function paint(){const s=HRT?HRT.snapshot():{hearts:5,max:5,nextInSecs:0,full:true},max=Math.max(5,s.max|0),n=Math.max(0,s.hearts|0),f=Math.min(n,max),k=f+'/'+max;
  /* berjejer max paha ayam: terisi = penuh warna, kosong = siluet redup (bukan teks 5/5) */
  if(k!==key){key=k;let h='';for(let i=0;i<max;i++)h+='<img src="assets/images/ui/white-glyphs/paha-ayam.webp" alt=""'+(i<f?'':' class="e"')+' draggable="false">';val.innerHTML=h}
  /* hati < max: hitung mundur | penuh: SIAP | > max: +N */
  tm.textContent=n>max?'+'+(n-max):n<max?mmss(s.nextInSecs):'SIAP';tm.classList.toggle('ready',n>=max);
  chip.setAttribute('aria-label','Nyawa '+n+' dari '+max)}
 paint();if(HRT&&HRT.onChange)HRT.onChange(paint);setInterval(()=>{if(!document.hidden)paint()},1000);
 chip.addEventListener('click',()=>{buzz();toast('Nyawa +1 tiap 15 menit')});
 if(SRV&&HRT)HRT.get()})();

/* ---------- LIVE: data tetap mutakhir tanpa refresh (live-sync.js: timer ~20 dtk saat tab terlihat + saat tab aktif lagi/online) ---------- */
if(SRV&&UT.LiveSync){const LS=UT.LiveSync;
 LS.add('wallet',()=>{const W=UT.WalletService&&UT.WalletService.get();return W?W.refresh():{ok:true}});
 LS.add('xp',pullXp);
 LS.add('appearance',()=>{const A=UT.AppearanceService&&UT.AppearanceService.get();return A?A.refreshThrottled().then(()=>({ok:true}),()=>({ok:false})):{ok:true}},{minGap:20000});
 LS.add('friends',pullFriends,{minGap:40000});
 LS.add('mail',pullMail,{minGap:40000});
 LS.add('quest',pullQuest,{minGap:30000});
 LS.add('mine',pullMine,{minGap:40000});
 LS.add('chest',pullChest,{minGap:20000});
 LS.add('hearts',()=>HRT?HRT.get().then(r=>({ok:!!(r&&r.ok)}),()=>({ok:false})):{ok:true},{minGap:20000});
 LS.start({interval:20000});
 env.own(()=>{LS.stop();['wallet','xp','appearance','friends','mail','quest','mine','chest'].forEach(k=>LS.remove&&LS.remove(k))});
}
/* Modal setelah masuk Lobby (hanya di sini): Ketentuan Layanan dulu bila belum setuju / versi naik, lalu "Unduh Data" bila ada pembaruan.
   Tidak ada unduhan otomatis: pemain yang memutuskan. Dialog ditutup saat Lobby di-unmount (SPA). */
{let alive=true;
 env.own(()=>{alive=false;try{UT.GameDialog&&UT.GameDialog.closeAll();UT.Update&&UT.Update.closeUi()}catch(e){}});
 setTimeout(()=>{
  const T=UT.Tos,U=UT.Update;
  Promise.resolve(T&&T.promptIfNeeded()).catch(()=>{}).then(()=>{if(alive&&U)return U.promptOnLobby()}).catch(()=>{});
 },2000);
}
});

