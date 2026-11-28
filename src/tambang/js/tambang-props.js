/* tambang-world: peti, kereta, rel, dekorasi — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 03 PROPS: peti, kereta, rel, objek tambang ============ */

/* ---------- PETI (6 jenis, geometri murni) ---------- */
MW.CHEST_TYPES = ['wooden', 'stone', 'crystal', 'deep', 'ancient', 'mystery'];
MW.CHEST_DEF = {
  wooden:  { base: 0x8a5a2b, lid: 0x9d6b36, band: 0x3a3a40, lock: 0xd9a63a },
  stone:   { base: 0x76767e, lid: 0x8d8d96, band: 0x55555d, lock: 0xbcbcc4 },
  crystal: { base: 0x3f5675, lid: 0x4f6a90, band: 0x26364c, lock: 0x66e0ff, glow: 0x33d6ff },
  deep:    { base: 0x41414b, lid: 0x50505c, band: 0x1f1f25, lock: 0xff7a2a, glow: 0xff5a1a },
  ancient: { base: 0x6f6a5c, lid: 0x837d6b, band: 0xd0a22a, lock: 0x2fd6c0 },
  mystery: { base: 0x54408a, lid: 0x6a52a8, band: 0x8a72d0, lock: 0x7de7ff, glow: 0xa05cff }
};
MW.makeChest = function (type) {
  const d = MW.CHEST_DEF[type], g = new THREE.Group();
  g.userData.kind = 'chest'; g.userData.type = type;
  MW.Bb(g, 1.1, 0.55, 0.8, d.base, 0, 0, 0);
  MW.Bb(g, 1.16, 0.3, 0.86, d.lid, 0, 0.55, 0);
  MW.Bb(g, 0.98, 0.12, 0.7, MW.shade(d.lid, 1.12), 0, 0.85, 0);
  [-0.36, 0.36].forEach(x => MW.Bb(g, 0.14, 0.97, 0.9, d.band, x, 0, 0));
  MW.B(g, 0.22, 0.26, 0.07, d.lock, 0, 0.55, 0.45);
  if (type === 'wooden') {
    MW.B(g, 1.0, 0.04, 0.82, 0x6b4220, 0, 0.28, 0.0);
    MW.B(g, 0.9, 0.04, 0.9, 0x6b4220, 0, 0.7, 0.0);
  } else if (type === 'stone') {
    MW.B(g, 0.3, 0.12, 0.3, 0x5f7f4a, -0.3, 0.92, 0.12);
    MW.B(g, 0.18, 0.1, 0.18, 0x6f9556, 0.35, 0.92, -0.1);
    MW.B(g, 0.32, 0.18, 0.06, 0x5c5c64, -0.03, 0.2, 0.42);
  } else if (type === 'crystal') {
    const gm = MW.glow(d.glow);
    [[-0.25, 0.5, 0.2], [0.05, 0.75, 0.3], [0.28, 0.45, -0.2]].forEach(c => {
      const m = new THREE.Mesh(MW.crystalGeo, new THREE.MeshStandardMaterial({ color: 0xaaf2ff, emissive: d.glow, emissiveIntensity: 0.8, flatShading: true, roughness: 0.55, metalness: 0 }));
      m.scale.set(0.28, c[1], 0.28); m.position.set(c[0], 0.9, c[2]); m.rotation.z = c[0] * 0.8; g.add(m);
    });
    MW.B(g, 0.8, 0.05, 0.02, gm, 0, 0.2, 0.41);
  } else if (type === 'deep') {
    const gm = MW.glow(0xff7a2a);
    MW.B(g, 0.28, 0.05, 0.02, gm, -0.12, 0.38, 0.41); MW.B(g, 0.05, 0.22, 0.02, gm, 0.02, 0.27, 0.41);
    MW.B(g, 0.26, 0.05, 0.02, gm, 0.15, 0.15, 0.41);
    MW.B(g, 0.16, 0.1, 0.16, 0xff5a1a, 0.38, 0.95, -0.15, 0).material = MW.glow(0xff6a22);
  } else if (type === 'ancient') {
    [[-0.52, 0.05], [0.52, 0.05], [-0.52, 0.8], [0.52, 0.8]].forEach(c => MW.B(g, 0.12, 0.12, 0.12, 0xd0a22a, c[0], c[1] + 0.1, 0.44));
    MW.B(g, 0.14, 0.14, 0.04, MW.glow(0x2fd6c0), 0, 0.55, 0.5);
    for (let i = 0; i < 3; i++) MW.B(g, 0.1, 0.03, 0.02, 0x3d3a30, -0.2 + i * 0.2, 0.18, 0.41);
  } else if (type === 'mystery') {
    const gm = MW.glow(0x7de7ff);
    for (let i = 0; i < 5; i++) MW.B(g, 0.07, 0.07 + (i % 2) * 0.08, 0.02, gm, -0.22 + i * 0.11, 0.22, 0.41);
    const orb = MW.B(g, 0.24, 0.24, 0.24, MW.glow(0xb97bff), 0, 1.3, 0);
    g.userData.update = function (t) { orb.position.y = 1.3 + Math.sin(t * 2) * 0.1; orb.rotation.y = t; orb.rotation.z = t * 0.7; };
  }
  g.userData.pop = 0;
  return g;
};

