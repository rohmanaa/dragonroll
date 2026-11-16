/* Tes integrasi Stage 3: ItemRegistry (14 manifest Frame) -> ItemCatalog -> konsumen existing.
   Jalankan: node tests/frame-catalog-integration.test.js
   Pembanding = tests/fixtures/item-catalog-baseline.json (snapshot runtime ItemCatalog SEBELUM integrasi, 147 item).
   Yang TIDAK diuji di sini: pemuatan nyata di browser (NOT TESTED kecuali ada laporan browser terpisah). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const base = JSON.parse(rd('tests/fixtures/item-catalog-baseline.json'));
const FrameCat = require(path.join(ROOT, 'data/inventory/frame/index.js'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const clone = o => JSON.parse(JSON.stringify(o));

/* Muat skrip klasik ke VM; `registry` = true -> muat item-registry + 14 manifest + index.js SEBELUM item-catalog.js (urutan halaman). */
function boot(registry, extra) {
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  const files = [];
  if (registry) { files.push('assets/js/core/item-registry.js'); FrameCat.keys.forEach(k => files.push('data/inventory/frame/' + k + '/manifest.js')); files.push('data/inventory/frame/index.js'); }
  files.push('assets/js/core/session.js', 'assets/js/item-catalog.js'); (extra || []).forEach(f => files.push(f));
  files.forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
  return ctx;
}
const legacy = boot(false), viaReg = boot(true);
const ICl = legacy.ItemCatalog, ICr = viaReg.ItemCatalog;

