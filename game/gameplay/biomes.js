/* Ular Tangga Blok — gameplay/biomes.js (Stage 4.1.14.5: extract biome data)
   Skrip klasik (tanpa import/export/type=module). Dimuat SETELAH gameplay/themes.js dan config.js
   dan SEBELUM blok skrip gameplay inline.
   HANYA data biome statis. Tidak ada THREE, DOM, RNG, localStorage, timer, atau state gameplay di sini.
   Dipindahkan APA ADANYA dari gameplay.html (nilai, key, dan URUTAN tidak diubah):
     BIO      — warna [c1,c2] hewan (pig/cow) per theme.key; fallback pembaca: BIO.rumput
     PK / R   — warna puncak (PK) dan air/sungai (R) buildMcTerrain per theme.key;
                theme tanpa entry (rumput) dan minecraft memakai nilai MC / FALLBACK
     PALETTES — palet area mulai: sandy.default dipakai semua theme kecuali salju (sandy.salju),
                format [sandy, sandy2]
   Pembaca (gameplay.html) tetap memegang logic pemilihan (th.key==='minecraft', th.key==='salju', ||fallback).
   Namespace: UT.Gameplay.Biomes. Idempotent: tidak menimpa object yang sudah ada. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var G = UT.Gameplay = UT.Gameplay || {};
  var B = G.Biomes = G.Biomes || {};

  B.BIO = B.BIO || {rumput:[[0xF0A8A8,0xD98888],[0xF2F2F2,0x3A2A22]],gurun:[[0xD9B26A,0x9A7A3A],[0xC99A52,0x7A5A2A]],salju:[[0xF4F8FA,0xB8C8D0],[0xDDE6EA,0x6A7A82]],hutan:[[0xE6B84A,0x8A6A1E],[0x6FBF4A,0x2E6B1E]],nether:[[0xD98A7A,0x8A4A3A],[0xC9703A,0x6A3A1A]]};

  B.PK = B.PK || {gurun:0xF6DDA0,salju:0xFFFFFF,hutan:0x2E7D4F,nether:0x2E2E36};
  B.R  = B.R  || {gurun:0x3FB6D0,salju:0x9AD7F0,hutan:0x2E8FBF,nether:0xFF6A1A};
  B.MC       = B.MC       || {PK:0xEEF4F4,R:0x3F76E4};
  B.FALLBACK = B.FALLBACK || {PK:0xEEF4F4,R:0x3F76E4};

  B.PALETTES = B.PALETTES || {
    sandy:{default:[0xE8D7A0,0xCDB878],salju:[0xCFE9F5,0xB4D6E8]}
  };
})(window);
