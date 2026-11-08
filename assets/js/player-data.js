/* Data pemain bersama — SINGLE SOURCE OF TRUTH (Tahap 3).
   Dibaca/ditulis oleh SEMUA halaman non-gameplay lewat objek ini.
   Penyimpanan: localStorage (hanya di browser ini, tanpa sinkronisasi server), TERPISAH PER AKUN:
   - tamu / belum login : "ularTanggaBlok:player:v1"
   - akun login         : "ularTanggaBlok:player:v1:acct:<id akun>" (id dari UT.Session / session.js)
   Logout tidak menghapus data akun; data kembali saat akun itu login lagi. Akun berikutnya di perangkat
   yang sama TIDAK mewarisi koin/inventory/XP akun sebelumnya. Tahap 3: data tamu TIDAK lagi dipindahkan ke
   akun; akun login memakai dompet server (saldo awal dari server).
   Butuh: item-catalog.js dimuat lebih dulu.

   Tahap 6c: impor data legacy (kunci "inv", "shop", "modeScreen") sudah DIHAPUS — login wajib dan semua data akun datang dari server.
   Pembersihan localStorage hanya menghapus key legacy tanpa pembaca ("shop", "modeScreen", "lobbyGift", "ut-dadu", "ut-tema2")
   dan HANYA bila state tamu bertanda migration >= MIGRATION_VERSION; "inv" dibiarkan. Tidak ada localStorage.clear(). Cadangan ":corrupt:"
   dipangkas ke yang terbaru saja per kunci. */
