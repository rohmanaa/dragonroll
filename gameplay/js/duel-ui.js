/* Ular Tangga Blok — gameplay/js/duel-ui.js
   DUEL PVP — tampilan "Dadu Duel Blok": 3 giliran, kamera sinematik 3D, dadu CSS-3D, serangan per karakter.
   Aturan murni ada di duel-core.js (UT.Gameplay.Duel); file ini hanya MEMAINKAN hasilnya (UT.GameplayDuelUI).
   Dipandu main.js (offline & host/tamu online):
     open(opts) -> intro() -> [waitForRoll(n) -> lockRoll() -> revealRolls([a,b]) -> turn(hasilDuel.round().turn)] x maks 3 -> result() -> close()
   opts: {names, css, faces, dice, reducedMotion, fighters:[{rig|config|preset|local|knight|model}, ...]}  (tanpa fighters = layar pilih lawan)
   Rig petarung (opts.fighters[i].rig, atau dipilih otomatis oleh rigFor):
     BARU  : 'archer' (Shuri, pemanah), 'knight' (Raja Blok)           -> rig prosedural dengan animasi sendiri
     LAMA  : 'ksatria' (Ksatria Mahkota/UT.PvpKnight), 'blocky' (karakter asli/UT.BlockyCharacter), 'model' (klon model bidak)
   Semua cue tampilan bisa dicerminkan ke tamu (argumen JSON biasa). CSS: gameplay/css/duel.css (semua berawalan #du2). */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var TEMPLATE = "<canvas id=\"du2-c\"></canvas>\n<div id=\"du2-vig\"></div><div id=\"du2-hurt\"></div>\n<div class=\"lb\" id=\"du2-lb1\"></div><div class=\"lb\" id=\"du2-lb2\"></div>\n<div id=\"du2-top\" class=\"hud\">\n  <div class=\"pcard\"><div class=\"port\"><canvas id=\"du2-pgL\" width=\"16\" height=\"16\"></canvas></div><div class=\"pinfo\"><div class=\"pname me\" id=\"du2-nl\">KAMU</div><div class=\"hpb\"><u id=\"du2-hl2\"></u><i id=\"du2-hl\"></i></div><div class=\"hexes\" id=\"du2-el\"><b></b><b></b><b></b></div></div></div>\n  <div id=\"du2-mid\"><div id=\"du2-plaque\"><b>DADU DUEL</b><small id=\"du2-rnd\">GILIRAN 1/3</small></div></div>\n  <div class=\"pcard r\"><div class=\"port\"><canvas id=\"du2-pgR\" width=\"16\" height=\"16\"></canvas></div><div class=\"pinfo\"><div class=\"pname ai\" id=\"du2-nr\">LAWAN</div><div class=\"hpb\"><u id=\"du2-hr2\"></u><i id=\"du2-hr\"></i></div><div class=\"hexes\" id=\"du2-er\"><b></b><b></b><b></b></div></div></div>\n</div>\n<div class=\"die\" id=\"du2-dieL\"><div class=\"cube\" id=\"du2-cL\"></div></div><div class=\"die\" id=\"du2-dieR\"><div class=\"cube\" id=\"du2-cR\"></div></div>\n<div class=\"abox hud fade\" id=\"du2-aL\"><div class=\"v\" id=\"du2-vL\">—</div><div class=\"s\"><b id=\"du2-sL\">SIAP</b></div></div>\n<div class=\"abox hud fade\" id=\"du2-aR\"><div class=\"v\" id=\"du2-vR\">—</div><div class=\"s\"><b id=\"du2-sR\">SIAP</b></div></div>\n<div id=\"du2-hint\" class=\"hud fade\">Tekan ROLL untuk memulai ronde.</div>\n<button id=\"du2-roll\" class=\"hud fade\"><span class=\"ic\">🎲</span>ROLL<small>SPASI</small></button>\n<div id=\"du2-vs\">VS</div><div id=\"du2-banner\"><b id=\"du2-bt\"></b><small id=\"du2-bs\"></small></div>\n<div id=\"du2-result\"><div class=\"box\"><h2 id=\"du2-rh\"></h2><div id=\"du2-rdl\"></div></div></div>\n<div id=\"du2-choose\" hidden></div>\n<div id=\"du2-rot\"><i></i><b>Putar ponsel ke mode landscape</b></div>";
  var inner = null, bootFailed = false;

  function loadFonts() {
    if (document.getElementById('du2-fonts')) return;
    var l = document.createElement('link'); l.id = 'du2-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Pixelify+Sans:wght@500;700&display=swap';
    document.head.appendChild(l);
  }

  function boot() {
    var T = window.THREE;
    if (!T || !T.WebGLRenderer) throw new Error('Three.js tidak tersedia');
    var RT = document.createElement('div');
    RT.id = 'du2'; RT.hidden = true; RT.setAttribute('aria-live', 'polite');
    RT.innerHTML = TEMPLATE;
    document.body.appendChild(RT);
    loadFonts();
    return (function (THREE, RT) {
/* ===== Karakter: Pemanah voxel (Shuri) + rig ===== */
const S=1/16, V3=THREE.Vector3;
const flashMats=[];
const mat=(c,e)=>{const m=new THREE.MeshLambertMaterial({color:c});if(e){m.emissive=new THREE.Color(e)}else flashMats.push(m);return m};
const bx=(p,w,h,d,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w*S,h*S,d*S),m);o.position.set(x*S,y*S,z*S);o.castShadow=true;p.add(o);return o};
const gp=(p,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x*S,y*S,z*S);g.rotation.order='YXZ';p.add(g);return g};

function faceTex(kind){
  const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');
  x.fillStyle='#f2b896';x.fillRect(0,0,16,16);
  const px=(col,a,b,w,h)=>{x.fillStyle=col;x.fillRect(a,b,w,h)};
  px('#e2a07c',0,15,16,1);
  const brow='#a8801e',ink='#3a2418';
  if(kind===2){ // kena hit: mata terpejam, alis naik, mulut terbuka
    px(brow,3,4,4,1);px(brow,9,4,4,1);px(ink,3,8,4,1);px(ink,9,8,4,1);px(ink,4,9,2,1);px(ink,10,9,2,1);
    px('#7a2a2a',6,11,4,3);px('#3a1010',7,12,2,1);
  }else{
    if(kind===1){px(brow,3,5,3,1);px(brow,5,6,2,1);px(brow,10,5,3,1);px(brow,9,6,2,1)}
    else{px(brow,3,5,4,2);px(brow,9,5,4,2)}
    px(ink,3,7,4,1);px(ink,9,7,4,1);                 // kelopak berat (mata sipit)
    px('#ffffff',3,8,4,1);px('#ffffff',9,8,4,1);
    px('#2f7a4e',4,8,2,1);px('#2f7a4e',10,8,2,1);px('#0c2a18',5,8,1,1);px('#0c2a18',11,8,1,1);
    px('#d98f6e',3,9,4,1);px('#d98f6e',9,9,4,1);     // kantung mata
    if(kind===3){px('#7a2a2a',5,12,6,1);px('#ffffff',6,12,4,1);px('#7a2a2a',4,11,1,1);px('#7a2a2a',11,11,1,1)}
    else if(kind===1){px('#8a4538',6,12,4,1);px('#8a4538',5,13,1,1);px('#8a4538',10,13,1,1)}
    else{px('#a85a48',6,12,4,1)}
  }
  const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;return t;
}

