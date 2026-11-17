/* Ular Tangga Blok — gameplay/js/duel-core.js
   ATURAN DUEL PVP (Clash) MURNI: tanpa DOM, THREE, audio, atau animasi. Hanya data -> data.
   Sama seperti game-core.js: bisa dipakai di browser (UT.Gameplay.Duel) dan Node (require) untuk tes,
   serta nanti di server agar dadu & hasil duel tidak bisa dicurangi di klien.

   Aturan:
   - Dua pemain bertemu (mendarat) di petak yang sama. Petak START (<=1) dan petak akhir = Safe Tile (tanpa duel).
   - Masing-masing 3 Hearts. Kedua pemain roll d6 bersamaan; efek diproses bersamaan.
       1 Defense      : blokir 1 damage dari serangan lawan di ronde itu
       2 Regeneration : pulihkan 1 HP
       3 Attack       : serang 1
       4 Critical     : serang 2, +2 Momentum
       5 Lifesteal    : serang 1 + pulihkan 1 HP
       6 Berserk      : serang 2, MENEMBUS Defense
   - Momentum (maks 3, per duel): serangan berhasil +1, Critical +2, berhasil memblokir +1.
     Momentum penuh -> serangan berikutnya = FINISHER (+1 damage), Momentum kembali 0.
   - Maks 3 ronde normal. HP 0 = kalah. Setelah ronde 3: HP lebih tinggi menang, sama -> Sudden Death.
     Kedua HP 0 di ronde yang sama: keduanya dipulihkan ke 1 HP, lanjut Sudden Death.
   - Sudden Death: tanpa heal (Regeneration & heal Lifesteal nonaktif), lanjut sampai ada yang kalah.
   - Defeat Penalty (satu paket, tidak ditumpuk): mundur 10% panjang papan (min petak 1).
     Heavy Defeat (kalah oleh Finisher atau di Sudden Death): mundur 10% + skip 1 giliran. Tidak pernah kembali ke START.
   - Hadiah: pemenang +20 XP, kalah +5 XP, yang kalah mendapat Revenge buff (+1 damage pada serangan pertama
     di duel berikutnya melawan lawan yang sama, sekali pakai).
   API: create(opts) -> state ; round(state, rolls|rng) -> {state, events} ; outcome(state, ctx) -> hasil/penalti.
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
    maxMomentum: 3,
    penaltyPct: 0.10,
    xpWin: 20,
    xpLose: 5,
    reviveHp: 2,     /* HP pemain kalah setelah duel (di luar duel) */
    revengeTurns: 5  /* masa berlaku Revenge buff, dihitung oleh lapisan luar */
  };

  var ACTIONS = {
    1: { id: 'defense', name: 'Defense', atk: 0 },
    2: { id: 'regen', name: 'Regeneration', atk: 0 },
    3: { id: 'attack', name: 'Attack', atk: 1 },
    4: { id: 'critical', name: 'Critical', atk: 2 },
    5: { id: 'lifesteal', name: 'Lifesteal', atk: 1 },
    6: { id: 'berserk', name: 'Berserk', atk: 2 }
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

  /* opts: {revenge:[bool,bool], maxHp, maxRounds, maxMomentum, ...DEFAULTS}. Pemain 0 = penantang (yang mendarat). */
  function create(opts) {
    opts = opts || {};
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) { cfg[k] = opts[k] != null ? opts[k] : DEFAULTS[k]; });
    var rv = opts.revenge || [false, false];
    return {
      cfg: cfg,
      hp: [cfg.maxHp, cfg.maxHp],
      mom: [0, 0],
      round: 0,
      sudden: false,
      over: false,
      winner: null,   /* 0 | 1 */
      loser: null,
      heavy: false,   /* true bila kalah oleh Finisher atau di Sudden Death */
      byFinisher: false,
      revenge: [!!rv[0], !!rv[1]],
      revengeUsed: [false, false]
    };
  }

  function clone(s) {
    return {
      cfg: s.cfg, hp: s.hp.slice(), mom: s.mom.slice(), round: s.round, sudden: s.sudden, over: s.over,
      winner: s.winner, loser: s.loser, heavy: s.heavy, byFinisher: s.byFinisher,
      revenge: s.revenge.slice(), revengeUsed: s.revengeUsed.slice()
    };
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* Satu ronde: kedua pemain roll bersamaan. rolls = [a,b] (angka 1-6) atau fungsi rng. */
  function round(state, rolls) {
    if (state.over) throw new Error('duel sudah selesai');
    var s = clone(state), ev = [], r, i, o, cfg = s.cfg;
    if (Array.isArray(rolls)) r = [rollValue(rolls[0]), rollValue(rolls[1])];
    else r = [rollValue(rolls), rollValue(rolls)];
    s.round++;
    ev.push({ type: 'round', n: s.round, sudden: s.sudden });
    ev.push({ type: 'roll', values: r.slice() });

    var base = [0, 0], dmg = [0, 0], heal = [0, 0], fin = [false, false], blocked = [false, false], rv = [false, false];
    for (i = 0; i < 2; i++) {
      base[i] = ACTIONS[r[i]].atk;
      if (base[i] > 0) {
        if (s.revenge[i] && !s.revengeUsed[i]) { base[i]++; s.revengeUsed[i] = true; rv[i] = true; }
        if (s.mom[i] >= cfg.maxMomentum) { base[i]++; fin[i] = true; }
      }
      if (!s.sudden && (r[i] === 2 || r[i] === 5)) heal[i] = 1;
    }
    for (i = 0; i < 2; i++) {
      o = 1 - i;
      dmg[o] = base[i];
      /* Defense memblokir 1 damage; Berserk menembus Defense. Di Sudden Death blokir tetap maks 1. */
      if (base[i] > 0 && r[o] === 1 && r[i] !== 6) { dmg[o] = Math.max(0, base[i] - 1); blocked[o] = true; }
    }
    if (base[0] > 0 && base[1] > 0) ev.push({ type: 'clash' });
    for (i = 0; i < 2; i++) {
      o = 1 - i;
      if (rv[i]) ev.push({ type: 'revenge', who: i });
      if (fin[i]) { s.mom[i] = 0; ev.push({ type: 'finisher', who: i }); }
      else if (base[i] > 0 && dmg[o] > 0) s.mom[i] = Math.min(cfg.maxMomentum, s.mom[i] + (r[i] === 4 ? 2 : 1));
      if (blocked[i]) s.mom[i] = Math.min(cfg.maxMomentum, s.mom[i] + 1);
    }
    for (i = 0; i < 2; i++) {
      if (dmg[i] > 0) ev.push({ type: 'hit', target: i, by: 1 - i, dmg: dmg[i], action: ACTIONS[r[1 - i]].id, finisher: fin[1 - i] });
      else if (blocked[i]) ev.push({ type: 'block', who: i });
      if (heal[i] > 0 && s.hp[i] - dmg[i] < cfg.maxHp) ev.push({ type: 'heal', who: i });
    }
    for (i = 0; i < 2; i++) s.hp[i] = clamp(s.hp[i] - dmg[i] + heal[i], 0, cfg.maxHp);
    ev.push({ type: 'state', hp: s.hp.slice(), mom: s.mom.slice() });

    var w = null;
    if (s.hp[0] === 0 && s.hp[1] === 0) {
      s.hp = [1, 1]; s.sudden = true;
      ev.push({ type: 'double_ko' }, { type: 'sudden_death' }, { type: 'state', hp: s.hp.slice(), mom: s.mom.slice() });
    } else if (s.hp[0] === 0 || s.hp[1] === 0) {
      w = s.hp[0] === 0 ? 1 : 0;
      s.byFinisher = !!(fin[w] && dmg[1 - w] > 0);
      s.heavy = s.sudden || s.byFinisher;
    } else if (!s.sudden && s.round >= cfg.maxRounds) {
      if (s.hp[0] !== s.hp[1]) { w = s.hp[0] > s.hp[1] ? 0 : 1; s.heavy = false; ev.push({ type: 'decision', by: 'hp' }); }
      else { s.sudden = true; ev.push({ type: 'sudden_death' }); }
    }
    if (w !== null) {
      s.over = true; s.winner = w; s.loser = 1 - w;
      ev.push({ type: 'ko', winner: w, loser: 1 - w, heavy: s.heavy, byFinisher: s.byFinisher });
    }
    return { state: s, events: ev };
  }

  /* Penalti & hadiah setelah duel selesai.
     ctx: {pos, goal}. -> {winner, loser, kind:'normal'|'heavy', back, to, skipTurn, xp:{winner,loser}, reviveHp, revengeFor}
     back = 10% panjang papan (min 1 petak); petak tujuan tidak pernah di bawah 1 (tidak pernah kembali ke START). */
  function outcome(state, ctx) {
    if (!state.over) throw new Error('duel belum selesai');
    var cfg = state.cfg, goal = (ctx && ctx.goal) || 100, pos = (ctx && ctx.pos) || 1;
    var back = Math.max(1, Math.round(goal * cfg.penaltyPct));
    var to = Math.max(1, pos - back);
    return {
      winner: state.winner,
      loser: state.loser,
      kind: state.heavy ? 'heavy' : 'normal',
      byFinisher: state.byFinisher,
      back: pos - to,
      from: pos,
      to: to,
      skipTurn: !!state.heavy,
      xp: { winner: cfg.xpWin, loser: cfg.xpLose },
      reviveHp: cfg.reviveHp,
      revengeFor: state.loser
    };
  }

  /* Mainkan duel sampai selesai (untuk simulasi/CPU/tes). rng opsional. Batas pengaman 60 ronde. */
  function play(state, rng) {
    var s = state, all = [], n = 0;
    while (!s.over && n++ < 60) { var r = round(s, rng || Math.random); s = r.state; all = all.concat(r.events); }
    if (!s.over) { /* sangat tak mungkin: putuskan dari HP, imbang -> penantang kalah tipis */
      s = clone(s); var w = s.hp[0] >= s.hp[1] ? 0 : 1; s.over = true; s.winner = w; s.loser = 1 - w; s.heavy = true;
      all.push({ type: 'ko', winner: w, loser: 1 - w, heavy: true, byFinisher: false });
    }
    return { state: s, events: all };
  }

  return {
    DEFAULTS: DEFAULTS, ACTIONS: ACTIONS, actionOf: actionOf, isSafeTile: isSafeTile,
    rollValue: rollValue, create: create, round: round, outcome: outcome, play: play
  };
});
