require("./_boot-compat.js");
/* Tes Character Registry Stage 8.2: metadata paritas, kompatibilitas Skin, urutan script, dan model dasar. */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p)), clone = o => JSON.parse(JSON.stringify(o));
const IR = require(path.join(ROOT, 'src/core/item-registry.js'));
const CharacterCat = require(path.join(ROOT, 'data/inventory/character/index.js'));
const baseline = JSON.parse(rd('tests/fixtures/item-catalog-baseline.json'));
const BASE_CHAIN = ['src/core/item-registry.js']
  .concat(CharacterCat.keys.map(k => 'data/inventory/character/' + k + '/manifest.js'), ['data/inventory/character/index.js']);
const PAGES = ['karakter.html', 'lobby.html', 'profile.html', 'room.html', 'gameplay.html', 'mode.html', 'leaderboard.html', 'hadiah-misi.html'];
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
  chain.concat(['src/core/session.js', 'src/stores/item-catalog.js'])
    .forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  if (withPlayerData) vm.runInContext(rd('src/stores/player-data.js'), ctx, { filename: 'src/stores/player-data.js' });
  return { ctx, store };
}

const reg = IR.create(), result = CharacterCat.register(reg), manifests = reg.getCategory('skin').items;
const byKey = Object.fromEntries(manifests.map(m => [m.gameKey, m]));
const oldSkins = baseline.items.filter(i => i.kind === 'skin');
const legacy = boot([]), integrated = boot(BASE_CHAIN);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok - ' + name); };

test('Registry mendaftarkan tepat enam ID skin lama dengan kind, gameKey, dan fallback lama', () => {
  assert.strictEqual(result.ok, true); assert.deepStrictEqual(result.rejected, []);
  assert.strictEqual(result.registered, 6); assert.deepStrictEqual(reg.rejected(), []);
  assert.strictEqual(reg.getCategory('skin').label, 'Karakter');
  assert.strictEqual(reg.getCategory('skin').fallbackId, 'skin.steve');
  assert.deepStrictEqual(manifests.map(m => m.id), oldSkins.map(i => i.id));
  assert.deepStrictEqual(manifests.map(m => m.gameKey), CharacterCat.keys);
  assert.strictEqual(reg.getItemOrFallback('skin.unknown').id, 'skin.steve');
  assert.strictEqual(reg.getItem('character.steve'), null);
});

test('Manifest mempertahankan metadata ItemCatalog, harga, rarity, starter, dan featured', () => {
  assert.strictEqual(oldSkins.length, 6);
  oldSkins.forEach(item => {
    const m = byKey[item.gameKey];
    assert.ok(m, item.id);
    ['id', 'kind', 'gameKey', 'name', 'group', 'rarity', 'price', 'desc', 'starter'].forEach(k => {
      assert.strictEqual(m[k], item[k], item.id + '.' + k);
    });
    assert.strictEqual(m.gems, null, item.id + '.gems');
    assert.strictEqual(!!m.featured, !!item.featured, item.id + '.featured');
    assert.strictEqual(m.canonicalId, 'character.' + item.gameKey, item.id + '.canonicalId');
    assert.strictEqual(m.visual.renderer, 'palette', item.id + '.renderer');
    assert.strictEqual(m.visual.baseModelKey, item.gameKey, item.id + '.baseModelKey');
    assert.ok(!Object.keys(m).some(k => /^(owned|owns|inventory|equipped|balance|wallet|coins|transaction)$/i.test(k)), item.id);
  });
  assert.deepStrictEqual(CharacterCat.keys.filter(k => byKey[k].starter), ['steve', 'alex', 'creeper', 'zombie']);
  assert.strictEqual(CharacterCat.category.fallbackId, 'skin.steve');
  assert.strictEqual(byKey.ender.featured, true);
  assert.ok(oldSkins.every(i => !Object.prototype.hasOwnProperty.call(i, 'tier')), 'tier belum ada di sumber lama');
});

test('Semua referensi model dasar ada di CharacterData dan jalur aset valid', () => {
  const w = { UT: {} }; w.window = w;
  const ctx = vm.createContext({ window: w, UT: w.UT, console, Math, JSON });
  vm.runInContext(rd('data/inventory/character/_shared/js/character-data.js'), ctx, { filename: 'data/inventory/character/_shared/js/character-data.js' });
  manifests.forEach(m => {
    assert.deepStrictEqual(IR.validateManifest(m, CharacterCat.category), { ok: true, errors: [] }, m.id);
    assert.strictEqual(IR.validateAssetPaths(m, CharacterCat.category).ok, true, m.id);
    assert.ok(w.UT.CharacterData.get('player', m.visual.baseModelKey), m.id + '.baseModelKey');
    assert.ok(exists('data/inventory/character/' + m.gameKey + '/manifest.js'), m.id + '.manifest');
  });
  assert.strictEqual(IR.validateAssetPaths({ assets: CharacterCat.category.assets }, null).ok, true);
  assert.ok(exists(CharacterCat.category.assets.modelData));
});

