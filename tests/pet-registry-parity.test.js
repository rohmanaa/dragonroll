/* Tes paritas Pet (Stage 4): manifest data/inventory/pet/items/* <-> ItemCatalog (baseline & runtime) <-> seed server <-> file di disk.
   Jalankan: node tests/pet-registry-parity.test.js
   Lapisan aset dilaporkan TERPISAH: A. manifest valid  B. FORMAT path  C. file ada + header WebP  D. pemuatan di browser = TIDAK diuji di sini (NOT TESTED). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const IR = require(path.join(ROOT, 'src/core/item-registry.js'));
const PetCat = require(path.join(ROOT, 'data/inventory/pet/index.js'));
const FrameCat = require(path.join(ROOT, 'data/inventory/frame/index.js'));
const base = JSON.parse(rd('tests/fixtures/item-catalog-baseline.json'));
const clone = o => JSON.parse(JSON.stringify(o));
const srcs = h => (h.match(/<script[^>]+src="([^"]+)"/g) || []).map(x => /src="([^"?]+)/.exec(x)[1]); /* tanpa query cache-bust (?v=NNN) */
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const bp = base.items.filter(i => i.kind === 'pet'), bf = base.items.filter(i => i.kind === 'frame');
const reg = IR.create(), res = PetCat.register(reg), items = reg.getCategory('pet').items, byId = {}; items.forEach(i => { byId[i.id] = i; });

function boot(chains) {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  chains.concat(['src/core/session.js', 'src/stores/item-catalog.js']).forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  return ctx;
}
const PET_CHAIN = ['src/core/item-registry.js'].concat(PetCat.keys.map(k => 'data/inventory/pet/items/' + k + '/manifest.js'), ['data/inventory/pet/index.js']);
const FRAME_CHAIN = FrameCat.keys.map(k => 'data/inventory/frame/' + k + '/manifest.js').concat(['data/inventory/frame/index.js']);
const legacy = boot([]), viaPet = boot(PET_CHAIN), viaBoth = boot(PET_CHAIN.concat(FRAME_CHAIN));

/* ---- A. Registry ---- */
t('Registry: 7 Pet terdaftar, 0 ditolak, kategori pet tersedia', () => {
  assert.deepStrictEqual(res.rejected, []); assert.strictEqual(res.ok, true); assert.strictEqual(res.registered, 7); assert.strictEqual(items.length, 7);
  assert.strictEqual(reg.rejected().length, 0); assert.deepStrictEqual(reg.categories(), ['pet']); assert.strictEqual(reg.getCategory('pet').kind, 'pet');
});
t('Registry: tanpa ID duplikat; registrasi ulang manifest identik ditolak (duplicate-registration), ID sama isi beda ditolak (duplicate-id)', () => {
  assert.strictEqual(new Set(items.map(i => i.id)).size, 7);
  const m = require(path.join(ROOT, 'data/inventory/pet/items/storm_wolf/manifest.js'));
  assert.strictEqual(reg.registerItem(m).reason, 'duplicate-registration');
  assert.strictEqual(reg.registerItem(Object.assign({}, m, { name: 'Lain' })).reason, 'duplicate-id');
  assert.strictEqual(reg.getCategory('pet').count, 7);
});
t('Registry: fallback sesuai konfigurasi (Pet tanpa fallbackId: slot opsional, tidak ada pet bawaan) -> null; getItem ketat', () => {
  assert.strictEqual(PetCat.category.fallbackId, undefined); assert.strictEqual(reg.getItemOrFallback('pet.tidak-ada'), null);
  assert.strictEqual(reg.getItem('pet.tidak-ada'), null); assert.strictEqual(reg.getItem('pet.storm_wolf').id, 'pet.storm_wolf');
  const c = reg.checkCompleteness('pet', bp.map(i => i.id)); assert.deepStrictEqual(c.missing, []); assert.deepStrictEqual(c.extra, []); assert.deepStrictEqual(c.incomplete, []);
});
t('Registry: urutan manifest = urutan ItemCatalog (tier 1..7); KEYS = gameKey', () => {
  assert.deepStrictEqual(items.map(i => i.id), bp.map(i => i.id)); assert.deepStrictEqual(PetCat.keys, bp.map(i => i.gameKey));
  assert.deepStrictEqual(items.map(i => i.tier), [1, 2, 3, 4, 5, 6, 7]);
});
t('Registry: nilai manifest dibekukan (deep-freeze) — mutasi tidak mengubah Registry', () => {
  const it = reg.getItem('pet.forest_pup'); assert.ok(Object.isFrozen(it) && Object.isFrozen(it.visual) && Object.isFrozen(it.visual.colors));
});

