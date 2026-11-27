/* Manifest frame.sayapsurgawi — frame hadiah Login 30 hari (tidak dijual; diberikan server lewat claim_daily_reward, urutan ke-15).
   Gambar bergaya ilustrasi; efek aura digambar frame-fx.js (tabel ART, margin jendela 8 sel). Paritas dengan ItemCatalog dijaga tests/frame-registry-parity.test.js. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "frame.sayapsurgawi",
    kind: "frame",
    gameKey: "sayapsurgawi",
    name: "Frame Sayap Surgawi",
    rarity: "legendary",
    price: null,
    gems: null,
    starter: false,
    source: "event",
    group: "Login",
    desc: "Frame emas bersayap putih dengan bintang suci dan halo yang berputar. Hadiah login 30 hari, tidak dijual.",
    visual: {"art":true,"mC":8},
    assets: { image: "data/frame/sayapsurgawi.webp" }
});
