/* Tes gear di PlayerData. Jalankan: node tests/gear-player-data.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function boot(store) {
  store = Object.assign({}, store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['session.js', 'item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  ctx.PlayerData.__store = store;
  return { PD: ctx.PlayerData, IC: ctx.ItemCatalog, store };
}
const own = (PD, ...ids) => { PD.coins(); const k = PD.key, st = JSON.parse(PD.__store[k]);   /* Tahap 3c: PD.grant item dihapus; seed inventory langsung ke storage */
  ids.forEach(id => { st.inventory[id] = { qty: 1, acquiredAt: Date.now(), seq: st.nextSeq++ }; }); PD.__store[k] = JSON.stringify(st); };
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
t('Tahap 3c: PD.purchase/purchaseSet lokal ditolak (tanpa akun: belum-login; akun: server-wallet); gear milik bisa dipakai', () => {
  const { PD, IC } = boot(), it = IC.byId('gear.helm.straw'), before = PD.coins();
  assert.strictEqual(PD.purchase(it.id).reason, 'belum-login');
  assert.strictEqual(PD.purchaseSet([it.id]).reason, 'belum-login');
  assert.strictEqual(PD.coins(), before); assert.strictEqual(PD.owns(it.id), false);
  const acc = boot({ 'ut-auth': JSON.stringify({ id: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb', username: 't' }) }).PD;
  assert.strictEqual(acc.purchase(it.id).reason, 'server-wallet');
  own(PD, it.id); assert.strictEqual(PD.owns(it.id), true); assert.strictEqual(PD.equip(it.id).ok, true);
});
t('unequip hanya untuk slot gear', () => {
  const { PD } = boot(); PD.equip('gear.top.tee');
  assert.strictEqual(PD.unequip('g.top').ok, true);
  assert.strictEqual(Object.keys(PD.gearLook()).length, 0);
  assert.strictEqual(PD.unequip('skin').reason, 'bukan-slot-gear');
  assert.strictEqual(PD.equippedId('skin'), 'skin.steve');
});
t('aksesori: beberapa dipakai sekaligus (satu slot per aksesori)', () => {
  const { PD } = boot(); own(PD, 'gear.acc.belt', 'gear.acc.pack');
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

/* ---- look ---- */
const LOOK = { gender: 'f', skin: 's3', eyes: { id: 'lash', dye: 'blue' }, hair: { id: 'bob', dye: 'brown' }, body: { height: 1.05, build: 1 } };
t('look: awalnya null; setLook valid tersimpan dan terbaca', () => {
  const { PD } = boot(); assert.strictEqual(PD.look(), null);
  assert.strictEqual(PD.setLook(LOOK).ok, true);
  assert.strictEqual(PD.look().hair.id, 'bob'); assert.strictEqual(PD.look().gender, 'f');
});
t('look: data rusak ditolak seluruhnya dan tidak mengubah yang lama', () => {
  const { PD } = boot(); PD.setLook(LOOK);
  [{ ...LOOK, gender: 'x' }, { ...LOOK, skin: 's9' }, { ...LOOK, eyes: { id: '<b>', dye: 'blue' } }, null, 'a'].forEach(bad =>
    assert.strictEqual(PD.setLook(bad).reason, 'look-tidak-valid'));
  assert.strictEqual(PD.look().skin, 's3');
});
t('look: tinggi/badan dibatasi rentang builder', () => {
  const { PD } = boot(); PD.setLook({ ...LOOK, body: { height: 9, build: -3 } });
  assert.strictEqual(PD.look().body.height, 1.1); assert.strictEqual(PD.look().body.build, 1);
});
console.log(n + ' tes lulus');
