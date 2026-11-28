(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.electric', kind: 'aura', gameKey: 'electric', name: 'Electric Aura', rarity: 'rare',
  price: 5000, gems: null, starter: false, stackable: false,
  desc: 'Lightning. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'electric', theme: 'Lightning', colors: ['#ffe94a', '#ffffff', '#5ac8ff'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

