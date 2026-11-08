/* Dice Pad FX + Emote (visual saja). Tidak menyentuh hasil dadu / giliran / logika game.
   - Tatakan dadu sekarang objek 3D Three.js di scene Dice Kit (assets/js/dice-kit/DiceRenderer.js _buildPad), bukan SVG; file ini tinggal Emote.
   - Emote: tombol kiri bawah; memunculkan balon emoji dan mengirim CustomEvent 'ut:emote' (siap disambung ke multiplayer). */
(function (win, doc) {
  'use strict';
  if (win.UT && win.UT.DicePadFX) return;

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
  (win.UT = win.UT || {}).DicePadFX = { init: init };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
