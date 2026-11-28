/* Kategori Aura — metadata 15 Aura dari ItemRegistry; perilaku visual tetap di engine AuraFX bersama. */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; (root.UT.ItemCategories = root.UT.ItemCategories || {}).aura = api; }
})(typeof window !== 'undefined' ? window : null, function (req) {
  'use strict';

  var KEYS = ['nature', 'stone', 'flame', 'frost', 'electric', 'emerald', 'ender', 'nether', 'amethyst', 'ocean',
    'solar', 'shadow', 'sculk', 'dragon', 'celestial'];
  var CATEGORY = {
    key: 'aura',
    kind: 'aura',
    label: 'Aura',
    assets: { renderer: 'src/renderers/aura-fx.js', view: 'src/renderers/aura-view.js' }
  };

  function manifests() {
    if (req) return KEYS.map(function (key) { return req('./' + key + '/manifest.js'); });
    var queue = (typeof window !== 'undefined' && window.UT && window.UT.ItemManifests) || [];
    return queue.filter(function (manifest) { return manifest && manifest.kind === CATEGORY.kind; });
  }

  function register(registry) {
    var out = { ok: true, registered: 0, rejected: [] };
    var category = registry.registerCategory(CATEGORY);
    if (!category.ok && category.reason !== 'duplicate-category') {
      out.ok = false;
      out.rejected.push({ id: null, reason: category.reason, errors: category.errors });
      return out;
    }
    var list;
    try { list = manifests(); }
    catch (e) {
      out.ok = false;
      out.rejected.push({ id: null, reason: 'manifest-load-failed', errors: [String(e && e.message || e)] });
      return out;
    }
    list.forEach(function (manifest) {
      var result = registry.registerItem(manifest);
      if (result.ok) out.registered++;
      else {
        out.ok = false;
        out.rejected.push({ id: manifest && manifest.id || null, reason: result.reason, errors: result.errors });
      }
    });
    return out;
  }

  return { category: CATEGORY, keys: KEYS.slice(), manifests: manifests, register: register };
});