function buildArcher(){
  const M={skin:mat(0xf2b896),hair:mat(0xf6d93a),hairL:mat(0xfff08a),hairD:mat(0xd9a820),
    tun:mat(0x5a6b45),tunD:mat(0x3a4a2c),leath:mat(0x6a4326),leathD:mat(0x4a2f1b),boot:mat(0x4e3a4a),pant:mat(0x3b3342),
    cape:mat(0xc43e14),capeIn:mat(0x8a2a10),scarf:mat(0xd6501e),scarfD:mat(0xa8380f),brac:mat(0x5a4458),
    pink:mat(0xe0508a),wood:mat(0xe8832a),steel:mat(0xf3efc8),feather:mat(0xf4b6d0),
    gold:mat(0xf0c040,0x4a3200),bow:mat(0x5cf06a,0x1d7a2a),leaf:mat(0xb8ffb0,0x2a8a3a),str:mat(0xf4f4e6,0x555544)};
  const faceM=new THREE.MeshLambertMaterial({map:faceTex(0)});flashMats.push(faceM);
  const A={mats:M,faceM,tex:[0,1,2,3].map(faceTex),hairOff:[{x:0,y:0},{x:0,y:0},{x:0,y:0}],cloakOff:{x:0}};
  const root=new THREE.Group();A.root=root;
  const flip=gp(root,0,16,0);A.flip=flip;
  const body=gp(flip,0,-16,0);A.body=body;
  const hips=gp(body,0,12,0);A.hips=hips;
  // kaki
  const leg=(sx)=>{const h=gp(hips,sx*2.1,0,0);bx(h,4.2,6,4.2,M.pant,0,-3,0);bx(h,4.6,2,4.6,M.tunD,0,-.3,0);
    const k=gp(h,0,-6,0);bx(k,4.2,6,4.2,M.pant,0,-3,0);bx(k,4.8,3.4,5.2,M.boot,0,-4.3,.4);bx(k,4.9,1,5.4,M.leathD,0,-2.4,.4);return[h,k]};
  [A.hipL,A.knL]=leg(1);[A.hipR,A.knR]=leg(-1);
  // torso: zirah zaitun
  const torso=gp(hips,0,0,0);A.torso=torso;
  bx(torso,8.4,12,4.2,M.tunD,0,6,0);bx(torso,8.8,6.4,4.7,M.tun,0,8.8,0);
  for(const s of[-1,1]){bx(torso,.7,5.6,.3,M.tunD,s*2,8.8,2.45);}
  bx(torso,5.4,.7,.3,M.tunD,0,9.6,2.45);bx(torso,5.4,.7,.3,M.tunD,0,7.6,2.45);
  bx(torso,8.8,1.8,4.8,M.leath,0,1.7,0);bx(torso,2,1.8,.6,M.gold,0,1.7,2.55);
  bx(torso,6.2,4.5,.7,M.tun,0,-1.2,2.5);bx(torso,6.2,4.5,.7,M.tun,0,-1.2,-2.5);
  const strap=bx(torso,1.2,13,.5,M.leath,0,6.5,2.65);strap.rotation.z=.55;
  // syal/kerah oranye tinggi
  bx(torso,10.6,3.2,6.6,M.scarf,0,12.4,0);bx(torso,11,1,6.9,M.scarfD,0,10.9,0);
  bx(torso,5,5,1.4,M.scarf,2,9.5,2.9);bx(torso,5,2,1.5,M.scarfD,2,6.6,2.95);
  // jubah merah-oranye (2 segmen)
  const cl=gp(torso,0,11.8,-2.8);A.cloak=cl;bx(cl,10,14,.9,M.cape,0,-7,-.4);bx(cl,10.2,2,1.1,M.capeIn,0,-.5,-.2);
  const cl2=gp(cl,0,-14,0);A.cloak2=cl2;bx(cl2,11,7,.9,M.cape,0,-3.5,-.4);bx(cl2,3.4,3.4,.95,M.capeIn,-3.5,-6.5,-.5);bx(cl2,3.4,2.4,.95,M.capeIn,3.5,-5.5,-.5);bx(cl2,3,2,.95,M.cape,0,-7.5,-.45);
  // tabung panah (sirip pink menyembul)
  const q=gp(torso,-2.4,10.5,-4.8);q.rotation.z=.5;bx(q,3.8,9,3.4,M.leathD,0,0,0);bx(q,4.1,1,3.7,M.gold,0,3.5,0);
  for(let i=0;i<4;i++){bx(q,.6,4,.6,M.wood,-1.3+i*.9,6,(i%2)*.8-.4);bx(q,.5,2,1.8,i%2?M.feather:M.pink,-1.3+i*.9,8.2,(i%2)*.8-.4)}
  // kepala
  const head=gp(torso,0,12,0);A.head=head;
  const sk=M.skin;
  const hm=new THREE.Mesh(new THREE.BoxGeometry(8*S,8*S,8*S),[sk,sk,sk,sk,faceM,sk]);hm.position.y=4*S;hm.castShadow=true;head.add(hm);
  bx(head,1.9,2.2,1.5,M.skin,0,3.3,4.7);bx(head,1.9,.8,.5,M.skin,0,2.4,5.2);          // hidung
  for(const s of[1,-1])bx(head,1,2.6,1.8,M.skin,s*4.5,3.4,-.3);                       // telinga manusia
  // rambut: poni miring + sapuan panjang ke belakang
  bx(head,9,2,9.2,M.hair,0,8.6,-.2);bx(head,7.6,1.4,8,M.hairL,0,9.9,-.9);bx(head,5,1,5,M.hairL,0,10.8,-1.4);
  bx(head,9,1.5,1.7,M.hair,0,7.6,4.4);bx(head,3.6,2.2,1.7,M.hair,2.6,6.5,4.5);bx(head,2,3,1.7,M.hairD,3.5,5,4.5);
  for(const s of[1,-1]){bx(head,1.8,5,5.8,M.hair,s*4.7,6.2,-1.4);bx(head,1.2,2.6,1.4,M.hairD,s*4.5,5.0,2.6)}
  bx(head,8.8,6,1.6,M.hair,0,5.5,-4.4);
  A.tufts=[];
  for(let i=0;i<3;i++){
    const g1=gp(head,(i-1)*.8,8.2-i*2.3,-4.4);bx(g1,8.2-i*1.2,2.4,6,i===0?M.hairL:M.hair,0,0,-3);
    const g2=gp(g1,0,0,-6);bx(g2,6.8-i*1.1,2,5,i%2?M.hairD:M.hair,0,-.2,-2.5);
    const g3=gp(g2,0,0,-5);bx(g3,4.4-i*.7,1.6,3.8,M.hair,0,-.4,-1.9);bx(g3,2,1.2,2,M.hairD,0,-.6,-4.2);
    A.tufts.push({g1,g2,g3});
  }
  // lengan: kulit terbuka + bracer ungu + pauldron zaitun
  const arm=(sx)=>{const sh=gp(torso,sx*6.2,10.5,0);bx(sh,5.4,2.6,5.4,M.tunD,0,.5,0);for(let i=0;i<3;i++)bx(sh,1.7,.9,5.4,M.tun,-1.8+i*1.8,-1.2,0);
    bx(sh,4.2,6,4.2,M.skin,0,-3,0);
    const el=gp(sh,0,-5.5,0);bx(el,3.8,6,3.8,M.skin,0,-3,0);bx(el,4.6,4.6,4.6,M.brac,0,-3.6,0);bx(el,4.8,.8,4.8,M.leathD,0,-1.1,0);
    const hd=gp(el,0,-6,0);bx(hd,3.7,3,3.7,M.skin,0,-.6,0);bx(hd,3.9,.8,3.9,M.leathD,0,.6,0);return[sh,el,hd]};
  [A.shL,A.elL,A.handL]=arm(1);[A.shR,A.elR,A.handR]=arm(-1);
  // busur sulur hijau
  const bw=gp(A.handL,0,-1.2,0);A.bow=bw;
  bx(bw,2,4,2,M.leathD,0,0,0);bx(bw,2.4,.9,2.4,M.gold,0,2.2,0);bx(bw,2.4,.9,2.4,M.gold,0,-2.2,0);
  for(const g of[1,-1])for(let k=1;k<=7;k++){const y=g*(2+k*1.8),z=-(k*k)*.085;const s=bx(bw,1.6,2.3,1.6,M.bow,0,y,z);s.rotation.x=Math.atan(-g*(2*k)*.085/1.8);
    const lf=bx(bw,3.4,.7,1,M.leaf,0,y,z);lf.rotation.z=(k%2?1:-1)*.5;lf.rotation.x=s.rotation.x}
  for(const g of[1,-1]){bx(bw,1.2,2.2,1.2,M.leaf,0,g*16.6,-4.6);bx(bw,3,.8,1,M.leaf,0,g*17.4,-4.8)}
  const sg=()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.35*S,1,.35*S),M.str);bw.add(m);return m};
  A.s1=sg();A.s2=sg();
  const arr=gp(bw,0,0,-4.2);A.arrow=arr;
  bx(arr,.8,.8,17,M.wood,0,0,8.5);bx(arr,2.4,.8,2.8,M.steel,0,0,18.4);bx(arr,1.4,.8,1.4,M.steel,0,0,20.2);
  bx(arr,.3,2.8,3.6,M.pink,0,0,1.8);bx(arr,2.8,.3,3.6,M.feather,0,0,1.8);
  A.setNock=(zpx)=>{
    const seg=(m,ay,az,by,bz)=>{const dy=by-ay,dz=bz-az,L=Math.hypot(dy,dz);m.scale.y=L*S;m.position.set(0,(ay+by)/2*S,(az+bz)/2*S);m.rotation.x=Math.atan2(dz,dy)};
    seg(A.s1,16,-4.5,0,zpx);seg(A.s2,0,zpx,-16,-4.5);A.arrow.position.z=zpx*S;
  };
  A.setNock(-4.5);
  A.setFace=k=>{faceM.map=A.tex[k];faceM.needsUpdate=true};
  A.flash=f=>{for(const m of flashMats)m.emissive.setRGB(f,f*.15,f*.1)};
  root.traverse(o=>{if(o.isMesh)o.castShadow=true});
  return A;
}

/* ===== Sistem pose: semua sendi dilerp menuju target ===== */
const Z=()=>({hipsRy:0,tx:0,ty:0,tz:0,hy:0,hx:0,hz:0,slx:0,sly:0,slz:0,elx:0,srx:0,sry:0,srz:0,erx:0,ery:0,hlx:0,klx:0,hrx:0,krx:0,tail:0,cloak:0,draw:0,bowT:0,rootY:0,rootRx:0,rootRy:0,rootRz:0,rootOff:0,pivot:16});
function applyPose(A,J){
  const reachL=6*Math.cos(J.hlx)+6*Math.cos(J.hlx+J.klx),reachR=6*Math.cos(J.hrx)+6*Math.cos(J.hrx+J.krx);
  A.hips.position.y=(Math.max(reachL,reachR)+J.rootOff*16)*S;
  A.root.position.y=J.rootY;
  A.root.rotation.y=J.rootRy;
  A.flip.position.y=J.pivot*S;A.body.position.y=-J.pivot*S;
  A.flip.rotation.x=J.rootRx;A.flip.rotation.z=J.rootRz;
  A.hips.rotation.y=J.hipsRy;
  A.torso.rotation.set(J.tx,J.ty,J.tz);
  A.head.rotation.set(J.hx,J.hy,J.hz);
  A.shL.rotation.set(J.slx,J.sly,J.slz);A.elL.rotation.set(J.elx,0,0);
  A.shR.rotation.set(J.srx,J.sry,J.srz);A.elR.rotation.set(J.erx,J.ery,0);
  A.hipL.rotation.x=J.hlx;A.knL.rotation.x=J.klx;A.hipR.rotation.x=J.hrx;A.knR.rotation.x=J.krx;
  A.bow.rotation.x=-(J.slx+J.elx)+J.bowT;
  A.tufts.forEach((t,i)=>{const o=A.hairOff[i];
    t.g1.rotation.set(.42-i*.1+J.tail*.25+o.x,o.y+(i-1)*.08,0);
    t.g2.rotation.set(-.08+J.tail*.35+o.x*.9,o.y*.8,0);
    t.g3.rotation.set(-.22+J.tail*.45+o.x*.8,o.y*.6,0)});
  A.cloak.rotation.x=.08+J.cloak+A.cloakOff.x;A.cloak2.rotation.x=J.cloak*.7+A.cloakOff.x*.6;
}
/* ===== Util, renderer, dunia arena, Raja Blok, efek ===== */
const cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t*t*(3-2*t);
const wrap=a=>{a=(a+Math.PI)%(Math.PI*2);if(a<0)a+=Math.PI*2;return a-Math.PI};
const rnd=(a,b)=>a+Math.random()*(b-a);
const $=id=>document.getElementById('du2-'+id);
const ARENA=12.2;
const canvas=$('c');
const MOBILE=!!(navigator.maxTouchPoints>0&&/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||''));
const rd=new THREE.WebGLRenderer({canvas,antialias:!MOBILE,powerPreference:'default'});
rd.setPixelRatio(Math.min(devicePixelRatio||1,MOBILE?1.5:2));
rd.shadowMap.enabled=true;rd.shadowMap.type=THREE.PCFSoftShadowMap;
const sc=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(46,1,.1,200);
const FOG=0xf0a868;sc.fog=new THREE.Fog(FOG,28,80);
function resize(){const w=Math.max(2,innerWidth),h=Math.max(2,innerHeight);rd.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
  const s=cl(Math.min(w/820,h/390),.62,1.15);RT.style.setProperty('--s',s.toFixed(2))}
addEventListener('resize',()=>{if(!RT.hidden)resize()});resize();

/* langit senja bergradasi */
(()=>{const g=new THREE.SphereGeometry(90,24,16),n=g.attributes.position.count,col=new Float32Array(n*3),c1=new THREE.Color(0x1d2a5c),c2=new THREE.Color(0xe9825a),c3=new THREE.Color(0xffd08a),t=new THREE.Color();
  for(let i=0;i<n;i++){const y=g.attributes.position.getY(i)/90;if(y>0.25)t.copy(c2).lerp(c1,cl((y-.25)/.6));else t.copy(c3).lerp(c2,cl((y+.1)/.35));col.set([t.r,t.g,t.b],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  sc.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false})))})();
const sunM=new THREE.Mesh(new THREE.BoxGeometry(14,14,2),new THREE.MeshBasicMaterial({color:0xfff2c0,fog:false}));sunM.position.set(-40,16,-70);sunM.lookAt(0,0,0);sc.add(sunM);
sc.add(new THREE.HemisphereLight(0xffd9b0,0x4a3a5c,.85));
const sun=new THREE.DirectionalLight(0xffc890,1.05);sun.position.set(-14,18,-10);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);const sh=sun.shadow.camera;sh.left=-17;sh.right=17;sh.top=17;sh.bottom=-17;sh.near=1;sh.far=60;sun.shadow.bias=-.0006;
sc.add(sun);sc.add(sun.target);

