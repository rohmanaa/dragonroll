/* assets/js/blocky-character.js — GENERATED dari karakter.html oleh tools/blocky-character/build.js. JANGAN edit manual.
   Karakter blocky (rig + katalog item + builder + animasi) yang SAMA dengan halaman Karakter, tanpa UI/scene/kamera.
   Dipakai halaman lain (mis. efek.html) agar menampilkan karakter pemain yang sebenarnya.
   Regenerasi bila karakter.html berubah:  node tools/blocky-character/build.js
   Perlu: global THREE (r128), ItemCatalog, PlayerData (dimuat sebelum create() dipanggil).

   const c = UT.BlockyCharacter.create(THREE);   // c.root = THREE.Group (kaki di y=0, menghadap +z, tinggi ~2 satuan)
   c.loadFromPlayer();                           // pakai penampilan + gear milik pemain (PlayerData)
   c.setMode('idle'|'walk'|'run'); c.jump();     // per frame: c.tick(dt)
   c.loadFromData(look,equipped,gearDye);       // tampilan pemain lain dari server (room_appearance_get)
   c.loadPreset(n);                              // tampilan siap pakai deterministik (pemain lain/CPU), n = bilangan bulat
   c.act('attack'|'block'|'sad'|'cheer'[,detik]);               // aksi sekali: ayun senjata / bertahan dengan perisai / sedih / bersorak
*/
(function(){
window.UT=window.UT||{};
UT.BlockyCharacter={create:function(THREE,opts){
opts=opts||{};
/*UTIL*/
/*BODY*/
/* ---- Aksi sekali pakai (tidak ada di karakter.html): attack = ayun senjata, block = pose bertahan + perisai ----
   Ditumpuk di atas pose normal (jalan/lari/idle) lewat applyAct di tick, lalu memudar kembali. */
const ACT_W={rArmS:-2.9,rElbow:-0.5,rWrist:1.2,rArmZ:-0.15,lArmS:-0.4,lElbow:-0.5,lArmZ:0.4,lean:-0.2,twist:-0.45,headX:-0.1,headY:-0.3,rLegT:0.3,rKnee:0.1,lLegT:-0.35,lKnee:0.25,cape:0.4,tail:0.5};
const ACT_S={rArmS:-0.9,rElbow:-0.15,rWrist:-0.6,rArmZ:-0.05,lArmS:0.4,lElbow:-0.3,lArmZ:0.5,lean:0.35,twist:0.4,headX:0.1,headY:0.28,rLegT:-0.5,rKnee:0.6,lLegT:0.5,lKnee:0.05,cape:0.7,tail:0.7};
const ACT_B={rArmS:-0.55,rElbow:-1.1,rWrist:0,rArmZ:0.3,lArmS:-0.55,lElbow:-1.1,lArmZ:-0.3,lean:-0.1,twist:0,headX:0.2,headY:0,rLegT:-0.45,rKnee:0.9,lLegT:-0.3,lKnee:0.8,cape:0.5,tail:0.6};
const ACT_SAD={rArmS:0.05,rElbow:-0.1,rWrist:0,rArmZ:-0.05,lArmS:0.05,lElbow:-0.1,lArmZ:0.05,lean:0.3,twist:0,headX:0.5,headY:0,rLegT:-0.1,rKnee:0.25,lLegT:-0.05,lKnee:0.2,cape:0.1,tail:0.05};
const ACT_CHEER={rArmS:-3.0,rElbow:-0.2,rWrist:0.5,rArmZ:-0.35,lArmS:-3.0,lElbow:-0.2,lArmZ:0.35,lean:-0.1,twist:0,headX:-0.25,headY:0,cape:0.5,tail:0.8};
const ACT_STATIC={block:ACT_B,sad:ACT_SAD,cheer:ACT_CHEER};
const ACT_DUR={attack:0.75,block:1.0,sad:1.6,cheer:2.4};
let act=null;
const shield=new THREE.Group();shield.visible=false;
(function(){ /* perisai kayu berbingkai besi di ujung lengan bawah kiri (normal = arah lengan bawah, yang menghadap depan saat siku ditekuk) */
  const L=(w,h,d,c,y)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w*S,h*S,d*S),new THREE.MeshLambertMaterial({color:c}));m.position.y=y*S;shield.add(m);};
  L(11,1.6,13,0x8a8f98,-7);L(9,1.9,11,0x8a5a2b,-7.2);L(3,2.4,3,0xc9ced6,-7.5);L(9,2.0,1.4,0x6a4220,-7.25);
  armL.el.add(shield);
})();
const ease3=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function doAct(type,dur){if(!ACT_DUR[type])return;act={type:type,t:0,dur:dur||ACT_DUR[type]};shield.visible=(type==='block');}
function applyAct(T,dt){
  if(!act)return;
  act.t+=dt;const u=act.t/act.dur;
  if(u>=1){act=null;shield.visible=false;return;}
  let w,pose={};
  if(act.type==='attack'){
    let m;
    if(u<0.4){m=0;w=ease3(u/0.4);}else if(u<0.55){m=(u-0.4)/0.15;w=1;}else{m=1;w=1-ease3((u-0.55)/0.45);}
    for(const k in ACT_W)pose[k]=lerp(ACT_W[k],ACT_S[k],m);
  }else{
    w=Math.min(1,u/0.12)*Math.min(1,(1-u)/0.2);
    pose=Object.assign({},ACT_STATIC[act.type]);
    if(act.type==='block')pose.lean+=Math.sin(act.t*38)*0.05*Math.max(0,1-u*2); /* getar sesaat saat kena */
    else if(act.type==='sad')pose.headY=Math.sin(act.t*3)*0.25; /* menggeleng pelan */
    else pose.rArmZ+=Math.sin(act.t*9)*0.12,pose.lArmZ-=Math.sin(act.t*9)*0.12; /* lengan melambai saat bersorak */
  }
  for(const k in pose)T[k]=lerp(T[k],pose[k],w);
}
/* ---- API (loop & loadCfg disalin dari bagian 12 karakter.html) ---- */
function tick(dt){
  dt=Math.min(Math.max(dt,0),0.05);time+=dt;
  const tl=mode==='walk'?1:(mode==='run'?2:0);
  level+=(tl-level)*(1-Math.exp(-dt*7));
  phase+=dt*(6.5+4.5*clamp(level-1,0,1));
  if(airborne){vy-=22*dt;jumpY+=vy*dt;if(jumpY<=0){jumpY=0;vy=0;airborne=false;landT=0.25;}}
  if(landT>0)landT-=dt;
  const k=1-Math.exp(-dt*(airborne?26:12));
  const T=computeTarget();applyAct(T,dt);
  for(const key in T)P[key]+=(T[key]-P[key])*k;
  applyRig();
}
function jump(){if(!airborne){airborne=true;vy=7.2;}}
function setMode(m){mode=m;}
/* Tampilan siap pakai (preset gear + gaya rambut/kulit bervariasi) untuk pemain lain/CPU: n bilangan bulat, deterministik. */
function loadPreset(n){
  n=Math.abs(n|0);const p=PRESETS[n%PRESETS.length],f=p.g==='f';
  const hairs=f?['bob','long','pony','twin','bun','braid','wavy']:['short','spiky','buzz'],dyes=['brown','black','blonde','red','brown'];
  const o={gender:p.g,skin:'s'+(1+(n*2)%5),eyes:{id:f?'lash':'round',dye:'blue'},hair:{id:hairs[n%hairs.length],dye:dyes[n%dyes.length]}};
  Object.assign(o,clone(p.set));
  cfg=clone(DEFAULT);apply(o,true);
}
function loadLook(L,G){
  if(!L){cfg=clone(DEFAULT);apply(null,true);return;}
  const o={gender:L.gender,skin:L.skin,eyes:L.eyes,hair:L.hair,body:L.body,accessories:[]};
  ['top','legs','boots','helm','chest','shoulder','cape','weapon'].forEach(k=>{
    const g=G['g.'+k],ci=g&&IC.byId(g.id);
    o[k]=ci?{id:ci.gameKey,dye:g.dye||undefined}:{id:'none'};
  });
  ACCS.forEach(a=>{const g=G['g.acc.'+a.id];if(g)o.accessories.push({id:a.id,dye:g.dye||undefined});});
  cfg=clone(DEFAULT);apply(o,true);
}
function loadFromPlayer(){loadLook(PD.look(),PD.gearLook());}
/* Tampilan pemain lain dari server (AppearanceService.roomAppearance): look + equipped {slot:itemId} + gearDye {itemId:warna}. */
function loadFromData(look,equipped,gearDye){
  const G={},eq=equipped||{},gd=gearDye||{};
  for(const k in eq){if(k.indexOf('g.')===0&&eq[k])G[k]={id:eq[k],dye:gd[eq[k]]||null};}
  try{loadLook(look||null,G);}catch(e){cfg=clone(DEFAULT);apply(null,true);}
}
apply(null,true);
return{root:root,tick:tick,jump:jump,setMode:setMode,act:doAct,loadFromPlayer:loadFromPlayer,loadFromData:loadFromData,loadPreset:loadPreset,presetCount:PRESETS.length,apply:apply,
  get acting(){return act?act.type:null;},
  get config(){return clone(cfg);},get airborne(){return airborne;},
  height:function(){return 2*root.scale.y;}};
}};
})();