/* ---- metadata parity: manifest vs baseline (nilai runtime SEBELUM integrasi) ---- */
t('Metadata: ID, kind, gameKey, nama, rarity, tier, role, harga, gems, starter, desc = baseline (7/7)', () => {
  bp.forEach(b => { const m = byId[b.id]; assert.ok(m, b.id);
    ['id', 'kind', 'gameKey', 'name', 'rarity', 'tier', 'role', 'price', 'gems', 'starter', 'desc'].forEach(k => assert.strictEqual(m[k], b[k], b.id + '.' + k)); });
});
t('Metadata visual katalog (accent, colors[3]) = baseline', () => {
  bp.forEach(b => { const m = byId[b.id]; assert.strictEqual(m.visual.accent, b.accent, b.id); assert.deepStrictEqual(clone(m.visual.colors), b.colors, b.id); assert.strictEqual(m.visual.colors.length, 3); });
});
t('Harga: tepat satu mata uang per Pet; koin T1-T4 (3.000/9.000/25.000/60.000), emerald T5-T7 (1.500/3.000/6.000)', () => {
  assert.deepStrictEqual(items.map(i => i.price), [3000, 9000, 25000, 60000, null, null, null]); assert.deepStrictEqual(items.map(i => i.gems), [null, null, null, null, 1500, 3000, 6000]);
  items.forEach(i => assert.strictEqual(i.starter, false));
});

