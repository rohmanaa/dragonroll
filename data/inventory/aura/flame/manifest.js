(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.flame', kind: 'aura', gameKey: 'flame', name: 'Flame Aura', rarity: 'uncommon',
  price: 2000, gems: null, starter: false, stackable: false,
  desc: 'Fire. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'flame', theme: 'Fire', colors: ['#ff3a1a', '#ff7a18', '#ffd24a'] },
  assets: { renderer: 'assets/js/renderers/aura-fx.js' }
});
