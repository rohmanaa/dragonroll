/* Manifest pet.storm_wolf — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/pet-registry-parity.test.js.
   tier/role/accent/colors = field katalog existing. assets.image = gambar kartu pet-page.js di data/inventory/pet/<gameKey>/<gameKey>.png.
   Visual 3D (data/pet/js/pet-viewer.js) tidak diduplikasi di sini. assets.sfx = sumber path 3 SFX Pet, urutan = slot 0,1,2 yang diacak PetViewer (playPetSound). */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "pet.storm_wolf",
    kind: "pet",
    gameKey: "storm_wolf",
    name: "Storm Wolf",
    rarity: "legendary",
    tier: 5,
    role: "Penyerang",
    price: null,
    gems: 1500,
    starter: false,
    desc: "Serigala baja dengan surai duri petir. Awan badai di atasnya menyambar tanah dan surainya secara acak.",
    visual: {"accent":"#7fd0ff","colors":["#5a6a8a","#e8f4ff","#7fd0ff"]},
    assets: { image: "data/pet/items/storm_wolf/storm_wolf.png", sfx: ["data/pet/items/storm_wolf/sfx/storm-wolf-howl.mp3", "data/pet/items/storm_wolf/sfx/storm-wolf-thunder.mp3", "assets/audio/sfx/pet/storm-wolf-zap.mp3"] }
});
