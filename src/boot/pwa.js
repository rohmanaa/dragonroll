/* Daftarkan service worker (cache aset di perangkat) + minta penyimpanan permanen.
   Hanya jalan di https / localhost. Gagal diam-diam bila tidak didukung (mis. file://, browser in-app).
   SW didaftarkan dengan jalur absolut /sw.js dan scope '/' agar benar di URL pretty. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var ok = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!ok) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
})();