/* ---------- KERETA TAMBANG & REL ---------- */
MW.makeCart = function (theme) {
  const g = new THREE.Group(); g.userData.kind = 'cart';
  const body = 0x5a5f69, rim = 0x2f3239, iron = 0x24262b;
  MW.Bb(g, 1.5, 0.14, 0.78, rim, 0, 0.3, 0);
  MW.Bb(g, 1.6, 0.58, 0.12, body, 0, 0.3, 0.4);
  MW.Bb(g, 1.6, 0.58, 0.12, body, 0, 0.3, -0.4);
  MW.Bb(g, 0.12, 0.58, 0.78, body, 0.74, 0.3, 0);
  MW.Bb(g, 0.12, 0.58, 0.78, body, -0.74, 0.3, 0);
  MW.Bb(g, 1.68, 0.09, 0.2, rim, 0, 0.88, 0.4);
  MW.Bb(g, 1.68, 0.09, 0.2, rim, 0, 0.88, -0.4);
  [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]].forEach(p => MW.Bb(g, 0.1, 0.22, 0.08, iron, p[0], 0.1, p[1] * 0.82));
  g.userData.wheels = [];
  [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]].forEach(p => {
    const w = new THREE.Mesh(MW.unitCyl, MW.M(0x1a1b1f));
    w.rotation.x = Math.PI / 2; w.scale.set(0.42, 0.1, 0.42); w.position.set(p[0], 0.22, p[1] * 0.8);
    g.add(w); g.userData.wheels.push(w);
    const hub = MW.B(g, 0.1, 0.1, 0.12, 0x9a9aa2, p[0], 0.22, p[1] * 0.86);
  });
  /* muatan sesuai tema */
  const load = { stone: [0x8d8d96, 0x6f6f78], crystal: [0x4ddcff, 0x2a9de0], deep: [0xff7a2a, 0xd24a1a], ancient: [0xf2c230, 0x2fd6c0], surface: [0x8d8d96, 0x7a5a38], mystery: [0xb97bff, 0x5fd8ff] }[theme] || [0x8d8d96, 0x6f6f78];
  const glowy = theme === 'crystal' || theme === 'deep' || theme === 'ancient' || theme === 'mystery';
  for (let i = 0; i < 6; i++) {
    const s = 0.28 + (i % 3) * 0.06, c = load[i % 2];
    const m = MW.B(g, s, s * 0.9, s, glowy && i % 2 === 0 ? MW.glow(c) : MW.M(c), -0.5 + (i % 3) * 0.5, 0.95 + (i > 2 ? 0.2 : 0), (i % 2) * 0.2 - 0.1);
    m.rotation.y = i * 0.7; m.rotation.z = (i % 3 - 1) * 0.2;
  }
  return g;
};
/* Rel: dua batang besi + bantalan kayu (InstancedMesh) */
MW.makeRail = function (x0, x1, floorY) {
  const g = new THREE.Group(); g.name = 'Rail'; g.position.set(0, floorY, 0);
  const len = x1 - x0, cx = (x0 + x1) / 2;
  MW.Bb(g, len, 0.07, 0.09, 0x7d828c, cx, 0.08, 0.4);
  MW.Bb(g, len, 0.07, 0.09, 0x7d828c, cx, 0.08, -0.4);
  const sl = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (let x = x0 + 0.2; x < x1; x += 0.55) sl.add(x, 0.04, 0, 0.18, 0.08, 1.0, 0x6b4220);
  sl.build(g, 'Sleepers');
  MW.Bb(g, 0.3, 0.5, 0.9, 0x3a3a40, x0 - 0.15, 0, 0);          // buffer stop
  MW.Bb(g, 0.3, 0.5, 0.9, 0x3a3a40, x1 + 0.15, 0, 0);
  return g;
};

