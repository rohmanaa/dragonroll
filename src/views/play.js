/* play.js — shell SPA tanpa overlay loading antar halaman.
   Pindah halaman view (SPA) instant tanpa reload dokumen. Gameplay/tambang/splash tetap lewat iframe. */
(function () {
  var NESTED = false, ROT = '(orientation:portrait) and (pointer:coarse)';
  try { NESTED = window.top !== window && /[?&]nested=1(&|$)/.test(location.search) && window.parent.__utOuterShell === true; } catch (e) {}
  if (window.top !== window && !NESTED) { try { window.top.location.replace(location.href); return; } catch (e) { } }
  if (window.top === window) window.__utOuterShell = true;
  function nestedUrl(u) { return 'play.html?nested=1&go=' + encodeURIComponent(u); }
  function frameUrl(u) { try { if (!NESTED && window.matchMedia(ROT).matches) return nestedUrl(u); } catch (e) {} return u; }
  var f = document.getElementById('f'), go = 'splash.html';
  try {
    if (window.UT && UT.PrettyUrl && UT.PrettyUrl.shouldUsePretty()) {
      go = UT.PrettyUrl.getGoFromUrl();
    } else {
      var q = new URLSearchParams(location.search).get('go');
      if (q && /^[A-Za-z0-9_-]+\.html(\?[^#]*)?(#.*)?$/.test(q) && !/^(play|index)\.html/.test(q)) go = q;
    }
  } catch (e) {}

  /* ================= Suara & musik (dimiliki pembungkus agar tidak putus antar halaman) ================= */
  function settings() {
    try { var s = (f.contentWindow.PlayerData || window.PlayerData).settings(); return { music: s.music !== false, sound: s.sound !== false }; } catch (e) {}
    return { music: true, sound: true };
  }
  function musicVol() { try { var v = parseInt(UT.Prefs.get('musicVol', 30), 10); return (isNaN(v) ? 30 : Math.max(0, Math.min(100, v))) / 100; } catch (e) { return 0.3; } }
  function sfxVol() { try { var v = parseInt(UT.Prefs.get('sfxVol', 100), 10); return (isNaN(v) ? 100 : Math.max(0, Math.min(100, v))) / 100; } catch (e) { return 1; } }

  var TRACKS = ['assets/audio/music/sunset-plains.mp3', 'assets/audio/music/community.mp3', 'assets/audio/music/first-light-particles.mp3', 'assets/audio/music/rainy.mp3'], ti = 0, bgm = null, fadeRaf = 0;
  var wantMusic = false;
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
    if (NESTED) { try { window.parent.UTShell.syncMusic(); } catch (e) {} return; }
    var on = wantMusic && settings().music && !document.hidden;
    if (on) {
      if (!ensureBgm()) return;
      if (bgm.paused) {
        var p; try { p = bgm.play(); } catch (e) {}
        if (p && p.catch) p.catch(function () { needGesture = true; });
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

  var clickPool = [], clickI = 0;
  function playClick() {
    if (NESTED) { try { window.parent.UTShell.click(); } catch (e) {} return; }
    if (!settings().sound) return;
    try {
      if (!clickPool.length) for (var i = 0; i < 4; i++) { var a = new Audio('assets/audio/sfx/ui/button-click.mp3'); a.preload = 'auto'; clickPool.push(a); }
      var el = clickPool[clickI++ % clickPool.length]; el.currentTime = 0; el.volume = sfxVol();
      var p = el.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function setWant(v) { if (NESTED) { try { window.parent.UTShell.want(!!v); } catch (e) {} return; } wantMusic = !!v; syncMusic(); }
  window.UTShell = { click: playClick, syncMusic: syncMusic, want: setWant, enter: function () { setWant(true); } };

  function afterTap() { setTimeout(syncMusic, 0); setTimeout(syncMusic, 120); }

  /* ================= Prefetch halaman berikutnya (saat idle) ================= */
  var NEXT = {
    'lobby.html': ['mode.html', 'shop.html', 'karakter.html', 'profile.html', 'inventory.html'],
    'mode.html': ['gameplay.html', 'room.html', 'lobby.html'],
    'room.html': ['gameplay.html', 'mode.html'],
    'shop.html': ['lobby.html'], 'inventory.html': ['lobby.html'], 'pet.html': ['lobby.html'], 'frame.html': ['lobby.html'], 'efek.html': ['lobby.html'], 'dadu.html': ['lobby.html'], 'hadiah-misi.html': ['lobby.html'], 'mail.html': ['lobby.html'], 'settings.html': ['lobby.html'], 'karakter.html': ['lobby.html'],
    'profile.html': ['lobby.html', 'tambang.html'], 'leaderboard.html': ['lobby.html'], 'tambang.html': ['lobby.html', 'shop.html'], 'friendship.html': ['lobby.html']
  }, warmed = {};
  function warm(page) {
    if (warmed[page]) return; warmed[page] = 1;
    fetch(page).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      var re = /<(?:script[^>]+src|link[^>]+href)=["']([^"']+\.(?:js|css))["']/gi, m, n = 0;
      while ((m = re.exec(html)) && n++ < 120) { if (!/^(https?:)?\/\//i.test(m[1])) fetch(m[1]).catch(function () {}); }
    }).catch(function () {});
  }
  function prefetchNext(name) {
    try {
      var c = navigator.connection || {};
      if (c.saveData || /2g/.test(c.effectiveType || '')) return;
      var list = NEXT[name] || [];
      var run = function () {
        var tier = document.documentElement.getAttribute('data-graphics') || 'normal';
        var warmCount = tier === 'low' ? 0 : tier === 'normal' ? 1 : tier === 'high' ? 3 : 9;
        list.slice(0, warmCount).forEach(warm);
        try {
          var g = document.documentElement.getAttribute('data-graphics') || 'normal';
          var n = g === 'low' ? 0 : g === 'normal' ? 1 : g === 'high' ? 3 : 9;
          if (n && window.UT && UT.Spa && UT.Spa.preload) {
            var q = list.slice(0, n), i = 0;
            (function nxt() { if (i >= q.length) return; UT.Spa.preload(q[i++]).then(function () { setTimeout(nxt, 400); }); })();
          }
        } catch (e) {}
      };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 1500);
    } catch (e) {}
  }

  /* ================= Pasang pada setiap halaman yang dimuat di iframe (gameplay, tambang, splash) ================= */
  f.addEventListener('load', function () {
    if (window.UT && UT.Spa && UT.Spa.viewActive) return;
    var w; try { w = f.contentWindow; w.document; } catch (e) { return; }
    var name = (w.location.pathname.split('/').pop() || 'index.html');
    if (name === 'gameplay.html') { setWant(false); }
    else if (name === 'splash.html') { setWant(false); }
    else if (!/^(play|index)\.html$/.test(name)) { setWant(true); }
    try { w.focus(); } catch (e) {}
    try { w.document.addEventListener('click', afterTap, true); } catch (e) {}
    prefetchNext(name);
    if (!NESTED && window.UT && UT.GraphicsAuto) UT.GraphicsAuto.afterReady();
  });

  /* ================= SPA: semua page (kecuali tambang, splash, gameplay) dirender di #view tanpa reload ================= */
  document.addEventListener('click', afterTap, true);
  if (!NESTED && window.UT && UT.GraphicsAuto) { try { UT.GraphicsAuto.boot(); } catch (e) {} }
  if (window.UT && UT.Spa) {
    UT.Spa.mount({
      frame: f, view: document.getElementById('view'), frameUrl: frameUrl,
      hooks: {
        leave: function (kind) { },
        ready: function (name) {
          setWant(true);
          prefetchNext(UT.Spa.page || name + '.html');
          if (!NESTED && UT.GraphicsAuto) UT.GraphicsAuto.afterReady();
        }
      }
    });
    if (UT.Spa.start(go)) {
      /* preload semua halaman view di latar (idle) agar pindah halaman instant tanpa jeda fetch */
      var all = UT.Spa.viewList ? UT.Spa.viewList() : [];
      var todo = all.map(function (n) { return n + '.html'; }).filter(function (p) {
        return p !== go && p !== 'tambang.html' && p !== 'splash.html' && p !== 'gameplay.html';
      });
      var i = 0;
      (function nxt() {
        if (i >= todo.length) return;
        UT.Spa.preload(todo[i++]).then(function () { setTimeout(nxt, 100); }, function () { nxt(); });
      })();
      return;
    }
  }
  f.src = frameUrl(go);
})();
