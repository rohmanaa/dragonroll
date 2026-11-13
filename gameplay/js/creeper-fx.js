/* Creeper Explosion Layering & Polish (Stage 4.1.24.2) — ledakan voxel/Minecraft-style berlapis:
   FLASH → CORE IMPACT (+ cincin kejut piksel) → MAIN CHUNKY BURST → DEBRIS BERAT → SMOKE/DUST → FADE/CLEANUP.
   Hanya memakai UT.ParticleFX.burstAt (engine 4.1.22): layer #fx-layer, batas partikel (20/burst, 60 visible), cleanup animationend, guard reduced-motion milik engine.
   Urutan/stagger lewat animation-delay CSS (delayMin/delay) dan karakter gerak lewat opsi ease engine (steps() = gerak patah ala piksel; cubic-bezier = cepat lalu melambat):
   TANPA timer, rAF, interval, listener, atau layer sendiri. Hanya transform+opacity.
   Acuan visual: kasus 'creeper' pada folder referensi visual (palet hijau, cincin kejut, burst blok persegi bergravitasi kuat, asap abu-hijau bulat, flash hijau pucat);
   nilai disalin/diadaptasi, TIDAK dibaca saat runtime.
   BELUM terhubung ke gameplay: tanpa SFX, tanpa trigger (explode()/creeper tetap memakai efek lama). Variasi Math.random hanya untuk tampilan.
   Classic script. Namespace: UT.CreeperExplosionFX. API: burstAt(x, y, opts) · burstFromElement(el, opts) — return jumlah partikel yang dibuat (0 bila tak ada engine/reduced-motion).
   (x, y) = pusat ledakan. opts: count (blok burst sedang 4–7, default 5) · distance (default 70). Default 25 partikel, maksimum 27. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.CreeperExplosionFX) return;

  var GREEN = ['#a8ff78', '#4fdb65', '#d7ffc2', 'rgba(79,219,101,.8)'];   /* palet creeper (acuan) */
  var CHUNK = ['#4fdb65', '#a8ff78', '#2f9e44'];                            /* blok besar: hijau lebih pekat */
  var DEBRIS = ['#3b4a3a', '#52675a', '#2f3b2f', '#6b7d6e'];                /* serpihan gelap/abu */
  var SMOKE = ['rgba(82,103,90,.6)', 'rgba(120,134,126,.45)', 'rgba(70,86,76,.55)'];

  function engine() { return UT.ParticleFX && typeof UT.ParticleFX.burstAt === 'function' ? UT.ParticleFX : null; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function burstAt(x, y, o) {
    try {
      var E = engine(); if (!E) return 0;
      o = o || {};
      var n = clamp(Math.floor(+o.count) || 5, 4, 7);
      var dist = clamp((+o.distance || 70) * (0.9 + Math.random() * 0.2), 24, 140);
      var made = 0;

      /* 1) FLASH: blok putih-kehijauan besar, sangat singkat */
      made += E.burstAt(x, y, { count: 1, color: '#f3ffe0', size: 40, sizeJitter: 0, distance: 0, duration: 120, durationJitter: 0, scale: 2.6, shape: 'square' });
      /* 2) CORE IMPACT: inti putih membesar patah-patah (steps) + halo hijau pekat */
      made += E.burstAt(x, y, { count: 1, color: '#ffffff', size: 20, sizeJitter: 0, distance: 0, duration: 180, durationJitter: 0, scale: 2.2, shape: 'square', delayMin: 10, ease: 'steps(3, end)' });
      made += E.burstAt(x, y, { count: 1, color: 'rgba(168,255,120,.55)', size: 52, sizeJitter: 0, distance: 0, duration: 300, durationJitter: 0, scale: 1.6, shape: 'square', delayMin: 30, ease: 'steps(4, end)' });
      /* 2b) CINCIN KEJUT: 5 blok mungil merata di lingkaran, melesat cepat dengan gerak piksel */
      made += E.burstAt(x, y, { count: 5, color: '#caff8a', size: 6, sizeJitter: 0.15, distance: dist * 0.95, distanceJitter: 0.08, duration: 300, durationJitter: 0.1,
        spread: 360, scale: 0.5, shape: 'square', delayMin: 15, ease: 'steps(5, end)' });
      /* 3) MAIN CHUNKY BURST: 3 blok besar (ledak sangat cepat lalu melambat) + n blok sedang (gerak patah, lebih jauh) */
      made += E.burstAt(x, y, { count: 3, colors: CHUNK, size: 14, sizeJitter: 0.3, distance: dist * 0.7, distanceJitter: 0.4, duration: 700, durationJitter: 0.25,
        spread: 360, gravity: 40, scale: 0.35, rotate: 160, shape: 'square', delayMin: 20, delay: 30, ease: 'cubic-bezier(.1,.8,.25,1)' });
      made += E.burstAt(x, y, { count: n, colors: GREEN, size: 8, sizeJitter: 0.6, distance: dist * 1.05, distanceJitter: 0.5, duration: 560, durationJitter: 0.3,
        spread: 360, gravity: 26, scale: 0.15, rotate: 120, shape: 'square', delayMin: 15, delay: 40, ease: 'steps(7, end)' });
      /* 3b) DEBRIS BERAT: serpihan gelap, jatuh jauh (gravity besar), berputar banyak, hidup lebih lama */
      made += E.burstAt(x, y, { count: 4, colors: DEBRIS, size: 9, sizeJitter: 0.5, distance: dist * 0.65, distanceJitter: 0.6, duration: 950, durationJitter: 0.25,
        spread: 360, gravity: 85, scale: 0.7, rotate: 260, shape: 'square', delayMin: 40, delay: 60, ease: 'cubic-bezier(.2,.5,.45,1)' });
      /* 4) SMOKE/DUST: 3 gumpalan besar naik pelan + 2 debu terang mengambang, mulai setelah burst */
      made += E.burstAt(x, y, { count: 3, colors: SMOKE, size: 22, sizeJitter: 0.35, angle: -90, spread: 150, distance: 30, distanceJitter: 0.6, duration: 900, durationJitter: 0.25,
        gravity: -30, scale: 2, shape: 'round', delayMin: 110, delay: 100 });
      made += E.burstAt(x, y, { count: 2, color: 'rgba(190,200,190,.4)', size: 12, sizeJitter: 0.3, distance: 46, distanceJitter: 0.5, duration: 560, durationJitter: 0.3,
        spread: 360, gravity: -8, scale: 1.4, shape: 'round', delayMin: 50, delay: 60 });
      return made; /* 5) FADE/CLEANUP: opacity 1→0 di akhir keyframe engine; partikel dihapus engine saat animationend */
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

  UT.CreeperExplosionFX = { burstAt: burstAt, burstFromElement: burstFromElement };
})(window);
