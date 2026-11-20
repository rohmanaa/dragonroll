/* Frame guard (Stage 4.1.19): semua halaman game dijalankan di dalam play.html (iframe pembungkus).
   Di HP portrait, play.html memutar iframe 90° sehingga halaman melihat viewport landscape (media query, vw/vh, innerWidth semuanya landscape),
   tanpa notif "putar perangkat". Halaman yang dibuka langsung dialihkan ke pembungkus. Tambahkan ?noframe=1 untuk debug tanpa pembungkus. */
(function () {
  try {
    if (window.top !== window) {                               // sudah di dalam pembungkus
      /* SPA tahap 2: Lobby/Karakter yang dimuat di iframe pembungkus diambil alih view di play.html (tanpa muat ulang dokumen, tanpa WebGL baru).
         Hanya iframe #f milik pembungkus (bukan iframe bersarang, mis. Karakter di modal room). */
      try {
        var pg = location.pathname.split('/').pop(), P = window.parent;
        if (window.frameElement && window.frameElement.id === 'f' && P === window.top && P.UT && P.UT.Spa
            && /^(lobby|karakter|profile|leaderboard|tambang)\.html$/.test(pg) && P.UT.Spa.canView(pg + location.search)) {
          window.stop();
          P.UT.Spa.go(pg + location.search + location.hash);
        }
      } catch (e) { /* lintas origin / sandbox: lanjut sebagai halaman biasa di iframe */ }
      return;
    }
    if (location.search.indexOf('noframe=1') > -1) return;     // mode debug
    var page = location.pathname.split('/').pop() || 'index.html';
    if (page === 'play.html' || page === 'index.html') return; // pembungkus & landing tidak dibungkus
    location.replace('play.html?go=' + encodeURIComponent(page + location.search + location.hash));
  } catch (e) { /* cross-origin / sandbox: biarkan halaman tampil apa adanya */ }
})();
