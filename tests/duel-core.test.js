const assert = require('assert');
const D = require('../gameplay/js/duel-core.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const types = r => r.events.map(e => e.type);
const A = 1, DF = 3, H = 5; /* nilai dadu mewakili aksi */

t('Safe Tile: START dan petak akhir tidak memicu duel', () => {
  assert.strictEqual(D.isSafeTile(0, 100), true);
  assert.strictEqual(D.isSafeTile(1, 100), true);
  assert.strictEqual(D.isSafeTile(100, 100), true);
  assert.strictEqual(D.isSafeTile(2, 100), false);
});
t('awal duel: 3 hati, 3 ronde', () => {
  const s = D.create(); assert.deepStrictEqual(s.hp, [3, 3]); assert.strictEqual(s.cfg.maxRounds, 3);
});
t('nilai dadu di luar 1-6 ditolak', () => {
  assert.throws(() => D.round(D.create(), [0, 3])); assert.throws(() => D.round(D.create(), [3, 7]));
});
t('dadu dipetakan 2 sisi per aksi', () => {
  [1, 2].forEach(v => assert.strictEqual(D.ACTIONS[v].id, 'attack'));
  [3, 4].forEach(v => assert.strictEqual(D.ACTIONS[v].id, 'defense'));
  [5, 6].forEach(v => assert.strictEqual(D.ACTIONS[v].id, 'heal'));
});
t('Attack vs Attack: saling kena 1', () => {
  const r = D.round(D.create(), [A, A]); assert.deepStrictEqual(r.state.hp, [2, 2]); assert.ok(types(r).includes('clash'));
});
t('Defense menahan Attack', () => {
  const r = D.round(D.create(), [A, DF]); assert.deepStrictEqual(r.state.hp, [3, 3]); assert.ok(types(r).includes('block'));
});
t('Attack vs Heal: serangan masuk, Heal gagal', () => {
  const r = D.round(D.create(), [H, A]); assert.deepStrictEqual(r.state.hp, [2, 3]);
});
t('Heal vs Defense: Heal berhasil, tidak lebih dari 3 hati', () => {
  let r = D.round(Object.assign(D.create(), { hp: [2, 3] }), [H, DF]); assert.strictEqual(r.state.hp[0], 3);
  r = D.round(D.create(), [H, DF]); assert.strictEqual(r.state.hp[0], 3);
});
t('Heal vs Heal: keduanya +1', () => {
  const r = D.round(Object.assign(D.create(), { hp: [1, 2] }), [H, H]); assert.deepStrictEqual(r.state.hp, [2, 3]);
});
t('Defense vs Defense: tidak ada yang terjadi', () => {
  const r = D.round(D.create(), [DF, DF]); assert.deepStrictEqual(r.state.hp, [3, 3]);
});
t('selesai tepat setelah ronde 3, tidak ada ronde ke-4', () => {
  let s = D.create();
  s = D.round(s, [DF, DF]).state; s = D.round(s, [DF, DF]).state;
  assert.strictEqual(s.over, false);
  s = D.round(s, [DF, DF]).state;
  assert.strictEqual(s.over, true); assert.strictEqual(s.round, 3);
  assert.throws(() => D.round(s, [A, A]));
});
t('setelah ronde 3: hati lebih banyak menang', () => {
  let x = D.round(D.create(), [A, H]).state; /* p1 kena 1, Heal gagal -> [3,2] */
  x = D.round(x, [DF, DF]).state; x = D.round(x, [DF, DF]).state;
  assert.strictEqual(x.over, true); assert.strictEqual(x.winner, 0);
});
t('hati sama setelah ronde 3 = draw', () => {
  let s = D.create(); for (let i = 0; i < 3; i++) s = D.round(s, [DF, DF]).state;
  assert.strictEqual(s.draw, true); assert.strictEqual(s.winner, null);
});
t('hati 0 = kalah lebih awal', () => {
  let s = Object.assign(D.create(), { hp: [3, 1] });
  const r = D.round(s, [A, A]); /* kedua attack: p1 jadi 0, p0 jadi 2 */
  assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.winner, 0);
});
t('kedua hati 0 di ronde sama = draw', () => {
  const r = D.round(Object.assign(D.create(), { hp: [1, 1] }), [A, A]);
  assert.strictEqual(r.state.draw, true);
});
t('hasil menang: menang bertahan, kalah mundur 5 petak + hadiah kecil', () => {
  let s = Object.assign(D.create(), { hp: [3, 1] }); s = D.round(s, [A, DF]).state; s = D.round(s, [A, A]).state;
  const o = D.outcome(s, { pos: 30, goal: 100 });
  assert.strictEqual(o.draw, false); assert.strictEqual(o.winner, 0); assert.strictEqual(o.to, 25); assert.strictEqual(o.back, 5);
  assert.ok(o.xp.winner > o.xp.loser && o.xp.loser > 0); assert.strictEqual(o.skipTurn, false);
});
t('mundur tidak pernah di bawah petak 1', () => {
  const s = Object.assign(D.create(), { over: true, winner: 0, loser: 1 });
  assert.strictEqual(D.outcome(s, { pos: 3, goal: 100 }).to, 1);
});
t('draw: tanpa hadiah dan tidak ada yang mundur', () => {
  let s = D.create(); for (let i = 0; i < 3; i++) s = D.round(s, [DF, DF]).state;
  const o = D.outcome(s, { pos: 40, goal: 100 });
  assert.strictEqual(o.draw, true); assert.strictEqual(o.back, 0); assert.strictEqual(o.to, 40);
  assert.strictEqual(o.xp.winner, 0); assert.strictEqual(o.xp.loser, 0);
});
t('play(): selalu selesai dalam maksimal 3 ronde', () => {
  for (let i = 0; i < 300; i++) { const r = D.play(D.create()); assert.strictEqual(r.state.over, true); assert.ok(r.state.round <= 3); }
});
console.log('\n' + n + ' tes duel-core lulus');
