(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.dragon', kind: 'aura', gameKey: 'dragon', name: 'Dragon Aura', rarity: 'mythic',
  price: null, gems: 1500, starter: false, stackable: false,
  desc: 'Ender Dragon. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'dragon', theme: 'Ender Dragon', colors: ['#ff2a3a', '#7a2aa8', '#0a0510'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

