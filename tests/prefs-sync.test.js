/* Tes Tahap 7b: UT.PrefsSync (UT.Prefs <-> server). Jalankan: node tests/prefs-sync.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const SYNC = require('../assets/js/prefs-sync.js');
function mkPrefs(init) {
  const w = { localStorage: (function () { const st = Object.assign({}, init ? { 'ut:prefs:v1': JSON.stringify(init) } : {}); return { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } }; })() };
  w.window = w; vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/prefs.js'), 'utf8'), vm.createContext(w));
  return w.UT.Prefs;
}
function mkServer(initial) {
  const s = { prefs: initial || {}, calls: [], fail: false };
  s.client = { rpc: async (name, args) => {
    s.calls.push(name);
    if (s.fail) return { error: new Error('offline') };
    if (name === 'get_my_prefs') return { data: { ok: true, prefs: s.prefs } };
    if (name === 'set_my_prefs') { s.prefs = args.p_prefs; return { data: { ok: true, prefs: s.prefs } }; }
    return { error: new Error('rpc?') };
  } };
  return s;
}
function mk(server, prefs, on) {
  let tasks = []; const sync = SYNC.create({ Prefs: prefs, getClient: async () => server.client, enabled: () => on !== false,
    schedule: fn => { tasks.push(fn); return tasks.length; }, cancel: h => { tasks[h - 1] = null; } });
  sync.run = async () => { const t = tasks.filter(Boolean); tasks = []; for (const f of t) await f(); };
  sync.pending = () => tasks.filter(Boolean).length;
  return sync;
}
let n = 0; const queue = []; const t = (name, fn) => queue.push([name, fn]);

t('pull: nilai server menang, kunci lokal-saja dipertahankan dan naik ke server', async () => {
  const P = mkPrefs({ musicVol: 10, night: true }), S = mkServer({ musicVol: 70, sfxVol: 30 }), sync = mk(S, P);
  const r = await sync.pull();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(P.get('musicVol'), 70); assert.strictEqual(P.get('sfxVol'), 30); assert.strictEqual(P.get('night'), true);
  assert.deepStrictEqual(S.prefs, { musicVol: 70, sfxVol: 30, night: true });
});
t('pull: server kosong = seed dari lokal', async () => {
  const P = mkPrefs({ autoRoll: true, musicOn: false }), S = mkServer({}), sync = mk(S, P);
  await sync.pull();
  assert.deepStrictEqual(S.prefs, { autoRoll: true, musicOn: false });
});
t('pull tidak memicu kirim ulang (tanpa loop) walau nilai server mengubah lokal', async () => {
  const P = mkPrefs({}), S = mkServer({ musicVol: 55 }), sync = mk(S, P); sync.start();
  await sync.pull();
  assert.strictEqual(P.get('musicVol'), 55);
  assert.strictEqual(sync.pending(), 0);
  assert.deepStrictEqual(S.calls, ['get_my_prefs']);
});
t('perubahan lokal dikirim ke server dengan debounce (banyak set = 1 kirim)', async () => {
  const P = mkPrefs({}), S = mkServer({}), sync = mk(S, P); sync.start();
  P.set('musicVol', 20); P.set('musicVol', 30); P.set('night', true);
  assert.strictEqual(sync.pending(), 1);
  await sync.run();
  assert.deepStrictEqual(S.calls, ['set_my_prefs']);
  assert.deepStrictEqual(S.prefs, { musicVol: 30, night: true });
});
t('kunci di luar daftar putih tidak pernah dikirim', async () => {
  const P = mkPrefs({}), S = mkServer({}), sync = mk(S, P); sync.start();
  P.set('rahasia', 'x'); P.set('musicVol', 5);
  await sync.run();
  assert.deepStrictEqual(S.prefs, { musicVol: 5 });
  assert.strictEqual(sync.pending(), 0);
});
t('belum login: tidak ada RPC sama sekali', async () => {
  const P = mkPrefs({ musicVol: 1 }), S = mkServer({}), sync = mk(S, P, false); sync.start();
  assert.strictEqual((await sync.pull()).reason, 'belum-login');
  P.set('night', true); assert.strictEqual(sync.pending(), 0);
  assert.strictEqual((await sync.push()).reason, 'belum-login');
  assert.deepStrictEqual(S.calls, []);
});
t('gagal jaringan tidak melempar dan cache lokal tetap utuh', async () => {
  const P = mkPrefs({ musicVol: 9 }), S = mkServer({}); S.fail = true; const sync = mk(S, P); sync.start();
  assert.strictEqual((await sync.pull()).reason, 'jaringan');
  P.set('night', true); await sync.run();
  assert.strictEqual(P.get('musicVol'), 9); assert.strictEqual(P.get('night'), true);
});
t('flush mengirim perubahan tertunda segera', async () => {
  const P = mkPrefs({}), S = mkServer({}), sync = mk(S, P); sync.start();
  P.set('sfxVol', 44);
  await sync.flush();
  assert.deepStrictEqual(S.prefs, { sfxVol: 44 }); assert.strictEqual(sync.pending(), 0);
});
t('daftar kunci klien sama dengan daftar putih di migrasi SQL', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/202611150001_player_prefs.sql'), 'utf8');
  const m = sql.match(/c_keys\s+constant text\[\] := array\[([^\]]+)\]/); assert.ok(m, 'c_keys tidak ditemukan');
  const sqlKeys = m[1].split(',').map(x => x.trim().replace(/'/g, '')).sort();
  assert.deepStrictEqual(SYNC.KEYS.slice().sort(), sqlKeys);
});
(async () => { for (const [name, fn] of queue) { await fn(); n++; console.log('ok - ' + name); } console.log(n + ' tes lulus'); })().catch(e => { console.error('GAGAL:', e && e.stack || e); process.exit(1); });
