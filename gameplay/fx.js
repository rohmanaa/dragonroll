/* Gameplay FX (Stage 4.1.13) — HANYA efek visual murni: konfeti (kemenangan/teleport/ledakan TNT) dan sparkle peti.
   Kode dipindahkan APA ADANYA dari gameplay.html (jumlah partikel, ukuran, warna, kecepatan, gravitasi, umur, urutan Math.random tidak diubah).
   Variasi Math.random di sini hanya untuk tampilan (sebar partikel), bukan hasil gameplay.
   Modul BUKAN pemilik scene/kamera/renderer: scene diberikan gameplay lewat init(scene). Tidak memanggil feedback/HUD, tanpa localStorage, tanpa timer,
   tanpa game loop kedua: update dipanggil dari loop animasi milik gameplay (pada titik yang sama seperti sebelumnya).
   Tetap di gameplay.html: explode/teleport (mengubah pawn + tween + sfx), salju/ember tema, animasi mob/ular, kamera, Dragon, state & guard gameId/STALE.
   Classic script. Namespace: UT.GameplayFX.
   API: init(scene) · spawnConfetti(pos) · updateConfetti(dt) · clearConfetti() · sparkle(pos) · updateSparks(dt) */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayFX) return;

  var scene = null, confetti = [], sparks = [], CONF_GEO = null, CONF_MATS = null, SPARK_GEO = null;

  function init(sc) {
    if (!sc || !win.THREE) return false;
    scene = sc;
    if (!CONF_GEO) { /* sumber daya dibuat sekali, nilai sama dengan kode lama */
      CONF_GEO = new THREE.BoxGeometry(0.14, 0.14, 0.14);
      CONF_MATS = [0xF0453A, 0x2F80FF, 0xFFC21A, 0xA855F7, 0x45C94B, 0xFFFFFF].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
      SPARK_GEO = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    }
    return true;
  }

  function spawnConfetti(pos) {
    if (!scene) return;
    for(let i=0;i<110;i++){
      const m=new THREE.Mesh(CONF_GEO,CONF_MATS[i%CONF_MATS.length]);
      m.position.set(pos.x,pos.y+0.8,pos.z);
      scene.add(m);
      confetti.push({m,v:new THREE.Vector3((Math.random()-0.5)*6,4+Math.random()*5,(Math.random()-0.5)*6),r:new THREE.Vector3(Math.random()*6,Math.random()*6,Math.random()*6),life:2.6+Math.random()*1.4});
    }
  }
  function clearConfetti() { if (!scene) return; confetti.forEach(c=>scene.remove(c.m)); confetti.length=0; }
  function updateConfetti(dt) {
    if (!scene) return;
    for(let i=confetti.length-1;i>=0;i--){
      const c=confetti[i]; c.life-=dt; c.v.y-=14*dt;
      c.m.position.addScaledVector(c.v,dt);
      c.m.rotation.x+=c.r.x*dt; c.m.rotation.y+=c.r.y*dt; c.m.rotation.z+=c.r.z*dt;
      if(c.life<=0){ scene.remove(c.m); confetti.splice(i,1); }
    }
  }

  function sparkle(pos) {
    if (!scene) return;
    for(let i=0;i<14;i++){
      const m=new THREE.Mesh(SPARK_GEO,new THREE.MeshBasicMaterial({color:i%3?0xFFE58A:0xFFFFFF,transparent:true,fog:false}));
      m.position.set(pos.x+(Math.random()-0.5)*0.3,pos.y,pos.z+(Math.random()-0.5)*0.3); scene.add(m);
      sparks.push({m,v:new THREE.Vector3((Math.random()-0.5)*0.9,0.7+Math.random()*0.9,(Math.random()-0.5)*0.9),life:1,max:1});
      sparks[sparks.length-1].life=sparks[sparks.length-1].max=0.8+Math.random()*0.5;
    }
  }
  function updateSparks(dt) {
    if (!scene) return;
    for(let i=sparks.length-1;i>=0;i--){
      const q=sparks[i]; q.life-=dt; q.m.position.addScaledVector(q.v,dt); q.v.y-=0.5*dt; q.m.material.opacity=Math.max(0,q.life/q.max);
      if(q.life<=0){ scene.remove(q.m); q.m.material.dispose(); sparks.splice(i,1); }
    }
  }

  UT.GameplayFX = { init: init, spawnConfetti: spawnConfetti, updateConfetti: updateConfetti, clearConfetti: clearConfetti, sparkle: sparkle, updateSparks: updateSparks };
})(window);