test('ItemCatalog mengadopsi Registry tanpa mengubah item publik; fallback legacy dan API lama tetap tersedia', () => {
  assert.strictEqual(legacy.ctx.ItemCatalog.skinSource(), 'legacy');
  assert.strictEqual(integrated.ctx.ItemCatalog.skinSource(), 'registry');
  assert.deepStrictEqual(clone(legacy.ctx.ItemCatalog.items), baseline.items);
  assert.deepStrictEqual(clone(integrated.ctx.ItemCatalog.items), baseline.items);
  assert.deepStrictEqual(Object.keys(integrated.ctx.ItemCatalog).filter(k => baseline.api.indexOf(k) < 0).sort(),
    ['auraSource', 'diceSource', 'frameSource', 'petSource', 'powerSource', 'skinSource']);
  baseline.api.forEach(k => {
    assert.ok(k in integrated.ctx.ItemCatalog, k);
    assert.strictEqual(typeof integrated.ctx.ItemCatalog[k], typeof legacy.ctx.ItemCatalog[k], k);
  });
  assert.strictEqual(integrated.ctx.ItemCatalog.byId('skin.steve').gameKey, 'steve');
  assert.strictEqual(integrated.ctx.ItemCatalog.byGameKey('skin', 'ender').id, 'skin.ender');
  assert.strictEqual(integrated.ctx.ItemCatalog.byId('character.steve'), null);
  assert.strictEqual(integrated.ctx.ItemCatalog.fallbackSkinId(), 'skin.steve');
  assert.strictEqual(integrated.ctx.ItemCatalog.CATEGORIES.find(c => c.key === 'skin').label, 'Karakter');
  assert.strictEqual(integrated.ctx.ItemCatalog.KIND_META.skin.slot, 'skin');
});

test('ItemCatalog mengambil metadata Karakter dari manifest saat Registry lengkap', () => {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  BASE_CHAIN.forEach(f => {
    let source = rd(f);
    if (f.endsWith('/ender/manifest.js')) source = source.replace("name: 'Enderman'", "name: 'Manifest Enderman'").replace('price: 700', 'price: 701');
    vm.runInContext(source, ctx, { filename: f });
  });
  ['src/core/session.js', 'src/stores/item-catalog.js'].forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  assert.strictEqual(ctx.ItemCatalog.skinSource(), 'registry');
  assert.strictEqual(ctx.ItemCatalog.byId('skin.ender').name, 'Manifest Enderman');
  assert.strictEqual(ctx.ItemCatalog.byId('skin.ender').price, 701);
});

test('Manifest tidak lengkap memakai fallback penuh dan tidak mengubah kategori lain', () => {
  const partial = boot(BASE_CHAIN.filter(f => !f.endsWith('/creeper/manifest.js'))).ctx;
  assert.strictEqual(partial.ItemCatalog.skinSource(), 'legacy');
  assert.deepStrictEqual(clone(partial.ItemCatalog.items), baseline.items);
  assert.strictEqual(partial.ItemCatalog.auraSource(), 'legacy');
  assert.strictEqual(partial.ItemCatalog.defaultEquipped.skin, 'skin.steve');
  assert.strictEqual(partial.ItemCatalog.KIND_META.aura.slot, 'aura');
  assert.strictEqual(partial.ItemCatalog.KIND_META.gear.slot, null);
});

test('PlayerData tetap memakai equipped.skin; registrasi tidak mengubah ownership, Outfit, atau look.skin', () => {
  const a = boot([], true).ctx, b = boot(BASE_CHAIN, true).ctx;
  const look = { gender: 'm', skin: 's3', eyes: { id: 'round', dye: 'blue' }, hair: { id: 'short', dye: 'brown' }, body: { height: 1, build: 1 } };
  [a, b].forEach(ctx => assert.strictEqual(ctx.PlayerData.setLook(look).ok, true));
  const snapshot = ctx => ({
    skin: ctx.PlayerData.equippedId('skin'),
    ownsSteve: ctx.PlayerData.owns('skin.steve'),
    ownsCanonical: ctx.PlayerData.owns('character.steve'),
    look: ctx.PlayerData.look(),
    appearance: ctx.PlayerData.appearance(),
    outfits: ctx.PlayerData.outfits()
  });
  const before = snapshot(b), again = CharacterCat.register(IR.create());
  assert.strictEqual(again.ok, true);
  assert.deepStrictEqual(clone(snapshot(b)), clone(before));
  assert.deepStrictEqual(clone(snapshot(b)), clone(snapshot(a)));
  assert.strictEqual(b.PlayerData.equippedId('skin'), 'skin.steve');
  assert.strictEqual(b.PlayerData.look().skin, 's3');
  assert.strictEqual(b.PlayerData.owns('character.steve'), false);
  assert.ok(!/ItemRegistry|ItemCategories|data\/inventory\/character/.test(rd('src/stores/player-data.js')));
});

test('Halaman konsumen memuat Registry, enam manifest, index, lalu ItemCatalog tanpa duplikasi', () => {
  PAGES.forEach(file => {
    const scripts = srcs(rd(file)), cat = scripts.indexOf('src/stores/item-catalog.js');
    assert.strictEqual(new Set(scripts).size, scripts.length, file + ' tidak boleh memuat skrip ganda');
    const registry = scripts.indexOf('src/core/item-registry.js'), index = scripts.indexOf('data/inventory/character/index.js');
    assert.ok(registry >= 0 && registry < index && index < cat, file);
    CharacterCat.keys.forEach(k => {
      const i = scripts.indexOf('data/inventory/character/' + k + '/manifest.js');
      assert.ok(i > registry && i < index && i < cat, file + ' ' + k);
      assert.ok(exists(scripts[i]), file + ' missing ' + scripts[i]);
    });
    assert.ok(exists('data/inventory/character/index.js'));
  });
  assert.ok(srcs(rd('shop.html')).indexOf('data/inventory/character/index.js') < 0, 'unrelated pages retain the legacy fallback');
});

test('Service Worker cache version naik dan preload mencatat semua manifest dengan ukuran aktual', () => {
  const preload = JSON.parse(rd('assets/preload-manifest.json'));
  BASE_CHAIN.slice(1).forEach(file => assert.strictEqual(preload[file], fs.statSync(path.join(ROOT, file)).size, file));
  assert.ok(/^ut-pwa-v\d+$/.test((/VERSION = '([^']+)'/.exec(rd('sw.js')) || [])[1] || ''));
});

console.log('PASS ' + passed + '/' + passed);

