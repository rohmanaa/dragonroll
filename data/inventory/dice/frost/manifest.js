/* Manifest dice.frost — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.frost",
    kind: "dice",
    gameKey: "frost",
    name: "Dadu Frost",
    rarity: "legendary",
    tier: 5,
    collection: "elemental",
    materialName: "Packed Ice",
    price: null,
    gems: 600,
    starter: false,
    desc: "Dadu es padat yang memancarkan kabut dingin dan ledakan es.",
    visual: {"bg":"#9fd8ff","accent":"#ffffff","pip":"#0c3a66","edge":"#486173"},
    assets: {}
});
