/* Ular Tangga Blok - gameplay/island-skin.js
   IslandSkin — "kulit" pulau melayang untuk dunia NON-board (tahap 1: sisi bawah).
   Padanan voxel dari assets/js/floating-island.js v2 (palet zaitun/sage, tanah + tanah liat + kerikil,
   batu abu-kebiruan + lumut, butir emas, stalaktit, kristal biru, kepingan batu melayang).
   Skrip klasik. Dimuat SETELAH gameplay/voxel-geom.js, SEBELUM script utama gameplay.html.

   PENTING: file ini TIDAK memakai rnd() milik gameplay.html (PRNG sendiri + hash), jadi urutan acak dunia
   (pohon, hewan, rumput, dll.) tidak bergeser sama sekali.

   API:
     UT.Gameplay.IslandSkin.palette                       -> warna (sama dengan PAL di floating-island.js)
     UT.Gameplay.IslandSkin.underside(opts)               -> [[x,y,z,sx,sy,sz,hex,yaw], ...]  (data murni)
     UT.Gameplay.IslandSkin.addUnderside(batch,addBox,o)  -> menambah kotak ke batch (edge garis dimatikan)
   opts: cx,cz (pusat, default 0), y0 (permukaan atas lapisan, default -0.5 = dasar kolom board),
         rx,rz (radius lapisan pertama), seed.  Sel berukuran 1x1x1 di titik .5 (sejajar petak board). */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {}, G = UT.Gameplay = UT.Gameplay || {};

  var PAL = {
    moss: [0x5a8744, 0x4e7a3e],
    dirt: [0x8b5d3a, 0x7d5233, 0x96683f, 0x6e4a2e], clay: 0xa8794a, gravel: 0x8c8b90,
    stone: [0x9a9ca6, 0x868a96, 0xaeb0b8, 0x7c808c], sand: 0xb09a78, stoneMoss: 0x6f8f55,
    gold: 0xd9a441, crystal: 0x7fd0e8, crystalHi: 0xbdeaf5, rock: 0x70707c
  };

  function rng(seed) { var a = seed | 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash2(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
  function shade(hex, k) {
    var r = Math.min(255, ((hex >> 16) & 255) * k | 0), g = Math.min(255, ((hex >> 8) & 255) * k | 0), b = Math.min(255, (hex & 255) * k | 0);
    return (r << 16) | (g << 8) | b;
  }

  /* 5 lapisan, makin ke bawah makin kecil (padanan R=[3.7,3.7,3.0,2.0] pada pulau 3D, ditambah 1 lapis batu) */
  var TAPER = [1, 0.97, 0.82, 0.6, 0.4], N = TAPER.length;

  function underside(o) {
    o = o || {};
    var cx = o.cx || 0, cz = o.cz || 0, y0 = o.y0 == null ? -0.5 : o.y0, rx = o.rx || 8.6, rz = o.rz || 8.0;
    var rnd = rng(o.seed || 5), cells = {}, list = [], out = [], x, y, z, i, k;

    for (y = 0; y < N; y++) {
      var f = TAPER[y], lim = Math.ceil(Math.max(rx, rz) * f + 2);
      for (i = -lim; i <= lim; i++) for (k = -lim; k <= lim; k++) {
        x = i; z = k;                                   /* indeks sel; pusat dunia = cx + x + .5 */
        var wob = Math.sin(z * 0.9 + y) * 0.32 + Math.cos(x * 0.75 - y) * 0.28;
        var d = Math.hypot((x + 0.5 + wob) / (rx * f), (z + 0.5 + wob * 0.6) / (rz * f)) + (rnd() - 0.5) * 0.1;
        if (d <= 1 && (y === 0 || cells[x + ',' + (y - 1) + ',' + z] === 1)) { cells[x + ',' + y + ',' + z] = 1; list.push([x, y, z]); }
      }
    }
    var has = function (a, b, c) { return cells[a + ',' + b + ',' + c] === 1; };
    var side = function (a, b, c) { return !has(a + 1, b, c) || !has(a - 1, b, c) || !has(a, b, c + 1) || !has(a, b, c - 1); };

    /* warna per-sel = hexOf() di floating-island.js (y di sini = y+1 pada pulau 3D, karena lapis rumput ada di atas) */
    var hexOf = function (c) {
      var X = c[0], Y = c[1], Z = c[2], rr = rnd(), ex = side(X, Y, Z);
      if (Y === 0 && ex && rr < 0.62) return PAL.moss[(X + Z) & 1];       /* rumput menetes di tepi */
      if (Y === 1 && ex && rr < 0.2) return PAL.moss[1];
      if (Y <= 1) {
        if (rr < 0.07) return PAL.clay; if (rr < 0.12) return PAL.gravel;
        return PAL.dirt[(X * 3 + Z * 2 + Y + (rr * 4 | 0)) & 3];
      }
      if (Y === 2 && rr < 0.3) return PAL.dirt[(X + Z) & 3];
      if (rr < 0.05) return PAL.gold;
      if (rr < 0.12) return PAL.sand;
      if (Y === 2 && ex && rr < 0.24) return PAL.stoneMoss;
      return PAL.stone[Math.abs(X * 5 + Z * 3 + Y + (rr * 3 | 0)) & 3];
    };

    list.forEach(function (c) {
      var above = 0, a, b;
      for (a = -1; a <= 1; a++) for (b = -1; b <= 1; b++) if (has(c[0] + a, c[1] - 1, c[2] + b)) above++;
      var ao = c[1] === 0 ? 1 : Math.max(0.5, 1 - 0.055 * above), dd = 1 - 0.02 * c[1], jit = 0.96 + rnd() * 0.08;
      out.push([cx + c[0] + 0.5, y0 - c[1] - 0.5, cz + c[2] + 0.5, 1, 1, 1, shade(hexOf(c), ao * dd * jit * 0.98), 0]);
    });

    /* stalaktit batu menjuntai dari lapisan terbawah */
    var low = list.filter(function (c) { return c[1] === N - 1; }), s, q;
    for (s = 0; s < 7 && low.length; s++) {
      var lc = low[(rnd() * low.length) | 0], len = 1 + (rnd() < 0.5 ? 1 : 0);
      for (q = 1; q <= len; q++) {
        var key = lc[0] + ',' + (N - 1 + q) + ',' + lc[2];
        if (!cells[key]) { cells[key] = 1; out.push([cx + lc[0] + 0.5, y0 - (N - 1 + q) - 0.5, cz + lc[2] + 0.5, 1, 1, 1, shade(PAL.stone[(s + q) & 3], 0.78), 0]); }
      }
    }
    /* stalaktit kecil dari tepi lapisan tengah (siluet bawah lebih bergerigi) */
    var mid = list.filter(function (c) { return c[1] === 2 && side(c[0], c[1], c[2]); });
    for (s = 0; s < 5 && mid.length; s++) {
      var mc = mid[(rnd() * mid.length) | 0], key2 = mc[0] + ',3,' + mc[2];
      if (!cells[key2]) { out.push([cx + mc[0] + 0.5, y0 - 3 - 0.3, cz + mc[2] + 0.5, 0.5, 0.6, 0.5, shade(PAL.dirt[s & 3], 0.8), 0]); }
    }

    /* kristal biru + kepingan batu melayang (posisi relatif pusat, skala mengikuti radius) */
    var sx = rx / 8.6, sz = rz / 8.0, base = y0 - N;
    [[-2.2, 0.0, 1.4, 0.7, 1.3], [1.6, -0.1, -1.1, 0.6, 1.05], [3.1, 0.9, 2.0, 0.5, 0.85], [-0.4, -0.6, -2.3, 0.45, 0.8]].forEach(function (p, n) {
      out.push([cx + p[0] * sx, base + p[1] - p[4] / 2, cz + p[2] * sz, p[3], p[4], p[3], PAL.crystal, 0.6 + n * 0.4]);
      out.push([cx + p[0] * sx, base + p[1] - p[4] + 0.04, cz + p[2] * sz, p[3] * 0.55, 0.12, p[3] * 0.55, PAL.crystalHi, 0.6 + n * 0.4]);
    });
    [[0.4, -3.2, 0.1, 1.0], [2.2, -2.6, -1.4, 0.65], [-1.8, -3.9, 1.2, 0.45]].forEach(function (p) {
      out.push([cx + p[0] * sx, base + p[1], cz + p[2] * sz, p[3], p[3], p[3], PAL.rock, p[0]]);
    });
    return out;
  }

  function addUnderside(batch, addBox, o) {
    var n = 0;
    underside(o).forEach(function (b) { addBox(batch, b[0], b[1], b[2], b[3], b[4], b[5], b[6], { edge: false, yaw: b[7] }); n++; });
    return n;
  }

  G.IslandSkin = { palette: PAL, underside: underside, addUnderside: addUnderside };
})(window);
