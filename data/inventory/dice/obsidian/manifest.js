/* Manifest dice.obsidian â€” dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/dice-registry-parity.test.js.
   visual = warna katalog (art.bg/accent/pip/edge) yang dipakai ItemArt/pratinjau; material 3D & efek (partikel/suara) tetap di src/renderers/dice-kit/dice-catalog.js
   (id DiceKit = gameKey). assets kosong: dadu dirender prosedural oleh DiceKit (tanpa berkas gambar per dadu). price/gems = harga tampilan klien (sama dengan nilai ItemCatalog); server tetap otoritas transaksi/saldo/kepemilikan. Kepemilikan & equip TIDAK disimpan di manifest. */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "dice.obsidian",
    kind: "dice",
    gameKey: "obsidian",
    name: "Dadu Obsidian",
    rarity: "epic",
    tier: 4,
    collection: "elemental",
    materialName: "Obsidian",
    price: 30000,
    gems: null,
    starter: false,
    desc: "Dadu obsidian gelap dengan urat ungu dan titik berpendar.",
    visual: {"bg":"#120c1e","accent":"#7a3cff","pip":"#b98cff","edge":"#08050e"},
    assets: {}
});

