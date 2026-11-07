/* Ular Tangga Blok - gameplay/island-skin.js
   Adaptor tipis: dasar dunia gameplay = komponen pulau melayang YANG SAMA dengan profil/teman
   (assets/js/floating-island.js: atlas piksel per-blok, AO, palet zaitun/sage, tanah liat, batu+lumut,
   emas, stalaktit, kristal, batu melayang). TIDAK ada generator pulau kedua di sini.
   Dimuat SETELAH three.min.js dan assets/js/floating-island.js.
   API: UT.Gameplay.IslandSkin.mount(parentGroup, THREE, {y, scale, seed}) -> group pulau (atau null bila komponen belum dimuat)
   Tahap 1: hanya pulau tanpa dekor puncak + tanpa bayangan kontak, diletakkan di BAWAH board/tanah
   (permukaan atas pulau = y; default -0.5 = dasar kolom board). Dibuat tidak memakai rnd() dunia. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  G.IslandSkin = {
    mount: function (parent, THREE, o) {
      o = o || {};
      if (!UT.FloatingIsland || !THREE) return null;
      var isl = UT.FloatingIsland.create(THREE, { seed: o.seed || 5, bob: 0, scale: o.scale || 2, decor: false, noShadow: true });
      isl.position.set(o.x || 0, o.y == null ? -0.5 : o.y, o.z || 0);
      isl.name = 'islandSkin';
      parent.add(isl);
      return isl;
    }
  };
})(window);
