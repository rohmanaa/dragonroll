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
const PET_CHAIN = PetCat.keys.map(k => 'data/inventory/pet/items/' + k + '/manifest.js').concat(['data/inventory/pet/index.js']);
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
    .filter(n => n !== '_shared' && fs.statSync(path.join(ROOT, 'data/inventory/power', n)).isDirectory()).sort();
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
t('Shop/Room/Gameplay/Power-up: rantai Registry selesai sebelum ItemCatalog; tidak ada script duplikat', () => {
  ['shop.html', 'room.html', 'gameplay.html', 'powerup.html'].forEach(file => {
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
    import(pathToFileURL(path.join(ROOT, 'assets/js/renderers/power-3d/power-catalog.js')).href),
    import(pathToFileURL(path.join(ROOT, 'assets/js/renderers/power-3d/power-sound.js')).href),
    import(pathToFileURL(path.join(ROOT, 'assets/js/renderers/power-3d/power-registry.js')).href)
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
t('Audio gameplay: file Power valid, setiap Power punya suara unik dan variasi pitch', () => {
  const audio = rd('gameplay/js/audio.js');
  const fileBlock = /const FILE=\{([\s\S]*?)\};/.exec(audio)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const filePaths = {};
  for (const m of fileBlock.matchAll(/([A-Za-z]\w*)\s*:\s*(NS\s*\+\s*)?'([^']+)'/g)) {
    filePaths[m[1]] = path.join('assets', 'audio', 'sfx', m[3]);
  }
  const powerFiles = /const POWER_FILES=\{([\s\S]*?)\};/.exec(audio)[1];
  for (const m of powerFiles.matchAll(/'([A-Za-z]\w*)'/g)) {
    assert.ok(filePaths[m[1]] && ex(filePaths[m[1]]), m[1] + ' Power SFX file');
  }
  assert.ok(/powerSynth\(k,'hit'\)/.test(audio), 'trigger must use the Power-specific hit');
  assert.ok(/if\(k==='tnt'\|\|k==='fire_charge'\|\|k==='blaze_core'\)\{[\s\S]*?if\(k==='fire_charge'&&powerFiles\(k,'activate'\)\) return null;[\s\S]*?return powerSynth\(k,'activate'\)/.test(audio), 'trap placement only plays Fire Charge ignition, never its impact');
  assert.ok(!audio.includes('creeper-explosion.mp3'), 'Power explosions must not reuse the Creeper explosion');
  const voicesSrc = rd('assets/js/renderers/power-3d/power-sound.js');
  const voiceBlock = /const VOICE = \{([\s\S]*?)\};/.exec(voicesSrc)[1];
  const voices = Object.fromEntries(Array.from(voiceBlock.matchAll(/([A-Za-z_]\w*):\s*'([^']+)'/g), m => [m[1], m[2]]));
  const assignedVoices = manifests.map(m => voices[m.visual.modelKey] || voices[m.gameKey]);
  assert.ok(assignedVoices.every(Boolean), 'every registered Power has a voice');
  assert.strictEqual(new Set(assignedVoices).size, manifests.length, 'every Power has a distinct voice');
  assert.ok(/0\.98 \+ Math\.random\(\) \* 0\.04/.test(voicesSrc), 'repeat-use pitch variation');
  assert.ok(/feather:\{activate:'featherWindMagic',action:'featherLongWhoosh',finish:'featherFinishWhoosh',pitch:1\.1,volume:0\.68\}/.test(audio), 'Feather SFX mix');
  assert.ok(/powerFile\(layers\.activate,rate,200/.test(audio) && /layers\.action,rate,500/.test(audio) && /layers\.finish,rate,300/.test(audio), 'Feather layer durations');
  assert.ok(/finish: \(\) => \{ tone\(1800, 0\.3,[\s\S]*?true\)/.test(voicesSrc), 'Feather finish sparkle reverb');
  assert.ok(/tnt:\{boom:'tntExplosionFx',deepBoom:'tntDeepExplosion',debris:'tntDebrisBreak',pitch:0\.9,volume:0\.85\}/.test(audio), 'TNT SFX mix');
  assert.ok(/layers\.boom,rate,800,fallback,level,\{bassDb:2,reverb:0\.18\}/.test(audio) && /layers\.deepBoom,rate,1300,fallback,level,\{bassDb:6,reverb:0\.35\}/.test(audio), 'TNT boom and bass layer tuning');
  assert.ok(/layers\.debris,rate,600,null,0\.72,\{bassDb:1,reverb:0\.2\}\);\s*\},1000\)/.test(audio), 'TNT debris finish timing');
  assert.ok(/shelf\.type='lowshelf'/.test(audio) && /comp\.ratio\.value=4/.test(audio), 'TNT bass processing stays compressed');
  ['debris-break.mp3', 'deep-explosion.mp3', 'diamond-sword-crystal-resonance.mp3', 'diamond-sword-crystal-unsheathe.mp3', 'diamond-sword-metal-impact.mp3', 'diamond-sword-slash-whoosh.mp3', 'epic-whoosh.mp3', 'explosion-fx.mp3', 'fire-charge-ignition.mp3', 'fire-charge-impact.mp3', 'fire-charge-magic.mp3', 'fire-charge-whoosh.mp3', 'golden-apple-activation.mp3', 'golden-apple-bite.mp3', 'golden-apple-finish.mp3', 'golden-apple-healing.mp3', 'ice-crystal-charge.mp3', 'ice-crystal-chime.mp3', 'ice-crystal-release.mp3', 'ice-crystal-shatter.mp3', 'long-whoosh.mp3', 'metal-whoosh-hit.mp3', 'potion-bubbling.mp3', 'potion-dark-magic.mp3', 'potion-drink.mp3', 'potion-even-drink.mp3', 'potion-even-healing-magic.mp3', 'potion-even-magic-chime.mp3', 'sword-slice.mp3', 'sword-unsheathing.mp3', 'totem-magic-spell.mp3', 'totem-mystical-chime.mp3', 'totem-shield-activation.mp3', 'wind-magic.mp3', 'wooden-shield-equip.mp3', 'wooden-shield-impact.mp3', 'wooden-shield-resonance.mp3'].forEach(file => {
    assert.ok(ex('assets/audio/sfx/powerup/' + file), file + ' SFX path');
  });
  assert.ok(/totem:\{activate:'totemChime',protection:'totemShield',finish:'totemSpell',pitch:0\.95,volume:0\.75\}/.test(audio), 'Totem SFX profile');
  assert.ok(/powerFile\(layers\.activate,rate,300/.test(audio) && /layers\.protection,rate,500[\s\S]*?\},300\)/.test(audio) && /layers\.finish,rate,500[\s\S]*?\},800\)/.test(audio), 'Totem phase durations');
  assert.ok(/if\(phase==='protection'\)[\s\S]*?layers\.protection/.test(audio), 'Totem block uses the protection layer');
  assert.ok(/diamond_sword:\{activate:'diamondSwordUnsheath',attack:'diamondSwordWhoosh',impact:'diamondSwordImpact',finish:'diamondSwordResonance',pitch:1\.05,volume:0\.85\}/.test(audio), 'Diamond Sword premium SFX profile');
  assert.ok(/layers\.activate,rate,300[\s\S]*?layers\.attack,rate,400[\s\S]*?layers\.impact,rate,500[\s\S]*?layers\.finish,rate,300/.test(audio), 'Diamond Sword four-layer timing');
  assert.ok(/reverb:0\.16,reverbWet:0\.18,resonanceDb:1\.5/.test(audio) && /powerSynth\(k,'swing',level\)/.test(audio), 'Diamond Sword crystal processing and distinct swing fallback');
  assert.ok(/diamond: \{[\s\S]*?swing: \(\) =>[\s\S]*?finish: \(\) =>/.test(voicesSrc) && /id === 'diamond_sword' \|\| id === 'golden_apple' \? 1\.05/.test(voicesSrc), 'Diamond Sword synthetic fallback uses matching pitch and stages');
  assert.ok(/wooden_shield:\{activate:'woodenShieldEquip',defense:'woodenShieldImpact',finish:'woodenShieldResonance',pitch:0\.95,volume:0\.8\}/.test(audio), 'Wooden Shield SFX profile');
  assert.ok(/if\(phase==='block'\)[\s\S]*?layers\.defense,rate,400[\s\S]*?layers\.finish,rate,300/.test(audio), 'Wooden Shield defense and finish occur on block');
  assert.ok(/power==='wooden_shield'&&powerFiles\(power,'block'\)/.test(audio) && /reverb:0\.06,reverbWet:0\.08,resonanceDb:2,resonanceHz:250/.test(audio), 'Wooden Shield uses dry wooden impact processing');
  assert.ok(/shield: \{[\s\S]*?finish: \(\) =>/.test(voicesSrc) && /id === 'wooden_shield' \? 0\.95/.test(voicesSrc), 'Wooden Shield has a matching protective fallback');
  assert.ok(/if\(k==='totem'\)\{[\s\S]*?\n    \}\n    if\(k==='diamond_sword'\)\{[\s\S]*?\n    \}\n    if\(k==='wooden_shield'\)\{[\s\S]*?\n    \}\n    if\(k==='golden_apple'\)\{[\s\S]*?\n    \}\n    if\(k==='fire_charge'\)\{[\s\S]*?\n    \}\n    if\(k==='ice_crystal'\)\{/.test(audio), 'each specialized Power audio handler must be reachable');
  assert.ok(/golden_apple:\{activate:'goldenAppleActivation',consume:'goldenAppleBite',healing:'goldenAppleHealing',finish:'goldenAppleFinish',pitch:1\.05,volume:0\.75\}/.test(audio), 'Golden Apple SFX profile');
  assert.ok(/layers\.activate,rate,300[\s\S]*?layers\.consume,rate,300[\s\S]*?\},300\)[\s\S]*?layers\.healing,rate,700[\s\S]*?\},600\)[\s\S]*?layers\.finish,rate,300[\s\S]*?\},1300\)/.test(audio), 'Golden Apple four-stage timing');
  assert.ok(/reverb:0\.14,reverbWet:0\.16,resonanceDb:1\.2/.test(audio) && /apple: \{[\s\S]*?consume: \(\) =>[\s\S]*?healing: \(\) =>[\s\S]*?finish: \(\) =>/.test(voicesSrc) && /ph === 'consume' && fam\.consume/.test(voicesSrc) && /ph === 'healing' && fam\.healing/.test(voicesSrc) && /id === 'diamond_sword' \|\| id === 'golden_apple' \? 1\.05/.test(voicesSrc), 'Golden Apple has matching reverb and phased synthetic fallback');
  assert.ok(/fire_charge:\{activate:'fireChargeIgnition',charge:'fireChargeMagic',launch:'fireChargeWhoosh',impact:'fireChargeImpact',pitch:1,volume:0\.85\}/.test(audio), 'Fire Charge SFX profile');
  assert.ok(/layers\.charge,rate,400[\s\S]*?powerSynth\(k,'embers',level\*0\.25\)[\s\S]*?layers\.launch,rate,400[\s\S]*?\},400\)[\s\S]*?layers\.impact,rate,500[\s\S]*?\},800\)[\s\S]*?\}else powerFile\(layers\.activate,rate,200/.test(audio), 'Fire Charge ignition-on-place and trigger sequence');
  assert.ok(/bassDb:-1,reverb:0\.22,reverbWet:0\.18/.test(audio) && /fire: \{[\s\S]*?charge: \(\) =>[\s\S]*?launch: \(\) =>[\s\S]*?embers: \(\) =>[\s\S]*?hit: \(\) =>/.test(voicesSrc) && /ph === 'charge' && fam\.charge/.test(voicesSrc) && /ph === 'launch' && fam\.launch/.test(voicesSrc) && /ph === 'embers' && fam\.embers/.test(voicesSrc), 'Fire Charge uses fast, ember-like effects with medium reverb and light bass');
  assert.ok(/ice_crystal:\{activate:'iceCrystalChime',charge:'iceCrystalCharge',release:'iceCrystalRelease',impact:'iceCrystalShatter',pitch:1\.1,volume:0\.78\}/.test(audio), 'Ice Crystal SFX profile');
  assert.ok(/layers\.activate,rate,300[\s\S]*?layers\.charge,rate,400[\s\S]*?\},300\)[\s\S]*?layers\.release,rate,400[\s\S]*?\},700\)[\s\S]*?layers\.impact,rate,600[\s\S]*?\},1100\)/.test(audio), 'Ice Crystal four-stage timing');
  assert.ok(/fallbackPlayed=false[\s\S]*?layers\.impact,rate,600,fallback,level,fx\)[\s\S]*?powerSynth\(k,'crack',level\*0\.25\)/.test(audio) && /bassDb:-1,reverb:0\.22,reverbWet:0\.2,resonanceDb:1\.5,resonanceHz:4000/.test(audio) && /ice: \{[\s\S]*?charge: \(\) =>[\s\S]*?release: \(\) =>[\s\S]*?crack: \(\) =>[\s\S]*?hit: \(\) =>/.test(voicesSrc) && /id === 'feather' \|\| id === 'potion_even' \|\| id === 'ice_crystal' \? 1\.1/.test(voicesSrc), 'Ice Crystal layers a bright crack over a restrained crystal shatter and has a phased fallback');
  assert.ok(/potion_odd:\{drink:'potionDrink',bubbling:'potionBubbling',effect:'potionDarkMagic',pitch:1,volume:0\.7\}/.test(audio), 'Potion SFX profile');
  assert.ok(/powerSynth\(k,'activate',level\);\s*setTimeout\(function\(\)\{[\s\S]*?layers\.drink,rate,400[\s\S]*?layers\.bubbling,rate,280[\s\S]*?\},200\)/.test(audio), 'Potion glass pop and drinking sequence');
  assert.ok(/layers\.effect,rate,600[\s\S]*?\},600\)/.test(audio), 'Potion shimmer duration');
  assert.ok(/ph === 'drink' && fam\.drink/.test(voicesSrc) && /finish: \(\) => \{ tone\(1250, 0\.6,[\s\S]*?true\)/.test(voicesSrc), 'Potion synthetic phase fallbacks');
  assert.ok(/potion_even:\{drink:'potionEvenDrink',effect:'potionEvenHealing',chime:'potionEvenChime',pitch:1\.1,volume:0\.7\}/.test(audio), 'Bright Potion Even SFX profile');
  assert.ok(/if\(k==='potion_even'\)[\s\S]*?layers\.chime,rate,600,fallback,0\.4/.test(audio), 'Potion Even bright chime layer');
  assert.ok(/potionEven: \{[\s\S]*?finish: \(\) => \{ \[880, 1100, 1320, 1760\]/.test(voicesSrc), 'Potion Even has an ascending fallback');
  assert.ok(/id === 'feather' \|\| id === 'potion_even' \|\| id === 'ice_crystal' \? 1\.1/.test(voicesSrc), 'high-pitch Power synthetic voices');
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
  ['golden-apple-activation.mp3', 'golden-apple-bite.mp3', 'golden-apple-healing.mp3', 'golden-apple-finish.mp3'].forEach(file => {
    const asset = 'assets/audio/sfx/powerup/' + file;
    assert.strictEqual(preload[asset], fs.statSync(path.join(ROOT, asset)).size, asset);
  });
  ['fire-charge-ignition.mp3', 'fire-charge-magic.mp3', 'fire-charge-whoosh.mp3', 'fire-charge-impact.mp3'].forEach(file => {
    const asset = 'assets/audio/sfx/powerup/' + file;
    assert.strictEqual(preload[asset], fs.statSync(path.join(ROOT, asset)).size, asset);
  });
  ['ice-crystal-chime.mp3', 'ice-crystal-charge.mp3', 'ice-crystal-release.mp3', 'ice-crystal-shatter.mp3'].forEach(file => {
    const asset = 'assets/audio/sfx/powerup/' + file;
    assert.strictEqual(preload[asset], fs.statSync(path.join(ROOT, asset)).size, asset);
  });
  PowerCat.keys.concat(['index']).forEach(k => {
    const file = 'data/inventory/power/' + (k === 'index' ? '' : k + '/') + (k === 'index' ? 'index.js' : 'manifest.js');
    assert.strictEqual(preload[file], fs.statSync(path.join(ROOT, file)).size, file);
  });
  assert.ok(/^ut-pwa-v\d+$/.test((/VERSION = '([^']+)'/.exec(rd('sw.js')) || [])[1] || ''));
});

(async () => {
  for (const [name, fn] of tests) { await fn(); console.log('ok - ' + name); }
  console.log('PASS ' + tests.length + '/' + tests.length);
})().catch(e => { console.error(e); process.exit(1); });
