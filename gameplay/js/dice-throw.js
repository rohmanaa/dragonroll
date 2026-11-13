/* Dice Throw — dadu 3D di dunia game: DILEMPAR bidak lalu jatuh di dekat bidak.
   Hanya VISUAL. Angka final (1..6) tetap dari gameplay (main.js); modul ini cuma menampilkan lemparan yang berakhir di angka itu.
   Indikator hasil dekat profil (#dieScene via UT.GameplayDiceUI) tetap dipakai oleh main.js: ditampilkan saat dadu mendarat.
   Classic script. Butuh global THREE (three.min.js). Namespace: UT.GameplayDiceThrow.
   API:
     init(scene)                          — pasang ke scene dunia (idempoten)
     throwFrom(pawnPos, v, opt) -> Promise — lempar dari posisi bidak (THREE.Vector3), mendarat dengan muka atas = v.
                                             opt: {onLand(), onBounce(speed), reduce, color, fade}
     skip()                               — paksa dadu langsung rebah di angkanya (dipanggil bila terlalu lama)
     ready                                — true bila siap */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayDiceThrow) return;

  var S = 0.42;                 /* sisi dadu (unit dunia; 1 petak ~ 1 unit) */
  var scene = null, die = null, shadow = null, mats = null, busy = null;

  /* urutan muka BoxGeometry three: +x, -x, +y, -y, +z, -z  -> angka standar (sisi berhadapan = 7) */
  var FACE_VAL = [3, 4, 1, 6, 2, 5];
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

  function build(color) {
    mats = FACE_VAL.map(function (n) { return new THREE.MeshLambertMaterial({ map: faceTex(n, color || '#f4efe4') }); });
    die = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), mats);
    die.castShadow = true; die.visible = false; die.renderOrder = 5;
    shadow = new THREE.Mesh(new THREE.CircleGeometry(S * 0.62, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.visible = false;
    scene.add(die); scene.add(shadow);
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
    scene = sc; build();
    UT.GameplayDiceThrow.ready = true;
    return true;
  }

  function throwFrom(pawnPos, v, opt) {
    opt = opt || {};
    if (!die || !(v >= 1 && v <= 6)) return Promise.resolve(v);
    if (busy) busy.finish();
    var from = pawnPos.clone(); from.y += 0.75;                 /* tinggi tangan bidak */
    var floorY = pawnPos.y + S / 2;
    var to = landSpot(pawnPos, opt.camera); to.y = floorY;
    var dur = opt.reduce ? 0.01 : 0.95;
    var yaw = Math.random() * 6.2832;
    var qEnd = quatForTop(v, yaw);
    var qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    var spin = new THREE.Quaternion(); var axis = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
    var turns = 3 + Math.random() * 1.5;
    var peak = from.y + 1.1;
    var bounced = false, done = false, t0 = performance.now(), raf = 0;

    die.visible = true; shadow.visible = true;
    die.scale.setScalar(1); mats.forEach(function (m) { m.transparent = false; m.opacity = 1; });

    return new Promise(function (resolve) {
      function place(k) {                                       /* k 0..1 sepanjang lemparan */
        var x = from.x + (to.x - from.x) * k, z = from.z + (to.z - from.z) * k;
        var y = from.y + (floorY - from.y) * k + Math.sin(Math.PI * k) * (peak - from.y) * 1.0;
        die.position.set(x, Math.max(y, floorY), z);
        shadow.position.set(x, pawnPos.y + 0.02, z);
        var h = Math.max(0, die.position.y - floorY);
        shadow.material.opacity = 0.32 * (1 - Math.min(1, h / 1.4));
        shadow.scale.setScalar(1 + h * 0.25);
        /* putaran: acak -> menyatu ke qEnd di akhir */
        var spinK = 1 - ease(k);
        spin.setFromAxisAngle(axis, spinK * turns * 6.2832);
        die.quaternion.copy(qEnd).premultiply(spin);
        if (k > 0.82) die.quaternion.slerp(qEnd, (k - 0.82) / 0.18);
      }
      function land() {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        die.position.set(to.x, floorY, to.z); die.quaternion.copy(qEnd);
        shadow.position.set(to.x, pawnPos.y + 0.02, to.z); shadow.material.opacity = 0.3; shadow.scale.setScalar(1);
        try { opt.onLand && opt.onLand(); } catch (e) { console.error(e); }
        var hold = opt.reduce ? 0 : (opt.hold == null ? 650 : opt.hold);
        setTimeout(function () { fade(); }, hold);
        busy = null; resolve(v);                                /* pemanggil lanjut saat mendarat (bidak jalan sambil dadu memudar) */
      }
      function fade() {
        var s0 = performance.now(), D = 350;
        (function f() {
          if (!die || busy) { hide(); return; }                 /* lemparan baru dimulai -> jangan ganggu */
          var k = Math.min(1, (performance.now() - s0) / D);
          mats.forEach(function (m) { m.transparent = true; m.opacity = 1 - k; });
          shadow.material.opacity = 0.3 * (1 - k); die.scale.setScalar(1 - 0.25 * k);
          if (k < 1) requestAnimationFrame(f); else hide();
        })();
      }
      function hide() { die.visible = false; shadow.visible = false; mats.forEach(function (m) { m.opacity = 1; m.transparent = false; }); die.scale.setScalar(1); }
      function frame() {
        if (done) return;
        var k = Math.min(1, (performance.now() - t0) / 1000 / dur);
        place(k);
        if (!bounced && k >= 0.999) {
          bounced = true;
          try { opt.onBounce && opt.onBounce(1); } catch (e) { console.error(e); }
        }
        if (k >= 1) {                                           /* satu pantulan kecil lalu diam */
          var b0 = performance.now(), B = opt.reduce ? 1 : 180;
          (function bounce() {
            var u = Math.min(1, (performance.now() - b0) / B);
            die.position.y = floorY + Math.sin(Math.PI * u) * 0.12 * (1 - u * 0.4);
            if (u < 1 && !done) requestAnimationFrame(bounce); else land();
          })();
          return;
        }
        raf = requestAnimationFrame(frame);
      }
      busy = { finish: function () { if (!done) land(); } };
      try { opt.onThrow && opt.onThrow(); } catch (e) { console.error(e); }
      raf = requestAnimationFrame(frame);
    });
  }

  function skip() { if (busy) busy.finish(); }

  UT.GameplayDiceThrow = { ready: false, init: init, throwFrom: throwFrom, skip: skip };
})(window, document);
