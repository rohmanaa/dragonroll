/* tambang-world: lift & shaft — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
const D_ORES = () => (MW.data && MW.data.ORES) || {};
/* ============ 08 LIFT: shaft, rel, kabin, kabel ============ */
MW.buildLift = function () {
  const g = new THREE.Group(); g.name = 'ElevatorSystem';
  const bottom = -MW.H * (MW.LAYERS - 1), top = MW.GROUND + 4.9;       // dari dasar dunia sampai puncak katrol
  const len = top - bottom, cy = (top + bottom) / 2;
  /* rel panduan: dua batang baja + sambungan kayu tiap 6 unit */
  [1.15, 4.85].forEach(x => {
    MW.B(g, 0.2, len, 0.28, 0x6c7079, x, cy, -0.15);
    MW.B(g, 0.08, len, 0.1, 0x9aa0aa, x + (x < 3 ? 0.14 : -0.14), cy, 0.0);
  });
  const br = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (let y = bottom + 2; y < top; y += 6) {
    br.add(3, y, -1.05, 3.7, 0.3, 0.3, 0x7a4e24);
    br.add(2.05, y + 1.5, -1.05, 2.0, 0.22, 0.26, 0x6b4220, 0, 0, Math.PI / 4 + 0.0);
    br.add(3.95, y + 1.5, -1.05, 2.0, 0.22, 0.26, 0x6b4220, 0, 0, -Math.PI / 4);
  }
  br.build(g, 'ShaftBraces');
  /* lampu penanda di tiap bukaan */
  for (let i = 0; i < MW.LAYERS; i++) {
    const y = MW.worldY(i, MW.stopY[i]);
    MW.B(g, 0.3, 0.3, 0.2, MW.glow(0xffd36a), 3, y + 4.4, -1.2);
    MW.Bb(g, 3.6, 0.22, 1.2, 0x3b3b42, 3, y - 0.22, -0.3);            // ambang lantai (di belakang kabin)
  }
  /* kabin */
  const cab = new THREE.Group(); cab.name = 'LiftCabin';
  MW.Bb(cab, 2.6, 0.2, 1.5, 0x5a5e68, 0, 0, 0);
  MW.Bb(cab, 2.5, 0.06, 1.4, 0x8a5a2b, 0, 0.2, 0);                    // lantai kayu
  [[-1.25, -0.7], [1.25, -0.7], [-1.25, 0.7], [1.25, 0.7]].forEach(p => MW.Bb(cab, 0.14, 2.9, 0.14, 0x3b3f48, p[0], 0.2, p[1]));
  MW.B(cab, 2.5, 2.4, 0.06, 0x23252c, 0, 1.45, -0.72);               // dinding belakang kabin
  [0.9, 1.7, 2.5].forEach(y => { MW.B(cab, 2.6, 0.07, 0.07, 0x7d828c, 0, y, 0.7); MW.B(cab, 0.07, 0.07, 1.4, 0x7d828c, -1.25, y, 0); MW.B(cab, 0.07, 0.07, 1.4, 0x7d828c, 1.25, y, 0); });
  MW.Bb(cab, 2.9, 0.22, 1.8, 0x4a4e58, 0, 3.1, 0);                    // atap
  MW.Bb(cab, 0.3, 0.3, 0.3, 0x2c2e35, 0, 3.32, 0);
  const lamp = MW.B(cab, 0.22, 0.22, 0.22, MW.glow(0xffd36a), 0, 3.6, 0);
  [[-1.45], [1.45]].forEach(p => MW.B(cab, 0.34, 0.8, 0.4, 0x3b3f48, p[0], 2.6, -0.1));   // sepatu panduan
  g.add(cab);
  /* gembok & rantai (lift terkunci) dan muatan ore (kubus warna di lantai kabin) */
  const lockG = new THREE.Group(); lockG.position.set(0, 0, 0.78); cab.add(lockG);
  [0.9, 1.6, 2.3].forEach(y => MW.B(lockG, 2.5, 0.09, 0.09, 0x1d1e23, 0, y, 0));
  MW.B(lockG, 0.09, 2.2, 0.09, 0x1d1e23, -0.6, 1.5, 0); MW.B(lockG, 0.09, 2.2, 0.09, 0x1d1e23, 0.6, 1.5, 0);
  MW.Bb(lockG, 0.7, 0.55, 0.3, 0xe8bb3c, 0, 1.25, 0.1); MW.B(lockG, 0.12, 0.12, 0.34, 0x3a2a08, 0, 1.5, 0.1);
  MW.B(lockG, 0.46, 0.08, 0.1, 0xc99a24, 0, 1.92, 0.1); MW.B(lockG, 0.08, 0.34, 0.1, 0xc99a24, -0.19, 1.82, 0.1); MW.B(lockG, 0.08, 0.34, 0.1, 0xc99a24, 0.19, 1.82, 0.1);
  const cargo = new THREE.Group(); cab.add(cargo); const cubes = [];
  for (let k = 0; k < 18; k++) { const c = MW.B(cargo, 0.34, 0.34, 0.34, MW.glow(0xffffff), 0, 0, 0); c.material = new THREE.MeshBasicMaterial({ color: 0xffffff }); c.position.set(-0.9 + (k % 6) * 0.36, 0.2 + 0.17 + Math.floor(k / 6) * 0.35, -0.3 + ((k * 5) % 3) * 0.32); c.visible = false; cubes.push(c); }
  /* kabel: dua batang tipis, panjangnya mengikuti kabin */
  const cables = [2.4, 3.6].map(x => MW.B(g, 0.07, 1, 0.07, 0x2a2b30, x, 0, 0));
  const lift = {
    group: g, cab: cab, y: MW.worldY(0, MW.stopY[0]), vel: 0, target: MW.worldY(0, MW.stopY[0]), layer: 0, pulleyY: top - 0.7,
    speedMul: 1,
    setLocked: function (b) { lockG.visible = !!b; },
    setLoad: function (n, cap, mix) {   /* n ore dari cap muatan -> jumlah kubus; mix {ore:jumlah} -> warna */
      const show = n > 0 ? Math.max(1, Math.round(n / Math.max(1, cap) * 18)) : 0, ks = Object.keys(mix || {}), tot = ks.reduce((a, k) => a + mix[k], 0) || 1;
      let ki = 0, acc = 0;
      cubes.forEach((c, k) => { c.visible = k < show; if (k < show) { while (ki < ks.length - 1 && k >= Math.round((acc + mix[ks[ki]]) / tot * show)) { acc += mix[ks[ki]]; ki++; } c.material.color.set((D_ORES()[ks[ki]] || { c: '#ffffff' }).c); } });
    },
    goTo: function (i) { this.layer = i; this.target = MW.worldY(i, MW.stopY[i]); },
    update: function (dt, t, pulley) {
      const d = this.target - this.y;
      const mul = this.speedMul || 1, want = Math.max(-18 * mul, Math.min(18 * mul, d * 2.6 * mul));
      this.vel += (want - this.vel) * Math.min(1, dt * 4.5);
      this.y += this.vel * dt;
      if (Math.abs(d) < 0.01 && Math.abs(this.vel) < 0.08) { this.y = this.target; this.vel = 0; }
      cab.position.set(3, this.y - 0.26, 0);
      cab.rotation.z = Math.sin(t * 9) * 0.004 * Math.min(1, Math.abs(this.vel) / 4);
      const roofY = this.y + 3.2, topY = this.pulleyY;
      cables.forEach(c => { c.scale.y = Math.max(0.1, topY - roofY); c.position.y = roofY + c.scale.y / 2; });
      if (pulley) pulley.rotation.y -= this.vel * dt / 0.65;
      lamp.visible = Math.sin(t * 3) > -0.6;
    }
  };
  lockG.visible = false;
  lift.update(0.016, 0, null);
  return lift;
};
})();