/* lantai arena: ubin batu (instanced), cincin emas, dinding pilar */
const R_FLOOR=13,torches=[],clouds=[],flags=[];
(()=>{const tiles=[];for(let x=-R_FLOOR;x<=R_FLOOR;x++)for(let z=-R_FLOOR;z<=R_FLOOR;z++)if(Math.hypot(x,z)<=R_FLOOR-.2)tiles.push([x,z]);
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.5,1),new THREE.MeshLambertMaterial({color:0xffffff}),tiles.length);im.receiveShadow=true;
  const m=new THREE.Matrix4(),c=new THREE.Color();
  tiles.forEach(([x,z],i)=>{m.makeTranslation(x,-.25,z);im.setMatrixAt(i,m);const r=Math.hypot(x,z),chk=(x+z)&1;
    c.set(r<3.4&&r>2.4?0xc9953a:(chk?0x8e8a96:0x7c7886));c.offsetHSL(0,0,rnd(-.03,.03));im.setColorAt(i,c)});
  sc.add(im);
  // lingkaran duel emas di tengah
  const gold=new THREE.MeshLambertMaterial({color:0xf0c040,emissive:0x3a2800});
  for(let i=0;i<40;i++){const a=i/40*Math.PI*2,b=new THREE.Mesh(new THREE.BoxGeometry(.7,.06,.34),gold);b.position.set(Math.cos(a)*7,.03,Math.sin(a)*7);b.rotation.y=-a;b.receiveShadow=true;sc.add(b)}
  // dinding pilar keliling + obor
  const stone=new THREE.MeshLambertMaterial({color:0x6d6a78}),stoneD=new THREE.MeshLambertMaterial({color:0x55525f}),fl=new THREE.MeshBasicMaterial({color:0xffa030}),fl2=new THREE.MeshBasicMaterial({color:0xffe27a});
  const N=44;for(let i=0;i<N;i++){const a=i/N*Math.PI*2,r=R_FLOOR+.2,x=Math.cos(a)*r,z=Math.sin(a)*r,h=1.4+((i*7)%5)*.18;
    const p=new THREE.Mesh(new THREE.BoxGeometry(1.7,h,1.4),i%2?stone:stoneD);p.position.set(x,h/2-.1,z);p.rotation.y=-a+Math.PI/2;p.castShadow=true;p.receiveShadow=true;sc.add(p);
    if(i%4===0){const t=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,.4),fl);t.position.set(x*.985,h+.35,z*.985);const t2=new THREE.Mesh(new THREE.BoxGeometry(.22,.3,.22),fl2);t2.position.copy(t.position);t2.position.y+=.28;sc.add(t,t2);
      const post=new THREE.Mesh(new THREE.BoxGeometry(.22,.5,.22),stoneD);post.position.set(x*.985,h+.1,z*.985);sc.add(post);torches.push([t,t2])}}
  // tanah rumput di luar + gunung jauh + awan blok
  const grass=new THREE.Mesh(new THREE.CylinderGeometry(80,80,.4,24),new THREE.MeshLambertMaterial({color:0x5c8a3e}));grass.position.y=-.75;grass.receiveShadow=true;sc.add(grass);
  const ringG=new THREE.Mesh(new THREE.CylinderGeometry(R_FLOOR+1.6,R_FLOOR+1.6,.3,40),new THREE.MeshLambertMaterial({color:0x7a6a52}));ringG.position.y=-.5;sc.add(ringG);
  for(let i=0;i<60;i++){const a=rnd(0,Math.PI*2),r=rnd(18,52),h=rnd(.8,2.6),t=new THREE.Group();
    const tr=new THREE.Mesh(new THREE.BoxGeometry(.5,h,.5),new THREE.MeshLambertMaterial({color:0x6a4a2c}));tr.position.y=h/2;t.add(tr);
    const lv=new THREE.Mesh(new THREE.BoxGeometry(2,1.6,2),new THREE.MeshLambertMaterial({color:i%3?0x3f7a34:0x58952f}));lv.position.y=h+.6;t.add(lv);t.position.set(Math.cos(a)*r,-.5,Math.sin(a)*r);t.castShadow=true;sc.add(t)}
  const mt=new THREE.MeshLambertMaterial({color:0x5a4a78,fog:true}),mt2=new THREE.MeshLambertMaterial({color:0xf4f0f4});
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2+rnd(-.1,.1),r=rnd(62,72),h=rnd(10,26),w=rnd(10,18),b=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),mt);b.position.set(Math.cos(a)*r,h/2-2,Math.sin(a)*r);b.rotation.y=rnd(0,3);sc.add(b);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(w*.5,h*.22,w*.5),mt2);cap.position.set(b.position.x,h-2+h*.05,b.position.z);cap.rotation.y=b.rotation.y;sc.add(cap)}
  const cm=new THREE.MeshBasicMaterial({color:0xffe6d0,transparent:true,opacity:.85,fog:false});
  for(let i=0;i<14;i++){const g=new THREE.Group();for(let k=0;k<4;k++){const b=new THREE.Mesh(new THREE.BoxGeometry(rnd(5,9),1.6,rnd(3,5)),cm);b.position.set(k*4-6,rnd(0,.8),rnd(-1,1));g.add(b)}
    const a=rnd(0,Math.PI*2);g.position.set(Math.cos(a)*55,rnd(20,34),Math.sin(a)*55);g.userData.sp=rnd(.1,.3);g.userData.a=a;clouds.push(g);sc.add(g)}
  // bendera di dinding
  const bm=[new THREE.MeshLambertMaterial({color:0x2b4a9a}),new THREE.MeshLambertMaterial({color:0xb02a1a})];
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2+Math.PI/4,r=R_FLOOR+.1,g=new THREE.Group(),pole=new THREE.Mesh(new THREE.BoxGeometry(.2,5,.2),stoneD);pole.position.y=2.5;g.add(pole);
    const f=new THREE.Mesh(new THREE.BoxGeometry(.1,2.2,1.4),bm[i%2]);f.position.set(0,3.6,.8);g.add(f);g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);g.rotation.y=-a+Math.PI/2;sc.add(g);flags.push(f)}
})();

/* ===== Raja Blok (ksatria bermahkota, mata merah, pedang menyala) ===== */
function knightFace(kind){
  const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');
  x.fillStyle='#d8c6c0';x.fillRect(0,0,16,16);const px=(col,a,b,w,h)=>{x.fillStyle=col;x.fillRect(a,b,w,h)};
  px('#c0aaa6',0,15,16,1);
  if(kind===2){px('#2a1a1a',3,4,4,1);px('#2a1a1a',9,4,4,1);px('#ff3a2a',4,7,2,2);px('#ff3a2a',10,7,2,2);px('#3a1010',6,11,4,3);px('#7a1a1a',7,12,2,1)}
  else{px('#24262e',3,5,5,1);px('#24262e',8,5,5,1);px('#24262e',5,6,2,1);px('#24262e',9,6,2,1);
    px('#ffffff',3,7,4,2);px('#ffffff',9,7,4,2);px('#ff2a22',4,7,2,2);px('#ff2a22',10,7,2,2);px('#180000',5,8,1,1);px('#180000',11,8,1,1);
    if(kind===3){px('#5a1a1a',5,12,6,1);px('#ffffff',6,12,4,1)}else if(kind===1){px('#6a2a2a',5,12,6,1);px('#6a2a2a',4,13,1,1);px('#6a2a2a',11,13,1,1)}else px('#8a4a48',6,12,4,1)}
  const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;return t;
}
function buildKnight(){
  const M={skin:mat(0xd8c6c0),hair:mat(0x2a2a36),coat:mat(0x2a5bb0),coatD:mat(0x1c3f82),coatL:mat(0x4a7fd8),steel:mat(0xb8c0d0),steelD:mat(0x7a8296),leath:mat(0x4a3322),pant:mat(0x232a44),boot:mat(0x1c1c28),
    gold:mat(0xf0c040,0x5a3c00),gem:mat(0xff3a2a,0x8a0a00),blade:mat(0x9be8ff,0x2aa0d8),bladeC:mat(0xffffff,0x9fe8ff),cape:mat(0x9a1c1c),capeIn:mat(0x5a0e10)};
  const faceM=new THREE.MeshLambertMaterial({map:knightFace(0)});flashMats.push(faceM);
  const A={mats:M,faceM,tex:[0,1,2,3].map(knightFace),hairOff:[{x:0,y:0}],cloakOff:{x:0}};
  const root=new THREE.Group();A.root=root;
  const flip=gp(root,0,16,0);A.flip=flip;const body=gp(flip,0,-16,0);A.body=body;const hips=gp(body,0,12,0);A.hips=hips;
  const leg=(sx)=>{const h=gp(hips,sx*2.3,0,0);bx(h,4.6,6,4.6,M.pant,0,-3,0);bx(h,5,2.2,5,M.steelD,0,-.4,0);
    const k=gp(h,0,-6,0);bx(k,4.6,6,4.6,M.pant,0,-3,0);bx(k,5.2,3.6,5.8,M.boot,0,-4.3,.5);bx(k,5.4,1.2,5.4,M.steel,0,-2.2,0);return[h,k]};
  [A.hipL,A.knL]=leg(1);[A.hipR,A.knR]=leg(-1);
  const torso=gp(hips,0,0,0);A.torso=torso;
  bx(torso,9.2,12,4.8,M.coat,0,6,0);bx(torso,9.6,3,5.2,M.coatD,0,1.5,0);bx(torso,2.2,12,.5,M.gold,0,6,2.55);
  for(let i=0;i<3;i++)bx(torso,1.2,1.2,.5,M.gold,0,3+i*3.4,2.85);
  bx(torso,9.8,2,5.4,M.leath,0,1.2,0);bx(torso,2.4,2,.6,M.gold,0,1.2,2.85);
  bx(torso,5,6,.5,M.coatD,0,-2.2,2.6);bx(torso,5,6,.5,M.coatD,0,-2.2,-2.6);
  bx(torso,10,2.4,5.6,M.coatL,0,11.4,0);bx(torso,3.2,1.6,.6,M.gem,0,9.5,2.8);
  const cl1=gp(torso,0,11.5,-2.8);A.cloak=cl1;bx(cl1,10.4,14,.9,M.cape,0,-7,-.4);bx(cl1,10.6,1.8,1.1,M.gold,0,-.4,-.2);
  const cl2=gp(cl1,0,-14,0);A.cloak2=cl2;bx(cl2,11,6,.9,M.cape,0,-3,-.4);bx(cl2,3,2.6,1,M.capeIn,-3.6,-6.2,-.4);bx(cl2,3,2,1,M.capeIn,3.6,-5.8,-.4);
  const head=gp(torso,0,12,0);A.head=head;const sk=M.skin;
  const hm=new THREE.Mesh(new THREE.BoxGeometry(8*S,8*S,8*S),[sk,sk,sk,sk,faceM,sk]);hm.position.y=4*S;hm.castShadow=true;head.add(hm);
  bx(head,1.8,2,1.4,M.skin,0,3.3,4.6);for(const s of[1,-1])bx(head,1,2.4,1.6,M.skin,s*4.5,3.4,-.3);
  bx(head,8.8,1.8,9,M.hair,0,8.2,-.2);bx(head,8.8,5.5,1.6,M.hair,0,5.6,-4.4);bx(head,2,3,1.6,M.hair,-3.2,6.4,4.4);bx(head,2,2,1.6,M.hair,3.4,7,4.4);
  for(const s of[1,-1])bx(head,1.2,4,5,M.hair,s*4.5,6.3,-1.6);
  // mahkota emas bergerigi + permata merah
  bx(head,9.4,1.6,9.6,M.gold,0,9.9,-.2);
  for(const[x,z]of[[-3.6,-3.6],[0,-3.8],[3.6,-3.6],[-3.6,0],[3.6,0],[-3.6,3.6],[0,3.8],[3.6,3.6]])bx(head,1.8,2.6,1.8,M.gold,x,11.6,z);
  bx(head,1.6,1.6,.6,M.gem,0,9.9,4.7);bx(head,.6,1.6,1.6,M.gem,4.8,9.9,0);bx(head,.6,1.6,1.6,M.gem,-4.8,9.9,0);
  const arm=(sx)=>{const sh=gp(torso,sx*6.6,10.5,0);bx(sh,5.8,3,5.8,M.steel,0,.4,0);bx(sh,6.2,1,6.2,M.gold,0,1.6,0);bx(sh,4.4,6,4.4,M.coat,0,-3,0);
    const el=gp(sh,0,-5.5,0);bx(el,4,6,4,M.coatD,0,-3,0);bx(el,4.8,3.4,4.8,M.steel,0,-4.2,0);bx(el,5,.8,5,M.gold,0,-2.4,0);
    const hd=gp(el,0,-6,0);bx(hd,3.9,3,3.9,M.steelD,0,-.6,0);return[sh,el,hd]};
  [A.shL,A.elL,A.handL]=arm(1);[A.shR,A.elR,A.handR]=arm(-1);
  A.bow=gp(hips,0,0,0);A.tufts=[]; // dummy (agar applyPose sama)
  // pedang menyala di tangan kanan
  const sw=gp(A.handR,0,-1.5,0);A.sword=sw;sw.rotation.x=-.6;
  bx(sw,1.8,3.6,1.8,M.leath,0,0,0);bx(sw,7,1.4,2,M.gold,0,-2.2,0);bx(sw,1.8,1.8,1.8,M.gold,0,2.1,0);
  bx(sw,2.8,22,1,M.blade,0,-14,0);bx(sw,1.2,22,1.2,M.bladeC,0,-14,0);bx(sw,2.2,2,.9,M.bladeC,0,-26,0);bx(sw,1.4,1.6,.8,M.bladeC,0,-27.6,0);
  const glow=new THREE.Mesh(new THREE.BoxGeometry(5*S,26*S,2.4*S),new THREE.MeshBasicMaterial({color:0x7be0ff,transparent:true,opacity:.28,depthWrite:false}));glow.position.y=-14*S;sw.add(glow);A.glow=glow;
  A.swordTip=gp(sw,0,-27,0);
  A.setFace=k=>{faceM.map=A.tex[k];faceM.needsUpdate=true};
  root.traverse(o=>{if(o.isMesh)o.castShadow=true});
  return A;
}
/* bangun kedua karakter dengan daftar flash terpisah */
/* ===== Pembuat karakter =====
   Rig PROSEDURAL BARU : 'archer' (Shuri), 'knight' (Raja Blok)  -> animasi sendiri (poseFor/render di atas)
   Rig LAMA (ditambahkan): 'ksatria' (Ksatria Mahkota = UT.PvpKnight), 'blocky' (karakter asli pemain/CPU = UT.BlockyCharacter),
                           'model' (klon model bidak). Semua tampil lewat adapter A.ad.update(f,dt,now) yang menerjemahkan
                           state mesin duel (idle/guard/act/hit/down/dead/win) ke gerak rig masing-masing. */
