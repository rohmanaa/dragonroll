/* Simulasi balance Dragon Roll — memakai game-core.js (aturan murni) dengan RNG ber-seed.
   Pakai:  node game/tools/sim/balance.js            -> laporan
           node game/tools/sim/balance.js --check    -> gagal (exit 1) bila di luar batas (untuk CI)
           node game/tools/sim/balance.js --n 50000 --seed 7
   CATATAN: hanya aturan inti (dadu, 6 = giliran tambahan, 3x6 hangus, pantul, ular, tangga).
   Mob, peti, power, dan totem BELUM disimulasikan (masih di gameplay.html). */
'use strict';
const C = require('../../gameplay/game-core.js');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? +process.argv[i + 1] : d; };
const N = arg('--n', 20000), SEED = arg('--seed', 20261106), CHECK = process.argv.includes('--check');
const MAX_ROLLS = 5000;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const BOARDS = {
  world: {},
  nether: { goal: 120, ladders: { 5: 26, 20: 46, 40: 64, 59: 88, 78: 106, 100: 116 }, snakes: { 28: 3, 50: 18, 66: 36, 82: 61, 102: 80, 118: 94 } }
};
const pct = (x, n) => +(100 * x / n).toFixed(1);
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];

function simulate(board, players, n, seed) {
  const rng = mulberry32(seed), ids = Array.from({ length: players }, (_, i) => 'p' + (i + 1));
  const wins = Array(players).fill(0), lens = [], leaderWins = { halfway: 0, counted: 0 };
  let stuck = 0, snakes = 0, ladders = 0, rolls = 0;
  for (let g = 0; g < n; g++) {
    let s = C.create(Object.assign({ players: ids }, BOARDS[board])), r = 0, half = null;
    while (!s.over && r < MAX_ROLLS) {
      const res = C.roll(s, rng); s = res.state; r++;
      for (const e of res.events) { if (e.type === 'snake') snakes++; else if (e.type === 'ladder') ladders++; }
      if (half === null && r === 25) half = s.players.map(p => p.pos); /* posisi di lemparan ke-25 */
    }
    rolls += r;
    if (!s.over) { stuck++; continue; }
    lens.push(r); const wi = ids.indexOf(s.winner); wins[wi]++;
    if (half) { const top = Math.max(...half); if (half.filter(x => x === top).length === 1) { leaderWins.counted++; if (half.indexOf(top) === wi) leaderWins.halfway++; } }
  }
  lens.sort((a, b) => a - b);
  const done = n - stuck;
  return {
    board: board, players: players, games: n, unfinished: stuck,
    rollsMedian: q(lens, .5), rollsP10: q(lens, .1), rollsP90: q(lens, .9),
    rollsPerPlayerMedian: +(q(lens, .5) / players).toFixed(1),
    seatWinPct: wins.map(w => pct(w, done)),
    seat1AdvantagePct: +(pct(wins[0], done) - 100 / players).toFixed(1),
    leaderAtRoll25WinsPct: leaderWins.counted ? pct(leaderWins.halfway, leaderWins.counted) : null,
    snakesPerGame: +(snakes / n).toFixed(1), laddersPerGame: +(ladders / n).toFixed(1)
  };
}

const out = [];
Object.keys(BOARDS).forEach(b => [2, 3, 4].forEach(p => out.push(simulate(b, p, N, SEED + p))));
console.log('Simulasi balance (aturan inti) — N=' + N + ', seed=' + SEED + '\n');
console.table(out.map(o => ({ papan: o.board, pemain: o.players, 'median lempar': o.rollsMedian, 'p10-p90': o.rollsP10 + '-' + o.rollsP90, 'lempar/pemain': o.rollsPerPlayerMedian, 'menang per kursi %': o.seatWinPct.join(' / '), 'keunggulan kursi1 (pp)': o.seat1AdvantagePct, 'pemimpin@25 menang %': o.leaderAtRoll25WinsPct, ular: o.snakesPerGame, tangga: o.laddersPerGame, 'tak selesai': o.unfinished })));

if (CHECK) {
  const bad = [];
  out.forEach(o => {
    const tag = o.board + '/' + o.players + 'p';
    if (o.unfinished > 0) bad.push(tag + ': ada game tidak selesai (' + o.unfinished + ')');
    if (Math.abs(o.seat1AdvantagePct) > 4) bad.push(tag + ': keunggulan kursi 1 ' + o.seat1AdvantagePct + 'pp (batas 4)');
    if (o.rollsPerPlayerMedian < 12 || o.rollsPerPlayerMedian > 40) bad.push(tag + ': lempar/pemain ' + o.rollsPerPlayerMedian + ' di luar 12-40');
  });
  if (bad.length) { console.error('\nBALANCE GAGAL:\n - ' + bad.join('\n - ')); process.exit(1); }
  console.log('\nBALANCE OK');
}
