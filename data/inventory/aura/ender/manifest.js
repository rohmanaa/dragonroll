(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.ender', kind: 'aura', gameKey: 'ender', name: 'Ender Aura', rarity: 'epic',
  price: 15000, gems: null, starter: false, stackable: false,
  desc: 'Enderman / End Dimension. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'ender', theme: 'Enderman / End Dimension', colors: ['#c24cff', '#ff40d8', '#14041f'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

