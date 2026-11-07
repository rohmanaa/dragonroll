/* Ular Tangga Blok — gameplay/skin-uv.js (Stage 4.1.14.9: PNG skin 64x64 -> UV box Minecraft)
   Skrip klasik (tanpa import/export/type=module). Dimuat SEBELUM blok skrip gameplay.
   Isi: matematika UV murni + (CP2) perakit model 3D bertekstur. TANPA rnd(), TANPA state gameplay,
   TANPA mengubah aset PNG. Palette renderer lama di gameplay.html tetap fallback.
   Tata letak = skin Minecraft modern 64x64 (sama dengan crop di assets/js/item-art.js):
     kepala  (0,0)  overlay (32,0)     badan   (16,16) overlay (16,32)
     lengan kanan (40,16) overlay (40,32)   lengan kiri (32,48) overlay (48,48)
     kaki kanan   (0,16)  overlay (0,32)    kaki kiri   (16,48) overlay (0,48)
   Kotak (u,v) ukuran w x h x d:
     top    (u+d, v)        w x d      bottom (u+d+w, v)      w x d
     right  (u, v+d)        d x h      front  (u+d, v+d)      w x h
     left   (u+d+w, v+d)    d x h      back   (u+2d+w, v+d)   w x h
   Karakter menghadap +z (sama dengan pawn palette): depan = +z, sisi kanan karakter = -x. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplaySkin && UT.GameplaySkin.boxUV) return;

  var TEX = 64;
  /* urutan face THREE.BoxGeometry: +x, -x, +y, -y, +z, -z */
  var FACE_ORDER = ['left', 'right', 'top', 'bottom', 'front', 'back'];

  function boxUV(u, v, w, h, d) {
    return {
      top:    { x: u + d,         y: v,     w: w, h: d },
      bottom: { x: u + d + w,     y: v,     w: w, h: d },
      right:  { x: u,             y: v + d, w: d, h: h },
      front:  { x: u + d,         y: v + d, w: w, h: h },
      left:   { x: u + d + w,     y: v + d, w: d, h: h },
      back:   { x: u + 2 * d + w, y: v + d, w: w, h: h }
    };
  }

  /* Bagian tubuh (piksel). slim => lengan 3 px, classic => 4 px. Posisi pusat relatif ke dasar kaki (piksel). */
  function parts(slim) {
    var aw = slim ? 3 : 4;
    return [
      { id: 'head',     size: [8, 8, 8],    pos: [0, 28, 0],                 base: [0, 0],   over: [32, 0],  inflate: 0.5 },
      { id: 'body',     size: [8, 12, 4],   pos: [0, 18, 0],                 base: [16, 16], over: [16, 32], inflate: 0.25 },
      { id: 'armR',     size: [aw, 12, 4],  pos: [-(4 + aw / 2), 18, 0],     base: [40, 16], over: [40, 32], inflate: 0.25 },
      { id: 'armL',     size: [aw, 12, 4],  pos: [4 + aw / 2, 18, 0],        base: [32, 48], over: [48, 48], inflate: 0.25 },
      { id: 'legR',     size: [4, 12, 4],   pos: [-2, 6, 0],                 base: [0, 16],  over: [0, 32],  inflate: 0.25 },
      { id: 'legL',     size: [4, 12, 4],   pos: [2, 6, 0],                  base: [16, 48], over: [0, 48],  inflate: 0.25 }
    ];
  }

  /* Tulis UV ke BoxGeometry (r128: 6 face x 4 vertex, urutan (0,1),(1,1),(0,0),(1,0)). rects = hasil boxUV. */
  function applyBoxUV(geo, rects) {
    var uv = geo.attributes.uv, i, f, r, u0, u1, vt, vb;
    for (f = 0; f < 6; f++) {
      r = rects[FACE_ORDER[f]]; i = f * 4;
      u0 = r.x / TEX; u1 = (r.x + r.w) / TEX; vt = 1 - r.y / TEX; vb = 1 - (r.y + r.h) / TEX;
      uv.setXY(i, u0, vt); uv.setXY(i + 1, u1, vt); uv.setXY(i + 2, u0, vb); uv.setXY(i + 3, u1, vb);
    }
    uv.needsUpdate = true;
    return geo;
  }

  /* Deteksi lengan slim dari piksel (cadangan bila katalog tidak menyebut): kolom ke-4 lengan kanan
     (x=54..55, y=20..31) transparan seluruhnya => slim. Mengembalikan null bila tidak bisa dibaca. */
  function detectSlim(image) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = TEX;
      var x = c.getContext('2d'); x.drawImage(image, 0, 0);
      var d = x.getImageData(54, 20, 2, 12).data;
      for (var i = 3; i < d.length; i += 4) if (d[i] > 0) return false;
      return true;
    } catch (e) { return null; }
  }

  /* Perakit model 3D bertekstur (CP2). THREE dari parameter (tidak bergantung global).
     tex   = THREE.Texture pixel-art (NearestFilter) dari ItemArt.makeSkinTexture
     opts  = { slim: bool, unit: ukuran 1 piksel skin dalam unit dunia (default 0.03 => tinggi ~0.96) }
     Hasil = THREE.Group (kaki di y=0, menghadap +z). Material dibagi antar bagian; alphaTest untuk piksel transparan.
     Tidak memakai rnd(). */
  function buildModel(THREE, tex, opts) {
    opts = opts || {};
    var u = opts.unit || 0.03, slim = !!opts.slim, g = new THREE.Group(), list = parts(slim);
    var mBase = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
    var mOver = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
    list.forEach(function (p) {
      var s = p.size, uv = boxUV(p.base[0], p.base[1], s[0], s[1], s[2]), ov = boxUV(p.over[0], p.over[1], s[0], s[1], s[2]);
      var m = new THREE.Mesh(applyBoxUV(new THREE.BoxGeometry(s[0] * u, s[1] * u, s[2] * u), uv), mBase);
      m.position.set(p.pos[0] * u, p.pos[1] * u, p.pos[2] * u); m.castShadow = true; m.name = p.id; g.add(m);
      var k = p.inflate * 2, o = new THREE.Mesh(applyBoxUV(new THREE.BoxGeometry((s[0] + k) * u, (s[1] + k) * u, (s[2] + k) * u), ov), mOver);
      o.position.copy(m.position); o.name = p.id + 'Over'; g.add(o);
    });
    g.userData.pngSkin = true; g.userData.slim = slim;
    return g;
  }

  UT.GameplaySkin = { TEX: TEX, FACE_ORDER: FACE_ORDER, boxUV: boxUV, parts: parts, applyBoxUV: applyBoxUV, detectSlim: detectSlim, buildModel: buildModel };
})(window);
