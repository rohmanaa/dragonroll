/* PodiumFX — cahaya & partikel untuk podium leaderboard (kanvas 2D ringan, tanpa pustaka).
   Pakai: UT.PodiumFX.mount()  (sekali; elemen #pfxc harus ada di dalam #pfxf). Berhenti otomatis saat tab tersembunyi.
   Koordinat = ruang #podium (660x540); gambar podium menempel di bawah (tinggi ±280), puncak pedestal 1 di y≈265, 2 di y≈342, 3 di y≈348. */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  if (UT.PodiumFX) return;
  var W = 660, H = 540, MAX = 45;
  var CONF = ['#3fb8ff', '#ff4fa8', '#ffd24a', '#ff9f3a', '#7be05a'];
  var GLINTS = [[330, 292], [262, 300], [398, 300], [126, 352], [186, 352], [482, 358], [540, 358], [330, 500], [300, 430], [360, 430]];
  var cv, cx, run = false, last = 0, P = [], acc = { s: 0, d: 0, c: 0, g: 0 }, raf = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function spawnSpark() {
    var r = Math.random(), x, y, col;
    if (r < .62) { x = rnd(255, 405); y = rnd(285, 420); col = '255,222,110'; }
    else if (r < .81) { x = rnd(115, 205); y = rnd(350, 420); col = '150,210,255'; }
    else { x = rnd(458, 556); y = rnd(356, 420); col = '255,176,100'; }
    P.push({ t: 'spark', x: x, y: y, vx: rnd(-6, 6), vy: rnd(-28, -12), life: 0, max: rnd(1.8, 3.2), s: rnd(2.6, 5.5), col: col, ph: rnd(0, 6.28) });
  }
  function spawnDot() {
    P.push({ t: 'dot', x: rnd(120, 540), y: rnd(300, 470), vx: rnd(-4, 4), vy: rnd(-15, -7), life: 0, max: rnd(2.6, 4.2), s: rnd(1.5, 3), col: '255,236,170', ph: rnd(0, 6.28) });
  }
  function spawnConf() {
    P.push({ t: 'conf', x: rnd(90, 570), y: -12, vx: rnd(-8, 8), vy: rnd(16, 30), life: 0, max: 9, s: rnd(5, 9), col: pick(CONF), rot: rnd(0, 6.28), vr: rnd(-2, 2), ph: rnd(0, 6.28) });
  }
  function spawnGlint() {
    var g = pick(GLINTS);
    P.push({ t: 'glint', x: g[0] + rnd(-6, 6), y: g[1] + rnd(-6, 6), vx: 0, vy: 0, life: 0, max: rnd(.9, 1.4), s: rnd(9, 15), col: '255,250,220', ph: 0 });
  }

  function star(x, y, r, a, col) {
    var g = cx.createRadialGradient(x, y, 0, x, y, r * 1.1);
    g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 1.1, 0, 6.2832); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,' + Math.min(1, a * .8) + ')';
    cx.beginPath();
    for (var i = 0; i < 8; i++) {
      var ang = i * Math.PI / 4 - Math.PI / 2, rr = (i % 2 === 0) ? r : r * .2;
      var px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
      if (i === 0) cx.moveTo(px, py); else cx.lineTo(px, py);
    }
    cx.closePath(); cx.fill();
  }

  function step(now) {
    raf = 0; if (!run) return;
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    acc.s += dt * 4; acc.d += dt * 2; acc.c += dt * 1.2; acc.g += dt * .7;
    while (acc.s >= 1) { acc.s--; if (P.length < MAX) spawnSpark(); }
    while (acc.d >= 1) { acc.d--; if (P.length < MAX) spawnDot(); }
    while (acc.c >= 1) { acc.c--; if (P.length < MAX) spawnConf(); }
    while (acc.g >= 1) { acc.g--; spawnGlint(); }
    cx.clearRect(0, 0, W, H); cx.globalCompositeOperation = 'lighter';
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i]; p.life += dt; var k = p.life / p.max;
      if (k >= 1 || (p.t === 'conf' && p.y > 420)) { P.splice(i, 1); continue; }
      p.x += p.vx * dt + (p.t === 'conf' ? Math.sin(p.life * 2 + p.ph) * 14 * dt : 0); p.y += p.vy * dt;
      if (p.t === 'spark') {
        var tw = .4 + .3 * Math.sin(p.life * 7 + p.ph), a = Math.sin(Math.PI * k) * tw;
        star(p.x, p.y, p.s, a, p.col);
      } else if (p.t === 'dot') {
        var a2 = Math.sin(Math.PI * k) * .7, g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 2.4);
        g.addColorStop(0, 'rgba(' + p.col + ',' + a2 + ')'); g.addColorStop(1, 'rgba(' + p.col + ',0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.s * 2.4, 0, 6.2832); cx.fill();
      } else if (p.t === 'glint') {
        star(p.x, p.y, p.s * Math.sin(Math.PI * k), Math.sin(Math.PI * k) * .7, p.col);
      } else {
        p.rot += p.vr * dt;
        var fade = p.y > 300 ? Math.max(0, 1 - (p.y - 300) / 120) : 1, a3 = Math.min(1, p.life * 2) * fade * .9;
        cx.globalCompositeOperation = 'source-over';
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.abs(Math.cos(p.life * 3 + p.ph)) * .8 + .2);
        cx.globalAlpha = a3; cx.fillStyle = p.col; cx.fillRect(-p.s / 2, -p.s * .35, p.s, p.s * .7); cx.restore();
        cx.globalAlpha = 1; cx.globalCompositeOperation = 'lighter';
      }
    }
    cx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(step);
  }
  function start() { if (run) return; run = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(step); }
  function stop() { run = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  UT.PodiumFX = {
    mount: function () {
      cv = document.getElementById('pfxc'); if (!cv) return;
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = W * d; cv.height = H * d; cx = cv.getContext('2d'); cx.scale(d, d);
      document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
      start();
    },
    start: start, stop: stop
  };
})();
