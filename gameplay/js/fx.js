/* Gameplay FX — efek visual murni dengan skala perangkat, tier, dan reduced-motion.
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
  var currentQuality = null, reducedMq = null, tracked = [], configuredQuality = null;
  var QUALITY = {
    low: { scale: 0.5, cap: 120, particles: { maxParticles: 40, maxBurst: 12 } },
    medium: { scale: 1.0, cap: 220, particles: { maxParticles: 60, maxBurst: 20 } },
    high: { scale: 1.3, cap: 320, particles: { maxParticles: 100, maxBurst: 30 } },
    ultra: { scale: 1.6, cap: 450, particles: { maxParticles: 150, maxBurst: 45 } }
  };
  var ITEM_TIER = { L1: 0.4, L2: 0.8, L3: 1.3, L4: 2.0 };

  function detectQuality() {
    try {
      var nav = win.navigator || {};
      var user = nav.userAgent || '';
      var mobile = /Android|iPhone|iPad|Mobile/i.test(user);
      var mem = nav.deviceMemory || 4;
      var cores = nav.hardwareConcurrency || 4;
      if (mem <= 2 || (cores <= 2 && mobile)) return 'low';
      if (mobile || cores <= 4 || mem <= 4) return 'medium';
      if (cores >= 8 && mem >= 8) return 'ultra';
      return 'high';
    } catch (e) { return 'medium'; }
  }

  function reduced() {
    try {
      if (!reducedMq && win.matchMedia) reducedMq = win.matchMedia('(prefers-reduced-motion: reduce)');
      return !!(reducedMq && reducedMq.matches);
    } catch (e) { return false; }
  }

  function quality() {
    if (!currentQuality) currentQuality = detectQuality();
    return currentQuality;
  }

  function limit() {
    var q = QUALITY[quality()] || QUALITY.medium;
    return q.cap;
  }

  function tierMultiplier(tier) {
    var value = tier;
    if (value && typeof value === 'object') value = value.effectTier || value.itemTier || value.tier;
    if (typeof value === 'number' && value >= 1 && value <= 4 && Math.floor(value) === value) value = 'L' + value;
    value = typeof value === 'string' ? value.toUpperCase() : '';
    return ITEM_TIER[value] || ITEM_TIER.L2;
  }

  function n(base, tier) {
    var val = Number(base);
    if (!isFinite(val)) val = 0;
    var q = QUALITY[quality()] || QUALITY.medium;
    var motion = reduced() ? 0.4 : 1;
    return Math.max(1, Math.min(q.cap, Math.round(val * tierMultiplier(tier) * q.scale * motion)));
  }

  function activeCount() {
    return confetti.length + sparks.length + blasts.length;
  }

  function availableCount() {
    var q = QUALITY[quality()] || QUALITY.medium;
    return Math.max(0, q.cap - activeCount());
  }

  function scaledCount(base, tier, available) {
    return Math.min(n(base, tier), available == null ? availableCount() : available);
  }

  function applyParticlePreset() {
    if (!win.UT || !win.UT.ParticleFX || typeof win.UT.ParticleFX.configure !== 'function') return;
    var name = quality(), q = QUALITY[name] || QUALITY.medium;
    if (configuredQuality === name) return;
    var preset = q.particles;
    try {
      win.UT.ParticleFX.configure({
        maxParticles: Math.min(q.cap, preset.maxParticles),
        maxBurst: Math.min(preset.maxParticles, preset.maxBurst)
      });
      configuredQuality = name;
    } catch (e) {
      if (win.console && win.console.warn) win.console.warn('[gameplay-fx] konfigurasi ParticleFX gagal', e);
    }
  }

  function track(item) {
    if (!item || typeof item.update !== 'function') return null;
    tracked.push(item);
    return item;
  }

  function stopAll() {
    for (var i = tracked.length - 1; i >= 0; i--) {
      try { if (tracked[i] && typeof tracked[i].stop === 'function') tracked[i].stop(); } catch (e) {}
      try { if (tracked[i] && typeof tracked[i].dispose === 'function') tracked[i].dispose(); } catch (e) {}
    }
    tracked.length = 0;
  }

  function init(sc) {
    if (!sc || !win.THREE) return false;
    scene = sc;
    applyParticlePreset();
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

  function spawnConfetti(pos, tier) {
    if (!scene) return;
    var count = scaledCount(138, tier);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(CONF_GEO, CONF_MATS[i % CONF_MATS.length]);
      m.position.set(pos.x, pos.y + 0.8, pos.z);
      scene.add(m);
      confetti.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), life: 2.6 + Math.random() * 1.4 });
    }
  }
  /* Ledakan api (TNT / Creeper / hit): serpihan api oranye-merah menyembur + asap abu naik. Menggantikan konfeti warna-warni untuk semua ledakan. */
  function spawnExplosion(pos, kind, tier) {
    if (!scene) return;
    var available = availableCount(), baseFire = 45, baseSmoke = 27.5;
    var en = kind === 'ender', bits = en ? ENDER_MATS : FIRE_MATS, smk = en ? ESMOKE_MATS : SMOKE_MATS;
    var NB = scaledCount(baseFire, tier, available), NS = scaledCount(baseSmoke, tier, available - NB);
    if (!NB && !NS) return;
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
  function clearConfetti() { if (!scene) return; confetti.forEach(c=>scene.remove(c.m)); confetti.length=0; blasts.forEach(b=>scene.remove(b.m)); blasts.length=0; sparks.forEach(q=>{ try { scene.remove(q.m); if (q.m.material) q.m.material.dispose(); } catch (e) {} }); sparks.length=0; }
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

  function sparkle(pos, tier) {
    if (!scene) return;
    var count = scaledCount(18, tier);
    for(let i=0;i<count;i++){
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

  UT.GameplayFX = { quality: quality, limit: limit, n: n, reduced: reduced, track: track, stopAll: stopAll, init: init, spawnConfetti: spawnConfetti, spawnExplosion: spawnExplosion, updateConfetti: updateConfetti, clearConfetti: clearConfetti, sparkle: sparkle, updateSparks: updateSparks };
})(window);
