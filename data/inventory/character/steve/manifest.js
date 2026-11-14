(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  id: 'skin.steve', canonicalId: 'character.steve', kind: 'skin', gameKey: 'steve',
  name: 'Steve', group: 'Default', rarity: 'common', price: 0, gems: null, starter: true,
  desc: 'Petualang blok klasik. Siap melangkah ke petak mana pun.',
  visual: { renderer: 'palette', baseModelKey: 'steve' },
  assets: {}
});
