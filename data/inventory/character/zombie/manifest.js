(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'skin.zombie', canonicalId: 'character.zombie', kind: 'skin', gameKey: 'zombie',
  name: 'Zombie', group: 'Adventure', rarity: 'common', price: 0, gems: null, starter: true,
  desc: 'Berjalan lambat tapi pantang menyerah sampai petak 100.',
  visual: { renderer: 'palette', baseModelKey: 'zombie' },
  assets: {}
});
