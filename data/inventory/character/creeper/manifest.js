(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'skin.creeper', canonicalId: 'character.creeper', kind: 'skin', gameKey: 'creeper',
  name: 'Creeper', group: 'Adventure', rarity: 'common', price: 0, gems: null, starter: true,
  desc: 'Hijau, diam-diam, dan penuh kejutan di setiap giliran.',
  visual: { renderer: 'palette', baseModelKey: 'creeper' },
  assets: {}
});
