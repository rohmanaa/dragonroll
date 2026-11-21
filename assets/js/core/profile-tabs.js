/* UT.ProfileTabs — baris tab di ATAS untuk 4 halaman: Profil, Teman, Pesan, Pengaturan (gaya referensi: tab menyatu ke panel).
   Isi tiap halaman tidak diubah; tab hanya berpindah antar-halaman (UT.Spa.go di shell, fade + location.href di halaman mandiri).
   Pakai: UT.ProfileTabs.mount('profil'|'teman'|'pesan'|'setelan', env) di awal modul halaman; env.own melepas tab saat unmount. */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var TABS = [['profil', 'Profil', 'profile.html'], ['teman', 'Teman', 'friendship.html'], ['pesan', 'Pesan', 'mail.html'], ['setelan', 'Pengaturan', 'settings.html']];
  function go(url) {
    if (UT.Spa && UT.Spa.go) { UT.Spa.go(url); return; }
    var f = document.getElementById('fade');
    if (f) f.classList.add('on');
    setTimeout(function () { location.href = url; }, 330);
  }
  function mount(active, env) {
    var stage = document.getElementById('stage');
    if (!stage) return function () {};
    var old = document.getElementById('ptabs');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var nav = document.createElement('nav');
    nav.id = 'ptabs'; nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Profil, Teman, Pesan, Pengaturan');
    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ptab' + (t[0] === active ? ' on' : ''); b.dataset.k = t[0];
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', t[0] === active ? 'true' : 'false');
      b.textContent = t[1];
      b.addEventListener('click', function () {
        if (t[0] === active) return;
        try { var S = window.PlayerData && PlayerData.settings(); if (S && S.sound && UT.Audio) UT.Audio.play('button'); if (S && S.vibration && navigator.vibrate) navigator.vibrate(15); } catch (e) {}
        go(t[2]);
      });
      nav.appendChild(b);
    });
    stage.appendChild(nav);
    stage.classList.add('has-ptabs');
    function remove() {
      if (nav.parentNode) nav.parentNode.removeChild(nav);
      stage.classList.remove('has-ptabs');
    }
    if (env && typeof env.own === 'function') env.own(remove);
    return remove;
  }
  UT.ProfileTabs = { TABS: TABS, mount: mount };
})();
