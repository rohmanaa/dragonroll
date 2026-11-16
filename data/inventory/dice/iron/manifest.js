/* Manifest dice.iron — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.iron",
    kind: "dice",
    gameKey: "iron",
    name: "Dadu Iron",
    rarity: "common",
    tier: 2,
    collection: "basic",
    materialName: "Iron",
    price: 1500,
    gems: null,
    starter: false,
    desc: "Dadu besi tempa yang berdenting dan memercikkan bunga api.",
    visual: {"bg":"#b4b8be","accent":"#e4e7eb","pip":"#23262c","edge":"#515356"},
    assets: {}
});
