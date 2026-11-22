/* Manifest pet.forest_pup — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/pet-registry-parity.test.js.
   tier/role/accent/colors = field katalog existing. assets.image = gambar kartu pet-page.js di data/inventory/pet/<gameKey>/<gameKey>.png.
   Visual 3D (data/inventory/pet/_shared/js/pet-viewer.js) tidak diduplikasi di sini. assets.sfx = sumber path 3 SFX Pet, urutan = slot 0,1,2 yang diacak PetViewer (playPetSound). */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "pet.forest_pup",
    kind: "pet",
    gameKey: "forest_pup",
    name: "Forest Pup",
    rarity: "common",
    tier: 1,
    role: "Pengendus",
    price: 3000,
    gems: null,
    starter: false,
    desc: "Anak anjing hutan dengan kalung papan kayu. Gerakannya sederhana: bernapas, mengibas ekor, berkedip.",
    visual: {"accent":"#6fd05a","colors":["#b8803f","#f0dcb0","#3fa04a"]},
    assets: { image: "assets/images/ui/pet/forest-pup.webp", sfx: ["data/inventory/pet/items/forest_pup/sfx/forest-pup-bark-burst.mp3", "data/inventory/pet/items/forest_pup/sfx/forest-pup-bark.mp3", "data/inventory/pet/items/forest_pup/sfx/forest-pup-whimper.mp3"] }
});
