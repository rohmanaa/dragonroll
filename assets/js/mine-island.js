/* assets/js/mine-island.js — adegan 3D TAMBANG: satu pulau melayang dengan tiga gua tambang (slot 1..3).
   Tiap gua: tebing batu + mulut gua berrangka kayu, obor, lampu gantung, rel, kereta tambang (muatan emerald = isi tambang), batu bijih, peti, tong, kristal.
   Slot terkunci = mulut gua dipalang papan + gembok.
   Hanya membangun adegan (THREE.Scene + kamera); renderer, DOM, dan data server dipegang tambang.html.

   const I = UT.MineIsland.create(THREE, { makeMiner: (i, k) => Group });   // makeMiner: userData.setEmote(e) & userData.anim(t), tinggi ~5,87
   I.scene, I.cam                      // render: renderer.render(I.scene, I.cam)
   I.fit(w, h)                         // atur kamera agar seluruh pulau muat di layar sebesar w x h
   I.frame(dt, states, speeds)         // states[1..3] = 'locked'|'work'|'full'|'cheer'; speeds[1..3] = pengali animasi
   I.setFill(i, 0..1)  I.burst(i, 'emerald'|'mix', n)  I.select(i)
   I.setCrew(i, 1..3)                  // jumlah penambang di gua i (makin cepat = makin banyak)
   I.pick(ndcX, ndcY) -> 0..3          // gua yang kena ketuk (0 = tidak ada)
   I.project(i, 'head'|'chip') -> {x,y} // posisi layar (NDC -1..1) di atas kepala penambang / label
   I.dispose()
*/
(function (root) {
  'use strict';
  root.UT = root.UT || {};
  root.UT.MineIsland = {
    create: function (THREE, opts) {
      opts = opts || {};
      var seed = 7;
      var rnd = function () { return (seed = (seed * 16807) % 2147483647) / 2147483647; };
      var pick = function (a) { return a[(rnd() * a.length) | 0]; };
      var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

      var GRASS = ['#7b8190', '#6f7685', '#848b99', '#697080']; /* nama lama dipertahankan; kini batu abu-abu, bukan rumput */
      var DIRT = ['#7a5a3a', '#6b4f33', '#5d4630', '#6a5035'];
      var STONE = ['#6b7280', '#5b6270', '#4b5563', '#737a88', '#565d6c'];

      function vox(list) {
        var g = new THREE.BoxGeometry(1, 1, 1), m = new THREE.MeshLambertMaterial({ color: 0xffffff });
        var im = new THREE.InstancedMesh(g, m, list.length), d = new THREE.Object3D(), c = new THREE.Color();
        list.forEach(function (v, k) {
          d.position.set(v[0], v[1], v[2]); d.scale.set(v[4] || 1, v[5] || v[4] || 1, v[6] || v[4] || 1); d.updateMatrix();
          im.setMatrixAt(k, d.matrix); im.setColorAt(k, c.set(v[3]));
        });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        return im;
      }
      function box(w, h, d, color, emissive) {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color, emissive: emissive || 0x000000 }));
      }

      var scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.74));
      var sun = new THREE.DirectionalLight(0xfff2d0, 0.9); sun.position.set(-10, 22, 16); scene.add(sun);
      var cam = new THREE.PerspectiveCamera(30, 1.6, 0.5, 400);
      var G = new THREE.Group(); scene.add(G);

      /* ---- pulau: permukaan rumput elips + lapisan tanah/batu yang menyempit ke bawah ---- */
      var RX = 17.5, RZ = 8.5, land = [], x, z, k;
      var PATH = ['#5d6472', '#566070', '#646b79'], pathCx = [-11, 0, 11], pathFz = [-3, -3, -3];
      var onPath = function (px, pz) { for (var pi = 0; pi < 3; pi++) if (Math.abs(px - pathCx[pi]) <= 3 && pz >= pathFz[pi] + 1 && pz <= pathFz[pi] + 7) return true; return false; };
      for (x = -17; x <= 17; x++) for (z = -8; z <= 8; z++) if (Math.pow(x / RX, 2) + Math.pow(z / RZ, 2) <= 1) land.push([x, -1, z, onPath(x, z) ? pick(PATH) : pick(GRASS)]);
      for (k = 1; k <= 8; k++) {
        var s = 1 - k * 0.105;
        for (x = -17; x <= 17; x++) for (z = -8; z <= 8; z++) if (Math.pow(x / (RX * s), 2) + Math.pow(z / (RZ * s), 2) <= 1) land.push([x, -1 - k, z, pick(STONE)]);
      }
      for (k = 0; k < 7; k++) { /* batu menggantung di bawah pulau */
        var sx = Math.round((rnd() - 0.5) * 14), sz = Math.round((rnd() - 0.5) * 6), len = 2 + ((rnd() * 3) | 0);
        for (var q = 0; q < len; q++) land.push([sx, -10 - q, sz, pick(STONE)]);
      }
      G.add(vox(land));

      /* ---- tiga gua (tebing batu dengan mulut gua menghadap kamera) ---- */
      var MP = [null, { x: -11, fz: -3, h: 6 }, { x: 0, fz: -3, h: 6 }, { x: 11, fz: -3, h: 6 }];   /* ketiga gua sama tinggi & sejajar (seperti gua tengah) */
      var FLANK = [{ x: -22, fz: -3, h: 6 }, { x: 22, fz: -3, h: 6 }];   /* tebing pembatas di luar gua 1 & 3, supaya tiap gua diapit tebing tinggi kiri-kanan */
      var BANNER = [null, 0xe0533d, 0x3d7be0, 0xf0b429];
      var cliffTop = function (m) { return m.h - 0.5; };
      var inOpen = function (dx, y) { return Math.abs(dx) <= 2 && y <= (Math.abs(dx) === 2 ? 2 : 3); };
      function cliffCells(m) {
        var cells = [], y, dx, dz;
        for (y = 0; y < m.h; y++) {
          var W = 5 - Math.floor(y * 0.5), back = 6 - Math.floor(y / 3);
          for (dx = -W; dx <= W; dx++) for (dz = -back; dz <= 0; dz++) {
            if (inOpen(dx, y) && dz >= -2) continue;                      /* rongga mulut gua */
            var col;
            if (inOpen(dx, y) && dz === -3) col = rnd() < 0.14 ? '#2ee86a' : (rnd() < 0.3 ? '#262633' : '#17171f'); /* dinding dalam gua: gelap + urat emerald */
            else if (y === m.h - 1) col = pick(GRASS);
            else { var r = rnd(); col = r < 0.05 ? '#2ee86a' : (r < 0.1 ? '#22232b' : pick(STONE)); }
            cells.push([m.x + dx, y, m.fz + dz, col]);
          }
        }
        return cells;
      }
      MP.forEach(function (m) { if (m) G.add(vox(cliffCells(m))); });
      FLANK.forEach(function (m) { G.add(vox(cliffCells(m))); });
      /* lantai + dasar batu di bawah tebing pembatas (di luar elips pulau) */
      var ext = [];
      for (x = 18; x <= 28; x++) for (z = -8; z <= 8; z++) for (k = 0; k < 3; k++) { ext.push([x, -1 - k, z, k === 0 ? pick(GRASS) : pick(STONE)]); ext.push([-x, -1 - k, z, k === 0 ? pick(GRASS) : pick(STONE)]); }
      G.add(vox(ext));

      /* ---- pohon, awan (dekor pulau) ---- */
      var trees = [], tl = []; /* tanpa pohon: pulau serba batu */
      trees.forEach(function (t) {
        for (var h = 0; h < 3; h++) tl.push([t[0], h, t[1], '#7b5330']);
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) for (var c2 = 0; c2 < 2; c2++) tl.push([t[0] + a, 3 + c2, t[1] + b, pick(['#3f9d3a', '#4aae43', '#358f33'])]);
      });
      if (tl.length) G.add(vox(tl));
      var clouds = [];
      [[-22, 15, -10, 1.3], [12, 17, -14, 1.7], [26, 13, -6, 1.0], [-6, 19, -18, 1.5]].forEach(function (c) {
        var g = new THREE.Group(), n = 4 + ((rnd() * 3) | 0);
        for (var j = 0; j < n; j++) { var b = box(2.6 + rnd() * 2, 1.2 + rnd() * 0.8, 2.4 + rnd(), 0xffffff, 0x555a66); b.position.set(j * 2.2 - n, rnd() * 0.6, (rnd() - 0.5) * 1.4); g.add(b); }
        g.position.set(c[0], c[1], c[2]); g.scale.setScalar(c[3]); G.add(g); clouds.push(g);
      });

      /* ---- unit per gua ---- */
      var UNIT_S = 0.5, units = [null], hits = [], rings = [], sel = 0, glows = [];
      var WOOD = '#8a5a2b', WOOD_D = '#6a4220', IRON = '#5a6270', IRON_D = '#3f4651';
      function makeUnit(i) {
        var m = MP[i];
        /* C = hiasan mulut gua (skala dunia): rangka kayu, obor, lampu gantung, kristal, jamur, papan terkunci */
        var C = new THREE.Group(); C.position.set(m.x, -0.5, m.fz); G.add(C);
        var cv = [
          [-2.7, 1.8, 1, WOOD, 0.7, 4.2, 0.7], [2.7, 1.8, 1, WOOD, 0.7, 4.2, 0.7],         /* tiang rangka */
          [0, 3.95, 1, WOOD_D, 6.6, 0.7, 0.85], [-2.7, 3.1, 1, WOOD_D, 0.5, 0.5, 1.1], [2.7, 3.1, 1, WOOD_D, 0.5, 0.5, 1.1],
          [-1.55, 3.35, 1, WOOD, 0.35, 0.35, 0.35], [1.55, 3.35, 1, WOOD, 0.35, 0.35, 0.35], /* penyangga siku */
          [-3.9, 0.6, 1.6, WOOD, 0.25, 2.2, 0.25], [3.9, 0.6, 1.6, WOOD, 0.25, 2.2, 0.25]  /* tiang obor */
        ];
        for (var k2 = 0; k2 < 7; k2++) { /* jamur di kaki tebing */
          var mx = (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 1.5), mz = 0.6 + rnd() * 1.2;
          cv.push([mx, 0.15, mz, '#e9e4d4', 0.2, 0.5, 0.2], [mx, 0.5, mz, rnd() < 0.5 ? '#d9473a' : '#e0a030', 0.6, 0.3, 0.6]);
        }
        for (var k3 = 0; k3 < 10; k3++) cv.push([(rnd() - 0.5) * 11, 0.0, 0.5 + rnd() * 5, pick(['#8f939c', '#777c86']), 0.3 + rnd() * 0.3, 0.3, 0.3 + rnd() * 0.3]); /* kerikil */
        C.add(vox(cv));
        var flames = [-3.9, 3.9].map(function (fx2) { var fl = box(0.5, 0.7, 0.5, 0xffa030, 0xff7a10); fl.position.set(fx2, 1.95, 1.6); C.add(fl); return fl; });
        var hang = new THREE.Group(); hang.position.set(0, 3.6, 1.15); C.add(hang);
        var lanternBody = box(0.55, 0.7, 0.55, 0xffd25a, 0xffb020); lanternBody.position.y = -0.8; hang.add(lanternBody);
        var chain = box(0.1, 0.8, 0.1, 0x3a3f48); chain.position.y = -0.3; hang.add(chain);
        var crystals = [];
        [[m.x > 0 ? -2.0 : 2.0, 0xff5fd2], [m.x < 0 ? 1.2 : -1.2, 0x5fd2ff], [0.3, 0xb28cff]].forEach(function (cr, j) {
          var oc = new THREE.Mesh(new THREE.OctahedronGeometry(0.55 + j * 0.1), new THREE.MeshLambertMaterial({ color: cr[1], emissive: cr[1], emissiveIntensity: 0.7 }));
          oc.scale.y = 1.7; oc.position.set(cr[0], m.h + 0.9, -1.2 - j * 1.1); C.add(oc); crystals.push(oc);   /* berdiri di puncak tebing */
        });
        /* terkunci: papan bersilang + gembok di mulut gua */
        var lock = new THREE.Group(); lock.position.set(0, 1.9, 1.6); C.add(lock);
        [0.55, -0.55].forEach(function (an) { var pl = box(7, 0.7, 0.3, 0x9a6a3a); pl.rotation.z = an; lock.add(pl); });
        var lb = box(1.7, 1.4, 0.6, 0xffd24d, 0x6a4a00); lb.position.set(0, -0.1, 0.4); lock.add(lb);
        [-0.5, 0.5].forEach(function (sx2) { var sh = box(0.25, 1.0, 0.25, 0xc9ced6); sh.position.set(sx2, 0.95, 0.4); lock.add(sh); });
        var sh3 = box(1.25, 0.25, 0.25, 0xc9ced6); sh3.position.set(0, 1.45, 0.4); lock.add(sh3);
        lock.visible = false;

        /* U = area kerja di depan gua (skala unit): rel, kereta tambang, batu bijih, peti, tong, lampu, penambang */
        var U = new THREE.Group(); U.position.set(m.x, -0.5, m.fz + 3.2); U.rotation.y = -0.05; U.scale.setScalar(UNIT_S); G.add(U);
        var uv = [];
        for (var sl = 0; sl < 10; sl++) uv.push([0, 0.12, -5.4 + sl * 1.2, WOOD_D, 3.0, 0.24, 0.5]);       /* bantalan rel */
        uv.push([-0.85, 0.42, -0.4, '#aab2c0', 0.2, 0.2, 11.4], [0.85, 0.42, -0.4, '#aab2c0', 0.2, 0.2, 11.4]); /* rel */
        uv.push([-3.6, 0.8, -1.4, '#a37a45', 1.7, 1.6, 1.7], [-3.6, 0.8, -1.4, '#7d5a2f', 1.78, 0.18, 1.78], [-3.6, 1.55, -1.4, '#7d5a2f', 1.78, 0.18, 1.78]); /* peti kayu */
        uv.push([-3.8, 2.3, -1.3, '#b98a4e', 1.2, 1.2, 1.2], [-3.8, 2.3, -1.3, '#7d5a2f', 1.26, 0.14, 1.26]);
        uv.push([-5.5, 0.8, 0.2, '#7a4a22', 1.3, 1.6, 1.3], [-5.5, 0.35, 0.2, '#2b2b33', 1.38, 0.16, 1.38], [-5.5, 1.25, 0.2, '#2b2b33', 1.38, 0.16, 1.38]); /* tong */
        for (var pb = 0; pb < 8; pb++) uv.push([5 + rnd() * 3, 0.1, -2.6 + rnd() * 3, pick(STONE), 0.4, 0.3, 0.4]);  /* serpihan batu */
        U.add(vox(uv));
        /* balok bijih emerald (3D): penambang bisa menghadapinya dari sisi kiri, depan, dan kanan */
        var rock = new THREE.Group(); rock.position.set(6.7, 0, -0.5); U.add(rock);
        var rs = [];
        for (var ra = -1; ra <= 1; ra++) for (var rb = -1; rb <= 1; rb++) for (var rh = 0; rh < 3; rh++) { if (rh === 2 && Math.abs(ra) + Math.abs(rb) > 1) continue; rs.push([ra * 1.05, rh * 1.05 + 0.52, rb * 1.05, pick(STONE), 1.02]); }
        rock.add(vox(rs));
        var ore = [];
        [[-1.62, 0.55, -0.5, 0], [-1.62, 1.6, 0.6, 0], [-1.62, 1.1, 1.0, 0], [1.62, 0.55, 0.5, 0], [1.62, 1.6, -0.6, 0], [1.62, 1.1, -1.0, 0],
         [-0.6, 0.55, 1.62, 1], [0.5, 1.6, 1.62, 1], [0.9, 0.7, 1.62, 1], [-0.2, 3.2, 0.1, 2], [0.5, 3.15, -0.5, 2]].forEach(function (p) {
          var o = p[3] === 0 ? box(0.3, 0.46, 0.46, 0x2ee86a, 0x16b84a) : (p[3] === 1 ? box(0.46, 0.46, 0.3, 0x2ee86a, 0x16b84a) : box(0.46, 0.3, 0.46, 0x2ee86a, 0x16b84a));
          o.position.set(p[0], p[1], p[2]); rock.add(o); ore.push(o);
        });
        /* kereta tambang: badan besi, roda, muatan emerald (= isi tambang) */
        var cart = new THREE.Group(); cart.position.set(0, 0, 1.4); U.add(cart);
        var cbody = box(2.3, 1.05, 3.1, 0x5a6270); cbody.position.y = 1.2; cart.add(cbody);
        var crim = box(2.5, 0.22, 3.3, 0x3f4651); crim.position.y = 1.78; cart.add(crim);
        [[-1.18, -1.0], [1.18, -1.0], [-1.18, 1.0], [1.18, 1.0]].forEach(function (w) { var wh = box(0.3, 0.75, 0.75, 0x23262d); wh.position.set(w[0], 0.55, w[1]); cart.add(wh); });
        var chub = box(0.35, 0.2, 3.5, 0x9aa3b2); chub.position.set(0, 0.62, 0); cart.add(chub);
        var pile = [], pileG = new THREE.Group(); pileG.position.set(0, 1.85, 0); cart.add(pileG);
        for (var p = 0; p < 15; p++) {
          var gm = box(0.36, 0.36, 0.36, 0x2ee86a, 0x12a844);
          gm.position.set(((p % 5) - 2) * 0.4, (p % 5 === 2 ? 0.3 : (p % 5 === 1 || p % 5 === 3 ? 0.15 : 0)), (Math.floor(p / 5) - 1) * 0.8);
          gm.rotation.y = rnd() * 1.2; gm.visible = false; pileG.add(gm); pile.push(gm);
        }
        /* lampu tiang */
        var pole = box(0.3, 4.4, 0.3, 0x7b5330); pole.position.set(-2.4, 2.2, -2.4); U.add(pole);
        var lamp = box(0.6, 0.7, 0.6, 0xffd25a, 0xffb020); lamp.position.set(-2.4, 4.7, -2.4); U.add(lamp);
        /* beliung bersandar di peti (hiasan) */
        var lean = new THREE.Group(); lean.position.set(-2.0, 1.2, -1.4); lean.rotation.z = -0.35; U.add(lean);
        var lh = box(0.2, 2.2, 0.2, 0x8a5a2b); lean.add(lh); var lhd = box(0.2, 0.2, 1.3, 0x959eae); lhd.position.y = 1.05; lean.add(lhd);
        /* kru penambang: 1 di sisi kiri balok (utama), tambahan di sisi depan & kanan; jumlah diatur setCrew (kecepatan tinggi = lebih banyak orang) */
        var SPOT = [{ x: 2.5, z: -0.5, ry: 1.45, sx: 5.1, sz: -0.5 }, { x: 6.7, z: 3.3, ry: Math.PI, sx: 6.7, sz: 1.2 }, { x: 10.9, z: -0.5, ry: -1.45, sx: 8.3, sz: -0.5 }];
        var crew = [];
        function addWorker(k) {
          var mn = opts.makeMiner(i, k); mn.position.set(SPOT[k].x, 0, SPOT[k].z); mn.rotation.y = SPOT[k].ry; mn.visible = false; U.add(mn);
          var w = { m: mn, t: k * 0.37, emote: 'mine', lastStrike: 0 }; crew[k] = w; return w;
        }
        var miner = addWorker(0).m; miner.visible = true;
        U.updateMatrixWorld(true); /* ukur setelah skala unit berlaku */
        var bb = new THREE.Box3().setFromObject(miner), H = Math.max(1, (bb.max.y - bb.min.y) / UNIT_S);
        var P = [], pg = new THREE.BoxGeometry(0.22, 0.22, 0.22);
        for (var n = 0; n < 14; n++) { var pm = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: 0x2ee86a, emissive: 0x12a844 })); pm.visible = false; U.add(pm); P.push({ m: pm, vx: 0, vy: 0, vz: 0, life: 0 }); }
        var u = { U: U, C: C, miner: miner, crew: crew, crewN: 1, lock: lock, cart: cart, h: m.h, H: H, t: 0, hit: 0 };
        u.chest = cart; /* nama lama tetap bisa dibaca */
        u.setCrew = function (n) { n = clamp(Math.round(n) || 1, 1, 3); for (var k = 0; k < n; k++) if (!crew[k]) addWorker(k); u.crewN = n; };
        u.burst = function (kind, n2, who) {
          var c = 0, sp0 = SPOT[who || 0];
          for (var j = 0; j < P.length; j++) {
            var pp = P[j]; if (pp.life > 0) continue;
            pp.life = 0.7 + rnd() * 0.4; pp.m.position.set(sp0.sx + (rnd() - 0.5) * 0.4, 1.5 + rnd() * 0.5, sp0.sz + (rnd() - 0.5) * 0.4);
            var dirx = who === 2 ? 1 : (who === 1 ? 0 : -1), dirz = who === 1 ? -1 : 0;
            pp.vx = dirx * (1 + rnd() * 2.2) + (rnd() - 0.5) * 1.2; pp.vy = 2 + rnd() * 3; pp.vz = dirz * (1 + rnd() * 2.2) + (rnd() - 0.5) * 1.6;
            var gr = kind === 'emerald' || rnd() < 0.55;
            pp.m.material.color.set(gr ? 0x2ee86a : 0x8b93a3); pp.m.material.emissive.set(gr ? 0x12a844 : 0x000000); pp.m.visible = true;
            if (++c >= (n2 || 8)) break;
          }
        };
        u.setFill = function (f) { var n3 = Math.min(15, Math.round(clamp(f, 0, 1) * 15)); pile.forEach(function (g, j) { g.visible = j < n3 && !u.locked; }); u.fill = f; };
        u.frame = function (dt, state, sp) {
          var locked = state === 'locked'; u.locked = locked;
          lock.visible = locked; cart.visible = !locked; if (locked) pile.forEach(function (g) { g.visible = false; });
          else u.setFill(u.fill || 0);
          flames.forEach(function (fl, j) { fl.visible = !locked; fl.scale.y = 1 + Math.sin(u.t * 14 + j * 2) * 0.18; fl.material.emissiveIntensity = 0.9 + Math.sin(u.t * 11 + j) * 0.3; });
          lanternBody.material.emissiveIntensity = locked ? 0.1 : 0.9 + Math.sin(u.t * 5) * 0.15;
          hang.rotation.z = I.still ? 0 : Math.sin(u.t * 1.3) * 0.06;
          crystals.forEach(function (cr, j) { cr.material.emissiveIntensity = 0.55 + Math.sin(u.t * 2 + j * 1.7) * 0.3; cr.rotation.y += dt * 0.6; });
          var em = state === 'cheer' ? 'cheer' : state === 'full' ? 'sit' : 'mine';
          crew.forEach(function (w, k) {
            var on = !locked && k < u.crewN; w.m.visible = on; if (!on) return;
            if (em !== w.emote) { w.emote = em; w.m.userData.setEmote(em); }
            w.t += dt * sp; w.m.userData.anim(w.t);
            var sk = w.m.userData.strikes; /* hantaman beliung dihitung rig (tepat saat kena batu) */
            if (typeof sk === 'number' && sk !== w.lastStrike) { w.lastStrike = sk; if (em === 'mine') { u.burst('mix', 5, k); u.hit = 0.14; } }
          });
          u.t += dt * (locked ? 1 : sp);
          rock.position.x = 6.7 + (u.hit > 0 && !I.still ? Math.sin(u.t * 80) * 0.035 : 0); u.hit = Math.max(0, u.hit - dt);
          ore.forEach(function (o) { o.material.emissiveIntensity = 1 + (u.hit > 0 ? 1.4 : 0) + Math.sin(u.t * 3 + o.position.x * 4) * 0.25; });
          lamp.material.emissiveIntensity = 0.9 + Math.sin(u.t * 5) * 0.15;
          cart.position.y = (em === 'mine' && u.hit > 0 && !I.still) ? 0.04 : 0; /* kereta bergetar sedikit saat batu dihantam */
          P.forEach(function (pp) {
            if (pp.life <= 0) return; pp.life -= dt; if (pp.life <= 0) { pp.m.visible = false; return; }
            pp.vy -= 9 * dt; pp.m.position.x += pp.vx * dt; pp.m.position.y += pp.vy * dt; pp.m.position.z += pp.vz * dt; pp.m.rotation.x += dt * 6; pp.m.scale.setScalar(Math.max(0.2, pp.life));
          });
        };
        u.dispose = function () {};
        u.setCrew(1);
        /* kotak ketuk (tak tampak): tebing + area kerja */
        var hb = new THREE.Mesh(new THREE.BoxGeometry(12, m.h + 4, 13), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
        hb.material.visible = false; hb.position.set(m.x, (m.h + 4) / 2 - 0.5, m.fz + 0.5); hb.userData.slot = i; G.add(hb); hits.push(hb);
        /* cincin pilihan di tanah depan gua */
        var ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.8, 32), new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, -0.5 + 0.08, m.fz + 3.2); ring.visible = false; G.add(ring); rings[i] = ring;
        return u;
      }
      [1, 2, 3].forEach(function (i) { units[i] = makeUnit(i); });

      var time = 0, selX = 0, camAsp = 1.6, camD = 45;
      var I = { scene: scene, cam: cam, units: units };

      I.fit = function (w, h) {
        camAsp = (w || 1) / Math.max(1, h || 1); cam.aspect = camAsp;
        var th = Math.tan(cam.fov * Math.PI / 360);
        camD = Math.max(12.6 / th, 19.6 / (th * camAsp)) * 1.03;
        cam.updateProjectionMatrix(); placeCam();
      };
      function placeCam() {
        var ph = 0.3, lx = selX * 0.12;
        cam.position.set(lx, Math.sin(ph) * camD + 0.4, Math.cos(ph) * camD); cam.lookAt(lx, 0.4, 0); cam.updateMatrixWorld(true);
      }
      I.select = function (i) {
        sel = (i >= 1 && i <= 3) ? i : 0; selX = sel ? MP[sel].x : 0;
        rings.forEach(function (r, j) { if (r) r.visible = (j === sel); });
      };
      I.setFill = function (i, f) { if (units[i]) units[i].setFill(f); };
      I.setCrew = function (i, n) { if (units[i]) units[i].setCrew(n); };
      I.burst = function (i, kind, n, who) { if (units[i]) units[i].burst(kind, n, who); };
      I.frame = function (dt, states, speeds) {
        dt = clamp(dt || 0, 0, 0.1); time += dt;
        if (I.still) { G.position.y = 0; G.rotation.y = 0; } else { G.position.y = Math.sin(time * 0.9) * 0.35; G.rotation.y = Math.sin(time * 0.25) * 0.05; } /* pulau melayang pelan (I.still = diam) */
        clouds.forEach(function (c, j) { c.position.x += dt * (0.6 + j * 0.25); if (c.position.x > 36) c.position.x = -36; });
        for (var i = 1; i <= 3; i++) units[i].frame(dt, (states && states[i]) || 'work', (speeds && speeds[i]) || 1);
        rings.forEach(function (r) { if (r && r.visible) r.material.opacity = 0.6 + Math.sin(time * 4) * 0.3; });
        var lx = selX * 0.12; cam.position.x += (lx - cam.position.x) * (1 - Math.exp(-dt * 4)); cam.lookAt(cam.position.x, 0.4, 0);
        cam.updateMatrixWorld(true); G.updateMatrixWorld(true);
      };
      var ray = new THREE.Raycaster();
      I.pick = function (nx, ny) {
        G.updateMatrixWorld(true); cam.updateMatrixWorld(true);
        ray.setFromCamera({ x: nx, y: ny }, cam);
        var h = ray.intersectObjects(hits, false)[0];
        return h ? h.object.userData.slot : 0;
      };
      var v = new THREE.Vector3();
      I.project = function (i, kind) {
        var u = units[i]; if (!u) return { x: 0, y: 0 };
        G.updateMatrixWorld(true); cam.updateMatrixWorld(true);
        v.set(2.5, u.H * (kind === 'chip' ? 1.42 : 1.02), -0.5); u.U.localToWorld(v); v.project(cam);
        return { x: v.x, y: v.y };
      };
      /* ---- tampilan per kartu: satu renderer, tiga viewport berjajar (gua i saja; unit lain disembunyikan) ----
         Dipakai halaman Tambang: tiap kartu menyalin potongannya dari satu kanvas WebGL (satu konteks, bukan tiga). */
      var vcam = new THREE.PerspectiveCamera(30, 1.2, 0.5, 400);
      function placeView(i, asp) {
        var m = MP[i], th = Math.tan(vcam.fov * Math.PI / 360), ph = 0.3;
        var top = m.h + 4.5, bot = -2.2, cy = (top + bot) / 2;
        var d = Math.max((top - bot) / 2 / th, 6.6 / (th * asp)) * 1.04;
        vcam.aspect = asp; vcam.updateProjectionMatrix();
        vcam.position.set(m.x, cy + Math.sin(ph) * d, Math.cos(ph) * d); vcam.lookAt(m.x, cy, 0); vcam.updateMatrixWorld(true);
      }
      I.viewCam = function (i, asp) { placeView(i, asp || 1.2); return vcam; };
      I.renderViews = function (rd, vw, vh) {
        var i, j; G.updateMatrixWorld(true); rd.setScissorTest(true);
        for (i = 1; i <= 3; i++) {
          for (j = 1; j <= 3; j++) { units[j].C.visible = units[j].U.visible = (j === i); }
          placeView(i, vw / Math.max(1, vh));
          rd.setViewport((i - 1) * vw, 0, vw, vh); rd.setScissor((i - 1) * vw, 0, vw, vh);
          rd.render(scene, vcam);
        }
        for (j = 1; j <= 3; j++) { units[j].C.visible = units[j].U.visible = true; }
        rd.setScissorTest(false);
      };
      I.dispose = function () {
        scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
      };
      I.select(0); I.fit(1.6, 1); I.frame(0.016, [null, 'work', 'work', 'work'], [0, 1, 1, 1]);
      return I;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
