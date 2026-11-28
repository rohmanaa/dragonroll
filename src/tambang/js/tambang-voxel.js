/* tambang-world: builder voxel, retakan, partikel — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 02 VOXEL: dinding batu, kayu, kristal, retakan ============ */

/* Bangun batu padat + dinding belakang rongga + detail permukaan satu layer.
   cfg: { stone:[hex..], back:hex, dash:hex, patches:[[x,y,w,h,hex]], ores:[{color,n,near}],
          sky:bool (layer 1), skipBack:fn(x,y) } */
MW.buildVoxels = function (layer, group, grid, cfg, seed) {
  const R = MW.rng(seed), W = MW.W, H = MW.H;
  const solid = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const back = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const dash = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const ore = new MW.InstBuilder(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const override = {};
  (cfg.patches || []).forEach(p => {
    for (let x = p[0]; x < p[0] + p[2]; x++) for (let y = p[1]; y < p[1] + p[3]; y++) override[x + ',' + y] = p[4];
  });
  const solidCells = [];
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    if (grid[x][y]) {
      let base = override[x + ',' + y];
      if (base === undefined) base = cfg.pick ? cfg.pick(x, y, R) : cfg.stone[Math.floor(R() * cfg.stone.length)];
      const col = MW.shade(base, 0.945 + R() * 0.11);
      solid.add(x + 0.5, y + 0.5, 0, 1, 1, 2, col);
      solidCells.push([x, y]);
      if (R() < 0.22) {
        const dx = 0.2 + R() * 0.45, dy = 0.2 + R() * 0.55;
        dash.add(x + dx + 0.12, y + dy, 1.015, 0.26 + R() * 0.2, 0.1, 0.03, MW.shade(cfg.dash || 0xaaaaaa, 0.9 + R() * 0.25));
      }
    } else {
      const sy = cfg.skyY !== undefined ? cfg.skyY : MW.GROUND, skyCell = cfg.sky && y >= sy;
      const inShaft = x >= MW.SHAFT.x0 && x < MW.SHAFT.x1;
      if (!skyCell) {
        back.add(x + 0.5, y + 0.5, -1.5, 1, 1, 1, MW.shade(inShaft ? (cfg.shaftBack || cfg.back) : cfg.back, (0.88 + R() * 0.2) * (cfg.backTint && !inShaft ? cfg.backTint(x, y) : 1)));
      } else if (inShaft && y < sy) {
        back.add(x + 0.5, y + 0.5, -1.5, 1, 1, 1, MW.shade(cfg.shaftBack || cfg.back, 1));
      }
    }
  }
  /* mineral tertanam di dinding (self-lit, kecil) */
  (cfg.ores || []).forEach(o => {
    for (let i = 0; i < o.n; i++) {
      let c = solidCells[Math.floor(R() * solidCells.length)];
      let tries = 0;
      while (o.near && tries++ < 40 && !(MW.isSolid(grid, c[0], c[1]) && (!MW.isSolid(grid, c[0], c[1] + 1) || !MW.isSolid(grid, c[0] - 1, c[1]) || !MW.isSolid(grid, c[0] + 1, c[1]) || !MW.isSolid(grid, c[0], c[1] - 1))))
        c = solidCells[Math.floor(R() * solidCells.length)];
      if (c[0] <= MW.SHAFT.x1 - 1 && !o.shaftOk) { continue; }
      const k = 3 + Math.floor(R() * 3);
      for (let j = 0; j < k; j++) {
        const s = 0.1 + R() * 0.14;
        ore.add(c[0] + 0.15 + R() * 0.7, c[1] + 0.15 + R() * 0.7, 1.03, s * 1.3, s, 0.05, MW.shade(o.color, 0.85 + R() * 0.3));
      }
    }
  });
  solid.build(group, 'RockWalls');
  back.build(group, 'BackWall');
  dash.build(group, 'Bricks');
  ore.build(group, 'Minerals');
  return { solidCells };
};

/* Penyangga kayu (frame) di bidang depan */
MW.timber = function (parent, x, floorY, w, h, z, o) {
  o = o || {};
  const wood = o.wood || 0x8a5a2b, dark = o.dark || 0x6b4220, stone = o.stone || 0x55555c;
  const g = new THREE.Group(); g.position.set(x, floorY, z || 0.75);
  const pw = o.post || 0.42;
  MW.Bb(g, 0.8, 0.3, 0.55, stone, -w / 2, 0, 0);
  MW.Bb(g, 0.8, 0.3, 0.55, stone, w / 2, 0, 0);
  MW.Bb(g, pw, h, 0.4, wood, -w / 2, 0.3, 0);
  const rightH = o.broken ? h * 0.62 : h;
  MW.Bb(g, pw, rightH, 0.4, dark, w / 2, 0.3, 0);
  const lint = MW.B(g, w + 0.9, 0.42, 0.5, wood, 0, h + 0.5, 0);
  if (o.tilt) lint.rotation.z = o.tilt;
  if (!o.noBrace) {
    const L = 1.5;
    const b1 = MW.B(g, L, 0.28, 0.3, dark, -w / 2 + 0.75, h - 0.2, 0.02); b1.rotation.z = -Math.PI / 4;
    const b2 = MW.B(g, L, 0.28, 0.3, dark, w / 2 - 0.75, h - 0.2, 0.02); b2.rotation.z = Math.PI / 4;
  }
  parent.add(g);
  return g;
};