function rigAvail(r){
  if(r==='archer'||r==='knight'||r==='model')return true;
  if(r==='ksatria')return !!(UT.PvpKnight&&UT.PvpKnight.createKnight&&UT.PvpKnight.sample);
  if(r==='blocky')return !!(UT.BlockyCharacter&&UT.BlockyCharacter.create);
  return false}
function rigFor(spec,side){
  spec=spec||{};
  if(spec.rig&&rigAvail(spec.rig))return spec.rig;
  if(spec.model)return 'model';
  if((spec.knight||spec.skin==='ksatria')&&rigAvail('ksatria'))return 'ksatria';
  if((spec.config||Number.isInteger(spec.preset)||spec.local)&&rigAvail('blocky'))return 'blocky';
  return side===0?'archer':'knight'}
function makeChar(spec,side){
  const kind=spec.rig;
  if(kind==='archer'||kind==='knight'){flashMats.length=0;const A=kind==='archer'?buildArcher():buildKnight();A.fm=flashMats.slice();
    A.flash=f=>{for(const m of A.fm)m.emissive.setRGB(f,f*.15,f*.1)};A.kind=kind;return A}
  return makeLegacy(spec,side)}

/* --- bantuan adapter --- */
const spdOf=f=>cl(Math.hypot(f.vx,f.vz)/f.def.spd);
/* seberapa rebah (0..1): terpental/jatuh ke belakang di poros kaki; 'down' bangkit lagi, 'dead' tetap rebah (sama dgn rig prosedural) */
function fallOf(f){if(f.state!=='down'&&f.state!=='dead')return 0;const fl=ease(cl(f.t/.4)),up=f.state==='down'?ease(cl((f.t-.8)/.4)):0;return fl*(1-up)}
/* condong umum untuk rig yang tidak punya pose serangan sendiri */
function swingOf(f,now){const s=f.state,t=f.t,a=f.act;let lean=0,hop=0;
  if(s==='act'&&a){const w=a.wind,k=cl((t-w)/a.act);lean=t<w?-.25*ease(cl(t/w)):(t<w+a.act?lerp(-.25,.55,ease(k)):.4*cl(1-(t-w-a.act)/a.rec))}
  else if(s==='hit')lean=-.4*Math.sin(cl(t/(f.hitLen||.38))*Math.PI);
  else if(s==='guard')lean=.12;
  else if(s==='win')hop=Math.abs(Math.sin(now*5))*.2;
  return{lean,hop}}
function placeLegacy(f,A,hop){A.root.position.set(f.x,hop||0,f.z);A.root.rotation.y=f.yaw}
/* jenis serangan -> kunci pose Ksatria Mahkota */
function ksKeys(P,a){const k=a.kind,v=a.v||0;
  if(k==='slash')return v===0?P.atk[0]:v===1?P.atk[1]:(P.atk[2]||P.smite);
  if(k==='slam')return P.smite;
  return P.atk[0]}

function ksUpdate(f,dt,now){
  const A=f.A,PK=UT.PvpKnight,P=PK.POSES,kn=A.kn,s=f.state,t=f.t,a=f.act,g=P.guard,sp=spdOf(f);
  let tgt=g,rate=10;
  if(s==='idle'){const kr=now*4.4+f.side*1.9,kb=Math.sin(kr)*.5+.5,ka=1+sp*1.4;
    tgt=Object.assign({},g,{hy:(g.hy||0)+.10+kb*.10,tx:(g.tx||0)+.10+Math.sin(kr)*.04+.15*sp,ty:(g.ty||0)+Math.sin(now*.9+f.side)*.12,
      ll:(g.ll||0)+Math.sin(kr*.5*ka)*.32*ka,rl:(g.rl||0)-Math.sin(kr*.5*ka)*.32*ka,rx:(g.rx||0)+Math.sin(kr*.5+.6)*.2,
      sw:(g.sw||0)+Math.sin(now*2.3+f.side)*.3,lx:(g.lx||0)-.35+Math.sin(kr+1)*.12})}
  else if(s==='guard'){tgt=P.block||g;rate=16}
  else if(s==='act'&&a){tgt=PK.sample(ksKeys(P,a),cl(t/(a.wind+a.act+a.rec)));rate=24}
  else if(s==='hit'||s==='stun'){tgt=P.hurt||g;rate=24}
  else if(s==='down'||s==='dead'){tgt=fallOf(f)>.3?(P.down||P.ko||g):g;rate=14}
  else if(s==='win'){tgt=P.win||g}
  PK.applyPose(kn,A.pose,tgt,dt,rate);
  if(kn.shield)kn.shield.visible=(s==='guard');
  const drag=Math.min(1,sp+(s==='act'?.5:0)+(s==='hit'?.6:0)+fallOf(f)*.9);
  if(kn.cape1){kn.cape1.rotation.x=.06+Math.sin(now*1.9+f.side)*.07+drag*.42;kn.cape1.rotation.z=Math.sin(now*1.3+f.side)*.05}
  if(kn.cape2){kn.cape2.rotation.x=Math.sin(now*2.6+f.side+1.1)*.13+drag*.3;kn.cape2.rotation.z=Math.sin(now*1.7+f.side+.4)*.07}
  A.inner.rotation.x=-1.5*fallOf(f);
  placeLegacy(f,A,sp>.1?Math.abs(Math.sin(now*9))*.05*sp:0)}

function bcUpdate(f,dt,now){
  const A=f.A,ch=A.ch,s=f.state,a=f.act,sp=spdOf(f),sw=swingOf(f,now);
  ch.tick(dt);
  if(s==='act'&&a){if(A.lastAct!==a){A.lastAct=a;ch.act&&ch.act('attack',Math.max(.3,a.wind+a.act+a.rec))}}else A.lastAct=null;
  if(s==='win'){if(!A.won){A.won=1;ch.act&&ch.act('cheer',2.2)}}else A.won=0;
  if(s==='guard'){if(!A.blk){A.blk=1;ch.act&&ch.act('block',.9)}}else A.blk=0;
  const mode=fallOf(f)>.3?'poseDown':'idle';
  if(ch.setMode&&A.mode!==mode){A.mode=mode;ch.setMode(mode)}
  A.inner.rotation.x=-1.5*fallOf(f)+(fallOf(f)>0?0:sw.lean*.5);
  placeLegacy(f,A,sw.hop+(sp>.1?Math.abs(Math.sin(now*9))*.06*sp:0))}

function mdUpdate(f,dt,now){
  const A=f.A,sp=spdOf(f),sw=swingOf(f,now),b=Math.sin(now*2.2)*.012;
  A.inner.rotation.x=-1.5*fallOf(f)+(fallOf(f)>0?0:sw.lean);
  A.inner.scale.set(1,1+b,1);
  placeLegacy(f,A,sw.hop+(sp>.1?Math.abs(Math.sin(now*9))*.08*sp:0))}

function makeLegacy(spec,side){
  const kind=spec.rig,A={root:new THREE.Group(),inner:new THREE.Group(),kind,fm:[],tex:null,flash(){},setFace(){}};
  A.root.add(A.inner);
  if(kind==='ksatria'){
    const PK=UT.PvpKnight,kn=PK.createKnight(THREE,side===1?{palette:PK.RIVAL_PAL}:undefined);
    A.inner.add(kn.root);A.kn=kn;A.pose=PK.newPose();A.flash=v=>{if(kn.setFlash)kn.setFlash(v)};A.ad={update:ksUpdate}}
  else if(kind==='blocky'){
    const ch=UT.BlockyCharacter.create(THREE);
    if(spec.config)ch.apply(spec.config,true);else if(Number.isInteger(spec.preset))ch.loadPreset(spec.preset);
    else if(spec.local)ch.loadFromPlayer();else ch.loadPreset(side);
    ch.tick(.016);const m=ch.root;m.scale.multiplyScalar(1.2);A.inner.add(m);A.ch=ch;A.ad={update:bcUpdate}}
  else{
    const sm=spec.model,wrap=new THREE.Group();
    sm.traverse(n=>{n.userData=n.userData||{};n.userData.sharedWithPawn=true});
    sm.position.set(0,0,0);sm.rotation.set(0,0,0);sm.scale.set(1,1,1);sm.updateMatrixWorld(true);
    const bb=new THREE.Box3().setFromObject(sm),h=Math.max(.1,bb.max.y-bb.min.y);
    sm.position.set(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);wrap.add(sm);wrap.scale.setScalar(2.1/h);
    A.inner.add(wrap);A.noDispose=true;A.ad={update:mdUpdate}}
  return A}



/* ===== Suara, partikel, teks ===== */
let AC=null;
function sfx(t){try{if(!AC)return;const T={shoot:[700,220,.09,'square',.04],power:[300,1200,.25,'sawtooth',.05],hit:[240,90,.1,'sawtooth',.07],crit:[900,260,.2,'square',.08],hurt:[170,50,.28,'sawtooth',.1],roll:[320,120,.22,'sine',.05],swing:[500,140,.14,'triangle',.06],slam:[90,30,.5,'sawtooth',.2],block:[1100,500,.1,'square',.07],parry:[1500,2400,.25,'triangle',.09],ko:[200,40,.9,'sawtooth',.18],bell:[880,880,.5,'triangle',.08],step:[120,70,.05,'sine',.03],wave:[400,900,.3,'sawtooth',.05]}[t];if(!T)return;
  const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime;o.type=T[3];o.connect(g);g.connect(AC.destination);o.frequency.setValueAtTime(T[0],n);o.frequency.exponentialRampToValueAtTime(T[1],n+T[2]);g.gain.setValueAtTime(T[4],n);g.gain.exponentialRampToValueAtTime(.001,n+T[2]);o.start(n);o.stop(n+T[2]+.02)}catch(e){}}
const parts=[],pm={},pg=new THREE.BoxGeometry(.14,.14,.14);
const pmat=c=>pm[c]||(pm[c]=new THREE.MeshBasicMaterial({color:c}));
function puff(pos,col,n,spd,life,grav=0,size=1,dirv){for(let i=0;i<n;i++){if(parts.length>260)break;const m=new THREE.Mesh(pg,pmat(col));m.position.copy(pos);m.scale.setScalar(size*rnd(.6,1.5));
  const v=new THREE.Vector3(rnd(-1,1),rnd(-.3,1),rnd(-1,1)).multiplyScalar(spd);if(dirv)v.add(dirv);sc.add(m);parts.push({m,v,life:life*rnd(.6,1.2),t:0,g:grav,s:m.scale.x})}}
