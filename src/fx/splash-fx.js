/* SplashFX — cahaya & partikel melayang untuk latar splash (kanvas 2D ringan, tanpa pustaka).
   Pakai: UT.SplashFX.mount()  (elemen <canvas id="splashfx"> di dalam #scene). Berhenti saat tab tersembunyi.
   Efek: percikan ungu/violet naik dari portal (bergoyang seperti berenang) + kunang-kunang emas + bola cahaya lembut yang mengapit. */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  if (UT.SplashFX) return;
  var MAX = 70, ORBS = 7;
  var COLORS = ['186,110,255', '210,140,255', '255,150,225', '255,225,150'];
  var cv, cx, W = 0, H = 0, run = false, last = 0, raf = 0, P = [], O = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function resize() {
    var d = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * d; cv.height = H * d;
    cx.setTransform(d, 0, 0, d, 0, 0);
  }
  function glow(x, y, r, a, col) {
    var g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 6.2832); cx.fill();
  }
  function spawn() {
    /* 62%: percikan dari gerbang portal (kolom tengah); sisanya kunang-kunang di tepi hutan */
    var mid = Math.random() < .62, col = mid ? pick(COLORS.slice(0, 3)) : (Math.random() < .55 ? '255,225,150' : '170,190,255');
    P.push({
      bx: mid ? rnd(W * .30, W * .70) : rnd(0, W), x: 0, y: mid ? rnd(H * .45, H) : rnd(H * .2, H),
      vy: mid ? rnd(-52, -24) : rnd(-16, -8), amp: rnd(14, 42), fr: rnd(.5, 1.4), ph: rnd(0, 6.28),
      life: 0, max: rnd(3, 6.5), s: mid ? rnd(1.6, 4.2) : rnd(1.4, 2.8), tw: rnd(2, 4.5), col: col
    });
  }
  function makeOrbs() {
    O = [];
    for (var i = 0; i < ORBS; i++) O.push({ x: Math.random(), y: rnd(.18, .8), r: rnd(48, 130), a: rnd(.05, .12), ph: rnd(0, 6.28), sp: rnd(.05, .16), dx: rnd(.02, .07) });
  }
  function step(now) {
    raf = 0; if (!run) return;
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    cx.clearRect(0, 0, W, H);
    cx.globalCompositeOperation = 'lighter';
    /* bola cahaya lembut mengapit pelan (berenang) */
    for (var i = 0; i < O.length; i++) {
      var o = O[i], t = now / 1000;
      glow((o.x + Math.sin(t * o.sp + o.ph) * o.dx) * W, (o.y + Math.sin(t * o.sp * .7 + o.ph * 2) * .04) * H, o.r, o.a, '190,120,255');
    }
    if (P.length < MAX && Math.random() < .5) spawn();
    for (i = P.length - 1; i >= 0; i--) {
      var p = P[i]; p.life += dt;
      var k = p.life / p.max;
      if (k >= 1 || p.y < -20) { P.splice(i, 1); continue; }
      p.y += p.vy * dt;
      p.x = p.bx + Math.sin(p.life * p.fr + p.ph) * p.amp; /* goyangan = kesan berenang */
      var a = Math.sin(Math.PI * k) * (.4 + .35 * Math.sin(p.life * p.tw + p.ph * 3));
      glow(p.x, p.y, p.s * 3.2, Math.max(0, a), p.col);
    }
    cx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(step);
  }
  function start() { if (run) return; run = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(step); }
  function stop() { run = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  UT.SplashFX = {
    mount: function () {
      cv = document.getElementById('splashfx'); if (!cv || !cv.getContext) return;
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      cx = cv.getContext('2d'); resize(); makeOrbs();
      window.addEventListener('resize', function () { resize(); makeOrbs(); });
      document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
      start();
    },
    start: start, stop: stop
  };
})();
