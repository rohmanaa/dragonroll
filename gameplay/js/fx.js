/* Gameplay FX — efek visual murni dengan skala perangkat, tier, dan reduced-motion.
   Variasi Math.random di sini hanya untuk tampilan (sebar partikel), bukan hasil gameplay.
   Modul BUKAN pemilik scene/kamera/renderer: scene diberikan gameplay lewat init(scene). Tidak memanggil feedback/HUD atau localStorage dan tidak membuat loop kedua;
   update dipanggil dari loop animasi milik gameplay (pada titik yang sama seperti sebelumnya), sementara timer FX dilacak agar dapat dibatalkan.
   Tetap di gameplay.html: explode/teleport (mengubah pawn + tween + sfx), salju/ember tema, animasi mob/ular, kamera, Dragon, state & guard gameId/STALE.
   Classic script. Namespace: UT.GameplayFX.
   API: track/stop/untrack/stopAll/getActive · timeout · init(scene) · emitters lama · dispose() */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayFX) return;

  var scene = null, confetti = [], sparks = [], blasts = [], CONF_GEO = null, CONF_MATS = null, SPARK_GEO = null, FIRE_MATS = null, SMOKE_MATS = null, ENDER_MATS = null, ESMOKE_MATS = null;
  var currentQuality = null, reducedMq = null, tracked = Object.create(null), trackSeq = 0, configuredQuality = null;
  var disposed = false, lifecycleBound = false;
  var doc = win.document;
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

  function reportCleanupError(error) {
    if (win.console && win.console.warn) win.console.warn('[gameplay-fx] cleanup gagal', error);
  }

  function setState(entry, state) {
    entry.state = state;
    if (typeof entry.effect.onLifecycle === 'function') {
      try { entry.effect.onLifecycle(state, entry.id); } catch (e) { reportCleanupError(e); }
    }
  }

  function track(effect, metadata) {
    if (!effect || typeof effect !== 'object' || disposed) return null;
    var id = 'gameplay-fx-' + (++trackSeq);
    var entry = { id: id, effect: effect, metadata: metadata || {}, state: 'created' };
    tracked[id] = entry;
    setState(entry, 'created');
    if (tracked[id] === entry) setState(entry, 'playing');
    return id;
  }

  function untrack(id) {
    var entry = tracked[id];
    if (!entry || entry.state === 'disposed') return false;
    setState(entry, 'disposed');
    delete tracked[id];
    return true;
  }

  function stop(id) {
    var entry = tracked[id];
    if (!entry || entry.state === 'stopping' || entry.state === 'disposed') return false;
    setState(entry, 'stopping');
    try {
      if (typeof entry.effect.stop === 'function') entry.effect.stop();
    } catch (e) { reportCleanupError(e); }
    try {
      if (typeof entry.effect.cleanup === 'function') entry.effect.cleanup();
      else if (typeof entry.effect.dispose === 'function') entry.effect.dispose();
    } catch (e) { reportCleanupError(e); }
    untrack(id);
    return true;
  }

  function matchesScope(entry, scope) {
    if (!scope) return true;
    var scopes = Array.isArray(scope) ? scope : [scope];
    for (var i = 0; i < scopes.length; i++) {
      if (entry.metadata.scope === scopes[i] || entry.metadata.category === scopes[i]) return true;
    }
    return false;
  }

  function stopAll(options) {
    var scope = options && options.scope, ids = Object.keys(tracked), stopped = 0;
    for (var i = ids.length - 1; i >= 0; i--) {
      var entry = tracked[ids[i]];
      if (entry && matchesScope(entry, scope) && stop(entry.id)) stopped++;
    }
    if (!scope || matchesScope({ metadata: { scope: 'visual', category: 'particle' } }, scope)) {
      try {
        if (win.UT && win.UT.ParticleFX && typeof win.UT.ParticleFX.clear === 'function') win.UT.ParticleFX.clear();
      } catch (e) { reportCleanupError(e); }
    }
    if (!scope || (Array.isArray(scope) ? scope.indexOf('visual') >= 0 : scope === 'visual')) {
      var overlay = win.UT && win.UT.PowerOverlay;
      try { if (overlay && typeof overlay.stop === 'function') overlay.stop(); }
      catch (e) { reportCleanupError(e); }
    }
    return stopped;
  }

  function timeout(callback, delay, metadata, onStop) {
    if (disposed) return { id: null, timer: 0, clear: function () { return false; } };
    var timer = 0, done = false, id = null;
    var finish = function (run, unlink) {
      if (done) return false;
      done = true;
      win.clearTimeout(timer);
      try { if (run) callback(); }
      finally { if (unlink && id) untrack(id); }
      return true;
    };
    var meta = { type: 'timeout', scope: 'visual' };
    Object.keys(metadata || {}).forEach(function (key) { meta[key] = metadata[key]; });
    id = track({ stop: function () { if (finish(false, false) && onStop) onStop(); } }, meta);
    timer = win.setTimeout(function () { finish(true, true); }, Math.max(0, Number(delay) || 0));
    return {
      id: id,
      timer: timer,
      clear: function () {
        if (id) return stop(id);
        if (finish(false, false) && onStop) onStop();
        return false;
      }
    };
  }

  function getActive() {
    return Object.keys(tracked).map(function (id) {
      var entry = tracked[id];
      return { id: entry.id, state: entry.state, metadata: entry.metadata };
    });
  }

  function onVisibilityChange() {
    if (doc && doc.hidden) stopAll({ scope: 'visual' });
  }

  function onPageHide(event) {
    if (event && event.persisted) {
      stopAll({ scope: 'visual' });
      return;
    }
    dispose();
  }

  function bindLifecycle() {
    if (lifecycleBound) return;
    if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisibilityChange);
    if (win.addEventListener) win.addEventListener('pagehide', onPageHide);
    lifecycleBound = true;
  }

  function unbindLifecycle() {
    if (!lifecycleBound) return;
    if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVisibilityChange);
    if (win.removeEventListener) win.removeEventListener('pagehide', onPageHide);
    lifecycleBound = false;
  }

  function makeParticleGroup(type) {
    var group = { id: null, items: [], stopping: false };
    group.id = track({
      stop: function () {
        group.stopping = true;
        group.items.slice().forEach(function (item) { removeParticle(item, !!item.ownedMaterial); });
      }
    }, { type: type, scope: 'visual', category: 'particle' });
    return group;
  }

  function addParticle(list, item, group) {
    item.list = list;
    item.group = group;
    group.items.push(item);
    list.push(item);
  }

  function removeParticle(item, disposeMaterial) {
    var list = item.list, group = item.group;
    if (list) {
      var index = list.indexOf(item);
      if (index >= 0) list.splice(index, 1);
      item.list = null;
    }
    try { if (scene && item.m) scene.remove(item.m); } catch (e) { reportCleanupError(e); }
    if (disposeMaterial && item.m && item.m.material && typeof item.m.material.dispose === 'function') {
      try { item.m.material.dispose(); } catch (e) { reportCleanupError(e); }
    }
    item.group = null;
    if (!group) return;
    var groupIndex = group.items.indexOf(item);
    if (groupIndex >= 0) group.items.splice(groupIndex, 1);
    if (!group.stopping && group.items.length === 0) untrack(group.id);
  }

  function disposeSharedResources() {
    var materials = (CONF_MATS || []).concat(FIRE_MATS || [], SMOKE_MATS || [], ENDER_MATS || [], ESMOKE_MATS || []);
    materials.forEach(function (material) {
      if (material && typeof material.dispose === 'function') {
        try { material.dispose(); } catch (e) { reportCleanupError(e); }
      }
    });
    [CONF_GEO, SPARK_GEO].forEach(function (geometry) {
      if (geometry && typeof geometry.dispose === 'function') {
        try { geometry.dispose(); } catch (e) { reportCleanupError(e); }
      }
    });
    CONF_GEO = SPARK_GEO = null;
    CONF_MATS = FIRE_MATS = SMOKE_MATS = ENDER_MATS = ESMOKE_MATS = null;
    configuredQuality = null;
  }

  function dispose() {
    if (disposed) return false;
    stopAll();
    clearConfetti();
    try { if (win.UT && win.UT.ParticleFX && typeof win.UT.ParticleFX.dispose === 'function') win.UT.ParticleFX.dispose(); }
    catch (e) { reportCleanupError(e); }
    var overlay = win.UT && win.UT.PowerOverlay;
    try { if (overlay && typeof overlay.dispose === 'function') overlay.dispose(); }
    catch (e) { reportCleanupError(e); }
    disposeSharedResources();
    unbindLifecycle();
    scene = null;
    disposed = true;
    return true;
  }

  function init(sc) {
    if (!sc || !win.THREE) return false;
    disposed = false;
    scene = sc;
    bindLifecycle();
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
    if (count < 1) return;
    var group = makeParticleGroup('confetti');
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(CONF_GEO, CONF_MATS[i % CONF_MATS.length]);
      m.position.set(pos.x, pos.y + 0.8, pos.z);
      scene.add(m);
      addParticle(confetti, { m, v: new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), life: 2.6 + Math.random() * 1.4 }, group);
    }
  }
  /* Ledakan api (TNT / Creeper / hit): serpihan api oranye-merah menyembur + asap abu naik. Menggantikan konfeti warna-warni untuk semua ledakan. */
  function spawnExplosion(pos, kind, tier) {
    if (!scene) return;
    var available = availableCount(), baseFire = 45, baseSmoke = 27.5;
    var en = kind === 'ender', bits = en ? ENDER_MATS : FIRE_MATS, smk = en ? ESMOKE_MATS : SMOKE_MATS;
    var NB = scaledCount(baseFire, tier, available), NS = scaledCount(baseSmoke, tier, available - NB);
    if (!NB && !NS) return;
    var group = makeParticleGroup('explosion');
    for (let i = 0; i < NB + NS; i++) {
      const fire = i < NB, sz = fire ? 0.045 + Math.random() * 0.07 : 0.1 + Math.random() * 0.14; /* serpihan kecil; asap sedikit lebih besar */
      const m = new THREE.Mesh(CONF_GEO, fire ? bits[Math.floor(Math.random() * bits.length)] : smk[Math.floor(Math.random() * smk.length)]);
      m.position.set(pos.x + (Math.random() - 0.5) * 0.25, pos.y + 0.45, pos.z + (Math.random() - 0.5) * 0.25);
      m.scale.setScalar(sz / 0.14); scene.add(m);
      const sp = fire ? 1.6 + Math.random() * 2.6 : 0.4 + Math.random() * 0.8, an = Math.random() * Math.PI * 2;
      var item = { m: m, s0: sz / 0.14, fire: fire, v: new THREE.Vector3(Math.cos(an) * sp, fire ? 1.2 + Math.random() * 2.8 : 0.8 + Math.random() * 1.1, Math.sin(an) * sp), r: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5), life: fire ? 0.5 + Math.random() * 0.4 : 1.0 + Math.random() * 0.7, max: 1 };
      item.max = item.life;
      addParticle(blasts, item, group);
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
      if (b.life <= 0) removeParticle(b, false);
    }
  }
  function clearConfetti() {
    stopAll({ scope: 'particle' });
    confetti.slice().forEach(function (item) { removeParticle(item, false); });
    blasts.slice().forEach(function (item) { removeParticle(item, false); });
    sparks.slice().forEach(function (item) { removeParticle(item, true); });
  }
  function updateConfetti(dt) {
    if (!scene) return;
    updateBlasts(dt);
    for(let i=confetti.length-1;i>=0;i--){
      const c=confetti[i]; c.life-=dt; c.v.y-=14*dt;
      c.m.position.addScaledVector(c.v,dt);
      c.m.rotation.x+=c.r.x*dt; c.m.rotation.y+=c.r.y*dt; c.m.rotation.z+=c.r.z*dt;
      if(c.life<=0) removeParticle(c, false);
    }
  }

  function sparkle(pos, tier) {
    if (!scene) return;
    var count = scaledCount(18, tier);
    if (count < 1) return;
    var group = makeParticleGroup('sparkle');
    for(let i=0;i<count;i++){
      const m=new THREE.Mesh(SPARK_GEO,new THREE.MeshBasicMaterial({color:i%3?0xFFE58A:0xFFFFFF,transparent:true,fog:false}));
      m.position.set(pos.x+(Math.random()-0.5)*0.3,pos.y,pos.z+(Math.random()-0.5)*0.3); scene.add(m);
      var item = {m:m,v:new THREE.Vector3((Math.random()-0.5)*0.9,0.7+Math.random()*0.9,(Math.random()-0.5)*0.9),life:1,max:1,ownedMaterial:true};
      item.life=item.max=0.8+Math.random()*0.5;
      addParticle(sparks, item, group);
    }
  }
  function updateSparks(dt) {
    if (!scene) return;
    for(let i=sparks.length-1;i>=0;i--){
      const q=sparks[i]; q.life-=dt; q.m.position.addScaledVector(q.v,dt); q.v.y-=0.5*dt; q.m.material.opacity=Math.max(0,q.life/q.max);
      if(q.life<=0) removeParticle(q, true);
    }
  }

  UT.GameplayFX = { quality: quality, limit: limit, n: n, reduced: reduced, track: track, untrack: untrack, stop: stop, stopAll: stopAll, timeout: timeout, getActive: getActive, dispose: dispose, init: init, spawnConfetti: spawnConfetti, spawnExplosion: spawnExplosion, updateConfetti: updateConfetti, clearConfetti: clearConfetti, sparkle: sparkle, updateSparks: updateSparks };
})(window);
