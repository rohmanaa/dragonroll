/* Tes pembersihan localStorage Tahap 1. Jalankan: node tests/legacy-cleanup.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function boot(store, opts) {
  store = Object.assign({}, store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  if (!(opts && opts.noEnumerate)) { Object.defineProperty(ls, 'length', { get: () => Object.keys(store).length }); ls.key = i => Object.keys(store)[i] || null; }
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['session.js', 'item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  return { PD: ctx.PlayerData, store };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const BASE = 'ularTanggaBlok:player:v1';

t('key legacy tanpa pembaca (shop/modeScreen/lobbyGift) dihapus setelah migrasi; inv tetap, ut-dadu dihapus', () => {
  const { PD, store } = boot({ shop: '{"coins":5}', modeScreen: '{}', lobbyGift: '1', inv: '{"coins":10}', 'ut-dadu': 'standard' });
  PD.coins();
  assert.strictEqual('shop' in store, false);
  assert.strictEqual('modeScreen' in store, false);
  assert.strictEqual('lobbyGift' in store, false);
  assert.ok('inv' in store);
  assert.strictEqual('ut-dadu' in store, false);
});
t('Tahap 6c: data shop/inv lama TIDAK lagi diimpor (state tamu mulai bersih)', () => {
  const { PD } = boot({ shop: '{"coins":4321,"gems":7}', inv: '{"coins":999,"own":{"dice":["emas"]}}' });
  assert.notStrictEqual(PD.coins(), 4321);
  assert.notStrictEqual(PD.coins(), 999);
  assert.strictEqual(PD.owns('dice.emas'), false);
});
t('akun login punya data, tetapi data tamu belum termigrasi: key legacy TIDAK dihapus', () => {
  const auth = JSON.stringify({ id: 'abcdefgh-1234' });
  const first = boot({ 'ut-auth': auth }); first.PD.coins();           /* membuat state akun (migration terisi) */
  const acctKey = Object.keys(first.store).find(k => k.indexOf(BASE + ':acct:') === 0);
  assert.ok(acctKey, 'state akun dibuat');
  const { PD, store } = boot({ 'ut-auth': auth, [acctKey]: first.store[acctKey], [BASE]: JSON.stringify({ schema: 1, migration: 0, coins: 1000, gems: 0 }), shop: '{"coins":9}' });
  PD.coins();
  assert.ok('shop' in store, 'shop dipertahankan karena data tamu belum migrasi');
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
  const { PD, store } = boot({ [A]: '{}', [A + ':paid']: '{}', [A + ':intent']: '{}', [A + ':acct:abcdefgh']: '{}', inv: '{\"coins\":1}' });
  PD.coins();
  Object.keys(store).forEach(k => assert.strictEqual(k.indexOf(A), -1, 'sisa: ' + k));
  assert.ok('inv' in store);
  assert.strictEqual(typeof PD.achKey, 'undefined');
});
console.log(n + ' tes lulus');
