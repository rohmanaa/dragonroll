const assert = require('assert');
const D = require('../gameplay/js/duel-core.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const types = r => r.events.map(e => e.type);
/* rumus: dmg = 6 + (menang-kalah)*5 (+8 bila menang=6); giliran ke-3 x1.8; lawan dadu 2 -> x0.45 (min 3) */

t('Safe Tile: START dan petak akhir tidak memicu duel', () => {
  assert.strictEqual(D.isSafeTile(0, 100), true);
  assert.strictEqual(D.isSafeTile(1, 100), true);
  assert.strictEqual(D.isSafeTile(100, 100), true);
  assert.strictEqual(D.isSafeTile(2, 100), false);
});
t('awal duel: HP 100 masing-masing, 3 giliran', () => {
  const s = D.create(); assert.deepStrictEqual(s.hp, [100, 100]); assert.strictEqual(s.cfg.maxRounds, 3); assert.strictEqual(s.round, 0);
});
t('nilai dadu di luar 1-6 ditolak', () => {
  assert.throws(() => D.round(D.create(), [0, 3])); assert.throws(() => D.round(D.create(), [3, 7])); assert.throws(() => D.round(D.create(), [2.5, 3]));
});
t('dadu dipetakan 1 MELESET .. 6 KRITIS', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map(v => D.ACTIONS[v].name), ['MELESET', 'TANGKIS', 'SERANG', 'SERANG KUAT', 'SKILL', 'KRITIS!']);
});
t('dadu lebih besar menyerang: damage = 6 + selisih*5', () => {
  const r = D.round(D.create(), [5, 3]); assert.strictEqual(r.turn.winner, 0); assert.strictEqual(r.turn.dmg, 16); assert.deepStrictEqual(r.state.hp, [100, 84]);
  const q = D.round(D.create(), [3, 4]); assert.strictEqual(q.turn.winner, 1); assert.deepStrictEqual(q.state.hp, [89, 100]);
});
t('dadu 6 memberi bonus +8', () => {
  assert.strictEqual(D.round(D.create(), [6, 3]).turn.dmg, 6 + 15 + 8);
});
t('dadu lawan 2 = TANGKIS: damage x0.45 (min 3) dan event block', () => {
  const r = D.round(D.create(), [5, 2]); assert.strictEqual(r.turn.blocked, true); assert.strictEqual(r.turn.dmg, 9); assert.ok(types(r).includes('block'));
  assert.strictEqual(D.damage(2, 1, false).dmg, 11);   /* menang dgn 2 vs 1 bukan tangkis */
});
t('dadu kembar = IMBANG, tanpa damage', () => {
  const r = D.round(D.create(), [4, 4]); assert.strictEqual(r.turn.winner, null); assert.deepStrictEqual(r.state.hp, [100, 100]); assert.ok(types(r).includes('clash'));
});
t('giliran ke-3 = pamungkas x1.8', () => {
  let s = D.create(); s = D.round(s, [3, 3]).state; s = D.round(s, [3, 3]).state;
  const r = D.round(s, [4, 3]); assert.strictEqual(r.turn.ult, true); assert.strictEqual(r.turn.dmg, Math.round(11 * 1.8));
  assert.strictEqual(D.round(D.create(), [4, 3]).turn.ult, false);
});
t('hanya 3 giliran: setelah giliran ke-3 duel selesai (tanpa sudden death)', () => {
  let s = D.create(); for (let i = 0; i < 3; i++) s = D.round(s, [3, 3]).state;
  assert.strictEqual(s.over, true); assert.strictEqual(s.round, 3);
  assert.throws(() => D.round(s, [1, 2]));
});
t('SERI: HP sama setelah 3 giliran -> draw, tidak ada pemenang', () => {
  let s = D.create(); for (let i = 0; i < 3; i++) s = D.round(s, [2, 2]).state;
  assert.strictEqual(s.draw, true); assert.strictEqual(s.winner, null); assert.strictEqual(s.by, 'draw');
  const o = D.outcome(s, { pos: 30, goal: 100 });
  assert.strictEqual(o.draw, true); assert.strictEqual(o.to, 30); assert.strictEqual(o.back, 0); assert.deepStrictEqual(o.xp, { winner: 0, loser: 0 });
});
t('HP lebih banyak setelah giliran ke-3 menang', () => {
  let s = D.create(); s = D.round(s, [4, 3]).state; s = D.round(s, [2, 2]).state;
  const r = D.round(s, [3, 3]); assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.winner, 0); assert.strictEqual(r.state.by, 'hp');
  assert.ok(types(r).includes('decision'));
});
t('K.O. (HP 0) mengakhiri duel lebih awal', () => {
  const s = D.create({ maxHp: 10 }); const r = D.round(s, [6, 1]);
  assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.winner, 0); assert.strictEqual(r.state.loser, 1); assert.strictEqual(r.state.by, 'ko'); assert.strictEqual(r.state.hp[1], 0);
  assert.strictEqual(r.state.round, 1);
});
t('menang: bertahan di petak; kalah: mundur 5 petak', () => {
  let s = D.create({ maxHp: 10 }); s = D.round(s, [1, 6]).state;
  const o = D.outcome(s, { pos: 40, goal: 100 });
  assert.strictEqual(o.draw, false); assert.strictEqual(o.winner, 1); assert.strictEqual(o.loser, 0);
  assert.strictEqual(o.from, 40); assert.strictEqual(o.to, 35); assert.strictEqual(o.back, 5);
  assert.ok(o.xp.winner > o.xp.loser);
});
t('mundur tidak pernah di bawah petak 1', () => {
  let s = D.create({ maxHp: 10 }); s = D.round(s, [6, 1]).state;
  const o = D.outcome(s, { pos: 3, goal: 100 }); assert.strictEqual(o.to, 1); assert.strictEqual(o.back, 2);
});
t('outcome sebelum duel selesai ditolak', () => {
  assert.throws(() => D.outcome(D.create(), { pos: 5, goal: 100 }));
});
t('state tidak dimutasi', () => {
  const s = D.create(), snap = JSON.stringify(s); D.round(s, [6, 1]); assert.strictEqual(JSON.stringify(s), snap);
});
t('play() selalu selesai paling lama di giliran 3 (acak)', () => {
  for (let i = 0; i < 300; i++) { const r = D.play(D.create()); assert.ok(r.state.over); assert.ok(r.state.round <= 3); assert.ok(r.state.draw || r.state.winner !== null); }
});
console.log('\n' + n + ' tes duel-core lulus');
