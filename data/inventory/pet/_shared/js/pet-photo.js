/* pet-photo.js — "foto" pet 3D untuk Profil (gambar statis, seperti foto karakter), bukan thumbnail webp toko.
   Model pet dibangun SEKALI dari modul model.js yang sama dengan pet-viewer, dirender lewat UT.SharedGL.offscreen() ke dataURL
   (latar transparan), lalu disimpan oleh pemanggil. Tanpa partikel dan tanpa animasi hidup: hanya satu pose diam.
   Helper mesh di bawah = salinan helper pet-viewer.js (API sama, dipakai model.js); konstanta redup (DIM) harus dijaga sama
   dengan di pet-viewer.js agar pet terlihat sama di Profil dan di halaman Pet.
   API: UT.PetPhoto.shoot(gameKey, W, H) -> Promise<dataURL> */
(function (global) {
  'use strict';
  const UT = global.UT = global.UT || {};
  if (UT.PetPhoto) return;

  /* Cahaya efek diminimalkan dan warna sedikit digelapkan supaya tidak menyilaukan:
     emissive = pengali intensitas emissive, glow = pengali opasitas sprite cahaya, dark = pengali warna dasar. */
  const DIM = Object.freeze({ emissive: .5, glow: .4, dark: .84 });

  function makeKit(T) {
    let seed = 11;   /* acak deterministik: foto yang sama setiap kali dijepret */
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const rr = (a, b) => a + (b - a) * rnd();
    const pick = a => a[(rnd() * a.length) | 0];
    const jc = (hex, a) => {
      const c = new T.Color(hex);
      if (a) c.offsetHSL(0, 0, (rnd() - .5) * a);
      c.r *= DIM.dark; c.g *= DIM.dark; c.b *= DIM.dark;
      return c;
    };
    /* intensitas/opasitas yang ditulis model (juga tiap frame lewat tick) otomatis dikali pengali redup */
    const scaled = (obj, prop, k) => {
      let v = obj[prop];
      Object.defineProperty(obj, prop, { get: () => v * k, set: x => { v = x; }, configurable: true, enumerable: true });
    };
    function mk(parent, geo, col, x, y, z, o) {
      o = o || {};
      const mat = new T.MeshStandardMaterial({ color: jc(col, o.j === undefined ? .06 : o.j), roughness: o.r === undefined ? .8 : o.r, metalness: o.m || 0, flatShading: o.flat !== false });
      if (o.e !== undefined) { mat.emissive = new T.Color(o.e); mat.emissiveIntensity = o.ei === undefined ? 1 : o.ei; scaled(mat, 'emissiveIntensity', DIM.emissive); }
      if (o.op !== undefined) { mat.transparent = true; mat.opacity = o.op; }
      if (o.side) mat.side = T.DoubleSide;
      const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
      if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
      parent.add(m); return m;
    }
    const bx = (p, w, h, d, c, x, y, z, o) => mk(p, new T.BoxGeometry(w, h, d), c, x, y, z, o);
    const cone = (p, r, h, c, x, y, z, o, seg) => mk(p, new T.ConeGeometry(r, h, seg || 4), c, x, y, z, o);
    const cyl = (p, r, h, c, x, y, z, o, seg) => mk(p, new T.CylinderGeometry(r, r, h, seg || 10), c, x, y, z, o);
    const oct = (p, r, c, x, y, z, o) => mk(p, new T.OctahedronGeometry(r, 0), c, x, y, z, o);
    const torus = (p, r, t, c, x, y, z, o) => mk(p, new T.TorusGeometry(r, t, 6, 36), c, x, y, z, o);
    const sph = (p, r, c, x, y, z, o) => mk(p, new T.SphereGeometry(r, 10, 8), c, x, y, z, o);
    function gp(parent, x, y, z) { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }
    function eye(p, x, y, z, s, iris, o) {
      o = o || {}; const g = gp(p, x, y, z);
      bx(g, s, s * 1.1, .05, o.sc || '#ffffff', 0, 0, 0, { j: 0, e: o.scGlow });
      bx(g, s * .62, s * .82, .06, iris || '#1a1020', 0, -.01 * s, .02, { j: 0, e: o.glow, ei: o.ei || 1 });
      bx(g, s * .22, s * .22, .07, '#ffffff', s * .14, s * .2, .04, { j: 0, e: '#ffffff' });
      return g;
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const glowTex = new T.CanvasTexture(cv);
    function glow(p, col, size, x, y, z, op) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: col, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: op === undefined ? .8 : op }));
      scaled(s.material, 'opacity', DIM.glow);
      s.scale.set(size, size, 1); s.position.set(x || 0, y || 0, z || 0); p.add(s); return s;
    }
    function fan(pts) {
      const v = []; for (let i = 1; i < pts.length - 1; i++) v.push(pts[0][0], pts[0][1], pts[0][2], pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
    }
    function makeBolt(parent, n, col) {
      const g = gp(parent, 0, 0, 0), segs = [];
      const mat = new T.MeshBasicMaterial({ color: col, blending: T.AdditiveBlending, transparent: true, depthWrite: false });
      for (let i = 0; i < n; i++) { const m = new T.Mesh(new T.BoxGeometry(.07, .07, 1), mat); m.visible = false; g.add(m); segs.push(m); }
      return { g, mat, set(pts) {
        for (let i = 0; i < segs.length; i++) {
          const m = segs[i];
          if (i >= pts.length - 1) { m.visible = false; continue; }
          const a = new T.Vector3(...pts[i]), b = new T.Vector3(...pts[i + 1]);
          m.visible = true; m.position.copy(a).add(b).multiplyScalar(.5); m.scale.set(1, 1, a.distanceTo(b)); m.lookAt(b);
        } }, hide() { segs.forEach(m => m.visible = false); } };
    }
    function zig(a, b, n, amp) {
      const pts = []; for (let i = 0; i <= n; i++) { const u = i / n, j = (i === 0 || i === n) ? 0 : 1; pts.push([a[0] + (b[0] - a[0]) * u + (rnd() - .5) * amp * j, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + (rnd() - .5) * amp * j]); }
      return pts;
    }
    const rate = r => { let a = 0; return (dt, fn) => { a += r * dt; let n = 0; while (a >= 1 && n++ < 10) { a--; fn(); } }; };
    return { helpers: Object.freeze({ bx, cone, cyl, oct, torus, sph, gp, eye, glow, fan, mk, makeBolt, zig, rate, pick, rr }), glowTex };
  }

  function disposeTree(root) {
    root.traverse(o => {
      try { if (o.geometry) o.geometry.dispose(); } catch (_) {}
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { try { if (m.map && m.map.dispose && !m.map.__shared) m.map.dispose(); m.dispose(); } catch (_) {} });
    });
  }

  /* Jepret satu foto pet. Pose diam = hasil tick() beberapa detik (pet "berdiri" natural), partikel dibuang (emit kosong). */
  function shoot(gameKey, W, H) {
    const reg = UT.PetModelRegistry, SGL = UT.SharedGL, T = global.THREE;
    if (!T || !SGL || !reg || !reg.hasModule(gameKey)) return Promise.reject(new Error('PetPhoto: model/renderer tidak tersedia untuk ' + gameKey));
    return reg.load(gameKey).then(builder => {
      const kit = makeKit(T);
      const model = builder({ THREE: T, helpers: kit.helpers, emit: () => {} });
      if (!model || !model.root || typeof model.tick !== 'function' || !model.cam) throw new TypeError('PetPhoto: model tidak valid: ' + gameKey);
      const sc = new T.Scene();
      /* cahaya lembut & redup (lebih rendah dari pet-viewer): tidak ada kilap putih yang menyilaukan */
      sc.add(new T.HemisphereLight(0xb9c6e6, 0x1c1630, .5));
      const key = new T.DirectionalLight(0xffeccc, .55); key.position.set(4, 7, 5); sc.add(key);
      const rim = new T.DirectionalLight(0x8fa8e8, .25); rim.position.set(-5, 3, -5); sc.add(rim);
      sc.add(model.root);
      for (let i = 0; i < 70; i++) model.tick(1.2 + i * .05, .05);   /* 3,5 detik animasi -> satu pose diam yang wajar */
      sc.updateMatrixWorld(true);
      const cam = new T.PerspectiveCamera(40, W / H, .1, 100);
      /* sudut pandang sama dengan pratinjau halaman Pet (azimut .6, sedikit dari atas), sedikit lebih dekat agar pet memenuhi bingkai */
      const az = .6, pol = 1.3, ty = model.cam.y, dd = model.cam.d * .94 * (W / H < 1 ? 1 + (1 - W / H) * .8 : 1);
      cam.position.set(Math.sin(pol) * Math.sin(az) * dd, ty + Math.cos(pol) * dd * .9 - dd * .18, Math.sin(pol) * Math.cos(az) * dd);
      cam.lookAt(0, ty, 0);
      const r = SGL.offscreen();
      r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0x000000, 0); r.render(sc, cam);
      const url = r.domElement.toDataURL('image/webp', .92);
      disposeTree(sc); kit.glowTex.dispose();
      return url;
    });
  }

  UT.PetPhoto = Object.freeze({ shoot, DIM });
})(window);
