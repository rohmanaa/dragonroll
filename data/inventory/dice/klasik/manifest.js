/* Manifest dice.klasik — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.klasik",
    kind: "dice",
    gameKey: "klasik",
    name: "Dadu Klasik",
    rarity: "common",
    price: 0,
    gems: null,
    starter: true,
    legacyIds: ["standard"],
    desc: "Dadu putih sederhana yang tidak pernah ketinggalan zaman.",
    visual: {"bg":"#ffffff","pip":"#1b2a3b","edge":"#1b2a3b"},
    assets: {}
});
