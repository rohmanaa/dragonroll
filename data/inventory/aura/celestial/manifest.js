(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'aura.celestial', kind: 'aura', gameKey: 'celestial', name: 'Celestial Aura', rarity: 'divine',
  price: null, gems: 3000, starter: false, stackable: false,
  desc: 'Divine / Cosmic. Aura mengikuti karakter saat berjalan, melompat, dan mendarat.',
  visual: { effectKey: 'celestial', theme: 'Divine / Cosmic', colors: ['#fff2b0', '#ffffff', '#7fe6ff'] },
  assets: { renderer: 'assets/js/renderers/aura-fx.js' }
});
