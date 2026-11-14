/* Dice Throw — dadu 3D di dunia game: DILEMPAR bidak lalu jatuh di dekat bidak.
   Hanya VISUAL. Angka final (1..6) tetap dari gameplay (main.js); modul ini cuma menampilkan lemparan yang berakhir di angka itu.
   Indikator hasil dekat profil (#dieScene via UT.GameplayDiceUI) tetap dipakai oleh main.js: ditampilkan saat dadu mendarat.
   Classic script. Butuh global THREE (three.min.js). Namespace: UT.GameplayDiceThrow.
   API:
     init(scene)                          — pasang ke scene dunia (idempoten)
     throwFrom(pawnPos, v, opt) -> Promise — lempar dari posisi bidak (THREE.Vector3), mendarat dengan muka atas = v.
                                             Utama: DiceKit asli (skin + efek aura/partikel/suara = sama dengan dadu.html) di panggung overlay yang
                                             terbang dari bidak ke dekatnya. Cadangan (DiceKit belum siap): dadu kubus sederhana di dunia 3D.
                                             opt: {camera, canvas, onThrow(), onBounce(speed), onLand(), reduce, hold}
     setSkin(key) / setSound(on) / setVolume(0..1) — ikut pengaturan gameplay
     showNumber(v) / hideNumber()         — angka hasil di atas tombol emote
     skip()                               — paksa dadu langsung rebah di angkanya (dipanggil bila terlalu lama)
     ready                                — true bila siap */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayDiceThrow) return;

  var S = 0.5;                  /* sisi dadu (unit dunia; 1 petak ~ 1 unit): dadu = objek 3D di dunia game, ikut zoom/kamera seperti bidak */
  var scene = null, die = null, shadow = null, mats = null, busy = null, throwId = 0;

  /* urutan muka BoxGeometry three: +x, -x, +y, -y, +z, -z  -> angka standar (sisi berhadapan = 7) */
  var FACE_VAL = [2, 5, 1, 6, 3, 4];   /* sama dengan D6_FACES DiceKit: +x,-x,+y,-y,+z,-z */
  var PIPS = {
    1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]],
    4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
    5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]],
    6: [[.3, .25], [.3, .5], [.3, .75], [.7, .25], [.7, .5], [.7, .75]]
  };

  function faceTex(n, base) {
    var c = doc.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
    g.fillStyle = n === 1 ? '#d02a2a' : '#1c1c22';
    PIPS[n].forEach(function (p) { g.beginPath(); g.arc(p[0] * 128, p[1] * 128, n === 1 ? 15 : 11, 0, 6.2832); g.fill(); });
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  /* kubus bersudut membulat (tanpa addon): titik dijepit ke kotak dalam lalu didorong keluar sejauh radius; UV & 6 grup muka tetap */
  function roundedCube(size, r, seg) {
    var g = new THREE.BoxGeometry(size, size, size, seg, seg, seg), pos = g.attributes.position, nor = g.attributes.normal, h = size / 2 - r;
    var v = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
      d.copy(v).sub(c);
      if (d.lengthSq() > 1e-10) { d.normalize(); nor.setXYZ(i, d.x, d.y, d.z); pos.setXYZ(i, c.x + d.x * r, c.y + d.y * r, c.z + d.z * r); }
    }
    return g;
  }

  function build(color) {
    mats = FACE_VAL.map(function (n) { return new THREE.MeshStandardMaterial({ map: faceTex(n, color || '#f4efe4'), roughness: 0.55, metalness: 0 }); });
    die = new THREE.Mesh(roundedCube(S, S * 0.11, 12), mats);
    die.castShadow = true; die.visible = false; die.renderOrder = 5;
    shadow = new THREE.Mesh(new THREE.CircleGeometry(S * 0.62, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.visible = false;
    scene.add(die); scene.add(shadow);
  }

  /* ---------- Skin dadu: tekstur/material PERSIS DiceKit (paintFace + katalog), dipasang ke mesh 3D dunia ---------- */
  var kmods = null;
  function loadMods() {
    if (!kmods) {
      var b = doc.baseURI;
      kmods = Promise.all([import(new URL('assets/js/dice-kit/DiceTextures.js', b).href), import(new URL('assets/js/dice-kit/DiceCatalog.js', b).href)])
        .catch(function (e) { console.error('[dice-throw] skin DiceKit gagal dimuat', e); return null; });
    }
    return kmods;
  }
  function applySkin(key) {
    return loadMods().then(function (m) {
      if (!m || !die) return;
      var T = m[0], C = m[1], d = C.getDice(key) || C.getDice('klasik');
      if (!d) return;
      var mm = d.material, ee = d.effect || {};
      var nm = C.D6_FACES.map(function (face) {
        var pf = T.paintFace(d, face.value, 256, true);
        var map = new THREE.CanvasTexture(pf.canvas); map.anisotropy = 4;
        var em = pf.glow ? new THREE.CanvasTexture(pf.glow) : map;
        return new THREE.MeshStandardMaterial({
          map: map, roughness: mm.roughness == null ? 0.6 : mm.roughness, metalness: Math.min(mm.metalness || 0, 0.4),
          emissive: new THREE.Color(mm.emissive || ee.glowColor || '#ffffff'), emissiveMap: em, emissiveIntensity: Math.min(ee.emissiveIntensity || 0, 0.5)
        });
      });
      var old = mats; die.material = nm; mats = nm;
      old.forEach(function (o) { if (o.map) o.map.dispose(); o.dispose(); });
    });
  }

  /* quaternion yang membuat muka bernilai v menghadap ke atas (+y) */
  function quatForTop(v, yaw) {
    var idx = FACE_VAL.indexOf(v);
    var nrm = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][idx];
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(nrm[0], nrm[1], nrm[2]), new THREE.Vector3(0, 1, 0));
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw || 0).multiply(q);
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  /* titik mendarat: di dekat bidak, di sisi yang menghadap ke kamera supaya terlihat */
  function landSpot(from, camera) {
    var a = Math.random() * 6.2832;
    if (camera) { var dx = camera.position.x - from.x, dz = camera.position.z - from.z, d = Math.hypot(dx, dz) || 1; a = Math.atan2(dz, dx) + (Math.random() - 0.5) * 1.6; }
    var r = 0.7 + Math.random() * 0.35;
    return new THREE.Vector3(from.x + Math.cos(a) * r, from.y, from.z + Math.sin(a) * r);
  }

  function init(sc) {
    if (scene) return true;
    if (!sc || !win.THREE) return false;
    scene = sc; build(); applySkin(kwant.key);
    UT.GameplayDiceThrow.ready = true;
    return true;
  }

  /* Dadu = objek 3D di dunia game (Three.js scene), dilempar dari tangan bidak, terbang melengkung, memantul 2x, rebah di PAPAN
     (opt.land = titik petak di depan bidak). Ikut kamera/zoom/geser seperti bidak, tertutup objek di depannya (depth test). */
  function worldThrow(pawnPos, v, opt) {
    opt = opt || {};
    if (!die || !(v >= 1 && v <= 6)) return Promise.resolve(v);
    if (busy) busy.finish();
    var id = ++throwId;
    var from = pawnPos.clone(); from.y += 0.75;                 /* tinggi tangan bidak */
    var base = opt.land ? opt.land.clone() : landSpot(pawnPos, opt.camera);
    var floorY = base.y + S / 2, groundY = base.y + 0.02;
    var to = new THREE.Vector3(base.x + (Math.random() - 0.5) * 0.16, floorY, base.z + (Math.random() - 0.5) * 0.16);
    var dx = to.x - from.x, dz = to.z - from.z, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
    var p1 = { x: to.x - ux * 0.55, z: to.z - uz * 0.55 }, p2 = { x: to.x - ux * 0.18, z: to.z - uz * 0.18 };
    var f = opt.reduce ? 0.02 : 1;
    var segs = [
      { x0: from.x, z0: from.z, y0: from.y, x1: p1.x, z1: p1.z, y1: floorY, H: 0.95, t: 0.64 * f },   /* terbang dari tangan */
      { x0: p1.x, z0: p1.z, y0: floorY, x1: p2.x, z1: p2.z, y1: floorY, H: 0.34, t: 0.26 * f },       /* pantul 1 */
      { x0: p2.x, z0: p2.z, y0: floorY, x1: to.x, z1: to.z, y1: floorY, H: 0.1, t: 0.17 * f }          /* pantul 2 lalu diam */
    ];
    var total = segs[0].t + segs[1].t + segs[2].t;
    var yaw = Math.random() * 6.2832;
    var qEnd = quatForTop(v, yaw);
    var spin = new THREE.Quaternion(); var axis = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
    var turns = 3 + Math.random() * 1.5;
    var lastSeg = -1, done = false, t0 = performance.now(), raf = 0;

    die.visible = true; shadow.visible = true;
    die.scale.setScalar(1); mats.forEach(function (m) { m.transparent = false; m.opacity = 1; });

    return new Promise(function (resolve) {
      function place(el) {
        var g = Math.min(1, el / total), si = el < segs[0].t ? 0 : (el < segs[0].t + segs[1].t ? 1 : 2);
        var s0 = segs[si], st = si === 0 ? 0 : (si === 1 ? segs[0].t : segs[0].t + segs[1].t);
        var k = Math.min(1, (el - st) / s0.t);
        if (si !== lastSeg) { if (si > 0) { try { opt.onBounce && opt.onBounce(1); } catch (e) { console.error(e); } } lastSeg = si; }
        var x = s0.x0 + (s0.x1 - s0.x0) * k, z = s0.z0 + (s0.z1 - s0.z0) * k;
        var y = Math.max(floorY, s0.y0 + (s0.y1 - s0.y0) * k + Math.sin(Math.PI * k) * s0.H);
        die.position.set(x, y, z);
        var h = Math.max(0, y - floorY);
        shadow.position.set(x, groundY, z);
        shadow.material.opacity = 0.34 * (1 - Math.min(1, h / 1.5));
        shadow.scale.setScalar(1 + h * 0.25);
        var spinK = (1 - g) * (1 - g);                            /* putaran melambat lalu menyatu ke muka v di atas */
        spin.setFromAxisAngle(axis, spinK * turns * 6.2832);
        die.quaternion.copy(qEnd).premultiply(spin);
      }
      function land() {
        if (done || id !== throwId) return; done = true;
        cancelAnimationFrame(raf);
        die.position.set(to.x, floorY, to.z); die.quaternion.copy(qEnd);
        shadow.position.set(to.x, groundY, to.z); shadow.material.opacity = 0.3; shadow.scale.setScalar(1);
        try { opt.onLand && opt.onLand(); } catch (e) { console.error(e); }
        var hold = opt.reduce ? 0 : (opt.hold == null ? 1500 : opt.hold);
        setTimeout(function () { fade(); }, hold);
        busy = null; resolve(v);                                /* pemanggil lanjut saat mendarat (bidak jalan sambil dadu memudar) */
      }
      function fade() {
        if (id !== throwId) return;
        var s0 = performance.now(), D = 350;
        (function f() {
          if (id !== throwId) return;
          if (!die || busy) return;
          var k = Math.min(1, (performance.now() - s0) / D);
          mats.forEach(function (m) { m.transparent = true; m.opacity = 1 - k; });
          shadow.material.opacity = 0.3 * (1 - k); die.scale.setScalar(1 - 0.25 * k);
          if (k < 1) requestAnimationFrame(f); else hide();
        })();
      }
      function hide() {
        if (id !== throwId) return;
        die.visible = false; shadow.visible = false; mats.forEach(function (m) { m.opacity = 1; m.transparent = false; }); die.scale.setScalar(1);
      }
      function frame() {
        if (done) return;
        var el = (performance.now() - t0) / 1000;
        place(Math.min(el, total));
        if (el >= total) { land(); return; }
        raf = requestAnimationFrame(frame);
      }
      busy = { finish: function () { if (!done && id === throwId) land(); } };
      try { opt.onThrow && opt.onThrow(); } catch (e) { console.error(e); }
      raf = requestAnimationFrame(frame);
    });
  }


  /* ---------- Panggung DiceKit (dadu asli dadu.html) sebagai overlay layar ---------- */
  var KW = 300, KH = 260, KDY = 8, KSC = 1 / 1.2; /* KSC: dadu 1,2x lebih kecil */
  var kit = null, kstage = null, kfail = false, kwant = { key: 'klasik', sound: true, volume: 1 }, kanim = null, kfadeAnim = null, khide = 0, kfade = 0, kitThrowId = 0, ktrack = 0;

  function kmount() {
    if (kit || kfail || !win.DiceKit || !win.DiceKit.mount) return;
    try {
      kstage = doc.createElement('div');
      kstage.id = 'diceThrowStage'; kstage.setAttribute('aria-hidden', 'true');
      kstage.style.cssText = 'position:fixed;left:0;top:0;width:' + KW + 'px;height:' + KH + 'px;pointer-events:none;z-index:40;visibility:hidden;opacity:0;will-change:transform,opacity;';
      doc.body.appendChild(kstage);
      kit = win.DiceKit.mount(kstage, {
        diceId: win.DiceKit.has(kwant.key) ? kwant.key : 'klasik', quality: 'auto', sound: kwant.sound,
        pad: false, dieScale: 1.4, speed: 1.7, camScale: 0.5, lookY: 0.6, bounds: { x: 1.3, z: 1.1 }
      });
      kit.setVolume(kwant.volume);
      kit.stop();                                             /* hemat GPU: jalan hanya saat lemparan */
      UT.GameplayDiceThrow.kitReady = true;
    } catch (e) { kfail = true; kit = null; console.error('[dice-throw] DiceKit gagal dipasang', e); }
  }

  function project(world, opt) {
    var v = world.clone().project(opt.camera), r = (opt.canvas || doc.body).getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }

  function kitThrow(pawnPos, v, opt) {
    clearTimeout(khide);
    clearTimeout(kfade);
    var id = ++kitThrowId;
    if (kit && kit.busy) { try { kit.finish(); } catch (e) { } }
    if (kfadeAnim) { try { kfadeAnim.cancel(); } catch (e) { } kfadeAnim = null; }
    if (kanim) { try { kanim.cancel(); } catch (e) { } }
    if (kstage && kstage.getAnimations) {
      kstage.getAnimations().forEach(function (anim) { try { anim.cancel(); } catch (e) { } });
    }
    kanim = null;
    kfadeAnim = null;
    var head = pawnPos.clone(); head.y += 0.9;
    var spot = landSpot(pawnPos, opt.camera);
    var a = project(head, opt), b = project(spot, opt);
    if (opt.land) {                                            /* jatuh di PAPAN, di depan bidak (maks 3 petak dari titik lempar) */
      b = project(opt.land, opt);
    } else if (opt.center !== false) {                         /* cadangan: tengah layar bila titik depan bidak tak diberikan */
      var cr = (opt.canvas || doc.body).getBoundingClientRect();
      b = { x: cr.left + cr.width / 2 + (Math.random() - 0.5) * 60, y: cr.top + cr.height / 2 + (Math.random() - 0.5) * 40 };
    }
    var fixedB = b, vw = win.innerWidth, vh = win.innerHeight;
    kstage.style.visibility = 'visible'; kstage.style.opacity = '1';
    kit.start();
    var dur = opt.reduce ? 1 : 700, t0 = performance.now();
    cancelAnimationFrame(ktrack);
    /* Posisi dadu dihitung ulang tiap frame dari titik di PAPAN (dunia 3D) -> bila layar/kamera digeser, dadu tetap di papan, bukan menempel di layar */
    (function track() {
      if (id !== kitThrowId || !kstage || kstage.style.visibility === 'hidden') return;
      var k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 2);
      var pa = project(head, opt), pb = opt.land ? project(opt.land, opt) : fixedB;
      var ax = (opt.land ? pa.x : a.x), ay = (opt.land ? pa.y : a.y);
      if (k >= 1) { ax = pb.x; ay = pb.y; }                    /* sudah mendarat: ikuti titik papan saja */
      var x = (k >= 1 ? pb.x : ax + (pb.x - ax) * e) - KW / 2;
      var y = (k >= 1 ? pb.y : ay + (pb.y - ay) * e) - KH / 2 - KDY - (k >= 1 ? 0 : Math.sin(Math.PI * e) * 80);
      if (!opt.land) { x = Math.max(-40, Math.min(vw - KW + 40, x)); y = Math.max(-40, Math.min(vh - KH + 40, y)); }
      var sc = KSC * (0.7 + 0.3 * Math.min(1, k * 2));
      kstage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')';
      ktrack = requestAnimationFrame(track);
    })();
    try { opt.onThrow && opt.onThrow(); } catch (e) { console.error(e); }
    var p = kit.roll(v);
    return (p ? p.then(function () { return v; }) : Promise.resolve(v)).then(function (r) {
      if (id !== kitThrowId) return r;
      try { opt.onLand && opt.onLand(); } catch (e) { console.error(e); }
      khide = setTimeout(function () {
        if (!kstage || id !== kitThrowId) return;
        kfadeAnim = kstage.animate ? kstage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }) : null;
        kfade = setTimeout(function () {
          if (id !== kitThrowId) return;
          kstage.style.visibility = 'hidden'; kstage.style.opacity = '0';
          try { kit.stop(); } catch (e) { }
          if (kfadeAnim) { try { kfadeAnim.cancel(); } catch (e) { } }
          kfadeAnim = null;
        }, kfadeAnim ? 330 : 0);
      }, opt.reduce ? 0 : (opt.hold == null ? 1800 : opt.hold)); /* tahan lebih lama supaya angka terbaca sebelum memudar */
      return r;
    });
  }

  function throwFrom(pawnPos, v, opt) {
    opt = opt || {};
    if (!(v >= 1 && v <= 6)) return Promise.resolve(v);
    return worldThrow(pawnPos, v, opt);                         /* dadu 3D di dunia game (bukan overlay layar) */
  }

  function setSkin(key) { if (!key) return; kwant.key = key; if (die) applySkin(key); }
  function setSound(on) { kwant.sound = !!on; if (kit) kit.setSound(kwant.sound); }
  function setVolume(v) { v = +v; kwant.volume = isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); if (kit) kit.setVolume(kwant.volume); }

  /* ---------- Angka hasil di atas tombol emote ---------- */
  var numEl = null;
  function numNode() {
    if (numEl && numEl.isConnected) return numEl;
    var dock = doc.getElementById('emoteDock'); if (!dock) return null;
    numEl = doc.createElement('div'); numEl.className = 'dice-num'; numEl.setAttribute('role', 'status'); numEl.setAttribute('aria-live', 'polite'); numEl.hidden = true;
    dock.appendChild(numEl);
    return numEl;
  }
  function showNumber(v) {
    var el = numNode(); if (!el || !(v >= 1 && v <= 6)) return;
    el.textContent = String(v); el.hidden = false; el.setAttribute('aria-label', 'Hasil dadu ' + v);
    try { el.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.35)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'ease-out' }); } catch (e) { }
  }
  function hideNumber() { if (numEl) numEl.hidden = true; }

  function skip() { if (busy) busy.finish(); if (kit && kit.busy) { try { kit.finish(); } catch (e) { } } }

  UT.GameplayDiceThrow = { ready: false, kitReady: false, init: init, throwFrom: throwFrom, skip: skip,
    setSkin: setSkin, setSound: setSound, setVolume: setVolume, showNumber: showNumber, hideNumber: hideNumber };
})(window, document);
