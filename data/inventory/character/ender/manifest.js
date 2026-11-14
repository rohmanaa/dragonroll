(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'skin.ender', canonicalId: 'character.ender', kind: 'skin', gameKey: 'ender',
  name: 'Enderman', group: 'Epic', rarity: 'epic', price: 700, gems: null, starter: false, featured: true,
  desc: 'Makhluk tinggi dari dimensi lain dengan mata ungu menyala.',
  visual: { renderer: 'palette', baseModelKey: 'ender' },
  assets: {}
});
