/* Ular Tangga Blok — gameplay/hud-scale.js
   HUD gameplay responsif: menghitung faktor skala --hs dari ukuran layar perangkat (innerWidth x innerHeight).
   CSS (blok #hud-responsive di gameplay.html) memakai --hs lewat `zoom` pada #hud, #side .col, dan #side .rcol,
   sehingga seluruh HUD mengecil di HP kecil dan membesar di layar lebar tanpa mengubah layout/logika game.
   Hanya presentasi. Classic script, aman bila dimuat lebih dari sekali. */
(function (win, doc) {
  'use strict';
  var root = doc.documentElement, raf = 0, last = 0, lastStage = 0;
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  /* Acuan ukuran per kelas layout (sesuai media query yang sudah ada di gameplay.html):
     - portrait sempit (<=699px)  : layout bertumpuk di bawah, dirancang ~390px lebar
     - landscape pendek (<=430px) : layout kompak HP (tinggi 460 = skala 1; HP 360px -> ~0.78)
     - tinggi menengah (<=720px)  : tablet kecil / laptop pendek
     - tinggi besar (>720px)      : desktop/tablet besar, boleh membesar sampai 1.4x */
  function scaleFor(W, H) {
    if (W <= 699 && H > W) return clamp(W / 390, 0.85, 1.2);
    if (H <= 430) return clamp(Math.min(H / 460, W / 820), 0.68, 1);
    if (H <= 720) return clamp(Math.min(H / 680, W / 960), 0.85, 1);
    return clamp(Math.min(H / 768, W / 1280), 0.85, 1.4);
  }

  function apply() {
    raf = 0;
    var W = win.innerWidth || root.clientWidth || 0, H = win.innerHeight || root.clientHeight || 0;
    if (!W || !H) return;
    var stage = Math.round(Math.min(W / 1920, H / 1080) * 1000) / 1000;
    if (stage !== lastStage) {
      lastStage = stage;
      root.style.setProperty('--ghud-stage-scale', String(stage));
    }
    var s = Math.round(scaleFor(W, H) * 1000) / 1000;
    if (s === last) return;
    last = s;
    root.style.setProperty('--hs', String(s));
  }
  function queue() { if (!raf) raf = win.requestAnimationFrame ? win.requestAnimationFrame(apply) : (apply(), 0); }

  apply();
  win.addEventListener('resize', queue);
  win.addEventListener('orientationchange', queue);
  if (win.visualViewport) win.visualViewport.addEventListener('resize', queue);
})(window, document);
