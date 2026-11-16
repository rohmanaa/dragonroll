/* Viewer 3D pet (dipindah dari 'data pet.html'; data pet sudah ada di supabase/pet_catalog.sql).
   Latar transparan, tanpa pad, tanpa zoom. API: PetViewer.select(gameKey). */
(function(){
"use strict";
const T=THREE;
let destroyed=false;
let _s=11;
const rnd=()=>((_s=(Math.imul(_s,1664525)+1013904223)>>>0)/4294967296);
const rr=(a,b)=>a+(b-a)*Math.random();
const pick=a=>a[(Math.random()*a.length)|0];
const rgb=h=>{const c=new T.Color(h);return[c.r,c.g,c.b]};
const jc=(hex,a)=>{const c=new T.Color(hex);if(a)c.offsetHSL(0,0,(rnd()-.5)*a);return c};

// ---------- mesh helpers (pets face +z, floor is y=0)
function mk(parent,geo,col,x,y,z,o){
  o=o||{};
  const mat=new T.MeshStandardMaterial({color:jc(col,o.j===undefined?.06:o.j),roughness:o.r===undefined?.8:o.r,metalness:o.m||0,flatShading:o.flat!==false});
  if(o.e!==undefined){mat.emissive=new T.Color(o.e);mat.emissiveIntensity=o.ei===undefined?1:o.ei}
  if(o.op!==undefined){mat.transparent=true;mat.opacity=o.op}
  if(o.side)mat.side=T.DoubleSide;
  const m=new T.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);
  if(o.rx)m.rotation.x=o.rx;if(o.ry)m.rotation.y=o.ry;if(o.rz)m.rotation.z=o.rz;
  parent.add(m);return m;
}
const bx=(p,w,h,d,c,x,y,z,o)=>mk(p,new T.BoxGeometry(w,h,d),c,x,y,z,o);
const cone=(p,r,h,c,x,y,z,o,seg)=>mk(p,new T.ConeGeometry(r,h,seg||4),c,x,y,z,o);
const cyl=(p,r,h,c,x,y,z,o,seg)=>mk(p,new T.CylinderGeometry(r,r,h,seg||10),c,x,y,z,o);
const oct=(p,r,c,x,y,z,o)=>mk(p,new T.OctahedronGeometry(r,0),c,x,y,z,o);
const torus=(p,r,t,c,x,y,z,o)=>mk(p,new T.TorusGeometry(r,t,6,36),c,x,y,z,o);
const sph=(p,r,c,x,y,z,o)=>mk(p,new T.SphereGeometry(r,10,8),c,x,y,z,o);
function gp(parent,x,y,z){const g=new T.Group();g.position.set(x||0,y||0,z||0);parent.add(g);return g}

// eye with sclera, pupil, and a highlight. o.sc = sclera color, o.glow = emissive pupil
function eye(p,x,y,z,s,iris,o){
  o=o||{};const g=gp(p,x,y,z);
  bx(g,s,s*1.1,.05,o.sc||'#ffffff',0,0,0,{j:0,e:o.scGlow});
  bx(g,s*.62,s*.82,.06,iris||'#1a1020',0,-.01*s,.02,{j:0,e:o.glow,ei:o.ei||1});
  bx(g,s*.22,s*.22,.07,'#ffffff',s*.14,s*.2,.04,{j:0,e:'#ffffff'});
  return g;
}

// soft additive glow billboard
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)})();
function glow(p,col,size,x,y,z,op){
  const s=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:col,blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:op===undefined?.8:op}));
  s.scale.set(size,size,1);s.position.set(x||0,y||0,z||0);p.add(s);return s;
}

// triangle fan from [x,y,z] points, first point is the hub (wing membranes)
function fan(pts){
  const v=[];for(let i=1;i<pts.length-1;i++){v.push(pts[0][0],pts[0][1],pts[0][2],pts[i][0],pts[i][1],pts[i][2],pts[i+1][0],pts[i+1][1],pts[i+1][2])}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
}

