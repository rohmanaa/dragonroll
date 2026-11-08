/* UT.PrefsSync — sinkronisasi preferensi (UT.Prefs) ke server supaya pengaturan ikut akun lintas perangkat (Tahap 7b).
   UT.Prefs tetap menyimpan salinan lokal sebagai cache cepat (sinkron, tanpa menunggu jaringan). Server (RPC get_my_prefs /
   set_my_prefs, tabel player_prefs) adalah sumber bersama:
     - pull(): ambil dari server; nilai server MENANG untuk kunci yang ada di server, kunci yang hanya ada lokal dipertahankan
       lalu digabung dan dikirim balik. Server kosong = seed dari lokal.
     - tiap UT.Prefs.set() lokal dikirim ke server (debounce). Nilai yang datang DARI server tidak memicu kirim ulang (tidak ada loop).
   Hanya untuk akun login. Tidak pernah melempar: gagal jaringan = tetap pakai cache lokal, coba lagi di perubahan/muat berikutnya.
   Dapat dimuat di browser (window.UT.PrefsSync) maupun Node (module.exports = {create}) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.PrefsSync = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* HARUS sama dengan daftar putih c_keys di supabase/migrations/202611150001_player_prefs.sql */
  var KEYS = ['settings', 'musicVol', 'musicOn', 'sfxVol', 'autoDN', 'night', 'autoRoll', 'cam', 'roomMap', 'roomPowers', 'ambience'];

  /* deps: { Prefs, getClient:()=>Promise<client>, enabled:()=>bool, schedule?:(fn,ms)=>handle, cancel?:(h)=>void, debounceMs? } */
  function create(deps) {
    deps = deps || {};
    var P = deps.Prefs, applying = false, timer = null, started = false, off = null;
    var schedule = deps.schedule || function (fn, ms) { return setTimeout(fn, ms); };
    var cancel = deps.cancel || function (h) { clearTimeout(h); };
    var wait = deps.debounceMs == null ? 800 : deps.debounceMs;

    function enabled() { try { return !!(deps.enabled && deps.enabled()); } catch (e) { return false; } }
    async function rpc(name, args) {
      var c = await deps.getClient();
      var r = await c.rpc(name, args || {});
      if (r.error) throw r.error;
      return r.data;
    }
    function localPicked() {
      var all = P.all(), o = {};
      KEYS.forEach(function (k) { if (k in all && all[k] !== undefined && all[k] !== null) o[k] = all[k]; });
      return o;
    }

    async function push() {
      if (!enabled()) return { ok: false, reason: 'belum-login' };
      try { await rpc('set_my_prefs', { p_prefs: localPicked() }); return { ok: true }; }
      catch (e) { return { ok: false, reason: 'jaringan' }; }
    }

    async function pull() {
      if (!enabled()) return { ok: false, reason: 'belum-login' };
      var d;
      try { d = await rpc('get_my_prefs'); } catch (e) { return { ok: false, reason: 'jaringan' }; }
      var srv = (d && d.prefs && typeof d.prefs === 'object') ? d.prefs : {}, local = localPicked(), needPush = false;
      applying = true;
      try {
        KEYS.forEach(function (k) {
          if (k in srv && srv[k] !== undefined && srv[k] !== null) {
            if (JSON.stringify(local[k]) !== JSON.stringify(srv[k])) P.set(k, srv[k]);
          } else if (k in local) needPush = true;       /* hanya ada lokal -> perlu naik ke server */
        });
      } finally { applying = false; }
      if (needPush) await push();
      return { ok: true, pushed: needPush };
    }

    function onLocalChange(name) {
      if (applying || KEYS.indexOf(name) < 0 || !enabled()) return;
      if (timer) cancel(timer);
      timer = schedule(function () { timer = null; push(); }, wait);
    }

    function start() {
      if (started || !P || typeof P.on !== 'function') return;
      started = true; off = P.on(onLocalChange);
    }
    function stop() { if (timer) { cancel(timer); timer = null; } if (off) { off(); off = null; } started = false; }
    /* kirim sekarang juga bila ada perubahan tertunda (mis. saat halaman akan ditutup) */
    function flush() { if (timer) { cancel(timer); timer = null; return push(); } return Promise.resolve({ ok: true, reason: 'tidak-ada-perubahan' }); }

    return { pull: pull, push: push, start: start, stop: stop, flush: flush, KEYS: KEYS };
  }

  /* ---- otomatis di browser: akun login -> pasang pendengar + tarik dari server (maks. 1x per 60 detik per tab) ---- */
  var SELF = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  function boot() {
    var w = (typeof window !== 'undefined') ? window : null;
    if (!w || !w.UT || !w.UT.Prefs || !w.UT.Session) return;
    var inst = create({
      Prefs: w.UT.Prefs,
      enabled: function () { return w.UT.Session.loggedIn(); },
      getClient: async function () {
        if (!(w.UT.Multiplayer && w.UT.Multiplayer.getClient)) await import(new URL('multiplayer/client.js', SELF || w.location.href).href);
        return w.UT.Multiplayer.getClient();
      }
    });
    w.UT.PrefsSync.instance = inst;
    if (!w.UT.Session.loggedIn()) return;
    inst.start();
    w.addEventListener('pagehide', function () { inst.flush(); });
    var KEY = 'ut:prefs-pulled', now = Date.now(), last = 0;
    try { last = +w.sessionStorage.getItem(KEY) || 0; } catch (e) {}
    if (now - last < 60000) return;
    try { w.sessionStorage.setItem(KEY, String(now)); } catch (e) {}
    inst.pull();
  }
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
    else setTimeout(boot, 0);
  }

  return { create: create, KEYS: KEYS };
});
