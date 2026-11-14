/* stage-edge.js — layar lebih lebar dari 16:9: UI kiri/kanan menempel ke tepi layar seperti lobby.
   Mengisi --ex (ruang ekstra per sisi, dalam satuan kanvas 1920x1080) pada #stage dan menandai <html data-edge data-page>.
   Aturan per halaman ada di assets/ng/css/edge.css. Rumus skala sama dengan fit() tiap halaman. */
(function () {
  'use strict';
  var de = document.documentElement;
  de.setAttribute('data-edge', '');
  de.setAttribute('data-page', (location.pathname.split('/').pop() || '').replace(/\.html$/, ''));
  function apply() {
    var st = document.getElementById('stage');
    if (!st) return;
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    st.style.setProperty('--ex', Math.max(0, (innerWidth / s - 1920) / 2).toFixed(1) + 'px');
  }
  addEventListener('resize', apply);
  addEventListener('orientationchange', apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
