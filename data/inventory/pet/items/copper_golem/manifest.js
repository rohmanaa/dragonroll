/* Manifest pet.copper_golem — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/pet-registry-parity.test.js.
   tier/role/accent/colors = field katalog existing. assets.image = gambar kartu pet-page.js di data/inventory/pet/<gameKey>/<gameKey>.png.
   Visual 3D (data/inventory/pet/_shared/js/pet-viewer.js) tidak diduplikasi di sini. assets.sfx = sumber path 3 SFX Pet, urutan = slot 0,1,2 yang diacak PetViewer (playPetSound). */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "pet.copper_golem",
    kind: "pet",
    gameKey: "copper_golem",
    name: "Copper Golem",
    rarity: "uncommon",
    tier: 2,
    role: "Pelindung",
    price: 9000,
    gems: null,
    starter: false,
    desc: "Golem tembaga dengan bercak karat hijau, panel pengukur di dada, dan roda gigi di punggung.",
    visual: {"accent":"#ff9a30","colors":["#c8703a","#3fbf9f","#ffb040"]},
    assets: { image: "data/inventory/pet/items/copper_golem/copper_golem.png", sfx: ["data/inventory/pet/items/copper_golem/sfx/copper-golem-clang.mp3", "data/inventory/pet/items/copper_golem/sfx/copper-golem-steam.mp3", "data/inventory/pet/items/copper_golem/sfx/copper-golem-servo.mp3"] }
});
