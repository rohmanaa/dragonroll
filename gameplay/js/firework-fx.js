/* Firework Layering & Polish (Stage 4.1.23.2) — kembang api voxel berlapis:
   LAUNCH → TRAIL → CORE FLASH → MAIN BURST → SECONDARY SPARK → FADE/CLEANUP.
   Hanya memakai UT.ParticleFX.burstAt (engine 4.1.22): layer #fx-layer, batas partikel (20/burst, 60 visible), cleanup animationend, guard reduced-motion milik engine.
   Urutan layer dijadwalkan lewat animation-delay CSS (opsi delayMin engine): TANPA timer, rAF, interval, listener, atau layer sendiri. Hanya transform+opacity.
   SFX (Stage 4.1.23.3): 1x per panggilan burstAt lewat audio existing UT.GameplayAudio.play('firework') (audio.js: file win/Firework_launch.ogg); aman bila audio tidak ada/gagal.
   BELUM terhubung ke gameplay: tanpa trigger victory/reward (sub-stage berikutnya). Variasi Math.random hanya untuk tampilan.
   Classic script. Namespace: UT.FireworkFX. API: burstAt(x, y, opts) · burstFromElement(el, opts) — return jumlah partikel yang dibuat (0 bila tak ada engine/reduced-motion).
   (x, y) = titik LEDAKAN; roket naik dari bawahnya. opts: count (8–16, default 12) · colors[] · distance (default 64) · rise (tinggi launch, default 90) · sound (false = tanpa SFX, mis. untuk rangkaian beberapa firework) */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.FireworkFX) return;

  /* Palet voxel (acuan visual: palet "victory" pada folder referensi visual; nilai disalin, BUKAN dibaca saat runtime).
     rgba memberi variasi opacity visual antar-partikel tanpa mengubah engine. */
  var PALETTES = [
    ['#fff3a3', '#ffd451', '#f7a7ff', '#78e7ff', '#8fffb6'],
    ['#fff3a3', '#ffd451', '#ff9d38', 'rgba(255,212,81,.8)'],
    ['#78e7ff', '#9af8ff', '#ffffff', 'rgba(120,231,255,.8)'],
    ['#f7a7ff', '#dca8ff', '#fff3a3', 'rgba(247,167,255,.8)']
  ];

  function engine() { return UT.ParticleFX && typeof UT.ParticleFX.burstAt === 'function' ? UT.ParticleFX : null; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function burstAt(x, y, o) {
    try {
      var E = engine(); if (!E) return 0;
      o = o || {};
      x = +x; y = +y;
      var n = clamp(Math.floor(+o.count) || 12, 8, 16);
      var colors = (o.colors && o.colors.length) ? o.colors : PALETTES[Math.floor(Math.random() * PALETTES.length)];
      var dist = clamp((+o.distance || 64) * (0.88 + Math.random() * 0.24), 20, 140); /* variasi skala antar firework */
      var rise = clamp(+o.rise || 90, 40, 160);
      var T = 280 + Math.floor(Math.random() * 50); /* durasi launch (ms) = waktu mulai flash & burst; variasi timing */
      var made = 0;

      /* 1) LAUNCH: satu blok roket naik lurus dari bawah titik ledak */
      made += E.burstAt(x, y + rise, { count: 1, color: '#fff3a3', size: 6, sizeJitter: 0, angle: -90, spread: 0, distance: rise, distanceJitter: 0,
        duration: T, durationJitter: 0, scale: 1, shape: 'square' });
      /* 2) TRAIL: 3 blok kecil tertinggal di jalur naik, memudar lebih cepat dari roket */
      made += E.burstAt(x, y + rise, { count: 3, color: 'rgba(255,212,81,.8)', size: 4, sizeJitter: 0.3, angle: -90, spread: 14, distance: rise * 0.55, distanceJitter: 0.5,
        duration: T + 40, durationJitter: 0.2, scale: 0.3, shape: 'square', delay: 90 });
      /* 3) CORE FLASH: inti terang + halo blok lebih besar & pudar; muncul tepat saat roket sampai */
      made += E.burstAt(x, y, { count: 1, color: '#ffffff', size: 22, sizeJitter: 0, distance: 0, duration: 200, durationJitter: 0, scale: 2.2, shape: 'square', delayMin: T });
      made += E.burstAt(x, y, { count: 1, color: 'rgba(255,243,163,.55)', size: 34, sizeJitter: 0, distance: 0, duration: 260, durationJitter: 0, scale: 2, shape: 'square', delayMin: T + 20 });
      /* 4) MAIN BURST: blok chunky radial, jeda acak kecil; arah/jarak/ukuran/durasi bervariasi */
      made += E.burstAt(x, y, { count: n, colors: colors, size: 6, sizeJitter: 0.5, distance: dist, distanceJitter: 0.45, duration: 850, durationJitter: 0.3,
        spread: 360, gravity: 24, scale: 0.15, rotate: 90, shape: 'square', delayMin: T + 20, delay: 50 });
      /* 5) SECONDARY SPARK: 3 titik di tepi burst, masing-masing 2 percik mungil yang jatuh sambil berkelip */
      var a0 = Math.random() * Math.PI * 2;
      for (var i = 0; i < 3; i++) {
        var a = a0 + i * 2.094 + (Math.random() - 0.5) * 0.6, r = dist * (0.65 + Math.random() * 0.2);
        made += E.burstAt(x + Math.cos(a) * r, y + Math.sin(a) * r, { count: 2, colors: ['#ffffff', colors[i % colors.length]], size: 3, sizeJitter: 0.3,
          distance: 18, distanceJitter: 0.5, duration: 520, durationJitter: 0.3, gravity: 30, scale: 0.1, shape: 'square', delayMin: T + 330, delay: 140 });
      }
      /* SFX: tepat 1x per event, hanya bila visual benar-benar keluar (reduced-motion/engine penuh => made=0 => senyap). Gagal audio tidak memengaruhi visual. */
      if (made > 0 && o.sound !== false) { try { var A = UT.GameplayAudio; if (A && typeof A.play === 'function') A.play('firework'); } catch (e2) {} }
      return made; /* 6) FADE/CLEANUP: opacity 1→0 di akhir keyframe engine; partikel dihapus engine saat animationend */
    } catch (e) { return 0; } /* FX tidak boleh menggagalkan gameplay */
  }

  function burstFromElement(el, o) {
    try {
      if (!el || !el.getBoundingClientRect) return 0;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return 0;
      return burstAt(r.left + r.width / 2, r.top + r.height / 2, o);
    } catch (e) { return 0; }
  }

  UT.FireworkFX = { burstAt: burstAt, burstFromElement: burstFromElement };
})(window);
