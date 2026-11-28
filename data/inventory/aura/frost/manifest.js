(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.frost', kind: 'aura', gameKey: 'frost', name: 'Frost Aura', rarity: 'uncommon',
  price: 2000, gems: null, starter: false, stackable: false,
  desc: 'Ice. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'frost', theme: 'Ice', colors: ['#9fe4ff', '#ffffff', '#5ac8ff'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

