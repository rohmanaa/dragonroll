/* Achievement — definisi (15 achievement x 3 bintang) + perhitungan status dari data SERVER (get_my_profile).
   Klaim divalidasi & dikreditkan server (claim_achievement); berkas ini hanya teks/target/nominal tampilan dan rumus progres.
   Dapat dimuat di browser (window.UT.Achievement) maupun Node (module.exports) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Achievement = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  /* [id, nama, deskripsi, kunci statistik, target 3 bintang] */
  var ACH = [
    ['peti', 'Penakluk Peti', 'Buka peti', 'chest', [10, 50, 200]],
    ['naga', 'Penyerang Naga', 'Serang naga', 'dragon', [3, 10, 30]],
    ['aktif', 'Pemain Aktif', 'Main sebanyak mungkin', 'play', [10, 50, 200]],
    ['menang', 'Master Kemenangan', 'Menangkan pertandingan', 'win', [3, 50, 200]],
    ['tangga', 'Raja Tangga', 'Naik tangga', 'ladder', [10, 50, 150]],
    ['ular', 'Penakluk Ular', 'Terkena ular', 'snake', [10, 50, 150]],
    ['skill', 'Pengguna Skill', 'Gunakan skill', 'skill', [10, 50, 200]],
    ['dadu', 'Pecinta Dadu', 'Lempar dadu', 'dice', [50, 250, 1000]],
    ['papan', 'Penjelajah Papan', 'Selesaikan pertandingan', 'match', [5, 50, 200]],
    ['login', 'Login Setia', 'Login berturut-turut', 'login', [3, 7, 30]],
    ['streak', 'Win Streak', 'Menang beruntun', 'streak', [2, 5, 10]],
    ['skin', 'Kolektor Skin', 'Miliki skin', 'skins', [2, 10, 25]],
    ['emerald', 'Pemburu Emerald', 'Kumpulkan Emerald', 'emerald', [10, 100, 500]],
    ['strategi', 'Ahli Strategi', 'Menang dengan skill berbeda', 'strat', [2, 5, 10]],
    ['legenda', 'Sang Legenda', 'Menangkan pertandingan', 'win', [500, 1000, 2000]]
  ];
  /* hadiah per bintang: [coin, emerald] (nominal asli dihitung server; ini hanya untuk tampilan) */
  var REW = [[250, 5], [750, 10], [2000, 25]];

  function num(v) { v = Math.floor(+v); return isFinite(v) ? v : 0; }

  /* sp = hasil get_my_profile ({counters, plays, wins, best_streak, claims}); extra = {skins, emerald} dari perangkat. */
  function stats(sp, extra) {
    var c = (sp && sp.counters) || {}; extra = extra || {};
    return { chest: num(c.chests), dragon: num(c.dragon_hits), play: num(sp && sp.plays), win: num(sp && sp.wins), ladder: num(c.ladders),
      snake: num(c.snakes), skill: num(c.skills_used), dice: num(c.dice_rolls), match: num(sp && sp.plays), login: num(c.best_login_streak),
      streak: num(sp && sp.best_streak), skins: num(extra.skins), emerald: num(extra.emerald), strat: num(c.skill_wins) };
  }
  /* Status tiap achievement: v nilai, st bintang diraih, cl bintang sudah diklaim, pend yang menunggu klaim, tg target berikutnya. */
  function info(sp, extra) {
    var S = stats(sp, extra), claims = (sp && sp.claims) || {};
    return ACH.map(function (a) {
      var v = S[a[3]] || 0, t = a[4], st = t.filter(function (x) { return v >= x; }).length, tg = t[Math.min(st, 2)];
      var cl = Math.min(3, Math.max(0, num(claims[a[0]])), st);
      return { id: a[0], name: a[1], desc: a[2], v: v, st: st, tg: tg, done: st >= 3, r: Math.min(1, v / tg), cl: cl, pend: st - cl };
    });
  }
  /* jumlah [coin, emerald] untuk bintang ke-from .. to-1 */
  function reward(from, to) {
    return REW.slice(from, to).reduce(function (t, x) { return [t[0] + x[0], t[1] + x[1]]; }, [0, 0]);
  }
  return { ACH: ACH, REW: REW, stats: stats, info: info, reward: reward };
});
