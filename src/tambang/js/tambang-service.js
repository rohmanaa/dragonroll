/* Tambang service â€” satu-satunya pintu klien Tambang World ke SERVER (RPC tambang_*, migrasi 202611490001_tambang_world.sql).
   Klien tidak pernah mengirim nominal, jam, atau hasil: server menghitung semuanya dan mengubah dompet lewat _wallet_apply.
   Aktif hanya untuk akun login (PlayerData.serverMode()). Method async, TIDAK melempar untuk kegagalan jaringan: {ok:false, reason}.
   Setiap hasil yang memuat saldo (coins/gems) menyegarkan cermin PlayerData lewat applyServerWallet(), jadi angka Koin/Emerald di
   semua halaman (lobby, toko, HUD tambang) sama dengan dompet server.
   Dapat dimuat di browser (window.UT.TambangService) maupun Node (module.exports = {create}) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.TambangService = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v) { v = Math.floor(+v); return isFinite(v) ? v : 0; }
  var MINES = [1, 2, 3, 4, 5];
  var KIND = { upgrade: ['speed', 'cap'], lift: ['cap', 'spd'], gudang: ['cap', 'off'], hire: ['furn', 'forest'] };

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
      if (r.state) { if (o.coins == null && r.state.coins != null && isFinite(r.state.coins)) o.coins = num(r.state.coins); if (o.gems == null && r.state.gems != null && isFinite(r.state.gems)) o.gems = num(r.state.gems); }
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
    var bad = function (reason) { return Promise.resolve({ ok: false, reason: reason }); };
    var slotOk = function (s) { return MINES.indexOf(+s) >= 0; };
    var kindOk = function (grp, k) { return KIND[grp].indexOf(k) >= 0; };

    /* Status lengkap + konfigurasi dari server. Juga menyegarkan saldo. */
    async function get() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { var r = await rpc('tambang_get'); mirror(r); return r; } catch (e) { return fail(e); }
    }

    return {
      enabled: enabled, get: get,
      unlock: function (slot) { return slotOk(slot) ? once('tb', function () { return rpc('tambang_unlock', { p_slot: +slot }); }) : bad('slot-tidak-valid'); },
      upgrade: function (slot, kind) {
        if (!slotOk(slot)) return bad('slot-tidak-valid');
        if (!kindOk('upgrade', kind)) return bad('jenis-tidak-valid');
        return once('tb', function () { return rpc('tambang_upgrade', { p_slot: +slot, p_kind: kind }); });
      },
      manager: function (slot) { return slotOk(slot) ? once('tb', function () { return rpc('tambang_manager', { p_slot: +slot }); }) : bad('slot-tidak-valid'); },
      boost: function (slot) { return slotOk(slot) ? once('tb', function () { return rpc('tambang_boost', { p_slot: +slot }); }) : bad('slot-tidak-valid'); },
      liftUpgrade: function (kind) { return kindOk('lift', kind) ? once('tb', function () { return rpc('tambang_lift_upgrade', { p_kind: kind }); }) : bad('jenis-tidak-valid'); },
      gudangUpgrade: function (kind) { return kindOk('gudang', kind) ? once('tb', function () { return rpc('tambang_gudang_upgrade', { p_kind: kind }); }) : bad('jenis-tidak-valid'); },
      hire: function (kind) { return kindOk('hire', kind) ? once('tb', function () { return rpc('tambang_hire', { p_kind: kind }); }) : bad('jenis-tidak-valid'); },
      sweep: function () { return once('tb', function () { return rpc('tambang_sweep'); }); },
      work: function () { return once('tb', function () { return rpc('tambang_work'); }); },
      claim: function () { return once('tb', function () { return rpc('tambang_claim'); }); },
      sell: function (grp, item, qty) {
        if (!grp || !item) return bad('barang-tidak-valid');
        var a = { p_grp: String(grp), p_item: String(item) };
        if (qty != null) { qty = Math.floor(+qty); if (!(qty >= 1)) return bad('jumlah-tidak-valid'); a.p_qty = qty; }
        return once('tb', function () { return rpc('tambang_sell', a); });
      },
      sellAll: function () { return once('tb', function () { return rpc('tambang_sell_all'); }); }
    };
  }

  /* Instans browser: klien Supabase dimuat malas pada RPC pertama (sama seperti mine-service / wallet-service). */
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
            ? new URL('../../multiplayer/client.js', SELF)
            : new URL('src/multiplayer/client.js', w.location.href);
          await import(clientUrl.href);
        }
        return w.UT.Multiplayer.getClient();
      }
    });
    return browser;
  }

  return { create: create, get: getInstance };
});

