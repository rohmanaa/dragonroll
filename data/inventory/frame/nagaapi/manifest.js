/* Manifest frame.nagaapi — frame hadiah Login 30 hari (tidak dijual; diberikan server lewat claim_daily_reward, urutan ke-1).
   Gambar bergaya ilustrasi; efek aura digambar frame-fx.js (tabel ART, margin jendela 8 sel). Paritas dengan ItemCatalog dijaga tests/frame-registry-parity.test.js. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "frame.nagaapi",
    kind: "frame",
    gameKey: "nagaapi",
    name: "Frame Naga Api",
    rarity: "legendary",
    price: null,
    gems: null,
    starter: false,
    source: "event",
    group: "Login",
    desc: "Frame naga bertanduk bersisik gelap dengan api yang menyala di kakinya. Hadiah login 30 hari, tidak dijual.",
    visual: {"art":true,"mC":8},
    assets: { image: "data/frame/nagaapi.webp" }
});
