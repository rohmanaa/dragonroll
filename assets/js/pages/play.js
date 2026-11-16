/* play.js — dipindah dari blok script inline (play.html). */
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
  /* Awan dipanaskan di awal: SVG dimuat + di-decode sebelum pernah tampil, supaya tirai langsung lengkap (tidak ada awan yang telat muncul). */
  var cloudWarm = [];
  ['cloud-1', 'cloud-2', 'cloud-3'].forEach(function (n) {
    try { var im = new Image(); im.src = 'assets/images/background/clouds/' + n + '.svg'; if (im.decode) im.decode().catch(function () {}); cloudWarm.push(im); } catch (e) {}
  });
  var SELF_LOADING = /^splash\.html$/;
  function pageName(w) { try { return (w.location.pathname.split('/').pop() || 'index.html'); } catch (e) { return ''; } }
  /* Overlay antar-halaman: tirai awan (tanpa persen palsu; progres asli dihitung di splash).
     Setelah splash (yang sudah memuat dan menyimpan aset di cache) overlay hanya latar polos, agar tidak tampak memuat dua kali. */
  var hideT = 0, shown = true, shownAt = 0, MIN_SHOW = 600;   // awan minimal tampil 0,7 dtk (sempat melayang) sebelum menyibak
  /* progres: tahap nyata (halaman dimuat -> font/latar/gambar siap) + merayap pelan menuju batas tahap, tidak pernah terlihat diam */
  var bar = ov.querySelector('.ldb b'), lbl = ov.querySelector('.ldt span'), pct = 0, cap = 60, creepRaf = 0;
  function setP(v) { if (v > pct) { pct = v; bar.style.width = pct + '%'; } }
  function stage(c, text) { if (c > cap) cap = c; if (text && lbl) lbl.textContent = text; }
  function resetP() { pct = 0; cap = 60; bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; if (lbl) lbl.textContent = 'Memuat halaman'; setP(6); }
  function creep() { clearTimeout(creepRaf); (function tick() { if (!shown) return; var room = cap - pct; if (room > 0.2) setP(pct + room * 0.08); creepRaf = setTimeout(tick, 100); })(); }   // 10x/dtk (bukan tiap frame): tidak membebani halaman yang sedang dimuat
  /* Tirai awan TERTUNDA: pindah halaman yang cepat (aset sudah di cache dari splash) tidak menampilkan loading sama sekali.
     Tirai baru muncul bila halaman tujuan belum siap setelah SHOW_DELAY. Selama menunggu, iframe polos (warna sama dengan latar) agar tidak ada kilatan baru. */
  var SHOW_DELAY = 450, armed = false, showT = 0;
  function doShow(quiet) {
    shown = true; shownAt = Date.now(); ov.classList.toggle('quiet', !!quiet);
    ov.classList.remove('hide'); resetP(); creep();
  }
  /* kind: 'quiet' = senyap (layar hitam polos; dipakai saat meninggalkan splash); 'now' = tirai awan + bar SEGERA (halaman berat: gameplay);
     selain itu = tirai awan TERTUNDA (SHOW_DELAY): pindah halaman yang cepat tidak menampilkan apa pun, yang lambat menampilkan "Memuat". */
  function showOv(kind) {
    clearTimeout(hideT);
    if (shown && !ov.classList.contains('hide')) return;   // pagehide + beforeunload bisa datang berurutan
    if (kind === 'quiet') { armed = false; clearTimeout(showT); doShow(true); return; }
    if (kind === 'now') { armed = false; clearTimeout(showT); doShow(false); return; }
    if (armed) return;
    armed = true; clearTimeout(showT);
    showT = setTimeout(function () { armed = false; doShow(false); }, SHOW_DELAY);
  }
  function hideOv() {
    if (armed) { armed = false; clearTimeout(showT); return; }   // halaman siap sebelum tirai sempat muncul
    if (!shown) return;
    shown = false; clearTimeout(hideT);
    setP(100);   // bar penuh dulu, baru awan menyibak
    var wait = ov.classList.contains('quiet') ? 60 : Math.max(60, MIN_SHOW - (Date.now() - shownAt));   // senyap: langsung buka; tirai awan: tampil minimal MIN_SHOW agar tidak berkedip
    hideT = setTimeout(function () { ov.classList.add('hide'); }, wait);
  }
  ov.classList.add('quiet');   // pembukaan pertama: splash langsung tampil di bawahnya, jangan ada dadu/teks lebih dulu

  /* Tunggu isi halaman "tenang": tidak ada elemen baru ditambahkan selama quiet ms (maks max ms). Mencegah latar/HUD/kartu muncul bergantian setelah tirai membuka. */
  function settle(w, d, quiet, max) {
    return new Promise(function (res) {
      var t = 0, cap = 0, mo = null, done = false;
      function fin() { if (done) return; done = true; clearTimeout(t); clearTimeout(cap); try { if (mo) mo.disconnect(); } catch (e) {} res(); }
      function arm() { clearTimeout(t); t = setTimeout(fin, quiet); }
      cap = setTimeout(fin, max);
      try { mo = new (w.MutationObserver || MutationObserver)(arm); mo.observe(d.documentElement, { childList: true, subtree: true }); } catch (e) {}
      arm();
    });
  }
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
    /* latar CSS (background-image) elemen utama harus sudah ter-decode, bukan hanya <img> */
    var bgs = [];
    try {
      var els = [d.documentElement, d.body].concat(Array.prototype.slice.call(d.body ? d.body.children : [], 0, 12)), seen = {};
      els.forEach(function (el) {
        if (!el) return;
        var m = /url\((['"]?)(.*?)\1\)/.exec(w.getComputedStyle(el).backgroundImage || '');
        if (m && m[2] && !seen[m[2]] && !/^data:/.test(m[2])) {
          seen[m[2]] = 1;
          bgs.push(new Promise(function (r) { var im = new Image(); im.onload = im.onerror = function () { (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(r); }; im.src = m[2]; setTimeout(r, 1500); }));
        }
      });
    } catch (e) {}
    /* gameplay: tunggu adegan 3D menggambar frame pertamanya (diset gameplay/js/main.js: class gp-ready), maks 6 dtk */
    var gp = Promise.resolve();
    if (pageName(w) === 'gameplay.html') gp = new Promise(function (r) {
      var t0 = Date.now();
      (function poll() { var ok = false; try { ok = d.documentElement.classList.contains('gp-ready'); } catch (e) {} if (ok || Date.now() - t0 > 6000) r(); else setTimeout(poll, 50); })();
    });
    var all = [fonts, bg, shownBody, gp].concat(bgs).concat(waits), n = all.length;
    all.forEach(function (pr) { pr.then(function () { stage(Math.min(96, cap + 24 / n)); setP(Math.min(94, pct + 24 / n)); }); });
    Promise.all(all).then(function () { return settle(w, d, 120, pageName(w) === 'gameplay.html' ? 1500 : 700); }).then(function () {
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
  var TRACKS = ['assets/audio/music/sunset-plains.mp3', 'assets/audio/music/community.mp3', 'assets/audio/music/first-light-particles.mp3', 'assets/audio/music/rainy.mp3'], ti = 0, bgm = null, fadeRaf = 0;
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
      if (!clickPool.length) for (var i = 0; i < 4; i++) { var a = new Audio('assets/audio/sfx/ui/button-click.mp3'); a.preload = 'auto'; clickPool.push(a); }
      var el = clickPool[clickI++ % clickPool.length]; el.currentTime = 0; el.volume = sfxVol(); /* file klik sudah diseragamkan (tools/normalize-sfx.py) */
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
    var leave = function () {
      var heavy = false;
      try { heavy = name === 'gameplay.html' || sessionStorage.getItem('ut:nav-heavy') === '1'; sessionStorage.removeItem('ut:nav-heavy'); } catch (e) {}
      showOv(SELF_LOADING.test(name) ? 'quiet' : heavy ? 'now' : 'delay');
    };
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
