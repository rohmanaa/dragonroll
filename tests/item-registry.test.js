/* Tes ItemRegistry (src/core/item-registry.js) â€” murni logika, tanpa DOM/ItemCatalog. Jalankan: node tests/item-registry.test.js */
const assert = require('assert'), path = require('path');
const IR = require(path.join(__dirname, '../src/core/item-registry.js'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const CAT = { key: 'frame', kind: 'frame', label: 'Frame', fallbackId: 'frame.default' };
const mk = (over) => Object.assign({ id: 'frame.a', kind: 'frame', name: 'Frame A', rarity: 'common', price: 0, starter: true,
  visual: { tier: 1 }, assets: { image: 'data/frame/a.webp' } }, over || {});
const fresh = () => { const r = IR.create(); assert.ok(r.registerCategory(CAT).ok); return r; };

t('registerCategory: sukses, lalu duplikat key/kind ditolak', () => {
  const r = IR.create();
  assert.strictEqual(r.registerCategory(CAT).ok, true);
  assert.strictEqual(r.registerCategory(CAT).reason, 'duplicate-category');
  assert.strictEqual(r.registerCategory({ key: 'frame2', kind: 'frame' }).reason, 'duplicate-kind');
  assert.deepStrictEqual(r.categories(), ['frame']);
});
t('registerCategory: input tidak valid ditolak tanpa melempar', () => {
  const r = IR.create();
  [null, 5, [], {}, { key: 'A B', kind: 'x' }, { key: 'ok', kind: '' }, { key: 'ok', kind: 'ok', rarities: [] }].forEach(c => assert.strictEqual(r.registerCategory(c).ok, false));
  assert.strictEqual(r.categories().length, 0);
});
t('registerItem: manifest valid diterima, hasil beku (immutable) & salinan', () => {
  const r = fresh(), m = mk(), res = r.registerItem(m);
  assert.strictEqual(res.ok, true);
  assert.ok(Object.isFrozen(res.item) && Object.isFrozen(res.item.assets));
  m.name = 'diubah-luar'; assert.strictEqual(r.getItem('frame.a').name, 'Frame A');
});
t('registerItem: kind tanpa kategori ditolak (unknown-category)', () => {
  const r = IR.create(); assert.strictEqual(r.registerItem(mk()).reason, 'unknown-category');
});
t('duplicate ID ditolak: beda isi = duplicate-id, identik = duplicate-registration', () => {
  const r = fresh(); assert.ok(r.registerItem(mk()).ok);
  assert.strictEqual(r.registerItem(mk({ name: 'Lain' })).reason, 'duplicate-id');
  assert.strictEqual(r.registerItem(mk()).reason, 'duplicate-registration');
  assert.strictEqual(r.getAll().length, 1);
  assert.strictEqual(r.getItem('frame.a').name, 'Frame A');   /* yang pertama tidak tertimpa */
});
t('manifest tidak valid ditolak (id/kind/name/rarity/price/gems/visual/assets)', () => {
  const r = fresh();
  const bad = [
    mk({ id: '' }), mk({ id: '  ' }), mk({ id: 'tanpatitik' }), mk({ id: 'frame.' }), mk({ id: 'Frame.A' }), mk({ id: 'dice.a' }),
    mk({ id: 'frame.a', gameKey: 'b' }), mk({ name: '' }), mk({ name: 5 }), mk({ name: 'x'.repeat(61) }),
    mk({ rarity: 'langka' }), mk({ rarity: undefined }), mk({ price: -1 }), mk({ price: 1.5 }), mk({ price: '5' }), mk({ gems: -3 }),
    mk({ starter: 'ya' }), mk({ visual: null }), mk({ visual: [] }), mk({ assets: 'x.webp' }), mk({ assets: undefined }), null, [], 'str'
  ];
  bad.forEach((m, i) => { const res = r.registerItem(m); assert.strictEqual(res.ok, false, 'kasus ' + i + ' seharusnya ditolak'); });
  assert.strictEqual(r.getAll().length, 0);
  assert.strictEqual(r.rejected().length, bad.length);
});
t('kind tidak sesuai kategori ditolak oleh validateManifest', () => {
  const v = IR.validateManifest(mk({ kind: 'dice', id: 'dice.a' }), CAT);
  assert.strictEqual(v.ok, false); assert.ok(v.errors.some(e => /kind/.test(e)));
});
t('validateManifest: murni & tidak melempar; mengembalikan semua error sekaligus', () => {
  assert.doesNotThrow(() => IR.validateManifest(undefined));
  const v = IR.validateManifest({}, CAT); assert.ok(v.errors.length >= 5);
  assert.strictEqual(IR.validateManifest(mk(), CAT).ok, true);
  assert.strictEqual(IR.validateManifest(mk({ price: null, gems: 450 }), CAT).ok, true);
});
t('validateAssetPaths: hanya FORMAT; path buruk ditolak, path baik lolos (tanpa cek file)', () => {
  const ok = ['data/frame/a.webp', 'assets/audio/sfx/dice/dice-roll.mp3', 'a_b-c/d.png'];
  const bad = ['', '/abs/a.webp', 'http://x/a.webp', '//cdn/a.webp', 'C:/a.webp', '../a.webp', 'a/../b.webp', 'a b/c.webp', 'a\\b.webp', 'a/b', 'a/b.exe', 'a//b.webp'];
  ok.forEach(p => assert.strictEqual(IR.validateAssetPaths(mk({ assets: { image: p } }), CAT).ok, true, p));
  bad.forEach(p => assert.strictEqual(IR.validateAssetPaths(mk({ assets: { image: p } }), CAT).ok, false, p));
  assert.strictEqual(IR.validateAssetPaths(mk({ assets: { image: 'a.webp', audio: { roll: 'x.mp3' }, list: ['b.png'] } }), CAT).ok, true);
  assert.strictEqual(IR.validateAssetPaths(mk({ assets: { audio: { roll: '../x.mp3' } } }), CAT).ok, false);
  assert.strictEqual(IR.validateAssetPaths(mk({ assets: { n: 5 } }), CAT).ok, false);
  /* path 'sah' secara format BUKAN bukti file ada / bisa dimuat */
  assert.strictEqual(IR.validateAssetPaths(mk({ assets: { image: 'tidak/ada/sama-sekali.webp' } }), CAT).ok, true);
});
t('registerItem: path aset buruk ditolak dengan reason invalid-asset-path', () => {
  const r = fresh(); const res = r.registerItem(mk({ assets: { image: '../x.webp' } }));
  assert.strictEqual(res.ok, false); assert.strictEqual(res.reason, 'invalid-asset-path');
});
t('getItem: tepat; ID tak dikenal/aneh -> null (tanpa melempar, tanpa prototype leak)', () => {
  const r = fresh(); r.registerItem(mk());
  assert.strictEqual(r.getItem('frame.a').id, 'frame.a');
  ['frame.x', '', null, undefined, 5, {}, 'constructor', '__proto__', 'toString'].forEach(x => assert.strictEqual(r.getItem(x), null));
  assert.strictEqual(r.has('frame.a'), true); assert.strictEqual(r.has('frame.x'), false);
});
t('getItemOrFallback: ID hilang/ditolak -> item fallback kategori; tanpa fallback terdaftar -> null', () => {
  const r = fresh();
  assert.strictEqual(r.getItemOrFallback('frame.x'), null);          /* fallbackId belum terdaftar */
  r.registerItem(mk({ id: 'frame.default', name: 'Default' }));
  assert.strictEqual(r.getItemOrFallback('frame.x').id, 'frame.default');
  r.registerItem(mk({ id: 'frame.rusak', rarity: 'xx' }));           /* ditolak */
  assert.strictEqual(r.getItemOrFallback('frame.rusak').id, 'frame.default');
  assert.strictEqual(r.getItemOrFallback('dice.a'), null);            /* kategori lain tak punya fallback */
  assert.strictEqual(r.getItemOrFallback(null), null);
});
t('getCategory / getAll: isi, urutan registrasi, filter kind, null untuk kategori tak ada', () => {
  const r = fresh(); r.registerCategory({ key: 'dice', kind: 'dice' });
  r.registerItem(mk({ id: 'frame.b' })); r.registerItem(mk({ id: 'dice.x', kind: 'dice' })); r.registerItem(mk({ id: 'frame.a' }));
  const c = r.getCategory('frame');
  assert.strictEqual(c.count, 2); assert.deepStrictEqual(c.items.map(i => i.id), ['frame.b', 'frame.a']);
  assert.deepStrictEqual(r.getCategory('dice').items.map(i => i.id), ['dice.x']);
  assert.deepStrictEqual(r.getAll().map(i => i.id), ['frame.b', 'dice.x', 'frame.a']);
  assert.deepStrictEqual(r.getAll('frame').map(i => i.id), ['frame.b', 'frame.a']);
  assert.strictEqual(r.getCategory('tidakada'), null); assert.strictEqual(r.getCategory(null), null);
  c.items.push('x'); assert.strictEqual(r.getCategory('frame').count, 2);   /* hasil adalah salinan array */
});
t('rarities kustom per kategori dihormati', () => {
  const r = IR.create(); r.registerCategory({ key: 'k', kind: 'k', rarities: ['a', 'b'] });
  assert.strictEqual(r.registerItem(mk({ id: 'k.x', kind: 'k', rarity: 'common' })).ok, false);
  assert.strictEqual(r.registerItem(mk({ id: 'k.x', kind: 'k', rarity: 'a' })).ok, true);
});
t('checkCompleteness: item hilang, item ekstra, metadata anjuran kosong', () => {
  const r = fresh(); r.registerItem(mk({ id: 'frame.a' })); r.registerItem(mk({ id: 'frame.b', desc: undefined }));
  const c = r.checkCompleteness('frame', ['frame.a', 'frame.c']);
  assert.deepStrictEqual(c.missing, ['frame.c']); assert.deepStrictEqual(c.extra, ['frame.b']);
  assert.ok(c.incomplete.some(x => x.id === 'frame.a' && x.missing.indexOf('desc') >= 0));
});
t('instance terisolasi; shared() singleton; tidak bergantung pada DOM/global', () => {
  const a = IR.create(), b = IR.create(); a.registerCategory(CAT);
  assert.strictEqual(b.categories().length, 0);
  assert.strictEqual(IR.shared(), IR.shared());
  assert.strictEqual(typeof window, 'undefined'); assert.strictEqual(typeof document, 'undefined');
});
console.log('\n' + n + ' tes lulus');

