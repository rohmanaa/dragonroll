/* ============================================================
   Ksatria Mahkota PVP — Rig Karakter Ksatria, Animasi & SFX
   Diadaptasi dari mockup PVP untuk Ular Tangga Blok
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var UT = window.UT = window.UT || {};
    UT.PvpKnight = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var S = 0.075;

  function pixTex(THREE, base, jitter, size, seed) {
    if (typeof document === 'undefined') return null;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var col = new THREE.Color(base);
    var r = seed * 9301 + 7;
    var rnd = function () { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var k = 1 + (rnd() - 0.5) * jitter;
        var f = function (v) { return Math.max(0, Math.min(255, Math.round(v * 255 * k))); };
        g.fillStyle = 'rgb(' + f(col.r) + ',' + f(col.g) + ',' + f(col.b) + ')';
        g.fillRect(x, y, 1, 1);
      }
    }
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return t;
  }

  function faceTexture(THREE, pal) {
    if (typeof document === 'undefined') return null;
    var c = document.createElement('canvas');
    c.width = c.height = 16;
    var g = c.getContext('2d');
    var px = function (col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w || 1, h || 1); };
    px(pal.skinCss, 0, 0, 16, 16);
    px('#d99f76', 0, 13, 16, 3);
    // poni
    px(pal.hairCss, 0, 0, 16, 3);
    px(pal.hairCss, 0, 3, 3, 2);
    px(pal.hairCss, 13, 3, 3, 2);
    px(pal.hairShadeCss, 6, 3, 4, 1);
    // alis
    px('#2a2230', 2, 6, 5, 1);
    px('#2a2230', 9, 6, 5, 1);
    px('#2a2230', 6, 5, 1, 1);
    px('#2a2230', 9, 5, 1, 1);
    // mata
    px('#ffffff', 3, 8, 3, 2);
    px('#ffffff', 10, 8, 3, 2);
    px(pal.eyeCss, 4, 8, 2, 2);
    px(pal.eyeCss, 10, 8, 2, 2);
    px('#0b0b12', 5, 8, 1, 2);
    px('#0b0b12', 10, 8, 1, 2);
    // hidung & mulut
    px('#c98a63', 7, 10, 2, 2);
    px('#a45f4a', 6, 13, 4, 1);
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return t;
  }

  var DEFAULT_PAL = {
    skin: 0xe3ad84, skinCss: '#e3ad84',
    hair: 0xf0f0f4, hairCss: '#f2f2f4', hairShadeCss: '#d9d9de', eyeCss: '#24324f',
    armor: 0x3a3d4a, armorDark: 0x23252f, cloth: 0x2b2d37,
    gold: 0xe8b830, goldEmissive: 0x4a3200,
    leather: 0x5a3a22, red: 0xb02a2a, redDark: 0x7e1d22,
    blade: 0xffd34a, bladeEmissive: 0x8a5a00,
    gem: 0x4aa8ff, gemEmissive: 0x2a7ad8,
  };

  var RIVAL_PAL = {
    skin: 0xd6a07c, skinCss: '#d6a07c',
    hair: 0x2b2b35, hairCss: '#2b2b35', hairShadeCss: '#1f1f27', eyeCss: '#b02a2a',
    armor: 0x56464e, armorDark: 0x2a2226, cloth: 0x3a2428,
    gold: 0xc42f2f, goldEmissive: 0x400808,
    leather: 0x3a2a2a, red: 0x9b2226, redDark: 0x5e1216,
    blade: 0xe0403a, bladeEmissive: 0x7a0f0f,
    gem: 0xffb04a, gemEmissive: 0xc8741a,
  };

  function createKnight(THREE, opts) {
    THREE = THREE || (typeof window !== 'undefined' ? window.THREE : null);
    if (!THREE) throw new Error('Three.js is required for createKnight');

    var pal = Object.assign({}, DEFAULT_PAL, (opts && opts.palette) || {});
    var mats = [];
    var seed = 1;

    function mat(color, mopts) {
      mopts = mopts || {};
      var tex = pixTex(THREE, color, mopts.jitter === undefined ? 0.16 : mopts.jitter, 8, seed++);
      var m = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: mopts.rough === undefined ? 0.85 : mopts.rough,
        metalness: mopts.metal || 0,
        emissive: new THREE.Color(mopts.emissive || 0x000000),
        emissiveIntensity: mopts.ei === undefined ? 1 : mopts.ei,
        transparent: !!mopts.transparent,
        opacity: mopts.opacity === undefined ? 1 : mopts.opacity,
      });
      m.userData.baseEmissive = m.emissive.clone();
      mats.push(m);
      return m;
    }

    var M = {
      skin: mat(pal.skin, { jitter: 0.06 }),
      hair: mat(pal.hair, { jitter: 0.1 }),
      armor: mat(pal.armor, { metal: 0.35, rough: 0.55 }),
      armorDark: mat(pal.armorDark, { metal: 0.25, rough: 0.65 }),
      cloth: mat(pal.cloth),
      gold: mat(pal.gold, { metal: 0.6, rough: 0.35, emissive: pal.goldEmissive, jitter: 0.1 }),
      leather: mat(pal.leather),
      red: mat(pal.red),
      redDark: mat(pal.redDark),
      blade: mat(pal.blade, { metal: 0.5, rough: 0.3, emissive: pal.bladeEmissive, jitter: 0.08 }),
      gem: mat(pal.gem, { emissive: pal.gemEmissive, jitter: 0.05 }),
    };

    var faceTex = faceTexture(THREE, pal);
    var faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.9 });
    faceMat.userData.baseEmissive = faceMat.emissive.clone();
    mats.push(faceMat);
    var headMats = [M.skin, M.skin, M.skin, M.skin, faceMat, M.skin];

    var meshes = [];
    function box(w, h, d, material, x, y, z, parent) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), material);
      m.position.set((x || 0) * S, (y || 0) * S, (z || 0) * S);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      meshes.push(m);
      return m;
    }
    function pivot(x, y, z, parent) {
      var g = new THREE.Group();
      g.position.set(x * S, y * S, z * S);
      parent.add(g);
      return g;
    }

    var root = new THREE.Group();
    var hips = pivot(0, 12, 0, root);

    // Kaki
    function makeLeg(x) {
      var leg = pivot(x, 0, 0, hips);
      box(4, 12, 4, M.armorDark, 0, -6, 0, leg);
      box(4.5, 2, 4.5, M.gold, 0, -5.2, 0.1, leg);
      box(4.6, 5, 4.8, M.leather, 0, -9.5, 0.1, leg);
      box(4.7, 0.8, 4.9, M.gold, 0, -7, 0.1, leg);
      return leg;
    }
    var legL = makeLeg(2);
    var legR = makeLeg(-2);

    // Badan
    var torso = pivot(0, 0, 0, hips);
    box(8, 12, 4, M.cloth, 0, 6, 0, torso);
    box(8.7, 7, 4.7, M.armor, 0, 8.5, 0, torso);
    box(8.9, 1, 4.9, M.gold, 0, 12.1, 0, torso);
    box(3.2, 3.2, 0.4, M.gold, 0, 9, 2.5, torso);
    box(1.6, 1.6, 0.5, M.red, 0, 9, 2.65, torso);
    box(8.7, 2, 4.7, M.leather, 0, 1.5, 0, torso);
    box(2.2, 1.6, 0.5, M.gold, 0, 1.5, 2.5, torso);

    // Kepala
    var head = pivot(0, 12, 0, torso);
    var headMesh = new THREE.Mesh(new THREE.BoxGeometry(8 * S, 8 * S, 8 * S), headMats);
    headMesh.position.y = 4 * S;
    headMesh.castShadow = true;
    head.add(headMesh);
    meshes.push(headMesh);

    // Rambut
    box(8.8, 1.4, 8.8, M.hair, 0, 8.2, 0, head);
    box(8.8, 7, 1.6, M.hair, 0, 4.4, -4.4, head);
    box(0.8, 5, 8.8, M.hair, 4.4, 5.2, 0, head);
    box(0.8, 5, 8.8, M.hair, -4.4, 5.2, 0, head);
    box(2, 1.6, 1, M.hair, -2.8, 6.6, 4.3, head);
    box(2, 1.6, 1, M.hair, 2.8, 6.6, 4.3, head);
    box(1.6, 1.2, 1, M.hair, 0, 6.8, 4.3, head);

    // Mahkota emas
    box(10, 1.6, 10, M.gold, 0, 7.2, 0, head);
    box(1.6, 2.4, 0.8, M.gold, 0, 8.8, 5.1, head);
    box(1.2, 1.8, 0.8, M.gold, -2.6, 8.4, 5.1, head);
    box(1.2, 1.8, 0.8, M.gold, 2.6, 8.4, 5.1, head);
    box(1.1, 1.1, 0.4, M.gem, 0, 7.2, 5.15, head);
    [-1, 1].forEach(function (s) {
      var w = box(0.7, 3.2, 2.4, M.gold, s * 5.4, 8.6, 0, head);
      w.rotation.z = -s * 0.45;
      var w2 = box(0.7, 2.2, 1.8, M.gold, s * 5.9, 7.6, -1.2, head);
      w2.rotation.z = -s * 0.7;
    });

    // Lengan
    function makeArm(x) {
      var arm = pivot(x, 10, 0, torso);
      box(4, 12, 4, M.armorDark, 0, -4, 0, arm);
      box(4.6, 4.2, 4.6, M.armor, 0, -8, 0, arm);
      box(4.8, 0.8, 4.8, M.gold, 0, -5.8, 0, arm);
      box(5.8, 2.8, 5.8, M.armor, x < 0 ? -0.3 : 0.3, 2.4, 0, arm);
      box(6, 0.7, 6, M.gold, x < 0 ? -0.3 : 0.3, 3.9, 0, arm);
      return arm;
    }
    var armL = makeArm(6);
    var armR = makeArm(-6);

    // Pedang di tangan kanan
    var hand = pivot(0, -9, 0.5, armR);
    var sword = pivot(0, 0, 0, hand);
    hand.rotation.x = 0;
    sword.rotation.x = 1.2;
    box(1.1, 3.6, 1.1, M.leather, 0, 0, 0, sword);
    box(1.8, 1, 1.8, M.gold, 0, -2.2, 0, sword);
    box(5.4, 1, 1.5, M.gold, 0, 2.2, 0, sword);
    box(1.9, 15, 0.7, M.blade, 0, 10.2, 0, sword);
    var tip = box(1.3, 1.6, 0.6, M.blade, 0, 18.5, 0, sword);
    tip.rotation.z = 0;
    var tipPoint = pivot(0, 20, 0, sword);

    // Jubah merah
    var cape1 = pivot(0, 11.5, -2.4, torso);
    box(8.4, 7, 0.8, M.red, 0, -3.5, -0.4, cape1);
    box(10, 1.2, 1.4, M.gold, 0, 0.2, -0.3, cape1);
    var cape2 = pivot(0, -7, 0, cape1);
    box(8.4, 7, 0.8, M.redDark, 0, -3.5, -0.4, cape2);
    box(8.6, 0.8, 1, M.gold, 0, -7, -0.4, cape2);

    // Perisai energi
    var shield = new THREE.Group();
    shield.position.set(0, 17 * S, 7.5 * S);
    shield.visible = false;
    var sMat = new THREE.MeshBasicMaterial({ color: 0x5ab8ff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
    var plate = new THREE.Mesh(new THREE.BoxGeometry(15 * S, 19 * S, 0.8 * S), sMat);
    shield.add(plate);
    var frameMat = new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.9 });
    [[15.8, 1, 0, 10], [15.8, 1, 0, -10], [1, 20, 8, 0], [1, 20, -8, 0]].forEach(function (f) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(f[0] * S, f[1] * S, 1.2 * S), frameMat);
      b.position.set(f[2] * S, f[3] * S, 0);
      shield.add(b);
    });
    root.add(shield);

    root.traverse(function (o) { if (o.isMesh) o.frustumCulled = false; });

    function setFlash(v, color) {
      var c = new THREE.Color(color || 0xff3030);
      for (var j = 0; j < mats.length; j++) {
        mats[j].emissive.copy(mats[j].userData.baseEmissive).lerp(c, v);
      }
    }
    function setGlow(v) {
      M.blade.emissiveIntensity = 1 + v * 4;
      M.gold.emissiveIntensity = 1 + v * 2;
    }

    return {
      root: root, hips: hips, torso: torso, head: head,
      armL: armL, armR: armR, legL: legL, legR: legR,
      cape1: cape1, cape2: cape2, hand: hand, sword: sword,
      tipPoint: tipPoint, shield: shield, setFlash: setFlash,
      setGlow: setGlow, S: S,
      dispose: function () {
        mats.forEach(function (m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    };
  }

  // ============================================================
  // ANIMASI & POSE SYSTEM
  // ============================================================
  var D = { ty: 0, tx: 0, rx: -0.9, ry: 0, rz: -0.25, sw: 1.9, lx: -0.4, lz: 0.25, hy: 0, hiy: 0, ll: 0, rl: 0 };
  var KEYS = Object.keys(D);
  var p = function (o) { return Object.assign({}, D, o); };

  function sample(keys, u) {
    u = Math.max(0, Math.min(1, u));
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (u <= b[0]) {
        var k = b[0] === a[0] ? 1 : (u - a[0]) / (b[0] - a[0]);
        k = k * k * (3 - 2 * k);
        var out = {};
        KEYS.forEach(function (n) { out[n] = a[1][n] + (b[1][n] - a[1][n]) * k; });
        return out;
      }
    }
    return Object.assign({}, keys[keys.length - 1][1]);
  }

  var wind1 = { ty: -1.0, rx: -1.1, rz: -1.0, sw: 2.7, tx: 0.05, ll: 0.3, rl: -0.4, hy: 0.04 };
  var hit1 = { ty: 1.0, rx: -1.5, rz: 0.2, sw: 3.0, tx: 0.15, ll: -0.5, rl: 0.6, hy: 0.06 };

  var POSES = {
    guard: p({}),
    block: p({ rx: -1.3, rz: 0.5, sw: 1.5, lx: -1.2, lz: -0.4, tx: -0.08, hy: 0.22, ll: 0.35, rl: -0.35 }),
    hurt: p({ tx: -0.35, rx: -0.4, sw: 1.2, lx: 0.3, hy: 0.08, ty: 0.2 }),
    dodge: p({ tx: 0.6, rx: -1.2, sw: 2.0, lx: -1.2, hy: 0.5, ll: -0.9, rl: -0.9 }),
    atk: [
      [[0, p(wind1)], [0.3, p(wind1)], [0.55, p(hit1)], [0.75, p(hit1)], [1, p({ ty: 0.4, rx: -1.0, rz: -0.2, sw: 2.2 })]],
      [[0, p(hit1)], [0.3, p(hit1)], [0.55, p({ ty: -1.0, rx: -1.5, rz: -1.0, sw: 3.0, tx: 0.15, ll: 0.5, rl: -0.6, hy: 0.06 })], [0.75, p({ ty: -1.0, rx: -1.5, rz: -1.0, sw: 3.0, tx: 0.15 })], [1, p({ ty: -0.3, rx: -1.0, rz: -0.2, sw: 2.2 })]],
      [[0, p({ ty: 0, rx: -2.9, rz: -0.3, sw: 3.6, tx: -0.25, hy: 0.1, lx: -2.5, lz: 0.2 })], [0.4, p({ ty: 0, rx: -2.9, rz: -0.3, sw: 3.6, tx: -0.25, hy: 0.1, lx: -2.5, lz: 0.2 })], [0.58, p({ ty: 0, rx: -1.25, rz: -0.1, sw: 3.1, tx: 0.5, hy: 0.22, ll: -0.7, rl: 0.7, lx: -0.2 })], [0.8, p({ ty: 0, rx: -1.25, rz: -0.1, sw: 3.1, tx: 0.5, hy: 0.22, ll: -0.7, rl: 0.7 })], [1, p({ rx: -1.0, sw: 2.2 })]],
    ],
    holy: [
      [0, p({ rx: -2.9, rz: -0.3, sw: 3.6, tx: -0.25, lx: -2.6, lz: 0.2, hy: 0.1 })],
      [0.4, p({ rx: -2.9, rz: -0.3, sw: 3.6, tx: -0.3, lx: -2.6, lz: 0.2, hy: 0.12, ll: 0.4, rl: -0.5 })],
      [0.55, p({ rx: -1.25, rz: -0.1, sw: 3.1, tx: 0.55, hy: 0.28, ll: -0.8, rl: 0.8, lx: -0.2 })],
      [0.8, p({ rx: -1.25, rz: -0.1, sw: 3.1, tx: 0.55, hy: 0.28, ll: -0.8, rl: 0.8 })],
      [1, p({})]
    ],
    smite: [
      [0, p({ hy: 0.55, tx: 0.2, rx: -1.0, ll: -0.5, rl: -0.5 })],
      [0.16, p({ hy: 0.55, tx: 0.2, rx: -1.0, ll: -0.5, rl: -0.5 })],
      [0.3, p({ rx: -2.95, rz: -0.2, sw: 3.6, lx: -2.7, lz: 0.2, tx: -0.2, ll: 0.5, rl: -0.3 })],
      [0.55, p({ rx: -2.95, rz: -0.2, sw: 3.6, lx: -2.7, lz: 0.2, tx: -0.2, ll: 0.5, rl: -0.3 })],
      [0.62, p({ rx: -1.15, rz: 0, sw: 3.1, tx: 0.6, hy: 0.4, ll: -0.7, rl: 0.7 })],
      [0.85, p({ rx: -1.15, rz: 0, sw: 3.1, tx: 0.55, hy: 0.4, ll: -0.7, rl: 0.7 })],
      [1, p({})]
    ],
    ko: p({ tx: -0.7, rx: -0.3, rz: -1.3, sw: 1.0, lx: 0.2, lz: 1.4, hy: 0.1, ll: 0.5, rl: -0.4 }),
    win: p({ rx: -3.0, rz: -0.3, sw: 3.6, tx: -0.15, lx: -0.6, lz: 0.5, hy: 0.04 }),
  };

  function applyPose(kn, cur, tgt, dt, rate) {
    var k = 1 - Math.exp(-rate * dt);
    KEYS.forEach(function (n) { cur[n] += (tgt[n] - cur[n]) * k; });
    kn.torso.rotation.set(cur.tx, cur.ty, 0);
    kn.head.rotation.set(-cur.tx * 0.6, -cur.ty * 0.55, 0);
    kn.armR.rotation.set(cur.rx, cur.ry, cur.rz);
    kn.sword.rotation.x = cur.sw;
    kn.armL.rotation.set(cur.lx, 0, cur.lz);
    kn.legL.rotation.x = cur.ll;
    kn.legR.rotation.x = cur.rl;
    kn.hips.position.y = (12 - cur.hy * 10) * kn.S;
    kn.hips.rotation.y = cur.hiy;
  }

  // ============================================================
  // WEBAUDIO SFX SYNTHESIZER (murni WebAudio, tanpa file audio)
  // ============================================================
  var AC = null;
  var sfxEnabled = true;

  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!AC) {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) AC = new AudioCtx();
      } catch (e) {}
    }
    if (AC && AC.state === 'suspended') {
      AC.resume().catch(function () {});
    }
    return AC;
  }

  function tone(f, d, type, vol, slide, delay) {
    if (!sfxEnabled) return;
    var a = getAudioContext();
    if (!a) return;
    try {
      var t = a.currentTime + (delay || 0);
      var o = a.createOscillator();
      var g = a.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
      g.gain.setValueAtTime(vol || 0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + d + 0.03);
    } catch (e) {}
  }

  function noise(d, vol, freq, delay) {
    if (!sfxEnabled) return;
    var a = getAudioContext();
    if (!a) return;
    try {
      var t = a.currentTime + (delay || 0);
      var n = Math.floor(a.sampleRate * d);
      var buf = a.createBuffer(1, n, a.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = a.createBufferSource();
      var fl = a.createBiquadFilter();
      var g = a.createGain();
      s.buffer = buf;
      fl.type = 'bandpass';
      fl.frequency.value = freq || 1500;
      g.gain.value = vol || 0.15;
      s.connect(fl);
      fl.connect(g);
      g.connect(a.destination);
      s.start(t);
    } catch (e) {}
  }

  var SFX = {
    enable: function (v) { sfxEnabled = !!v; },
    isEnabled: function () { return sfxEnabled; },
    roll: function () {
      for (var i = 0; i < 9; i++) {
        noise(0.05, 0.12, 1400 + Math.random() * 2200, i * 0.11);
        tone(300 + Math.random() * 300, 0.04, 'square', 0.03, 0, i * 0.11);
      }
    },
    land: function () {
      tone(180, 0.12, 'triangle', 0.12, 70);
      noise(0.08, 0.12, 900);
    },
    hit: function () {
      noise(0.12, 0.3, 1100);
      tone(160, 0.14, 'sawtooth', 0.1, 60);
    },
    crit: function () {
      noise(0.2, 0.4, 900);
      tone(120, 0.25, 'sawtooth', 0.14, 40);
      tone(880, 0.18, 'square', 0.07, 1500, 0.02);
      tone(1320, 0.2, 'square', 0.05, 1800, 0.08);
    },
    berserk: function () {
      noise(0.3, 0.4, 500);
      tone(90, 0.4, 'sawtooth', 0.16, 40);
      tone(180, 0.3, 'square', 0.06, 60);
    },
    block: function () {
      tone(1400, 0.18, 'triangle', 0.1, 900);
      noise(0.06, 0.18, 3500);
    },
    guard: function () {
      tone(520, 0.12, 'triangle', 0.07, 700);
    },
    heal: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone(f, 0.18, 'triangle', 0.07, 0, i * 0.07);
      });
    },
    thud: function () {
      tone(90, 0.18, 'sine', 0.2, 40);
      noise(0.1, 0.18, 400);
    },
    ko: function () {
      noise(0.45, 0.5, 600);
      tone(200, 0.9, 'sawtooth', 0.14, 35);
    },
    defeat: function () {
      [392, 330, 262, 196].forEach(function (f, i) {
        tone(f, 0.4, 'triangle', 0.1, 0, 0.1 + i * 0.28);
      });
    },
    victory: function () {
      [523, 659, 784, 1046, 784, 1046, 1318].forEach(function (f, i) {
        tone(f, 0.24, 'square', 0.06, 0, i * 0.13);
      });
    }
  };

  return {
    createKnight: createKnight,
    DEFAULT_PAL: DEFAULT_PAL,
    RIVAL_PAL: RIVAL_PAL,
    POSES: POSES,
    sample: sample,
    applyPose: applyPose,
    newPose: function () { return Object.assign({}, D); },
    SFX: SFX
  };
});
