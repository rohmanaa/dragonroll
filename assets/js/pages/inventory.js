/* inventory.js — SATU halaman Inventory: tab Power-up / Ore / Log (hanya item yang dimiliki).
   Power-up = halaman lama (powerup.html) di iframe ?embed=inv, jadi sistem beli/pakai/3D/server tidak berubah; Ore & Log dirender di sini (kosong dulu).
   Frame / Dadu / Efek / Pet tidak lagi tab Inventory: dipasang dari Karakter (bar tab Perlengkapan) dan Pet dari tombol Pet di lobby.
   Tahap 3 SPA: dibungkus UT.PageModule ('inventory'); jadi view di shell play.html (tab tetap iframe bersarang sampai tiap tab dimigrasikan). */
UT.PageModule.define('inventory', function (env) {
  'use strict';
  var addEventListener = env.addEventListener, setTimeout = env.setTimeout;
  var $ = function (s) { return document.querySelector(s); };
  var TABS = UT.InvTabs.tabsOf('inv');
  var KEY = UT.InvTabs.KEY, host = $('#views'), loading = $('#view-loading'), tabsEl = $('#tabs'), cur = '', frames = {};
  var SET = function () { try { return window.PlayerData.settings(); } catch (e) { return {}; } };
  function snd() { try { if (SET().sound) UT.Audio.play('button'); } catch (e) {} }

  function fit() { var k = Math.min(innerWidth / 1920, innerHeight / 1080); $('#stage').style.transform = 'scale(' + k + ')'; document.documentElement.style.setProperty('--invs', k); }
  addEventListener('resize', fit); fit();

  /* di shell (play.html) semua target lewat UT.Spa.go; halaman mandiri: fade 330 ms lalu pindah halaman biasa */
  function nav(u) { if (window.UT && UT.Spa && UT.Spa.go) { UT.Spa.go(u); return; } $('#fade').classList.add('on'); setTimeout(function () { location.href = u; }, 330); }
  /* di shell location.search milik play.html (?go=...): ?tab= diambil dari URL rute aktif */
  function search() { var c = window.UT && UT.Spa && UT.Spa.current && UT.Spa.current(); if (c && c.name === 'inventory') { var i = c.url.indexOf('?'); return i < 0 ? '' : c.url.slice(i).split('#')[0]; } return location.search; }
  function inShell() { var c = window.UT && UT.Spa && UT.Spa.current && UT.Spa.current(); return !!(c && c.name === 'inventory'); }

  tabsEl.innerHTML = UT.InvTabs.markup('');

  /* Tiap tab dimuat SEKALI (iframe dibuat saat pertama dibuka) lalu disimpan; pindah tab = tampilkan/sembunyikan saja.
     Iframe yang disembunyikan (display:none) tidak menjalankan animasi/3D, jadi tidak membebani. */
  function mk(t) {
    var f = document.createElement('iframe');
    f.className = 'view'; f.title = t.label; f.setAttribute('allow', 'autoplay');
    f.addEventListener('load', function () {
      /* cadangan bila Navigation API tidak ada: iframe berpindah ke halaman lain -> induk yang berpindah */
      try {
        var p = f.contentWindow.location.pathname.split('/').pop();
        if (p && !TABS.some(function (x) { return x.page === p; }) && p !== 'inventory.html') { nav(p + f.contentWindow.location.search); return; }
      } catch (e) {}
      f.classList.add('ready');
      if (f.classList.contains('on')) loading.hidden = true;
    });
    f.src = t.page + '?embed=inv';
    host.appendChild(f);
    return f;
  }
  function open(k, quiet) {
    var t = TABS.filter(function (x) { return x.k === k; })[0] || TABS[0];
    if (t.k === cur) return;
    /* Tab yang sudah jadi view (Pet) tidak dimuat di iframe: pindah ke view-nya langsung (tanpa dokumen bersarang) */
    if (UT.InvTabs.VIEW_TABS[t.k] && inShell() && UT.Spa.canView(UT.InvTabs.VIEW_TABS[t.k])) {
      try { sessionStorage.setItem(KEY, t.k); } catch (e) {}
      if (!quiet) snd();
      nav(UT.InvTabs.VIEW_TABS[t.k]);
      return;
    }
    cur = t.k;
    Array.prototype.forEach.call(tabsEl.children, function (b) { b.classList.toggle('on', b.dataset.k === t.k); });
    try { sessionStorage.setItem(KEY, t.k); if (!inShell()) history.replaceState(null, '', 'inventory.html?tab=' + t.k); } catch (e) {}   /* di shell URL milik play.html?go=... */
    Array.prototype.forEach.call(host.querySelectorAll('.native'), function (p) { p.classList.toggle('on', p.dataset.k === t.k); });
    if (t.native) {   /* Ore / Log: isi native, tanpa iframe */
      Object.keys(frames).forEach(function (x) { frames[x].classList.remove('on'); });
      loading.hidden = true;
      if (!quiet) snd();
      return;
    }
    if (!frames[t.k]) frames[t.k] = mk(t);
    frames[t.k].classList.remove('warm');   // dibuka pengguna: tidak lagi pemanasan
    Object.keys(frames).forEach(function (x) { frames[x].classList.toggle('on', x === t.k); });
    loading.hidden = frames[t.k].classList.contains('ready');
    if (!quiet) snd();
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) open(b.dataset.k); });
  host.addEventListener('click', function (e) { var g = e.target.closest('[data-go]'); if (g) { snd(); nav(g.dataset.go); } });
  $('#back').addEventListener('click', function () { snd(); nav('lobby.html'); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') nav('lobby.html'); });
  addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'ut-inv-nav' || !Object.keys(frames).some(function (x) { return frames[x].contentWindow === e.source; })) return;
    var u = String(e.data.url || '');
    if (/^[A-Za-z0-9_-]+\.html(\?[^#]*)?$/.test(u) && !/^(play|index)\.html/.test(u)) nav(u);
  });
  addEventListener('pageshow', function (e) { if (e.persisted) $('#fade').classList.remove('on'); });

  var q = new URLSearchParams(search()).get('tab'), saved = '';
  try { saved = sessionStorage.getItem(KEY) || ''; } catch (e) {}
  open(q || saved || 'power', true);

  /* Pemanasan: begitu tab pertama selesai dimuat, tab lain dimuat diam-diam satu per satu (opacity 0, tidak bisa diklik),
     jadi pindah tab nyaris tanpa layar loading. Dimuat dalam keadaan tampil-tak-terlihat (.warm) supaya ukuran/layout halaman
     sama seperti biasa; setelah selesai kembali display:none (tidak menjalankan animasi/3D). Dilewati bila hemat data/memori. */
  function canWarm() {
    try { var n = navigator, c = n.connection || {}; if (c.saveData) return false; if (n.deviceMemory && n.deviceMemory < 4) return false; } catch (e) {}
    return true;
  }
  function warm() {
    var next = TABS.filter(function (t) { return !t.native && !frames[t.k]; })[0];
    if (!next) return;
    var f = frames[next.k] = mk(next), done = false;
    f.classList.add('warm');
    function again() {
      if (done) return; done = true;
      setTimeout(function () { f.classList.remove('warm'); }, 300);
      setTimeout(warm, 400);
    }
    f.addEventListener('load', again);
    setTimeout(again, 6000);   // jangan menunggu tab yang macet
  }
  if (canWarm() && frames[cur]) {
    var first = frames[cur], started = false;
    var go = function () { if (started) return; started = true; setTimeout(warm, 500); };
    first.addEventListener('load', go);
    setTimeout(go, 6000);
  }
});
