/* Tes paritas Dice (Stage 5): manifest data/inventory/dice/* <-> ItemCatalog (baseline & runtime) <-> DiceKit <-> seed server <-> halaman.
   Jalankan: node tests/dice-registry-parity.test.js
   Lapisan aset dilaporkan TERPISAH: A. manifest valid  B. FORMAT path  C. file ada  D. pemuatan di browser = TIDAK diuji di sini (NOT TESTED). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8'), ex = p => fs.existsSync(path.join(ROOT, p));
const IR = require(path.join(ROOT, 'assets/js/core/item-registry.js'));
const DiceCat = require(path.join(ROOT, 'data/inventory/dice/index.js'));
const PetCat = require(path.join(ROOT, 'data/inventory/pet/index.js'));
const FrameCat = require(path.join(ROOT, 'data/inventory/frame/index.js'));
const base = JSON.parse(rd('tests/fixtures/item-catalog-baseline.json'));
const clone = o => JSON.parse(JSON.stringify(o));
const srcs = h => (h.match(/<script[^>]+src="([^"]+)"/g) || []).map(x => /src="([^"]+)"/.exec(x)[1]);
const tests = []; const t = (name, fn) => tests.push([name, fn]);

const bd = base.items.filter(i => i.kind === 'dice');
const reg = IR.create(), res = DiceCat.register(reg), items = reg.getCategory('dice').items, byId = {}; items.forEach(i => { byId[i.id] = i; });

function boot(chains) {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  chains.concat(['assets/js/core/session.js', 'assets/js/item-catalog.js']).forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  return ctx;
}
const DICE_CHAIN = ['assets/js/core/item-registry.js'].concat(DiceCat.keys.map(k => 'data/inventory/dice/' + k + '/manifest.js'), ['data/inventory/dice/index.js']);
const DICEKIT_FILES = ['DiceAnimation.js', 'DiceCatalog.js', 'DiceEffects.js', 'DiceEffectsCore.js', 'DiceMaterials.js', 'DicePhysics.js', 'DiceRenderer.js', 'DiceTextures.js', 'index.js', 'RoomEnvironment.js', 'RoundedBoxGeometry.js']
  .map(name => 'assets/js/renderers/dice-kit/' + name);
const PET_CHAIN = PetCat.keys.map(k => 'data/inventory/pet/' + k + '/manifest.js').concat(['data/inventory/pet/index.js']);
const FRAME_CHAIN = FrameCat.keys.map(k => 'data/inventory/frame/' + k + '/manifest.js').concat(['data/inventory/frame/index.js']);
const legacy = boot([]), viaDice = boot(DICE_CHAIN), viaAll = boot(DICE_CHAIN.concat(PET_CHAIN, FRAME_CHAIN));

/* ---- A. Registry ---- */
t('Registry: 23 Dice terdaftar, 0 ditolak, kategori dice tersedia', () => {
  assert.deepStrictEqual(res.rejected, []); assert.strictEqual(res.ok, true); assert.strictEqual(res.registered, 23); assert.strictEqual(items.length, 23);
  assert.strictEqual(reg.rejected().length, 0); assert.deepStrictEqual(reg.categories(), ['dice']); assert.strictEqual(reg.getCategory('dice').kind, 'dice');
});
t('Registry: tanpa ID duplikat; registrasi ulang identik ditolak (duplicate-registration), ID sama isi beda ditolak (duplicate-id)', () => {
  assert.strictEqual(new Set(items.map(i => i.id)).size, 23);
  const m = require(path.join(ROOT, 'data/inventory/dice/dragon/manifest.js'));
  assert.strictEqual(reg.registerItem(m).reason, 'duplicate-registration');
  assert.strictEqual(reg.registerItem(Object.assign({}, m, { name: 'Lain' })).reason, 'duplicate-id');
  assert.strictEqual(reg.getCategory('dice').count, 23);
});
t('Registry: fallback = dice.klasik (dadu bawaan/starter); getItem ketat; kelengkapan vs baseline', () => {
  assert.strictEqual(DiceCat.category.fallbackId, 'dice.klasik'); assert.strictEqual(reg.getItemOrFallback('dice.tidak-ada').id, 'dice.klasik');
  assert.strictEqual(reg.getItem('dice.tidak-ada'), null); assert.strictEqual(reg.getItem('dice.dragon').id, 'dice.dragon');
  const c = reg.checkCompleteness('dice', bd.map(i => i.id)); assert.deepStrictEqual(c.missing, []); assert.deepStrictEqual(c.extra, []); assert.deepStrictEqual(c.incomplete, []);
});
t('Registry: urutan manifest = urutan ItemCatalog; KEYS = gameKey; nilai dibekukan', () => {
  assert.deepStrictEqual(items.map(i => i.id), bd.map(i => i.id)); assert.deepStrictEqual(DiceCat.keys, bd.map(i => i.gameKey));
  const it = reg.getItem('dice.emas'); assert.ok(Object.isFrozen(it) && Object.isFrozen(it.visual) && Object.isFrozen(it.legacyIds));
});
t('Folder: satu item = satu folder (nama folder = gameKey); tidak ada folder/manifest liar', () => {
  const dirs = fs.readdirSync(path.join(ROOT, 'data/inventory/dice')).filter(n => fs.statSync(path.join(ROOT, 'data/inventory/dice', n)).isDirectory()).sort();
  assert.deepStrictEqual(dirs, DiceCat.keys.slice().sort());
  DiceCat.keys.forEach(k => assert.ok(ex('data/inventory/dice/' + k + '/manifest.js'), k));
});

