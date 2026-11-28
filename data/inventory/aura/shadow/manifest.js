(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.shadow', kind: 'aura', gameKey: 'shadow', name: 'Shadow Aura', rarity: 'legendary',
  price: null, gems: 500, starter: false, stackable: false,
  desc: 'Dark Dimension. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'shadow', theme: 'Dark Dimension', colors: ['#0a0510', '#5a1a8a', '#c0182c'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

