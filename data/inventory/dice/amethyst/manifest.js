/* Manifest dice.amethyst â€” dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.amethyst",
    kind: "dice",
    gameKey: "amethyst",
    name: "Dadu Amethyst",
    rarity: "epic",
    tier: 4,
    collection: "mineral",
    materialName: "Amethyst",
    price: 30000,
    gems: null,
    starter: false,
    desc: "Dadu kecubung ungu yang beresonansi dengan serpihan kristal.",
    visual: {"bg":"#8a4fd8","accent":"#e0baff","pip":"#2a0f4a","edge":"#3e2461"},
    assets: {}
});

