/* assets/js/blocky-character.js — GENERATED dari karakter.html oleh tools/blocky-character/build.js. JANGAN edit manual.
   Karakter blocky (rig + katalog item + builder + animasi) yang SAMA dengan halaman Karakter, tanpa UI/scene/kamera.
   Dipakai halaman lain (mis. efek.html) agar menampilkan karakter pemain yang sebenarnya.
   Regenerasi bila karakter.html berubah:  node tools/blocky-character/build.js
   Perlu: global THREE (r128), ItemCatalog, PlayerData (dimuat sebelum create() dipanggil).

   const c = UT.BlockyCharacter.create(THREE);   // c.root = THREE.Group (kaki di y=0, menghadap +z, tinggi ~2 satuan)
   c.loadFromPlayer();                           // pakai penampilan + gear milik pemain (PlayerData)
   c.setMode('idle'|'walk'|'run'); c.jump();     // per frame: c.tick(dt)
*/
(function(){
window.UT=window.UT||{};
UT.BlockyCharacter={create:function(THREE,opts){
opts=opts||{};
/*UTIL*/
/*BODY*/
/* ---- API (loop & loadCfg disalin dari bagian 12 karakter.html) ---- */
function tick(dt){
  dt=Math.min(Math.max(dt,0),0.05);time+=dt;
  const tl=mode==='walk'?1:(mode==='run'?2:0);
  level+=(tl-level)*(1-Math.exp(-dt*7));
  phase+=dt*(6.5+4.5*clamp(level-1,0,1));
  if(airborne){vy-=22*dt;jumpY+=vy*dt;if(jumpY<=0){jumpY=0;vy=0;airborne=false;landT=0.25;}}
  if(landT>0)landT-=dt;
  const k=1-Math.exp(-dt*(airborne?26:12));
  const T=computeTarget();
  for(const key in T)P[key]+=(T[key]-P[key])*k;
  applyRig();
}
function jump(){if(!airborne){airborne=true;vy=7.2;}}
function setMode(m){mode=m;}
function loadFromPlayer(){
  const L=PD.look(),G=PD.gearLook();
  if(!L){cfg=clone(DEFAULT);apply(null,true);return;}
  const o={gender:L.gender,skin:L.skin,eyes:L.eyes,hair:L.hair,body:L.body,accessories:[]};
  ['top','legs','boots','helm','chest','shoulder','cape','weapon'].forEach(k=>{
    const g=G['g.'+k],ci=g&&IC.byId(g.id);
    o[k]=ci?{id:ci.gameKey,dye:g.dye||undefined}:{id:'none'};
  });
  ACCS.forEach(a=>{const g=G['g.acc.'+a.id];if(g)o.accessories.push({id:a.id,dye:g.dye||undefined});});
  cfg=clone(DEFAULT);apply(o,true);
}
apply(null,true);
return{root:root,tick:tick,jump:jump,setMode:setMode,loadFromPlayer:loadFromPlayer,apply:apply,
  get config(){return clone(cfg);},get airborne(){return airborne;},
  height:function(){return 2*root.scale.y;}};
}};
})();
