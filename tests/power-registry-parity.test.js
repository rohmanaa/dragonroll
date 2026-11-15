/* Tes paritas Power Stage 6: manifest <-> ItemCatalog baseline <-> renderer/FX/audio <-> server catalog.
   Pemuatan nyata di browser tidak diuji di sini. */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ex = p => fs.existsSync(path.join(ROOT, p)), clone = o => JSON.parse(JSON.stringify(o));
const IR = require(path.join(ROOT, 'assets/js/core/item-registry.js'));
const PowerCat = require(path.join(ROOT, 'data/inventory/power/index.js'));
const PetCat = require(path.join(ROOT, 'data/inventory/pet/index.js'));
const DiceCat = require(path.join(ROOT, 'data/inventory/dice/index.js'));
const FrameCat = require(path.join(ROOT, 'data/inventory/frame/index.js'));
const base = JSON.parse(rd('tests/fixtures/item-catalog-baseline.json'));
const baseline = base.items.filter(i => i.kind === 'powerup');
const srcs = html => (html.match(/<script[^>]+src="([^"]+)"/g) || []).map(x => /src="([^"]+)"/.exec(x)[1]);
const POWER_CHAIN = ['assets/js/core/item-registry.js']
  .concat(PowerCat.keys.map(k => 'data/inventory/power/' + k + '/manifest.js'), ['data/inventory/power/index.js']);
const FRAME_CHAIN = FrameCat.keys.map(k => 'data/inventory/frame/' + k + '/manifest.js').concat(['data/inventory/frame/index.js']);
const PET_CHAIN = PetCat.keys.map(k => 'data/inventory/pet/' + k + '/manifest.js').concat(['data/inventory/pet/index.js']);
const DICE_CHAIN = DiceCat.keys.map(k => 'data/inventory/dice/' + k + '/manifest.js').concat(['data/inventory/dice/index.js']);
const cloneManifest = key => clone(require(path.join(ROOT, 'data/inventory/power', key, 'manifest.js')));

function boot(chains, playerData) {
  const store = {};
  const localStorage = {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i] || null
  };
  const w = { addEventListener() {}, localStorage };
  w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math, localStorage }));
  chains.concat(['assets/js/core/session.js', 'assets/js/item-catalog.js']).forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  if (playerData) vm.runInContext(rd('assets/js/player-data.js'), ctx, { filename: 'assets/js/player-data.js' });
  return ctx;
}

const reg = IR.create(), result = PowerCat.register(reg);
const manifests = reg.getCategory('powerup').items;
const byGameKey = Object.fromEntries(manifests.map(m => [m.gameKey, m]));
const legacy = boot([]), viaPower = boot(POWER_CHAIN);
const viaAll = boot(POWER_CHAIN.concat(FRAME_CHAIN, PET_CHAIN, DICE_CHAIN));
const tests = [], t = (name, fn) => tests.push([name, fn]);

