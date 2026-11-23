/* hub-redirect.js — friendship.html / mail.html / settings.html kini PANEL di hub profile.html (Profil · Teman · Pesan · Pengaturan).
   Dibuka langsung di browser, halaman-halaman itu dialihkan ke profile.html?tab=... (query ?from= dan hash dipertahankan).
   Skrip ini hanya berjalan saat halamannya dibuka langsung; hub dan UT.Spa mengambil halaman lewat fetch + parse sehingga skrip ini
   tidak dijalankan (dan namanya masuk SKIP_JS di account-hub.js dan spa-host.js). */
(function () {
  var TAB = { 'friendship.html': 'teman', 'mail.html': 'pesan', 'settings.html': 'setelan' };
  var tab = TAB[location.pathname.split('/').pop()];
  if (!tab) return;
  var q = location.search.replace(/^\?/, '');
  location.replace('profile.html?tab=' + tab + (q ? '&' + q : '') + location.hash);
})();
