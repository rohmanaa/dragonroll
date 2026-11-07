/* Data pemain bersama — SINGLE SOURCE OF TRUTH (Tahap 3).
   Dibaca/ditulis oleh SEMUA halaman non-gameplay lewat objek ini.
   Penyimpanan: localStorage (hanya di browser ini, tanpa sinkronisasi server), TERPISAH PER AKUN:
   - tamu / belum login : "ularTanggaBlok:player:v1"
   - akun login         : "ularTanggaBlok:player:v1:acct:<id akun>" (id dari cache "ut-auth")
   Logout tidak menghapus data akun; data kembali saat akun itu login lagi. Akun berikutnya di perangkat
   yang sama TIDAK mewarisi koin/inventory/XP akun sebelumnya. Data tamu dipindahkan (bukan disalin) ke
   akun pertama yang login bila akun itu belum punya data lokal.
   Butuh: item-catalog.js dimuat lebih dulu.

   MIGRASI (v1): data lama dari kunci legacy "inv", "shop", "modeScreen", "ut-dadu", "ut-tema2"
   diimpor SEKALI secara idempoten. Kunci legacy TIDAK dihapus dan TIDAK ditimpa — tetap
   dipertahankan sebagai sumber kompatibilitas sampai tahap cleanup di masa depan.
   Tidak ada localStorage.clear(). Pembersihan (Tahap 1 penghapusan localStorage) hanya menghapus key legacy yang
   TIDAK dibaca kode mana pun lagi ("shop", "modeScreen", "lobbyGift"), dan HANYA setelah migrasi v1 selesai;
   "inv", "ut-dadu", "ut-tema2", "ut-malam" masih dipakai halaman lain dan dibiarkan. Cadangan ":corrupt:"
   dipangkas ke yang terbaru saja per kunci. */
