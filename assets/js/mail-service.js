/* Mail service — satu-satunya pintu klien ke KOTAK MASUK di SERVER (supabase/migrations/202611260001_player_mail.sql).
   Surat hanya dibuat server/admin. Klien hanya membaca, menandai dibaca, mengklaim hadiah, menghapus.
   Klien tidak pernah mengirim nominal: server (RPC mail_*) yang menentukan hadiah lewat dompet (idempoten per surat).
   Aktif hanya untuk akun login (PlayerData.serverMode()). Method async, TIDAK melempar untuk kegagalan jaringan: {ok:false, reason}.
   Klaim menyegarkan cermin saldo PlayerData lewat applyServerWallet().
   Dapat dimuat di browser (window.UT.MailService) maupun Node (module.exports = {create}) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.MailService = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v) { v = Math.floor(+v); return isFinite(v) ? v : 0; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    /* Saldo hasil klaim ikut ke cermin PlayerData (hanya bila server mengirim saldo). */
    function mirror(r) {
      if (!r || !r.ok || !PD || !PD.applyServerWallet) return;
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
    function bad() { return Promise.resolve({ ok: false, reason: 'tidak-ada' }); }

    /* Daftar surat (terbaru di atas). Pemanggilan pertama membuat surat sambutan di server. */
    async function list(limit) {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try {
        var r = await rpc('mail_list', { p_limit: Math.min(Math.max(num(limit) || 50, 1), 100) });
        if (!r || r.ok !== true) return { ok: false, reason: 'jaringan' };
        var mails = (Array.isArray(r.mails) ? r.mails : []).map(function (m) {
          return { id: String(m.id), kind: m.kind === 'reward' ? 'reward' : 'system', title: String(m.title || ''), body: String(m.body || ''),
                   coins: num(m.coins), gems: num(m.gems), at: m.at, expires_at: m.expires_at || null, read: !!m.read, claimed: !!m.claimed };
        });
        return { ok: true, mails: mails, unread: num(r.unread), pending: num(r.pending) };
      } catch (e) { return fail(e); }
    }
    /* Ringkas untuk titik merah di lobby: tidak membuat surat sambutan. */
    async function summary() {
      if (!enabled()) return { ok: false, reason: 'mode-lokal' };
      try { var r = await rpc('mail_summary'); return r && r.ok ? { ok: true, unread: num(r.unread), pending: num(r.pending) } : { ok: false, reason: 'jaringan' }; }
      catch (e) { return fail(e); }
    }
    function read(id) {
      if (!UUID.test(String(id))) return bad();
      return once('read:' + id, function () { return rpc('mail_read', { p_id: String(id) }); });
    }
    function readAll() { return once('readAll', function () { return rpc('mail_read_all'); }); }
    function claim(id) {
      if (!UUID.test(String(id))) return bad();
      return once('claim', function () { return rpc('mail_claim', { p_id: String(id) }); });
    }
    function claimAll() { return once('claim', function () { return rpc('mail_claim_all'); }); }
    function remove(id) {
      if (!UUID.test(String(id))) return bad();
      return once('del:' + id, function () { return rpc('mail_delete', { p_id: String(id) }); });
    }

    return { enabled: enabled, list: list, summary: summary, read: read, readAll: readAll, claim: claim, claimAll: claimAll, remove: remove };
  }

  /* Instans browser: dibuat malas; klien Supabase baru dimuat saat RPC pertama. */
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
