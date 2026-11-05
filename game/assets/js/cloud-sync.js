// Sinkronisasi data pemain (PlayerData) ke Supabase untuk akun terdaftar.
// - localStorage tetap sumber utama/offline; cloud = cadangan + lintas perangkat.
// - Login: tarik dari server; jika belum ada baris, unggah data lokal SEKALI (data lokal tidak dihapus).
// - Simpan: debounce 2.5 dtk, flush saat tab disembunyikan/ditutup. Tidak menulis tiap frame/tick.
// - Gagal/offline: tetap dirty, dicoba lagi saat online/berikutnya. Tidak pernah memblokir game.
(function () {
  'use strict';
  var META_KEY = 'ut-sync-meta:v1';
  var BACKUP_PREFIX = 'ularTanggaBlok:player:v1:backup:';
  var DEBOUNCE_MS = 2500;
  var state = { uid: null, client: null, timer: null, pushing: false, seq: 0, session: null, started: false };

  function readMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { return null; } }
  function writeMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} }
  function PD() { return window.PlayerData || null; }

  function backupLocal(reason) {
    try {
      var pd = PD(); if (!pd) return;
      localStorage.setItem(BACKUP_PREFIX + Date.now(), JSON.stringify({ reason: reason, state: pd.exportState() }));
      var keys = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(BACKUP_PREFIX) === 0) keys.push(k); }
      keys.sort(); while (keys.length > 3) localStorage.removeItem(keys.shift()); // simpan 3 cadangan terakhir
    } catch (e) {}
  }

  async function getClient() {
    if (state.client) return state.client;
    await import('./multiplayer/client.js');
    state.client = await window.UT.Multiplayer.getClient();
    return state.client;
  }

  function markDirty() {
    var m = readMeta() || {};
    if (!m.uid || m.uid !== state.uid) m = { uid: state.uid, syncedAt: null, dirty: true };
    else m.dirty = true;
    writeMeta(m);
  }

  function schedule() {
    if (!state.uid) return;
    markDirty(); state.seq++;
    clearTimeout(state.timer);
    state.timer = setTimeout(function () { push().catch(function () {}); }, DEBOUNCE_MS);
  }

  async function push() {
    var pd = PD(); if (!state.uid || !pd || state.pushing) return false;
    state.pushing = true; var seqAtStart = state.seq;
    try {
      var c = await getClient();
      var res = await c.from('player_profiles').upsert({ user_id: state.uid, state: pd.exportState() }, { onConflict: 'user_id' }).select('updated_at').single();
      if (res.error) throw res.error;
      writeMeta({ uid: state.uid, syncedAt: res.data.updated_at, dirty: state.seq !== seqAtStart }); // ada perubahan saat upload -> tetap dirty
      if (state.seq !== seqAtStart) { clearTimeout(state.timer); state.timer = setTimeout(function () { push().catch(function () {}); }, DEBOUNCE_MS); }
      return true;
    } catch (e) {
      console.warn('[cloud-sync] push gagal, tetap tersimpan lokal:', e && e.message || e);
      return false;
    } finally { state.pushing = false; }
  }

  // Flush sinkron-ish saat halaman ditutup: fetch keepalive langsung ke REST (supabase-js tidak menjamin selesai).
  function flushBeacon() {
    var pd = PD(), m = readMeta();
    if (!state.uid || !state.session || !pd || !m || !m.dirty) return;
    try {
      var cfg = window.__utSupabaseCfg; if (!cfg) return;
      fetch(cfg.url + '/rest/v1/player_profiles?on_conflict=user_id', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + state.session.access_token, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: state.uid, state: pd.exportState() })
      }).catch(function () {});
    } catch (e) {}
  }

  async function reconcile(uid) {
    var pd = PD(); if (!pd) return;
    var c = await getClient();
    var r = await c.from('player_profiles').select('state,updated_at').eq('user_id', uid).maybeSingle();
    if (r.error) { console.warn('[cloud-sync] gagal membaca server, pakai data lokal:', r.error.message); markDirty(); return; }
    var meta = readMeta(), data = r.data;
    var sameOwner = !!(meta && meta.uid === uid), claimed = !!(meta && meta.uid);
    if (!data) {                                    // belum ada baris di server
      if (!claimed || sameOwner) { await push(); return; }       // migrasi sekali jalan dari data lokal akun ini / data tanpa pemilik
      backupLocal('akun-lain'); pd.resetState(); await push(); return; // data lokal milik akun lain -> akun baru mulai bersih
    }
    if (sameOwner && meta.dirty && meta.syncedAt === data.updated_at) { await push(); return; } // lokal lebih baru, server tak berubah
    if ((sameOwner && meta.dirty) || !sameOwner) backupLocal(sameOwner ? 'konflik' : (claimed ? 'akun-lain' : 'tamu-lokal'));
    var res = pd.importState(data.state);                        // server menang (lokal sudah dicadangkan bila berbeda pemilik/konflik)
    if (res && res.ok) writeMeta({ uid: uid, syncedAt: data.updated_at, dirty: false });
  }

  async function onSession(session) {
    var u = session && session.user && !session.user.is_anonymous ? session.user : null;
    state.session = u ? session : null;
    if (!u) { state.uid = null; clearTimeout(state.timer); return; }
    if (state.uid === u.id) return;
    state.uid = u.id;
    try { await reconcile(u.id); } catch (e) { console.warn('[cloud-sync] reconcile error:', e && e.message || e); }
  }

  async function start() {
    if (state.started) return; state.started = true;
    var pd = PD(); if (!pd || !pd.exportState) return;
    var c = await getClient();
    try { var cfg = await import('./multiplayer/config.example.js'); window.__utSupabaseCfg = { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY }; } catch (e) {}
    pd.subscribe(function (reason) { if (reason === 'sync' || reason === 'storage' || reason === 'pageshow') return; schedule(); });
    c.auth.onAuthStateChange(function (event, session) {
      if (event === 'TOKEN_REFRESHED' && session) { state.session = session; return; }
      setTimeout(function () { onSession(session).catch(function () {}); }, 0); // jangan await supabase di dalam callback auth
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { clearTimeout(state.timer); flushBeacon(); } });
    window.addEventListener('pagehide', flushBeacon);
    window.addEventListener('online', function () { var m = readMeta(); if (state.uid && m && m.dirty) push().catch(function () {}); });
    var s = await c.auth.getSession(); await onSession(s && s.data && s.data.session);
  }

  async function flush() { clearTimeout(state.timer); var m = readMeta(); if (state.uid && m && m.dirty) return push(); return true; }

  window.UT = window.UT || {};
  window.UT.CloudSync = { flush: flush, push: push, start: start };

  // Hanya muat klien Supabase bila perlu: ada sesi akun tersimpan, atau saat login terjadi.
  function hasCachedAccount() { try { return !!localStorage.getItem('ut-auth'); } catch (e) { return false; } }
  function boot() { start().catch(function (e) { console.warn('[cloud-sync] start gagal:', e && e.message || e); }); }
  if (hasCachedAccount()) boot();
  window.addEventListener('ut:auth-changed', function () { if (!state.started) boot(); else getClient().then(function (c) { return c.auth.getSession(); }).then(function (s) { return onSession(s && s.data && s.data.session); }).catch(function () {}); });
})();