// bolt made of thin additive boxes between points
function makeBolt(parent,n,col){
  const g=gp(parent,0,0,0),segs=[];
  const mat=new T.MeshBasicMaterial({color:col,blending:T.AdditiveBlending,transparent:true,depthWrite:false});
  for(let i=0;i<n;i++){const m=new T.Mesh(new T.BoxGeometry(.07,.07,1),mat);m.visible=false;g.add(m);segs.push(m)}
  return{g,mat,set(pts){
    for(let i=0;i<segs.length;i++){
      const m=segs[i];
      if(i>=pts.length-1){m.visible=false;continue}
      const a=new T.Vector3(...pts[i]),b=new T.Vector3(...pts[i+1]);
      m.visible=true;m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(1,1,a.distanceTo(b));m.lookAt(b);
    }},hide(){segs.forEach(m=>m.visible=false)}};
}
function zig(a,b,n,amp){
  const pts=[];for(let i=0;i<=n;i++){const u=i/n,j=(i===0||i===n)?0:1;pts.push([a[0]+(b[0]-a[0])*u+(Math.random()-.5)*amp*j,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u+(Math.random()-.5)*amp*j])}
  return pts;
}
const rate=r=>{let a=0;return(dt,fn)=>{a+=r*dt;let n=0;while(a>=1&&n++<10){a--;fn()}}};
const modelHelpers=Object.freeze({bx,cone,cyl,oct,torus,sph,gp,eye,glow,fan,mk,makeBolt,zig,rate,pick,rr});

// ---------- particle system (one Points object, additive)
class Particles{
  constructor(scene,N){
    this.N=N;this.i=0;
    this.pos=new Float32Array(N*3);this.col=new Float32Array(N*3);this.size=new Float32Array(N);
    this.vel=new Float32Array(N*3);this.cs=new Float32Array(N*3);this.life=new Float32Array(N);this.max=new Float32Array(N).fill(1);this.g=new Float32Array(N);this.base=new Float32Array(N);
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.BufferAttribute(this.pos,3));
    geo.setAttribute('aCol',new T.BufferAttribute(this.col,3));
    geo.setAttribute('aSize',new T.BufferAttribute(this.size,1));
    this.u={uScale:{value:500}};
    const mat=new T.ShaderMaterial({uniforms:this.u,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'attribute vec3 aCol;attribute float aSize;varying vec3 vC;uniform float uScale;void main(){vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uScale/max(0.1,-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'varying vec3 vC;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;float a=smoothstep(0.5,0.0,d);gl_FragColor=vec4(vC*a*1.2,1.0);}'});
    this.pts=new T.Points(geo,mat);this.pts.frustumCulled=false;scene.add(this.pts);this.geo=geo;
  }
  emit(p,v,life,size,c,g){
    const i=this.i;this.i=(i+1)%this.N;const k=i*3;
    this.pos[k]=p[0];this.pos[k+1]=p[1];this.pos[k+2]=p[2];
    this.vel[k]=v[0];this.vel[k+1]=v[1];this.vel[k+2]=v[2];
    this.cs[k]=c[0];this.cs[k+1]=c[1];this.cs[k+2]=c[2];
    this.life[i]=life;this.max[i]=life;this.base[i]=size;this.size[i]=size;this.g[i]=g||0;
  }
  clear(){this.life.fill(0);this.size.fill(0);this.geo.attributes.aSize.needsUpdate=true}
  dispose(){this.geo.dispose();this.pts.material.dispose()}
  update(dt){
    for(let i=0;i<this.N;i++){
      if(this.life[i]<=0)continue;
      this.life[i]-=dt;
      if(this.life[i]<=0){this.size[i]=0;continue}
      const k=i*3;this.vel[k+1]+=this.g[i]*dt;
      this.pos[k]+=this.vel[k]*dt;this.pos[k+1]+=this.vel[k+1]*dt;this.pos[k+2]+=this.vel[k+2]*dt;
      const u=this.life[i]/this.max[i],f=Math.min(1,u*3)*Math.min(1,(1-u)*10);
      this.col[k]=this.cs[k]*f;this.col[k+1]=this.cs[k+1]*f;this.col[k+2]=this.cs[k+2]*f;
      this.size[i]=this.base[i]*(.55+.45*u);
    }
    this.geo.attributes.position.needsUpdate=true;this.geo.attributes.aCol.needsUpdate=true;this.geo.attributes.aSize.needsUpdate=true;
  }
}
let P=null;
const emit=(p,v,l,s,c,g)=>{if(P)P.emit(p,v,l,s,c,g)};

