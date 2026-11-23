/* Ular Tangga Blok — gameplay/js/duel-core.js
   ATURAN DUEL PVP (Clash) MURNI: tanpa DOM, THREE, audio, atau animasi. Hanya data -> data.
   Sama seperti game-core.js: bisa dipakai di browser (UT.Gameplay.Duel) dan Node (require) untuk tes,
   serta nanti di server agar dadu & hasil duel tidak bisa dicurangi di klien.

   Aturan (gaya batu-gunting-kertas):
   - Dua pemain bertemu (mendarat) di petak yang sama. Petak START (<=1) dan petak akhir = Safe Tile (tanpa duel).
   - Masing-masing 3 Hearts. Kedua pemain roll d6 bersamaan; dadu diubah jadi 3 aksi (2 sisi dadu per aksi):
       1-2 Attack  : beri 1 damage
       3-4 Defense : bertahan, menahan Attack lawan
       5-6 Heal    : dapat 1 hati (maks 3)
   - Siapa mengalahkan siapa:
       Attack  vs Defense -> serangan diblokir (0 damage)
       Attack  vs Heal    -> serangan masuk, Heal gagal (terganggu)
       Attack  vs Attack  -> saling kena 1
       Heal    vs Defense -> Heal berhasil
       Heal    vs Heal    -> keduanya +1
       Defense vs Defense -> tidak terjadi apa-apa
   - Hanya 3 ronde. Setelah ronde 3 selesai TIDAK ada ronde berikutnya (tanpa Sudden Death).
     Hati 0 = kalah lebih awal. Setelah ronde 3: hati lebih banyak menang, sama = DRAW.
   - Hasil:
       Menang : hadiah (XP) + bertahan di petak
       Kalah  : hadiah kecil + mundur 5 petak (minimal petak 1)
       Draw   : tanpa hadiah, kedua pemain tetap di petak yang sama
   API: create(opts) -> state ; round(state, rolls|rng) -> {state, events} ; outcome(state, ctx) -> hasil.
   State tidak dimutasi. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  var UT = root.UT = root.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  if (!G.Duel || !Object.keys(G.Duel).length) G.Duel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DEFAULTS = {
    maxHp: 3,
    maxRounds: 3,
    backTiles: 5,   /* petak mundur bagi yang kalah */
    xpWin: 20,
    xpLose: 5,
    xpDraw: 0,
    reviveHp: 2     /* HP pemain kalah setelah duel (di luar duel) */
  };

  /* dadu 1-6 -> aksi. atk = damage yang diberikan. */
  var ACTIONS = {
    1: { id: 'attack',  name: 'Attack',  atk: 1 },
    2: { id: 'attack',  name: 'Attack',  atk: 1 },
    3: { id: 'defense', name: 'Defense', atk: 0 },
    4: { id: 'defense', name: 'Defense', atk: 0 },
    5: { id: 'heal',    name: 'Heal',    atk: 0 },
    6: { id: 'heal',    name: 'Heal',    atk: 0 }
  };

  function actionOf(v) { return ACTIONS[v]; }

  /* Petak aman: START (<=1) dan petak akhir (>=goal) tidak memicu duel. */
  function isSafeTile(pos, goal) { return !(pos > 1 && pos < goal); }

  function rollValue(rng) {
    if (typeof rng === 'number') {
      if (!Number.isInteger(rng) || rng < 1 || rng > 6) throw new Error('nilai dadu harus 1-6');
      return rng;
    }
    return 1 + Math.floor((rng || Math.random)() * 6);
  }

  /* opts: {maxHp, maxRounds, backTiles, ...DEFAULTS}. Pemain 0 = penantang (yang mendarat). */
  function create(opts) {
    opts = opts || {};
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) { cfg[k] = opts[k] != null ? opts[k] : DEFAULTS[k]; });
    return {
      cfg: cfg,
      hp: [cfg.maxHp, cfg.maxHp],
      mom: [0, 0],    /* dipertahankan (selalu 0) agar UI/cue lama tetap kompatibel */
      round: 0,
      over: false,
      draw: false,
      winner: null,   /* 0 | 1 | null (draw) */
      loser: null
    };
  }

  function clone(s) {
    return { cfg: s.cfg, hp: s.hp.slice(), mom: s.mom.slice(), round: s.round, over: s.over, draw: s.draw, winner: s.winner, loser: s.loser };
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* Satu ronde: kedua pemain roll bersamaan. rolls = [a,b] (angka 1-6) atau fungsi rng. */
  function round(state, rolls) {
    if (state.over) throw new Error('duel sudah selesai');
    var s = clone(state), ev = [], r, i, o, cfg = s.cfg;
    if (Array.isArray(rolls)) r = [rollValue(rolls[0]), rollValue(rolls[1])];
    else r = [rollValue(rolls), rollValue(rolls)];
    s.round++;
    ev.push({ type: 'round', n: s.round });
    ev.push({ type: 'roll', values: r.slice() });

    var act = [ACTIONS[r[0]].id, ACTIONS[r[1]].id];
    var dmg = [0, 0], heal = [0, 0], blocked = [false, false];
    for (i = 0; i < 2; i++) {
      o = 1 - i;
      if (act[i] === 'attack') {
        if (act[o] === 'defense') blocked[o] = true;
        else dmg[o] = 1;
      }
      /* Heal berhasil kecuali diserang di ronde yang sama */
      if (act[i] === 'heal' && act[o] !== 'attack') heal[i] = 1;
    }
    if (act[0] === 'attack' && act[1] === 'attack') ev.push({ type: 'clash' });
    for (i = 0; i < 2; i++) {
      if (dmg[i] > 0) ev.push({ type: 'hit', target: i, by: 1 - i, dmg: dmg[i], action: 'attack', finisher: false });
      else if (blocked[i]) ev.push({ type: 'block', who: i });
      if (heal[i] > 0 && s.hp[i] < cfg.maxHp) ev.push({ type: 'heal', who: i });
    }
    for (i = 0; i < 2; i++) s.hp[i] = clamp(s.hp[i] - dmg[i] + heal[i], 0, cfg.maxHp);
    ev.push({ type: 'state', hp: s.hp.slice(), mom: s.mom.slice() });

    var w = null, ended = false;
    if (s.hp[0] === 0 && s.hp[1] === 0) { ended = true; ev.push({ type: 'double_ko' }); }
    else if (s.hp[0] === 0 || s.hp[1] === 0) { ended = true; w = s.hp[0] === 0 ? 1 : 0; }
    else if (s.round >= cfg.maxRounds) {
      ended = true;
      if (s.hp[0] !== s.hp[1]) { w = s.hp[0] > s.hp[1] ? 0 : 1; ev.push({ type: 'decision', by: 'hp' }); }
    }
    if (ended) {
      s.over = true;
      if (w === null) { s.draw = true; ev.push({ type: 'draw' }); }
      else { s.winner = w; s.loser = 1 - w; ev.push({ type: 'ko', winner: w, loser: 1 - w, heavy: false, byFinisher: false }); }
    }
    return { state: s, events: ev };
  }

  /* Hasil & hadiah setelah duel selesai. ctx: {pos, goal}.
     -> {draw, winner, loser, kind:'win'|'draw', back, from, to, skipTurn:false, xp:{winner,loser}, reviveHp}
     Kalah: mundur backTiles petak (tidak pernah di bawah petak 1). Draw: tanpa hadiah, tidak ada yang bergerak. */
  function outcome(state, ctx) {
    if (!state.over) throw new Error('duel belum selesai');
    var cfg = state.cfg, pos = (ctx && ctx.pos) || 1;
    if (state.draw) {
      return { draw: true, winner: null, loser: null, kind: 'draw', byFinisher: false, back: 0, from: pos, to: pos,
               skipTurn: false, xp: { winner: cfg.xpDraw, loser: cfg.xpDraw }, reviveHp: cfg.maxHp, revengeFor: null };
    }
    var to = Math.max(1, pos - cfg.backTiles);
    return {
      draw: false,
      winner: state.winner,
      loser: state.loser,
      kind: 'win',
      byFinisher: false,
      back: pos - to,
      from: pos,
      to: to,
      skipTurn: false,
      xp: { winner: cfg.xpWin, loser: cfg.xpLose },
      reviveHp: cfg.reviveHp,
      revengeFor: null
    };
  }

  /* Mainkan duel sampai selesai (untuk simulasi/CPU/tes). rng opsional. Selalu berakhir paling lama di ronde 3. */
  function play(state, rng) {
    var s = state, all = [], n = 0;
    while (!s.over && n++ < 10) { var r = round(s, rng || Math.random); s = r.state; all = all.concat(r.events); }
    return { state: s, events: all };
  }

  return {
    DEFAULTS: DEFAULTS, ACTIONS: ACTIONS, actionOf: actionOf, isSafeTile: isSafeTile,
    rollValue: rollValue, create: create, round: round, outcome: outcome, play: play
  };
});
