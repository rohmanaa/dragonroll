/* Manifest dice.copper — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.copper",
    kind: "dice",
    gameKey: "copper",
    name: "Dadu Copper",
    rarity: "common",
    tier: 2,
    collection: "basic",
    materialName: "Copper",
    price: 1500,
    gems: null,
    starter: false,
    desc: "Dadu tembaga berkilau jingga yang memercikkan listrik kecil.",
    visual: {"bg":"#c4733a","accent":"#e8a36a","pip":"#3a1a08","edge":"#58341a"},
    assets: {}
});

