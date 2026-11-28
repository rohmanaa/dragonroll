/* Manifest dice.void â€” dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.void",
    kind: "dice",
    gameKey: "void",
    name: "Dadu Void",
    rarity: "legendary",
    tier: 6,
    collection: "mythical",
    materialName: "Crying Obsidian",
    price: null,
    gems: 1500,
    starter: false,
    desc: "Dadu crying obsidian yang membuka portal pusaran saat mendarat.",
    visual: {"bg":"#0a0614","accent":"#9a3cff","pip":"#d8a8ff","edge":"#050309"},
    assets: {}
});

