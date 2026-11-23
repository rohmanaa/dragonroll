/* Hearts service — satu-satunya pintu klien ke HATI/NYAWA di SERVER (supabase/migrations/202611410001_hearts.sql).
   Tiap pemain punya 5 hati; 1 hati terpakai tiap match dimulai; terisi lagi otomatis 1 hati / 15 menit sampai penuh.
   Klien tidak pernah mengirim jumlah/waktu: server (RPC hearts_*) yang menghitung; klien hanya memproyeksikan hitung mundur
   dari next_in_secs terakhir supaya HUD bergerak tiap detik tanpa polling.
   Aktif hanya untuk akun login (PlayerData.serverMode()). Tamu/lokal: tidak ada batas hati (enabled() = false).
   Method async, TIDAK melempar untuk kegagalan jaringan: {ok:false, reason}.
   Dapat dimuat di browser (window.UT.HeartsService) maupun Node (module.exports = {create, project}) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.HeartsService = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var DEFAULT_MAX = 5, DEFAULT_REGEN = 900;

  /* Proyeksi lokal dari status server: st = {hearts, max, regenSecs, nextAt(ms) | null}. Murni, untuk HUD & tes. */
  function project(st, nowMs) {
    var max = st.max || DEFAULT_MAX, regen = (st.regenSecs || DEFAULT_REGEN) * 1000, h = st.hearts | 0;
    if (h >= max || st.nextAt == null) return { hearts: h, max: max, nextInSecs: 0, full: h >= max };
    var gain = nowMs >= st.nextAt ? Math.floor((nowMs - st.nextAt) / regen) + 1 : 0;
    var hh = Math.min(max, h + gain);
    if (hh >= max) return { hearts: hh, max: max, nextInSecs: 0, full: true };
    var nextAt = st.nextAt + gain * regen;
    return { hearts: hh, max: max, nextInSecs: Math.max(0, Math.ceil((nextAt - nowMs) / 1000)), full: false };
  }

  /* deps: { getClient:()=>Promise<supabaseClient>, PlayerData, enabled?:()=>bool, now?:()=>ms } */
  function create(deps) {
    deps = deps || {};
    var PD = deps.PlayerData;
    var now = deps.now || function () { return Date.now(); };
    var inflight = false, listeners = [];
    var state = { known: false, hearts: DEFAULT_MAX, max: DEFAULT_MAX, regenSecs: DEFAULT_REGEN, nextAt: null };

    function enabled() {
      if (typeof deps.enabled === 'function') return !!deps.enabled();
      return !!(PD && PD.serverMode && PD.serverMode());
    }
    async function rpc(name, args) {
      var c = await deps.getClient();
      var r = await c.rpc(name, args || {});
      if (r.error) throw r.error;
      return r.data;
    }
    function fail(e) {
      var m = String((e && e.message) || e || '');
      if (m.indexOf('AUTH_REQUIRED') >= 0) return { ok: false, reason: 'belum-login' };
      return { ok: false, reason: 'jaringan', message: m };
    }
    function apply(r) {
      if (!r || r.hearts == null || !isFinite(r.hearts)) return;
      state.known = true;
      state.hearts = Math.max(0, Math.floor(+r.hearts));
      if (r.max != null && isFinite(r.max)) state.max = Math.floor(+r.max);
      if (r.regen_secs != null && isFinite(r.regen_secs)) state.regenSecs = Math.floor(+r.regen_secs);
      state.nextAt = (r.next_in_secs == null || !isFinite(r.next_in_secs)) ? null : now() + Math.floor(+r.next_in_secs) * 1000;
      emit();
    }
    function emit() { var p = snapshot(); listeners.slice().forEach(function (fn) { try { fn(p); } catch (e) {} }); }
    function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

    /* Status saat ini (diproyeksikan ke waktu sekarang). Tanpa server: penuh, tidak pernah habis. */
    function snapshot() {
      if (!enabled()) return { known: false, hearts: DEFAULT_MAX, max: DEFAULT_MAX, nextInSecs: 0, full: true, enabled: false };
      var p = project(state, now());
      p.known = state.known; p.enabled = true;
      return p;
    }

    async function get() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { var r = await rpc('hearts_get'); apply(r); return r; } catch (e) { return fail(e); }
    }
    /* Potong 1 hati (dipanggil sekali saat match dimulai). {ok:false, reason:'hati-habis'} bila habis. Tanpa server: selalu ok. */
    async function consume() {
      if (!enabled()) return { ok: true, local: true };
      if (inflight) return { ok: false, reason: 'sedang-diproses' };
      inflight = true;
      try { var r = await rpc('hearts_consume'); apply(r); return r; }
      catch (e) { return fail(e); }
      finally { inflight = false; }
    }
    /* Tahap 2 — kirim hati ke teman (server menghitung fee/emas/batas; klien hanya mengirim id teman). */
    /* Status per teman: {ok, limit, sent_today, fee, fee_gold, friends:[{friend_id, sent_today, gold}]} */
    async function friends() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return await rpc('hearts_friends'); } catch (e) { return fail(e); }
    }
    /* {ok:true, fee, gold, sent_today, limit, gems} | {ok:false, reason:'sudah-dikirim'|'batas-harian'|'bukan-teman'|'diri-sendiri'|'jaringan'|'belum-login'} */
    async function send(friendId) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return await rpc('hearts_send', { p_friend: String(friendId) }); } catch (e) { return fail(e); }
    }
    /* Cek cepat dari proyeksi lokal (hanya UX; server tetap memutuskan di consume). Belum dimuat/tanpa server: boleh. */
    function canPlay() { var s = snapshot(); return !s.enabled || !s.known || s.hearts > 0; }

    return { enabled: enabled, get: get, consume: consume, friends: friends, send: send, snapshot: snapshot, canPlay: canPlay, onChange: onChange };
  }

  /* Instans browser: klien Supabase dimuat malas pada RPC pertama (sama seperti mine-service). */
  var SELF = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var browser = null;
  function getInstance() {
    if (browser) return browser;
    var w = (typeof window !== 'undefined') ? window : null;
    if (!w || !w.PlayerData) return null;
    browser = create({
      PlayerData: w.PlayerData,
      getClient: async function () {
        if (!(w.UT && w.UT.Multiplayer && w.UT.Multiplayer.getClient)) {
          var clientUrl = SELF
            ? new URL('../multiplayer/client.js', SELF)
            : new URL('assets/js/multiplayer/client.js', w.location.href);
          await import(clientUrl.href);
        }
        return w.UT.Multiplayer.getClient();
      }
    });
    return browser;
  }

  return { create: create, get: getInstance, project: project };
});
