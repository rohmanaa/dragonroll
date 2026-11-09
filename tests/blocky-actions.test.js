/* Tes API karakter blocky untuk gameplay: preset, tampilan dari server, aksi (serang/bertahan/sedih/sorak), mode jalan/lari.
   Jalankan: node tests/blocky-actions.test.js   (tanpa browser: canvas dipalsukan, tidak ada render WebGL) */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..') + path.sep;
const read = f => fs.readFileSync(R + f, 'utf8');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const store = {};
global.window = global; global.self = global;
global.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} }), addEventListener() {}, documentElement: { classList: { add() {} } } };
global.navigator = { userAgent: 'node', hardwareConcurrency: 8, deviceMemory: 8 };
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.sessionStorage = global.localStorage; global.addEventListener = () => {}; global.location = { href: '', search: '', pathname: '/gameplay.html' };
global.UT = {};
global.THREE = require(R + 'assets/js/vendor/three.min.js');
const THREE = global.THREE;
for (const f of ['item-catalog.js', 'player-data.js', 'blocky-character.js']) vm.runInThisContext(read('assets/js/' + f), { filename: f });
const BC = UT.BlockyCharacter;

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const make = () => { const c = BC.create(THREE); return c; };
const box = c => { c.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(c.root); };
const run = (c, sec) => { for (let i = 0; i < Math.round(sec / 0.016); i++) c.tick(0.016); };
const findShield = c => { let s = null; c.root.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0x8a5a2b) s = o; }); return s; };

t('semua preset (2 putaran seed) dibuat, tinggi badan ~2, telapak kaki di y=0 setelah tick pertama', () => {
  assert.ok(BC.create(THREE).presetCount >= 10);
  const N = make().presetCount;
  for (let i = 0; i < N * 2; i++) {
    const c = make(); c.loadPreset(i); c.tick(0.016);
    const b = box(c); assert.ok(Math.abs(c.height() - 2) < 0.3, 'tinggi ' + i);
    assert.ok(Math.abs(b.min.y) < 0.1, 'kaki preset ' + i + ' = ' + b.min.y);
  }
});
t('preset deterministik dan beragam (gender & penampilan berbeda antar seed)', () => {
  const a = make(), b = make(); a.loadPreset(5); b.loadPreset(5);
  assert.strictEqual(JSON.stringify(a.config), JSON.stringify(b.config));
  const set = new Set(); for (let i = 0; i < make().presetCount; i++) { const c = make(); c.loadPreset(i); set.add(JSON.stringify(c.config)); }
  assert.strictEqual(set.size, make().presetCount);
  const g = new Set(); for (let i = 0; i < make().presetCount; i++) { const c = make(); c.loadPreset(i); g.add(c.config.gender); } assert.strictEqual(g.size, 2);
});
t('loadFromData(look, equipped, gearDye) = loadFromPlayer untuk data yang sama; data kosong/aneh tidak error', () => {
  const PD = window.PlayerData;
  assert.strictEqual(PD.setLook({ gender: 'f', skin: 's4', eyes: { id: 'lash', dye: 'blue' }, hair: { id: 'twin', dye: 'red' }, body: { height: 1, build: 1 } }).ok, true);
  const ap = PD.appearance(), a = make(), b = make();
  a.loadFromPlayer(); b.loadFromData(ap.look, ap.equipped, ap.gearDye);
  assert.strictEqual(JSON.stringify(a.config), JSON.stringify(b.config));
  assert.strictEqual(b.config.hair.id, 'twin');
  const c = make(); c.loadFromData(null, null, null); c.tick(0.016);
  const d = make(); d.loadFromData(ap.look, { 'g.top': 'gear.top.tidak-ada', 'x': 'y' }, {}); d.tick(0.016);
  assert.ok(c.config.gender && d.config.gender);
});
t('aksi attack/block/sad/cheer selesai sendiri; perisai hanya tampak saat block; aksi tak dikenal diabaikan', () => {
  const c = make(); c.loadFromPlayer(); c.tick(0.016); const sh = findShield(c); assert.ok(sh, 'perisai ada');
  assert.strictEqual(sh.parent.visible, false);
  for (const type of ['attack', 'block', 'sad', 'cheer']) {
    c.act(type); assert.strictEqual(c.acting, type);
    run(c, 0.2); assert.strictEqual(sh.parent.visible, type === 'block', type);
    run(c, 3); assert.strictEqual(c.acting, null, type); assert.strictEqual(sh.parent.visible, false, type);
  }
  c.act('tidak-ada'); assert.strictEqual(c.acting, null);
  c.act('block', 0.3); run(c, 0.5); assert.strictEqual(c.acting, null);
});
t('pose block: perisai di depan dada (bukan di wajah/punggung); pose tidak merusak tinggi/telapak kaki', () => {
  const c = make(); c.loadFromPlayer(); c.tick(0.016); const sh = findShield(c);
  c.act('block'); run(c, 0.3); c.root.updateMatrixWorld(true);
  const p = new THREE.Vector3().setFromMatrixPosition(sh.matrixWorld);
  assert.ok(p.z > 0.3 && p.y > 0.7 && p.y < 1.4, 'perisai ' + p.toArray());
  for (const type of ['attack', 'sad', 'cheer']) { c.act(type); run(c, 0.3); const b = box(c); assert.ok(b.min.y > -0.3 && b.max.y < 2.4, type + ' ' + b.min.y + '/' + b.max.y); run(c, 3); }
});
t('mode jalan/lari/idle: tick stabil dan kembali ke idle; lompat selesai', () => {
  const c = make(); c.loadFromPlayer(); c.tick(0.016);
  for (const m of ['walk', 'run', 'idle', 'pose1', 'pose2', 'pose3']) { c.setMode(m); run(c, 0.6); const b = box(c); assert.ok(isFinite(b.min.y) && b.max.y - b.min.y < 2.6, m); }
  c.setMode('idle'); c.jump(); assert.strictEqual(c.airborne, true); run(c, 1); assert.strictEqual(c.airborne, false);
});
t('gameplay.html memuat skrip karakter baru berurutan & memakai API yang ada di rig', () => {
  const g = read('gameplay.html');
  const idx = s => { const i = g.indexOf(s); assert.ok(i > 0, s); return i; };
  assert.ok(idx('vendor/three.min.js') < idx('blocky-character.js'));
  assert.ok(idx('player-data.js') < idx('blocky-character.js'));
  assert.ok(idx('blocky-character.js') < idx('character-face.js'));
  const used = ['loadFromPlayer', 'loadPreset', 'loadFromData', 'setMode', 'act', 'jump', 'tick', 'height'];
  const c = make(); used.forEach(k => assert.strictEqual(typeof c[k], 'function', k));
  assert.ok(/UT\.AppearanceService/.test(g) && /roomAppearance/.test(g));
});
console.log(n + ' tes lulus');
