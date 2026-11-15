/* Tes Registry Aura Stage 7: manifest, ItemCatalog, aset bersama, halaman konsumen, dan PlayerData. */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p)), clone = o => JSON.parse(JSON.stringify(o));
const IR = require(path.join(ROOT, 'assets/js/core/item-registry.js'));
const AuraCat = require(path.join(ROOT, 'data/inventory/aura/index.js'));
const BASE_CHAIN = ['assets/js/core/item-registry.js']
  .concat(AuraCat.keys.map(k => 'data/inventory/aura/' + k + '/manifest.js'), ['data/inventory/aura/index.js']);
const srcs = html => Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), m => m[1]);

function boot(chain, withPlayerData) {
  const store = {}, localStorage = {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i] || null
  };
  const w = { addEventListener() {}, localStorage }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math, localStorage }));
  chain.concat(['assets/js/core/session.js', 'assets/js/item-catalog.js'])
    .forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  if (withPlayerData) vm.runInContext(rd('assets/js/player-data.js'), ctx, { filename: 'assets/js/player-data.js' });
  return { ctx, store };
}

const reg = IR.create(), result = AuraCat.register(reg), manifests = reg.getCategory('aura').items;
const byKey = Object.fromEntries(manifests.map(m => [m.gameKey, m]));
const legacy = boot([]).ctx, integrated = boot(BASE_CHAIN).ctx;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok - ' + name); };

test('Registry mendaftarkan tepat 15 Aura dengan ID dan gameKey lama', () => {
  assert.strictEqual(result.ok, true); assert.deepStrictEqual(result.rejected, []);
  assert.strictEqual(result.registered, 15); assert.strictEqual(reg.rejected().length, 0);
  assert.deepStrictEqual(clone(AuraCat.keys), clone(legacy.ItemCatalog.items.filter(i => i.kind === 'aura').map(i => i.gameKey)));
  assert.deepStrictEqual(manifests.map(m => m.id), AuraCat.keys.map(k => 'aura.' + k));
  manifests.forEach(m => assert.strictEqual(m.gameKey, m.id.slice('aura.'.length), m.id));
});

test('Manifest paritas dengan katalog fallback dan definisi AuraFX: nama, rarity, harga, warna', () => {
  const baseline = legacy.ItemCatalog.items.filter(i => i.kind === 'aura');
  baseline.forEach(b => {
    const m = byKey[b.gameKey];
    assert.ok(m, b.id);
    ['kind', 'gameKey', 'name', 'rarity', 'price', 'gems', 'desc', 'starter'].forEach(k => assert.strictEqual(m[k], b[k], b.id + '.' + k));
    assert.deepStrictEqual(clone(m.visual.colors), clone(b.colors), b.id + '.colors');
    assert.strictEqual(m.visual.effectKey, b.gameKey, b.id + '.effectKey');
  });
  const fx = Array.from(rd('assets/js/renderers/aura-fx.js').matchAll(/\{ id: '([^']+)', name: '([^']+)', rarity: '([^']+)', theme: '([^']+)', colors: \[([^\]]+)\]/g), m => ({
    id: m[1], name: m[2], rarity: m[3], theme: m[4], colors: Array.from(m[5].matchAll(/'([^']+)'/g), c => c[1])
  }));
  assert.strictEqual(fx.length, 15);
  fx.forEach(def => {
    const m = byKey[def.id];
    assert.strictEqual(m.name, def.name, def.id + '.name');
    assert.strictEqual(m.rarity, def.rarity, def.id + '.rarity');
    assert.strictEqual(m.visual.theme, def.theme, def.id + '.theme');
    assert.deepStrictEqual(clone(m.visual.colors), def.colors, def.id + '.colors');
  });
});

test('ItemCatalog mempertahankan bentuk/API lama pada mode legacy dan Registry; fallback tetap aktif bila manifest kurang', () => {
  const oldItems = clone(legacy.ItemCatalog.items);
  assert.strictEqual(legacy.ItemCatalog.auraSource(), 'legacy');
  assert.strictEqual(integrated.ItemCatalog.auraSource(), 'registry');
  assert.deepStrictEqual(clone(integrated.ItemCatalog.items), oldItems);
  const incomplete = boot(BASE_CHAIN.filter(f => f !== 'data/inventory/aura/celestial/manifest.js')).ctx;
  assert.strictEqual(incomplete.ItemCatalog.auraSource(), 'legacy');
  assert.deepStrictEqual(clone(incomplete.ItemCatalog.items), oldItems);
  ['items', 'byId', 'byGameKey', 'cost', 'optionalSlots'].forEach(k => assert.strictEqual(typeof integrated.ItemCatalog[k], typeof legacy.ItemCatalog[k], k));
});

