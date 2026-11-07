/* Gambar item (SVG inline berbasis piksel/blok) — tanpa aset eksternal, tanpa emoji.
   Semua data berasal dari katalog internal, bukan input pengguna. */
(function (g) {
  'use strict';
  var C = g.ItemCatalog;

  /* Wajah 8x8 + palet, selaras dengan tampilan skin di lobby.html */
  var FACES = {
    steve:   { p: { h: '#4a2e13', H: '#3a2410', s: '#c58c62', w: '#fff', b: '#3b4fd8', n: '#a56a45', m: '#5a3820' },
               f: ['hhhhhhhh', 'hHhhhhHh', 'hssssssh', 'swbssbws', 'sssnnsss', 'ssmmmmss', 'smmmmmms', 'ssmmmmss'],
               body: { shirt: '#00a8a8', arm: '#c58c62', pants: '#3b4fd8', shoe: '#555a60' } },
    alex:    { p: { o: '#d4701c', O: '#b85a10', s: '#e8b48a', w: '#fff', g: '#2f8f3f', n: '#c98b66', m: '#b0563a' },
               f: ['oooooooo', 'oOooooOo', 'osssssso', 'swgssgws', 'sssnnsss', 'sssmmsss', 'ssssssss', 'ssssssss'],
               body: { shirt: '#6fbf3f', arm: '#e8b48a', pants: '#7a5230', shoe: '#444' } },
    creeper: { p: { g: '#5fb34a', G: '#3f8a35', k: '#0b0b0b' },
               f: ['gGggGggg', 'gkkggkkg', 'gkkggkkg', 'gggkkggg', 'ggkkkkgg', 'ggkkkkgg', 'ggkggkgg', 'gGggggGg'],
               body: { shirt: '#5fb34a', arm: '#4c9a3b', pants: '#3f8a35', shoe: '#2f6a28' } },
    ender:   { p: { b: '#141414', B: '#222', p: '#e879f9', q: '#a21caf' },
               f: ['bbbbbbbb', 'bBbbbbBb', 'bbbbbbbb', 'bbbbbbbb', 'pqpbbpqp', 'bbbbbbbb', 'bBbbbbBb', 'bbbbbbbb'],
               body: { shirt: '#1b1b1b', arm: '#141414', pants: '#141414', shoe: '#0a0a0a' } },
    zombie:  { p: { h: '#2f5f2a', s: '#5e9e4a', S: '#4c8a3b', w: '#fff', b: '#2a2a8a', m: '#1d3d18' },
               f: ['hhhhhhhh', 'hsssssSh', 'ssssssss', 'swbssbws', 'sssSsSss', 'ssmmmmss', 'smmmmmms', 'ssmsmsss'],
               body: { shirt: '#2d8fa8', arm: '#5e9e4a', pants: '#2a2a8a', shoe: '#222a55' } },
    skeleton:{ p: { k: '#e8e8e8', K: '#c4c4c4', d: '#222', m: '#8a8a8a' },
               f: ['kkkkkkkk', 'kKkkkkKk', 'kkkkkkkk', 'kddkkddk', 'kddkkddk', 'kkkddkkk', 'kmdmdmkk', 'kkkkkkkk'],
               body: { shirt: '#d6d6d6', arm: '#e0e0e0', pants: '#c8c8c8', shoe: '#b0b0b0', ribs: '#6f7378' } }
  };

  function rect(x, y, w, h, fill) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>'; }

  /* ---------- Skin PNG (Tahap 3.2) ----------
     PNG = TEXTURE template Minecraft 64x64, dipotong per bagian tubuh (crop) lalu digambar di atas
     data skin cadangan. Jadi bila PNG hilang/rusak, yang tampil adalah skin cadangan — BUKAN karakter kosong.
     Pixel-art: tanpa smoothing (image-rendering: pixelated + shape-rendering: crispEdges). */
  var TEX = 64;
  function isPng(it) { return !!it && it.kind === 'skin' && it.renderer === 'png'; }
  function pngReady(it) { return isPng(it) && !!it.textureValid; }
  function textureUrl(skinId) { return C.skinTexture(skinId); }

  /* Data skin untuk gambar vektor: skin legacy -> FACES miliknya; skin PNG -> skin cadangan (default). */
  function faceData(it) {
    if (!it || it.kind !== 'skin') return null;
    if (isPng(it)) { var fb = C.byId(C.fallbackSkinId()); return fb ? FACES[fb.gameKey] || null : null; }
    return FACES[it.gameKey] || null;
  }

  /* Potongan texture (sx,sy,w,h) digambar di (dx,dy) berukuran sama. */
  function crop(url, sx, sy, w, h, dx, dy) {
    return '<svg x="' + dx + '" y="' + dy + '" width="' + w + '" height="' + h + '" viewBox="' + sx + ' ' + sy + ' ' + w + ' ' + h + '" preserveAspectRatio="none" overflow="hidden">' +
      '<image href="' + url + '" width="' + TEX + '" height="' + TEX + '" preserveAspectRatio="none" style="image-rendering:crisp-edges;image-rendering:pixelated"/></svg>';
  }
  /* Layer texture wajah (8x8): kepala depan + overlay topi/rambut */
  function pngFaceLayers(url, dx, dy) { return crop(url, 8, 8, 8, 8, dx, dy) + crop(url, 40, 8, 8, 8, dx, dy); }
  /* Layer texture tubuh penuh (16x32): kaki, badan, lengan (classic 4 px / slim 3 px), kepala + semua overlay */
  function pngBodyLayers(it, url) {
    var aw = it.arms === 'slim' ? 3 : 4, ra = 4 - aw, s = '';
    s += crop(url, 4, 20, 4, 12, 4, 20) + crop(url, 20, 52, 4, 12, 8, 20);          /* kaki kanan & kiri */
    s += crop(url, 20, 20, 8, 12, 4, 8);                                             /* badan */
    s += crop(url, 44, 20, aw, 12, ra, 8) + crop(url, 36, 52, aw, 12, 12, 8);        /* lengan kanan & kiri */
    s += crop(url, 4, 36, 4, 12, 4, 20) + crop(url, 4, 52, 4, 12, 8, 20);           /* overlay celana */
    s += crop(url, 20, 36, 8, 12, 4, 8);                                             /* overlay jaket */
    s += crop(url, 44, 36, aw, 12, ra, 8) + crop(url, 52, 52, aw, 12, 12, 8);        /* overlay lengan */
    s += pngFaceLayers(url, 4, 0);                                                    /* kepala + overlay */
    return s;
  }

  /* slim: lengan 3 px (layer cadangan ikut selebar lengan texture agar tidak ada sisa 1 px yang mengintip) */
  function bodyRects(d, slim) {
    var b = d.body, s = '', aw = slim ? 3 : 4, ra = 4 - aw;
    s += rect(4, 20, 4, 12, b.pants) + rect(8, 20, 4, 12, b.pants) + rect(4, 29, 4, 3, b.shoe) + rect(8, 29, 4, 3, b.shoe);
    s += rect(4, 8, 8, 12, b.shirt) + rect(ra, 8, aw, 12, b.arm) + rect(12, 8, aw, 12, b.arm);
    s += rect(4, 19, 8, 1, 'rgba(0,0,0,.22)') + rect(7.9, 20, .2, 12, 'rgba(0,0,0,.25)');
    if (b.ribs) for (var r = 10; r < 19; r += 3) s += rect(5, r, 6, 1, b.ribs);
    s += rect(ra, 8, 1, 12, 'rgba(255,255,255,.15)') + rect(11 + aw, 8, 1, 12, 'rgba(0,0,0,.18)');
    return s;
  }
  function faceRects(d, ox) {
    var s = '';
    d.f.forEach(function (row, y) { for (var x = 0; x < 8; x++) s += rect((ox || 0) + x, y, 1, 1, d.p[row.charAt(x)] || '#000'); });
    return s;
  }

  /* Karakter voxel tampak depan (16x32 unit piksel) */
  /* Model karakter bersama (UT.CharacterData, sama dengan gameplay). Bila data/skrip tidak dimuat -> kembali ke gambar palet lama di bawah. */
  function sharedSvg(it, label, headOnly) {
    var CD = g.UT && g.UT.CharacterData; if (!CD || !CD.get('player', it.gameKey)) return '';
    var o = { label: label || it.name }, out = headOnly ? CD.face('player', it.gameKey, o) : CD.svg('player', it.gameKey, { view: 'front', label: o.label });
    return out ? out.replace('class="ut-char"', 'class="' + (headOnly ? 'art-face' : 'art-char') + ' ut-char"') : '';
  }
  function character(skinId, label) {
    var it = C.byId(skinId); if (!it || it.kind !== 'skin') return '';
    var shared = sharedSvg(it, label, false); if (shared) return shared;
    var d = faceData(it); if (!d) return '';
    var s = bodyRects(d, isPng(it) && it.arms === 'slim') + faceRects(d, 4);
    s += rect(4, 0, 8, 1, 'rgba(255,255,255,.18)') + rect(4, 7, 8, 1, 'rgba(0,0,0,.18)');
    if (pngReady(it)) s += pngBodyLayers(it, it.texture);
    return '<svg class="art-char' + (isPng(it) ? ' art-png' : '') + '" viewBox="0 0 16 32" shape-rendering="crispEdges" role="img" aria-label="' + (label || it.name) + '">' + s + '</svg>';
  }

  /* Wajah saja (untuk thumbnail kecil) */
  function face(skinId, label) {
    var it = C.byId(skinId); if (!it || it.kind !== 'skin') return '';
    var shared = sharedSvg(it, label, true); if (shared) return shared;
    var d = faceData(it); if (!d) return '';
    var s = faceRects(d, 0);
    if (pngReady(it)) s += pngFaceLayers(it.texture, 0, 0);
    return '<svg class="art-face' + (isPng(it) ? ' art-png' : '') + '" viewBox="0 0 8 8" shape-rendering="crispEdges" role="img" aria-label="' + (label || it.name) + '">' + s + '</svg>';
  }

  /* ---------- Validasi texture skin PNG (ringan, tidak pernah melempar error) ----------
     loadSkinTexture(id) -> Promise<{ok, id, usedId, fallback, reason?, texture?, image?, width?, height?}>
       - skin legacy (tanpa PNG)      : ok, fallback=false, texture=null
       - PNG ada, valid, dapat dimuat : ok, fallback=false, image = HTMLImageElement
       - PNG hilang/rusak/bukan PNG   : ok=false, fallback=true, usedId = skin cadangan
     Kepemilikan pemain TIDAK disentuh. Ukuran didukung: 64x64 (template Minecraft modern — satu-satunya hasil audit). */
  var texCache = {};
  var PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  function checkPngSignature(url) { /* true / false / null (tidak bisa dicek, mis. file://) */
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (buf) {
      if (!buf) return null;
      var b = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
      if (b.length < 8) return false;
      for (var i = 0; i < 8; i++) if (b[i] !== PNG_SIG[i]) return false;
      return true;
    }, function () { return null; });
  }
  function loadSkinTexture(skinId) {
    var it = C.byId(skinId), fb = C.fallbackSkinId();
    function bad(reason) {
      if (g.console && g.console.warn) g.console.warn('[ItemArt] texture skin ' + skinId + ' dipakai fallback (' + reason + ')');
      return { ok: false, id: skinId, usedId: fb, fallback: true, reason: reason };
    }
    if (!it || it.kind !== 'skin') return Promise.resolve(bad('bukan-skin'));
    if (it.renderer !== 'png') return Promise.resolve({ ok: true, id: skinId, usedId: skinId, fallback: false, texture: null });
    if (!it.textureValid) return Promise.resolve(bad('path-tidak-valid'));
    if (texCache[skinId]) return texCache[skinId];
    var p = new Promise(function (resolve) {
      if (typeof g.Image !== 'function') { resolve(bad('tanpa-image')); return; }
      var img = new g.Image(), done = false;
      function fin(v) { if (!done) { done = true; resolve(v); } }
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w !== 64 || h !== 64) { fin(bad('ukuran-tidak-didukung')); return; }
        checkPngSignature(it.texture).then(function (isPngFile) {
          if (isPngFile === false) fin(bad('bukan-png'));
          else fin({ ok: true, id: skinId, usedId: skinId, fallback: false, texture: it.texture, image: img, width: w, height: h });
        });
      };
      img.onerror = function () { fin(bad('gagal-dimuat')); };
      img.src = it.texture;
    });
    texCache[skinId] = p;
    return p;
  }
  /* Skin yang BOLEH dipakai renderer: id itu sendiri bila texture OK, selain itu skin cadangan. */
  function resolveSkinId(skinId) { return loadSkinTexture(skinId).then(function (r) { return r.usedId; }); }

  /* Untuk renderer three.js di tahap integrasi gameplay: texture pixel-art (nearest, tanpa mipmap). */
  function makeSkinTexture(THREE, image) {
    var t = new THREE.Texture(image);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }

  /* Dadu: muka angka 5 */
  function dice(itemId, label) {
    var it = C.byId(itemId); if (!it || it.kind !== 'dice') return '';
    var a = it.art, s = '';
    s += rect(4, 4, 56, 56, a.edge) + rect(8, 8, 48, 48, a.bg);
    s += rect(8, 8, 48, 4, 'rgba(255,255,255,.28)') + rect(8, 52, 48, 4, 'rgba(0,0,0,.18)');
    [[18, 18], [46, 18], [32, 32], [18, 46], [46, 46]].forEach(function (p) {
      s += '<rect x="' + (p[0] - 5) + '" y="' + (p[1] - 5) + '" width="10" height="10" fill="' + a.pip + '"/>';
    });
    return '<svg class="art-dice" viewBox="0 0 64 64" shape-rendering="crispEdges" role="img" aria-label="' + (label || it.name) + '">' + s + '</svg>';
  }

  /* Tema papan: langit + tanah blok */
  function theme(itemId, label) {
    var it = C.byId(itemId); if (!it || it.kind !== 'theme') return '';
    var a = it.art, id = 'sk-' + it.gameKey + '-' + Math.random().toString(36).slice(2, 7), s = '';
    s += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a.skyTop + '"/><stop offset="1" stop-color="' + a.skyBot + '"/></linearGradient></defs>';
    s += '<rect width="96" height="64" fill="url(#' + id + ')"/>';
    s += rect(66, 8, 12, 12, 'rgba(255,255,255,.75)');
    s += rect(0, 40, 96, 8, a.a) + rect(0, 48, 96, 16, a.b);
    for (var j = 0; j < 6; j++) s += rect(j * 16 + 7, 48, 1, 16, 'rgba(0,0,0,.2)');
    s += rect(0, 40, 96, 2, 'rgba(255,255,255,.22)') + rect(0, 56, 96, 1, 'rgba(0,0,0,.2)');
    s += rect(20, 30, 8, 10, '#6a4326') + rect(14, 20, 20, 12, 'rgba(0,0,0,.28)') + rect(14, 20, 20, 10, a.a);
    return '<svg class="art-theme" viewBox="0 0 96 64" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" role="img" aria-label="' + (label || it.name) + '">' + s + '</svg>';
  }

  /* Totem Undying (viewBox 500x500: gold, mata emerald, sayap, glow). Id gradient unik per render agar aman bila tampil berkali-kali.
     Visual sementara sesuai spesifikasi; ganti isi TOTEM_BODY dengan SVG final dari user (cukup isi di dalam <svg>, viewBox tetap 500x500). */
  function emeraldSvg(x,y,w,h){
    const sx=w/140,sy=h/161,s=Math.min(sx,sy);
    const dx=(w-140*s)/2,dy=(h-161*s)/2;
    return '<g transform="translate('+(x+dx)+','+(y+dy)+') scale('+s+') translate(-18,-34)">' +
      '<path d="M88 34 L158 74 L88 114 L18 74 Z" fill="#55E875"/>' +
      '<path d="M88 34 L158 74 L88 74 Z" fill="#8BEFA0"/>' +
      '<path d="M88 34 L88 74 L18 74 Z" fill="#42D960"/>' +
      '<path d="M88 74 L158 74 L88 114 Z" fill="#A2F2B0"/>' +
      '<path d="M88 74 L88 114 L18 74 Z" fill="#75DF8B"/>' +
      '<path d="M18 74 L88 114 L88 195 L18 155 Z" fill="#36B94F"/>' +
      '<path d="M18 74 L88 114 L88 160 L18 155 Z" fill="#3BC354"/>' +
      '<path d="M158 74 L88 114 L88 195 L158 155 Z" fill="#31C653"/>' +
      '<path d="M158 74 L88 114 L88 160 L158 155 Z" fill="#48D764"/>' +
      '<path d="M18 155 L88 195 L88 160 L18 121 Z" fill="#279743"/>' +
      '<path d="M158 155 L88 195 L88 160 L158 121 Z" fill="#269D43"/>' +
      '</g>';
  }
  var TOTEM_BODY =
    '<ellipse cx="250" cy="260" rx="190" ry="200" fill="url(#G_glow)"/>' +
    '<path d="M92 170 L20 120 L48 214 L28 290 L98 262 L128 300 L150 190 Z" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6" stroke-linejoin="round"/>' +
    '<path d="M408 170 L480 120 L452 214 L472 290 L402 262 L372 300 L350 190 Z" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6" stroke-linejoin="round"/>' +
    '<rect x="196" y="318" width="40" height="120" rx="8" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6"/>' +
    '<rect x="264" y="318" width="40" height="120" rx="8" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6"/>' +
    '<rect x="126" y="190" width="40" height="128" rx="8" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6"/>' +
    '<rect x="334" y="190" width="40" height="128" rx="8" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6"/>' +
    '<rect x="166" y="190" width="168" height="150" rx="14" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6"/>' +
    '<rect x="170" y="52" width="160" height="150" rx="18" fill="url(#G_gold)" stroke="#7a5a08" stroke-width="6"/>' +
    emeraldSvg(194,112,40,34) +
    emeraldSvg(266,112,40,34) +
    emeraldSvg(232,224,36,36);
  function totem(label) {
    var id = 'tt-' + Math.random().toString(36).slice(2, 7), b = TOTEM_BODY.replace(/G_(glow|gold|em)/g, id + '-$1');
    var defs = '<defs>' +
      '<radialGradient id="' + id + '-glow"><stop offset="0" stop-color="#ffe27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + '-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#f5c518"/><stop offset="1" stop-color="#b8860b"/></linearGradient>' +
      '<linearGradient id="' + id + '-em" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ff2a8"/><stop offset="1" stop-color="#0a9d5a"/></linearGradient></defs>';
    return '<svg class="art-powerup" viewBox="0 0 500 500" role="img" aria-label="' + label + '">' + defs + b + '</svg>';
  }

  /* Stage 4.1.19: ikon Power = gambar dari data/power (path dari katalog: it.icon). SVG blok di bawah (powerupSvg) dipertahankan
     sebagai cadangan: tersembunyi secara default (inline style, karena CSS halaman seperti svg{display:block} mengalahkan atribut display) dan baru ditampilkan bila gambar GAGAL dimuat (onerror), sehingga SVG lama tidak pernah
     terlihat selama gambar masih dimuat.
     Tetap berupa <svg> agar CSS ukuran existing (.th svg, #art svg) tetap berlaku. */
  function powerup(itemId, label) {
    var it = C.byId(itemId); if (!it || it.kind !== 'powerup') return '';
    var fb = powerupSvg(itemId, label);
    if (!it.icon || !fb) return fb;
    return '<svg class="art-powerup" viewBox="0 0 64 64" role="img" aria-label="' + (label || it.name) + '">' +
      fb.replace('<svg ', '<svg x="0" y="0" width="64" height="64" style="display:none" ') +
      '<image x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet" href="' + it.icon + '" ' +
      'onerror="this.style.display=\'none\';this.previousElementSibling.style.display=\'\'"/></svg>';
  }

  /* Power-Up (Tahap 3.1): ikon blok sederhana per gameplay key — kini cadangan bila gambar data/power gagal dimuat. */
  function powerupSvg(itemId, label) {
    var it = C.byId(itemId); if (!it || it.kind !== 'powerup') return '';
    var k = it.gameKey, s = '';
    if (k === 'sword') {
      s += rect(30, 6, 6, 34, '#cfd8e8') + rect(30, 6, 3, 34, '#f2f7ff') + rect(28, 4, 10, 4, '#e8eefc');
      s += rect(22, 40, 22, 5, '#c9a227') + rect(29, 45, 8, 6, '#8a5a2b') + rect(27, 51, 12, 5, '#6b431c');
    } else if (k === 'feather') {
      s += rect(28, 6, 10, 34, '#f4f9ff') + rect(24, 14, 6, 26, '#e2ecfb') + rect(36, 10, 6, 26, '#e2ecfb');
      s += rect(31, 40, 4, 18, '#b9c9e4') + rect(28, 6, 10, 6, '#cdddf5');
    } else if (k === 'tnt') {
      s += rect(10, 16, 44, 36, '#d63a2a') + rect(10, 16, 44, 8, '#e8564a') + rect(10, 30, 44, 8, '#ffffff');
      s += rect(16, 32, 6, 4, '#4a0d07') + rect(24, 32, 5, 4, '#4a0d07') + rect(31, 32, 6, 4, '#4a0d07') + rect(40, 32, 5, 4, '#4a0d07');
      s += rect(29, 8, 6, 8, '#8a5a2b') + rect(35, 4, 6, 4, '#ffb02e');
    } else if (k === 'totem') {
      return totem(label || it.name); /* fallback SVG Totem (dipakai hanya bila data/power/sm/totem.webp gagal dimuat) */
    } else if (k === 'potion_odd' || k === 'potion_even') {
      s += rect(26, 4, 12, 6, '#8a5a2b') + rect(24, 10, 16, 8, '#b9c9e4');
      s += rect(14, 18, 36, 38, '#dff3ff') + rect(14, 36, 36, 20, '#c04fd0') + rect(18, 40, 8, 6, '#e08ae8');
      s += rect(14, 18, 36, 4, '#f2fbff');
    } else { /* grass */
      s += rect(8, 24, 48, 32, '#9a6a3b') + rect(8, 24, 48, 12, '#5fae3e') + rect(8, 24, 48, 4, '#78d957');
      s += rect(14, 44, 8, 6, '#7a5230') + rect(34, 38, 10, 6, '#7a5230') + rect(24, 50, 8, 6, '#7a5230');
    }
    return '<svg class="art-powerup" viewBox="0 0 64 64" shape-rendering="crispEdges" role="img" aria-label="' + (label || it.name) + '">' + s + '</svg>';
  }

  /* Frame profil: gambar frame di atas wajah skin yang sedang dipakai (badan frame = 68% lebar gambar -> wajah inset 16%). */
  function frame(frameId, label) {
    var it = C.byId(frameId); if (!it || it.kind !== 'frame') return '';
    var skinId = (g.PlayerData && g.PlayerData.equippedId && g.PlayerData.equippedId('skin')) || C.fallbackSkinId();
    return '<div class="fr-th" role="img" aria-label="' + (label || it.name) + '"><span class="fr-in">' + face(skinId) + '</span>' +
      '<img class="fr-img" src="' + it.image + '" alt="" draggable="false" decoding="async"></div>';
  }

  /* Gambar utama kartu. variant: 'full' (karakter penuh) | 'face' */
  function forItem(itemId, variant) {
    var it = C.byId(itemId); if (!it) return '';
    if (it.kind === 'frame') return frame(itemId);
    if (it.kind === 'skin') return variant === 'face' ? face(itemId) : character(itemId);
    if (it.kind === 'dice') return dice(itemId);
    if (it.kind === 'theme') return theme(itemId);
    if (it.kind === 'powerup') return powerup(itemId);
    return '';
  }

  /* Palet warna karakter untuk renderer 3D halaman (lobby/shop/inventory/profile).
     Satu sumber warna skin: dibaca dari FACES katalog, bukan database warna kedua. */
  function palette(skinId) {
    var it = C.byId(skinId); if (!it || it.kind !== 'skin') return null;
    var d = faceData(it); if (!d) return null;
    var hairKey = d.f[0] ? d.f[0].charAt(0) : '';
    var pal = { gameKey: it.gameKey, hood: d.body.shirt, hair: d.p[hairKey] || d.body.shirt, pants: d.body.pants };
    /* Skin PNG: renderer 3D belum memakai texture (DEFERRED) -> palet skin cadangan; texture disertakan utk tahap berikut. */
    if (isPng(it)) { pal.png = true; pal.fallbackPalette = true; pal.texture = C.skinTexture(skinId); }
    return pal;
  }

  g.ItemArt = { character: character, face: face, frame: frame, dice: dice, theme: theme, powerup: powerup, forItem: forItem, palette: palette,
                textureUrl: textureUrl, loadSkinTexture: loadSkinTexture, resolveSkinId: resolveSkinId, makeSkinTexture: makeSkinTexture };
})(window);
