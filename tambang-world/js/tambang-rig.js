/* tambang-rig.js — rig karakter pekerja tambang (global: window.TambangRig)
   Mengacu pada UT.BlockyCharacter (assets/js/renderers/blocky-character.js) di repo dragonroll:
   - skala 1 voxel-px = 1/16 satuan, tinggi ~2 satuan, kaki di y=0, menghadap +z
   - hierarki: root > hips > upper > head ; bahu (sh) > siku (el) ; paha (g) > lutut (knee) ; titik genggam `hand`
   - pose = nilai target sudut per sendi, dihaluskan eksponensial tiap tick; aksi sekali ('mine') ditumpuk di atasnya
   Tidak bergantung ItemCatalog / PlayerData. Hanya butuh global THREE (r128).

   const r = TambangRig.create({ skin, shirt, pants, boots, glove, helm, hair, eye, beard });
   r.root                        THREE.Group (belum masuk scene)
   r.setMode('idle'|'walk'|'push'|'pushwait');
   r.setTool('pickaxe'|null);    r.tool = grup alat (atau null)
   r.act('mine'|'grab'[,detik]); r.strikes / r.grabs = jumlah hantaman / pungutan sejauh ini
   r.tick(dt)                    panggil tiap frame
*/
(function () {
  'use strict';
  const NS = window.TambangRig = window.TambangRig || {};
  const S = 1 / 16;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease3 = (t) => t * t * (3 - 2 * t);

  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function shade(c, f) {
    const r = clamp(((c >> 16) & 255) * f, 0, 255) | 0, g = clamp(((c >> 8) & 255) * f, 0, 255) | 0, b = clamp((c & 255) * f, 0, 255) | 0;
    return (r << 16) | (g << 8) | b;
  }

  /* tekstur piksel 1:1 dengan jitter kecil (seperti mkTex di rig repo); di-cache per kunci agar pekerja sewarna berbagi tekstur */
  const TEX = {}, MAT = {};
  function tex(key, w, h, fn, seed) {
    if (TEX[key]) return TEX[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = fn(x, y); if (col === null || col === undefined) continue;
      const k = 1 + (hash(x, y, seed || 1) - 0.5) * 0.14;
      g.fillStyle = 'rgb(' + (clamp(((col >> 16) & 255) * k, 0, 255) | 0) + ',' + (clamp(((col >> 8) & 255) * k, 0, 255) | 0) + ',' + (clamp((col & 255) * k, 0, 255) | 0) + ')';
      g.fillRect(x, y, 1, 1);
    }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return (TEX[key] = t);
  }
  function mapMat(key, w, h, fn, seed) {
    if (MAT[key]) return MAT[key];
    return (MAT[key] = new THREE.MeshLambertMaterial({ map: tex(key, w, h, fn, seed) }));
  }
  function solid(c) { const k = 's' + c; return MAT[k] || (MAT[k] = new THREE.MeshLambertMaterial({ color: c })); }
  function phong(c) { const k = 'p' + c; return MAT[k] || (MAT[k] = new THREE.MeshPhongMaterial({ color: c, shininess: 70, specular: 0x777777 })); }
  function glow(c) { const k = 'g' + c; return MAT[k] || (MAT[k] = new THREE.MeshBasicMaterial({ color: c })); }
  function box(w, h, d, m, x, y, z) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), m);
    o.position.set((x || 0) * S, (y || 0) * S, (z || 0) * S); return o;
  }

  /* ---------- pose: nilai target sudut (rad). Nama kunci sama dengan rig repo ---------- */
  const ACT_MU = { rArmS: -2.6, rElbow: -0.9, rWrist: 1.0, rArmZ: -0.1, lArmS: -2.3, lElbow: -0.9, lArmZ: 0.25, lean: -0.28, twist: -0.2, headX: -0.15, rLegT: 0.25, rKnee: 0.15, lLegT: -0.25, lKnee: 0.2 };
  const ACT_MH = { rArmS: -0.75, rElbow: -0.1, rWrist: -0.7, rArmZ: -0.05, lArmS: -0.95, lElbow: -0.25, lArmZ: 0.2, lean: 0.5, twist: 0.15, headX: 0.3, rLegT: -0.45, rKnee: 0.55, lLegT: 0.4, lKnee: 0.05 };
  /* memungut mineral: berjongkok, badan condong, kedua tangan menjangkau ke depan-bawah */
  const GR_DN = { rArmS: -0.9, rElbow: -0.5, rWrist: 0, rArmZ: -0.12, lArmS: -0.9, lElbow: -0.5, lArmZ: 0.12, lean: 0.75, twist: 0, headX: -0.25, rLegT: -0.85, rKnee: 1.45, lLegT: -0.55, lKnee: 1.25 };
  const GR_UP = { rArmS: -0.5, rElbow: -1.5, rWrist: 0, rArmZ: -0.1, lArmS: -0.5, lElbow: -1.5, lArmZ: 0.1, lean: 0.2, twist: 0, headX: 0, rLegT: -0.2, rKnee: 0.25, lLegT: -0.1, lKnee: 0.15 };
  const PUSH = { rArmS: -1.35, rElbow: -0.15, rWrist: 0.2, rArmZ: -0.12, lArmS: -1.35, lElbow: -0.15, lArmZ: 0.12, lean: 0.3, headX: -0.15 };
  const ACT_CHEER = { rArmS: -3.0, rElbow: -0.2, rWrist: 0.5, rArmZ: -0.35, lArmS: -3.0, lElbow: -0.2, lArmZ: 0.35, lean: -0.1, twist: 0, headX: -0.25 };
  const ACT_WAVE = { rArmS: -2.85, rElbow: -0.4, rWrist: 0.3, rArmZ: -0.55, lArmS: 0.05, lElbow: -0.12, lArmZ: 0.07, lean: 0, twist: 0.1, headX: -0.05, headY: 0.25 };
  const ACT_DUR = { mine: 0.85, grab: 1.5, cheer: 2.4, wave: 2.0 };

  NS.create = function (o) {
    o = o || {};
    const C = {
      skin: o.skin || 0xe0ac86, shirt: o.shirt || 0xd9732a, pants: o.pants || 0x2f3a52, boots: o.boots || 0x3b2a1a,
      glove: o.glove || 0x6a4527, helm: o.helm || 0xf2c230, hair: o.hair || 0x3a2a1c, eye: o.eye || 0x2b4f7a, beard: !!o.beard
    };
    const id = [C.skin, C.shirt, C.pants, C.helm, C.hair, C.beard ? 1 : 0].join('_');
    const skD = shade(C.skin, 0.85), hD = shade(C.hair, 0.6), shD = shade(C.shirt, 0.78), shL = shade(C.shirt, 1.25);
    const LEA = 0x6a4527, LEA_D = 0x4a3019, GOLD = 0xe8bb3c, HIVIS = 0xe6e2c8;

    /* ---- hierarki (sama dengan rig repo) ---- */
    const root = new THREE.Group();
    const hips = new THREE.Group(); root.add(hips);
    const upper = new THREE.Group(); hips.add(upper);
    const head = new THREE.Group(); head.position.y = 12 * S; upper.add(head);
    const mkArm = (side) => { const sh = new THREE.Group(); sh.position.set(side * 6 * S, 10 * S, 0); upper.add(sh); const el = new THREE.Group(); el.position.y = -5 * S; sh.add(el); return { sh, el, side }; };
    const mkLeg = (side) => { const g = new THREE.Group(); g.position.set(side * 2 * S, 0, 0); hips.add(g); const knee = new THREE.Group(); knee.position.y = -6 * S; g.add(knee); return { g, knee, side }; };
    const armL = mkArm(1), armR = mkArm(-1), legL = mkLeg(1), legR = mkLeg(-1);
    const hand = new THREE.Group(); hand.position.y = -5.5 * S; armR.el.add(hand);

    /* ---- badan ---- */
    const shirtP = (x, y) => {
      if (y === 11) return C.pants;
      if (y === 10) return LEA;
      return C.shirt;
    };
    const frontP = (x, y) => {
      if (y === 10 && (x === 3 || x === 4)) return GOLD;              /* gesper sabuk */
      if ((x === 1 || x === 6) && y >= 2 && y <= 8) return HIVIS;     /* strip reflektif rompi kerja */
      if (x === 5 && y === 3) return shD;                             /* saku dada */
      if (y === 1 && (x === 3 || x === 4)) return skD;                /* kerah */
      return shirtP(x, y);
    };
    const backP = (x, y) => ((x === 1 || x === 6) && y >= 2 && y <= 8) ? HIVIS : shirtP(x, y);
    const M = (k, w, h, fn, seed) => mapMat(id + k, w, h, fn, seed);
    const torso = box(8, 12, 4, [
      M('ts1', 4, 12, shirtP, 11), M('ts2', 4, 12, shirtP, 12),
      M('tt', 8, 4, () => C.shirt, 13), M('tb', 8, 4, () => C.pants, 14),
      M('tf', 8, 12, frontP, 15), M('tk', 8, 12, backP, 16)
    ], 0, 6, 0);
    upper.add(torso);
    const sleeveP = (x, y) => y >= 10 ? C.glove : (y === 9 ? shD : C.shirt);
    [armL, armR].forEach((R) => {
      R.sh.add(box(4, 6, 4, [0, 1, 2, 3, 4, 5].map((i) => M('au' + i, 4, 6, (x, y) => sleeveP(x, y), 31 + R.side)), 0, -2, 0));
      R.el.add(box(4, 6, 4, [0, 1, 2, 3, 4, 5].map((i) => M('ae' + i, 4, 6, (x, y) => sleeveP(x, y + 6), 41 + R.side)), 0, -3, 0));
    });
    const legP = (x, y) => y >= 9 ? (y === 11 ? LEA_D : C.boots) : ((y === 6 || y === 7) && x > 0 && x < 3 ? shade(C.pants, 1.18) : C.pants);
    [legL, legR].forEach((R) => {
      R.g.add(box(4, 6, 4, [0, 1, 2, 3, 4, 5].map((i) => M('lu' + i, 4, 6, (x, y) => legP(x, y), 51 + R.side)), 0, -3, 0));
      R.knee.add(box(4, 6, 4, [0, 1, 2, 3, 4, 5].map((i) => M('lk' + i, 4, 6, (x, y) => legP(x, y + 6), 61 + R.side)), 0, -3, 0));
    });

    /* ---- kepala: wajah 8x8 (mata, alis, hidung, mulut) + kedip ---- */
    const faceF = (shut) => (x, y) => {
      const m = x < 4 ? x : 7 - x;
      if ((m === 1 || m === 2) && y === 4) return shut ? shade(C.skin, 0.5) : (m === 1 ? 0xffffff : C.eye);
      if ((m === 1 || m === 2) && y === 3) return hD;
      if (y === 5 && (x === 3 || x === 4)) return skD;
      if (C.beard && y >= 6) return (y === 6 && (x === 3 || x === 4)) ? 0x8c4a3c : hD;
      if (y === 6 && (x === 3 || x === 4)) return 0x8c4a3c;
      if (y === 6 && (x === 1 || x === 6) && !C.beard) return shade(C.skin, 0.92);
      return C.skin;
    };
    const faceOpen = M('fo', 8, 8, faceF(false), 25), faceShut = M('fs', 8, 8, faceF(true), 25);
    const headMesh = box(8, 8, 8, [
      M('hs1', 8, 8, (x, y) => (x === 3 || x === 4) && (y === 4 || y === 5) ? skD : C.skin, 21),
      M('hs2', 8, 8, (x, y) => (x === 3 || x === 4) && (y === 4 || y === 5) ? skD : C.skin, 22),
      M('ht', 8, 8, () => C.hair, 23), M('hb', 8, 8, () => skD, 24),
      faceOpen, M('hk', 8, 8, (x, y) => y < 6 ? C.hair : C.skin, 26)
    ], 0, 4, 0);
    head.add(headMesh);

    /* ---- helm tambang + lampu ---- */
    const helmM = phong(C.helm), helmD = phong(shade(C.helm, 0.78)), helmL = phong(shade(C.helm, 1.2));
    head.add(box(9.2, 3.2, 9.2, helmM, 0, 7.5, 0));
    head.add(box(9.2, 1, 9.2, helmD, 0, 6.1, 0));                 /* lingkar bawah */
    head.add(box(9, 0.9, 3.4, helmD, 0, 6.3, 5.8));               /* visor depan */
    head.add(box(2, 1.4, 9.6, helmL, 0, 9.5, 0));                 /* rusuk atas */
    head.add(box(3.2, 2.6, 1.6, solid(0x2a2a30), 0, 8, 5));       /* rumah lampu */
    head.add(box(2.2, 1.7, 0.7, glow(0xfff2a8), 0, 8, 5.95));     /* lampu helm */

    /* ---- alat: beliung (geometri sama dengan setTool('pickaxe') di rig repo) ---- */
    let toolG = null;
    function setTool(kind) {
      if (toolG) { hand.remove(toolG); toolG = null; }
      if (kind === 'axe') {
        toolG = new THREE.Group(); hand.add(toolG);
        toolG.add(box(1.3, 14, 1.3, solid(LEA), 0, 3.5, 0));
        toolG.add(box(1.4, 2.6, 2.2, phong(0x7d8696), 0, 10.3, 1.2));
        toolG.add(box(0.9, 4.2, 3.6, phong(0xb9c1cd), 0, 10.4, 3.0));
        toolG.add(box(0.7, 3.2, 1.0, phong(0xe3e8ef), 0, 10.4, 5.2));
        return;
      }
      if (kind !== 'pickaxe') return;
      toolG = new THREE.Group(); hand.add(toolG);
      toolG.add(box(1.3, 14, 1.3, solid(LEA), 0, 3.5, 0));
      toolG.add(box(2.0, 2.4, 2.4, phong(0x7d8696), 0, 10.8, 0));
      toolG.add(box(1.1, 1.1, 9.5, phong(0x959eae), 0, 11.1, 0));
      [1, -1].forEach((s) => { toolG.add(box(0.9, 0.9, 2.6, phong(0xb9c1cd), 0, 10.2, s * 5.6)); toolG.add(box(0.8, 0.8, 1.6, phong(0xd3d9e2), 0, 9.4, s * 6.7)); });
    }

    /* ---- pose & animasi ---- */
    let jumpY = 0, vy = 0, air = false;
    let mode = 'idle', level = 0, phase = 0, time = o.phase || 0, act = null, strikeN = 0, grabN = 0;
    let blinkT = 1.5 + Math.random() * 3, blinkClose = 0;
    const P = { rLegT: 0, rKnee: 0, lLegT: 0, lKnee: 0, rLegZ: -0.05, lLegZ: 0.05, rArmS: -0.35, rElbow: -0.6, rWrist: 0, rArmZ: -0.1, lArmS: 0.05, lElbow: -0.12, lArmZ: 0.07, lean: 0, twist: 0, headX: 0, headY: 0 };

    function target() {
      const T = { rLegT: 0, rKnee: 0, lLegT: 0, lKnee: 0, rLegZ: -0.05, lLegZ: 0.05, rArmS: -0.35, rElbow: -0.6, rWrist: 0, rArmZ: -0.1, lArmS: 0.05, lElbow: -0.12, lArmZ: 0.07, lean: 0, twist: 0, headX: 0, headY: 0 };
      const w = clamp(level, 0, 1), idleW = 1 - w, b = Math.sin(time * 2.2);
      T.rArmS += b * 0.025 * idleW; T.lArmS += -b * 0.03 * idleW; T.headX += b * 0.02 * idleW; T.headY += Math.sin(time * 0.7) * 0.1 * idleW;
      if (w > 0.01) {
        const A = 0.62 * w, s = Math.sin(phase);
        T.rLegT = A * s; T.lLegT = -A * s;
        T.rKnee = 0.55 * Math.max(0, -Math.cos(phase)) * w + 0.05 * w; T.lKnee = 0.55 * Math.max(0, Math.cos(phase)) * w + 0.05 * w;
        T.lArmS = 0.55 * w * s; T.lElbow = -0.15 * w;
        T.rArmS = -0.4 - s * 0.15 * w; T.rElbow = -0.5; T.rWrist = 0.05;
        T.lean = 0.04 * w; T.twist = 0.18 * s * w; T.headY = 0; T.headX = -0.04 * w;
      }
      if (mode === 'push' || mode === 'pushwait') { for (const k in PUSH) T[k] = PUSH[k]; T.twist = 0; }
      return T;
    }
    function reach(t, k, z) { return (0.375 * Math.cos(t) + 0.375 * Math.cos(t + k)) * Math.cos(z); }
    function applyRig() {
      legR.g.rotation.set(P.rLegT, 0, P.rLegZ); legR.knee.rotation.x = P.rKnee;
      legL.g.rotation.set(P.lLegT, 0, P.lLegZ); legL.knee.rotation.x = P.lKnee;
      armR.sh.rotation.set(P.rArmS, 0, P.rArmZ); armR.el.rotation.x = P.rElbow;
      armL.sh.rotation.set(P.lArmS, 0, P.lArmZ); armL.el.rotation.x = P.lElbow;
      if (toolG) toolG.rotation.x = 1.6 + P.rWrist * 1.35;
      upper.rotation.set(P.lean, P.twist, 0);
      head.rotation.set(P.headX - P.lean * 0.6, P.headY - P.twist * 0.7, 0);
      /* pinggul turun mengikuti jangkauan kaki agar telapak selalu menapak (sama dengan rig repo) */
      hips.position.y = Math.max(reach(P.rLegT, P.rKnee, P.rLegZ), reach(P.lLegT, P.lKnee, P.lLegZ));
    }
    function applyAct(T, dt) {
      if (!act) return;
      act.t += dt; const u = act.t / act.dur;
      if (u >= 1) { act = null; return; }
      let w = 1; const pose = {};
      if (act.type === 'mine') {
        let m; if (u < 0.3) m = 0; else if (u < 0.42) m = ease3((u - 0.3) / 0.12); else if (u < 0.6) m = 1; else m = 1 - ease3((u - 0.6) / 0.4);
        if (!act.hit && u >= 0.4) { act.hit = true; strikeN++; }
        for (const k in ACT_MU) pose[k] = lerp(ACT_MU[k], ACT_MH[k], m);
      } else if (act.type === 'grab') {
        let m; if (u < 0.35) m = ease3(u / 0.35); else if (u < 0.6) m = 1; else m = 1 - ease3((u - 0.6) / 0.35);
        if (!act.hit && u >= 0.5) { act.hit = true; grabN++; }
        w = ease3(Math.min(1, u / 0.15)) * (1 - ease3(clamp((u - 0.9) / 0.1, 0, 1)));
        for (const k in GR_DN) pose[k] = lerp(GR_UP[k], GR_DN[k], m);
      }
      else if (act.type === 'wave' || act.type === 'cheer') {
        w = Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.2);
        Object.assign(pose, act.type === 'wave' ? ACT_WAVE : ACT_CHEER);
        if (act.type === 'wave') pose.rElbow = -0.4 + Math.sin(act.t * 11) * 0.55;
        else { pose.rArmZ += Math.sin(act.t * 9) * 0.12; pose.lArmZ -= Math.sin(act.t * 9) * 0.12; }
      }
      for (const k in pose) T[k] = lerp(T[k], pose[k], w);
    }
    function blinkStep(dt) {
      blinkT -= dt;
      if (blinkT <= 0) { blinkClose = 0.12; blinkT = 2 + Math.random() * 3.5; }
      const shut = blinkClose > 0; if (blinkClose > 0) blinkClose -= dt;
      headMesh.material[4] = shut ? faceShut : faceOpen;
    }
    function tick(dt) {
      dt = Math.min(Math.max(dt, 0), 0.05); time += dt;
      const tl = (mode === 'walk' || mode === 'push') ? 1 : 0;
      level += (tl - level) * (1 - Math.exp(-dt * 7));
      phase += dt * 6.5;
      const k = 1 - Math.exp(-dt * 12);
      const T = target(); applyAct(T, dt);
      for (const key in T) P[key] += (T[key] - P[key]) * k;
      if (air) { vy -= 22 * dt; jumpY += vy * dt; if (jumpY <= 0) { jumpY = 0; vy = 0; air = false; } }
      root.position.y = jumpY;
      applyRig(); blinkStep(dt);
    }
    function jump() { if (!air) { air = true; vy = 7.2; } }
    function doAct(type, dur) { act = { type: type, t: 0, dur: dur || ACT_DUR[type] || 1, hit: false }; }

    applyRig();
    return {
      root: root, hand: hand, tick: tick, jump: jump, setTool: setTool, act: doAct,
      setMode: function (m) { mode = m; },
      get tool() { return toolG; },
      get strikes() { return strikeN; }, get grabs() { return grabN; }, get acting() { return act ? act.type : null; }
    };
  };
})();
