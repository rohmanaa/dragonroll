(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.nature', kind: 'aura', gameKey: 'nature', name: 'Nature Aura', rarity: 'common',
  price: 600, gems: null, starter: false, stackable: false,
  desc: 'Nature / Forest. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'nature', theme: 'Nature / Forest', colors: ['#4caf50', '#8bc34a', '#7a5230'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

