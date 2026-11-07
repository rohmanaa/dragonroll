/* Tes gear di PlayerData. Jalankan: node tests/gear-player-data.test.js */
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

t('pemain baru memiliki gear starter, belum memakai gear apa pun', () => {
  const { PD } = boot();
  assert.ok(PD.owns('gear.top.tee') && PD.owns('gear.legs.pants') && PD.owns('gear.boots.shoes'));
  assert.strictEqual(Object.keys(PD.gearLook()).length, 0);
});
t('equip gear milik sendiri berhasil; gear belum dimiliki ditolak', () => {
  const { PD } = boot();
  assert.strictEqual(PD.equip('gear.top.tee').ok, true);
  assert.strictEqual(PD.gearLook()['g.top'].id, 'gear.top.tee');
  assert.strictEqual(PD.equip('gear.helm.crown').reason, 'belum-dimiliki');
  assert.strictEqual(PD.gearLook()['g.helm'], undefined);
});
t('beli gear lokal: koin berkurang sesuai harga katalog lalu bisa dipakai', () => {
  const { PD, IC } = boot(), it = IC.byId('gear.helm.straw'), before = PD.coins();
  assert.strictEqual(PD.purchase(it.id).ok, true);
  assert.strictEqual(PD.coins(), before - it.price);
  assert.strictEqual(PD.equip(it.id).ok, true);
  assert.strictEqual(PD.purchase(it.id).reason, 'sudah-dimiliki');
});
t('unequip hanya untuk slot gear', () => {
  const { PD } = boot(); PD.equip('gear.top.tee');
  assert.strictEqual(PD.unequip('g.top').ok, true);
  assert.strictEqual(Object.keys(PD.gearLook()).length, 0);
  assert.strictEqual(PD.unequip('skin').reason, 'bukan-slot-gear');
  assert.strictEqual(PD.equippedId('skin'), 'skin.steve');
});
t('aksesori: beberapa dipakai sekaligus (satu slot per aksesori)', () => {
  const { PD } = boot(); PD.grant({ item: 'gear.acc.belt' }); PD.grant({ item: 'gear.acc.pack' });
  PD.equip('gear.acc.belt'); PD.equip('gear.acc.pack');
  const l = PD.gearLook(); assert.ok(l['g.acc.belt'] && l['g.acc.pack']);
});
t('pewarna: hanya gear milik sendiri, bentuk id divalidasi', () => {
  const { PD } = boot();
  assert.strictEqual(PD.setGearDye('gear.top.tee', 'blue').ok, true);
  PD.equip('gear.top.tee'); assert.strictEqual(PD.gearLook()['g.top'].dye, 'blue');
  assert.strictEqual(PD.setGearDye('gear.helm.crown', 'gold').reason, 'belum-dimiliki');
  assert.strictEqual(PD.setGearDye('gear.top.tee', '<script>').reason, 'warna-tidak-valid');
  assert.strictEqual(PD.setGearDye('skin.steve', 'blue').reason, 'bukan-gear');
});
t('save yang diedit (gear tak dimiliki / id palsu / dye rusak) dibersihkan saat dimuat', () => {
  const a = boot(); a.PD.equip('gear.top.tee');
  const key = Object.keys(a.store).find(k => /player/.test(k)), st = JSON.parse(a.store[key]);
  st.equipped['g.helm'] = 'gear.helm.crown'; st.equipped['g.top'] = 'gear.top.tee'; st.equipped['g.cape'] = 'gear.legs.pants';
  st.gearDye = { 'gear.top.tee': 'red', 'gear.helm.crown': 'gold', 'x': 'y', 'gear.top.tee2': '!!' };
  const b = boot({ [key]: JSON.stringify(st) });
  const l = b.PD.gearLook();
  assert.strictEqual(JSON.stringify(Object.keys(l)), '["g.top"]');
  assert.strictEqual(l['g.top'].dye, 'red');
});
console.log(n + ' tes lulus');