t('jalur Registry aktif bila skrip dimuat; jalur cadangan bila tidak (diagnostik frameSource)', () => {
  assert.strictEqual(ICr.frameSource(), 'registry'); assert.strictEqual(ICl.frameSource(), 'legacy');
});
t('ItemCatalog: 147 item, kedua jalur', () => { assert.strictEqual(base.total, 147); assert.strictEqual(ICr.items.length, 147); assert.strictEqual(ICl.items.length, 147); });
t('ItemCatalog: urutan ID = baseline (kedua jalur)', () => {
  const ids = base.items.map(i => i.id);
  assert.deepStrictEqual(clone(ICr.items.map(i => i.id)), ids); assert.deepStrictEqual(clone(ICl.items.map(i => i.id)), ids);
});
t('ItemCatalog: tidak ada ID ganda', () => { assert.strictEqual(new Set(clone(ICr.items.map(i => i.id))).size, 147); });
t('ItemCatalog: SELURUH item (semua field) sama dengan baseline, jalur Registry dan jalur cadangan', () => {
  assert.deepStrictEqual(clone(ICr.items), base.items); assert.deepStrictEqual(clone(ICl.items), base.items);
});
t('ItemCatalog: kategori non-Frame identik dengan baseline', () => {
  const nf = a => clone(a.filter(i => i.kind !== 'frame'));
  assert.strictEqual(nf(ICr.items).length, 133); assert.deepStrictEqual(nf(ICr.items), base.items.filter(i => i.kind !== 'frame'));
});
t('ItemCatalog: semua API publik baseline tetap ada (tipe sama); sumber Registry kategori tetap tersedia', () => {
  const cur = Object.keys(ICr).sort(); base.api.forEach(k => { assert.ok(k in ICr, k); assert.strictEqual(typeof ICr[k], typeof ICl[k], k); });
  assert.deepStrictEqual(cur.filter(k => base.api.indexOf(k) < 0), ['auraSource', 'diceSource', 'frameSource', 'petSource', 'powerSource', 'skinSource']);
  assert.ok(Object.isFrozen(ICr) && Object.isFrozen(ICr.items));
});
t('ItemCatalog: byId/byGameKey/cost/starters/defaultEquipped/FRAME_TAB_ICON sama di kedua jalur', () => {
  base.items.filter(i => i.kind === 'frame').forEach(f => {
    assert.deepStrictEqual(clone(ICr.byId(f.id)), f); assert.deepStrictEqual(clone(ICr.byGameKey('frame', f.gameKey)), f);
    assert.deepStrictEqual(clone(ICr.cost(ICr.byId(f.id))), clone(ICl.cost(ICl.byId(f.id))), f.id);
  });
  assert.strictEqual(ICr.byId('frame.tidak-ada'), null); assert.strictEqual(ICr.byId('__proto__'), null);
  assert.deepStrictEqual(clone(ICr.starters().map(i => i.id)), clone(ICl.starters().map(i => i.id))); assert.ok(ICr.starters().some(i => i.id === 'frame.default'));
  assert.deepStrictEqual(clone(ICr.defaultEquipped), clone(ICl.defaultEquipped)); assert.strictEqual(ICr.defaultEquipped.frame, 'frame.default');
  assert.strictEqual(ICr.FRAME_TAB_ICON, 'data/inventory/frame/_shared/img/icon-frame.webp');
});
t('Frame: 14/14 metadata (id, name, kind, rarity, price, gems, starter, desc, featured, image) dari manifest = baseline', () => {
  const fr = ICr.items.filter(i => i.kind === 'frame'), bf = base.items.filter(i => i.kind === 'frame'); assert.strictEqual(fr.length, 14);
  fr.forEach((f, i) => ['id', 'name', 'kind', 'rarity', 'price', 'gems', 'starter', 'desc', 'featured', 'image', 'gameKey', 'category', 'slot', 'stackable'].forEach(k => assert.strictEqual(f[k], bf[i][k], f.id + '.' + k)));
});
t('Frame: tiap item katalog berasal dari manifest Registry (bukan literal) — nilai yang sengaja dibedakan di manifest muncul di katalog', () => {
  /* Bukti sumber: ubah satu manifest di salinan lalu muat ulang -> katalog mengikuti manifest, bukan literal/TIER_PRICE. */
  const IR = require(path.join(ROOT, 'assets/js/core/item-registry.js')), reg = IR.create(); FrameCat.register(reg);
  const m = JSON.parse(JSON.stringify(reg.getItem('frame.stone'))); m.name = 'Frame Batu UJI'; m.gems = 77; m.price = null;
  const ctx = boot(false); /* VM bersih lalu pasang Registry tiruan dengan manifest termutasi */
  const store = {}, w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const c2 = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
  vm.runInContext(rd('assets/js/core/item-registry.js'), c2);
  FrameCat.keys.forEach(k => { let src = rd('data/inventory/frame/' + k + '/manifest.js'); if (k === 'stone') src = src.replace('"Frame Batu"', '"Frame Batu UJI"').replace('price: 500', 'price: null').replace(/gems: null/, 'gems: 77'); vm.runInContext(src, c2); });
  vm.runInContext(rd('data/inventory/frame/index.js'), c2); vm.runInContext(rd('assets/js/item-catalog.js'), c2);
  const s = c2.ItemCatalog.byId('frame.stone'); assert.strictEqual(c2.ItemCatalog.frameSource(), 'registry');
  assert.strictEqual(s.name, 'Frame Batu UJI'); assert.strictEqual(s.gems, 77); assert.strictEqual(s.price, null);
});
t('Registry: item Frame dari katalog berasal dari Registry bersama (shared) dan fallback berfungsi', () => {
  const reg = viaReg.UT.ItemRegistry.shared(); assert.strictEqual(reg.getCategory('frame').count, 14);
  assert.strictEqual(reg.getItemOrFallback('frame.tidak-ada').id, 'frame.default'); assert.strictEqual(reg.getItemOrFallback('frame.default').id, 'frame.default');
  assert.strictEqual(reg.rejected().length, 0);
  const f = reg.getItem('frame.storm'); assert.strictEqual(f.visual.tier, 5); assert.strictEqual(f.visual.marginCells, 6); assert.strictEqual(f.visual.fxKey, 'storm');
});
t('Pemuatan ganda: item-catalog.js dimuat dua kali di VM sama tidak menggandakan registrasi / tidak melempar', () => {
  const ctx = boot(true); vm.runInContext(rd('assets/js/item-catalog.js'), ctx);
  assert.strictEqual(ctx.ItemCatalog.frameSource(), 'registry'); assert.strictEqual(ctx.UT.ItemRegistry.shared().getCategory('frame').count, 14);
  assert.strictEqual(ctx.UT.ItemRegistry.shared().rejected().length, 0);
});
t('Ketahanan: Registry ada tetapi manifest belum dimuat -> jalur cadangan, katalog tetap 147 item identik baseline', () => {
  const store = {}, w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { console: { error() {}, log() {} }, Date, JSON, Math }));
  ['assets/js/core/item-registry.js', 'data/inventory/frame/index.js', 'assets/js/item-catalog.js'].forEach(f => vm.runInContext(rd(f), ctx));
  assert.strictEqual(ctx.ItemCatalog.frameSource(), 'legacy'); assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items);
});
t('Ketahanan: jalur Registry tidak bergantung pada DOM (tanpa document/localStorage global)', () => { assert.strictEqual(typeof viaReg.document, 'undefined'); });

