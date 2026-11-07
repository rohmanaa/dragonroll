/* Ular Tangga Blok — assets/js/character-data.js
   DATA KARAKTER BERSAMA (voxel) — satu sumber detail model karakter & mob gameplay, untuk dipakai halaman mana pun
   (lobby, leaderboard, profil, shop, inventory, dll). Skrip klasik (tanpa import/export), global: UT.CharacterData.
   - Data di bawah diekstrak apa adanya dari gameplay.html (makePawn / addCreeper / addEnderman / addSkeleton / addZombie /
     addWarden / addVillager / addBlaze / makeHostile) oleh tools/character-data/build.js (jalankan ulang bila model di gameplay.html berubah). gameplay.html TIDAK diubah.
   - Satu box = [x, y, z, w, h, d, '#rrggbb', noEdge, tag]. Pusat box; satuan dunia gameplay; dasar kaki di y=0;
     karakter menghadap +z; kanan karakter = -x. noEdge=1: detail tanpa garis tepi (mata, mulut, dll).
     tag: 0 biasa | 2 batang Blaze (berputar di gameplay) | 3 blok kepala 0.3 (di gameplay = 27 kubus 0.1 dengan variasi warna 0.09).
   - Grup: 'player' (skin palette gameplay), 'mob' (mob di petak papan), 'wild' (mob liar di luar papan, mis. Golem).
   - Skin PNG (hero, knight, ...) memakai tekstur: lihat ItemArt.character()/face() (assets/js/item-art.js). Di sini hanya
     metadata + fallback ke 'steve'.
   API:
     UT.CharacterData.list(group)                 -> ['steve', ...]
     UT.CharacterData.get(group, key)             -> {group,key,name,hex,css,boxes,bounds,png?,fallback?}
     UT.CharacterData.svg(group, key, opts)       -> string SVG (opts: view 'front'|'iso'|'back'|'side', yaw, pitch, bust, size, edge, label)
     UT.CharacterData.face(group, key, opts)      -> SVG kepala saja (depan)
     UT.CharacterData.mesh(THREE, group, key, o)  -> THREE.Group (satu mesh, vertex color); o.scale, o.dither (default true)
     UT.CharacterData.SEATS                       -> warna kursi pemain (Merah/Biru/Kuning/Hijau) */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.CharacterData && UT.CharacterData.get) return;

  var DATA = /*DATA*/;
  var META = /*META*/;
  var SEATS = /*SEATS*/;

  function bounds(boxes) {
    var b = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9 };
    boxes.forEach(function (q) {
      b.minX = Math.min(b.minX, q[0] - q[3] / 2); b.maxX = Math.max(b.maxX, q[0] + q[3] / 2);
      b.minY = Math.min(b.minY, q[1] - q[4] / 2); b.maxY = Math.max(b.maxY, q[1] + q[4] / 2);
      b.minZ = Math.min(b.minZ, q[2] - q[5] / 2); b.maxZ = Math.max(b.maxZ, q[2] + q[5] / 2);
    });
    return b;
  }
  var cache = {};
  function get(group, key) {
    var ck = group + ':' + key; if (cache[ck]) return cache[ck];
    var m = (META[group] || {})[key]; if (!m) return null;
    var boxes = DATA[group] && DATA[group][m.fallback || key];
    var o = { group: group, key: key, name: m.name, hex: m.hex, css: m.css, png: !!m.png, fallback: m.fallback || null,
              boxes: boxes || [], bounds: boxes ? bounds(boxes) : null };
    return (cache[ck] = o);
  }
  function list(group) { return Object.keys(META[group] || {}); }

  /* ---------- util warna ---------- */
  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function shade(h, f) {
    var c = rgb(h); return 'rgb(' + Math.max(0, Math.min(255, Math.round(c[0] * f))) + ',' + Math.max(0, Math.min(255, Math.round(c[1] * f))) + ',' + Math.max(0, Math.min(255, Math.round(c[2] * f))) + ')';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- SVG: proyeksi ortografis + painter's algorithm ---------- */
  var FACES = [ /* normal, 4 sudut (sx,sy,sz = -1/+1), faktor cahaya */
    { n: [0, 0, 1],  c: [[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]],    l: 1.0 },
    { n: [0, 0, -1], c: [[1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1]], l: 0.72 },
    { n: [1, 0, 0],  c: [[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]],    l: 0.84 },
    { n: [-1, 0, 0], c: [[-1, 1, -1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1]], l: 0.78 },
    { n: [0, 1, 0],  c: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],    l: 1.16 },
    { n: [0, -1, 0], c: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]], l: 0.55 }
  ];
  var VIEWS = { front: [0, 0], back: [180, 0], side: [90, 0], iso: [35, 22] };

  function svg(group, key, opts) {
    opts = opts || {};
    var d = get(group, key); if (!d || !d.boxes.length) return '';
    var v = VIEWS[opts.view || 'front'] || VIEWS.front;
    var yaw = (opts.yaw != null ? opts.yaw : v[0]) * Math.PI / 180, pit = (opts.pitch != null ? opts.pitch : v[1]) * Math.PI / 180;
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    function rot(x, y, z) { var x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y, z1]; }
    function proj(x, y, z) { var r = rot(x, y, z); return [r[0], -(r[1] * cp) + r[2] * sp]; }
    var edge = opts.edge !== false;
    var items = d.boxes.map(function (q) {
      var r = rot(q[0], q[1], q[2]);
      return { q: q, depth: r[2] * cp + r[1] * sp };
    }).sort(function (a, b) { return a.depth - b.depth; });
    var out = [], x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, cut = opts.bust ? (opts.bustFrom != null ? opts.bustFrom : d.bounds.maxY * 0.58) : -1e9;
    items.forEach(function (it) {
      var q = it.q, hw = q[3] / 2, hh = q[4] / 2, hd = q[5] / 2;
      FACES.forEach(function (f) {
        var nr = rot(f.n[0], f.n[1], f.n[2]);
        if (nr[2] * cp + nr[1] * sp <= 1e-6) return;
        var pts = f.c.map(function (c) { return proj(q[0] + c[0] * hw, q[1] + c[1] * hh, q[2] + c[2] * hd); });
        pts.forEach(function (p, i) { var wy = q[1] + f.c[i][1] * hh; if (wy < cut) return; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
        out.push('<polygon points="' + pts.map(function (p) { return p[0].toFixed(3) + ',' + p[1].toFixed(3); }).join(' ') + '" fill="' + shade(q[6], f.l) + '"' +
          (edge && !q[7] ? ' stroke="rgba(0,0,0,.32)" stroke-width="0.008" stroke-linejoin="round"' : ' stroke="' + shade(q[6], f.l) + '" stroke-width="0.004"') + '/>');
      });
    });
    var pad = 0.06, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2, size = opts.size;
    var attrs = ' viewBox="' + (x0 - pad).toFixed(3) + ' ' + (y0 - pad).toFixed(3) + ' ' + w.toFixed(3) + ' ' + h.toFixed(3) + '"';
    if (size) attrs += ' width="' + Math.round(size * w / Math.max(w, h)) + '" height="' + Math.round(size * h / Math.max(w, h)) + '"';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="ut-char" shape-rendering="geometricPrecision"' + attrs + ' role="img" aria-label="' + esc(opts.label || d.name) + '">' + out.join('') + '</svg>';
  }
  function face(group, key, opts) {
    opts = opts || {};
    var d = get(group, key); if (!d || !d.boxes.length) return '';
    var top = d.bounds.maxY;
    return svg(group, key, { view: 'front', bust: true, bustFrom: top - (opts.headH || (group === 'player' ? 0.3 : 0.32)), size: opts.size, label: opts.label, edge: opts.edge });
  }

  /* ---------- THREE.js: satu BufferGeometry ber-vertex-color ---------- */
  function seeded(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function mesh(THREE, group, key, o) {
    o = o || {};
    var d = get(group, key); if (!d || !d.boxes.length) return null;
    var boxes = o.boxes || d.boxes; if (!boxes.length) return null; /* o.boxes: sebagian kotak saja (bagian tubuh terpisah, lihat character-view.js) */
    var rnd = seeded(o.seed || 1337), dither = o.dither !== false, pos = [], nor = [], col = [], idx = [], n = 0;
    function addCube(q, cx, cy, cz, w, h, dd, hex, amt) {
      var c = new THREE.Color(hex); if (amt) c.offsetHSL(0, 0, (rnd() - 0.5) * amt);
      FACES.forEach(function (f) {
        var li = f.l > 1 ? 1 : f.l < 0.6 ? 0.7 : 1;
        f.c.forEach(function (k) { pos.push(cx + k[0] * w / 2, cy + k[1] * h / 2, cz + k[2] * dd / 2); nor.push(f.n[0], f.n[1], f.n[2]); col.push(c.r * li, c.g * li, c.b * li); });
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
      });
    }
    boxes.forEach(function (q) {
      if (q[8] === 3 && dither) { for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) for (var l = -1; l <= 1; l++) addCube(q, q[0] + i * 0.1, q[1] + j * 0.1, q[2] + l * 0.1, 0.1, 0.1, 0.1, q[6], 0.09); }
      else addCube(q, q[0], q[1], q[2], q[3], q[4], q[5], q[6], 0);
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    var m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    var grp = new THREE.Group(); grp.add(m); if (o.scale) grp.scale.setScalar(o.scale);
    grp.userData.characterData = { group: group, key: key, name: d.name, bounds: d.bounds };
    return grp;
  }

  UT.CharacterData = { version: 1, list: list, get: get, svg: svg, face: face, mesh: mesh, SEATS: SEATS, groups: Object.keys(META) };
})(window);
