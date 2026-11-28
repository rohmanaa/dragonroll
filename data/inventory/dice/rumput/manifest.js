/* Manifest dice.rumput — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.rumput",
    kind: "dice",
    gameKey: "rumput",
    name: "Dadu Rumput",
    rarity: "common",
    price: 500,
    gems: null,
    starter: false,
    desc: "Dadu hijau segar bergaya blok rumput.",
    visual: {"bg":"#5fae3e","pip":"#1f4a12","edge":"#2c5a1c"},
    assets: {}
});

