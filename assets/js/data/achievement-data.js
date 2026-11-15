/* Achievement — definisi (18 achievement x 3 bintang) + perhitungan status dari data SERVER (get_my_profile).
   Klaim divalidasi & dikreditkan server (claim_achievement); berkas ini hanya teks/target/nominal tampilan dan rumus progres.
   Dapat dimuat di browser (window.UT.Achievement) maupun Node (module.exports) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Achievement = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  /* [id, nama, deskripsi, kunci statistik, target 3 bintang, kelas hadiah] */
  var ACH = [
    ['peti', 'Penakluk Peti', 'Buka peti', 'chest', [10, 100, 1000], 'sedang'],
    ['naga', 'Penyerang Naga', 'Serang naga', 'dragon', [10, 50, 500], 'sulit'],
    ['aktif', 'Pemain Aktif', 'Main sebanyak mungkin', 'play', [10, 100, 1000], 'sedang'],
    ['menang', 'Master Kemenangan', 'Menangkan pertandingan', 'win', [5, 50, 500], 'sulit'],
    ['tangga', 'Raja Tangga', 'Naik tangga', 'ladder', [25, 250, 2500], 'sedang'],
    ['ular', 'Penakluk Ular', 'Terkena ular', 'snake', [25, 250, 2500], 'mudah'],
    ['skill', 'Pengguna Skill', 'Gunakan skill', 'skill', [25, 250, 2500], 'sedang'],
    ['dadu', 'Pecinta Dadu', 'Lempar dadu', 'dice', [100, 1000, 10000], 'sedang'],
    ['papan', 'Penyelesai Misi', 'Selesaikan misi harian', 'quest', [10, 100, 500], 'sedang'],
    ['login', 'Login Setia', 'Login berturut-turut', 'login', [7, 30, 100], 'sulit'],
    ['streak', 'Win Streak', 'Menang beruntun', 'streak', [3, 7, 15], 'sulit'],
    ['skin', 'Kolektor', 'Miliki dadu, frame, aura, dan skin', 'collection', [5, 15, 30], 'sedang'],
    ['emerald', 'Pemburu Emerald', 'Kumpulkan Emerald', 'emerald', [50, 500, 5000], 'sedang'],
    ['strategi', 'Ahli Strategi', 'Menang dengan skill berbeda', 'strat', [5, 25, 100], 'sulit'],
    ['legenda', 'Sang Legenda', 'Menangkan pertandingan', 'win', [500, 1000, 2000], 'legendaris'],
    ['boss', 'Pemburu Boss', 'Kalahkan Ender Dragon online', 'boss', [10, 100, 500], 'sulit'],
    ['teman', 'Si Ramah', 'Punya teman', 'friends', [1, 5, 20], 'mudah'],
    ['level', 'Naik Level', 'Capai level pemain', 'level', [5, 20, 50], 'sedang']
  ];
  /* hadiah per bintang menurut kelas: [coin, emerald] (nominal asli dihitung server; ini hanya untuk tampilan) */
  var CLS = {
    mudah: [[300, 0], [1000, 2], [3000, 5]],
    sedang: [[500, 1], [2000, 5], [6000, 15]],
    sulit: [[1000, 3], [4000, 10], [12000, 30]],
    legendaris: [[2000, 5], [8000, 25], [25000, 75]]
  };
  var REW = CLS.sedang;

  function num(v) { v = Math.floor(+v); return isFinite(v) ? v : 0; }

  /* sp = hasil get_my_profile (counters sudah memuat koleksi, boss, teman, emerald, misi dari server). */
  function stats(sp) {
    var c = (sp && sp.counters) || {};
    return { chest: num(c.chests), dragon: num(c.dragon_hits), play: num(sp && sp.plays), win: num(sp && sp.wins), ladder: num(c.ladders),
      snake: num(c.snakes), skill: num(c.skills_used), dice: num(c.dice_rolls), quest: num(c.quests_done), login: num(c.best_login_streak),
      streak: num(sp && sp.best_streak), collection: num(c.collection), emerald: num(c.emerald), strat: num(c.skill_wins),
      boss: num(c.boss_wins), friends: num(c.friends), level: num(sp && sp.level) };
  }
  /* Status tiap achievement: v nilai, st bintang diraih, cl bintang sudah diklaim, pend yang menunggu klaim, tg target berikutnya, rew hadiah per bintang. */
  function info(sp) {
    var S = stats(sp), claims = (sp && sp.claims) || {};
    return ACH.map(function (a) {
      var v = S[a[3]] || 0, t = a[4], st = t.filter(function (x) { return v >= x; }).length, tg = t[Math.min(st, 2)];
      var cl = Math.min(3, Math.max(0, num(claims[a[0]])), st);
      return { id: a[0], name: a[1], desc: a[2], v: v, st: st, tg: tg, done: st >= 3, r: Math.min(1, v / tg), cl: cl, pend: st - cl, rew: CLS[a[5]] || REW };
    });
  }
  /* jumlah [coin, emerald] untuk bintang ke-from .. to-1; rew = array hadiah per bintang (default kelas sedang) */
  function reward(from, to, rew) {
    return (rew || REW).slice(from, to).reduce(function (t, x) { return [t[0] + x[0], t[1] + x[1]]; }, [0, 0]);
  }
  return { ACH: ACH, REW: REW, CLS: CLS, stats: stats, info: info, reward: reward };
});
