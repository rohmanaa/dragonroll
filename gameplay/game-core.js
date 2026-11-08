/* Ular Tangga Blok — gameplay/game-core.js
   INTI ATURAN MURNI: tanpa DOM, THREE, audio, atau animasi. Hanya data -> data.
   Bisa dipakai di browser (UT.Gameplay.Core) dan Node (require) untuk tes otomatis,
   serta nanti di server agar dadu & hasil tidak bisa dicurangi di klien.

   Aturan (sama dengan perilaku gameplay.html):
   - Dadu 1-6. Angka 6 = giliran tambahan.
   - Tiga kali 6 berturut-turut = giliran hangus (tanpa bergerak, tanpa giliran tambahan).
   - Melewati petak akhir = memantul: akhir - kelebihan.
   - Mendarat di kaki tangga naik, di kepala ular turun (sekali, tanpa rantai).
   - Mencapai petak akhir = menang (opsi onGoal:'stop' bila fase boss ditangani lapisan lain).
   API: create(opts) -> state ; roll(state, rng|value) -> {state, events}. State tidak dimutasi. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  var UT = root.UT = root.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  if (!G.Core || !Object.keys(G.Core).length) G.Core = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DEFAULTS = {
    goal: 100,
    ladders: { 8: 26, 20: 41, 36: 55, 51: 72, 71: 91 },
    snakes: { 17: 7, 32: 12, 47: 27, 62: 44, 98: 77 },
    maxSixes: 3,
    onGoal: 'win' /* 'win' | 'stop' (berhenti di goal, fase boss dikelola luar) */
  };

  /* Validasi papan: kembalikan daftar masalah (kosong = valid). */
  function validateBoard(b) {
    var errs = [], goal = b.goal, L = b.ladders || {}, S = b.snakes || {};
    if (!Number.isInteger(goal) || goal < 2) errs.push('goal tidak valid');
    Object.keys(L).forEach(function (k) {
      var f = +k, t = L[k];
      if (!(f >= 1 && t <= goal && t > f)) errs.push('tangga ' + f + '->' + t + ' tidak valid');
    });
    Object.keys(S).forEach(function (k) {
      var f = +k, t = S[k];
      if (!(f <= goal && t >= 1 && t < f)) errs.push('ular ' + f + '->' + t + ' tidak valid');
      if (L[f] != null) errs.push('petak ' + f + ' ada tangga sekaligus ular');
    });
    if (L[goal] != null || S[goal] != null) errs.push('petak akhir tidak boleh tangga/ular');
    [L, S].forEach(function (m) {
      Object.keys(m).forEach(function (k) {
        var t = m[k]; if (L[t] != null || S[t] != null) errs.push('rantai di petak ' + t);
      });
    });
    return errs;
  }

  function create(opts) {
    opts = opts || {};
    var cfg = {
      goal: opts.goal || DEFAULTS.goal,
      ladders: Object.assign({}, opts.ladders || DEFAULTS.ladders),
      snakes: Object.assign({}, opts.snakes || DEFAULTS.snakes),
      maxSixes: opts.maxSixes || DEFAULTS.maxSixes,
      onGoal: opts.onGoal || DEFAULTS.onGoal
    };
    var errs = validateBoard(cfg);
    if (errs.length) throw new Error('Papan tidak valid: ' + errs.join('; '));
    var ids = opts.players || ['p1', 'p2'];
    if (!Array.isArray(ids) || ids.length < 1) throw new Error('minimal 1 pemain');
    if (new Set(ids).size !== ids.length) throw new Error('id pemain harus unik');
    return {
      cfg: cfg,
      players: ids.map(function (id) { return { id: id, pos: 0, sixes: 0 }; }),
      cur: 0, over: false, winner: null, turn: 1
    };
  }

  function clone(s) {
    return {
      cfg: s.cfg,
      players: s.players.map(function (p) { return { id: p.id, pos: p.pos, sixes: p.sixes }; }),
      cur: s.cur, over: s.over, winner: s.winner, turn: s.turn
    };
  }

  /* Dadu: rng() harus mengembalikan [0,1). Angka bulat 1-6 juga diterima langsung. */
  function rollValue(rng) {
    if (typeof rng === 'number') {
      if (!Number.isInteger(rng) || rng < 1 || rng > 6) throw new Error('nilai dadu harus 1-6');
      return rng;
    }
    var r = (rng || Math.random)();
    return 1 + Math.floor(r * 6);
  }

  /* Rencana gerak murni: dari pos maju `steps` di papan berpetak akhir `goal`.
     Tanpa kelebihan -> {to, over:0, bounceTo:null}.
     Kelebihan -> pion tiba di goal lalu memantul: {to:goal, over, bounceTo:goal-over}. */
  function planMove(pos, steps, goal) {
    var target = pos + steps;
    if (target <= goal) return { to: target, over: 0, bounceTo: null, final: target };
    var over = target - goal;
    return { to: goal, over: over, bounceTo: goal - over, final: goal - over };
  }

  /* Hitungan enam berturut-turut setelah satu lemparan. forfeit=true -> giliran hangus (hitungan di-reset). */
  function sixesAfter(prev, value, max) {
    var n = value === 6 ? prev + 1 : 0;
    if (n >= (max || DEFAULTS.maxSixes)) return { sixes: 0, forfeit: true };
    return { sixes: n, forfeit: false };
  }

  /* ---- Efek mob & peti (murni) ----
     SOFT_CAP = batas legacy 99 yang di kode lama tertulis mati (Villager, peti, Enderman maks 98),
     juga pada peta goal>100 (Nether=120). Dipertahankan agar refaktor tidak mengubah perilaku;
     ubah di satu tempat ini bila ingin mengikuti goal. */
  var SOFT_CAP = 99;

  /* Efek mob di petak `pos`. o: {goal, back:{mob:langkah}, rng}. -> {kind:'back'|'forward'|'teleport'|'none', to, steps} */
  function mobEffect(mob, pos, o) {
    o = o || {}; var goal = o.goal || DEFAULTS.goal, rng = o.rng || Math.random, to;
    function res(kind, t) { return { kind: kind, to: t, steps: t - pos }; }
    if (mob === 'creeper') return res('back', Math.max(1, pos - 2));
    if (mob === 'skeleton') return res('back', Math.max(1, pos - 1));
    if (mob === 'villager') return res('forward', Math.min(SOFT_CAP, pos + 5));
    if (mob === 'strider') return res('forward', Math.min(goal - 1, pos + 3));
    if (mob === 'ender') {
      var hi = SOFT_CAP - 1, tries = 0;
      do { to = pos + Math.floor(rng() * 21) - 10; } while ((to < 1 || to > hi || to === pos) && ++tries < 1000);
      if (to < 1 || to > hi || to === pos) to = pos;
      return res('teleport', to);
    }
    var bk = o.back && o.back[mob];
    if (typeof bk !== 'number') return res('none', pos);
    return res('back', Math.max(1, pos - bk));
  }

  /* Maju/mundur peti: dijepit ke [1, cap]. */
  function chestMove(pos, delta, cap) { return Math.max(1, Math.min(cap || SOFT_CAP, pos + delta)); }

  /* Petak tangga/ular terdekat DI DEPAN pos dari tabel {petak:tujuan}; null bila tidak ada. */
  function chestNearest(pos, table) {
    var ahead = Object.keys(table || {}).map(Number).filter(function (n) { return n > pos; }).sort(function (a, b) { return a - b; });
    return ahead.length ? ahead[0] : null;
  }

  /* Undi reward peti dari pool [{id,w}] (total wajib 1000). Tidak valid -> {id:'empty', invalid:true}. */
  function pickChestReward(pool, rng) {
    var total = (pool || []).reduce(function (a, r) { return a + r.w; }, 0);
    if (total !== 1000) return { id: 'empty', invalid: true };
    var x = Math.floor((rng || Math.random)() * total);
    for (var i = 0; i < pool.length; i++) { if (x < pool[i].w) return { id: pool[i].id }; x -= pool[i].w; }
    return { id: 'empty' };
  }

  function advance(s) {
    s.cur = (s.cur + 1) % s.players.length; s.turn++;
  }

  function resolveTile(s, p, ev) {
    var L = s.cfg.ladders, S = s.cfg.snakes;
    if (L[p.pos] != null) { ev.push({ type: 'ladder', id: p.id, from: p.pos, to: L[p.pos] }); p.pos = L[p.pos]; }
    else if (S[p.pos] != null) { ev.push({ type: 'snake', id: p.id, from: p.pos, to: S[p.pos] }); p.pos = S[p.pos]; }
  }

  /* Satu lemparan untuk pemain giliran saat ini. */
  function roll(state, rngOrValue) {
    if (state.over) throw new Error('game sudah selesai');
    var s = clone(state), ev = [], p = s.players[s.cur], v = rollValue(rngOrValue), goal = s.cfg.goal;
    ev.push({ type: 'roll', id: p.id, value: v });

    var sx = sixesAfter(p.sixes, v, s.cfg.maxSixes);
    p.sixes = sx.sixes;
    if (sx.forfeit) {
      ev.push({ type: 'triple_six', id: p.id });
      advance(s); ev.push({ type: 'turn', id: s.players[s.cur].id });
      return { state: s, events: ev };
    }

    var from = p.pos, pm = planMove(from, v, goal);
    ev.push({ type: 'move', id: p.id, from: from, to: pm.to });
    if (pm.over) ev.push({ type: 'bounce', id: p.id, over: pm.over, to: pm.bounceTo });
    p.pos = pm.final;

    if (p.pos === goal) {
      if (s.cfg.onGoal === 'win') {
        s.over = true; s.winner = p.id; ev.push({ type: 'win', id: p.id });
        return { state: s, events: ev };
      }
      ev.push({ type: 'goal', id: p.id }); /* 'stop': lapisan luar (boss) yang lanjut */
    } else {
      resolveTile(s, p, ev);
    }

    if (v === 6) ev.push({ type: 'extra_turn', id: p.id }); /* p.sixes tetap, giliran tidak berpindah */
    else { advance(s); ev.push({ type: 'turn', id: s.players[s.cur].id }); }
    return { state: s, events: ev };
  }

  return { DEFAULTS: DEFAULTS, validateBoard: validateBoard, planMove: planMove, sixesAfter: sixesAfter, mobEffect: mobEffect, chestMove: chestMove, chestNearest: chestNearest, pickChestReward: pickChestReward, SOFT_CAP: SOFT_CAP, create: create, roll: roll, rollValue: rollValue };
});