// ================= T4 Arcane Owl (Epic)

// ================= T5 Storm Wolf (Legendary)


// ================= T6 Inferno Dragon (Mythic)

// ================= T7 Celestial Kitsune (Divine)

// ================= audio (synthesized, no files)
let AC=null,MASTER=null,noiseBuf=null;
const petSounds=new Set();
/* Suara pet ikut pengaturan: tombol Suara (PlayerData.settings().sound) + slider Efek suara (Prefs sfxVol), sama seperti UT.Audio. */
function sfxVolume(){let v=1;try{const p=parseInt(UT.Prefs.get('sfxVol',100),10);if(!isNaN(p))v=Math.max(0,Math.min(100,p))/100}catch(e){}return v}
function sfxEnabled(){try{return !!window.PlayerData.settings().sound&&sfxVolume()>0&&!(UT.Audio&&UT.Audio.isMuted&&UT.Audio.isMuted())}catch(e){return true}}
function applyMaster(){if(MASTER)MASTER.gain.value=.55*sfxVolume()}
function audioInit(){
  if(AC){if(AC.state==='suspended')AC.resume();applyMaster();return true}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
  try{
    AC=new C();const comp=AC.createDynamicsCompressor();
    MASTER=AC.createGain();MASTER.gain.value=.55*sfxVolume();MASTER.connect(comp);comp.connect(AC.destination);
    if(AC.state==='suspended')AC.resume();
  }catch(e){AC=null;return false}
  try{petPreloadFiles()}catch(e){}
  return true;
}
// f0 -> f1 over dur. o: attack, lp (lowpass hz), vib (hz), vibd (depth hz), then (extra target hz at the end)
function tone(f0,f1,dur,type,vol,delay,o){
  o=o||{};const t0=AC.currentTime+(delay||0);
  const os=AC.createOscillator(),g=AC.createGain();os.type=type||'sine';
  os.frequency.setValueAtTime(f0,t0);
  if(o.then){os.frequency.exponentialRampToValueAtTime(f1,t0+dur*.45);os.frequency.exponentialRampToValueAtTime(o.then,t0+dur)}
  else if(f1&&f1!==f0)os.frequency.exponentialRampToValueAtTime(f1,t0+dur);
  g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol,t0+(o.attack||.01));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  let n=os;
  if(o.lp){const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;os.connect(f);n=f}
  if(o.vib){const l=AC.createOscillator(),lg=AC.createGain();l.frequency.value=o.vib;lg.gain.value=o.vibd||f0*.03;l.connect(lg);lg.connect(os.frequency);l.start(t0);l.stop(t0+dur+.05)}
  n.connect(g);g.connect(MASTER);os.start(t0);os.stop(t0+dur+.05);
}
function noise(dur,vol,type,f0,f1,delay,q){
  if(!noiseBuf){noiseBuf=AC.createBuffer(1,AC.sampleRate*1.6,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const t0=AC.currentTime+(delay||0);
  const s=AC.createBufferSource();s.buffer=noiseBuf;
  const f=AC.createBiquadFilter();f.type=type||'bandpass';f.frequency.setValueAtTime(f0,t0);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t0+dur);f.Q.value=q||1;
  const g=AC.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol,t0+Math.min(.03,dur/3));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  s.connect(f);f.connect(g);g.connect(MASTER);s.start(t0,Math.random()*.3);s.stop(t0+dur+.05);
}

