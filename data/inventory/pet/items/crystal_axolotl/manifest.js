/* Manifest pet.crystal_axolotl — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/pet-registry-parity.test.js.
   tier/role/accent/colors = field katalog existing. assets.image = gambar kartu pet-page.js di data/inventory/pet/<gameKey>/<gameKey>.png.
   Visual 3D (data/inventory/pet/_shared/js/pet-viewer.js) tidak diduplikasi di sini. assets.sfx = sumber path 3 SFX Pet, urutan = slot 0,1,2 yang diacak PetViewer (playPetSound). */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "pet.crystal_axolotl",
    kind: "pet",
    gameKey: "crystal_axolotl",
    name: "Crystal Axolotl",
    rarity: "rare",
    tier: 3,
    role: "Penyembuh",
    price: 25000,
    gems: null,
    starter: false,
    desc: "Axolotl berwarna es dengan kristal tumbuh di punggung dan permata di dahi. Mengambang pelan di atas panggung.",
    visual: {"accent":"#40e8f4","colors":["#8fe8f2","#d8fbff","#ff9ad8"]},
    assets: { image: "data/inventory/pet/items/crystal_axolotl/crystal-axolotl.webp", sfx: ["data/inventory/pet/items/crystal_axolotl/sfx/crystal-axolotl-bubble.mp3", "data/inventory/pet/items/crystal_axolotl/sfx/crystal-axolotl-chime.mp3", "data/inventory/pet/items/crystal_axolotl/sfx/crystal-axolotl-squeak.mp3"] }
});
