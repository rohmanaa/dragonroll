/* floatingsample.js — dipindah dari <script> inline (floatingsample.html). */
/* ================= JS ================= */
(function () {
  'use strict';

  /* ---- pengaturan (ubah di sini) ---- */
  var ISLAND_SCALE = 2.4;   /* ukuran pulau: 1 = ukuran normal di lobby/profil; makin besar makin raksasa */
  var ISLAND_SEED  = 5;     /* ganti angka untuk bentuk/dekorasi pulau yang berbeda */
  var BOB          = 0.12;  /* tinggi melayang naik-turun (di dalam skala pulau) */
  var AUTO_SPIN    = 0.12;  /* kecepatan putar otomatis (rad/dtk); 0 = mati */

  var cv = document.getElementById('gl');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  } catch (e) {
    document.getElementById('msg').style.display = 'grid';
    return;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

  /* cahaya: sama dengan halaman profil, batas bayangan diperbesar mengikuti skala pulau */
  scene.add(new THREE.AmbientLight(0xffffff, 0.6), new THREE.HemisphereLight(0xcfeaff, 0x6a9a50, 0.6));
  var sun = new THREE.DirectionalLight(0xfff2d8, 0.95);
  sun.position.set(6 * ISLAND_SCALE, 12 * ISLAND_SCALE, 8 * ISLAND_SCALE);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var sc = 8 * ISLAND_SCALE;
  Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 1, far: 12 * ISLAND_SCALE * 3 });
  scene.add(sun);

  /* pulau besar */
  var holder = new THREE.Group();
  scene.add(holder);
  var island = UT.FloatingIsland.create(THREE, { seed: ISLAND_SEED, bob: BOB, scale: ISLAND_SCALE });
  holder.add(island);

  /* ---- kamera: orbit sederhana (putar, zoom, miring sedikit) ---- */
  var target = new THREE.Vector3(0, -2.2 * ISLAND_SCALE, 0); /* titik pandang kira-kira di tengah badan pulau */
  var baseD = 20, zoomK = 1, zoomGoal = 1, ZMIN = 0.45, ZMAX = 1.6; /* zoomK = pengali jarak kamera (kecil = dekat) */
  var pitch = 0.36;        /* sudut pandang dari atas (rad) */
  var rot = 0.5, vel = 0, dragging = false, idle = 0;

  function frame() {
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    /* jarak dasar supaya seluruh pulau (lebar ~7.4 x skala) pas di layar, portrait maupun landscape */
    var needW = 8.6 * ISLAND_SCALE, needH = 9.5 * ISLAND_SCALE;
    var th = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    baseD = Math.max((needH / 2) / th, (needW / 2) / (th * cam.aspect));
    cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', frame);
  window.addEventListener('orientationchange', function () { setTimeout(frame, 200); });
  if (window.ResizeObserver) new ResizeObserver(frame).observe(cv);

  /* input: geser = putar, 2 jari = cubit zoom, roda mouse = zoom */
  var ptrs = {}, pinch0 = 0, zoom0 = 0, lx = 0;
  function count() { return Object.keys(ptrs).length; }
  function pdist() { var k = Object.keys(ptrs); if (k.length < 2) return 0; var a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
  cv.addEventListener('pointerdown', function (e) {
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    cv.setPointerCapture(e.pointerId);
    if (count() === 1) { dragging = true; lx = e.clientX; vel = 0; cv.classList.add('drag'); }
    if (count() === 2) { dragging = false; pinch0 = pdist(); zoom0 = zoomGoal; }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (count() >= 2 && pinch0) {
      zoomGoal = THREE.MathUtils.clamp(zoom0 * (pinch0 / pdist()), ZMIN, ZMAX);
    } else if (dragging) {
      vel = (e.clientX - lx) * 0.012; rot += vel; lx = e.clientX; idle = 0;
    }
  });
  function up(e) {
    delete ptrs[e.pointerId];
    if (count() < 2) pinch0 = 0;
    if (count() === 0) { dragging = false; cv.classList.remove('drag'); }
    if (count() === 1) { var k = Object.keys(ptrs)[0]; lx = ptrs[k].x; dragging = true; }
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomGoal = THREE.MathUtils.clamp(zoomGoal * (1 + e.deltaY * 0.0012), ZMIN, ZMAX);
  }, { passive: false });

  /* loop */
  var clock = new THREE.Clock();
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!dragging) {
      vel *= 0.94; rot += vel;                       /* inersia setelah dilepas */
      idle += dt;
      if (idle > 1.2 && !reduce) rot += AUTO_SPIN * dt; /* putar otomatis kalau tidak disentuh */
    }
    island.userData.update(t);
    holder.rotation.y = rot;

    zoomK += (zoomGoal - zoomK) * Math.min(1, dt * 8);  /* zoom halus */
    var dist = baseD * zoomK;
    cam.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
    cam.lookAt(target);
    renderer.render(scene, cam);
  }
  frame();
  loop();
})();
