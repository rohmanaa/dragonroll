/* Ular Tangga Blok — data/inventory/character/_shared/js/character-data.js
   DATA KARAKTER BERSAMA (voxel) — satu sumber detail model karakter & mob gameplay, untuk dipakai halaman mana pun
   (lobby, leaderboard, profil, shop, inventory, dll). Skrip klasik (tanpa import/export), global: UT.CharacterData.
   - Data di bawah diekstrak apa adanya dari src/gameplay/js/main.js (makePawn / addCreeper / addEnderman / addSkeleton / addZombie /
     addWarden / addVillager / addBlaze / makeHostile) oleh tools/character-data/build.js (jalankan ulang bila model Gameplay berubah).
   - Satu box = [x, y, z, w, h, d, '#rrggbb', noEdge, tag]. Pusat box; satuan dunia gameplay; dasar kaki di y=0;
     karakter menghadap +z; kanan karakter = -x. noEdge=1: detail tanpa garis tepi (mata, mulut, dll).
     tag: 0 biasa | 2 batang Blaze (berputar di gameplay) | 3 blok kepala 0.3 (di gameplay = 27 kubus 0.1 dengan variasi warna 0.09).
   - Grup: 'player' (skin palette gameplay), 'mob' (mob di petak papan), 'wild' (mob liar di luar papan, mis. Golem).
   - Skin PNG (hero, knight, ...) memakai tekstur: lihat ItemArt.character()/face() (src/renderers/item-art.js). Di sini hanya
     metadata + fallback ke 'steve'.
   API:
     UT.CharacterData.list(group)                 -> ['steve', ...]
     UT.CharacterData.get(group, key)             -> {group,key,name,hex,css,boxes,bounds,rig?,png?,fallback?}
     UT.CharacterData.svg(group, key, opts)       -> string SVG (opts: view 'front'|'iso'|'back'|'side', yaw, pitch, bust, size, edge, label)
     UT.CharacterData.face(group, key, opts)      -> SVG kepala saja (depan)
     UT.CharacterData.mesh(THREE, group, key, o)  -> THREE.Group (satu mesh, vertex color); o.scale, o.dither (default true)
     UT.CharacterRigAdapter.resolve(key)           -> validasi definisi rig CharacterData tanpa membuat mesh
     UT.CharacterRigAdapter.create(THREE, key, opts) -> rig ber-pivot; fallback hanya bila opts.fallbackKey dinyatakan
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
              rig: m.rig || null,
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

  function cloneMetadata(value) { return JSON.parse(JSON.stringify(value)); }
  function vector3(value) {
    return Array.isArray(value) && value.length === 3 && value.every(function (n) { return typeof n === 'number' && isFinite(n); });
  }
  function validateRigDefinition(d) {
    var errors = [], rig = d && d.rig, seen = {};
    if (!rig || rig.baseModelKey !== d.key) return ['baseModelKey or rig metadata missing'];
    if (!rig.parts || !Object.keys(rig.parts).length) return ['parts missing'];
    Object.keys(rig.parts).forEach(function (name) {
      var part = rig.parts[name];
      if (!Array.isArray(part.boxIndices) || !part.boxIndices.length) errors.push('parts.' + name + '.boxIndices missing');
      if (!vector3(part.pivot)) errors.push('parts.' + name + '.pivot invalid');
      (part.boxIndices || []).forEach(function (index) {
        if (typeof index !== 'number' || index % 1 || index < 0 || index >= d.boxes.length) errors.push('parts.' + name + '.box index invalid');
        else if (seen[index]) errors.push('box index duplicated: ' + index);
        else seen[index] = true;
      });
    });
    for (var i = 0; i < d.boxes.length; i++) if (!seen[i]) errors.push('box index unmapped: ' + i);
    ['head', 'torso', 'back'].forEach(function (name) {
      if (!rig.anchors || !vector3(rig.anchors[name])) errors.push('anchors.' + name + ' invalid');
    });
    if (!rig.capabilities || !rig.capabilities.locomotion || !rig.capabilities.locomotion.gait ||
        !rig.capabilities.actionRig || typeof rig.capabilities.actionRig.handAnchors !== 'boolean') errors.push('capabilities invalid');
    if (!rig.gearConstraints || !Array.isArray(rig.gearConstraints.availableAnchors)) errors.push('gearConstraints invalid');
    else rig.gearConstraints.availableAnchors.forEach(function (name) {
      if (!rig.anchors || !vector3(rig.anchors[name])) errors.push('gear anchor missing: ' + name);
    });
    if (rig.anchors) Object.keys(rig.anchors).forEach(function (name) {
      if (!vector3(rig.anchors[name])) errors.push('anchors.' + name + ' invalid');
    });
    return errors;
  }
  function resolveRig(baseModelKey) {
    var d = get('player', baseModelKey);
    if (!d) return { ok: false, reason: 'unknown-model', baseModelKey: baseModelKey };
    if (!d.rig) return { ok: false, reason: 'rig-unavailable', baseModelKey: baseModelKey };
    var errors = validateRigDefinition(d);
    if (errors.length) return { ok: false, reason: 'invalid-rig', baseModelKey: baseModelKey, errors: errors };
    return {
      ok: true, baseModelKey: d.rig.baseModelKey, type: d.rig.type,
      definition: cloneMetadata(d.rig), bounds: cloneMetadata(d.bounds), boxCount: d.boxes.length
    };
  }
  function partBounds(boxes) {
    var b = bounds(boxes);
    var min = [b.minX, b.minY, b.minZ], max = [b.maxX, b.maxY, b.maxZ];
    return { min: min, max: max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
  }
  function createRig(THREE, baseModelKey, opts) {
    opts = opts || {};
    var requestedModelKey = baseModelKey, result = resolveRig(baseModelKey), fallback = null;
    if (!result.ok && opts.fallbackKey) {
      var reason = result.reason, fallbackResult = resolveRig(opts.fallbackKey);
      if (!fallbackResult.ok) return { ok: false, reason: 'invalid-fallback', baseModelKey: requestedModelKey, fallbackKey: opts.fallbackKey, fallbackReason: fallbackResult.reason };
      result = fallbackResult;
      fallback = { requestedModelKey: requestedModelKey, usedModelKey: result.baseModelKey, reason: reason };
    }
    if (!result.ok) return result;
    if (!THREE || typeof THREE.Group !== 'function') return { ok: false, reason: 'three-unavailable', baseModelKey: result.baseModelKey };

    var d = get('player', result.baseModelKey), definition = result.definition;
    var root = new THREE.Group(), parts = {}, disposed = false;
    root.name = 'character-base-' + result.baseModelKey;

    function dispose() {
      if (disposed) return;
      root.traverse(function (object) {
        if (object.geometry && object.geometry.dispose) object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach(function (material) { if (material && material.dispose) material.dispose(); });
        else if (object.material && object.material.dispose) object.material.dispose();
      });
      while (root.children.length) root.remove(root.children[0]);
      disposed = true;
    }

    var partNames = Object.keys(definition.parts);
    for (var i = 0; i < partNames.length; i++) {
      var name = partNames[i], part = definition.parts[name];
      var boxes = part.boxIndices.map(function (index) { return d.boxes[index]; });
      var extent = partBounds(boxes), pivot = part.pivot;
      var node = new THREE.Group();
      node.name = name;
      node.position.set(pivot[0], pivot[1], pivot[2]);
      var geometryGroup = mesh(THREE, 'player', result.baseModelKey, { boxes: boxes, dither: opts.dither });
      if (!geometryGroup) {
        dispose();
        return { ok: false, reason: 'geometry-unavailable', baseModelKey: result.baseModelKey, part: name };
      }
      geometryGroup.position.set(-pivot[0], -pivot[1], -pivot[2]);
      node.add(geometryGroup);
      root.add(node);
      parts[name] = { node: node, boxIndices: part.boxIndices.slice(), pivot: pivot.slice(), bounds: extent, size: extent.size.slice() };
    }
    root.userData.characterRig = { baseModelKey: result.baseModelKey, type: result.type, partNames: partNames.slice() };
    return {
      ok: true, requestedModelKey: requestedModelKey, baseModelKey: result.baseModelKey, type: result.type,
      root: root, parts: parts, anchors: cloneMetadata(definition.anchors),
      capabilities: cloneMetadata(definition.capabilities), gearConstraints: cloneMetadata(definition.gearConstraints),
      bounds: result.bounds, fallback: fallback, dispose: dispose
    };
  }

  UT.CharacterData = { version: 1, list: list, get: get, svg: svg, face: face, mesh: mesh, SEATS: SEATS, groups: Object.keys(META) };
  UT.CharacterRigAdapter = { resolve: resolveRig, create: createRig };
})(window);