(function (g) {
  'use strict';
  var C = g.ItemCatalog;
  var BASE_KEY = 'ularTanggaBlok:player:v1';
  var SCHEMA = 1;
  var MIGRATION_VERSION = 1;   /* playerDataMigrationVersion — naikkan bila ada langkah migrasi baru */
  var SET_MAX_UNIQUE = 20, SET_MAX_RAW = 200;   /* batas beli set: sama dengan buy_set di server */
  /* Tahap 6d: tidak ada saldo/XP awal lokal. Semua mulai 0 dan baru bermakna setelah server membalas (lihat walletReady). */
  var DEFAULT_SETTINGS = { music: true, sound: true, vibration: true, graphics: 'high', ambience: 'day' }; /* ambience: 'day' | 'night' | 'system' (ikuti perangkat) */
  var DEFAULT_PROFILE = { name: 'OmanBogel' };   /* nama mock sementara (satu sumber: PlayerData.profile().name) */


  /* Id akun yang sedang login (dari cache auth.js). '' = tamu. Divalidasi agar aman dipakai sebagai bagian nama kunci. */
  /* Sesi login: hanya lewat UT.Session (session.js). Tanpa itu = tamu/belum login. */
  function sess() { try { return (g.UT && g.UT.Session) || null; } catch (e) { return null; } }
  function accountId() { var S = sess(); return S ? S.id() : ''; }
  function accountName() { var S = sess(); return S ? S.username() : ''; }
  function keyFor(base) { var id = accountId(); return id ? base + ':acct:' + id : base; }
  function key() { return keyFor(BASE_KEY); }
  var memState = null;     /* cadangan di memori jika localStorage tidak bisa dipakai */
  var persistent = probe();
  var listeners = [];

  function probe() {
    try { var k = BASE_KEY + ':probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  }
  function rawGet() { try { return localStorage.getItem(key()); } catch (e) { return null; } }
  function rawSet(s) { try { localStorage.setItem(key(), s); return true; } catch (e) { return false; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* UT.Prefs (prefs.js) dibaca malas-malasan: urutan muat skrip tidak penting. null bila tidak tersedia. */
  function prefsStore() { try { var U = g.UT; return (U && U.Prefs && typeof U.Prefs.get === 'function') ? U.Prefs : null; } catch (e) { return null; } }
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
  function freshState() {
    var now = Date.now(), seq = 0, inv = {};
    C.starters().forEach(function (it) { inv[it.id] = { qty: 1, acquiredAt: now, seq: seq++ }; });
    var st = { schema: SCHEMA, migration: MIGRATION_VERSION, createdAt: now, coins: 0, gems: 0, xp: 0, stats: normStats(null), walletSyncedAt: 0, nextSeq: seq,
               inventory: inv, equipped: clone(C.defaultEquipped), gearDye: {}, look: null, outfits: [],
               settings: clone(DEFAULT_SETTINGS), profile: clone(DEFAULT_PROFILE) };
    return st;
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
      gems: (isFinite(o.gems) && o.gems >= 0) ? Math.floor(o.gems) : 0,
      xp: (isFinite(o.xp) && o.xp >= 0) ? Math.floor(o.xp) : 0,
      walletSyncedAt: (isFinite(o.walletSyncedAt) && o.walletSyncedAt > 0) ? +o.walletSyncedAt : 0,
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

  /* Tahap 6c: impor data legacy (inv/shop/modeScreen) DIHAPUS. Akun login selalu mulai dari server; state tamu mulai bersih. */

  /* ---------- Pembersihan localStorage (Tahap 1) ----------
     - Key legacy tanpa pembaca: shop, modeScreen, lobbyGift. Hanya dihapus bila data tamu sudah termigrasi
       (state tamu belum ada, atau migration >= MIGRATION_VERSION), (tanda bahwa blob tamu sudah dipakai sistem baru; blob lama bertanda 0 dibiarkan agar tidak ada data yang hilang tanpa disengaja).
     - Cadangan data rusak "<kunci>:corrupt:<ts>": simpan yang TERBARU saja per kunci, hapus yang lebih lama.
     Idempoten, sekali per muat halaman, aman bila localStorage tidak tersedia / tidak bisa dienumerasi. */
  var cleaned = false;
  var DEAD_LEGACY_KEYS = ['shop', 'modeScreen', 'lobbyGift', 'ut-dadu', 'ut-tema2']; /* Tahap 5a: pilihan dadu/tema kini dibaca dari PlayerData, bukan cermin lokal */
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
      /* Tahap 6a: klaim achievement kini hanya dari server -> hapus key lokal lama (klaim/:paid/:intent, semua akun) */
      var oldAch = [];
      for (i = 0; i < n; i++) { k = localStorage.key(i); if (typeof k === 'string' && k.indexOf('ularTanggaBlok:achClaimed:v1') === 0) oldAch.push(k); }
      oldAch.forEach(function (x) { try { localStorage.removeItem(x); } catch (e) {} });
      n = localStorage.length;
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
      if (!memState) memState = freshState();
      return clone(memState);
    }
    var raw = rawGet();
    if (raw === null) {
      /* Akun baru: mulai bersih (Tahap 3: saldo/data tamu lama tidak diimpor). */
      var st0 = freshState();
      if (!write(st0)) { persistent = false; memState = clone(st0); }
      return st0;
    }
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    var st = sanitize(parsed);
    if (!st) { /* rusak: cadangkan dulu, lalu mulai bersih — tidak menghapus apa pun */
      try { localStorage.setItem(key() + ':corrupt:' + Date.now(), raw); } catch (e) {}
      st = freshState();
      write(st);
      return st;
    }
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
     Tahap 3c: tidak ada lagi saklar/flag; akun login SELALU mode server, dan tanpa akun tidak ada mutasi dompet. */
  function serverMode() { return !!accountId(); }
  function walletDenied() { return { ok: false, reason: serverMode() ? 'server-wallet' : 'belum-login' }; }

  /* ---------- API publik ---------- */
  var API = {
    get key() { return key(); },
    /* Id akun aktif ('' = tamu) dan kunci klaim achievement untuk akun itu (dipakai profile.html). */
    scope: function () { return accountId(); },
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
    /* Tahap 6b-3: pengaturan = preferensi PERANGKAT -> disimpan di UT.Prefs ('settings'), bukan di blob pemain/akun.
       Impor sekali dari blob lama bila Prefs belum punya. Tanpa UT.Prefs (mis. tes node) jatuh ke blob seperti dulu. */
    settings: function () {
      var P = prefsStore();
      if (!P) return clone(load().settings);
      var v = P.get('settings', null);
      if (!v || typeof v !== 'object') { v = normSettings(load().settings); P.set('settings', v); }
      return normSettings(v);
    },
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
      notify('equip');
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
    purchase: function (id) { return walletDenied(); },   /* Tahap 3c: beli hanya lewat WalletService.buy (server) */

    /* Beli SET gear atomik untuk tamu/lokal: validasi + hitung total + cek saldo dulu, lalu saldo dan SEMUA item
       dalam SATU penulisan (tidak ada set setengah jadi). Aturan SAMA dengan RPC buy_set di server
       (supabase/migrations/202611140001_buy_set.sql): kosong/null -> tidak-tersedia; >200 elemen mentah atau >20 id unik
       (setelah digabung) -> terlalu-banyak; elemen null/tak dikenal/bukan gear/starter/tanpa harga -> tidak-tersedia
       (SATU item tidak dijual menolak seluruh set); item sudah dimiliki dilewati dan tidak ditagih;
       total > koin -> saldo-kurang + kurang. Return {ok, items, skipped, spent, coins, gems}. */
    purchaseSet: function (ids) { return walletDenied(); },   /* Tahap 3c: hanya WalletService.buySet (server, RPC buy_set) */

    /* Perubahan currency atomik: addCurrency(+500) / addCurrency(0, +10) / addCurrency(-200, -5).
       Return {ok, coins, gems} atau {ok:false, reason:'saldo-kurang'|'gem-kurang', kurang} */
    addCurrency: function (dCoins, dGems) { return walletDenied(); },   /* Tahap 3c: saldo hanya dari server */

    /* Tahap 6b: grant()/recordMatch() dihapus. Koin/gem/item = WalletService; XP/statistik = submit_match_result -> applyServerStats. */

    /* Pengaturan (bagian dari player state): whitelist field, satu penulisan. */
    setSettings: function (patch) {
      var P = prefsStore();
      var p = (patch && typeof patch === 'object') ? patch : {};
      var next = clone(API.settings());
      if (typeof p.music === 'boolean') next.music = p.music;
      if (typeof p.sound === 'boolean') next.sound = p.sound;
      if (typeof p.vibration === 'boolean') next.vibration = p.vibration;
      if (p.graphics === 'high' || p.graphics === 'low') next.graphics = p.graphics;
      if (p.ambience === 'day' || p.ambience === 'night' || p.ambience === 'system') next.ambience = p.ambience;
      if (P) { P.set('settings', next); notify('settings'); return clone(next); }
      var st = load(); st.settings = next;
      if (!write(st)) return null;
      notify('settings');
      return clone(next);
    },

    /* Nama profil (bagian dari player state). */
    setName: function (name) {
      if (typeof name !== 'string' || !name.trim()) return null;
      /* Tahap 6b: akun login -> nama = username akun (server menentukan nama lewat trigger player_stats_enforce_name).
         Nama lain ditolak supaya tampilan lokal tidak menyimpang dari leaderboard. */
      if (serverMode() && name.trim().toLowerCase() !== accountName().toLowerCase()) return null;
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
      if (isFinite(o.coins) || isFinite(o.gems)) st.walletSyncedAt = now;   /* cache saldo ini pernah diisi server */
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
      notify('server-wallet');
      return { ok: true, coins: st.coins, gems: st.gems };
    },
    /* true bila saldo cache akun ini pernah diisi server. Sebelum itu UI menampilkan "—", bukan 0/angka palsu. */
    walletReady: function () { return serverMode() && !!load().walletSyncedAt; },
    /* Isi cermin XP/statistik/nama dari server (get_my_profile): {xp, plays, wins, streak, bestStreak, points, weekPoints, name}.
       Hanya mode server. Field yang tidak valid diabaikan; server adalah satu-satunya sumber. */
    applyServerStats: function (o) {
      if (!serverMode()) return { ok: false, reason: 'bukan-mode-server' };
      o = o || {};
      var st = load(), s = normStats(st.stats), ok = function (v) { return isFinite(v) && v >= 0; };
      if (ok(o.xp)) st.xp = Math.floor(o.xp);
      if (ok(o.plays)) s.plays = Math.floor(o.plays);
      if (ok(o.wins)) s.wins = Math.floor(o.wins);
      if (ok(o.streak)) s.streak = Math.floor(o.streak);
      if (ok(o.bestStreak)) s.bestStreak = Math.floor(o.bestStreak);
      if (ok(o.points)) s.points = Math.floor(o.points);
      if (ok(o.weekPoints)) s.weekPoints = Math.floor(o.weekPoints);
      st.stats = s;
      if (typeof o.name === 'string' && o.name.trim()) st.profile.name = o.name.trim().slice(0, 16);
      if (!write(st)) return { ok: false, reason: 'gagal-simpan' };
      notify('stats');
      var li = levelInfo(st.xp);
      return { ok: true, xp: st.xp, level: li.level, plays: s.plays, wins: s.wins };
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
      notify('server-appearance');
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
    if (e.key === key() || (sess() && e.key === sess().KEY) || e.key === null) notify('storage');
  });
  g.addEventListener('pageshow', function (e) { if (e.persisted) notify('pageshow'); }); /* bfcache saat tombol kembali */

  g.PlayerData = API;
  load(); /* pastikan data awal/migrasi dibuat sekali, tanpa me-reset data yang sudah ada */
})(window);
