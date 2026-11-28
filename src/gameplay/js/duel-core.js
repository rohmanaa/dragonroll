/* Ular Tangga Blok — src/gameplay/js/duel-core.js
   ATURAN DUEL PVP (Dadu Duel Blok) MURNI: tanpa DOM, THREE, audio, atau animasi. Hanya data -> data.
   Sama seperti game-core.js: bisa dipakai di browser (UT.Gameplay.Duel) dan Node (require) untuk tes,
   serta nanti di server agar dadu & hasil duel tidak bisa dicurangi di klien.

   Aturan (sistem baru, dari prototipe Dadu_Duel_Blok.html):
   - Dua pemain bertemu (mendarat) di petak yang sama. Petak START (<=1) dan petak akhir = Safe Tile (tanpa duel).
   - Masing-masing punya HP 100. Hanya 3 GILIRAN. Tiap giliran kedua pemain roll d6 bersamaan:
       angka lebih besar = penyerang giliran itu; angka kembar = IMBANG (senjata beradu, tanpa damage).
       Angka dadu juga nama aksinya: 1 MELESET, 2 TANGKIS, 3 SERANG, 4 SERANG KUAT, 5 SKILL, 6 KRITIS.
   - Damage = 6 + (dadu menang - dadu kalah) * 5, +8 bila dadu menang = 6.
       Giliran ke-3 = SERANGAN PAMUNGKAS: damage x1.8.
       Bila dadu lawan = 2 (TANGKIS): damage x0.45 (minimal 3), diblokir sebagian.
   - HP 0 = K.O., duel langsung selesai. Setelah giliran ke-3: HP lebih banyak menang.
     HP sama = SERI (TIDAK ada adu ulang / sudden death).
   - Hasil:
       Menang : hadiah (XP) + bertahan di petak
       Kalah  : hadiah kecil + mundur backTiles petak (minimal petak 1)
       Seri   : tanpa hadiah, kedua pemain tetap di petak yang sama
   API: create(opts) -> state ; round(state, rolls|rng) -> {state, events, turn} ; outcome(state, ctx) -> hasil.
   State tidak dimutasi. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  var UT = root.UT = root.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  if (!G.Duel || !Object.keys(G.Duel).length) G.Duel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DEFAULTS = {
    maxHp: 100,
    maxRounds: 3,   /* jumlah giliran (tetap 3) */
    backTiles: 5,   /* petak mundur bagi yang kalah */
    xpWin: 20,
    xpLose: 5,
    xpDraw: 0,
    reviveHp: 50,   /* HP pemain kalah setelah duel (di luar duel) */
    ultMult: 1.8,   /* pengali damage giliran terakhir */
    guardMult: 0.45,/* pengali damage bila lawan menangkis (dadu 2) */
    guardMin: 3
  };

  /* dadu 1-6 -> aksi (nama dipakai UI) */
  var ACTIONS = {
    1: { id: 'miss',   name: 'MELESET' },
    2: { id: 'guard',  name: 'TANGKIS' },
    3: { id: 'attack', name: 'SERANG' },
    4: { id: 'power',  name: 'SERANG KUAT' },
    5: { id: 'skill',  name: 'SKILL' },
    6: { id: 'crit',   name: 'KRITIS!' }
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
      round: 0,       /* giliran yang sudah dimainkan */
      over: false,
      draw: false,
      winner: null,   /* 0 | 1 | null (seri) */
      loser: null,
      by: null        /* 'ko' | 'hp' | 'draw' setelah selesai */
    };
  }

  function clone(s) {
    return { cfg: s.cfg, hp: s.hp.slice(), round: s.round, over: s.over, draw: s.draw, winner: s.winner, loser: s.loser, by: s.by };
  }

  /* Damage satu serangan: dadu menang rw, dadu kalah rl, ult = giliran terakhir. -> {dmg, blocked} */
  function damage(rw, rl, ult, cfg) {
    cfg = cfg || DEFAULTS;
    var dmg = 6 + (rw - rl) * 5 + (rw === 6 ? 8 : 0);
    if (ult) dmg = Math.round(dmg * cfg.ultMult);
    var blocked = rl === 2;
    if (blocked) dmg = Math.max(cfg.guardMin, Math.round(dmg * cfg.guardMult));
    return { dmg: dmg, blocked: blocked };
  }

  /* Satu giliran: kedua pemain roll bersamaan. rolls = [a,b] (angka 1-6) atau fungsi rng.
     turn = ringkasan untuk UI: {n, rolls, winner/loser (pemenang GILIRAN; null=imbang), dmg, blocked, ult, hp, over, by, dw (pemenang DUEL), draw} */
  function round(state, rolls) {
    if (state.over) throw new Error('duel sudah selesai');
    var s = clone(state), ev = [], r, cfg = s.cfg;
    if (Array.isArray(rolls)) r = [rollValue(rolls[0]), rollValue(rolls[1])];
    else r = [rollValue(rolls), rollValue(rolls)];
    var ult = s.round === cfg.maxRounds - 1;
    s.round++;
    ev.push({ type: 'round', n: s.round, ult: ult });
    ev.push({ type: 'roll', values: r.slice() });

    var w = r[0] > r[1] ? 0 : r[1] > r[0] ? 1 : null, dmg = 0, blocked = false, l = null;
    if (w === null) ev.push({ type: 'clash' });
    else {
      l = 1 - w;
      var d = damage(r[w], r[l], ult, cfg);
      dmg = d.dmg; blocked = d.blocked;
      s.hp[l] = Math.max(0, s.hp[l] - dmg);
      ev.push({ type: blocked ? 'block' : 'hit', target: l, by: w, dmg: dmg, ult: ult });
    }
    ev.push({ type: 'state', hp: s.hp.slice() });

    var ended = false, win = null, by = null;
    if (s.hp[0] === 0 || s.hp[1] === 0) { ended = true; win = s.hp[0] === 0 ? 1 : 0; by = 'ko'; }
    else if (s.round >= cfg.maxRounds) {
      ended = true;
      if (s.hp[0] !== s.hp[1]) { win = s.hp[0] > s.hp[1] ? 0 : 1; by = 'hp'; ev.push({ type: 'decision', by: 'hp' }); }
      else by = 'draw';
    }
    if (ended) {
      s.over = true; s.by = by;
      if (win === null) { s.draw = true; ev.push({ type: 'draw' }); }
      else { s.winner = win; s.loser = 1 - win; ev.push({ type: 'ko', winner: win, loser: 1 - win, by: by }); }
    }
    return {
      state: s, events: ev,
      turn: { n: s.round, rolls: r.slice(), winner: w, loser: l, dmg: dmg, blocked: blocked, ult: ult, hp: s.hp.slice(), over: s.over, by: s.by, dw: s.winner, draw: s.draw, max: cfg.maxHp }
    };
  }

  /* Hasil & hadiah setelah duel selesai. ctx: {pos, goal}.
     -> {draw, winner, loser, kind:'win'|'draw', back, from, to, skipTurn:false, xp:{winner,loser}, reviveHp}
     Kalah: mundur backTiles petak (tidak pernah di bawah petak 1). Menang: bertahan. Seri: tanpa hadiah, tidak ada yang bergerak. */
  function outcome(state, ctx) {
    if (!state.over) throw new Error('duel belum selesai');
    var cfg = state.cfg, pos = (ctx && ctx.pos) || 1;
    if (state.draw) {
      return { draw: true, winner: null, loser: null, kind: 'draw', by: 'draw', back: 0, from: pos, to: pos,
               skipTurn: false, xp: { winner: cfg.xpDraw, loser: cfg.xpDraw }, reviveHp: cfg.maxHp };
    }
    var to = Math.max(1, pos - cfg.backTiles);
    return {
      draw: false, winner: state.winner, loser: state.loser, kind: 'win', by: state.by,
      back: pos - to, from: pos, to: to, skipTurn: false,
      xp: { winner: cfg.xpWin, loser: cfg.xpLose }, reviveHp: cfg.reviveHp
    };
  }

  /* Mainkan duel sampai selesai (untuk simulasi/CPU/tes). rng opsional. Selalu berakhir paling lama di giliran 3. */
  function play(state, rng) {
    var s = state, all = [], n = 0;
    while (!s.over && n++ < 10) { var r = round(s, rng || Math.random); s = r.state; all = all.concat(r.events); }
    return { state: s, events: all };
  }

  return {
    DEFAULTS: DEFAULTS, ACTIONS: ACTIONS, actionOf: actionOf, isSafeTile: isSafeTile,
    rollValue: rollValue, damage: damage, create: create, round: round, outcome: outcome, play: play
  };
});