function ring(c,col,r,n){for(let i=0;i<n;i++){const a=i/n*Math.PI*2;puff(c.clone().add(new V3(Math.cos(a)*.3,0,Math.sin(a)*.3)),col,1,.1,.7,0,1.6,new V3(Math.cos(a)*r,.5,Math.sin(a)*r))}}
function partStep(dt){for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.t+=dt;p.v.y-=p.g*dt;p.m.position.addScaledVector(p.v,dt);p.v.multiplyScalar(1-dt*2);
  const k=1-p.t/p.life;p.m.scale.setScalar(Math.max(.01,p.s*k));if(p.t>=p.life){sc.remove(p.m);parts.splice(i,1)}}}
function floatText(pos,txt,col){const v=pos.clone().project(cam);if(v.z>1)return;const d=document.createElement('div');d.className='dmg';d.textContent=txt;d.style.color=col||'#fff';
  d.style.left=((v.x*.5+.5)*innerWidth)+'px';d.style.top=((-v.y*.5+.5)*innerHeight)+'px';RT.appendChild(d);setTimeout(()=>d.remove(),1000)}
const DEFS={
  archer:{name:'SHURI',hp:90,spd:4.9,labels:['PANAH','KUAT','HUJAN','TENDANG'],
    mv:[{wind:.24,act:.05,rec:.2,cd:.45,kind:'arrow',dmg:8,spd:27},{wind:.75,act:.05,rec:.35,cd:3.5,kind:'arrow',dmg:22,spd:40,kb:6,big:1},
        {wind:.4,act:.1,rec:.45,cd:6.5,kind:'fan',dmg:6,spd:24},{wind:.15,act:.1,rec:.3,cd:2.2,kind:'kick',dmg:7,kb:9,range:2.2,arc:2.2}]},
  knight:{name:'RAJA BLOK',hp:120,spd:4.2,labels:['TEBAS','TERJANG','HANTAM','GELOMBANG'],
    mv:[{wind:.18,act:.16,rec:.2,cd:.25,kind:'slash',dmg:8,kb:3,range:2.5,arc:2.0},{wind:.3,act:.28,rec:.45,cd:3.8,kind:'lunge',dmg:15,kb:7,range:1.5},
        {wind:.62,act:.12,rec:.6,cd:7,kind:'slam',dmg:22,kb:10,range:3.0,breaker:1},{wind:.35,act:.1,rec:.35,cd:5,kind:'wave',dmg:12,spd:12,kb:4}]}
};

DEFS.ksatria=DEFS.blocky=DEFS.model=DEFS.knight;

/* ===== Pose ===== */
function ready(T,now){const b=Math.sin(now*2.2);
  T.hipsRy=-.45;T.ty=-.3+b*.02;T.hy=.72;T.tx=.03+b*.015;T.sly=.75;T.slx=-.55;T.elx=-.9;T.slz=.05;
  T.srx=.12;T.srz=-.12;T.erx=-.35;T.hlx=-.22;T.klx=.18;T.hrx=.2;T.krx=.3;T.tail=.05+b*.05;T.cloak=.05+b*.03}
function gait(T,now,sp){
  const w=now*(7+sp*7),a=.5+.5*sp,sn=Math.sin(w);
  T.hlx=sn*a;T.hrx=-sn*a;T.klx=Math.max(0,-Math.sin(w+1.2))*(.8+.9*sp);T.krx=Math.max(0,Math.sin(w+1.2))*(.8+.9*sp);
  T.slx=-.55-sn*.3;T.elx=-.9;T.sly=.1;T.srx=sn*a*.9;T.erx=-.5-.8*sp;T.tx=.05+.23*sp;T.ty=sn*(.1+.05*sp);T.hy=-sn*.1;T.rootY=Math.abs(sn)*(.04+.08*sp);T.cloak=.2+.35*sp;T.tail=.3+.5*sp}
function aim(T,d){
  T.hipsRy=-.75;T.ty=-.42;T.hy=1.1;T.tx=-.05*d;T.slx=-1.5;T.sly=1.17;T.elx=-.04;
  T.srx=-1.5;T.sry=lerp(1.17,-1.4,d);T.erx=lerp(-.4,-2.0,d);T.ery=lerp(0,-1.57,d);
  T.hlx=-.3;T.hrx=.3;T.klx=.1;T.krx=.15;T.draw=d;T.cloak=.1;T.tail=.1}
/* Raja Blok: sikap pedang di tangan kanan */
function kReady(T,now){const b=Math.sin(now*2.2);
  T.hipsRy=.25;T.ty=.2+b*.02;T.hy=-.4;T.tx=.04+b*.015;T.srx=-.8;T.sry=-.15;T.erx=-1.2;T.slx=-.7;T.sly=.25;T.elx=-1.3;
  T.hlx=-.25;T.klx=.2;T.hrx=.28;T.krx=.32;T.cloak=.06+b*.03;T.bowT=0}
function kGait(T,now,sp){const w=now*(6.5+sp*6),a=.45+.45*sp,sn=Math.sin(w);
  T.hlx=sn*a;T.hrx=-sn*a;T.klx=Math.max(0,-Math.sin(w+1.2))*(.8+.8*sp);T.krx=Math.max(0,Math.sin(w+1.2))*(.8+.8*sp);
  T.tx=.05+.18*sp;T.rootY=Math.abs(sn)*(.03+.07*sp);T.cloak=.2+.3*sp;T.slx=-.7+sn*.3}
const stunSway=(T,now)=>{T.hx=.35;T.hz=Math.sin(now*6)*.25;T.tx=.25;T.srx=.3;T.slx=.3;T.hlx=-.2;T.klx=.4}
function poseFor(f,now){
  const T=Z(),s=f.state,t=f.t,a=f.act,ar=f.kind==='archer';let face=0,rate=13;
  const sp=cl(Math.hypot(f.vx,f.vz)/f.def.spd);
  if(s==='idle'){if(ar){sp>.1?gait(T,now,sp):ready(T,now)}else{kReady(T,now);if(sp>.1)kGait(T,now,sp)}}
  else if(s==='guard'){if(ar){ready(T,now);T.hipsRy=-.2;T.ty=-.15;T.hy=.35;T.tx=.2;T.slx=-1.2;T.sly=.3;T.elx=-1.5;T.srx=-1.1;T.sry=-.35;T.erx=-1.9;T.hx=.12;T.hlx=-.5;T.klx=.55;T.hrx=.45;T.krx=.55}
    else{kReady(T,now);T.hipsRy=.1;T.ty=.05;T.hy=-.1;T.tx=.15;T.srx=-1.3;T.sry=.5;T.erx=-1.6;T.slx=-1.3;T.sly=-.1;T.elx=-1.6;T.bowT=.5;T.hlx=-.5;T.klx=.5;T.hrx=.4;T.krx=.5}face=1;rate=16}
  else if(s==='act'){rate=18;face=1;
    if(ar){const w=a.wind,ph=a.i;
      if(ph===0||ph===1){const dd=t<w?ease(cl(t/w)):cl(1-(t-w)*7);aim(T,dd);if(t>=w){T.sry+=.4*cl(1-(t-w)/.3);T.tx=.08}
        if(ph===1){T.tx=t<w?-.18*dd:.3;T.hlx=-.55;T.klx=.55;T.hrx=.5;T.krx=.6;if(t>w*.7&&t<w)T.tx+=Math.sin(now*70)*.02;T.cloak=.4}}
      else if(ph===2){const p=cl((t-w*.3)/.45);aim(T,.75);T.tx=-.35*Math.sin(p*Math.PI);T.rootY=Math.sin(p*Math.PI)*.9;T.rootRx=-.3*Math.sin(p*Math.PI);T.hlx=-.7;T.klx=1;T.hrx=.2;T.krx=1;T.cloak=.7;T.tail=1}
      else{ready(T,now);const e=t<a.wind?ease(t/a.wind):cl(1-(t-a.wind-a.act)/a.rec);T.tx=-.3*e;T.hrx=-1.5*e;T.krx=.25*e;T.hlx=.35*e;T.klx=.2;T.slx=-.9*e;T.srx=-.5*e;T.cloak=.5*e}}
    else{kReady(T,now);const w=a.wind,sw=cl((t-w)/a.act),wd=cl(t/w),k=a.kind;
      if(k==='slash'){const v=a.v||0;
        if(v===2){T.srx=lerp(-.8,-2.9,ease(wd));T.erx=-.3;T.slx=T.srx;T.elx=-.3;T.sly=0;T.sry=0;T.bowT=.3;T.tx=lerp(.04,-.3,ease(wd));if(t>=w){const q=ease(sw);T.srx=lerp(-2.9,-.45,q);T.slx=T.srx;T.tx=lerp(-.3,.7,q)}T.hlx=-.6;T.klx=.5;T.hrx=.4;T.krx=.4;T.ty=0;T.hipsRy=0;T.hy=0}
        else{const dir=v===0?1:-1;const sx=lerp(-.4,-1.3,ease(wd))*dir;let r=sx;if(t>=w)r=lerp(-1.3*dir,1.1*dir,ease(sw));
          T.srx=-1.45;T.erx=-.15;T.sry=r;T.slx=-.8;T.sly=.1;T.bowT=.6;T.ty=r*.6;T.tx=.15;T.hipsRy=0;T.hy=-r*.4;T.hlx=-.5;T.klx=.4;T.hrx=.4;T.krx=.4}
        T.cloak=.4}
      else if(k==='lunge'){const e=t<w?ease(wd):1;T.srx=lerp(-.8,-1.5,e);T.erx=lerp(-1.2,-.1,e);T.sry=0;T.bowT=.6*e;T.tx=lerp(.04,.55,e);T.hipsRy=.4*(1-e);T.ty=.3*(1-e);T.slx=-.5;T.sly=.6;
        T.hlx=lerp(-.25,-1.0,e);T.klx=lerp(.2,.3,e);T.hrx=lerp(.28,.7,e);T.krx=lerp(.3,.9,e);T.cloak=.8*e;T.rootOff=-.1*e;if(t>w+a.act)T.tx=.4}
      else if(k==='slam'){const up=ease(cl(t/w)),dn=t>=w?ease(cl((t-w)/a.act)):0;T.srx=lerp(-.8,-2.9,up);T.erx=-.25;T.slx=T.srx;T.elx=-.25;T.sly=0;T.sry=0;T.hipsRy=0;T.ty=0;T.hy=0;T.bowT=.3;
        T.tx=lerp(.04,-.35,up);T.rootY=up*.12;T.hlx=-.4;T.klx=.3;T.hrx=.4;T.krx=.3;if(t>=w){T.srx=lerp(-2.9,-.4,dn);T.slx=T.srx;T.tx=lerp(-.35,.75,dn);T.rootY=0;T.klx=.8;T.krx=.5}T.cloak=.5+dn*.6}
      else{const e=ease(wd),q=t>=w?ease(sw):0;T.srx=-1.45;T.erx=-.15;T.sry=lerp(-1.3*e,1.0,q);T.bowT=.6;T.ty=lerp(0,-.5,e)+q*1.0;T.slx=-.8;T.hlx=-.4;T.klx=.4;T.hrx=.4;T.krx=.4;T.cloak=.4}}}
  else if(s==='dodge'){const p=cl(t/.5),aa=cl(p/.14),r=cl((p-.14)/.58),u=cl((p-.72)/.28),tuck=ease(aa)*(1-ease(u));
    T.tx=.35+.6*tuck;T.hx=.7*tuck;T.hlx=-.7-.8*tuck;T.klx=.9+1.1*tuck;T.hrx=-.7-.8*tuck;T.krx=.9+1.1*tuck;
    T.slx=-.6-.6*tuck;T.elx=-1-.9*tuck;T.srx=-.6-.6*tuck;T.erx=-1-.9*tuck;
    T.pivot=lerp(16,9,tuck);T.rootRx=Math.PI*2*ease(r);T.rootY=Math.sin(r*Math.PI)*.16;T.cloak=-.5*tuck;T.tail=-.6*tuck;rate=24;if(!ar)T.bowT=.5}
  else if(s==='hit'){ar?ready(T,now):kReady(T,now);const k=Math.sin(cl(t/(f.hitLen||.38))*Math.PI);T.tx=-.55*k;T.hx=-.5*k;T.slx=-.2;T.srx=-.5*k;T.srz=-.5*k;T.hlx=-.4*k;T.hrx=.4*k;T.klx=.4;T.cloak=-.4*k;T.tail=-.8*k;face=2;rate=28}
  else if(s==='stun'){ar?ready(T,now):kReady(T,now);stunSway(T,now);face=2;rate=10}
  else if(s==='down'||s==='dead'){const fall=ease(cl(t/.4)),up=s==='down'?ease(cl((t-.8)/.4)):0,g=fall*(1-up);
    ar?ready(T,now):kReady(T,now);T.rootRx=-1.5*g;T.pivot=lerp(16,5,g);T.rootY=Math.sin(cl(t/.4)*Math.PI)*.2;T.hlx=-.5*g;T.klx=.5*g;T.hrx=-.2*g;T.krx=.8*g;T.slx=-1*g;T.srx=-1.2*g;T.elx=-.5*g;T.erx=-.5*g;T.tx=-.3*g;
    T.cloak=-.4*g;face=2;rate=s==='dead'?9:16;if(!ar)T.bowT=.4*g}
  else if(s==='win'){ar?ready(T,now):kReady(T,now);const b=Math.abs(Math.sin(now*5));T.hipsRy=0;T.ty=0;T.hy=0;T.srx=-2.6;T.sry=0;T.erx=-.3;T.slx=ar?-2.8:-.6;T.sly=0;T.rootY=b*.2;T.hlx=-.15;T.hrx=.15;T.klx=.3*b;T.krx=.3*b;T.cloak=.4+b*.3;T.tail=b;face=3;if(!ar)T.bowT=.3}
  return{T,face,rate};
}
function springs(f,dt){const A=f.A,fw=f.vx*Math.sin(f.yaw)+f.vz*Math.cos(f.yaw),lt=f.vx*Math.cos(f.yaw)-f.vz*Math.sin(f.yaw);
  A.hairOff.forEach((o,i)=>{const s=f.hs[i],k=70-i*12,c=6+i;s.vx+=((-fw*.07-s.x)*k-s.vx*c)*dt;s.x+=s.vx*dt;s.vy+=((lt*.05-s.y)*k-s.vy*c)*dt;s.y+=s.vy*dt;o.x=cl(s.x,-.9,.9);o.y=cl(s.y,-.7,.7)});
  const cs=f.cs;cs.v+=((cl(fw*.12,-.8,.9)-cs.x)*40-cs.v*5)*dt;cs.x+=cs.v*dt;A.cloakOff.x=cl(cs.x,-.8,.9)}
