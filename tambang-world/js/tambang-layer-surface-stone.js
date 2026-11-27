/* tambang-world: layer 1-2 + builder layer — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 05 LAYERS (A): kerangka umum, slot, partikel, Layer 1-2 ============ */
MW.LCFG = [
  { // 1 SURFACE
    key: 'surface', stone: [0x8b8b92, 0x84848c, 0x7c7c85], back: 0x4a4a52, shaftBack: 0x18181d, dash: 0xa6a6ac, sky: true,
    pick: (x, y, R) => y >= 7 ? [0x7a4b27, 0x84552e, 0x6f4422][Math.floor(R() * 3)] : [0x8b8b92, 0x84848c, 0x7c7c85][Math.floor(R() * 3)],
    ores: [{ color: 0x5a5a62, n: 8, near: false }],
    ambient: [0xffffff, 0.95], dir: 0.55, light: null
  },
  { // 2 STONE
    key: 'stone', stone: [0x8b8b90, 0x85858b, 0x7e7e86], back: 0x3d3d45, shaftBack: 0x16161b, dash: 0xa8a8a0,
    patches: [[6, 13, 4, 3, 0x8a5a2e], [17, 15, 3, 2, 0x8a5a2e], [29, 12, 3, 3, 0x8a5a2e], [0, 6, 1, 3, 0x8a5a2e], [10, 0, 4, 1, 0x8a5a2e]],
    ores: [{ color: 0xffc928, n: 9, near: true }, { color: 0x2a2a30, n: 10, near: true }, { color: 0xc4ccd8, n: 8, near: true }],
    ambient: [0xffe3c0, 0.7], dir: 0.35, light: { color: 0xffb25a, i: 1.0, d: 34 }
  },
  { // 3 CRYSTAL
    key: 'crystal', stone: [0x465267, 0x404c60, 0x3a465a], back: 0x1c2636, shaftBack: 0x0f121a, dash: 0x6c7f99,
    ores: [{ color: 0x4dd8ff, n: 14, near: true }, { color: 0xffc928, n: 6, near: true }],
    ambient: [0x9ec0ff, 0.5], dir: 0.2, light: { color: 0x3fc8ff, i: 1.4, d: 36 }
  },
  { // 4 DEEP
    key: 'deep', stone: [0x37373e, 0x303037, 0x3d3d45], back: 0x1b1b20, shaftBack: 0x0d0d10, dash: 0x585860,
    patches: [[8, 12, 5, 3, 0x4a2a22], [24, 6, 3, 2, 0x4a2a22]],
    ores: [{ color: 0xff7a2a, n: 16, near: true }, { color: 0xff4a3a, n: 6, near: true }],
    ambient: [0xb09090, 0.42], dir: 0.18, light: { color: 0xff6a2a, i: 1.5, d: 36 }
  },
  { // 5 ANCIENT
    key: 'ancient', stone: [0x3b3e48, 0x373a44, 0x31343e], back: 0x1b1d24, shaftBack: 0x0d0e12, dash: 0x5d6068,
    patches: [[6, 13, 4, 3, 0x5a3a2c], [24, 11, 5, 3, 0x5a3a2c], [0, 8, 1, 3, 0x5a3a2c]],
    ores: [{ color: 0xffc928, n: 16, near: true }, { color: 0x2fd6c0, n: 12, near: true }],
    ambient: [0xd8c8a0, 0.48], dir: 0.18, light: { color: 0xffd078, i: 1.4, d: 36 }
  },
  { // 6 COMING SOON
    key: 'mystery', stone: [0x26232f, 0x221f2c, 0x2b2837], back: 0x1a1530, shaftBack: 0x09080e, dash: 0x453f58,
    ores: [{ color: 0xa05cff, n: 12, near: true }, { color: 0x4dd8ff, n: 8, near: true }],
    ambient: [0xa090d8, 0.5], dir: 0.15, light: { color: 0x9a6cff, i: 1.6, d: 38 },
    backTint: (x, y) => x > 25 ? Math.max(0.5, 1 - (x - 25) * 0.07) : 1
  }
];
/* rel per layer: [x0,x1] */
MW.RAILS = [null, [9.5, 22.6], [9.5, 22.6], [9.5, 22.6], [9.5, 22.6], null];   /* rel sampai belakang penambang (tumpukan batu) */

/* ---- slot template: tipe, x, opsi. z & lantai diisi otomatis ---- */
MW.slotDefs = function (i) {
  const s = [];
  const add = (type, x, o) => s.push(Object.assign({ type: type, x: x }, o || {}));
  if (i === 0) return s;   // layer 0 = Base Camp (Hutan + Tungku + Gudang), tanpa slot tambang
  add('chest', 7.2, { fill: true });
  add('decor', 8.6, { fill: 'torch' });
  add('cartRail', 11.0, { fill: true, track: MW.RAILS[i], pusher: true });
  add('mineral', 21.0);   /* tidak diisi: jalur cart sampai tumpukan batu */
  add('decor', 22.3);
  add('chest', 23.7);
  if (i === 2) add('grabber', 25.5, { fill: true, face: 1 });
  else add('mining', 25.5, { fill: true, face: 1 });
  add('chest', i === 5 ? 27.0 : 27.9, { fill: true });
  add('worker', i === 5 ? 24.0 : 30.2, i === 4 ? { fill: 'walk', range: [29.2, 30.9] } : {});
  return s;
};

