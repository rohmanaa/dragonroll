/* Manifest dice.matrix — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.matrix",
    kind: "dice",
    gameKey: "matrix",
    name: "Dadu Matrix Epik",
    rarity: "epic",
    tier: 4,
    collection: "mythical",
    materialName: "Matrix Code",
    price: 30000,
    gems: null,
    starter: false,
    desc: "Dadu Epik hijau neon: hujan kode Matrix, sirkuit menyala, dan ledakan data saat mendarat.",
    visual: {"bg":"#04140a","accent":"#22ff66","pip":"#b6ffcf","edge":"#020a05"},
    assets: {}
});