function render(f,dt,now){if(f.A.ad){f.A.ad.update(f,dt,now);f.A.flash(f.flash);return}
  const{T,face,rate}=poseFor(f,now),a=1-Math.exp(-rate*dt),J=f.J;
  for(const k in T){if(k==='draw'||(k==='rootRx'&&f.state==='dodge')){J[k]=T[k];continue}J[k]+=(T[k]-J[k])*a}
  if(f.state!=='dodge')J.rootRx=((J.rootRx+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  springs(f,dt);const A=f.A;A.setFace(face);applyPose(A,J);
  A.root.rotation.y=f.yaw;A.root.position.x=f.x;A.root.position.z=f.z;
  if(f.kind==='archer'){const showA=f.state==='act'&&f.act&&f.act.kind!=='kick'&&J.draw>.03;A.root.updateMatrixWorld(true);
    if(showA){const hp=A.handR.getWorldPosition(new V3());A.bow.worldToLocal(hp);const nz=cl(hp.z/S,-15,-4.5);A.setNock(lerp(-4.5,nz,cl(J.draw*2.5)))}else A.setNock(-4.5);A.arrow.visible=showA}
  else{A.sword.rotation.x=-.6+J.bowT;A.glow.material.opacity=.22+Math.sin(now*6)*.06+(f.state==='act'?.2:0)}
  A.flash(f.flash)}

/* ===== Duel dadu: giliran bersamaan, aksi dimainkan sebagai sinematik 3D ===== */
const G={phase:'idle',turn:0,sd:false,ko:false,ts:1,tsT:0,shake:0,fov:0,clock:0,busy:false,paused:false,bestHit:0,rolls:0};
const hitStop=(ms,s)=>{G.ts=s;G.tsT=ms/1000};
const shake=a=>{G.shake=Math.max(G.shake,a)};
const waits=[],tweens=[],flights=[];
const wait=s=>new Promise(r=>waits.push({t:s,r}));
function mv(f,x,z,dur){return new Promise(r=>tweens.push({f,x0:f.x,z0:f.z,x1:x,z1:z,t:0,dur,r}))}
const BASE=[-3.2,3.2];
const NAMES={archer:'SHURI',knight:'RAJA BLOK'};
const ACT_NAME=['','MELESET','TANGKIS','SERANG','SERANG KUAT','SKILL','KRITIS!'];

function mkFighter(spec,side){
  spec=spec||{};const rig=rigFor(spec,side),A=makeChar(Object.assign({},spec,{rig}),side),def=DEFS[rig];sc.add(A.root);
  return{kind:rig,A,side,def,name:spec.name||'',J:Z(),x:BASE[side],z:0,vx:0,vz:0,yaw:side?-Math.PI/2:Math.PI/2,hp:100,max:100,en:0,state:'idle',t:0,act:null,flash:0,hitLen:.4,
    hs:[{x:0,vx:0,y:0,vy:0},{x:0,vx:0,y:0,vy:0},{x:0,vx:0,y:0,vy:0}],cs:{x:0,v:0}}}

let P=null,E=null;
const setState=(f,s)=>{f.state=s;f.t=0};
function resetFighters(){for(const f of[P,E]){f.hp=100;f.en=0;f.x=BASE[f.side];f.z=0;f.vx=f.vz=0;f.yaw=f.side?-Math.PI/2:Math.PI/2;f.state='idle';f.t=0;f.act=null;f.flash=0;f.J=Z();f.A.setFace(0)}}
const other=f=>f===P?E:P;

/* ===== Dadu CSS 3D ===== */
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const FACE_ROT={1:'',6:'rotateY(180deg)',3:'rotateY(-90deg)',4:'rotateY(90deg)',2:'rotateX(-90deg)',5:'rotateX(90deg)'};
['cL','cR'].forEach(id=>{const c=$(id);for(let n=1;n<=6;n++){const f=document.createElement('div');f.className='face f'+n;for(let k=0;k<9;k++){const i=document.createElement('i');if(PIPS[n].includes(k))i.className='p';f.appendChild(i)}c.appendChild(f)}});
function diceRoll(on){for(const[id,did]of[['cL','dieL'],['cR','dieR']]){const c=$(id),d=$(did);if(on){c.style.transform='';c.classList.add('roll');d.classList.remove('toss');void d.offsetWidth;d.classList.add('toss')}else c.classList.remove('roll')}}
function diceShow(id,n){const c=$(id);c.classList.remove('roll');c.style.transform='rotateX(-18deg) rotateY(18deg) '+FACE_ROT[n]}
/* putar balik transform: tampilkan sisi n menghadap kamera */
function diceFace(id,n){const c=$(id);c.classList.remove('roll');c.style.transform=(FACE_ROT[n]||'')+' rotateX(-14deg) rotateY(14deg)'}

/* ===== HUD ===== */
let banT=null;function banner(a,b,ms,ko){const e=$('banner');$('bt').textContent=a;$('bs').textContent=b||'';e.classList.toggle('ko',!!ko);e.classList.add('on');clearTimeout(banT);banT=setTimeout(()=>e.classList.remove('on'),ms)}
function hud(){if(!P||!E)return;G.turn=G.turn||0;for(const[f,h,u,e]of[[P,'hl','hl2','el'],[E,'hr','hr2','er']]){const p=Math.max(0,f.hp)+'%';$(h).style.width=p;$(u).style.width=p;[...$(e).children].forEach((b,i)=>b.classList.toggle('on',i<G.turn))}
  $('rnd').textContent='GILIRAN '+Math.min(3,G.turn+1)+'/3'}
function pipsHud(){const pp=$('mid').querySelectorAll('.pips span');pp.forEach((s,i)=>{});}
function label(side,v,s,go){$(side?'vR':'vL').textContent=v;$(side?'vR':'vL').classList.toggle('go',!!go);$(side?'sR':'sL').textContent=s}

/* ===== Kamera sinematik ===== */
const cp=new V3(0,3,11),cLook=new V3(0,1.5,0),tp=new V3(0,3,11),tl=new V3(0,1.5,0);let fovT=40,ck=4,camInit=false;
function shot(px,py,pz,lx,ly,lz,k,fov){tp.set(px,py,pz);tl.set(lx,ly,lz);ck=k||5;fovT=fov||40}
function baseShot(){shot(0,2.5,11.2,0,.95,0,2.5,40)}
function camUpdate(dt,now){
  if(G.phase==='title'){const a=now*.2;tp.set(Math.cos(a)*10,3.2,Math.sin(a)*10+2);tl.set(0,1.4,0);ck=3;fovT=42}
  if(!camInit){cp.copy(tp);cLook.copy(tl);camInit=true}
  const a=1-Math.exp(-ck*dt);cp.lerp(tp,a);cLook.lerp(tl,Math.min(1,a*1.2));
  G.fov*=Math.exp(-dt*6);cam.fov+=(fovT+G.fov-cam.fov)*Math.min(1,dt*6);cam.updateProjectionMatrix();
  cam.position.copy(cp);
  if(G.phase==='wait'){cam.position.x+=Math.sin(now*.35)*.5;cam.position.y+=Math.sin(now*.5)*.12}
  if(G.shake>.002){cam.position.x+=rnd(-1,1)*G.shake;cam.position.y+=rnd(-1,1)*G.shake*.7;cam.position.z+=rnd(-1,1)*G.shake;G.shake*=Math.exp(-dt*9)}
  cam.lookAt(cLook)}

/* ===== Efek serangan ===== */
const mA=[new THREE.MeshBasicMaterial({color:0xe8832a}),new THREE.MeshBasicMaterial({color:0xf3efc8}),new THREE.MeshBasicMaterial({color:0x9bff7a})];
function flight(from,to,dur,big,cb,arc=.5){const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(.07,.07,1.1),mA[big?2:0]));const h=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.24),mA[1]);h.position.z=.65;g.add(h);
  const fl=new THREE.Mesh(new THREE.BoxGeometry(.05,.26,.28),mA[2]);fl.position.z=-.5;g.add(fl);sc.add(g);flights.push({g,from:from.clone(),to:to.clone(),t:0,dur,cb,arc,big})}
function stepFlights(dt){for(let i=flights.length-1;i>=0;i--){const q=flights[i];q.t+=dt;const k=Math.min(1,q.t/q.dur);q.g.position.lerpVectors(q.from,q.to,k);q.g.position.y+=Math.sin(k*Math.PI)*q.arc;
  const nk=Math.min(1,k+.03),n=new V3().lerpVectors(q.from,q.to,nk);n.y+=Math.sin(nk*Math.PI)*q.arc;q.g.lookAt(n);if(q.big&&Math.random()<.6)puff(q.g.position,0x9bff7a,1,.3,.3,0,.8);
  if(k>=1){sc.remove(q.g);flights.splice(i,1);q.cb&&q.cb()}}}
