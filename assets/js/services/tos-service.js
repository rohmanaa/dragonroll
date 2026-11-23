/* tos-service.js — persetujuan Ketentuan Layanan + Kebijakan Privasi.
   Akun login: status disimpan di server (RPC tos_status / tos_accept, migrasi 202611420001_tos_acceptance.sql).
   Tamu tanpa akun: disimpan di localStorage; saat membuat akun, centang persetujuan di form Sign up lalu UT.Tos.accept() menulisnya ke server.
   Versi terbaru dipegang SERVER (_tos_current_version). FALLBACK_CURRENT di bawah hanya untuk tamu; tests/tos-service.test.js menjaganya sama.

     UT.Tos.status()          -> Promise<{ current, accepted, needs, source:'server'|'local' } | null>   null = tidak bisa dipastikan (jaringan)
     UT.Tos.accept()          -> Promise<boolean>        catat persetujuan versi terbaru
     UT.Tos.promptIfNeeded()  -> Promise<void>           modal "Ketentuan Layanan" (View + Confirm) bila perlu; selesai saat modal tertutup
   Skrip klasik; di Node (module.exports) untuk tes: create(deps), FALLBACK_CURRENT. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; if (!root.UT.Tos) { root.UT.Tos = api.get(); root.UT.Tos.create = api.create; } }
})(typeof window !== 'undefined' ? window : null, function (G) {
  'use strict';
  var FALLBACK_CURRENT = 1, LOCAL_KEY = 'ut:tos:version', TOS_URL = 'tos.html', PRIVACY_URL = 'tos.html#privasi';
  var SELF = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';

  function create(deps) {
    var g = deps.G || G || {};
    function serverMode() { try { return !!(g.PlayerData && g.PlayerData.serverMode && g.PlayerData.serverMode()); } catch (e) { return false; } }
    function ls() { try { return deps.storage || g.localStorage; } catch (e) { return null; } }
    function readLocal() { try { return parseInt(ls().getItem(LOCAL_KEY), 10) || 0; } catch (e) { return 0; } }
    function writeLocal(v) { try { ls().setItem(LOCAL_KEY, String(v)); } catch (e) {} }
    async function rpc(name, args) {
      var c = await deps.getClient();
      var r = await c.rpc(name, args || {});
      if (r.error) throw r.error;
      return r.data;
    }

    async function status() {
      if (serverMode()) {
        try {
          var r = await rpc('tos_status');
          if (!r || r.ok !== true) return null;
          if (r.accepted != null) writeLocal(r.accepted);
          return { current: r.current, accepted: r.accepted == null ? 0 : r.accepted, needs: !!r.needs, source: 'server' };
        } catch (e) { return null; }
      }
      var a = readLocal();
      return { current: FALLBACK_CURRENT, accepted: a, needs: a < FALLBACK_CURRENT, source: 'local' };
    }
    async function accept() {
      if (serverMode()) {
        try { var r = await rpc('tos_accept', {}); if (r && r.ok === true) { writeLocal(r.current); return true; } return false; }
        catch (e) { return false; }
      }
      writeLocal(FALLBACK_CURRENT); return true;
    }

    var pending = null;
    function promptIfNeeded() {
      if (pending) return pending;
      pending = (async function () {
        var GD = g.UT && g.UT.GameDialog; if (!GD) return;
        var s = await status(); if (!s || !s.needs) return;
        await GD.preload();
        await new Promise(function (done) {
          var busy = false;
          var d = GD.open({
            title: 'Ketentuan Layanan',
            message: 'Dengan menekan "Konfirmasi", kamu menyetujui Ketentuan Layanan dan Kebijakan Privasi Dragon Roll.',
            closable: true, onClose: done,
            buttons: [
              { label: 'Lihat', tone: 'blue', keepOpen: true, onClick: function () { try { g.open(TOS_URL, '_blank', 'noopener'); } catch (e) {} } },
              { label: 'Konfirmasi', tone: 'yellow', keepOpen: true, onClick: async function () {
                if (busy) return; busy = true; d.set({ sub: '' });
                var ok = await accept(); busy = false;
                if (ok) d.close(); else d.set({ sub: 'Gagal menyimpan. Periksa koneksi lalu coba lagi.' });
              } }
            ]
          });
        });
      })();
      pending.then(function () { pending = null; }, function () { pending = null; });
      return pending;
    }
    return { status: status, accept: accept, promptIfNeeded: promptIfNeeded, urls: { tos: TOS_URL, privacy: PRIVACY_URL } };
  }

  var inst = null;
  function get() {
    if (inst) return inst;
    var w = typeof window !== 'undefined' ? window : null;
    inst = create({
      G: w,
      getClient: async function () {
        if (!(w.UT && w.UT.Multiplayer && w.UT.Multiplayer.getClient)) {
          var u = SELF ? new URL('../multiplayer/client.js', SELF) : new URL('assets/js/multiplayer/client.js', w.location.href);
          await import(u.href);
        }
        return w.UT.Multiplayer.getClient();
      }
    });
    return inst;
  }
  return { create: create, get: get, FALLBACK_CURRENT: FALLBACK_CURRENT };
});