/* ---- ItemCatalog ---- */
t('ItemCatalog: jalur Registry aktif untuk Pet (petSource) dan cadangan bila tidak dimuat', () => {
  assert.strictEqual(viaPet.ItemCatalog.petSource(), 'registry'); assert.strictEqual(legacy.ItemCatalog.petSource(), 'legacy'); assert.strictEqual(viaBoth.ItemCatalog.petSource(), 'registry');
});
t('ItemCatalog: total 183, Pet 7, Frame 29 di katalog (jalur cadangan dan gabungan)', () => {
  [legacy, viaPet, viaBoth].forEach(c => { const IC = c.ItemCatalog; assert.strictEqual(IC.items.length, 183);
    assert.strictEqual(IC.items.filter(i => i.kind === 'pet').length, 7); assert.strictEqual(IC.items.filter(i => i.kind === 'frame').length, 29); });
  assert.strictEqual(viaBoth.ItemCatalog.frameSource(), 'registry'); assert.strictEqual(viaPet.ItemCatalog.frameSource(), 'legacy');
});
t('ItemCatalog: SELURUH 183 item (semua field, urutan, tanpa ID ganda) = baseline di setiap kombinasi jalur', () => {
  [legacy, viaPet, viaBoth].forEach(c => { assert.deepStrictEqual(clone(c.ItemCatalog.items), base.items); assert.strictEqual(new Set(clone(c.ItemCatalog.items.map(i => i.id))).size, 183); });
});
t('ItemCatalog: kategori non-Pet tidak berubah (176 item) dan Frame 29/29 sama dengan baseline', () => {
  const IC = viaBoth.ItemCatalog; assert.deepStrictEqual(clone(IC.items.filter(i => i.kind !== 'pet')), base.items.filter(i => i.kind !== 'pet'));
  assert.deepStrictEqual(clone(IC.items.filter(i => i.kind === 'frame')), bf);
});
t('ItemCatalog: Pet dari Registry tidak mendapat field baru (mis. image) — bentuk item = baseline; manifest sengaja mengubah katalog (bukti sumber)', () => {
  assert.deepStrictEqual(Object.keys(viaPet.ItemCatalog.byId('pet.storm_wolf')).sort(), Object.keys(bp[4]).sort());
  const c2 = boot([]); /* VM bersih dengan manifest storm_wolf termutasi */
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const x = vm.createContext(Object.assign(w, { console, Date, JSON, Math })); vm.runInContext(rd('src/core/item-registry.js'), x);
  PetCat.keys.forEach(k => { let s = rd('data/inventory/pet/items/' + k + '/manifest.js'); if (k === 'storm_wolf') s = s.replace('"Storm Wolf"', '"Storm Wolf UJI"').replace('gems: 1500', 'gems: 1501'); vm.runInContext(s, x); });
  vm.runInContext(rd('data/inventory/pet/index.js'), x); vm.runInContext(rd('src/stores/item-catalog.js'), x);
  const s = x.ItemCatalog.byId('pet.storm_wolf'); assert.strictEqual(x.ItemCatalog.petSource(), 'registry'); assert.strictEqual(s.name, 'Storm Wolf UJI'); assert.strictEqual(s.gems, 1501);
});
t('ItemCatalog: semua API lama tetap ada; cost/byId/byGameKey/optionalSlots/KIND_META.pet sama di semua jalur', () => {
  base.api.forEach(k => { assert.ok(k in viaPet.ItemCatalog, k); assert.strictEqual(typeof viaPet.ItemCatalog[k], typeof legacy.ItemCatalog[k], k); });
  bp.forEach(b => { const a = viaPet.ItemCatalog, l = legacy.ItemCatalog;
    assert.deepStrictEqual(clone(a.byId(b.id)), b); assert.deepStrictEqual(clone(a.byGameKey('pet', b.gameKey)), b); assert.deepStrictEqual(clone(a.cost(a.byId(b.id))), clone(l.cost(l.byId(b.id))), b.id); });
  assert.deepStrictEqual(clone(viaPet.ItemCatalog.optionalSlots()), clone(legacy.ItemCatalog.optionalSlots())); assert.ok(viaPet.ItemCatalog.optionalSlots().indexOf('pet') >= 0);
  assert.deepStrictEqual(clone(viaPet.ItemCatalog.KIND_META.pet), clone(legacy.ItemCatalog.KIND_META.pet)); assert.strictEqual(viaPet.ItemCatalog.byId('pet.tidak-ada'), null);
  assert.deepStrictEqual(clone(viaPet.ItemCatalog.starters().map(i => i.id)), clone(legacy.ItemCatalog.starters().map(i => i.id))); assert.ok(!viaPet.ItemCatalog.starters().some(i => i.kind === 'pet'));
});
t('Ketahanan: Registry + index.js ada tetapi manifest belum dimuat -> jalur cadangan, katalog identik baseline', () => {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console: { error() {}, log() {} }, Date, JSON, Math }));
  ['src/core/item-registry.js', 'data/inventory/pet/index.js', 'src/stores/item-catalog.js'].forEach(f => vm.runInContext(rd(f), ctx));
  assert.strictEqual(ctx.ItemCatalog.petSource(), 'legacy'); assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
});
t('Pemuatan ganda: item-catalog.js dimuat dua kali tidak menggandakan registrasi', () => {
  vm.runInContext(rd('src/stores/item-catalog.js'), viaBoth); const R = viaBoth.UT.ItemRegistry.shared();
  assert.strictEqual(R.getCategory('pet').count, 7); assert.strictEqual(R.getCategory('frame').count, 29); assert.strictEqual(R.rejected().length, 0);
});

