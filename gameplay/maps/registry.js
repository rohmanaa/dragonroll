/* Ular Tangga Blok - gameplay/maps/registry.js
   Registry map. Dimuat SEBELUM gameplay/maps/*.js dan gameplay/themes.js.
   API: UT.Gameplay.Maps.register(def)  def = {key, theme, goal?, rules?, onlyMobs?}
        goal  = petak akhir (default 100). rules = {ladders, snakes, chests:[], mobs:[[nama,[petak]]]};
        yang tidak diisi memakai UT.Gameplay.Config (dibaca gameplay.html -> applyMapRules)  (key unik; duplikat diabaikan)
        .list() -> array def sesuai urutan daftar   .get(key)   .themes() -> array theme
        .mobThemeOnly() -> {mob: key}  turunan dari onlyMobs tiap map
   Titik perluasan berikutnya (belum dipindah dari gameplay.html): board (bentuk papan), rules (ular/tangga/petak),
   dan builder dekor per map. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  var M = G.Maps = G.Maps || {}, L = M._list = M._list || [];
  M.register = M.register || function (def) {
    if (!def || !def.key || !def.theme || M.get(def.key)) return false;
    L.push(def); return true;
  };
  M.get = M.get || function (k) { for (var i = 0; i < L.length; i++) if (L[i].key === k) return L[i]; return null; };
  M.list = M.list || function () { return L.slice(); };
  M.themes = M.themes || function () { return L.map(function (m) { return m.theme; }); };
  M.mobThemeOnly = M.mobThemeOnly || function () {
    var o = {}; L.forEach(function (m) { (m.onlyMobs || []).forEach(function (b) { o[b] = m.key; }); }); return o;
  };
})(window);
