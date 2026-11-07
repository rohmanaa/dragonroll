/* Tes outfit pribadi di PlayerData (tahap a). Jalankan: node tests/outfits-player-data.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function boot(store) {
  store = Object.assign({}, store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  return { PD: ctx.PlayerData, IC: ctx.ItemCatalog, store };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const none = { id: 'none' };
const base = (o) => Object.assign({ gender: 'm', top: { id: 'tee', dye: 'blue' }, legs: { id: 'pants', dye: 'navy' }, boots: { id: 'shoes', dye: 'brown' },
  helm: none, chest: none, shoulder: none, cape: none, weapon: none, accessories: [] }, o || {});
const keyOf = s => Object.keys(s).find(k => /player/.test(k));
const own = (PD, ...ids) => ids.forEach(id => PD.grant({ item: id }));

t('pemain baru: belum punya outfit, batas 5 slot', () => {
  const { PD } = boot();
  assert.deepStrictEqual(PD.outfits(), []);
  assert.strictEqual(PD.outfitLimit, 5);
});
t('simpan outfit: masuk slot 0, tersimpan lintas muat ulang', () => {
  const a = boot(); const r = a.PD.saveOutfit('Harian', base());
  assert.deepStrictEqual([r.ok, r.slot], [true, 0]);
  const b = boot(a.store), o = b.PD.outfits();
  assert.strictEqual(o.length, 1);
  assert.strictEqual(o[0].name, 'Harian');
  assert.strictEqual(o[0].data.top.dye, 'blue');
  assert.strictEqual(o[0].data.gender, 'm');
});
t('maksimal 5 slot; slot ke-6 ditolak; slot kosong dipakai ulang setelah hapus', () => {
  const { PD } = boot();
  for (let i = 0; i < 5; i++) assert.strictEqual(PD.saveOutfit('O' + i, base()).slot, i);
  assert.strictEqual(PD.saveOutfit('O5', base()).reason, 'slot-penuh');
  assert.strictEqual(PD.deleteOutfit(2).ok, true);
  assert.strictEqual(PD.outfits().length, 4);
  assert.strictEqual(PD.saveOutfit('Baru', base()).slot, 2);
  assert.deepStrictEqual(PD.outfits().map(o => o.slot), [0, 1, 2, 3, 4]);
});
t('ganti nama dan hapus; slot tidak ada ditolak', () => {
  const { PD } = boot(); PD.saveOutfit('A', base());
  assert.strictEqual(PD.renameOutfit(0, '  Nama Baru  ').ok, true);
  assert.strictEqual(PD.outfits()[0].name, 'Nama Baru');
  assert.strictEqual(PD.renameOutfit(0, '   ').reason, 'nama-kosong');
  assert.strictEqual(PD.renameOutfit(3, 'X').reason, 'tidak-ada');
  assert.strictEqual(PD.deleteOutfit(3).reason, 'tidak-ada');
  assert.strictEqual(PD.deleteOutfit(0).ok, true);
  assert.deepStrictEqual(PD.outfits(), []);
});
t('nama dibersihkan: kontrol/tag dibuang, dipotong 16 karakter, kosong ditolak', () => {
  const { PD } = boot();
  assert.strictEqual(PD.saveOutfit('', base()).reason, 'nama-kosong');
  assert.strictEqual(PD.saveOutfit(123, base()).reason, 'nama-kosong');
  PD.saveOutfit('<b>Hai</b>\n\tdunia ' + 'x'.repeat(40), base());
  const nm = PD.outfits()[0].name;
  assert.ok(nm.length <= 16 && !/[<>\n\t]/.test(nm) && nm.indexOf('bHai') === 0, nm);
});
t('item belum dimiliki ditolak saat menyimpan; setelah dimiliki diterima', () => {
  const { PD } = boot();
  const d = base({ helm: { id: 'crown', dye: 'gold' } });
  const r = PD.saveOutfit('Raja', d);
  assert.strictEqual(r.reason, 'belum-dimiliki');
  assert.strictEqual(r.item.id, 'gear.helm.crown');
  assert.strictEqual(PD.outfits().length, 0);
  own(PD, 'gear.helm.crown');
  assert.strictEqual(PD.saveOutfit('Raja', d).ok, true);
});
t('item beda gender ditolak; item tidak dikenal ditolak; "none" untuk bagian kosong diterima', () => {
  const { PD } = boot(); own(PD, 'gear.top.dress');
  assert.strictEqual(PD.saveOutfit('X', base({ top: { id: 'dress', dye: 'pink' } })).reason, 'gender-tidak-cocok');
  assert.strictEqual(PD.saveOutfit('X', base({ top: { id: 'zzz' } })).reason, 'item-tidak-dikenal');
  assert.strictEqual(PD.saveOutfit('X', base({ gender: 'f', top: { id: 'dress', dye: 'pink' }, legs: { id: 'skirt' }, boots: { id: 'mary' } })).ok, true);
  assert.strictEqual(PD.saveOutfit('Y', base()).ok, true);
});
t('aksesori: harus dimiliki, duplikat digabung', () => {
  const { PD } = boot();
  const d = base({ accessories: [{ id: 'belt', dye: 'brown' }, { id: 'belt', dye: 'red' }] });
  assert.strictEqual(PD.saveOutfit('B', d).reason, 'belum-dimiliki');
  own(PD, 'gear.acc.belt');
  assert.strictEqual(PD.saveOutfit('B', d).ok, true);
  assert.strictEqual(PD.outfits()[0].data.accessories.length, 1);
});
t('data rusak ditolak; id/warna berbahaya dibersihkan', () => {
  const { PD } = boot();
  assert.strictEqual(PD.saveOutfit('X', null).reason, 'data-tidak-valid');
  assert.strictEqual(PD.saveOutfit('X', base({ gender: 'x' })).reason, 'data-tidak-valid');
  assert.strictEqual(PD.saveOutfit('X', [1, 2]).reason, 'data-tidak-valid');
  assert.strictEqual(PD.saveOutfit('X', base({ top: { id: 'tee', dye: '<script>' } })).ok, true);
  assert.strictEqual(PD.outfits()[0].data.top.dye, undefined);
  assert.strictEqual(PD.saveOutfit('Y', base({ top: { id: '../x' } })).ok, true);   /* id tidak valid -> bagian kosong */
  assert.strictEqual(PD.outfits()[1].data.top.id, 'none');
});
t('salinan: mengubah hasil outfits() tidak mengubah data tersimpan', () => {
  const { PD } = boot(); PD.saveOutfit('A', base());
  const o = PD.outfits(); o[0].name = 'HACK'; o[0].data.top.id = 'robe';
  assert.strictEqual(PD.outfits()[0].name, 'A');
  assert.strictEqual(PD.outfits()[0].data.top.id, 'tee');
});
t('save yang diedit dibersihkan saat dimuat (slot ganda/di luar rentang, nama kosong, data rusak), maks 5', () => {
  const a = boot(); a.PD.saveOutfit('A', base());
  const key = keyOf(a.store), st = JSON.parse(a.store[key]), good = st.outfits[0];
  st.outfits = [good, Object.assign({}, good, { name: 'Dobel' }), Object.assign({}, good, { slot: 9 }), Object.assign({}, good, { slot: 1, name: '  ' }),
    Object.assign({}, good, { slot: 2, data: { gender: 'q' } }), 'x', null, Object.assign({}, good, { slot: 4, name: 'Ok' })];
  const b = boot({ [key]: JSON.stringify(st) });
  assert.deepStrictEqual(b.PD.outfits().map(o => [o.slot, o.name]), [[0, 'A'], [4, 'Ok']]);
});
t('save lama tanpa outfits dimuat sebagai daftar kosong', () => {
  const a = boot(); a.PD.setName('Budi');
  const key = keyOf(a.store), st = JSON.parse(a.store[key]); delete st.outfits;
  const b = boot({ [key]: JSON.stringify(st) });
  assert.deepStrictEqual(b.PD.outfits(), []);
});
t('outfit dengan item belum dimiliki tetap disimpan saat dimuat (untuk preview & beli)', () => {
  const a = boot(); own(a.PD, 'gear.helm.crown'); a.PD.saveOutfit('Raja', base({ helm: { id: 'crown', dye: 'gold' } }));
  const key = keyOf(a.store), st = JSON.parse(a.store[key]); delete st.inventory['gear.helm.crown'];
  const b = boot({ [key]: JSON.stringify(st) });
  assert.strictEqual(b.PD.owns('gear.helm.crown'), false);
  assert.strictEqual(b.PD.outfits().length, 1);
  assert.strictEqual(b.PD.outfits()[0].data.helm.id, 'crown');
});
t('pemberitahuan perubahan: subscribe menerima "outfits"', () => {
  const { PD } = boot(), seen = []; PD.subscribe(r => seen.push(r));
  PD.saveOutfit('A', base()); PD.renameOutfit(0, 'B'); PD.deleteOutfit(0);
  assert.deepStrictEqual(seen, ['outfits', 'outfits', 'outfits']);
});
t('outfit tidak mengubah gear/equip yang sedang dipakai', () => {
  const { PD } = boot(); PD.equip('gear.top.tee');
  PD.saveOutfit('A', base({ legs: { id: 'bare' } }));
  assert.deepStrictEqual(Object.keys(PD.gearLook()), ['g.top']);
});
console.log('\n' + n + ' tes lulus');