(function (g) {
  'use strict';
  var C = g.ItemCatalog;
  var BASE_KEY = 'ularTanggaBlok:player:v1';
  var ACH_BASE = 'ularTanggaBlok:achClaimed:v1';   /* klaim achievement (dipakai profile.html) */
  var SCHEMA = 1;
  var MIGRATION_VERSION = 1;   /* playerDataMigrationVersion — naikkan bila ada langkah migrasi baru */
  var SET_MAX_UNIQUE = 20, SET_MAX_RAW = 200;   /* batas beli set: sama dengan buy_set di server */
  var START_COINS = 1000;      /* saldo awal SEKALI saat data dibuat; tidak ada koin gratis berulang */
  var START_GEMS = 0;
  var START_XP = 0;            /* Chest Feature 2: XP minimal (hanya angka tersimpan; tanpa level/progression) */
  var DEFAULT_SETTINGS = { music: true, sound: true, vibration: true, graphics: 'high', ambience: 'day' }; /* ambience: 'day' | 'night' | 'system' (ikuti perangkat) */
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

  /* Id akun yang sedang login (dari cache auth.js). '' = tamu. Divalidasi agar aman dipakai sebagai bagian nama kunci. */
  function accountId() {
    try {
      var a = JSON.parse(localStorage.getItem('ut-auth') || 'null');
      return (a && typeof a.id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(a.id)) ? a.id : '';
    } catch (e) { return ''; }
  }
  function keyFor(base) { var id = accountId(); return id ? base + ':acct:' + id : base; }
  function key() { return keyFor(BASE_KEY); }
  /* Akun login pertama kali di perangkat ini: pindahkan data tamu (jika ada) ke akun, lalu hapus salinan tamu
     agar akun lain tidak ikut mewarisinya. Tidak berbuat apa-apa bila akun sudah punya data. */
  function adoptGuest() {
    if (!accountId()) return;
    try {
      [BASE_KEY, ACH_BASE].forEach(function (b) {
        var dst = keyFor(b);
        if (localStorage.getItem(dst) !== null) return;
        var v = localStorage.getItem(b);
        if (v === null) return;
        localStorage.setItem(dst, v);
        localStorage.removeItem(b);
      });
    } catch (e) {}
  }

  var memState = null;     /* cadangan di memori jika localStorage tidak bisa dipakai */
  var persistent = probe();
  var listeners = [];

  function probe() {
    try { var k = BASE_KEY + ':probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  }
  function rawGet() { try { return localStorage.getItem(key()); } catch (e) { return null; } }
  function rawSet(s) { try { localStorage.setItem(key(), s); return true; } catch (e) { return false; } }
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
      if (s.ambience === 'day' || s.ambience === 'night' || s.ambience === 'system') out.ambience = s.ambience;
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

  /* ---------- Gear karakter (builder) ----------
     equipped['g.<bagian>'] / equipped['g.acc.<kunci>'] = ID gear yang DIMILIKI; slot kosong = tidak dipakai.
     gearDye[itemId] = id pewarna pilihan pemain (kosmetik, lokal; daftar warna milik builder, di sini hanya divalidasi bentuknya). */
  var DYE_RE = /^[a-z0-9_]{1,24}$/;
  function cleanGear(st, eq, dyes) {
    st.gearDye = {};
    C.gearSlots().forEach(function (slot) {
      var it = C.byId(eq && eq[slot]);
      if (it && it.slot === slot && st.inventory[it.id]) st.equipped[slot] = it.id; else delete st.equipped[slot];
    });
    if (dyes && typeof dyes === 'object') Object.keys(dyes).forEach(function (id) {
      var it = C.byId(id);
      if (it && it.kind === 'gear' && typeof dyes[id] === 'string' && DYE_RE.test(dyes[id])) st.gearDye[id] = dyes[id];
    });
  }

  /* ---------- Tampilan dasar karakter (builder) ----------
     look = { gender:'m'|'f', skin:'s1'..'s5', eyes:{id,dye}, hair:{id,dye}, body:{height,build} } atau null (belum pernah diatur).
     Kosmetik lokal (bukan item dagangan): hanya BENTUK data yang divalidasi; daftar id/warna milik builder. */
  var LOOK_ID = /^[a-z0-9_]{1,24}$/;
  function cleanLook(l) {
    if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
    var part = function (p) { return (p && typeof p === 'object' && LOOK_ID.test(p.id || '') && LOOK_ID.test(p.dye || '')) ? { id: p.id, dye: p.dye } : null; };
    var eyes = part(l.eyes), hair = part(l.hair);
    var b = (l.body && typeof l.body === 'object') ? l.body : {};
    var h = +b.height, bd = +b.build;
    if (!eyes || !hair || (l.gender !== 'm' && l.gender !== 'f') || !/^s[1-5]$/.test(l.skin || '')) return null;
    return { gender: l.gender, skin: l.skin, eyes: eyes, hair: hair,
             body: { height: Math.min(1.1, Math.max(0.9, isFinite(h) && h > 0 ? h : 1)), build: Math.min(1.15, Math.max(0.9, isFinite(bd) && bd > 0 ? bd : 1)) } };
  }

  /* ---------- Outfit pribadi (tab Set di builder) ----------
     outfits = [{ slot:0..4, name, data, updatedAt }], maksimal OUTFIT_MAX, urut menurut slot.
     data = { gender:'m'|'f', top|legs|boots|helm|chest|shoulder|cape|weapon: {id, dye?}, accessories:[{id, dye?}] }
     (id = kunci builder, sama dengan ItemCatalog gameKey: 'gear.<bagian>.<id>'; 'none' = bagian kosong).
     Hanya BENTUK data yang dibersihkan saat dimuat (outfit dengan item yang belum dimiliki tetap disimpan -> bisa
     di-preview dan dibeli). Kepemilikan & gender item divalidasi saat MENYIMPAN (saveOutfit). */
  var OUTFIT_MAX = 5, OUTFIT_NAME_MAX = 16, OUTFIT_ACC_MAX = 12;
  var OUTFIT_PARTS = ['top', 'legs', 'boots', 'helm', 'chest', 'shoulder', 'cape', 'weapon'];
  function cleanOutfitName(n) {
    if (typeof n !== 'string') return '';
    return n.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, OUTFIT_NAME_MAX);
  }
  function cleanOutfitData(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    if (d.gender !== 'm' && d.gender !== 'f') return null;
    var out = { gender: d.gender };
    var part = function (p) {
      if (!p || typeof p !== 'object' || Array.isArray(p) || !LOOK_ID.test(p.id || '')) return { id: 'none' };
      var o = { id: p.id };
      if (typeof p.dye === 'string' && DYE_RE.test(p.dye)) o.dye = p.dye;
      return o;
    };
    OUTFIT_PARTS.forEach(function (k) { out[k] = part(d[k]); });
    var seen = {}; out.accessories = [];
    (Array.isArray(d.accessories) ? d.accessories : []).forEach(function (a) {
      var o = part(a);
      if (o.id === 'none' || seen[o.id] || out.accessories.length >= OUTFIT_ACC_MAX) return;
      seen[o.id] = true; out.accessories.push(o);
    });
    return out;
  }
  function cleanOutfits(list) {
    var out = [], used = {};
    (Array.isArray(list) ? list : []).forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var slot = Math.floor(+e.slot), name = cleanOutfitName(e.name), data = cleanOutfitData(e.data);
      if (!(slot >= 0 && slot < OUTFIT_MAX) || used[slot] || !name || !data) return;
      used[slot] = true;
      out.push({ slot: slot, name: name, data: data, updatedAt: isFinite(e.updatedAt) ? +e.updatedAt : 0 });
    });
    return out.sort(function (a, b) { return a.slot - b.slot; });
  }
  /* Item outfit yang harus dimiliki & cocok gender: [{id:'gear.top.tee'}...]; mengembalikan {ok} atau {ok:false, reason, item?} */
  function checkOutfitItems(st, data) {
    var refs = [];
    OUTFIT_PARTS.forEach(function (k) { refs.push([k, data[k].id]); });
    data.accessories.forEach(function (a) { refs.push(['acc', a.id]); });
    for (var i = 0; i < refs.length; i++) {
      var it = C.byId('gear.' + refs[i][0] + '.' + refs[i][1]);
      if (!it) { if (refs[i][1] === 'none') continue; return { ok: false, reason: 'item-tidak-dikenal' }; }
      if (it.g && it.g !== data.gender) return { ok: false, reason: 'gender-tidak-cocok', item: it };
      if (!st.inventory[it.id]) return { ok: false, reason: 'belum-dimiliki', item: it };
    }
    return { ok: true };
  }

  /* ---------- Pembuatan data awal ---------- */
  function freshState(skipLegacy) {
    var now = Date.now(), seq = 0, inv = {};
    C.starters().forEach(function (it) { inv[it.id] = { qty: 1, acquiredAt: now, seq: seq++ }; });
    var st = { schema: SCHEMA, migration: 0, createdAt: now, coins: START_COINS, gems: START_GEMS, xp: START_XP, stats: normStats(null), nextSeq: seq,
               inventory: inv, equipped: clone(C.defaultEquipped), gearDye: {}, look: null, outfits: [],
               settings: clone(DEFAULT_SETTINGS), profile: clone(DEFAULT_PROFILE) };
    if (!skipLegacy) migrateLegacyEquip(st); /* pilihan dadu/tema lama (ut-dadu, ut-tema2) dulu gratis — pertahankan (hanya untuk tamu, bukan akun baru) */
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
    cleanGear(st, eq, o.gearDye);
    st.look = cleanLook(o.look);
    st.outfits = cleanOutfits(o.outfits);
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

  /* ---------- Pembersihan localStorage (Tahap 1) ----------
     - Key legacy tanpa pembaca: shop, modeScreen, lobbyGift. Hanya dihapus bila data tamu sudah termigrasi
       (state tamu belum ada, atau migration >= MIGRATION_VERSION), karena migrateV1 masih membaca shop/modeScreen sekali.
     - Cadangan data rusak "<kunci>:corrupt:<ts>": simpan yang TERBARU saja per kunci, hapus yang lebih lama.
     Idempoten, sekali per muat halaman, aman bila localStorage tidak tersedia / tidak bisa dienumerasi. */
  var cleaned = false;
  var DEAD_LEGACY_KEYS = ['shop', 'modeScreen', 'lobbyGift'];
  function guestMigrated() {
    try {
      var raw = localStorage.getItem(BASE_KEY);
      if (raw === null) return true;
      var o = JSON.parse(raw);
      return !!(o && isFinite(o.migration) && o.migration >= MIGRATION_VERSION);
    } catch (e) { return false; }
  }
  function cleanupLegacy() {
    if (cleaned) return;
    cleaned = true;
    try {
      if (guestMigrated()) {
        DEAD_LEGACY_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      }
      var n = localStorage.length, newest = {}, all = [], i, k, at, base, ts;
      if (!isFinite(n) || typeof localStorage.key !== 'function') return;
      for (i = 0; i < n; i++) {
        k = localStorage.key(i);
        if (typeof k !== 'string' || k.indexOf('ularTanggaBlok:') !== 0) continue;
        at = k.indexOf(':corrupt:'); if (at < 0) continue;
        base = k.slice(0, at); ts = +k.slice(at + 9) || 0;
        all.push([k, base, ts]);
        if (!(base in newest) || ts > newest[base]) newest[base] = ts;
      }
      all.forEach(function (e) { if (e[2] < newest[e[1]]) { try { localStorage.removeItem(e[0]); } catch (x) {} } });
    } catch (e) { /* abaikan: pembersihan bersifat opsional */ }
  }

  /* ---------- Baca ---------- */
  function load() {
    if (!persistent) {
      if (!memState) memState = ensureMigration(freshState());
      return clone(memState);
    }
    var raw = rawGet();
    if (raw === null && accountId()) { adoptGuest(); raw = rawGet(); }
    if (raw === null) {
      /* Akun baru tanpa data tamu: mulai bersih, jangan impor key legacy global (inv/shop) milik orang lain. */
      var st0 = accountId() ? freshState(true) : ensureMigration(freshState());
      if (accountId()) st0.migration = MIGRATION_VERSION;
      if (!write(st0)) { persistent = false; memState = clone(st0); }
      return st0;
    }
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    var st = sanitize(parsed);
    if (!st) { /* rusak: cadangkan dulu, lalu mulai bersih — tidak menghapus apa pun */
      try { localStorage.setItem(key() + ':corrupt:' + Date.now(), raw); } catch (e) {}
      st = accountId() ? freshState(true) : ensureMigration(freshState());
      if (accountId()) st.migration = MIGRATION_VERSION;
      write(st);
      return st;
    }
    var before = st.migration;
    st = ensureMigration(st);
    if (st.migration !== before) write(st); /* hasil migrasi disimpan sekali */
    cleanupLegacy();
    return st;
  }

  function notify(reason) {
    listeners.slice().forEach(function (fn) { try { fn(reason); } catch (e) {} });
  }

  /* ---------- Mode dompet server (B5) ----------
     Akun login + flag menyala: coins/gems/inventory dimiliki SERVER. Data lokal hanya CERMIN (cache baca)
     yang diisi dari respons RPC lewat applyServerWallet/applyServerItem (dipanggil wallet-service.js).
     Mutasi lokal (purchase/addCurrency/grant mata uang/item) DITOLAK agar tidak ada saldo ganda atau saldo
     yang bisa diedit lewat devtools. XP, statistik, pengaturan, nama, dan equip tetap lokal. Tamu tidak berubah.
     Flag: window.UT_SERVER_WALLET === true  atau  localStorage['ut:serverWallet'] === '1'. */
  function flagOn() {
    try { if (g.UT_SERVER_WALLET === true) return true; } catch (e) {}
    try { return localStorage.getItem('ut:serverWallet') === '1'; } catch (e) { return false; }
  }
  function serverMode() { return !!accountId() && flagOn(); }

  /* ---------- API publik ---------- */
  var API = {
    get key() { return key(); },
    /* Id akun aktif ('' = tamu) dan kunci klaim achievement untuk akun itu (dipakai profile.html). */
    scope: function () { return accountId(); },
    achKey: function () { return keyFor(ACH_BASE); },
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
      var pts = o.noPoints ? 0 : (won ? PTS_WIN : PTS_LOSS), gain = won ? XP_WIN : XP_LOSS;
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

    /* Tampilan dasar karakter (null bila belum diatur). */
    look: function () { var l = load().look; return l ? clone(l) : null; },
    /* Simpan tampilan dasar; data tidak valid ditolak seluruhnya (tidak ada simpan setengah). */
    setLook: function (l) {
      var c = cleanLook(l); if (!c) return { ok: false, reason: 'look-tidak-valid' };
      var st = load(); st.look = c;
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('equip'); return { ok: true };
    },
    /* Lepas gear dari slot (hanya slot gear; skin/dadu/tema/frame selalu terpasang). */
    unequip: function (slot) {
      if (C.gearSlots().indexOf(slot) < 0) return { ok: false, reason: 'bukan-slot-gear' };
      var st = load();
      if (st.equipped[slot]) { delete st.equipped[slot]; if (!write(st)) return { ok: false, reason: 'gagal-simpan' }; notify('equip'); }
      return { ok: true };
    },
    /* Pewarna gear (kosmetik): dye = id warna builder atau null untuk kembali ke bawaan. Hanya untuk gear yang dimiliki. */
    setGearDye: function (id, dye) {
      var it = C.byId(id), st = load();
      if (!it || it.kind !== 'gear') return { ok: false, reason: 'bukan-gear' };
      if (!st.inventory[id]) return { ok: false, reason: 'belum-dimiliki' };
      if (dye === null || dye === undefined) delete st.gearDye[id];
      else if (typeof dye === 'string' && DYE_RE.test(dye)) st.gearDye[id] = dye;
      else return { ok: false, reason: 'warna-tidak-valid' };
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('equip'); return { ok: true };
    },
    /* Tampilan gear sekarang: { 'g.helm': {id:'gear.helm.knight', dye:'steel'|null}, ... } (hanya slot terisi) */
    gearLook: function () {
      var st = load(), out = {};
      C.gearSlots().forEach(function (slot) {
        var id = st.equipped[slot]; if (id) out[slot] = { id: id, dye: st.gearDye[id] || null };
      });
      return out;
    },

    /* ----- Outfit pribadi (maks OUTFIT_MAX slot) ----- */
    outfitLimit: OUTFIT_MAX,
    outfitNameMax: OUTFIT_NAME_MAX,
    outfits: function () { return clone(load().outfits); },
    /* Simpan outfit baru ke slot kosong pertama. data = tampilan gear (lihat cleanOutfitData); semua item harus
       dimiliki & cocok gender. Return {ok, slot} atau {ok:false, reason:'nama-kosong'|'data-tidak-valid'|'slot-penuh'|
       'belum-dimiliki'|'gender-tidak-cocok'|'item-tidak-dikenal'|'gagal-simpan', item?} */
    saveOutfit: function (name, data) {
      if (serverMode()) return { ok: false, reason: 'server-mode' };   /* akun server: lewat AppearanceService */
      var nm = cleanOutfitName(name); if (!nm) return { ok: false, reason: 'nama-kosong' };
      var d = cleanOutfitData(data); if (!d) return { ok: false, reason: 'data-tidak-valid' };
      var st = load(), used = {};
      st.outfits.forEach(function (e) { used[e.slot] = true; });
      var slot = -1; for (var i = 0; i < OUTFIT_MAX; i++) { if (!used[i]) { slot = i; break; } }
      if (slot < 0) return { ok: false, reason: 'slot-penuh' };
      var chk = checkOutfitItems(st, d); if (!chk.ok) return chk;
      st.outfits.push({ slot: slot, name: nm, data: d, updatedAt: Date.now() });
      st.outfits.sort(function (a, b) { return a.slot - b.slot; });
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('outfits'); return { ok: true, slot: slot };
    },
    renameOutfit: function (slot, name) {
      if (serverMode()) return { ok: false, reason: 'server-mode' };   /* akun server: lewat AppearanceService */
      var nm = cleanOutfitName(name); if (!nm) return { ok: false, reason: 'nama-kosong' };
      var st = load(), e = st.outfits.filter(function (x) { return x.slot === slot; })[0];
      if (!e) return { ok: false, reason: 'tidak-ada' };
      e.name = nm; e.updatedAt = Date.now();
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('outfits'); return { ok: true };
    },
    deleteOutfit: function (slot) {
      if (serverMode()) return { ok: false, reason: 'server-mode' };   /* akun server: lewat AppearanceService */
      var st = load(), n = st.outfits.length;
      st.outfits = st.outfits.filter(function (x) { return x.slot !== slot; });
      if (st.outfits.length === n) return { ok: false, reason: 'tidak-ada' };
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('outfits'); return { ok: true };
    },

    /* Pembelian atomik (harga katalog = coins): validasi dulu, lalu saldo + inventory dalam SATU penulisan. */
    purchase: function (id) {
      if (serverMode()) return { ok: false, reason: 'server-wallet' };   /* beli lewat WalletService.buy */
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

    /* Beli SET gear atomik untuk tamu/lokal: validasi + hitung total + cek saldo dulu, lalu saldo dan SEMUA item
       dalam SATU penulisan (tidak ada set setengah jadi). Aturan SAMA dengan RPC buy_set di server
       (supabase/migrations/202611140001_buy_set.sql): kosong/null -> tidak-tersedia; >200 elemen mentah atau >20 id unik
       (setelah digabung) -> terlalu-banyak; elemen null/tak dikenal/bukan gear/starter/tanpa harga -> tidak-tersedia
       (SATU item tidak dijual menolak seluruh set); item sudah dimiliki dilewati dan tidak ditagih;
       total > koin -> saldo-kurang + kurang. Return {ok, items, skipped, spent, coins, gems}. */
    purchaseSet: function (ids) {
      if (serverMode()) return { ok: false, reason: 'server-wallet' };   /* akun server: WalletService.buySet */
      if (!Array.isArray(ids) || ids.length === 0) return { ok: false, reason: 'tidak-tersedia' };
      if (ids.length > SET_MAX_RAW) return { ok: false, reason: 'terlalu-banyak' };
      if (ids.some(function (x) { return typeof x !== 'string'; })) return { ok: false, reason: 'tidak-tersedia' };
      var uniq = ids.filter(function (x, i) { return ids.indexOf(x) === i; }).sort();
      if (uniq.length > SET_MAX_UNIQUE) return { ok: false, reason: 'terlalu-banyak' };
      var its = uniq.map(function (id) { return C.byId(id); });
      if (its.some(function (it) { return !it || it.kind !== 'gear' || it.starter || it.stackable || !(it.price > 0); })) {
        return { ok: false, reason: 'tidak-tersedia' };
      }
      var st = load(), skipped = [], fresh = [], total = 0;
      its.forEach(function (it) {
        if (st.inventory[it.id]) skipped.push(it.id); else { fresh.push(it); total += it.price; }
      });
      if (!fresh.length) return { ok: true, items: [], skipped: skipped, spent: 0, coins: st.coins, gems: st.gems };
      if (st.coins < total) return { ok: false, reason: 'saldo-kurang', kurang: total - st.coins };
      st.coins -= total;
      var now = Date.now();
      fresh.forEach(function (it) { st.inventory[it.id] = { qty: 1, acquiredAt: now, seq: st.nextSeq++ }; });
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };   /* load() mengembalikan salinan: tidak ada yang tersisa */
      notify('purchase');
      return { ok: true, items: fresh.map(function (it) { return it.id; }), skipped: skipped, spent: total, coins: st.coins, gems: st.gems };
    },

    /* Perubahan currency atomik: addCurrency(+500) / addCurrency(0, +10) / addCurrency(-200, -5).
       Return {ok, coins, gems} atau {ok:false, reason:'saldo-kurang'|'gem-kurang', kurang} */
    addCurrency: function (dCoins, dGems) {
      if (serverMode()) return { ok: false, reason: 'server-wallet' };
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
      /* Akun server: hanya XP yang boleh lewat sini; koin/gem/item hanya dari server (WalletService). */
      if (serverMode() && (o.coins || o.gems || o.item)) return { ok: false, reason: 'server-wallet' };
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
      if (p.ambience === 'day' || p.ambience === 'night' || p.ambience === 'system') next.ambience = p.ambience;
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

    /* ----- Mode dompet server ----- */
    serverMode: function () { return serverMode(); },
    /* Isi cermin dari server: {coins?, gems?, inventory?:[{id, qty}]}. Hanya berlaku di mode server.
       Inventory = daftar server (+ item awal). Equip yang tak lagi dimiliki dikembalikan ke default. */
    applyServerWallet: function (o) {
      if (!serverMode()) return { ok: false, reason: 'bukan-mode-server' };
      o = o || {};
      var st = load(), now = Date.now();
      if (isFinite(o.coins) && o.coins >= 0) st.coins = Math.floor(o.coins);
      if (isFinite(o.gems) && o.gems >= 0) st.gems = Math.floor(o.gems);
      if (Array.isArray(o.inventory)) {
        var inv = {}, seq = 0;
        C.starters().forEach(function (it) { inv[it.id] = { qty: 1, acquiredAt: (st.inventory[it.id] || {}).acquiredAt || st.createdAt, seq: seq++ }; });
        o.inventory.forEach(function (e) {
          if (!e || !C.byId(e.id)) return;                /* id tak dikenal katalog klien: abaikan */
          var q = Math.max(1, Math.floor(+e.qty) || 1), prev = st.inventory[e.id];
          inv[e.id] = { qty: q, acquiredAt: prev ? prev.acquiredAt : now, seq: prev ? prev.seq : seq++ };
        });
        st.inventory = inv; st.nextSeq = Math.max(seq, st.nextSeq || 0);
        ['skin', 'dice', 'theme', 'frame'].forEach(function (slot) {
          var it = C.byId(st.equipped[slot]);
          if (!it || !st.inventory[it.id]) st.equipped[slot] = C.defaultEquipped[slot];
        });
        cleanGear(st, st.equipped, st.gearDye);   /* gear yang tidak ada di inventory server dilepas */
      }
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      mirrorLegacy(st); notify('server-wallet');
      return { ok: true, coins: st.coins, gems: st.gems };
    },
    /* Tampilan aktif untuk dikirim ke server (AppearanceService.pushAppearance): {look, equipped, gearDye}.
       equipped hanya slot yang bisa di-equip (skin/dice/theme/frame + slot gear); validasi final ada di server. */
    appearance: function () {
      var st = load(), eq = {};
      ['skin', 'dice', 'theme', 'frame'].concat(C.gearSlots()).forEach(function (s) { if (st.equipped[s]) eq[s] = st.equipped[s]; });
      return { look: st.look ? clone(st.look) : null, equipped: eq, gearDye: clone(st.gearDye) };
    },
    /* Isi cermin tampilan dari server: {look, equipped, gearDye}. Hanya mode server. Item yang tidak ada di inventory
       cermin tidak dipasang (skin/dadu/tema/frame tetap yang lama; gear dilepas). Tidak memicu push balik ('server-appearance'). */
    applyServerAppearance: function (o) {
      if (!serverMode()) return { ok: false, reason: 'bukan-mode-server' };
      o = o || {};
      var st = load(), eq = (o.equipped && typeof o.equipped === 'object' && !Array.isArray(o.equipped)) ? o.equipped : {};
      st.look = cleanLook(o.look);
      ['skin', 'dice', 'theme', 'frame'].forEach(function (slot) {
        var it = C.byId(eq[slot]);
        if (it && it.slot === slot && st.inventory[it.id]) st.equipped[slot] = it.id;
      });
      cleanGear(st, eq, o.gearDye);
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      mirrorLegacy(st); notify('server-appearance');
      return { ok: true };
    },
    /* Isi cermin outfit dari server: [{slot, name, data, updatedAt?}]. Hanya mode server. */
    applyServerOutfits: function (list) {
      if (!serverMode()) return { ok: false, reason: 'bukan-mode-server' };
      var st = load(); st.outfits = cleanOutfits(list);
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('server-outfits');
      return { ok: true };
    },
    /* Tambah satu item hasil pembelian server ke cermin (tanpa menunggu inventory_get). */
    applyServerItem: function (id) {
      if (!serverMode()) return { ok: false, reason: 'bukan-mode-server' };
      var it = C.byId(id); if (!it) return { ok: false, reason: 'tidak-dikenal' };
      var st = load(), cur = st.inventory[id];
      st.inventory[id] = cur ? { qty: it.stackable ? cur.qty + 1 : 1, acquiredAt: cur.acquiredAt, seq: cur.seq }
                             : { qty: 1, acquiredAt: Date.now(), seq: st.nextSeq++ };
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('server-wallet');
      return { ok: true };
    },

    /* Langganan perubahan (halaman ini + tab/halaman lain). Mengembalikan fungsi berhenti. */
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    }
  };

  g.addEventListener('storage', function (e) {
    if (e.key === key() || e.key === 'ut-auth' || e.key === null) notify('storage');
  });
  g.addEventListener('pageshow', function (e) { if (e.persisted) notify('pageshow'); }); /* bfcache saat tombol kembali */

  g.PlayerData = API;
  load(); /* pastikan data awal/migrasi dibuat sekali, tanpa me-reset data yang sudah ada */
})(window);
