/* Fade in dari hitam setelah layar loading (flag ut:fadein diset splash.html, sekali pakai). */
(function () {
  try {
    if (sessionStorage.getItem('ut:fadein') !== '1') return;
    sessionStorage.removeItem('ut:fadein');
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var st = document.createElement('style');
    st.textContent = 'html{background:#000}body{animation:utPageIn .7s ease backwards}@keyframes utPageIn{from{opacity:0}to{opacity:1}}';
    document.documentElement.appendChild(st);
    setTimeout(function () { if (st.parentNode) st.parentNode.removeChild(st); }, 900); /* lepas setelah fade supaya latar halaman normal kembali */
  } catch (e) {}
})();
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
