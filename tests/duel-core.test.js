const assert = require('assert');
const D = require('../gameplay/js/duel-core.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const types = r => r.events.map(e => e.type);
const withState = (patch, opts) => Object.assign(D.create(opts), patch);
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

t('Safe Tile: START dan petak akhir tidak memicu duel', () => {
  assert.strictEqual(D.isSafeTile(0, 100), true);
  assert.strictEqual(D.isSafeTile(1, 100), true);
  assert.strictEqual(D.isSafeTile(100, 100), true);
  assert.strictEqual(D.isSafeTile(2, 100), false);
  assert.strictEqual(D.isSafeTile(99, 100), false);
});
t('awal duel: 3 HP, momentum 0', () => {
  const s = D.create(); assert.deepStrictEqual(s.hp, [3, 3]); assert.deepStrictEqual(s.mom, [0, 0]);
});
t('nilai dadu di luar 1-6 ditolak', () => {
  assert.throws(() => D.round(D.create(), [0, 3])); assert.throws(() => D.round(D.create(), [3, 7]));
});
t('Attack vs Attack: saling melukai 1', () => {
  const r = D.round(D.create(), [3, 3]); assert.deepStrictEqual(r.state.hp, [2, 2]); assert.ok(types(r).includes('clash'));
});
t('Defense memblokir Attack penuh', () => {
  const r = D.round(D.create(), [3, 1]); assert.deepStrictEqual(r.state.hp, [3, 3]); assert.ok(types(r).includes('block'));
});
t('Defense vs Critical: hanya 1 damage tembus', () => {
  const r = D.round(D.create(), [4, 1]); assert.deepStrictEqual(r.state.hp, [3, 2]);
});
t('Berserk menembus Defense (2 damage penuh)', () => {
  const r = D.round(D.create(), [6, 1]); assert.deepStrictEqual(r.state.hp, [3, 1]); assert.ok(!types(r).includes('block'));
});
t('Defense tanpa serangan lawan tidak berguna', () => {
  const r = D.round(D.create(), [1, 2]); assert.deepStrictEqual(r.state.hp, [3, 3]);
});
t('Regeneration memulihkan 1 HP, tidak melebihi 3', () => {
  let s = withState({ hp: [2, 3] }); let r = D.round(s, [2, 1]); assert.strictEqual(r.state.hp[0], 3);
  r = D.round(D.create(), [2, 1]); assert.strictEqual(r.state.hp[0], 3);
});
t('Lifesteal: serang 1 dan pulihkan 1 (bersamaan)', () => {
  const r = D.round(withState({ hp: [2, 3] }), [5, 1]); /* lawan Defense: serangan diblok, heal tetap */
  assert.deepStrictEqual(r.state.hp, [3, 3]);
  const r2 = D.round(withState({ hp: [2, 2] }), [5, 2]); /* lawan Regeneration: heal bersamaan, damage & heal saling menutup */
  assert.deepStrictEqual(r2.state.hp, [3, 2]);
});
t('serangan serentak: kedua HP dihitung bersamaan', () => {
  const r = D.round(withState({ hp: [1, 1] }), [3, 3]); /* kedua 0 -> double KO */
  assert.ok(types(r).includes('double_ko')); assert.deepStrictEqual(r.state.hp, [1, 1]); assert.strictEqual(r.state.sudden, true); assert.strictEqual(r.state.over, false);
});
t('Critical memberi +2 Momentum, Attack +1, blok +1', () => {
  assert.strictEqual(D.round(D.create(), [4, 2]).state.mom[0], 2);
  assert.strictEqual(D.round(D.create(), [3, 2]).state.mom[0], 1);
  const r = D.round(D.create(), [3, 1]); assert.strictEqual(r.state.mom[1], 1); assert.strictEqual(r.state.mom[0], 0);
});
t('Momentum maksimal 3', () => {
  const r = D.round(withState({ mom: [2, 0] }), [4, 2]);
  /* mom 2 belum penuh: Critical +2 -> dijepit 3 */
  assert.strictEqual(r.state.mom[0], 3);
});
t('Momentum penuh memicu Finisher: +1 damage lalu reset ke 0', () => {
  const r = D.round(withState({ mom: [3, 0] }), [3, 3]); /* lawan menyerang juga, tanpa heal yang menutup damage */
  assert.strictEqual(r.state.hp[1], 1); assert.strictEqual(r.state.mom[0], 0); assert.ok(types(r).includes('finisher'));
});
t('Finisher bukan dipicu oleh Defense/Regeneration', () => {
  const r = D.round(withState({ mom: [3, 0] }), [2, 2]); assert.ok(!types(r).includes('finisher')); assert.strictEqual(r.state.mom[0], 3);
});
t('HP 0 = kalah seketika, winner & loser terisi', () => {
  const r = D.round(withState({ hp: [3, 1] }), [3, 3]);
  assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.winner, 0); assert.strictEqual(r.state.loser, 1);
  assert.throws(() => D.round(r.state, [3, 3]));
});
t('kalah biasa = Normal Defeat (bukan heavy)', () => {
  const r = D.round(withState({ hp: [3, 1] }), [3, 3]); assert.strictEqual(r.state.heavy, false);
});
t('kalah oleh Finisher = Heavy Defeat', () => {
  const r = D.round(withState({ hp: [3, 2], mom: [3, 0] }), [3, 3]);
  assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.heavy, true); assert.strictEqual(r.state.byFinisher, true);
});
t('setelah ronde 3: HP lebih tinggi menang (Normal Defeat)', () => {
  let s = D.create();
  s = D.round(s, [4, 2]).state; /* Critical 2 - Regen 1 -> 3:2 */
  s = D.round(s, [2, 2]).state; /* keduanya Regen -> 3:3 */
  const r = D.round(s, [4, 2]);   /* 3:2, ronde 3 selesai */
  assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.winner, 0); assert.strictEqual(r.state.heavy, false);
});
t('HP sama setelah ronde 3: masuk Sudden Death', () => {
  let s = D.create();
  s = D.round(s, [2, 2]).state; s = D.round(s, [2, 2]).state;
  const r = D.round(s, [2, 2]);
  assert.strictEqual(r.state.over, false); assert.strictEqual(r.state.sudden, true); assert.ok(types(r).includes('sudden_death'));
});
t('Sudden Death: tanpa heal', () => {
  const r = D.round(withState({ sudden: true, hp: [1, 2], round: 3 }), [2, 5]);
  /* P1 Regen nonaktif; P2 Lifesteal menyerang 1 tanpa heal -> P1 mati */
  assert.strictEqual(r.state.hp[0], 0); assert.strictEqual(r.state.hp[1], 2); assert.ok(!types(r).includes('heal'));
});
t('kalah di Sudden Death = Heavy Defeat', () => {
  const r = D.round(withState({ sudden: true, hp: [1, 2], round: 3 }), [2, 3]);
  assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.heavy, true);
});
t('Sudden Death: Defense tetap hanya memblokir 1', () => {
  const r = D.round(withState({ sudden: true, hp: [3, 3], round: 3 }), [4, 1]); assert.strictEqual(r.state.hp[1], 2);
});
t('Revenge: +1 damage pada serangan pertama, sekali pakai', () => {
  let s = D.create({ revenge: [true, false] });
  let r = D.round(s, [2, 2]); assert.strictEqual(r.state.revengeUsed[0], false); /* tanpa serangan: belum terpakai */
  r = D.round(r.state, [3, 3]); assert.strictEqual(r.state.hp[1], 1); assert.strictEqual(r.state.revengeUsed[0], true);
  r = D.round(withState({ hp: [3, 3], round: 0, revengeUsed: [true, false], revenge: [true, false] }), [3, 3]);
  assert.strictEqual(r.state.hp[1], 2);
});
t('penalti Normal Defeat: mundur 10% papan (100 -> 10 petak)', () => {
  const s = D.round(withState({ hp: [3, 1] }), [3, 3]).state;
  const o = D.outcome(s, { pos: 52, goal: 100 });
  assert.strictEqual(o.kind, 'normal'); assert.strictEqual(o.to, 42); assert.strictEqual(o.back, 10); assert.strictEqual(o.skipTurn, false);
  assert.strictEqual(o.winner, 0); assert.strictEqual(o.loser, 1); assert.strictEqual(o.xp.winner, 20); assert.strictEqual(o.xp.loser, 5); assert.strictEqual(o.revengeFor, 1);
});
t('penalti Heavy Defeat: mundur 10% + skip 1 giliran', () => {
  const s = D.round(withState({ hp: [3, 2], mom: [3, 0] }), [3, 3]).state;
  const o = D.outcome(s, { pos: 52, goal: 100 });
  assert.strictEqual(o.kind, 'heavy'); assert.strictEqual(o.skipTurn, true); assert.strictEqual(o.to, 42);
});
t('penalti menyesuaikan panjang papan (persentase)', () => {
  const s = D.round(withState({ hp: [3, 1] }), [3, 3]).state;
  assert.strictEqual(D.outcome(s, { pos: 90, goal: 120 }).back, 12);
  assert.strictEqual(D.outcome(s, { pos: 50, goal: 50 }).back, 5);
});
t('penalti tidak pernah di bawah petak 1 dan tidak kembali ke START', () => {
  const s = D.round(withState({ hp: [3, 1] }), [3, 3]).state;
  const o = D.outcome(s, { pos: 4, goal: 100 }); assert.strictEqual(o.to, 1); assert.strictEqual(o.back, 3);
  assert.ok(D.outcome(s, { pos: 52, goal: 100 }).to > 1);
});
t('outcome sebelum duel selesai ditolak', () => {
  assert.throws(() => D.outcome(D.create(), { pos: 5, goal: 100 }));
});
t('state asli tidak dimutasi', () => {
  const s = D.create(), snap = JSON.stringify(s); D.round(s, [3, 3]); assert.strictEqual(JSON.stringify(s), snap);
});
t('rng deterministik (seed sama = hasil sama)', () => {
  const mk = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const a = D.play(D.create(), mk(7)), b = D.play(D.create(), mk(7));
  assert.deepStrictEqual(a.state, b.state); assert.deepStrictEqual(a.events, b.events);
});
t('simulasi 3000 duel: selalu selesai dengan satu pemenang & invarian benar', () => {
  let wins = [0, 0], heavy = 0;
  for (let i = 0; i < 3000; i++) {
    const r = D.play(D.create()), s = r.state;
    assert.ok(s.over && (s.winner === 0 || s.winner === 1) && s.loser === 1 - s.winner);
    assert.ok(s.hp[0] >= 0 && s.hp[0] <= 3 && s.hp[1] >= 0 && s.hp[1] <= 3);
    assert.ok(s.mom[0] >= 0 && s.mom[0] <= 3 && s.mom[1] >= 0 && s.mom[1] <= 3);
    assert.ok(s.round >= 1 && s.round < 60);
    wins[s.winner]++; if (s.heavy) heavy++;
  }
  assert.ok(wins[0] > 1200 && wins[1] > 1200, 'duel simetris (tidak berat sebelah): ' + wins);
  assert.ok(heavy > 0 && heavy < 3000);
});
console.log(n + ' tes duel-core lulus');
