/* App Version — versi game = VERSION di sw.js (satu-satunya sumber). Halaman tidak perlu diedit tiap rilis.
   Cara kerja: tanya SW yang sedang aktif (postMessage {type:'GET_VERSION'}) = versi kode yang SEDANG berjalan (SW baru menunggu sampai restart).
   Cadangan (belum ada controller / SW lama tanpa handler / Electron): baca teks sw.js dan ambil VERSION.
   Pakai: letakkan <span data-app-version hidden></span> di halaman; skrip mengisinya "Versi v307" dan menampilkannya.
   API: UT.Version.get() -> Promise<{raw,label}|null> · UT.Version.apply(root) · label(raw) · parse(text) · create(deps) (untuk tes).
   Skrip klasik; dapat dimuat di browser (window.UT.Version) maupun Node (module.exports). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Version = api.create({}); root.UT.Version.create = api.create; root.UT.Version.parse = api.parse; root.UT.Version.label = api.label; }
})(typeof window !== 'undefined' ? window : null, function (G) {
  'use strict';

  function parse(text) {
    var m = /\bVERSION\s*=\s*['"]([^'"]+)['"]/.exec(String(text || ''));
    return m ? m[1] : null;
  }
  /* 'ut-pwa-v307' -> 'v307'; format lain dipakai apa adanya */
  function label(raw) {
    var m = /v(\d+(?:\.\d+)*)\s*$/i.exec(String(raw || ''));
    return m ? 'v' + m[1] : String(raw || '');
  }

  function create(deps) {
    var g = deps.G || G || {}, nav = deps.navigator || g.navigator, doc = deps.document || g.document;
    var doFetch = deps.fetch || (g.fetch && g.fetch.bind(g)), timeout = deps.timeout == null ? 1500 : deps.timeout;
    var swUrl = deps.swUrl || 'sw.js', cached = null;

    function viaController() {
      return new Promise(function (resolve) {
        var c = nav && nav.serviceWorker && nav.serviceWorker.controller;
        if (!c || typeof g.MessageChannel !== 'function') return resolve(null);
        var ch = new g.MessageChannel(), done = false;
        var end = function (v) { if (!done) { done = true; resolve(v); } };
        ch.port1.onmessage = function (e) { end(e && e.data && e.data.type === 'VERSION' ? e.data.version : null); };
        try { c.postMessage({ type: 'GET_VERSION' }, [ch.port2]); } catch (e) { return end(null); }
        setTimeout(function () { end(null); }, timeout);
      });
    }
    function viaFile() {
      if (!doFetch) return Promise.resolve(null);
      return Promise.resolve().then(function () { return doFetch(swUrl); })
        .then(function (r) { return r && r.ok ? r.text() : ''; }).then(parse).catch(function () { return null; });
    }
    function get(force) {
      if (cached && !force) return cached;
      cached = viaController().then(function (v) { return v || viaFile(); }).then(function (raw) {
        if (!raw) { cached = null; return null; }
        return { raw: raw, label: label(raw) };
      });
      return cached;
    }
    function apply(rootEl, force) {
      var els = (rootEl || doc) && (rootEl || doc).querySelectorAll ? (rootEl || doc).querySelectorAll('[data-app-version]') : [];
      if (!els.length) return Promise.resolve(null);
      return get(force).then(function (v) {
        if (!v) return null;
        for (var i = 0; i < els.length; i++) { els[i].textContent = 'Versi ' + v.label; els[i].title = v.raw; els[i].hidden = false; }
        return v;
      });
    }
    return { get: get, apply: apply };
  }

  /* browser: isi otomatis; ulangi saat SW mengambil alih (kunjungan pertama belum punya controller) */
  if (G && G.document) {
    var script = G.document.currentScript, v;
    var url = script && script.src ? new G.URL('../../../sw.js', script.src).href : 'sw.js';
    var start = function () {
      v = G.UT && G.UT.Version; if (!v) return;
      /* arahkan cadangan ke sw.js di root situs (bukan relatif ke halaman) */
      var inst = create({ swUrl: url }); v.get = inst.get; v.apply = inst.apply;
      v.apply(G.document);
      if (G.navigator.serviceWorker) G.navigator.serviceWorker.addEventListener('controllerchange', function () { v.apply(G.document, true); });
    };
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', start); else start();
  }
  return { create: create, parse: parse, label: label };
});