// 3 sounds per pet, same order as PETS
const SND=window.__synthesizedSnd||[
 [ // Forest Pup: guk guk, yip, rengekan
  ()=>{tone(420,220,.16,'sawtooth',.32,0,{lp:1800});noise(.1,.16,'bandpass',900,500,0);tone(460,240,.15,'sawtooth',.3,.22,{lp:1800});noise(.09,.14,'bandpass',900,500,.22)},
  ()=>{tone(700,950,.09,'square',.1,0,{lp:2500});tone(760,1000,.09,'square',.1,.13,{lp:2500});tone(820,1060,.1,'square',.09,.26,{lp:2500})},
  ()=>{tone(620,380,.75,'sine',.22,0,{vib:7,vibd:14,attack:.05})}
 ],
 [ // Copper Golem: denting logam, uap, servo
  ()=>{tone(880,880,.4,'triangle',.22,0);tone(1320,1320,.32,'triangle',.14,0);tone(1990,1990,.22,'triangle',.08,0);noise(.05,.18,'highpass',3000,0,0)},
  ()=>{noise(.9,.26,'highpass',2500,4500,0)},
  ()=>{tone(140,320,.5,'sawtooth',.16,0,{lp:900});tone(320,160,.45,'sawtooth',.13,.5,{lp:900})}
 ],
 [ // Crystal Axolotl: gelembung, lonceng air, cicit
  ()=>{for(let i=0;i<4;i++)tone(300+i*120,900+i*200,.08,'sine',.22,i*.1)},
  ()=>{tone(1318,1318,.7,'sine',.16,0);tone(1760,1760,.8,'sine',.12,.13)},
  ()=>{tone(900,1500,.13,'triangle',.18,0);tone(1100,1700,.13,'triangle',.16,.17)}
 ],
 [ // Arcane Owl: hu-hu, denting arcane, kepakan
  ()=>{tone(340,300,.45,'sine',.3,0,{lp:700,attack:.08});tone(340,290,.55,'sine',.3,.62,{lp:700,attack:.08})},
  ()=>{[660,990,1320,1980].forEach((f,i)=>tone(f,f,1.2,'sine',.1,i*.1,{vib:5,vibd:3}))},
  ()=>{for(let i=0;i<6;i++)noise(.09,.16,'bandpass',900,600,i*.1,1.5)}
 ],
 [ // Storm Wolf: lolongan, guntur, setrum
  ()=>{tone(330,700,1.8,'sine',.24,0,{vib:5,vibd:8,then:520,attack:.3});tone(660,1400,1.8,'triangle',.07,0,{vib:5,vibd:16,then:1040,attack:.35});noise(1.6,.05,'bandpass',1200,1600,.1,2)},
  ()=>{noise(.12,.5,'highpass',1500,800,0);noise(.35,.4,'bandpass',500,200,.05,.6);noise(.7,.35,'bandpass',300,120,.3,.5);noise(1.0,.25,'bandpass',200,90,.7,.5)},
  ()=>{for(let i=0;i<7;i++)noise(.03,.3,'highpass',4000,0,i*.035+Math.random()*.02);tone(3200,700,.18,'sine',.1,0)}
 ],
 [ // Inferno Dragon: raungan, semburan api, kepakan sayap
  ()=>{tone(110,55,1.1,'sawtooth',.28,0,{lp:700,vib:18,vibd:8,attack:.1});noise(1.1,.28,'lowpass',500,200,0)},
  ()=>{noise(1.0,.4,'bandpass',500,1800,0,.8);noise(1.0,.2,'lowpass',300,150,0)},
  ()=>{for(let i=0;i<2;i++){tone(90,45,.28,'sine',.5,i*.45);noise(.3,.28,'lowpass',500,150,i*.45)}}
 ],
 [ // Celestial Kitsune: lonceng arpeggio, lengkingan rubah, kilau
  ()=>{[880,1175,1319,1760].forEach((f,i)=>tone(f,f,.9,'sine',.15,i*.11))},
  ()=>{tone(800,1500,.5,'sine',.2,0,{vib:8,vibd:20,then:900,attack:.05})},
  ()=>{[2093,2637,3136].forEach((f,i)=>tone(f,f,1.0,'sine',.06,i*.05,{vib:9,vibd:f*.01}));noise(.9,.05,'highpass',6000,9000,0)}
 ]
];
/* Suara Pet = rekaman asli, SFX khusus di folder kategori dan empat SFX shared tetap di assets/audio/sfx/pet/. tools/normalize-sfx.py menormalkan keduanya. Path dibaca dari manifest Pet
   (data/inventory/pet/<key>/manifest.js -> assets.sfx, via UT.ItemRegistry), BUKAN lagi dipetakan per indeks tier di sini. assets.sfx[k] = SND[pet][k].
   Sintesis lama (SND) jadi cadangan bila file belum dimuat/gagal, atau bila Registry/manifest tidak tersedia. */
