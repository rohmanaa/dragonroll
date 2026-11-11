/* assets/js/live-sync.js — penyegar data server supaya halaman selalu mutakhir TANPA refresh halaman.
   Tanpa Realtime & tanpa migrasi: hanya memanggil ulang RPC yang sudah ada (wallet_get, profil/XP, tampilan, ...).
   Hasil tiap tugas masuk lewat PlayerData seperti biasa, jadi event currencyChanged/skinChanged/... otomatis memperbarui UI.
   API:
     UT.LiveSync.add(nama, fn, {minGap})  -> daftar tugas; fn() boleh mengembalikan Promise; {ok:false} / throw = gagal
     UT.LiveSync.start({interval,maxInterval,minGap,immediate}) / stop()
     UT.LiveSync.now(alasan)              -> jalankan sekarang (tetap menghormati minGap, tab tersembunyi, offline)
   Pemicu: timer (±20 dtk, hanya saat tab terlihat), tab kembali aktif (visibilitychange/focus/pageshow), koneksi pulih (online).
   Gagal berturut-turut -> jeda dilipatgandakan sampai maxInterval; sukses -> kembali normal. Tidak pernah dua putaran bersamaan. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.LiveSync) return;
  var doc = win.document, nav = win.navigator;
  var st = win.setTimeout ? win.setTimeout.bind(win) : setTimeout, ct = win.clearTimeout ? win.clearTimeout.bind(win) : clearTimeout;
  var cfg = { interval: 20000, maxInterval: 120000, minGap: 3000 };
  var tasks = [], timer = null, running = false, inflight = false, fails = 0, lastRun = -1e15, bound = false, rounds = 0;

  function visible() { return !(doc && doc.hidden === true); }
  function online() { return !(nav && nav.onLine === false); }
  function delay() {
    var base = Math.min(cfg.maxInterval, cfg.interval * Math.pow(2, fails));
    return Math.round(base + Math.random() * Math.min(2000, base / 10));
  }
  function schedule() {
    if (timer) { ct(timer); timer = null; }
    if (!running) return;
    timer = st(function () { timer = null; run('timer'); }, delay());
  }
  function okOf(r) { return !(r && r.ok === false && r.reason !== 'mode-lokal'); }

  function run(reason) {
    if (!running) return Promise.resolve({ ok: false, skipped: 'stopped' });
    if (!visible() || !online()) { schedule(); return Promise.resolve({ ok: false, skipped: 'idle' }); }
    if (inflight) return Promise.resolve({ ok: false, skipped: 'busy' });
    var t = Date.now();
    if (t - lastRun < cfg.minGap) { schedule(); return Promise.resolve({ ok: false, skipped: 'gap' }); }
    inflight = true; lastRun = t; rounds++;
    var jobs = tasks.map(function (k) {
      if (k.minGap && t - k.last < k.minGap) return Promise.resolve(true);
      k.last = t;
      return new Promise(function (res) { res(k.fn(reason)); }).then(okOf, function () { return false; });
    });
    return Promise.all(jobs).then(function (oks) {
      var ok = oks.every(Boolean);
      fails = ok ? 0 : fails + 1;
      inflight = false; schedule();
      return { ok: ok, reason: reason };
    });
  }

  function onVis() { if (visible()) run('visible'); }
  function bind() {
    if (bound || !win.addEventListener) return; bound = true;
    if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVis);
    win.addEventListener('focus', function () { run('focus'); });
    win.addEventListener('online', function () { run('online'); });
    win.addEventListener('pageshow', function (e) { if (e && e.persisted) run('pageshow'); });
  }

  UT.LiveSync = {
    add: function (name, fn, opts) {
      if (typeof fn !== 'function') return false;
      tasks = tasks.filter(function (k) { return k.name !== name; });
      tasks.push({ name: name, fn: fn, minGap: (opts && opts.minGap) || 0, last: -1e15 });
      return true;
    },
    start: function (o) {
      if (o) for (var k in o) if (k in cfg && typeof o[k] === 'number') cfg[k] = o[k];
      running = true; bind(); schedule();
      if (o && o.immediate) run('start');
      return true;
    },
    stop: function () { running = false; if (timer) { ct(timer); timer = null; } },
    now: function (reason) { return run(reason || 'manual'); },
    status: function () { return { running: running, inflight: inflight, fails: fails, rounds: rounds, tasks: tasks.map(function (k) { return k.name; }) }; }
  };
})(window);
