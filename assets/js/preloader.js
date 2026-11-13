/* Preloader untuk splash.html (satu-satunya layar loading dengan bar; perpindahan halaman memakai layar dadu di play.html).
   Progres NYATA dihitung dari BYTE yang benar-benar terunduh (stream fetch), bukan dari jumlah file atau timer:
     UT_Preload.run(urls, onProgress, minMs, sizes) -> Promise     (sizes = {url: perkiraan byte}, opsional)
     UT_Preload.runAuto(extraUrls, onProgress)       -> Promise     (memuat assets/preload-manifest.json + extraUrls)
   Kegagalan/aset macet tidak memblokir: timeout 20 dtk dihitung dari byte terakhir yang masuk (file besar di koneksi lambat tidak terpotong), gagal jaringan dicoba ulang 1x.
   Urutan: URL tambahan (halaman tujuan, library) dulu, lalu aset kecil -> besar (musik terakhir). onProgress(persen, jenis, info) — info = {fresh, dlGot, dlTotal} (byte media yang BELUM tersimpan di perangkat; fresh=true bila perlu unduh sungguhan). Media yang sudah ada di cache service worker dilewati (tidak diunduh ulang). jenis = 'kode'|'gambar'|'audio'|'data' dari file yang terakhir mulai diunduh. Bila semua sudah ada di cache, loading memang cepat: itu nyata.
   Daftar aset dibuat oleh tools/gen-preload-manifest.py (jalankan ulang setelah menambah musik/gambar/sfx). */
window.UT_Preload = (function () {
  var CONC = 6, DEF_SIZE = 30000, EXT_SIZE = 80000, TIMEOUT = 20000, RETRY = 1;
  function kindOf(u) { var e = (u.split('?')[0].match(/\.([a-z0-9]+)$/i) || [])[1]; e = (e || '').toLowerCase(); if (/^(mp3|ogg|wav|webm|m4a)$/.test(e)) return 'audio'; if (/^(png|webp|jpe?g|gif|svg)$/.test(e)) return 'gambar'; if (/^(js|css|html|woff2?)$/.test(e)) return 'kode'; return 'data'; }
  var MEDIA = /\.(png|webp|jpe?g|gif|svg|ico|woff2?|mp3|ogg|wav|webm|m4a)$/i;
  function isMedia(u) { return !isExt(u) && MEDIA.test(u.split('?')[0]); }
  /* tunggu service worker aktif & mengendalikan halaman, supaya semua unduhan masuk cache perangkat (maks 3 dtk; tanpa SW tetap jalan) */
  function swReady() {
    if (!('serviceWorker' in navigator) || !window.caches) return Promise.resolve();
    var tm = new Promise(function (r) { setTimeout(r, 3000); });
    var ready = navigator.serviceWorker.ready.then(function () {
      if (navigator.serviceWorker.controller) return;
      return new Promise(function (r) { navigator.serviceWorker.addEventListener('controllerchange', function () { r(); }, { once: true }); setTimeout(r, 1500); });
    }).catch(function () {});
    return Promise.race([ready, tm]);
  }
  function cachedFlags(list) {
    if (!window.caches) return Promise.resolve(list.map(function () { return false; }));
    return Promise.all(list.map(function (u) {
      return isMedia(u) ? caches.match(u).then(function (h) { return !!h; }, function () { return false; }) : false;
    }));
  }
  function isExt(u) { return /^https?:\/\//i.test(u) && u.indexOf(location.origin) !== 0; }

  function run(urls, onProgress, minMs, sizes) {
    sizes = sizes || {}; minMs = minMs || 0;
    var list = [], seen = {};
    urls.forEach(function (u) { if (!seen[u]) { seen[u] = 1; list.push(u); } });
    var N = list.length, exp = [], got = [], cached = [], doneN = 0, next = 0, t0 = performance.now(), shown = 0;
    list.forEach(function (u, i) { exp[i] = sizes[u] || (isExt(u) ? EXT_SIZE : DEF_SIZE); got[i] = 0; });

    var curKind = 'kode';
    function load(i) {
      return new Promise(function (res) {
        var fin = false, tm, u = list[i];
        if (cached[i]) { got[i] = exp[i]; doneN++; res(); return; } /* sudah ada di perangkat */
        curKind = kindOf(u);
        function done() { if (fin) return; fin = true; clearTimeout(tm); got[i] = exp[i]; doneN++; res(); }
        function arm() { clearTimeout(tm); tm = setTimeout(done, TIMEOUT); } /* timeout = tanpa byte baru selama TIMEOUT */
        function attempt(n) {
          arm();
          try {
            fetch(u, isExt(u) ? { mode: 'no-cors' } : {}).then(function (r) {
              if (!isExt(u) && r.status >= 500 && n < RETRY) { got[i] = 0; return new Promise(function (ok) { setTimeout(ok, 400); }).then(function () { return attempt(n + 1); }); }
              if (isExt(u) || !r.body || !r.body.getReader) return r.arrayBuffer();
              var cl = parseInt(r.headers.get('content-length'), 10);
              if (cl > 0) exp[i] = cl; /* ukuran asli dari server menggantikan perkiraan */
              var rd = r.body.getReader();
              return (function pump() {
                return rd.read().then(function (c) {
                  if (c.done) return;
                  arm();
                  got[i] = Math.min(exp[i], got[i] + c.value.length);
                  return pump();
                });
              })();
            }, function () {
              if (n < RETRY) { got[i] = 0; return new Promise(function (ok) { setTimeout(ok, 400); }).then(function () { return attempt(n + 1); }); }
            }).then(done, done);
          } catch (e) { done(); }
        }
        attempt(0);
      });
    }
    function worker() {
      if (next >= N) return Promise.resolve();
      var i = next++;
      return load(i).then(worker);
    }
    return swReady().then(function () { return cachedFlags(list); }).then(function (flags) { cached = flags; return new Promise(function (resolve) {
      for (var w = 0; w < Math.min(CONC, N); w++) worker();
      function paint(now) {
        var a = 0, b = 0;
        for (var i = 0; i < N; i++) { a += got[i]; b += exp[i]; }
        var real = N ? (doneN >= N ? 1 : Math.min(0.99, a / b)) : 1;
        var target = minMs > 0 ? Math.min(real, (now - t0) / minMs) : real;
        shown += (target - shown) * 0.2;
        if (target - shown < 0.002) shown = target;
        var dg = 0, dt = 0;
        for (var k = 0; k < N; k++) if (isMedia(list[k]) && !cached[k]) { dg += got[k]; dt += exp[k]; }
        onProgress(Math.round(shown * 100), curKind, { fresh: dt > 200000, dlGot: dg, dlTotal: dt });
        if (shown >= 1 && doneN >= N) { resolve(); return; }
        requestAnimationFrame(paint);
      }
      requestAnimationFrame(paint);
    }); });
  }

  function runAuto(extra, onProgress) {
    var base = 'assets/preload-manifest.json';
    var tm = new Promise(function (r) { setTimeout(function () { r(null); }, 4000); });
    var man = fetch(base).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return Promise.race([man, tm]).then(function (m) {
      m = m || {};
      var rest = Object.keys(m).sort(function (a, b) { return (m[a] || 0) - (m[b] || 0); }); /* kecil -> besar: musik terakhir */
      var urls = (extra || []).concat(rest);
      return run(urls, onProgress, 0, m);
    });
  }
  return { run: run, runAuto: runAuto };
})();
