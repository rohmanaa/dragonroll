/* tambang-workers.js — pekerja berbasis TambangRig + serpihan batu. API sama dengan versi lama:
   MW.makeWorker(variant) / MW.setWorkerMode(root, mode, o) / MW.updateWorker(root, t, dt) / MW.debris */
(function () {
  'use strict';
  const MW = window.TambangMW = window.TambangMW || {};
  const LOOKS = [
    { shirt: 0xd9732a, helm: 0xf2c230, skin: 0xe0ac86, hair: 0x3a2a1c, pants: 0x2f3a52 },
    { shirt: 0x2f79c4, helm: 0xeaeaea, skin: 0xc68a62, hair: 0x20160e, pants: 0x3a3a46, beard: true },
    { shirt: 0x3f9a55, helm: 0xf08a24, skin: 0x9b6a4a, hair: 0x120c08, pants: 0x4a3a2a },
    { shirt: 0xb8383e, helm: 0xf2c230, skin: 0xf0c8a0, hair: 0x8a5a2a, pants: 0x2f3a52, beard: true },
    { shirt: 0x8a5bc4, helm: 0xeaeaea, skin: 0xe0ac86, hair: 0x5a3a20, pants: 0x383048 }
  ];
  MW._wCount = 0;
  MW.makeWorker = function (variant, custom) {
    const v = variant === undefined ? MW._wCount++ : variant;
    const look = custom || LOOKS[v % LOOKS.length];
    const rig = TambangRig.create(Object.assign({ phase: v * 1.7 }, look));
    if (!custom || !custom.noTool) rig.setTool('pickaxe');
    const root = new THREE.Group(); root.userData.kind = 'worker';
    const face = new THREE.Group(); face.add(rig.root); root.add(face);
    root.userData.w = { v: v, rig: rig, face: face, mode: 'idle', dir: 1, rotY: Math.PI / 2, path: null, cart: null, speed: 1.3, wait: 0, noTool: !!(custom && custom.noTool), nextAct: 0.8 + (v % 3) * 0.4, seen: 0, debrisColor: 0x9a9aa2 };
    face.rotation.y = Math.PI / 2;
    return root;
  };
  MW.setWorkerMode = function (root, mode, o) {
    const w = root.userData.w; o = o || {};
    w.mode = mode; w.path = o.path || null; w.cart = o.cart || null; if (o.dir) w.dir = o.dir;
    w.rig.setTool(w.noTool || mode === 'grab' || mode === 'push' ? null : 'pickaxe');
    w.rig.setMode(mode === 'walk' ? 'walk' : mode === 'push' ? 'push' : 'idle');
    w.seen = w.rig.strikes; w.nextAct = 0.4; w.wait = 0;
  };
  /* ---------- istirahat: makan (berdiri, suap) / tidur (berbaring + Zzz) ---------- */
  const _tex = {};
  function restTex(kind) {
    if (_tex[kind]) return _tex[kind];
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    g.font = '800 46px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = '#1b1030';
    const txt = kind === 'sleep' ? 'Zzz' : '\ud83c\udf56'; g.strokeText(txt, 64, 34); g.fillStyle = kind === 'sleep' ? '#bfe3ff' : '#fff'; g.fillText(txt, 64, 34);
    return (_tex[kind] = new THREE.CanvasTexture(c));
  }
  function restFx(root, w, kind, t, dt) {
    if (!w.rsp) { w.rsp = new THREE.Sprite(new THREE.SpriteMaterial({ map: restTex('sleep'), transparent: true, depthTest: false })); w.rsp.scale.set(1.5, 0.75, 1); w.rsp.renderOrder = 30; root.add(w.rsp); w.rk = 'sleep'; }
    if (kind && w.rk !== kind) { w.rsp.material.map = restTex(kind); w.rsp.material.needsUpdate = true; w.rk = kind; }
    w.rsp.visible = !!kind;
    const lie = kind === 'sleep', k = Math.min(1, dt * 5);
    root.rotation.z += ((lie ? -Math.PI / 2 : 0) - root.rotation.z) * k; w.face.position.x += ((lie ? -0.34 : 0) - w.face.position.x) * k;
    if (kind) { w.rsp.position.set(lie ? 0.2 : 0, lie ? 2.6 : 2.7, 0.2); w.rsp.position.y += Math.sin(t * 2.4) * 0.12; }
  }
  const wp = new THREE.Vector3();
  MW.updateWorker = function (root, t, dt) {
    const w = root.userData.w, rig = w.rig;
    const tgt = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    w.rotY += (tgt - w.rotY) * Math.min(1, dt * 9); w.face.rotation.y = w.rotY;
    const rk = root.userData.rest || null;
    if (rk || w.rsp) { restFx(root, w, rk, t, dt); if (rk) w.wasRest = 1; else if (w.wasRest) { w.wasRest = 0; w.rig.setTool(w.noTool || w.mode === 'grab' || w.mode === 'push' ? null : (w.mode === 'lumber' ? 'axe' : 'pickaxe')); } }
    if (rk) {
      rig.setTool(null);
      if (rk === 'sleep') rig.setMode('idle');
      else { rig.setMode('idle'); w.nextAct -= dt; if (w.nextAct <= 0 && !rig.acting) { rig.act('grab'); w.nextAct = 1.6; } }
      rig.tick(dt); return;
    }
    if (w.mode === 'walk' && w.path) {
      const p = w.path, x = root.position.x;
      if (x >= p.x1 && w.dir > 0) { w.dir = -1; w.wait = 1.2; }
      if (x <= p.x0 && w.dir < 0) { w.dir = 1; w.wait = 1.2; }
      if (w.wait > 0) { w.wait -= dt; rig.setMode('idle'); } else { rig.setMode('walk'); root.position.x += w.dir * w.speed * dt; }
    } else if (w.mode === 'push' && w.cart) {
      const c = w.cart; w.dir = c.dir; rig.setMode(c.moving ? 'push' : 'pushwait');
      const tx = c.obj.position.x - c.dir * 1.45, far = Math.abs(root.position.x - tx);
      root.position.x = far > 0.06 ? root.position.x + (tx - root.position.x) * Math.min(1, dt * 5) : tx;
      root.position.z += ((far > 0.06 ? 0.85 : 0.2) - root.position.z) * Math.min(1, dt * 8);
      if (far > 0.06) rig.setMode('walk');
    } else if (w.mode === 'mine' || w.mode === 'grab') {
      /* slot produksi (layer 1-3): perilaku mengikuti status data tambang: locked | work | full | cheer */
      const D = MW.data, ps = root.userData.prodSlot, st = ps && D && D.ready ? D.status(ps) : 'work';
      const sp = ps && D && D.ready && D.boostLeft(ps) > 0 ? 1.7 : 1;
      w.nextAct -= dt * sp;
      if (st === 'locked') { rig.setTool(null); rig.setMode('idle'); }
      else if (st === 'cheer') { if (w.nextAct <= 0 && !rig.acting) { rig.jump(); rig.act('cheer', 0.9); w.nextAct = 0.9; } }
      else if (st === 'full') { if (w.nextAct <= 0 && !rig.acting) { rig.act('wave'); w.nextAct = 3.2; } }
      else if (w.mode === 'mine') {
        if (w.nextAct <= 0 && !rig.acting) { rig.act('mine'); w.nextAct = 1.3; }
        if (rig.strikes !== w.seen) {
          w.seen = rig.strikes;
          root.getWorldPosition(wp); wp.x += w.dir * 1.25; wp.y += 0.55; wp.z += 0.35;
          MW.debris.spawn(wp, w.debrisColor, 7);
          if (root.userData.node) root.userData.node.userData.shake = 0.25;
        }
      } else if (w.nextAct <= 0 && !rig.acting) { rig.act('grab'); w.nextAct = 2.9; }
      if (st !== 'locked' && w.mode === 'mine' && !rig.tool && st !== 'full' && st !== 'cheer') rig.setTool('pickaxe');
    }
    rig.tick(dt);
  };

  /* ---------- serpihan batu / percikan (satu InstancedMesh) ---------- */
  MW.debris = {
    n: 72, active: 0,
    init: function (scene) {
      this.mesh = new THREE.InstancedMesh(MW.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.n);
      this.mesh.frustumCulled = false;
      this.p = []; for (let i = 0; i < this.n; i++) this.p.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, s: 0.1 });
      this._m = new THREE.Matrix4(); this._c = new THREE.Color(); this._z = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < this.n; i++) { this.mesh.setMatrixAt(i, this._z); this.mesh.setColorAt(i, this._c.set(0xffffff)); }
      scene.add(this.mesh); this.idx = 0;
    },
    spawn: function (pos, color, count) {
      for (let k = 0; k < count; k++) {
        const i = this.idx, p = this.p[i]; this.idx = (this.idx + 1) % this.n;
        p.x = pos.x; p.y = pos.y; p.z = pos.z;
        p.vx = (Math.random() - 0.5) * 4; p.vy = 2 + Math.random() * 3; p.vz = (Math.random() - 0.2) * 1.5;
        p.life = 0.5 + Math.random() * 0.4; p.s = 0.06 + Math.random() * 0.1;
        this.mesh.setColorAt(i, this._c.set(color).multiplyScalar(0.8 + Math.random() * 0.5));
      }
      this.mesh.instanceColor.needsUpdate = true; this.active = 1;
    },
    update: function (dt) {
      if (!this.active) return;
      let any = 0;
      for (let i = 0; i < this.n; i++) {
        const p = this.p[i];
        if (p.life > 0) {
          p.life -= dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          this._m.makeScale(p.s, p.s, p.s).setPosition(p.x, p.y, p.z);
          this.mesh.setMatrixAt(i, p.life > 0 ? this._m : this._z); any = 1;
        }
      }
      this.mesh.instanceMatrix.needsUpdate = true;
      if (!any) this.active = 0;
    }
  };
})();
