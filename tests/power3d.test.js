/* Tes Power-3D (Batch 1): peta power-up -> model 3D, jalur impor, dan konsistensi nama. Jalankan: node tests/power3d.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const PG = require("./_page");
const root = path.join(__dirname, '..'), rd = p => PG.readFileSync(path.join(root, p), 'utf8'), ex = p => fs.existsSync(path.join(root, p));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const w = { addEventListener() {} }; w.window = w; const ctx = vm.createContext(w);
vm.runInContext(rd('src/stores/item-catalog.js'), ctx);
const IC = ctx.ItemCatalog, pus = IC.items.filter(i => i.kind === 'powerup');
const powerKeys = require('../data/inventory/power/index.js').keys;
const map = Object.fromEntries(powerKeys.map(k => [k, require('../data/inventory/power/' + k + '/manifest.js').visual.modelKey]));

t('17 power punya model 3D: 7 lama + 10 Batch 2-3', () => {
  assert.deepStrictEqual(Object.keys(map).sort(), ['blaze_core', 'diamond_sword', 'dragon_crystal', 'feather', 'fire_charge', 'golden_apple', 'grass', 'ice_crystal', 'nether_star', 'netherite_sword', 'potion_even', 'potion_odd', 'sword', 'tnt', 'totem', 'trident', 'wooden_shield']);
});
t('setiap kunci peta adalah gameKey power-up yang ada di katalog game', () => {
  Object.keys(map).forEach(k => assert.ok(pus.some(p => p.gameKey === k), 'tidak ada power-up ' + k));
});
t('setiap id 3D di peta ada di PowerCatalog.js', () => {
  const ids = (rd('src/renderers/power-3d/power-catalog.js').match(/\bid:\s*'(\w+)'/g) || []).map(s => s.match(/'(\w+)'/)[1]);
  assert.strictEqual(ids.length, 17);
  Object.values(map).forEach(v => assert.ok(ids.indexOf(v) >= 0, 'model 3D tidak ada: ' + v));
});
t('nama tampil 5 power sesuai item baru dan sama di katalog & src/gameplay/js/config.js', () => {
  const want = { sword: 'Iron Sword', feather: 'Feather', tnt: 'TNT', totem: 'Totem', grass: 'Ender Pearl' };
  const cfg = rd('src/gameplay/js/config.js');
  Object.keys(want).forEach(k => {
    assert.strictEqual(pus.find(p => p.gameKey === k).name, want[k]);
    assert.ok(new RegExp(k + ":\\s*\\['[^']*',\\s*'" + want[k] + "'").test(cfg), 'config.js nama ' + k);
  });
});
t('aturan power lama tidak berubah (id/gameKey tetap, potion & ID server utuh); ditambah 10 power baru', () => {
  ['sword', 'feather', 'tnt', 'totem', 'potion_odd', 'potion_even', 'grass'].forEach(k => assert.ok(IC.byId(k) && IC.byId(k).kind === 'powerup', k));
  assert.strictEqual(pus.length, 17);
});
t('importmap powerup.html menunjuk file lokal yang ada', () => {
  const im = JSON.parse(rd('powerup.html').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  assert.ok(ex(im['three'].replace('./', '')), 'three lokal tidak ada');
  assert.ok(ex(im['three/addons/'].replace('./', '')), 'folder addons tidak ada');
});
t('semua impor mesin 3D (relatif dan three/addons) menunjuk file yang ada', () => {
  fs.readdirSync(path.join(root, 'src/renderers/power-3d')).filter(f => f.endsWith('.js')).forEach(f => {
    const src = rd('src/renderers/power-3d/' + f);
    (src.match(/from\s+'([^']+)'/g) || []).forEach(m => {
      const spec = m.match(/'([^']+)'/)[1];
      if (spec === 'three') return;
      if (spec.indexOf('three/addons/') === 0) assert.ok(ex('src/vendor/three-addons/' + spec.slice(13)), f + ' -> ' + spec);
      else if (spec[0] === '.') assert.ok(ex(path.posix.join('src/renderers/power-3d', spec)), f + ' -> ' + spec);
      else assert.fail('impor tak dikenal: ' + spec);
    });
  });
  ['utils/BufferGeometryUtils.js', 'geometries/RoundedBoxGeometry.js', 'environments/RoomEnvironment.js'].forEach(a => {
    const s = rd('src/vendor/three-addons/' + a); (s.match(/from\s+'([^']+)'/g) || []).forEach(m => assert.strictEqual(m.match(/'([^']+)'/)[1], 'three', a));
  });
});
t('powerup.html punya wadah #p3d dan cadangan ke tampilan lama (showThemeArt)', () => {
  const h = rd('powerup.html');
  assert.ok(h.indexOf('id="p3d"') > 0); const pj = rd('data/inventory/power/_shared/js/powerup.js'); assert.ok(pj.indexOf("import('../../../../../src/renderers/power-3d/power-show.js')") > 0); /* path relatif dari data/inventory/power/_shared/js/powerup.js */
  assert.ok(/catch\(e=>\{this\.state=3/.test(h), 'tidak ada cadangan saat impor gagal');
});
t('Power: klik pilihan tidak membangun ulang grid/FX, renderer dipakai ulang dan berhenti saat preview tersembunyi', () => {
  const pj = rd('data/inventory/power/_shared/js/powerup.js');
  const pick = pj.match(/function pick\(i\)\{([\s\S]*?)\n\}/);
  assert.ok(pick && /if\(sel===i\)/.test(pick[1]), 'pilihan yang sama tidak perlu dirender ulang');
  assert.ok(!/renderGrid\(\)|PFX\.at\(i\)/.test(pick[1]), 'pilih item tidak membangun ulang grid atau burst FX');
  assert.ok(pj.includes('this.key===i.gameKey&&this.on()'), 'model yang sama tidak di-mount ulang');
  assert.ok(pj.includes('P3D.setVisible(previewIntersecting&&!document.hidden)'), 'renderer mengikuti visibilitas preview');
  assert.ok(pj.includes('if(this.inst)this.inst.stop()'), 'renderer dihentikan ketika preview tidak aktif');
});
t('Power: preview mengaktifkan suara sesuai pengaturan dan Nether Star memainkan empat layer file', () => {
  const pj = rd('data/inventory/power/_shared/js/powerup.js');
  assert.ok(pj.includes('this.inst.setSound(sound&&!star,star?0.9:1)'), 'suara renderer mengikuti pengaturan saat aktivasi oleh gesture');
  assert.ok(pj.includes('if(star&&sound)playNetherStarPreview()'), 'Nether Star preview memakai aset file, bukan suara sintetis ganda');
  ['nether-star-activation.mp3', 'nether-star-charge.mp3', 'nether-star-release.mp3', 'nether-star-finish.mp3'].forEach(file => {
    assert.ok(pj.includes(file), file + ' tersedia di preview');
  });
  assert.ok(pj.includes('a.playbackRate=rate') && pj.includes('a.volume=0.9'), 'preview menghormati pitch dan volume Nether Star');
  assert.ok(pj.includes('stopNetherStarPreview()'), 'preview dihentikan saat berpindah power');
});
t('Power-3D mendukung kualitas Low sampai Ultra dengan scaling bertahap', () => {
  const source = rd('src/renderers/power-3d/power-config.js').replace(/^export /gm, '');
  const load = device => vm.runInNewContext(source + '\n;({ QUALITY, detectQuality })', { navigator: device });
  const profiles = load({ userAgent: 'Desktop', deviceMemory: 4, hardwareConcurrency: 4 }).QUALITY;
  assert.deepStrictEqual(Object.keys(profiles), ['low', 'medium', 'high', 'ultra']);
  assert.ok(profiles.low.particleCap < profiles.medium.particleCap);
  assert.ok(profiles.medium.particleCap < profiles.high.particleCap);
  assert.ok(profiles.high.particleCap < profiles.ultra.particleCap);
  assert.ok(profiles.low.auraLayers < profiles.medium.auraLayers);
  assert.ok(profiles.medium.auraLayers < profiles.high.auraLayers);
  assert.ok(profiles.high.auraLayers < profiles.ultra.auraLayers);
  const cases = [
    [{ userAgent: 'Desktop', deviceMemory: 2, hardwareConcurrency: 8 }, 'low'],
    [{ userAgent: 'Desktop', deviceMemory: 4, hardwareConcurrency: 4 }, 'medium'],
    [{ userAgent: 'Desktop', deviceMemory: 8, hardwareConcurrency: 6 }, 'high'],
    [{ userAgent: 'Desktop', deviceMemory: 8, hardwareConcurrency: 8 }, 'ultra']
  ];
  cases.forEach(([device, expected]) => assert.strictEqual(load(device).detectQuality(), expected));
});
console.log(n + ' tes lulus');




