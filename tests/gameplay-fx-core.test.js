/* Global GameplayFX quality and ParticleFX integration tests. Run: node tests/gameplay-fx-core.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function harness(device, reducedMotion) {
  let motion = !!reducedMotion;
  const scene = {
    children: [],
    add(item) { this.children.push(item); },
    remove(item) { const i = this.children.indexOf(item); if (i >= 0) this.children.splice(i, 1); }
  };
  class Vector3 {
    constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    addScaledVector(v, scale) { this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale; return this; }
  }
  class Material { constructor(options) { Object.assign(this, options || {}); } dispose() {} }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry; this.material = material;
      this.position = new Vector3(); this.rotation = new Vector3();
      this.scale = { setScalar(value) { this.value = value; } };
    }
  }
  const THREE = {
    BoxGeometry: class {},
    MeshLambertMaterial: Material,
    MeshBasicMaterial: Material,
    Mesh,
    Vector3
  };
  const media = { get matches() { return motion; }, addEventListener() {} };
  const window = {
    UT: {},
    THREE,
    navigator: Object.assign({ userAgent: 'Desktop', deviceMemory: 4, hardwareConcurrency: 4 }, device || {}),
    matchMedia: query => {
      assert.strictEqual(query, '(prefers-reduced-motion: reduce)');
      return media;
    },
    console: { warn() {} }
  };
  const document = {};
  const context = { window, document, THREE, console: window.console, Number, Math, isFinite };
  vm.runInNewContext(read('gameplay/js/fx.js'), context, { filename: 'gameplay/js/fx.js' });
  vm.runInNewContext(read('gameplay/js/particle-fx.js'), context, { filename: 'gameplay/js/particle-fx.js' });
  return { FX: window.UT.GameplayFX, ParticleFX: window.UT.ParticleFX, window, media, setMotion: value => { motion = !!value; }, scene };
}

let count = 0;
const test = (name, fn) => { fn(); count++; console.log('ok - ' + name); };

test('deteksi kualitas Low dari memori perangkat rendah', () => {
  assert.strictEqual(harness({ deviceMemory: 2, hardwareConcurrency: 8 }).FX.quality(), 'low');
});
test('deteksi kualitas Medium dari profil perangkat standar', () => {
  assert.strictEqual(harness({ deviceMemory: 4, hardwareConcurrency: 4 }).FX.quality(), 'medium');
});
test('deteksi kualitas High dari perangkat kuat non-ultra', () => {
  assert.strictEqual(harness({ deviceMemory: 8, hardwareConcurrency: 6 }).FX.quality(), 'high');
});
test('deteksi kualitas Ultra dari memori dan core tinggi', () => {
  assert.strictEqual(harness({ deviceMemory: 8, hardwareConcurrency: 8 }).FX.quality(), 'ultra');
});

test('skala count mengikuti kualitas perangkat', () => {
  const expected = [
    [{ deviceMemory: 2, hardwareConcurrency: 8 }, 40],
    [{ deviceMemory: 4, hardwareConcurrency: 4 }, 80],
    [{ deviceMemory: 8, hardwareConcurrency: 6 }, 104],
    [{ deviceMemory: 8, hardwareConcurrency: 8 }, 128]
  ];
  expected.forEach(([device, value]) => assert.strictEqual(harness(device).FX.n(100, 'L2'), value));
});
test('tier L1-L4 menjadi multiplier item terpisah dari kualitas perangkat', () => {
  const FX = harness({ deviceMemory: 4, hardwareConcurrency: 4 }).FX;
  assert.deepStrictEqual(['L1', 'L2', 'L3', 'L4'].map(tier => FX.n(100, tier)), [40, 80, 130, 200]);
  assert.strictEqual(FX.n(100, { tier: 3 }), 130);
});
test('metadata tier yang tidak tersedia default ke L2', () => {
  const FX = harness({ deviceMemory: 4, hardwareConcurrency: 4 }).FX;
  assert.strictEqual(FX.n(100), 80);
  assert.strictEqual(FX.n(100, null), 80);
});
test('Reduce Motion aktif dan perubahan matchMedia terbaca langsung', () => {
  const h = harness({ deviceMemory: 4, hardwareConcurrency: 4 });
  assert.strictEqual(h.FX.reduced(), false);
  h.setMotion(true);
  assert.strictEqual(h.FX.reduced(), true);
  assert.strictEqual(h.FX.n(100, 'L2'), 32);
  h.setMotion(false);
  assert.strictEqual(h.FX.reduced(), false);
});
test('jumlah scaled minimum satu walau hasil pembulatan di bawah satu', () => {
  const h = harness({ deviceMemory: 2, hardwareConcurrency: 8 }, true);
  assert.strictEqual(h.FX.n(1, 'L1'), 1);
});
test('count tidak melampaui batas kualitas global', () => {
  const caps = [
    [{ deviceMemory: 2, hardwareConcurrency: 8 }, 120],
    [{ deviceMemory: 4, hardwareConcurrency: 4 }, 220],
    [{ deviceMemory: 8, hardwareConcurrency: 6 }, 320],
    [{ deviceMemory: 8, hardwareConcurrency: 8 }, 450]
  ];
  caps.forEach(([device, cap]) => assert.strictEqual(harness(device).FX.n(10000, 'L4'), cap));
});

test('ParticleFX.configure mengikuti preset kualitas dan tidak dipanggil ulang saat init berulang', () => {
  const presets = [
    [{ deviceMemory: 2, hardwareConcurrency: 8 }, { maxParticles: 40, maxBurst: 12 }],
    [{ deviceMemory: 4, hardwareConcurrency: 4 }, { maxParticles: 60, maxBurst: 20 }],
    [{ deviceMemory: 8, hardwareConcurrency: 6 }, { maxParticles: 100, maxBurst: 30 }],
    [{ deviceMemory: 8, hardwareConcurrency: 8 }, { maxParticles: 150, maxBurst: 45 }]
  ];
  presets.forEach(([device, expected]) => {
    const h = harness(device), calls = [], configure = h.ParticleFX.configure;
    h.ParticleFX.configure = config => { calls.push(config); return configure(config); };
    assert.strictEqual(h.FX.init(h.scene), true);
    assert.strictEqual(h.FX.init(h.scene), true);
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0])), expected);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.ParticleFX.configure())), expected);
  });
});
test('emisi GameplayFX bersama dibatasi oleh cap global aktif', () => {
  const h = harness({ deviceMemory: 4, hardwareConcurrency: 4 });
  h.FX.init(h.scene);
  for (let i = 0; i < 10; i++) h.FX.spawnConfetti({ x: 0, y: 0, z: 0 });
  h.FX.spawnExplosion({ x: 0, y: 0, z: 0 });
  h.FX.sparkle({ x: 0, y: 0, z: 0 });
  assert.strictEqual(h.scene.children.length, 220);
});
test('jumlah efek Medium tetap sama dengan baseline sebelum skala tier/device', () => {
  const h = harness({ deviceMemory: 4, hardwareConcurrency: 4 });
  h.FX.init(h.scene);
  h.FX.spawnConfetti({ x: 0, y: 0, z: 0 });
  assert.strictEqual(h.scene.children.length, 110);
  h.FX.clearConfetti();
  h.FX.spawnExplosion({ x: 0, y: 0, z: 0 });
  assert.strictEqual(h.scene.children.length, 58);
  h.FX.clearConfetti();
  h.FX.sparkle({ x: 0, y: 0, z: 0 });
  assert.strictEqual(h.scene.children.length, 14);
});
test('ParticleFX tidak dapat dikonfigurasi melewati cap kualitas global', () => {
  const h = harness({ deviceMemory: 2, hardwareConcurrency: 8 });
  const result = h.ParticleFX.configure({ maxParticles: 450, maxBurst: 80 });
  assert.strictEqual(result.maxParticles, h.FX.limit());
  assert.strictEqual(result.maxBurst, h.FX.limit() > 80 ? 80 : h.FX.limit());
});
test('API FX lama dan alias ParticleFX tetap tersedia', () => {
  const h = harness();
  ['init', 'spawnConfetti', 'spawnExplosion', 'updateConfetti', 'clearConfetti', 'sparkle', 'updateSparks', 'track', 'stopAll'].forEach(name => assert.strictEqual(typeof h.FX[name], 'function', name));
  assert.strictEqual(typeof h.FX.limit, 'function');
  ['burstAt', 'burstFromElement', 'clear', 'configure'].forEach(name => assert.strictEqual(typeof h.ParticleFX[name], 'function', name));
  assert.strictEqual(h.window.particleFX, h.ParticleFX);
});
test('feedback reduced-motion statis tidak memakai shake atau flash animasi', () => {
  const main = read('gameplay/js/main.js'), css = read('gameplay/css/gameplay.css');
  assert.match(main, /function fxReduced\(\)\{ return FX&&typeof FX\.reduced==='function'\?FX\.reduced\(\):reduce; \}/);
  assert.match(main, /if\(fxReduced\(\)\)\{ add\('hf-static-hit'/);
  const rule = /#hitFx \.hf-static-hit\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'feedback statis tersedia');
  assert.ok(!/\banimation\s*:/.test(rule[1]), 'feedback statis tidak dianimasikan');
});

test('perubahan Reduce Motion diterapkan live dan listener dilepas saat pagehide', () => {
  const main = read('gameplay/js/main.js');
  const setup = main.match(/const reduceMq=matchMedia\('\(prefers-reduced-motion: reduce\)'\);\s*let reduce=reduceMq\.matches;\s*const onReduceChange=e=>\{\s*reduce=!!e\.matches;\s*\};\s*if\(reduceMq\.addEventListener\) reduceMq\.addEventListener\('change',onReduceChange\);\s*else if\(reduceMq\.addListener\) reduceMq\.addListener\(onReduceChange\);/);
  assert.ok(setup, 'media query harus diperbarui saat preferensi berubah');
  let listener = null;
  const state = new Function('matchMedia', setup[0] + ';return { get value(){ return reduce; }, onReduceChange:onReduceChange };')(() => ({
    matches: false,
    addEventListener(type, callback) { assert.strictEqual(type, 'change'); listener = callback; }
  }));
  assert.strictEqual(state.value, false);
  listener({ matches: true });
  assert.strictEqual(state.value, true);
  listener({ matches: false });
  assert.strictEqual(state.value, false);
  const cleanup = main.match(/if\(!e\.persisted\)\{([\s\S]*?)\n    \}/);
  assert.ok(cleanup, 'listener cleanup harus terpasang pada pagehide');
  let removed = 0;
  const media = {
    removeEventListener(type, callback) { assert.strictEqual(type, 'change'); assert.strictEqual(callback, state.onReduceChange); removed++; }
  };
  const removeOnPagehide = new Function('e', 'reduceMq', 'onReduceChange', cleanup[0]);
  removeOnPagehide({ persisted: true }, media, state.onReduceChange);
  assert.strictEqual(removed, 0, 'listener dipertahankan untuk BFCache');
  removeOnPagehide({ persisted: false }, media, state.onReduceChange);
  assert.strictEqual(removed, 1, 'listener dilepas saat halaman ditutup');
});

console.log('\n' + count + ' tes lulus');
