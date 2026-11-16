/* Manifest dice.lapis — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.lapis",
    kind: "dice",
    gameKey: "lapis",
    name: "Dadu Lapis",
    rarity: "rare",
    tier: 3,
    collection: "mineral",
    materialName: "Lapis Lazuli",
    price: 9000,
    gems: null,
    starter: false,
    desc: "Dadu lapis lazuli biru pekat dengan bintik emas dan cincin cahaya.",
    visual: {"bg":"#1d3a9e","accent":"#0f2266","pip":"#e8d27a","edge":"#0d1a47"},
    assets: {}
});
