/* Quest (Daily Quest) — definisi misi harian. Dipakai misi.html dan hadiah-misi.html.
   Tahap 4: progres, klaim, reset (hari WIB) dan hadiah SEPENUHNYA di server (quest_get/quest_track/quest_claim*,
   lewat UT.WalletService). Berkas ini hanya memuat teks/ikon/nominal tampilan; tidak ada penyimpanan lokal.
   Key lama 'ut:quest' dibersihkan dari browser. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var DEFS = [
    { id: 'login', title: 'Login Harian',      desc: 'Masuk ke dalam game',        goal: 1, reward: 50,  icon: 'mode/calndar' },
    { id: 'play',  title: 'Mainkan Permainan', desc: 'Selesaikan 1 pertandingan',  goal: 1, reward: 75,  icon: 'items/dadu' },
    { id: 'win',   title: 'Raih Kemenangan',   desc: 'Menangkan 3 pertandingan',   goal: 3, reward: 150, icon: 'lobby/trophy' }
  ];
  var BONUS = 100;
  try { win.localStorage.removeItem('ut:quest'); } catch (e) {}
  UT.Quest = {
    DEFS: DEFS, BONUS: BONUS,
    total: function () { return DEFS.reduce(function (a, d) { return a + d.reward; }, 0); }
  };
})(window);
