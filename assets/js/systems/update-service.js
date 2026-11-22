/* update-service.js — pembaruan game dengan KONFIRMASI pemain (tanpa unduhan tiba-tiba).
   Alur (hanya dipanggil dari Lobby, lihat data/lobby/js/lobby.js):
     1. check()    : bandingkan VERSION sw.js di server dengan versi yang sedang berjalan; hitung media yang berubah
                     (assets/media-hash.json baru vs indeks tersimpan di cache 'ut-media') + ukurannya (assets/preload-manifest.json).
     2. modal "Unduh Data" menampilkan ukuran -> pemain menekan Unduh (X = tunda, ditanya lagi saat kunjungan Lobby berikutnya).
     3. download() : unduh media yang berubah ke cache 'ut-media' (progres), tulis indeks baru, lalu pasang SW baru (menunggu).
     4. modal berubah jadi "Mulai ulang" -> restart(): SW baru diaktifkan (pesan SKIP_WAITING) lalu halaman dimuat ulang.
   Karena indeks sudah diperbarui oleh download(), syncMedia() di sw.js saat aktivasi tidak membuang unduhan ini.
   Splash TIDAK mengunduh pembaruan; splash hanya memuat aset pertama kali (preloader).
   Skrip klasik; di browser jadi window.UT.Update, di Node (module.exports) untuk tes. Fungsi murni: plan(), formatBytes(). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Update = api.create({}); ['plan', 'formatBytes', 'create'].forEach(function (k) { root.UT.Update[k] = api[k]; }); }
})(typeof window !== 'undefined' ? window : null, function (G) {
  'use strict';

  var MEDIA_CACHE = 'ut-media', MEDIA_INDEX = '__media-index__';
  var HASH_URL = 'assets/media-hash.json', SIZE_URL = 'assets/preload-manifest.json', SW_URL = 'sw.js';
  var FLAG_DONE = 'ut:upd:done', FLAG_DISMISS = 'ut:upd:dismiss';

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
    var job = null, ui = null, listeners = [];

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
        var sw = await fresh(SW_URL); if (!sw.ok) return null;
        var next = parseVersion(await sw.text()), cur = await runningVersion();
        if (!next || !cur || next === cur) { writeFlag(FLAG_DONE, null); return { available: false }; }
        var hr = await fresh(HASH_URL), sr = await fresh(SIZE_URL);
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

    /* Aktifkan SW baru lalu muat ulang. Cadangan 3 dtk bila controllerchange tidak datang. */
    async function restart() {
      var reg = await nav.serviceWorker.getRegistration();
      writeFlag(FLAG_DONE, null);
      var reload = function () { try { g.location.reload(); } catch (e) {} };
      if (!reg || !reg.waiting) return reload();
      nav.serviceWorker.addEventListener('controllerchange', reload, { once: true });
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(reload, 3000);
    }

    function dismissed(version) { try { return sess().getItem(FLAG_DISMISS) === version; } catch (e) { return false; } }
    function dismiss(version) { try { sess().setItem(FLAG_DISMISS, version); } catch (e) {} }

    function closeUi() { if (ui) { var u = ui; ui = null; try { u.close(); } catch (e) {} } }

    function showModal(info) {
      var GD = g.UT && g.UT.GameDialog; if (!GD) return;
      closeUi();
      var off = null;
      var d = ui = GD.open({
        title: 'Unduh Data', message: 'Unduh data tambahan untuk pembaruan ' + info.label + '?', sub: 'Disarankan memakai jaringan Wi-Fi',
        badge: formatBytes(info.bytes), closable: true,
        onClose: function () { if (off) off(); if (ui === d) ui = null; if (!job) dismiss(info.version); }
      });
      function ask() {
        d.set({ title: 'Unduh Data', message: 'Unduh data tambahan untuk pembaruan ' + info.label + '?', sub: 'Disarankan memakai jaringan Wi-Fi',
          badge: formatBytes(info.bytes), progress: null, closable: true,
          buttons: [{ label: 'Unduh', tone: 'blue', keepOpen: true, onClick: start }] });
      }
      function ready() {
        d.set({ title: 'Pembaruan Siap', message: 'Unduhan selesai. Mulai ulang untuk memakai versi ' + info.label + '.', sub: '', badge: '', progress: null, closable: true,
          buttons: [{ label: 'Mulai ulang', tone: 'green', keepOpen: true, onClick: function () { d.set({ buttons: [{ label: 'Memulai…', tone: 'green', disabled: true }], closable: false }); restart(); } }] });
      }
      function failed() {
        d.set({ title: 'Unduh Data', message: 'Unduhan gagal. Periksa koneksi lalu coba lagi.', sub: '', badge: '', progress: null, closable: true,
          buttons: [{ label: 'Coba lagi', tone: 'blue', keepOpen: true, onClick: start }] });
      }
      function progress(ev) {
        var pct = ev.total > 0 ? ev.loaded / ev.total : 0;
        d.set({ title: 'Mengunduh…', message: 'Jangan tutup game sampai selesai.', sub: formatBytes(ev.loaded) + ' / ' + formatBytes(ev.total), badge: '', progress: pct, closable: false, buttons: [{ label: Math.round(pct * 100) + '%', tone: 'blue', disabled: true }] });
      }
      function attach() {
        off = onEvent(function (ev) {
          if (ev.type === 'progress') progress(ev);
          else if (ev.type === 'installing') d.set({ message: 'Menyiapkan pembaruan…', sub: '', progress: 1 });
          else if (ev.type === 'done') ready();
        });
      }
      function start() {
        progress({ loaded: 0, total: info.bytes }); attach();
        download(info).catch(function () { if (off) { off(); off = null; } if (d.isOpen()) failed(); });
      }
      if (job) { progress({ loaded: 0, total: info.bytes }); attach(); }
      else if (info.ready) ready();
      else ask();
    }

    /* Dipanggil Lobby sekali per kunjungan. Tidak melakukan apa pun bila tidak ada pembaruan / sudah ditunda di sesi ini. */
    async function promptOnLobby() {
      var GD = g.UT && g.UT.GameDialog; if (!GD) return null;
      var info = await check(); if (!info || !info.available) return null;
      if (!job && dismissed(info.version)) return info;
      await GD.preload();
      showModal(info); return info;
    }

    return { supported: supported, check: check, download: download, restart: restart, promptOnLobby: promptOnLobby, closeUi: closeUi, onEvent: onEvent, parseVersion: parseVersion };
  }

  return { create: create, plan: plan, formatBytes: formatBytes };
});