/* ---- Metadata parity (manifest vs baseline = nilai runtime SEBELUM integrasi) ---- */
t('Metadata: jumlah 23 dan ID sama dengan baseline; ID lama/legacyIds dipertahankan (standard, emas)', () => {
  assert.strictEqual(bd.length, 23); assert.deepStrictEqual(items.map(i => i.id).sort(), bd.map(i => i.id).sort());
  assert.deepStrictEqual(clone(byId['dice.klasik'].legacyIds), ['standard']); assert.deepStrictEqual(clone(byId['dice.emas'].legacyIds), ['emas']);
  assert.strictEqual(items.filter(i => i.legacyIds).length, bd.filter(i => i.legacyIds).length);
});
t('Metadata: id, kind, gameKey, nama, rarity, tier, collection, materialName, harga, gems, starter, featured, desc = baseline (23/23)', () => {
  bd.forEach(b => { const m = byId[b.id]; assert.ok(m, b.id);
    ['id', 'kind', 'gameKey', 'name', 'rarity', 'tier', 'collection', 'materialName', 'price', 'gems', 'starter', 'desc'].forEach(k => assert.strictEqual(m[k], b[k], b.id + '.' + k));
    assert.strictEqual(!!m.featured, !!b.featured, b.id + '.featured'); });
});
t('Metadata visual (art bg/accent/pip/edge) = baseline (23/23)', () => {
  bd.forEach(b => assert.deepStrictEqual(clone(byId[b.id].visual), b.art, b.id));
});
t('Harga: tepat satu mata uang per Dice yang dijual; koin T1-T4, emerald T5-T7; hanya klasik starter gratis', () => {
  items.forEach(i => { if (i.starter) { assert.strictEqual(i.id, 'dice.klasik'); assert.strictEqual(i.price, 0); assert.strictEqual(i.gems, null); }
    else assert.ok((i.price > 0) !== (i.gems > 0), i.id + ' harus tepat satu mata uang'); });
  const coin = items.filter(i => i.price > 0).map(i => i.price), gem = items.filter(i => i.gems > 0).map(i => i.gems);
  assert.deepStrictEqual([...new Set(coin)].sort((a, b) => a - b), [500, 1500, 9000, 30000]); assert.deepStrictEqual([...new Set(gem)].sort((a, b) => a - b), [600, 1500, 3000]);
});