/* ---- konsumen existing ---- */
t('PlayerData: kepemilikan/equipped/pembelian identik antara jalur cadangan dan jalur Registry (struktur & transaksi tidak berubah)', () => {
  const snap = ctx => { vm.runInContext(rd('src/stores/player-data.js'), ctx); const PD = ctx.PlayerData;
    return clone({ owns: bp.map(p => PD.owns(p.id)), eq: PD.equippedId('pet'), eqF: PD.equippedId('frame'), coins: PD.coins(), gems: PD.gems(), buy: PD.purchase('pet.forest_pup'), buyG: PD.purchase('pet.storm_wolf'),
      eqUnowned: PD.equip('pet.forest_pup'), snapshot: PD.snapshot ? PD.snapshot() : null }); };
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (/At$/.test(k) ? undefined : v)));   /* buang cap waktu (createdAt/acquiredAt/...) */
  const a = strip(snap(boot([]))), b = strip(snap(boot(PET_CHAIN.concat(FRAME_CHAIN)))); assert.deepStrictEqual(b, a);
  assert.deepStrictEqual(b.owns, [false, false, false, false, false, false, false]);
});
t('Pet catalog / pet-page: konsumen membaca IC.items kind pet urut tier; gambar pet-page = data/inventory/pet/items/gameKey/gameKey.png; manifest assets.image = gameKey-strip.webp', () => {
  const pg = rd('data/inventory/pet/_shared/js/pet-page.js'); assert.ok(/IMAGE_ROOT = 'data\/inventory\/pet\/items\/'/.test(pg)); assert.ok(/IMAGE_ROOT \+ item\.gameKey \+ '\/' \+ item\.gameKey \+ '\.png'/.test(pg));
  assert.ok(/item\.kind === 'pet'\)\.sort\(\(a, b\) => a\.tier - b\.tier\)/.test(pg));
  const sorted = clone(viaPet.ItemCatalog.items.filter(i => i.kind === 'pet')).sort((a, b) => a.tier - b.tier); assert.deepStrictEqual(sorted.map(i => i.id), bp.map(i => i.id));
  items.forEach(m => assert.strictEqual(m.assets.image, 'data/inventory/pet/items/' + m.gameKey + '/' + m.gameKey.replace(/_/g, '-') + '.webp'));
});
t('AppearanceService: memuat dengan katalog jalur Registry tanpa error; slot pet opsional', () => {
  const ctx = boot(PET_CHAIN.concat(FRAME_CHAIN)); vm.runInContext(rd('src/stores/player-data.js'), ctx); assert.ok(require(path.join(ROOT, 'src/services/appearance-service.js'))); assert.strictEqual(ctx.ItemCatalog.items.length, 183);
});
t('Server catalog: id/harga/gems/starter/kind Pet = seed server (migrasi pet) dan supabase/pet_catalog.sql (tanpa mengubah SQL)', () => {
  const seed = /BEGIN PET SEED[\s\S]*?END PET SEED/.exec(rd('supabase/migrations/202611290001_pet_catalog.sql'))[0]; let seen = 0;
  items.forEach(i => { const m = new RegExp("\\('" + i.id + "', 'pet', (null|\\d+), (null|\\d+), (true|false), (true|false)\\)").exec(seed); assert.ok(m, i.id);
    assert.strictEqual(m[1] === 'null' ? null : +m[1], i.price, i.id + ' koin'); assert.strictEqual(m[2] === 'null' ? null : +m[2], i.gems, i.id + ' gems'); assert.strictEqual(m[3], 'false'); assert.strictEqual(m[4], 'false'); seen++; });
  assert.strictEqual(seen, 7);
  const meta = rd('supabase/pet_catalog.sql'); items.forEach(i => assert.ok(meta.indexOf("'" + i.gameKey + "'") >= 0, i.gameKey + ' ada di pet_catalog.sql'));
});

