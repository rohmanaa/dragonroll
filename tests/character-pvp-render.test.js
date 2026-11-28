/* Tes API karakter blocky untuk gameplay: preset, tampilan dari server, aksi (serang/bertahan/sedih/sorak), mode jalan/lari.
   Jalankan: node tests/blocky-actions.test.js   (tanpa browser: canvas dipalsukan, tidak ada render WebGL) */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const PG = require("./_page");
const R = path.join(__dirname, '..') + path.sep;
const read = f => PG.readFileSync(R + f, 'utf8');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const store = {};
global.window = global; global.self = global;
global.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} }), addEventListener() {}, documentElement: { classList: { add() {} } } };
global.navigator = { userAgent: 'node', hardwareConcurrency: 8, deviceMemory: 8 };
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.sessionStorage = global.localStorage; global.addEventListener = () => {}; global.location = { href: '', search: '', pathname: '/gameplay.html' };
global.UT = {};
global.THREE = require(R + 'src/vendor/three.min.js');
const THREE = global.THREE;
for (const f of ['src/stores/item-catalog.js', 'src/stores/player-data.js', 'src/renderers/blocky-character.js']) vm.runInThisContext(read(f), { filename: f });
const BC = UT.BlockyCharacter;

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const make = () => BC.create(THREE);
const PVP = k => ({ eyes: { id: k, dye: k === 'rival' ? 'red' : 'blue' }, hair: { id: k, dye: k === 'rival' ? 'black' : 'silver' },
  top: { id: k }, legs: { id: k }, boots: { id: k }, helm: { id: k }, chest: { id: k }, shoulder: { id: k }, cape: { id: k }, weapon: { id: k } });

['mahkota', 'rival'].forEach(k => t('renderer bersama: set PVP ' + k + ' dirender utuh (bukan jatuh ke default)', () => {
  const c = make(); c.setPreviewAll(true); c.apply(PVP(k), true); c.tick(0.016);
  const cf = c.config;
  ['eyes', 'hair', 'top', 'legs', 'boots', 'helm', 'chest', 'shoulder', 'cape', 'weapon'].forEach(p => assert.strictEqual(cf[p].id, k, p));
  let meshes = 0; c.root.traverse(o => { if (o.isMesh) meshes++; }); assert.ok(meshes > 40);
}));
t('tanpa memiliki item, set PVP tidak dirender (perilaku kepemilikan tetap)', () => {
  const c = make(); c.apply(PVP('mahkota'), true);
  assert.notStrictEqual(c.config.helm.id, 'mahkota'); assert.notStrictEqual(c.config.chest.id, 'mahkota');
});
t('wajah: face dipakai renderer, face tak dikenal/kosong jatuh ke classic, kepala tetap dibangun', () => {
  const c = make(); c.apply({ face: { id: 'smile' } }, true); assert.strictEqual(c.config.face.id, 'smile'); c.tick(0.016);
  c.apply({ face: { id: 'tidak-ada' } }); assert.strictEqual(c.config.face.id, 'classic');
  const d = make(); d.loadFromData({ gender: 'f', skin: 's2', eyes: { id: 'lash', dye: 'blue' }, hair: { id: 'bob', dye: 'brown' }, face: { id: 'freckle' }, body: { height: 1, build: 1 } }, {}, {});
  assert.strictEqual(d.config.face.id, 'freckle');
  const e = make(); e.loadFromData({ gender: 'm', skin: 's2', eyes: { id: 'round', dye: 'blue' }, hair: { id: 'short', dye: 'brown' }, body: { height: 1, build: 1 } }, {}, {});
  assert.strictEqual(e.config.face.id, 'classic', 'look lama tanpa face = classic');
  ['classic', 'soft', 'smile', 'stern', 'freckle', 'cute', 'open'].forEach(f => { const x = make(); x.apply({ face: { id: f } }, true); x.tick(0.016); });
});
console.log(n + ' tes lulus');

