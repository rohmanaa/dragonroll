/* Tes UT.Prefs (Tahap 2 penghapusan localStorage). Jalankan: node tests/prefs.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '../assets/js/prefs.js'), 'utf8');
function boot(store, opts) {
  store = Object.assign({}, store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = {}; w.window = w;
  if (!(opts && opts.noStorage)) w.localStorage = ls;
  const ctx = vm.createContext(Object.assign(w, { console, JSON, Math, Object }));
  vm.runInContext(SRC, ctx);
  return { P: ctx.UT.Prefs, store, ctx };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

t('get mengembalikan bawaan bila belum ada; set lalu get mengembalikan nilai', () => {
  const { P } = boot();
  assert.strictEqual(P.get('musicVol', 60), 60);
  P.set('musicVol', 25);
  assert.strictEqual(P.get('musicVol', 60), 25);
});
t('false dan 0 adalah nilai sah (bukan dianggap kosong)', () => {
  const { P } = boot();
  P.set('musicOn', false); P.set('sfxVol', 0);
  assert.strictEqual(P.get('musicOn', true), false);
  assert.strictEqual(P.get('sfxVol', 100), 0);
});
t('set(nama, null) menghapus nama itu', () => {
  const { P } = boot();
  P.set('roomMap', 'gurun'); P.set('roomMap', null);
  assert.strictEqual(P.get('roomMap', 'x'), 'x');
});
t('semua tersimpan dalam SATU key ut:prefs:v1', () => {
  const { P, store } = boot();
  P.set('musicVol', 30); P.set('night', true);
  assert.deepStrictEqual(Object.keys(store), ['ut:prefs:v1']);
  assert.deepStrictEqual(JSON.parse(store['ut:prefs:v1']), { musicVol: 30, night: true });
});
t('migrasi: key lama diimpor lalu dihapus', () => {
  const { P, store } = boot({
    'ut-musicvol': '35', 'ut-musicon': '0', 'ut-sfxvol': '80', 'ut-auto': '1', 'ut-malam': '1', 'ut-autoroll': '1',
    'ut-cam': '{"angle":true,"preset":"free"}', 'ut-room-map': 'salju', 'ut-room-powers:v1': '{"equipped":["a","b"]}',
    'ut-ambience': '{"mode":"night","graphics":"low"}'
  });
  assert.strictEqual(P.get('musicVol'), 35);
  assert.strictEqual(P.get('musicOn'), false);
  assert.strictEqual(P.get('sfxVol'), 80);
  assert.strictEqual(P.get('autoDN'), true);
  assert.strictEqual(P.get('night'), true);
  assert.strictEqual(P.get('autoRoll'), true);
  assert.deepStrictEqual(P.get('cam'), { angle: true, preset: 'free' });
  assert.strictEqual(P.get('roomMap'), 'salju');
  assert.deepStrictEqual(P.get('roomPowers'), { equipped: ['a', 'b'] });
  assert.deepStrictEqual(P.get('ambience'), { mode: 'night', graphics: 'low' });
  P.LEGACY_KEYS.forEach(k => assert.ok(!(k in store), 'key lama masih ada: ' + k));
});
t('migrasi: ut-musicon="1" -> true; nilai lama yang rusak diabaikan tapi key-nya tetap dihapus', () => {
  const { P, store } = boot({ 'ut-musicon': '1', 'ut-musicvol': 'abc', 'ut-cam': '{rusak' });
  assert.strictEqual(P.get('musicOn'), true);
  assert.strictEqual(P.get('musicVol', 60), 60);
  assert.strictEqual(P.get('cam', null), null);
  assert.ok(!('ut-musicvol' in store) && !('ut-cam' in store));
});
t('migrasi tidak menimpa nilai yang sudah ada di objek baru', () => {
  const { P, store } = boot({ 'ut:prefs:v1': JSON.stringify({ musicVol: 10 }), 'ut-musicvol': '99' });
  assert.strictEqual(P.get('musicVol'), 10);
  assert.ok(!('ut-musicvol' in store));
});
t('idempoten: migrasi berulang tidak mengubah hasil', () => {
  const { P } = boot({ 'ut-sfxvol': '40' });
  const a = JSON.stringify(P.all()); P._migrate(); P._migrate();
  assert.strictEqual(JSON.stringify(P.all()), a);
});
t('dua "frame" yang berbagi storage saling melihat perubahan (tanpa cache basi)', () => {
  const a = boot(); const store = a.store;
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = {}; w.window = w; w.localStorage = ls;
  const ctx2 = vm.createContext(Object.assign(w, { console, JSON, Math, Object }));
  vm.runInContext(SRC, ctx2);
  a.P.set('musicVol', 77);
  assert.strictEqual(ctx2.UT.Prefs.get('musicVol'), 77);
});
t('all() mengembalikan salinan (mengubahnya tidak mengubah penyimpanan)', () => {
  const { P } = boot(); P.set('night', true);
  const o = P.all(); o.night = false;
  assert.strictEqual(P.get('night'), true);
});
t('on(fn) dipanggil saat set dan bisa dihentikan', () => {
  const { P } = boot(); const seen = [];
  const off = P.on((k, v) => seen.push([k, v]));
  P.set('night', true); off(); P.set('night', false);
  assert.deepStrictEqual(seen, [['night', true]]);
});
t('tanpa localStorage: tidak error, nilai bertahan di memori', () => {
  const { P } = boot({}, { noStorage: true });
  assert.doesNotThrow(() => P.set('musicVol', 12));
  assert.strictEqual(P.get('musicVol', 60), 12);
});
t('setBackend: localStorage tidak dipakai lagi, semua lewat backend', () => {
  const { P, store } = boot();
  let remote = { sfxVol: 5 }, saves = 0;
  P.setBackend({ load: () => remote, save: o => { remote = o; saves++; } });
  assert.strictEqual(P.get('sfxVol'), 5);
  P.set('night', true);
  assert.strictEqual(saves, 1);
  assert.strictEqual(remote.night, true);
  assert.ok(!('ut:prefs:v1' in store));
});
console.log(n + ' tes lulus');