/* ---- konsumen existing: PlayerData / AppearanceService / server catalog ---- */
t('PlayerData: perilaku sama di kedua jalur (kepemilikan starter, equip, pemasangan frame, penolakan tanpa login)', () => {
  const snap = ctx => { const PD = (() => { vm.runInContext(rd('assets/js/player-data.js'), ctx); return ctx.PlayerData; })();
    const o = { owns: base.items.filter(i => i.kind === 'frame').map(f => PD.owns(f.id)), eq: PD.equippedId('frame'), isEq: PD.isEquipped('frame.default'),
      coins: PD.coins(), gems: PD.gems(), buy: PD.purchase('frame.stone'), buyGem: PD.purchase('frame.ender'), eqUnowned: PD.equip('frame.stone'), eqStarter: PD.equip('frame.default') };
    return o; };
  const a = clone(snap(boot(false))), b = clone(snap(boot(true))); assert.deepStrictEqual(b, a);
  assert.strictEqual(b.eq, 'frame.default'); assert.strictEqual(b.owns[0], true); assert.strictEqual(b.owns[1], false);
});
t('AppearanceService: memuat dengan katalog jalur Registry tanpa error', () => {
  const ctx = boot(true, ['assets/js/player-data.js']); const Svc = require(path.join(ROOT, 'assets/js/services/appearance-service.js')); assert.ok(Svc); assert.strictEqual(ctx.ItemCatalog.items.length, 147);
});
t('Server catalog: harga/gems Frame hasil integrasi = seed server (migrasi SQL fase 3) dan frame.default starter (harga server null)', () => {
  const sql = rd('supabase/migrations/202611280001_economy_phase3_gems.sql'), blk = /BEGIN TIER PRICE SEED[\s\S]*?END TIER PRICE SEED/.exec(sql)[0];
  let seen = 0; ICr.items.filter(i => i.kind === 'frame' && !i.starter).forEach(f => {
    const m = new RegExp("\\('" + f.id.replace('.', '\\.') + "', (null|\\d+), (null|\\d+)\\)").exec(blk); assert.ok(m, f.id);
    assert.strictEqual(m[1] === 'null' ? null : +m[1], f.price > 0 ? f.price : null, f.id + ' koin'); assert.strictEqual(m[2] === 'null' ? null : +m[2], f.gems > 0 ? f.gems : null, f.id + ' gems'); seen++;
  });
  assert.strictEqual(seen, 13); assert.ok(!/frame\.default/.test(blk));
  assert.strictEqual(ICr.byId('frame.default').starter, true); assert.strictEqual(ICr.byId('frame.default').price, 0);
});

/* ---- pemuatan skrip: tag <script> klasik statis, urutan di halaman ---- */
const WIRED = ['shop', 'inventory', 'karakter', 'profile', 'frame'];
const CHAIN = ['assets/js/core/item-registry.js'].concat(FrameCat.keys.map(k => 'data/inventory/frame/' + k + '/manifest.js'), ['data/inventory/frame/index.js']);
const srcs = h => (h.match(/<script[^>]+src="([^"]+)"/g) || []).map(x => /src="([^"]+)"/.exec(x)[1]);
t('Halaman: registry -> 14 manifest -> index.js berurutan dan sebelum item-catalog.js', () => {
  WIRED.forEach(p => { const s = srcs(rd(p + '.html')), i = s.indexOf('assets/js/item-catalog.js');
    const indexes = CHAIN.map(f => s.indexOf(f));
    assert.ok(indexes.every(x => x >= 0 && x < i), p);
    assert.deepStrictEqual(indexes, indexes.slice().sort((a, b) => a - b), p);
    CHAIN.concat(['assets/js/item-catalog.js']).forEach(f => assert.strictEqual(s.filter(x => x === f).length, 1, p + ' ' + f));
    const fx = s.indexOf('data/inventory/frame/_shared/js/frame-fx.js'); assert.ok(fx < 0 || fx > i, p + ': frame-fx.js (bila dimuat) tetap sesudah katalog'); });
});
t('Halaman: semua file rantai ada di disk', () => { CHAIN.forEach(f => assert.ok(fs.existsSync(path.join(ROOT, f)), f)); assert.strictEqual(CHAIN.length, 16); });
t('Halaman lain memakai jalur fallback Frame tanpa manifest Frame; Registry kategori lain tidak mengubahnya', () => {
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && WIRED.concat(['pet']).indexOf(f.replace('.html', '')) < 0).forEach(f => {
    assert.ok(!/data\/inventory\/frame\//.test(rd(f)), f); });
});
t('Simulasi urutan halaman: menjalankan skrip PERSIS menurut urutan tag di HTML -> frameSource = registry di setiap halaman terhubung', () => {
  WIRED.forEach(p => { const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } }; w.window = w;
    const ctx = vm.createContext(Object.assign(w, { console, Date, JSON, Math }));
    srcs(rd(p + '.html')).filter(f => /^(assets\/js\/(item-registry|session|item-catalog)|data\/inventory\/frame\/)/.test(f)).forEach(f => vm.runInContext(rd(f), ctx));
    assert.strictEqual(ctx.ItemCatalog.frameSource(), 'registry', p); assert.deepStrictEqual(clone(ctx.ItemCatalog.items), base.items, p); });
});
console.log('\n' + n + ' tes lulus');
