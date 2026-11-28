(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.solar', kind: 'aura', gameKey: 'solar', name: 'Solar Aura', rarity: 'legendary',
  price: null, gems: 500, starter: false, stackable: false,
  desc: 'Sun / Solar Energy. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'solar', theme: 'Sun / Solar Energy', colors: ['#ffd24a', '#fff7c8', '#ffffff'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

