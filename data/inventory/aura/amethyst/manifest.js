(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.amethyst', kind: 'aura', gameKey: 'amethyst', name: 'Amethyst Aura', rarity: 'epic',
  price: 15000, gems: null, starter: false, stackable: false,
  desc: 'Amethyst Geode. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'amethyst', theme: 'Amethyst Geode', colors: ['#b266ff', '#d8b4ff', '#ff9ae6'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

