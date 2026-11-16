/* Core FX (audit/4 checkpoint 1.1): kualitas perangkat, reduce-motion live, batas aktif, kompatibilitas medium = perilaku lama. */
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const SRC = fs.readFileSync(require('path').join(__dirname, '../gameplay/js/fx.js'), 'utf8');
const J = o => JSON.parse(JSON.stringify(o));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

function V3() { this.x = 0; this.y = 0; this.z = 0; }
V3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
V3.prototype.addScaledVector = function (v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; };
function build(opts) {
  opts = opts || {};
  const configured = [];
  const mq = { matches: !!opts.reduce };
  const win = {
    navigator: { hardwareConcurrency: opts.cores || 8, deviceMemory: opts.mem || 8 },
    matchMedia: () => mq,
  };
  win.UT = opts.noPFX ? {} : { ParticleFX: { configure: c => configured.push(c) } };
  const THREE = {
    BoxGeometry: function () {}, MeshLambertMaterial: function () { this.disposed = 0; }, MeshBasicMaterial: function () { this.disposed = 0; this.dispose = () => { this.disposed++; }; },
    Mesh: function (g, m) { this.geometry = g; this.material = m; this.position = new V3(); this.rotation = new V3(); this.scale = { setScalar() {} }; }, Vector3: V3,
  };
  THREE.MeshLambertMaterial.prototype.dispose = function () { this.disposed++; };
  win.THREE = THREE;
  const ctx = vm.createContext({ window: win, THREE, Math });
  vm.runInContext(SRC, ctx);
  const scene = { kids: new Set(), add(m) { this.kids.add(m); }, remove(m) { this.kids.delete(m); } };
  const FX = win.UT.GameplayFX;
  FX.init(scene);
  return { FX, scene, mq, configured };
}
const P = { x: 0, y: 0, z: 0 };

t('API lama tetap ada + API Core FX baru', () => {
  const { FX } = build();
  ['init', 'spawnConfetti', 'spawnExplosion', 'updateConfetti', 'clearConfetti', 'sparkle', 'updateSparks', 'quality', 'setQuality', 'n', 'cap', 'reduced']
    .forEach(k => assert.strictEqual(typeof FX[k], 'function', k));
});
t('medium (bawaan) = jumlah partikel lama: konfeti 110, ledakan 58, sparkle 14', () => {
  let b = build(); b.FX.spawnConfetti(P); assert.strictEqual(b.scene.kids.size, 110);
  b = build(); b.FX.spawnExplosion(P); assert.strictEqual(b.scene.kids.size, 58);
  b = build(); b.FX.spawnExplosion(P, 'ender'); assert.strictEqual(b.scene.kids.size, 58);
  b = build(); b.FX.sparkle(P); assert.strictEqual(b.scene.kids.size, 14);
});
t('swap Ender (2 ledakan) + konfeti tidak terpotong di medium', () => {
  const b = build(); b.FX.spawnExplosion(P, 'ender'); b.FX.spawnExplosion(P, 'ender'); b.FX.spawnConfetti(P);
  assert.strictEqual(b.scene.kids.size, 58 * 2 + 110);
});
t('deteksi otomatis: perangkat sangat lemah = low, lainnya medium', () => {
  assert.strictEqual(build({ cores: 2 }).FX.quality(), 'low');
  assert.strictEqual(build({ mem: 2 }).FX.quality(), 'low');
  assert.strictEqual(build({ cores: 4, mem: 4 }).FX.quality(), 'medium');
  assert.strictEqual(build().FX.quality(), 'medium');
});
t('skala n(): low 0.5, medium 1, high 1.3, ultra 1.6, minimal 1', () => {
  const { FX } = build();
  const r = q => { FX.setQuality(q); return FX.n(110); };
  assert.deepStrictEqual([r('low'), r('medium'), r('high'), r('ultra')], [55, 110, 143, 176]);
  assert.strictEqual(FX.n(1), 2); /* ultra: round(1.6) */
  FX.setQuality('low'); assert.strictEqual(FX.n(1), 1);
  FX.setQuality('bukan-tier'); assert.strictEqual(FX.quality(), 'medium'); /* kembali ke auto */
});
t('reduce-motion dibaca LIVE (ganti setelah load berlaku langsung) -> partikel x0.4', () => {
  const b = build();
  assert.strictEqual(b.FX.reduced(), false); assert.strictEqual(b.FX.n(110), 110);
  b.mq.matches = true;
  assert.strictEqual(b.FX.reduced(), true); assert.strictEqual(b.FX.n(110), 44);
  b.FX.spawnConfetti(P); assert.strictEqual(b.scene.kids.size, 44);
  b.mq.matches = false; assert.strictEqual(b.FX.n(110), 110);
});
t('batas aktif: tidak melebihi cap per tier', () => {
  const b = build(); b.FX.setQuality('low'); assert.strictEqual(b.FX.cap(), 120);
  for (let i = 0; i < 10; i++) { b.FX.spawnConfetti(P); b.FX.spawnExplosion(P); b.FX.sparkle(P); }
  assert.ok(b.scene.kids.size <= 120, 'aktif=' + b.scene.kids.size);
  assert.ok(b.scene.kids.size > 0);
});
t('batas aktif: ledakan menjaga proporsi api:asap dan tidak negatif', () => {
  const b = build(); b.FX.setQuality('low');
  for (let i = 0; i < 20; i++) b.FX.spawnExplosion(P);
  assert.ok(b.scene.kids.size <= 120);
});
t('ParticleFX.configure tersambung (init + setQuality); medium = batas lama 60/20', () => {
  const b = build();
  assert.deepStrictEqual(J(b.configured[0]), { maxParticles: 60, maxBurst: 20 });
  b.FX.setQuality('low'); assert.deepStrictEqual(J(b.configured.pop()), { maxParticles: 30, maxBurst: 10 });
  b.FX.setQuality('ultra'); assert.deepStrictEqual(J(b.configured.pop()), { maxParticles: 96, maxBurst: 30 });
});
t('tanpa ParticleFX / tanpa matchMedia tidak error', () => {
  const b = build({ noPFX: true }); b.FX.setQuality('high'); b.FX.spawnConfetti(P);
  assert.strictEqual(b.scene.kids.size, 143);
});
t('clearConfetti ikut membersihkan sparkle dan men-dispose materialnya (F2)', () => {
  const b = build(); b.FX.spawnConfetti(P); b.FX.spawnExplosion(P); b.FX.sparkle(P);
  b.FX.clearConfetti(); assert.strictEqual(b.scene.kids.size, 0);
  b.FX.updateSparks(0.1); b.FX.updateConfetti(0.1); /* tidak error setelah bersih */
});
console.log(n + ' test lulus (gameplay-fx-core)');
