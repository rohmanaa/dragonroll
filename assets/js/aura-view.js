/* assets/js/aura-view.js — memasang AURA yang sedang dipakai (item katalog kind 'aura', slot 'aura') pada karakter 3D di halaman mana pun.
   Pembungkus tipis di atas UT.AuraFX (aura-fx.js) agar lobby, profil, dan gameplay tidak menyalin logika efek.html.
   Butuh (dimuat lebih dulu): three.min.js, item-catalog.js, player-data.js, aura-fx.js. Semua fungsi aman dipanggil bila modul/WebGL tidak ada (tidak error, aura saja yang tak tampil).
   API:
     UT.AuraView.equippedKey()           -> id aura (gameKey) yang dipakai pemain ini, atau null
     UT.AuraView.keyFromEquipped(eq)     -> id aura dari data 'equipped' server (pemain lain), atau null
     UT.AuraView.quality()               -> 'low' kecuali pengaturan grafis 'high' (lalu deteksi perangkat)
     const A = UT.AuraView.create(scene, camera[, {quality}])
       A.only(root, key[, {height, settings}])  // aura hanya untuk root ini (yang lain dilepas); key null = tanpa aura
       A.set(root, key[, {height, settings}])   // tambah/ubah aura untuk root (banyak karakter sekaligus)
       A.clear(root) / A.clearAll()             // lepas dengan memudar
       A.update(dt)                             // tiap frame (setelah posisi karakter diperbarui)
       A.has(root)                              // true bila root punya aura aktif */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.AuraView) return;

  function FX() { return UT.AuraFX || null; }
  function keyOfItem(id) {
    try {
      if (!id || !win.ItemCatalog || !FX() || !FX().AURAS) return null;
      var it = win.ItemCatalog.byId(id);
      if (!it || it.kind !== 'aura') return null;
      var k = it.gameKey;
      return FX().AURAS.some(function (a) { return a.id === k; }) ? k : null;
    } catch (e) { return null; }
  }
  function equippedKey() { try { return keyOfItem(win.PlayerData.equippedId('aura')); } catch (e) { return null; } }
  function keyFromEquipped(eq) { try { return keyOfItem(eq && eq.aura); } catch (e) { return null; } }
  function quality() {
    try { return win.PlayerData.settings().graphics === 'high' ? FX().detectQuality() : 'low'; } catch (e) { return 'low'; }
  }

  function create(scene, camera, opts) {
    opts = opts || {};
    var sys = null, items = [];
    function find(root) { for (var i = 0; i < items.length; i++) if (items[i].root === root) return items[i]; return null; }
    function ensure() {
      if (sys) return sys;
      if (!FX() || !FX().AuraSystem || !win.THREE) return null;
      try { sys = new (FX().AuraSystem)(scene, camera, { quality: opts.quality || quality() }); } catch (e) { sys = null; }
      return sys;
    }
    function clear(root) {
      var it = find(root); if (!it) return;
      items.splice(items.indexOf(it), 1);
      try { it.a.despawn(true); } catch (e) {}
    }
    function set(root, key, o) {
      o = o || {};
      if (!root) return;
      if (!key) { clear(root); return; }
      var s = ensure(); if (!s) return;
      var it = find(root);
      try {
        if (it) { if (it.key !== key) { it.a.setAura(key); it.key = key; } return; }
        scene.updateMatrixWorld(true);
        var h = o.height; if (!(h > 0.05)) { var bb = new win.THREE.Box3().setFromObject(root); h = bb.max.y - bb.min.y; }
        var a = s.attach(root, key, o.settings || {}, { height: h > 0.05 ? h : undefined });
        items.push({ root: root, key: key, a: a });
      } catch (e) { /* aura gagal: karakter tetap tampil tanpa aura */ }
    }
    function only(root, key, o) {
      items.slice().forEach(function (it) { if (it.root !== root) clear(it.root); });
      set(root, key, o);
    }
    function clearAll() { items.slice().forEach(function (it) { clear(it.root); }); }
    function update(dt) { if (sys) { try { sys.update(dt); } catch (e) {} } }
    function has(root) { return !!find(root); }
    return { set: set, only: only, clear: clear, clearAll: clearAll, update: update, has: has, get system() { return sys; } };
  }

  UT.AuraView = { equippedKey: equippedKey, keyFromEquipped: keyFromEquipped, quality: quality, create: create };
})(window);