test('Semua manifest dan referensi aset bersama valid, tersedia di filesystem', () => {
  assert.deepStrictEqual(AuraCat.keys.slice().sort(), fs.readdirSync(path.join(ROOT, 'data/inventory/aura')).filter(k => fs.statSync(path.join(ROOT, 'data/inventory/aura', k)).isDirectory()).sort());
  manifests.forEach(m => {
    assert.deepStrictEqual(IR.validateManifest(m, AuraCat.category), { ok: true, errors: [] }, m.id);
    assert.strictEqual(IR.validateAssetPaths(m, AuraCat.category).ok, true, m.id);
    assert.ok(exists('data/inventory/aura/' + m.gameKey + '/manifest.js'), m.id);
    assert.ok(exists(m.assets.renderer), m.id + '.renderer');
  });
  assert.strictEqual(IR.validateAssetPaths({ assets: AuraCat.category.assets }, null).ok, true);
  Object.keys(AuraCat.category.assets).forEach(k => assert.ok(exists(AuraCat.category.assets[k]), k));
});

test('Shop, Inventory, Character, Lobby, Profile, Gameplay memuat Aura Registry sebelum ItemCatalog', () => {
  ['efek.html', 'inventory.html', 'karakter.html', 'lobby.html', 'profile.html', 'gameplay.html'].forEach(file => {
    const scripts = srcs(rd(file)), cat = scripts.indexOf('assets/js/item-catalog.js');
    assert.strictEqual(new Set(scripts).size, scripts.length, file + ' tidak boleh memuat skrip ganda');
    const registry = scripts.indexOf('assets/js/core/item-registry.js'), index = scripts.indexOf('data/inventory/aura/index.js');
    assert.ok(registry >= 0 && registry < index, file + ' ItemRegistry sebelum manifest');
    AuraCat.keys.forEach(k => {
      const i = scripts.indexOf('data/inventory/aura/' + k + '/manifest.js');
      assert.ok(i > registry && i < index && i < cat, file + ' ' + k);
    });
    assert.ok(index < cat, file + ' Aura index sebelum ItemCatalog');
  });
  ['lobby.html', 'profile.html', 'gameplay.html', 'karakter.html'].forEach(file => {
    const scripts = srcs(rd(file));
    assert.ok(scripts.indexOf('assets/js/renderers/aura-fx.js') >= 0 && scripts.indexOf('assets/js/renderers/aura-fx.js') < scripts.indexOf('assets/js/renderers/aura-view.js'), file);
  });
  assert.ok(/k:\s*'efek',\s*page:\s*'efek\.html'/.test(rd('assets/js/pages/inventory.js')), 'Inventory membuka tab Efek/Aura yang menggunakan halaman shop');
});

test('Service Worker version dan preload manifest mencakup semua berkas Aura baru', () => {
  const preload = JSON.parse(rd('assets/preload-manifest.json'));
  AuraCat.keys.concat(['index']).forEach(k => {
    const file = 'data/inventory/aura/' + (k === 'index' ? '' : k + '/') + (k === 'index' ? 'index.js' : 'manifest.js');
    assert.strictEqual(preload[file], fs.statSync(path.join(ROOT, file)).size, file);
  });
  assert.ok(/VERSION = 'ut-pwa-v193'/.test(rd('sw.js')));
});

test('PlayerData tetap mewajibkan ownership untuk equip dan menyimpan Aura di slot lama', () => {
  const { ctx, store } = boot(BASE_CHAIN, true), PD = ctx.PlayerData;
  assert.strictEqual(PD.equip('aura.flame').reason, 'belum-dimiliki');
  PD.coins();
  const state = JSON.parse(store[PD.key]);
  state.inventory['aura.flame'] = { qty: 1, acquiredAt: Date.now(), seq: state.nextSeq++ };
  store[PD.key] = JSON.stringify(state);
  assert.strictEqual(PD.equip('aura.flame').ok, true);
  assert.strictEqual(PD.equippedId('aura'), 'aura.flame');
  assert.strictEqual(PD.appearance().equipped.aura, 'aura.flame');
});

console.log('PASS ' + passed + '/' + passed);
