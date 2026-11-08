/* Mine service — satu-satunya pintu klien ke TAMBANG di SERVER (lihat doc/fitur/tambang/TAMBANG.md).
   Klien tidak pernah mengirim nominal, jam, atau hasil: server (RPC mine_*) yang menghitung. Semua angka ekonomi dibaca dari mine_get().
   Aktif hanya untuk akun login (PlayerData.serverMode()). Method async, TIDAK melempar untuk kegagalan jaringan: {ok:false, reason}.
   Setiap hasil yang memuat saldo menyegarkan cermin PlayerData lewat applyServerWallet().
   Dapat dimuat di browser (window.UT.MineService) maupun Node (module.exports = {create}) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.MineService = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v) { v = Math.floor(+v); return isFinite(v) ? v : 0; }

  /* deps: { getClient:()=>Promise<supabaseClient>, PlayerData, enabled?:()=>bool } */
  function create(deps) {
    deps = deps || {};
    var PD = deps.PlayerData;
    var inflight = Object.create(null);

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
    function mirror(r) {
      if (!r || !PD || !PD.applyServerWallet) return;
      var o = {};
      if (r.coins != null && isFinite(r.coins)) o.coins = num(r.coins);
      if (r.gems != null && isFinite(r.gems)) o.gems = num(r.gems);
      if (o.coins != null || o.gems != null) PD.applyServerWallet(o);
    }
    /* Satu aksi bermutasi per kunci: tombol ditekan cepat tidak mengirim dua permintaan. */
    async function once(key, fn) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      if (inflight[key]) return { ok: false, reason: 'sedang-diproses' };
      inflight[key] = true;
      try { var r = await fn(); mirror(r); return r; }
      catch (e) { return fail(e); }
      finally { delete inflight[key]; }
    }

    /* Status semua slot + konfigurasi ekonomi dari server. Juga menyegarkan saldo. */
    async function get() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { var r = await rpc('mine_get'); mirror(r); return r; } catch (e) { return fail(e); }
    }
    function slotOk(s) { s = +s; return s === 1 || s === 2 || s === 3; }
    function bad() { return Promise.resolve({ ok: false, reason: 'slot-tidak-valid' }); }

    function unlock(slot) { return slotOk(slot) ? once('mine', function () { return rpc('mine_unlock', { p_slot: +slot }); }) : bad(); }
    function upgrade(slot, kind) {
      if (!slotOk(slot)) return bad();
      if (kind !== 'speed' && kind !== 'cap') return Promise.resolve({ ok: false, reason: 'jenis-tidak-valid' });
      return once('mine', function () { return rpc('mine_upgrade', { p_slot: +slot, p_kind: kind }); });
    }
    function boost(slot) { return slotOk(slot) ? once('mine', function () { return rpc('mine_boost', { p_slot: +slot }); }) : bad(); }
    function collect(slot) { return slotOk(slot) ? once('mine', function () { return rpc('mine_collect', { p_slot: +slot }); }) : bad(); }

    return { enabled: enabled, get: get, unlock: unlock, upgrade: upgrade, boost: boost, collect: collect };
  }

  /* Instans browser: klien Supabase dimuat malas pada RPC pertama (sama seperti wallet-service). */
  var SELF = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var browser = null;
  function getInstance() {
    if (browser) return browser;
    var w = (typeof window !== 'undefined') ? window : null;
    if (!w || !w.PlayerData) return null;
    browser = create({
      PlayerData: w.PlayerData,
      getClient: async function () {
        if (!(w.UT && w.UT.Multiplayer && w.UT.Multiplayer.getClient)) await import(new URL('multiplayer/client.js', SELF || w.location.href).href);
        return w.UT.Multiplayer.getClient();
      }
    });
    return browser;
  }

  return { create: create, get: getInstance };
});
