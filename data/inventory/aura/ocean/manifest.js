(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.ocean', kind: 'aura', gameKey: 'ocean', name: 'Ocean Aura', rarity: 'epic',
  price: 15000, gems: null, starter: false, stackable: false,
  desc: 'Ocean / Prismarine. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'ocean', theme: 'Ocean / Prismarine', colors: ['#27d8e6', '#8ff6ff', '#1a6fb8'] },
  assets: { renderer: 'assets/js/renderers/aura-fx.js' }
});
