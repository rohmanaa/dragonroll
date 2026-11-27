/* tambang-world: perakitan dunia, lampu, loop — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 10 WORLD: perakitan scene, populasi slot, lampu, loop ============ */
MW.world = { layers: [], s: 0, sT: 0, cur: 0, cx: 16, cxT: 16, viewW: 32, ready: false };
MW.THEME = ['surface', 'stone', 'crystal', 'deep', 'ancient', 'mystery'];
MW.ACCENT = ['#6fbf3b', '#a9a9b3', '#4dd8ff', '#ff7a2a', '#ffc928', '#a05cff'];
MW.AMB_KS = [0.62, 0.85, 0.95, 1.0, 1.0, 1.05];   // skala ambient per layer (layer 1 diredam agar tidak overexposed)
MW.LIGHT_K = 0.75;    // skala lampu titik per layer

(function () {
  const Wd = MW.world;
  const SUBKEY = { chest: 'Chests', worker: 'Workers', mining: 'Workers', grabber: 'Workers', cartRail: 'Carts', decor: 'Decorations', mineral: 'Minerals' };
  const KIND_OF = { chest: 'chest', worker: 'worker', mining: 'worker', grabber: 'worker', cartRail: 'cart', decor: 'decor', mineral: 'mineral' };
  MW.kindOfSlot = KIND_OF;

  /* lepas objek bantu (simpul tambang / pendorong) milik sebuah objek */
  MW.detach = function (o) {
    const u = o.userData;
    if (u.aux) { if (u.aux.parent) u.aux.parent.remove(u.aux); u.aux = null; }
    if (u.pusher) { if (u.pusher.parent) u.pusher.parent.remove(u.pusher); u.pusher = null; }
    if (u.kind === 'worker' && u.w) { if (u.w.cart && u.w.cart.obj) { u.w.cart.obj.userData.pusher = null; } u.w.cart = null; u.node = null; }
  };

  function configure(obj, slot, floor, L) {
    const u = obj.userData, d = slot.def || {};
    if (u.kind === 'worker') {
      const w = u.w; u.prodSlot = (slot.type === 'mining' || slot.type === 'grabber') ? slot.layer : 0;
      if (slot.type === 'mining') {
        const dir = d.face || 1, node = MW.makeOreNode(slot.layer);
        node.position.set(slot.x + dir * 1.3, floor, 0.2); node.userData.bx = node.position.x;
        L.sub.Nodes.add(node); u.aux = node; u.node = node;
        w.debrisColor = [0x9a9aa2, 0xc8a060, 0x5fd8ff, 0xff7a2a, 0xf2c230, 0xa05cff][slot.layer];
        MW.setWorkerMode(obj, 'mine', { dir: dir });
      } else if (slot.type === 'grabber') {
        const dir = d.face || 1, m = MW.makeMineral(slot.layer);
        m.position.set(slot.x + dir * 1.15, floor, 0.15); L.sub.Nodes.add(m); u.aux = m;
        MW.setWorkerMode(obj, 'grab', { dir: dir });
      } else if (d.fill === 'walk') {
        const r = d.range || [slot.x - 1, slot.x + 1];
        MW.setWorkerMode(obj, 'walk', { path: { x0: r[0], x1: r[1] }, dir: 1 });
      } else MW.setWorkerMode(obj, 'idle', { dir: slot.x < 16 ? 1 : -1 });
    } else if (u.kind === 'cart') {
      const tr = slot.track;
      const m = { obj: obj, dir: 1, moving: !!tr, wait: 0, min: tr ? tr[0] + 1.0 : slot.x, max: tr ? tr[1] - 1.0 : slot.x, speed: 0.9 };
      u.m = m;
      if (d.pusher && tr) {
        const p = MW.makeWorker();
        MW.setWorkerMode(p, 'push', { cart: m, dir: 1 });
        p.position.set(slot.x - 1.45, floor, 0.2); L.sub.Workers.add(p); u.pusher = p;
      }
    }
  }

  function attach(obj, slot) {
    const L = Wd.layers[slot.layer], floor = slot.layer === 0 ? MW.GROUND : MW.FLOOR;
    MW.detach(obj);
    L.sub[SUBKEY[slot.type]].add(obj);
    obj.position.set(slot.x, floor + (obj.userData.kind === 'cart' ? 0.14 : 0), slot.z);
    obj.rotation.set(0, 0, 0); obj.scale.set(1, 1, 1); obj.visible = true;
    configure(obj, slot, floor, L);
  }

  MW.createObject = function (spec, layer) {
    const p = spec.split(':');
    if (p[0] === 'chest') return MW.makeChest(p[1]);
    if (p[0] === 'worker') return MW.makeWorker();
    if (p[0] === 'cart') return MW.makeCart(MW.THEME[layer]);
    if (p[0] === 'decor') return MW.makeDecor(p[1]);
    if (p[0] === 'mineral') return MW.makeMineral(layer);
    return null;
  };

  function populate() {
    MW.Snap.slots.forEach(s => {
      const d = s.def; if (!d.fill) return;
      let o;
      if (s.type === 'chest') o = MW.makeChest(MW.CHEST_TYPES[s.layer]);
      else if (s.type === 'cartRail') o = MW.makeCart(MW.THEME[s.layer]);
      else if (s.type === 'decor') o = MW.makeDecor(typeof d.fill === 'string' ? d.fill : 'rocks');
      else if (s.type === 'mineral') o = MW.makeMineral(s.layer);
      else o = MW.makeWorker();
      const r = MW.Snap.place(o, KIND_OF[s.type], s.x, s.y);
      if (!r.ok) console.warn('slot gagal diisi', s.id, r.reason);
    });
  }

  function updateCart(c, dt) {
    const m = c.userData.m; if (!m || m.ctl) return;
    if (m.min >= m.max) { m.moving = false; return; }
    if (m.wait > 0) { m.wait -= dt; m.moving = false; return; }
    m.moving = true; c.position.x += m.dir * m.speed * dt;
    if (c.position.x >= m.max) { c.position.x = m.max; m.dir = -1; m.wait = 1.6; }
    else if (c.position.x <= m.min) { c.position.x = m.min; m.dir = 1; m.wait = 1.6; }
  }

  MW.buildWorld = function (canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x07060c, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-MW.W / 2, MW.W / 2, MW.H / 2, -MW.H / 2, 0.1, 200);
    camera.position.set(MW.W / 2, MW.H / 2, 50);
    const root = new THREE.Group(); root.name = 'MineWorld'; scene.add(root);
    Object.assign(Wd, { renderer: renderer, scene: scene, camera: camera, root: root });

    /* Lighting */
    const lit = new THREE.Group(); lit.name = 'Lighting'; root.add(lit);
    const amb = new THREE.AmbientLight(0xffffff, 1), dirL = new THREE.DirectionalLight(0xffffff, 0.5);
    dirL.position.set(-8, 14, 20);
    const pl1 = new THREE.PointLight(0xffffff, 0, 36, 1), pl2 = new THREE.PointLight(0xffffff, 0, 36, 1);
    lit.add(amb, dirL, pl1, pl2);
    Wd.lights = { amb: amb, dir: dirL, pl1: pl1, pl2: pl2 };

    /* Layers */
    for (let i = 0; i < MW.LAYERS; i++) {
      const L = MW.buildLayer(i); MW.decor[i](L);
      /* skirt: perpanjang terrain ke kiri/kanan (layar lebih lebar dari 16:9): kiri = salinan geser, kanan = cermin di tepi */
      ['RockWalls', 'BackWall', 'Bricks', 'Minerals', 'GrassCaps'].forEach(n => {
        const m = L.group.getObjectByName(n); if (!m || !m.isInstancedMesh) return;
        const a = m.clone(); a.position.x = -MW.W; a.name = n + 'SkirtL'; L.group.add(a);
        const b = m.clone(); b.scale.x = -1; b.position.x = MW.W * 2; b.name = n + 'SkirtR'; L.group.add(b);
      });
      L.group.userData.sub = { attach_: attach };
      root.add(L.group); Wd.layers.push(L);
    }
    if (Wd.layers[0].light) { root.add(Wd.layers[0].light); }
    /* Manager tiap tambang (muncul setelah direkrut dengan Emerald) */
    for (let i = 1; i < MW.LAYERS; i++) { const m = MW.makeWorker(11 + i, { shirt: 0xf4f4f8, helm: 0x1c1c24, skin: 0xe0ac86, hair: 0x1a1410, pants: 0x1e1e2a, noTool: true }); m.userData.w.rig.setTool(null); m.userData.kind = null; m.position.set(6.3, MW.FLOOR, 0.55); MW.setWorkerMode(m, 'idle', { dir: 1 }); m.visible = false; Wd.layers[i].sub.Buildings.add(m); Wd.layers[i].mgr = m; }
    /* Elevator */
    const lift = MW.buildLift(); root.add(lift.group); Wd.lift = lift;
    Wd.pulley = Wd.layers[0].pulley; lift.pulleyY = Wd.layers[0].pulleyY;
    const rider = MW.makeWorker(2); rider.userData.kind = 'rider'; rider.position.set(0.1, 0.26, 0.1);
    MW.setWorkerMode(rider, 'idle', { dir: 1 }); lift.cab.add(rider); Wd.rider = rider;
    /* Snap + isi awal */
    MW.debris.init(root); MW.logi.initFly(root);
    MW.Snap.build(Wd.layers, root);
    Wd.ready = true;
    populate();
    return Wd;
  };

  const c1 = new THREE.Color(), c2 = new THREE.Color();
  function updateLights(s, t) {
    const lg = Wd.lights, n = MW.LAYERS - 1, sc = Math.max(0, Math.min(n, s));
    const a = Math.min(n - 1, Math.floor(sc)), f = sc - a, A = MW.LCFG[a], B = MW.LCFG[a + 1];
    c1.set(A.ambient[0]); c2.set(B.ambient[0]); lg.amb.color.copy(c1.lerp(c2, f));
    lg.amb.intensity = A.ambient[1] * MW.AMB_KS[a] * (1 - f) + B.ambient[1] * MW.AMB_KS[a + 1] * f;
    lg.dir.intensity = A.dir + (B.dir - A.dir) * f;
    const setP = (pl, idx, w) => {
      const L = MW.LCFG[idx], lay = Wd.layers[idx];
      if (!L.light || w <= 0.001) { pl.intensity = 0; return; }
      const fl = lay.flicker ? 1 + (Math.sin(t * 11 + idx) * 0.5 + Math.sin(t * 27.3) * 0.5) * lay.flicker : 1;
      pl.color.set(L.light.color); pl.distance = L.light.d;
      pl.intensity = L.light.i * MW.LIGHT_K * w * fl;
      pl.position.set(Math.max(Wd.cx + 1, 8), -idx * MW.H + 8.5, 9);
    };
    setP(lg.pl1, a, 1 - f); setP(lg.pl2, a + 1, f);
  }

  MW.tick = function (dt, t) {
    const s = Wd.s;
    Wd.layers.forEach(L => {
      const vis = Math.abs(L.index - s) < 1.5; L.group.visible = vis; if (!vis) { if (L.light) L.light.intensity = 0; return; }
      if (L.update) L.update(t, dt);
      L.anim.forEach(f => f(t)); L.pulse.forEach(f => f(t));
      L.fx.forEach(p => p.userData.update(t, dt));
      const open = L.index === 0 || !MW.data.ready || (MW.data.slots[L.index - 1] && MW.data.slots[L.index - 1].unlocked);
      const rs = open && L.index >= 1 ? MW.data.restOf(L.index) : { resting: false };
      L.resting = rs.resting;
      L.sub.Workers.children.forEach(w => { w.visible = open; w.userData.rest = rs.resting ? rs.kind : null; if (open && w.userData.w) MW.updateWorker(w, t, dt); });
      MW.logi.update(L, dt, t, open, rs.resting);
      L.sub.Carts.visible = open; if (open && !rs.resting) L.sub.Carts.children.forEach(c => updateCart(c, dt)); else if (open) L.sub.Carts.children.forEach(c => { if (c.userData.m) c.userData.m.moving = false; });
      if (L.mgr) { const sd = MW.data.slots[L.index - 1]; L.mgr.visible = open && !!(sd && sd.mgr); if (L.mgr.visible) MW.updateWorker(L.mgr, t, dt); }
      L.sub.Chests.children.forEach(c => {
        const u = c.userData; if (u.update) u.update(t);
        if (u.pop > 0) { u.pop = Math.max(0, u.pop - dt * 2.6); c.scale.y = 1 + Math.sin(u.pop * Math.PI) * 0.2; c.scale.x = c.scale.z = 1 - Math.sin(u.pop * Math.PI) * 0.05; }
      });
      L.sub.Decorations.children.forEach(c => { if (c.userData.update) c.userData.update(t); });
      L.sub.Nodes.children.forEach(n => {
        const u = n.userData; if (u.bx === undefined) return;
        if (u.shake > 0) { u.shake -= dt; n.position.x = u.bx + Math.sin(t * 90) * 0.05 * Math.min(1, u.shake * 4); } else n.position.x = u.bx;
      });
    });
    MW.debris.update(dt); MW.logi.tick(dt);
    if (Wd.rider) MW.updateWorker(Wd.rider, t, dt);
    Wd.lift.update(dt, t, Wd.pulley);
    updateLights(s, t);
    Wd.camera.position.y = MW.H / 2 - s * MW.H + 3.4 * Math.max(0, 1 - Math.abs(s));
    Wd.camera.position.x = Wd.cx;
  };
})();

/* lebar pandang: 32 = seluruh tambang (desktop); 20 = jendela potret (ponsel), lift tetap di kiri */
MW.setViewW = function (w) {
  const Wd = MW.world; Wd.viewW = w;
  Wd.camera.left = -w / 2; Wd.camera.right = w / 2; Wd.camera.updateProjectionMatrix();
  Wd.cxT = w >= MW.W ? MW.W / 2 : Math.max(w / 2, Math.min(MW.W - w / 2, Wd.cxT));
  if (w >= MW.W) Wd.cx = MW.W / 2;
};
})();
