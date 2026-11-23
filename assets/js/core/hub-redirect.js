/* hub-redirect.js — friendship.html / mail.html / leaderboard.html / hadiah-misi.html / settings.html kini PANEL di hub profile.html
   (Profil · Teman · Pesan · Peringkat · Misi · Pengaturan).
   Dibuka langsung di browser, halaman-halaman itu dialihkan ke profile.html?tab=... (query ?from= dan hash dipertahankan).
   hadiah-misi.html?tab=hadiah|misi|ach: ?tab= milik halaman lama dipindah jadi &sub= (tab hub = misi); tanpa ?tab= = Hadiah Harian seperti dulu.
   Skrip ini hanya berjalan saat halamannya dibuka langsung; hub dan UT.Spa mengambil halaman lewat fetch + parse sehingga skrip ini
   tidak dijalankan (dan namanya masuk SKIP_JS di account-hub.js dan spa-host.js). */
(function () {
  var TAB = { 'friendship.html': 'teman', 'mail.html': 'pesan', 'leaderboard.html': 'peringkat', 'hadiah-misi.html': 'misi', 'settings.html': 'setelan' };
  var page = location.pathname.split('/').pop();
  var tab = TAB[page];
  if (!tab) return;
  var q = location.search.replace(/^\?/, '');
  if (page === 'hadiah-misi.html') {
    var m = /(?:^|&)tab=([a-z]{1,12})(?=&|$)/.exec(q), sub = m ? m[1] : 'hadiah';
    q = q.replace(/(?:^|&)tab=[^&]*/g, '').replace(/^&/, '');
    q = 'sub=' + sub + (q ? '&' + q : '');
  }
  location.replace('profile.html?tab=' + tab + (q ? '&' + q : '') + location.hash);
})();
