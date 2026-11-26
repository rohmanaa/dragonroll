/* chest-reveal.js — pembukaan chest SINEMATIK (dipakai Inventory + Shop). Skrip klasik; di browser jadi window.UT.ChestReveal, di Node (tes) module.exports.
   Alur (tiap jenis chest makin dramatis: Kayu < Perak < Emas < Diamond):
     1. layar menggelap + sorot cahaya; peti JATUH dari atas, memantul, debu
     2. ANTISIPASI: peti bergoyang makin kuat (3 tingkat), cahaya & sinar berputar menguat, percikan naik
     3. LEDAKAN: kilat putih, cincin kejut, partikel voxel, peti meloncat, getar layar/HP, suara
     4. judul "Peti X Terbuka!" lalu hadiah keluar satu per satu (Coin -> Emerald -> XP -> Power) dengan hitung naik
     5. tombol MANTAP!
   Ketuk layar = lewati (sebelum ledakan -> langsung ledak; saat hadiah keluar -> tampil semua). Mode "kurangi gerakan" = tanpa goyang/partikel.
   API: play(reward, {onRewards, onClose}) -> {skip, close} · plan(kind, reward, {reduced}) (murni, untuk tes) */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.ChestReveal = api; }
})(typeof window !== 'undefined' ? window : null, function (win) {
  'use strict';
  var IC = 'assets/images/ui/';
  /* a = lama antisipasi (ms), n = jumlah partikel ledakan, c = warna jenis */
  var KINDS = {
    wood:    { nm: 'Peti Kayu',    im: 'peti-kayu',    c: '#d99a52', a: 900,  n: 16 },
    silver:  { nm: 'Peti Perak',   im: 'peti-perak',   c: '#d6e2f2', a: 1250, n: 26 },
    gold:    { nm: 'Peti Emas',    im: 'peti-emas',    c: '#ffd45a', a: 1650, n: 40 },
    diamond: { nm: 'Peti Diamond', im: 'peti-diamond', c: '#4de8e0', a: 2100, n: 60 }
  };
  var DROP = 700, TITLE_GAP = 650, STEP = 460, COUNT = 800, OK_GAP = 600;

  function meta(kind) { return KINDS[kind] || KINDS.wood; }
  function num(v) { v = +v; return isFinite(v) && v > 0 ? Math.floor(v) : 0; }

  /* Daftar hadiah berurutan. Power selalu terakhir (kejutan penutup). */
  function rewardsOf(r) {
    var out = [];
    if (num(r.coins)) out.push({ t: 'coin', v: num(r.coins), label: 'Coin', icon: IC + 'hud/ikon-koin-emas.webp' });
    if (num(r.gems)) out.push({ t: 'gem', v: num(r.gems), label: 'Emerald', icon: IC + 'gem-medal-icons/berlian-hijau.webp' });
    if (num(r.xp)) out.push({ t: 'xp', v: num(r.xp), label: 'XP', icon: null });
    if (r.power) {
      var it = win && win.ItemCatalog && win.ItemCatalog.byId ? win.ItemCatalog.byId(r.power) : null;
      out.push({ t: 'power', v: 1, label: it ? it.name : String(r.power), icon: it && it.icon ? it.icon : null, power: true });
    }
    return out;
  }

  /* Jadwal (ms sejak mulai) — fungsi murni agar bisa dites. */
  function plan(kind, reward, o) {
    o = o || {}; var m = meta(kind), reduced = !!o.reduced, list = rewardsOf(reward || {});
    var a = reduced ? 0 : m.a, drop = reduced ? 0 : DROP, burst = drop + a;
    var title = burst + (reduced ? 0 : TITLE_GAP), step = reduced ? 140 : STEP;
    var first = title + (reduced ? 120 : 520);
    var rw = list.map(function (x, i) { return Object.assign({ at: first + i * step }, x); });
    var last = rw.length ? rw[rw.length - 1].at : first;
    return {
      kind: KINDS[kind] ? kind : 'wood', meta: m, reduced: reduced,
      drop: drop, anticipation: a, burst: burst, title: title,
      stages: reduced ? [] : [{ at: drop, cls: 's1' }, { at: drop + Math.round(a * 0.35), cls: 's2' }, { at: drop + Math.round(a * 0.72), cls: 's3' }],
      particles: reduced ? 0 : m.n, rewards: rw,
      okAt: last + (reduced ? 200 : (rw.length ? COUNT : 0) + OK_GAP)
    };
  }

  /* ---------- DOM ---------- */
  var live = [];
  function soundOn() { try { var s = win.PlayerData && win.PlayerData.settings && win.PlayerData.settings(); return !s || s.sound !== false; } catch (e) { return true; } }
  function sfx(n) { try { if (soundOn() && win.UT && win.UT.Audio) win.UT.Audio.play(n); } catch (e) { } }
  function buzz(p) { try { var s = win.PlayerData && win.PlayerData.settings && win.PlayerData.settings(); if ((!s || s.vibration !== false) && win.navigator && win.navigator.vibrate) win.navigator.vibrate(p); } catch (e) { } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('id-ID'); }

  function play(reward, opts) {
    reward = reward || {}; opts = opts || {};
    if (!win || !win.document) return { skip: function () { }, close: function () { } };
    var doc = win.document, reduced = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var P = plan(reward.kind, reward, { reduced: reduced }), M = P.meta;
    var el = doc.createElement('div');
    el.className = 'crv tier-' + P.kind; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', M.nm);
    el.style.setProperty('--c', M.c);
    el.innerHTML = '<div class="crv-bg"></div><div class="crv-rays"></div><div class="crv-glow"></div>' +
      '<div class="crv-stage"><div class="crv-shadow"></div><img class="crv-chest" src="' + IC + 'chest-packs/' + M.im + '.webp" alt=""></div>' +
      '<div class="crv-ring"></div><div class="crv-fx"></div><div class="crv-flash"></div>' +
      '<div class="crv-title" aria-live="polite">' + esc(M.nm) + ' Terbuka!</div><div class="crv-rewards"></div>' +
      '<button class="crv-ok ut-gl ut-c-g" type="button">MANTAP!</button><div class="crv-hint">Ketuk untuk melewati</div>';
    doc.body.appendChild(el);
    var q = function (s) { return el.querySelector(s); }, box = q('.crv-rewards'), fx = q('.crv-fx');
    var timers = [], raf = [], state = 'intro', closed = false, sparkIv = null;
    function at(ms, fn) { var t = setTimeout(function () { if (!closed) fn(); }, Math.max(0, ms)); timers.push(t); return t; }
    function clearAll() { timers.forEach(clearTimeout); timers = []; raf.forEach(function (r) { win.cancelAnimationFrame && win.cancelAnimationFrame(r); }); raf = []; if (sparkIv) { clearInterval(sparkIv); sparkIv = null; } }

    function spark(burst) {
      var s = doc.createElement('i'), ang = Math.random() * Math.PI * 2, d = burst ? 16 + Math.random() * 34 : 6 + Math.random() * 10;
      s.className = 'crv-p' + (burst ? ' b' : '');
      s.style.setProperty('--x', (Math.cos(ang) * d).toFixed(1) + 'vmin');
      s.style.setProperty('--y', (Math.sin(ang) * d * (burst ? 0.8 : 1) - (burst ? 8 : 14)).toFixed(1) + 'vmin');
      s.style.setProperty('--s', (burst ? 1.2 + Math.random() * 2 : 0.7 + Math.random() * 1.1).toFixed(2) + 'vmin');
      s.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      s.style.setProperty('--k', ['var(--c)', '#fff', '#ffe27a'][Math.floor(Math.random() * 3)]);
      s.style.setProperty('--d', Math.round(Math.random() * (burst ? 120 : 400)) + 'ms');
      fx.appendChild(s); at(1400, function () { if (s.parentNode) s.parentNode.removeChild(s); });
    }

    function countUp(node, to, dur) {
      if (reduced || !win.requestAnimationFrame) { node.textContent = fmt(to); return; }
      var t0 = null;
      (function step(ts) {
        if (closed) return; if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        node.textContent = fmt(v); if (k < 1) raf.push(win.requestAnimationFrame(step)); else node.textContent = fmt(to);
      })(win.performance ? win.performance.now() : 0);
    }
    function showReward(x, instant) {
      var c = doc.createElement('div');
      c.className = 'crv-r r-' + x.t + (x.power ? ' pw' : '') + (instant ? ' now' : '');
      var ic = x.icon ? '<img src="' + esc(x.icon) + '" alt="">' : (x.t === 'xp' ? '<i class="crv-xpb">XP</i>' : '<i class="crv-xpb">\u2605</i>');
      c.innerHTML = ic + '<b>0</b><span>' + esc(x.label) + '</span>';   /* awalan "+" dari CSS (::before) agar hitung-naik cukup menulis angka */
      box.appendChild(c);
      var b = c.querySelector('b'); if (x.power) { b.textContent = '\u00d71'; } else if (instant) { b.textContent = fmt(x.v); } else { countUp(b, x.v, COUNT); }
      sfx(x.power ? 'power' : 'pop');
    }

    function showOk() { if (state === 'done') return; state = 'done'; el.classList.add('done'); var ok = q('.crv-ok'); try { ok.focus({ preventScroll: true }); } catch (e) { } if (opts.onRewards) { try { opts.onRewards(); } catch (e) { } } }
    function revealRest() {   // lewati: semua hadiah tampil langsung
      clearAll(); el.classList.add('open', 'titled'); box.innerHTML = '';
      P.rewards.forEach(function (x) { showReward(x, true); });
      state = 'rewards'; showOk();
    }
    function doBurst() {
      if (state !== 'intro') return; state = 'rewards';
      clearAll(); el.classList.remove('s1', 's2', 's3'); el.classList.add('burst');
      sfx('pop'); at(120, function () { sfx('chest'); }); buzz([30, 40, 70]);
      for (var i = 0; i < P.particles; i++) spark(true);
      at(60, function () { el.classList.add('open'); });
      at(P.title - P.burst, function () { el.classList.add('titled'); });
      P.rewards.forEach(function (x) { at(x.at - P.burst, function () { showReward(x, false); }); });
      at(P.okAt - P.burst, showOk);
    }

    /* --- naskah waktu --- */
    el.classList.add('in');
    if (reduced) { at(0, doBurst); }
    else {
      at(450, function () { sfx('bounce'); });
      P.stages.forEach(function (s) { at(s.at, function () { el.classList.remove('s1', 's2'); el.classList.add(s.cls); buzz(s.cls === 's3' ? 25 : 10); }); });
      at(P.drop, function () { sparkIv = setInterval(function () { if (!closed && state === 'intro') spark(false); }, 110); });
      at(P.burst, doBurst);
    }

    function close() {
      if (closed) return; closed = true; clearAll();
      el.classList.add('out'); live = live.filter(function (x) { return x !== api2; });
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
      if (opts.onClose) { try { opts.onClose(); } catch (e) { } }
    }
    function skip() { if (state === 'intro') doBurst(); else if (state === 'rewards') revealRest(); }
    el.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.crv-ok')) { close(); return; } skip(); });
    doc.addEventListener('keydown', function onKey(e) { if (closed) { doc.removeEventListener('keydown', onKey); return; } if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (state === 'done') close(); else skip(); } });
    var api2 = { skip: skip, close: close }; live.push(api2);
    return api2;
  }
  function closeAll() { live.slice().forEach(function (x) { x.close(); }); }

  var api = { play: play, plan: plan, closeAll: closeAll, KINDS: KINDS };
  return api;
});
