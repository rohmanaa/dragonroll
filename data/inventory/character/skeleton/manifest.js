(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'skin.skeleton', canonicalId: 'character.skeleton', kind: 'skin', gameKey: 'skeleton',
  name: 'Skeleton', group: 'Rare', rarity: 'rare', price: 300, gems: null, starter: false,
  desc: 'Tulang-belulang pemanah dari gua gelap. Dingin dan tajam.',
  visual: { renderer: 'palette', baseModelKey: 'skeleton' },
  assets: {}
});
