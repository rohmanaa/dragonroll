/* inventory-bridge.js — dipasang di frame/dadu/efek/powerup/pet.html.
   Frame/powerup tampil sebagai TAB di inventory.html (dimuat di iframe dengan ?embed=inv).
   Dadu, Efek, dan Pet BUKAN tab Inventory lagi (Dadu & Efek bagian Perlengkapan; Pet punya grup tab sendiri): dibuka langsung -> shell play.html?go=<halaman>.
   - Mode embed: sembunyikan tombol kembali + judul (dipegang inventory.html) dan teruskan navigasi keluar (lobby, tambang, shop) ke induk.
   - Dibuka langsung (bukan embed, bukan dari room): alihkan ke inventory.html?tab=... agar tetap satu halaman. */
(function () {
  'use strict';
  var TABS = { 'frame.html': 'frame', 'dadu.html': 'dadu', 'powerup.html': 'power' };
  var OWN_VIEW = { 'dadu.html': 1, 'efek.html': 1, 'pet.html': 1 };   // halaman mandiri di shell (bukan tab Inventory)
  var q = new URLSearchParams(location.search), page = (window.UT && window.UT.PrettyUrl) ? window.UT.PrettyUrl.getGoFromUrl() : location.pathname.split('/').pop();
  if (q.get('from') === 'room') return;                 // dipakai room.html: ditangani room-modal-bridge.js
  if (OWN_VIEW[page]) {   // mode ?embed=inv sudah usang untuk Dadu/Efek/Pet; iframe (cadangan shell) tidak dialihkan lagi agar tak berputar
    if (window.self === window.top) location.replace('play.html?go=' + page);
    return;
  }
  if (q.get('embed') !== 'inv') {
    if (TABS[page]) location.replace('inventory.html?tab=' + TABS[page]);
    return;
  }
  document.documentElement.classList.add('ut-inv-embed');
  var st = document.createElement('style');
  st.textContent = 'html.ut-inv-embed #back,html.ut-inv-embed #title{display:none!important}'
    /* latar & panel dipegang inventory.html (bingkai penuh di bawah iframe): isi tab transparan */
    + 'html.ut-inv-embed,html.ut-inv-embed body{background:transparent!important}';
  document.head.appendChild(st);

  function toParent(url) { try { parent.postMessage({ type: 'ut-inv-nav', url: url }, '*'); } catch (e) {} }
  if (window.navigation && navigation.addEventListener) {
    navigation.addEventListener('navigate', function (e) {
      if (!e.cancelable || e.hashChange || e.downloadRequest !== null) return;
      var u = new URL(e.destination.url), p = u.pathname.split('/').pop();
      if (u.origin !== location.origin || (TABS[p] && u.searchParams.get('embed') === 'inv')) return;
      e.preventDefault();
      toParent(p + u.search);
    });
  }
})();
