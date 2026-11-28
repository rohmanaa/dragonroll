/* Manifest dice.magma — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.magma",
    kind: "dice",
    gameKey: "magma",
    name: "Dadu Magma",
    rarity: "legendary",
    tier: 5,
    collection: "elemental",
    materialName: "Magma Block",
    price: null,
    gems: 600,
    starter: false,
    desc: "Dadu magma membara dengan percikan lava dan bara yang naik.",
    visual: {"bg":"#1a0d0a","accent":"#ff5a10","pip":"#ffb040","edge":"#0c0605"},
    assets: {}
});

