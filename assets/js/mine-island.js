/* assets/js/mine-island.js — adegan 3D TAMBANG: satu pulau melayang dengan tiga gundukan (slot 1..3).
   Tiap gundukan berisi penambang + batu bijih emerald + peti + lampu; slot terkunci = papan bersilang + gembok.
   Hanya membangun adegan (THREE.Scene + kamera); renderer, DOM, dan data server dipegang tambang.html.

   const I = UT.MineIsland.create(THREE, { makeMiner: i => Group });   // makeMiner: userData.setEmote(e) & userData.anim(t), tinggi ~5,87
   I.scene, I.cam                      // render: renderer.render(I.scene, I.cam)
   I.fit(w, h)                         // atur kamera agar seluruh pulau muat di layar sebesar w x h
   I.frame(dt, states, speeds)         // states[1..3] = 'locked'|'work'|'full'|'cheer'; speeds[1..3] = pengali animasi
   I.setFill(i, 0..1)  I.burst(i, 'emerald'|'mix', n)  I.select(i)
   I.pick(ndcX, ndcY) -> 0..3          // gundukan yang kena ketuk (0 = tidak ada)
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

      var GRASS = ['#6fcf4f', '#62c046', '#76d655', '#58b53f'];
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
      for (x = -17; x <= 17; x++) for (z = -8; z <= 8; z++) if (Math.pow(x / RX, 2) + Math.pow(z / RZ, 2) <= 1) land.push([x, -1, z, pick(GRASS)]);
      for (k = 1; k <= 8; k++) {
        var s = 1 - k * 0.105;
        for (x = -17; x <= 17; x++) for (z = -8; z <= 8; z++) if (Math.pow(x / (RX * s), 2) + Math.pow(z / (RZ * s), 2) <= 1) land.push([x, -1 - k, z, k <= 2 ? pick(DIRT) : pick(STONE)]);
      }
      for (k = 0; k < 7; k++) { /* batu menggantung di bawah pulau */
        var sx = Math.round((rnd() - 0.5) * 14), sz = Math.round((rnd() - 0.5) * 6), len = 2 + ((rnd() * 3) | 0);
        for (var q = 0; q < len; q++) land.push([sx, -10 - q, sz, pick(STONE)]);
      }
      G.add(vox(land));

      /* ---- tiga gundukan (bertingkat, makin tinggi dari slot 1 ke 3) ---- */
      var MP = [null, { x: -10, z: 1, h: 3 }, { x: 0, z: -2, h: 4 }, { x: 10, z: 1, h: 5 }];
      var radius = function (y) { return 5.4 - y * 0.6; };
      var moundTop = function (m) { return m.h - 0.5; };
      MP.forEach(function (m, i) {
        if (!m) return;
        var cells = [];
        for (var y = 0; y < m.h; y++) {
          var R = radius(y);
          for (var dx = -6; dx <= 6; dx++) for (var dz = -6; dz <= 6; dz++) {
            if (dx * dx + dz * dz > R * R) continue;
            var col = y === m.h - 1 ? pick(GRASS) : (y === 0 ? pick(STONE) : (rnd() < 0.12 && Math.abs(dx) + Math.abs(dz) > R * 0.9 ? '#2ee86a' : pick(DIRT)));
            cells.push([m.x + dx, y, m.z + dz, col]);
          }
        }
        G.add(vox(cells));
      });

      /* ---- pohon kecil & awan (dekor) ---- */
      var trees = [[-4.8, 6.5], [4.8, 6.5], [-5, -6.5], [5, -6.5], [0, 7.2]], tl = [];
      trees.forEach(function (t) {
        for (var h = 0; h < 3; h++) tl.push([t[0], h, t[1], '#7b5330']);
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) for (var c2 = 0; c2 < 2; c2++) tl.push([t[0] + a, 3 + c2, t[1] + b, pick(['#3f9d3a', '#4aae43', '#358f33'])]);
      });
      G.add(vox(tl));
      var clouds = [];
      [[-22, 15, -10, 1.3], [12, 17, -14, 1.7], [26, 13, -6, 1.0], [-6, 19, -18, 1.5]].forEach(function (c) {
        var g = new THREE.Group(), n = 4 + ((rnd() * 3) | 0);
        for (var j = 0; j < n; j++) { var b = box(2.6 + rnd() * 2, 1.2 + rnd() * 0.8, 2.4 + rnd(), 0xffffff, 0x555a66); b.position.set(j * 2.2 - n, rnd() * 0.6, (rnd() - 0.5) * 1.4); g.add(b); }
        g.position.set(c[0], c[1], c[2]); g.scale.setScalar(c[3]); G.add(g); clouds.push(g);
      });

      /* ---- unit per gundukan ---- */
      var UNIT_S = 0.5, units = [null], hits = [], rings = [], sel = 0;
      function makeUnit(i) {
        var m = MP[i], U = new THREE.Group();
        U.position.set(m.x, moundTop(m), m.z); U.rotation.y = -0.12; U.scale.setScalar(UNIT_S); G.add(U);
        /* batu bijih emerald */
        var rock = new THREE.Group(); rock.position.set(3.1, 0, -0.9); U.add(rock);
        var rs = []; for (var a = 0; a < 3; a++) for (var b = 0; b < 3 - (a === 2 ? 1 : 0); b++) rs.push([(a - 1) * 1.05, b * 1.05 + 0.52, 0, pick(STONE), 1.02]);
        rock.add(vox(rs));
        var ore = [[-0.55, 0.55, 0.55], [0.35, 1.5, 0.55], [-0.2, 1.75, 0.4], [1.05, 0.45, 0.5], [0.4, 0.5, 0.55], [-0.7, 1.6, 0.5]].map(function (p) {
          var o = box(0.46, 0.46, 0.3, 0x2ee86a, 0x16b84a); o.position.set(p[0], p[1], p[2]); rock.add(o); return o;
        });
        /* peti + tumpukan emerald (bertambah mengikuti isi) */
        var chest = new THREE.Group(); chest.position.set(-3.6, 0, 0.5); chest.rotation.y = 0.35; U.add(chest);
        var cb = box(1.9, 1.1, 1.3, 0x8a5a2b); cb.position.y = 0.55; chest.add(cb);
        var band = box(2, 0.2, 1.4, 0xd9a520); band.position.y = 1.0; chest.add(band);
        var lk = box(0.3, 0.35, 0.15, 0xffd24d); lk.position.set(0, 0.8, 0.7); chest.add(lk);
        var pile = [], pileG = new THREE.Group(); pileG.position.set(0, 1.15, 0); chest.add(pileG);
        for (var p = 0; p < 15; p++) {
          var gm = box(0.34, 0.34, 0.34, 0x2ee86a, 0x12a844);
          gm.position.set(((p % 5) - 2) * 0.34, Math.floor(p / 10) * 0.3, (Math.floor(p / 5) % 2) * 0.34 - 0.17);
          gm.rotation.y = rnd() * 1.2; gm.visible = false; pileG.add(gm); pile.push(gm);
        }
        /* lampu tiang */
        var pole = box(0.3, 5, 0.3, 0x7b5330); pole.position.set(-4.9, 2.5, -1.6); U.add(pole);
        var lamp = box(0.6, 0.7, 0.6, 0xffd25a, 0xffb020); lamp.position.set(-4.9, 5.3, -1.6); U.add(lamp);
        /* terkunci: papan bersilang + gembok */
        var lock = new THREE.Group(); lock.position.set(0, 2.6, 1.6); U.add(lock);
        [0.5, -0.5].forEach(function (an) { var pl = box(10, 0.7, 0.3, 0x9a6a3a); pl.rotation.z = an; lock.add(pl); });
        var body = box(1.6, 1.3, 0.6, 0xffd24d, 0x6a4a00); body.position.set(0, -0.1, 0.4); lock.add(body);
        var sh1 = box(0.25, 1.0, 0.25, 0xc9ced6); sh1.position.set(-0.5, 0.9, 0.4); lock.add(sh1);
        var sh2 = sh1.clone(); sh2.position.x = 0.5; lock.add(sh2);
        var sh3 = box(1.25, 0.25, 0.25, 0xc9ced6); sh3.position.set(0, 1.4, 0.4); lock.add(sh3);
        lock.visible = false;
        /* penambang + kapak */
        var miner = opts.makeMiner(i); miner.position.set(-1.0, 0, 0.5); miner.rotation.y = 1.35; U.add(miner);
        U.updateMatrixWorld(true); /* ukur setelah skala unit berlaku */
        var bb = new THREE.Box3().setFromObject(miner), H = Math.max(1, (bb.max.y - bb.min.y) / UNIT_S);
        var pivot = new THREE.Group(); pivot.position.set(0, H * 0.74, H * 0.16); miner.add(pivot);
        var hd = box(0.2, H * 0.62, 0.2, 0x9a6a3a); hd.position.y = -H * 0.31; pivot.add(hd);
        var ph = box(H * 0.5, 0.28, 0.28, 0xc9d1de); ph.position.y = -H * 0.62; pivot.add(ph);
        var pt = box(0.16, 0.34, 0.3, 0x8995a8); pt.position.set(H * 0.27, -H * 0.62, 0); pivot.add(pt);
        var pt2 = pt.clone(); pt2.position.x = -H * 0.27; pivot.add(pt2);
        /* partikel kepingan batu/emerald */
        var P = [], pg = new THREE.BoxGeometry(0.22, 0.22, 0.22);
        for (var n = 0; n < 22; n++) { var pm = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: 0x2ee86a, emissive: 0x12a844 })); pm.visible = false; U.add(pm); P.push({ m: pm, vx: 0, vy: 0, vz: 0, life: 0 }); }
        var u = { U: U, miner: miner, pivot: pivot, lock: lock, chest: chest, H: H, t: 0, angle: 0, lastC: 0, emote: 'mine', hit: 0 };
        u.burst = function (kind, n2) {
          var c = 0;
          for (var j = 0; j < P.length; j++) {
            var pp = P[j]; if (pp.life > 0) continue;
            pp.life = 0.7 + rnd() * 0.4; pp.m.position.set(2.1 + (rnd() - 0.5) * 0.4, 1.5 + rnd() * 0.5, 0.7);
            pp.vx = 1 + rnd() * 2.6; pp.vy = 2 + rnd() * 3; pp.vz = (rnd() - 0.4) * 2.2;
            var gr = kind === 'emerald' || rnd() < 0.55;
            pp.m.material.color.set(gr ? 0x2ee86a : 0x8b93a3); pp.m.material.emissive.set(gr ? 0x12a844 : 0x000000); pp.m.visible = true;
            if (++c >= (n2 || 8)) break;
          }
        };
        u.setFill = function (f) { var n3 = Math.min(15, Math.round(clamp(f, 0, 1) * 15)); pile.forEach(function (g, j) { g.visible = j < n3 && !u.locked; }); u.fill = f; };
        u.frame = function (dt, state, sp) {
          var locked = state === 'locked'; u.locked = locked;
          miner.visible = !locked; lock.visible = locked; chest.visible = !locked; if (locked) pile.forEach(function (g) { g.visible = false; });
          else u.setFill(u.fill || 0);
          if (!locked) {
            var em = state === 'cheer' ? 'cheer' : state === 'full' ? 'sit' : 'mine';
            if (em !== u.emote) { u.emote = em; miner.userData.setEmote(em); }
            u.t += dt * sp; miner.userData.anim(u.t); pivot.visible = em === 'mine';
            if (em === 'mine') {
              var c = (u.t * 2.4) % 1, sw = c < 0.55 ? Math.pow(c / 0.55, 2) : Math.max(0, 1 - (c - 0.55) / 0.2), tgt = -(0.3 + 2.1 * sw);
              u.angle += (tgt - u.angle) * (1 - Math.exp(-dt * 14)); pivot.rotation.x = u.angle;
              if (u.lastC < 0.74 && c >= 0.74) { u.burst('mix', 5); u.hit = 0.12; }
              u.lastC = c;
            }
          } else u.t += dt;
          rock.position.x = 3.1 + (u.hit > 0 ? Math.sin(u.t * 80) * 0.035 : 0); u.hit = Math.max(0, u.hit - dt);
          ore.forEach(function (o) { o.material.emissiveIntensity = 1 + (u.hit > 0 ? 1.4 : 0) + Math.sin(u.t * 3 + o.position.x * 4) * 0.25; });
          lamp.material.emissiveIntensity = 0.9 + Math.sin(u.t * 5) * 0.15;
          P.forEach(function (pp) {
            if (pp.life <= 0) return; pp.life -= dt; if (pp.life <= 0) { pp.m.visible = false; return; }
            pp.vy -= 9 * dt; pp.m.position.x += pp.vx * dt; pp.m.position.y += pp.vy * dt; pp.m.position.z += pp.vz * dt; pp.m.rotation.x += dt * 6; pp.m.scale.setScalar(Math.max(0.2, pp.life));
          });
        };
        u.dispose = function () {};
        /* kotak ketuk (tak tampak): gundukan + penambang di atasnya */
        var hb = new THREE.Mesh(new THREE.BoxGeometry(10.5, m.h + 5, 10.5), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
        hb.material.visible = false; hb.position.set(m.x, (m.h + 5) / 2 - 0.5, m.z); hb.userData.slot = i; G.add(hb); hits.push(hb);
        /* cincin pilihan di permukaan gundukan */
        var rr = radius(m.h - 1) - 0.25;
        var ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.45, rr, 28), new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, moundTop(m) + 0.07, m.z); ring.visible = false; G.add(ring); rings[i] = ring;
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
      I.burst = function (i, kind, n) { if (units[i]) units[i].burst(kind, n); };
      I.frame = function (dt, states, speeds) {
        dt = clamp(dt || 0, 0, 0.1); time += dt;
        G.position.y = Math.sin(time * 0.9) * 0.35; G.rotation.y = Math.sin(time * 0.25) * 0.05; /* pulau melayang pelan */
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
        v.set(-1.0, u.H * (kind === 'chip' ? 1.42 : 1.02), 0.5); u.U.localToWorld(v); v.project(cam);
        return { x: v.x, y: v.y };
      };
      I.dispose = function () {
        scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
      };
      I.select(0); I.fit(1.6, 1); I.frame(0.016, [null, 'work', 'work', 'work'], [0, 1, 1, 1]);
      return I;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
