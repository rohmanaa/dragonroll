/* Manifest frame.batutua — frame hadiah Login 30 hari (tidak dijual; diberikan server lewat claim_daily_reward, urutan ke-2).
   Gambar bergaya ilustrasi; efek aura digambar frame-fx.js (tabel ART, margin jendela 5 sel). Paritas dengan ItemCatalog dijaga tests/frame-registry-parity.test.js. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "frame.batutua",
    kind: "frame",
    gameKey: "batutua",
    name: "Frame Batu Tua",
    rarity: "rare",
    price: null,
    gems: null,
    starter: false,
    source: "event",
    group: "Login",
    desc: "Frame batu kuno yang retak dan berkarat di sudut-sudutnya. Hadiah login 30 hari, tidak dijual.",
    visual: {"art":true,"mC":5},
    assets: { image: "data/frame/batutua.webp" }
});