t('Registry: 17 Power terdaftar sesuai urutan katalog; ID prefiks Registry tidak mengubah gameKey lama', () => {
  assert.strictEqual(result.ok, true); assert.deepStrictEqual(result.rejected, []);
  assert.strictEqual(result.registered, 17); assert.strictEqual(reg.rejected().length, 0);
  assert.deepStrictEqual(PowerCat.keys, baseline.map(i => i.gameKey));
  assert.deepStrictEqual(manifests.map(i => i.id), baseline.map(i => 'powerup.' + i.gameKey));
  assert.strictEqual(new Set(manifests.map(i => i.id)).size, 17);
  manifests.forEach(m => assert.strictEqual(m.gameKey, m.id.slice('powerup.'.length), m.id));
});
t('Manifest: semua metadata Power sama persis dengan baseline (nama, rarity, harga/mata uang, maps, takedown)', () => {
  baseline.forEach(b => {
    const m = byGameKey[b.gameKey];
    assert.ok(m, b.id);
    ['kind', 'gameKey', 'name', 'rarity', 'price', 'gems', 'starter', 'stackable', 'desc'].forEach(k => assert.strictEqual(m[k], b[k], b.id + '.' + k));
    assert.strictEqual(m.id, 'powerup.' + b.gameKey);
    assert.strictEqual(m.assets.icon, b.icon, b.id + '.icon');
    assert.strictEqual(!!m.off, !!b.off, b.id + '.off');
    assert.strictEqual(m.offNote, b.offNote, b.id + '.offNote');
    assert.deepStrictEqual(clone(m.maps || null), clone(b.maps || null), b.id + '.maps');
    assert.strictEqual(m.visual.effect2d, b.gameKey, b.id + '.effect2d');
  });
  assert.strictEqual(manifests.filter(m => m.off).map(m => m.gameKey).sort().join(','), 'netherite_sword,sword');
});
t('ItemCatalog: jalur Registry/legacy/gabungan identik dengan baseline dan API lama tetap tersedia', () => {
  [legacy, viaPower, viaAll].forEach(ctx => {
    assert.strictEqual(ctx.ItemCatalog.items.length, 147);
    assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
    assert.strictEqual(ctx.ItemCatalog.powerSource(), ctx === legacy ? 'legacy' : 'registry');
    base.api.forEach(k => { if (typeof k === 'string') assert.ok(k in ctx.ItemCatalog, k); });
  });
  assert.strictEqual(viaPower.ItemCatalog.byId('sword').gameKey, 'sword');
  assert.strictEqual(viaPower.ItemCatalog.byId('powerup.sword'), null);
  assert.strictEqual(viaPower.ItemCatalog.powerOnMap('fire_charge', 'nether'), true);
  assert.strictEqual(viaPower.ItemCatalog.powerOnMap('fire_charge', 'minecraft'), false);
  assert.strictEqual(viaPower.ItemCatalog.byId('sword').slot, null);
});
t('Fallback: manifest kosong atau tidak lengkap mempertahankan seluruh katalog legacy', () => {
  const empty = boot(['assets/js/core/item-registry.js', 'data/inventory/power/index.js']);
  const one = boot(['assets/js/core/item-registry.js', 'data/inventory/power/sword/manifest.js', 'data/inventory/power/index.js']);
  [empty, one].forEach(ctx => {
    assert.strictEqual(ctx.ItemCatalog.powerSource(), 'legacy');
    assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
  });
});
t('Folder dan ikon: tepat 17 manifest unik, format path valid, PNG icon ada dan berisi', () => {
  const dirs = fs.readdirSync(path.join(ROOT, 'data/inventory/power'))
    .filter(n => fs.statSync(path.join(ROOT, 'data/inventory/power', n)).isDirectory()).sort();
  assert.deepStrictEqual(dirs, PowerCat.keys.slice().sort());
  assert.strictEqual(new Set(manifests.map(m => m.assets.icon)).size, 17);
  manifests.forEach(m => {
    assert.deepStrictEqual(IR.validateManifest(m, PowerCat.category), { ok: true, errors: [] }, m.id);
    assert.strictEqual(IR.validateAssetPaths(m, PowerCat.category).ok, true, m.id);
    assert.ok(ex('data/inventory/power/' + m.gameKey + '/manifest.js'), m.id);
    const data = fs.readFileSync(path.join(ROOT, m.assets.icon));
    assert.ok(data.length > 1000, m.assets.icon);
    assert.strictEqual(data.slice(1, 4).toString(), 'PNG', m.assets.icon);
  });
  assert.strictEqual(IR.validateAssetPaths({ assets: PowerCat.category.assets }, null).ok, true);
  Object.keys(PowerCat.category.assets).forEach(k => assert.ok(ex(PowerCat.category.assets[k]), k + ': ' + PowerCat.category.assets[k]));
});
t('Shop/Inventory/Room/Gameplay/Power-up: rantai Registry selesai sebelum ItemCatalog; tidak ada script duplikat', () => {
  ['shop.html', 'inventory.html', 'room.html', 'gameplay.html', 'powerup.html'].forEach(file => {
    const scripts = srcs(rd(file)), cat = scripts.indexOf('assets/js/item-catalog.js');
    assert.strictEqual(new Set(scripts).size, scripts.length, file + ' script ganda');
    assert.ok(scripts.indexOf('assets/js/core/item-registry.js') >= 0, file + ' Registry');
    assert.ok(scripts.indexOf('data/inventory/power/index.js') < cat, file + ' power index');
    PowerCat.keys.forEach(k => {
      const i = scripts.indexOf('data/inventory/power/' + k + '/manifest.js');
      assert.ok(i >= 0 && i < scripts.indexOf('data/inventory/power/index.js'), file + ' ' + k);
    });
  });
  ['powerup.html', 'room.html'].forEach(file => {
    const html = rd(file);
    assert.ok(html.includes('gameplay/css/particle-fx.css'), file + ' particle CSS');
    assert.ok(html.includes('gameplay/js/particle-fx.js'), file + ' particle engine');
  });
  assert.ok(ex('gameplay/css/particle-fx.css'));
  assert.ok(ex('gameplay/js/particle-fx.js'));
});
t('Model, animasi, aura, FX, dan audio: manifest merujuk entri sistem bersama yang benar-benar tersedia', async () => {
  const [{ POWER_ITEMS }, { PowerSound }, powerRegistry] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, 'assets/js/renderers/power3d/PowerCatalog.js')).href),
    import(pathToFileURL(path.join(ROOT, 'assets/js/renderers/power3d/PowerSound.js')).href),
    import(pathToFileURL(path.join(ROOT, 'assets/js/renderers/power3d/PowerRegistry.js')).href)
  ]);
  const modelById = Object.fromEntries(POWER_ITEMS.map(m => [m.id, m]));
  const expectedMap = {};
  manifests.forEach(m => {
    const model = modelById[m.visual.modelKey];
    assert.ok(model, m.gameKey + ' model 3D');
    assert.ok(model.idle && model.aura && model.particles, m.gameKey + ' animasi/aura/partikel');
    assert.ok(PowerSound.has(m.visual.modelKey), m.gameKey + ' audio');
    expectedMap[m.gameKey] = m.visual.modelKey;
  });
  assert.deepStrictEqual({ ...powerRegistry.KEY_TO_POWER3D }, expectedMap);

  const previousWindow = global.window;
  try {
    global.window = { UT: { ItemRegistry: { shared: () => reg } } };
    manifests.forEach(m => assert.strictEqual(powerRegistry.power3dKey(m.gameKey), m.visual.modelKey, m.gameKey));
    const changed = IR.create();
    changed.registerCategory(PowerCat.category);
    PowerCat.keys.forEach(k => {
      const m = cloneManifest(k);
      if (k === 'sword') m.visual.modelKey = 'feather';
      assert.strictEqual(changed.registerItem(m).ok, true);
    });
    global.window.UT.ItemRegistry.shared = () => changed;
    assert.strictEqual(powerRegistry.power3dKey('sword'), 'feather');
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
});
t('Audio gameplay: file yang dirujuk tersedia; file Power opsional memakai fallback yang sudah ada', () => {
  const audio = rd('gameplay/js/audio.js');
  const fileBlock = /const FILE=\{([\s\S]*?)\};/.exec(audio)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const filePaths = {};
  for (const m of fileBlock.matchAll(/([A-Za-z]\w*)\s*:\s*(NS\s*\+\s*)?'([^']+)'/g)) {
    filePaths[m[1]] = m[2] ? path.join('assets', 'new sound', m[3]) : path.join('assets', 'sfx', m[3]);
  }
  const mappedKeys = new Set(['swordUse']);
  ['POWER_SND', 'POWER_TRIG'].forEach(name => {
    const block = new RegExp('const ' + name + '=\\{([\\s\\S]*?)\\};').exec(audio)[1];
    for (const m of block.matchAll(/:\s*\{f:'([^']+)'/g)) mappedKeys.add(m[1]);
  });
  mappedKeys.forEach(k => assert.ok(filePaths[k] && ex(filePaths[k]), k + ' audio file'));

  const optional = /const POWER_OPT=\{([\s\S]*?)\};/.exec(audio)[1];
  assert.ok(/a\.play\(\)\.catch\(function\(\)\{\s*powerBase\(k\);\s*\}\)/.test(audio), 'missing optional sound playback falls back');
  assert.ok(/catch\(e\)\{\s*return powerBase\(k\);\s*\}/.test(audio), 'optional sound load error falls back');
  for (const m of optional.matchAll(/([A-Za-z_]\w*)\s*:\s*'([^']+)'/g)) {
    const file = path.join('assets', 'sfx', m[2]);
    assert.ok(ex(file) || /powerBase\(k\)/.test(audio), m[1] + ' missing optional sound must fall back');
  }
});
t('PowerFX: efek 2D membaca effect2d Registry; alias efek guard/totem lama tetap tersedia', () => {
  const fxReg = IR.create();
  fxReg.registerCategory(PowerCat.category);
  PowerCat.keys.forEach(k => {
    const m = cloneManifest(k);
    if (k === 'feather') m.visual.effect2d = 'tnt';
    assert.strictEqual(fxReg.registerItem(m).ok, true);
  });
  const calls = [];
  const w = { UT: {
    ItemRegistry: { shared: () => fxReg },
    ParticleFX: {
      configure(o) { return o || { maxParticles: 60 }; },
      burstAt(x, y, options) { calls.push({ x, y, options }); return 1; }
    }
  } };
  new Function('window', rd('data/power/power-fx.js'))(w);
  assert.strictEqual(w.UT.PowerFX.has('feather'), true);
  assert.strictEqual(w.UT.PowerFX.has('shield_block'), true);
  assert.strictEqual(w.UT.PowerFX.has('totem_block'), true);
  assert.strictEqual(w.UT.PowerFX.keyFor('feather'), 'tnt');
  assert.ok(w.UT.PowerFX.play('feather', 12, 34) > 0);
  assert.strictEqual(calls[0].options.count, w.UT.PowerFX.DATA.tnt.layers[0].count);
});
t('PlayerData dan server: Power tetap consumable non-equip; RPC use/buy dan harga Coin server sama', () => {
  const login = { 'ut-auth': JSON.stringify({ id: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb', username: 'tester' }) };
  const ctx = boot(POWER_CHAIN, true);
  ctx.localStorage.setItem('ut-auth', login['ut-auth']);
  assert.strictEqual(ctx.PlayerData.applyServerWallet({ inventory: [{ id: 'feather', qty: 3 }] }).ok, true);
  assert.strictEqual(ctx.PlayerData.qty('feather'), 3);
  assert.strictEqual(ctx.PlayerData.equip('feather').reason, 'bukan-equipment');
  assert.strictEqual(ctx.ItemCatalog.byId('feather').slot, null);

  const sql = rd('supabase/migrations/202611230001_powerup_stock.sql');
  const values = /from \(values([\s\S]*?)\) as v\(id, p\)/.exec(sql);
  assert.ok(values, 'harga Power di migrasi server');
  const prices = Object.fromEntries(Array.from(values[1].matchAll(/\('([a-z0-9_]+)',\s*(\d+)\)/g), m => [m[1], Number(m[2])]));
  manifests.forEach(m => {
    assert.strictEqual(prices[m.gameKey], m.price, m.gameKey + ' harga server Coin');
    assert.strictEqual(m.gems, null, m.gameKey + ' tidak memakai Emerald');
  });
  const wallet = rd('assets/js/services/wallet-service.js');
  assert.ok(/rpc\('buy_powerup'/.test(wallet) && /rpc\('use_powerup'/.test(wallet));
  assert.ok(/p_item_id: String\(itemId \|\| ''\)/.test(wallet));
});
t('Service worker preload: seluruh manifest Power tersedia dengan ukuran aktual dan cache version naik', () => {
  const preload = JSON.parse(rd('assets/preload-manifest.json'));
  PowerCat.keys.concat(['index']).forEach(k => {
    const file = 'data/inventory/power/' + (k === 'index' ? '' : k + '/') + (k === 'index' ? 'index.js' : 'manifest.js');
    assert.strictEqual(preload[file], fs.statSync(path.join(ROOT, file)).size, file);
  });
  assert.ok(/VERSION = 'ut-pwa-v196'/.test(rd('sw.js')));
});

(async () => {
  for (const [name, fn] of tests) { await fn(); console.log('ok - ' + name); }
  console.log('PASS ' + tests.length + '/' + tests.length);
})().catch(e => { console.error(e); process.exit(1); });
