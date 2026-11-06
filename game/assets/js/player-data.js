/* Data pemain bersama — SINGLE SOURCE OF TRUTH (Tahap 3).
   Dibaca/ditulis oleh SEMUA halaman non-gameplay lewat objek ini.
   Penyimpanan: localStorage["ularTanggaBlok:player:v1"] (hanya di browser ini, tanpa sinkronisasi server).
   Butuh: item-catalog.js dimuat lebih dulu.

   MIGRASI (v1): data lama dari kunci legacy "inv", "shop", "modeScreen", "ut-dadu", "ut-tema2"
   diimpor SEKALI secara idempoten. Kunci legacy TIDAK dihapus dan TIDAK ditimpa — tetap
   dipertahankan sebagai sumber kompatibilitas sampai tahap cleanup di masa depan.
   Tidak ada localStorage.clear() / removeItem untuk key legacy di file ini. */
(function (g) {
  'use strict';
  var C = g.ItemCatalog;
  var KEY = 'ularTanggaBlok:player:v1';
  var SCHEMA = 1;
  var MIGRATION_VERSION = 1;   /* playerDataMigrationVersion — naikkan bila ada langkah migrasi baru */
  var START_COINS = 1000;      /* saldo awal SEKALI saat data dibuat; tidak ada koin gratis berulang */
  var START_GEMS = 0;
  var START_XP = 0;            /* Chest Feature 2: XP minimal (hanya angka tersimpan; tanpa level/progression) */
  var DEFAULT_SETTINGS = { music: true, sound: true, vibration: true, graphics: 'high' };
  var DEFAULT_PROFILE = { name: 'OmanBogel' };   /* nama mock sementara (satu sumber: PlayerData.profile().name) */

  /* ---------- Mapping legacy -> canonical (EKSPLISIT, bukan tebakan) ----------
     Dice: hanya pasangan yang dapat DIBUKTIKAN dari project yang dipetakan.
     - "standard" -> dice.klasik : deskripsi legacy "Dadu klasik untuk semua pemain.",
       ditandai own:1 (starter) — persis peran dice.klasik di katalog/gameplay.
     - "emas"     -> dice.emas   : kunci & nama sama ("Dadu Emas"), palet emas sama.
     "ajaib", "crystal", "lava" dan SEMUA skin legacy (explorer-neon, snow-ranger,
     red-warrior, purple-mystic, green-ranger, yellow-scout, shadow-ninja, future-hero)
     TIDAK punya padanan yang dapat dipastikan -> UNMAPPED: tidak diimpor, tidak dihapus,
     tetap tersimpan di storage legacy (lihat DATA_MIGRATION.md). */
  var LEGACY_DICE_MAP = { standard: 'dice.klasik', emas: 'dice.emas' };
  var LEGACY_SKIN_MAP = {};    /* kosong dengan sengaja — tidak ada padanan yang dapat dibuktikan */
  var LEGACY_THEME_MAP = {};   /* ut-tema2 sudah memakai kunci tema canonical */
  var LEGACY_MAPS = { skin: LEGACY_SKIN_MAP, dice: LEGACY_DICE_MAP, theme: LEGACY_THEME_MAP };

  var memState = null;     /* cadangan di memori jika localStorage tidak bisa dipakai */
  var persistent = probe();
  var listeners = [];

  function probe() {
    try { var k = KEY + ':probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  }
  function rawGet() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function rawSet(s) { try { localStorage.setItem(KEY, s); return true; } catch (e) { return false; } }
  function legacyGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function legacySet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function legacyJSON(k) { /* baca key legacy tanpa pernah menulis/menghapusnya */
    try { var v = legacyGet(k); if (!v) return null; var o = JSON.parse(v); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; }
    catch (e) { return null; }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function normSettings(s) {
    var out = clone(DEFAULT_SETTINGS);
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      if (typeof s.music === 'boolean') out.music = s.music;
      if (typeof s.sound === 'boolean') out.sound = s.sound;
      if (typeof s.vibration === 'boolean') out.vibration = s.vibration;
      if (s.graphics === 'high' || s.graphics === 'low') out.graphics = s.graphics;
    }
    return out;
  }
  function normProfile(p) {
    var out = clone(DEFAULT_PROFILE);
    if (p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 16);
    if (out.name === 'FajarGG') out.name = DEFAULT_PROFILE.name;   /* mock lama -> mock baru (data tersimpan ikut diperbarui) */
    return out;
  }


  /* ---------- Statistik pertandingan & level (nyata, disimpan lokal) ---------- */
  var XP_WIN = 120, XP_LOSS = 40;          /* XP per match (menang / kalah) */
  var PTS_WIN = 100, PTS_LOSS = 10;        /* poin leaderboard per match */
  var SEEN_MAX = 40;                       /* token match terakhir untuk cegah hitung ganda */
  /* XP untuk naik dari level L ke L+1 = 400 + 100*(L-1). Level 1 mulai di XP 0. */
  function xpNeed(L) { return 400 + 100 * (L - 1); }
  function levelInfo(xp) {
    var L = 1, left = Math.max(0, Math.floor(+xp) || 0);
    while (left >= xpNeed(L) && L < 999) { left -= xpNeed(L); L++; }
    return { level: L, xpIn: left, xpMax: xpNeed(L) };
  }
  function weekKey(t) { /* Senin 00:00 UTC minggu ini, format YYYY-MM-DD (sama dengan server) */
    var d = new Date(t || Date.now()), day = (d.getUTCDay() + 6) % 7;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    return d.toISOString().slice(0, 10);
  }
  function normStats(s) {
    s = (s && typeof s === 'object') ? s : {};
    var n = function (v) { v = Math.floor(+v); return (isFinite(v) && v >= 0) ? v : 0; };
    var wk = weekKey();
    return {
      plays: n(s.plays), wins: n(s.wins), streak: n(s.streak), bestStreak: n(s.bestStreak),
      points: n(s.points),
      weekKey: wk, weekPoints: (s.weekKey === wk) ? n(s.weekPoints) : 0,   /* minggu baru -> reset */
      seen: Array.isArray(s.seen) ? s.seen.filter(function (x) { return typeof x === 'string'; }).slice(-SEEN_MAX) : []
    };
  }

  /* ---------- Pembuatan data awal ---------- */
  function freshState() {
    var now = Date.now(), seq = 0, inv = {};
    C.starters().forEach(function (it) { inv[it.id] = { qty: 1, acquiredAt: now, seq: seq++ }; });
    var st = { schema: SCHEMA, migration: 0, createdAt: now, coins: START_COINS, gems: START_GEMS, xp: START_XP, stats: normStats(null), nextSeq: seq,
               inventory: inv, equipped: clone(C.defaultEquipped),
               settings: clone(DEFAULT_SETTINGS), profile: clone(DEFAULT_PROFILE) };
    migrateLegacyEquip(st); /* pilihan dadu/tema lama (ut-dadu, ut-tema2) dulu gratis — pertahankan */
    return st;
  }

  /* Migrasi lama Tahap-2: kunci pilihan dadu/tema gratis. */
  function migrateLegacyEquip(st) {
    [['dice', 'ut-dadu'], ['theme', 'ut-tema2']].forEach(function (p) {
      var it = C.byGameKey(p[0], legacyGet(p[1]) || '');
      if (!it) return;
      if (!st.inventory[it.id]) st.inventory[it.id] = { qty: 1, acquiredAt: st.createdAt, seq: st.nextSeq++ };
      st.equipped[p[0]] = it.id;
    });
  }

  /* ---------- Validasi & normalisasi (tidak membuang data yang tak dikenal) ---------- */
  function sanitize(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    var now = Date.now();
    var st = {
      schema: SCHEMA,
      migration: (isFinite(o.migration) && o.migration >= 0) ? Math.floor(o.migration) : 0,
      createdAt: isFinite(o.createdAt) ? +o.createdAt : now,
      coins: (isFinite(o.coins) && o.coins >= 0) ? Math.floor(o.coins) : 0,
      gems: (isFinite(o.gems) && o.gems >= 0) ? Math.floor(o.gems) : START_GEMS,
      xp: (isFinite(o.xp) && o.xp >= 0) ? Math.floor(o.xp) : START_XP, /* save lama tanpa xp -> 0 */
      stats: normStats(o.stats),
      nextSeq: 0, inventory: {}, equipped: {},
      settings: normSettings(o.settings),
      profile: normProfile(o.profile)
    };
    var inv = (o.inventory && typeof o.inventory === 'object' && !Array.isArray(o.inventory)) ? o.inventory : {};
    var maxSeq = -1;
    Object.keys(inv).forEach(function (rawId) {
      var e = inv[rawId]; if (!e || typeof e !== 'object') return;
      /* Stage 4.1.20: save lama menyimpan Totem sebagai 'apple' -> baca sebagai 'totem' (idempoten; ID lain tidak berubah).
         Bila 'apple' dan 'totem' sama-sama ada, jumlahnya digabung (tidak ada duplikat, stok tidak hilang). */
      var id = C.normalizePowerId ? C.normalizePowerId(rawId) : rawId;
      var it = C.byId(id);
      var qty = Math.floor(+e.qty); if (!(qty >= 1)) qty = 1;
      if (it && !it.stackable) qty = 1;
      var seq = Math.floor(+e.seq); if (!(seq >= 0)) seq = maxSeq + 1;
      var acq = isFinite(e.acquiredAt) ? +e.acquiredAt : st.createdAt;
      var prev = st.inventory[id];
      if (prev) { qty = prev.qty + qty; acq = Math.min(prev.acquiredAt, acq); seq = Math.min(prev.seq, seq); }
      if (seq > maxSeq) maxSeq = seq;
      st.inventory[id] = { qty: qty, acquiredAt: acq, seq: seq };
    });
    st.nextSeq = Math.max(maxSeq + 1, Math.floor(+o.nextSeq) || 0);
    C.starters().forEach(function (it) { /* item awal tidak pernah hilang */
      if (!st.inventory[it.id]) st.inventory[it.id] = { qty: 1, acquiredAt: st.createdAt, seq: st.nextSeq++ };
    });
    var eq = (o.equipped && typeof o.equipped === 'object') ? o.equipped : {};
    ['skin', 'dice', 'theme', 'frame'].forEach(function (slot) { /* save lama tanpa frame -> frame.default (starter) */
      var it = C.byId(eq[slot]);
      st.equipped[slot] = (it && it.slot === slot && st.inventory[it.id]) ? it.id : C.defaultEquipped[slot];
    });
    return st;
  }

  function write(st) {
    if (!persistent) { memState = clone(st); return true; }
    if (!rawSet(JSON.stringify(st))) return false;
    memState = null;
    return true;
  }

  function mirrorLegacy(st) { /* kompatibilitas: gameplay.html lama membaca kunci ini */
    var d = C.byId(st.equipped.dice), t = C.byId(st.equipped.theme);
    if (d) legacySet('ut-dadu', d.gameKey);
    if (t) legacySet('ut-tema2', t.gameKey);
  }

  /* ---------- MIGRASI v1 (idempoten) ----------
     Dijalankan hanya bila st.migration < MIGRATION_VERSION. Setelah sukses, versi disimpan,
     sehingga pemanggilan berulang (refresh, pindah halaman) tidak menggandakan apa pun.
     Pengaman tambahan: currency hanya diimpor bila saldo masih "pristine"
     (belum pernah diubah sistem baru), item hanya ditambah bila belum dimiliki. */
  function migrateV1(st) {
    var inv = legacyJSON('inv'), shop = legacyJSON('shop'), mode = legacyJSON('modeScreen');

    /* --- currency: default 1000 coins TIDAK BOLEH menimpa saldo legacy --- */
    var pristine = st.coins === START_COINS && (st.gems | 0) === START_GEMS;
    if (pristine) {
      var cur = (inv && isFinite(inv.coins)) ? inv : ((shop && isFinite(shop.coins)) ? shop : null);
      if (cur) {
        var c = Math.floor(+cur.coins); if (c >= 0) st.coins = c;
        if (isFinite(cur.gems)) { var gm = Math.floor(+cur.gems); if (gm >= 0) st.gems = gm; }
      }
    }

    /* --- inventory: hanya ID canonical hasil mapping eksplisit; tidak pernah menduplikasi --- */
    function importOwned(list, map) {
      if (!Array.isArray(list)) return;
      list.forEach(function (legacyId) {
        var cid = map[legacyId] || (C.byId(legacyId) ? legacyId : null); /* id legacy yang ternyata canonical */
        if (!cid) return; /* unmapped: dipertahankan di storage legacy, tidak diimpor */
        if (!C.byId(cid)) return;
        if (!st.inventory[cid]) st.inventory[cid] = { qty: 1, acquiredAt: st.createdAt, seq: st.nextSeq++ };
      });
    }
    var own = (inv && inv.own) || (shop && shop.own) || {};
    importOwned(own.dice, LEGACY_DICE_MAP);
    importOwned(own.skin, LEGACY_SKIN_MAP);
    importOwned(own.theme, LEGACY_THEME_MAP);

    /* --- equipped: pulihkan pilihan legacy bila slot masih default --- */
    var eq = (inv && inv.eq) || (shop && shop.eq) || {};
    ['skin', 'dice', 'theme'].forEach(function (slot) {
      var lid = eq[slot]; if (!lid) return;
      var cid = LEGACY_MAPS[slot][lid] || (function () { var it = C.byId(lid); return (it && it.slot === slot) ? lid : null; })();
      if (!cid) return;
      if (st.inventory[cid] && st.equipped[slot] === C.defaultEquipped[slot]) st.equipped[slot] = cid;
    });

    /* --- settings & nama profil --- */
    var srcSet = (inv && inv.set) || (shop && shop.set) || (mode && mode.set) || null;
    if (srcSet) {
      var merged = normSettings(Object.assign({}, st.settings, srcSet));
      st.settings = merged;
    }
    if (inv && typeof inv.name === 'string' && inv.name.trim()) st.profile.name = inv.name.trim().slice(0, 16);
  }

  function ensureMigration(st) {
    if (st.migration >= MIGRATION_VERSION) return st;
    migrateV1(st);
    st.migration = MIGRATION_VERSION;
    return st;
  }

  /* ---------- Baca ---------- */
  function load() {
    if (!persistent) {
      if (!memState) memState = ensureMigration(freshState());
      return clone(memState);
    }
    var raw = rawGet();
    if (raw === null) {
      var st0 = ensureMigration(freshState());
      if (!write(st0)) { persistent = false; memState = clone(st0); }
      return st0;
    }
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    var st = sanitize(parsed);
    if (!st) { /* rusak: cadangkan dulu, lalu mulai bersih — tidak menghapus apa pun */
      try { localStorage.setItem(KEY + ':corrupt:' + Date.now(), raw); } catch (e) {}
      st = ensureMigration(freshState()); write(st);
      return st;
    }
    var before = st.migration;
    st = ensureMigration(st);
    if (st.migration !== before) write(st); /* hasil migrasi disimpan sekali */
    return st;
  }

  function notify(reason) {
    listeners.slice().forEach(function (fn) { try { fn(reason); } catch (e) {} });
  }

  /* ---------- API publik ---------- */
  var API = {
    key: KEY,
    startCoins: START_COINS,
    startGems: START_GEMS,
    migrationVersion: MIGRATION_VERSION, /* playerDataMigrationVersion */
    get persistent() { return persistent; },
    snapshot: function () { return load(); },
    coins: function () { return load().coins; },
    gems: function () { return load().gems; },
    xp: function () { return load().xp; },
    /* Level dihitung dari total XP (match + hadiah). {level, xpIn, xpMax, xp} */
    levelInfo: function () { var x = load().xp, i = levelInfo(x); i.xp = x; return i; },
    /* Statistik match (salinan). weekPoints otomatis 0 bila minggu sudah berganti. */
    stats: function () { var st = normStats(load().stats); delete st.seen; return st; },
    joinedAt: function () { return load().createdAt; },
    /* Catat hasil 1 match. IDEMPOTEN per token: token yang sama tidak dihitung dua kali.
       o = {token, won:boolean}. Mengembalikan {ok, duplicate, won, xpGain, points, levelUp, ...stats}. */
    recordMatch: function (o) {
      o = o || {};
      var token = String(o.token || '').slice(0, 80);
      if (!token) return { ok: false, reason: 'token-kosong' };
      var st = load(), s = normStats(st.stats);
      if (s.seen.indexOf(token) >= 0) return { ok: true, duplicate: true };
      var won = !!o.won, before = levelInfo(st.xp).level;
      s.plays += 1;
      if (won) { s.wins += 1; s.streak += 1; if (s.streak > s.bestStreak) s.bestStreak = s.streak; }
      else { s.streak = 0; }
      var pts = won ? PTS_WIN : PTS_LOSS, gain = won ? XP_WIN : XP_LOSS;
      s.points += pts; s.weekPoints += pts;
      s.seen.push(token); s.seen = s.seen.slice(-SEEN_MAX);
      st.stats = s; st.xp += gain;
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('stats');
      var after = levelInfo(st.xp).level;
      return { ok: true, duplicate: false, won: won, xpGain: gain, points: pts, level: after, levelUp: after > before,
               plays: s.plays, wins: s.wins, streak: s.streak, totalPoints: s.points, weekPoints: s.weekPoints };
    },
    settings: function () { return clone(load().settings); },
    profile: function () { return clone(load().profile); },
    owns: function (id) { return !!load().inventory[id]; },
    qty: function (id) { var e = load().inventory[id]; return e ? e.qty : 0; },
    equippedId: function (slot) { return load().equipped[slot] || null; },
    /* Skin yang sedang dipakai (ID canonical, mis. 'skin.hero'). Alias baca-saja dari equipped.skin —
       BUKAN state kedua. Dipakai tahap integrasi gameplay: PlayerData.equippedSkin() -> config -> renderer -> texture PNG. */
    equippedSkin: function () { return load().equipped.skin || null; },
    isEquipped: function (id) { var it = C.byId(id); return !!it && load().equipped[it.slot] === id; },

    /* Daftar item yang dimiliki: [{item, qty, acquiredAt, seq, equipped}] — hanya id yang ada di katalog */
    ownedItems: function () {
      var st = load();
      return Object.keys(st.inventory).map(function (id) {
        var it = C.byId(id); if (!it) return null;
        var e = st.inventory[id];
        return { item: it, qty: e.qty, acquiredAt: e.acquiredAt, seq: e.seq, equipped: st.equipped[it.slot] === id };
      }).filter(Boolean);
    },
    ownedCount: function () { return API.ownedItems().length; },

    /* Pakai item yang dimiliki. Return {ok, reason?}
       Power-Up (slot null) adalah consumable: tidak di-equip, quantity-nya dibaca via qty(). */
    equip: function (id) {
      var it = C.byId(id);
      if (!it) return { ok: false, reason: 'tidak-dikenal' };
      if (!it.slot) return { ok: false, reason: 'bukan-equipment', item: it };
      var st = load();
      if (!st.inventory[id]) return { ok: false, reason: 'belum-dimiliki' };
      st.equipped[it.slot] = id;
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      mirrorLegacy(st); notify('equip');
      return { ok: true, item: it };
    },

    /* Pembelian atomik (harga katalog = coins): validasi dulu, lalu saldo + inventory dalam SATU penulisan. */
    purchase: function (id) {
      var it = C.byId(id);
      if (!it || it.starter || !(it.price > 0)) return { ok: false, reason: 'tidak-tersedia' };
      var st = load();
      if (st.inventory[id] && !it.stackable) return { ok: false, reason: 'sudah-dimiliki', item: it };
      if (st.coins < it.price) return { ok: false, reason: 'saldo-kurang', item: it, kurang: it.price - st.coins };
      var before = st.coins;
      st.coins = before - it.price;
      var cur = st.inventory[id];
      st.inventory[id] = cur ? { qty: cur.qty + 1, acquiredAt: cur.acquiredAt, seq: cur.seq }
                             : { qty: 1, acquiredAt: Date.now(), seq: st.nextSeq++ };
      if (!write(st)) return { ok: false, reason: 'gagal-simpan', item: it };
      notify('purchase');
      return { ok: true, item: it, coins: st.coins, gems: st.gems, spent: it.price };
    },

    /* Perubahan currency atomik: addCurrency(+500) / addCurrency(0, +10) / addCurrency(-200, -5).
       Return {ok, coins, gems} atau {ok:false, reason:'saldo-kurang'|'gem-kurang', kurang} */
    addCurrency: function (dCoins, dGems) {
      var dC = Math.floor(+dCoins || 0), dG = Math.floor(+dGems || 0);
      var st = load();
      var nc = st.coins + dC, ng = st.gems + dG;
      if (nc < 0) return { ok: false, reason: 'saldo-kurang', kurang: -nc };
      if (ng < 0) return { ok: false, reason: 'gem-kurang', kurang: -ng };
      st.coins = nc; st.gems = ng;
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('currency');
      return { ok: true, coins: st.coins, gems: st.gems };
    },

    /* Hadiah/reward atomik (daily reward, event): {coins, gems, xp, item, duplicateCoins, duplicateGems, reason}.
       Item non-stackable yang sudah dimiliki -> tidak diduplikasi; beri kompensasi duplicateCoins/duplicateGems. */
    grant: function (o) {
      o = o || {};
      var it = o.item ? C.byId(o.item) : null;
      if (o.item && !it) return { ok: false, reason: 'tidak-dikenal' };
      var st = load();
      var duplicate = false, compensation = 0;
      if (it) {
        if (st.inventory[it.id] && !it.stackable) {
          duplicate = true;
          compensation = Math.max(0, Math.floor(+o.duplicateCoins || 0));
          st.coins += compensation;
          var compG = Math.max(0, Math.floor(+o.duplicateGems || 0));
          st.gems += compG; compensation += compG;
        } else {
          var cur = st.inventory[it.id];
          st.inventory[it.id] = cur ? { qty: cur.qty + 1, acquiredAt: cur.acquiredAt, seq: cur.seq }
                                    : { qty: 1, acquiredAt: Date.now(), seq: st.nextSeq++ };
        }
      }
      st.coins += Math.max(0, Math.floor(+o.coins || 0));
      st.gems += Math.max(0, Math.floor(+o.gems || 0));
      st.xp += Math.max(0, Math.floor(+o.xp || 0));
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify(o.reason || 'reward');
      return { ok: true, duplicate: duplicate, compensation: compensation, coins: st.coins, gems: st.gems, xp: st.xp };
    },

    /* Pengaturan (bagian dari player state): whitelist field, satu penulisan. */
    setSettings: function (patch) {
      var st = load();
      var p = (patch && typeof patch === 'object') ? patch : {};
      var next = clone(st.settings);
      if (typeof p.music === 'boolean') next.music = p.music;
      if (typeof p.sound === 'boolean') next.sound = p.sound;
      if (typeof p.vibration === 'boolean') next.vibration = p.vibration;
      if (p.graphics === 'high' || p.graphics === 'low') next.graphics = p.graphics;
      st.settings = next;
      if (!write(st)) return null;
      notify('settings');
      return clone(next);
    },

    /* Nama profil (bagian dari player state). */
    setName: function (name) {
      if (typeof name !== 'string' || !name.trim()) return null;
      var st = load();
      st.profile.name = name.trim().slice(0, 16);
      if (!write(st)) return null;
      notify('profile');
      return clone(st.profile);
    },

    /* Langganan perubahan (halaman ini + tab/halaman lain). Mengembalikan fungsi berhenti. */
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    }
  };

  g.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) notify('storage');
  });
  g.addEventListener('pageshow', function (e) { if (e.persisted) notify('pageshow'); }); /* bfcache saat tombol kembali */

  g.PlayerData = API;
  load(); /* pastikan data awal/migrasi dibuat sekali, tanpa me-reset data yang sudah ada */
})(window);
