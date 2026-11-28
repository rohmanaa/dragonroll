/* Manifest dice.emas — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.emas",
    kind: "dice",
    gameKey: "emas",
    name: "Dadu Emas",
    rarity: "legendary",
    tier: 3,
    collection: "basic",
    materialName: "Gold Block",
    price: 9000,
    gems: null,
    starter: false,
    featured: true,
    legacyIds: ["emas"],
    desc: "Dadu emas berkilau untuk pemain yang percaya diri.",
    visual: {"bg":"#eab72a","accent":"#fff0a0","pip":"#5a3d00","edge":"#695213"},
    assets: {}
});

