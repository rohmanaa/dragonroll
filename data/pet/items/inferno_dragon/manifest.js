/* Manifest pet.inferno_dragon — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/pet-registry-parity.test.js.
   tier/role/accent/colors = field katalog existing. assets.image = gambar kartu pet-page.js di data/inventory/pet/<gameKey>/<gameKey>.png.
   Visual 3D (data/pet/js/pet-viewer.js) tidak diduplikasi di sini. assets.sfx = sumber path 3 SFX Pet, urutan = slot 0,1,2 yang diacak PetViewer (playPetSound). */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "pet.inferno_dragon",
    kind: "pet",
    gameKey: "inferno_dragon",
    name: "Inferno Dragon",
    rarity: "mythic",
    tier: 6,
    role: "Pembakar Ular",
    price: null,
    gems: 3000,
    starter: false,
    desc: "Naga obsidian dengan retakan lava di dada. Setiap beberapa detik rahangnya terbuka dan menyemburkan api.",
    visual: {"accent":"#ff4a3a","colors":["#1b0a10","#a0182c","#ff7a18"]},
    assets: { image: "data/pet/items/inferno_dragon/inferno_dragon.png", sfx: ["data/pet/items/inferno_dragon/sfx/inferno-dragon-roar.mp3", "assets/audio/sfx/pet/inferno-dragon-fire.mp3", "data/pet/items/inferno_dragon/sfx/inferno-dragon-wings.mp3"] }
});