/* ---- ItemCatalog ---- */
t('ItemCatalog: jalur Registry aktif untuk Dice (diceSource) dan cadangan bila tidak dimuat', () => {
  assert.strictEqual(viaDice.ItemCatalog.diceSource(), 'registry'); assert.strictEqual(legacy.ItemCatalog.diceSource(), 'legacy'); assert.strictEqual(viaAll.ItemCatalog.diceSource(), 'registry');
  assert.strictEqual(viaDice.ItemCatalog.petSource(), 'legacy'); assert.strictEqual(viaAll.ItemCatalog.petSource(), 'registry'); assert.strictEqual(viaAll.ItemCatalog.frameSource(), 'registry');
});
t('ItemCatalog: 147 item, urutan ID sama, tanpa ID ganda, DEEP-EQUAL ke baseline pada jalur cadangan, Dice-Registry, dan semua Registry', () => {
  [legacy, viaDice, viaAll].forEach(c => { const IC = c.ItemCatalog; assert.strictEqual(IC.items.length, 147);
    assert.deepStrictEqual(clone(IC.items), base.items);
    assert.strictEqual(new Set(IC.items.map(i => i.id)).size, 147); });
});
t('ItemCatalog: API publik sama (tipe & kunci) dengan baseline; sumber Registry baru tersedia', () => {
  const a = Object.keys(legacy.ItemCatalog).sort(), b = Object.keys(viaDice.ItemCatalog).sort(); assert.deepStrictEqual(a, b);
  base.api.forEach(k => { if (typeof k === 'string') assert.ok(k in viaDice.ItemCatalog, k); });
  ['diceSource', 'powerSource'].forEach(k => assert.ok(typeof viaDice.ItemCatalog[k] === 'function', k));
  const IC = viaDice.ItemCatalog; bd.forEach(b => { assert.strictEqual(IC.byId(b.id).gameKey, b.gameKey); assert.strictEqual(IC.byGameKey('dice', b.gameKey).id, b.id); });
  assert.strictEqual(IC.byId('dice.tidak-ada'), null);
});
t('ItemCatalog: sumber = manifest (mutasi manifest pada VM bersih mengubah katalog)', () => {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  DICE_CHAIN.forEach(f => { let s = rd(f); if (f.endsWith('dragon/manifest.js')) s = s.replace('gems: 3000', 'gems: 3001'); vm.runInContext(s, ctx, { filename: f }); });
  ['assets/js/core/session.js', 'assets/js/item-catalog.js'].forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  assert.strictEqual(ctx.ItemCatalog.byId('dice.dragon').gems, 3001); assert.strictEqual(ctx.ItemCatalog.diceSource(), 'registry');
});
t('ItemCatalog: manifest Dice yang tidak cocok (hilang satu) -> jalur cadangan, katalog tetap utuh', () => {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console: { error() {}, log() {}, warn() {} }, Date, JSON, Math }));
  DICE_CHAIN.filter(f => !f.endsWith('/tnt/manifest.js')).forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  ['assets/js/core/session.js', 'assets/js/item-catalog.js'].forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  assert.strictEqual(ctx.ItemCatalog.diceSource(), 'legacy'); assert.strictEqual(ctx.ItemCatalog.items.length, 147); assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
});

