/* Dice Pad FX + Emote (visual saja). Tidak menyentuh hasil dadu / giliran / logika game.
   - Mendengarkan animasi 'hop' pada #dieScene (dipicu UT.GameplayDiceUI.showDie) lalu memunculkan efek tumbukan di tatakan.
   - Emote: tombol kiri bawah; memunculkan balon emoji dan mengirim CustomEvent 'ut:emote' (siap disambung ke multiplayer). */
(function (win, doc) {
  'use strict';
  if (win.UT && win.UT.DicePadFX) return;

  var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLORS = ['rgba(235,242,255,.75)', 'rgba(190,215,255,.7)', 'rgba(255,225,140,.7)', 'rgba(170,180,200,.65)'];
  var timers = [];

  function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function restartClass(el, cls, ms) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    if (ms) setTimeout(function () { el.classList.remove(cls); }, ms);
  }

  function burst(dock, layer, count, spread, rise) {
    if (reduce || !layer.animate) return;
    var cx = 75, cy = 88; /* titik tumbukan di permukaan tatakan (koordinat dock 150x120) */
    for (var i = 0; i < count; i++) {
      var p = doc.createElement('i'); p.className = 'dp';
      var sz = 1.5 + Math.random() * 2.5; /* partikel tipis: 1.5-4px */
      p.style.width = sz + 'px'; p.style.height = sz + 'px';
      p.style.background = COLORS[(Math.random() * COLORS.length) | 0];
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      layer.appendChild(p);
      var dir = Math.random() < .5 ? -1 : 1;
      var dx = dir * (8 + Math.random() * spread);
      var up = -(4 + Math.random() * rise);
      var dur = 420 + Math.random() * 360;
      var a = p.animate([
        { transform: 'translate(0,0) scale(1)', opacity: .85 },
        { transform: 'translate(' + (dx * .6) + 'px,' + up + 'px) scale(1)', opacity: .7, offset: .45 },
        { transform: 'translate(' + dx + 'px,' + (up + 10 + Math.random() * 8) + 'px) scale(.4)', opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      a.onfinish = (function (el) { return function () { if (el.parentNode) el.parentNode.removeChild(el); }; })(p);
    }
  }

  function impact(dock, layer, ring, big) {
    restartClass(dock, big ? 'thud' : 'thud-s', 340);
    ring.classList.remove('go', 's'); void ring.offsetWidth;
    ring.classList.add('go'); if (!big) ring.classList.add('s');
    burst(dock, layer, big ? 16 : 6, big ? 52 : 28, big ? 24 : 12);
  }

  function initDice() {
    var scene = doc.getElementById('dieScene');
    var dock = doc.getElementById('dieDock');
    if (!scene || !dock) return;
    var layer = dock.querySelector('.dp-layer');
    var ring = dock.querySelector('.dp-ring');
    scene.addEventListener('animationstart', function (e) {
      if (e.animationName !== 'dieDrop') return;
      clearTimers();
      restartClass(dock, 'drop');
      /* waktu mengikuti keyframes dieDrop (1.4s): tumbukan 40% dan 66% */
      later(function () { impact(dock, layer, ring, true); }, 560);
      later(function () { impact(dock, layer, ring, false); }, 924);
    });
    scene.addEventListener('animationend', function (e) { if (e.animationName === 'dieDrop') dock.classList.remove('drop'); });
  }

  function initEmote() {
    var d = doc.getElementById('emoteDock');
    if (!d) return;
    var main = d.querySelector('.em-main'), tab = d.querySelector('.em-tab'), list = d.querySelector('.em-list');
    var cooling = false;
    function toggle(force) {
      var open = typeof force === 'boolean' ? force : !d.classList.contains('open');
      d.classList.toggle('open', open);
      tab.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    main.addEventListener('click', function () { toggle(); });
    tab.addEventListener('click', function () { toggle(); });
    list.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-e]');
      if (!b || cooling) return;
      cooling = true; setTimeout(function () { cooling = false; }, 1500);
      var em = b.getAttribute('data-e'), handled = false;
      try { handled = !win.dispatchEvent(new CustomEvent('ut:emote', { detail: { emoji: em }, cancelable: true })); } catch (err) { /* abaikan */ }
      if (!handled) { /* tidak ada penangan (mis. di luar gameplay): tampilkan balon di dock saja */
        var bub = doc.createElement('div'); bub.className = 'em-bubble'; bub.textContent = em;
        d.appendChild(bub); setTimeout(function () { if (bub.parentNode) bub.parentNode.removeChild(bub); }, 1900);
      }
      toggle(false);
    });
  }

  function init() { initDice(); initEmote(); }
  (win.UT = win.UT || {}).DicePadFX = { init: init };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
