/* Manifest dice.tnt — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di assets/js/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.tnt",
    kind: "dice",
    gameKey: "tnt",
    name: "Dadu TNT",
    rarity: "rare",
    price: 1500,
    gems: null,
    starter: false,
    desc: "Dadu merah meledak-ledak. Semoga angkanya ikut meledak!",
    visual: {"bg":"#d63a2a","pip":"#ffffff","edge":"#4a0d07"},
    assets: {}
});
