/* tambang-logistics.js — alur barang per tambang (visual, mengikuti stok data):
   penambang menggali -> TUMPUKAN BATU di belakangnya -> pendorong cart memuat dari tumpukan -> cart mengantar ke CHEST dekat manager
   -> LIFT turun mengambil dari chest. Bar di atas chest = isi stok tambang (penuh = produksi berhenti).
   Hanya tampilan: angka tetap dari TambangMW.data (D.est(i) / slot.cap). Dipanggil dari MW.tick -> MW.logi.update(L, dt, t). */
(function () {
  'use strict';
  const MW = window.TambangMW = window.TambangMW || {};
  const PILE_X = 24.05, PILE_N = 28, ROCK = [0x8a8a92, 0x77777f, 0x9c9ca4, 0x6b6b73];
  const CHEST_X = 7.2, BAR_W = 1.5, FLY_N = 64;
  const col = (h) => new THREE.Color(h);
  const D_ = () => MW.data;
  function oreColor(i) {
    const D = D_(), mix = D && D.MIX && D.MIX[i], ores = (D && D.ORES) || {};
    const k = mix ? Object.keys(mix).sort((a, b) => mix[b] - mix[a])[0] : null;
    return k && ores[k] ? ores[k].c : '#e0804a';
  }
  const lg = MW.logi = { hold: {}, st: {}, fly: null };

  /* ---------- partikel terbang (satu InstancedMesh): ore melayang dari tumpukan -> cart -> chest -> lift ---------- */
  lg.initFly = function (root) {
    const mesh = new THREE.InstancedMesh(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }), FLY_N);
    mesh.frustumCulled = false; mesh.renderOrder = 25;
    const z = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color(0xffffff);
    for (let k = 0; k < FLY_N; k++) { mesh.setMatrixAt(k, z); mesh.setColorAt(k, c); }
    root.add(mesh); lg.fly = { mesh: mesh, p: [], idx: 0, z: z, m: new THREE.Matrix4(), c: new THREE.Color() };
    for (let k = 0; k < FLY_N; k++) lg.fly.p.push({ t: 1, d: 1, delay: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), h: 1, s: 0.2, on: false });
  };
  /* kirim satu kubus dari A ke B (koordinat dunia), tertunda delay detik */
  lg.send = function (a, b, color, delay, h) {
    const f = lg.fly; if (!f) return; const p = f.p[f.idx]; f.idx = (f.idx + 1) % FLY_N;
    p.a.copy(a); p.b.copy(b); p.t = 0; p.d = 0.55 + Math.random() * 0.15; p.delay = delay || 0; p.h = h === undefined ? 1 : h; p.s = 0.2 + Math.random() * 0.1; p.on = true;
    f.mesh.setColorAt((f.idx + FLY_N - 1) % FLY_N, f.c.set(color)); f.mesh.instanceColor.needsUpdate = true;
  };
  function updateFly(dt) {
    const f = lg.fly; if (!f) return; let any = false;
    f.p.forEach((p, k) => {
      if (!p.on) return; any = true;
      if (p.delay > 0) { p.delay -= dt; f.mesh.setMatrixAt(k, f.z); return; }
      p.t += dt / p.d; if (p.t >= 1) { p.on = false; f.mesh.setMatrixAt(k, f.z); return; }
      const e = p.t * p.t * (3 - 2 * p.t);
      f.m.makeScale(p.s, p.s, p.s).setPosition(p.a.x + (p.b.x - p.a.x) * e, p.a.y + (p.b.y - p.a.y) * e + Math.sin(Math.PI * e) * p.h, p.a.z + (p.b.z - p.a.z) * e);
      f.mesh.setMatrixAt(k, f.m);
    });
    if (any || f.dirty) { f.mesh.instanceMatrix.needsUpdate = true; f.dirty = any; }
  }
  const W3 = (i, x, y, z) => new THREE.Vector3(x, MW.worldY(i, y), z === undefined ? 0.4 : z);

  /* ---------- siapkan perlengkapan satu layer (lazy: setelah slot terisi) ---------- */
  function setup(L) {
    const i = L.index, g = L.group, FL = MW.FLOOR;
    const s = { i: i, ready: false, vp: 0, vc: 0, ph: 'go', tmr: 0, load: 0, shown: 0 };
    const ore = oreColor(i);
    /* tumpukan batu di belakang penambang */
    const pile = new THREE.InstancedMesh(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }), PILE_N);
    const R = MW.rng(77 + i * 13); let n = 0; const rows = [7, 6, 5, 4, 3, 2, 1], m4 = new THREE.Matrix4();
    rows.forEach((cnt, r) => {
      for (let k = 0; k < cnt && n < PILE_N; k++, n++) {
        const sz = 0.36 + R() * 0.08, x = PILE_X + (k - (cnt - 1) / 2) * 0.3 + (R() - 0.5) * 0.05, y = FL + sz / 2 + r * 0.3;
        m4.compose(new THREE.Vector3(x, y, -0.2 + R() * 0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 0.7, (R() - 0.5) * 0.4)), new THREE.Vector3(sz, sz, sz * 1.1));
        pile.setMatrixAt(n, m4);
        pile.setColorAt(n, R() < 0.28 ? col(ore) : col(ROCK[Math.floor(R() * ROCK.length)]).multiplyScalar(0.9 + R() * 0.2));
      }
    });
    pile.instanceMatrix.needsUpdate = true; pile.instanceColor.needsUpdate = true; pile.frustumCulled = false; pile.count = 0; pile.name = 'RockPile';
    g.add(pile); s.pile = pile; s.oreHex = ore;
    /* bar isi chest */
    const bar = new THREE.Group(); bar.position.set(CHEST_X, FL + 2.0, 0.6);
    MW.B(bar, BAR_W + 0.18, 0.4, 0.08, 0x0d0a18, 0, 0, -0.03);
    MW.B(bar, BAR_W, 0.24, 0.06, 0x2c2744, 0, 0, 0.02);
    const fill = new THREE.Mesh(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0x62cc2c })); fill.scale.set(BAR_W, 0.2, 0.06); fill.position.set(0, 0, 0.06); bar.add(fill);
    const hi = new THREE.Mesh(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); hi.scale.set(BAR_W, 0.06, 0.06); hi.position.set(0, 0.06, 0.1); bar.add(hi);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 48; const tx = new THREE.CanvasTexture(cv);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); tag.scale.set(1.5, 0.56, 1); tag.position.set(0, 0.62, 0.2); tag.renderOrder = 30; tag.visible = false; bar.add(tag);
    const g2 = cv.getContext('2d'); g2.font = '800 34px Nunito, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = 8; g2.strokeStyle = '#0d0a18'; g2.strokeText('PENUH', 64, 26); g2.fillStyle = '#ff6a5a'; g2.fillText('PENUH', 64, 26); tx.needsUpdate = true;
    g.add(bar); s.bar = bar; s.fill = fill; s.tag = tag;
    s.cartCargo = null; s.ready = true; L.logi = s;
    return s;
  }
  function cargoFor(cart) {
    const g = new THREE.Group(); g.visible = false;
    const b = new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff })), R = MW.rng(5);
    for (let k = 0; k < 9; k++) b.add(-0.45 + (k % 3) * 0.45, 0.62 + Math.floor(k / 3) * 0.2, -0.18 + (k % 2) * 0.3, 0.34, 0.26, 0.3, [0x8a8a92, 0x6b6b73, 0x9c9ca4][k % 3], 0, R(), 0);
    b.build(g, 'CartCargo'); cart.add(g); return g;
  }

  /* ---------- per frame, per layer ---------- */
  lg.update = function (L, dt, t, open, resting) {
    const i = L.index; if (i < 1) return;
    const D = MW.data; if (!D || !D.ready) return;
    const sd = D.slots[i - 1]; if (!sd) return;
    const s = L.logi || setup(L);
    s.pile.visible = s.bar.visible = open;
    if (!open) return;
    /* total terisi (0..1): stok + yang sedang ditahan menunggu lift tiba */
    const T = Math.max(0, Math.min(1, (D.est(i) + (lg.hold[i] || 0)) / Math.max(1, sd.cap)));
    const have = s.vp + s.vc + s.load;
    if (T > have) s.vp = Math.min(1, s.vp + (T - have) * Math.min(1, dt * 2.5));
    else if (T < have - 1e-4) { let d = Math.min(have - T, dt * 0.45 + 1e-4); const k = Math.min(s.vc, d); s.vc -= k; d -= k; const k2 = Math.min(s.vp, d); s.vp -= k2; d -= k2; s.load = Math.max(0, s.load - d); if (s.load < 0.01 && s.cargo) s.cargo.visible = false; }
    /* tumpukan: jumlah kubus mengikuti vp */
    const want = Math.round(Math.min(1, s.vp / 0.6) * PILE_N); s.pile.count = want;
    /* bar */
    const tot = Math.min(1, s.vp + s.vc + s.load), f = Math.max(0.02, tot);
    s.shown += (f - s.shown) * Math.min(1, dt * 6);
    s.fill.scale.x = BAR_W * s.shown; s.fill.position.x = -BAR_W * (1 - s.shown) / 2;
    s.fill.material.color.set(tot >= 0.98 ? 0xff4a3a : tot >= 0.75 ? 0xffc61f : 0x62cc2c);
    s.tag.visible = tot >= 0.98; if (s.tag.visible) { const k = 1 + Math.sin(t * 6) * 0.08; s.tag.scale.set(1.5 * k, 0.56 * k, 1); }
    /* siklus pendorong */
    const cart = L.sub.Carts.children[0], m = cart && cart.userData.m; if (!m) return;
    m.ctl = true;
    if (!s.cargo) s.cargo = cargoFor(cart);
    if (resting) { m.moving = false; m.busy = false; return; }
    const unit = 0.22, cy = MW.FLOOR + 0.9;
    if (s.ph === 'go') {
      m.dir = 1; m.busy = false; m.moving = true; cart.position.x = Math.min(m.max, cart.position.x + 1.5 * dt);
      if (cart.position.x >= m.max - 1e-3) { s.ph = 'load'; s.tmr = 0; s.sent = 0; m.moving = false; m.busy = true; }
    } else if (s.ph === 'load') {
      s.tmr += dt; m.moving = false; m.busy = true;
      const avail = Math.min(unit, s.vp);
      if (avail > 0.01) { while (s.sent < 5 && s.tmr > 0.15 + s.sent * 0.25) { lg.send(W3(i, PILE_X, MW.FLOOR + 0.9, 0.2), W3(i, cart.position.x, cy, 0.1), s.oreHex, 0, 1.0); s.sent++; } }
      if (s.tmr > (avail > 0.01 ? 1.7 : 0.9)) { const mv = Math.min(unit, s.vp); s.vp -= mv; s.load = mv; s.cargo.visible = mv > 0.01; s.ph = 'back'; m.dir = -1; m.busy = false; }
    } else if (s.ph === 'back') {
      m.dir = -1; m.moving = true; cart.position.x = Math.max(m.min, cart.position.x - 1.5 * dt);
      if (cart.position.x <= m.min + 1e-3) { s.ph = 'unload'; s.tmr = 0; s.sent = 0; m.moving = false; m.busy = true; }
    } else {
      s.tmr += dt; m.moving = false; m.busy = true;
      if (s.load > 0.01) { while (s.sent < 5 && s.tmr > 0.15 + s.sent * 0.22) { lg.send(W3(i, cart.position.x, cy, 0.1), W3(i, CHEST_X, MW.FLOOR + 1.0, 0.3), s.oreHex, 0, 1.2); s.sent++; } }
      if (s.tmr > (s.load > 0.01 ? 1.5 : 0.8)) {
        if (s.load > 0.01) { s.vc = Math.min(1, s.vc + s.load); s.load = 0; s.cargo.visible = false; const ch = L.sub.Chests.children[0]; if (ch) ch.userData.pop = 1; }
        s.ph = 'go'; m.dir = 1; m.busy = false;
      }
    }
    cart.rotation.z = 0;
  };
  /* lift mengambil dari chest: kubus melayang chest -> kabin */
  lg.pickup = function (i) {
    const lift = MW.world.lift, s = MW.world.layers[i] && MW.world.layers[i].logi; if (!lift) return;
    const hex = s ? s.oreHex : '#e0804a';
    for (let k = 0; k < 8; k++) lg.send(W3(i, CHEST_X, MW.FLOOR + 1.0, 0.3), new THREE.Vector3(3 + (k % 4 - 1.5) * 0.4, lift.y + 0.9, 0.3), hex, k * 0.12, 1.4);
  };
  lg.tick = function (dt) { updateFly(dt); };
})();
