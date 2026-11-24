/* tambang-world: layer 5-6 — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 07 LAYERS (C): Crystal, Deep, Ancient, Coming Soon ============ */
MW.crystalField = function (L, o) {
  const R = L.R, cb = MW.crystalBuilder(o.emissive, 0.8), b = cb.b;
  o.hang.forEach(x => { const cy = L.ceil[Math.floor(x)]; MW.crystalCluster(b, x, cy + 0.02, -0.15 + R() * 0.5, -1, 2 + Math.floor(R() * 3), o.palette, o.hs, R); });
  o.floor.forEach(x => MW.crystalCluster(b, x, MW.FLOOR, -0.85 + R() * 0.25, 1, 3, o.palette, o.fs, R));
  b.build(L.group, 'Crystals');
  L.pulse.push(function (t) { cb.mat.emissiveIntensity = 0.65 + Math.sin(t * 1.6) * 0.18; });
  L.fx.push(L.group.add(MW.makeParticles(o.pn || 60, { x0: 5.5, x1: 31, y0: 3.5, y1: 10, z0: -0.5, z1: 0.9 }, o.pc, 'twinkle', 3)) && L.group.children[L.group.children.length - 1]);
};

/* ---------------- LAYER 3: CRYSTAL ---------------- */
MW.decor[2] = function (L) {
  MW.frames(L, [[13.5, 3.0, 5.4], [17.9, 2.8, 5.0]], { wood: 0x6b4a2a, dark: 0x57391f, stone: 0x3d4656 });
  MW.stalactites(L, 0x4a566c, 9);
  MW.backFormations(L, [[11.5, 4, 5], [20, 5, 5], [28, 3, 4]], 0x2b3647);
  MW.crystalField(L, { emissive: 0x1aa6d6, palette: [0x7fe6ff, 0x4dd0ff, 0x35b4f0, 0x66f0d8], hang: [7.5, 10.5, 14.5, 18.5, 22, 25.5, 29], floor: [9.2, 13.2, 16.6, 22.8, 26.6, 29.6], hs: 1.1, fs: 1.2, pc: 0x8fe9ff });
  MW.rubble(L.group, L.grid, 6, 31, MW.FLOOR, 0x4a566c, 12, 88, -0.95, -0.3);
};

/* ---------------- LAYER 4: DEEP ---------------- */
MW.decor[3] = function (L) {
  MW.frames(L, [[13.5, 3.2, 5.6], [18.0, 3.0, 5.4]], { wood: 0x6a4425, dark: 0x4f3219, stone: 0x2c2c32, post: 0.62 });
  MW.stalactites(L, 0x2a2a30, 12);
  MW.backFormations(L, [[10.5, 5, 6], [20, 6, 7], [28, 4, 5]], 0x25252b);
  const m1 = MW.cracks(L.group, L.grid, 6, 0xff5a1a, 0xffc060, 31, 11.0, 16.8, 5.6, 31.5);
  const m2 = MW.cracks(L.group, L.grid, 3, 0xff5a1a, 0xffb050, 47, 0.6, 2.6, 6, 31.5);
  L.pulse.push(function (t) { const k = 0.75 + Math.sin(t * 1.4) * 0.2 + Math.sin(t * 4.1) * 0.05; if (m1) m1.color.setScalar(k); if (m2) m2.color.setScalar(k); });
  MW.rubble(L.group, L.grid, 6, 31, MW.FLOOR, 0x3d3d45, 14, 99, -0.95, -0.3);
  MW.rubble(L.group, L.grid, 6, 31, MW.FLOOR, 0xd25a22, 6, 98, -0.95, -0.6);
  L.group.add(MW.makeParticles(40, { x0: 5.5, x1: 31, y0: 3.2, y1: 12, z0: -0.5, z1: 0.9 }, 0xff8a3a, 'rise', 2));
  L.fx.push(L.group.children[L.group.children.length - 1]);
  L.flicker = 0.08;
};

