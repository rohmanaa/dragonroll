(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.emerald', kind: 'aura', gameKey: 'emerald', name: 'Emerald Aura', rarity: 'rare',
  price: 5000, gems: null, starter: false, stackable: false,
  desc: 'Emerald. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'emerald', theme: 'Emerald', colors: ['#1fd16a', '#c6ff5a', '#ffffff'] },
  assets: { renderer: 'assets/js/renderers/aura-fx.js' }
});
