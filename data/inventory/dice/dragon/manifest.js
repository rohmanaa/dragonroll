/* Manifest dice.dragon — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.dragon",
    kind: "dice",
    gameKey: "dragon",
    name: "Dadu Dragon",
    rarity: "legendary",
    tier: 7,
    collection: "mythical",
    materialName: "Dragon Essence",
    price: null,
    gems: 3000,
    starter: false,
    desc: "Dadu esensi naga tertinggi: sisik gelap, api, dan ledakan naga saat mendarat.",
    visual: {"bg":"#0c0508","accent":"#e01830","pip":"#ff5a40","edge":"#050204"},
    assets: {}
});
