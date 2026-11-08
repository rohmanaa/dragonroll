/* Dice Pad FX + Emote (visual saja). Tidak menyentuh hasil dadu / giliran / logika game.
   - Efek tumbukan di tatakan dipicu dadu 3D asli (Dice Kit lewat UT.GameplayDiceUI -> UT.DicePadFX.impact) setiap dadu menghantam lantai.
   - Emote: tombol kiri bawah; memunculkan balon emoji dan mengirim CustomEvent 'ut:emote' (siap disambung ke multiplayer). */
(function (win, doc) {
  'use strict';
  if (win.UT && win.UT.DicePadFX) return;

  var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLORS = ['rgba(235,242,255,.75)', 'rgba(190,215,255,.7)', 'rgba(255,225,140,.7)', 'rgba(170,180,200,.65)'];


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

  /* Dipanggil UT.GameplayDiceUI tiap dadu 3D (Dice Kit) menghantam lantai: tatakan tertekan + cincin + partikel tipis. */
  function impactNow(big) {
    var dock = doc.getElementById('dieDock');
    if (!dock) return;
    var layer = dock.querySelector('.dp-layer'), ring = dock.querySelector('.dp-ring');
    if (!layer || !ring) return;
    if (big) { restartClass(dock, 'drop'); setTimeout(function () { dock.classList.remove('drop'); }, 1400); }
    impact(dock, layer, ring, !!big);
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

  function init() { initEmote(); }
  (win.UT = win.UT || {}).DicePadFX = { init: init, impact: impactNow };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
