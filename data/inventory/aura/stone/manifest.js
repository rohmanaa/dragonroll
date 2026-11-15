(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.stone', kind: 'aura', gameKey: 'stone', name: 'Stone Aura', rarity: 'common',
  price: 600, gems: null, starter: false, stackable: false,
  desc: 'Stone / Mountain. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'stone', theme: 'Stone / Mountain', colors: ['#9a9ea6', '#ffffff', '#c0c4cc'] },
  assets: { renderer: 'assets/js/renderers/aura-fx.js' }
});
