/* Manifest frame.mahkotarubi — frame hadiah Login 30 hari (tidak dijual; diberikan server lewat claim_daily_reward, urutan ke-13).
   Gambar bergaya ilustrasi; efek aura digambar frame-fx.js (tabel ART, margin jendela 8 sel). Paritas dengan ItemCatalog dijaga tests/frame-registry-parity.test.js. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "frame.mahkotarubi",
    kind: "frame",
    gameKey: "mahkotarubi",
    name: "Frame Mahkota Rubi",
    rarity: "legendary",
    price: null,
    gems: null,
    starter: false,
    source: "event",
    group: "Login",
    desc: "Frame mahkota emas merah dengan rubi besar yang berkilau. Hadiah login 30 hari, tidak dijual.",
    visual: {"art":true,"mC":8},
    assets: { image: "data/frame/mahkotarubi.webp" }
});
