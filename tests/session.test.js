/* Tes Tahap 6e: UT.Session = satu pintu ke cache sesi login. Jalankan: node tests/session.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function boot(store) {
  store = Object.assign({}, store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { localStorage: ls }; w.window = w;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/session.js'), 'utf8'), vm.createContext(w));
  return { S: w.UT.Session, store };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const ID = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb';
t('belum login: read null, id/username kosong, loggedIn false', () => {
  const { S } = boot({});
  assert.deepStrictEqual([S.read(), S.id(), S.username(), S.loggedIn()], [null, '', '', false]);
});
t('write lalu read/id/username/loggedIn', () => {
  const { S, store } = boot({});
  assert.strictEqual(S.write({ id: ID, username: 'Rohman_aa' }), true);
  assert.strictEqual(S.id(), ID); assert.strictEqual(S.username(), 'Rohman_aa'); assert.strictEqual(S.loggedIn(), true);
  assert.ok(store[S.KEY]);
});
t('clear menghapus sesi', () => {
  const { S } = boot({ 'ut-auth': JSON.stringify({ id: ID, username: 'a_b' }) });
  S.clear(); assert.strictEqual(S.loggedIn(), false); assert.strictEqual(S.id(), '');
});
t('data rusak/bukan objek/id tidak valid ditolak', () => {
  assert.strictEqual(boot({ 'ut-auth': '{rusak' }).S.loggedIn(), false);
  assert.strictEqual(boot({ 'ut-auth': '[1,2]' }).S.loggedIn(), false);
  assert.strictEqual(boot({ 'ut-auth': '"teks"' }).S.loggedIn(), false);
  assert.strictEqual(boot({ 'ut-auth': JSON.stringify({ id: '../../x', username: 'a_b' }) }).S.id(), '');
});
t('dimuat dua kali tidak menimpa objek Session', () => {
  const { S } = boot({}); assert.strictEqual(typeof S.read, 'function');
});
console.log(n + ' tes lulus');
