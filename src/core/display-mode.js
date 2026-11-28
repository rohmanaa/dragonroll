/* Display Mode — layar penuh (Fullscreen) / normal. Satu API untuk dua lingkungan:
   - Electron: window.electronAPI.setFullscreen / getFullscreen (lihat electron-preload.js + main.js).
   - Web/PWA: Fullscreen API pada dokumen paling atas (shell play.html bila halaman berjalan di iframe; sama-origin).
   Tidak didukung (mis. iPhone Safari, dokumen tanpa izin fullscreen): supported() false -> pemanggil menonaktifkan tombol.
   Masuk fullscreen di web WAJIB dipicu gestur pengguna (klik); karena itu mode tidak bisa dipulihkan otomatis saat game dibuka lagi.
   API: UT.Display.kind() · supported() · isFullscreen() -> Promise<bool> · set(bool) -> Promise<bool aktual> · on(fn) -> off
   Skrip klasik; dapat dimuat di browser (window.UT.Display) maupun Node (module.exports) untuk tes. create(deps) menerima stub. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Display = api.create({}); root.UT.Display.create = api.create; }
})(typeof window !== 'undefined' ? window : null, function (G0) {
  'use strict';

  function create(deps) {
    var G = deps.G || G0 || {};

    function top() { try { var t = G.top || G; void t.document; return t; } catch (e) { return G; } }
    function ea() {
      var a = G.electronAPI;
      return a && typeof a.setFullscreen === 'function' && typeof a.getFullscreen === 'function' ? a : null;
    }
    function doc() { return top().document; }
    function el() { var d = doc(); return d && d.documentElement; }
    function webOK() {
      var d = doc(), e = el();
      if (!d || !e) return false;
      var can = d.fullscreenEnabled !== undefined ? d.fullscreenEnabled : d.webkitFullscreenEnabled;
      return !!can && !!(e.requestFullscreen || e.webkitRequestFullscreen);
    }
    function kind() { return ea() ? 'electron' : webOK() ? 'web' : 'none'; }
    function supported() { return kind() !== 'none'; }

    function webState() {
      var d = doc();
      if (d && (d.fullscreenElement || d.webkitFullscreenElement)) return true;
      try { var mq = top().matchMedia && top().matchMedia('(display-mode: fullscreen)'); if (mq && mq.matches) return true; } catch (e) { /* abaikan */ }
      return false;
    }
    function isFullscreen() {
      var a = ea();
      if (a) return Promise.resolve().then(function () { return a.getFullscreen(); }).then(Boolean);
      return Promise.resolve(webState());
    }
    function settle() { return new Promise(function (r) { (G.setTimeout || setTimeout)(r, 120); }); }

    function set(value) {
      value = !!value;
      var a = ea();
      if (a) return Promise.resolve().then(function () { return a.setFullscreen(value); }).then(Boolean);
      if (!webOK()) return Promise.reject(new Error('fullscreen-tidak-didukung'));
      var d = doc(), e = el(), p;
      try {
        if (value) {
          if (webState()) return Promise.resolve(true);
          p = e.requestFullscreen ? e.requestFullscreen({ navigationUI: 'hide' }) : e.webkitRequestFullscreen();
        } else {
          if (!(d.fullscreenElement || d.webkitFullscreenElement)) return Promise.resolve(webState());
          p = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen();
        }
      } catch (err) { return Promise.reject(err); }
      return Promise.resolve(p).then(settle).then(webState);
    }

    function on(fn) {
      var offs = [];
      var notify = function () { isFullscreen().then(fn, function () {}); };
      var a = ea();
      if (!a) {
        var d = doc();
        if (d && d.addEventListener) {
          ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (t) {
            d.addEventListener(t, notify); offs.push(function () { d.removeEventListener(t, notify); });
          });
        }
      }
      /* Electron (dan cadangan web): ukuran jendela berubah saat layar penuh/normal bergantian, termasuk lewat tombol sistem */
      if (G.addEventListener) { G.addEventListener('resize', notify); offs.push(function () { G.removeEventListener('resize', notify); }); }
      return function () { offs.forEach(function (o) { o(); }); offs = []; };
    }
    return { kind: kind, supported: supported, isFullscreen: isFullscreen, set: set, on: on };
  }
  return { create: create };
});
