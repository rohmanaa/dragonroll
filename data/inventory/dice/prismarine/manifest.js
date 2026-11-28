/* Manifest dice.prismarine â€” dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.prismarine",
    kind: "dice",
    gameKey: "prismarine",
    name: "Dadu Prismarine",
    rarity: "legendary",
    tier: 5,
    collection: "elemental",
    materialName: "Prismarine",
    price: null,
    gems: 600,
    starter: false,
    desc: "Dadu prismarine laut dengan gelembung dan cipratan air.",
    visual: {"bg":"#2ab8a8","accent":"#1f8a78","pip":"#05302c","edge":"#13534c"},
    assets: {}
});

