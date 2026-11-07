/* Power FX — DATA efek visual tiap Power (partikel kecil, asap, percikan, gelembung, dll).
   Hanya memakai engine UT.ParticleFX.burstAt (gameplay/particle-fx.js): layer #fx-layer, batas partikel, cleanup animationend, otomatis mati saat reduced-motion.
   Tanpa timer/rAF/listener; urutan lapisan dijadwalkan lewat delayMin (CSS animation-delay). Aman-gagal: modul/engine tak ada -> return 0, gameplay tetap jalan.
   Classic script. Namespace: UT.PowerFX.
   API: play(key, x, y[, o]) · playAtElement(key, el[, o]) · has(key) · DATA
   key = ID canonical Power (sword · feather · tnt · totem · potion_odd · potion_even · grass) + efek tambahan: totem_block (Totem menahan serangan) · get (dapat Power).
   o = { scale: pengali jumlah & jarak partikel (default 1) }.
   Tiap entri DATA = { name, note, layers[] }. Layer = opsi UT.ParticleFX.burstAt:
     count · colors[] · size · sizeJitter · distance · distanceJitter · duration · spread · angle (0=kanan, -90=atas) · gravity (+ turun, - naik)
     scale (akhir; >1 = membesar seperti asap) · rotate · shape('square'|'round'|'bar') · delayMin · delay · ease
   Cara tambah/ubah efek: cukup edit DATA di bawah (tiap Power mandiri, tidak ada kode khusus per Power di tempat lain). */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.PowerFX) return;

  var SMOKE = ['#26262b', '#34343a', '#4a4a52', '#6b6b73'];
  var FIRE = ['#fff2a0', '#ffc93c', '#ff9a1a', '#ff6a00', '#e8340a'];

  var DATA = {
    /* PEDANG — tebasan putih-baja menyilang + percikan logam */
    sword: {
      name: 'Pedang', note: 'tebasan bar putih menyilang + percikan kuning kecil',
      layers: [
        { count: 8, colors: ['#ffffff', '#dff3ff', '#bcd7ee'], shape: 'bar', size: 15, sizeJitter: 0.3, distance: 74, spread: 36, angle: -40, duration: 380, scale: 0.4, rotate: 20, ease: 'cubic-bezier(.1,.8,.2,1)' },
        { count: 7, colors: ['#ffffff', '#dff3ff', '#bcd7ee'], shape: 'bar', size: 15, sizeJitter: 0.3, distance: 74, spread: 36, angle: 140, duration: 380, scale: 0.4, rotate: 20, delayMin: 70, ease: 'cubic-bezier(.1,.8,.2,1)' },
        { count: 10, colors: ['#fff3a3', '#ffd451', '#ffffff'], size: 4, distance: 46, duration: 420, gravity: 18, scale: 0.2, delayMin: 90 }
      ]
    },

    /* BULU — bulu putih melayang pelan + kilau halus */
    feather: {
      name: 'Bulu', note: 'bulu putih kecil melayang naik lalu turun pelan + kilau',
      layers: [
        { count: 10, colors: ['#ffffff', '#f1f6ff', '#dbe9ff'], shape: 'bar', size: 9, sizeJitter: 0.3, distance: 52, spread: 140, angle: -90, duration: 1150, gravity: 34, scale: 0.4, rotate: 140, ease: 'ease-out' },
        { count: 7, colors: ['#ffffff', '#fff3a3', '#cfeaff'], shape: 'round', size: 4, distance: 62, spread: 360, duration: 800, scale: 0.1, delayMin: 80 }
      ]
    },

    /* TNT — ledakan api kecil (kuning -> oranye -> merah) + asap abu naik + bara */
    tnt: {
      name: 'TNT', note: 'blok api kecil + asap abu membesar + bara jatuh',
      layers: [
        { count: 18, colors: FIRE, size: 8, sizeJitter: 0.5, distance: 82, spread: 360, duration: 650, scale: 0.15 },
        { count: 12, colors: SMOKE, shape: 'round', size: 13, sizeJitter: 0.4, distance: 52, spread: 120, angle: -90, gravity: -34, duration: 1250, scale: 1.9, delayMin: 110 },
        { count: 10, colors: ['#ffd23c', '#ff7a12', '#ffffff'], size: 4, distance: 112, spread: 360, gravity: 44, duration: 900, scale: 0.15, delayMin: 40 }
      ]
    },

    /* TOTEM — cincin kilau emas-hijau + percikan naik (rasa Totem of Undying) */
    totem: {
      name: 'Totem', note: 'cincin kilau emas & hijau, lalu percikan naik',
      layers: [
        { count: 18, colors: ['#ffd24d', '#fff3a3', '#7dff6a', '#3fd13a'], size: 6, distance: 58, spread: 360, duration: 820, scale: 0.25, rotate: 90 },
        { count: 10, colors: ['#fff3a3', '#7dff6a', '#ffd24d'], size: 5, distance: 96, spread: 80, angle: -90, gravity: -12, duration: 1000, scale: 0.15, delayMin: 110 }
      ]
    },

    /* RAMUAN GANJIL (merah) — gelembung merah naik + cipratan */
    potion_odd: {
      name: 'Ramuan Ganjil', note: 'gelembung merah naik + cipratan merah tua',
      layers: [
        { count: 12, colors: ['#e04a3c', '#ff7a6a', '#ffb3a8', '#a8231a'], shape: 'round', size: 8, sizeJitter: 0.5, distance: 70, spread: 100, angle: -90, gravity: -22, duration: 950, scale: 1.2, ease: 'ease-out' },
        { count: 8, colors: ['#a8231a', '#e04a3c', '#5a0f0a'], size: 5, distance: 44, spread: 360, gravity: 26, duration: 600, scale: 0.2, delayMin: 40 }
      ]
    },

    /* RAMUAN GENAP (biru) — gelembung biru naik + cipratan */
    potion_even: {
      name: 'Ramuan Genap', note: 'gelembung biru naik + cipratan biru tua',
      layers: [
        { count: 12, colors: ['#4fb0d0', '#8fdcf5', '#d4f4ff', '#2a7fa8'], shape: 'round', size: 8, sizeJitter: 0.5, distance: 70, spread: 100, angle: -90, gravity: -22, duration: 950, scale: 1.2, ease: 'ease-out' },
        { count: 8, colors: ['#2a7fa8', '#4fb0d0', '#0f3d57'], size: 5, distance: 44, spread: 360, gravity: 26, duration: 600, scale: 0.2, delayMin: 40 }
      ]
    },

    /* RUMPUT / BLOCK — serpihan rumput & tanah + debu */
    grass: {
      name: 'Rumput', note: 'serpihan hijau & tanah berputar + debu',
      layers: [
        { count: 12, colors: ['#78d957', '#4aa83a', '#2f7d2a'], size: 7, distance: 66, spread: 360, gravity: 32, duration: 700, scale: 0.25, rotate: 180 },
        { count: 8, colors: ['#8b5a2b', '#6b4423', '#a06a38'], size: 6, distance: 52, spread: 360, gravity: 38, duration: 700, scale: 0.25, rotate: 180, delayMin: 30 },
        { count: 8, colors: ['#d8c9a0', '#c2b280', '#e8dcb8'], shape: 'round', size: 11, distance: 36, spread: 180, angle: -90, gravity: -16, duration: 900, scale: 1.7, delayMin: 60 }
      ]
    },

    /* TOTEM MENAHAN SERANGAN — kilatan emas + cincin hijau */
    totem_block: {
      name: 'Totem menahan', note: 'kilatan emas-putih + cincin hijau',
      layers: [
        { count: 16, colors: ['#ffd24d', '#ffffff', '#fff3a3'], size: 7, distance: 66, spread: 360, duration: 620, scale: 0.2 },
        { count: 12, colors: ['#7dff6a', '#3fd13a', '#b8ffb0'], shape: 'round', size: 5, distance: 88, spread: 360, duration: 850, scale: 0.15, delayMin: 90 }
      ]
    },

    /* DAPAT POWER — kilau emas kecil */
    get: {
      name: 'Dapat Power', note: 'kilau emas kecil naik',
      layers: [
        { count: 12, colors: ['#ffd24d', '#fff3a3', '#ffffff'], size: 5, distance: 50, spread: 200, angle: -90, gravity: -8, duration: 800, scale: 0.15 }
      ]
    }
  };

  function engine() { return UT.ParticleFX && typeof UT.ParticleFX.burstAt === 'function' ? UT.ParticleFX : null; }
  function has(key) { return Object.prototype.hasOwnProperty.call(DATA, key); }

  var tuned = false;
  function tune(E) { /* beberapa lapisan sekaligus (mis. 2 pemain di Rumput) -> naikkan batas total partikel engine sedikit */
    if (tuned) return; tuned = true;
    try { var L = E.configure(); if (L && L.maxParticles < 90) E.configure({ maxParticles: 90 }); } catch (e) {}
  }

  function play(key, x, y, o) {
    try {
      var E = engine(); if (!E || !has(key)) return 0;
      tune(E);
      var k = (o && +o.scale > 0) ? +o.scale : 1, total = 0, layers = DATA[key].layers;
      for (var i = 0; i < layers.length; i++) {
        var src = layers[i], p = {};
        for (var f in src) if (Object.prototype.hasOwnProperty.call(src, f)) p[f] = src[f];
        if (k !== 1) { p.count = Math.max(1, Math.round((p.count || 12) * k)); p.distance = (p.distance || 60) * k; }
        total += E.burstAt(x, y, p) || 0;
      }
      return total;
    } catch (e) { return 0; } /* FX tidak boleh menggagalkan gameplay */
  }

  function playAtElement(key, el, o) {
    try {
      if (!el || !el.getBoundingClientRect) return 0;
      var r = el.getBoundingClientRect(); if (!r.width && !r.height) return 0;
      return play(key, r.left + r.width / 2, r.top + r.height / 2, o);
    } catch (e) { return 0; }
  }

  UT.PowerFX = { DATA: DATA, play: play, playAtElement: playAtElement, has: has };
})(window);
