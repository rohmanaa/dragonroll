/* Manifest dice.quartz â€” dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.quartz",
    kind: "dice",
    gameKey: "quartz",
    name: "Dadu Quartz",
    rarity: "legendary",
    tier: 5,
    collection: "elemental",
    materialName: "Nether Quartz",
    price: null,
    gems: 600,
    starter: false,
    desc: "Dadu kuarsa nether bening yang memantulkan kilau merah muda.",
    visual: {"bg":"#f4eeee","accent":"#f0a8c0","pip":"#5a2a3a","edge":"#6e6b6b"},
    assets: {}
});

