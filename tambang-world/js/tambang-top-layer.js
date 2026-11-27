/* tambang-top-layer.js — Layer paling atas (Base Camp): Hutan + Tungku + Gudang dalam SATU layer, tanpa penambangan.
   Bangunan = userData.bid ('hutan'|'tungku'|'gudang') di grup Buildings, dipilih lewat raycast (klik membuka modal).
   Penebang (AI) berjalan antar pohon, menebang 3 kali -> D.chop; pohon tumbuh lagi lewat D.treeGrow. */
(function () {
  'use strict';
  const MW = window.TambangMW = window.TambangMW || {};
  const TREE_X = [17.6, 18.9, 20.2, 21.5, 22.8, 24.1];
  MW.TREE_X = TREE_X;

  function signTex(text, w, h, bg, fg) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = '400 ' + Math.round(h * 0.62) + "px 'Lilita One', Impact, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return t;
  }
  function sign(parent, text, w, h, x, y, z, bg, fg) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, 256, Math.round(256 * h / w), bg || '#6b4220', fg || '#ffe8a3') }));
    m.position.set(x, y, z); parent.add(m); return m;
  }
  function mark(g, bid) { g.userData.bid = bid; return g; }


  function buildTree(parent, x, k) {
    const t = new THREE.Group(); t.position.set(x, MW.GROUND, (k % 2) * -0.45); t.scale.setScalar(0.7); parent.add(t);
    const inner = new THREE.Group(); t.add(inner);
    const gr = [0x3f8a28, 0x4a9a2e, 0x367a22], h = 3.6 + (k % 3) * 0.5;
    MW.Bb(inner, 0.7, h, 0.7, 0x6b4a2a, 0, 0, 0); MW.Bb(inner, 0.2, h * 0.7, 0.72, 0x5a3c20, 0.2, 0.2, 0);
    MW.Bb(inner, 2.5, 1.4, 1.9, gr[0], 0, h - 0.2, 0); MW.Bb(inner, 1.7, 1.4, 1.5, gr[1], -0.15, h + 1.1, 0); MW.Bb(inner, 1.3, 1.1, 1.6, gr[2], 0.65, h + 0.45, 0.1); MW.Bb(inner, 1.0, 1.0, 1.0, gr[0], 0, h + 2.2, 0);
    const stump = MW.Bb(t, 0.85, 0.5, 0.85, 0x6b4a2a, 0, 0, 0); MW.B(stump, 0.7, 0.04, 0.7, 0xc9a06a, 0, 0.5, 0); stump.visible = false;
    t.userData = { zb: (k % 2) * -0.45, idx: k, inner: inner, stump: stump, state: 'up', fall: 0, shake: 0, side: 1, bx: x, h: h };
    return t;
  }

  MW.buildTop = function (L) {
    const f = MW.GROUND, dec = L.sub.Decorations, b = L.sub.Buildings, R = L.R;
    const lam = () => new MW.InstBuilder(MW.unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));

    L.trees = TREE_X.map((x, k) => buildTree(dec, x, k));
    L.lumbers = [];
    const claimed = {}, home = 16.9;
    const spawn = (n) => {
      const w = MW.makeWorker(n + 2); w.userData.kind = 'lumber'; w.userData.w.rig.setTool('axe'); w.userData.w.mode = 'lumber';
      w.position.set(home + n * 0.5, f, 0.5 + n * 0.12); b.add(w);
      w.userData.ai = { st: 'idle', t: 0.5 + n * 0.6, target: -1, hits: 0, seen: w.userData.w.rig.strikes };
      L.lumbers.push(w);
    };
    const wp = new THREE.Vector3();
    function lumberTick(wk, dt, t) {
      const w = wk.userData.w, ai = wk.userData.ai, rig = w.rig, D = MW.data;
      const rg = D.restGlobal(); wk.userData.rest = rg.resting ? rg.kind : null;
      if (rg.resting || w.rsp) {
        if (rg.resting && ai.st !== 'idle') { if (ai.target >= 0) claimed[ai.target] = 0; ai.st = 'idle'; ai.t = 1; ai.home = true; }
        MW.updateWorker(wk, t, dt); return;
      }
      const tg = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; w.rotY += (tg - w.rotY) * Math.min(1, dt * 9); w.face.rotation.y = w.rotY;
      if (ai.st === 'idle') {
        rig.setMode('idle'); ai.t -= dt;
        if (ai.t <= 0) {
          let best = -1, bd = 1e9;
          L.trees.forEach((tr, k) => { if (D.storeFree() >= 4 && !claimed[k] && D.treeUp(k) && tr.userData.state === 'up') { const d = Math.abs(tr.position.x - wk.position.x); if (d < bd) { bd = d; best = k; } } });
          if (best >= 0) { claimed[best] = 1; ai.target = best; ai.st = 'walk'; ai.side = wk.position.x < L.trees[best].position.x ? -1 : 1; }
          else { ai.t = 1.5; ai.home = true; }
        }
        if (ai.home && Math.abs(wk.position.x - (home + L.lumbers.indexOf(wk) * 0.5)) > 0.2) { const dx = home + L.lumbers.indexOf(wk) * 0.5 - wk.position.x; w.dir = Math.sign(dx); rig.setMode('walk'); wk.position.x += w.dir * 2.2 * dt; }
      } else if (ai.st === 'walk') {
        const tr = L.trees[ai.target]; if (!tr || !D.treeUp(ai.target) || tr.userData.state !== 'up') { claimed[ai.target] = 0; ai.st = 'idle'; ai.t = 0.3; return; }
        const dest = tr.position.x + ai.side * 1.0, dx = dest - wk.position.x;
        if (Math.abs(dx) > 0.08) { w.dir = Math.sign(dx); rig.setMode('walk'); wk.position.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.4 * dt); }
        else { rig.setMode('idle'); w.dir = -ai.side; ai.st = 'chop'; ai.hits = 0; ai.seen = rig.strikes; ai.t = 0.25; }
      } else if (ai.st === 'chop') {
        const tr = L.trees[ai.target]; rig.setMode('idle'); w.dir = -ai.side;
        ai.t -= dt; if (ai.t <= 0 && !rig.acting) { rig.act('mine'); ai.t = 0.3; }
        if (rig.strikes !== ai.seen) {
          ai.seen = rig.strikes; ai.hits++; tr.userData.shake = 0.25;
          wk.getWorldPosition(wp); wp.x += w.dir * 1.15; wp.y += 1.1; wp.z += 0.3; MW.debris.spawn(wp, 0xc9a06a, 5);
          if (ai.hits >= 3) {
            const got = D.chop(ai.target); tr.userData.state = 'falling'; tr.userData.fall = 0; tr.userData.side = -ai.side;
            wk.getWorldPosition(wp); wp.x += w.dir * 1.8; wp.y += 1.5; MW.debris.spawn(wp, 0x8a5a2b, 10); MW.debris.spawn(wp, 0x58a62e, 6);
            if (MW.ui && MW.ui.onWood) MW.ui.onWood(got, wp.clone());
            claimed[ai.target] = 0; ai.st = 'idle'; ai.t = 0.9; ai.home = false;
          }
        }
      }
      rig.tick(dt);
    }
    L.update = function (t, dt) {
      const D = MW.data; if (!D || !D.ready) return;
      const n = D.forest().workers; while (L.lumbers.length < n) spawn(L.lumbers.length);
      L.lumbers.forEach((wk, i) => { wk.visible = i < n; if (i < n) lumberTick(wk, dt, t); });
      const fn = D.furnace().n, act = D.smeltActive(), rg = D.restGlobal();
      (L.smelters || []).forEach((sm, i) => smelterTick(sm, i < fn, act, rg, t, dt));
      L.trees.forEach((tr, k) => {
        const u = tr.userData;
        if (u.state === 'falling') {
          u.fall += dt * 1.3; const e = Math.min(1, u.fall); u.inner.rotation.z = u.side * -e * e * 1.45; u.inner.position.y = -e * 0.2;
          if (u.fall >= 1.25) { u.state = 'down'; u.inner.rotation.z = 0; u.inner.position.y = 0; u.inner.visible = false; u.stump.visible = true; }
          return;
        }
        const g = D.treeGrow(k);
        if (g >= 1) { u.state = 'up'; u.inner.visible = true; u.stump.visible = false; u.inner.scale.setScalar(1); }
        else { u.state = 'down'; u.stump.visible = true; if (g > 0.08) { u.inner.visible = true; u.inner.scale.setScalar(0.2 + 0.8 * g); } else u.inner.visible = false; }
        if (u.shake > 0) { u.shake -= dt; tr.position.x = u.bx + Math.sin(t * 90) * 0.05; } else tr.position.x = u.bx;
      });
    };

    /* ---------------- FURNACE (maks 3, dibuka lewat upgrade) ---------------- */
    const FS = 0.4, FXS = [7.2, 11.0, 14.8];
    L.furn = FXS.map((FX, fi) => {
      const fu = mark(new THREE.Group(), 'tungku'); fu.position.set(FX, f, -0.1); fu.scale.setScalar(FS); b.add(fu);
      MW.Bb(fu, 9.4, 0.5, 3.2, 0x5b5b63, 0, 0, 0);
      const body = new THREE.Group(); fu.add(body);
      const bricks = lam();
      for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) { if (x >= 2 && x <= 4 && y < 3) continue; bricks.add(-3.5 + x + 0.5 + (y % 2 ? 0.25 : 0), 0.5 + y + 0.5, 0, 1, 1, 2.4, [0x9a6a52, 0x8d6048, 0xa87458][Math.floor(R() * 3)]); }
      bricks.build(body, 'FurnaceBricks');
      MW.B(body, 3.0, 3.0, 0.2, 0x140b08, 0, 2.0, 1.25);
      const fl = [[-0.7, 0], [0.2, 0.3], [0.8, -0.1]].map((p) => MW.B(body, 0.7, 1.4, 0.2, MW.glow(0xff8a22), p[0], 1.5 + p[1], 1.35));
      const fl2 = [[-0.3, 0], [0.5, 0.15]].map((p) => MW.B(body, 0.45, 0.9, 0.2, MW.glow(0xffe08a), p[0], 1.35 + p[1], 1.4));
      MW.B(body, 3.6, 0.35, 0.5, 0x4a4a52, 0, 3.7, 1.2); [-1.65, 1.65].forEach((x) => MW.Bb(body, 0.35, 3.0, 0.5, 0x4a4a52, x, 0.5, 1.2));
      MW.Bb(body, 2.0, 3.4, 2.0, 0x7a5a48, 2.1, 6.5, -0.3); MW.Bb(body, 2.4, 0.5, 2.4, 0x5b5b63, 2.1, 9.9, -0.3);
      sign(body, 'FURNACE', 5.2, 1.2, 0, 5.4, 1.28, '#3a2a22', '#ffd45a');
      const smoke = MW.makeParticles(10, { x0: FX + 0.5, x1: FX + 1.1, y0: f + 4.0, y1: f + 5.4, z0: -0.4, z1: 0.3 }, 0x9a9aa4, 'rise', 3); dec.add(smoke); L.fx.push(smoke);
      /* slot kosong: papan "bangun" */
      const ghost = new THREE.Group(); fu.add(ghost);
      MW.Bb(ghost, 0.3, 3.0, 0.3, 0x6b4220, 0, 0.5, 0.8); sign(ghost, '+ FURNACE', 6.4, 1.5, 0, 3.4, 1.0, '#4a4a56', '#cfc8ee');
      return { fu: fu, body: body, ghost: ghost, fl: fl, fl2: fl2, smoke: smoke };
    });
    /* tukang bakar otomatis: satu per furnace yang sudah dibangun */
    L.smelters = FXS.map((FX, i) => {
      const s = MW.makeWorker(21 + i, { shirt: 0x6b3a22, helm: 0x2a2a30, skin: 0xd9a07a, hair: 0x2a1a10, pants: 0x2a2220, noTool: true });
      s.userData.w.noTool = true; s.userData.w.rig.setTool(null); s.userData.w.mode = 'grab';
      s.position.set(FX - 1.9, f, 1.2); s.userData.w.dir = 1; s.visible = false; b.add(s); s.userData.nx = 1; return s;
    });
    function smelterTick(s, built, active, rg, t, dt) {
      const w = s.userData.w, rig = w.rig; s.visible = built; if (!built) return;
      s.userData.rest = rg.resting ? rg.kind : null;
      if (rg.resting || w.rsp) { MW.updateWorker(s, t, dt); return; }
      w.dir = 1; const tg = Math.PI / 2; w.rotY += (tg - w.rotY) * Math.min(1, dt * 9); w.face.rotation.y = w.rotY;
      rig.setMode('idle');
      if (active) { s.userData.nx -= dt; if (s.userData.nx <= 0 && !rig.acting) { rig.act('grab'); s.userData.nx = 1.3; } }
      rig.tick(dt);
    }
    const coal = lam();
    [[0, 0], [0.5, 0], [1.0, 0], [0.25, 0.4], [0.75, 0.4], [0.5, 0.8]].forEach((p) => coal.add(5.2 + p[0] * 0.7, f + 0.2 + p[1] * 0.7, 0.9, 0.35, 0.32, 0.35, [0x24242a, 0x2e2e36][Math.floor(R() * 2)]));
    coal.build(dec, 'CoalPile');
    const light = new THREE.PointLight(0xff7a22, 1.2, 12, 1); light.position.set(FXS[0] + 3.6, f + 1.6, 3.2); L.light = light; L.burst = 0;
    L.anim.push((t) => {
      const n = (MW.data && MW.data.ready) ? MW.data.furnace().n : 0;
      L.furn.forEach((F, i) => { const on = i < n; F.body.visible = on; F.ghost.visible = !on; F.smoke.visible = on && !!(MW.data.smeltActive());
        F.fl.forEach((m, k) => { m.scale.y = 1 + Math.sin(t * 11 + k * 2 + i) * 0.18; }); F.fl2.forEach((m, k) => { m.scale.y = 1 + Math.sin(t * 15 + k + i) * 0.2; }); });
      light.intensity = (n > 0 ? 0.5 + 0.35 * n : 0) + Math.sin(t * 9) * 0.2 + (L.burst > 0 ? L.burst * 2 : 0); if (L.burst > 0) L.burst -= 0.02;
    });

    /* ---------------- GUDANG (bangunan, bukan gua) ---------------- */
    const gd = mark(new THREE.Group(), 'gudang'); gd.position.set(28.6, f, -0.1); b.add(gd);
    MW.Bb(gd, 6.0, 0.3, 3.0, 0x5b5b63, 0, 0, 0);
    MW.Bb(gd, 5.4, 3.0, 2.4, 0xb08a5a, 0, 0.3, 0);
    [-2.55, -0.95, 0.95, 2.55].forEach((x) => MW.Bb(gd, 0.3, 3.0, 2.5, 0x7a4e24, x, 0.3, 0));
    MW.B(gd, 5.5, 0.22, 2.5, 0x7a4e24, 0, 1.9, 0);
    [[6.0, 2.9, 0x6b4220], [5.2, 2.5, 0xa04028], [4.2, 2.1, 0xb04a30], [3.0, 1.7, 0xa04028]].forEach((r, k) => MW.Bb(gd, r[0], 0.5, r[1], r[2], 0, 3.3 + k * 0.5, 0));
    MW.B(gd, 2.3, 2.5, 0.12, 0x2a1a0e, 0, 1.55, 1.24); MW.B(gd, 1.9, 2.2, 0.08, MW.glow(0x1a0f08), 0, 1.45, 1.28);
    const gl = new MW.InstBuilder(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (let k = 0; k < 10; k++) gl.add(-0.8 + R() * 1.6, 0.6 + R() * 1.6, 1.32, 0.14, 0.14, 0.05, [0x2fe07a, 0xffd24d, 0xb06cff, 0x6fe8ff, 0xff7a2a][k % 5]);
    gl.build(gd, 'StorageGlints');
    [-1, 1].forEach((sd) => { const d = MW.Bb(gd, 0.95, 2.4, 0.1, 0x6b4220, sd * 1.5, 0.3, 1.32); d.rotation.y = sd * 0.8; });
    [-1, 1].forEach((sd) => MW.B(gd, 0.7, 0.7, 0.1, MW.glow(0xffd36a), sd * 2.0, 2.3, 1.24));
    sign(gd, 'GUDANG', 2.6, 0.7, 0, 3.55, 1.5, '#3a2a22', '#ffd45a');
    [[-3.4, 0], [-3.4, 0.75], [3.35, 0]].forEach((p, i) => MW.Bb(gd, 0.7, 0.7, 0.7, [0x8a5a2b, 0x96622f, 0x7c5126][i], p[0], p[1] + 0.3, 1.3));
    ['wooden', 'stone'].forEach((tp, i) => { const c = MW.makeChest(tp); c.userData.kind = null; c.position.set(-1.9 + i * 3.8, 0.3, 1.9); gd.add(c); L.anim.push((t) => { if (c.userData.update) c.userData.update(t); }); });
    const gem = MW.B(gd, 0.45, 0.45, 0.45, MW.glow(0x2fe07a), 0, 6.1, 0.4); L.anim.push((t) => { gem.rotation.y = t; gem.position.y = 6.1 + Math.sin(t * 2) * 0.12; });
  };
})();
