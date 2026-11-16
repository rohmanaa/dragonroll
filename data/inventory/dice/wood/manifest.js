/* Manifest dice.wood — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.wood",
    kind: "dice",
    gameKey: "wood",
    name: "Dadu Wood",
    rarity: "common",
    tier: 1,
    collection: "basic",
    materialName: "Oak Wood",
    price: 500,
    gems: null,
    starter: false,
    desc: "Dadu kayu oak hangat dengan serat alami. Serpihan kayu berhamburan saat mendarat.",
    visual: {"bg":"#8b5a2b","accent":"#5e3a18","pip":"#2b1a0c","edge":"#3f2913"},
    assets: {}
});
