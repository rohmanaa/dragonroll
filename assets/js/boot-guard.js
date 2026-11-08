/* Fade in dari hitam setelah layar loading (flag ut:fadein diset splash.html, sekali pakai). */
(function () {
  try {
    if (sessionStorage.getItem('ut:fadein') !== '1') return;
    sessionStorage.removeItem('ut:fadein');
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /* Fade in sinematik: layar hitam bertahan sebentar lalu terbuka pelan (overlay html::before) + vinyet gelap di tepi yang menyusul. Tanpa transform/filter di body. */
    var st = document.createElement('style');
    st.textContent = 'html::before,html::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483647}'
      + 'html::before{background:#000;animation:utCine 2.2s cubic-bezier(.4,0,.2,1) forwards}'
      + 'html::after{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 35%,rgba(0,0,0,.75) 100%);animation:utVig 3s ease-out forwards}'
      + '@keyframes utCine{0%,14%{opacity:1}100%{opacity:0}}'
      + '@keyframes utVig{0%,20%{opacity:1}100%{opacity:0}}'
      + '#ui>:not(.ut-curbar){animation-delay:.7s!important}'; /* animasi masuk UI lobby menyusul setelah layar terbuka */
    document.documentElement.appendChild(st);
    setTimeout(function () { if (st.parentNode) st.parentNode.removeChild(st); }, 3300);
  } catch (e) {}
})();
/* Boot guard: halaman apa pun yang dibuka langsung (tanpa lewat splash) dialihkan ke splash.html dulu.
   Splash memuat semua data & aset, lalu kembali ke halaman tujuan. Flag disimpan per tab (sessionStorage). */
(function () {
  try {
    if (sessionStorage.getItem('ut:booted') === '1' && window.UT && UT.Session && UT.Session.loggedIn()) return; /* wajib sudah lewat splash DAN login (tanpa session.js = dianggap belum login) */
  } catch (e) { return; }
  var page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'splash.html') return;
  var next = (page === 'index.html' || page === '') ? 'lobby.html' : page + location.search;
  location.replace('splash.html?next=' + encodeURIComponent(next));
})();