/* ---------------- LAYER 5: ANCIENT ---------------- */
MW.ruinPillar = function (b, x, h, broken, R) {
  const z = -0.75, F = MW.FLOOR;
  b.add(x, F + 0.2, z, 1.3, 0.4, 0.8, 0x8a8a78);
  for (let k = 0; k < h; k++) b.add(x, F + 0.4 + k + 0.5, z, 0.95, 1, 0.55, MW.shade(R() < 0.3 ? 0x7d8a6a : 0x8e8e7c, 0.9 + R() * 0.2));
  if (broken) b.add(x + 0.25, F + 0.4 + h + 0.2, z, 0.55, 0.45, 0.5, 0x8e8e7c, 0, 0.3, 0.4);
  else b.add(x, F + 0.4 + h + 0.15, z, 1.2, 0.3, 0.75, 0x9a9a88);
};
MW.glyph = function (b, x, y, z, seed, color) {
  const R = MW.rng(seed);
  for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 5; gy++) if (R() < 0.55) b.add(x + gx * 0.2 - 0.3, y + gy * 0.2 - 0.4, z, 0.13, 0.13, 0.03, color);
};
MW.decor[4] = function (L) {
  const R = L.R, g = L.group;
  MW.frames(L, [[12.4, 3.0, 5.2]], { wood: 0x5f4226, dark: 0x4a321c, stone: 0x3a3d46, broken: true, tilt: 0.06 });
  MW.stalactites(L, 0x3d404a, 8);
  /* reruntuhan batu kuno di dinding belakang */
  const rb = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  MW.ruinPillar(rb, 8.8, 4, false, R); MW.ruinPillar(rb, 14.8, 3, true, R); MW.ruinPillar(rb, 21.0, 5, true, R); MW.ruinPillar(rb, 29.3, 3, false, R);
  /* lengkung batu rusak */
  const ax = 17.9, ay = MW.FLOOR + 3.0;
  for (let a = 0; a <= 6; a++) { const t = a / 6 * Math.PI; if (a === 5) continue; rb.add(ax + Math.cos(t) * 1.7, ay + Math.sin(t) * 1.7, -0.75, 0.85, 0.85, 0.5, MW.shade(0x8e8e7c, 0.9 + R() * 0.2), 0, 0, t - Math.PI / 2); }
  [[ax - 1.7, 0.5], [ax + 1.7, 0.5]].forEach(p => { for (let k = 0; k < 3; k++) rb.add(p[0], MW.FLOOR + 0.5 + k, -0.75, 0.85, 1, 0.5, MW.shade(0x8a8a78, 0.9 + R() * 0.2)); });
  /* lempeng bertulis */
  rb.add(25.2, MW.FLOOR + 1.3, -0.75, 2.4, 2.6, 0.55, 0x77776a);
  rb.add(26.9, MW.FLOOR + 0.5, -0.7, 1.1, 1.0, 0.5, 0x6d6d62);
  rb.build(L.group, 'AncientStructures');
  const gl = new MW.InstBuilder(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  MW.glyph(gl, 25.2, MW.FLOOR + 1.5, -0.46, 5, 0x2fd6c0); MW.glyph(gl, 17.9, MW.FLOOR + 5.2, -0.46, 9, 0xd9a82a); MW.glyph(gl, 26.9, MW.FLOOR + 0.5, -0.43, 2, 0xffc928);
  gl.build(L.group, 'Carvings');
  /* sulur & lumut */
  const vn = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (let k = 0; k < 16; k++) { const x = 6 + R() * 25, cy = L.ceil[Math.floor(x)], h = 0.7 + R() * 1.8; vn.add(x, cy - h / 2, -0.5 + R() * 0.8, 0.09, h, 0.09, MW.shade(0x4a7a2a, 0.8 + R() * 0.4)); if (R() < 0.5) vn.add(x + 0.12, cy - h + 0.1, -0.5, 0.2, 0.09, 0.09, 0x4a7a2a); }
  for (let k = 0; k < 14; k++) vn.add(22 + R() * 9, MW.FLOOR + 0.06, -0.9 + R() * 0.7, 0.5 + R() * 0.6, 0.12, 0.4, MW.shade(0x5c9a30, 0.8 + R() * 0.4));
  vn.build(L.group, 'Moss');
  /* obor dinding */
  [14.0, 21.6].forEach(x => { const t = MW.makeDecor('torch'); t.position.set(x, MW.FLOOR + 0.8, -0.85); L.sub.Decorations.add(t); L.anim.push(function (tt) { if (t.userData.update) t.userData.update(tt); }); });
  MW.rubble(L.group, L.grid, 6, 31, MW.FLOOR, 0x55585f, 14, 123, -0.95, -0.3);
  L.group.add(MW.makeParticles(36, { x0: 5.5, x1: 31, y0: 3.5, y1: 11, z0: -0.5, z1: 0.9 }, 0xffd070, 'float', 2));
  L.fx.push(L.group.children[L.group.children.length - 1]);
  L.flicker = 0.1;
};

/* ---------------- LAYER 6: COMING SOON ---------------- */
MW.decor[5] = function (L) {
  const R = L.R, g = L.group;
  MW.stalactites(L, 0x2b2838, 10);
  MW.backFormations(L, [[9.5, 6, 8], [14.5, 4, 6], [24.5, 5, 7]], 0x1e1b29);
  /* gerbang struktur kuno yang belum dijelajahi */
  const rb = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  [17.2, 20.8].forEach(x => { for (let k = 0; k < 6; k++) rb.add(x, MW.FLOOR + 0.5 + k, -0.8, 0.95, 1, 0.55, MW.shade(0x3b3850, 0.9 + R() * 0.2)); });
  for (let k = 0; k < 5; k++) rb.add(16.6 + k * 1.0 + 0.5, MW.FLOOR + 6.4, -0.8, 1.02, 0.8, 0.6, MW.shade(0x45425c, 0.9 + R() * 0.2));
  rb.build(g, 'UnexploredStructure');
  const gl = new MW.InstBuilder(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  MW.glyph(gl, 19, MW.FLOOR + 6.4, -0.48, 4, 0x4dd8ff); MW.glyph(gl, 17.2, MW.FLOOR + 2.2, -0.5, 6, 0x7b52c8); MW.glyph(gl, 20.8, MW.FLOOR + 3.2, -0.5, 8, 0x7b52c8);
  gl.build(g, 'Glyphs');
  const door = MW.B(g, 2.7, 6.0, 0.1, MW.glow(0x0b0914), 19, MW.FLOOR + 3, -1.05);
  MW.crystalField(L, { emissive: 0x6a34d8, palette: [0xb98cff, 0x9a5cff, 0x7a4ce0, 0x6fd8ff], hang: [7.5, 11.5, 15, 22.5, 26, 30], floor: [8.8, 13.8, 22, 25.8], hs: 1.3, fs: 1.5, pc: 0xc8a0ff });
  const m = MW.cracks(g, L.grid, 6, 0xa05cff, 0x4dd8ff, 71, 11.0, 16.8, 5.6, 31.5);
  L.pulse.push(function (t) { if (m) m.color.setScalar(0.7 + Math.sin(t * 1.1) * 0.25); });
  MW.rubble(g, L.grid, 6, 27, MW.FLOOR, 0x35314a, 12, 141, -0.95, -0.3);
  /* mulut lubang ke bawah: pendar ungu */
  MW.B(g, 3.6, 0.15, 0.1, MW.glow(0x5b3aa8), 29.8, 0.6, -1.0);
};
})();
