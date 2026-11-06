const assert = require('assert');
const C = require('../gameplay/game-core.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const at = (s, i, pos, sixes) => { const x = JSON.parse(JSON.stringify(s)); x.cfg = s.cfg; x.players[i].pos = pos; if (sixes != null) x.players[i].sixes = sixes; return x; };
const types = r => r.events.map(e => e.type);

t('papan bawaan valid', () => assert.deepStrictEqual(C.validateBoard(C.DEFAULTS), []));
t('papan rusak ditolak', () => {
  assert.throws(() => C.create({ ladders: { 5: 3 } }));
  assert.throws(() => C.create({ ladders: { 5: 20 }, snakes: { 5: 2 } }));
  assert.throws(() => C.create({ ladders: { 5: 20 }, snakes: { 30: 5 } }));
  assert.throws(() => C.create({ players: ['a', 'a'] }));
});
t('gerak biasa & ganti giliran', () => {
  const r = C.roll(C.create(), 4);
  assert.strictEqual(r.state.players[0].pos, 4); assert.strictEqual(r.state.cur, 1);
});
t('tangga naik', () => {
  const r = C.roll(C.create(), 3 - 0 === 3 ? 3 : 3); /* 0+3=3 -> tangga ke 22 */
  assert.strictEqual(r.state.players[0].pos, 22); assert.ok(types(r).includes('ladder'));
});
t('ular turun', () => {
  const r = C.roll(at(C.create(), 0, 14), 3); /* 17 -> 7 */
  assert.strictEqual(r.state.players[0].pos, 7); assert.ok(types(r).includes('snake'));
});
t('enam = giliran tambahan', () => {
  const r = C.roll(C.create(), 6);
  assert.strictEqual(r.state.cur, 0); assert.ok(types(r).includes('extra_turn'));
});
t('tiga enam = hangus, tidak bergerak', () => {
  let s = at(C.create(), 0, 10, 2); const r = C.roll(s, 6);
  assert.strictEqual(r.state.players[0].pos, 10); assert.strictEqual(r.state.cur, 1);
  assert.strictEqual(r.state.players[0].sixes, 0); assert.ok(types(r).includes('triple_six'));
});
t('bukan-enam mereset hitungan enam', () => {
  let s = at(C.create(), 0, 10, 2); const r = C.roll(s, 2);
  assert.strictEqual(r.state.players[0].sixes, 0);
});
t('menang tepat di 100', () => {
  const r = C.roll(at(C.create(), 0, 96), 4);
  assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.winner, 'p1');
  assert.throws(() => C.roll(r.state, 1));
});
t('kelebihan memantul', () => {
  const r = C.roll(at(C.create(), 0, 97), 5); /* 102 -> over 2 -> 98 -> ular ke 77 */
  const ev = types(r); assert.ok(ev.includes('bounce')); assert.strictEqual(r.state.players[0].pos, 77);
  const r2 = C.roll(at(C.create(), 0, 99), 3); /* over 2 -> 98 -> ular 77 */
  assert.strictEqual(r2.state.players[0].pos, 77);
  const r3 = C.roll(at(C.create(), 0, 95), 6); /* over 1 -> 99 */
  assert.strictEqual(r3.state.players[0].pos, 99); assert.strictEqual(r3.state.over, false);
});
t('onGoal:stop berhenti di goal tanpa menang', () => {
  const r = C.roll(at(C.create({ onGoal: 'stop' }), 0, 96), 4);
  assert.strictEqual(r.state.over, false); assert.ok(types(r).includes('goal'));
});
t('state asli tidak dimutasi', () => {
  const s = C.create(), snap = JSON.stringify(s.players); C.roll(s, 4);
  assert.strictEqual(JSON.stringify(s.players), snap);
});
t('rng deterministik (seed sama = hasil sama)', () => {
  const mk = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const play = seed => { let s = C.create({ players: ['a', 'b', 'c'] }), r = mk(seed), k = 0; while (!s.over && k++ < 5000) s = C.roll(s, r).state; return JSON.stringify(s.players) + s.winner; };
  assert.strictEqual(play(7), play(7));
});
t('simulasi 2000 game: selalu selesai & posisi selalu valid', () => {
  for (let g = 0; g < 2000; g++) {
    let s = C.create({ players: ['a', 'b', 'c', 'd'].slice(0, 1 + g % 4) }), k = 0;
    while (!s.over) {
      s = C.roll(s).state;
      s.players.forEach(p => assert.ok(p.pos >= 0 && p.pos <= 100 && p.sixes < 3));
      assert.ok(++k < 20000, 'game tidak selesai');
    }
    assert.ok(s.winner);
  }
});
t('planMove murni', () => {
  assert.deepStrictEqual(C.planMove(10, 4, 100), { to: 14, over: 0, bounceTo: null, final: 14 });
  assert.deepStrictEqual(C.planMove(100, 3, 100), { to: 100, over: 3, bounceTo: 97, final: 97 });
  assert.deepStrictEqual(C.planMove(97, 5, 100), { to: 100, over: 2, bounceTo: 98, final: 98 });
  assert.strictEqual(C.planMove(96, 4, 100).final, 100);
});
t('sixesAfter murni', () => {
  assert.deepStrictEqual(C.sixesAfter(0, 6, 3), { sixes: 1, forfeit: false });
  assert.deepStrictEqual(C.sixesAfter(2, 6, 3), { sixes: 0, forfeit: true });
  assert.deepStrictEqual(C.sixesAfter(2, 5, 3), { sixes: 0, forfeit: false });
});
console.log('\n' + n + ' tes lulus');

/* Ekuivalensi dengan rumus lama di gameplay.html (sebelum integrasi) */
(() => {
  let k = 0;
  for (let pos = 0; pos <= 100; pos++) for (let st = 1; st <= 8; st++) {
    const target = pos + st; let to, over = 0, fin;
    if (target <= 100) { to = target; fin = target; } else { over = target - 100; fin = 100 - over; to = 100; }
    const pm = C.planMove(pos, st, 100);
    assert.strictEqual(pm.to, to); assert.strictEqual(pm.over, over); assert.strictEqual(pm.final, fin);
    if (over) assert.strictEqual(pm.bounceTo, fin); k++;
  }
  console.log('ok - ekuivalen rumus lama (' + k + ' kombinasi)');
})();
