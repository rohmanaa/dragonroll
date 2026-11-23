/* Manifest pet.arcane_owl — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/pet-registry-parity.test.js.
   tier/role/accent/colors = field katalog existing. assets.image = gambar kartu pet-page.js di data/inventory/pet/<gameKey>/<gameKey>.png.
   Visual 3D (data/inventory/pet/_shared/js/pet-viewer.js) tidak diduplikasi di sini. assets.sfx = sumber path 3 SFX Pet, urutan = slot 0,1,2 yang diacak PetViewer (playPetSound). */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "pet.arcane_owl",
    kind: "pet",
    gameKey: "arcane_owl",
    name: "Arcane Owl",
    rarity: "epic",
    tier: 4,
    role: "Peramal",
    price: 60000,
    gems: null,
    starter: false,
    desc: "Burung hantu bertengger di gugus amethyst. Dua cincin rune berputar berlawanan di belakang kepalanya.",
    visual: {"accent":"#b46af0","colors":["#6a4a7a","#b46af0","#ffd24a"]},
    assets: { image: "data/inventory/pet/items/arcane_owl/arcane-owl.webp", sfx: ["data/inventory/pet/items/arcane_owl/sfx/arcane-owl-hoot.mp3", "data/inventory/pet/items/arcane_owl/sfx/arcane-owl-sparkle.mp3", "data/inventory/pet/items/arcane_owl/sfx/arcane-owl-flap.mp3"] }
});