const chest=f=>new V3(f.x,1.1,f.z);
function hurt(l,dmg,o={}){l.hp=Math.max(G.ko?0:1,l.hp-dmg);l.flash=1;const c=chest(l);floatText(c.clone().setY(2.1),dmg,o.big?'#ffd84a':'#fff');puff(c,0xffa030,o.big?18:9,3,.45,3);sfx(o.big?'crit':'hit');shake(o.big?.4:.16);G.fov+=o.big?3.5:1.2;hitStop(o.big?130:70,o.big?.05:.1);
  if(l===P)$('hurt').style.opacity=1,setTimeout(()=>$('hurt').style.opacity=0,200);
  if(G.bestHit<dmg&&P&&l===E)G.bestHit=dmg;
  if(l.hp>0&&l.state!=='guard'){if(o.down){setState(l,'down')}else setState(l,'hit')}}
function playAct(f,a){f.act=a;setState(f,'act')}
const mvAct=(f,i,v)=>{const a=Object.assign({i,v:v||0},DEFS[f.kind].mv[i]);a.total=a.wind+a.act+a.rec;a.fireT=a.wind+(a.kind==='lunge'?0:a.act*.4);return a};
const away=f=>f===P?-1:1; // arah menjauh lawan (untuk penyerang di sisi lain)

/* ===== Aksi per karakter ===== */
async function archerAttack(w,l,r,dmg,ult,blocked){
  const sx=w.x,from=()=>new V3(w.x+(l.x>w.x?.8:-.8),1.2,w.z),to=()=>chest(l);
  const shoot=async(i,hits,big)=>{const a=mvAct(w,i);playAct(w,a);shot(w.x+(l.x>w.x?2:-2),1.7,6,w.x+(l.x>w.x?3:-3),1.4,0,6,36);await wait(a.wind);
    const dur=.32;let landed=0;const n=i===2?5:1;
    for(let k=0;k<n;k++){const f0=from();f0.z+=(k-2)*.12*(n>1?1:0);const t0=to();t0.z+=(k-2)*.22*(n>1?1:0);flight(f0,t0,dur+k*.03,big,()=>{landed++},.4);}
    sfx('shoot');puff(from(),big?0x9bff7a:0xffffff,big?12:5,1.5,.3);await wait(dur+.04*n);
    hurt(l,hits,{big,down:big&&!blocked});if(blocked){puff(chest(l),0xcfe6ff,10,2.5,.3);sfx('block')}
    shot((w.x+l.x)/2,1.9,5.2,l.x,1.3,0,7,34);await wait(a.rec+.25)};
  if(ult){banner('PAMUNGKAS!','Hujan panah',1400);RT.classList.add('cine');G.fov+=4;
    await shoot(2,Math.round(dmg*.45),false);await shoot(1,Math.round(dmg*.55),true);RT.classList.remove('cine')}
  else if(r>=6)await shoot(2,dmg,true);
  else if(r===5)await shoot(1,dmg,true);
  else if(r===4){await shoot(0,Math.round(dmg*.5),false);await shoot(0,Math.round(dmg*.5),false)}
  else await shoot(0,dmg,false);
  w.state==='act'&&setState(w,'idle')}
async function knightAttack(w,l,r,dmg,ult,blocked){
  const dirx=l.x>w.x?1:-1,adj=()=>l.x-dirx*1.9;
  const dash=async()=>{shot((w.x+l.x)/2,2.2,8,(w.x+l.x)/2,1.3,0,6,40);await mv(w,adj(),0,.3);setState(w,'idle')};
  const slash=async(v,hits,big)=>{const a=mvAct(w,0,v);playAct(w,a);shot(l.x-dirx*3.2,1.9,5.6,l.x,1.4,0,7,36);await wait(a.fireT);sfx('swing');hurt(l,hits,{big,down:big&&!blocked});if(blocked){puff(chest(l),0xcfe6ff,10,2.5,.3);sfx('block')}await wait(a.total-a.fireT)};
  const slam=async(hits)=>{const a=mvAct(w,2);playAct(w,a);shot(w.x+dirx*1,1.1,5.6,w.x+dirx*3,1.2,0,7,38);await wait(a.fireT);const c=new V3(w.x+dirx*1.5,.15,0);puff(c,0xc9b8a0,18,3.2,.6,0,2);ring(c,0x7be0ff,5.5,28);sfx('slam');shake(.6);hurt(l,hits,{big:true,down:!blocked});await wait(a.total-a.fireT)};
  await dash();
  if(ult){banner('PAMUNGKAS!','Badai pedang',1500);RT.classList.add('cine');G.fov+=4;
    await slash(0,Math.round(dmg*.18),false);await slash(1,Math.round(dmg*.22),false);await slash(2,Math.round(dmg*.2),true);await slam(Math.round(dmg*.4));RT.classList.remove('cine')}
  else if(r>=6){await slash(2,Math.round(dmg*.4),true);await slam(Math.round(dmg*.6))}
  else if(r===5){const a=mvAct(w,1);playAct(w,a);await wait(a.wind);hurt(l,dmg,{big:true,down:!blocked});sfx('swing');await wait(a.act+a.rec)}
  else if(r===4){await slash(0,Math.round(dmg*.5),false);await slash(1,Math.round(dmg*.5),false)}
  else await slash(0,dmg,false);
  setState(w,'idle');await mv(w,BASE[w.side],0,.4)}

function diceReset(){['cL','cR'].forEach(id=>{$(id).classList.remove('roll');$(id).style.transform='rotateX(-20deg) rotateY(25deg)'})}
function projClear(){flights.splice(0).forEach(q=>sc.remove(q.g))}
const options={reducedMotion:false};
/* ===== Alur duel (dipandu main.js; aturan dari duel-core.js, dadu dari server/Math.random) =====
   Urutan: open -> intro -> [waitForRoll -> lockRoll -> revealRolls -> turn] x (maks 3) -> result -> close. */
let epoch=0,rollRes=null,rollTimer=0,rollTick=0;
const ROLL_LIMIT_MS=5000;      /* lewat 5 detik tanpa tap ROLL -> otomatis roll */
function ensureAudio(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}
const rollSmall=()=>$('roll').querySelector('small');
function clearRollTimer(){clearTimeout(rollTimer);clearInterval(rollTick);rollTimer=rollTick=0;const s=rollSmall();if(s)s.textContent='SPASI'}
function pressRoll(){if(!rollRes||$('roll').disabled)return;ensureAudio();$('roll').disabled=true;clearRollTimer();const r=rollRes;rollRes=null;r(true)}
$('roll').onclick=pressRoll;
addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!RT.hidden&&rollRes){e.preventDefault();pressRoll()}});
$('rot').onclick=()=>RT.classList.add('norot');   /* portrait: ketuk untuk lanjut tanpa memutar ponsel */

/* --- disposal --- */
function disposeTree(n){n.traverse(o=>{if(o.geometry)o.geometry.dispose();const m=o.material;(Array.isArray(m)?m:m?[m]:[]).forEach(x=>{if(x.map)x.map.dispose();x.dispose()})})}
function disposeFighter(f){sc.remove(f.A.root);if(f.A.noDispose)return;
  try{if(f.A.kn&&f.A.kn.dispose)f.A.kn.dispose();else if(f.A.ch)f.A.ch.dispose&&f.A.ch.dispose();else disposeTree(f.A.root)}catch(e){}}
function flushAsync(){const w=waits.splice(0),t=tweens.splice(0);w.forEach(x=>x.r());t.forEach(x=>x.r())}
function clearFx(){projClear();for(const p of parts)sc.remove(p.m);parts.length=0;RT.querySelectorAll('.dmg').forEach(d=>d.remove())}

/* --- potret & dadu --- */
function portraitSet(id,url,f){
  const c=$(id),port=c.parentNode;let im=port.querySelector('img');
  if(url){if(!im){im=document.createElement('img');im.alt='';im.style.cssText='width:100%;height:100%;display:block;object-fit:cover;image-rendering:pixelated';port.appendChild(im)}
    im.src=url;im.style.display='';c.style.display='none';return}
  if(im)im.style.display='none';c.style.display='';
  const x=c.getContext('2d'),ar=f&&f.kind==='archer';x.clearRect(0,0,16,16);
  x.fillStyle=ar?'#f6d93a':'#2a2a36';x.fillRect(0,0,16,16);
  if(f&&f.A&&f.A.tex&&f.A.tex[0])x.drawImage(f.A.tex[0].image,0,0,16,16);
  x.fillStyle=ar?'#f6d93a':'#f0c040';x.fillRect(0,0,16,3)}
let diceCatP=null;
const shade=(hex,k)=>{const m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex||'');if(!m)return hex;return '#'+[1,2,3].map(i=>Math.round(parseInt(m[i],16)*k).toString(16).padStart(2,'0')).join('')};
function diceSkin(i,sk){const d=$(i?'dieR':'dieL');d.style.setProperty('--df1',sk.face);d.style.setProperty('--df2',shade(sk.face,.86));d.style.setProperty('--dp',sk.pip);d.style.setProperty('--dr',sk.rim)}
function diceSkinReset(){['dieL','dieR'].forEach(id=>['--df1','--df2','--dp','--dr'].forEach(p=>$(id).style.removeProperty(p)))}
function loadDiceSkin(key,i){const ep=epoch;
  try{if(!diceCatP)diceCatP=import('../../assets/js/renderers/dice-kit/dice-catalog.js');
    diceCatP.then(m=>{if(ep!==epoch)return;const d=m.getDice?m.getDice(key):null,mt=d&&d.material;if(!mt)return;
      diceSkin(i,{face:mt.base||'#f4ead2',pip:(mt.pip&&mt.pip.color)||'#1c2a4a',rim:mt.accent||'#d9b45a'})}).catch(()=>{})}catch(e){}}

/* --- pasang petarung --- */
function setup(o){
  for(const f of[P,E])if(f)disposeFighter(f);
  const sp=o.fighters||[],nm=o.names||[],cs=o.css||[],fc=o.faces||[];
  P=mkFighter(Object.assign({},sp[0],{name:nm[0]||'KAMU'}),0);E=mkFighter(Object.assign({},sp[1],{name:nm[1]||'LAWAN'}),1);
  resetFighters();
  $('nl').textContent=nm[0]||'KAMU';$('nr').textContent=nm[1]||'LAWAN';
  $('nl').style.color=cs[0]||'';$('nr').style.color=cs[1]||'';
  portraitSet('pgL',fc[0],P);portraitSet('pgR',fc[1],E)}

/* --- akhir duel --- */
async function matchEnd(w,l,ko){G.phase='ko';if(ko){l.hp=0;setState(l,'dead')}setState(w,'win');
  banner(ko?'K.O.':'PEMENANG',ko?w.name+' menang':'Darah lebih banyak tersisa',2400,ko);sfx(ko?'ko':'bell');RT.classList.add('cine');
  if(ko){G.ts=.25;G.tsT=1.3}
  shot(w.x+(w.x>0?-2:2),1.5,4.4,w.x,1.3,0,3,34);await wait(.6);shot(w.x+(w.x>0?-2.5:2.5),1.2,3.4,w.x,1.3,0,2,32);await wait(2.4);G.phase='result'}
async function drawEnd(){G.phase='ko';banner('SERI!','Darah sama, tidak ada pemenang',2200);sfx('bell');RT.classList.add('cine');
  for(const f of[P,E])setState(f,'guard');puff(new V3(0,1.4,0),0xffffff,20,4,.4);ring(new V3(0,.2,0),0xffd84a,3,20);
  shot(0,1.9,6.2,0,1.4,0,3,34);await wait(2.2);for(const f of[P,E])setState(f,'idle');G.phase='result'}

