/* Tes aura 3D (assets/js/aura-fx.js) + karakter blocky (assets/js/blocky-character.js) di three.js r128 yang dipakai halaman.
   Jalankan: node tests/aura-fx.test.js   (tanpa browser: canvas dipalsukan, tidak ada render WebGL) */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..') + path.sep;
const read = f => fs.readFileSync(R + f, 'utf8');

/* ---- lingkungan browser minimal ---- */
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const store = {};
global.window = global; global.self = global;
global.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} }), addEventListener() {}, documentElement: { classList: { add() {} } } };
global.navigator = { userAgent: 'node', hardwareConcurrency: 8, deviceMemory: 8 };
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.sessionStorage = global.localStorage; global.addEventListener = () => {}; global.location = { href: '', search: '', pathname: '/efek.html' };
global.UT = {};
global.THREE = require(R + 'assets/js/vendor/three.min.js');
const THREE = global.THREE;
for (const f of ['item-catalog.js', 'player-data.js', 'aura-fx.js', 'blocky-character.js']) vm.runInThisContext(read('assets/js/' + f), { filename: f });
const FX = UT.AuraFX;

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const frames = (sys, k, extra) => { for (let i = 0; i < k; i++) { extra && extra(i); sys.update(1 / 60); } };
const stage = () => { const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 1, 0.1, 100); cam.position.set(0, 3, 19); return { scene, cam }; };

t('three yang dipakai halaman = r128 (aura-fx harus tetap kompatibel)', () => assert.strictEqual(THREE.REVISION, '128'));
t('15 aura, id unik, rarity dikenal', () => {
  assert.strictEqual(FX.AURAS.length, 15);
  assert.strictEqual(new Set(FX.AURAS.map(a => a.id)).size, 15);
  FX.AURAS.forEach(a => assert.ok(FX.RARITY[a.rarity] && a.name && a.colors.length, a.id));
});
t('shader tidak memakai include three r152+ (colorspace_fragment) yang tidak ada di r128', () => {
  assert.ok(!/colorspace_fragment/.test(read('assets/js/aura-fx.js')));
  assert.ok(!/^\s*(import|export)\s/m.test(read('assets/js/aura-fx.js')));
});
t('semua aura x 3 kualitas: attach, lompat, ganti aura, tint, despawn tanpa error', () => {
  for (const q of ['low', 'medium', 'high']) {
    const { scene, cam } = stage(), sys = new FX.AuraSystem(scene, cam, { quality: q });
    FX.AURAS.forEach((a, i) => {
      const ch = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.4), new THREE.MeshBasicMaterial()); m.position.y = 1; ch.add(m); scene.add(ch);
      const au = sys.attach(ch, a.id, {}, { height: 2 });
      frames(sys, 60, k => { ch.rotation.y += 0.05; ch.position.y = k > 15 && k < 30 ? 1.2 : 0; });
      au.set({ tint: '#ff0000', intensity: 1.5 }); au.setAura(FX.AURAS[(i + 1) % 15].id); frames(sys, 20);
      au.despawn(true); frames(sys, 70); scene.remove(ch);
    });
    assert.strictEqual(sys.stats.auras, 0, q);
    sys.setQuality(q === 'low' ? 'high' : 'low'); sys.update(0.016); sys.dispose();
  }
});
t('karakter blocky: pakai penampilan PlayerData, tinggi ~2, semua mode & lompat jalan', () => {
  const c = UT.BlockyCharacter.create(THREE); c.loadFromPlayer();
  ['idle', 'walk', 'run'].forEach(m => { c.setMode(m); for (let i = 0; i < 60; i++) c.tick(1 / 60); });
  c.jump(); assert.strictEqual(c.airborne, true);
  for (let i = 0; i < 90; i++) c.tick(1 / 60);
  assert.strictEqual(c.airborne, false);
  const s = new THREE.Box3().setFromObject(c.root).getSize(new THREE.Vector3());
  assert.ok(s.y > 1.8 && s.y < 2.4, 'tinggi ' + s.y); assert.ok(Math.abs(c.height() - 2) < 0.3);
});
t('aura menempel ke karakter blocky: mengikuti lompat & menghasilkan partikel', () => {
  const c = UT.BlockyCharacter.create(THREE); c.loadFromPlayer();
  const { scene, cam } = stage(), w = new THREE.Group(); w.scale.setScalar(1.9); w.add(c.root); scene.add(w); scene.updateMatrixWorld(true);
  const sys = new FX.AuraSystem(scene, cam, { quality: 'medium' });
  const au = sys.attach(c.root, 'dragon', {}, { height: c.height() * 1.9 });
  assert.ok(Math.abs(au.u - 2.1) < 0.2, 'u ' + au.u);
  c.jump(); let air = false; for (let i = 0; i < 90; i++) { c.tick(1 / 60); sys.update(1 / 60); air = air || au.airborne; }
  assert.ok(air, 'aura harus mendeteksi lompat'); assert.ok(sys.stats.particles > 0);
});
t('efek.html terhubung: skrip dimuat berurutan setelah three, kategori Efek memakai UT.AuraFX', () => {
  const h = read('efek.html');
  const i3 = h.indexOf('vendor/three.min.js'), ib = h.indexOf('blocky-character.js'), ia = h.indexOf('aura-fx.js');
  assert.ok(i3 > 0 && ib > i3 && ia > i3, 'urutan skrip');
  assert.ok(/UT\.AuraFX/.test(h) && !/id="fxj"/.test(h) && !/id="fxw"/.test(h)); /* tombol Lompat/Jalan sudah dihapus dari halaman */
});
console.log(n + ' tes lulus');
