/* inventory-bridge.js — dipasang di frame/dadu/efek/powerup/pet.html.
   Kelima halaman itu sekarang tampil sebagai TAB di inventory.html (dimuat di iframe dengan ?embed=inv).
   - Mode embed: sembunyikan tombol kembali + judul (dipegang inventory.html) dan teruskan navigasi keluar (lobby, tambang, shop) ke induk.
   - Dibuka langsung (bukan embed, bukan dari room): alihkan ke inventory.html?tab=... agar tetap satu halaman. */
(function () {
  'use strict';
  var TABS = { 'frame.html': 'frame', 'dadu.html': 'dadu', 'efek.html': 'efek', 'powerup.html': 'power', 'pet.html': 'pet' };
  var q = new URLSearchParams(location.search), page = location.pathname.split('/').pop();
  if (q.get('from') === 'room') return;                 // dipakai room.html: ditangani room-modal-bridge.js
  if (q.get('embed') !== 'inv') {
    if (TABS[page]) location.replace('inventory.html?tab=' + TABS[page]);
    return;
  }
  document.documentElement.classList.add('ut-inv-embed');
  var st = document.createElement('style');
  st.textContent = 'html.ut-inv-embed #back,html.ut-inv-embed #title{display:none!important}html.ut-inv-embed body.notabs #grid{top:250px!important;max-height:500px!important}';
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