/* --- satu giliran: res = hasil Duel.round(...).turn --- */
async function playTurn(res){
  G.ko=!!(res.over&&res.by==='ko');G.phase='act';RT.classList.add('act');
  const w=res.winner===0?P:res.winner===1?E:null;
  if(!w){banner('IMBANG!','Dadu kembar, senjata beradu',1200);for(const f of[P,E])setState(f,'guard');
    puff(new V3(0,1.4,0),0xffffff,20,4,.4);ring(new V3(0,.2,0),0xffd84a,3,20);sfx('parry');shake(.3);shot(0,1.9,6.2,0,1.4,0,6,34);await wait(1.2);for(const f of[P,E])setState(f,'idle')}
  else{const l=other(w),rw=res.rolls[w.side],ult=res.ult,blocked=res.blocked,dmg=res.dmg;
    if(blocked){setState(l,'guard');floatText(chest(l).setY(2.4),'TANGKIS','#cfe6ff')}
    label(w.side,ACT_NAME[rw],ult?'PAMUNGKAS':ACT_NAME[rw],1);
    if(w.kind==='archer')await archerAttack(w,l,rw,dmg,ult,blocked);else await knightAttack(w,l,rw,dmg,ult,blocked);
    if(!G.ko&&l.state!=='dead'){await wait(.3);if(l.state==='down'){await wait(.9)}setState(l,'idle');await mv(l,BASE[l.side],0,.35)}}
  const mx=res.max||100;P.hp=res.hp[0]*100/mx;E.hp=res.hp[1]*100/mx;G.turn=res.n;hud();
  if(res.over){if(res.draw||res.dw==null)await drawEnd();else{const dw=res.dw===0?P:E;await matchEnd(dw,other(dw),res.by==='ko')}return}
  label(0,'—','SIAP');label(1,'—','SIAP');baseShot();RT.classList.remove('act');G.phase='wait'}

const UI={
  /* o: {names,css,faces,dice,reducedMotion,fighters:[{rig|config|preset|local|knight|model},...]}. Tanpa fighters = layar pilih lawan saja. */
  open(o){o=o||{};ensureAudio();epoch++;flushAsync();clearRollTimer();rollRes=null;
    RT.hidden=false;RT.classList.remove('norot','act','cine','selecting','out');document.body.classList.add('duel-active');
    try{window.dispatchEvent(new Event('ut:duel-open'))}catch(e){}
    $('result').style.display='none';$('choose').hidden=true;
    if(!o.fighters){RT.classList.add('selecting');loopStop();return true}
    options.reducedMotion=!!o.reducedMotion;
    diceSkinReset();(o.dice||[]).slice(0,2).forEach((k,i)=>{if(k)loadDiceSkin(k,i)});
    clearFx();Object.assign(G,{phase:'intro',turn:0,ko:false,ts:1,tsT:0,shake:0,fov:0,paused:false,busy:true});
    setup(o);label(0,'—','SIAP');label(1,'—','SIAP');diceReset();baseShot();camInit=false;
    $('roll').disabled=true;$('hint').textContent='';$('vs').classList.remove('on');$('banner').classList.remove('on');
    resize();hud();loopStart();return true},
  chooseOpponent(foes){const ch=$('choose');ch.innerHTML='';const h=document.createElement('b');h.textContent='PILIH LAWAN';ch.appendChild(h);ch.hidden=false;
    return new Promise(res=>{foes.forEach((foe,i)=>{const b=document.createElement('button');b.type='button';b.textContent=foe.name;b.style.setProperty('--pc',foe.css||'#f6cf55');
      b.addEventListener('click',()=>{ch.hidden=true;RT.classList.remove('selecting');res(i)},{once:true});ch.appendChild(b)})})},
  async intro(){const ep=epoch;RT.classList.add('act','cine');projClear();G.phase='intro';diceReset();baseShot();
    $('vs').classList.add('on');banner('DUEL 3 GILIRAN',P.name+'  VS  '+E.name,1800);sfx('bell');
    const q=options.reducedMotion?.25:1;
    shot(-5,1.6,6,0,1.4,0,3,34);await wait(q);shot(5,1.6,7,0,1.4,0,3,36);await wait(q);
    $('vs').classList.remove('on');baseShot();RT.classList.remove('cine','act');G.phase='wait';G.busy=false},
  /* true = pemain menekan ROLL (atau 5 detik habis -> otomatis); false = UI ditutup / dikunci */
  waitForRoll(round){const b=$('roll');b.disabled=false;G.phase='wait';diceReset();label(0,'—','SIAP');label(1,'—','SIAP');
    $('hint').style.opacity=1;if(!$('hint').textContent)$('hint').textContent='Tekan ROLL untuk giliran '+round+' dari 3.';
    return new Promise(res=>{if(rollRes)rollRes(false);rollRes=res;clearRollTimer();let left=Math.round(ROLL_LIMIT_MS/1000);const s=rollSmall();if(s)s.textContent=left+' dtk';
      rollTick=setInterval(()=>{left--;const t=rollSmall();if(t&&left>0)t.textContent=left+' dtk'},1000);rollTimer=setTimeout(pressRoll,ROLL_LIMIT_MS)})},
  /* online: kunci tombol ROLL (sudah tap / menunggu lawan / penonton); melepas waitForRoll yang menggantung (false) */
  lockRoll(label_){clearRollTimer();$('roll').disabled=true;if(label_)$('hint').textContent=label_;$('hint').style.opacity=1;
    if(rollRes){const r=rollRes;rollRes=null;r(false)}},
  /* dadu berguling lalu mendarat; values = [dadu pemain 0, dadu pemain 1] */
  async revealRolls(values){const ep=epoch;ensureAudio();baseShot();G.phase='roll';$('hint').style.opacity=0;
    label(0,'—','MELEMPAR…');label(1,'—','MELEMPAR…');diceRoll(true);sfx('roll');await wait(options.reducedMotion?.4:1.3);
    diceRoll(false);diceFace('cL',values[0]);diceFace('cR',values[1]);sfx('hit');
    label(0,values[0]+' · '+ACT_NAME[values[0]],ACT_NAME[values[0]],1);label(1,values[1]+' · '+ACT_NAME[values[1]],ACT_NAME[values[1]],1);
    await wait(1.1)},
  /* hp: [hp0,hp1] (dari duel-core), turns = giliran yang sudah selesai */
  state(hp,turns,max){max=max||100;if(P&&E){P.hp=hp[0]*100/max;E.hp=hp[1]*100/max}if(turns!=null)G.turn=turns;hud()},
  async turn(res){const ep=epoch;try{await playTurn(res)}catch(e){if(ep===epoch)console.error('[duel] giliran gagal',e)}},
  banner(text,sub,ms){banner(text,sub||'',ms||1400)},
  log(text){$('hint').textContent=text||'';$('hint').style.opacity=1},
  pop(side,text){floatText(chest(side?E:P).setY(2.3),text,'#fff')},
  shake(){shake(.4)},
  act(side,type){const f=side?E:P;if(!f)return;if(type==='cheer'||type==='win')setState(f,'win');else if(type==='sad'||type==='ko')setState(f,'down')},
  impact(side,cls){const f=side?E:P;if(!f)return;f.flash=1;shake(cls==='heavy'?.4:.16);sfx(cls==='block'?'block':'hit')},
  result(title,lines,outcome){const h=$('rh');h.textContent=title;h.className=outcome==='lose'?'lose':'';
    const dl=$('rdl');dl.innerHTML='';(lines||[]).forEach(t=>{const d=document.createElement('div');d.className='rl';d.textContent=t;dl.appendChild(d)});
    $('result').style.display='flex';$('hint').style.opacity=0;$('roll').disabled=true},
  close(){if(RT.hidden)return;epoch++;clearRollTimer();if(rollRes){const r=rollRes;rollRes=null;r(false)}
    document.body.classList.remove('duel-active');try{window.dispatchEvent(new Event('ut:duel-close'))}catch(e){}
    RT.hidden=true;RT.classList.remove('act','cine','selecting','norot');$('result').style.display='none';$('choose').hidden=true;
    $('vs').classList.remove('on');$('banner').classList.remove('on');G.ts=1;G.tsT=0;
    loopStop();flushAsync();clearFx();for(const f of[P,E])if(f)disposeFighter(f)}
};


/* ===== Loop ===== */
let last=performance.now(),raf=0,running=false;
function frame(nw){if(!running)return;raf=requestAnimationFrame(frame);let dt=Math.min(.05,(nw-last)/1000);last=nw;if(G.paused)dt=0;
  if(G.tsT>0){G.tsT-=dt;if(G.tsT<=0)G.ts=1}
  const rdt=dt;dt*=G.ts;G.clock+=dt;const now=G.clock;
  for(let i=waits.length-1;i>=0;i--){const w=waits[i];w.t-=dt;if(w.t<=0){waits.splice(i,1);w.r()}}
  for(let i=tweens.length-1;i>=0;i--){const q=tweens[i];q.t+=dt;const k=Math.min(1,q.t/q.dur),e=ease(k);q.f.x=lerp(q.x0,q.x1,e);q.f.z=lerp(q.z0,q.z1,e);
    q.f.vx=k<1?(q.x1-q.x0)/q.dur*(Math.abs(q.x1-q.x0)>.01?1:0):0;if(k>=1){q.f.vx=0;tweens.splice(i,1);q.r()}}
  for(const f of[P,E]){if(!f)continue;f.t+=dt;f.flash=Math.max(0,f.flash-dt*3.5);
    if(f.state==='hit'&&f.t>=f.hitLen)setState(f,'idle');
    if(f.state==='idle'&&Math.abs(f.vx)<.01){f.yaw+=wrap((f.side?-Math.PI/2:Math.PI/2)-f.yaw)*Math.min(1,dt*10)}
    if(f.state==='idle'&&Math.abs(f.vx)>.01){f.yaw=Math.atan2(Math.sign(f.vx),0)}
    render(f,dt,now)}
  stepFlights(dt);partStep(dt);
  torches.forEach(([a,b],i)=>{a.scale.setScalar(1+Math.sin(now*9+i)*.12);b.scale.setScalar(.8+Math.sin(now*11+i*2)*.2)});
  clouds.forEach(c=>{c.userData.a+=c.userData.sp*rdt*.01;const a=c.userData.a;c.position.x=Math.cos(a)*55;c.position.z=Math.sin(a)*55;c.rotation.y=-a});
  flags.forEach((f,i)=>f.rotation.y=Math.sin(now*2+i)*.15);
  sun.position.set(-14,18,12);sun.target.position.set(0,0,0);
  hud();camUpdate(rdt,performance.now()/1000);rd.render(sc,cam)}
function loopStart(){if(running)return;running=true;last=performance.now();raf=requestAnimationFrame(frame)}
function loopStop(){running=false;cancelAnimationFrame(raf)}
      return UI;
    })(T, RT);
  }

  function api() {
    if (inner || bootFailed) return inner;
    try { inner = boot(); }
    catch (e) { bootFailed = true; console.error('[duel] arena gagal dibuat', e); var r = document.getElementById('du2'); if (r && r.parentNode) r.parentNode.removeChild(r); }
    return inner;
  }
  var done = function () { return Promise.resolve(); };
  var UI = {
    /* false = arena tidak bisa dibuat (mis. Three.js/WebGL tak ada): pemanggil melewati duel */
    open: function (o) { var u = api(); return u ? u.open(o) : false; },
    chooseOpponent: function (foes) { var u = api(); return u ? u.chooseOpponent(foes) : Promise.resolve(Math.floor(Math.random() * foes.length)); },
    intro: function () { return inner ? inner.intro() : done(); },
    waitForRoll: function (n) { return inner ? inner.waitForRoll(n) : Promise.resolve(false); },
    revealRolls: function (v) { return inner ? inner.revealRolls(v) : done(); },
    turn: function (res) { return inner ? inner.turn(res) : done(); }
  };
  ['lockRoll', 'state', 'banner', 'log', 'pop', 'shake', 'act', 'impact', 'result', 'close'].forEach(function (n) {
    UI[n] = function () { if (inner) return inner[n].apply(inner, arguments); };
  });
  UT.GameplayDuelUI = UI;
})();
