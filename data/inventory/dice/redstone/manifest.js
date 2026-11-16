/* Manifest dice.redstone — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.redstone",
    kind: "dice",
    gameKey: "redstone",
    name: "Dadu Redstone",
    rarity: "epic",
    tier: 4,
    collection: "mineral",
    materialName: "Redstone",
    price: 30000,
    gems: null,
    starter: false,
    desc: "Dadu redstone yang menyala; titiknya berpendar dan menyetrum saat mendarat.",
    visual: {"bg":"#6a0d0d","accent":"#ff2a2a","pip":"#ff3a3a","edge":"#300606"},
    assets: {}
});
