/* Tes Power-3D (Batch 1): peta power-up -> model 3D, jalur impor, dan konsistensi nama. Jalankan: node tests/power3d.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const PG = require("./_page");
const root = path.join(__dirname, '..'), rd = p => PG.readFileSync(path.join(root, p), 'utf8'), ex = p => fs.existsSync(path.join(root, p));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const w = { addEventListener() {} }; w.window = w; const ctx = vm.createContext(w);
vm.runInContext(rd('assets/js/item-catalog.js'), ctx);
const IC = ctx.ItemCatalog, pus = IC.items.filter(i => i.kind === 'powerup');
const showSrc = rd('assets/js/power3d/power-show.js');
const map = {}; (showSrc.match(/KEY_TO_POWER3D\s*=\s*\{([^}]*)\}/)[1]).split(',').forEach(p => { const m = p.match(/(\w+)\s*:\s*'(\w+)'/); if (m) map[m[1]] = m[2]; });

t('17 power punya model 3D: 7 lama + 10 Batch 2-3', () => {
  assert.deepStrictEqual(Object.keys(map).sort(), ['blaze_core', 'diamond_sword', 'dragon_crystal', 'feather', 'fire_charge', 'golden_apple', 'grass', 'ice_crystal', 'nether_star', 'netherite_sword', 'potion_even', 'potion_odd', 'sword', 'tnt', 'totem', 'trident', 'wooden_shield']);
});
t('setiap kunci peta adalah gameKey power-up yang ada di katalog game', () => {
  Object.keys(map).forEach(k => assert.ok(pus.some(p => p.gameKey === k), 'tidak ada power-up ' + k));
});
t('setiap id 3D di peta ada di PowerCatalog.js', () => {
  const ids = (rd('assets/js/power3d/PowerCatalog.js').match(/\bid:\s*'(\w+)'/g) || []).map(s => s.match(/'(\w+)'/)[1]);
  assert.strictEqual(ids.length, 17);
  Object.values(map).forEach(v => assert.ok(ids.indexOf(v) >= 0, 'model 3D tidak ada: ' + v));
});
t('nama tampil 5 power sesuai item baru dan sama di katalog & gameplay/js/config.js', () => {
  const want = { sword: 'Iron Sword', feather: 'Feather', tnt: 'TNT', totem: 'Totem', grass: 'Ender Pearl' };
  const cfg = rd('gameplay/js/config.js');
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
  fs.readdirSync(path.join(root, 'assets/js/power3d')).filter(f => f.endsWith('.js')).forEach(f => {
    const src = rd('assets/js/power3d/' + f);
    (src.match(/from\s+'([^']+)'/g) || []).forEach(m => {
      const spec = m.match(/'([^']+)'/)[1];
      if (spec === 'three') return;
      if (spec.indexOf('three/addons/') === 0) assert.ok(ex('assets/js/vendor/three-addons/' + spec.slice(13)), f + ' -> ' + spec);
      else if (spec[0] === '.') assert.ok(ex(path.posix.join('assets/js/power3d', spec)), f + ' -> ' + spec);
      else assert.fail('impor tak dikenal: ' + spec);
    });
  });
  ['utils/BufferGeometryUtils.js', 'geometries/RoundedBoxGeometry.js', 'environments/RoomEnvironment.js'].forEach(a => {
    const s = rd('assets/js/vendor/three-addons/' + a); (s.match(/from\s+'([^']+)'/g) || []).forEach(m => assert.strictEqual(m.match(/'([^']+)'/)[1], 'three', a));
  });
});
t('powerup.html punya wadah #p3d dan cadangan ke tampilan lama (showThemeArt)', () => {
  const h = rd('powerup.html');
  assert.ok(h.indexOf('id="p3d"') > 0); assert.ok(h.indexOf("import('../../../assets/js/power3d/power-show.js')") > 0); /* path relatif ke assets/js/pages/powerup.js */
  assert.ok(/catch\(e=>\{this\.state=3/.test(h), 'tidak ada cadangan saat impor gagal');
});
console.log(n + ' tes lulus');
