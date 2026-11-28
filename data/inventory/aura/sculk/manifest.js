(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.sculk', kind: 'aura', gameKey: 'sculk', name: 'Sculk Aura', rarity: 'legendary',
  price: null, gems: 500, starter: false, stackable: false,
  desc: 'Deep Dark / Sculk. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'sculk', theme: 'Deep Dark / Sculk', colors: ['#27e6ff', '#0a2a5a', '#1a5fbf'] },
  assets: { renderer: 'src/renderers/aura-fx.js' }
});

