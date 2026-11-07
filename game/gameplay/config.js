/* Ular Tangga Blok — gameplay/config.js (Stage 4.1.3: extract gameplay config)
   Skrip klasik (tanpa import/export/type=module). Dimuat SETELAH gameplay/module-bridge.js
   dan SEBELUM gameplay/hud.js serta blok skrip gameplay inline.
   HANYA data/konfigurasi statis. Tidak ada logic, closure state, atau akses DOM/THREE di sini.
   Satu-satunya sumber (single source of truth) untuk data di bawah; gameplay.html membacanya lewat
   UT.Gameplay.Config.* dan tidak menyimpan salinan.
   Idempotent: aman dimuat lebih dari sekali, tidak menimpa key yang sudah terisi.
   Isi:
     LADDERS        {dari: ke}               tangga
     SNAKES         {kepala: ekor}           ular
     CHESTS         Set<number>              posisi peti
     MOB_POSITIONS  [[mob, [petak,...]], ...] posisi mob
     MOB_THEME_ONLY {mob: themeKey}           mob yang hanya aktif di tema tertentu (blaze -> nether)
     MOB_BACK       {mob: langkah mundur}     mundur saat terkena mob jahat
     MOB_COLOR      {mob: 0xRRGGBB}           warna petak mob
     MOB_NAME       {mob: nama tampil}
     DMG            damage per angka dadu ke Ender Dragon
     DRAGON_REWARD  {coins, gems}            nominal hadiah mengalahkan Ender Dragon (dipakai PlayerData.grant)
     CHEST_POOL     [{id, w}]                bobot Reward Pool Chest (w = persen x 10, total 1000 = 100%)
     CHEST_AMOUNT   {coins, xp, gems}        nominal reward Chest (dipakai PlayerData.grant)
     CHEST_MOVE     [langkah]                kandidat langkah reward maju / mundur
     PUN            {powerKey: [emoji, nama, deskripsi, labelPendek?]} metadata power-up
   Catatan: ukuran papan (10 x 10 = 100) belum ada sebagai konfigurasi di source (masih literal di
   logic), jadi sengaja tidak dibuat di sini agar tidak ada nilai ganda. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var G = UT.Gameplay = UT.Gameplay || {};
  var C = G.Config = G.Config || {};

  C.LADDERS = C.LADDERS || { 3: 22, 8: 26, 20: 41, 36: 55, 51: 72, 71: 91 };
  C.SNAKES = C.SNAKES || { 17: 7, 32: 10, 48: 27, 62: 44, 79: 57, 94: 73, 98: 77 };
  C.CHESTS = C.CHESTS || new Set([6, 15, 34, 46, 59, 64, 82, 89]);

  C.MOB_POSITIONS = C.MOB_POSITIONS || [
    ['creeper', [29]], ['ender', [53]], ['skeleton', [38]], ['zombie', [2]],
    ['warden', [85]], ['villager', [45]], ['blaze', [66]]
  ];
  C.MOB_THEME_ONLY = C.MOB_THEME_ONLY || (G.Maps && G.Maps.list().length ? G.Maps.mobThemeOnly() : { blaze: 'nether' });
  C.MOB_BACK = C.MOB_BACK || { skeleton: 1, zombie: 1, warden: 10, blaze: 3, zombified_piglin: 1, magma_cube: 2, piglin: 2, hoglin: 3, zoglin: 5, piglin_brute: 6, ghast: 4 };
  C.MOB_COLOR = C.MOB_COLOR || {
    creeper: 0x3E8E3A, ender: 0x3A1F5C, skeleton: 0xB8B8B8, zombie: 0x4F8F3F,
    warden: 0x0E3A44, villager: 0xC9A24A, blaze: 0xE0561A,
    strider: 0xB02A2A, magma_cube: 0xE0561A, piglin: 0xD99A78, piglin_brute: 0x8A4A2A,
    hoglin: 0xA8714A, zoglin: 0x6F8F6A, zombified_piglin: 0x7F9A68, ghast: 0xEDEDED
  };
  C.MOB_NAME = C.MOB_NAME || {
    creeper: 'Creeper', ender: 'Enderman', skeleton: 'Skeleton', zombie: 'Zombie',
    warden: 'Warden', villager: 'Villager', blaze: 'Blaze',
    strider: 'Strider', magma_cube: 'Magma Cube', piglin: 'Piglin', piglin_brute: 'Piglin Brute',
    hoglin: 'Hoglin', zoglin: 'Zoglin', zombified_piglin: 'Zombified Piglin', ghast: 'Ghast'
  };
  C.DMG = C.DMG || 5;
  /* Dragon Feature 6: hadiah mengalahkan Ender Dragon. Hanya NOMINAL; diberikan lewat PlayerData.grant existing
     (bukan currency/reward system baru). Diberikan 1x per game ke pemain manusia yang menang. */
  C.DRAGON_REWARD = C.DRAGON_REWARD || { coins: 500, gems: 10 };

  /* Chest Feature 2: Reward Pool. Persentase x10 supaya 0.5% dan 7.5% jadi bilangan bulat; total WAJIB 1000.
     Power = 0% (Power hanya dari Shop/Inventory). Tidak ada entri power di sini. */
  C.CHEST_POOL = C.CHEST_POOL || [
    { id: 'empty',   w: 150 },  /* 15%  */
    { id: 'maju',    w: 190 },  /* 19%  maju 1-3 langkah */
    { id: 'mundur',  w: 50 },   /* 5%   mundur 1-3 langkah */
    { id: 'lucky',   w: 90 },   /* 9%   label tampil: "Pasti 6" (dadu berikutnya 6) */
    { id: 'addroll', w: 150 },  /* 15%  */
    { id: 'bonus',   w: 190 },  /* 19%  Bonus Langkah: dadu berikutnya +2 */
    { id: 'tangga',  w: 90 },   /* 9%   Lucky: meluncur ke tangga terdekat di depan (lalu naik) */
    { id: 'ular',    w: 90 }    /* 9%   Unlucky: meluncur ke ular terdekat di depan (lalu turun) */
  ]; /* Dadu Ganjil/Genap BUKAN lagi reward Chest: pindah jadi Power (Ramuan Ganjil / Ramuan Genap). */ /* Semua reward Chest hanya berdampak ke pemain pembuka (tanpa interaksi antar pemain). Coin/XP/Emerald dihapus. */
  C.CHEST_AMOUNT = C.CHEST_AMOUNT || { coins: 5, xp: 10, gems: 1 };
  C.CHEST_MOVE = C.CHEST_MOVE || [1, 2, 3]; /* kandidat langkah untuk reward maju / mundur */

  C.PUN = C.PUN || {
    sword: ['🗡️', 'Pedang', 'serang musuh di petak yang sama: mundur 2'],
    feather: ['🪶', 'Bulu', 'giliran tambahan'],
    tnt: ['🧨', 'TNT', 'pemain terdepan mundur 6'],
    totem: ['🗿', 'Totem', 'pilih pakai saat kena ular, mob jahat, Pedang, TNT, atau Rumput'],
    potion_odd: ['🧪', 'Ramuan Ganjil', 'dadu berikutnya ganjil (1, 3, atau 5)', 'Ganjil'],
    potion_even: ['🧪', 'Ramuan Genap', 'dadu berikutnya genap (2, 4, atau 6)', 'Genap'],
    grass: ['🟩', 'Blok Rumput', 'tukar posisi dengan pemain terdepan']
  };
  /* Gambar ikon Power (versi 192px dari data/power). Emoji di PUN tetap jadi cadangan bila gambar gagal dimuat. */
  /* Stage 4.1.19: path dibaca dari ItemCatalog (item-catalog.js, dimuat sebelum file ini) agar satu sumber data.
     Bila katalog tidak ada, peta kosong -> setPuIcon otomatis memakai emoji cadangan. */
  C.PUIMG = C.PUIMG || (function () {
    var m = {}, IC = window.ItemCatalog;
    try { if (IC && IC.items) IC.items.forEach(function (it) { if (it.kind === 'powerup' && it.icon) m[it.gameKey] = it.icon; }); } catch (e) {}
    return m;
  })();
  /* Isi elemen dengan ikon Power: gambar bila ada, kalau tidak (atau gagal muat) emoji. */
  C.setPuIcon = C.setPuIcon || function (el, key, fallback) {
    var emoji = (C.PUN[key] && C.PUN[key][0]) || fallback || '', src = C.PUIMG[key];
    el.textContent = '';
    if (!src) { el.textContent = emoji; return el; }
    var im = document.createElement('img');
    im.src = src; im.alt = ''; im.draggable = false; im.className = 'puimg';
    im.onerror = function () { el.textContent = emoji; };
    el.appendChild(im); return el;
  };
})(window);
