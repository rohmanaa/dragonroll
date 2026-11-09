/* Appearance service (tahap b) — pintu klien ke outfit pribadi + tampilan aktif di SERVER.
   Pola sama dengan wallet-service.js: aktif hanya untuk AKUN LOGIN + flag dompet server menyala; tamu/offline tetap
   memakai PlayerData lokal. PlayerData tetap sumber kebenaran sisi klien: hasil server hanya mengisi cermin lewat
   PlayerData.applyServerOutfits / applyServerAppearance. Validasi (kepemilikan, gender, bagian, format warna) ada di SERVER
   (supabase/migrations/202611130001_player_outfits.sql); klien tidak punya validasi kedua.

   Kebijakan sinkron tampilan aktif: server menang saat refresh() (halaman Karakter dibuka); selama itu, tiap perubahan
   equip/look lokal dikirim ke server (debounce, digabung bila ada perubahan baru saat pengiriman berjalan).
   Bila server belum punya data tampilan akun ini, refresh() mengirim tampilan lokal sebagai data awal.
   Semua method async dan TIDAK melempar untuk kegagalan jaringan: mengembalikan {ok:false, reason}.
   Dapat dimuat di browser (window.UT.AppearanceService) maupun Node (module.exports = {create}) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.AppearanceService = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var DEBOUNCE_MS = 700;

  /* deps: { getClient:()=>Promise<supabaseClient>, PlayerData, enabled?:()=>bool, setTimeout?, clearTimeout? } */
  function create(deps) {
    deps = deps || {};
    var PD = deps.PlayerData;
    var setT = deps.setTimeout || (typeof setTimeout !== 'undefined' ? setTimeout : null);
    var clearT = deps.clearTimeout || (typeof clearTimeout !== 'undefined' ? clearTimeout : null);
    var inflight = Object.create(null);
    var timer = null, pushing = false, dirty = false, unsub = null;

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

    /* Satu aksi bermutasi per kunci -> tidak dobel saat tombol ditekan cepat. */
    async function once(key, fn) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      if (inflight[key]) return { ok: false, reason: 'sedang-diproses' };
      inflight[key] = true;
      try { return await fn(); }
      catch (e) { return fail(e); }
      finally { delete inflight[key]; }
    }

    function outfitList(rows) {
      return (Array.isArray(rows) ? rows : []).map(function (r) {
        return { slot: r.slot, name: r.name, data: r.data, updatedAt: Date.parse(r.updated_at) || 0 };
      });
    }

    /* ----- outfit pribadi ----- */
    async function refreshOutfits() {
      var rows = await rpc('outfit_list');
      if (PD && PD.applyServerOutfits) PD.applyServerOutfits(outfitList(rows));
      return rows;
    }
    function saveOutfit(name, data) {
      return once('outfit', async function () {
        var r = await rpc('outfit_save', { p_name: String(name == null ? '' : name), p_data: data });
        if (r && r.ok) await refreshOutfits();
        return r;
      });
    }
    function renameOutfit(slot, name) {
      return once('outfit', async function () {
        var r = await rpc('outfit_rename', { p_slot: Math.floor(+slot), p_name: String(name == null ? '' : name) });
        if (r && r.ok) await refreshOutfits();
        return r;
      });
    }
    function deleteOutfit(slot) {
      return once('outfit', async function () {
        var r = await rpc('outfit_delete', { p_slot: Math.floor(+slot) });
        if (r && r.ok) await refreshOutfits();
        return r;
      });
    }

    /* ----- tampilan aktif ----- */
    /* Kirim tampilan lokal sekarang. Bila sedang mengirim, tandai kotor dan kirim ulang setelahnya (hasil akhir = terbaru). */
    async function pushAppearance() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      if (pushing) { dirty = true; return { ok: true, queued: true }; }
      pushing = true;
      try {
        var r;
        do {
          dirty = false;
          var a = PD.appearance();
          r = await rpc('appearance_save', { p_look: a.look, p_equipped: a.equipped, p_gear_dye: a.gearDye });
        } while (dirty);
        return r;
      } catch (e) { return fail(e); }
      finally { pushing = false; }
    }

    /* Ambil dari server: inventory dulu (agar item yang dipakai dikenali), lalu tampilan aktif dan outfit.
       Panggilan beruntun saat satu refresh masih berjalan memakai hasil yang sama (tidak dobel ke server). */
    var refreshing = null;
    function refresh() {
      if (refreshing) return refreshing;
      refreshing = doRefresh().then(function (r) { refreshing = null; return r; }, function (e) { refreshing = null; throw e; });
      return refreshing;
    }
    async function doRefresh() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try {
        var inv = await rpc('inventory_get');
        if (PD.applyServerWallet && Array.isArray(inv)) PD.applyServerWallet({ inventory: inv });
        var a = await rpc('appearance_get');
        var pushed = false;
        if (a && a.found) PD.applyServerAppearance({ look: a.look, equipped: a.equipped, gearDye: a.gear_dye });
        else { var p = await pushAppearance(); pushed = !!(p && p.ok); }
        await refreshOutfits();
        return { ok: true, pushed: pushed };
      } catch (e) { return fail(e); }
    }

    /* Tampilan aktif pemain lain (Teman/Leaderboard): maks 50 id. Server hanya mengembalikan diri sendiri, teman, pengirim permintaan,
       dan pemain leaderboard. Hasil: {ok, byId:{<user_id huruf kecil>: {look, equipped, gear_dye}}} (bentuk sama dengan baris room_appearance_get). */
    async function usersAppearance(ids) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      var list = Array.from(new Set((ids || []).map(String))).slice(0, 50);
      if (!list.length) return { ok: true, byId: {} };
      try {
        var rows = await rpc('appearance_get_many', { p_user_ids: list }), byId = {};
        (Array.isArray(rows) ? rows : []).forEach(function (x) { byId[String(x.user_id).toLowerCase()] = { look: x.look || null, equipped: x.equipped || {}, gear_dye: x.gear_dye || {} }; });
        return { ok: true, byId: byId };
      } catch (e) { return fail(e); }
    }

    /* Tampilan aktif anggota room (untuk multiplayer): [{user_id, look, equipped, gear_dye}]. */
    async function roomAppearance(roomId) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { return { ok: true, players: await rpc('room_appearance_get', { p_room_id: String(roomId || '') }) }; }
      catch (e) { return fail(e); }
    }

    /* Kirim otomatis tiap perubahan equip/look lokal (debounce). Mengembalikan fungsi berhenti. */
    function autoSync() {
      if (unsub || !PD || !PD.subscribe || !setT) return function () {};
      unsub = PD.subscribe(function (reason) {
        if (reason !== 'equip' || !enabled()) return;   /* 'server-*' = cermin dari server: jangan kirim balik */
        if (timer) clearT(timer);
        timer = setT(function () { timer = null; pushAppearance(); }, DEBOUNCE_MS);
      });
      return function () { if (unsub) unsub(); unsub = null; if (timer) { clearT(timer); timer = null; } };
    }

    return {
      enabled: enabled, refresh: refresh,
      saveOutfit: saveOutfit, renameOutfit: renameOutfit, deleteOutfit: deleteOutfit,
      pushAppearance: pushAppearance, roomAppearance: roomAppearance, usersAppearance: usersAppearance, autoSync: autoSync
    };
  }

  /* Instans browser: dibuat malas; klien Supabase baru dimuat saat RPC pertama. */
  var SELF = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var MANUAL = !!(typeof document !== 'undefined' && document.currentScript && document.currentScript.hasAttribute('data-manual'));
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
    browser.autoSync();   /* halaman mana pun yang memuat file ini ikut mengirim perubahan equip (hanya mode server) */
    /* Ambil juga tampilan aktif dari server sekali saat halaman dibuka, supaya Lobi/Room/Profil tidak menunggu pemain
       membuka halaman Karakter dulu. PlayerData memberi tahu lewat 'server-appearance' -> halaman yang berlangganan
       merender ulang. Halaman yang mengatur refresh sendiri (Karakter) memasang atribut data-manual pada <script>. */
    if (!MANUAL) { try { browser.refresh(); } catch (e) {} }
    return browser;
  }
  if (typeof window !== 'undefined' && window.PlayerData) get();

  return { create: create, get: get };
});
