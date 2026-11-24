/* tambang-world: layer 3-4 — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 06 LAYERS (B): dekorasi tiap layer ============ */
MW.decor = [];

MW.stalactites = function (L, color, n) {
  const R = L.R, b = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (let k = 0; k < n; k++) {
    const x = 6 + R() * 25, cy = L.ceil[Math.floor(x)];
    if (!cy) continue;
    const w = 0.35 + R() * 0.5, h = 0.5 + R() * 1.0;
    b.add(x, cy - h / 2, -0.6 + R() * 1.1, w, h, 0.5 + R() * 0.3, MW.shade(color, 0.8 + R() * 0.4), 0, R(), 0);
  }
  b.build(L.group, 'CeilingRocks');
};
MW.backFormations = function (L, list, color) {
  const R = L.R, b = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  list.forEach(f => MW.formation(b, f[0], f[1], f[2], MW.FLOOR, color, R));
  b.build(L.group, 'RockFormations');
};
MW.frames = function (L, list, o) {
  list.forEach(f => MW.timber(L.group.children.find(c => c.name === 'Decorations'), f[0], MW.FLOOR, f[1], f[2], 0.78, o));
};

/* ---------------- LAYER 1: SURFACE ---------------- */
MW.decor[0] = function (L) {
  const g = L.group, R = L.R, dec = L.sub.Decorations, GR = MW.GROUND;
  /* langit gradasi (PlaneGeometry + vertex color) */
  const sg = new THREE.PlaneGeometry(140, 40, 1, 8), col = [];
  const pos = sg.attributes.position, top = new THREE.Color(0x86caf2), bot = new THREE.Color(0xcdeeff), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) { const t = (pos.getY(k) + 20) / 40; c.copy(bot).lerp(top, t); col.push(c.r, c.g, c.b); }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true }));
  sky.position.set(16, GR + 19, -6); g.add(sky);
  /* awan voxel */
  const clouds = new THREE.Group(); clouds.position.z = -5; g.add(clouds);
  [[5, 16.5], [14, 15.2], [27, 16.8], [21, 14.4]].forEach((p, k) => {
    for (let j = 0; j < 4; j++) MW.B(clouds, 2.2 + (j % 2) * 1.2, 0.7, 0.6, MW.glow(0xf4fbff), p[0] + j * 1.0 - 1.5, p[1] + (j % 3) * 0.28, 0);
  });
  L.anim.push(function (t) { clouds.position.x = Math.sin(t * 0.04) * 2.5; });
  /* rumput di atas tanah */
  const grass = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const gcol = [0x58a62e, 0x4f9a2c, 0x62b236];
  for (let x = 0; x < MW.W; x++) {
    if (x >= MW.SHAFT.x0 && x < MW.SHAFT.x1) continue;
    grass.add(x + 0.5, GR - 0.14, 0, 1.0, 0.28, 2.04, gcol[Math.floor(R() * 3)]);
    if (R() < 0.6) { const h = 0.25 + R() * 0.3; grass.add(x + 0.2 + R() * 0.6, GR - 0.28 - h / 2, 1.015, 0.3, h, 0.04, 0x4f9a2c); }
    if (R() < 0.35) grass.add(x + 0.2 + R() * 0.6, GR + 0.18, 0.2 + R() * 0.8, 0.08, 0.3 + R() * 0.2, 0.08, 0x58a62e);
  }
  grass.build(g, 'GrassCaps');
  /* batu alam */
  const rk = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  [[9.9, 0.3], [20.2, 0.35], [31.4, 0.4]].forEach(r => rk.add(r[0], GR + r[1] / 2, -0.55, r[1] * 1.4, r[1], r[1] * 1.1, [0x8d8d95, 0x777780, 0x6a6a72][Math.floor(R() * 3)], 0, R(), 0));
  rk.build(dec, 'Stones');
  /* rangka katrol lift */
  const hf = new THREE.Group(); hf.position.set(3, GR, 0); dec.add(hf);
  MW.Bb(hf, 0.6, 0.5, 0.7, 0x4a4a52, -1.9, 0, 0); MW.Bb(hf, 0.6, 0.5, 0.7, 0x4a4a52, 1.9, 0, 0);
  MW.Bb(hf, 0.42, 4.2, 0.55, 0x8a5a2b, -1.9, 0.5, 0); MW.Bb(hf, 0.42, 4.2, 0.55, 0x7a4e24, 1.9, 0.5, 0);
  MW.B(hf, 4.5, 0.5, 0.7, 0x55555d, 0, 4.95, 0);
  const b1 = MW.B(hf, 1.7, 0.26, 0.3, 0x6b4220, -1.2, 4.0, 0.1); b1.rotation.z = -Math.PI / 4; const b2 = MW.B(hf, 1.7, 0.26, 0.3, 0x6b4220, 1.2, 4.0, 0.1); b2.rotation.z = Math.PI / 4;
  const pulley = new THREE.Mesh(MW.unitCyl, MW.M(0x6a6a72)); pulley.rotation.x = Math.PI / 2; pulley.scale.set(1.3, 0.3, 1.3); pulley.position.set(0, 4.2, -0.1); hf.add(pulley); MW.B(pulley, 0.15, 1.2, 0.15, 0x2a2a30, 0, 0, 0);
  L.pulley = pulley; L.pulleyY = GR + 4.2;
  /* Base Camp: Hutan + Tungku + Gudang dalam satu layer */
  MW.buildTop(L);
};

/* ---------------- LAYER 2: STONE ---------------- */
MW.decor[1] = function (L) {
  MW.frames(L, [[13.5, 3.0, 5.4], [17.9, 2.8, 5.0]], {});
  MW.stalactites(L, 0x6a6a72, 12);
  MW.backFormations(L, [[12, 4, 5], [20.5, 5, 6], [28, 3, 4]], 0x4a4a52);
  MW.rubble(L.group, L.grid, 6, 31, MW.FLOOR, 0x7a7a82, 16, 77, -0.95, -0.3);
  L.group.add(MW.makeParticles(24, { x0: 5.5, x1: 31, y0: 3.5, y1: 9, z0: -0.5, z1: 0.8 }, 0xffe0b0, 'float', 2));
  L.group.children[L.group.children.length - 1];
  L.fx.push(L.group.children[L.group.children.length - 1]);
};
})();
