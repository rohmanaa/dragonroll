/* Kategori Pet (Stage 4) — mendaftarkan kategori + 7 manifest ke ItemRegistry (pola sama dengan data/inventory/frame/index.js).
   Urutan KEYS = urutan di ItemCatalog (assets/js/item-catalog.js, tier 1..7). Satu item = satu folder (nama folder = gameKey).
   Gambar, model, dan SFX khusus Pet berada di folder item masing-masing; SFX yang dipakai Gameplay Power tetap di assets/audio/sfx/pet/. Tanpa fallbackId: slot pet opsional, tidak ada pet bawaan.
   Node : require('data/pet/index.js').register(registry)
   Browser: muat tiap <folder>/manifest.js (mengisi UT.ItemManifests) lalu berkas ini; ItemCatalog memanggil register() sendiri. */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; (root.UT.ItemCategories = root.UT.ItemCategories || {}).pet = api; }
})(typeof window !== 'undefined' ? window : null, function (req) {
  'use strict';

  var KEYS = ['forest_pup',  'copper_golem',  'crystal_axolotl',  'arcane_owl',  'storm_wolf',  'inferno_dragon',  'celestial_kitsune'];
  var CATEGORY = { key: 'pet', kind: 'pet', label: 'Pet' };

  /* Manifest kategori ini: Node = require per folder; browser = antrean UT.ItemManifests yang diisi tiap manifest.js. */
  function manifests() {
    if (req) return KEYS.map(function (k) { return req('./items/' + k + '/manifest.js'); });
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
