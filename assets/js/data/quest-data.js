/* Quest (Daily Quest) — definisi misi harian. Dipakai misi.html dan hadiah-misi.html.
   Tahap 4: progres, klaim, reset (hari WIB) dan hadiah SEPENUHNYA di server (quest_get/quest_track/quest_claim*,
   lewat UT.WalletService). Berkas ini hanya memuat teks/ikon/nominal tampilan; tidak ada penyimpanan lokal.
   Key lama 'ut:quest' dibersihkan dari browser. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var DEFS = [
    { id: 'login',  title: 'Login Harian',      desc: 'Masuk ke dalam game',         goal: 1,  reward: 100, icon: 'mode/calndar' },
    { id: 'play',   title: 'Mainkan Permainan', desc: 'Selesaikan 1 pertandingan',   goal: 1,  reward: 150, icon: 'items/dadu' },
    { id: 'win',    title: 'Raih Kemenangan',   desc: 'Menangkan 3 pertandingan',    goal: 3,  reward: 250, icon: 'lobby/trophy' },
    { id: 'dice',   title: 'Lempar Dadu',       desc: 'Lempar dadu 30 kali',         goal: 30, reward: 120, icon: 'items/dadu' },
    { id: 'ladder', title: 'Naik Tangga',       desc: 'Naik tangga 5 kali',          goal: 5,  reward: 120, icon: 'lobby/leader' },
    { id: 'dragon', title: 'Serang Naga',       desc: 'Serang naga 3 kali',          goal: 3,  reward: 200, icon: 'items/efek' },
    { id: 'chest',  title: 'Buka Peti',         desc: 'Buka peti 3 kali',            goal: 3,  reward: 120, icon: 'lobby/inventory' },
    { id: 'skill',  title: 'Pakai Skill',       desc: 'Gunakan skill 3 kali',        goal: 3,  reward: 120, icon: 'items/power' }
  ];
  var BONUS = 300;
  try { win.localStorage.removeItem('ut:quest'); } catch (e) {}
  UT.Quest = {
    DEFS: DEFS, BONUS: BONUS,
    total: function () { return DEFS.reduce(function (a, d) { return a + d.reward; }, 0); }
  };
})(window);
