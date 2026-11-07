/* Quest (Daily Quest) — data & logika misi harian. Dipakai misi.html.
   State: localStorage 'ut:quest' = {v,day,prog:{login,play,win},claimed:{id:true},bonus:bool,winBase:n}
   - Reset otomatis tiap ganti hari (jam lokal).
   - login   : tercatat otomatis saat halaman Misi dibuka (UT.Quest.track('login')).
   - win     : dibaca otomatis dari kemenangan gameplay ('ut-dragon-win'.wins) dikurangi baseline awal hari.
   - play    : UT.Quest.track('play') — panggil dari gameplay saat pertandingan selesai (belum terpasang).
                Kemenangan otomatis dihitung sebagai 1 pertandingan selesai.
   - Hadiah coin lewat PlayerData.grant (atomik, tidak bisa digandakan; ditandai klaim DULU baru diberikan). */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var KEY = 'ut:quest', WINKEY = 'ut-dragon-win';
  var DEFS = [
    { id: 'login', title: 'Login Harian',      desc: 'Masuk ke dalam game',        goal: 1, reward: 50,  icon: 'mode/calndar' },
    { id: 'play',  title: 'Mainkan Permainan', desc: 'Selesaikan 1 pertandingan',  goal: 1, reward: 75,  icon: 'items/dadu' },
    { id: 'win',   title: 'Raih Kemenangan',   desc: 'Menangkan 3 pertandingan',   goal: 3, reward: 150, icon: 'lobby/trophy' }
  ];
  var BONUS = 100;

  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function winsNow() { try { var o = JSON.parse(localStorage.getItem(WINKEY) || 'null'); return (o && isFinite(o.wins) && o.wins >= 0) ? Math.floor(o.wins) : 0; } catch (e) { return 0; } }
  function fresh() { return { v: 1, day: dayKey(), prog: { login: 0, play: 0, win: 0 }, claimed: {}, bonus: false, winBase: winsNow() }; }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!s || typeof s !== 'object' || s.day !== dayKey()) { s = fresh(); save(s); return s; }
    s.prog = Object.assign({ login: 0, play: 0, win: 0 }, s.prog || {});
    s.claimed = (s.claimed && typeof s.claimed === 'object') ? s.claimed : {};
    if (!isFinite(s.winBase)) s.winBase = winsNow();
    if (winsNow() < s.winBase) s.winBase = winsNow(); /* catatan menang direset: jangan jadi negatif */
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function def(id) { for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i]; return null; }

  function progress(id, s) {
    s = s || load();
    var d = def(id); if (!d) return 0;
    var wins = Math.max(0, winsNow() - s.winBase), v = s.prog[id] || 0;
    if (id === 'win') v = Math.max(v, wins);
    if (id === 'play') v = Math.max(v, wins > 0 ? 1 : 0);
    return Math.min(d.goal, Math.floor(v));
  }
  function status(id, s) {
    s = s || load();
    var d = def(id);
    return s.claimed[id] ? 'claimed' : (progress(id, s) >= d.goal ? 'ready' : 'todo');
  }
  function grant(coins) {
    var PD = win.PlayerData;
    if (!PD || !PD.grant) return false;
    var r = PD.grant({ coins: coins, reason: 'quest' });
    return !!(r && r.ok);
  }

  var Quest = UT.Quest = {
    DEFS: DEFS, BONUS: BONUS,
    list: function () {
      var s = load();
      return DEFS.map(function (d) { return { id: d.id, title: d.title, desc: d.desc, goal: d.goal, reward: d.reward, icon: d.icon, progress: progress(d.id, s), status: status(d.id, s) }; });
    },
    total: function () { return DEFS.reduce(function (a, d) { return a + d.reward; }, 0); },
    claimable: function () { var s = load(); return DEFS.filter(function (d) { return status(d.id, s) === 'ready'; }); },
    bonusState: function () {
      var s = load();
      if (s.bonus) return 'claimed';
      return DEFS.every(function (d) { return s.claimed[d.id]; }) ? 'ready' : 'locked';
    },
    track: function (type, n) {
      if (type !== 'login' && type !== 'play' && type !== 'win') return false;
      var s = load(), d = def(type);
      s.prog[type] = Math.min(d.goal, Math.max(s.prog[type] || 0, 0) + (n === undefined ? 1 : Math.max(0, Math.floor(+n) || 0)));
      return save(s);
    },
    claim: function (id) {
      var s = load(), d = def(id);
      if (!d || status(id, s) !== 'ready') return { ok: false, coins: 0 };
      s.claimed[id] = true;
      if (!save(s)) return { ok: false, coins: 0 };
      if (!grant(d.reward)) { delete s.claimed[id]; save(s); return { ok: false, coins: 0 }; }
      return { ok: true, coins: d.reward };
    },
    claimAll: function () {
      var s = load(), list = DEFS.filter(function (d) { return status(d.id, s) === 'ready'; });
      if (!list.length) return { ok: false, coins: 0 };
      var sum = 0; list.forEach(function (d) { s.claimed[d.id] = true; sum += d.reward; });
      if (!save(s)) return { ok: false, coins: 0 };
      if (!grant(sum)) { list.forEach(function (d) { delete s.claimed[d.id]; }); save(s); return { ok: false, coins: 0 }; }
      return { ok: true, coins: sum, count: list.length };
    },
    claimBonus: function () {
      var s = load();
      if (Quest.bonusState() !== 'ready') return { ok: false, coins: 0 };
      s.bonus = true;
      if (!save(s)) return { ok: false, coins: 0 };
      if (!grant(BONUS)) { s.bonus = false; save(s); return { ok: false, coins: 0 }; }
      return { ok: true, coins: BONUS };
    },
    msUntilReset: function () { var n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); return Math.max(0, m - n); },
    /* untuk badge (mis. titik merah di tombol Misi lobby): ada misi/bonus yang bisa diklaim? */
    hasClaimable: function () { return Quest.claimable().length > 0 || Quest.bonusState() === 'ready'; }
  };
})(window);
