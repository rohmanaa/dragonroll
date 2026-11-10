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

  var scene = null, confetti = [], sparks = [], blasts = [], CONF_GEO = null, CONF_MATS = null, SPARK_GEO = null, FIRE_MATS = null, SMOKE_MATS = null, ENDER_MATS = null, ESMOKE_MATS = null;

  function init(sc) {
    if (!sc || !win.THREE) return false;
    scene = sc;
    if (!CONF_GEO) { /* sumber daya dibuat sekali, nilai sama dengan kode lama */
      CONF_GEO = new THREE.BoxGeometry(0.14, 0.14, 0.14);
      CONF_MATS = [0xF0453A, 0x2F80FF, 0xFFC21A, 0xA855F7, 0x45C94B, 0xFFFFFF].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
      SPARK_GEO = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      /* palet api: putih-kuning -> oranye -> merah (menyala, tidak kena cahaya) + asap abu gelap */
      FIRE_MATS = [0xFFF2A0, 0xFFC93C, 0xFF9A1A, 0xFF6A00, 0xE8340A].map(function (c) { return new THREE.MeshBasicMaterial({ color: c, fog: false }); });
      ENDER_MATS = [0xDD66FF, 0xB84DFF, 0xFFE6FF, 0x241C30, 0x15121C, 0xDD66FF].map(function (c) { return new THREE.MeshBasicMaterial({ color: c, fog: false }); }); /* palet Enderman: ungu partikel + hitam */
      ESMOKE_MATS = [0x15121C, 0x241C30, 0x3A2A55, 0x55407A].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
      SMOKE_MATS = [0x26262B, 0x34343A, 0x4A4A52, 0x6B6B73].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
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
  /* Ledakan api (TNT / Creeper / hit): serpihan api oranye-merah menyembur + asap abu naik. Menggantikan konfeti warna-warni untuk semua ledakan. */
  function spawnExplosion(pos, kind) {
    if (!scene) return;
    const en = kind === 'ender', bits = en ? ENDER_MATS : FIRE_MATS, smk = en ? ESMOKE_MATS : SMOKE_MATS, NB = 36, NS = 22;
    for (let i = 0; i < NB + NS; i++) {
      const fire = i < NB, sz = fire ? 0.045 + Math.random() * 0.07 : 0.1 + Math.random() * 0.14; /* serpihan kecil; asap sedikit lebih besar */
      const m = new THREE.Mesh(CONF_GEO, fire ? bits[Math.floor(Math.random() * bits.length)] : smk[Math.floor(Math.random() * smk.length)]);
      m.position.set(pos.x + (Math.random() - 0.5) * 0.25, pos.y + 0.45, pos.z + (Math.random() - 0.5) * 0.25);
      m.scale.setScalar(sz / 0.14); scene.add(m);
      const sp = fire ? 1.6 + Math.random() * 2.6 : 0.4 + Math.random() * 0.8, an = Math.random() * Math.PI * 2;
      blasts.push({ m: m, s0: sz / 0.14, fire: fire, v: new THREE.Vector3(Math.cos(an) * sp, fire ? 1.2 + Math.random() * 2.8 : 0.8 + Math.random() * 1.1, Math.sin(an) * sp), r: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5), life: fire ? 0.5 + Math.random() * 0.4 : 1.0 + Math.random() * 0.7, max: 1 });
      blasts[blasts.length - 1].max = blasts[blasts.length - 1].life;
    }
  }
  function updateBlasts(dt) {
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i]; b.life -= dt;
      b.v.y += (b.fire ? -9 : 1.2) * dt; /* api jatuh, asap naik */
      b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.x += b.r.x * dt; b.m.rotation.y += b.r.y * dt;
      const k = Math.max(0, b.life / b.max);
      b.m.scale.setScalar(b.s0 * (b.fire ? k : 0.6 + (1 - k) * 0.9)); /* api mengecil, asap membesar lalu hilang */
      if (!b.fire && k < 0.25) b.m.scale.setScalar(b.s0 * 1.5 * (k / 0.25));
      if (b.life <= 0) { scene.remove(b.m); blasts.splice(i, 1); }
    }
  }
  function clearConfetti() { if (!scene) return; confetti.forEach(c=>scene.remove(c.m)); confetti.length=0; blasts.forEach(b=>scene.remove(b.m)); blasts.length=0; }
  function updateConfetti(dt) {
    if (!scene) return;
    updateBlasts(dt);
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

  UT.GameplayFX = { init: init, spawnConfetti: spawnConfetti, spawnExplosion: spawnExplosion, updateConfetti: updateConfetti, clearConfetti: clearConfetti, sparkle: sparkle, updateSparks: updateSparks };
})(window);
