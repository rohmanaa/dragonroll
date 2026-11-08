/* Tes pembersihan localStorage Tahap 1. Jalankan: node tests/legacy-cleanup.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function boot(store, opts) {
  store = Object.assign({}, store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  if (!(opts && opts.noEnumerate)) { Object.defineProperty(ls, 'length', { get: () => Object.keys(store).length }); ls.key = i => Object.keys(store)[i] || null; }
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['session.js', 'prefs.js', 'item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  return { PD: ctx.PlayerData, store, ctx };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const BASE = 'ularTanggaBlok:player:v1';

t('Tahap 7a: semua key legacy tanpa pembaca dihapus tanpa syarat (termasuk inv)', () => {
  const { PD, store } = boot({ shop: '{"coins":5}', modeScreen: '{}', lobbyGift: '1', inv: '{"coins":10}', 'ut-dadu': 'standard' });
  PD.coins();
  assert.strictEqual('shop' in store, false);
  assert.strictEqual('modeScreen' in store, false);
  assert.strictEqual('lobbyGift' in store, false);
  assert.strictEqual('inv' in store, false);
  assert.strictEqual('ut-dadu' in store, false);
});
t('Tahap 6c: data shop/inv lama TIDAK lagi diimpor (state tamu mulai bersih)', () => {
  const { PD } = boot({ shop: '{"coins":4321,"gems":7}', inv: '{"coins":999,"own":{"dice":["emas"]}}' });
  assert.notStrictEqual(PD.coins(), 4321);
  assert.notStrictEqual(PD.coins(), 999);
  assert.strictEqual(PD.owns('dice.emas'), false);
});
t('Tahap 7a: key logika lokal lama (ut:quest, ut-dragon-win, ut-mp-active, ut:serverWallet, ut:adLocal:*) dihapus', () => {
  const { PD, store } = boot({ 'ut:quest': '{}', 'ut-dragon-win': '1', 'ut-mp-active': '{}', 'ut:serverWallet': '1', 'ut:adLocal:2026-11-08': '2', 'ut:prefs:v1': '{"x":1}' });
  PD.coins();
  ['ut:quest', 'ut-dragon-win', 'ut-mp-active', 'ut:serverWallet', 'ut:adLocal:2026-11-08'].forEach(k => assert.strictEqual(k in store, false, k));
  assert.ok('ut:prefs:v1' in store, 'preferensi tidak ikut terhapus');
});
t('Tahap 7a: akun login -> blob tamu dihapus, pengaturannya diimpor sekali ke UT.Prefs; state akun tidak tersentuh', () => {
  const auth = JSON.stringify({ id: 'abcdefgh-1234', username: 'ab_cd' });
  const first = boot({ 'ut-auth': auth }); first.PD.coins();
  const acctKey = Object.keys(first.store).find(k => k.indexOf(BASE + ':acct:') === 0);
  const guest = JSON.stringify({ schema: 1, migration: 1, coins: 777, gems: 0, settings: { music: false, sound: true, vibration: true, graphics: 'low', ambience: 'night' } });
  const { PD, store, ctx } = boot({ 'ut-auth': auth, [acctKey]: first.store[acctKey], [BASE]: guest, [BASE + ':corrupt:5']: 'x' });
  PD.coins();
  assert.strictEqual(BASE in store, false, 'blob tamu dihapus');
  assert.strictEqual((BASE + ':corrupt:5') in store, false, 'cadangan rusak tamu dihapus');
  assert.ok(acctKey in store, 'state akun tetap ada');
  const st = ctx.UT.Prefs.get('settings');
  assert.deepStrictEqual([st.music, st.graphics, st.ambience], [false, 'low', 'night']);
});
t('Tahap 7a: tanpa akun blob tamu TIDAK dihapus (dipakai halaman login)', () => {
  const { PD, store } = boot({ [BASE]: JSON.stringify({ schema: 1, migration: 1, coins: 0, gems: 0 }) });
  PD.coins();
  assert.ok(BASE in store);
});
t('cadangan :corrupt: dipangkas ke yang terbaru saja per kunci', () => {
  const { PD, store } = boot({ [BASE + ':corrupt:100']: 'a', [BASE + ':corrupt:300']: 'c', [BASE + ':corrupt:200']: 'b', [BASE + ':acct:abcdefgh:corrupt:50']: 'z' });
  PD.coins();
  assert.deepStrictEqual(Object.keys(store).filter(k => k.includes(':corrupt:')).sort(), [BASE + ':acct:abcdefgh:corrupt:50', BASE + ':corrupt:300'].sort());
});
t('tanpa length/key (tidak bisa dienumerasi): tidak error, key legacy tetap dihapus', () => {
  const { PD, store } = boot({ shop: '{}', lobbyGift: '1' }, { noEnumerate: true });
  assert.doesNotThrow(() => PD.coins());
  assert.strictEqual('shop' in store, false);
});
t('idempoten: panggil berulang tidak mengubah data pemain', () => {
  const { PD } = boot({ shop: '{"coins":2000}' });
  const a = PD.coins(); PD.coins(); PD.coins();
  assert.strictEqual(PD.coins(), a);
});
t('Tahap 6a: key klaim achievement lokal (klaim/:paid/:intent, semua akun) dihapus, key lain tetap', () => {
  const A = 'ularTanggaBlok:achClaimed:v1';
  const { PD, store } = boot({ [A]: '{}', [A + ':paid']: '{}', [A + ':intent']: '{}', [A + ':acct:abcdefgh']: '{}', 'ut:prefs:v1': '{}' });
  PD.coins();
  Object.keys(store).forEach(k => assert.strictEqual(k.indexOf(A), -1, 'sisa: ' + k));
  assert.ok('ut:prefs:v1' in store);
  assert.strictEqual(typeof PD.achKey, 'undefined');
});
console.log(n + ' tes lulus');
