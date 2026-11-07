/* Tes katalog gear karakter. Jalankan: node tests/gear-catalog.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const w = {}; new Function('window', fs.readFileSync(path.join(__dirname, '../assets/js/item-catalog.js'), 'utf8'))(w);
const C = w.ItemCatalog, gear = C.items.filter(i => i.kind === 'gear');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

t('gear ada dan ID unik berformat gear.<bagian>.<kunci>', () => {
  assert.ok(gear.length > 0);
  gear.forEach(i => assert.ok(/^gear\.[a-z]+\.[a-z]+$/.test(i.id) && i.id === 'gear.' + i.part + '.' + i.gameKey, i.id));
});
t('harga & sumber konsisten: starter gratis, shop berharga > 0, quest/event tanpa harga', () => {
  gear.forEach(i => {
    if (i.source === 'starter') assert.ok(i.starter && i.price === 0, i.id);
    else if (i.source === 'shop') assert.ok(!i.starter && i.price > 0, i.id);
    else assert.ok(['quest', 'event'].includes(i.source) && i.price === null, i.id);
  });
});
t('slot: satu slot per bagian, aksesori satu slot per item', () => {
  gear.forEach(i => assert.strictEqual(i.slot, i.part === 'acc' ? 'g.acc.' + i.gameKey : 'g.' + i.part, i.id));
});
t('tiap gender punya baju+celana+sepatu starter (builder tidak pernah telanjang)', () => {
  ['m', 'f'].forEach(g => ['top', 'legs', 'boots'].forEach(p =>
    assert.ok(gear.some(i => i.part === p && i.starter && (!i.g || i.g === g)), g + ' ' + p)));
});
t('slot yang tidak ada di builder (aura/trail/spawn_effect/idle_animation) tidak masuk katalog', () => {
  ['aura', 'trail', 'spawn_effect', 'idle_animation', 'bundle'].forEach(p => assert.ok(!gear.some(i => i.part === p), p));
});
t('item non-gear tidak berubah (slot lama tetap)', () => {
  assert.strictEqual(C.byId('skin.steve').slot, 'skin');
  assert.strictEqual(C.byId('frame.gold').slot, 'frame');
  assert.strictEqual(C.byId('tnt').slot, null);
});
console.log(n + ' tes lulus');
