/* play.js — dipindah dari <script> inline (play.html). */
(function () {
  var f = document.getElementById('f'), ov = document.getElementById('ov'), go = 'splash.html';
  try {
    var q = new URLSearchParams(location.search).get('go');
    // hanya halaman .html di folder yang sama (bukan play.html/index.html) agar tidak jadi open redirect
    if (q && /^[A-Za-z0-9_-]+\.html(\?[^#]*)?(#.*)?$/.test(q) && !/^(play|index)\.html/.test(q)) go = q;
  } catch (e) {}

  /* ================= Layar memuat (kondisional, bukan timer) =================
     Halaman akan pergi (pagehide/beforeunload)  -> layar memuat tampil seketika, menutup jeda kosong.
     Halaman baru selesai (load + font + gambar) -> layar memuat dihilangkan.
     splash.html punya layar muat sendiri (pulau melayang), jadi layar dadu ini tidak ditampilkan di atasnya. */
  var SELF_LOADING = /^splash\.html$/;
  function pageName(w) { try { return (w.location.pathname.split('/').pop() || 'index.html'); } catch (e) { return ''; } }
  /* Overlay antar-halaman: tirai awan (tanpa persen palsu; progres asli dihitung di splash).
     Setelah splash (yang sudah memuat dan menyimpan aset di cache) overlay hanya latar polos, agar tidak tampak memuat dua kali. */
  var hideT = 0, shown = true, shownAt = 0, MIN_SHOW = 700;   // awan minimal tampil 0,7 dtk (sempat melayang) sebelum menyibak
  /* progres: tahap nyata (halaman dimuat -> font/latar/gambar siap) + merayap pelan menuju batas tahap, tidak pernah terlihat diam */
  var bar = ov.querySelector('.ldb b'), lbl = ov.querySelector('.ldt span'), pct = 0, cap = 60, creepRaf = 0;
  function setP(v) { if (v > pct) { pct = v; bar.style.width = pct + '%'; } }
  function stage(c, text) { if (c > cap) cap = c; if (text && lbl) lbl.textContent = text; }
  function resetP() { pct = 0; cap = 60; bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; if (lbl) lbl.textContent = 'Memuat halaman'; setP(6); }
  function creep() { cancelAnimationFrame(creepRaf); (function tick() { if (!shown) return; var room = cap - pct; if (room > 0.2) setP(pct + room * 0.03); creepRaf = requestAnimationFrame(tick); })(); }
  /* Tirai awan TERTUNDA: pindah halaman yang cepat (aset sudah di cache dari splash) tidak menampilkan loading sama sekali.
     Tirai baru muncul bila halaman tujuan belum siap setelah SHOW_DELAY. Selama menunggu, iframe polos (warna sama dengan latar) agar tidak ada kilatan baru. */
  var SHOW_DELAY = 320, armed = false, showT = 0;
  function doShow(quiet) {
    shown = true; shownAt = Date.now(); ov.classList.toggle('quiet', !!quiet);
    ov.classList.remove('hide'); resetP(); creep();
  }
  function showOv(quiet) {
    /* Antar-halaman SELALU senyap: layar hitam polos (sama dengan fade hitam tiap halaman), tanpa tirai awan / teks "Menyiapkan tampilan" / bar.
       Sebelumnya tirai awan biru-putih muncul bila halaman tujuan belum siap dalam 320 ms, sehingga berpindah halaman terasa tersendat dan tidak sinkron. */
    quiet = true;
    clearTimeout(hideT);
    if (shown && !ov.classList.contains('hide')) return;   // pagehide + beforeunload bisa datang berurutan
    if (quiet) { armed = false; clearTimeout(showT); doShow(true); return; }
    if (armed) return;
    armed = true; clearTimeout(showT);
    showT = setTimeout(function () { armed = false; doShow(false); }, SHOW_DELAY);
  }
  function hideOv() {
    if (armed) { armed = false; clearTimeout(showT); return; }   // halaman siap sebelum tirai sempat muncul
    if (!shown) return;
    shown = false; clearTimeout(hideT);
    setP(100);   // bar penuh dulu, baru awan menyibak
    var wait = 60;   // senyap: begitu halaman siap, langsung buka
    hideT = setTimeout(function () { ov.classList.add('hide'); }, wait);
  }
  ov.classList.add('quiet');   // pembukaan pertama: splash langsung tampil di bawahnya, jangan ada dadu/teks lebih dulu

  function whenReady(w, cb) {
    var d; try { d = w.document; } catch (e) { cb(); return; }
    var fonts = (d && d.fonts && d.fonts.ready) ? d.fonts.ready.catch(function () {}) : Promise.resolve();
    var imgs = [];
    try { imgs = Array.prototype.filter.call(d.images || [], function (im) { return !im.complete && im.src; }); } catch (e) {}
    var waits = imgs.map(function (im) { return new Promise(function (r) { im.addEventListener('load', r); im.addEventListener('error', r); }); });
    /* latar harus sudah ter-decode, kalau tidak frame pertama tampil polos */
    var bg = Promise.resolve();
    try { var bi = d.querySelector('.sbg-img'); if (bi && bi.decode) bg = bi.decode().catch(function () {}); } catch (e) {}
    /* halaman yang menyembunyikan body sampai render awal selesai (html:not(.ut-ready) body{visibility:hidden}):
       jangan buka overlay sebelum body benar-benar terlihat (maks 2 dtk agar tidak macet). */
    var shownBody = new Promise(function (r) {
      var t0 = Date.now();
      (function poll() {
        var hidden = false;
        try { hidden = w.getComputedStyle(d.body).visibility === 'hidden'; } catch (e) {}
        if (!hidden || Date.now() - t0 > 2000) r(); else setTimeout(poll, 30);
      })();
    });
    var all = [fonts, bg, shownBody].concat(waits), n = all.length;
    all.forEach(function (pr) { pr.then(function () { stage(Math.min(96, cap + 24 / n)); setP(Math.min(94, pct + 24 / n)); }); });
    Promise.all(all).then(function () {
      /* dua frame: beri kesempatan halaman menggambar frame pertamanya sebelum layar memuat dibuka */
      requestAnimationFrame(function () { requestAnimationFrame(cb); });
    });
  }

  /* ================= Suara & musik (dimiliki pembungkus agar tidak putus antar halaman) ================= */
  function settings() {
    try { var s = (f.contentWindow.PlayerData || window.PlayerData).settings(); return { music: s.music !== false, sound: s.sound !== false }; } catch (e) {}
    return { music: true, sound: true };
  }
  function musicVol() { try { var v = parseInt(UT.Prefs.get('musicVol', 30), 10); return (isNaN(v) ? 30 : Math.max(0, Math.min(100, v))) / 100; } catch (e) { return 0.3; } }   // bawaan 30%
  function sfxVol() { try { var v = parseInt(UT.Prefs.get('sfxVol', 100), 10); return (isNaN(v) ? 100 : Math.max(0, Math.min(100, v))) / 100; } catch (e) { return 1; } }

  /* Musik latar untuk semua halaman selain gameplay (gameplay punya musiknya sendiri).
     Empat lagu di assets/music diputar bergantian. */
  var TRACKS = ['assets/music/sunset_plains.mp3', 'assets/music/community.mp3', 'assets/music/first_light_particles.mp3', 'assets/music/rainy.mp3'], ti = 0, bgm = null, fadeRaf = 0;
  var wantMusic = false;                     // halaman saat ini boleh bermusik (bukan gameplay)
  function ensureBgm() {
    if (bgm) return bgm;
    try {
      bgm = new Audio(); bgm.preload = 'auto'; bgm.src = TRACKS[ti]; bgm.volume = 0;
      bgm.addEventListener('ended', function () { ti = (ti + 1) % TRACKS.length; bgm.src = TRACKS[ti]; syncMusic(); });
    } catch (e) { bgm = null; }
    return bgm;
  }
  function fadeTo(v, ms, done) {
    cancelAnimationFrame(fadeRaf);
    if (!bgm) { if (done) done(); return; }
    var from = bgm.volume, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      try { bgm.volume = Math.max(0, Math.min(1, from + (v - from) * k)); } catch (e) {}
      if (k < 1) fadeRaf = requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  var needGesture = false;
  function syncMusic() {
    var on = wantMusic && settings().music && !document.hidden;
    if (on) {
      if (!ensureBgm()) return;
      if (bgm.paused) {
        var p; try { p = bgm.play(); } catch (e) {}
        if (p && p.catch) p.catch(function () { needGesture = true; });   // diblokir browser: coba lagi pada gesture pertama
        else if (!p) needGesture = true;
      }
      fadeTo(musicVol(), 400);
    } else if (bgm && !bgm.paused) {
      fadeTo(0, 300, function () { if (!(wantMusic && settings().music && !document.hidden)) { try { bgm.pause(); } catch (e) {} } });
    }
  }
  function onGesture() { if (needGesture) { needGesture = false; syncMusic(); } }
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (ev) { window.addEventListener(ev, onGesture, true); });
  document.addEventListener('visibilitychange', syncMusic);

  /* Suara ketukan tombol: kolam kecil agar ketukan beruntun tidak saling memotong; tetap bunyi walau halaman langsung berpindah. */
  var clickPool = [], clickI = 0;
  function playClick() {
    if (!settings().sound) return;
    try {
      if (!clickPool.length) for (var i = 0; i < 4; i++) { var a = new Audio('assets/sfx/ui/button-click.mp3'); a.preload = 'auto'; clickPool.push(a); }
      var el = clickPool[clickI++ % clickPool.length]; el.currentTime = 0; el.volume = 0.7 * sfxVol();
      var p = el.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  window.UTShell = { click: playClick, syncMusic: syncMusic };   // dipakai UT.Audio di halaman (app.js)

  /* Setelah setiap ketukan di halaman, baca ulang pengaturan (toggle Musik/Suara di Pengaturan berlaku seketika). */
  function afterTap() { setTimeout(syncMusic, 0); setTimeout(syncMusic, 120); }

  /* ================= Pasang pada setiap halaman yang dimuat di iframe ================= */
  f.addEventListener('load', function () {
    var w; try { w = f.contentWindow; w.document; } catch (e) { hideOv(); return; }
    var name = pageName(w);

    // layar memuat
    stage(84, 'Menyiapkan tampilan'); setP(70);   // dokumen sudah dimuat
    if (SELF_LOADING.test(name)) hideOv(); else whenReady(w, hideOv);
    var leave = function () { showOv(SELF_LOADING.test(name)); };
    try {
      w.addEventListener('beforeunload', leave);
      w.addEventListener('pagehide', leave);
      w.addEventListener('pageshow', function (e) { if (e.persisted) hideOv(); });
    } catch (e) {}

    // musik: gameplay = berhenti; splash/loading = biarkan apa adanya; selain itu = bermusik
    if (name === 'gameplay.html') { wantMusic = false; syncMusic(); }
    else if (!SELF_LOADING.test(name)) { wantMusic = true; syncMusic(); }
    try { w.focus(); } catch (e) {}
    try { w.document.addEventListener('click', afterTap, true); } catch (e) {}
  });
  f.src = go;
})();