const PET_FILES={};
function petSfxFromManifest(id){
  try{
    const IR=window.UT&&window.UT.ItemRegistry; if(!IR||!IR.shared)return null;
    const m=IR.shared().getItem('pet.'+id), f=m&&m.assets&&m.assets.sfx;
    return Array.isArray(f)&&f.length===3&&f.every(u=>typeof u==='string'&&u)?f.slice():null;
  }catch(e){return null}
}
const petBuf=Object.create(null),petLoading=Object.create(null);
function petLoad(url){
  if(petBuf[url]||petLoading[url]||!AC||destroyed)return;
  const controller=new AbortController();
  petLoading[url]=controller;
  fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()})
    .then(b=>new Promise((ok,no)=>AC.decodeAudioData(b,ok,no)))
    .then(buf=>{if(!destroyed&&petLoading[url]===controller)petBuf[url]=buf})
    .catch(error=>{if(!controller.signal.aborted)console.warn('[PetViewer] Failed to load Pet SFX '+url+'. Using synthesized fallback.',error)})
    .then(()=>{if(petLoading[url]===controller)delete petLoading[url]});
}
function petPlayFile(url,fallback){
  const b=petBuf[url];
  if(!b||!AC){petLoad(url);try{fallback&&fallback()}catch(e){}return}
  const s=AC.createBufferSource();s.buffer=b;s.connect(MASTER);petSounds.add(s);
  s.onended=()=>{petSounds.delete(s);s.disconnect()};
  s.start();
}
function petPreloadFiles(){Object.keys(PET_FILES).forEach(k=>PET_FILES[k].forEach(petLoad))}
const catalogItems=window.ItemCatalog&&window.ItemCatalog.items;
if(!Array.isArray(catalogItems))throw new Error('PetViewer requires ItemCatalog.items');
const PETS=catalogItems.filter(item=>item.kind==='pet').sort((a,b)=>a.tier-b.tier).map(item=>({id:item.gameKey,name:item.name,color:item.accent}));
if(PETS.length!==7||PETS.some(item=>!item.id||!item.name||!item.color))throw new Error('PetViewer requires seven complete Pet catalog entries');

/* Hubungkan SND[indeks PETS][slot] ke file dari manifest (cari per id Pet, tidak bergantung urutan Registry). */
PETS.forEach((d,i)=>{const f=petSfxFromManifest(d.id);if(!f)return;PET_FILES[i]=f;f.forEach((url,k)=>{const synth=SND[i][k];SND[i][k]=()=>petPlayFile(url,synth)})});

