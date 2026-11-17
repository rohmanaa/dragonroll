/* Gameplay FX — efek visual murni dengan skala perangkat, tier, dan reduced-motion.
   Variasi Math.random di sini hanya untuk tampilan (sebar partikel), bukan hasil gameplay.
   Modul BUKAN pemilik scene/kamera/renderer: scene diberikan gameplay lewat init(scene). Tidak memanggil feedback/HUD atau localStorage dan tidak membuat loop kedua;
   update dipanggil dari loop animasi milik gameplay (pada titik yang sama seperti sebelumnya), sementara timer FX dilacak agar dapat dibatalkan.
   Tetap di gameplay.html: explode/teleport (mengubah pawn + tween + sfx), salju/ember tema, animasi mob/ular, kamera, Dragon, state & guard gameId/STALE.
   Classic script. Namespace: UT.GameplayFX.
   API: track/stop/untrack/stopAll/getActive/getHistory · timeout · init(scene) · emitters lama (opsional opts {seed,fid,source}) · dispose()
   Spatial FX: spatial(kind, opts) · spatialKinds · clearSpatial — teleport, portal, combat, and impact effects.
   Cue multiplayer (1.3): cueMeta(origin,epoch) -> {fid,seed,source} · acceptCue(cue) (dedup + cue basi) · cueOptions(cue) · rng(seed[,index]) · getCueLog() · setDebug(on).
   Seed hanya untuk variasi visual (arah/ukuran/kecepatan partikel); tiap partikel memakai rng(seed, index) sendiri, jadi partikel ke-i sama di semua klien walau jumlah total berbeda (skala perangkat). */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayFX) return;

  var scene = null, confetti = [], sparks = [], blasts = [], CONF_GEO = null, CONF_MATS = null, SPARK_GEO = null, FIRE_MATS = null, SMOKE_MATS = null, ENDER_MATS = null, ESMOKE_MATS = null;
  var currentQuality = null, reducedMq = null, tracked = Object.create(null), trackSeq = 0, configuredQuality = null;
  var disposed = false, lifecycleBound = false;
  var fidSeq = 0, SESSION = Math.random().toString(36).slice(2, 6) || 'x', CUE_SEEN_MAX = 256, CUE_EPOCH_MAX = 256, LOG_MAX = 64;
  var cueSeen = Object.create(null), cueSeenOrder = [], cueEpoch = Object.create(null), cueEpochOrder = [], cueLog = [], history = [], debugOn = false;
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
    return confetti.length + sparks.length + blasts.length + spItems.length; /* partikel spasial ikut batas kualitas yang sama */
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

  function now() { try { return Date.now(); } catch (e) { return 0; } }

  function debugLog(kind, info) {
    if (!debugOn || !win.console || !win.console.debug) return;
    try { win.console.debug('[gameplay-fx] ' + kind, info); } catch (e) { /* debug tidak boleh mengganggu FX */ }
  }

  function pushBounded(list, item) {
    list.push(item);
    if (list.length > LOG_MAX) list.shift();
  }

  /* ---- Seed deterministik (hanya visual) ---- */
  function hash32(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mix(seed, index) {
    var h = (seed >>> 0) ^ Math.imul(((index | 0) + 1) | 0, 0x9E3779B1);
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function validSeed(v) { return typeof v === 'number' && isFinite(v); }
  function rng(seed, index) {
    var a = (index === undefined ? seed : mix(seed, index)) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* RNG per partikel: berseed bila opts.seed valid, selain itu Math.random seperti sebelumnya */
  function pr(opts, index) {
    return opts && validSeed(opts.seed) ? rng(opts.seed, index) : Math.random;
  }

  /* ---- Identitas cue (fid) ---- */
  var FID_RE = /^(.+):(\d+):([a-z0-9]+)\.(\d+)$/;
  function parseFid(fid) {
    if (typeof fid !== 'string' || fid.length > 80) return null;
    var m = FID_RE.exec(fid);
    return m ? { origin: m[1], epoch: +m[2], nonce: m[3], seq: +m[4] } : null;
  }
  function cueMeta(origin, epoch) {
    var o = String(origin == null ? 'host' : origin).replace(/[^\w\-.@]/g, '').slice(0, 24) || 'host';
    var e = Math.max(0, Math.floor(Number(epoch) || 0));
    var fid = o + ':' + e + ':' + SESSION + '.' + (++fidSeq);
    return { fid: fid, seed: hash32(fid), source: o };
  }
  /* Opsi emitter dari cue yang diterima; cue lama tanpa fid/seed -> null (acak seperti dulu) */
  function cueOptions(cue) {
    if (!cue || typeof cue !== 'object') return null;
    var f = parseFid(cue.fid), seed = validSeed(cue.seed) ? cue.seed : (f ? hash32(cue.fid) : null);
    if (seed == null && !f) return null;
    var o = {};
    if (seed != null) o.seed = seed;
    if (f) { o.fid = cue.fid; o.source = f.origin; }
    return o;
  }
  function logCue(cue, status, reason) {
    var f = cue && parseFid(cue.fid);
    var item = { fid: cue && typeof cue.fid === 'string' ? cue.fid : null, k: cue && cue.k, source: f ? f.origin : null, seed: cue && validSeed(cue.seed) ? cue.seed : null, status: status, reason: reason, at: now() };
    pushBounded(cueLog, item);
    debugLog('cue ' + status, item);
  }
  function remember(fid) {
    cueSeen[fid] = 1;
    cueSeenOrder.push(fid);
    if (cueSeenOrder.length > CUE_SEEN_MAX) delete cueSeen[cueSeenOrder.shift()];
  }
  function rememberEpoch(key, epoch) {
    if (cueEpoch[key] == null) {
      cueEpochOrder.push(key);
      if (cueEpochOrder.length > CUE_EPOCH_MAX) delete cueEpoch[cueEpochOrder.shift()];
    }
    cueEpoch[key] = epoch;
  }
  /* true = putar cue; false = abaikan (duplikat / dari game sebelumnya). Cue tanpa fid yang valid selalu diterima (kompatibel mundur). Murni visual: tidak menyentuh state gameplay. */
  function acceptCue(cue) {
    var f = cue && typeof cue === 'object' ? parseFid(cue.fid) : null;
    if (!f) { logCue(cue, 'accepted', 'legacy'); return true; }
    if (cueSeen[cue.fid]) { logCue(cue, 'rejected', 'duplicate'); return false; }
    var key = f.origin + '|' + f.nonce, last = cueEpoch[key];
    if (last != null && f.epoch < last) { logCue(cue, 'rejected', 'stale-epoch'); return false; }
    if (last == null || f.epoch > last) rememberEpoch(key, f.epoch);
    remember(cue.fid);
    logCue(cue, 'accepted', 'new');
    return true;
  }
  function getCueLog() { return cueLog.slice(); }
  function getHistory() { return history.slice(); }
  function setDebug(on) { debugOn = !!on; return debugOn; }

  function setState(entry, state) {
    entry.state = state;
    if (typeof entry.effect.onLifecycle === 'function') {
      try { entry.effect.onLifecycle(state, entry.id); } catch (e) { reportCleanupError(e); }
    }
  }

  function track(effect, metadata) {
    if (!effect || typeof effect !== 'object' || disposed) return null;
    var id = 'gameplay-fx-' + (++trackSeq);
    var entry = { id: id, effect: effect, metadata: metadata || {}, state: 'created', createdAt: now(), reason: null };
    tracked[id] = entry;
    setState(entry, 'created');
    if (tracked[id] === entry) setState(entry, 'playing');
    return id;
  }

  function untrack(id, reason) {
    var entry = tracked[id];
    if (!entry || entry.state === 'disposed') return false;
    entry.reason = entry.reason || reason || 'completed';
    setState(entry, 'disposed');
    delete tracked[id];
    var md = entry.metadata, item = { id: entry.id, type: md.type, category: md.category, scope: md.scope, fid: md.fid == null ? null : md.fid, seed: md.seed == null ? null : md.seed, source: md.source == null ? null : md.source, createdAt: entry.createdAt, endedAt: now(), state: 'disposed', reason: entry.reason };
    pushBounded(history, item);
    debugLog('dispose', item);
    return true;
  }

  function stop(id, reason) {
    var entry = tracked[id];
    if (!entry || entry.state === 'stopping' || entry.state === 'disposed') return false;
    entry.reason = typeof reason === 'string' && reason ? reason : 'stopped';
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
      if (entry.metadata.scope === scopes[i] || entry.metadata.category === scopes[i] || entry.metadata.parentCategory === scopes[i]) return true;
    }
    return false;
  }

  function stopAll(options) {
    var scope = options && options.scope, ids = Object.keys(tracked), stopped = 0;
    var reason = options && typeof options.reason === 'string' && options.reason ? options.reason : 'stopAll';
    for (var i = ids.length - 1; i >= 0; i--) {
      var entry = tracked[ids[i]];
      if (entry && matchesScope(entry, scope) && stop(entry.id, reason)) stopped++;
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
      return { id: entry.id, state: entry.state, metadata: entry.metadata, createdAt: entry.createdAt, reason: entry.reason };
    });
  }

  function onVisibilityChange() {
    if (doc && doc.hidden) stopAll({ scope: 'visual', reason: 'visibility-hidden' });
  }

  function onPageHide(event) {
    if (event && event.persisted) {
      stopAll({ scope: 'visual', reason: 'pagehide-bfcache' });
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

  function makeParticleGroup(type, opts) {
    var group = { id: null, items: [], stopping: false };
    var meta = { type: type, scope: 'visual', category: 'particle' };
    if (opts) ['fid', 'seed', 'source'].forEach(function (key) { if (opts[key] != null) meta[key] = opts[key]; });
    group.id = track({
      stop: function () {
        group.stopping = true;
        group.items.slice().forEach(function (item) { removeParticle(item, !!item.ownedMaterial); });
      }
    }, meta);
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
    (SP_MATS || []).forEach(function (material) { try { material.dispose(); } catch (e) { reportCleanupError(e); } });
    [SP_RING, SP_DISC].forEach(function (geometry) { if (geometry && typeof geometry.dispose === 'function') { try { geometry.dispose(); } catch (e) { reportCleanupError(e); } } });
    SP_MATS = SP_RING = SP_DISC = null;
    CONF_GEO = SPARK_GEO = null;
    CONF_MATS = FIRE_MATS = SMOKE_MATS = ENDER_MATS = ESMOKE_MATS = null;
    configuredQuality = null;
  }

  function dispose() {
    if (disposed) return false;
    stopAll({ reason: 'dispose' });
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

  function spawnConfetti(pos, tier, opts) {
    if (!scene) return;
    var count = scaledCount(138, tier);
    if (count < 1) return;
    var group = makeParticleGroup('confetti', opts);
    for (let i = 0; i < count; i++) {
      const R = pr(opts, i);
      const m = new THREE.Mesh(CONF_GEO, CONF_MATS[i % CONF_MATS.length]);
      m.position.set(pos.x, pos.y + 0.8, pos.z);
      scene.add(m);
      addParticle(confetti, { m, v: new THREE.Vector3((R() - 0.5) * 6, 4 + R() * 5, (R() - 0.5) * 6), r: new THREE.Vector3(R() * 6, R() * 6, R() * 6), life: 2.6 + R() * 1.4 }, group);
    }
  }
  /* Ledakan api (TNT / Creeper / hit): serpihan api oranye-merah menyembur + asap abu naik. Menggantikan konfeti warna-warni untuk semua ledakan. */
  function spawnExplosion(pos, kind, tier, opts) {
    if (!scene) return;
    var available = availableCount(), baseFire = 45, baseSmoke = 27.5;
    var en = kind === 'ender', bits = en ? ENDER_MATS : FIRE_MATS, smk = en ? ESMOKE_MATS : SMOKE_MATS;
    var NB = scaledCount(baseFire, tier, available), NS = scaledCount(baseSmoke, tier, available - NB);
    if (!NB && !NS) return;
    var group = makeParticleGroup('explosion', opts);
    for (let i = 0; i < NB + NS; i++) {
      const fire = i < NB, R = pr(opts, fire ? i : 1000 + (i - NB)); /* asap punya namespace indeks sendiri: jumlah api berbeda antar perangkat tidak menggeser variasi asap */
      const sz = fire ? 0.045 + R() * 0.07 : 0.1 + R() * 0.14; /* serpihan kecil; asap sedikit lebih besar */
      const m = new THREE.Mesh(CONF_GEO, fire ? bits[Math.floor(R() * bits.length)] : smk[Math.floor(R() * smk.length)]);
      m.position.set(pos.x + (R() - 0.5) * 0.25, pos.y + 0.45, pos.z + (R() - 0.5) * 0.25);
      m.scale.setScalar(sz / 0.14); scene.add(m);
      const sp = fire ? 1.6 + R() * 2.6 : 0.4 + R() * 0.8, an = R() * Math.PI * 2;
      var item = { m: m, s0: sz / 0.14, fire: fire, v: new THREE.Vector3(Math.cos(an) * sp, fire ? 1.2 + R() * 2.8 : 0.8 + R() * 1.1, Math.sin(an) * sp), r: new THREE.Vector3(R() * 5, R() * 5, R() * 5), life: fire ? 0.5 + R() * 0.4 : 1.0 + R() * 0.7, max: 1 };
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
    stopAll({ scope: 'particle', reason: 'clear' });
    confetti.slice().forEach(function (item) { removeParticle(item, false); });
    blasts.slice().forEach(function (item) { removeParticle(item, false); });
    sparks.slice().forEach(function (item) { removeParticle(item, true); });
    clearSpatial();
  }
  function updateConfetti(dt) {
    if (!scene) return;
    updateBlasts(dt);
    updateSpatial(dt);
    for(let i=confetti.length-1;i>=0;i--){
      const c=confetti[i]; c.life-=dt; c.v.y-=14*dt;
      c.m.position.addScaledVector(c.v,dt);
      c.m.rotation.x+=c.r.x*dt; c.m.rotation.y+=c.r.y*dt; c.m.rotation.z+=c.r.z*dt;
      if(c.life<=0) removeParticle(c, false);
    }
  }

  function sparkle(pos, tier, opts) {
    if (!scene) return;
    var count = scaledCount(18, tier);
    if (count < 1) return;
    var group = makeParticleGroup('sparkle', opts);
    for(let i=0;i<count;i++){
      const R=pr(opts,i);
      const m=new THREE.Mesh(SPARK_GEO,new THREE.MeshBasicMaterial({color:i%3?0xFFE58A:0xFFFFFF,transparent:true,fog:false}));
      m.position.set(pos.x+(R()-0.5)*0.3,pos.y,pos.z+(R()-0.5)*0.3); scene.add(m);
      var item = {m:m,v:new THREE.Vector3((R()-0.5)*0.9,0.7+R()*0.9,(R()-0.5)*0.9),life:1,max:1,ownedMaterial:true};
      item.life=item.max=0.8+R()*0.5;
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


  /* ================= Spatial FX (Phase 2) =================
     Efek perpindahan & manipulasi ruang: Teleport, Ender Hole (lapisan energi), Portal, Spatial Distortion, Energy Trail.
     Tidak ada engine baru: partikel memakai CONF_GEO + materi bersama, dihitung ke batas kualitas yang sama (activeCount/cap),
     tiap efek dilacak lewat track() (kategori 'spatial', scope 'visual') sehingga stop/stopAll/dispose/visibility ikut bekerja.
     Update dipanggil dari updateConfetti (loop gameplay yang sama). Murni visual; seed per partikel = rng(seed, ns*1000+i). */
  var spItems = [], spEffects = [], SP_MATS = null, SP_RING = null, SP_DISC = null;
  var SP_COLORS = [0xB84DFF, 0xDD66FF, 0xFFE6FF, 0x6D28D9, 0x14B8A6, 0x15121C, 0xFFC94A, 0xFF5C62, 0x58DFFF, 0x75E28C, 0xB7A2FF, 0x9A7880, 0x62545D]; /* violet, magenta, pale, teal, gold, red, cyan, green, lavender, muted rose, slate */
  var SP_NS = { gather: 1, depart: 2, trail: 3, arrive: 4, recover: 5, residual: 6, hole: 7, portal: 9, entry: 10, exit: 11, ripple: 12, frag: 13, collapse: 14, slash: 15, release: 16, projectile: 17, charge: 18, impact: 19, defense: 20, buff: 21, reward: 22, ambient: 23, world: 24, result: 25 };
  var SP_KINDS = Object.create(null);
  var HOLE_LIFE = 2.3, HALF_PI = Math.PI / 2;

  function mo() { return reduced() ? 0.35 : 1; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(v) { v = clamp(v, 0, 1); return 1 - (1 - v) * (1 - v) * (1 - v); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function pal(o, j) { return (o && o.tint ? [4, 2, 0, 2] : [0, 1, 2, 3])[j & 3]; } /* tint 1 = aksen teal: dua karakter tidak berbagi warna yang sama */
  function cp(o, extra) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in extra) r[k] = extra[k]; return r; }
  function spCount(base, o) { return scaledCount(base, o && o.tier); }

  function spRes() {
    if (SP_MATS) return true;
    if (!scene || !win.THREE || !CONF_GEO) return false;
    SP_MATS = SP_COLORS.map(function (c) { return new THREE.MeshBasicMaterial({ color: c, fog: false }); });
    SP_RING = new THREE.RingGeometry(0.88, 1, 44);
    SP_DISC = new THREE.CircleGeometry(1, 32);
    return true;
  }
  function spPos(o) {
    var p = null;
    try { p = typeof o.follow === 'function' ? o.follow() : null; } catch (e) { p = null; }
    p = p || o.pos || { x: 0, y: 0, z: 0 };
    return { x: num(+p.x, 0), y: num(+p.y, 0), z: num(+p.z, 0) };
  }
  function spCenter(ctl) {
    var p = spPos(ctl.o);
    ctl.px = p.x; ctl.py = p.y; ctl.pz = p.z; ctl.cx = p.x; ctl.cy = p.y + ctl.hy; ctl.cz = p.z;
  }
  function spBasis(ctl, yaw) { /* bidang portal: U kanan, V atas, N normal (menghadap yaw) */
    var s = Math.sin(yaw), c = Math.cos(yaw);
    ctl.U = [c, 0, -s]; ctl.V = [0, 1, 0]; ctl.N = [s, 0, c];
  }
  function spMesh(ctl, geo, ci, opacity, additive) {
    var mat = new THREE.MeshBasicMaterial({ color: SP_COLORS[ci], transparent: true, opacity: opacity, depthWrite: false, fog: false, side: THREE.DoubleSide });
    if (additive !== false) mat.blending = THREE.AdditiveBlending;
    var m = new THREE.Mesh(geo, mat);
    m.renderOrder = 6; scene.add(m); ctl.meshes.push(m); ctl.mats.push(mat);
    return m;
  }
  function spCube(ctl, ci) {
    var m = new THREE.Mesh(CONF_GEO, SP_MATS[ci]); /* geometri & materi milik bersama: hanya dilepas dari scene */
    m.renderOrder = 6; scene.add(m); ctl.meshes.push(m);
    return m;
  }
  function spFlat(m) { m.rotation.x = -HALF_PI; return m; }
  function spGroup(ctl) {
    var g = ctl.group;
    if (g && g.stopping) return null;
    if (g && tracked[g.id]) return g;
    g = makeParticleGroup('spatial-' + ctl.type, ctl.o);
    if (g.id && tracked[g.id]) tracked[g.id].metadata.parentCategory = 'spatial';
    ctl.group = g;
    return g.id ? g : null;
  }
  function spPart(ctl, s) {
    if (availableCount() <= 0) return null; /* kuota dicek saat dipancarkan (bukan hanya saat efek dibuat): batas kualitas tidak pernah terlampaui */
    var g = spGroup(ctl);
    if (!g) return null;
    var m = new THREE.Mesh(CONF_GEO, SP_MATS[s.mat]);
    s.s0 = s.size / 0.14; s.max = s.life; s.c = ctl;
    s.vx = s.vx || 0; s.vy = s.vy || 0; s.vz = s.vz || 0;
    m.position.set(s.x, s.y, s.z); m.scale.setScalar(s.s0 * (s.s1 || 0.3)); m.renderOrder = 6; scene.add(m);
    s.m = m;
    addParticle(spItems, s, g);
    return s;
  }

  function spFinish(ctl) {
    if (ctl.cleaned) return;
    ctl.cleaned = true; ctl.done = true;
    var i = spEffects.indexOf(ctl);
    if (i >= 0) spEffects.splice(i, 1);
    ctl.meshes.forEach(function (m) { try { if (scene) scene.remove(m); } catch (e) { reportCleanupError(e); } });
    ctl.mats.forEach(function (mat) { try { mat.dispose(); } catch (e) { reportCleanupError(e); } });
    ctl.meshes.length = 0; ctl.mats.length = 0;
  }

  function spRun(type, dur, o, build) {
    if (!scene || disposed || !spRes()) return null;
    o = o || {};
    var ctl = { type: type, o: o, t: 0, dur: Math.max(0.05, dur), meshes: [], mats: [], group: null, tick: null, id: null, cleaned: false, done: false, hy: num(o.hy, 0), scale: clamp(num(o.scale, 1), 0.3, 3), U: [1, 0, 0], V: [0, 0, 1], N: [0, 1, 0], px: 0, py: 0, pz: 0, cx: 0, cy: 0, cz: 0 };
    spCenter(ctl);
    var meta = { type: type, scope: 'visual', category: 'spatial' };
    ['fid', 'seed', 'source'].forEach(function (key) { if (o[key] != null) meta[key] = o[key]; });
    ctl.id = track({
      stop: function () { ctl.done = true; if (ctl.group && ctl.group.id) stop(ctl.group.id, 'parent-stop'); },
      cleanup: function () { spFinish(ctl); }
    }, meta);
    if (!ctl.id) return null;
    try { build(ctl); } catch (e) { reportCleanupError(e); stop(ctl.id, 'build-failed'); return null; }
    spEffects.push(ctl);
    return ctl;
  }

  function updateSpatialItems(dt) {
    for (var i = spItems.length - 1; i >= 0; i--) {
      var it = spItems[i];
      it.life -= dt;
      if (it.life <= 0) { removeParticle(it, false); continue; }
      var k = it.life / it.max, u = 1 - k, m = it.m, c = it.c, p = m.position;
      if (it.mode === 'gather') {
        var r = it.rad * (1 - u * u);
        p.set(c.cx + it.dx * r, c.cy + it.dy * r, c.cz + it.dz * r);
      } else if (it.mode === 'swirl') {
        it.a += it.w * dt;
        var rr = it.rad * (it.out ? 0.25 + 0.75 * u : k), ca = Math.cos(it.a) * rr, sa = Math.sin(it.a) * rr, d = it.d || 0;
        p.set(c.cx + c.U[0] * ca + c.V[0] * sa + c.N[0] * d, c.cy + c.U[1] * ca + c.V[1] * sa + c.N[1] * d + (it.rise || 0) * u, c.cz + c.U[2] * ca + c.V[2] * sa + c.N[2] * d);
      } else {
        it.vy -= (it.g || 0) * dt;
        p.x += it.vx * dt; p.y += it.vy * dt; p.z += it.vz * dt;
      }
      m.scale.setScalar(it.s0 * Math.min(1, k * 3) * Math.min(1, (it.s1 || 0.3) + u * 6));
      if (it.spin) { m.rotation.x += it.spin * dt; m.rotation.y += it.spin * 0.7 * dt; }
    }
  }

  function updateSpatial(dt) {
    if (!scene) return;
    updateSpatialItems(dt);
    for (var i = spEffects.length - 1; i >= 0; i--) {
      var ctl = spEffects[i];
      if (ctl.done) continue;
      ctl.t += dt;
      spCenter(ctl);
      try { if (ctl.tick) ctl.tick(ctl, ctl.t, clamp(ctl.t / ctl.dur, 0, 1), dt); } catch (e) { reportCleanupError(e); ctl.t = ctl.dur; }
      if (ctl.t >= ctl.dur) { spFinish(ctl); untrack(ctl.id, 'completed'); }
    }
  }

  function clearSpatial() {
    stopAll({ scope: 'spatial', reason: 'clear' });
    spItems.slice().forEach(function (item) { removeParticle(item, false); });
    spEffects.slice().forEach(spFinish);
  }

  /* ---- Teleport ---- */
  /* 1+2. Antisipasi & energi berkumpul: cincin menyempit + serpihan voxel mengalir ke pion (mengikuti pion), selesai tepat saat pion lenyap */
  SP_KINDS['tp-gather'] = function (o) {
    var dur = clamp(num(o.dur, 0.3), 0.1, 1.5);
    return spRun('tp-gather', dur, o, function (ctl) {
      ctl.hy = num(o.hy, 0.8); spCenter(ctl);
      var s = ctl.scale, ring = spFlat(spMesh(ctl, SP_RING, pal(o, 0), 0.7)), n = spCount(16, o);
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.gather * 1000 + i), th = R() * 6.2832, ph = (R() - 0.25) * 1.3, rad = (0.8 + R() * 0.7) * s;
        var dx = Math.cos(th) * Math.cos(ph), dy = Math.sin(ph) * 0.8, dz = Math.sin(th) * Math.cos(ph);
        spPart(ctl, { mode: 'gather', dx: dx, dy: dy, dz: dz, rad: rad, x: ctl.cx + dx * rad, y: ctl.cy + dy * rad, z: ctl.cz + dz * rad, life: dur, size: 0.05 + R() * 0.06, mat: pal(o, i % 3), s1: 0.5, spin: (R() - 0.5) * 6 * mo() });
      }
      ctl.tick = function (c, t, k) {
        ring.position.set(c.px, c.py + 0.05, c.pz);
        ring.scale.setScalar((1.3 * (1 - k * k) + 0.18) * s);
        ring.rotation.z = reduced() ? 0 : t * 6;
        ring.material.opacity = 0.7 * Math.min(1, k * 4) * (1 - k * 0.3);
      };
    });
  };
  /* 3. Departure burst: pilar percik naik + cincin kolom naik (karakter: vertikal, naik) */
  SP_KINDS['tp-depart'] = function (o) {
    return spRun('tp-depart', 0.55, o, function (ctl) {
      ctl.hy = num(o.hy, 0.6); spCenter(ctl);
      var s = ctl.scale, g = spFlat(spMesh(ctl, SP_RING, pal(o, 1), 0.75)), col = spFlat(spMesh(ctl, SP_RING, pal(o, 2), 0.6)), i, R;
      var n = spCount(26, o), nf = spCount(6, o), m = mo();
      for (i = 0; i < n; i++) {
        R = pr(o, SP_NS.depart * 1000 + i);
        var a = R() * 6.2832, rad = R() * 0.35 * s;
        spPart(ctl, { mode: 'burst', x: ctl.px + Math.cos(a) * rad, y: ctl.py + 0.1, z: ctl.pz + Math.sin(a) * rad, vx: Math.cos(a) * 0.4 * m, vy: (2.4 + R() * 3) * m, vz: Math.sin(a) * 0.4 * m, g: 2.5, life: 0.45 + R() * 0.35, size: 0.04 + R() * 0.06, mat: pal(o, i % 3) });
      }
      for (i = 0; i < nf; i++) {
        R = pr(o, SP_NS.depart * 1000 + 500 + i);
        var b = R() * 6.2832, sp = (0.8 + R() * 0.8) * m;
        spPart(ctl, { mode: 'burst', x: ctl.px, y: ctl.py + 0.5, z: ctl.pz, vx: Math.cos(b) * sp, vy: (1.2 + R()) * m, vz: Math.sin(b) * sp, g: 4, life: 0.5 + R() * 0.3, size: 0.1 + R() * 0.04, mat: pal(o, 2), spin: 8 * m, s1: 0.8 });
      }
      ctl.tick = function (c, t, k) {
        g.position.set(c.px, c.py + 0.05, c.pz); g.scale.setScalar((0.25 + easeOut(k) * 1.1) * s); g.material.opacity = 0.75 * (1 - k);
        col.position.set(c.px, c.py + 0.1 + easeOut(k) * 1.9 * m, c.pz); col.scale.setScalar(0.55 * (1 - 0.55 * k) * s); col.material.opacity = 0.6 * (1 - k);
      };
    });
  };
  /* 5+6 Arrival burst + recovery: cincin lebar melebar + serpihan jatuh ke pion lalu menyembur ke samping (karakter: horizontal, turun) */
  SP_KINDS['tp-arrive'] = function (o) {
    return spRun('tp-arrive', 0.7, o, function (ctl) {
      ctl.hy = num(o.hy, 0.6); spCenter(ctl);
      var s = ctl.scale, g = spFlat(spMesh(ctl, SP_RING, pal(o, 2), 0.7)), dn = spFlat(spMesh(ctl, SP_RING, pal(o, 0), 0.6)), i, R;
      var n = spCount(28, o), nd = spCount(12, o), nf = spCount(8, o), m = mo();
      for (i = 0; i < n; i++) {
        R = pr(o, SP_NS.arrive * 1000 + i);
        var a = R() * 6.2832, sp = (1.6 + R() * 1.8) * m;
        spPart(ctl, { mode: 'burst', x: ctl.px, y: ctl.py + 0.15, z: ctl.pz, vx: Math.cos(a) * sp, vy: (0.6 + R() * 1.2) * m, vz: Math.sin(a) * sp, g: 7, life: 0.4 + R() * 0.4, size: 0.04 + R() * 0.06, mat: pal(o, i % 3) });
      }
      for (i = 0; i < nd; i++) {
        R = pr(o, SP_NS.arrive * 1000 + 300 + i);
        spPart(ctl, { mode: 'burst', x: ctl.px + (R() - 0.5) * 0.5 * s, y: ctl.py + 1.4 + R() * 0.6, z: ctl.pz + (R() - 0.5) * 0.5 * s, vy: -(3 + R() * 2) * m, g: 0, life: 0.3 + R() * 0.1, size: 0.05 + R() * 0.04, mat: pal(o, 2) });
      }
      for (i = 0; i < nf; i++) {
        R = pr(o, SP_NS.arrive * 1000 + 600 + i);
        var b = R() * 6.2832, sp2 = (1 + R() * 1.2) * m;
        spPart(ctl, { mode: 'burst', x: ctl.px, y: ctl.py + 0.4, z: ctl.pz, vx: Math.cos(b) * sp2, vy: (1 + R()) * m, vz: Math.sin(b) * sp2, g: 5, life: 0.5 + R() * 0.3, size: 0.1 + R() * 0.04, mat: pal(o, 1), spin: 7 * m, s1: 0.8 });
      }
      ctl.tick = function (c, t, k) {
        g.position.set(c.px, c.py + 0.05, c.pz); g.scale.setScalar((0.15 + easeOut(k) * 1.6) * s); g.material.opacity = 0.7 * (1 - k) * (1 - k);
        var d = clamp(k / 0.4, 0, 1);
        dn.position.set(c.px, c.py + 0.1 + 1.8 * (1 - d) * m, c.pz); dn.scale.setScalar(0.5 * s); dn.material.opacity = k < 0.4 ? 0.6 : Math.max(0, 0.6 - (k - 0.4) * 3);
        dn.visible = dn.material.opacity > 0.01;
      };
    });
  };
  /* 7. Recovery particles: percik halus berputar naik di sekitar pion (mengikuti pion) */
  SP_KINDS['tp-recover'] = function (o) {
    return spRun('tp-recover', 0.9, o, function (ctl) {
      ctl.hy = num(o.hy, 0.2); spCenter(ctl);
      var n = spCount(10, o), m = mo();
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.recover * 1000 + i), life = 0.6 + R() * 0.3, a = R() * 6.2832, rad = 0.45 * ctl.scale;
        spPart(ctl, { mode: 'swirl', a: a, w: (R() < 0.5 ? -1 : 1) * (3 + R() * 3) * m, rad: rad, rise: 0.9 * m, x: ctl.cx + Math.cos(a) * rad, y: ctl.cy, z: ctl.cz + Math.sin(a) * rad, life: life, size: 0.04 + R() * 0.03, mat: pal(o, 1 + (i % 2)) });
      }
    });
  };
  /* 8. Residual energy: percik tipis berkedip + glow tanah redup yang tertinggal */
  SP_KINDS['tp-residual'] = function (o) {
    return spRun('tp-residual', 1.3, o, function (ctl) {
      var s = ctl.scale, glow = spFlat(spMesh(ctl, SP_DISC, pal(o, 3), 0.22)), n = spCount(7, o), m = mo();
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.residual * 1000 + i), a = R() * 6.2832, rad = (0.15 + R() * 0.4) * s;
        spPart(ctl, { mode: 'burst', x: ctl.px + Math.cos(a) * rad, y: ctl.py + 0.1, z: ctl.pz + Math.sin(a) * rad, vy: (0.3 + R() * 0.3) * m, g: 0, life: 0.8 + R() * 0.5, size: 0.03 + R() * 0.03, mat: pal(o, 1 + (i % 2)) });
      }
      ctl.tick = function (c, t, k) {
        glow.position.set(c.px, c.py + 0.04, c.pz); glow.scale.setScalar(0.6 * s * (1 - k * 0.3)); glow.material.opacity = 0.22 * (1 - k) * (reduced() ? 1 : 0.85 + 0.15 * Math.sin(t * 9));
      };
    });
  };
  /* Spatial Energy Trail: serpihan mengalir dari 'from' ke 'to' (busur ringan). Dipakai teleport, penyerapan, dan pertukaran. */
  SP_KINDS['tp-trail'] = function (o) {
    var a = o.from || o.pos, b = o.to;
    if (!a || !b) return null;
    var dur = clamp(num(o.dur, 0.6), 0.2, 1.5);
    return spRun('tp-trail', dur, cp(o, { pos: a, follow: null }), function (ctl) {
      var ax = num(+a.x, 0), ay = num(+a.y, 0), az = num(+a.z, 0), bx = num(+b.x, 0), by = num(+b.y, 0), bz = num(+b.z, 0);
      var dx = bx - ax, dz = bz - az, dist = Math.sqrt(dx * dx + dz * dz + (by - ay) * (by - ay)), len = Math.sqrt(dx * dx + dz * dz) || 1;
      var arcH = Math.min(1, 0.25 * dist + 0.3) * mo(), side = num(o.side, 0), px = -dz / len * side, pz = dx / len * side;
      var N = spCount(18, o), made = 0, hy = num(o.hy, 0.8);
      ctl.tick = function (c, t) {
        var want = Math.floor(N * clamp(t / (dur * 0.6), 0, 1) + 0.0001);
        while (made < want) {
          var R = pr(o, SP_NS.trail * 1000 + made), f = made / N, sn = Math.sin(Math.PI * f);
          spPart(ctl, { mode: 'burst', x: ax + dx * f + px * sn + (R() - 0.5) * 0.2, y: ay + hy + (by - ay) * f + sn * arcH + (R() - 0.5) * 0.2, z: az + dz * f + pz * sn + (R() - 0.5) * 0.2, vy: 0.3 * mo(), g: 0, life: 0.35 + R() * 0.3, size: 0.05 + R() * 0.05, mat: pal(o, made % 3) });
          made++;
        }
      };
    });
  };

  /* ---- Ender Hole: lapisan energi di atas lubang hitam lama (inti, cincin, & hisapan lama tidak diubah) ---- */
  /* pembukaan (gelombang kejut), energi lubang (glow), pusaran voxel terhisap, penutupan (kolaps), partikel sisa */
  SP_KINDS['hole-fx'] = function (o) {
    var life = clamp(num(o.dur, HOLE_LIFE), 0.8, 4), closeLen = 0.4, tilt = 1.15;
    return spRun('hole-fx', life, o, function (ctl) {
      var s = ctl.scale; ctl.hy = 0.95 * s; spCenter(ctl);
      ctl.U = [1, 0, 0]; ctl.V = [0, Math.cos(tilt), Math.sin(tilt)]; ctl.N = [0, -Math.sin(tilt), Math.cos(tilt)];
      var shock = spFlat(spMesh(ctl, SP_RING, pal(o, 1), 0.5)), glow = spMesh(ctl, SP_DISC, pal(o, 3), 0.26), coll = spFlat(spMesh(ctl, SP_RING, pal(o, 2), 0)), made = 0, burst = false;
      glow.rotation.x = tilt; coll.visible = false;
      var N = spCount(44, o), m = mo();
      ctl.tick = function (c, t) {
        var env = t < 0.7 ? easeOut(t / 0.7) : (t > life - closeLen ? 1 - easeOut((t - (life - closeLen)) / closeLen) : 1);
        var sk = clamp(t / 0.55, 0, 1);
        shock.position.set(c.px, c.py + 0.05, c.pz); shock.scale.setScalar((0.3 + easeOut(sk) * 1.3) * s); shock.material.opacity = 0.5 * (1 - sk); shock.visible = sk < 1;
        glow.position.set(c.cx, c.cy, c.cz); glow.scale.setScalar(Math.max(0.001, 1.35 * s * env)); glow.material.opacity = 0.26 * env * (reduced() ? 1 : 0.85 + 0.15 * Math.sin(t * 7));
        var want = Math.floor(N * clamp((t - 0.1) / (life - 0.6), 0, 1) + 0.0001);
        while (made < want) {
          var R = pr(o, SP_NS.hole * 1000 + made);
          spPart(ctl, { mode: 'swirl', a: R() * 6.2832, w: (4 + R() * 3) * m, rad: (0.7 + R() * 1.1) * s, d: (R() - 0.5) * 0.3, x: c.cx, y: c.cy, z: c.cz, life: 0.7 + R() * 0.3, size: 0.04 + R() * 0.04, mat: pal(o, made % 3) });
          made++;
        }
        if (t > life - closeLen) {
          var ck = clamp((t - (life - closeLen)) / closeLen, 0, 1);
          coll.visible = true; coll.position.set(c.px, c.py + 0.05, c.pz); coll.scale.setScalar(Math.max(0.001, (1.2 * (1 - ck) + 0.1) * s)); coll.material.opacity = 0.5 * Math.sin(Math.PI * ck);
        }
        if (!burst && t >= life - 0.05) {
          burst = true;
          var nb = spCount(12, o);
          for (var i = 0; i < nb; i++) {
            var Q = pr(o, SP_NS.collapse * 1000 + i), a = Q() * 6.2832, sp = (0.4 + Q() * 0.8) * m;
            spPart(ctl, { mode: 'burst', x: c.cx, y: c.cy, z: c.cz, vx: Math.cos(a) * sp, vy: (0.4 + Q() * 0.6) * m, vz: Math.sin(a) * sp, g: 1.5, life: 0.8 + Q() * 0.3, size: 0.03 + Q() * 0.04, mat: pal(o, i % 3) });
          }
        }
      };
    });
  };

  /* ---- Portal ---- */
  SP_KINDS.portal = function (o) {
    var OPEN = 0.5, CLOSE = 0.4, idle = clamp(num(o.idle, 2.5), 0.2, 12), yaw = num(o.yaw, 0);
    var ctl = spRun('portal', OPEN + idle + CLOSE, o, function (ctl) {
      var s = ctl.scale, i; ctl.hy = 1.0 * s; spCenter(ctl); spBasis(ctl, yaw); ctl.closeAt = OPEN + idle;
      var back = spMesh(ctl, SP_DISC, 5, 0.9, false); back.rotation.y = yaw;
      var defs = [[1.0, 2, 0.85, 0.02, 1.6], [0.78, 1, 0.6, -0.04, -2.4], [0.55, 0, 0.5, -0.1, 3.2]]; /* [radius, warna, opacity, kedalaman, spin] -> lorong berlapis = kedalaman */
      var rings = defs.map(function (d) { var m = spMesh(ctl, SP_RING, d[1], d[2]); m.rotation.y = yaw; return m; });
      var nc = (quality() === 'low' || reduced()) ? 8 : 12, cubes = [];
      for (i = 0; i < nc; i++) cubes.push(spCube(ctl, i % 2 ? 0 : 3));
      var acc = 0, opened = false, closed = false, m = mo();
      ctl.tick = function (c, t, k, dt) {
        var env = t < OPEN ? easeOut(t / OPEN) : (t > c.closeAt ? 1 - easeOut((t - c.closeAt) / CLOSE) : 1), e = Math.max(0.001, env);
        back.position.set(c.cx + c.N[0] * -0.12, c.cy, c.cz + c.N[2] * -0.12); back.scale.setScalar(0.9 * s * e);
        for (var j = 0; j < rings.length; j++) { var d = defs[j], r = rings[j]; r.position.set(c.cx + c.N[0] * d[3], c.cy, c.cz + c.N[2] * d[3]); r.scale.setScalar(d[0] * s * e); r.rotation.z = t * d[4] * m; }
        for (j = 0; j < cubes.length; j++) {
          var an = j / cubes.length * 6.2832, cu = Math.cos(an) * 1.08 * s * e, sv = Math.sin(an) * 1.08 * s * e;
          cubes[j].position.set(c.cx + c.U[0] * cu + c.V[0] * sv, c.cy + c.U[1] * cu + c.V[1] * sv, c.cz + c.U[2] * cu + c.V[2] * sv);
          cubes[j].scale.setScalar(Math.max(0.001, (1.0 + 0.15 * (reduced() ? 0 : Math.sin(t * 4 + j))) * s * e)); cubes[j].rotation.z = an;
        }
        var q, R, a;
        if (!opened) { opened = true; for (q = 0, a = spCount(10, o); q < a; q++) { R = pr(o, SP_NS.portal * 1000 + 800 + q); var th = R() * 6.2832, sp = (1 + R()) * m; spPart(c, { mode: 'burst', x: c.cx, y: c.cy, z: c.cz, vx: (c.U[0] * Math.cos(th) + c.V[0] * Math.sin(th)) * sp, vy: Math.sin(th) * sp, vz: (c.U[2] * Math.cos(th)) * sp, g: 0, life: 0.5, size: 0.06, mat: pal(o, 1) }); } }
        if (t > OPEN * 0.6 && t < c.closeAt) { /* partikel portal: terus keluar, mengorbit, terhisap ke pusat */
          acc += dt;
          while (acc >= 0.1) {
            acc -= 0.1;
            R = pr(o, SP_NS.portal * 1000 + (c.emitted = (c.emitted || 0) + 1));
            spPart(c, { mode: 'swirl', a: R() * 6.2832, w: (R() < 0.5 ? -1 : 1) * (2 + R() * 2) * m, rad: (1.0 + R() * 0.4) * s, d: (R() - 0.5) * 0.2, x: c.cx, y: c.cy, z: c.cz, life: 0.8 + R() * 0.3, size: 0.04 + R() * 0.04, mat: pal(o, (c.emitted + 1) % 3) });
          }
        }
        if (!closed && t >= c.closeAt) { /* penutupan: cincin kolaps + percik terakhir */
          closed = true;
          var cr = spMesh(c, SP_RING, pal(o, 2), 0.6); cr.rotation.y = yaw; cr.position.set(c.cx, c.cy, c.cz); c.collapseRing = cr; c.collapseAt = t;
          for (q = 0, a = spCount(10, o); q < a; q++) { R = pr(o, SP_NS.portal * 1000 + 900 + q); var th2 = R() * 6.2832, sp2 = (0.6 + R() * 0.8) * m; spPart(c, { mode: 'burst', x: c.cx, y: c.cy, z: c.cz, vx: (c.U[0] * Math.cos(th2)) * sp2, vy: Math.sin(th2) * sp2, vz: (c.U[2] * Math.cos(th2)) * sp2, g: 1, life: 0.4, size: 0.05, mat: pal(o, 2) }); }
        }
        if (c.collapseRing) { var ck = clamp((t - c.collapseAt) / CLOSE, 0, 1); c.collapseRing.scale.setScalar(Math.max(0.001, (1.1 * (1 - ck) + 0.05) * s)); c.collapseRing.material.opacity = 0.6 * (1 - ck); }
      };
    });
    if (!ctl) return null;
    var base = { pos: { x: ctl.px, y: ctl.py, z: ctl.pz }, yaw: yaw, scale: ctl.scale, tier: o.tier };
    return {
      id: ctl.id,
      close: function () { if (ctl.cleaned || ctl.t >= ctl.closeAt) return false; ctl.closeAt = Math.max(OPEN, ctl.t); ctl.dur = ctl.closeAt + CLOSE; return true; },
      stop: function () { return stop(ctl.id, 'portal-stop'); },
      enter: function () { return SP_KINDS['portal-entry'](cp(base, { seed: o.seed, fid: o.fid, source: o.source })); },
      exit: function () { return SP_KINDS['portal-exit'](cp(base, { seed: o.seed, fid: o.fid, source: o.source })); }
    };
  };
  SP_KINDS['portal-entry'] = function (o) {
    var yaw = num(o.yaw, 0), dur = 0.5;
    return spRun('portal-entry', dur, o, function (ctl) {
      var s = ctl.scale; ctl.hy = 1.0 * s; spCenter(ctl); spBasis(ctl, yaw);
      var ring = spMesh(ctl, SP_RING, pal(o, 2), 0.6), n = spCount(16, o), U = ctl.U, V = ctl.V, N = ctl.N;
      ring.rotation.y = yaw;
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.entry * 1000 + i), th = R() * 6.2832, cu = Math.cos(th), sv = Math.sin(th), rad = (1.0 + R() * 0.4) * s;
        var dx = U[0] * cu + V[0] * sv + N[0] * 0.6, dy = V[1] * sv + 0.0, dz = U[2] * cu + N[2] * 0.6;
        spPart(ctl, { mode: 'gather', dx: dx, dy: dy, dz: dz, rad: rad, x: ctl.cx + dx * rad, y: ctl.cy + dy * rad, z: ctl.cz + dz * rad, life: dur, size: 0.05 + R() * 0.05, mat: pal(o, i % 3), s1: 0.5 });
      }
      ctl.tick = function (c, t, k) { ring.position.set(c.cx, c.cy, c.cz); ring.scale.setScalar((1.1 * (1 - k) + 0.25) * s); ring.material.opacity = 0.6 * (1 - k * k); };
    });
  };
  SP_KINDS['portal-exit'] = function (o) {
    var yaw = num(o.yaw, 0);
    return spRun('portal-exit', 0.6, o, function (ctl) {
      var s = ctl.scale; ctl.hy = 1.0 * s; spCenter(ctl); spBasis(ctl, yaw);
      var ring = spMesh(ctl, SP_RING, pal(o, 1), 0.6), n = spCount(20, o), U = ctl.U, V = ctl.V, N = ctl.N, m = mo();
      ring.rotation.y = yaw;
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.exit * 1000 + i), th = R() * 6.2832, cu = Math.cos(th) * (0.8 + R() * 1.2) * m, sv = Math.sin(th) * (0.8 + R() * 1.2) * m, fw = (1.8 + R() * 1.5) * m;
        spPart(ctl, { mode: 'burst', x: ctl.cx, y: ctl.cy, z: ctl.cz, vx: U[0] * cu + N[0] * fw, vy: V[1] * sv, vz: U[2] * cu + N[2] * fw, g: 2, life: 0.45 + R() * 0.35, size: 0.04 + R() * 0.05, mat: pal(o, i % 3) });
      }
      ctl.tick = function (c, t, k) { ring.position.set(c.cx, c.cy, c.cz); ring.scale.setScalar((0.3 + easeOut(k) * 1.0) * s); ring.material.opacity = 0.6 * (1 - k); };
    });
  };

  /* ---- Spatial Distortion: titik pusat (pos) + arah (dir = yaw, rad) ---- */
  SP_KINDS.distort = function (o) {
    var dur = clamp(num(o.dur, 1.4), 0.6, 3), dir = num(o.dir, 0);
    return spRun('distort', dur, o, function (ctl) {
      var s = ctl.scale, i, phi = Math.atan2(-Math.cos(dir), Math.sin(dir)), dvx = Math.sin(dir), dvz = Math.cos(dir), m = mo();
      ctl.hy = 0.6 * s; spCenter(ctl);
      var rip = [0, 1, 2].map(function () { return spFlat(spMesh(ctl, SP_RING, pal(o, 0), 0)); }); /* riak energi: memanjang searah dir */
      var wave = spMesh(ctl, SP_RING, pal(o, 2), 0); wave.rotation.y = dir; /* gelombang ruang: cincin tegak lurus dir, bergerak searah dir */
      var dring = spMesh(ctl, SP_RING, pal(o, 1), 0); dring.rotation.x = 1.3; /* cincin distorsi: berdenyut */
      var coll = spFlat(spMesh(ctl, SP_RING, pal(o, 2), 0)); /* kolaps energi */
      var vN = spCount(30, o), fN = spCount(10, o), vm = 0, fm = 0, burst = false;
      ctl.tick = function (c, t, k) {
        for (var j = 0; j < 3; j++) {
          var lk = clamp((t - j * 0.18) / 0.8, 0, 1), r = rip[j], rr = (0.3 + easeOut(lk) * 1.9) * s;
          r.position.set(c.px, c.py + 0.05, c.pz); r.rotation.z = phi; r.scale.set(rr * 1.4, rr, 1); r.material.opacity = (t < j * 0.18 || lk >= 1) ? 0 : 0.55 * (1 - lk); r.visible = r.material.opacity > 0.01;
        }
        var wk = clamp((t - 0.05) / 0.9, 0, 1);
        wave.position.set(c.cx + dvx * easeOut(wk) * 2.0 * s * m, c.cy, c.cz + dvz * easeOut(wk) * 2.0 * s * m); wave.scale.setScalar(Math.max(0.001, 0.8 * s * (0.6 + easeOut(wk) * 0.7))); wave.material.opacity = (wk <= 0 || wk >= 1) ? 0 : 0.5 * (1 - wk); wave.visible = wave.material.opacity > 0.01;
        var dk = clamp((t - 0.1) / (dur - 0.5), 0, 1), dv = Math.sin(Math.PI * dk);
        dring.position.set(c.cx, c.cy, c.cz); dring.scale.setScalar(0.9 * s * (1 + (reduced() ? 0 : 0.08 * Math.sin(t * 12)))); dring.rotation.z = reduced() ? 0 : t * 2.2; dring.material.opacity = 0.6 * dv; dring.visible = dring.material.opacity > 0.01;
        var vw = Math.floor(vN * clamp(t / (dur - 0.5), 0, 1) + 0.0001);
        while (vm < vw) { var R = pr(o, SP_NS.ripple * 1000 + vm), a = R() * 6.2832; spPart(c, { mode: 'swirl', a: a, w: (6 + R() * 3) * m, rad: (1.2 + R() * 0.5) * s, rise: 0.2, x: c.cx, y: c.cy, z: c.cz, life: 0.6 + R() * 0.3, size: 0.04 + R() * 0.04, mat: pal(o, vm % 3) }); vm++; } /* tarikan pusaran ke titik pusat */
        var fw = Math.floor(fN * clamp((t - 0.2) / 0.6, 0, 1) + 0.0001);
        while (fm < fw) { var Q = pr(o, SP_NS.frag * 1000 + fm), b = Q() * 6.2832, rd = (0.8 + Q() * 0.7) * s; spPart(c, { mode: 'burst', x: c.cx + Math.cos(b) * rd, y: c.cy + (Q() - 0.5) * 0.5, z: c.cz + Math.sin(b) * rd, vx: dvx * (0.6 + Q()) * m, vz: dvz * (0.6 + Q()) * m, vy: 0.3 * m, g: 0, life: 0.8 + Q() * 0.4, size: 0.09 + Q() * 0.05, mat: pal(o, 2 - (fm % 2)), spin: 5 * m, s1: 0.6 }); fm++; } /* serpihan dimensi */
        if (t > dur - 0.4) {
          var ck = clamp((t - (dur - 0.4)) / 0.4, 0, 1);
          coll.position.set(c.px, c.py + 0.05, c.pz); coll.scale.setScalar(Math.max(0.001, (1.0 * (1 - ck) + 0.05) * s)); coll.material.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, ck * 1.1)); coll.visible = coll.material.opacity > 0.01;
          if (!burst && ck > 0.6) { burst = true; for (i = 0, a = spCount(14, o); i < a; i++) { var P = pr(o, SP_NS.collapse * 1000 + 100 + i), an = P() * 6.2832, sp = (1 + P() * 1.5) * m; spPart(c, { mode: 'burst', x: c.cx, y: c.cy, z: c.cz, vx: Math.cos(an) * sp, vy: (0.3 + P()) * m, vz: Math.sin(an) * sp, g: 2, life: 0.35, size: 0.04 + P() * 0.04, mat: pal(o, i % 3) }); } }
        } else { coll.visible = false; }
      };
    });
  };

  SP_KINDS['sword-slash'] = function (o) {
    var style = o.style || 'horizontal', heavy = style === 'heavy' || style === 'heavy-diagonal', diagonal = style === 'diagonal' || style === 'heavy-diagonal', double = style === 'double', critical = style === 'critical';
    var dur = clamp(num(o.dur, heavy || double || critical ? 0.62 : 0.42), 0.2, 1.2);
    return spRun('sword-slash', dur, o, function (ctl) {
      var yaw = num(o.dir, 0), s = ctl.scale, layers = double ? 2 : 1, n = spCount(heavy ? 10 : 8, o), ci = critical || heavy ? 6 : 2;
      ctl.hy = 0.65 * s; spCenter(ctl); spBasis(ctl, yaw);
      var slashes = [], i, j;
      for (j = 0; j < layers; j++) for (i = 0; i < n; i++) {
        var u = n === 1 ? 0.5 : i / (n - 1), a = (u - 0.5) * Math.PI * 0.82;
        var lateral = style === 'vertical' ? 0.12 + Math.cos(a) * 0.28 : Math.sin(a) * (heavy ? 0.88 : 0.72);
        var height = style === 'vertical' ? 0.65 + Math.sin(a) * 0.62 : 0.62 + (diagonal || critical ? (u - 0.5) * -0.55 : Math.sin(a) * 0.08);
        var m = spMesh(ctl, CONF_GEO, ci, heavy ? 0.78 : 0.68, false);
        m.scale.set(0.22 * s * (heavy ? 1.2 : 1), 0.07 * s, 0.045 * s);
        m.rotation.y = yaw;
        slashes.push({ mesh: m, lateral: lateral, height: height, depth: 0.2 + Math.cos(a) * 0.16, progress: u, pass: j, angle: style === 'vertical' ? 0 : (diagonal || critical ? -0.45 : 0) });
      }
      var ring = null;
      if (heavy) { ring = spFlat(spMesh(ctl, SP_RING, 6, 0.58)); }
      var nbits = spCount(heavy || critical ? 10 : 5, o), motion = mo();
      for (i = 0; i < nbits; i++) {
        var R = pr(o, SP_NS.slash * 1000 + i), th = yaw + (R() - 0.5) * 1.25, rad = 0.25 + R() * 0.3;
        spPart(ctl, { mode: 'burst', x: ctl.px + Math.sin(th) * rad, y: ctl.py + 0.55 + R() * 0.45, z: ctl.pz + Math.cos(th) * rad, vx: Math.sin(th) * (heavy ? 1.6 : 0.8) * motion, vy: (R() - 0.2) * motion, vz: Math.cos(th) * (heavy ? 1.6 : 0.8) * motion, g: 1.5, life: 0.25 + R() * 0.2, size: 0.035 + R() * 0.025, mat: critical ? 6 : ci });
      }
      ctl.tick = function (c, t, k) {
        var u = easeOut(clamp(k / (double ? 0.78 : 0.7), 0, 1));
        slashes.forEach(function (item) {
          var passStart = item.pass * 0.34, pass = clamp((k - passStart) / (double ? 0.36 : 0.56), 0, 1);
          var fade = Math.max(0, 1 - Math.max(0, k - 0.52) / 0.48);
          item.mesh.position.set(c.px + c.U[0] * item.lateral + c.N[0] * (item.depth + u * (heavy ? 0.5 : 0.35)), c.py + item.height * s, c.pz + c.U[2] * item.lateral + c.N[2] * (item.depth + u * (heavy ? 0.5 : 0.35)));
          item.mesh.rotation.z = item.angle + (style === 'vertical' ? 0 : (u - 0.5) * 0.9);
          item.mesh.material.opacity = (heavy ? 0.78 : 0.68) * fade * clamp(pass * 3, 0, 1);
        });
        if (ring) {
          ring.position.set(c.px, c.py + 0.04, c.pz);
          ring.scale.setScalar((0.3 + easeOut(k) * 1.1) * s);
          ring.material.opacity = 0.58 * (1 - k);
        }
      };
    });
  };

  SP_KINDS['weapon-charge'] = function (o) {
    var dur = clamp(num(o.dur, 1.2), 0.2, 2.5);
    return spRun('weapon-charge', dur, o, function (ctl) {
      var s = ctl.scale, rings = [0, 1].map(function (i) { return spMesh(ctl, SP_RING, i ? 6 : 2, i ? 0.35 : 0.5); });
      rings.forEach(function (r) { r.rotation.y = num(o.dir, 0); });
      var n = spCount(8, o), motion = mo();
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.charge * 1000 + i), a = R() * 6.2832, rad = 0.38 + R() * 0.22;
        spPart(ctl, { mode: 'swirl', a: a, w: (3 + R() * 2) * motion, rad: rad * s, x: ctl.cx + Math.cos(a) * rad, y: ctl.cy + Math.sin(a) * 0.3, z: ctl.cz + Math.sin(a) * rad, life: dur, size: 0.04 + R() * 0.025, mat: i % 2 ? 6 : 2 });
      }
      ctl.tick = function (c, t, k) {
        var pulse = reduced() ? 1 : 0.94 + 0.06 * Math.sin(t * 10);
        rings[0].position.set(c.cx, c.cy, c.cz); rings[0].scale.setScalar((0.48 + k * 0.14) * s * pulse); rings[0].material.opacity = 0.45 * (1 - k * 0.3);
        rings[1].position.set(c.cx, c.cy, c.cz); rings[1].scale.setScalar((0.32 + k * 0.12) * s); rings[1].material.opacity = 0.32 * (1 - k * 0.2);
      };
    });
  };

  SP_KINDS['weapon-trail'] = function (o) {
    var dur = clamp(num(o.dur, 0.72), 0.25, 1.2);
    return spRun('weapon-trail', dur, o, function (ctl) {
      var n = spCount(8, o), color = o.style === 'heavy' ? 6 : 2, history = [], segments = [];
      for (var i = 0; i < n; i++) segments.push(spMesh(ctl, CONF_GEO, color, 0, false));
      ctl.tick = function (c, t, k) {
        history.unshift({ x: c.cx, y: c.cy, z: c.cz });
        if (history.length > n + 1) history.length = n + 1;
        for (var j = 0; j < segments.length; j++) {
          var m = segments[j], a = history[j], b = history[j + 1] || a;
          if (!a) { m.visible = false; continue; }
          var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          m.visible = len > 0.01 && k < 0.98;
          if (!m.visible) continue;
          m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
          m.rotation.y = Math.atan2(dx, dz); m.rotation.z = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
          m.scale.set(Math.max(0.1, len / 0.14), 0.08 * ctl.scale / 0.14, 0.035 * ctl.scale / 0.14);
          m.material.opacity = (o.style === 'heavy' ? 0.68 : 0.52) * (1 - j / segments.length) * (1 - k * 0.55);
        }
      };
    });
  };

  SP_KINDS['weapon-release'] = function (o) {
    return spRun('weapon-release', 0.32, o, function (ctl) {
      var ring = spFlat(spMesh(ctl, SP_RING, o.style === 'heavy' ? 6 : 2, 0.6)), n = spCount(8, o), motion = mo();
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.release * 1000 + i), a = R() * 6.2832, speed = (0.6 + R() * 0.8) * motion;
        spPart(ctl, { mode: 'burst', x: ctl.px, y: ctl.py + 0.5, z: ctl.pz, vx: Math.cos(a) * speed, vy: (0.4 + R() * 0.5) * motion, vz: Math.sin(a) * speed, g: 1, life: 0.25 + R() * 0.12, size: 0.04 + R() * 0.03, mat: o.style === 'heavy' ? 6 : 2 });
      }
      ctl.tick = function (c, t, k) { ring.position.set(c.px, c.py + 0.04, c.pz); ring.scale.setScalar((0.2 + easeOut(k) * 0.9) * c.scale); ring.material.opacity = 0.6 * (1 - k); };
    });
  };

  SP_KINDS['combat-projectile'] = function (o) {
    var a = o.from || o.pos, b = o.to;
    if (!a || !b) return null;
    var dur = clamp(num(o.dur, 0.4), 0.12, 1.5);
    return spRun('combat-projectile', dur, cp(o, { pos: a, follow: null }), function (ctl) {
      var ax = num(+a.x, 0), ay = num(+a.y, 0), az = num(+a.z, 0), dx = num(+b.x, 0) - ax, dy = num(+b.y, 0) - ay, dz = num(+b.z, 0) - az;
      var n = spCount(o.style === 'charged' ? 14 : 9, o), made = 0;
      ctl.tick = function (c, t) {
        var want = Math.floor(n * clamp(t / dur, 0, 1) + 0.0001);
        while (made < want) {
          var R = pr(o, SP_NS.projectile * 1000 + made), f = made / Math.max(1, n - 1), spread = (R() - 0.5) * 0.08;
          spPart(c, { mode: 'burst', x: ax + dx * f + spread, y: ay + dy * f + Math.sin(f * Math.PI) * 0.35 + spread, z: az + dz * f + spread, vx: -dx * 0.18 / dur, vy: 0.15, vz: -dz * 0.18 / dur, g: 0, life: 0.2 + R() * 0.12, size: o.style === 'charged' ? 0.06 : 0.045, mat: o.style === 'charged' ? 6 : 2 });
          made++;
        }
      };
    });
  };

  SP_KINDS['combat-impact'] = function (o) {
    var style = o.style || 'hit', heavy = style === 'heavy' || style === 'ground', critical = style === 'critical';
    return spRun('combat-impact', 0.48, o, function (ctl) {
      var s = ctl.scale, color = critical ? 6 : style === 'damage' ? 7 : style === 'ground' ? 6 : 2;
      var ring = spFlat(spMesh(ctl, SP_RING, color, 0.68)), hit = spMesh(ctl, SP_RING, color, 0.5), flash = spMesh(ctl, SP_DISC, color, 0.28);
      var n = spCount(heavy ? 18 : 12, o), motion = mo();
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.impact * 1000 + i), a = R() * 6.2832, speed = (heavy ? 1.8 : 1.2) * (0.6 + R() * 0.6) * motion;
        spPart(ctl, { mode: 'burst', x: ctl.px, y: ctl.py + (style === 'ground' ? 0.08 : 0.5), z: ctl.pz, vx: Math.cos(a) * speed, vy: style === 'ground' ? 0.1 : (0.4 + R() * 0.8) * motion, vz: Math.sin(a) * speed, g: style === 'ground' ? 0.5 : 2.5, life: 0.28 + R() * 0.2, size: 0.04 + R() * 0.045, mat: color });
      }
      ctl.tick = function (c, t, k) {
        ring.position.set(c.px, c.py + 0.04, c.pz); ring.scale.setScalar((0.24 + easeOut(k) * (heavy ? 1.35 : 0.95)) * s); ring.material.opacity = 0.68 * (1 - k);
        hit.position.set(c.cx, c.cy, c.cz); hit.scale.setScalar((0.22 + easeOut(k) * 0.42) * s); hit.material.opacity = 0.5 * (1 - k); hit.visible = hit.material.opacity > 0.01;
        flash.position.set(c.cx, c.cy, c.cz); flash.scale.setScalar((0.12 + clamp(t / 0.08, 0, 1) * 0.2) * s); flash.material.opacity = 0.28 * Math.max(0, 1 - t / 0.12); flash.visible = flash.material.opacity > 0.01;
      };
    });
  };

  SP_KINDS['combat-defense'] = function (o) {
    var absorb = o.style === 'absorb', dur = 0.5;
    return spRun('combat-defense', dur, o, function (ctl) {
      var yaw = num(o.dir, 0), s = ctl.scale, color = absorb ? 6 : 4;
      spCenter(ctl); spBasis(ctl, yaw);
      var shield = [];
      if (!absorb) {
        var points = [[0, 0.42], [0.34, 0.18], [0.28, -0.22], [0, -0.42], [-0.28, -0.22], [-0.34, 0.18]];
        for (var i = 0; i < points.length; i++) {
          var m = spMesh(ctl, CONF_GEO, color, 0.72, false);
          m.scale.set(0.17 * s, 0.07 * s, 0.06 * s); shield.push({ mesh: m, x: points[i][0], y: points[i][1] });
        }
      }
      var ring = spMesh(ctl, SP_RING, color, 0.48), n = spCount(absorb ? 12 : 7, o);
      for (i = 0; i < n; i++) {
        var R = pr(o, SP_NS.defense * 1000 + i), a = R() * 6.2832, rad = 0.38 + R() * 0.3;
        spPart(ctl, { mode: absorb ? 'gather' : 'burst', dx: Math.cos(a), dy: 0, dz: Math.sin(a), rad: rad, x: ctl.cx + Math.cos(a) * rad, y: ctl.cy + (R() - 0.5) * 0.45, z: ctl.cz + Math.sin(a) * rad, vx: Math.cos(a) * 0.8 * mo(), vy: 0.5 * mo(), vz: Math.sin(a) * 0.8 * mo(), life: dur, size: 0.045, mat: color });
      }
      ctl.tick = function (c, t, k) {
        shield.forEach(function (item) {
          item.mesh.position.set(c.cx + c.U[0] * item.x, c.cy + item.y * s, c.cz + c.U[2] * item.x);
          item.mesh.rotation.y = yaw; item.mesh.material.opacity = 0.72 * (1 - k);
        });
        ring.position.set(c.cx, c.cy, c.cz); ring.scale.setScalar((0.4 + easeOut(k) * 0.9) * s); ring.rotation.y = yaw; ring.material.opacity = 0.48 * (1 - k);
      };
    });
  };

  SP_KINDS['buff-feedback'] = function (o) {
    var ending = o.style === 'end', dur = ending ? 0.42 : 0.62;
    return spRun('buff-feedback', dur, o, function (ctl) {
      var s = ctl.scale, color = ending ? 2 : 4, ring = spFlat(spMesh(ctl, SP_RING, color, 0.56)), shield = [];
      var points = [[0, 0.34], [0.2, 0.14], [0.16, -0.12], [0, -0.28], [-0.16, -0.12], [-0.2, 0.14]];
      for (var i = 0; i < points.length; i++) {
        var m = spMesh(ctl, CONF_GEO, color, 0.64, false);
        m.scale.set(0.1 * s, 0.1 * s, 0.07 * s);
        shield.push({ mesh: m, x: points[i][0], y: points[i][1] });
      }
      var n = spCount(ending ? 8 : 12, o), motion = mo();
      for (i = 0; i < n; i++) {
        var R = pr(o, SP_NS.buff * 1000 + i), a = R() * 6.2832, speed = (ending ? 1.2 : 0.55) * (0.65 + R() * 0.5) * motion;
        spPart(ctl, { mode: 'burst', x: ctl.cx, y: ctl.cy, z: ctl.cz, vx: Math.cos(a) * speed, vy: (ending ? 0.25 : 0.7 + R() * 0.5) * motion, vz: Math.sin(a) * speed, g: ending ? 0.3 : 0.8, life: 0.3 + R() * 0.2, size: 0.045 + R() * 0.025, mat: color });
      }
      ctl.tick = function (c, t, k) {
        ring.position.set(c.px, c.py + 0.04, c.pz);
        ring.scale.setScalar((ending ? 1.05 * (1 - k) + 0.1 : 0.32 + easeOut(k) * 0.58) * s);
        ring.material.opacity = 0.56 * (1 - k);
        shield.forEach(function (item) {
          item.mesh.position.set(c.cx + c.U[0] * item.x, c.cy + item.y * s, c.cz + c.U[2] * item.x);
          item.mesh.rotation.y = num(o.dir, 0); item.mesh.material.opacity = 0.64 * (1 - k);
        });
      };
    });
  };

  SP_KINDS['reward-burst'] = function (o) {
    var style = o.style || 'reveal', coin = style === 'coin', gem = style === 'gem', xp = style === 'xp';
    var chest = style === 'chest', rare = style === 'rare', legendary = style === 'legendary';
    var primary = coin ? 6 : gem ? 8 : xp ? 9 : chest ? 4 : rare ? 1 : legendary ? 6 : 2;
    var secondary = coin || chest || legendary ? 4 : gem || xp ? 10 : rare ? 0 : 8;
    var dur = chest ? 0.82 : legendary ? 0.9 : 0.68;
    return spRun('reward-burst', dur, o, function (ctl) {
      var s = ctl.scale, base = coin ? 10 : gem || xp ? 12 : rare ? 15 : legendary ? 18 : chest ? 12 : 10;
      var n = spCount(base, o), ringCount = rare || legendary ? 2 : 1, rings = [], tokens = [];
      for (var j = 0; j < ringCount; j++) {
        var r = spMesh(ctl, SP_RING, j ? secondary : primary, j ? 0.42 : 0.62, false);
        r.rotation.x = j && legendary ? 0 : -HALF_PI;
        rings.push(r);
      }
      var tokenCount = coin ? 4 : gem ? 5 : legendary ? 5 : 3;
      for (var k = 0; k < tokenCount; k++) {
        var m = spMesh(ctl, CONF_GEO, k % 2 ? secondary : primary, 0.82, false);
        if (coin) m.scale.set(0.11 * s, 0.035 * s, 0.11 * s);
        else if (gem || legendary || rare) m.scale.set(0.06 * s, 0.15 * s, 0.06 * s);
        else m.scale.set(0.075 * s, 0.075 * s, 0.075 * s);
        tokens.push(m);
      }
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.reward * 1000 + i), a = R() * 6.2832;
        var speed = (coin ? 0.85 : gem || legendary ? 1.05 : 0.75) * (0.65 + R() * 0.6) * mo();
        spPart(ctl, {
          mode: 'burst', x: ctl.cx, y: ctl.cy, z: ctl.cz,
          vx: Math.cos(a) * speed, vy: (xp ? 1.25 : gem || legendary ? 0.9 : 0.55) * mo(),
          vz: Math.sin(a) * speed, g: xp ? 0.1 : 0.75,
          life: 0.36 + R() * 0.35, size: coin ? 0.045 : 0.04 + R() * 0.035,
          mat: i % 3 === 0 ? secondary : primary, spin: (R() - 0.5) * 8 * mo()
        });
      }
      ctl.tick = function (c, t, p) {
        var out = easeOut(p);
        rings.forEach(function (r, i) {
          r.position.set(c.cx, c.cy - (coin ? 0.12 : 0), c.cz);
          r.scale.setScalar((0.26 + out * (i ? 0.78 : 1.04)) * s);
          r.material.opacity = (i ? 0.38 : 0.62) * (1 - p);
          if (i && !legendary) r.rotation.z = out * 0.35;
        });
        tokens.forEach(function (m, i) {
          var a = i * 6.2832 / tokens.length + (coin ? p * 1.2 : p * 0.45);
          var radius = (coin ? 0.2 : 0.16) + out * (coin ? 0.34 : 0.24);
          m.position.set(c.cx + Math.cos(a) * radius * s, c.cy + (xp ? out * 0.56 : Math.sin(out * Math.PI) * 0.18) * s, c.cz + Math.sin(a) * radius * s);
          m.rotation.x += (coin ? 3.2 : 1.7) * 0.016 * mo();
          m.rotation.y += (coin ? 4.4 : 2.6) * 0.016 * mo();
          m.material.opacity = 0.82 * (1 - p);
        });
      };
    });
  };

  SP_KINDS['environment-ambient'] = function (o) {
    var style = o.style || 'world', nether = style === 'nether', dragon = style === 'dragon';
    var primary = nether ? 7 : dragon ? 10 : 9, secondary = nether ? 1 : 6, dur = dragon ? 1.35 : 1.55;
    return spRun('environment-ambient', dur, o, function (ctl) {
      var n = spCount(dragon ? 4 : 3, o), motion = mo();
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.ambient * 1000 + i);
        spPart(ctl, {
          mode: 'burst', x: ctl.cx + (R() - 0.5) * 0.85, y: ctl.cy + (R() - 0.5) * 0.7, z: ctl.cz + (R() - 0.5) * 0.85,
          vx: (dragon ? 0.16 : nether ? (R() - 0.5) * 0.12 : (R() - 0.5) * 0.2) * motion,
          vy: (nether ? 0.28 : dragon ? 0.12 : 0.08 + R() * 0.1) * motion,
          vz: (dragon ? 0.08 : (R() - 0.5) * 0.16) * motion, g: 0,
          life: dur * (0.72 + R() * 0.25), size: dragon ? 0.035 : 0.028 + R() * 0.018,
          mat: i % 3 === 0 ? secondary : primary, spin: dragon ? (R() - 0.5) * 2 * motion : 0
        });
      }
    });
  };

  SP_KINDS['world-transition'] = function (o) {
    var style = o.style || 'world', nether = style === 'nether', dragon = style === 'dragon';
    var primary = nether ? 7 : dragon ? 10 : 9, secondary = nether ? 1 : 6, dur = dragon ? 0.92 : 0.78;
    return spRun('world-transition', dur, o, function (ctl) {
      var s = ctl.scale, rings = [], n = spCount(dragon ? 12 : 9, o);
      var ring = spFlat(spMesh(ctl, SP_RING, primary, 0.58));
      rings.push(ring);
      if (dragon) {
        var accent = spMesh(ctl, SP_RING, secondary, 0.38, false);
        accent.rotation.y = Math.PI / 2;
        rings.push(accent);
      }
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.world * 1000 + i), a = R() * 6.2832, speed = (nether ? 0.72 : 0.55) * mo();
        spPart(ctl, {
          mode: 'burst', x: ctl.cx, y: ctl.cy + (R() - 0.5) * 0.5, z: ctl.cz,
          vx: Math.cos(a) * speed, vy: (dragon ? 0.65 : 0.4) * mo(), vz: Math.sin(a) * speed,
          g: 0.35, life: 0.32 + R() * 0.28, size: 0.035 + R() * 0.025,
          mat: i % 3 === 0 ? secondary : primary
        });
      }
      ctl.tick = function (c, t, p) {
        rings.forEach(function (r, i) {
          r.position.set(c.cx, c.cy + (i ? 0 : -0.5), c.cz);
          r.scale.setScalar((0.3 + easeOut(p) * (i ? 0.72 : 1.02)) * s);
          r.material.opacity = (i ? 0.38 : 0.58) * (1 - p);
          if (i) r.rotation.x = p * 0.35;
        });
      };
    });
  };

  SP_KINDS['result-dissolve'] = function (o) {
    return spRun('result-dissolve', 0.78, o, function (ctl) {
      var n = spCount(9, o), motion = mo();
      for (var i = 0; i < n; i++) {
        var R = pr(o, SP_NS.result * 1000 + i), a = R() * 6.2832, speed = (0.25 + R() * 0.28) * motion;
        spPart(ctl, {
          mode: 'burst', x: ctl.cx, y: ctl.cy + R() * 0.32, z: ctl.cz,
          vx: Math.cos(a) * speed, vy: (0.16 + R() * 0.18) * motion, vz: Math.sin(a) * speed,
          g: -0.08, life: 0.48 + R() * 0.26, size: 0.028 + R() * 0.018,
          s1: 0.12, mat: i % 3 === 0 ? 12 : 11
        });
      }
    });
  };

  function spatial(kind, opts) {
    var fn = SP_KINDS[kind];
    if (!fn || !scene || disposed) return null;
    try { return fn(opts && typeof opts === 'object' ? opts : {}); } catch (e) { reportCleanupError(e); return null; }
  }
  var SPATIAL_KINDS = Object.create(null);
  Object.keys(SP_KINDS).forEach(function (key) { SPATIAL_KINDS[key] = 1; });
  UT.GameplayFX = { quality: quality, limit: limit, n: n, reduced: reduced, track: track, untrack: untrack, stop: stop, stopAll: stopAll, timeout: timeout, getActive: getActive, getHistory: getHistory, cueMeta: cueMeta, cueOptions: cueOptions, parseFid: parseFid, acceptCue: acceptCue, getCueLog: getCueLog, setDebug: setDebug, rng: rng, dispose: dispose, init: init, spawnConfetti: spawnConfetti, spawnExplosion: spawnExplosion, updateConfetti: updateConfetti, clearConfetti: clearConfetti, sparkle: sparkle, updateSparks: updateSparks, spatial: spatial, spatialKinds: SPATIAL_KINDS, clearSpatial: clearSpatial };
})(window);
