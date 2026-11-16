/* Particle FX 2D (Stage 4.1.22) — engine partikel DOM/CSS ringan dan reusable. HANYA primitive; belum ada efek spesifik (firework/creeper/dll).
   Tidak memakai canvas/WebGL/Three.js, tanpa rAF, tanpa setInterval/setTimeout, tanpa listener per partikel.
   Cleanup terpusat: satu listener 'animationend' (event delegation) pada #fx-layer menghapus partikel; layer lazy/reusable dan listener dapat dilepas lewat dispose().
   Tidak menyentuh gameplay/pawn/board/kamera/Three.js. Semua panggilan aman-gagal (return 0) bila DOM/CSS animation tidak tersedia atau reduced-motion aktif.
   Classic script. Namespace: UT.ParticleFX (alias window.particleFX).
   API: burstAt(x, y, opts) · burstFromElement(el, opts) · clear() · dispose() · configure({maxParticles, maxBurst}) — burst mengembalikan jumlah partikel yang dibuat.
   opts: count(12) · color | colors[] · size(8) · sizeJitter(.5) · distance(60) · distanceJitter(.5) · duration(600ms) · durationJitter(.3) · spread(360°) · angle(derajat arah tengah, 0=kanan)
         · gravity(px turun di akhir) · scale(akhir, .2) · rotate(derajat maks) · shape('square'|'round'|'bar') · delay(ms, maks acak) · delayMin(ms, jeda tetap sebelum mulai, maks 1500; total jeda = delayMin + acak(0..delay))
         · ease(timing-function CSS: steps(n[,end]) · cubic-bezier(a,b,c,d) · linear/ease*; nilai lain diabaikan) */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.ParticleFX) return;

  var LIMITS = { maxParticles: 60, maxBurst: 20 }; /* Medium: batas total & per burst lama */
  var MAX_PARTICLES = 450, MAX_BURST = 80;
  var layer = null, live = 0, mq = null, boundLayer = null, layerListener = null, ownsLayer = false;
  var groups = [];
  var EASE_RE = /^(linear|ease|ease-in|ease-out|ease-in-out|steps\(\s*\d{1,2}\s*(,\s*(start|end)\s*)?\)|cubic-bezier\(\s*-?[\d.]+(\s*,\s*-?[\d.]+){3}\s*\))$/; /* whitelist: ease hanya nilai aman */

  function reduced() {
    try { if (!mq && win.matchMedia) mq = win.matchMedia('(prefers-reduced-motion: reduce)'); return !!(mq && mq.matches); } catch (e) { return false; }
  }
  function supported() {
    return !!(doc && doc.body && doc.createElement && win.CSS && win.CSS.supports && win.CSS.supports('animation-name', 'fx-particle-move'));
  }
  function getLayer() {
    if (layer && layer.isConnected) return layer;
    ownsLayer = false;
    layer = doc.getElementById('fx-layer');
    if (!layer) {
      layer = doc.createElement('div'); layer.id = 'fx-layer'; layer.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(layer);
      ownsLayer = true;
    }
    if (boundLayer !== layer) {
      if (boundLayer && layerListener) boundLayer.removeEventListener('animationend', layerListener);
      boundLayer = layer;
      layerListener = function (e) {
        var t = e.target, group = t && t.__fxGroup;
        if (!t || t === boundLayer || !t.classList || !t.classList.contains('fx-particle')) return;
        if (t.parentNode === boundLayer) boundLayer.removeChild(t);
        if (live > 0) live--;
        if (group) {
          group.nodes.delete(t);
          if (!group.nodes.size) completeGroup(group);
        }
      };
      layer.addEventListener('animationend', layerListener);
    }
    return layer;
  }

  function removeGroup(group) {
    if (!group || group.stopping) return;
    group.stopping = true;
    group.nodes.forEach(function (node) {
      var attached = node.parentNode === layer;
      if (node.parentNode) node.parentNode.removeChild(node);
      if (attached && live > 0) live--;
    });
    group.nodes.clear();
    var index = groups.indexOf(group);
    if (index >= 0) groups.splice(index, 1);
  }

  function completeGroup(group) {
    if (!group) return;
    var index = groups.indexOf(group);
    if (index >= 0) groups.splice(index, 1);
    if (group.id && UT.GameplayFX && typeof UT.GameplayFX.untrack === 'function') UT.GameplayFX.untrack(group.id);
  }

  function makeGroup() {
    var group = { id: null, nodes: new Set(), stopping: false };
    groups.push(group);
    if (UT.GameplayFX && typeof UT.GameplayFX.track === 'function') {
      group.id = UT.GameplayFX.track({ stop: function () { removeGroup(group); } }, { type: 'dom-particle-burst', scope: 'visual', category: 'particle' });
    }
    return group;
  }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function burstAt(x, y, o) {
    var group = null;
    try {
      o = o || {};
      x = +x; y = +y;
      if (!isFinite(x) || !isFinite(y)) return 0;
      if (reduced() || !supported()) return 0; /* hentikan emission dari JS, bukan sekadar disembunyikan CSS */
      live = (layer && layer.isConnected) ? layer.childElementCount : 0; /* sinkron dengan DOM nyata: tidak bisa drift */
      var room = LIMITS.maxParticles - live;
      var n = Math.floor(Math.min(num(o.count, 12), LIMITS.maxBurst, room));
      if (n < 1) return 0;
      var L = getLayer(); if (!L) return 0;
      var colors = (o.colors && o.colors.length) ? o.colors : [o.color || '#ffffff'];
      var size = Math.max(2, Math.min(24, num(o.size, 8))), sj = num(o.sizeJitter, 0.5);
      var dist = Math.max(0, num(o.distance, 60)), dj = num(o.distanceJitter, 0.5);
      var dur = Math.max(150, Math.min(1500, num(o.duration, 600))), duj = num(o.durationJitter, 0.3);
      var spread = Math.max(0, Math.min(360, num(o.spread, 360))), base = num(o.angle, 0);
      var grav = num(o.gravity, 0), scl = num(o.scale, 0.2), rot = num(o.rotate, 0), delay = Math.max(0, num(o.delay, 0)), dmin = Math.max(0, Math.min(1500, num(o.delayMin, 0)));
      var ease = (typeof o.ease === 'string' && EASE_RE.test(o.ease.trim())) ? o.ease.trim() : '';
      var cls = o.shape === 'round' ? ' fx-round' : o.shape === 'bar' ? ' fx-bar' : '';
      var frag = doc.createDocumentFragment();
      group = makeGroup();
      for (var i = 0; i < n; i++) {
        var a = (base - spread / 2 + (spread >= 360 ? (i / n) * 360 + rnd(-8, 8) : rnd(0, spread))) * Math.PI / 180;
        var d = dist * (1 - dj + Math.random() * dj);
        var el = doc.createElement('span'), s = el.style;
        el.className = 'fx-particle' + cls;
        el.__fxGroup = group;
        group.nodes.add(el);
        frag.appendChild(el);
        s.left = x.toFixed(1) + 'px'; s.top = y.toFixed(1) + 'px'; /* hanya set statis sekali; tidak dianimasikan */
        s.setProperty('--fx-x', (Math.cos(a) * d).toFixed(1) + 'px');
        s.setProperty('--fx-y', (Math.sin(a) * d + grav).toFixed(1) + 'px');
        s.setProperty('--fx-size', (size * (1 - sj + Math.random() * sj * 2)).toFixed(1) + 'px');
        s.setProperty('--fx-dur', Math.round(dur * (1 - duj + Math.random() * duj * 2)) + 'ms');
        s.setProperty('--fx-scale', String(scl));
        s.setProperty('--fx-rot', Math.round(rnd(-rot, rot)) + 'deg');
        s.setProperty('--fx-color', colors[i % colors.length]);
        if (ease) s.setProperty('--fx-ease', ease);
        if (delay || dmin) s.setProperty('--fx-delay', Math.round(dmin + Math.random() * delay) + 'ms');
      }
      L.appendChild(frag); live += n;
      return n;
    } catch (e) {
      if (group) {
        if (group.id && UT.GameplayFX && typeof UT.GameplayFX.stop === 'function') UT.GameplayFX.stop(group.id);
        else removeGroup(group);
      }
      return 0;
    } /* FX tidak boleh menggagalkan gameplay */
  }

  function burstFromElement(el, o) {
    try {
      if (!el || !el.getBoundingClientRect) return 0;
      var r = el.getBoundingClientRect(); /* dibaca hanya saat dipanggil */
      if (!r.width && !r.height) return 0;
      return burstAt(r.left + r.width / 2, r.top + r.height / 2, o);
    } catch (e) { return 0; }
  }

  function clear() {
    groups.slice().forEach(function (group) {
      if (group.id && UT.GameplayFX && typeof UT.GameplayFX.stop === 'function') UT.GameplayFX.stop(group.id);
      else removeGroup(group);
    });
    if (layer && layer.querySelectorAll) {
      Array.prototype.slice.call(layer.querySelectorAll('.fx-particle')).forEach(function (node) {
        if (node.parentNode === layer) layer.removeChild(node);
      });
    }
    live = 0;
  }

  function dispose() {
    clear();
    if (boundLayer && layerListener) boundLayer.removeEventListener('animationend', layerListener);
    boundLayer = null;
    layerListener = null;
    if (ownsLayer && layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null;
    ownsLayer = false;
  }
  function configure(c) {
    if (!c) return LIMITS;
    var globalCap = MAX_PARTICLES, fx = win.UT && win.UT.GameplayFX;
    if (fx && typeof fx.limit === 'function') globalCap = Math.min(globalCap, fx.limit());
    LIMITS.maxParticles = Math.min(LIMITS.maxParticles, globalCap);
    if (isFinite(+c.maxParticles)) LIMITS.maxParticles = Math.max(1, Math.min(globalCap, +c.maxParticles));
    if (isFinite(+c.maxBurst)) LIMITS.maxBurst = Math.max(1, Math.min(MAX_BURST, +c.maxBurst));
    LIMITS.maxBurst = Math.max(1, Math.min(LIMITS.maxBurst, LIMITS.maxParticles, globalCap));
    return LIMITS;
  }

  UT.ParticleFX = { burstAt: burstAt, burstFromElement: burstFromElement, clear: clear, dispose: dispose, configure: configure };
  if (!win.particleFX) win.particleFX = UT.ParticleFX;
})(window, document);
