/* Manifest dice.ender — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.ender",
    kind: "dice",
    gameKey: "ender",
    name: "Dadu Ender",
    rarity: "legendary",
    tier: 6,
    collection: "mythical",
    materialName: "Ender Pearl",
    price: null,
    gems: 1500,
    starter: false,
    desc: "Dadu mutiara Ender yang berteleportasi dengan bintang ungu.",
    visual: {"bg":"#1c0a3a","accent":"#e020c8","pip":"#ff7af0","edge":"#0d051a"},
    assets: {}
});
