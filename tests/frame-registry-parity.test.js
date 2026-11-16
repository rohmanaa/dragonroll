/* Tes paritas Frame: manifest data/inventory/frame/* <-> ItemCatalog (runtime) <-> frame-fx.js <-> seed server (migrasi SQL) <-> file di disk.
   Jalankan: node tests/frame-registry-parity.test.js
   Empat lapis dilaporkan TERPISAH (lulus satu lapis != lulus lapis lain):
     A. manifest valid   B. FORMAT path aset   C. file ada di disk + header WebP valid   D. pemuatan aset di browser = TIDAK diuji di sini. */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const IR = require(path.join(ROOT, 'assets/js/core/item-registry.js'));
const FrameCat = require(path.join(ROOT, 'data/inventory/frame/index.js'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const w = {}; new Function('window', rd('assets/js/item-catalog.js'))(w);
const IC = w.ItemCatalog, catFrames = IC.items.filter(i => i.kind === 'frame');
const reg = IR.create(), res = FrameCat.register(reg), items = reg.getCategory('frame').items, byId = {}; items.forEach(i => { byId[i.id] = i; });

/* ---- A. manifest ---- */
t('A. register: 14 manifest terdaftar, tidak ada yang ditolak', () => {
  assert.deepStrictEqual(res.rejected, []); assert.strictEqual(res.ok, true);
  assert.strictEqual(res.registered, 14); assert.strictEqual(items.length, 14); assert.strictEqual(reg.rejected().length, 0);
});
t('A. 14 Frame ItemCatalog = 14 manifest: tidak ada yang hilang/ekstra/ganda', () => {
  assert.strictEqual(catFrames.length, 14);
  const a = catFrames.map(i => i.id).sort(), b = items.map(i => i.id).sort();
  assert.deepStrictEqual(b, a); assert.strictEqual(new Set(b).size, 14);
  const c = reg.checkCompleteness('frame', catFrames.map(i => i.id)); assert.deepStrictEqual(c.missing, []); assert.deepStrictEqual(c.extra, []);
  assert.deepStrictEqual(c.incomplete, []);
});
t('A. urutan manifest = urutan ItemCatalog; KEYS index = gameKey', () => {
  assert.deepStrictEqual(items.map(i => i.id), catFrames.map(i => i.id));
  assert.deepStrictEqual(FrameCat.keys, catFrames.map(i => i.gameKey));
});
t('A. paritas ID, kind, gameKey, nama, rarity, starter, desc, featured dengan ItemCatalog', () => {
  catFrames.forEach(c => {
    const m = byId[c.id]; assert.ok(m, c.id);
    assert.strictEqual(m.id, c.id); assert.strictEqual(m.kind, c.kind); assert.strictEqual(m.gameKey, c.gameKey);
    assert.strictEqual(m.name, c.name, c.id + ' name'); assert.strictEqual(m.rarity, c.rarity, c.id + ' rarity');
    assert.strictEqual(m.starter, c.starter, c.id + ' starter'); assert.strictEqual(m.desc, c.desc, c.id + ' desc');
    assert.strictEqual(!!m.featured, !!c.featured, c.id + ' featured');
  });
});
t('A. paritas HARGA (koin) dan GEMS dengan ItemCatalog runtime (bukan literal frame(...) yang ditimpa TIER_PRICE)', () => {
  catFrames.forEach(c => {
    const m = byId[c.id];
    assert.strictEqual(m.price, c.price, c.id + ' price'); assert.strictEqual(m.gems, c.gems, c.id + ' gems');
    if (!m.starter) assert.ok((m.price === null) !== (m.gems === null), c.id + ': tepat satu mata uang');
  });
});
t('A. paritas HARGA dengan seed server (migrasi fase 3) — default = starter gratis', () => {
  const sql = rd('supabase/migrations/202611280001_economy_phase3_gems.sql'), seed = {};
  for (const m of sql.matchAll(/\('frame\.([a-z]+)',\s*(\d+|null),\s*(\d+|null)\)/g)) seed[m[1]] = { price: m[2] === 'null' ? null : +m[2], gems: m[3] === 'null' ? null : +m[3] };
  assert.strictEqual(Object.keys(seed).length, 13, 'seed server: 13 frame berbayar');
  catFrames.forEach(c => {
    if (c.starter) { assert.ok(!(c.gameKey in seed), c.id + ' starter tidak ada di seed harga'); return; }
    assert.deepStrictEqual(seed[c.gameKey], { price: byId[c.id].price, gems: byId[c.id].gems }, c.id + ' vs server');
  });
  const cat = rd('supabase/migrations/202611160001_frame_catalog.sql');   /* server menandai frame.default sebagai starter (harga null) */
  assert.ok(/\('frame\.default',\s*'frame',\s*null,\s*true,/.test(cat));
});
t('A. paritas visual dengan frame-fx.js: fxKey ada di FR, tier & margin sama', () => {
  const fx = rd('data/inventory/frame/_shared/js/frame-fx.js'), tier = {};
  for (const m of fx.matchAll(/^D\('([a-z]+)',(\d+),/gm)) tier[m[1]] = +m[2];
  const mC = JSON.parse(fx.match(/var MARGIN_C = (\{[^}]*\})/)[1].replace(/([a-z]+):/g, '"$1":'));
  assert.strictEqual(Object.keys(tier).length, 14);
  items.forEach(m => {
    const k = m.visual.fxKey; assert.ok(k in tier, m.id + ' fxKey ' + k);
    assert.strictEqual(m.visual.tier, tier[k], m.id + ' tier');
    assert.strictEqual(m.visual.marginCells, mC[k], m.id + ' margin');
    assert.strictEqual(m.visual.fxKey, m.gameKey === 'default' ? 'wood' : m.gameKey, m.id + ' pemetaan fxKey');
  });
  assert.strictEqual(new Set(items.map(m => m.visual.fxKey)).size, 14);
});
t('A. gambar manifest = ItemCatalog.image; kategori memakai FRAME_TAB_ICON yang sama', () => {
  catFrames.forEach(c => assert.strictEqual(byId[c.id].assets.image, c.image, c.id));
  assert.strictEqual(FrameCat.category.assets.tabIcon, 'data/inventory/frame/_shared/img/icon-frame.webp');
  assert.ok(/FRAME_TAB_ICON = 'data\/inventory\/frame\/_shared\/img\/icon-frame\.webp'/.test(rd('assets/js/item-catalog.js')));
});

/* ---- B. format path ---- */
t('B. FORMAT path aset valid untuk semua manifest + ikon tab kategori', () => {
  items.forEach(m => { const v = IR.validateAssetPaths(m, FrameCat.category); assert.deepStrictEqual(v.errors, [], m.id); });
  assert.strictEqual(IR.validateAssetPaths({ assets: FrameCat.category.assets }).ok, true);
});

/* ---- C. file di disk (BUKAN pemuatan di browser) ---- */
t('C. tiap path gambar menunjuk file yang ADA, tidak kosong, berheader WebP (RIFF....WEBP)', () => {
  const paths = items.map(m => m.assets.image).concat([FrameCat.category.assets.tabIcon]);
  paths.forEach(p => {
    const f = path.join(ROOT, p); assert.ok(fs.existsSync(f), 'file tidak ada: ' + p);
    const b = fs.readFileSync(f); assert.ok(b.length > 100, 'terlalu kecil: ' + p);
    assert.strictEqual(b.slice(0, 4).toString('latin1'), 'RIFF', p); assert.strictEqual(b.slice(8, 12).toString('latin1'), 'WEBP', p);
  });
  assert.strictEqual(new Set(items.map(m => m.assets.image)).size, 14, 'tiap frame punya gambar sendiri');
});
t('C. gambar tersedia di disk untuk setiap file yang dirujuk frame-fx (FILE2KEY) dan sebaliknya', () => {
  const map = JSON.parse(rd('data/inventory/frame/_shared/js/frame-fx.js').match(/var FILE2KEY = (\{[^}]*\})/)[1].replace(/'/g, '"'));
  items.forEach(m => assert.ok(m.assets.image.replace(/^data\/frame\/|\.webp$/g, '') in map, m.id + ' tidak ada di FILE2KEY'));
});

/* ---- struktur folder ---- */
t('struktur: satu folder per item (nama = gameKey) berisi manifest.js; tanpa berkas kosong/placeholder', () => {
  const base = path.join(ROOT, 'data/inventory/frame'), dirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== '_shared').map(d => d.name).sort();
  assert.deepStrictEqual(dirs, FrameCat.keys.slice().sort());
  dirs.forEach(d => {
    const files = fs.readdirSync(path.join(base, d)); assert.deepStrictEqual(files, ['manifest.js'], d + ' hanya manifest.js (CSS/JS/asset/audio bersifat opsional & belum perlu)');
    assert.ok(fs.statSync(path.join(base, d, 'manifest.js')).size > 200, d);
  });
  assert.ok(fs.statSync(path.join(base, 'index.js')).size > 200);
});
t('manifest.js bagian dari data dibekukan registry; ID folder = gameKey = bagian kunci id', () => {
  items.forEach(m => { assert.ok(Object.isFrozen(m)); assert.strictEqual(m.id, 'frame.' + m.gameKey); });
});

/* ---- jalur browser (tanpa require): antrean UT.ItemManifests ---- */
t('jalur browser: manifest.js + index.js dimuat di vm tanpa require -> 14 terdaftar identik dengan jalur Node', () => {
  const ctx = { console }; ctx.window = ctx; ctx.window.window = ctx; vm.createContext(ctx);
  vm.runInContext(rd('assets/js/core/item-registry.js'), ctx);
  FrameCat.keys.forEach(k => vm.runInContext(rd('data/inventory/frame/' + k + '/manifest.js'), ctx, { filename: k + '/manifest.js' }));
  vm.runInContext(rd('data/inventory/frame/index.js'), ctx);
  assert.strictEqual(ctx.UT.ItemManifests.length, 14);
  const r2 = ctx.UT.ItemRegistry.create(), out = ctx.UT.ItemCategories.frame.register(r2);
  assert.strictEqual(out.ok, true); assert.strictEqual(out.registered, 14);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r2.getAll())), JSON.parse(JSON.stringify(items)));
});
t('jalur browser: manifest dimuat dobel -> registrasi kedua ditolak (duplicate-registration), tidak ada item ganda', () => {
  const r = IR.create(); assert.strictEqual(FrameCat.register(r).ok, true);
  const again = FrameCat.register(r);
  assert.strictEqual(again.ok, false); assert.strictEqual(again.rejected.length, 14);
  assert.ok(again.rejected.every(x => x.reason === 'duplicate-registration'));
  assert.strictEqual(r.getCategory('frame').count, 14);
});
t('fallback: ID frame tak dikenal/ditolak -> frame.default (starter)', () => {
  assert.strictEqual(reg.getItemOrFallback('frame.tidak-ada').id, 'frame.default');
  assert.strictEqual(reg.getItemOrFallback('frame.default').starter, true);
});

/* ---- kompatibilitas sistem lama ---- */
t('ItemCatalog tidak berubah: 147 item, 14 frame, byId/byGameKey/defaultEquipped utuh', () => {
  assert.strictEqual(IC.items.length, 147);
  assert.strictEqual(IC.byId('frame.gold').gameKey, 'gold'); assert.strictEqual(IC.byGameKey('frame', 'gold').id, 'frame.gold');
  assert.strictEqual(IC.defaultEquipped.frame, 'frame.default'); assert.strictEqual(IC.byId('frame.gold').slot, 'frame');
});
t('registry berdiri sendiri: ItemCatalog/PlayerData tidak diubah atau dimuat olehnya', () => {
  const src = rd('assets/js/core/item-registry.js');
  assert.ok(!/ItemCatalog|PlayerData|localStorage|document\.|window\.[a-z]/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/typeof window[^;]*/g, '').replace(/root\.UT[^;]*;/g, '')));
});
console.log('\n' + n + ' tes lulus');
