/* Tes paritas Pet (Stage 4): manifest data/inventory/pet/* <-> ItemCatalog (baseline & runtime) <-> seed server <-> file di disk.
   Jalankan: node tests/pet-registry-parity.test.js
   Lapisan aset dilaporkan TERPISAH: A. manifest valid  B. FORMAT path  C. file ada + header PNG  D. pemuatan di browser = TIDAK diuji di sini (NOT TESTED). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const IR = require(path.join(ROOT, 'assets/js/item-registry.js'));
const PetCat = require(path.join(ROOT, 'data/inventory/pet/index.js'));
const FrameCat = require(path.join(ROOT, 'data/inventory/frame/index.js'));
const base = JSON.parse(rd('tests/fixtures/item-catalog-baseline.json'));
const clone = o => JSON.parse(JSON.stringify(o));
const srcs = h => (h.match(/<script[^>]+src="([^"]+)"/g) || []).map(x => /src="([^"]+)"/.exec(x)[1]);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const bp = base.items.filter(i => i.kind === 'pet'), bf = base.items.filter(i => i.kind === 'frame');
const reg = IR.create(), res = PetCat.register(reg), items = reg.getCategory('pet').items, byId = {}; items.forEach(i => { byId[i.id] = i; });

function boot(chains) {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  chains.concat(['assets/js/core/session.js', 'assets/js/item-catalog.js']).forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  return ctx;
}
const PET_CHAIN = ['assets/js/item-registry.js'].concat(PetCat.keys.map(k => 'data/inventory/pet/' + k + '/manifest.js'), ['data/inventory/pet/index.js']);
const FRAME_CHAIN = FrameCat.keys.map(k => 'data/inventory/frame/' + k + '/manifest.js').concat(['data/inventory/frame/index.js']);
const legacy = boot([]), viaPet = boot(PET_CHAIN), viaBoth = boot(PET_CHAIN.concat(FRAME_CHAIN));

/* ---- A. Registry ---- */
t('Registry: 7 Pet terdaftar, 0 ditolak, kategori pet tersedia', () => {
  assert.deepStrictEqual(res.rejected, []); assert.strictEqual(res.ok, true); assert.strictEqual(res.registered, 7); assert.strictEqual(items.length, 7);
  assert.strictEqual(reg.rejected().length, 0); assert.deepStrictEqual(reg.categories(), ['pet']); assert.strictEqual(reg.getCategory('pet').kind, 'pet');
});
t('Registry: tanpa ID duplikat; registrasi ulang manifest identik ditolak (duplicate-registration), ID sama isi beda ditolak (duplicate-id)', () => {
  assert.strictEqual(new Set(items.map(i => i.id)).size, 7);
  const m = require(path.join(ROOT, 'data/inventory/pet/storm_wolf/manifest.js'));
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
t('ItemCatalog: total 147, Pet 7, Frame 14/14 (jalur cadangan dan gabungan)', () => {
  [legacy, viaPet, viaBoth].forEach(c => { const IC = c.ItemCatalog; assert.strictEqual(IC.items.length, 147);
    assert.strictEqual(IC.items.filter(i => i.kind === 'pet').length, 7); assert.strictEqual(IC.items.filter(i => i.kind === 'frame').length, 14); });
  assert.strictEqual(viaBoth.ItemCatalog.frameSource(), 'registry'); assert.strictEqual(viaPet.ItemCatalog.frameSource(), 'legacy');
});
t('ItemCatalog: SELURUH 147 item (semua field, urutan, tanpa ID ganda) = baseline di setiap kombinasi jalur', () => {
  [legacy, viaPet, viaBoth].forEach(c => { assert.deepStrictEqual(clone(c.ItemCatalog.items), base.items); assert.strictEqual(new Set(clone(c.ItemCatalog.items.map(i => i.id))).size, 147); });
});
t('ItemCatalog: kategori non-Pet tidak berubah (140 item) dan Frame 14/14 sama dengan baseline', () => {
  const IC = viaBoth.ItemCatalog; assert.deepStrictEqual(clone(IC.items.filter(i => i.kind !== 'pet')), base.items.filter(i => i.kind !== 'pet'));
  assert.deepStrictEqual(clone(IC.items.filter(i => i.kind === 'frame')), bf);
});
t('ItemCatalog: Pet dari Registry tidak mendapat field baru (mis. image) — bentuk item = baseline; manifest sengaja mengubah katalog (bukti sumber)', () => {
  assert.deepStrictEqual(Object.keys(viaPet.ItemCatalog.byId('pet.storm_wolf')).sort(), Object.keys(bp[4]).sort());
  const c2 = boot([]); /* VM bersih dengan manifest storm_wolf termutasi */
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const x = vm.createContext(Object.assign(w, { console, Date, JSON, Math })); vm.runInContext(rd('assets/js/item-registry.js'), x);
  PetCat.keys.forEach(k => { let s = rd('data/inventory/pet/' + k + '/manifest.js'); if (k === 'storm_wolf') s = s.replace('"Storm Wolf"', '"Storm Wolf UJI"').replace('gems: 1500', 'gems: 1501'); vm.runInContext(s, x); });
  vm.runInContext(rd('data/inventory/pet/index.js'), x); vm.runInContext(rd('assets/js/item-catalog.js'), x);
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
  ['assets/js/item-registry.js', 'data/inventory/pet/index.js', 'assets/js/item-catalog.js'].forEach(f => vm.runInContext(rd(f), ctx));
  assert.strictEqual(ctx.ItemCatalog.petSource(), 'legacy'); assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
});
t('Pemuatan ganda: item-catalog.js dimuat dua kali tidak menggandakan registrasi', () => {
  vm.runInContext(rd('assets/js/item-catalog.js'), viaBoth); const R = viaBoth.UT.ItemRegistry.shared();
  assert.strictEqual(R.getCategory('pet').count, 7); assert.strictEqual(R.getCategory('frame').count, 14); assert.strictEqual(R.rejected().length, 0);
});

/* ---- konsumen existing ---- */
t('PlayerData: kepemilikan/equipped/pembelian identik antara jalur cadangan dan jalur Registry (struktur & transaksi tidak berubah)', () => {
  const snap = ctx => { vm.runInContext(rd('assets/js/player-data.js'), ctx); const PD = ctx.PlayerData;
    return clone({ owns: bp.map(p => PD.owns(p.id)), eq: PD.equippedId('pet'), eqF: PD.equippedId('frame'), coins: PD.coins(), gems: PD.gems(), buy: PD.purchase('pet.forest_pup'), buyG: PD.purchase('pet.storm_wolf'),
      eqUnowned: PD.equip('pet.forest_pup'), snapshot: PD.snapshot ? PD.snapshot() : null }); };
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (/At$/.test(k) ? undefined : v)));   /* buang cap waktu (createdAt/acquiredAt/...) */
  const a = strip(snap(boot([]))), b = strip(snap(boot(PET_CHAIN.concat(FRAME_CHAIN)))); assert.deepStrictEqual(b, a);
  assert.deepStrictEqual(b.owns, [false, false, false, false, false, false, false]);
});
t('Pet catalog / pet-page: konsumen membaca IC.items kind pet urut tier; gambar pet-page = IMAGE_ROOT + gameKey + .png = manifest assets.image', () => {
  const pg = rd('assets/js/pet-page.js'); assert.ok(/IMAGE_ROOT = 'assets\/ng\/pet3d\/'/.test(pg)); assert.ok(/IMAGE_ROOT \+ item\.gameKey\}\.png/.test(pg));
  assert.ok(/item\.kind === 'pet'\)\.sort\(\(a, b\) => a\.tier - b\.tier\)/.test(pg));
  const sorted = clone(viaPet.ItemCatalog.items.filter(i => i.kind === 'pet')).sort((a, b) => a.tier - b.tier); assert.deepStrictEqual(sorted.map(i => i.id), bp.map(i => i.id));
  items.forEach(m => assert.strictEqual(m.assets.image, 'assets/ng/pet3d/' + m.gameKey + '.png'));
});
t('AppearanceService: memuat dengan katalog jalur Registry tanpa error; slot pet opsional', () => {
  const ctx = boot(PET_CHAIN.concat(FRAME_CHAIN)); vm.runInContext(rd('assets/js/player-data.js'), ctx); assert.ok(require(path.join(ROOT, 'assets/js/services/appearance-service.js'))); assert.strictEqual(ctx.ItemCatalog.items.length, 147);
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
t('B. FORMAT path gambar valid 7/7 (bukan bukti file ada / termuat)', () => { items.forEach(m => assert.strictEqual(IR.validateAssetPaths(m, PetCat.category).ok, true, m.id)); assert.strictEqual(new Set(items.map(m => m.assets.image)).size, 7); });
t('C. file gambar ADA, tidak kosong, header PNG (BUKAN pemuatan di browser)', () => {
  items.forEach(m => { const f = path.join(ROOT, m.assets.image); assert.ok(fs.existsSync(f), m.assets.image); const b = fs.readFileSync(f); assert.ok(b.length > 1000, m.assets.image); assert.strictEqual(b.slice(1, 4).toString(), 'PNG', m.assets.image); });
});
/* Baseline Stage 4 (SEBELUM 4.1): PET_FILES hardcoded per indeks tier di pet-viewer.js. Dibekukan di sini sebagai bukti pemetaan tidak berubah. */
const SFX_BASELINE = {
  forest_pup: ['forest-pup-bark-burst', 'forest-pup-bark', 'forest-pup-whimper'], copper_golem: ['copper-golem-clang', 'copper-golem-steam', 'copper-golem-servo'],
  crystal_axolotl: ['crystal-axolotl-bubble', 'crystal-axolotl-chime', 'crystal-axolotl-squeak'], arcane_owl: ['arcane-owl-hoot', 'arcane-owl-sparkle', 'arcane-owl-flap'],
  storm_wolf: ['storm-wolf-howl', 'storm-wolf-thunder', 'storm-wolf-zap'], inferno_dragon: ['inferno-dragon-roar', 'inferno-dragon-fire', 'inferno-dragon-wings'],
  celestial_kitsune: ['celestial-kitsune-bell', 'celestial-kitsune-cry', 'celestial-kitsune-shine'] };
const sfxPath = n => 'assets/sfx/pet/' + n + '.mp3', PV = rd('assets/js/pet-viewer.js');
t('SFX manifest (4.1): 7 Pet x 3 = 21 referensi, tepat 3 per Pet, tanpa duplikat', () => {
  const all = []; items.forEach(m => { assert.ok(Array.isArray(m.assets.sfx) && m.assets.sfx.length === 3, m.id); all.push.apply(all, m.assets.sfx); });
  assert.strictEqual(all.length, 21); assert.strictEqual(new Set(all).size, 21);
});
t('SFX manifest: path dan urutan slot = pemetaan baseline pet-viewer.js (tidak ada yang hilang/salah)', () => {
  assert.deepStrictEqual(Object.keys(SFX_BASELINE), PetCat.keys);
  items.forEach(m => assert.deepStrictEqual(m.assets.sfx, SFX_BASELINE[m.gameKey].map(sfxPath), m.id));
});
t('SFX validasi: A. validateManifest OK 7/7  B. format path OK (ekstensi mp3)  C. 21 file ada di lokasi lama, header MP3, tidak kosong, tidak ada file mp3 yatim', () => {
  items.forEach(m => { assert.deepStrictEqual(IR.validateManifest(m, PetCat.category), { ok: true, errors: [] }, m.id); assert.strictEqual(IR.validateAssetPaths(m, PetCat.category).ok, true, m.id); });
  const disk = fs.readdirSync(path.join(ROOT, 'assets/sfx/pet')).filter(f => /\.mp3$/.test(f)).map(f => 'assets/sfx/pet/' + f).sort(), ref = [];
  items.forEach(m => m.assets.sfx.forEach(u => { ref.push(u); const f = path.join(ROOT, u); assert.ok(fs.existsSync(f), u); const b = fs.readFileSync(f); assert.ok(b.length > 1000, u);
    assert.ok(b.slice(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), u + ' header MP3'); }));
  assert.deepStrictEqual(ref.slice().sort(), disk);
});
t('SFX: tidak digandakan di ItemCatalog (item katalog tetap = baseline; tidak ada field sfx/audio/assets)', () => {
  [legacy, viaPet, viaBoth].forEach(c => c.ItemCatalog.items.forEach(i => { assert.ok(!('sfx' in i) && !('audio' in i) && !('assets' in i), i.id); }));
  assert.deepStrictEqual(clone(viaPet.ItemCatalog.items), base.items);
});
t('Pet Viewer: tidak lagi punya path mp3 hardcoded; membaca dari UT.ItemRegistry (pet.<id> -> assets.sfx)', () => {
  assert.ok(PV.indexOf('assets/sfx/pet/') < 0 || !/['"]assets\/sfx\/pet\/[^'"]+\.mp3['"]/.test(PV), 'masih ada literal path mp3');
  assert.ok(/UT\.ItemRegistry/.test(PV) && /getItem\('pet\.'\+id\)/.test(PV) && /assets\.sfx/.test(PV));
});
/* Jalankan potongan nyata pet-viewer.js (PET_FILES..wiring) di VM dgn Registry + manifest asli; AC=null -> hanya jalur cadangan sintesis. */
function viewerSlice(reg) {
  const a = PV.indexOf('const PET_FILES={}'), b = PV.indexOf('const PETS=['), w = PV.indexOf('PETS.forEach((d,i)=>{const f=petSfxFromManifest');
  assert.ok(a > 0 && b > a && w > b, 'penanda potongan');
  const wEnd = PV.indexOf('\n', w), ids = PetCat.keys, calls = [];
  const SND = ids.map((_, i) => [0, 1, 2].map(k => () => calls.push([i, k])));
  const win = { UT: reg ? { ItemRegistry: { shared: () => reg } } : {} }, ctx = vm.createContext({ window: win, SND, AC: null, MASTER: null, fetch() { throw new Error('tak boleh fetch tanpa AC'); }, console, calls });
  vm.runInContext(PV.slice(a, b) + 'const PETS=' + JSON.stringify(ids.map(id => ({ id }))) + ';\n' + PV.slice(w, wEnd) + '\nthis.PET_FILES=PET_FILES;this.SND=SND;', ctx);
  return { PET_FILES: clone(ctx.PET_FILES), SND: ctx.SND, calls, ids };
}
t('Pet Viewer (kode nyata di VM): PET_FILES diambil dari manifest = baseline per indeks tier; SND[pet][slot] tetap fungsi; cadangan sintesis jalan', () => {
  const r = viewerSlice(reg); assert.strictEqual(Object.keys(r.PET_FILES).length, 7);
  r.ids.forEach((id, i) => assert.deepStrictEqual(r.PET_FILES[i], SFX_BASELINE[id].map(sfxPath), id));
  r.ids.forEach((id, i) => [0, 1, 2].forEach(k => { const before = r.calls.length; r.SND[i][k](); assert.strictEqual(r.calls.length, before + 1, id + ' slot ' + k + ' cadangan sintesis'); }));
});
t('Pet Viewer: manifest adalah sumber — mengubah assets.sfx di manifest mengubah yang dibaca viewer; urutan Registry tidak berpengaruh', () => {
  const r2 = IR.create(); r2.registerCategory(PetCat.category); PetCat.keys.forEach(k => { const mm = clone(require(path.join(ROOT, 'data/inventory/pet/' + k + '/manifest.js'))); if (k === 'storm_wolf') mm.assets.sfx[0] = 'assets/sfx/pet/ZZ.mp3'; assert.ok(r2.registerItem(mm).ok); });
  assert.strictEqual(viewerSlice(r2).PET_FILES[4][0], 'assets/sfx/pet/ZZ.mp3');
  const r3 = IR.create(); r3.registerCategory(PetCat.category); PetCat.keys.slice().reverse().forEach(k => r3.registerItem(require(path.join(ROOT, 'data/inventory/pet/' + k + '/manifest.js'))));
  assert.deepStrictEqual(viewerSlice(r3).PET_FILES, viewerSlice(reg).PET_FILES);
});
t('Pet Viewer: tanpa Registry / tanpa sfx di manifest -> tidak melempar, tetap memakai sintesis (tanpa pemetaan kedua)', () => {
  assert.deepStrictEqual(viewerSlice(null).PET_FILES, {});
  const r4 = IR.create(); r4.registerCategory(PetCat.category); const m = clone(require(path.join(ROOT, 'data/inventory/pet/forest_pup/manifest.js'))); delete m.assets.sfx; r4.registerItem(m);
  const r = viewerSlice(r4); assert.strictEqual(r.PET_FILES[0], undefined); r.SND[0][0](); assert.strictEqual(r.calls.length, 1);
});
t('Event/trigger/timing/volume pet-viewer TIDAK berubah (playPetSound: kantong acak 0-2, timer 3..5.5s, 120ms saat ganti Pet, sfxVol/master .55)', () => {
  ['sndBag=[0,1,2].sort(()=>Math.random()-.5)', 'SND[cur][k]()', 'sndT=rr(3,5.5);playPetSound()', 'setTimeout(playPetSound,120)', 'MASTER.gain.value=.55*sfxVolume()',
   'function petPlayFile(url,fallback){', "s.buffer=b;s.connect(MASTER);s.start();"].forEach(x => assert.ok(PV.indexOf(x) >= 0, x));
});
t('SFX: pet.html memuat manifest + pet/index.js SEBELUM pet-viewer.js; ke-21 mp3 sudah terdaftar di preload-manifest.json (path sama, tidak perlu didaftarkan ulang)', () => {
  const s = srcs(rd('pet.html')), pv = s.indexOf('assets/js/pet-viewer.js'); assert.ok(pv > 0);
  PET_CHAIN.concat(['assets/js/item-catalog.js']).forEach(f => assert.ok(s.indexOf(f) >= 0 && s.indexOf(f) < pv, f));
  const pm = JSON.parse(rd('assets/preload-manifest.json')); items.forEach(m => m.assets.sfx.forEach(u => assert.ok(pm[u] > 1000, u)));
});
t('D. pemuatan aset/visual/audio di browser: NOT TESTED (tidak diuji oleh tes ini)', () => { assert.ok(true); });

/* ---- pemuatan skrip ---- */
t('pet.html: item-registry.js -> 7 manifest -> pet/index.js -> item-catalog.js -> skrip halaman; tepat satu kali; tanpa document.write', () => {
  const html = rd('pet.html'), s = srcs(html), i = s.indexOf('assets/js/item-catalog.js'); assert.deepStrictEqual(s.slice(i - PET_CHAIN.length, i), PET_CHAIN);
  PET_CHAIN.concat(['assets/js/item-catalog.js']).forEach(f => assert.strictEqual(s.filter(x => x === f).length, 1, f)); assert.ok(s.indexOf('assets/js/pet-page.js') > i); assert.ok(!/document\.write/.test(html));
  PET_CHAIN.forEach(f => assert.ok(fs.existsSync(path.join(ROOT, f)), f));
});
t('pet.html: simulasi urutan tag -> petSource = registry, katalog = baseline', () => {
  const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w; const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  srcs(rd('pet.html')).filter(f => /^(assets\/js\/(item-registry|session|item-catalog)|data\/inventory\/)/.test(f)).forEach(f => vm.runInContext(rd(f), ctx));
  assert.strictEqual(ctx.ItemCatalog.petSource(), 'registry'); assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
});
t('Halaman lain tidak memuat manifest Pet; gameplay.html tidak berubah', () => {
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && f !== 'pet.html').forEach(f => assert.ok(!/inventory\/pet/.test(rd(f)), f));
});
t('Loader lama dibuang: tidak ada document.write di berkas Registry/manifest/index/katalog', () => {
  ['assets/js/item-registry.js', 'assets/js/item-catalog.js', 'data/inventory/pet/index.js', 'data/inventory/frame/index.js'].concat(PetCat.keys.map(k => 'data/inventory/pet/' + k + '/manifest.js')).forEach(f => assert.ok(!/document\.write/.test(rd(f)), f));
});
console.log('\n' + n + ' tes lulus');
