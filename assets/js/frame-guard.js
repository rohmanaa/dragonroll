/* Frame guard (Stage 4.1.19): semua halaman game dijalankan di dalam play.html (iframe pembungkus).
   Di HP portrait, play.html memutar iframe 90° sehingga halaman melihat viewport landscape (media query, vw/vh, innerWidth semuanya landscape),
   tanpa notif "putar perangkat". Halaman yang dibuka langsung dialihkan ke pembungkus. Tambahkan ?noframe=1 untuk debug tanpa pembungkus. */
(function () {
  try {
    if (window.top !== window) return;                         // sudah di dalam pembungkus
    if (location.search.indexOf('noframe=1') > -1) return;     // mode debug
    var page = location.pathname.split('/').pop() || 'index.html';
    if (page === 'play.html' || page === 'index.html') return; // pembungkus & landing tidak dibungkus
    location.replace('play.html?go=' + encodeURIComponent(page + location.search + location.hash));
  } catch (e) { /* cross-origin / sandbox: biarkan halaman tampil apa adanya */ }
})();