/* ================= scene: latar transparan, tanpa pad, kanvas besar, tanpa zoom ================= */
const view=document.getElementById('fpv'),canvas=document.getElementById('petGl');
const listeners=[];
let rafId=0,resizeObserver=null,soundTimer=0;
function listen(target,type,handler,options){
  target.addEventListener(type,handler,options);
  listeners.push({target,type,handler,options});
}
function removeListeners(){
  listeners.splice(0).forEach(({target,type,handler,options})=>target.removeEventListener(type,handler,options));
}
let renderer=null;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,premultipliedAlpha:true})}catch(err){
  view.insertAdjacentHTML('beforeend','<div class="gl-fail">WebGL tidak tersedia, pratinjau 3D tidak bisa ditampilkan.</div>');
}
let teardownFn=()=>{if(destroyed)return;destroyed=true;glowTex.dispose();removeListeners()};
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let pendingId=null,selectFn=null;
if(renderer){
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setClearColor(0x000000,0);
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(40,1,.1,100);
scene.add(new T.HemisphereLight(0xcfe0ff,0x201838,.8));
const key=new T.DirectionalLight(0xffffff,.85);key.position.set(4,7,5);scene.add(key);
const rim=new T.DirectionalLight(0xffffff,.8);rim.position.set(-5,3,-5);scene.add(rim);
const fill=new T.PointLight(0xffffff,.5,12);fill.position.set(0,.6,3.5);scene.add(fill);
P=new Particles(scene,900);

/* kamera: hanya putar (seret). Tanpa zoom: roda mouse dan cubit tidak mengubah jarak. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let az=.6,azT=.6,pol=1.3,polT=1.3,dist=9,distT=9,ty=1.5,tyT=1.5,camD=9,idle=0,autoRot=!RM,pop=0,drag=null;
function resetCam(){azT=.6;polT=1.3;distT=camD}
listen(canvas,'pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}if(drag===null)drag={id:e.pointerId,x:e.clientX,y:e.clientY};idle=2.5});
listen(canvas,'pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  azT-=(e.clientX-drag.x)*.009;polT=clamp(polT-(e.clientY-drag.y)*.006,.4,1.65);
  drag.x=e.clientX;drag.y=e.clientY;
});
const up=e=>{if(drag&&e.pointerId===drag.id)drag=null;idle=2.5};
listen(canvas,'pointerup',up);listen(canvas,'pointercancel',up);
listen(canvas,'wheel',e=>e.preventDefault(),{passive:false});
listen(canvas,'dblclick',resetCam);

function resize(){
  const w=Math.max(1,view.clientWidth),h=Math.max(1,view.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  P.u.uScale.value=renderer.domElement.height/(2*Math.tan(camera.fov*Math.PI/360));
}
if(typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(resize);resizeObserver.observe(view)}
else listen(window,'resize',resize);
resize();

let pet=null,cur=-1,selectionVersion=0;
const selectionGuard=window.UT&&window.UT.PetModelRegistry&&window.UT.PetModelRegistry.createSelectionGuard
  ?window.UT.PetModelRegistry.createSelectionGuard()
  :{begin(){return ++selectionVersion},isCurrent(token){return token===selectionVersion}};
function disposeObj(o){o.traverse(m=>{if(m.geometry)m.geometry.dispose();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose())})}
let soundOn=false,sndT=1,sndBag=[],bagLast=-1;
function playPetSound(){
  applyMaster();if(!soundOn||!sfxEnabled()||!AC||AC.state!=='running'||cur<0)return;
  if(!sndBag.length){sndBag=[0,1,2].sort(()=>Math.random()-.5);if(sndBag[sndBag.length-1]===bagLast)sndBag.reverse()}
  const k=sndBag.pop();bagLast=k;
  try{SND[cur][k]()}catch(e){}
}
function unlockAudio(){if(audioInit())soundOn=true}
['pointerdown','keydown','touchstart'].forEach(ev=>listen(window,ev,unlockAudio,{passive:true}));
selectFn=function(i){
  const d=PETS[i];
  if(pendingId===i)return;
  if(cur===i&&pet){if(pendingId!==null){selectionGuard.begin();pendingId=null}return}
  const token=selectionGuard.begin(),changed=cur!==i;
  pendingId=i;
  const discard=model=>{
    if(model&&model.root&&typeof model.root.traverse==='function'){
      scene.remove(model.root);disposeObj(model.root);
    }
  };
  const install=model=>{
    if(!selectionGuard.isCurrent(token)){discard(model);return}
    if(!model||!model.root||typeof model.root.traverse!=='function'||!model.cam||
      typeof model.cam.y!=='number'||typeof model.cam.d!=='number'||
      typeof model.tick!=='function'||typeof model.burst!=='function'){
      discard(model);
      throw new TypeError('Invalid Pet model handle: '+d.id);
    }
    scene.add(model.root);
    const previous=pet;
    pet=model;cur=i;pendingId=null;
    if(previous){scene.remove(previous.root);disposeObj(previous.root)}
    P.clear();
    rim.color.set(d.color);fill.color.set(d.color);
    camD=pet.cam.d;tyT=pet.cam.y;resetCam();pop=.1;sndT=.9;sndBag=[];
    if(soundTimer)clearTimeout(soundTimer);
    if(changed&&soundOn)soundTimer=setTimeout(()=>{soundTimer=0;if(!destroyed)playPetSound()},120);
    canvas.setAttribute('aria-label','Pratinjau 3D '+d.name);
  };
  const failed=error=>{
    if(!selectionGuard.isCurrent(token))return;
    pendingId=null;
    console.error('[PetViewer] Failed to load or build '+d.id+'.',error);
  };
  const registry=window.UT&&window.UT.PetModelRegistry;
  if(registry&&registry.hasModule(d.id)){
    registry.load(d.id).then(builder=>{
      if(!selectionGuard.isCurrent(token))return;
      try{install(builder({THREE:T,helpers:modelHelpers,emit}))}
      catch(error){failed(error)}
    },failed);
    return;
  }
  if(typeof d.build!=='function'){failed(new Error('No Pet model builder is available for '+d.id));return}
  try{install(d.build())}
  catch(error){failed(error)}
};

let last=performance.now(),t=0;
function frame(now){
  if(destroyed)return;
  rafId=requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;
  if(idle>0)idle-=dt;
  sndT-=dt;if(sndT<=0){sndT=rr(3,5.5);playPetSound()}
  if(autoRot&&!drag&&idle<=0)azT+=dt*.4;
  const k=1-Math.exp(-dt*9);
  az+=(azT-az)*k;pol+=(polT-pol)*k;dist+=(distT-dist)*k;ty+=(tyT-ty)*k;
  const asp=camera.aspect,dd=dist*(asp<1?1+(1-asp)*.8:1);
  camera.position.set(Math.sin(pol)*Math.sin(az)*dd,ty+Math.cos(pol)*dd*.9-dd*.18,Math.sin(pol)*Math.cos(az)*dd);
  camera.lookAt(0,ty,0);
  if(pet){pet.tick(t,dt);pop*=Math.exp(-dt*5);pet.root.scale.setScalar(1+pop)}
  P.update(dt);
  renderer.render(scene,camera);
}
rafId=requestAnimationFrame(frame);
teardownFn=()=>{
  if(destroyed)return;
  destroyed=true;
  if(rafId)cancelAnimationFrame(rafId);
  if(resizeObserver)resizeObserver.disconnect();
  if(soundTimer)clearTimeout(soundTimer);
  removeListeners();
  selectionGuard.begin();pendingId=null;
  if(pet){scene.remove(pet.root);disposeObj(pet.root);pet=null}
  if(P){P.clear();scene.remove(P.pts);P.dispose();P=null}
  Object.keys(petLoading).forEach(url=>{petLoading[url].abort();delete petLoading[url]});
  Object.keys(petBuf).forEach(url=>delete petBuf[url]);
  petSounds.forEach(source=>{try{source.stop();source.disconnect()}catch(error){console.warn('[PetViewer] Failed to stop Pet SFX during teardown.',error)}});
  petSounds.clear();
  if(AC){AC.close().catch(error=>console.error('[PetViewer] Failed to close audio context.',error));AC=null;MASTER=null;noiseBuf=null}
  glowTex.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
};
}

window.PetViewer={
  select(gameKey){
    if(destroyed)return;
    const i=PETS.findIndex(d=>d.id===gameKey);if(i<0)return;
    if(selectFn){selectFn(i);}
  },
  destroy(){teardownFn()}
};
listen(window,'pagehide',event=>{if(!event.persisted)window.PetViewer.destroy()});
})();
