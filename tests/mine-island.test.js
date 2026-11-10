/* Tes adegan 3D Tambang (satu pulau, tiga gundukan) tanpa browser: THREE asli, tanpa renderer.
   Jalankan: node tests/mine-island.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..') + path.sep, read = f => fs.readFileSync(R + f, 'utf8');
global.window = global; global.UT = {};
const THREE = global.THREE = require(R + 'assets/js/vendor/three.min.js');
vm.runInThisContext(read('assets/js/mine-island.js'), { filename: 'mine-island.js' });

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const miner = () => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(1, 5.87, 1), new THREE.MeshBasicMaterial()); b.position.y = 2.9; g.add(b);
  g.userData.setEmote = e => { g.userData.emote = e; }; g.userData.anim = tt => { g.userData.t = tt; }; return g; };
const make = () => UT.MineIsland.create(THREE, { makeMiner: miner });
const ndc = (I, x, y, z) => { const v = new THREE.Vector3(x, y, z); I.scene.children[2].updateMatrixWorld(true); I.cam.updateMatrixWorld(true); I.scene.children[2].localToWorld(v); return v.project(I.cam); };

t('adegan dibuat: satu pulau (satu grup) dengan 3 unit gundukan', () => {
  const I = make(); assert.strictEqual(I.units.length, 4); [1, 2, 3].forEach(i => assert.ok(I.units[i] && I.units[i].miner));
  const xs = [1, 2, 3].map(i => I.units[i].U.position.x); assert.ok(xs[0] < xs[1] && xs[1] < xs[2], 'gundukan kiri-tengah-kanan');
  const ys = [1, 2, 3].map(i => I.units[i].U.position.y); assert.ok(ys[0] < ys[1] && ys[1] < ys[2], 'makin tinggi ke slot 3');
});
t('seluruh pulau + penambang muat di layar untuk rasio 1.1 sampai 2.4 (tak terpotong)', () => {
  for (const asp of [1.1, 1.39, 1.6, 1.78, 2.0, 2.4]) {
    const I = make(); I.fit(asp * 100, 100); I.frame(0.016, [null, 'work', 'work', 'work'], [0, 1, 1, 1]);
    const pts = [[-17.5, -0.5, 0], [17.5, -0.5, 0], [0, -0.5, 8.5], [0, -0.5, -8.5], [0, -9, 0]];
    for (const p of pts) { const q = ndc(I, p[0], p[1], p[2]); assert.ok(Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1, 'rasio ' + asp + ' titik ' + p + ' -> ' + q.x.toFixed(2) + ',' + q.y.toFixed(2)); }
    for (const i of [1, 2, 3]) { const h = I.project(i, 'chip'); assert.ok(Math.abs(h.x) < 0.98 && h.y < 0.98 && h.y > -0.98, 'label slot ' + i + ' rasio ' + asp + ' ' + h.x.toFixed(2) + ',' + h.y.toFixed(2)); }
  }
});
t('ketuk tepat di penambang tiap gundukan memilih slot yang benar; ketuk langit = 0', () => {
  const I = make(); I.fit(160, 100); I.frame(0.016, [null, 'work', 'work', 'work'], [0, 1, 1, 1]);
  for (const i of [1, 2, 3]) { const p = I.project(i, 'head'); assert.strictEqual(I.pick(p.x, p.y), i, 'slot ' + i); }
  assert.strictEqual(I.pick(0, 0.97), 0, 'langit'); assert.strictEqual(I.pick(-0.99, 0.99), 0);
});
t('slot terkunci: penambang & peti tersembunyi, gembok tampak; terbuka: sebaliknya; tak ada NaN selama 20 dtk', () => {
  const I = make(); I.fit(160, 100); const st = [null, 'locked', 'work', 'full'];
  for (let k = 0; k < 1250; k++) I.frame(0.016, st, [0, 1, 1.7, 1]);
  assert.strictEqual(I.units[1].miner.visible, false); assert.strictEqual(I.units[2].miner.visible, true); assert.strictEqual(I.units[3].miner.userData.emote, 'sit');
  assert.ok(I.units[1].lock.visible && !I.units[2].lock.visible && !I.units[3].lock.visible, 'gembok hanya di slot terkunci');
  assert.ok(!I.units[1].chest.visible && I.units[2].chest.visible, 'peti tersembunyi saat terkunci');
  I.frame(0.016, [null, 'cheer', 'work', 'work'], [0, 1, 1, 1]); assert.strictEqual(I.units[1].miner.visible, true); assert.strictEqual(I.units[1].miner.userData.emote, 'cheer');
  const b = new THREE.Box3().setFromObject(I.scene); assert.ok([b.min.x, b.max.y, b.min.z].every(isFinite));
});
t('isi peti (setFill) menampakkan tumpukan emerald sebanding; select menampakkan cincin pilihan hanya di satu gundukan', () => {
  const I = make(); I.frame(0.016, [null, 'work', 'work', 'work'], [0, 1, 1, 1]);
  const piles = i => { let c = 0; I.units[i].U.traverse(o => { if (o.isMesh && o.geometry.parameters && o.geometry.parameters.width === 0.34 && o.visible) c++; }); return c; };
  I.setFill(1, 0); I.setFill(2, 0.5); I.setFill(3, 1); I.frame(0.016, [null, 'work', 'work', 'work'], [0, 1, 1, 1]);
  assert.strictEqual(piles(1), 0); assert.strictEqual(piles(2), 8); assert.strictEqual(piles(3), 15);
  const rings = () => I.scene.children[2].children.filter(o => o.geometry && o.geometry.type === 'RingGeometry' && o.visible).length;
  assert.strictEqual(rings(), 0); I.select(2); assert.strictEqual(rings(), 1); I.select(3); assert.strictEqual(rings(), 1); I.select(0); assert.strictEqual(rings(), 0);
});
t('burst memunculkan partikel lalu hilang sendiri; dispose tidak error', () => {
  const I = make(); I.burst(2, 'emerald', 10); const vis = () => { let c = 0; I.units[2].U.traverse(o => { if (o.isMesh && o.geometry.parameters && o.geometry.parameters.width === 0.22 && o.visible) c++; }); return c; };
  assert.ok(vis() >= 8); for (let k = 0; k < 80; k++) I.frame(0.016, [null, 'full', 'full', 'full'], [0, 1, 1, 1]); assert.strictEqual(vis(), 0, 'partikel habis saat penambang diam'); I.dispose();
});
t('percikan batu muncul tepat saat rig melaporkan hantaman (strikes), bukan berdasar waktu', () => {
  let strikes = 0; const mk = () => { const g = miner(); Object.defineProperty(g.userData, 'strikes', { get: () => strikes }); return g; };
  const I = UT.MineIsland.create(THREE, { makeMiner: mk }); const st = [null, 'work', 'work', 'work'], sp = [0, 1, 1, 1];
  const vis = () => { let c = 0; I.units[1].U.traverse(o => { if (o.isMesh && o.geometry.parameters && o.geometry.parameters.width === 0.22 && o.visible) c++; }); return c; };
  for (let k = 0; k < 120; k++) I.frame(0.016, st, sp); assert.strictEqual(vis(), 0, 'tanpa hantaman: tanpa percikan');
  strikes++; I.frame(0.016, st, sp); assert.ok(vis() >= 5, 'hantaman: percikan muncul ' + vis());
});
t('tambang.html memakai pulau 3D: satu kanvas, skrip dimuat sebelum dipakai, tanpa kanvas per slot', () => {
  const h = read('tambang.html');
  assert.ok(h.indexOf('mine-island.js') > h.indexOf('three.min.js') && h.indexOf('mine-island.js') > 0);
  assert.ok(/id="stage"/.test(h) && /id="cv"/.test(h) && /UT\.MineIsland\.create/.test(h));
  assert.ok(!/<div class="bay">/.test(h) && !/makeBay/.test(h), 'adegan gua per slot sudah dihapus');
  assert.ok(/isl\.pick\(/.test(h) && /isl\.select\(/.test(h));
});
console.log(n + ' tes lulus');
