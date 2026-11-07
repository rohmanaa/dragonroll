/* Mob 3D bersama & reusable (halaman Teman, Hadiah Harian, dst.): model voxel berdetail + animasi, satu API.
   Beda dengan UT.CharacterData (karakter pemain, diekstrak dari gameplay): ini mob dekoratif untuk halaman non-gameplay.
   Skrip klasik, global UT.MobView; three.js dikirim lewat argumen THREE. Tanpa dependency lain.

   UT.MobView.make(THREE, key, opts) -> THREE.Group; g.userData.anim(t) dipanggil tiap frame (t = detik)
     key   : 'chicken' (ayam) | 'butterfly' (kupu-kupu) | 'flowers' (hamparan bunga) | 'butterfly-garden' (kupu-kupu terbang di atas bunga)
     opts  : { palette: 'blue'|'orange'|'pink'  (kupu-kupu; default 'blue'),
               mood:    'idle'|'happy'          (ayam; default 'idle' = mematuk, 'happy' = melompat & mengepak),
               scale:   angka (pengali ukuran, default 1), seed: angka (variasi warna bulu/bunga) }
   UT.MobView.list()                      -> ['chicken', ...]
   UT.MobView.register(key, build)        -> tambah mob baru; build(ctx) -> { root: THREE.Group, anim: function(t) }
        ctx = { THREE, opts, part(parent, boxes, pivot) -> Group, mesh(boxes, pivot) -> Mesh, rnd() }
        boxes: [[x,y,z,w,h,d,'#rrggbb', grain?], ...]  (pusat box; grain = ukuran kubus kecil -> bulu/tekstur berbintik)
   Semua mob menghadap +z, dasar di y = 0 (mob terbang melayang di atas y = 0). Tidak ada aset gambar/suara. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.MobView) return;

  var FACES = [ /* normal + 4 sudut + faktor cahaya (sama dengan UT.CharacterData.mesh) */
    { n: [0, 0, 1],  c: [[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]],    l: 1.0 },
    { n: [0, 0, -1], c: [[1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1]], l: 0.72 },
    { n: [1, 0, 0],  c: [[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]],    l: 0.84 },
    { n: [-1, 0, 0], c: [[-1, 1, -1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1]], l: 0.78 },
    { n: [0, 1, 0],  c: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],    l: 1.16 },
    { n: [0, -1, 0], c: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]], l: 0.55 }
  ];
  function seeded(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ---------- pembangun mesh: satu BufferGeometry ber-vertex-color per bagian ---------- */
  function buildMesh(THREE, boxes, pivot, rnd) {
    var pv = pivot || [0, 0, 0], pos = [], nor = [], col = [], idx = [], n = 0;
    function cube(cx, cy, cz, w, h, d, c) {
      FACES.forEach(function (f) {
        var li = f.l < 0.6 ? 0.7 : 1;
        f.c.forEach(function (k) { pos.push(cx + k[0] * w / 2 - pv[0], cy + k[1] * h / 2 - pv[1], cz + k[2] * d / 2 - pv[2]); nor.push(f.n[0], f.n[1], f.n[2]); col.push(c.r * li, c.g * li, c.b * li); });
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
      });
    }
    boxes.forEach(function (q) {
      var base = new THREE.Color(q[6]), gr = q[7];
      if (!gr) { cube(q[0], q[1], q[2], q[3], q[4], q[5], base); return; }
      var nx = Math.max(1, Math.round(q[3] / gr)), ny = Math.max(1, Math.round(q[4] / gr)), nz = Math.max(1, Math.round(q[5] / gr));
      var w = q[3] / nx, h = q[4] / ny, d = q[5] / nz;
      for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) for (var l = 0; l < nz; l++) {
        if (nx > 2 && ny > 2 && nz > 2 && i > 0 && i < nx - 1 && j > 0 && j < ny - 1 && l > 0 && l < nz - 1) continue; /* bagian dalam tidak terlihat */
        var c = base.clone(); c.offsetHSL(0, 0, (rnd() - 0.5) * 0.09);
        cube(q[0] - q[3] / 2 + w * (i + 0.5), q[1] - q[4] / 2 + h * (j + 0.5), q[2] - q[5] / 2 + d * (l + 0.5), w, h, d, c);
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    var m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = true;
    return m;
  }
  function makeCtx(THREE, opts, rnd) {
    function part(parent, boxes, pivot) {
      var g = new THREE.Group(), pv = pivot || [0, 0, 0];
      g.position.set(pv[0], pv[1], pv[2]); g.add(buildMesh(THREE, boxes, pv, rnd)); parent.add(g); return g;
    }
    return { THREE: THREE, opts: opts, rnd: rnd, part: part, mesh: function (boxes, pivot) { return buildMesh(THREE, boxes, pivot, rnd); } };
  }

  var REG = {};
  function register(key, build) { REG[key] = build; }
  function list() { return Object.keys(REG); }
  function make(THREE, key, opts) {
    opts = opts || {};
    var build = REG[key], g = new THREE.Group();
    if (!build) { g.userData.anim = function () {}; return g; } /* mob tak dikenal: kosong, bukan error */
    var rnd = seeded(opts.seed || 2024), r = build(makeCtx(THREE, opts, rnd));
    g.add(r.root); if (opts.scale) g.scale.setScalar(opts.scale);
    g.userData.anim = r.anim; g.userData.mob = key;
    return g;
  }

  /* =====================  AYAM  ===================== (satuan model = px, 1 px = 0.34 satuan halaman) */
  register('chicken', function (c) {
    var T = c.THREE, U = 0.3, happy = c.opts.mood === 'happy';
    var root = new T.Group(), s = new T.Group(); s.scale.setScalar(U); s.position.y = 0.3; root.add(s);
    var up = new T.Group(); up.position.y = -1.8; s.add(up); /* bagian atas diturunkan: kaki pendek ala ayam Minecraft */
    var W = '#f7f4ee', W2 = '#e9e4d8', ORG = '#f0a30f', RED = '#d62828';
    /* badan: kubus kecil 1 px ber-variasi warna = kesan bulu */
    c.part(up, [[0, 8, 0, 6, 6, 8, W, 1], [0, 11.1, -0.6, 5.6, 0.5, 6.4, W2, 1], [0, 6.4, 2.6, 4.6, 2.2, 2.6, '#fffdf8', 1]], [0, 8, 0]);
    var tail = c.part(up, [[0, 11.2, -4.6, 4, 4, 2, W2, 1], [0, 12.6, -5.2, 2, 3, 1, '#ffffff', 1], [0, 10.0, -4.4, 3, 1.4, 1.4, W]], [0, 10, -4]);
    var head = c.part(up, [
      [0, 12.5, 4.5, 4, 6, 3, '#fbf9f4', 1],
      [0, 16.3, 4.3, 1, 1.6, 2.6, RED], [0, 15.9, 4.9, 1, 1, 1, RED],            /* jengger */
      [0, 13.1, 6.9, 2, 1.4, 2, ORG], [0, 12.1, 6.6, 1.6, 0.8, 1.4, '#e08e0a'], /* paruh atas & bawah */
      [0, 11.2, 6.2, 1, 1.8, 1, RED],                                             /* pial */
      [2.05, 13.7, 5.1, 0.4, 1, 1, '#1a1a1a'], [-2.05, 13.7, 5.1, 0.4, 1, 1, '#1a1a1a'],
      [2.12, 14.0, 5.3, 0.2, 0.4, 0.4, '#ffffff'], [-2.12, 14.0, 5.3, 0.2, 0.4, 0.4, '#ffffff']
    ], [0, 10.5, 3.6]);
    var legs = [1, -1].map(function (sd) {
      return c.part(s, [[sd * 1.5, 1.8, 0.5, 1, 3.6, 1, '#e8a317'], [sd * 1.5, 0.4, 1.6, 3, 0.8, 3, '#e8a317'], [sd * 1.5, 0.9, 2.9, 0.8, 0.5, 1, '#c9860a']], [sd * 1.5, 3.6, 0.5]);
    });
    var wings = [1, -1].map(function (sd) {
      return c.part(up, [[sd * 3.7, 8.4, 0, 0.8, 4.6, 5.4, W2, 1], [sd * 3.8, 6.2, 0, 0.8, 1.2, 5.4, '#d9d2c2', 1], [sd * 3.7, 10.2, -0.8, 0.7, 0.8, 3, '#fffdf8']], [sd * 3.2, 10.8, 0]);
    });
    function anim(t) {
      var sn = Math.sin, hop = happy ? Math.abs(sn(t * 4.2)) * 0.5 : 0;
      root.position.y = hop;
      s.scale.y = U * (1 + (happy ? 0.03 : 0.012) * sn(t * (happy ? 8 : 2)));
      if (happy) {
        var fl = 0.55 + sn(t * 18) * 0.5;
        wings[0].rotation.z = fl; wings[1].rotation.z = -fl;
        head.rotation.x = sn(t * 8.4) * 0.12; head.rotation.y = sn(t * 2.1) * 0.25;
        tail.rotation.x = -0.15 + sn(t * 8.4) * 0.12;
        legs[0].rotation.x = sn(t * 8.4) * 0.35; legs[1].rotation.x = -sn(t * 8.4) * 0.35;
      } else {
        var ph = (t % 3.4) / 3.4, peck = ph < 0.2 ? sn(ph / 0.2 * Math.PI) * 0.95 : 0;
        head.rotation.x = peck; head.rotation.y = sn(t * 0.8) * 0.3;
        wings[0].rotation.z = 0.04 + sn(t * 2) * 0.03; wings[1].rotation.z = -wings[0].rotation.z;
        tail.rotation.x = -0.08 + sn(t * 1.6) * 0.05 + peck * 0.2;
        legs[0].rotation.x = legs[1].rotation.x = 0;
      }
    }
    return { root: root, anim: anim };
  });

  /* =====================  KUPU-KUPU  ===================== (satuan dunia halaman) */
  var PAL = {
    blue:   { K: '#1e2a5a', A: '#38b6ff', B: '#9be3ff', W: '#ffffff', Y: '#ffe066' },
    orange: { K: '#2b1b3d', A: '#ff9f1c', B: '#ffd23f', W: '#ffffff', Y: '#fff1a8' },
    pink:   { K: '#4a1a4a', A: '#ff7ac8', B: '#ffc2e8', W: '#ffffff', Y: '#ffe066' }
  };
  var FORE = ['..KKKK.', '.KAAAWK', 'KAABAAK', 'KABBWAK', 'KAAAAK.', '.KKKK..'];   /* sayap depan: kolom 0 = dekat badan */
  var HIND = ['KAAAK', 'KABAK', '.KAAK', '..KK.'];                                   /* sayap belakang */
  /* Sayap mendatar di kiri-kanan badan: kolom grid = ke samping (x), baris grid = sepanjang badan (z, baris 0 paling depan), tebal di y. */
  function wingBoxes(grid, cs, x0, z0, y, pal, side) {
    var out = [];
    grid.forEach(function (row, j) { row.split('').forEach(function (ch, i) {
      if (ch === '.') return;
      out.push([side * (x0 + (i + 0.5) * cs), y, z0 - (j + 0.5) * cs, cs, 0.12, cs, pal[ch]]);
    }); });
    return out;
  }
  register('butterfly', function (c) {
    var T = c.THREE, pal = PAL[c.opts.palette] || PAL.blue, CS = 0.34;
    var root = new T.Group(), bf = new T.Group(); root.add(bf);
    var DK = '#2f221b';
    c.part(bf, [
      [0, 0, 0.1, 0.5, 0.55, 0.9, '#3a2a22', 0.25],                                  /* dada */
      [0, -0.05, -0.95, 0.4, 0.42, 1.1, DK, 0.2],                                   /* perut */
      [0, -0.04, -0.62, 0.45, 0.47, 0.16, pal.Y], [0, -0.04, -1.0, 0.45, 0.47, 0.16, pal.Y], [0, -0.04, -1.38, 0.43, 0.45, 0.14, pal.Y],
      [0, 0.06, 0.85, 0.56, 0.56, 0.5, DK, 0.28],                                    /* kepala */
      [0.21, 0.12, 1.12, 0.18, 0.22, 0.05, '#ffffff'], [-0.21, 0.12, 1.12, 0.18, 0.22, 0.05, '#ffffff'],
      [0.21, 0.1, 1.15, 0.09, 0.13, 0.04, '#111111'], [-0.21, 0.1, 1.15, 0.09, 0.13, 0.04, '#111111']
    ]);
    var ants = [1, -1].map(function (sd) {
      return c.part(bf, [[sd * 0.12, 0.72, 0.95, 0.07, 0.8, 0.07, DK], [sd * 0.12, 1.16, 0.95, 0.17, 0.17, 0.17, pal.Y]], [sd * 0.12, 0.3, 0.95]);
    });
    var wings = [1, -1].map(function (sd) {
      var pv = [sd * 0.2, 0, 0];
      return c.part(bf, wingBoxes(FORE, CS, 0.2, 0.55, 0.03, pal, sd).concat(wingBoxes(HIND, CS, 0.2, -0.6, -0.04, pal, sd)), pv);
    });
    function anim(t) {
      var sn = Math.sin, a = sn(t * 13) * 0.7 + 0.35;
      wings[0].rotation.z = a; wings[1].rotation.z = -a;
      ants[0].rotation.z = -0.3 + sn(t * 3) * 0.08; ants[1].rotation.z = 0.3 - sn(t * 3) * 0.08;
      ants[0].rotation.x = ants[1].rotation.x = 0.6; /* sungut condong ke depan */
      bf.position.y = sn(t * 13) * 0.07; /* tubuh ikut naik-turun saat mengepak */
    }
    return { root: root, anim: anim };
  });

  /* =====================  BUNGA (hamparan)  ===================== (satuan dunia halaman, dasar y = 0.3) */
  var FL = [
    { x: -2.5, z: 0.5, h: 2.2, c: '#ff5d73' }, { x: -1.2, z: -0.5, h: 3.1, c: '#ffd23f' }, { x: 0.1, z: 1.0, h: 2.0, c: '#ffffff' },
    { x: 1.3, z: -0.3, h: 3.4, c: '#7aa2ff' }, { x: 2.5, z: 0.6, h: 2.5, c: '#ff9ad5' }
  ];
  register('flowers', function (c) {
    var T = c.THREE, root = new T.Group(), base = new T.Group(); base.position.y = 0.3; root.add(base);
    var G = '#2f9a34', G2 = '#3fb44a', tufts = [];
    for (var i = 0; i < 26; i++) { var gx = (c.rnd() - 0.5) * 6.6, gz = (c.rnd() - 0.5) * 2.6, gh = 0.25 + c.rnd() * 0.45; tufts.push([gx, gh / 2, gz, 0.13, gh, 0.13, c.rnd() < 0.5 ? G : G2]); }
    c.part(base, tufts);
    var heads = FL.map(function (f, k) {
      var g = new T.Group(); g.position.set(f.x, 0, f.z); base.add(g);
      var h = f.h, dir = k % 2 ? 1 : -1;
      c.part(g, [[0, h / 2, 0, 0.16, h, 0.16, G], [dir * 0.3, h * 0.42, 0, 0.5, 0.14, 0.2, G2], [dir * 0.52, h * 0.42 + 0.14, 0, 0.14, 0.2, 0.2, G2], [-dir * 0.3, h * 0.66, 0, 0.5, 0.14, 0.2, G2]]);
      var hd = c.part(g, [
        [0, h + 0.12, 0.08, 0.38, 0.38, 0.3, '#ffcf2e'],
        [0, h + 0.46, 0, 0.34, 0.3, 0.2, f.c, 0.17], [0, h - 0.22, 0, 0.34, 0.3, 0.2, f.c, 0.17],
        [0.34, h + 0.12, 0, 0.3, 0.34, 0.2, f.c, 0.17], [-0.34, h + 0.12, 0, 0.3, 0.34, 0.2, f.c, 0.17]
      ], [0, h * 0.5, 0]);
      return { g: g, hd: hd, ph: k * 1.3 };
    });
    function anim(t) { heads.forEach(function (o) { o.g.rotation.z = Math.sin(t * 1.5 + o.ph) * 0.06; o.g.rotation.x = Math.sin(t * 1.1 + o.ph) * 0.03; }); }
    return { root: root, anim: anim };
  });

  /* =====================  KUPU-KUPU + BUNGA  ===================== */
  register('butterfly-garden', function (c) {
    var T = c.THREE, root = new T.Group();
    var fl = make(T, 'flowers', c.opts), bf = make(T, 'butterfly', c.opts);
    root.add(fl, bf);
    bf.scale.setScalar(0.72); bf.rotation.order = 'YXZ';
    function anim(t) {
      fl.userData.anim(t); bf.userData.anim(t);
      /* jalur oval kecil di atas bunga; seluruh badan + sayap (rentang ±2.6 x skala) harus tetap di dalam bingkai kamera Teman */
      bf.position.set(Math.sin(t * 0.6) * 1.1, 5.0 + Math.sin(t * 1.7) * 0.3 + Math.sin(t * 0.6) * 0.2, Math.cos(t * 0.6) * 0.6);
      bf.rotation.set(-0.85, Math.cos(t * 0.6) * 0.4, Math.sin(t * 0.6) * 0.12);
    }
    return { root: root, anim: anim };
  });

  UT.MobView = { make: make, register: register, list: list };
})(window);
