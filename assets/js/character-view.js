/* Tampilan karakter 3D bersama (Lobby, Inventory, Shop, Profil, Teman, Leaderboard, Hadiah Harian).
   Satu sumber model = UT.CharacterData (diekstrak dari gameplay.html), jadi karakter di semua halaman sama dengan gameplay.
   Butuh: assets/js/character-data.js (dan three.js yang dikirim lewat argumen THREE).

   TAMPILAN PEMAIN (sumber kebenaran = halaman Karakter, tersimpan di PlayerData + server lewat AppearanceService):
     UT.CharacterView.make(THREE, 'mine', emote)        karakter pemain ini (rambut, warna, outfit, tubuh) — ikut berubah LIVE saat
                                                        PlayerData berubah (equip/look/server-appearance/tab lain) dan ditarik dari
                                                        server saat halaman dibuka (akun login + mode server)
     UT.CharacterView.make(THREE, {look,equipped,gearDye}, emote)   tampilan pemain lain (mis. baris server room_appearance_get)
     userData.setAppearance(a) mengganti tampilan; userData.unwatch() berhenti berlangganan (hanya mode 'mine')
     UT.CharacterView.mine() / refreshMine() / portrait(THREE, a, {frame:'head'|'bust'|'full', size}) -> dataURL (avatar 2D)
   Rig = UT.CharacterRig (dibangun dari karakter.html lewat tools/character-rig/build.js).

   Mode lama (UT.CharacterData, Steve/Alex bawaan gameplay) tetap ada hanya sebagai cadangan bila rig tidak dimuat:
   UT.CharacterView.make(THREE, skinIdOrKey, emote) -> THREE.Group, userData.anim(t) siap dipanggil tiap frame
     skinIdOrKey : 'skin.steve' | 'steve' | palet dari ItemArt.palette (memakai .gameKey); tak dikenal -> steve
     emote       : 'idle' (default) | 'wave' | 'dance' | 'victory' | 'cheer' | 'laugh' | 'celebrate'
   userData.setEmote(nama) mengganti emote saat jalan (transisi halus, tanpa loncat pose).

   Model dipecah otomatis dari kotak UT.CharacterData menjadi sendi: kepala (leher), mata (kedip), tangan kiri/kanan, kaki kiri/kanan,
   badan. Bentuk & warna tetap sama dengan gameplay. Karakter tanpa tangan (Creeper, Villager) hanya memakai bagian yang ada.
   Gerak = pose target per emote (sama seperti rig lama: tangan melambai, tangan terangkat, kepala mendongak saat tertawa, dst),
   lalu diperhalus (redaman eksponensial) + gerak sekunder: kepala sedikit tertinggal dari badan, tangan mengayun berlawanan,
   kaki bergantian saat dance, squash & stretch saat lompat, kedip acak.
   Ukuran: 1 satuan gameplay = SCALE satuan halaman (kaki di y = FEET). Karakter lebih tinggi (Enderman) tetap lebih tinggi. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.CharacterView) return;

  var SCALE = 6.6, FEET = 0.3, DEFAULT_KEY = 'steve';

  function keyOf(x) {
    var k = x && typeof x === 'object' ? x.gameKey : x;
    if (typeof k === 'string' && k.indexOf('skin.') === 0) k = k.slice(5);
    var CD = UT.CharacterData;
    return CD && k && CD.get('player', k) ? k : DEFAULT_KEY;
  }

  /* Aturan pemecahan bagian tubuh per karakter (satuan gameplay). Kiri/kanan = sisi layar (+x = kanan layar). */
  var RIGS = {
    humanoid: { neck: 0.50, arm: { y: 0.505, x: 0.15, minY: 0.2 }, leg: { y: 0.22, maxY: 0.25, maxX: 0.15 } },
    ender:    { neck: 0.80, arm: { y: 0.88, x: 0.08, minY: 0.3 }, leg: { y: 0.50, maxY: 0.50, maxX: 0.08 } },
    creeper:  { neck: 0.50, arm: null, leg: { y: 0.18, maxY: 0.19, maxX: 9, hop: true } },
    villager: { neck: 0.50, arm: null, leg: { y: 0.22, maxY: 0.22, maxX: 9 } }
  };
  var RIG_OF = { steve: 'humanoid', alex: 'humanoid', zombie: 'humanoid', skeleton: 'humanoid', ender: 'ender', creeper: 'creeper', villager: 'villager' };

  function splitParts(d, rig) {
    var P = { head: [], eyeL: [], eyeR: [], armL: [], armR: [], legL: [], legR: [], body: [] };
    var hb = null, i;
    for (i = 0; i < d.boxes.length; i++) if (d.boxes[i][8] === 3) { hb = d.boxes[i]; break; }
    var hy = hb ? hb[1] : rig.neck + 0.14;
    d.boxes.forEach(function (q) {
      var cx = q[0], cy = q[1], cz = q[2], noEdge = q[7] === 1;
      var isHead = q[8] === 3 || cy > hy + 0.1 || (noEdge && cy >= hy - 0.15 && cy > 0.4);
      if (isHead) {
        var isEye = noEdge && cz >= 0.15 && Math.abs(cx) >= 0.04 && Math.abs(cx) <= 0.08 && Math.abs(cy - hy) < 0.07;
        (isEye ? (cx < 0 ? P.eyeL : P.eyeR) : P.head).push(q);
      } else if (rig.arm && Math.abs(cx) > rig.arm.x && cy > rig.arm.minY) (cx < 0 ? P.armL : P.armR).push(q);
      else if (cy < rig.leg.maxY && Math.abs(cx) < rig.leg.maxX) (cx < 0 ? P.legL : P.legR).push(q);
      else P.body.push(q);
    });
    return P;
  }

  /* pose = semua sudut (radian) / offset yang dipakai rig; tiap emote hanya menghitung target-nya.
     by badan naik-turun · brz/bry badan miring/putar · hx/hy/hz kepala · alz/alx, arz/arx tangan kiri/kanan (z = angkat ke samping, x = ayun depan-belakang)
     llx/lrx kaki · hop lompat (satuan gameplay) · sq squash(-)/stretch(+) */
  var KEYS = ['by', 'brz', 'bry', 'hx', 'hy', 'hz', 'alz', 'alx', 'arz', 'arx', 'llx', 'lrx', 'hop', 'sq'];
  function pose() { var p = {}; KEYS.forEach(function (k) { p[k] = 0; }); return p; }

  var EMOTES = {
    idle: function (t, p) {
      var br = Math.sin(t * 2);
      p.by = br * 0.004; p.sq = br * 0.012;
      p.bry = Math.sin(t * 0.7) * 0.10; p.hy = Math.sin(t * 0.7 - 0.6) * 0.18; p.hx = Math.sin(t * 0.5) * 0.04; p.hz = Math.sin(t * 0.9) * 0.03;
      p.alz = -0.12 - br * 0.02; p.arz = 0.12 + br * 0.02; p.alx = Math.sin(t * 2 - 0.5) * 0.03; p.arx = -p.alx;
      p.hop = Math.sin(t * 1.6) * 0.012;
      if (Math.sin(t * 0.4) > 0.97) p.arz += 1.0; /* sesekali angkat tangan kanan sebentar */
    },
    wave: function (t, p) {
      EMOTES.idle(t, p);
      p.arz = 2.45 + Math.sin(t * 10) * 0.32; p.arx = Math.sin(t * 5) * 0.08;
      p.hz = -0.08 + Math.sin(t * 2) * 0.03; p.brz = Math.sin(t * 2) * 0.03;
    },
    dance: function (t, p) {
      var sw = Math.sin(t * 5), ab = Math.abs(sw);
      p.hop = ab * 0.05; p.sq = (ab - 0.5) * 0.07; p.brz = sw * 0.12; p.bry = Math.sin(t * 2.5) * 0.45;
      p.hz = -sw * 0.12; p.hy = Math.sin(t * 2.5 - 0.7) * 0.25; p.hx = Math.sin(t * 10) * 0.05;
      p.alz = -2.0 + sw * 0.32; p.arz = 2.0 - sw * 0.32; p.alx = Math.sin(t * 5 + 1.2) * 0.25; p.arx = -p.alx;
      p.llx = Math.max(0, sw) * 0.7; p.lrx = Math.max(0, -sw) * 0.7; /* kaki bergantian terangkat */
    },
    victory: function (t, p) {
      var j = Math.abs(Math.sin(t * 4));
      p.hop = j * 0.06; p.sq = (j - 0.5) * 0.08; p.brz = Math.sin(t * 8) * 0.05; p.hx = -0.18; p.hy = Math.sin(t * 2) * 0.15;
      p.alz = -2.75 + Math.sin(t * 8) * 0.12; p.arz = 2.75 - Math.sin(t * 8) * 0.12;
      p.llx = -j * 0.35; p.lrx = j * 0.2;
    },
    cheer: function (t, p) {
      var j = Math.abs(Math.sin(t * 6));
      p.hop = j * 0.07; p.sq = (j - 0.5) * 0.09; p.brz = Math.sin(t * 12) * 0.06; p.hx = -0.15;
      p.alz = -0.3; p.arz = 2.5 + Math.sin(t * 12) * 0.35; p.arx = Math.sin(t * 6) * 0.1;
      p.llx = j * 0.2; p.lrx = -j * 0.2;
    },
    laugh: function (t, p) {
      var s = Math.sin(t * 16);
      p.by = Math.abs(s) * 0.006; p.brz = Math.sin(t * 7) * 0.04; p.bry = Math.sin(t * 1.4) * 0.08;
      p.hx = -0.25 + s * 0.07; p.hz = Math.sin(t * 7) * 0.04; p.sq = s * 0.02;
      p.alz = -0.9 + s * 0.05; p.arz = 0.9 - s * 0.05; p.alx = 0.25; p.arx = 0.25; /* tangan memegang perut */
    },
    celebrate: function (t, p) {
      var j = Math.abs(Math.sin(t * 5));
      p.hop = j * 0.11; p.sq = (j - 0.5) * 0.1; p.brz = Math.sin(t * 5) * 0.08; p.bry = Math.sin(t * 2.5) * 0.3; p.hx = -0.15;
      p.alz = -2.5 + Math.sin(t * 8) * 0.4; p.arz = 2.5 - Math.sin(t * 8) * 0.4;
      p.llx = (Math.sin(t * 5) > 0 ? 1 : 0) * 0.5; p.lrx = (Math.sin(t * 5) < 0 ? 1 : 0) * 0.5;
    }
  };

  /* ---------- Tampilan pemain (rig builder) ---------- */
  var RIG_SCALE = 0.83 * SCALE / 2.0;   /* rig ±2 satuan tinggi; disamakan dengan tinggi Steve lama supaya tata letak halaman tidak bergeser */

  function mine() {
    var PD = win.PlayerData;
    try { return PD && PD.appearance ? PD.appearance() : null; } catch (e) { return null; }
  }

  function makeAppearance(THREE, app, emote) {
    var g = new THREE.Group(), CR = UT.CharacterRig;
    g.userData.setAppearance = function () {}; g.userData.setEmote = function () {}; g.userData.anim = function () {};
    if (!CR) return g;   /* rig tidak dimuat: kosong, bukan error */
    var R = CR.create(THREE, {});
    var holder = new THREE.Group(); holder.scale.setScalar(RIG_SCALE); holder.position.y = FEET; holder.add(R.root); g.add(holder);
    var sig = null, lastT = null;
    function set(a) {
      var s = CR.signature(a);
      if (s === sig) return;
      sig = s; R.setAppearance(a);
    }
    set(app);
    R.setEmote(EMOTES[emote] ? emote : 'idle');
    g.userData.setAppearance = set;
    g.userData.setEmote = function (n) { R.setEmote(EMOTES[n] ? n : 'idle'); };
    g.userData.anim = function (t) {
      var dt = lastT == null ? 0.016 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      R.update(dt);
    };
    g.userData.dispose = function () { if (g.userData.unwatch) g.userData.unwatch(); R.dispose(); };
    g.userData.anim(0);
    return g;
  }

  /* Tarik tampilan aktif dari SERVER (akun login + mode server): AppearanceService.refresh() = inventory dulu, lalu tampilan (server menang), sama seperti
     halaman Karakter. Hasilnya masuk ke PlayerData -> notify('server-appearance') -> semua karakter 'mine' di halaman ikut berubah. */
  var refreshing = null, refreshedAt = 0;
  function refreshMine(force) {
    var PD = win.PlayerData;
    if (!PD || !PD.serverMode || !PD.serverMode()) return Promise.resolve({ ok: false, reason: 'mode-lokal' });
    if (refreshing) return refreshing;
    if (!force && Date.now() - refreshedAt < 15000) return Promise.resolve({ ok: true, cached: true });
    var AS = UT.AppearanceService && UT.AppearanceService.get && UT.AppearanceService.get();
    if (!AS) return Promise.resolve({ ok: false, reason: 'tanpa-layanan' });
    refreshing = AS.refresh().then(function (r) { if (r && r.ok) refreshedAt = Date.now(); return r || { ok: false }; },
      function () { return { ok: false, reason: 'jaringan' }; })
      .then(function (r) { refreshing = null; return r; });
    return refreshing;
  }

  var WATCH = { equip: 1, 'server-appearance': 1, storage: 1, pageshow: 1 };
  function makeMine(THREE, emote) {
    var g = makeAppearance(THREE, mine(), emote), PD = win.PlayerData;
    if (PD && PD.subscribe) {
      g.userData.unwatch = PD.subscribe(function (reason) { if (WATCH[reason]) g.userData.setAppearance(mine()); });
    }
    refreshMine();
    return g;
  }

  function portrait(THREE, app, o) { return UT.CharacterRig ? UT.CharacterRig.portrait(THREE, app, o) : ''; }

  function make(THREE, skin, emote) {
    if (UT.CharacterRig) {
      if (skin === 'mine') return makeMine(THREE, emote);
      if (skin && typeof skin === 'object' && !skin.gameKey && ('look' in skin || 'equipped' in skin)) return makeAppearance(THREE, skin, emote);
    }
    var CD = UT.CharacterData, g = new THREE.Group(), key = keyOf(skin);
    var d = CD && CD.get('player', key);
    function stub() { g.userData.anim = function () {}; g.userData.setEmote = function () {}; return g; }
    if (!d || !d.boxes.length) return stub(); /* data karakter tidak ada: kosong, bukan error */
    var rig = RIGS[RIG_OF[key] || 'humanoid'], P = splitParts(d, rig);

    var root = new THREE.Group(); root.scale.setScalar(SCALE); root.position.y = FEET; g.add(root);
    var bodyG = new THREE.Group(); root.add(bodyG);

    /* part(): kotak -> mesh bersumbu putar di (px,py,pz). Mengembalikan grup pivot yang sudah dipasang di parent. */
    function part(boxes, px, py, pz, parent) {
      var pv = new THREE.Group(); pv.position.set(px, py, pz); parent.add(pv);
      if (boxes.length) {
        var m = CD.mesh(THREE, 'player', key, { boxes: boxes });
        if (m) { m.position.set(-px, -py, -pz); m.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } }); pv.add(m); }
      }
      return pv;
    }
    var sideX = function (boxes, dflt) { return boxes.length ? boxes[0][0] : dflt; };

    part(P.body, 0, 0, 0, bodyG);
    var neck = part(P.head, 0, rig.neck, 0, bodyG);
    var eyeL = null, eyeR = null;
    [['eyeL', 0], ['eyeR', 1]].forEach(function (s) {
      var b = P[s[0]]; if (!b.length) return;
      var cx = b[0][0], cy = b[0][1], cz = b[0][2];
      var e = new THREE.Group(); e.position.set(cx, cy - rig.neck, cz); neck.add(e);
      var m = CD.mesh(THREE, 'player', key, { boxes: b }); m.position.set(-cx, -cy, -cz); e.add(m);
      if (s[1]) eyeR = e; else eyeL = e;
    });
    var armL = null, armR = null;
    if (rig.arm) {
      armL = part(P.armL, sideX(P.armL, -0.2), rig.arm.y, 0, bodyG);
      armR = part(P.armR, sideX(P.armR, 0.2), rig.arm.y, 0, bodyG);
    }
    var legL = part(P.legL, sideX(P.legL, -0.07), rig.leg.y, 0, bodyG);
    var legR = part(P.legR, sideX(P.legR, 0.07), rig.leg.y, 0, bodyG);
    if (rig.leg.hop) { /* Creeper: 4 kaki; kelompokkan per sisi, pivot di tengah */
      legL.position.x = legR.position.x = 0; legL.children.forEach(function (m) { m.position.x = 0; }); legR.children.forEach(function (m) { m.position.x = 0; });
    }

    var cur = pose(), tgt = pose(), kind = EMOTES[emote] ? emote : 'idle', lastT = null, primed = false;
    var nextBlink = 1.5, blinkT = -1;
    g.userData.setEmote = function (n) { kind = EMOTES[n] ? n : 'idle'; };
    g.userData.anim = function (t) {
      var dt = lastT == null ? 0.016 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      var k;
      for (k = 0; k < KEYS.length; k++) tgt[KEYS[k]] = 0;
      EMOTES[kind](t, tgt);
      var a = primed ? 1 - Math.exp(-dt * 14) : 1; primed = true; /* peredaman: pose berpindah mulus; frame pertama langsung pas */
      for (k = 0; k < KEYS.length; k++) cur[KEYS[k]] += (tgt[KEYS[k]] - cur[KEYS[k]]) * a;
      var c = cur;
      root.scale.set(SCALE * (1 - c.sq * 0.5), SCALE * (1 + c.sq), SCALE * (1 - c.sq * 0.5)); /* kaki tetap menapak */
      g.position.y = c.hop * SCALE;
      bodyG.position.y = c.by; bodyG.rotation.set(0, c.bry, c.brz);
      neck.rotation.set(c.hx, c.hy, c.hz);
      if (armL) { armL.rotation.set(c.alx, 0, c.alz); armR.rotation.set(c.arx, 0, c.arz); }
      if (rig.leg.hop) { var h = Math.max(0, Math.sin(t * 1.6)); legL.scale.y = legR.scale.y = 1 + h * 0.06; legL.rotation.x = legR.rotation.x = 0; }
      else { legL.rotation.x = c.llx; legR.rotation.x = c.lrx; }
      /* kedip acak tiap 2-5 dtk (tertutup ~0.14 dtk) */
      if (blinkT < 0 && t >= nextBlink) blinkT = t;
      var sy = 1;
      if (blinkT >= 0) {
        var u = (t - blinkT) / 0.14;
        if (u >= 1) { blinkT = -1; nextBlink = t + 2 + (((Math.sin(t * 12.9898) * 43758.5453) % 1) + 1) % 1 * 3; }
        else sy = Math.max(0.08, Math.abs(u * 2 - 1));
      }
      if (eyeL) eyeL.scale.y = sy;
      if (eyeR) eyeR.scale.y = sy;
    };
    g.userData.anim(0);
    return g;
  }

  UT.CharacterView = { make: make, makeMine: makeMine, makeAppearance: makeAppearance, mine: mine, refreshMine: refreshMine, portrait: portrait, keyOf: keyOf, SCALE: SCALE, emotes: Object.keys(EMOTES) };
})(window);
