/* gameplay-loading.js — layar muat KHUSUS gameplay (play.html #gl, di dalam #ov.gp). Referensi: referensi/newgui/assets/penerapan/6EC+9G.png.
   Isi: pedang (aset repo), "Mempersiapkan…" lalu "Siap?" saat adegan siap, timer NAIK (uptime mm:ss sejak layar tampil, bukan hitung mundur),
   dan pill jaringan: ikon wifi + ping dalam ms (tanpa LTE & baterai).
   Dipanggil play.js:  UT.GameLoading.start() saat layar tampil · .ready() saat gameplay siap ("Siap?") · .stop() setelah layar hilang.
   Ping = lama balasan HEAD ke manifest.webmanifest (selalu ke jaringan lewat header X-UT-Fresh), tiap 2,5 dtk selama layar tampil; gagal = "— ms" + ikon redup.
   Skrip klasik; di Node (module.exports) untuk tes: fmt(), create(deps). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.GameLoading = api.create({}); root.UT.GameLoading.fmt = api.fmt; root.UT.GameLoading.create = api.create; }
})(typeof window !== 'undefined' ? window : null, function (G) {
  'use strict';
  var PING_URL = 'manifest.webmanifest', PING_EVERY = 2500, DUST = 18;
  var SWORD = 'assets/images/ui/achievement/ach-pedang.webp';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  /* detik -> {m:'00', s:'07'}; menit dibatasi 99 */
  function fmt(sec) { sec = Math.max(0, Math.floor(+sec) || 0); return { m: pad(Math.min(99, Math.floor(sec / 60))), s: pad(sec % 60) }; }

  function create(deps) {
    var g = deps.G || G || {}, doc = deps.document || g.document;
    var now = deps.now || Date.now, doFetch = deps.fetch || (g.fetch && g.fetch.bind(g));
    var running = false, t0 = 0, tickT = 0, pingT = 0, built = false, ping;

    function $(id) { return doc && doc.getElementById(id); }
    function text(id, v) { var e = $(id); if (e) e.textContent = v; }
    function elapsed() { return running ? (now() - t0) / 1000 : 0; }
    function render() { var t = fmt(elapsed()); text('gl-m', t.m); text('gl-s', t.s); }

    function setPing(ms) {
      ping = ms; text('gl-ms', ms == null ? '— ms' : ms + ' ms');
      var w = $('gl-wifi'); if (w && w.classList) w.classList.toggle('off', ms == null);
    }
    function measure() {
      if (!doFetch || (doc && doc.hidden)) return;
      var s = now(), p;
      try { p = doFetch(PING_URL + '?p=' + s, { method: 'HEAD', cache: 'no-store', headers: { 'X-UT-Fresh': '1' } }); } catch (e) { setPing(null); return; }
      p.then(function () { if (running) setPing(Math.max(1, Math.round(now() - s))); }, function () { if (running) setPing(null); });
    }

    /* titik debu ungu (dekor) dibuat sekali; posisi acak tetap per pemuatan halaman */
    function build() {
      if (built || !doc) return; built = true;
      var box = $('gl-dust'); if (!box) return;
      for (var i = 0; i < DUST; i++) {
        var d = doc.createElement('i');
        d.style.left = (Math.random() * 100).toFixed(1) + '%'; d.style.top = (Math.random() * 78).toFixed(1) + '%';
        d.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's'; d.style.animationDuration = (3 + Math.random() * 3).toFixed(1) + 's';
        box.appendChild(d);
      }
      try { var im = new g.Image(); im.src = SWORD; } catch (e) {}
    }

    function start() {
      if (running) return; running = true; t0 = now(); build();
      var gl = $('gl'); if (gl && gl.classList) gl.classList.remove('rdy');
      text('gl-txt', 'Mempersiapkan'); setPing(ping == null ? null : ping); if (ping == null) text('gl-ms', '— ms');
      render(); clearInterval(tickT); clearInterval(pingT);
      tickT = setInterval(render, 250); measure(); pingT = setInterval(measure, PING_EVERY);
    }
    function ready() { var gl = $('gl'); if (gl && gl.classList) gl.classList.add('rdy'); text('gl-txt', 'Siap?'); }
    function stop() { running = false; clearInterval(tickT); clearInterval(pingT); tickT = pingT = 0; }

    return { start: start, ready: ready, stop: stop, elapsed: elapsed, isRunning: function () { return running; }, preload: build, ping: function () { return ping; }, SWORD: SWORD };
  }
  return { create: create, fmt: fmt };
});
