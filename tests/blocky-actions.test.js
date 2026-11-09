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

const findHead = c => { let h = null; c.root.traverse(o => { const g = o.geometry && o.geometry.parameters; if (o.isMesh && Array.isArray(o.material) && g && g.width === 0.5 && g.height === 0.5 && g.depth === 0.5) h = o; }); return h; };
t('mata berkedip sendiri: wajah ditukar ke mata terpejam sesaat (<0,2 dtk) lalu kembali, minimal 3x dalam 30 dtk', () => {
  const c = make(); c.loadPreset(1); c.tick(0.016);
  const h = findHead(c); assert.ok(h, 'kepala ditemukan'); const open = h.material[4];
  let closedNow = false, since = 0, blinks = 0, maxClosed = 0;
  for (let i = 0; i < Math.round(30 / 0.016); i++) {
    c.tick(0.016);
    const isClosed = h.material[4] !== open;
    if (isClosed) { since += 0.016; maxClosed = Math.max(maxClosed, since); if (!closedNow) blinks++; } else since = 0;
    closedNow = isClosed;
  }
  assert.ok(blinks >= 3, 'kedip ' + blinks + 'x'); assert.ok(maxClosed < 0.2, 'terpejam ' + maxClosed + ' dtk');
  assert.strictEqual(h.material[4], open, 'berakhir dengan mata terbuka (atau kembali terbuka)');
});
t('mata gaya "Tertutup" tidak berkedip; ganti penampilan membangun ulang kepala tanpa error', () => {
  const c = make(); c.loadPreset(1); c.apply({ eyes: { id: 'closed', dye: 'blue' } }); c.tick(0.016);
  const h = findHead(c), m0 = h.material[4]; run(c, 12); assert.strictEqual(h.material[4], m0);
  c.apply({ eyes: { id: 'round', dye: 'blue' } }); run(c, 1); assert.ok(findHead(c));
});
t('aksi baru wave/flip/backflip/spin/roll: selesai sendiri, badan kembali tegak di tempat, tidak menembus lantai', () => {
  for (const type of ['wave', 'flip', 'backflip', 'spin', 'roll']) {
    const c = make(); c.loadPreset(2); c.tick(0.016); assert.strictEqual(c.acting, null);
    c.act(type); assert.strictEqual(c.acting, type, type);
    let maxRx = 0, maxRy = 0, minY = 0;
    for (let i = 0; i < Math.round((type === "wave" ? 2.3 : 1.4) / 0.016); i++) {
      c.tick(0.016); maxRx = Math.max(maxRx, Math.abs(c.root.rotation.x)); maxRy = Math.max(maxRy, Math.abs(c.root.rotation.y));
      if (type === 'roll' || type === 'flip' || type === 'backflip') minY = Math.min(minY, box(c).min.y);
    }
    assert.strictEqual(c.acting, null, type); assert.strictEqual(c.airborne, false, type);
    assert.strictEqual(c.root.rotation.x, 0, type); assert.strictEqual(c.root.rotation.y, 0, type);
    assert.ok(Math.abs(c.root.position.z) < 1e-9, type); assert.ok(Math.abs(c.root.position.y) < 1e-6, type);
    if (type === 'flip' || type === 'backflip' || type === 'roll') assert.ok(maxRx > 5.5, type + ' putaran ' + maxRx);
    if (type === 'spin') assert.ok(maxRy > 5.5, 'spin ' + maxRy);
    assert.ok(minY > -0.2, type + ' menembus lantai ' + minY);
    assert.ok(Math.abs(box(c).min.y) < 0.15, type + ' kaki kembali ke lantai');
  }
});
t('arah salto: flip ke depan (rotasi x +), backflip ke belakang (rotasi x -); salto saat sedang di udara diabaikan', () => {
  const a = make(), b = make(); a.tick(0.016); b.tick(0.016);
  a.act('flip'); b.act('backflip'); run(a, 0.3); run(b, 0.3);
  assert.ok(a.root.rotation.x > 0.5 && b.root.rotation.x < -0.5, a.root.rotation.x + ' / ' + b.root.rotation.x);
  const c = make(); c.tick(0.016); c.jump(); c.tick(0.016); c.act('flip'); assert.strictEqual(c.acting, null);
});
t('lari lalu loncat lalu berguling (urutan lobby) stabil: tinggi badan ~2 dan tidak ada NaN', () => {
  const c = make(); c.loadPreset(3); c.tick(0.016);
  c.setMode('run'); run(c, 1.2); c.jump(); run(c, 0.9); c.act('roll'); run(c, 1.0); c.act('attack'); run(c, 0.4); c.setMode('idle'); run(c, 1.5);
  const b = box(c); assert.ok(isFinite(b.min.y) && isFinite(b.max.y)); assert.ok(Math.abs(c.height() - 2) < 0.3);
  assert.ok(Math.abs(b.min.y) < 0.15, 'kaki di lantai ' + b.min.y);
});

t('lobby.html: semua aksi yang dijadwalkan dikenal rig, dan jadwal dipanggil di loop', () => {
  const l = read('lobby.html'), names = new Set(); let m; const re = /bc\.act\('([a-z]+)'\)/g;
  while ((m = re.exec(l))) names.add(m[1]);
  assert.ok(names.size >= 7, 'aksi lobby: ' + [...names]);
  for (const nm of names) { const c = make(); c.tick(0.016); c.act(nm); assert.strictEqual(c.acting, nm, 'aksi lobby tidak dikenal: ' + nm); }
  assert.ok(/bc\.tick\(dt\);lobbyStep\(dt\)/.test(l), 'lobbyStep dipanggil tiap frame');
  assert.ok(/lobbyTap\(\);buzz\(\)/.test(l), 'tap karakter memicu aksi');
});
console.log(n + ' tes lulus');
