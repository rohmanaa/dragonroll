/* account.js — modul halaman 'profile' (view/rute profile.html) = HUB Profil · Teman · Pesan · Pengaturan.
   Isi tiap panel adalah modul sendiri ('profil' di profile.js, 'friendship', 'mail', 'settings') yang dipasang/dilepas UT.AccountHub di dalam #pane.
   Halaman mandiri: profile.html mem-mount modul ini lewat skrip inline; di shell (play.html) UT.Spa yang me-mount-nya.
   unmount() melepas hub: panel aktif di-unmount, kerangka modal dibuang, latar tidak lagi inert. */
UT.PageModule.define('profile', function (env) {
  var url = '';
  try {
    var c = UT.Spa && UT.Spa.current && UT.Spa.current();
    url = c && c.name === 'profile' ? c.url : 'profile.html' + location.search;   // shell: URL rute aktif; mandiri: query halaman
  } catch (e) { url = 'profile.html' + location.search; }
  UT.AccountHub.open(env, url);
});
