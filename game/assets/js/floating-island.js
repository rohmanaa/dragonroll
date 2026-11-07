/* FloatingIsland v2 — komponen pulau melayang voxel, terpisah dari latar & karakter.
   Pakai (butuh THREE global): const isl = UT.FloatingIsland.create(THREE,{seed:5});
     scene.add(isl);  per frame: isl.userData.update(t);   // melayang naik-turun halus
   Permukaan atas pulau di y=0 (karakter berdiri di y=0).
   v2: palet alami (hijau zaitun/sage, BUKAN neon), tanah & tanah liat bervariasi, batu abu-kebiruan + lumut,
       butir emas & kristal biru, tepi rumput menetes, tekstur piksel per-balok (atlas 4x4, tile acak per instance),
       dekor: bunga, jamur, semak, jumbai rumput, batu; AO voxel per-instance.
   opts tambahan: decor:false (tanpa dekor puncak), noShadow:true (tanpa bayangan kontak). */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};

  function rng(seed) { var s = (seed || 1) * 2654435761 % 2147483647 || 1; return function () { s = s * 16807 % 2147483647; return s / 2147483647; }; }
  function hash2(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }

  /* palet: hijau enak dipandang (saturasi sedang, cenderung zaitun/sage) + warna pendamping */
  var PAL = {
    grass: [0x6a9440, 0x5d8738, 0x76a049, 0x537c3a],
    grassOlive: 0x86973f, grassSage: 0x5a8452, moss: [0x5a8744, 0x4e7a3e],
    dirt: [0x8b5d3a, 0x7d5233, 0x96683f, 0x6e4a2e], clay: 0xa8794a, gravel: 0x8c8b90,
    stone: [0x9a9ca6, 0x868a96, 0xaeb0b8, 0x7c808c], sand: 0xb09a78, stoneMoss: 0x6f8f55,
    gold: 0xd9a441, crystal: 0x7fd0e8,
    tuft: [0x4f7f33, 0x68923f, 0x86a850], flowers: [0xe58fa0, 0xf0cf68, 0xf2efe6, 0xa99bd6, 0xe9a35c]
  };

  /* bayangan lembut (dipakai juga untuk "contact shadow" karakter) */
  function contactShadow(THREE, w, h, opacity) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(20,50,90,.9)'); gr.addColorStop(.55, 'rgba(20,50,90,.35)'); gr.addColorStop(1, 'rgba(20,50,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: opacity == null ? .5 : opacity, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; return m;
  }

  /* atlas tekstur piksel 4x4 tile (16px/tile): bintik terang/gelap halus, dikalikan warna instance */
  function makeAtlas(THREE, rnd) {
    var T = 16, N = 4, c = document.createElement('canvas'); c.width = c.height = T * N;
    var g = c.getContext('2d'), t, i, v;
    for (t = 0; t < N * N; t++) {
      var ox = (t % N) * T, oy = ((t / N) | 0) * T;
      g.fillStyle = 'rgb(236,236,236)'; g.fillRect(ox, oy, T, T);
      for (i = 0; i < 26; i++) { v = rnd() < .5 ? 214 + (rnd() * 14 | 0) : 244 + (rnd() * 11 | 0); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(ox + (rnd() * T | 0), oy + (rnd() * T | 0), 1 + (rnd() < .25 ? 1 : 0), 1); }
      if (rnd() < .5) { g.fillStyle = 'rgb(200,200,200)'; g.fillRect(ox + (rnd() * 12 | 0), oy + (rnd() * 12 | 0), 2, 2); } /* kerikil kecil */
    }
    var tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    return tex;
  }

  function create(THREE, opts) {
    opts = opts || {};
    var rnd = rng(opts.seed || 5), g = new THREE.Group();
    var R = [3.7, 3.7, 3.0, 2.0], N = R.length, cells = {}, list = [], x, y, z;

    /* bentuk organik: tepi bergelombang (dua frekuensi) */
    for (y = 0; y < N; y++) {
      var r = R[y], lim = Math.ceil(r + 2);
      for (x = -lim; x <= lim; x++) for (z = -lim; z <= lim; z++) {
        var wob = Math.sin(z * .9 + y) * .32 + Math.cos(x * .75 - y) * .28;
        var d = Math.hypot(x * 1.04 + wob, z + wob * .6) / (r + (rnd() - .5) * 1.0);
        if (d <= 1 || (y === 0 && x === 0 && z === 0)) { cells[x + ',' + y + ',' + z] = 1; list.push([x, y, z]); }
      }
    }
    var has = function (a, b, c) { return cells[a + ',' + b + ',' + c] === 1; };
    /* stalaktit batu menjuntai di bawah */
    var low = list.filter(function (c) { return c[1] === N - 1; });
    for (var s = 0; s < 6 && low.length; s++) {
      var lc = low[(rnd() * low.length) | 0], len = 1 + (rnd() < .5 ? 1 : 0);
      for (var q = 1; q <= len; q++) { var k = lc[0] + ',' + (N - 1 + q) + ',' + lc[2]; if (!cells[k]) { cells[k] = 1; list.push([lc[0], N - 1 + q, lc[2]]); } }
    }
    var side = function (a, b, c) { return !has(a + 1, b, c) || !has(a - 1, b, c) || !has(a, b, c + 1) || !has(a, b, c - 1); };

    var hexOf = function (c) {
      x = c[0]; y = c[1]; z = c[2];
      var rr = rnd(), ex = side(x, y, z), patch = hash2(Math.floor(x / 2), Math.floor(z / 2));
      if (y === 0) {                                   /* puncak: rumput 2-warna + petak zaitun/sage */
        if (patch > .8) return PAL.grassOlive;
        if (patch < .16) return PAL.grassSage;
        return PAL.grass[((x + z) & 1) ? (rr < .2 ? 2 : 0) : (rr < .2 ? 3 : 1)];
      }
      if (y === 1 && ex && rr < .62) return PAL.moss[(x + z) & 1];       /* rumput menetes di tepi */
      if (y === 2 && ex && rr < .2) return PAL.moss[1];
      if (y <= 2) {                                     /* tanah: coklat bervariasi, tanah liat, kerikil */
        if (rr < .07) return PAL.clay; if (rr < .12) return PAL.gravel;
        return PAL.dirt[(x * 3 + z * 2 + y + (rr * 4 | 0)) & 3];
      }
      if (y === 3 && rr < .3) return PAL.dirt[(x + z) & 3];
      if (rr < .05) return PAL.gold;                    /* butir emas */
      if (rr < .12) return PAL.sand;
      if (y === 3 && ex && rr < .24) return PAL.stoneMoss; /* lumut di batu */
      return PAL.stone[Math.abs(x * 5 + z * 3 + y + (rr * 3 | 0)) & 3];
    };

    /* material dengan atlas piksel; tile dipilih per-instance lewat atribut aTile */
    var geo = new THREE.BoxGeometry(1, 1, 1), n = list.length, tile = new Float32Array(n * 2);
    geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    var mat = new THREE.MeshStandardMaterial({ roughness: .92, metalness: 0, map: makeAtlas(THREE, rnd) });
    mat.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aTile;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvUv = vUv * 0.25 + aTile;\n#endif');
    };
    var mesh = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), col = new THREE.Color();
    list.forEach(function (c, i) {
      x = c[0]; y = c[1]; z = c[2];
      var above = 0, a, b;
      for (a = -1; a <= 1; a++) for (b = -1; b <= 1; b++) if (has(x + a, y - 1, z + b)) above++;
      var ao = Math.max(.5, 1 - .055 * above), dd = 1 - .02 * y, jit = .96 + rnd() * .08;
      col.setHex(hexOf(c)).multiplyScalar(ao * dd * jit * .98);
      var t = (rnd() * 16) | 0; tile[i * 2] = (t % 4) * .25; tile[i * 2 + 1] = ((t / 4) | 0) * .25;
      m4.makeTranslation(x, -y - .5, z); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col);
    });
    mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    g.add(mesh);

    /* ---- dekor puncak (di luar area karakter di tengah) ---- */
    var top = list.filter(function (c) { return c[1] === 0 && Math.hypot(c[0], c[2]) < 3.2 && !(Math.abs(c[0]) < 2 && Math.abs(c[2]) < 2); });
    var M = function (hex, r) { return new THREE.MeshStandardMaterial({ color: hex, roughness: r == null ? 1 : r }); };
    var pick = function () { return top[(rnd() * top.length) | 0]; };
    var add = function (geom, mt, px, py, pz, cast) { var o = new THREE.Mesh(geom, mt); o.position.set(px, py, pz); if (cast !== false) o.castShadow = true; g.add(o); return o; };
    var i, c, h;
    if (opts.decor !== false) {                                      /* opts.decor:false = tanpa dekor puncak (dipakai gameplay: pulau sebagai dasar dunia) */
    for (i = 0; i < 14 && top.length; i++) {                         /* jumbai rumput 3 warna */
      c = pick(); h = .28 + rnd() * .42;
      for (var kq = 0; kq < 3; kq++) add(new THREE.BoxGeometry(.12, h * (1 - kq * .22), .12), M(PAL.tuft[kq]), c[0] + (rnd() - .5) * .65, h * (1 - kq * .22) / 2, c[2] + (rnd() - .5) * .65);
    }
    for (i = 0; i < 9 && top.length; i++) {                          /* bunga warna-warni */
      c = pick(); var fx = c[0] + (rnd() - .5) * .6, fz = c[2] + (rnd() - .5) * .6, fh = .26 + rnd() * .16;
      add(new THREE.BoxGeometry(.06, fh, .06), M(0x4f7f33), fx, fh / 2, fz, false);
      add(new THREE.BoxGeometry(.2, .14, .2), M(PAL.flowers[(rnd() * PAL.flowers.length) | 0], .8), fx, fh + .05, fz);
      add(new THREE.BoxGeometry(.07, .05, .07), M(0xf6e08a), fx, fh + .14, fz, false);
    }
    for (i = 0; i < 2 && top.length; i++) {                          /* jamur */
      c = pick(); var mx = c[0] + (rnd() - .5) * .4, mz = c[2] + (rnd() - .5) * .4;
      add(new THREE.BoxGeometry(.13, .2, .13), M(0xe8dcc0), mx, .1, mz);
      add(new THREE.BoxGeometry(.34, .12, .34), M(0xc2503f), mx, .24, mz);
      add(new THREE.BoxGeometry(.08, .03, .08), M(0xffffff), mx + .08, .31, mz + .06, false);
    }
    for (i = 0; i < 2 && top.length; i++) {                          /* semak kecil */
      c = pick();
      add(new THREE.BoxGeometry(.55, .38, .5), M(0x45703a), c[0], .19, c[2]);
      add(new THREE.BoxGeometry(.36, .3, .34), M(0x55823f), c[0] + .06, .5, c[2] - .03);
    }
    [[2.0, 1.3, .8, .32, .7, 0xb9a98c], [-1.7, -2.2, .5, .26, .5, 0x9c9ca2], [1.0, -2.6, .38, .2, .38, 0xb4a48a], [-2.3, .9, .42, .22, .4, 0xa8a7ad]].forEach(function (st) {
      var sm = add(new THREE.BoxGeometry(st[2], st[3], st[4]), M(st[5]), st[0], st[3] / 2, st[1]); sm.rotation.y = st[0];
    });
    }

    /* ---- detail bawah: kristal biru bercahaya + kepingan batu melayang ---- */
    var cm = new THREE.MeshStandardMaterial({ color: PAL.crystal, emissive: 0x2a8fb8, emissiveIntensity: .7, roughness: .3 });
    [[-1.0, -N - .1, .6, .22, .55], [.7, -N - .3, -.5, .18, .42], [1.4, -N + .6, .9, .16, .34]].forEach(function (p) {
      var cr = add(new THREE.BoxGeometry(p[3], p[4], p[3]), cm, p[0], p[1], p[2], false); cr.rotation.z = p[0] * .25; cr.rotation.y = .6;
    });
    [[.2, -N - 1.6, 0, .5], [1.0, -N - 1.2, -.6, .32], [-.9, -N - 1.9, .5, .22]].forEach(function (p) {
      add(new THREE.BoxGeometry(p[3], p[3], p[3]), M(0x70707c), p[0], p[1], p[2], false);
    });

    var shadow = contactShadow(THREE, 9, 9, opts.shadow == null ? .38 : opts.shadow); shadow.position.y = -N - 3; if (!opts.noShadow) g.add(shadow);
    var base = -N - 3, amp = opts.bob == null ? .16 : opts.bob;
    g.userData.update = function (t) {
      var b = Math.sin(t * 1.1) * amp;
      g.position.y = b; g.rotation.z = Math.sin(t * .6) * .012;
      shadow.position.y = base - b; shadow.scale.setScalar(1 - b * .35); shadow.material.opacity = (opts.shadow == null ? .38 : opts.shadow) * (1 - b * .8);
    };
    if (opts.scale) g.scale.setScalar(opts.scale);
    return g;
  }

  UT.FloatingIsland = { create: create, contactShadow: contactShadow, palette: PAL };
})();
