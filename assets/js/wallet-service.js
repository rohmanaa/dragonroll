/* Wallet service (B5) — satu-satunya pintu klien ke dompet SERVER (coins/gems/inventory).
   Klien tidak pernah mengirim nominal: server yang menentukan (lihat doc/WALLET_SERVER_PLAN.md).
   Aktif hanya untuk AKUN LOGIN + flag menyala. Tamu/offline tetap memakai PlayerData lokal.

   Flag (Tahap 3: default MENYALA; migrasi B1-B4 dan B6 harus sudah diterapkan di Supabase):
     Tahap 3: BAWAAN MENYALA untuk akun login. Saklar darurat: window.UT_SERVER_WALLET = false atau localStorage['ut:serverWallet'] = '0'

   Setiap pemanggilan sukses menyegarkan cermin PlayerData lewat PlayerData.applyServerWallet().
   Semua method async dan TIDAK melempar untuk kegagalan jaringan: mengembalikan {ok:false, reason}.
   Dapat dimuat di browser (window.UT.Wallet) maupun Node (module.exports = {create}) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.WalletService = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v) { v = Math.floor(+v); return isFinite(v) ? v : 0; }

  /* deps: { getClient:()=>Promise<supabaseClient>, PlayerData, enabled?:()=>bool, claimAchievementRpc? } */
  function create(deps) {
    deps = deps || {};
    var PD = deps.PlayerData;
    var inflight = Object.create(null);   /* satu permintaan per kunci -> tidak dobel saat tombol ditekan cepat */

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

    /* Jalankan satu aksi bermutasi; tolak bila aksi yang sama masih berjalan. */
    async function once(key, fn) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      if (inflight[key]) return { ok: false, reason: 'sedang-diproses' };
      inflight[key] = true;
      try { return await fn(); }
      catch (e) { return fail(e); }
      finally { delete inflight[key]; }
    }

    /* Sinkronkan cermin saldo dari angka server. coins/gems boleh diambil dari hasil RPC. */
    function mirror(coins, gems, inv) {
      if (!PD || !PD.applyServerWallet) return;
      var o = {};
      if (coins != null && isFinite(coins)) o.coins = num(coins);
      if (gems != null && isFinite(gems)) o.gems = num(gems);
      if (inv) o.inventory = inv;
      PD.applyServerWallet(o);
    }

    /* Ambil saldo + inventory dari server (sumber kebenaran). Dipanggil saat halaman dibuka. */
    async function refresh() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try {
        var w = await rpc('wallet_get'), inv = await rpc('inventory_get');
        mirror(w.coins, w.gems, Array.isArray(inv) ? inv : []);
        return { ok: true, coins: num(w.coins), gems: num(w.gems) };
      } catch (e) { return fail(e); }
    }

    /* ----- toko ----- */
    function buy(itemId) {
      return once('buy', async function () {
        var r = await rpc('buy_item', { p_item_id: String(itemId || '') });
        if (r && r.ok) {
          mirror(r.coins, r.gems);
          if (PD && PD.applyServerItem) PD.applyServerItem(r.item);
        }
        return r;
      });
    }

    /* Beli satu SET gear: server menghitung total, memotong koin sekali, dan memasukkan semua item dalam satu
       transaksi (semua berhasil atau semua gagal). Item yang sudah dimiliki dilewati dan tidak ditagih.
       Memakai kunci 'buy' yang sama dengan buy(): dua pembelian tidak bisa berjalan bersamaan. */
    function buySet(itemIds) {
      return once('buy', async function () {
        var ids = Array.isArray(itemIds) ? itemIds.map(function (x) { return String(x); }) : [];
        var r = await rpc('buy_set', { p_item_ids: ids });
        if (r && r.ok) {
          mirror(r.coins, r.gems);
          if (PD && PD.applyServerItem) {
            /* items = baru dibeli; skipped = sudah dimiliki di server (menyembuhkan cermin yang usang) */
            (Array.isArray(r.items) ? r.items : []).forEach(function (id) { PD.applyServerItem(id); });
            (Array.isArray(r.skipped) ? r.skipped : []).forEach(function (id) { if (!PD.owns(id)) PD.applyServerItem(id); });
          }
        }
        return r;
      });
    }

    /* ----- tukar gem -> koin (paket 0..2, nominal di server) ----- */
    function exchange(pack) {
      return once('exchange', async function () {
        var r = await rpc('exchange_gems', { p_pack: Math.floor(+pack) });
        if (r && r.ok) return Object.assign({}, r, await refresh());
        return r;
      });
    }

    /* ----- daily reward ----- */
    async function dailyGet() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return Object.assign({ ok: true }, await rpc('daily_reward_get')); } catch (e) { return fail(e); }
    }
    function claimDaily() {
      return once('daily', async function () {
        var r = await rpc('claim_daily_reward');
        if (r && r.ok) { mirror(r.wallet_coins, r.wallet_gems); await refreshInventory(); }
        return r;
      });
    }

    /* ----- misi ----- */
    async function questGet() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return Object.assign({ ok: true }, await rpc('quest_get')); } catch (e) { return fail(e); }
    }
    async function questTrack(type) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return await rpc('quest_track', { p_type: String(type) }); } catch (e) { return fail(e); }
    }
    function questClaim(id) { return claimAndRefresh('quest', 'quest_claim', { p_id: String(id) }); }
    function questClaimAll() { return claimAndRefresh('quest', 'quest_claim_all'); }
    function questClaimBonus() { return claimAndRefresh('quest', 'quest_claim_bonus'); }

    /* Klaim yang hanya mengembalikan nominal hadiah: ambil saldo terbaru dari server. */
    function claimAndRefresh(key, name, args) {
      return once(key, async function () {
        var r = await rpc(name, args);
        if (r && r.ok) await refresh();
        return r;
      });
    }

    /* ----- hadiah boss ----- */
    function claimBossOnline(roomId) {
      return once('boss', async function () {
        var r = await rpc('claim_boss_reward', { p_room_id: String(roomId || '') });
        if (r && r.ok && !r.duplicate) mirror(r.coins, r.gems);
        return r;
      });
    }
    function claimBossCpu(token) {
      return once('boss', async function () {
        var r = await rpc('claim_cpu_boss_reward', { p_token: String(token || '') });
        if (r && r.ok && !r.duplicate) mirror(r.coins, r.gems);
        return r;
      });
    }
    async function capsGet() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return Object.assign({ ok: true }, await rpc('reward_caps_get')); } catch (e) { return fail(e); }
    }

    /* ----- emerald dari iklan berhadiah: token dari ads-service; nominal, batas harian, dan jeda ditentukan server ----- */
    function claimAd(token) {
      return once('ad', async function () {
        var r = await rpc('claim_ad_reward', { p_token: String(token || '') });
        if (r && r.ok && !r.duplicate) mirror(r.coins, r.gems);
        return r;
      });
    }
    async function adGet() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return Object.assign({ ok: true }, await rpc('ad_reward_get')); } catch (e) { return fail(e); }
    }

    /* ----- achievement: RPC klaim tetap lewat progress-service; di sini hanya sinkron saldo ----- */
    function claimAchievement(id, clientValue) {
      return once('ach', async function () {
        var r = deps.claimAchievementRpc
          ? await deps.claimAchievementRpc(id, clientValue)
          : await rpc('claim_achievement', { p_id: String(id), p_client_value: clientValue == null ? null : Math.max(0, num(clientValue)) });
        if (r && r.ok !== false) mirror(r.wallet_coins, r.wallet_gems);
        return r;
      });
    }

    async function refreshInventory() {
      try { var inv = await rpc('inventory_get'); mirror(null, null, Array.isArray(inv) ? inv : []); } catch (e) {}
    }

    return {
      enabled: enabled, refresh: refresh, buy: buy, buySet: buySet, exchange: exchange,
      dailyGet: dailyGet, claimDaily: claimDaily,
      questGet: questGet, questTrack: questTrack, questClaim: questClaim, questClaimAll: questClaimAll, questClaimBonus: questClaimBonus,
      claimBossOnline: claimBossOnline, claimBossCpu: claimBossCpu, capsGet: capsGet, claimAd: claimAd, adGet: adGet,
      claimAchievement: claimAchievement
    };
  }

  /* Instans browser: dibuat malas; klien Supabase baru dimuat saat RPC pertama (halaman tidak perlu memuatnya lebih dulu). */
  var SELF = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var browser = null;
  function get() {
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

  return { create: create, get: get };
});
