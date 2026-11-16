/* Kategori Power (Stage 6) — mendaftarkan manifest Power ke ItemRegistry.
   ID Registry memakai powerup.<gameKey>; ItemCatalog memetakan kembali ke ID gameplay lama (gameKey).
   Aset dan perilaku tetap di renderer/engine bersama; manifest hanya menyimpan metadata dan referensinya. */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; (root.UT.ItemCategories = root.UT.ItemCategories || {}).powerup = api; }
})(typeof window !== 'undefined' ? window : null, function (req) {
  'use strict';

  var KEYS = ['sword', 'feather', 'tnt', 'totem', 'potion_odd', 'potion_even', 'grass',
    'diamond_sword', 'netherite_sword', 'wooden_shield', 'golden_apple', 'fire_charge',
    'ice_crystal', 'blaze_core', 'trident', 'dragon_crystal', 'nether_star'];
  var CATEGORY = {
    key: 'powerup', kind: 'powerup', label: 'Power-up',
    assets: {
      modelCatalog: 'assets/js/renderers/power-3d/power-catalog.js',
      modelRegistry: 'assets/js/renderers/power-3d/power-registry.js',
      geometry: 'assets/js/renderers/power-3d/power-geometry.js',
      materials: 'assets/js/renderers/power-3d/power-materials.js',
      animation: 'assets/js/renderers/power-3d/power-animation.js',
      effects3d: 'assets/js/renderers/power-3d/power-effects.js',
      particles3d: 'assets/js/renderers/power-3d/power-particles.js',
      aura: 'assets/js/renderers/power-3d/power-aura.js',
      audio: 'assets/js/renderers/power-3d/power-sound.js',
      effects2d: 'data/power/power-fx.js',
      particleEngine: 'gameplay/js/particle-fx.js',
      particleStyles: 'gameplay/css/particle-fx.css',
      gameplayAudio: 'gameplay/js/audio.js'
    }
  };

  function manifests() {
    if (req) return KEYS.map(function (k) { return req('./' + k + '/manifest.js'); });
    var q = (typeof window !== 'undefined' && window.UT && window.UT.ItemManifests) || [];
    return q.filter(function (m) { return m && m.kind === CATEGORY.kind; });
  }

  function register(registry) {
    var out = { ok: true, registered: 0, rejected: [] };
    var c = registry.registerCategory(CATEGORY);
    if (!c.ok && c.reason !== 'duplicate-category') {
      out.ok = false; out.rejected.push({ id: null, reason: c.reason, errors: c.errors }); return out;
    }
    var list;
    try { list = manifests(); }
    catch (e) { out.ok = false; out.rejected.push({ id: null, reason: 'manifest-load-failed', errors: [String(e && e.message || e)] }); return out; }
    list.forEach(function (m) {
      var r = registry.registerItem(m);
      if (r.ok) out.registered++;
      else { out.ok = false; out.rejected.push({ id: m && m.id || null, reason: r.reason, errors: r.errors }); }
    });
    return out;
  }

  return { category: CATEGORY, keys: KEYS.slice(), manifests: manifests, register: register };
});
