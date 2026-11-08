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
  const r = C.roll(at(C.create(), 0, 5), 3); /* 5+3=8 -> tangga ke 26 (papan sekarang: 8->26) */
  assert.strictEqual(r.state.players[0].pos, 26); assert.ok(types(r).includes('ladder'));
});
t('ular turun', () => {
  const r = C.roll(at(C.create(), 0, 14), 3); /* 17 -> 4 (papan sekarang: 17->4) */
  assert.strictEqual(r.state.players[0].pos, 4); assert.ok(types(r).includes('snake'));
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

/* ===== Tahap 2: mob & peti, memakai data ASLI gameplay/config.js ===== */
global.window = global; require('../gameplay/config.js');
const CFG = global.UT.Gameplay.Config;
const seeded = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

t('config asli: papan valid & tidak ada petak spesial bentrok', () => {
  assert.deepStrictEqual(C.validateBoard({ goal: 100, ladders: CFG.LADDERS, snakes: CFG.SNAKES }), []);
  const mobs = [].concat(...CFG.MOB_POSITIONS.map(m => m[1]));
  const all = [...Object.keys(CFG.LADDERS), ...Object.keys(CFG.SNAKES), ...CFG.CHESTS, ...mobs].map(Number);
  assert.strictEqual(new Set(all).size, all.length);
});
t('config asli: kolam peti total 1000', () => {
  assert.strictEqual(CFG.CHEST_POOL.reduce((a, r) => a + r.w, 0), 1000);
});
t('pickChestReward ekuivalen kode lama (semua nilai undian 0..999)', () => {
  for (let x = 0; x < 1000; x++) {
    let y = x, old = 'empty'; for (const r of CFG.CHEST_POOL) { if (y < r.w) { old = r.id; break; } y -= r.w; }
    assert.strictEqual(C.pickChestReward(CFG.CHEST_POOL, () => (x + 0.5) / 1000).id, old);
  }
});
t('pickChestReward: pool rusak -> empty+invalid; distribusi ~ bobot', () => {
  assert.deepStrictEqual(C.pickChestReward([{ id: 'a', w: 10 }], Math.random), { id: 'empty', invalid: true });
  const cnt = {}, r = seeded(42), N = 100000;
  for (let i = 0; i < N; i++) { const id = C.pickChestReward(CFG.CHEST_POOL, r).id; cnt[id] = (cnt[id] || 0) + 1; }
  CFG.CHEST_POOL.forEach(e => assert.ok(Math.abs(cnt[e.id] / N - e.w / 1000) < 0.01, e.id));
});
t('mobEffect deterministik ekuivalen kode lama (semua mob config, pos 1..100)', () => {
  const kinds = Object.keys(CFG.MOB_BACK).concat(['creeper', 'skeleton', 'villager', 'strider']);
  for (const k of kinds) for (let pos = 1; pos <= 100; pos++) {
    let old;
    if (k === 'creeper') old = Math.max(1, pos - 2);
    else if (k === 'skeleton') old = Math.max(1, pos - 1);
    else if (k === 'villager') old = Math.min(99, pos + 5);
    else if (k === 'strider') old = Math.min(100 - 1, pos + 3);
    else old = Math.max(1, pos - CFG.MOB_BACK[k]);
    const e = C.mobEffect(k, pos, { goal: 100, back: CFG.MOB_BACK });
    if (k === 'creeper' || k === 'skeleton' || k === 'villager' || k === 'strider' || CFG.MOB_BACK[k] != null) assert.strictEqual(e.to, old, k + '@' + pos);
  }
});
t('mobEffect ender: selalu 1..98, tidak sama dengan pos, dalam jarak 10', () => {
  const r = seeded(9);
  for (let pos = 1; pos <= 99; pos++) for (let i = 0; i < 200; i++) {
    const e = C.mobEffect('ender', pos, { rng: r });
    assert.ok(e.to >= 1 && e.to <= 98 && e.to !== pos && Math.abs(e.to - pos) <= 10, pos + '->' + e.to);
    assert.strictEqual(e.kind, 'teleport');
  }
});
t('mobEffect: mob tak dikenal tidak memindahkan', () => {
  assert.deepStrictEqual(C.mobEffect('xyz', 50, { back: {} }), { kind: 'none', to: 50, steps: 0 });
});
t('mobEffect: pos tidak pernah < 1 dan strider memakai goal', () => {
  assert.strictEqual(C.mobEffect('warden', 3, { back: CFG.MOB_BACK }).to, 1);
  assert.strictEqual(C.mobEffect('strider', 118, { goal: 120 }).to, 119);
});
t('chestMove ekuivalen kode lama', () => {
  for (let pos = 0; pos <= 100; pos++) for (const d of [-3, -2, -1, 1, 2, 3])
    assert.strictEqual(C.chestMove(pos, d), Math.max(1, Math.min(99, pos + d)));
});
t('chestNearest: terdekat di depan, null bila tidak ada', () => {
  assert.strictEqual(C.chestNearest(0, CFG.LADDERS), 8);   /* tangga 3-22 sudah dihapus dari papan */
  assert.strictEqual(C.chestNearest(8, CFG.LADDERS), 20);
  assert.strictEqual(C.chestNearest(71, CFG.LADDERS), null);
  assert.strictEqual(C.chestNearest(50, CFG.SNAKES), 62);
  assert.strictEqual(C.chestNearest(98, CFG.SNAKES), null);
});
console.log('\nSEMUA TES SELESAI');
