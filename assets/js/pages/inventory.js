/* inventory.js — SATU halaman Inventory: tab Power-up / Chest / Ore / Log (hanya item yang dimiliki).
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

  /* ---- Tab Chest (native): HANYA chest yang sudah dimiliki (hasil klaim di Lobby), pola UI Power-up: panel kiri (pratinjau + nama + jumlah dimiliki),
     grid slot kanan (chip jumlah), satu tombol BUKA kanan bawah. Tanpa harga. BUKA = hadiah langsung (tanpa timer; server: chest_collect). Klaim ada di modal Chest di Lobby. ---- */
  var CIC = 'assets/images/ui/', CS = null, cBusy = false, cReward = null, cSel = '', tt = 0;
  var CK = { wood: { nm: 'Peti Kayu', im: 'chest-packs/peti-kayu' }, silver: { nm: 'Peti Silver', im: 'chest-packs/peti-perak' }, gold: { nm: 'Peti Gold', im: 'chest-packs/peti-emas' }, diamond: { nm: 'Peti Diamond', im: 'chest-packs/peti-diamond' } };
  var CDS = { wood: 'Berisi coin dan XP. Hadiah dasar dari game harian.', silver: 'Coin lebih banyak, kadang gem atau power-up.', gold: 'Hadiah besar: coin, gem, dan peluang power-up.', diamond: 'Hadiah terbaik dengan gem dan power-up langka.' };
  var CORD = ['wood', 'silver', 'gold', 'diamond'];
  var CWM = { 'jaringan': 'Tidak dapat terhubung ke server.', 'belum-login': 'Silakan login ulang.', 'sedang-diproses': 'Sedang diproses...', 'sudah-diambil': 'Chest sudah diambil.', 'tidak-ada': 'Chest tidak ditemukan.' };
  var cBox = $('#chestBox');
  function fmt(n) { return Number(n).toLocaleString('id-ID'); }
  function cWS() { return window.UT && UT.WalletService && UT.WalletService.get(); }
  function cSV() { try { return !!(window.PlayerData.serverMode && window.PlayerData.serverMode()); } catch (e) { return false; } }
  function toast(m) { var t = $('#invToast'); if (!t) return; t.textContent = m; t.classList.add('on'); env.clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 1900); }
  function cOwned() { return CS && Array.isArray(CS.chests) ? CS.chests.filter(function (c) { return c.status !== 'collected'; }) : []; }
  function cHtml() {
    if (!cSV()) return '<div class="cempty">Masuk ke akun untuk<br>memakai Chest.</div>';
    if (cReward) {
      var k = CK[cReward.kind] || CK.wood, x = '<div class="rwd"><img class="mi" src="' + CIC + k.im + '.webp" alt=""><div class="rt">' + k.nm + ' Terbuka!</div>';
      x += '<div class="rw"><img src="' + CIC + 'hud/ikon-koin-emas.webp" alt="">+' + fmt(cReward.coins) + ' Coin</div>';
      if (cReward.gems > 0) x += '<div class="rw"><img src="' + CIC + 'gem-medal-icons/berlian-hijau.webp" alt="">+' + fmt(cReward.gems) + ' Gem</div>';
      if (cReward.xp > 0) x += '<div class="rw">+' + fmt(cReward.xp) + ' XP</div>';
      if (cReward.power) { var it = window.ItemCatalog && ItemCatalog.byId(cReward.power); x += '<div class="rw pw">' + (it && it.icon ? '<img src="' + it.icon + '" alt="">' : '') + 'Power: ' + (it ? it.name : cReward.power) + ' ×1</div>'; }
      return x + '<button class="btn cb" type="button" data-cback><img src="' + CIC + 'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>MANTAP!</span></button></div>';
    }
    if (!CS) return '<div class="cempty">Memuat…</div>';
    var L = cOwned(), by = {};
    L.forEach(function (c) { (by[c.kind] = by[c.kind] || []).push(c); });
    var kinds = CORD.filter(function (q) { return by[q]; });
    if (!kinds.length) return '<div class="cempty">Belum ada chest.<small>Main game, lalu klaim chest harian lewat tombol Chest di Lobby.</small></div>';
    if (!by[cSel]) cSel = kinds[0];
    var sk = CK[cSel] || CK.wood, sn = by[cSel].length;
    var h = '<section id="cl"><div id="cpv"><img src="' + CIC + sk.im + '.webp" alt=""></div><div id="cnm">' + sk.nm + '</div>' +
      '<div id="cown">Dimiliki ×' + fmt(sn) + '</div><p id="cds">' + (CDS[cSel] || '') + '</p></section><section id="cr"><div id="cg">';
    kinds.forEach(function (q) {
      var kk = CK[q] || CK.wood, n = by[q].length;
      h += '<button class="fslot' + (q === cSel ? ' sel' : '') + '" type="button" data-kind="' + q + '" aria-label="' + kk.nm + ', jumlah ' + n + '"><img class="dc" src="' + CIC + kk.im + '.webp" alt=""><span class="chip-n">' + (n > 99 ? '99+' : n) + '</span></button>';
    });
    return h + '</div></section><button class="btn" id="cact" type="button" aria-label="Buka ' + sk.nm + '"><img src="' + CIC + 'buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>BUKA</span></button>';
  }
  function cPaint() { if (!env.disposed && cBox) cBox.innerHTML = '<div id="cbox">' + cHtml() + '</div>'; }
  function cPull() {
    var w = cWS(); if (!cSV() || !w || !w.chestGet) { cPaint(); return Promise.resolve(); }
    return w.chestGet().then(function (r) { if (env.disposed) return; if (r && r.ok !== false && Array.isArray(r.daily)) CS = r; cPaint(); }, function () { cPaint(); });
  }
  function cEnter() { cReward = null; cPaint(); cPull(); }
  function cOpen(id) {
    if (cBusy) return; cBusy = true;
    var w = cWS();
    Promise.resolve(w ? w.chestCollect(id) : { ok: false, reason: 'jaringan' }).then(function (r) {
      if (env.disposed) return;
      if (r && r.ok) { if (Array.isArray(r.daily)) CS = r; try { if (SET().sound) UT.Audio.play('chest'); } catch (e2) {} cReward = r; }
      else { toast(CWM[r && r.reason] || 'Gagal, coba lagi'); return cPull(); }
    }).catch(function () { toast('Gagal, coba lagi'); }).then(function () { cBusy = false; cPaint(); });
  }
  if (cBox) cBox.addEventListener('click', function (e) {
    if (e.target.closest('[data-cback]')) { snd(); cReward = null; cPaint(); return; }
    var b = e.target.closest('button[data-kind]');
    if (b) { snd(); cSel = b.dataset.kind; cPaint(); return; }
    if (!e.target.closest('#cact')) return;
    var c = cOwned().filter(function (x) { return x.kind === cSel; })[0]; if (!c) return;
    snd(); cOpen(c.id);
  });

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
    if (t.k === 'chest') cEnter();
    if (t.native) {   /* Chest / Ore / Log: isi native, tanpa iframe */
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