/* Kristal: geometri Lathe 6 sisi (prisma + ujung runcing), alas di y=0, tinggi 1 */
MW.crystalGeo = (function () {
  const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.32, 0.03), new THREE.Vector2(0.34, 0.62), new THREE.Vector2(0.001, 1)];
  return new THREE.LatheGeometry(pts, 6);
})();
MW.crystalBuilder = function (emissive, ei) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: emissive, emissiveIntensity: ei === undefined ? 0.75 : ei, flatShading: true, roughness: 0.55, metalness: 0 });
  m.userData.baseEI = m.emissiveIntensity;
  return { b: new MW.InstBuilder(MW.crystalGeo, m), mat: m };
};
/* sebuah kelompok kristal; dir=1 tumbuh ke atas, -1 menggantung dari langit-langit */
MW.crystalCluster = function (b, x, y, z, dir, n, palette, scale, R) {
  for (let i = 0; i < n; i++) {
    const h = (0.5 + R() * 1.1) * scale, w = (0.35 + R() * 0.35) * scale;
    const tilt = (R() - 0.5) * 0.9;
    const ox = (i - (n - 1) / 2) * 0.28 * scale + (R() - 0.5) * 0.15;
    const col = palette[Math.floor(R() * palette.length)];
    b.add(x + ox, y, z + (R() - 0.5) * 0.3, w, h, w, col, 0, R() * 3, dir > 0 ? tilt : Math.PI + tilt);
  }
};

/* Retakan bercahaya: random walk sumbu-selaras di bidang depan, inti terang + halo lebar */
MW.cracks = function (parent, grid, segs, color, hot, seed, y0, y1, x0, x1) {
  const R = MW.rng(seed);
  const core = new MW.InstBuilder(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const halo = new MW.InstBuilder(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
  for (let s = 0; s < segs; s++) {
    let x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), horiz = R() < 0.5;
    const steps = 2 + Math.floor(R() * 3);
    for (let i = 0; i < steps; i++) {
      const len = 0.5 + R() * 0.9, t = 0.15 + R() * 0.07;
      const sgn = R() < 0.5 ? -1 : 1, c = R() < 0.3 ? hot : color;
      if (!MW.isSolid(grid, Math.floor(x), Math.floor(y))) break;
      const hx = horiz ? x + sgn * len / 2 : x, hy = horiz ? y : y + sgn * len / 2, hw = horiz ? len : t, hh = horiz ? t : len;
      halo.add(hx, hy, 1.02, hw + 0.3, hh + 0.3, 0.02, MW.shade(c, 0.55));
      core.add(hx, hy, 1.04, hw, hh, 0.04, c);
      if (horiz) x += sgn * len; else y += sgn * len;
      if (R() < 0.45) horiz = !horiz;
    }
  }
  halo.build(parent, 'CrackHalo');
  const im = core.build(parent, 'Cracks');
  return im ? im.material : null;
};

/* Batu lepas & tumpukan di lantai (InstancedMesh) */
MW.rubble = function (parent, grid, x0, x1, floorY, color, n, seed, zmin, zmax) {
  const R = MW.rng(seed), b = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), s = 0.12 + R() * 0.3;
    b.add(x, floorY + s * 0.5, (zmin === undefined ? -0.4 : zmin) + R() * ((zmax === undefined ? 0.9 : zmax) - (zmin === undefined ? -0.4 : zmin)), s * (1 + R() * 0.5), s, s * (0.8 + R() * 0.6), MW.shade(color, 0.7 + R() * 0.5), 0, R() * 1.5, (R() - 0.5) * 0.4);
  }
  b.build(parent, 'Rubble');
};

/* Bukaan lift pada tiap layer: kusen kayu di x=5 */
MW.liftOpening = function (parent, floorY, wood, h) {
  const g = new THREE.Group(); g.position.set(5.0, floorY, 0.9);
  MW.Bb(g, 0.28, h, 0.35, wood, 0.1, 0, 0);
  MW.Bb(g, 0.55, 0.3, 0.35, 0x3d3d44, 0.1, 0, 0);
  MW.B(g, 0.6, 0.34, 0.4, wood, 0.12, h + 0.15, 0);
  parent.add(g);
};
})();
