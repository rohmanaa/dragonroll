(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.nether', kind: 'aura', gameKey: 'nether', name: 'Nether Aura', rarity: 'epic',
  price: 15000, gems: null, starter: false, stackable: false,
  desc: 'Nether. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'nether', theme: 'Nether', colors: ['#ff3a1a', '#ff7a18', '#1a0505'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

