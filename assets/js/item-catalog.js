/* Katalog item Ular Tangga Blok — SATU-SATUNYA sumber harga & metadata item.
   Hanya berisi item yang benar-benar didukung gameplay (skin karakter, skin dadu, tema papan).
   `gameKey` = kunci yang dipakai lobby.html / gameplay.html.
   Kepemilikan pemain TIDAK disimpan di sini (lihat player-data.js). */
(function (g) {
  'use strict';

  var RARITY = {
    common:    { key: 'common',    label: 'Umum',       rank: 1, stars: '★' },
    rare:      { key: 'rare',      label: 'Langka',     rank: 2, stars: '★★' },
    epic:      { key: 'epic',      label: 'Epik',       rank: 3, stars: '★★★' },
    legendary: { key: 'legendary', label: 'Legendaris', rank: 4, stars: '★★★★' }
  };

  var CATEGORIES = [
    { key: 'skin',     label: 'Skin' },
    { key: 'aksesori', label: 'Aksesori' },
    { key: 'efek',     label: 'Efek' },
    { key: 'emote',    label: 'Emote' },
    { key: 'lainnya',  label: 'Lainnya' }
  ];

  var SKIN_GROUPS = ['Default', 'Adventure', 'Fantasy', 'Rare', 'Epic', 'Legendary'];

  /* kind: skin -> bidak karakter | dice -> skin dadu | theme -> tema papan | powerup -> power-up gameplay
     slot powerup = null: consumable (quantity), BUKAN equipment — tidak masuk defaultEquipped. */
  var KIND_META = {
    skin:    { category: 'skin',     noun: 'Skin',       slot: 'skin' },
    dice:    { category: 'aksesori', noun: 'Skin dadu',  slot: 'dice' },
    theme:   { category: 'lainnya',  noun: 'Maps', slot: 'theme' },
    powerup: { category: 'efek',     noun: 'Power-Up',   slot: null },
    frame:   { category: 'aksesori', noun: 'Frame',      slot: 'frame' }
  };
  /* Frame profil: gambar WebP transparan (badan frame = 68% lebar gambar) di game/data/frame/.
     Ikon tab Shop/Inventory = FRAME_TAB_ICON. */
  var FRAME_DIR = 'data/frame/';
  var FRAME_TAB_ICON = FRAME_DIR + 'icon-frame.webp';
  function frame(gameKey, name, rarity, price, desc, file, extra) {
    return Object.assign({ id: 'frame.' + gameKey, kind: 'frame', gameKey: gameKey, name: 'Frame ' + name,
      rarity: rarity, price: price, desc: desc, starter: price === 0, image: FRAME_DIR + file }, extra || {});
  }

  /* Skin legacy (palet bawaan di item-art.js / gameplay.html): texture = null, renderer = 'palette'.
     Tidak ada PNG palsu untuk skin ini. */
  function skin(gameKey, name, group, rarity, price, desc, extra) {
    return Object.assign({ id: 'skin.' + gameKey, kind: 'skin', gameKey: gameKey, name: name, group: group,
      rarity: rarity, price: price, desc: desc, starter: price === 0,
      texture: null, renderer: 'palette' }, extra || {});
  }
  /* Skin PNG sudah dihapus: semua skin memakai model voxel UT.CharacterData (assets/js/character-data.js). */
  /* Path texture harus relatif, berakhiran .png, tanpa skema/URL, drive Windows, '..' atau spasi. */
  function validTexturePath(p) {
    return typeof p === 'string' && /^[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\.png$/.test(p);
  }
  function dice(gameKey, name, rarity, price, desc, art, extra) {
    return Object.assign({ id: 'dice.' + gameKey, kind: 'dice', gameKey: gameKey, name: 'Dadu ' + name,
      rarity: rarity, price: price, desc: desc, starter: price === 0, art: art }, extra || {});
  }
  /* Map = bagian dari game, BUKAN item dagangan/koleksi: tanpa harga, tidak dijual di Shop, tidak perlu dimiliki
     (RoomFlow.maps() menampilkan semua map). `starter` dipertahankan hanya untuk map bawaan agar slot 'theme' PlayerData tetap valid. */
  function theme(gameKey, name, rarity, price, desc, art, extra) {
    return Object.assign({ id: 'theme.' + gameKey, kind: 'theme', gameKey: gameKey, name: 'Map ' + name,
      rarity: rarity, price: null, desc: desc, starter: price === 0, free: true, art: art }, extra || {});
  }
  /* Power-Up (Tahap 3.1): consumable ber-quantity.
     ID canonical = PERSIS key gameplay di gameplay.html (p.pu: sword/feather/tnt/totem/potion_odd/potion_even/grass)
     — tanpa prefiks, agar tidak perlu bridge ID (lihat DATA_MIGRATION.md "Power-Up").
     price: null = EKONOMI BELUM DITENTUKAN — tidak dijual di shop, tidak boleh diarang.
     rarity 'common' = default netral untuk UI; gameplay sendiri tidak mengenal rarity power-up. */
  /* Stage 4.1.19: SATU-SATUNYA sumber path ikon Power (versi 192px dari data/power). Dibaca oleh
     gameplay (Config.PUIMG), Shop/Inventory/Profil (ItemArt.powerup). Key = ID Power (identity), bukan nama effect. */
  var POWER_ICON = {
    sword: 'data/power/sm/pedang.webp', feather: 'data/power/sm/feather.webp', tnt: 'data/power/sm/dinamit.webp',
    totem: 'data/power/sm/totem.webp', potion_odd: 'data/power/sm/ramuan-merah.webp', potion_even: 'data/power/sm/ramuan-biru.webp', grass: 'data/power/sm/block.webp'
  };
  /* Stage 4.1.20: ID Power lama -> identity sekarang. Dipakai HANYA untuk membaca data lama (save/localStorage pemain
     yang menyimpan Totem sebagai 'apple'); ID lama tidak dipakai lagi sebagai identity visual maupun di gameplay. */
  var LEGACY_POWER_ID = { apple: 'totem', potion: 'potion_odd' }; /* 'potion' (Ramuan 4-6) diganti Ramuan Ganjil/Genap: stok lama dibaca sebagai Ramuan Ganjil */
  function normalizePowerId(id) { return Object.prototype.hasOwnProperty.call(LEGACY_POWER_ID, id) ? LEGACY_POWER_ID[id] : id; }
  function powerup(gameKey, name, rarity, desc, extra) {
    return Object.assign({ id: gameKey, kind: 'powerup', gameKey: gameKey, name: name,
      rarity: rarity, price: null, desc: desc, starter: false, stackable: true, icon: POWER_ICON[gameKey] || null }, extra || {});
  }

  var ITEMS = [
    /* ---- Frame profil (Aksesori) ---- */
    frame('default', 'Kayu', 'common', 0,   'Frame kayu sederhana berhias daun hijau. Terpasang sejak awal.', 'frame-default.webp'),
    frame('stone',   'Batu',    'common', 150, 'Frame batu abu-abu retak yang kokoh, langsung dari dasar tambang.', 'stone.webp'),
    frame('copper',  'Tembaga', 'rare',   350, 'Frame tembaga berkarat hijau dengan paku-paku kecil di setiap sudutnya.', 'copper.webp'),
    frame('gold',    'Emas', 'epic',   800, 'Frame emas berkilau dengan daun rimbun untuk profil yang menonjol.', 'frame-gold.webp', { featured: true }),

    /* ---- Skin karakter ---- */
    skin('steve',    'Steve',    'Default',   'common', 0,   'Petualang blok klasik. Siap melangkah ke petak mana pun.'),
    skin('alex',     'Alex',     'Default',   'common', 0,   'Penjelajah lincah berambut oranye dengan jiwa petualang.'),
    skin('creeper',  'Creeper',  'Adventure', 'common', 0,   'Hijau, diam-diam, dan penuh kejutan di setiap giliran.'),
    skin('zombie',   'Zombie',   'Adventure', 'common', 0,   'Berjalan lambat tapi pantang menyerah sampai petak 100.'),
    skin('skeleton', 'Skeleton', 'Rare',      'rare',   300, 'Tulang-belulang pemanah dari gua gelap. Dingin dan tajam.'),
    skin('ender',    'Enderman', 'Epic',      'epic',   700, 'Makhluk tinggi dari dimensi lain dengan mata ungu menyala.', { featured: true }),

    /* ---- Skin dadu (Aksesori) ---- */
    /* legacyIds = metadata migrasi Tahap 3 (ID lama yang dipetakan eksplisit ke ID canonical ini).
       ID legacy yang tidak tercantum di sini adalah UNMAPPED (lihat DATA_MIGRATION.md). */
    dice('klasik',   'Klasik',   'common',    0,   'Dadu putih sederhana yang tidak pernah ketinggalan zaman.',
         { bg: '#ffffff', pip: '#1b2a3b', edge: '#1b2a3b' }, { legacyIds: ['standard'] }),
    dice('rumput',   'Rumput',   'common',    100, 'Dadu hijau segar bergaya blok rumput.',
         { bg: '#5fae3e', pip: '#1f4a12', edge: '#2c5a1c' }),
    dice('tnt',      'TNT',      'rare',      200, 'Dadu merah meledak-ledak. Semoga angkanya ikut meledak!',
         { bg: '#d63a2a', pip: '#ffffff', edge: '#4a0d07' }),
    dice('diamond',  'Diamond',  'epic',      450, 'Dadu biru kristal berkilau seperti berlian dari tambang dalam.',
         { bg: '#4aedd9', pip: '#0b4f4a', edge: '#0b4f4a' }),
    dice('obsidian', 'Obsidian', 'epic',      500, 'Dadu ungu gelap dari obsidian dengan titik berpendar.',
         { bg: '#2a1747', pip: '#d3b4ff', edge: '#0d0618' }),
    dice('emas',     'Emas',     'legendary', 900, 'Dadu emas berkilau untuk pemain yang percaya diri.',
         { bg: '#ffd23f', pip: '#6b4a00', edge: '#6b4a00' }, { featured: true, legacyIds: ['emas'] }),

    /* ---- Tema papan (Lainnya) ---- */
    theme('minecraft', 'World', 'common', 0,   'Padang rumput blok bergaya klasik.',
          { skyTop: '#6EC6FF', skyBot: '#E6F7FF', a: '#5FAE3E', b: '#8A5B33' }),
    theme('nether',    'Nether',    'epic',   600, 'Dunia api dan batu merah yang berbahaya.',
          { skyTop: '#2a0606', skyBot: '#8a2410', a: '#8A2B2B', b: '#3A0D0D' }, { featured: true }),

    /* ---- Power-Up (Tahap 3.1) ----
       Metadata & efek = hasil audit gameplay.html (PUN + usePU), TIDAK diarang:
       sword  -> serang musuh di petak yang sama, mundur 2 (tanpa p.bonus)      feather -> p.extra=true (giliran tambahan)
       tnt    -> pemain terdepan mundur 6 (teleport)    totem   -> p.shield=true (kebal 1 ular/mob; dulu ID 'apple', effect TIDAK berubah)
       potion_odd/potion_even -> p.odd/p.even=true (dadu berikutnya ganjil/genap)   grass -> tukar posisi dgn pemain terdepan
       Pemakaian & pengurangan quantity tetap di gameplay (p.pu); integrasi PlayerData menyusul. */
    powerup('sword',   'Pedang',     'common', 'Serang musuh di petak yang sama, ia mundur 2.'),
    powerup('feather', 'Bulu',       'common', 'Giliran tambahan sekali lempar.'),
    powerup('tnt',     'TNT',        'common', 'Pemain terdepan mundur 6 petak.'),
    powerup('totem',   'Totem',      'common', 'Saat kena ular, mob jahat, Pedang, TNT, atau Rumput, kamu bisa memilih memakai Totem untuk menahannya.'),
    powerup('potion_odd',  'Ramuan Ganjil', 'common', 'Dadu berikutnya selalu ganjil: 1, 3, atau 5.'),
    powerup('potion_even', 'Ramuan Genap',  'common', 'Dadu berikutnya selalu genap: 2, 4, atau 6.'),
    powerup('grass',   'Blok Rumput','common', 'Tukar posisi dengan pemain terdepan.')
  ];

  var DEFAULT_EQUIPPED = Object.freeze({ skin: 'skin.steve', dice: 'dice.klasik', theme: 'theme.minecraft', frame: 'frame.default' });
  var BY_ID = {};
  ITEMS.forEach(function (it) {
    var meta = KIND_META[it.kind];
    it.category = meta.category;
    it.slot = meta.slot;
    it.stackable = !!it.stackable;
    it.featured = !!it.featured;
    if (it.kind === 'skin') { /* validasi texture ringan: path buruk TIDAK membuat halaman crash, skin tampil dgn fallback */
      it.textureValid = it.renderer === 'png' && validTexturePath(it.texture);
      if (it.renderer === 'png' && !it.textureValid && g.console) g.console.error('[ItemCatalog] path texture skin tidak valid: ' + it.id);
    }
    if (it.art) Object.freeze(it.art);
    Object.freeze(it);
    if (BY_ID[it.id]) throw new Error('ID item ganda: ' + it.id);
    BY_ID[it.id] = it;
  });

  g.ItemCatalog = Object.freeze({
    version: 1,
    RARITY: RARITY,
    CATEGORIES: CATEGORIES,
    SKIN_GROUPS: SKIN_GROUPS,
    FRAME_TAB_ICON: FRAME_TAB_ICON,
    KIND_META: KIND_META,
    items: Object.freeze(ITEMS.slice()),
    byId: function (id) { return Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : null; },
    byGameKey: function (kind, gameKey) { return BY_ID[kind + '.' + gameKey] || null; },
    /* ID Power lama ('apple') -> identity sekarang ('totem'); ID lain dikembalikan apa adanya. Untuk membaca data lama saja. */
    normalizePowerId: normalizePowerId,
    /* Path texture PNG skin (relatif) atau null untuk skin legacy / path tidak valid */
    skinTexture: function (id) { var it = BY_ID[id]; return it && it.kind === 'skin' && it.textureValid ? it.texture : null; },
    /* Skin cadangan bila texture hilang/rusak (= skin default; selalu dimiliki sebagai starter) */
    fallbackSkinId: function () { return DEFAULT_EQUIPPED.skin; },
    starters: function () { return ITEMS.filter(function (i) { return i.starter; }); },
    categoryLabel: function (key) { var c = CATEGORIES.filter(function (x) { return x.key === key; })[0]; return c ? c.label : key; },
    /* Item default tiap slot saat data pemain dibuat */
    defaultEquipped: DEFAULT_EQUIPPED
  });
})(window);
