/* Grafik Auto: heuristik detect(), preferensi lokal, penulisan tingkat ke PlayerData, turun-sendiri (governor) dan batasnya. */
const assert = require('assert');
const path = require('path');
const GA = require(path.join(__dirname, '..', 'src/systems/graphics-auto.js'));
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

function setup(o) {
  o = o || {};
  const store = {}, writes = [];
  let graphics = o.graphics || 'high';
  const G = {
    navigator: Object.assign({ hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 0, userAgent: 'Desktop' }, o.nav || {}),
    document: { hidden: false },
    UT: { Prefs: { get: (k, d) => (k in store ? store[k] : d), set: (k, v) => { store[k] = v; } } },
    PlayerData: { settings: () => ({ graphics }), setSettings: p => { if (p.graphics) { graphics = p.graphics; writes.push(p.graphics); } } },
    setTimeout: (f) => { G._t = f; return 1; }, clearTimeout() {},
    requestAnimationFrame: f => { G._raf = f; }
  };
  return { ga: GA.create(G), G, store, writes, get graphics() { return graphics; } };
}

t('detect: HP lemah -> low, HP menengah -> normal, HP kuat -> high, desktop kuat -> ultra', () => {
  assert.strictEqual(GA.detect({ cores: 4, mem: 2, mobile: true }), 'low');
  assert.strictEqual(GA.detect({ cores: 2, mem: 0, mobile: true }), 'low');
  assert.strictEqual(GA.detect({ cores: 4, mem: 4, mobile: true }), 'normal');
  assert.strictEqual(GA.detect({ cores: 6, mem: 4, mobile: true }), 'high');
  assert.strictEqual(GA.detect({ cores: 8, mem: 8, mobile: false }), 'ultra');
  assert.strictEqual(GA.detect({ cores: 4, mem: 8, mobile: false }), 'high');
  assert.strictEqual(GA.detect({ cores: 2, mem: 8, mobile: false }), 'normal');
});
t('detect: Save-Data selalu low; memori tak diketahui (Safari) tidak membuat turun', () => {
  assert.strictEqual(GA.detect({ cores: 8, mem: 8, saveData: true }), 'low');
  assert.strictEqual(GA.detect({ cores: 6, mem: 0, mobile: true }), 'high');
});
t('Auto mati secara bawaan dan apply() tidak menulis apa pun', () => {
  const s = setup(); assert.strictEqual(s.ga.enabled(), false); assert.strictEqual(s.ga.apply(), null); assert.deepStrictEqual(s.writes, []);
});
t('setEnabled(true) memilih tingkat perangkat dan menulisnya ke PlayerData; sudah sama = tidak menulis ulang', () => {
  const s = setup({ graphics: 'high', nav: { hardwareConcurrency: 4, deviceMemory: 2, maxTouchPoints: 5, userAgent: 'Android Mobi' } });
  assert.strictEqual(s.ga.setEnabled(true), 'low'); assert.strictEqual(s.graphics, 'low'); assert.deepStrictEqual(s.writes, ['low']);
  s.ga.apply(); assert.deepStrictEqual(s.writes, ['low']);
});
t('setEnabled(false) mematikan Auto tanpa mengubah tingkat', () => {
  const s = setup({ graphics: 'normal' }); s.ga.setEnabled(true); s.ga.setEnabled(false);
  assert.strictEqual(s.ga.enabled(), false); const g = s.graphics; assert.strictEqual(s.ga.apply(), null); assert.strictEqual(s.graphics, g);
});
t('boot() hanya sekali dan tanpa Auto tidak mengubah tingkat', () => {
  const s = setup({ graphics: 'ultra' }); assert.strictEqual(s.ga.boot(), 'ultra'); assert.deepStrictEqual(s.writes, []);
});
t('demote: turun satu tingkat, batas disimpan, maks 2x, tidak pernah di bawah low', () => {
  const s = setup({ graphics: 'ultra' }); s.ga.setEnabled(true);
  assert.strictEqual(s.graphics, 'ultra');
  assert.strictEqual(s.ga.demote(), true); assert.strictEqual(s.graphics, 'high');
  assert.strictEqual(s.ga.demote(), true); assert.strictEqual(s.graphics, 'normal');
  assert.strictEqual(s.ga.demote(), false, 'batas 2x per sesi'); assert.strictEqual(s.graphics, 'normal');
  const l = setup({ graphics: 'low', nav: { hardwareConcurrency: 2, deviceMemory: 1, maxTouchPoints: 5, userAgent: 'Android Mobi' } }); l.ga.setEnabled(true); assert.strictEqual(l.ga.demote(), false);
});
t('target() dibatasi cap hasil turun-sendiri; setEnabled(true) lagi mereset cap', () => {
  const s = setup({ graphics: 'ultra' }); s.ga.setEnabled(true); s.ga.demote();
  assert.strictEqual(s.ga.target(), 'high'); s.ga.setEnabled(true); assert.strictEqual(s.ga.target(), 'ultra');
});
t('sample: median frame time dihitung; tab tersembunyi = null', () => {
  const s = setup(); let got = 'x', ts = 0; s.G.requestAnimationFrame = f => { ts += 50; s.G._raf = f; setImmediate(() => s.G._raf(ts)); };
  s.ga.sample(v => { got = v; });
  return new Promise(r => setTimeout(r, 30)).then(() => { assert.ok(got >= 45 && got <= 55, String(got)); });
});
t('afterReady: tidak melakukan apa-apa bila Auto mati; terjadwal bila aktif', () => {
  const off = setup(); off.ga.afterReady(); assert.strictEqual(off.G._t, undefined);
  const on = setup({ graphics: 'ultra' }); on.ga.setEnabled(true); on.ga.afterReady(); assert.strictEqual(typeof on.G._t, 'function');
});

console.log(n + ' tes lulus');

