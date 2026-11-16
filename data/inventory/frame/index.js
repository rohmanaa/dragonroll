/* Kategori Frame (pilot Stage 2) — mendaftarkan kategori + 14 manifest ke ItemRegistry.
   Urutan KEYS = urutan di ItemCatalog (assets/js/item-catalog.js). Satu item = satu folder (nama folder = gameKey).
   Asset TIDAK dipindah: manifest merujuk path existing di data/frame/ (aset & renderer frame-fx.js tidak berubah).
   Halaman yang memuat rantai ini mengadopsi metadata lewat ItemCatalog; fallback legacy tetap tersedia.
   Node : require('data/inventory/frame/index.js').register(registry)
   Browser: muat tiap <folder>/manifest.js, lalu berkas ini; ItemCatalog memanggil register() saat mengadopsi kategori. */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; (root.UT.ItemCategories = root.UT.ItemCategories || {}).frame = api; }
})(typeof window !== 'undefined' ? window : null, function (req) {
  'use strict';

  var KEYS = ['default', 'stone', 'copper', 'iron', 'gold', 'diamond', 'amethyst', 'nether', 'ender', 'storm', 'dragon', 'phoenix', 'celestial', 'cosmic'];
  var CATEGORY = { key: 'frame', kind: 'frame', label: 'Frame', fallbackId: 'frame.default',
                   assets: { tabIcon: 'data/frame/img/icon-frame.webp' } };

  /* Manifest kategori ini: Node = require per folder; browser = antrean UT.ItemManifests yang diisi tiap manifest.js. */
  function manifests() {
    if (req) return KEYS.map(function (k) { return req('./' + k + '/manifest.js'); });
    var q = (typeof window !== 'undefined' && window.UT && window.UT.ItemManifests) || [];
    return q.filter(function (m) { return m && m.kind === CATEGORY.kind; });
  }

  /* Mendaftarkan kategori lalu semua item. Mengembalikan { ok, registered, rejected:[{id, reason, errors}] }. Tidak melempar. */
  function register(registry) {
    var out = { ok: true, registered: 0, rejected: [] };
    var c = registry.registerCategory(CATEGORY);
    if (!c.ok && c.reason !== 'duplicate-category') { out.ok = false; out.rejected.push({ id: null, reason: c.reason, errors: c.errors }); return out; }
    var list; try { list = manifests(); } catch (e) { out.ok = false; out.rejected.push({ id: null, reason: 'manifest-load-failed', errors: [String(e && e.message || e)] }); return out; }
    list.forEach(function (m) {
      var r = registry.registerItem(m);
      if (r.ok) out.registered++; else { out.ok = false; out.rejected.push({ id: m && m.id || null, reason: r.reason, errors: r.errors }); }
    });
    return out;
  }

  return { category: CATEGORY, keys: KEYS.slice(), manifests: manifests, register: register };
});
