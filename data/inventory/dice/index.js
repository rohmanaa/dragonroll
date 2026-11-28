/* Kategori Dice (Stage 5) — mendaftarkan kategori + 24 manifest ke ItemRegistry (pola sama dengan data/inventory/frame|pet/index.js).
   Urutan KEYS = urutan di ItemCatalog (src/stores/item-catalog.js). Satu item = satu folder (nama folder = gameKey = id DiceKit).
   fallbackId 'dice.klasik' = dadu bawaan (DEFAULT_EQUIPPED.dice di ItemCatalog; starter).
   Asset TIDAK dipindah: render/material/efek/suara dadu tetap di src/renderers/dice-kit/ (DiceCatalog.js = sumber material & efek; efek suara prosedural di DiceEffectsCore.js);
   assets.renderKit di bawah hanya REFERENSI ke sumber render itu (bukan salinan). Berkas SFX dice-roll.mp3 dimiliki peta audio gameplay (src/gameplay/js/audio.js) — tidak diduplikasi di sini.
   Node : require('data/inventory/dice/index.js').register(registry)
   Browser: muat tiap <folder>/manifest.js (mengisi UT.ItemManifests) lalu berkas ini; ItemCatalog memanggil register() sendiri. */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; (root.UT.ItemCategories = root.UT.ItemCategories || {}).dice = api; }
})(typeof window !== 'undefined' ? window : null, function (req) {
  'use strict';

  var KEYS = ['klasik', 'rumput', 'tnt', 'wood', 'stone', 'copper', 'iron', 'emas', 'diamond', 'emerald', 'lapis', 'amethyst', 'redstone', 'obsidian', 'magma', 'frost', 'prismarine', 'quartz', 'void', 'netherite', 'sculk', 'ender', 'dragon', 'matrix'];
  var CATEGORY = { key: 'dice', kind: 'dice', label: 'Dadu', fallbackId: 'dice.klasik',
                   assets: { renderKit: 'src/renderers/dice-kit/dice-catalog.js' } };

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


