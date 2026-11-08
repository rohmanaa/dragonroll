/* Tes katalog Aura: 15 aura = kind 'aura' (slot opsional 'aura'), id sama dengan aura-fx.js, harga naik per rarity, seed server sinkron.
   Jalankan: node tests/aura-catalog.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(root, p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const w = {}; new Function('window', rd('assets/js/item-catalog.js'))(w); const IC = w.ItemCatalog;
const auras = IC.items.filter(i => i.kind === 'aura');
const fxIds = [...rd('assets/js/aura-fx.js').matchAll(/\{ id: '(\w+)', name: '[^']+', rarity: '(\w+)'/g)].map(m => [m[1], m[2]]);
t('15 aura di katalog, id & rarity sama dengan aura-fx.js', () => {
  assert.strictEqual(auras.length, 15); assert.strictEqual(fxIds.length, 15);
  fxIds.forEach(([id, r]) => { const it = IC.byId('aura.' + id); assert.ok(it, id); assert.strictEqual(it.rarity, r); assert.strictEqual(it.gameKey, id); });
});
t('aura dijual (harga > 0, bukan starter) dan memakai slot opsional "aura"', () => {
  auras.forEach(a => { assert.ok(a.price > 0 && !a.starter && !a.stackable, a.id); assert.strictEqual(a.slot, 'aura'); assert.strictEqual(a.category, 'efek'); });
  assert.ok(IC.optionalSlots().indexOf('aura') >= 0);
  assert.strictEqual(IC.defaultEquipped.aura, undefined, 'tidak ada aura bawaan');
});
t('harga tidak turun saat rarity naik', () => {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'];
  const min = r => Math.min.apply(null, auras.filter(a => a.rarity === r).map(a => a.price));
  for (let i = 1; i < order.length; i++) assert.ok(min(order[i]) >= min(order[i - 1]), order[i]);
});
t('migrasi aura memuat semua aura dengan harga yang sama dan slot equip "aura"', () => {
  const sql = rd('supabase/migrations/202611200001_aura_catalog.sql');
  auras.forEach(a => assert.ok(sql.indexOf("('" + a.id + "', 'aura', " + a.price + ", false, false)") >= 0, a.id));
  assert.ok(/when 'aura' then 'aura'/.test(sql));
});
/* ---- PlayerData: equip/lepas aura ---- */
function boot() {
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['session.js', 'item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(rd('assets/js/' + f), ctx));
  return { PD: ctx.PlayerData, store };
}
const own = (PD, store, ...ids) => { PD.coins(); const st = JSON.parse(store[PD.key]); ids.forEach(id => { st.inventory[id] = { qty: 1, acquiredAt: Date.now(), seq: st.nextSeq++ }; }); store[PD.key] = JSON.stringify(st); };
t('aura belum dimiliki tidak bisa dipakai; setelah dimiliki bisa dipakai, ikut appearance(), dan bisa dilepas', () => {
  const { PD, store } = boot();
  assert.strictEqual(PD.equip('aura.flame').reason, 'belum-dimiliki');
  own(PD, store, 'aura.flame', 'aura.frost');
  assert.strictEqual(PD.equip('aura.flame').ok, true);
  assert.strictEqual(PD.equippedId('aura'), 'aura.flame');
  assert.strictEqual(PD.appearance().equipped.aura, 'aura.flame');
  assert.strictEqual(PD.equip('aura.frost').ok, true);           /* satu aura aktif: yang baru menggantikan */
  assert.strictEqual(PD.equippedId('aura'), 'aura.frost');
  assert.strictEqual(PD.unequip('aura').ok, true);
  assert.strictEqual(PD.equippedId('aura'), null);
  assert.strictEqual(PD.appearance().equipped.aura, undefined);
});
t('pembelian aura lokal tanpa akun ditolak (harga dipegang server)', () => {
  const { PD } = boot();
  assert.strictEqual(PD.purchase('aura.nature').ok, false);
});
console.log(n + ' tes lulus');