/* ---- Equip / Shop / Inventory / Gameplay (integrasi lintas sistem) ---- */
t('Equip: slot dice terpasang selalu valid — DEFAULT dice.klasik ada di Registry & starter; semua Dice kind dice, slot dice, kategori aksesori', () => {
  const IC = viaDice.ItemCatalog; assert.strictEqual(IC.defaultEquipped.dice, 'dice.klasik'); assert.strictEqual(DiceCat.category.fallbackId, IC.defaultEquipped.dice);
  assert.strictEqual(IC.byId('dice.klasik').starter, true);
  IC.items.filter(i => i.kind === 'dice').forEach(i => { assert.strictEqual(i.slot, 'dice'); assert.strictEqual(i.category, 'aksesori'); assert.ok(Object.isFrozen(i)); });
  assert.deepStrictEqual(clone(IC.items.filter(i => i.slot === 'dice').map(i => i.id)), bd.map(i => i.id));
});
t('Shop/Inventory: dadu.html membaca kind dice dari ItemCatalog (tanpa salinan data); shop.js/inventory.js tidak membaca metadata dice', () => {
  assert.ok(/IC\.items\.filter\(i=>i\.kind==='dice'/.test(rd('assets/js/pages/dadu.js')));
  ['assets/js/pages/shop.js', 'assets/js/pages/inventory.js'].forEach(f => { if (ex(f)) assert.ok(!/kind\s*===?\s*'dice'/.test(rd(f)), f); });
  const IC = viaDice.ItemCatalog; const shown = IC.items.filter(i => i.kind === 'dice' && !i.off); assert.strictEqual(shown.length, 23);
  shown.forEach(i => { const c = IC.cost(i); if (i.starter) assert.strictEqual(c, null); else assert.ok(c && ((c.coins > 0) !== (c.gems > 0)), i.id); });
});
t('Equip->Gameplay: tiap gameKey Dice ada di DiceKit (DiceCatalog.js) sehingga dadu terpasang = dadu yang dirender; urutan sama', () => {
  const ids = [...rd('assets/js/renderers/dice-kit/DiceCatalog.js').matchAll(/^\s{2}\{\s*\n\s{4}id: '([a-z0-9_]+)'/gm)].map(m => m[1]);
  assert.deepStrictEqual(ids, DiceCat.keys);
  assert.ok(/PD\.owns\('dice\.' \+ dice\)/.test(rd('assets/js/game-integration.js')) && /eqKey\('dice'\) \|\| 'klasik'/.test(rd('assets/js/game-integration.js')));
  assert.ok(/window\.ItemCatalog\.byId\(di\)/.test(rd('gameplay/js/main.js')) && /p\.diceKey=\(it&&it\.gameKey\)/.test(rd('gameplay/js/main.js')));
  assert.ok(/DiceKit\.has\(want\.key\) \? want\.key : 'klasik'/.test(rd('gameplay/js/dice-ui.js')));
});
t('Gameplay implementation tidak disentuh: gameplay/, PlayerData, API server, dan aset audio identik dengan HEAD', () => {
  const d = cp.execSync('git diff --name-only HEAD -- gameplay assets/js/player-data.js assets/js/game-integration.js assets/js/renderers/dice-kit supabase assets/sfx', { cwd: ROOT }).toString().trim();
  assert.strictEqual(d, '');
});

/* ---- Server / kepemilikan ---- */
t('Server: seed klien-server sinkron (gen-item-seed --check) dan harga/gems/starter Dice = blok seed migrasi phase3 + 23 id ada di migrasi dice_catalog', () => {
  const out = cp.execSync('node tools/wallet/gen-item-seed.js --check', { cwd: ROOT }).toString(); assert.ok(/sinkron/.test(out), out);
  const p3 = rd('supabase/migrations/202611280001_economy_phase3_gems.sql'), cat = rd('supabase/migrations/202611170001_dice_catalog.sql');
  items.forEach(i => { assert.ok(cat.indexOf("'" + i.id + "'") >= 0, 'dice_catalog migrasi: ' + i.id);
    if (i.starter) return;
    const m = new RegExp("\\('" + i.id.replace('.', '\\.') + "', (null|\\d+), (null|\\d+)\\)").exec(p3); assert.ok(m, 'phase3: ' + i.id);
    assert.strictEqual(m[1] === 'null' ? null : +m[1], i.price, i.id + ' koin'); assert.strictEqual(m[2] === 'null' ? null : +m[2], i.gems, i.id + ' gems'); });
});
t('Server/PlayerData: manifest tidak memuat kepemilikan/saldo/equip/transaksi; skema PlayerData & server tidak berubah', () => {
  const FORBIDDEN = /^(owned|owns|equipped|equip|balance|wallet|coins|purchase|transaction|inventory)$/i;
  items.forEach(i => Object.keys(i).forEach(k => assert.ok(!FORBIDDEN.test(k), i.id + ' field terlarang ' + k)));
  assert.ok(!/ItemRegistry|ItemCategories|data\/inventory\/dice/.test(rd('assets/js/player-data.js')));
  assert.strictEqual(cp.execSync('git diff --name-only HEAD -- supabase assets/js/player-data.js', { cwd: ROOT }).toString().trim(), '');
});

/* ---- Aset (lapisan dipisah) ---- */
t('Aset A: validateManifest lulus 23/23', () => { items.forEach(m => { const v = IR.validateManifest(m, reg.getCategory('dice')); assert.strictEqual(v.ok, true, m.id + ': ' + v.errors.join('; ')); }); });
t('Aset B: FORMAT path lulus 23/23 (assets per item kosong: dadu prosedural DiceKit) + path kategori renderKit valid', () => {
  items.forEach(m => { const v = IR.validateAssetPaths(m, reg.getCategory('dice')); assert.strictEqual(v.ok, true, m.id); assert.deepStrictEqual(clone(m.assets), {}); });
  assert.strictEqual(IR.validateAssetPaths({ assets: { x: DiceCat.category.assets.renderKit } }, null).ok, true);
});
t('Aset C: berkas rujukan benar-benar ada — renderKit (DiceCatalog.js) dan seluruh modul dice-kit yang dimuat dadu.html; sfx dice-roll.mp3 milik audio gameplay tetap ada', () => {
  assert.ok(ex(DiceCat.category.assets.renderKit) && fs.statSync(path.join(ROOT, DiceCat.category.assets.renderKit)).size > 1000);
  DICEKIT_FILES.forEach(f => assert.ok(ex(f), f));
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets/js/dice-kit')), 'legacy dice-kit directory must be removed');
  assert.ok(ex('assets/sfx/dice/dice-roll.mp3') && /roll:'dice\/dice-roll\.mp3'/.test(rd('gameplay/js/audio.js')));
  DICE_CHAIN.forEach(f => assert.ok(ex(f), f));
});

/* ---- Halaman ---- */
t('Halaman: dadu/room memuat rantai Dice berurutan (registry -> 23 manifest -> index -> item-catalog), tanpa skrip ganda, semua berkas ada', () => {
  ['dadu.html', 'room.html'].forEach(h => { const s = srcs(rd(h)); assert.strictEqual(new Set(s).size, s.length, h + ' skrip ganda');
    const iReg = s.indexOf('assets/js/core/item-registry.js'), iIdx = s.indexOf('data/inventory/dice/index.js'), iCat = s.indexOf('assets/js/item-catalog.js');
    assert.ok(iReg >= 0 && iReg < iIdx && iIdx < iCat, h);
    DiceCat.keys.forEach(k => { const i = s.indexOf('data/inventory/dice/' + k + '/manifest.js'); assert.ok(i > iReg && i < iIdx, h + ' ' + k); });
    s.filter(x => /^data\/inventory\/dice\/|^assets\/js\/item-(registry|catalog)\.js$/.test(x)).forEach(x => assert.ok(ex(x), h + ' 404: ' + x)); });   /* hanya berkas rantai Dice/Registry/Catalog (room.html punya 404 lama di luar lingkup: gameplay/particle-fx.js, lihat audit) */
});
t('Halaman lain tidak diubah: gameplay/shop/inventory/lobby/profile memakai jalur cadangan Dice (identik tes paritas); tidak memuat manifest Dice', () => {
  ['gameplay.html', 'lobby.html', 'shop.html', 'inventory.html', 'mode.html', 'profile.html', 'karakter.html', 'pet.html'].forEach(h => assert.ok(rd(h).indexOf('data/inventory/dice/') < 0, h));
});
t('Service worker: VERSION dinaikkan dan preload-manifest memuat semua aset Dice dengan ukuran benar', () => {
  assert.ok(/VERSION = 'ut-pwa-v186'/.test(rd('sw.js')));
  const pm = JSON.parse(rd('assets/preload-manifest.json')), want = DiceCat.keys.map(k => 'data/inventory/dice/' + k + '/manifest.js').concat(['data/inventory/dice/index.js']);
  assert.strictEqual(want.length, 24); want.forEach(f => assert.strictEqual(pm[f], fs.statSync(path.join(ROOT, f)).size, f));
  DICEKIT_FILES.forEach(f => assert.strictEqual(pm[f], fs.statSync(path.join(ROOT, f)).size, f));
  assert.ok(!Object.keys(pm).some(f => f.startsWith('assets/js/dice-kit/')), 'preload must not retain legacy DiceKit paths');
});

/* ---- DiceKit (modul ES) : paritas visual katalog <-> DiceKit ---- */
t('DiceKit: id/urutan DiceCatalog = manifest; warna bg/accent/pip & tier/collection/materialName selaras (nama emas dicatat: "Gold Dice" vs "Dadu Emas" — sudah ada sebelumnya, tidak diubah)', async () => {
  const { DICE_CATALOG, validateCatalog } = await import(pathToFileURL(path.join(ROOT, 'assets/js/renderers/dice-kit/DiceCatalog.js')).href);
  assert.deepStrictEqual(validateCatalog(), []); assert.deepStrictEqual(DICE_CATALOG.map(d => d.id), DiceCat.keys);
  DICE_CATALOG.forEach(d => { const m = byId['dice.' + d.id]; assert.strictEqual(m.visual.bg, d.material.base, d.id); assert.strictEqual(m.visual.pip, d.material.pip.color, d.id);
    if (m.visual.accent !== undefined) assert.strictEqual(m.visual.accent, d.material.accent, d.id);
    if (m.tier !== undefined) assert.strictEqual(m.tier, d.effect.effectTier, d.id + ' tier'); if (m.collection) assert.strictEqual(m.collection, d.collection, d.id);
    if (m.materialName) assert.strictEqual(m.materialName, d.materialName, d.id);
    if (d.id !== 'emas') assert.strictEqual(m.name.replace(/^Dadu /, ''), d.name.replace(/ Dice$/, ''), d.id); });
});

(async () => { let n = 0; for (const [name, fn] of tests) { await fn(); n++; console.log('ok - ' + name); } console.log('PASS ' + n + '/' + tests.length); })().catch(e => { console.error(e); process.exit(1); });
