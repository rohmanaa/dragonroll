/* Tes UT.AuraView (assets/js/aura-view.js): kunci aura dari katalog/PlayerData/data server, dan siklus pasang-ganti-lepas pada karakter blocky. */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..') + path.sep, read = f => fs.readFileSync(R + f, 'utf8');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const store = {};
global.window = global; global.self = global;
global.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} }), addEventListener() {}, documentElement: { classList: { add() {} } } };
global.navigator = { userAgent: 'node', hardwareConcurrency: 8, deviceMemory: 8 };
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.sessionStorage = global.localStorage; global.addEventListener = () => {}; global.location = { href: '', search: '', pathname: '/' };
global.UT = {}; global.THREE = require(R + 'assets/js/vendor/three.min.js');
for (const f of ['item-catalog.js', 'player-data.js', 'blocky-character.js', 'aura-fx.js', 'aura-view.js']) vm.runInThisContext(read('assets/js/' + f), { filename: f });
const AV = UT.AuraView, FX = UT.AuraFX;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const auras = ItemCatalog.items.filter(i => i.kind === 'aura');

t('keyFromEquipped: id item aura -> gameKey aura; selain itu null', () => {
  assert.ok(auras.length >= 2);
  assert.strictEqual(AV.keyFromEquipped({ aura: auras[0].id }), auras[0].gameKey);
  assert.ok(FX.AURAS.some(a => a.id === AV.keyFromEquipped({ aura: auras[1].id })));
  for (const bad of [null, undefined, {}, { aura: null }, { aura: 'tidak.ada' }, { aura: 'skin.steve' }, 5]) assert.strictEqual(AV.keyFromEquipped(bad), null);
  assert.strictEqual(AV.equippedKey(), null); /* belum ada aura dipakai */
  assert.strictEqual(PlayerData.settings().graphics, 'high');
  assert.strictEqual(AV.quality(), FX.detectQuality(), 'grafis high = deteksi perangkat');
  PlayerData.setSettings({ graphics: 'low' }); assert.strictEqual(AV.quality(), 'low', 'grafis low = low');
  PlayerData.setSettings({ graphics: 'high' });
});
t('set/only/clear: aura menempel ke karakter, ganti aura, pindah karakter, lepas', () => {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .1, 100), A = AV.create(scene, cam);
  const mk = x => { const c = UT.BlockyCharacter.create(THREE); c.loadFromPlayer(); c.tick(.016); const g = new THREE.Group(); g.position.x = x; g.add(c.root); scene.add(g); return c.root; };
  const r1 = mk(0), r2 = mk(3), k1 = auras[0].gameKey, k2 = auras[1].gameKey;
  assert.strictEqual(A.has(r1), false);
  A.set(r1, k1); assert.strictEqual(A.has(r1), true);
  for (let i = 0; i < 30; i++) A.update(.016);
  assert.ok(A.system.stats.auras === 1 && A.system.stats.quality === AV.quality());
  A.set(r1, k2); assert.strictEqual(A.system.stats.auras, 1, 'ganti aura = setAura, bukan aura baru');
  A.set(r2, k1); assert.strictEqual(A.system.stats.auras, 2);
  A.only(r2, k1); assert.strictEqual(A.has(r1), false); assert.strictEqual(A.has(r2), true);
  for (let i = 0; i < 80; i++) A.update(.016); assert.strictEqual(A.system.stats.auras, 1, 'aura yang dilepas memudar lalu hilang');
  A.set(r2, null); assert.strictEqual(A.has(r2), false); for (let i = 0; i < 80; i++) A.update(.016); assert.strictEqual(A.system.stats.auras, 0);
  A.set(r1, 'aura-tidak-ada'); /* gagal -> tidak melempar, tidak ada aura */ assert.strictEqual(A.has(r1), false);
  A.set(null, k1); A.clearAll(); A.update(.016);
});
t('tinggi dari opsi height dipakai (pion kecil di gameplay) & tanpa AuraFX tidak error', () => {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .1, 100), A = AV.create(scene, cam);
  const c = UT.BlockyCharacter.create(THREE); c.loadFromPlayer(); c.tick(.016); const g = new THREE.Group(); g.scale.setScalar(.46); g.add(c.root); scene.add(g);
  A.set(c.root, auras[0].gameKey, { height: .92 }); const a = A.system.auras[0]; assert.ok(Math.abs(a.u - .92 / 1.8) < 1e-6, 'u=' + a.u);
  const saved = UT.AuraFX; UT.AuraFX = null;
  const B = AV.create(scene, cam); B.set(c.root, auras[0].gameKey); B.update(.016); B.clearAll();
  assert.strictEqual(AV.equippedKey(), null); UT.AuraFX = saved;
});
t('lompat: cincin & kabut aura tetap di lantai, dekor badan ikut naik; mendarat kembali normal (semua aura)', () => {
  for (const def of FX.AURAS) {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .1, 100), sys = new FX.AuraSystem(scene, cam, { quality: 'low' });
    const c = UT.BlockyCharacter.create(THREE); c.loadFromPlayer(); c.setMode('idle'); c.tick(.016);
    const g = new THREE.Group(); g.add(c.root); scene.add(g); scene.updateMatrixWorld(true);
    const a = sys.attach(c.root, def.id, {}, { height: 2 });
    for (let i = 0; i < 20; i++) { c.tick(.016); sys.update(.016); }
    const y0 = a.floor.position.y; c.jump(); let maxFlat = -1, maxFloor = -1, sawAir = false;
    for (let i = 0; i < 60; i++) { c.tick(.016); sys.update(.016); maxFlat = Math.max(maxFlat, a.flat.position.y - y0); maxFloor = Math.max(maxFloor, a.floor.position.y - y0); sawAir = sawAir || a.airborne; }
    assert.ok(sawAir, def.id + ': lompat terdeteksi');
    assert.ok(maxFlat > 0.3, def.id + ': dekor badan ikut naik ' + maxFlat);
    assert.ok(maxFloor < 0.02, def.id + ': lantai tidak ikut naik ' + maxFloor);
    for (let i = 0; i < 80; i++) { c.tick(.016); sys.update(.016); }
    assert.ok(Math.abs(a.floor.position.y - y0) < 0.03 && !a.airborne, def.id + ': normal setelah mendarat');
    sys.dispose();
  }
});
t('lobby, profil, gameplay memuat skrip aura berurutan (three -> blocky -> aura-fx -> aura-view) dan memakai UT.AuraView', () => {
  for (const f of ['lobby.html', 'profile.html', 'gameplay.html']) {
    const g = read(f), i = x => { const k = g.indexOf(x); assert.ok(k > 0, f + ': ' + x); return k; };
    assert.ok(i('vendor/three.min.js') < i('blocky-character.js') || f === 'lobby.html', f);
    assert.ok(i('three.min.js') < i('aura-fx.js') && i('blocky-character.js') < i('aura-fx.js') && i('aura-fx.js') < i('aura-view.js'), f);
    assert.ok(/UT\.AuraView\.create\(/.test(g) && /\.update\(\w+\)/.test(g), f);
  }
  assert.ok(/keyFromEquipped\(seed\.equipped\)/.test(read('gameplay.html')), 'pemain lain: aura dari data server');
});
t('karakter.html: skrip aura dimuat setelah three & player-data; aura disinkronkan di loop dan diupdate tiap frame', () => {
  const g = read('karakter.html'), i = x => { const k = g.indexOf(x); assert.ok(k > 0, x); return k; };
  assert.ok(i('vendor/three.min.js') < i('player-data.js') && i('player-data.js') < i('aura-fx.js') && i('aura-fx.js') < i('aura-view.js'));
  assert.ok(/UT\.AuraView\.create\(scene,camera\)/.test(g) && /AUR\.update\(dt\)/.test(g) && /auraSync\(\)/.test(g) && /AUR\.clear\(root\)/.test(g));
});
console.log(n + ' tes lulus');