/* ---------- OBJEK PENDUKUNG (dekorasi & mineral) ---------- */
MW.makeDecor = function (kind) {
  const g = new THREE.Group(); g.userData.kind = 'decor'; g.userData.type = kind;
  if (kind === 'torch') {
    MW.Bb(g, 0.14, 1.2, 0.14, 0x6b4220, 0, 0, 0);
    MW.Bb(g, 0.26, 0.12, 0.26, 0x3a3a40, 0, 1.1, 0);
    const f = MW.B(g, 0.22, 0.34, 0.22, MW.glow(0xffa630), 0, 1.4, 0);
    const f2 = MW.B(g, 0.12, 0.22, 0.12, MW.glow(0xffe08a), 0, 1.45, 0);
    g.userData.update = function (t) { const s = 1 + Math.sin(t * 13 + g.position.x) * 0.12; f.scale.y = 0.34 * s; f2.scale.y = 0.22 * s; };
  } else if (kind === 'crates') {
    MW.Bb(g, 0.7, 0.7, 0.7, 0x8a5a2b, -0.4, 0, 0); MW.Bb(g, 0.7, 0.7, 0.7, 0x96622f, 0.4, 0, 0.05);
    MW.Bb(g, 0.6, 0.6, 0.6, 0x7c5126, 0, 0.7, 0);
    [-0.4, 0.4].forEach(x => MW.B(g, 0.74, 0.06, 0.74, 0x5a3818, x, 0.35, 0.02));
  } else if (kind === 'lantern') {
    MW.Bb(g, 0.1, 1.0, 0.1, 0x3a3a40, 0, 0, 0);
    MW.Bb(g, 0.34, 0.06, 0.34, 0x24262b, 0, 1.0, 0);
    MW.B(g, 0.26, 0.3, 0.26, MW.glow(0xffd36a), 0, 1.2, 0);
    MW.Bb(g, 0.38, 0.06, 0.38, 0x24262b, 0, 1.35, 0);
  } else {                                   // rocks
    [[0, 0.35, 0.5], [0.5, 0.25, 0.4], [-0.45, 0.2, 0.34]].forEach((s, i) => { const m = MW.Bb(g, s[2], s[1], s[2] * 0.9, [0x8d8d96, 0x777780, 0x6a6a72][i], s[0], 0, 0); m.rotation.y = i * 0.6; });
  }
  return g;
};
MW.MINERAL_KIND = ['coal', 'gold', 'crystal', 'ember', 'relic', 'violet'];
MW.makeMineral = function (layer) {
  const g = new THREE.Group(); g.userData.kind = 'mineral';
  const k = MW.MINERAL_KIND[layer];
  const mk = (c) => MW.glow(c);
  if (k === 'coal') { [[0, 0.3, 0.55], [0.45, 0.2, 0.4]].forEach(s => MW.Bb(g, s[2], s[1], s[2], 0x2a2a2e, s[0], 0, 0)); MW.B(g, 0.1, 0.1, 0.04, 0x6a6a72, 0.1, 0.25, 0.3); }
  else if (k === 'gold') { MW.Bb(g, 0.7, 0.45, 0.6, 0x7e7e86, 0, 0, 0); for (let i = 0; i < 4; i++) MW.B(g, 0.16, 0.12, 0.05, mk(0xffc928), -0.25 + i * 0.17, 0.12 + (i % 2) * 0.17, 0.31); }
  else if (k === 'ember') { MW.Bb(g, 0.7, 0.45, 0.6, 0x2c2c32, 0, 0, 0); for (let i = 0; i < 4; i++) MW.B(g, 0.15, 0.12, 0.05, mk(0xff7a2a), -0.25 + i * 0.17, 0.12 + (i % 2) * 0.17, 0.31); }
  else if (k === 'relic') { MW.Bb(g, 0.7, 0.45, 0.6, 0x6f6a5c, 0, 0, 0); MW.B(g, 0.18, 0.14, 0.05, mk(0xffc928), -0.15, 0.2, 0.31); MW.B(g, 0.18, 0.14, 0.05, mk(0x2fd6c0), 0.15, 0.3, 0.31); }
  else {
    const col = k === 'crystal' ? 0x33d6ff : 0xa05cff;
    [[-0.2, 0.9, 0.3], [0.05, 1.3, 0.38], [0.3, 0.7, 0.28]].forEach((c, i) => {
      const m = new THREE.Mesh(MW.crystalGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: col, emissiveIntensity: 0.8, flatShading: true, roughness: 0.55, metalness: 0 }));
      m.scale.set(c[2], c[1], c[2]); m.position.set(c[0], 0, 0); m.rotation.z = (i - 1) * 0.25; g.add(m);
    });
  }
  g.userData.type = k;
  return g;
};
/* simpul tambang: batu yang dipukul pekerja */
MW.makeOreNode = function (layer) {
  const g = new THREE.Group(); g.userData.kind = 'node';
  const stone = [0x8d8d96, 0x7a7a82, 0x6a6a72, 0x5c5c66, 0x3c3c44, 0x6f6a5c][layer] || 0x777780;
  const spec = [0x6b6b72, 0xffc928, 0x33d6ff, 0xff7a2a, 0xffc928, 0xa05cff][layer];
  MW.Bb(g, 0.9, 0.7, 0.7, stone, 0, 0, 0);
  MW.Bb(g, 0.55, 0.5, 0.55, MW.shade(stone, 1.15), 0.1, 0.7, 0);
  for (let i = 0; i < 4; i++) MW.B(g, 0.14, 0.12, 0.05, MW.glow(spec), -0.28 + i * 0.2, 0.2 + (i % 2) * 0.28, 0.36);
  return g;
};
})();
