/* Layar lebih lebar dari 16:9: elemen kiri menempel ke tepi kiri layar dan elemen kanan ke tepi kanan (tanpa jarak),
   alih-alih terkumpul di kotak 1920x1080 tengah. Dipakai halaman newgui selain lobby (lobby punya logikanya sendiri).
   Cara kerja: tiap anak langsung #stage diberi data-edge="l"/"r" menurut posisi tengahnya (elemen selebar layar / di tengah dilewati),
   lalu CSS menggeser dengan `translate: ±var(--ex)` (properti terpisah dari transform, jadi animasi tidak bentrok). */
(function () {
  'use strict';
  var st = document.getElementById('stage'); if (!st) return;
  function mark() {
    for (var i = 0; i < st.children.length; i++) {
      var el = st.children[i], w = el.offsetWidth; if (!w) continue;
      var c = el.offsetLeft + w / 2;
      if (w >= 1500 || /^(fade|toast|modal|md)$/.test(el.id) || getComputedStyle(el).position === 'fixed') { el.removeAttribute('data-edge'); continue; }
      if (c < 880) el.setAttribute('data-edge', 'l'); else if (c > 1040) el.setAttribute('data-edge', 'r'); else el.removeAttribute('data-edge');
    }
  }
  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    st.style.setProperty('--ex', Math.max(0, (innerWidth / s - 1920) / 2) + 'px');
  }
  var st2 = document.createElement('style');
  st2.textContent = '#stage{overflow:visible!important}#stage>[data-edge=l]{translate:calc(var(--ex,0px)*-1) 0}#stage>[data-edge=r]{translate:var(--ex,0px) 0}';
  document.head.appendChild(st2);
  function run() { mark(); fit(); }
  addEventListener('resize', fit);
  addEventListener('load', run);
  if (document.readyState !== 'loading') run(); else addEventListener('DOMContentLoaded', run);
  setTimeout(run, 600); /* elemen yang baru tampil setelah data siap */
})();
