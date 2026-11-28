/* update-service.js — pembaruan game dengan KONFIRMASI pemain (tanpa unduhan tiba-tiba).
   Alur (di SPLASH, sebelum aset apa pun diunduh):
     1. check()    : bandingkan VERSION sw.js di server dengan versi yang sedang berjalan; hitung media yang berubah
                     (assets/media-hash.json baru vs indeks tersimpan di cache 'ut-media') + ukurannya (assets/preload-manifest.json).
     2. modal "Unduh Data" HANYA konfirmasi (ukuran + Unduh / X = tunda, ditanya lagi di sesi berikutnya). Modal tidak menampilkan progres.
     3. Unduh -> modal menutup; PROGRES tampil di bar loading splash (hooks.progress / hooks.status dari splash.js).
        download() mengunduh media yang berubah ke cache 'ut-media', menulis indeks baru, lalu memasang SW baru (menunggu).
     4. selesai -> restart() otomatis: SW baru diaktifkan (SKIP_WAITING) lalu halaman pindah ke URL root (seperti Ctrl+Shift+R).
   Lobby (cadangan bila splash terlewat): modal konfirmasi yang sama; Unduh -> tanda sesi 'ut:upd:go' + pindah ke root,
   lalu splash langsung mengunduh tanpa bertanya lagi.
   Karena indeks sudah diperbarui oleh download(), syncMedia() di sw.js saat aktivasi tidak membuang unduhan ini.
   Skrip klasik; di browser jadi window.UT.Update, di Node (module.exports) untuk tes. Fungsi murni: plan(), formatBytes(). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Update = api.create({}); ['plan', 'formatBytes', 'create'].forEach(function (k) { root.UT.Update[k] = api[k]; }); }
})(typeof window !== 'undefined' ? window : null, function (G) {
  'use strict';

  var MEDIA_CACHE = 'ut-media', MEDIA_INDEX = '__media-index__';
  var HASH_URL = 'assets/media-hash.json', SIZE_URL = 'assets/preload-manifest.json', SW_URL = 'sw.js';
  var FLAG_DONE = 'ut:upd:done', FLAG_DISMISS = 'ut:upd:dismiss', FLAG_GO = 'ut:upd:go';

  /* Media yang harus diunduh: hash berubah atau baru. Tanpa indeks lama (instalasi lama/pertama) -> kosong:
     sw.js yang bermigrasi sendiri saat aktivasi, tidak ada yang perlu dikonfirmasi pemain. */
  function plan(oldIdx, fresh, sizes) {
    var out = { files: [], removed: [], bytes: 0 };
    if (!oldIdx || !fresh) return out;
    Object.keys(fresh).forEach(function (p) {
      if (oldIdx[p] !== fresh[p]) { out.files.push(p); out.bytes += (sizes && +sizes[p]) || 0; }
    });
    Object.keys(oldIdx).forEach(function (p) { if (!(p in fresh)) out.removed.push(p); });
    return out;
  }
  function formatBytes(b) {
    var mb = (+b || 0) / 1048576;
    if (mb < 0.1) return '<0.1MB';
    return (mb < 10 ? mb.toFixed(1) : mb < 100 ? mb.toFixed(1) : Math.round(mb)) + 'MB';
  }

  function create(deps) {
    var g = deps.G || G || {}, nav = deps.navigator || g.navigator, doc = deps.document || g.document;
    var doFetch = deps.fetch || (g.fetch && g.fetch.bind(g)), cachesApi = deps.caches || g.caches;
    var store = function () { try { return deps.storage || g.localStorage; } catch (e) { return null; } };
    var sess = function () { try { return deps.session || g.sessionStorage; } catch (e) { return null; } };
    var job = null, ui = null, listeners = [], pending = null;

    function supported() { return !!(nav && nav.serviceWorker && cachesApi && doFetch); }
    /* header X-UT-Fresh: sw.js melewatkan permintaan ini ke jaringan (bukan dari cache) */
    function fresh(url, init) { init = init || {}; init.cache = 'no-store'; init.headers = { 'X-UT-Fresh': '1' }; return doFetch(url, init); }
    function readFlag(k) { try { return store().getItem(k); } catch (e) { return null; } }
    function writeFlag(k, v) { try { v == null ? store().removeItem(k) : store().setItem(k, v); } catch (e) {} }
    function parseVersion(text) { var m = /\bVERSION\s*=\s*['"]([^'"]+)['"]/.exec(String(text || '')); return m ? m[1] : null; }

    async function runningVersion() {
      try { var v = g.UT && g.UT.Version && await g.UT.Version.get(true); if (v && v.raw) return v.raw; } catch (e) {}
      return null;
    }
    async function storedIndex(scope) {
      try {
        var mc = await cachesApi.open(MEDIA_CACHE);
        var r = await mc.match(new g.Request(new g.URL(MEDIA_INDEX, scope).href));
        return r ? await r.json() : null;
      } catch (e) { return null; }
    }

    /* -> null (tidak didukung / gagal cek) | { available:false } | { available:true, version, label, files, removed, bytes, ready } */
    async function check() {
      if (!supported()) return null;
      try {
        var reg = await nav.serviceWorker.getRegistration();
        if (!reg || !nav.serviceWorker.controller) return null;
        var both = await Promise.all([fresh(SW_URL), runningVersion()]), sw = both[0]; if (!sw.ok) return null;
        var next = parseVersion(await sw.text()), cur = both[1];
        if (!next || !cur || next === cur) { writeFlag(FLAG_DONE, null); return { available: false }; }
        var two = await Promise.all([fresh(HASH_URL), fresh(SIZE_URL)]), hr = two[0], sr = two[1];
        var freshIdx = hr.ok ? await hr.json() : null, sizes = sr.ok ? await sr.json() : {};
        var p = plan(await storedIndex(reg.scope), freshIdx, sizes);
        return { available: true, version: next, label: g.UT && g.UT.Version ? g.UT.Version.label(next) : next,
          files: p.files, removed: p.removed, bytes: p.bytes, fresh: freshIdx,
          ready: readFlag(FLAG_DONE) === next && !!reg.waiting };
      } catch (e) { return null; }
    }

    function emit(ev) { listeners.slice().forEach(function (f) { try { f(ev); } catch (e) {} }); }
    function onEvent(f) { listeners.push(f); return function () { var i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; }

    async function fetchToCache(mc, path, scope, tick) {
      var url = new g.URL(path, scope).href, last = 0;
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          var res = await fresh(url, { cache: 'reload' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var parts = [], got = 0;
          if (res.body && res.body.getReader) {
            var rd = res.body.getReader();
            for (;;) { var s = await rd.read(); if (s.done) break; parts.push(s.value); got += s.value.byteLength; tick(got - last); last = got; }
          } else { var b = await res.arrayBuffer(); parts.push(new Uint8Array(b)); tick(b.byteLength); last = b.byteLength; }
          await mc.put(new g.Request(url), new g.Response(new g.Blob(parts), { status: 200, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' } }));
          return last;
        } catch (e) { tick(-last); last = 0; if (attempt) throw e; }
      }
    }
    async function waitInstalled(reg) {
      await reg.update();
      var w = reg.waiting || reg.installing; if (!w) throw new Error('worker-baru-tidak-ada');
      if (w.state === 'installed') return;
      await new Promise(function (res, rej) {
        var t = setTimeout(function () { rej(new Error('install-timeout')); }, 30000);
        w.addEventListener('statechange', function () {
          if (w.state === 'installed') { clearTimeout(t); res(); } else if (w.state === 'redundant') { clearTimeout(t); rej(new Error('install-gagal')); }
        });
      });
    }

    /* info = hasil check(). Satu unduhan berjalan sekaligus; panggilan kedua memakai job yang sama. */
    function download(info) {
      if (job) return job;
      job = (async function () {
        var total = info.bytes, loaded = 0, reg = await nav.serviceWorker.getRegistration();
        if (!reg) throw new Error('tanpa-registrasi');
        var mc = await cachesApi.open(MEDIA_CACHE), queue = info.files.slice(), failed = null;
        function tick(d) { loaded = Math.max(0, loaded + d); emit({ type: 'progress', loaded: loaded, total: total }); }
        emit({ type: 'progress', loaded: 0, total: total });
        async function worker() { while (queue.length && !failed) { try { await fetchToCache(mc, queue.shift(), reg.scope, tick); } catch (e) { failed = e; } } }
        await Promise.all([worker(), worker(), worker(), worker()]);
        if (failed) throw failed;
        for (var i = 0; i < info.removed.length; i++) await mc.delete(new g.Request(new g.URL(info.removed[i], reg.scope).href));
        if (info.fresh) await mc.put(new g.Request(new g.URL(MEDIA_INDEX, reg.scope).href), new g.Response(JSON.stringify(info.fresh), { headers: { 'Content-Type': 'application/json' } }));
        emit({ type: 'installing' });
        await waitInstalled(reg);
        writeFlag(FLAG_DONE, info.version);
        emit({ type: 'done' });
      })();
      job.then(function () { job = null; }, function () { job = null; });
      return job;
    }

    /* Aktifkan SW baru lalu pindah ke URL ROOT situs (index -> splash), bukan reload halaman terakhir (mis. lobby):
       cache kode versi lama sudah dibuang SW baru saat aktivasi, jadi hasilnya seperti Ctrl+Shift+R. Cadangan 3 dtk bila controllerchange tidak datang. */
    function rootUrl(reg) {
      try { return new g.URL('./', (reg && reg.scope) || (g.location && g.location.href)).href; } catch (e) { return null; }
    }
    /* Navigasi HARUS di jendela paling atas (pembungkus play.html). Bila dipanggil dari iframe (splash), loc.replace(root) hanya memindahkan
       iframe -> pembungkus kedua bersarang di dalam pembungkus pertama dan keduanya memutar musik (bertabrakan). */
    function navWin() {
      try { var t = g.top; if (t && t !== g && t.location && g.location && t.location.origin === g.location.origin) return t; } catch (e) {}
      return g;
    }
    function goRoot(reg) {
      try { var ss = sess(); if (ss) { ss.removeItem('ut:booted'); ss.removeItem('ut:fadein'); } } catch (e) {}
      var url = rootUrl(reg), loc = navWin().location;
      try { if (loc && url && typeof loc.replace === 'function') return loc.replace(url); } catch (e) {}
      try { loc && loc.reload(); } catch (e) {}
    }
    async function restart() {
      var reg = await nav.serviceWorker.getRegistration();
      writeFlag(FLAG_DONE, null);
      var go = function () { goRoot(reg); };
      if (!reg || !reg.waiting) return go();
      nav.serviceWorker.addEventListener('controllerchange', go, { once: true });
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(go, 3000);
    }

    function dismissed(version) { try { return sess().getItem(FLAG_DISMISS) === version; } catch (e) { return false; } }
    function dismiss(version) { try { sess().setItem(FLAG_DISMISS, version); } catch (e) {} }

    function closeUi() { if (ui) { var u = ui; ui = null; try { u.close(); } catch (e) {} } }

    /* Modal KONFIRMASI saja -> 'download' (tombol Unduh / Coba lagi) atau 'later' (X / Esc; ditunda untuk sesi ini). */
    function confirmDialog(info, failedMsg) {
      return new Promise(function (resolve) {
        var GD = g.UT && g.UT.GameDialog; if (!GD) return resolve('later');
        closeUi();
        var picked = false, d = ui = GD.open({
          title: 'Unduh Data',
          message: failedMsg || ('Unduh data tambahan untuk pembaruan ' + info.label + '?'),
          sub: failedMsg ? '' : 'Disarankan memakai jaringan Wi-Fi',
          badge: formatBytes(info.bytes), closable: true,
          buttons: [{ label: failedMsg ? 'Coba lagi' : 'Unduh', tone: 'blue', onClick: function () { picked = true; } }],
          onClose: function () { if (ui === d) ui = null; if (picked) return resolve('download'); dismiss(info.version); resolve('later'); }
        });
      });
    }

    function setGo(version) { try { sess().setItem(FLAG_GO, version); } catch (e) {} }
    function takeGo(version) { try { var ok = sess().getItem(FLAG_GO) === version; sess().removeItem(FLAG_GO); return ok; } catch (e) { return false; } }

    /* Lobby (cadangan): konfirmasi lalu pindah ke splash yang mengunduh. Tidak melakukan apa pun bila tidak ada pembaruan / sudah ditunda. */
    async function promptOnLobby() {
      var GD = g.UT && g.UT.GameDialog; if (!GD) return null;
      var info = await check(); if (!info || !info.available) return null;
      if (dismissed(info.version)) return info;
      await GD.preload();
      var c = info.ready ? 'download' : await confirmDialog(info);
      if (c === 'download') { setGo(info.version); goRoot(await nav.serviceWorker.getRegistration()); }
      return info;
    }

    /* Splash: mulai cek ke server segera; hasilnya dipakai ulang oleh promptOnSplash(). */
    function precheck() { if (!pending) pending = check().catch(function () { return null; }); return pending; }
    /* Dipanggil splash SEBELUM bar memuat aset. hooks = { progress(ev{loaded,total}), status(teks) } -> progres unduhan tampil di bar splash.
       Resolve bila tidak ada pembaruan / cek gagal / ditunda (X). Unduh -> restart otomatis ke root, promise tidak pernah resolve (halaman berpindah). */
    async function promptOnSplash(maxWaitMs, hooks) {
      hooks = hooks || {};
      var GD = g.UT && g.UT.GameDialog; if (!GD) return null;
      var info = await Promise.race([precheck(), new Promise(function (r) { setTimeout(function () { r(null); }, maxWaitMs || 6000); })]);
      if (!info || !info.available) return null;
      var go = takeGo(info.version);
      if (!go && !info.ready) {
        if (!job && dismissed(info.version)) return info;
        try { await GD.preload(); } catch (e) {}
      }
      var failedMsg = null, st = function (t) { if (hooks.status) hooks.status(t); };
      for (;;) {
        if (!info.ready) {
          if (!go) { var c = await confirmDialog(info, failedMsg); if (c !== 'download') return info; }
          go = false;
          var off = onEvent(function (ev) {
            if (ev.type === 'progress' && hooks.progress) hooks.progress(ev);
            else if (ev.type === 'installing') st('Menyiapkan pembaruan…');
          });
          st('Mengunduh pembaruan…');
          try { await download(info); } catch (e) { failedMsg = 'Unduhan gagal. Periksa koneksi lalu coba lagi.'; st('Unduhan gagal'); continue; } finally { off(); }
        }
        st('Memulai ulang…');
        await restart();
        return new Promise(function () {});
      }
    }

    return { supported: supported, check: check, precheck: precheck, promptOnSplash: promptOnSplash, download: download, restart: restart, promptOnLobby: promptOnLobby, closeUi: closeUi, onEvent: onEvent, parseVersion: parseVersion };
  }

  return { create: create, plan: plan, formatBytes: formatBytes };
});
