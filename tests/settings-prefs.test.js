/* Tes Tahap 6b-3: PlayerData.settings()/setSettings() disimpan di UT.Prefs (perangkat). Jalankan: node tests/settings-prefs.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function boot(store, withPrefs) {
  store = Object.assign({}, store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  Object.defineProperty(ls, 'length', { get: () => Object.keys(store).length }); ls.key = i => Object.keys(store)[i] || null;
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  const files = (withPrefs === false ? [] : ['prefs.js']).concat(['item-catalog.js', 'player-data.js']);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  return { PD: ctx.PlayerData, store, ctx };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const BASE = 'ularTanggaBlok:player:v1', ACCT = { 'ut-auth': JSON.stringify({ id: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb' }) };

t('setSettings menulis ke UT.Prefs, bukan ke blob pemain', () => {
  const { PD, store, ctx } = boot({});
  const r = PD.setSettings({ music: false, graphics: 'low' });
  assert.strictEqual(r.music, false); assert.strictEqual(r.graphics, 'low');
  assert.strictEqual(ctx.UT.Prefs.get('settings').music, false);
  assert.strictEqual(PD.settings().graphics, 'low');
  const blob = JSON.parse(store[BASE] || '{"settings":{"music":true}}');
  assert.strictEqual(blob.settings.music, true, 'blob tidak ikut berubah');
});
t('nilai tidak valid diabaikan (whitelist tetap)', () => {
  const { PD } = boot({});
  PD.setSettings({ music: 'ya', graphics: 'ultra', ambience: 'siang', sound: false });
  const s = PD.settings();
  assert.deepStrictEqual([s.music, s.graphics, s.ambience, s.sound], [true, 'high', 'day', false]);
});
t('impor sekali: pengaturan lama di blob pemain dipindah ke Prefs', () => {
  const old = JSON.stringify({ schema: 1, migration: 1, coins: 0, gems: 0, xp: 0, settings: { music: false, sound: true, vibration: false, graphics: 'low', ambience: 'night' } });
  const { PD, ctx } = boot({ [BASE]: old });
  const s = PD.settings();
  assert.deepStrictEqual([s.music, s.vibration, s.graphics, s.ambience], [false, false, 'low', 'night']);
  assert.strictEqual(ctx.UT.Prefs.get('settings').ambience, 'night');
});
t('pengaturan milik perangkat: sama untuk akun lain di perangkat yang sama', () => {
  const a = boot({}); a.PD.setSettings({ sound: false });
  const b = boot(Object.assign({}, a.store, ACCT));
  assert.strictEqual(b.PD.serverMode(), true);
  assert.strictEqual(b.PD.settings().sound, false);
});
t('setSettings memberi notifikasi "settings"', () => {
  const { PD } = boot({}); const seen = []; PD.subscribe(r => seen.push(r));
  PD.setSettings({ vibration: false });
  assert.ok(seen.includes('settings'));
});
t('tanpa UT.Prefs (jalur cadangan) tetap berfungsi lewat blob', () => {
  const { PD } = boot({}, false);
  PD.setSettings({ music: false });
  assert.strictEqual(PD.settings().music, false);
});
console.log(n + ' tes lulus');
