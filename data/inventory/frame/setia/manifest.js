/* Manifest frame.setia — frame hadiah login Hari 30 (tidak dijual; diberikan server lewat claim_daily_reward).
   Paritas dengan ItemCatalog dijaga tests/frame-registry-parity.test.js. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "frame.setia",
    kind: "frame",
    gameKey: "setia",
    name: "Frame Setia",
    rarity: "legendary",
    price: null,
    gems: null,
    starter: false,
    source: "event",
    group: "Login",
    desc: "Frame zamrud eksklusif untuk pemain yang login 30 hari berturut-turut. Tidak dijual.",
    visual: {"fxKey":"gold","tier":3},
    assets: { image: "data/frame/setia.webp" }
});
