/* inventory.js — SATU halaman Inventory: tab Frame / Dadu / Efek / Power-up / Pet.
   Tiap tab = halaman lama (frame.html dst.) dimuat di iframe ?embed=inv, jadi seluruh sistem (beli, pakai, 3D, server) tidak berubah. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TABS = [
    { k: 'frame', page: 'frame.html', label: 'Frame', icon: 'new-icon/frame.webp' },
    { k: 'dadu', page: 'dadu.html', label: 'Dadu', icon: 'new-icon/dadu.webp' },
    { k: 'efek', page: 'efek.html', label: 'Efek', icon: 'ikon-gem-medali/kristal-api.webp' },
    { k: 'power', page: 'powerup.html', label: 'Power-up', icon: 'ikon-gem-medali/petir-ungu.webp' },
    { k: 'pet', page: 'pet.html', label: 'Pet', icon: 'lobby/pet.webp' }
  ];
  var KEY = 'ut-inv-tab', host = $('#views'), tabsEl = $('#tabs'), cur = '', frames = {};
  var SET = function () { try { return window.PlayerData.settings(); } catch (e) { return {}; } };
  function snd() { try { if (SET().sound) UT.Audio.play('button'); } catch (e) {} }

  function fit() { $('#stage').style.transform = 'scale(' + Math.min(innerWidth / 1920, innerHeight / 1080) + ')'; }
  addEventListener('resize', fit); fit();

  function nav(u) { $('#fade').classList.add('on'); setTimeout(function () { location.href = u; }, 330); }

  tabsEl.innerHTML = TABS.map(function (t) {
    return '<button class="tab" type="button" data-k="' + t.k + '" aria-label="' + t.label + '"><img class="ic" src="assets/ng/komponen/' + t.icon + '" alt=""><span>' + t.label + '</span><img class="ul" src="assets/ng/komponen/ikon-navigasi/garis-bawah-tab-emas.webp" alt=""></button>';
  }).join('');

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
    });
    f.src = t.page + '?embed=inv';
    host.appendChild(f);
    return f;
  }
  function open(k, quiet) {
    var t = TABS.filter(function (x) { return x.k === k; })[0] || TABS[0];
    if (t.k === cur) return;
    cur = t.k;
    Array.prototype.forEach.call(tabsEl.children, function (b) { b.classList.toggle('on', b.dataset.k === t.k); });
    try { sessionStorage.setItem(KEY, t.k); history.replaceState(null, '', 'inventory.html?tab=' + t.k); } catch (e) {}
    if (!frames[t.k]) frames[t.k] = mk(t);
    Object.keys(frames).forEach(function (x) { frames[x].classList.toggle('on', x === t.k); });
    if (!quiet) snd();
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) open(b.dataset.k); });
  $('#back').addEventListener('click', function () { snd(); nav('lobby.html'); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') nav('lobby.html'); });
  addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'ut-inv-nav' || !Object.keys(frames).some(function (x) { return frames[x].contentWindow === e.source; })) return;
    var u = String(e.data.url || '');
    if (/^[A-Za-z0-9_-]+\.html(\?[^#]*)?$/.test(u) && !/^(play|index)\.html/.test(u)) nav(u);
  });
  addEventListener('pageshow', function (e) { if (e.persisted) $('#fade').classList.remove('on'); });

  var q = new URLSearchParams(location.search).get('tab'), saved = '';
  try { saved = sessionStorage.getItem(KEY) || ''; } catch (e) {}
  open(q || saved || 'frame', true);
})();