/* ---- partikel kecil per layer ---- */
MW.makeParticles = function (n, b, color, mode, size) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), v = new Float32Array(n);
  for (let k = 0; k < n; k++) { pos[k * 3] = b.x0 + Math.random() * (b.x1 - b.x0); pos[k * 3 + 1] = b.y0 + Math.random() * (b.y1 - b.y0); pos[k * 3 + 2] = b.z0 + Math.random() * (b.z1 - b.z0); v[k] = 0.2 + Math.random() * 0.6; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: color, size: size || 3, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.name = 'Particles';
  pts.userData.update = function (t, dt) {
    const a = geo.attributes.position.array;
    for (let k = 0; k < n; k++) {
      let x = a[k * 3], y = a[k * 3 + 1];
      if (mode === 'rise') { y += v[k] * dt * 1.4; x += Math.sin(t * 1.3 + k) * dt * 0.25; }
      else if (mode === 'float') { y += Math.sin(t * 0.8 + k * 1.7) * dt * 0.35; x += Math.cos(t * 0.6 + k) * dt * 0.3; }
      else { y += v[k] * dt * 0.25; x += Math.sin(t * 0.5 + k) * dt * 0.15; }
      if (y > b.y1) y = b.y0; if (y < b.y0) y = b.y1;
      if (x > b.x1) x = b.x0; if (x < b.x0) x = b.x1;
      a[k * 3] = x; a[k * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = mode === 'twinkle' ? 0.6 + 0.35 * Math.sin(t * 3) : 0.85;
  };
  return pts;
};

/* formasi batu di dinding belakang (bertingkat, mengerucut ke atas) */
MW.formation = function (b, x, w, h, floorY, color, R, z, d) {
  for (let k = 0; k < h; k++) {
    const ww = Math.max(1, w - Math.floor(k * (0.55 + R() * 0.2)));
    b.add(x + (R() - 0.5) * 0.3, floorY + k + 0.5, z === undefined ? -0.72 : z, ww, 1, d || 0.5, MW.shade(color, 0.85 + R() * 0.3));
  }
};

/* ---- kerangka umum satu layer ---- */
MW.buildLayer = function (i) {
  const H = MW.H, W = MW.W, cfg = MW.LCFG[i], R = MW.rng(100 + i * 31);
  const g = new THREE.Group(); g.name = 'Layer' + (i + 1) + '_' + ['BaseCamp', 'StoneMine', 'CrystalMine', 'DeepMine', 'AncientMine', 'ComingSoon'][i];
  g.position.y = -i * H;
  const sub = {};
  ['Decorations', 'Workers', 'Chests', 'Carts', 'Minerals', 'Nodes', 'MiningRails', 'Buildings'].forEach(n => { sub[n] = new THREE.Group(); sub[n].name = n; g.add(sub[n]); });
  const grid = MW.makeGrid();
  /* shaft & rongga */
  MW.carve(grid, MW.SHAFT.x0, MW.SHAFT.x1 - 1, 0, H - 1);
  let ceil = null;
  if (i === 0) {
    MW.carve(grid, 0, W - 1, MW.GROUND, H - 1);
  } else {
    const lo = [0, 9, 10, 9, 10, 10][i], hi = [0, 12, 13, 13, 13, 13][i];
    ceil = MW.ceilProfile(500 + i * 17, 5, 31, lo, hi, 3, 6);
    for (let x = 5; x <= 31; x++) MW.carve(grid, x, x, MW.FLOOR, ceil[x] - 1);
    if (i === 5) { MW.carve(grid, 28, 31, 0, 2); }
  }
  const info = MW.buildVoxels(i, g, grid, cfg, 900 + i);
  /* garis strata batas layer */
  if (i > 0) { const m = MW.B(g, W - 5.2, 0.12, 0.05, MW.glow(MW.shade([0, 0x6b6b72, 0x3fa8d6, 0xb0502a, 0xb89a3a, 0x7b52c8][i], 0.7)), 5.2 + (W - 5.2) / 2, H - 0.06, 1.03); }
  /* kusen lift di tiap lantai */
  MW.liftOpening(g, MW.stopY[i], i === 3 ? 0x7a4b24 : 0x8a5a2b, 5.0);
  /* rel */
  if (MW.RAILS[i]) sub.MiningRails.add(MW.makeRail(MW.RAILS[i][0], MW.RAILS[i][1], MW.FLOOR + (i === 0 ? MW.GROUND - MW.FLOOR : 0)));
  const L = { index: i, group: g, sub: sub, grid: grid, ceil: ceil, cfg: cfg, R: R, fx: [], anim: [], slotDefs: MW.slotDefs(i), pulse: [] };
  return L;
};
})();
