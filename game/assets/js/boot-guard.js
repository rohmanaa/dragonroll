/* Boot guard: halaman apa pun yang dibuka langsung (tanpa lewat splash) dialihkan ke splash.html dulu.
   Splash memuat semua data & aset, lalu kembali ke halaman tujuan. Flag disimpan per tab (sessionStorage). */
(function () {
  try {
    if (sessionStorage.getItem('ut:booted') === '1' && localStorage.getItem('ut-auth')) return; /* wajib sudah lewat splash DAN login */
  } catch (e) { return; }
  var page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'splash.html') return;
  var next = (page === 'index.html' || page === '') ? 'lobby.html' : page + location.search;
  location.replace('splash.html?next=' + encodeURIComponent(next));
})();