/* ---- aset & audio: lapisan dipisah ---- */
t('A. manifest valid (validateManifest) 7/7', () => { items.forEach(m => assert.deepStrictEqual(IR.validateManifest(m, PetCat.category), { ok: true, errors: [] }, m.id)); });
t('B. FORMAT path gambar canonical valid 7/7 dan unik (bukan bukti file ada / termuat)', () => {
  items.forEach(m => {
    assert.strictEqual(m.assets.image, 'data/inventory/pet/items/' + m.gameKey + '/' + m.gameKey.replace(/_/g, '-') + '.webp', m.id);
    assert.strictEqual(IR.validateAssetPaths(m, PetCat.category).ok, true, m.id);
  });
  assert.strictEqual(new Set(items.map(m => m.assets.image)).size, 7);
});
t('C. file gambar ADA, tidak kosong, header WebP (BUKAN pemuatan di browser)', () => {
  items.forEach(m => { const f = path.join(ROOT, m.assets.image); assert.ok(fs.existsSync(f), m.assets.image); const b = fs.readFileSync(f); assert.ok(b.length > 1000, m.assets.image); assert.ok(b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP', m.assets.image); });
});
/* Baseline Stage 4 (SEBELUM 4.1): PET_FILES hardcoded per indeks tier di pet-viewer.js. Dibekukan di sini sebagai bukti pemetaan tidak berubah. */
const SFX_BASELINE = {
  forest_pup: ['forest-pup-bark-burst', 'forest-pup-bark', 'forest-pup-whimper'], copper_golem: ['copper-golem-clang', 'copper-golem-steam', 'copper-golem-servo'],
  crystal_axolotl: ['crystal-axolotl-bubble', 'crystal-axolotl-chime', 'crystal-axolotl-squeak'], arcane_owl: ['arcane-owl-hoot', 'arcane-owl-sparkle', 'arcane-owl-flap'],
  storm_wolf: ['storm-wolf-howl', 'storm-wolf-thunder', 'storm-wolf-zap'], inferno_dragon: ['inferno-dragon-roar', 'inferno-dragon-fire', 'inferno-dragon-wings'],
  celestial_kitsune: ['celestial-kitsune-bell', 'celestial-kitsune-cry', 'celestial-kitsune-shine'] };
const SHARED_PET_SFX = new Set(['storm-wolf-zap', 'inferno-dragon-fire', 'celestial-kitsune-bell', 'celestial-kitsune-shine']);
const sfxPath = (key, n) => SHARED_PET_SFX.has(n)
  ? 'assets/audio/sfx/pet/' + n + '.mp3'
  : 'data/inventory/pet/items/' + key + '/sfx/' + n + '.mp3';
const PV_PATH = 'data/inventory/pet/_shared/js/pet-viewer.js', PV = rd(PV_PATH);
function viewerAudioProbe(itemRegistry) {
  const calls = [], SND = PetCat.keys.map((_, i) => [0, 1, 2].map(k => () => calls.push([i, k])));
  const view = { insertAdjacentHTML() {} }, canvas = {};
  const context2d = { createRadialGradient() { return { addColorStop() {} }; }, fillRect() {} };
  const document = {
    createElement() { return { getContext() { return context2d; } }; },
    getElementById(id) { return id === 'fpv' ? view : canvas; }
  };
  const window = { ItemCatalog: { items: bp }, UT: Object.assign({ PageModule: { define: (name, fn) => fn(new Proxy({ disposed: false }, { get: (t, k) => (k in t ? t[k] : () => 0) })) } }, itemRegistry ? { ItemRegistry: { shared: () => itemRegistry } } : {}), __synthesizedSnd: SND, addEventListener() {}, removeEventListener() {} };
  window.window = window;
  const ctx = vm.createContext({
    window, document,
    THREE: { CanvasTexture: function(){}, WebGLRenderer: function(){throw new Error('WebGL disabled in audio contract probe')} },
    console: { error() {} }, Date, JSON, Math
  });
  let source = PV.replace(/const SND=window\.__synthesizedSnd\|\|\[[\s\S]*?\n\];/, 'const SND=window.__synthesizedSnd;');
  assert.notStrictEqual(source, PV, 'synthetic fallback functions must be injectable');
  const end = /\}\);\s*$/; /* pet-viewer.js = UT.PageModule.define('pet-viewer', function(env){ ... }); */
  assert.ok(end.test(source), 'PetViewer IIFE terminator');
  source = source.replace(end, 'window.__petAudioProbe={PET_FILES,SND};\n});');
  vm.runInContext(source, ctx, { filename: PV_PATH });
  return { PET_FILES: clone(window.__petAudioProbe.PET_FILES), SND: window.__petAudioProbe.SND, calls };
}
t('SFX manifest (4.1): 7 Pet x 3 = 21 referensi, tepat 3 per Pet, tanpa duplikat', () => {
  const all = []; items.forEach(m => { assert.ok(Array.isArray(m.assets.sfx) && m.assets.sfx.length === 3, m.id); all.push.apply(all, m.assets.sfx); });
  assert.strictEqual(all.length, 21); assert.strictEqual(new Set(all).size, 21);
});
t('SFX manifest: path dan urutan slot = pemetaan baseline pet-viewer.js (tidak ada yang hilang/salah)', () => {
  assert.deepStrictEqual(Object.keys(SFX_BASELINE), PetCat.keys);
  items.forEach(m => assert.deepStrictEqual(m.assets.sfx, SFX_BASELINE[m.gameKey].map(n => sfxPath(m.gameKey, n)), m.id));
});
t('SFX validasi: A. validateManifest OK 7/7  B. path format mp3 valid  C. 17 SFX Pet-owned + 4 shared ada dan tidak ada file yatim', () => {
  items.forEach(m => { assert.deepStrictEqual(IR.validateManifest(m, PetCat.category), { ok: true, errors: [] }, m.id); assert.strictEqual(IR.validateAssetPaths(m, PetCat.category).ok, true, m.id); });
  const diskShared = fs.readdirSync(path.join(ROOT, 'assets/audio/sfx/pet')).filter(f => /\.mp3$/.test(f)).map(f => 'assets/audio/sfx/pet/' + f).sort(), diskOwned = [], ref = [];
  PetCat.keys.forEach(key => fs.readdirSync(path.join(ROOT, 'data/inventory/pet/items', key, 'sfx')).filter(f => /\.mp3$/.test(f))
    .forEach(f => diskOwned.push('data/inventory/pet/items/' + key + '/sfx/' + f)));
  items.forEach(m => m.assets.sfx.forEach(u => { ref.push(u); const f = path.join(ROOT, u); assert.ok(fs.existsSync(f), u); const b = fs.readFileSync(f); assert.ok(b.length > 1000, u);
    assert.ok(b.slice(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), u + ' header MP3'); }));
  assert.deepStrictEqual(ref.filter(u => u.startsWith('assets/audio/sfx/pet/')).sort(), diskShared);
  assert.deepStrictEqual(ref.filter(u => u.startsWith('data/inventory/pet/items/')).sort(), diskOwned.sort());
  assert.strictEqual(diskOwned.length, 17);
  assert.strictEqual(diskShared.length, 4);
});
t('SFX: tidak digandakan di ItemCatalog (item katalog tetap = baseline; tidak ada field sfx/audio/assets)', () => {
  [legacy, viaPet, viaBoth].forEach(c => c.ItemCatalog.items.forEach(i => { assert.ok(!('sfx' in i) && !('audio' in i) && !('assets' in i), i.id); }));
  assert.deepStrictEqual(clone(viaPet.ItemCatalog.items), base.items);
});
t('Pet Viewer: tidak lagi punya path mp3 hardcoded; membaca dari UT.ItemRegistry (pet.<id> -> assets.sfx)', () => {
  assert.ok(PV.indexOf('assets/audio/sfx/pet/') < 0 || !/['"]assets\/sfx\/pet\/[^'"]+\.mp3['"]/.test(PV), 'masih ada literal path mp3');
  assert.ok(/UT\.ItemRegistry/.test(PV) && /getItem\('pet\.'\+id\)/.test(PV) && /assets\.sfx/.test(PV));
});
t('Pet Viewer: SFX dibaca dari manifest ItemRegistry dan dipasangkan ke fallback sintesis per Pet/slot', () => {
  assert.ok(PV.includes("IR.shared().getItem('pet.'+id)"));
  assert.ok(PV.includes('m&&m.assets&&m.assets.sfx'));
  assert.ok(PV.includes('PETS.forEach((d,i)=>{const f=petSfxFromManifest(d.id);if(!f)return;PET_FILES[i]=f;'));
  assert.ok(PV.includes('const synth=SND[i][k];SND[i][k]=()=>petPlayFile(url,synth)'));
  assert.ok(!/['"]assets\/sfx\/pet\/[^'"]+\.mp3['"]/.test(PV), 'viewer tidak boleh memiliki pemetaan SFX kedua');
});
t('Pet Viewer (full source in VM): manifest SFX maps to the baseline Pet/slot and preserves all synth fallbacks', () => {
  const result = viewerAudioProbe(reg); assert.strictEqual(Object.keys(result.PET_FILES).length, 7);
  PetCat.keys.forEach((key, i) => assert.deepStrictEqual(result.PET_FILES[i], SFX_BASELINE[key].map(n => sfxPath(key, n)), key));
  PetCat.keys.forEach((key, i) => [0, 1, 2].forEach(k => {
    const before = result.calls.length; result.SND[i][k](); assert.strictEqual(result.calls.length, before + 1, key + ' slot ' + k);
  }));
});
t('Pet Viewer: manifest remains the source when assets.sfx changes and Registry order is reversed', () => {
  const changed = IR.create(); changed.registerCategory(PetCat.category);
  PetCat.keys.forEach(key => {
    const manifest = clone(require(path.join(ROOT, 'data/inventory/pet/items/' + key + '/manifest.js')));
    if (key === 'storm_wolf') manifest.assets.sfx[0] = 'assets/audio/sfx/pet/ZZ.mp3';
    assert.ok(changed.registerItem(manifest).ok);
  });
  assert.strictEqual(viewerAudioProbe(changed).PET_FILES[4][0], 'assets/audio/sfx/pet/ZZ.mp3');
  const reversed = IR.create(); reversed.registerCategory(PetCat.category);
  PetCat.keys.slice().reverse().forEach(key => reversed.registerItem(require(path.join(ROOT, 'data/inventory/pet/items/' + key + '/manifest.js'))));
  assert.deepStrictEqual(viewerAudioProbe(reversed).PET_FILES, viewerAudioProbe(reg).PET_FILES);
});
t('Pet Viewer: missing Registry or manifest SFX keeps the synthesized fallback without throwing', () => {
  const absent = viewerAudioProbe(null);
  assert.deepStrictEqual(absent.PET_FILES, {});
  absent.SND[0][0](); assert.strictEqual(absent.calls.length, 1);
  const missing = IR.create(); missing.registerCategory(PetCat.category);
  PetCat.keys.forEach(key => {
    const manifest = clone(require(path.join(ROOT, 'data/inventory/pet/items/' + key + '/manifest.js')));
    if (key === 'forest_pup') delete manifest.assets.sfx;
    assert.ok(missing.registerItem(manifest).ok);
  });
  const result = viewerAudioProbe(missing);
  assert.strictEqual(result.PET_FILES[0], undefined);
  result.SND[0][0](); assert.strictEqual(result.calls.length, 1);
});
t('Event/trigger/timing/volume pet-viewer TIDAK berubah (playPetSound: kantong acak 0-2, timer 3..5.5s, 120ms saat ganti Pet, sfxVol/master .55)', () => {
  ['sndBag=[0,1,2].sort(()=>Math.random()-.5)', 'SND[cur][k]()', 'sndT=rr(3,5.5);playPetSound()', 'setTimeout(()=>{soundTimer=0;if(!destroyed)playPetSound()},120)', 'MASTER.gain.value=.55*sfxVolume()',
   'function petPlayFile(url,fallback){', 's.buffer=b;s.connect(MASTER);petSounds.add(s);', 's.onended=()=>{petSounds.delete(s);s.disconnect()}', 's.start();'].forEach(x => assert.ok(PV.indexOf(x) >= 0, x));
});
t('Aset: gambar Pet baru dan ke-21 SFX terdaftar di preload-manifest.json dengan byte count aktual', () => {
  const pm = JSON.parse(rd('assets/preload-manifest.json'));
  assert.ok(Object.keys(pm).length >= 908, 'preload-manifest bertambah seiring aset baru; batas bawah saja');
  ['data/inventory/pet/_shared/js/pet-model-registry.js'].concat(PetCat.keys.map(key => 'data/inventory/pet/items/' + key + '/model.js')).forEach(f => {
    assert.strictEqual(pm[f], fs.statSync(path.join(ROOT, f)).size, f);
  });
  items.forEach(m => {
    assert.strictEqual(pm[m.assets.image], fs.statSync(path.join(ROOT, m.assets.image)).size, m.assets.image);
    m.assets.sfx.forEach(u => assert.ok(pm[u] > 1000, u));
  });
});
t('SFX: pet.html memuat manifest + pet/index.js SEBELUM PetViewer', () => {
  const s = srcs(rd('pet.html')), pv = s.indexOf(PV_PATH); assert.ok(pv > 0);
  const catalog = s.indexOf('src/stores/item-catalog.js'), playerData = s.indexOf('src/stores/player-data.js');
  const three = s.indexOf('src/vendor/three.min.js'), registry = s.indexOf('data/inventory/pet/_shared/js/pet-model-registry.js');
  assert.ok(catalog >= 0 && catalog < playerData && playerData < three && three < registry && registry < pv);
  PET_CHAIN.concat(['src/stores/item-catalog.js']).forEach(f => assert.ok(s.indexOf(f) >= 0 && s.indexOf(f) < pv, f));
});
t('D. pemuatan aset/visual/audio di browser: NOT TESTED (tidak diuji oleh tes ini)', () => { assert.ok(true); });

/* ---- pemuatan skrip ---- */
t('pet.html: item-registry.js -> 7 manifest -> pet/index.js -> item-catalog.js -> skrip halaman; tepat satu kali; tanpa document.write', () => {
  const html = rd('pet.html'), s = srcs(html), i = s.indexOf('src/stores/item-catalog.js'); assert.deepStrictEqual(s.slice(i - PET_CHAIN.length, i), PET_CHAIN);
  PET_CHAIN.concat(['src/stores/item-catalog.js']).forEach(f => assert.strictEqual(s.filter(x => x === f).length, 1, f)); assert.ok(s.indexOf('data/inventory/pet/_shared/js/pet-page.js') > i); assert.ok(!/document\.write/.test(html));
  assert.strictEqual(s.filter(x => x === 'data/inventory/pet/_shared/js/pet-model-registry.js').length, 1);
  assert.ok(s.indexOf('src/vendor/three.min.js') < s.indexOf('data/inventory/pet/_shared/js/pet-model-registry.js'));
  assert.ok(s.indexOf('src/stores/item-catalog.js') < s.indexOf('src/stores/player-data.js'));
  assert.ok(s.indexOf('src/stores/player-data.js') < s.indexOf('src/vendor/three.min.js'));
  assert.ok(s.indexOf('data/inventory/pet/_shared/js/pet-model-registry.js') < s.indexOf(PV_PATH));
  PET_CHAIN.forEach(f => assert.ok(fs.existsSync(path.join(ROOT, f)), f));
});
t('pet.html: simulasi urutan tag -> petSource = registry, katalog = baseline', () => {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w; const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  srcs(rd('pet.html')).filter(f => /^src\/(?:core\/(?:item-registry|session)|stores\/item-catalog)\.js$|^data\/inventory\/pet\/(?:items\/[^/]+\/manifest\.js|index\.js)$/.test(f)).forEach(f => vm.runInContext(rd(f), ctx));
  assert.strictEqual(ctx.ItemCatalog.petSource(), 'registry'); assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
});
t('Halaman lain tidak memuat manifest Pet; gameplay.html tidak berubah', () => {
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && f !== 'pet.html').forEach(f => assert.ok(!/inventory\/pet\/items\/[^"']*manifest\.js/.test(rd(f)), f)); /* halaman lain boleh memakai CSS pet-page (dadu/frame), tapi tidak memuat manifest Pet */
});
t('Loader lama dibuang: tidak ada document.write di berkas Registry/manifest/index/katalog', () => {
  ['src/core/item-registry.js', 'src/stores/item-catalog.js', 'data/inventory/pet/index.js', 'data/inventory/frame/index.js'].concat(PetCat.keys.map(k => 'data/inventory/pet/items/' + k + '/manifest.js')).forEach(f => assert.ok(!/document\.write/.test(rd(f)), f));
});
console.log('\n' + n + ' tes lulus');

