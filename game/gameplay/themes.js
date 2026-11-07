/* Ular Tangga Blok — gameplay/themes.js (Stage 4.1.14.3: extract gameplay themes data)
   Skrip klasik (tanpa import/export/type=module). Dimuat SETELAH gameplay/module-bridge.js
   dan SEBELUM blok skrip gameplay inline.
   Sekarang data tiap tema ada di gameplay/maps/<map>.js (world, nether); file ini hanya merakit LIST dari UT.Gameplay.Maps.
   HANYA data tema statis. Tidak ada THREE, DOM, RNG, localStorage, timer, atau state gameplay di sini.
   Dipindahkan APA ADANYA dari gameplay.html (isi object, property, nilai, dan URUTAN array tidak diubah).
   CATATAN: tema aktif sementara hanya World & Nether (rumput/gurun/salju/hutan dihapus sementara, ada di git history).
   URUTAN WAJIB TETAP: gameplay.html memakai THEMES.indexOf(th) untuk seed dunia (20241022 + index * 977)
   dan THEMES[0] sebagai tema default. Jangan sort/reorder/rename/tambah/hapus tema tanpa memperhitungkan itu.
   Namespace: UT.Gameplay.Themes (slot object dari module-bridge.js, tidak ditimpa).
   API:  UT.Gameplay.Themes.LIST   Array<theme>  — array yang sama persis dengan THEMES lama
   Idempotent: aman dimuat lebih dari sekali, tidak menimpa LIST yang sudah terisi. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var G = UT.Gameplay = UT.Gameplay || {};
  var T = G.Themes = G.Themes || {};

  T.LIST = T.LIST || (G.Maps ? G.Maps.themes() : []);
})(window);
